-- Burako — Torre semanal v2: cofres con loot diferido (bloque 2).
--
-- Diferencia clave con el resto de Torre: el premio de piso (coins/xp, y el
-- ítem fijo de los pisos 9/10 de la Torre I) se paga íntegro al momento de
-- ganar, vía reward_grants (sin cambios). El COFRE es un premio ADICIONAL,
-- separado, cuyo contenido se sortea una sola vez -- en el mismo instante
-- en que se superó el piso (ver createTowerChest en server/db.js) -- pero
-- NO se le muestra al jugador ni se aplica a su cuenta hasta que elige
-- abrirlo. Por eso necesita tabla propia: reward_grants no tiene lugar
-- para "algo que ya está decidido pero todavía no se reveló ni se aplicó".
create table public.tower_chests (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tower_id smallint not null check (tower_id in (1, 2, 3)),
  week_id text not null,
  floor smallint not null check (floor >= 1 and floor <= 10),
  tier text not null check (tier in ('kombatiente', 'reino', 'ancestral', 'conquistador', 'titan')),
  -- Ya sorteado en el momento del insert (ver rollTowerChestRewards) -- abrir
  -- el cofre NUNCA vuelve a tirar RNG, solo revela esto y lo aplica.
  rewards jsonb not null,
  opened boolean not null default false,
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  -- Un solo cofre por piso por semana por jugador -- igual que un solo
  -- reward_grants por floor/weekId, mismo criterio de idempotencia.
  unique (profile_id, tower_id, week_id, floor)
);
create index tower_chests_pending_idx on public.tower_chests (profile_id, opened);

-- Cerrada por defecto, sin políticas -- mismo criterio que el resto del
-- esquema (initial_schema.sql, tower_lives): el Service Role Key (Node)
-- bypassa RLS siempre, esto es solo defensa en profundidad.
alter table public.tower_chests enable row level security;
