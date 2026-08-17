-- Burako — esquema inicial (Etapa 2 de la integración backend)
-- Ver docs/backend/01-architecture.md para el diseño completo y el porqué de
-- cada decisión. Node (Service Role Key) es el único cliente de estas tablas;
-- el navegador/Android nunca las toca directo (ver RLS al final del archivo).

-- ============================================================
-- profiles — 1:1 con auth.users, la identidad real de cara al jugador
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  avatar text not null default '🀄',
  coins integer not null default 0,
  xp integer not null default 0,
  rank_pts integer not null default 1000,
  galactico_xp integer not null default 0,

  -- estadísticas (columnas simples, no tabla aparte: es 1:1, siempre se leen/
  -- escriben juntas — ver justificación en docs/backend/01-architecture.md §3)
  games integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  streak integer not null default 0,
  best_streak integer not null default 0,
  ranked_games integer not null default 0,
  ranked_wins integer not null default 0,

  -- cosmético actualmente equipado por categoría (uno solo por categoría,
  -- no hace falta tabla aparte para esto)
  active_skin text not null default 'clasica',
  active_tapete text not null default 'clasico',
  active_effect text not null default 'clasico',
  active_soundfx text not null default 'clasico',
  active_trail text not null default 'clasica',
  active_nameeffect text,
  active_banner text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint username_length check (char_length(username) between 2 and 24)
);

-- Username único sin distinguir mayúsculas/minúsculas (igual que el sistema
-- viejo, que usaba username.toLowerCase() como clave).
create unique index profiles_username_lower_idx on public.profiles (lower(username));

-- updated_at automático en cada UPDATE
create function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crear la fila de profiles automáticamente cuando Node da de alta un usuario
-- en Supabase Auth (auth.admin.createUser con user_metadata.username) — así
-- el perfil siempre existe atómicamente junto con la cuenta, sin depender de
-- que Node haga un segundo INSERT por separado que podría fallar a mitad de camino.
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, avatar)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'Jugador'),
    coalesce(new.raw_user_meta_data->>'avatar', '🀄')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- inventory_items — reemplaza los arrays sueltos (skins[], tapetes[], ...)
-- ============================================================
create table public.inventory_items (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('skin','tapete','effect','soundfx','trail','avatar','nameeffect','banner')),
  item_id text not null,
  acquired_at timestamptz not null default now(),
  unique (profile_id, item_type, item_id)
);
create index inventory_items_profile_idx on public.inventory_items (profile_id);

-- ============================================================
-- profile_achievements — el catálogo (nombre/desc/criterio) sigue en el
-- cliente como hoy; acá solo se guarda CUÁLES desbloqueó cada jugador.
-- ============================================================
create table public.profile_achievements (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (profile_id, achievement_id)
);

-- ============================================================
-- pass_claims — reemplaza passClaimed{level:true} / galactico.claimed{...}
-- ============================================================
create table public.pass_claims (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  pass_type text not null check (pass_type in ('season','galactico')),
  level integer not null,
  claimed_at timestamptz not null default now(),
  primary key (profile_id, pass_type, level)
);

-- ============================================================
-- seasons — mínimo, preparado para temporadas/matchmaking futuro sin
-- implementarlo todavía (pedido explícito: no cerrar la arquitectura).
-- ============================================================
create table public.seasons (
  id bigint generated always as identity primary key,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz
);

alter table public.pass_claims
  add column season_id bigint references public.seasons(id);

-- ============================================================
-- matches / match_participants — historial de partidas (sección 19 del
-- pedido original): solo el resultado final, nunca estado intermedio.
-- ============================================================
create table public.matches (
  id bigint generated always as identity primary key,
  room_code text,
  game_mode text not null,
  ranked boolean not null default false,
  started_at timestamptz not null,
  ended_at timestamptz not null default now()
);

create table public.match_participants (
  id bigint generated always as identity primary key,
  match_id bigint not null references public.matches(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  place integer not null,
  score integer not null default 0,
  surrendered boolean not null default false,
  xp_gained integer not null default 0,
  coins_gained integer not null default 0,
  rank_delta integer not null default 0
);
create index match_participants_match_idx on public.match_participants (match_id);
create index match_participants_profile_idx on public.match_participants (profile_id);

-- ============================================================
-- RLS — todas las tablas cerradas por defecto. El Service Role Key (Node)
-- las ignora siempre (bypassa RLS por diseño de Supabase), así que estas
-- políticas solo importan si algún día el cliente llega a hablar con
-- Supabase directo con una sesión de usuario — hoy no lo hace (ver
-- docs/backend/01-architecture.md §2), esto es defensa en profundidad.
-- ============================================================
alter table public.profiles enable row level security;
alter table public.inventory_items enable row level security;
alter table public.profile_achievements enable row level security;
alter table public.pass_claims enable row level security;
alter table public.seasons enable row level security;
alter table public.matches enable row level security;
alter table public.match_participants enable row level security;

-- Único permiso abierto a un usuario autenticado: leer SU PROPIA fila de
-- profiles (útil a futuro para un leaderboard o vista propia sin pasar por
-- Node). Nada de INSERT/UPDATE/DELETE para anon/authenticated en ninguna
-- tabla — todas las escrituras pasan por Node con la Service Role Key.
create policy "profiles: leer la fila propia"
  on public.profiles for select
  using (auth.uid() = id);

create policy "seasons: lectura pública"
  on public.seasons for select
  using (true);
