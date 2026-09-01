-- Burako — Torre semanal v2: 3 Torres (Violeta/Roja/Dorada) x 10 pisos.
--
-- El progreso de pisos sigue derivándose de reward_grants sin tabla nueva
-- (source_id pasa de "{weekId}:{floor}" a "{weekId}:{towerId}:{floor}"),
-- exactamente el mismo criterio que ya se usó para la Torre de un solo
-- tramo — no hace falta migrar nada histórico porque el progreso siempre
-- se lee scopeado por weekId (una semana pasada nunca se vuelve a
-- consultar), y los cosméticos ya ganados (torre_relampago/torre_celestial)
-- viven en inventory_items, sin relación con este cambio de formato.
--
-- Lo único que SÍ necesita estado nuevo son las vidas: perder un piso no
-- genera ninguna fila en reward_grants (no hay nada que otorgar), así que
-- no hay ledger del que derivarlo. Ausencia de fila = 3 vidas disponibles
-- (default implícito del lado de la app); la fila recién se crea la
-- primera vez que el jugador pierde en esa Torre esa semana.
create table if not exists public.tower_lives (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tower_id smallint not null check (tower_id in (1, 2, 3)),
  week_id text not null,
  lives_remaining smallint not null default 3 check (lives_remaining >= 0 and lives_remaining <= 3),
  updated_at timestamptz not null default now(),
  primary key (profile_id, tower_id, week_id)
);

-- Cerrada por defecto, sin políticas — mismo criterio que el resto del
-- esquema (initial_schema.sql): el Service Role Key (Node) bypassa RLS
-- siempre, así que esto solo es defensa en profundidad para si algún día
-- el cliente hablara directo con Supabase (hoy no lo hace).
alter table public.tower_lives enable row level security;

-- Única escritura real sobre esta tabla: perder una partida de Torre.
-- Atómico en una sola llamada (crea la fila con 3 vidas si no existía
-- todavía esta semana para esa Torre, y descuenta 1 sin bajar de 0) para
-- no depender de un read-modify-write desde Node con su propia carrera.
-- Devuelve las vidas que quedaron.
create or replace function public.tower_lose_life(
  p_profile_id uuid,
  p_tower_id smallint,
  p_week_id text
) returns smallint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lives smallint;
begin
  insert into tower_lives(profile_id, tower_id, week_id, lives_remaining)
    values (p_profile_id, p_tower_id, p_week_id, 3)
    on conflict (profile_id, tower_id, week_id) do nothing;

  update tower_lives
    set lives_remaining = greatest(0, lives_remaining - 1), updated_at = now()
    where profile_id = p_profile_id and tower_id = p_tower_id and week_id = p_week_id
    returning lives_remaining into v_lives;

  return v_lives;
end;
$$;
