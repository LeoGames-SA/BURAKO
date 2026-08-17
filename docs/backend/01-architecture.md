# Burako — Arquitectura Backend (Supabase + Node + Render)

Etapa 1 de la integración online pública. Ver `CHANGELOG.md` para el historial de UX;
este doc cubre infraestructura/backend exclusivamente.

```
                SUPABASE
        Auth + Postgres + persistencia
                 ▲
                 │  (Service Role Key — solo acá)
                 │
        NODE GAME SERVER
        servidor autoritativo
        WebSocket + lógica de juego
                 ▲
                 │
             Internet (wss://)
                 │
        ┌────────┴────────┐
        ▼                 ▼
       WEB              ANDROID
```

## 1. Estado actual (auditoría, previo a esta fase)

- Servidor: `server/server.js` (Node + `ws`, único dependency externa hoy).
  Escucha en `process.env.PORT || 8181`, sin host fijo → ya compatible con Render.
- Persistencia: `server/players.json`, leído/escrito ENTERO en cada operación vía
  `server/db.js` (`load()`/`save()` — `fs.readFileSync`/`writeFileSync` sin locking,
  sin cache compartida). `db.js` ya expone una interfaz limpia por función
  (`register`, `login`, `buyItem`, `setActive`, `claimPass`, `claimGalacticoPass`,
  `reserveBet`, `creditCoins`, `resolveMatch`, `checkLive`, `setAvatar`) — el plan es
  reescribir el INTERIOR de estas funciones contra Supabase, manteniendo la firma,
  para no tener que tocar `server.js` en la mayoría de los call-sites.
- Forma de un perfil hoy (`players.json`, clave = `username.toLowerCase()`):
  ```
  username, passwordHash (SHA-256 sin salt),
  rankPts, coins, xp, avatar,
  inventory: { skins[], tapetes[], effects[], soundfx[], trails[], avatars[], nameeffects[], banners[] },
  active:    { skin, tapete, effect, soundfx, trail, nameeffect, banner },
  stats:     { games, wins, losses, streak, bestStreak, totalCoinsEarned, totalXpEarned, rankedGames, rankedWins },
  achievements: { [achievementId]: unlockedAtMs },
  passClaimed:  { [level]: true },
  galactico:    { xp, claimed: { [level]: true } },
  createdAt, updatedAt
  ```
- Auth hoy: sin sesión/token — `authUser` vive en memoria por conexión WebSocket,
  nunca se re-valida. El cliente reconecta reenviando `{type:"login"}` con la
  contraseña — que además **guarda en texto plano en localStorage**
  (`burako_lan_pass`) para poder hacerlo solo. Mismo username puede abrir 2
  sesiones sin control fuera del flujo de `rejoin`.
- `finishMatch`/`resolveMatch` no son atómicos entre sí: un jugador que se rinde
  dispara su propio `resolveMatch` aparte del `finishMatch` final del resto de la
  sala — un crash a mitad deja el resultado a medias.
- Bots (`username:null`) nunca tocan persistencia — no necesitan tratamiento especial.
- Cliente (`client/burako.js`) construye el socket con `new WebSocket("ws://"+host)`
  — **esquema hardcodeado**, único bloqueo real para `wss://` detrás de HTTPS
  (mixed content). Ya soporta dos formas de elegir `host`: automática
  (`location.host`) y manual (campo `#nethost`, para LAN) — ambas quedan.

## 2. Decisión de autenticación: Node como único cliente de Supabase

El navegador/WebView **nunca** habla con Supabase directo. El cliente sigue
mandando `{type:"register"/"login", username, password}` por el WebSocket —mismo
mensaje que hoy, mínimo cambio de UI—. Node, usando la **Service Role Key** (nunca
sale del servidor), llama a la API de Supabase Auth por su cuenta:

- Username no es email → se sintetiza uno interno: `{username}@users.burako.internal`.
  El username real vive en `profiles.username` (único, indexado), es la identidad
  de cara al jugador siempre.
- `register` → Node llama `supabase.auth.admin.createUser({email, password, ...})`.
- `login` → Node llama al endpoint de password grant de Supabase Auth con ese email
  sintético + la contraseña que mandó el cliente. Devuelve `access_token` +
  `refresh_token` reales de Supabase.
- Node devuelve al cliente un `refreshToken` para persistir en vez de la
  contraseña — reconexión (`rejoin`) lo valida contra Supabase en vez de re-mandar
  password. Arregla el hallazgo de seguridad de la contraseña en texto plano.
- Ventaja sobre que el cliente hable directo con Supabase: cero SDK/credenciales de
  Supabase en el bundle web ni en el APK — todas las credenciales viven solo en el
  servidor, cumpliendo el pedido de no exponer secretos en frontend/APK/repo de la
  forma más estricta posible (ni siquiera la clave pública `anon` viaja al cliente).

## 3. Esquema Postgres (Supabase)

Migraciones SQL versionadas en `supabase/migrations/`, reproducibles. Nombres
orientativos — se pueden ajustar en la implementación real sin romper este diseño:

| Tabla | Contenido | Notas |
|---|---|---|
| `profiles` | 1:1 con `auth.users.id`. `username` (único), `avatar`, `coins`, `xp`, `rank_pts`, `galactico_xp`, `games/wins/losses/streak/best_streak/ranked_games/ranked_wins`, `active_skin/active_tapete/active_effect/active_soundfx/active_trail/active_nameeffect/active_banner`, timestamps | Stats como columnas simples (no tabla aparte) — son 1:1, siempre se leen/escriben juntas |
| `inventory_items` | `profile_id, item_type, item_id, acquired_at` | Reemplaza los 7 arrays sueltos (`skins[]`, `tapetes[]`, ...) por una tabla normalizada. `UNIQUE(profile_id,item_type,item_id)` |
| `profile_achievements` | `profile_id, achievement_id, unlocked_at` | El catálogo (nombre/desc/criterio) sigue en el cliente como hoy — acá solo qué desbloqueó cada uno |
| `pass_claims` | `profile_id, pass_type ('season'|'galactico'), level, claimed_at` | Reemplaza `passClaimed`/`galactico.claimed`. `UNIQUE(profile_id,pass_type,level)` |
| `matches` | `id, room_code, game_mode, ranked, started_at, ended_at` | Historial — sin guardar estado intermedio, solo el resultado |
| `match_participants` | `match_id, profile_id, place, score, surrendered, xp_gained, coins_gained, rank_delta` | Join de `matches` — soporta "partidas recientes/oponentes/resultado" (pedido) |
| `seasons` | `id, name, starts_at, ends_at` | Mínimo, FK nullable desde `pass_claims` — preparado para temporadas/matchmaking futuro sin implementarlo aún |

**Ranked Offline NO entra a Supabase.** Sigue siendo 100% local (`PO` +
`localStorage`, ya construido) — nunca sincroniza, por diseño explícito.

### Migración aplicada (Etapa 2)

`supabase/migrations/20260817174905_initial_schema.sql` — crea las 7 tablas de
arriba, `profiles_username_lower_idx` (username único sin distinguir
mayúsculas), el trigger `handle_new_user` (crea la fila de `profiles`
automáticamente al dar de alta un usuario en `auth.users`, leyendo
`username`/`avatar` de `user_metadata` — atómico, sin depender de un segundo
INSERT desde Node) y `set_updated_at`. Aplicada con `supabase db push` contra
el proyecto real; confirmada con `supabase migration list` (local y remoto
coinciden, sin drift).

### Paso manual que no se pudo automatizar

La CLI de Supabase necesita autenticarse contra la cuenta antes de poder
`link`/`db push` — no hay forma de evitar este paso una única vez por máquina/
entorno. Se resolvió con un **Personal Access Token** (`SUPABASE_ACCESS_TOKEN`
en `server/.env`, generado en supabase.com/dashboard/account/tokens) en vez de
`supabase login` interactivo — así queda scripteable para CI/Render más
adelante sin depender de un navegador. Es el único paso de esta etapa que
exigió una acción manual tuya (generar el token); todo lo demás (init, migración,
push, verificación) corrió por CLI/scripts.

## 4. RLS (Row Level Security)

Todas las tablas con RLS activo.

- **Escritura**: solo Service Role (Node) — bloqueada para roles `anon`/`authenticated`.
  El cliente nunca escribe directo a Supabase (ni loguín logueado ni anónimo).
- **Lectura**: `profiles` permite `SELECT` de la fila propia (`auth.uid() = id`) por
  si en el futuro se agrega una vista propia o leaderboard desde el cliente
  directamente; el resto de las tablas cerradas por defecto hasta necesitarlo.

## 5. Variables de entorno

`server/.env` (nunca commiteado — ver `.gitignore`), con `server/.env.example`
versionado como plantilla:

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PORT=8181
```

Desarrollo = `.env` local apuntando a un proyecto Supabase (puede ser el mismo de
producción o uno de pruebas, a definir). Producción (Render) = las mismas
variables cargadas como env vars del servicio en el dashboard de Render, nunca en
código. El cliente no necesita ninguna env var de Supabase (ver §2) — solo necesita
saber a qué host/URL de Node conectarse, que ya resuelve solo (`location.host`) o
manualmente (`#nethost`).

## 6. Migración de datos existentes — ✅ hecho (Etapa 3)

`server/scripts/migrate-players-to-supabase.mjs`: lee `players.json` (nunca lo
escribe), por cada jugador crea su `auth.users` (email sintético
`{username}@users.burako.internal`, contraseña temporal aleatoria — ver
"contraseñas" abajo), y llena `profiles`/`inventory_items`/
`profile_achievements`/`pass_claims` con sus valores reales. Idempotente:
si el username ya existe en Supabase lo saltea en vez de duplicar, así se
puede correr de nuevo sin miedo. Resultado real: **16/16 jugadores migrados,
0 fallidos**.

`server/scripts/validate-migration.mjs`: compara CADA jugador de
`players.json` contra su fila en Supabase, campo por campo (perfil, stats,
cosméticos activos, inventario completo, logros con timestamp, pase/galáctico
reclamados) + un chequeo inverso (¿hay algo en Supabase que no esté en el
origen?). Resultado real: **16/16 coinciden exactamente, 0 diferencias, 0
perfiles huérfanos.**

`players.json`/`db.js` NO se tocan ni se borran — siguen siendo la fuente que
usa el juego en vivo hoy. Antes de correr la migración se hace un backup con
timestamp + checksum del `players.json` de ese momento
(`server/players.json.bak-pre-migration-*`, gitignoreado por tener datos
reales de usuarios).

**Contraseñas — plan de migración perezosa para la Etapa 4**: las contraseñas
originales (SHA-256 sin salt) no son recuperables a texto plano, así que cada
cuenta migrada arranca con una contraseña temporal aleatoria en Supabase Auth
que nadie conoce. En vez de forzar un reset masivo, la Etapa 4 va a
implementar login con fallback: intenta contra Supabase Auth primero: si
falla, compara la contraseña ingresada contra el hash SHA-256 viejo (todavía
disponible en `players.json`) — si coincide, actualiza la contraseña en
Supabase Auth a la correcta vía Admin API y deja pasar. Cada usuario migra su
contraseña solo, en su primer login real, sin darse cuenta.

## 7. Roadmap de etapas (pedido explícito del usuario, no repetir explicaciones largas)

1. ✅ Auditoría + arquitectura (este documento).
2. ✅ **Infraestructura Supabase + conexión real probada** (CLI, migraciones,
   SDK instalado, test de lectura/escritura real contra el proyecto real).
   Todavía NO incluye: reescribir `db.js` ni el flujo de auth de
   `server.js` — eso queda para la Etapa 4, a propósito, para poder migrar
   los datos primero (Etapa 3) contra un esquema ya probado.
3. ✅ **Migración de `players.json` → Supabase** (16/16 migrados, 16/16
   validados campo por campo, 0 diferencias — ver §6). `players.json`/`db.js`
   siguen siendo la fuente en vivo, sin tocar.
4. ✅ **`db.js` reescrito contra Supabase + login con migración perezosa de
   contraseña**. Supabase es ahora la fuente principal para login/perfil/
   monedas/XP/ranking/inventario/logros/pases; `players.json` queda solo
   como fallback de solo-lectura para migrar la contraseña de cuentas viejas
   en su primer login post-Etapa 4 (ver §6 y §8). `server.js` se adaptó al
   mínimo necesario: los ~18 call-sites de `DB.*` pasaron a `await`, y
   `finishMatch`/`forfeitPlayer`/`reportLiveAchievements` pasaron a `async`
   sin tocar sus ~15 puntos de llamada (todos "fire-and-forget" seguros,
   confirmado revisando que ninguno depende de su resultado sincrónico).
   Probado real de punta a punta (`npm run test:auth`, servidor real +
   Supabase real, ver §8) — no se avanza a Render/GitHub producción todavía.
5. Deploy en Render — esquema dinámico `ws://`/`wss://` en el cliente, `render.yaml`.
6. Web + Android probados contra producción real.
7. Reconexión/resiliencia (multi-tab, timeout, sockets huérfanos).
8. Testing real de punta a punta con dos dispositivos/redes distintas.

## 8. Resultado de la Etapa 4 (`db.js` + auth de `server.js`)

**Backups antes de tocar**: `db.js.bak-pre-supabase-auth-<ts>`,
`server.js.bak-pre-supabase-auth-<ts>` en `server/` (gitignorados).

**Diseño de acceso a datos**: cada función mutadora (`buyItem`, `setActive`,
`claimPass`, `claimGalacticoPass`, `reserveBet`, `creditCoins`, `setAvatar`,
`resolveMatch`, `checkLive`) sigue el mismo patrón: trae la fila de
`profiles` (+ `inventory_items`/`profile_achievements`/`pass_claims`) y la
convierte al mismo shape en memoria que usaba `players.json`, corre la
lógica de negocio **sin cambios** (misma matemática de XP/monedas/rango/
logros que ya estaba probada), y guarda de vuelta con un `UPDATE` de los
campos escalares de `profiles` + un `upsert(..., {ignoreDuplicates:true})`
de las colecciones (inventario/logros/pases son de solo-agregar, así que no
hace falta diffear). `resolveMatch` procesa a cada jugador de forma
independiente: si Supabase falla para uno, ese jugador no recibe su
`update` (se loguea el error) pero no arrastra ni corrompe el resultado de
los demás.

**Bug real encontrado y corregido durante las pruebas** (no cosmético):
llamar `auth.signInWithPassword()` sobre el mismo cliente de Supabase que
usa la Service Role Key para todo el resto del servidor mutaba la sesión
interna de ESE cliente compartido — cualquier login exitoso downgradeaba
todas las queries siguientes de **cualquier jugador** de service-role a la
sesión RLS-limitada de quien acababa de loguearse, rompiendo lecturas/
escrituras de otros usuarios en simultáneo. Se corrigió usando un cliente
Supabase nuevo y descartable solo para verificar la contraseña
(`freshAuthClient()` en `db.js`), sin tocar el cliente compartido. Se
encontró y arregló gracias a la prueba de punta a punta real, no habría
aparecido con pruebas sintéticas de un solo usuario.

**Columnas agregadas**: `total_coins_earned`/`total_xp_earned` (migración
`20260817182417_add_earned_totals.sql`) — existían en `players.json`
(`stats.totalCoinsEarned/totalXpEarned`, expuestos en `publicProfile()`)
pero no se habían incluido en el esquema inicial de la Etapa 2. Se
agregaron y se completó su valor real para los 16 usuarios ya migrados
(`scripts/backfill-earned-totals.mjs`).

**Bono de bienvenida (`WELCOME_BONUS_COINS`)**: no se portó como chequeo en
cada login — los 16 usuarios migrados ya lo tenían aplicado en su saldo
antes de la Etapa 3 (confirmado por `validate-migration.mjs`), y los
usuarios nuevos lo reciben una sola vez en `register()`. No hay columna
`bonus_v11_given` en el esquema porque ya no hace falta re-chequearlo.

**Gap conocido, no portado (a evaluar si hace falta)**: `pendingAlert`
(aviso pendiente de una sola entrega, ej. una sanción) existía en el
`login()` viejo pero no tiene columna en el esquema nuevo — no hay evidencia
de que esté en uso activo hoy. Si hace falta reintroducirlo, es una tabla
chica (`profile_id`, `msg`, `delivered_at`) + una lectura en `login()`.

**Probado (real, contra Supabase real, servidor real corriendo)**
`npm run test:auth` (`server/scripts/test-etapa4-auth.mjs`), con el server
en `localhost:8181`:
- ✅ Usuario "legacy ya migrado" (existe en `players.json` con hash SHA-256
  Y en Supabase con contraseña Auth aún sin setear — mismo estado que los
  16 reales) + contraseña incorrecta → rechazado.
- ✅ Mismo usuario + contraseña correcta → login OK, dispara la migración
  perezosa (`auth.admin.updateUserById`), logueada sin exponer la
  contraseña (`[auth-migration] contraseña migrada... usuario: X`).
- ✅ Se quita al usuario de `players.json` por completo y se vuelve a
  loguear con la misma contraseña → sigue funcionando (confirma que ya NO
  depende del hash viejo tras la primera migración).
- ✅ Registro de usuario nuevo → bono de bienvenida + saldo inicial
  correctos.
- ✅ Compra de un ítem → aparece en la respuesta inmediata.
- ✅ Cierre de conexión + reconexión (nuevo login) → la compra y el saldo
  siguen exactamente iguales en Supabase.
- ✅ `players.json` real verificado byte-a-byte idéntico antes/después
  (md5sum + comparación de contenido) — el script usa un usuario de prueba
  temporal que se agrega y se quita del archivo real durante la corrida,
  restaurado en un `finally` que corre pase lo que pase.
- ✅ Los 16 usuarios reales migrados en Etapa 3 siguen validando 16/16 sin
  diferencias tras estas pruebas (`npm run validate:migration`, vuelto a
  correr después).

**No probado todavía / fuera del alcance de esta etapa** (para no
sobre-afirmar cobertura):
- Login real de uno de los 16 usuarios reales con su contraseña real — no
  se conoce ninguna contraseña real de un jugador existente, así que la
  prueba usó un usuario sintético en el mismo estado exacto (en
  `players.json` + en Supabase, contraseña Auth aún no seteada). El
  mecanismo probado es idéntico al que van a atravesar los 16 reales en su
  próximo login.
- Atomicidad estricta de `resolveMatch` a través de MÚLTIPLES jugadores en
  una misma partida (cada jugador se persiste de forma independiente, no
  hay una transacción Postgres que cubra a los 4 a la vez — si hace falta
  esa garantía más adelante, la vía es una función RPC de Postgres).
- Reconexión de partida en curso (`rejoin`), Render, HTTPS/WSS, dos
  dispositivos en redes distintas — quedan para las etapas siguientes.
