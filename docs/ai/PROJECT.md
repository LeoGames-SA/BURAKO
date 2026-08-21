# BURAKO — Arquitectura del proyecto

> Fuente de verdad: el código real (`server/`, `client/`), auditado el 2026-08-21
> contra el commit `5efe3eb`. Donde este documento contradiga `README.md` o
> `docs/backend/01-architecture.md`, **gana este documento** — esos otros archivos
> quedaron desactualizados en partes (ver nota al final).

## 1. Qué es Burako

Variante uruguaya de Rummikub: 108 fichas (2 sets de 1-13 en 4 colores + 4
comodines), cada jugador arma grupos/escaleras para vaciar su atril. Single-player
contra IA (100% en el cliente, offline) y multijugador online server-authoritative
(web + Android, mismo backend).

## 2. Arquitectura general

```
                    SUPABASE (Postgres + Auth)
                    Persistencia + identidad
                            ▲
                            │  Service Role Key — SOLO en Node,
                            │  nunca sale del servidor
                            │
                    NODE GAME SERVER (server/server.js)
                    servidor autoritativo — WS + HTTP estático
                    rooms en memoria (Map, un solo proceso)
                            ▲
                            │  wss:// (JSON sobre WebSocket)
                            │
                  ┌─────────┴──────────┐
                  ▼                    ▼
             WEB (browser)       ANDROID (Capacitor/WebView)
         mismo client/burako.js   www/ = copia sincronizada
                                  del mismo client/
```

- **Render** (`burako-server.onrender.com`) es el único backend de **producción**
  hoy. **Fly.io** (São Paulo) está desplegado pero **pausado**, sin tráfico real
  (ver §9).
- El cliente es "delgado" en modo online: no aplica reglas, solo manda intenciones
  (`netSend`) y renderiza el estado que le devuelve el servidor (`netApplyState`).
  Offline (`file://` o modo "Casual IA" sin login), toda la lógica corre en el
  navegador contra `burako-core.js`, compartido con el servidor.

## 3. Estructura de carpetas (real)

```
burako-final/
├── CHANGELOG.md              ← historial de versiones (fuente de verdad de STATUS.md)
├── README.md                 ← desactualizado en partes, ver nota final
├── Dockerfile                ← build de server/+client/ para Fly (no usado por Render)
├── render.yaml                ← blueprint del servicio de Render (producción)
├── fly.toml                   ← config de Fly (entorno de prueba, pausado)
├── docs/
│   ├── ai/                    ← este directorio (PROJECT/DECISIONS/STATUS/BACKLOG)
│   ├── backend/                ← 01-architecture.md, 02-render-deploy.md (parcialmente desactualizados)
│   │   └── fly-investigation/  ← logs/resultados de los 3 soak tests de Fly + conclusión
│   └── redesign/               ← auditoría visual / Design DNA (histórico, no funcional)
├── supabase/
│   ├── config.toml
│   └── migrations/             ← esquema SQL versionado (fuente real del schema Postgres)
├── server/
│   ├── server.js                ← servidor autoritativo (WS+HTTP), ~2400 líneas
│   ├── db.js                    ← toda la capa de datos contra Supabase
│   ├── burako-core.js           ← reglas puras (meldInfo, shuffle, IA base) — compartido con el cliente
│   ├── package.json              ← deps: ws, @supabase/supabase-js, dotenv
│   ├── .env / .env.example
│   ├── players.json*             ← LEGACY, solo fallback de migración perezosa de contraseña (ver §7)
│   └── scripts/                  ← todos los tests y scripts one-off (ver §10)
└── client/
    ├── burako.js                 ← todo el cliente: juego, IA offline, red, UI, tienda (~440 KB)
    ├── burako-core.js            ← mismo módulo de reglas que usa el server (copia, no symlink)
    ├── burako.css / burako.html
    ├── sw.js                     ← service worker (cachea para PWA/instalación)
    ├── sync-www.mjs               ← copia client/ → client/www/ para empaquetar en Android
    ├── capacitor.config.json      ← appId com.burako.app, webDir "www"
    └── android/                    ← proyecto Capacitor/Gradle nativo
```

## 4. Cliente web (`client/burako.js`)

Un único archivo grande, sin bundler para el juego en sí (sí hay un `vite.config.js`
para un vendor bundle aparte, `client/vendor/vendor-bundle.js`, ver `client/src/vendor.js`).

- **Máquina de estados de pantalla**: `G.screen` (`menu`, `play`, `shop`, `profile`,
  `netConnect` con sub-pasos, `lobby`, `netSorteo`/`netDealing`, `playing`,
  `gameover`, etc.) — `render()` decide qué pintar.
- **Modo offline vs online**: `isNativeApp()` detecta Capacitor; `G.online` decide
  si las acciones de juego (`layFromRack`, `drawAndPass`, `attachToMeld`,
  `confirmTurn`...) ejecutan lógica local o mandan `netSend()` y esperan `state`.
- **Conexión al backend**:
  - `PROD_BACKEND_HOST = "burako-server.onrender.com"` — hardcodeado, usado como
    default **solo dentro de la app nativa** (`defaultHost()`), porque
    `location.host` no sirve en un WebView de Capacitor. **Si el servicio de
    Render cambia de nombre, hay que actualizar esta constante, commitear y
    generar un APK nuevo** (la web no lo necesita, resuelve `location.host` solo).
  - `wsUrlFor(host)` decide `ws://` vs `wss://` (mixed content en HTTPS obliga
    `wss://`; forzado también en nativo apuntando a producción).
- **Sesión persistente por token** (no contraseña en `localStorage`):
  `SESSION_TOKEN_KEY = "burako_session_token"`, `resumeSessionSilently()` intenta
  reconectar solo con el refresh token guardado, mandando `{type:"resumeSession",
  refreshToken}`. Reemplaza el viejo esquema de reenviar la contraseña.
- **Buffer de estado diferido** (`G._deferStateUntil` / `G._deferredState`):
  agregado en la fase de matchmaking (v1.2.5) para poder mostrar una transición
  UX corta ("¡Partida encontrada!", "Iniciando…") sin que un `"state"` entrante
  fuerce el screen antes de tiempo — `netApplyState()` respeta esta ventana.
- **`GAME_VERSION`** (línea ~5) y **`CHANGELOG`** (array in-app, pantalla de
  Novedades) — deben bumpearse juntos en cada release, junto con `sw.js`
  (`CACHE_VERSION`, ver §11).

## 5. Android (Capacitor)

- `client/android/` es el proyecto Gradle nativo generado por Capacitor.
  `capacitor.config.json`: `appId: com.burako.app`, `webDir: "www"`.
- **`client/www/` es una COPIA generada** por `sync-www.mjs` — nunca se edita a
  mano, se pisa entera en cada sync.
- Receta real de build (confirmada en esta sesión):
  ```bash
  cd client
  node sync-www.mjs && npx cap sync android
  cd android
  JAVA_HOME=<repo>/.tools/jdk-21.0.12+8 ./gradlew assembleDebug
  ```
- El APK apunta siempre a `PROD_BACKEND_HOST` (Render) — nunca se generó ni se
  debe generar un APK apuntando a Fly.
- APKs de referencia versionados sueltos en la raíz del repo (no en `docs/`):
  `burako-v1.2.2-fase1-rewards.apk`, `burako-v1.2.4-reconexion-fix.apk`,
  `burako-v1.2.5-matchmaking-fix.apk`.

## 6. Servidor Node (`server/server.js`)

WebSocket server (`ws`) que también sirve los estáticos de `../client/` por HTTP.
Escucha en `process.env.PORT || 8181`, sin host fijo.

Constantes clave: `TURN_SECONDS=60`, `MAX_LIVES=3`, `MAX_PLAYERS=8`,
`GAME_MODES=["casual","ranked","monedas","team2v2","galactico"]`.

**Protocolo WS actual** (extraído de los `if (msg.type === "...")` reales en
`server.js`, no de README — ese listado quedó parcialmente desactualizado):

Cliente → servidor: `ping`, `register`, `login`, `resumeSession`, `logout`,
`leaderboard`, `listRooms`, `queueJoin`, `queueLeave`, `buyItem`, `setActive`,
`setAvatar`, `claimPass`, `claimGalacticoPass`, `catalog`, `myProfile`, `join`,
`rejoin`, `leaveRoom`, `setSkin`, `setNameCosmetics`, `setReady`, `placeBet`,
`cancelBet`, `setTapete`, `setTeam`, `addAI`, `kickAI`, `roomConfig`, `start`,
`lay`, `layMultiple`, `reorganize`, `attach`, `surrender`, `reveal`, `dealDraw`,
`activity`, `nudgeCancel`, `markTiles`, `draw`, `useAbility`,
`requestAbilityInfo`, `teamAddLoose`, `teamRemoveLoose`, `teamFormGroup`,
`teamDissolveGroup`, `teamAddToGroup`, `teamClearWork`, `teamOpenMeld`,
`teamConfirm`, `teamProposeDraw`, `teamProposeConfirm`, `teamRespond`,
`quickChat`, `sendChat`, `teamChat`.

Servidor → cliente (principales): `authOk`, `error`, `sessionExpired`,
`loggedOut`, `joined`, `state`, `tick`, `toast`, `leaderboard`, `roomList`,
`queueStatus`, `queueMatched`, `matchResult`, `rankUpdate`, `playerActivity`.

**Ciclo de vida de una sala** (manual o por matchmaking — mismo pipeline, ver §7):
`join`/`formMatchmakingRoom` crea la sala → jugadores listos → `start()` /
matchmaking dispara `startGame(room)` → fase `sorteo` (cada jugador revela una
ficha, bots vía `autoReveal`) → `finishSorteo()` ordena por valor y pasa a
`dealing` (reparto de 14 fichas, bots vía `autoDeal`) → fase `playing` (turnos,
timer de 60s, `advanceTurn`) → alguien vacía el atril o se acaba el pozo →
`finishMatch()` centraliza el cierre (ver §8).

## 7. Matchmaking actual (cerrado en v1.2.5)

- `matchQueues = { casual: [], ranked: [] }`, en memoria.
- `MATCHMAKING_TICK_MS=2000` (intervalo del timer que intenta armar salas),
  `MATCH_TARGET_SIZE=4` (techo, nunca se rellena de más), `MATCH_WAIT_TIMEOUT_MS
  =30000`. Todos overrideables por env var.
- **Composición** (`tryMatchQueue`/`formMatchmakingRoom`): mínimo 2, máximo 4.
  4 en cola → arranca ya. Menos de 4 pero se cumplió el timeout → arranca con lo
  que haya (2 o 3, sin bots). Si al timeout queda exactamente 1 humano, se agrega
  **exactamente 1 bot** (nunca relleno hasta 4) — la IA es solo fallback para no
  dejar a una persona sola esperando indefinidamente.
- **Ranked**: misma cola única (no sub-colas por bracket de MMR). Ventana de
  tolerancia de `rank_pts` progresiva: `RANKED_RANGE_BASE=100` +
  `RANKED_RANGE_GROWTH_PER_SEC=40` × segundos de espera del más antiguo en cola;
  al cumplirse el timeout, rango = infinito (agrupa con lo que haya). Mismo
  algoritmo para cuentas nuevas y migradas.
- **Punto delicado ya resuelto, no reintroducir**: `formMatchmakingRoom` corre
  desde el timer global, un contexto de ejecución distinto al de la conexión de
  cada jugador. `room`/`player` son variables de **closure por conexión**
  (declaradas en `wss.on("connection", ws => { let room=null, player=null; ...
  })`), así que código externo a esa closure no puede mutarlas directo. El fix
  es `ws._applyRoomPlayer(room, player)`, un setter colgado de cada conexión al
  abrirla — es el ÚNICO punto de entrada válido para que matchmaking (u otro
  código futuro que arme salas desde fuera del handler de mensajes) setee el
  `room`/`player` reales de esa conexión. Sin esto, sorteo/reparto/jugadas caen
  en silencio en el guard `if (!room || !player) return`.
- Matchmaking reusa el **mismo** `startGame()` que las salas manuales — no hay
  una segunda implementación paralela de sorteo/reparto.
- Landmine menor encontrada en esta auditoría (no confirmado impacto real en
  usuarios, no tocado): el primer `broadcast(room)` que manda
  `formMatchmakingRoom` ocurre ANTES de llamar `startGame()`, cuando
  `room.phase` todavía es `undefined` — el serializador (`stateFor`, línea ~160)
  usa el default `room.phase || "playing"` para ese instante transitorio, así
  que ese único mensaje muestra `phase:"playing"` con `started:false`. El
  `_deferStateUntil` del cliente (§4) parece absorberlo en la práctica, pero
  cualquier script/test que lea `state` sin filtrar por `started` puede
  confundirse con esto (nos pasó auditando este mismo documento).

## 8. Ranked / MMR

- Tiers por `rank_pts` (`TIERS` en `db.js`): Bronce (0), Plata (1500), Oro
  (2500), Platino (3500), Diamante (4500), **Legendario (6000)** — este último
  no está documentado en el README viejo.
- `RANK_DELTAS = { 2: [50,-50], 3: [50,10,-50], 4: [50,30,10,-50] }` — se
  aplica en `resolveMatch` solo si `opts.ranked`.
- **Los bots nunca puntúan ni afectan `rank_pts`/MMR**: `resolveMatch` filtra
  `if (!r.username) return null` — un bot no tiene perfil, se ignora.
- El **fallback de 1 bot cuando queda 1 humano solo tras el timeout aplica
  también en Ranked**, igual que en Casual (decisión confirmada explícitamente
  en esta fase, ver DECISIONS.md) — el bot ocupa un asiento pero nunca
  puntúa ranked.
- `finishMatch`/`forfeitPlayer` son el único lugar que llama a
  `DB.resolveMatch` — centralizado, no hay un segundo camino de cierre de
  partida ranked.

## 9. Fly.io — pausado

Investigado en agosto 2026 como alternativa a Render Free para bajar latencia
para jugadores de Uruguay/LatAm (región `gru`, São Paulo). Resultado completo en
`docs/backend/fly-investigation/README.md`. Resumen:

- Latencia base mejor que Render (~40-160ms vs ~205-260ms en ops sin DB).
- **Inestable** en pruebas largas (20-28 min, WS persistentes reales): 3 soak
  tests mostraron desconexiones código 1006 agrupadas, incluso tras corregir dos
  causas reales (`concurrency.type` mal puesto para WS, bug propio de heartbeat
  bloqueado por el loop de turnos) — ninguna de las dos resolvió el problema.
  `finishMatch` falló en las 3 corridas.
- **Decisión: Render sigue en producción, Fly queda pausado** como entorno de
  prueba, sin endpoint activo, infraestructura preservada (`fly.toml`,
  `Dockerfile`, app `burako-server-gru` con secrets ya cargados) para retomar la
  investigación o abrir un ticket de soporte con Fly usando los logs ya
  guardados.
- **Nunca escalar Fly (ni cualquier otro entorno futuro) por encima de 1
  instancia**: el estado de las salas vive en memoria de un solo proceso Node
  (`rooms = new Map()`).

## 10. Auth / sesiones

- Node es el único cliente de Supabase Auth — el navegador/WebView nunca habla
  con Supabase directo, nunca recibe la Service Role Key ni la clave `anon`.
- Username no es email → se sintetiza `{username}@users.burako.internal`
  (`syntheticEmail`). `register`/`login` en `db.js` llaman a la Admin API de
  Supabase Auth con ese email sintético.
- El servidor devuelve `session.refreshToken` al cliente (nunca la contraseña
  se vuelve a mandar en reconexión) — el cliente lo persiste y lo usa vía
  `resumeSession`.
- **Migración perezosa de contraseña**: cuentas creadas antes de la migración a
  Supabase (16 usuarios originales) tienen su hash SHA-256 viejo disponible como
  fallback de solo-lectura (`players.json`, o en Render vía Secret File montado
  en `/etc/secrets/players.json`, env var `LEGACY_PLAYERS_JSON_PATH`). Login
  intenta Supabase Auth primero; si falla, compara contra el hash viejo y si
  coincide migra la contraseña real a Supabase Auth vía Admin API. Este
  mecanismo deja de ser necesario cuando los 16 originales ya iniciaron sesión
  al menos una vez post-migración.
- **Landmine ya resuelta, no reintroducir**: nunca llamar
  `auth.signInWithPassword()` sobre el cliente Supabase compartido (el que usa
  la Service Role Key para todo lo demás) — mutaba la sesión interna de ese
  cliente y downgradeaba las queries de TODOS los jugadores simultáneos a la
  sesión RLS-limitada de quien acababa de loguearse. El fix (`freshAuthClient()`
  en `db.js`) usa un cliente Supabase nuevo y descartable solo para verificar
  contraseña.
- No hay ningún guard contra dos conexiones simultáneas del mismo usuario
  (multi-tab / multi-dispositivo) — limitación heredada, no reverificada en
  esta auditoría (ver STATUS.md).

## 11. Reward engine (motor de recompensas, Fase 1)

Infraestructura centralizada en `db.js`, pensada para que Ruleta/Misiones/Torre
(no implementadas todavía) no dupliquen lógica de otorgar premios:

- **`claimGrantSlot(profileId, sourceType, sourceId, rewards)`**: gate de
  idempotencia real a nivel DB — un `INSERT` liso a `reward_grants` con
  constraint único; si ya existe, falla con `23505` y se traduce a
  `claimed:false` sin aplicar nada dos veces. Reemplaza el viejo mecanismo
  puramente en-memoria (`player._statsResolved`), que no protegía contra
  reinicios ni reintentos.
- **`grantRewards(username, rewards, source)`**: motor completo para features
  nuevas — aplica `coins`/`xp`/`rank_delta`/items de forma atómica vía el RPC
  Postgres `grant_rewards` (una transacción real, rollback si algo falla a
  mitad).
- **`REWARD_DEFINITIONS = {}`** — catálogo central, a propósito vacío hoy. Es
  donde Ruleta/Misiones/Torre deben agregar sus entradas (`rank_promo_gold`,
  `tower_rank_3`, `daily_first_win`, ...) en vez de hardcodear números mágicos.
- **`checkAchievements`**: 26 logros (`ACHIEVEMENTS` en `db.js`), chequeo puro
  en memoria + un solo `upsert` por lote a `reward_grants` (antes: hasta 26
  round-trips secuenciales — optimizado en la fase de perf de agosto).
- **Slot de "título" ya existe en el esquema** (`inventory_items` tipo `title`,
  `profiles.active_title`) pero **ningún título está definido ni se otorga
  todavía** — es infraestructura sin contenido, ver BACKLOG.md.
- `matches`/`match_participants` (Postgres) **sí se escriben** en cada cierre de
  partida (`ensureMatchRow`/`recordMatchParticipants`) pero **no hay ninguna UI
  de cliente que muestre historial de partidas** — los datos existen, falta
  consumirlos.

## 12. Reglas importantes del juego

- 14 fichas por jugador. Mazo doble automático si la sala supera 4 jugadores
  (modo 8 jugadores, `MAX_PLAYERS=8`).
- **Primera bajada = un único juego que por sí solo sume 30 o más** — no se
  puede sumar el valor de varios juegos chicos para llegar a 30, aunque se
  bajen varios juntos en la misma jugada (alcanza con que UNO de ellos llegue a
  30 solo). Validado igual en `handleLay` (un juego) y `handleLayMultiple`
  (varios).
- Turno de 60s (`TURN_SECONDS`); si se vence, pierde una vida y pasa el turno.
- 3 vidas por partida (`MAX_LIVES`); 0 vidas = eliminado.
- 3 rupturas de comodín por partida (`jokerBreaks`), para tocar un juego que ya
  tiene comodín puesto.
- Gana quien vacía el atril, o si el pozo se acaba, quien tenga menos puntos en
  la mano (`endGameByPoints`) — **solo entre jugadores activos**, nunca cuenta a
  quien ya se rindió/fue eliminado (su mano quedó vacía al pozo, "ganaría"
  artificialmente con 0 puntos si se lo incluyera — bug real, ya corregido,
  Fase 0.5.1).
- **Rendirse (`surrender`) nunca puede ganar la partida** — el ganador sale
  siempre del pool de jugadores activos, aunque el que se rindió terminara con
  0 fichas en la mano.
- Modo `team2v2`: la salida con 30+ es de EQUIPO (si un compañero ya salió, el
  otro no necesita volver a juntar 30). Alternancia estricta Azul/Rojo por
  turno.
- Modo `galactico`: se gana al vaciar las fichas NORMALES; las de habilidad no
  cuentan ni impiden ganar.

## 13. Tests existentes (`server/scripts/`)

Scripts declarados en `package.json` (`npm run <script>`):
`test:supabase`, `test:auth`, `test:e2e`, `test:chat`, `test:chat-ui`.

Otros scripts de test que se corren directo con `node` (no tienen entrada en
`package.json`, pero existen y se usan activamente):
`test-rules.mjs`, `test-ranked.mjs`, `test-rooms.mjs`,
`test-endgame-resolution.mjs`, `test-reward-engine.mjs`, `test-matchmaking.mjs`
(el más nuevo, 20 casos — arma cada sala real hasta fase `"playing"` de verdad,
no solo `started:true`, justo la aserción que hubiera agarrado el bug crítico
de matchmaking desde el principio).

Scripts one-off / de soporte, no tests de regresión:
`migrate-players-to-supabase.mjs`, `validate-migration.mjs`,
`backfill-earned-totals.mjs`, `audit-legacy-users.mjs`, `repro-ghost-meld.mjs`,
`measure-latency.mjs`, `measure-latency-ops.mjs`, `soak-test-fly.mjs` (soak test
de Fly, requiere `TARGET_WS_URL` apuntando a Fly, no correr contra Render).

`test-etapa5-production.mjs` corre contra la URL pública real
(`wss://burako-server.onrender.com` por default, overrideable con
`TARGET_WS_URL`) — usuarios y datos de prueba se crean y se borran de Supabase
real en cada corrida (`[cleanup]` al final). Puede fallar por timeout si Render
está "dormido" (cold start, ver §14) — no es necesariamente un bug, reintentar.

`test-matchmaking.mjs` levanta su PROPIO servidor local (puerto aparte) con
`MATCHMAKING_TICK_MS`/`MATCH_WAIT_TIMEOUT_MS` bajados a milisegundos chicos —
no está pensado para apuntar a producción (los timeouts reales de producción
son 30s).

## 14. Flujo GitHub → Render → APK

1. Commit + push a `origin main`.
2. **Render tiene auto-deploy activado** — no requiere un paso manual de
   "redeploy" además del push (confirmado por el usuario). `render.yaml` define
   el blueprint (`rootDir: server`, `npm install`, `npm start`, health check
   `/`).
3. Variables de entorno / secretos se cargan a mano en el dashboard de Render
   (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) — nunca en el repo.
4. Verificación post-deploy: correr `test:e2e` (`test-etapa5-production.mjs`)
   contra la URL real. **Render Free duerme tras ~15 min sin tráfico** — el
   primer intento post-deploy puede tardar 30-60s en responder (cold start, no
   error) — si un test da timeout de conexión, reintentar antes de asumir que
   algo se rompió.
5. Si hubo cambios de cliente: `cd client && node sync-www.mjs && npx cap sync
   android && cd android && JAVA_HOME=... ./gradlew assembleDebug` → nuevo APK.
   Si SOLO cambió el servidor, no hace falta generar APK nuevo.

## 15. Puntos delicados — resumen de "no romper esto"

1. `room`/`player` son closures por conexión WS — cualquier código que arme
   salas desde fuera del handler de mensajes de esa conexión (matchmaking, y
   cualquier feature futura similar) DEBE usar `ws._applyRoomPlayer`.
2. Nunca escalar ningún backend por encima de 1 instancia — `rooms` vive en
   memoria de un solo proceso.
3. `finishMatch()` es el único punto de cierre de partida — no setear
   `winnerId` directo en otro lado.
4. `resolveMatch` es idempotente vía `matchId` + constraint único en
   `reward_grants` — cualquier llamador nuevo debe pasar `opts.matchId`
   (`ensureMatchDbId`) o pierde esa protección.
5. Bots nunca tienen `username` → nunca tocan Supabase ni puntúan — cualquier
   feature nueva que filtre "solo jugadores reales" debe usar ese mismo check
   (`if (!r.username) return`).
6. Nunca llamar `auth.signInWithPassword()` (ni ningún método que mute sesión)
   sobre el cliente Supabase compartido de `db.js` — usar `freshAuthClient()`.
7. `.dockerignore` necesita `**/` de prefijo en cada patrón (no es recursivo
   como `.gitignore` sin eso) — ya hubo un leak real de `server/.env` por este
   motivo.
8. `PROD_BACKEND_HOST` en `client/burako.js` es la única fuente de verdad de a
   qué backend apunta el APK — si el nombre del servicio de Render cambia, hay
   que actualizar esto y regenerar el APK, la web no se entera sola.
9. `GAME_VERSION` (burako.js) y `CACHE_VERSION` (sw.js) se bumpean SIEMPRE
   juntos — si no, celulares con la app ya instalada quedan con assets viejos
   cacheados indefinidamente.
10. Nunca exponer `SUPABASE_SERVICE_ROLE_KEY` ni `SUPABASE_ACCESS_TOKEN` en
    cliente/APK/repo/logs — viven solo en `server/.env` (local) o el dashboard
    de Render (producción), nunca commiteados.

---

**Nota sobre docs viejos**: `README.md` y `docs/backend/01-architecture.md`
describen etapas anteriores (LAN-only sin Supabase, sin sesión por token, sin
matchmaking, sin motor de recompensas) y quedaron desactualizados en esas
partes — se conservan como historial, pero para arquitectura VIGENTE usar este
archivo. `docs/backend/02-render-deploy.md` sigue vigente (deploy a Render,
limitaciones del plan free).
