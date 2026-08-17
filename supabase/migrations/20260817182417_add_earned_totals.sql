-- Campos informativos de players.json que faltaban en el esquema inicial
-- (stats.totalCoinsEarned / stats.totalXpEarned) — se agregan para no perder
-- compatibilidad con el shape público que ya consume el cliente.
alter table public.profiles
  add column if not exists total_coins_earned integer not null default 0,
  add column if not exists total_xp_earned integer not null default 0;
