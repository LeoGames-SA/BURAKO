-- Burako — Fase 1: infraestructura de recompensas y progresión.
-- Ver docs/backend/01-architecture.md para el diseño previo. Este archivo
-- agrega el motor centralizado de recompensas (idempotente, transaccional)
-- que todos los sistemas futuros (Ranked rewards, Ruleta, Misiones, Torre,
-- Logros) van a reusar en vez de mutar profiles.coins/xp por su cuenta.

-- ============================================================
-- reward_grants — ledger/historial de TODO lo que se otorgó, y el
-- mecanismo real de idempotencia (antes no existía ninguno a nivel DB para
-- coins/xp — el único guard era un flag en memoria de un solo proceso).
-- El unique constraint es lo que garantiza "esta fuente ya pagó a este
-- jugador, no pagar de nuevo" de forma atómica, sin importar reinicios del
-- server, dos requests casi simultáneos, o reintentos del cliente.
-- ============================================================
create table public.reward_grants (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  -- 'match' | 'achievement' | 'pass' | 'pass_galactico' | futuro: 'daily_win' | 'rank_promotion' | 'tower' | 'mission' | 'roulette'
  source_type text not null,
  -- id concreto de la fuente: matchId, achievement.id, nivel de pase, fecha ISO para daily_win, etc.
  source_id text not null,
  -- [{type:'coins',amount}, {type:'xp',amount}, {type:'item',itemType,itemId}, {type:'title',itemId}, {type:'rank_delta',amount}]
  rewards jsonb not null,
  granted_at timestamptz not null default now(),
  unique (profile_id, source_type, source_id)
);
create index reward_grants_profile_idx on public.reward_grants (profile_id, granted_at desc);
alter table public.reward_grants enable row level security;
-- Sin políticas de select/insert para anon/authenticated a propósito — solo
-- Node (Service Role Key) toca esta tabla, mismo criterio que el resto.

-- ============================================================
-- grant_rewards — aplica una lista de recompensas de forma atómica: si algo
-- falla a mitad, Postgres hace rollback de TODO (coins, xp, items, y el
-- registro del ledger) — nunca queda "coins sí, XP sí, skin no". El insert
-- a reward_grants va PRIMERO con "on conflict do nothing": el unique
-- constraint decide atómicamente si es la primera vez, sin el hueco de
-- carrera de "leer si existe, después insertar" (dos llamadas concurrentes
-- para la misma fuente: como mucho UNA gana la fila, la otra no aplica nada).
-- ============================================================
create or replace function public.grant_rewards(
  p_profile_id uuid,
  p_source_type text,
  p_source_id text,
  p_rewards jsonb
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
  insert into reward_grants(profile_id, source_type, source_id, rewards)
  values (p_profile_id, p_source_type, p_source_id, p_rewards)
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

-- ============================================================
-- Títulos: reusan inventory_items (item_type='title') en vez de un segundo
-- inventario, y profiles.active_title mismo patrón que active_skin/etc.
-- ============================================================
alter table public.inventory_items drop constraint if exists inventory_items_item_type_check;
alter table public.inventory_items add constraint inventory_items_item_type_check
  check (item_type in ('skin','tapete','effect','soundfx','trail','avatar','nameeffect','banner','title'));

alter table public.profiles add column if not exists active_title text;

-- ============================================================
-- matches / match_participants existían desde el esquema inicial pero
-- nunca se escribían (0 filas siempre) — de acá en más finishMatch() las
-- llena, dando el historial de partida real que faltaba.
-- ============================================================
-- (sin cambios de esquema acá — las tablas y sus columnas ya estaban listas
-- desde 20260817174905_initial_schema.sql, este comentario documenta el
-- cambio de comportamiento del lado de la aplicación.)
