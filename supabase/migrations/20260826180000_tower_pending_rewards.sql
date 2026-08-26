-- Burako — Torre semanal: premios pendientes de reclamar.
-- Pedido explícito del usuario: ganar un piso NUNCA debe poder perder el
-- premio (ya no se pierde hoy — grant_rewards() ya paga a coins/xp/inventory
-- de forma atómica e idempotente en el mismo instante en que se gana el
-- piso, ver 20260819142555_reward_engine.sql). Lo que faltaba era un rastro
-- PERSISTENTE, server-authoritative, de si el jugador ya vio/reconoció esa
-- recompensa con su animación — para poder mostrar "premio pendiente" en la
-- Torre y no perder ese aviso al cerrar la app/cambiar de dispositivo.
--
-- Diseño: reusar reward_grants (ya es el registro único e idempotente por
-- fuente, exactamente lo que pedía el usuario) en vez de una tabla nueva —
-- una columna `acknowledged` booleana alcanza. Default TRUE a propósito:
-- todo lo que ya se otorgó ANTES de esta migración (Willy, cuentas de
-- prueba, etc.) se considera ya visto — no hay forma de saber retroactivo
-- si el jugador vio o no esa animación, y asumir "pendiente" para cientos
-- de premios viejos sería peor (un montón de badges "premio pendiente"
-- sobre cosas que el jugador ya sabe que tiene hace días/semanas). Solo las
-- recompensas de Torre NUEVAS de acá en más se insertan explícitamente con
-- acknowledged=false (ver el nuevo parámetro p_acknowledged de
-- grant_rewards) hasta que el jugador las abre.
alter table public.reward_grants add column if not exists acknowledged boolean not null default true;

-- grant_rewards() gana un parámetro opcional p_acknowledged (default true,
-- así TODOS los llamadores existentes — match, achievement, pass, ranked —
-- siguen exactamente igual sin tocar una línea de su lado). Solo la Torre
-- lo va a pasar en false para sus propias recompensas de piso.
create or replace function public.grant_rewards(
  p_profile_id uuid,
  p_source_type text,
  p_source_id text,
  p_rewards jsonb,
  p_acknowledged boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant_id bigint;
  v_coins_delta integer := 0;
  v_xp_delta integer := 0;
  v_rank_delta integer := 0;
  v_reward jsonb;
  v_existing record;
begin
  insert into reward_grants(profile_id, source_type, source_id, rewards, acknowledged)
  values (p_profile_id, p_source_type, p_source_id, p_rewards, p_acknowledged)
  on conflict (profile_id, source_type, source_id) do nothing
  returning id into v_grant_id;

  if v_grant_id is null then
    select rewards, granted_at into v_existing
      from reward_grants
      where profile_id = p_profile_id and source_type = p_source_type and source_id = p_source_id;
    return jsonb_build_object('alreadyGranted', true, 'rewards', v_existing.rewards, 'grantedAt', v_existing.granted_at);
  end if;

  for v_reward in select * from jsonb_array_elements(p_rewards) loop
    if v_reward->>'type' = 'coins' then v_coins_delta := v_coins_delta + (v_reward->>'amount')::integer;
    elsif v_reward->>'type' = 'xp' then v_xp_delta := v_xp_delta + (v_reward->>'amount')::integer;
    elsif v_reward->>'type' = 'rank_delta' then v_rank_delta := v_rank_delta + (v_reward->>'amount')::integer;
    end if;
  end loop;

  update profiles set
    coins = coins + v_coins_delta,
    xp = xp + v_xp_delta,
    rank_pts = greatest(0, rank_pts + v_rank_delta),
    total_coins_earned = total_coins_earned + greatest(v_coins_delta, 0),
    total_xp_earned = total_xp_earned + greatest(v_xp_delta, 0)
  where id = p_profile_id;

  for v_reward in select * from jsonb_array_elements(p_rewards) loop
    if v_reward->>'type' = 'item' then
      insert into inventory_items(profile_id, item_type, item_id)
        values (p_profile_id, v_reward->>'itemType', v_reward->>'itemId')
        on conflict (profile_id, item_type, item_id) do nothing;
    elsif v_reward->>'type' = 'title' then
      insert into inventory_items(profile_id, item_type, item_id)
        values (p_profile_id, 'title', v_reward->>'itemId')
        on conflict (profile_id, item_type, item_id) do nothing;
    end if;
  end loop;

  return jsonb_build_object('alreadyGranted', false, 'rewards', p_rewards, 'grantedAt', now());
end;
$$;

-- Marca un grant como reconocido/abierto por el jugador — usado cuando toca
-- el regalo (en el gameover o desde la Torre). Idempotente por diseño: si ya
-- estaba en true, no hace nada raro, solo confirma. Devuelve true si existía
-- el grant (para poder distinguir "ya estaba abierto"/"no existía" del lado
-- de la app si hace falta).
create or replace function public.acknowledge_reward_grant(
  p_profile_id uuid,
  p_source_type text,
  p_source_id text
) returns boolean
language sql
security definer
set search_path = public
as $$
  update reward_grants set acknowledged = true
    where profile_id = p_profile_id and source_type = p_source_type and source_id = p_source_id
  returning true;
$$;
