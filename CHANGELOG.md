# Changelog

Todos los cambios notables del proyecto se documentan en este archivo.

## [1.2.7] - 2026-08-26 — Ruleta diaria y Torre semanal: rediseño + mejoras de UX

Cierre del trabajo de Ruleta diaria/Torre semanal (el CSS de esta feature se
había quedado sin deployar por error en el commit anterior — ver detalle en
`docs/ai/FROM-CLAUDE.md`). Esta versión completa el diseño y suma mejoras
pedidas al ver la primera versión ya en producción:

- **Ambientación mística compartida**: gemas de colores flotando + chispas
  doradas subiendo dentro de las tarjetas de Ruleta/Torre, con los MISMOS
  colores que ya usan las fichas del juego — no colores nuevos.
- **Ruleta diaria — la animación de giro ahora varía de verdad**: el premio
  YA era 100% aleatorio del lado servidor (`crypto.randomInt`), pero la
  animación siempre giraba exactamente 4 vueltas en 1.7s clavado —
  visualmente idéntica cada vez, lo que daba sensación de estar trucada.
  Ahora la cantidad de vueltas (5-7) y la duración (1.6-2.3s) varían en
  cada tirada.
- **Torre semanal — premio de pisos bloqueados oculto**: un piso todavía no
  alcanzado mostraba el monto exacto de entrada, arruinando la sorpresa de
  ir subiendo. Ahora muestra "🎁 ???" con un brillo sutil hasta que lo
  superás — el servidor sigue siendo la única fuente real del premio
  otorgado.
- **Torre semanal — click en cualquier piso centra la vista**: antes solo
  existía el paneo automático al piso actual; ahora tocar cualquier piso
  (bloqueado o no) lo centra con scroll suave, sin cambiar qué piso se
  puede jugar. Se corrigió además una carrera real donde el paneo
  automático podía "ganarle" al click manual del jugador y devolver la
  vista al piso actual justo después.
- **Torre semanal — el premio ahora se "abre" como un regalo**: al superar
  un piso, antes el premio aparecía directo como una línea de texto; ahora
  se muestra una caja de regalo que invita a tocarla, y al abrirla revela
  el monto con el mismo brillo dorado que ya usa el premio de la Ruleta.
- **Menú reordenado**: Ruleta diaria y Torre semanal se mudaron de su
  propia columna a apilarse debajo del Pase de temporada, para que la
  columna derecha del menú quede mejor distribuida.
- **Dato corregido**: una cuenta de prueba tenía un premio de Torre (piso 1)
  de una sesión de pruebas anterior que hacía que ese piso apareciera como
  ya superado sin corresponder — se borró ese registro puntual de Supabase.

## [1.2.6] - 2026-08-26 — Fase 5: validación de sesión/reconexión + 3 bugs críticos reales

Fase 5 del proyecto de remediación de arquitectura de sesión
(`docs/ai/AUDIT-SESSION-ARCHITECTURE.md` / `docs/ai/FROM-CLAUDE.md`) — no era
una fase de features nuevas: el objetivo era validar de punta a punta el
sistema resultante de las Fases 1-4B (Session Manager, Connection Manager,
serialización de mensajes, grace period de lobby) con navegador y servidor
reales, un soak test de reconexiones repetidas, y un smoke test contra la
URL real de producción (Render) tras el deploy. Encontró y corrigió **3
bugs críticos reales de sesión** — dos solo visibles bajo reconexión
sostenida (varios minutos, no un corte puntual) y uno solo visible contra
latencia de red real (nunca se reprodujo en local, donde los round-trips
son sub-milisegundo).

**Bug crítico #1 — un rate-limit de Supabase se confundía con sesión
vencida.** `db.js: resumeSession()` trataba CUALQUIER error que devolviera
`supabase.auth.refreshSession()` como un refresh token inválido — incluido
un `429 "over_request_rate_limit"` (rate-limit propio de la API de Auth,
visto en vivo bajo el soak test). El servidor mandaba `sessionExpired` al
cliente en los dos casos por igual, y el cliente borraba el token guardado y
mandaba al usuario al login — **aunque su sesión fuera perfectamente
válida** y el refresh token ni siquiera se hubiera llegado a consumir.
Corregido distinguiendo el status HTTP del error (`429`/`5xx`/sin status →
transitorio, no borra nada; `4xx` real → expiración de verdad) en
`db.js`, propagando esa distinción en `server.js` (deja de mandar
`sessionExpired` para el caso transitorio), y en `client/burako.js`
(`tryAutoReconnect()` ya no se olvida de la sala guardada ante un fallo
transitorio; `attemptMatchReconnect()` suma un reintento corto acotado).

**Bug crítico #2 — la sala/partida guardada para auto-reconectar
"vencía" a los 3 minutos, sin importar que el jugador siguiera
presente.** `ACTIVE_ROOM_TTL_MS` (3 minutos) se medía desde el join/
creación ORIGINAL de la sala y nunca se refrescaba en reconexiones
exitosas posteriores — así que cualquier partida o sala que durara más de
3 minutos (la inmensa mayoría de las partidas reales) perdía la capacidad
de auto-reconectar a partir de ese punto: el cliente ni siquiera intentaba
el `rejoin` en el próximo corte, aunque el jugador hubiera estado
reconectando con éxito todo ese tiempo. Confirmado en vivo con el soak
test: la pista de lobby pasó de 18 fallas en 29 ciclos a 0 fallas tras el
fix. Corregido refrescando el timestamp guardado en cada rejoin exitoso Y
en cada mensaje `"state"` recibido durante la partida (`client/burako.js`).

**Bug crítico #3 — el guard anti-secuestro de sesión de `rejoin` rechazaba
reconexiones legítimas bajo latencia de red real.** `server.js` rechazaba
un `rejoin` si `existing.ws` apuntaba a "otro" socket — pero cuando la
MISMA sesión reconecta (cierra el viejo, abre uno nuevo), el aviso de
cierre del socket viejo tarda un viaje de red real en llegar al servidor.
Contra Render, el rejoin del socket nuevo llegaba seguido antes de que el
servidor se enterara de que el viejo ya había muerto, y se lo rechazaba
como si fuera un segundo dispositivo — la conexión quedaba autenticada
pero sin sala/jugador server-side, así que `setReady`/`start` se perdían
en silencio. Nunca se reprodujo en ninguna corrida local (round-trips
sub-milisegundo); lo encontró el smoke test recién agregado contra la URL
real de Render. Corregido con un cambio de enfoque: la identidad ya está
confirmada (playerId + mismo username autenticado) antes del guard — el
rejoin más reciente siempre gana la butaca; si había otro socket
realmente activo, se lo avisa y se lo cierra en vez de rechazar al que se
está reconectando de buena fe.

**Validación**: E2E de punta a punta (34/34, corrido varias veces), soak
test de reconexiones repetidas a cadencia realista (10+ minutos sin ninguna
falla en las 3 superficies — menú, lobby, partida — tras los fixes),
regresión completa de Fases 1-4B (Session Manager 11/11, Connection Manager
21/21, serialización de mensajes 10/10, grace period de lobby 18/18),
matchmaking 33/33, salas 5/5, y smoke test con navegador real contra
`https://burako-server.onrender.com` en producción (14/14, corrido varias
veces tras el fix del bug #3: login, cold start, Logros, Perfil, crear
sala, rejoin de lobby, iniciar partida, reconectar en partida, matchmaking,
logout/login, sin falsos "iniciá sesión"). Sin excepciones no atrapadas en
el servidor en ninguna corrida. Android/Capacitor queda explícitamente
pendiente (sin `adb`/emulador disponible en este entorno) — no se dio por
validado WebView solo por navegador. Detalle completo en
`docs/ai/FROM-CLAUDE.md`.

## [1.2.5] - 2026-08-20 — Matchmaking: bug crítico de sorteo/reparto + composición correcta

**Auditoría primero** (pedido explícito: no duplicar lo que ya existía).
Matchmaking Casual/Ranked ya estaba shippeado desde 1.2.3: colas server-side
separadas, botones, backfill con bots, limpieza de fantasmas al cancelar/
desconectar, emparejamiento por MMR en Ranked. Lo que faltaba de verdad:
progreso `N/4` explícito, tiempo estimado, estados de UI claros, ventana de
MMR que se amplía con el tiempo (antes era fija, sin expandirse), y — el
hallazgo más importante — un bug real que rompía el gameplay.

**Bug crítico encontrado (reportado por el usuario jugando una partida
real)**: entrar a una partida por matchmaking mostraba todo bien, pero
`sorteo` y `reparto` no respondían — no se podía tomar la ficha ni recibir
la mano inicial. Causa raíz: `room`/`player` son variables de **closure de
cada conexión WebSocket**, seteadas normalmente adentro del handler de
`"join"` de ESA MISMA conexión. `formMatchmakingRoom()` arma la sala desde
el timer global de matchmaking — un contexto de ejecución totalmente
distinto, sin ningún acceso a esos bindings — así que un jugador emparejado
recibía `"joined"` y veía la sala, pero cualquier acción de juego (`reveal`,
`draw`, `lay`...) pisaba el guard `if (!room || !player) return` de cada
handler y no hacía nada, en silencio. Los tests anteriores no lo agarraron
porque solo chequeaban `started:true` — ese flag ya se pone en `true` ANTES
de entrar a la fase `"sorteo"` (ver `startGame()`), así que una sala
trabada en sorteo para siempre igual pasaba esa aserción.

**Fix**: `ws._applyRoomPlayer(room, player)` — un setter colgado de cada
conexión al abrirla (`wss.on("connection", ...)`), el único punto de
entrada que le permite a código externo al closure (`formMatchmakingRoom`)
actualizar el `room`/`player` reales de esa conexión. Matchmaking sigue
usando el MISMO `startGame()` que la sala manual — no hay un segundo
pipeline de sorteo/reparto en paralelo.

**Composición corregida** (pedido explícito: nunca rellenar de más):
mínimo 2, máximo 4, sin forzar bots hasta completar 4.
- 4 humanos en cola → arranca ya, sin bots.
- 3 humanos al vencer el timeout → arranca con 3, sin bots.
- 2 humanos al vencer el timeout → arranca con 2, sin bots.
- 1 humano al vencer el timeout → se agrega EXACTAMENTE 1 bot (arranca
  1 vs IA) — la IA es fallback para no dejar a una persona sola esperando
  para siempre, nunca relleno "hasta 4".

**Ranked — ventana de MMR progresiva**: antes agrupaba con los 3 más
cercanos disponibles en el momento, sin ninguna restricción de distancia.
Ahora la ventana de tolerancia arranca angosta (`RANKED_RANGE_BASE`, según
`rank_pts` del que espera hace más tiempo) y se amplía con cada segundo de
espera (`RANKED_RANGE_GROWTH_PER_SEC`) hasta cubrir prácticamente cualquier
rango para cuando se cumple el timeout — sigue siendo UNA sola cola (nunca
sub-colas por bracket de MMR). Mismo algoritmo para cuentas nuevas y
migradas (no hay ninguna distinción de origen en `rank_pts`, confirmado en
la auditoría).

**Timeout**: `MATCH_WAIT_TIMEOUT_MS` de 20s a 30s.

**Cliente**: nuevos estados explícitos en la pantalla de búsqueda —
"Buscando… N/4 jugadores" con tiempo transcurrido y tiempo máximo estimado,
"¡Partida encontrada!" (con la cantidad real de jugadores, o "Completando
con IA…" si quedó solo), "Iniciando…" — con una demora corta y deliberada
antes de entrar a la sala para que esos estados lleguen a verse (la sala
armada por matchmaking arranca sola del lado del server, así que el
`"state"` de sorteo llegaba casi pisando al `"joined"`). Botón de cancelar
nunca queda deshabilitado — se oculta una vez que la partida ya está
confirmada, en vez de mostrarse "congelado".

20 tests nuevos/reescritos (`test-matchmaking.mjs`) — a diferencia de los
anteriores, cada caso que arma una sala real la empuja hasta fase
`"playing"` DE VERDAD (reveal + dealDraw reales, no solo `started:true`),
exactamente la aserción que hubiera agarrado el bug crítico desde el
principio. Cubre las 4 composiciones (1+bot, 2, 3, 4), la ventana de MMR
angosta Y su expansión con el tiempo, cancelación y limpieza de fantasmas.
Regresión completa existente sin romperse (104/104: reglas, ranked, salas,
chat, auth, motor de recompensas, resolución de fin de partida).

## [1.2.4] - 2026-08-20 — Fix: reconexión en PC/web nunca más cae en la pantalla de IP LAN

Reportado por el usuario: "salís de la partida... para volver a jugar
multijugador tengo que desloguearme e ingresar de nuevo, desde PC".

**Causa real** (`client/burako.js`, `goOnlineConnect`): si `resumeSessionSilently()`
fallaba por CUALQUIER motivo (token vencido, o el WS no lograba conectar —
confirmado en la medición de latencia: intentos de conexión contra Render
colgados 20s+ y fallando del todo, más de una vez en esta sesión), la rama
de PC/web caía en `netStep="connect"`: la pantalla de "Multijugador · Red
local" pidiendo una IP manual (`192.168.0.5:8181`), pensada para testing en
LAN. La rama de la app nativa (Android) sí mandaba al login correctamente;
la de PC/web nunca se actualizó para hacer lo mismo. El usuario quedaba en
una pantalla que no tiene sentido para un jugador real, sin ninguna pista
de qué hacer — el único camino que encontraba para salir era desloguearse
y volver a entrar a mano, lo que fuerza un login real y por lo tanto
"arregla" el síntoma sin que nadie supiera por qué.

**Fix**: `goOnlineConnect()` ahora distingue el motivo del fallo:
- Sesión realmente vencida/token inválido (`reason==="expired"`) → login
  normal, directo.
- Falla temporal de conexión (sin red, timeout, Render recién
  despertando) → reintenta de forma VISIBLE (usa el mismo
  `connectWithRetry` con backoff que ya existía, ahora conectado a un
  mensaje de estado real en pantalla — "Iniciando servidor (puede tardar
  hasta un minuto)…", "Reintentando conexión…" — en vez de un
  "Conectando al servidor…" estático que no cambiaba durante el reintento).
- Si tras reintentar sigue sin poder conectar, o nunca hubo sesión: login
  normal, en PC/web y en Android por igual. La pantalla de IP manual queda
  intacta en el código para acceso de desarrollo, pero deja de ser un
  destino automático para un usuario real.

**Verificación**: 3 casos nuevos con Playwright real (sin token → login;
token inválido → login, nunca la pantalla LAN; sesión válida → camino
feliz intacto, llega a `joinRoom` sin romperse) + regresión completa
existente (chat UI 22/23, la 1 fallida es el flake preexistente
documentado, no relacionado).

## [sin bump de versión] - 2026-08-20 — Perf: menos round-trips a Supabase en fin de partida

Cambio 100% backend (`server/db.js`), CERO archivos de cliente tocados —
por eso no hay bump de `GAME_VERSION`/entrada en Novedades ni build de APK
para esta entrada: no hay nada perceptible para el jugador más que menor
latencia. Sigue a la medición de latencia (ver sesión anterior): `resolveMatch`
tardaba ~1.8-2.4s por jugador, dominado por una cadena secuencial de
llamadas a Supabase.

**Causa real identificada**: `checkAchievements` hacía UN `claimGrantSlot`
(insert) POR CADA logro que calificaba, uno atrás del otro — en el peor
caso real (la primera partida de un jugador nuevo, donde varios logros se
cumplen a la vez: `first_game` + `first_win` + `clean_win` + `quick_win`
juntos) eso son varios round trips secuenciales solo para logros, sumados
a los ya existentes de `fetchProfileRaw` + `claimGrantSlot` (del resultado
de partida) + `persistProfile`. Además, `persistProfile` siempre re-subía
la tabla `profile_achievements` COMPLETA (todo el historial del jugador,
no solo lo nuevo) en cada partida, aunque no hubiera nada nuevo que
guardar — redundante pero idempotente (`ignoreDuplicates`), así que era
puro desperdicio de un round trip en el caso común (sin logro nuevo).

**Optimización** (sin tocar reglas, montos de recompensa, Ranked/MMR ni la
garantía de idempotencia del reward engine de Fase 1):
- `checkAchievements`: separa el chequeo (`ach.check()`, puro en memoria,
  sin DB) de la reclamación. Junta TODOS los logros candidatos primero, y
  los reclama con UN SOLO `upsert(...).select()` con `ignoreDuplicates`
  sobre `reward_grants` — mismo unique constraint, misma semántica de "si
  ya lo tenía otra request, no se paga de nuevo", pero en un round trip en
  vez de hasta 26. Verificado empíricamente contra Supabase real (no
  asumido) que `ignoreDuplicates+select()` devuelve SOLO las filas
  realmente insertadas, nunca las que ya existían — es el mecanismo exacto
  del que depende la idempotencia de este cambio.
- `persistProfile(p, opts)`: nuevo parámetro opcional `opts.newAchievementIds`
  — si se pasa, sube SOLO esos logros nuevos a `profile_achievements` en
  vez de re-subir el historial completo (los viejos ya están persistidos
  de cuando se desbloquearon la primera vez). Sin el parámetro (los otros
  9 call sites existentes, sin tocar), el comportamiento queda IDÉNTICO al
  de antes — cambio 100% aditivo y opt-in, cero riesgo para el resto del
  código que llama a `persistProfile`.
- `resolveMatch`/`checkLive` (los dos call sites de fin de partida y logros
  en vivo) ahora pasan `newAchievementIds` con la lista real devuelta por
  `checkAchievements`.

**Verificación**: regresión completa existente (92/92: reglas, ranked,
salas, chat, auth, motor de recompensas, resolución de fin de partida,
matchmaking) sin romperse. Test dedicado nuevo (ad-hoc, no commiteado)
que fuerza 4 logros simultáneos en una sola partida — confirma que se
otorgan los 4 exactamente una vez, quedan persistidos, una segunda
resolución del mismo jugador NO los vuelve a pagar, y las coins ganadas
suman exacto lo esperado.

**Medición antes/después** (mismo script, `server/scripts/measure-latency-ops.mjs`,
operación `surrender→finishMatch`, caso sin logros nuevos — el caso común):
- Local (dev→Supabase directo): ~1900-2080ms → ~1370-1410ms (~30% menos,
  1 round trip removido siempre).
- Producción (cliente→Render→Supabase): pendiente de re-medir tras el
  deploy de este commit (ver reporte de infraestructura).
- El caso con varios logros simultáneos (ej. primera partida de un
  jugador nuevo) es donde más se nota — antes escalaba con la cantidad de
  logros desbloqueados (hasta ~26 round trips posibles), ahora es 1 solo
  round trip sin importar cuántos se desbloqueen a la vez.

## [1.2.3] - 2026-08-19 — Matchmaking automático (Casual/Ranked)

Hasta ahora, entrar a una partida online era 100% manual: crear sala y
compartir código, escribir un código existente, o navegar la lista de
salas públicas y tocar "Unirse" una por una. No existía ninguna cola ni
emparejamiento automático. A pedido del usuario, se agregó matchmaking
para los modos Casual y Ranked, con relleno de bots confirmado
explícitamente para ambas colas si no aparecen suficientes rivales humanos
a tiempo.

**Auditoría primero**: ya existía un browser de salas públicas manual
(`listRooms`/`roomList`) que se deja intacto — el matchmaking es una vía
paralela, no un reemplazo. `rank_pts` hoy solo se usaba para mostrar tier
y ordenar el leaderboard — cero lógica de proximidad/matching en ningún
lado, se construyó desde cero. Partidas ranked ya soportaban bots como
relleno sin romper `resolveMatch` (un bot sin `username` simplemente no
puntúa) — el patrón "ranked con bots" ya era válido hoy, solo faltaba
automatizarlo.

**Servidor** (`server.js`): `matchQueues` en memoria (`casual`/`ranked`),
intervalo de emparejamiento cada 2s (`MATCHMAKING_TICK_MS`, overrideable
por env para tests). Casual agrupa los 4 más antiguos en cola (FIFO puro).
Ranked ancla al jugador que espera hace más tiempo y le suma los 3 más
cercanos en `rank_pts` disponibles en ese momento. Si el más antiguo de la
cola lleva ≥20s esperando (`MATCH_WAIT_TIMEOUT_MS`) y no hay 4 humanos
disponibles, arma la partida igual y rellena el resto con bots (mismo
criterio de dificultad aleatoria que ya usa el matchmaking offline). La
sala armada arranca directo con `startGame()` — entrar a la cola ya es la
señal de "listo", sin pasar por el mensaje `start` manual. Limpieza de
cola tanto en `queueLeave` explícito como al cerrar la conexión (mismo
bloque donde ya se limpiaba al jugador de su sala).

**Cliente** (`client/burako.js`, `client/burako.css`): reusa exactamente
el mensaje `{type:"joined"}` que ya maneja el join manual — el cliente no
necesitó código nuevo para "entrar a la partida ya armada". Se agregaron
dos botones ("🎲 Casual rápido" / "⚡ Ranked rápido") en el hub de Todos
contra todos y una pantalla de búsqueda nueva (spinner, segundos
transcurridos, tamaño de cola, cancelar) con estilos Cristal/Design DNA
existentes — sin componentes visuales nuevos de fondo.

8 tests nuevos (`server/scripts/test-matchmaking.mjs`, servidor propio en
puerto aislado con timeouts acelerados vía env): 4 jugadores casual
terminan en la misma sala; ranked agrupa por cercanía de `rank_pts`
excluyendo un outlier lejano; 1 solo jugador ranked + timeout arranca
igual completando con 3 bots; `queueLeave` cancela y evita el match
posterior; desconectar en cola no deja un "fantasma" que bloquee futuros
matches. Regresión completa existente sin romperse (reglas, ranked, salas,
chat, motor de recompensas, resolución de fin de partida, auth, e2e).

## [1.2.2] - 2026-08-19 — Fase 1: infraestructura de recompensas y progresión

Infraestructura server-authoritative, idempotente y transaccional para que
todos los sistemas futuros (Ranked rewards, Ruleta, Misiones, Torre) usen el
mismo motor en vez de mutar `profiles.coins/xp` cada uno por su cuenta.

**Auditoría primero** (sin crear tablas nuevas antes de saber qué había):
`matches`/`match_participants` existían en el esquema desde el inicio pero
nunca se escribían (0 filas siempre); no existía ninguna función RPC/
transaccional (`supabase.rpc`) en todo el repo — todo era read-modify-write
desde Node; el único mecanismo de idempotencia para logros/pases era un
chequeo en memoria sobre un objeto recién leído, que no protege contra dos
requests casi simultáneos; para el resultado de partida, el único guard era
`player._statsResolved`, un flag en memoria de ese proceso/sala — cero
protección ante un reinicio del server o un replay del mismo mensaje.

**Motor nuevo** (migración `supabase/migrations/20260819142555_reward_engine.sql`):
- `reward_grants`: ledger/historial de toda recompensa otorgada, con
  `unique(profile_id, source_type, source_id)` — el mecanismo real de
  idempotencia que antes no existía a nivel DB.
- RPC `grant_rewards(profile_id, source_type, source_id, rewards)`:
  transaccional (una función = una transacción) — si algo falla a mitad,
  Postgres hace rollback de TODO (coins, xp, items, el registro del
  ledger), nunca queda "coins sí, skin no". Verificado con un test real:
  un item con `item_type` inválido rechaza la transacción completa sin
  dejar ni las coins aplicadas ni un registro fantasma en el ledger.
- `db.js`: `grantRewards()` (motor completo, para features nuevas) y
  `claimGrantSlot()` (gate liviano de idempotencia, usado para envolver la
  lógica YA EXISTENTE de logros/pases/resultado de partida sin reescribirla
  — más seguro que una migración completa de esa lógica, ya endurecida dos
  veces esta sesión en Ranked/MMR).
- `checkAchievements`/`claimPass`/`claimGalacticoPass`/`resolveMatch` ahora
  pasan por ese gate — arregla una carrera real: un logro podía pagarse dos
  veces si el chequeo "en vivo" durante la partida corría casi al mismo
  tiempo que el chequeo de fin de partida.
- `resolveMatch` sigue usando exactamente el mismo cálculo de XP/coins/
  rankDelta por puesto (sin tocar esa lógica), pero ahora protegido por el
  ledger real en vez de `_statsResolved` en memoria.
- `matches`/`match_participants` finalmente se escriben: `finishMatch()`
  crea una fila de partida y un participante por jugador (lugar, puntaje,
  XP/monedas/rankDelta ganados) — el historial real de partida que faltaba.
- Títulos: base lista (reutiliza `inventory_items` con `item_type='title'`
  en vez de un segundo inventario, `profiles.active_title` nuevo,
  `setActive('title', id)` extendido) — sin ningún título real todavía
  (no hay fuente que los otorgue: Torre no está implementada).
- Bug real encontrado en el camino: `DB.checkLive` nunca estaba exportado
  desde `db.js` — los logros que se desbloquean EN VIVO durante la partida
  nunca funcionaron, silenciado por un `try/catch` vacío. Corregido.

23 tests nuevos (`server/scripts/test-reward-engine.mjs`): reward simple,
idempotencia secuencial, reward múltiple consistente, reward fallido sin
estado parcial, usuario inexistente, concurrencia real (2 requests
simultáneos → un solo claim), título unlock+equip, persistencia tras
releer el perfil (relogin). Regresión completa existente sin romperse
(reglas, ranked, salas, chat, resolución de fin de partida, auth, e2e).

## [1.2.1] - 2026-08-19 — Fix: caché del service worker desactualizada

Bug real reportado: fondo animado (estrellas/fichas flotando) ausente por
completo en el menú, tanto en la APK como en el navegador. Causa: `sw.js`
cachea html/css/js con una `CACHE_VERSION` que hay que subir a mano cada vez
que cambia `GAME_VERSION` (estaba en "burako-v2.8.0", sin tocar hace
varias versiones) — sin eso, quien ya había abierto la app antes queda
sirviendo una mezcla de archivos viejos cacheados en vez de los nuevos.
`CACHE_VERSION` ahora sincronizada con `GAME_VERSION` — fuerza una
recarga limpia de todo el caché en el próximo ingreso.

## [1.2.0] - 2026-08-19 — Mini-fase: UX de chat (texto libre)

En pruebas reales, un jugador no encontraba el chat ni entendía dónde tocar.
Investigación: no existía chat de texto libre — solo un "quick chat" de
frases/emojis predefinidos, mezclado dentro del panel de Historial junto con
el log de partida (fichas robadas, juegos bajados, etc.), sin ninguna
etiqueta que lo distinguiera. Reemplazado por completo:

- Punto de entrada único y claro: botón "💬 Chat" (o "💬 Chat · N" con
  mensajes sin leer) en el HUD, separado del Historial.
- PC: panel compacto flotante sobre la mesa (no tapa el atril), alto fijo,
  scroll interno, últimos 10 mensajes.
- Android/mobile: bottom-sheet que ocupa ~45% de la pantalla, no tapa la
  mesa permanentemente.
- Input de texto real ("Escribí un mensaje...", Enter o botón Enviar),
  límite de 200 caracteres, texto siempre escapado (sin HTML arbitrario).
- Servidor: buffer de chat por sala capado a 25 mensajes (antes no se
  guardaba nada — quien se unía a mitad de partida no veía nada de lo
  conversado; ahora recibe el historial reciente al entrar/reconectar).
- Rendimiento (Fase 0.5): recibir un mensaje de chat NO dispara un render
  completo de la mesa — actualiza solo la lista de mensajes/badge, mismo
  criterio que ya usa el timer. Verificado con Playwright: 0 llamadas a
  `renderPlaying()` al recibir un chat con la mesa cargada de juegos.

23 tests de UI (Playwright) + 10 tests de servidor nuevos.

## [1.1.2] - 2026-08-18 — Fase 0.5.1: bug de resolución final de partida

Bug real reportado tras probar en producción: en una partida de 3, alguien se
rendía (quedando marcado surrendered/eliminated, con el atril vacío por
forfeitPlayer) y la partida seguía para el resto — pero si esa partida
terminaba DESPUÉS por tiempo o pozo agotado (`endGameByPoints`), el rendido
podía terminar elegido "ganador por puntos" porque una mano vacía por
rendirse parecía el mejor puntaje. `hand.length===0` se estaba mezclando con
"ganó legítimamente", exactamente lo que no debía pasar.

Causa raíz: `endGameByPoints()` rankeaba por puntos a TODOS los jugadores de
la sala sin excluir a quien ya se había rendido. Fix: el candidato a ganador
por puntos sale SOLO de los jugadores activos (ni rendidos ni eliminados por
vidas). Además:
- `finishMatch()`: el orden final ahora también empuja al final a los
  eliminados por vidas (antes solo a los rendidos explícitos) — quedarse sin
  vidas tampoco vacía la mano, así que sin este ajuste alguien eliminado con
  pocas fichas podía rankear mejor que un jugador que siguió activo.
- Desempate entre 2+ rendidos/eliminados: por orden real de salida (quien
  quedó afuera después rankea mejor), no por la posición arbitraria que
  tenían en la lista de jugadores de la sala — mismo tipo de bug que ya se
  había encontrado y corregido en Ranked/MMR en la etapa anterior.
- El campo `surrendered` que llega a `resolveMatch`/reparto de apuestas
  (Modo Monedas) ahora se deriva del estado real de cada jugador, no de cuál
  camino específico terminó cerrando la partida esta vez.

6 casos de test nuevos contra un servidor real (rendición con pozo agotado,
victoria legítima vaciando la mano, rendición con desempate por puntos entre
los activos, doble rendición, Ranked con penalización de último lugar, y la
regla explícita de que rendirse en Ranked es SIEMPRE derrota aunque en ese
momento tuvieras menos puntos en mano que los demás).

## [1.1.1] - 2026-08-18 — Fase 0.5: rendimiento y consumo

Perfilado (auditoría estática + medición en vivo con Playwright/CDP) confirmó la
causa de fondo del calentamiento reportado en Galaxy S25 Ultra en partidas
avanzadas: cada jugada de CUALQUIER jugador de la sala dispara un render
completo de la mesa, con costo proporcional a la cantidad de juegos en mesa.

- `meldHTML()` memoizado por juego — evita recalcular info/orden/HTML de
  juegos sin cambios entre un render y el siguiente.
- Una capa de sombra redundante menos en la gema de cada ficha.
- Animaciones de fondo (`#bgdecor`, `#galacticoBg`) se pausan durante la
  partida en vez de seguir corriendo sin aportar nada.
- `prefers-reduced-motion` extendido a las 8 skins animadas que no lo
  respetaban todavía.
- Limpieza de timers pendientes al salir de una sala online.

Medido: costo de render con mesa cargada (40 juegos) bajó ~37% (TaskDuration
CDP). Sin cambios de Design DNA — nada se ocultó ni se le bajó calidad,
solo se dejó de rehacer/animar trabajo redundante.

## [1.1.0] - 2026-08-17 — Fase UX de partida: re-render, Preparación workspace, responsive, Ver Mesa

### Ronda 10 — Pantalla de progreso offline
- Pregunta del usuario: "si subo de nivel offline, ¿dónde lo veo?" — hasta ahora
  solo aparecía un instante en la tarjeta de resultado post-partida, sin forma
  de consultarlo después.
- `openOfflineStats()`/`offlineStatsModalHTML()`: modal reusando el patrón
  `.pauseovl`/`.pausecard` ya existente, accesible desde un botón nuevo en
  Casual contra IA ("📊 Ver mi progreso offline"). Muestra tier + rankPts, barra
  de XP/nivel (reusa `levelFromXp`, pura), y récord (victorias/partidas/racha)
  — todo leído de `PO`, nunca de `P`. Aclara explícitamente en el propio cartel
  que no reparte nada del Pase (skins/monedas reales) — separación de
  perfiles online/offline, mismo criterio que el resto de Ranked Offline.

### Ronda 9 — Feedback de dispositivo real (foto de un S25 Ultra con cámara perforada)
- **HUD tapado/desalineado por la cámara**: `.hud{align-items:center}` (regla base)
  centraba verticalmente `.title` contra `.right` — con el badge nuevo de Ranked
  Offline, `.right` pasó a envolver en 2-3 filas (77px de alto medido) contra las
  22px de `.title`, así que centrarlos dejaba el título VISIBLEMENTE más abajo
  que la primera fila de `.right` (la que queda pegada arriba, justo donde está
  la cámara). Fix: `align-items:flex-start` en mobile — el título siempre es lo
  primero pegado arriba, sin importar cuánto envuelva el resto. Colchón extra
  (`14px + env(safe-area-inset-top)`, antes 8px) porque el recorte real
  reportado por algunos Samsung no siempre coincide exacto con el círculo
  visible. Badge de Ranked Offline acortado ("🏆 Ranked Offline" → "🏆 Ranked")
  para que `.right` envuelva menos filas de entrada.
- **Historial tapado por la barra de acciones**: `.col-history` (drawer mobile)
  tenía `z-index:70`, la barra `.actions` (Bajar/Preparación/Ficha y pasar)
  `z-index:80` — la barra quedaba PINTADA ENCIMA de la parte de abajo del
  historial (con el botón de cerrar). Subido a `z-index:82` (backdrop a `81`).
- **"Agrupar"/"Vaciar" se esconden**: en mobile `.col-prep` entero scrollea como
  una sola unidad (a diferencia de PC, donde solo `.prep-loose`/`.prep-groups`
  scrollean por separado y el toolbar queda afuera) — con suficiente contenido
  en Preparación, el toolbar podía quedar scrolleado fuera de vista arriba.
  `.prep-toolbar` ahora es `position:sticky;top:0` con fondo propio: siempre
  alcanzable sin importar el scroll.
- **Recalentamiento con partidas largas (reportado en un S25 Ultra, "no debería
  con ese hardware")**: sospechoso principal, `.mesa .meld{transform:rotateX
  (17deg)}` + `.mesa-inner{perspective:800px}` — cada juego bajado en la mesa se
  promueve a su propia capa 3D compuesta en GPU; con 20-30 juegos eso es una
  cantidad real de capas recalculándose en cada scroll/interacción, y escala
  justo con la cantidad de juegos como se reportó (no con la potencia del
  teléfono). Sacada la inclinación 3D de la mesa en mobile — el atril ya no la
  tenía (por usabilidad táctil), acá se saca por la misma razón práctica.

### Ronda 8 — Cámara/recorte de pantalla en Android + tamaño de fichas en Ver mesa mobile
- **Causa raíz de "no usa toda la pantalla, hay una franja muerta donde está la
  cámara"**: `MainActivity.java` ya pedía pantalla completa
  (`setDecorFitsSystemWindows(false)` + ocultar status/nav bars), pero el tema de
  la app (`styles.xml`) nunca declaraba `android:windowLayoutInDisplayCutoutMode`
  — sin eso, Android reserva a nivel de VENTANA (fuera del control de la app) un
  cuadro alrededor del recorte de cámara, dejando una franja que ni el sistema ni
  la app dibujaban, Y el CSS (`padding-top:calc(8px + env(safe-area-inset-top))`
  en `.hud`) sumaba SU propio margen encima de un WebView que ya arrancaba más
  abajo — de ahí el header ("☰ Burako") empujado más abajo de lo necesario.
  Fix: `shortEdges` en `AppTheme`/`AppTheme.NoActionBar`/`AppTheme.NoActionBarLaunch`
  deja que el contenido dibuje hasta el borde físico real (bajo la cámara
  incluida); recién ahí `env(safe-area-inset-top)` refleja el alto real del
  recorte y el CSS existente lo compensa correctamente, sin desperdiciar la franja.
- `body.ingame .table-felt` (altura de la mesa en mobile): de `38dvh` a `34dvh` —
  en un celular real con cámara, ese presupuesto de altura terminaba solapando la
  mesa con el botón "Agrupar" de Preparación (el recorte se comía parte del `dvh`
  que el cálculo daba por seguro). Con la cámara ya resuelta del lado Android se
  deja un colchón de seguridad igual, para no repetir el bug en equipos con
  recortes de otro tamaño/forma.
- Modo Ver mesa en mobile: `--tile-size-table` de `44px`/`60px` (portrait) y
  `50px`/`68px` (landscape) bajado a `27px`/`37px` en ambos — mismo tamaño que la
  mesa chica normal. Pedido explícito: en celular la prioridad es ver VARIOS
  juegos a la vez sin scrollear, no agrandar cada ficha (al revés que en PC,
  donde sí se mantiene el agrandado).

### Ronda 7 — Ranked Offline (progreso 100% separado del online)
- `PO` (perfil offline) + `Store` key `burako_offline_profile`, completamente aparte de
  `P`/`burako_profile`: `rankPts`, `xp`, `level`, `wins`, `games`, `streak`. Nunca se
  llama `saveP()` desde este flujo, solo `savePO()`.
- Reutiliza funciones PURAS ya existentes para el rango online (`tierOf`, `levelFromXp`,
  `RANK_DELTAS_BY_COUNT`) porque son solo fórmulas sin estado — compartir la fórmula no
  mezcla el progreso; lo que nunca se comparte es el objeto de estado (P vs PO).
- `pickOfflineOpponent()`: genera un rival 1v1 con nombre (`AI_BOT_NAMES`), avatar,
  nivel/rango cercanos al propio (`PO.level±3`, `PO.rankPts±150`) y una skin que
  "puede pagar" alguien de ese nivel (filtra `SKINS` por precio ≤ `nivel*70+200`) —
  nunca un cosmético de 8000 monedas para un rival de nivel 2. La dificultad de la IA
  (`aiLevelForOfflineTier`) escala con el tier del jugador (Bronce→fácil ... 
  Diamante+→extremo).
- `goRankedOffline()` / `rankedOfflineResolve()`: mismo patrón que `goSorteo(true,...)`/
  `rankedResolve()` (online) pero apuntando a `PO`. Enganchado en `endGame()` junto al
  existente `rankedResolve()` — mutuamente excluyentes vía `G.ranked` vs
  `G.rankedOffline`, nunca ambos true a la vez.
- `surrender()`, el modal de confirmación y el botón "Salir al menú" extendidos para
  tratar `G.rankedOffline` igual que `G.ranked` (cuenta como derrota resuelta, no un
  simple volver al menú sin consecuencia).
- UI: botón "🏆 Ranked Offline · [tier]" en Casual contra IA, tarjeta de progreso propia
  en la pantalla de resultado (mismo estilo visual que la de progreso online, con PO en
  vez de P), botón Revancha re-generando un rival nuevo.
- Verificado con Playwright: rivales generados dentro de los rangos de coherencia
  esperados en 20 muestras, una partida completa ganada confirma `P` (perfil online)
  **byte a byte idéntico** antes/después mientras `PO` sí progresa, derrota resta
  puntos de rango offline correctamente, claves de `localStorage` separadas.

### Ronda 6 — Identidades de bots offline + IA por dificultad real
- `AI_BOT_NAMES`: pool de ~40 usernames realistas (`Manolo87`, `NicoUY`, etc.) +
  avatares de `AVATARS` asignados al azar por partida — reemplaza los nombres
  "IA Rojo"/"IA Azul"/etc en `goSorteo()`. IA-Claude mantiene su nombre de marca
  cuando esa dificultad está seleccionada; el resto de rivales, incluso en esa
  partida, ya usan nombres realistas. `pickBotNames(n)` evita repetidos.
- **IA por comportamiento, no por demora**: `runAi()` enrutaba solo "extremo" y
  "claude" por `BurakoCore` (motor de búsqueda combinatoria compartido con los
  bots online de `server.js`); "facil"/"normal"/"dificil" tenían su propia
  lógica más tosca (un 30% de probabilidad de "no ver" la jugada para fácil,
  nunca reorganizaban la mesa) con demoras hardcodeadas sin relación con la
  dificultad real (fácil 12s, extremo 1.5s — literalmente al revés de lo
  intuitivo). Ahora los 5 niveles pasan por el mismo motor, con
  `BurakoCore.AI_CONFIG[nivel]` controlando profundidad de búsqueda, uso de
  comodines y probabilidad de pegar fichas — la dificultad real es CÓMO
  busca/juega cada nivel, no una demora artificial. `scheduleAi()` ahora toma
  el rango de demora directamente de `AI_CONFIG[nivel].delay` (350ms–3000ms
  según nivel, todos con margen de sobra bajo el pedido de "<5s").
- Bug encontrado en verificación (no en el motor, en el propio script de
  prueba): forzar `G.screen="playing"` sin completar el reparto real
  (`startDealing()` requiere ir tomando fichas del pozo) dejaba el estado
  inconsistente y el turno de la IA nunca resolvía — 30s de "cuelgue" que no
  tenía nada que ver con el cambio de IA. Reproducido y descartado inyectando
  el estado de partida directamente (mismo patrón que el resto de los tests
  de esta sesión), confirmando que los 5 niveles responden en <3s reales.

### Ronda 5 — Refinamiento de Ver Mesa + oponentes mobile
- Botón de Ver Mesa rediseñado: pasa de un pill dentro del label "Mesa" a una pestaña
  circular anclada al borde inferior-izquierdo del marco de la mesa (`.mesa3d`,
  `position:absolute`, fuera de `.mesa` para no scrollear con el pan interno).
- Apertura/cierre con GSAP: se mide el rect del botón antes de abrir y se traduce a un
  `transform-origin` en % relativo al panel (evita convertir coordenadas de viewport a
  locales a mano), animando un `scale` desde el tamaño del botón hasta el tamaño real
  del panel — el panel "crece" visualmente desde el botón. Reversible al cerrar. Sin
  GSAP o con `prefers-reduced-motion`, abre/cierra directo sin animación.
- Backdrop cambiado de un overlay casi negro (`rgba(2,6,16,.87)`, blur 3px) a un
  "frosted glass" real: `rgba(4,10,24,.42)` + `blur(16px) saturate(115%)` — se ve la
  propia partida de fondo, difuminada y oscurecida, no una pantalla negra aparte.
- **`seatForOppIndex`**: en mobile (mismo corte que `.table-felt{display:flex;
  flex-direction:column}`, `max-width:820px` o `max-height:480px`), la distribución
  izquierda/derecha pensada para la grilla de escritorio hacía que un oponente
  terminara flotando en un hueco raro debajo de la mesa (seat-right se apila DESPUÉS
  del tablero en flex-column, no al costado). Fix: todos los oponentes van a
  `seat-top` en mobile — se agrupan arriba, prolijos, y seat-left/seat-right quedan
  vacíos (`:empty{display:none}` evita que sumen su gap del flex-column).
- Con ese espacio liberado, `.table-felt` pasa de `31dvh` a `38dvh` en mobile — la
  mesa (zona con prioridad, pedido explícito) crece notablemente sin romper el ajuste
  fino ya existente entre atril y barra de acciones (siguen tocándose, ~3px).
- Verificado con Playwright hasta 6 oponentes (2 filas) sin overlaps ni scroll
  forzado en `.bottomzone`.

### Ronda 1 — Re-render destructivo (causa raíz)
- `render()` siempre hacía `app.innerHTML=...` completo para la pantalla `playing`. El único
  camino de actualización parcial que existía era `netUpdateTimerDOM()` (solo para el mensaje
  `tick`). Cualquier otro mensaje de servidor (`state`, `toast`, `chat`, `playerActivity`, etc.)
  y cualquier acción offline (`endTurn`, `confirmTurn`, `runAi`) reconstruía el DOM entero.
- `netApplyState(s)` — que procesa CADA `"state"` del servidor, disparado por la jugada de
  CUALQUIER jugador — borraba incondicionalmente `G.selHand`/`G.workLoose`/`G.workGroups`/
  `G.selWork` en cada broadcast, sin importar si afectaba o no al jugador local.
- Fix en dos partes:
  1. **`netApplyState`**: reemplazado el borrado incondicional por un filtro "stillThere" (ya
     existía para team2v2, se generalizó): solo se descartan fichas que realmente dejaron de
     estar en la mano (jugada propia confirmada), preservando selección/preparación intactas
     ante cualquier evento ajeno. También protege las fichas de un candado abierto localmente
     (`openedMeldTileIds()`) para que no se dupliquen en la mesa si llega un `state` a mitad de
     reorganizar.
  2. **`morph(container, html)`**: nueva función de reconciliación de DOM por clave (estilo
     morphdom, escrita a mano para no sumar dependencia externa), usada en vez de
     `app.innerHTML=` para la pantalla `playing`. Reconcilia por `data-tid`/`data-mid`/
     `data-pid`/`data-gid`/`data-idx`/`id` (fallback posicional), reusando nodos existentes en
     vez de recrearlos — el scroll, el foco, las transiciones CSS y el estado nativo del
     navegador sobreviven a cualquier actualización que no los toque. `data-morph-keep` como
     escape hatch para contenedores administrados aparte por JS (ej. `#achToastZone`).
  3. **Bug encontrado en verificación visual** (no solo "0 errores de consola" — mirando
     capturas de pantalla reales): un elemento con `id` pero sin ninguna de las claves data-*
     se emparejaba por posición nomás; tras un cambio de pantalla, contenido de la pantalla
     ANTERIOR podía quedar "disfrazado" de `#achToastZone` (mismos atributos sincronizados,
     hijos intactos porque `data-morph-keep` corta la reconciliación de hijos). Fix: `id` se
     agregó como clave de emparejamiento de primera clase en `morphNodeKey()`.
- Verificado con Playwright: selección/preparación sobreviven a la jugada de un rival, DOM
  node identity preservada, scroll no salta, drag en curso sobrevive a una actualización a
  mitad de gesto, prep se limpia correctamente tras confirmar la jugada propia.

### Ronda 2 — Preparación: mover fichas entre juegos sin desarmar
- Extendido el sistema de drag interno de Preparación (`prepDragMove`/`prepDragUp`, antes solo
  soportaba devolver una ficha al atril) para soportar tres movimientos nuevos: suelta→grupo,
  grupo→grupo, grupo→suelta. Nueva función `moveTileInPrep(tileId, dest)`.
- Feedback visual de validez (`drop-ok`/`drop-bad`) reusando las clases CSS que ya usaba el
  drag del atril hacia la mesa, calculado en vivo con `meldInfo()`.
- Un grupo que queda en 0 fichas se elimina solo; uno que queda con <3 sigue mostrando
  "inválido" (no se auto-corrige, para permitir seguir experimentando antes de confirmar).
- Alcance: modo individual (team2v2 está deshabilitado en la UI desde una ronda anterior).

### Ronda 3 — Responsive desktop + paneles plegables
- El Historial ahora se puede ocultar en PC (antes solo en mobile), con el mismo botón 📜 —
  libera ~190-200px de ancho para que mesa/preparación/atril no se aprieten en ventanas
  angostas. Preferencia persistida en `Store` (`burako_historyPanelClosed`).
- Cards de oponentes más compactas por debajo de los 900px de ancho.
- Verificado: en una ventana de 1100px, el atril pasó de 488px a 678px de ancho al cerrar el
  historial.

### Ronda 4 — Modo "Ver mesa" (⛶)
- Botón junto al label "Mesa" que abre una vista ampliada/focus a pantalla completa: fichas
  notablemente más grandes (64px PC, 44-50px mobile), SIN la inclinación 3D de la vista
  normal (pedido explícito: "ver los números claramente"), resto de la interfaz oscurecido.
- Reusa `meldHTML`/`tileHTML` tal cual — mismos skins, mismo tapete, mismo estado en vivo, sin
  lógica de datos separada. El pan con mouse (`.mesa`) funciona igual porque está cableado por
  clase CSS, no por instancia.
- Cierre por botón, clic afuera del panel, o tecla Escape. Adaptado a mobile portrait y
  landscape (en landscape aprovecha el ancho extra).

## [1.0.1] - 2026-08-14 — Fixes de reglas (salida múltiple) + Galáctico + audio + UI

### Bug de reglas — salida con varios juegos combinados
- La regla real de Burako permite salir (primera jugada) con UN juego de 30+ puntos O con VARIOS
  juegos que sumen 30+ entre todos. El código (tanto el offline `confirmTurn()` en `burako.js` como
  `handleLayMultiple`/`handleTeamConfirm` en `server.js`) exigía forzosamente un único juego
  (`groups.length !== 1`), rechazando salidas legítimas armadas con más de un juego en Preparación.
  Reportado específicamente en Modo Galáctico ("te dice que no saliste", "solo te deja usar 2 juegos"),
  pero el mismo bug afectaba cualquier modo (offline, online FFA, 2v2). Fix: la validación ahora suma
  el valor de TODOS los juegos enviados y solo exige que el total sea ≥30.
- **Efecto cascada**: el sistema de "candados" (abrir un juego con comodín — `handleAttach`/
  `attachToMeld`) exige haber salido primero (`teamOpened`/`hasLaidInitial`). Como la salida con
  varios juegos fallaba, cualquiera que intentara salir así nunca lograba activar `hasLaidInitial`, y
  por lo tanto el sistema de candados parecía roto ("como que algo no se reinicia") cuando en realidad
  nunca se llegaba a habilitar. Verificado con una partida Galáctico real entre 2 jugadores (Modo
  Galáctico no admite IA): salida combinando 2 juegos (33 pts) ahora se acepta y `hasLaidInitial` queda
  en `true` correctamente.

### Audio y UI
- Efectos de sonido (clics, fichas, etc.) subidos ~45% — quedaban tapados por la música de Partida,
  que se había subido de volumen en una ronda anterior.
- Arreglado: la primera ficha de un juego armado en Preparación se veía cortada por el borde —
  `.prep-group-row .meld .tiles .tile` y `body.ingame .meld .tiles .tile` (ambas con la misma
  especificidad o mayor que la regla base `.meld .tiles .tile:first-child{margin-left:0}`, así que la
  pisaban) le aplicaban el margen negativo del "fanning" también a la primera ficha sin excepción.
- "2v2 en equipo" (tanto offline "vs IA" como online) pasa a mostrarse como "Próximamente" y
  deshabilitado en ambos lugares — no forma parte del alcance pulido de esta versión.

## [1.0.0] - 2026-08-14 — Relanzamiento como versión 1.0

A pedido explícito del usuario: ahora que el juego está terminado y pulido, se relanza como versión
1.0.0 — número de versión reiniciado (venía de 3.0.0) y el changelog que ve el jugador en pantalla
("📣 Novedades") vaciado y reemplazado por una única entrada de lanzamiento resumiendo el juego
completo, en vez de arrastrar el historial entero de rondas de desarrollo. Este archivo (`CHANGELOG.md`,
de uso interno/desarrollo) mantiene el historial completo tal cual estaba, ya que documenta el proceso
real de construcción del juego — solo cambia lo que el jugador ve adentro del juego.

- "🤖 2v2 vs IA" (offline, en "Elegí modo de juego") pasa a mostrarse como "Próximamente" y deshabilitado
  — no forma parte del alcance pulido de esta versión 1.0.
- Investigado el reporte de "no sale el sonido/música en la sala mientras jugás": se armó una partida
  online real de punta a punta (registro → crear sala → agregar 2 IA → listo → empezar → sorteo →
  repartir → jugando) y se confirmó que `Music.current` queda en `"partida"`, el `AudioContext` está
  `running` y el volumen no es cero — igual que en una partida offline. No se pudo reproducir el
  síntoma por este canal; puede ser específico del dispositivo real (enfoque de audio de Android/
  WebView) — pendiente de más detalle del usuario tras probar esta build.

## [3.0.0] - 2026-08-14 — Versión final: reinicio de cuentas + primera experiencia rediseñada

### Reinicio de cuentas registradas
- Se reinició `server/players.json` (28 cuentas, casi todas de pruebas/desarrollo) para que la versión
  final arranque con una base de jugadores limpia. Se guardó un backup con fecha
  (`players.json.bak-<fecha>`) antes de reiniciar, por si hiciera falta recuperar algo. El servidor se
  reinició para limpiar también cualquier sala/estado en memoria.

### Primera experiencia rediseñada (onboarding)
- Antes, la primera vez que se abría el juego (sin conexión a servidor, o el flujo "offline" del
  celular) solo pedía un nombre y un avatar — sin contraseña, sin ninguna explicación del juego. Ahora
  es un flujo de 3 pasos, igual esté o no el servidor disponible:
  1. **Crear cuenta**: nombre + contraseña + repetir contraseña. Si hay servidor conectado, crea una
     cuenta real (mismo registro que usa Multijugador); si no hay servidor (o se corta a mitad de
     camino — con un timeout de 5s para no dejar a nadie trabado esperando una respuesta que no va a
     llegar), sigue igual como perfil local, sin bloquear el avance.
  2. **Mini tutorial**: bienvenida resumida (qué son grupos/escaleras/comodines) + dos tarjetas cortas
     señalando dónde está el Perfil y la Tienda (con las monedas que se ganan jugando partidas).
  3. **Elegir avatar**: la misma grilla de avatares gratuitos de antes, pero como paso final en vez de
     mezclado con el nombre.
  - El botón de entrada de la portada pasa a decir siempre "▶ Jugar" para quien todavía no tiene
    cuenta (antes decía "Iniciar sesión →" apenas había servidor disponible, lo cual no correspondía
    para alguien que nunca abrió el juego).
  - La bandera que marca "ya pasaste el onboarding" se versionó (`burako_onboarded_v2`) para que el
    nuevo flujo se muestre una vez a TODOS, incluidos navegadores que ya habían completado el
    onboarding viejo.

## [2.9.0] - 2026-08-14 — Feedback tras instalar el APK: bugs de UI, reglas y app nativa

Primera ronda de correcciones después de que el usuario instaló y jugó con el APK real en su celular.

### Bugs de interfaz
- **Preparación**: si quedaban fichas sueltas abajo (con scroll) y tocabas una, la lista saltaba de
  vuelta arriba en vez de mantenerse donde estaba — causa: el re-render completo de React-less vanilla
  DOM no preservaba `scrollTop`. Se enganchó al mecanismo `data-preserve-scroll` que ya existía para
  Tienda/Perfil/Historial, aplicado tanto al contenedor de fichas sueltas como al de juegos armados.
- **Tabla de posiciones (Ranked)**: mostraba literalmente "undefined" en victorias y mejor racha de
  cada jugador. Causa: el cliente leía `p.wins`/`p.bestStreak` directo, pero el perfil público que
  manda el servidor los anida bajo `p.stats.wins`/`p.stats.bestStreak`.
- **Historial ausente jugando offline**: el botón/drawer de Historial (agregado en Fase 12 para
  mobile) solo se mostraba en partidas Multijugador — Casual/2v2 contra IA no tenían ninguno. Se
  generalizó: `setMsg()` ahora también alimenta `G.history` cuando la partida es offline (mismo
  criterio que ya usa el servidor: todo evento de juego, incluidos errores, es historial), y el botón
  📜 dejó de estar condicionado a `G.online`.

### Reglas / IA
- **Pistas (💡) no detectaban jugadas con comodín en la mesa**: si romper (abrir 🔓) un juego con
  comodín era la ÚNICA jugada disponible, el sistema de pistas decía "No veo jugadas" en vez de
  sugerirlo — la lógica descartaba directamente cualquier juego de mesa que tuviera comodín. Ahora lo
  detecta (si quedan rupturas disponibles) y lo marca explícitamente como "🔓 abriendo el comodín...".
- **IA-Claude reaccionaba casi instantáneo** (retraso base de 1s) — se sentía artificial comparado con
  el resto de las dificultades. Subido a ~3.5s base (rango real 2.6-4.4s con el multiplicador aleatorio
  existente), similar al resto de niveles.
- **Música de Partida casi inaudible**: el pad ambiental tenía `gainScale:0.4` (deliberadamente sutil
  de una ronda anterior) pero en la práctica quedaba tapado por los efectos de sonido del juego —
  subido a `0.95`.

### App nativa (APK)
- **Pantalla completa real**: la barra de estado (batería/hora) seguía visible en la app instalada —
  se agregó modo inmersivo (`WindowInsetsController`/`SYSTEM_UI_FLAG_IMMERSIVE_STICKY` según versión de
  Android) en `MainActivity.java`, reaplicado en cada `onWindowFocusChanged` porque Android vuelve a
  mostrar las barras cada vez que la ventana recupera foco.
- **El juego se salía solo al arrastrar fichas cerca del borde**: la navegación por gestos de Android
  10+ interpretaba un arrastre horizontal cerca del borde izquierdo/derecho como "volver atrás" del
  sistema. Se usó `View.setSystemGestureExclusionRects()` (Android 10+) para cederle esa franja a la
  app en vez de al gesto de navegación del sistema.
- Investigado pero no reproducido en las pruebas: la sensación de "parpadeo cada segundo" reportada en
  el celular — no se encontró ningún re-render en loop (medido con Playwright: 2 renders en 8s de
  juego inactivo, nada periódico). Es posible que estuviera ligado a las transiciones de la barra de
  estado del sistema, que el fix de pantalla completa de arriba debería reducir o eliminar — pendiente
  de confirmación del usuario en el próximo build.

## [2.8.0] - 2026-08-14 — Burako como app instalable (PWA + APK) + modo offline

### APK real (Android)
- Tras la PWA de más abajo, se armó también un `.apk` instalable de verdad (Capacitor), a pedido
  explícito del usuario ("algo físico" en el celular). Se instaló el toolchain de Android completo
  (JDK, Android SDK, Gradle) sin necesitar permisos de administrador en esta máquina. El APK queda en
  `Desktop\Burako.apk` — se instala como cualquier app fuera de Play Store (Android pide habilitar
  "fuentes desconocidas" la primera vez), con ícono propio, pantalla completa nativa, y el mismo modo
  offline que la PWA (Casual contra IA sin conexión; el modo Online sigue necesitando red). Detalle
  técnico completo en `docs/redesign/12-roadmap.md`.

### PWA instalable
- Se agregó `manifest.webmanifest` + `sw.js` (service worker) al cliente: desde Chrome en Android,
  "Agregar a pantalla de inicio" instala Burako con ícono propio y lo abre en `display:fullscreen`
  (sin barra de navegador ni URL visible), cayendo a `standalone` si el dispositivo no soporta
  fullscreen. Se generaron íconos propios (192/512/512 maskable/apple-touch-icon) con la paleta del
  juego (fondo `--bg-deep`, borde `--gold`).
- No se generó un `.apk` nativo: esta máquina no tiene Android SDK/Java/Gradle instalados, y armar ese
  toolchain implica varios GB de descarga. La PWA da el mismo resultado percibido (ícono en el
  celular, pantalla completa, funciona sin conexión) sin esa dependencia pesada — ver decisión en
  `docs/redesign/12-roadmap.md`.
- El service worker cachea todos los assets estáticos (HTML/CSS/JS, fuentes, la música de fondo, los
  íconos) con estrategia cache-first + actualización en segundo plano. Una vez que el celular visitó
  el juego al menos una vez con conexión, Casual contra IA se puede jugar completo sin internet — el
  modo Online sigue necesitando red, como siempre, porque depende del WebSocket del servidor.
- `server.js` ahora sirve `.webmanifest`/`.json` con el content-type correcto (antes cualquier tipo no
  listado caía a `application/octet-stream`, lo mismo que rompía el `.mp3` en una ronda anterior).
- Verificado con Playwright: manifest con content-type correcto, service worker activo, los 4 íconos
  cargan con 200, y una partida completa de Casual contra IA (sorteo → reparto → jugar, con fichas en
  el atril) funciona de punta a punta con el navegador puesto en modo offline. 0 errores de consola en
  la regresión completa (mobile/landscape/desktop).

## [2.7.0] - 2026-08-14 — Fix crítico de reglas (robo de fichas) + consistencia de música/sonido

### Bug crítico de reglas — robo de fichas de la mesa
- Al romper (abrir) un juego de la mesa que tenía comodín para armar uno nuevo, se podía terminar
  arrastrando una ficha de ese juego — incluso el comodín, o fichas que eran de un rival — de vuelta al
  atril propio. Una vez que un juego está en la mesa es de todos; sacar fichas de ahí hacia el propio
  atril no tiene sentido en las reglas de Burako. Causa raíz: `pullTileFromPrep()` (pensada solo para
  devolver al atril fichas que el propio jugador mandó desde su mano) no distinguía el origen de la
  ficha en la zona de armado. Fix: nueva `openedMeldTileIds()` que identifica las fichas provenientes de
  un juego de mesa roto y bloquea el arrastre a atril con un mensaje explicativo, sin afectar la
  devolución normal de fichas propias.

### Consistencia de música y sonido
- Unificada la música: "Elegí modo de juego", Casual contra IA y las pantallas de entrada al
  Multijugador ahora suenan igual que el resto del Menú (antes usaban una pista sintetizada distinta y
  se sentía como un cambio brusco al navegar).
- Sonido de "bajar fichas" rediseñado — golpe cálido con mini-arpegio en vez del sawtooth áspero
  anterior.

### Controles de audio en pausa + Perfil más completo
- El menú de pausa (durante una partida) suma los mismos controles de Efectos/Música que ya existían en
  Opciones — ya no hace falta abandonar la partida para ajustar el volumen.
- El encabezado de Perfil creció y ahora también muestra monedas y racha actual junto a Rango y Nivel.

## [2.6.0] - 2026-08-14 — Sonido de interfaz, música real y consistencia visual

### Sonido de botones
- Cualquier botón del juego que antes no tenía sonido propio (la mayoría de los botones de navegación,
  menú, pestañas) ahora reproduce un click corto y agradable al tocarlo. Los botones de cerrar (X) tienen
  su propio sonido, un barrido descendente que se siente como un "cierre" en vez de un tap más. Se
  implementó con un solo listener delegado (no se tocó cada botón a mano) que evita duplicar sonido en
  los que ya reproducían uno propio (colocar ficha, error, etc.).

### Música de fondo real
- Se incorporó el archivo de música que dejó el usuario como música de fondo real del Menú (antes era
  100% sintetizada) — reproducida un 8% más lenta a pedido explícito. Convive con el motor de música
  sintetizada de fases anteriores: Lobby/Partida/Modo Galáctico siguen siendo sintetizadas. Si el archivo
  no carga, cae de vuelta a la versión sintetizada en vez de quedar en silencio. El volumen y el mute de
  Opciones lo controlan igual que al resto de la música.

### Consistencia visual — logo con brillo
- El logo de BURAKO con su halo/brillo característico (el mismo tratamiento que ya tenía el login) ahora
  también aparece en "Elegí modo de juego", "Casual contra IA" y las pantallas de entrada al
  Multijugador — antes esas pantallas mostraban el nombre del juego como texto plano.

## [2.5.0] - 2026-08-14 — Fase 12: Mobile Game Layout + Battle Pass UX + Animaciones persistentes

Roadmap detallado en `docs/redesign/12-roadmap.md`. Pasada específica sobre la pantalla de partida en
mobile (composición propia, no la versión desktop apilada) + bugs concretos en Preparación, Modo
Galáctico y Pase de Batalla.

### Partida en mobile — composición nueva
- Reemplazado el layout mobile anterior (página entera scrolleando, versión desktop apilada en
  columna) por una composición de "videojuego móvil real" con viewport fijo: rivales en chips
  horizontales compactos arriba de la mesa (sin tarjeta grande — ya no duplican tu propio estado, que
  vive en el atril de abajo), mesa reducida que crece con contenido en vez de ocupar media pantalla,
  Preparación y Pozo lado a lado en la misma fila, Atril ocupando todo el ancho debajo.
- Nuevos tokens de tamaño de ficha (`--tile-size-table`/`--tile-size-preparation`/`--tile-size-preview`)
  — en mobile la mesa y Preparación quedan más chicas que el atril (que sigue siendo cómodo de tocar).
- Atril inteligente: ya no arrastra siempre 3 filas de casillas vacías — se ajusta a la cantidad real de
  fichas (con un margen y scroll interno si hace falta más), sin tocar la lógica de posiciones fijas
  que usa el arrastre.
- El aviso "¡Empieza la partida!/¡Tu turno!" pasó de un texto gigante centrado tapando la mesa (~2.4s) a
  un toast chico cerca del header (1.6s) — de paso se corrigió que la animación de salida se cortaba a
  mitad de camino por un desfase entre el timeout de JS y la animación CSS.
- El Historial pasa a un botón (📜) que abre un panel superpuesto en mobile, en vez de ocupar una
  columna fija — en desktop sigue igual que antes.
- Extendidas las media queries relevantes para que celulares en landscape (poca altura, no poco ancho)
  también usen esta composición compacta en vez de la de escritorio, que a esa altura quedaba con
  botones solapados.

### Modo Galáctico — atril cortado (bug)
- La fila extra de fichas de habilidad (exclusiva de este modo) podía empujar la última fila de fichas
  reales fuera del área visible del atril, sin forma de llegar a ella ni con scroll. Arreglado en PC y
  mobile.

### Preparación — ficha que quedaba flotando (bug)
- Causa raíz: los 3 sistemas de arrastre del juego (atril, Preparación, paneo de mesa) solo escuchaban
  `pointerup` para terminar un arrastre — en mobile el navegador puede mandar `pointercancel` en su
  lugar (típicamente cuando reinterpreta el gesto como scroll), y sin ese handler el clon visual de la
  ficha que sigue al dedo quedaba pegado en pantalla para siempre. Se agregó el manejo de `pointercancel`
  a los 3 sistemas. De paso se encontró y corrigió un guard faltante (`G.suppressClick`) que hacía que
  el click sintetizado después de un arrastre fallido volviera a togglear la selección de la ficha.

### Pase de Batalla
- Nuevo botón "Reclamar todo" (Pase normal y Pase Galáctico) — junta todas las recompensas disponibles
  en un solo toque con un resumen claro (monedas totales + lista de objetos), en vez de tener que
  reclamar nivel por nivel.
- Arreglado: reclamar una recompensa hacía saltar el scroll de golpe al nivel actual, perdiendo el lugar
  donde estabas mirando — el salto automático ahora solo pasa al entrar al tab, no en cada reclamo.

### Partida en mobile — segunda ronda de correcciones (a pedido del usuario, después de probar la primera pasada)
- El atril y la barra de acciones tenían un hueco muerto enorme entre ellos (la mesa arriba se llevaba
  muy poco espacio y el atril se estiraba de más antes de recortarse a 2 filas) — se invirtió: ahora la
  mesa es la que absorbe el espacio libre disponible y se ve notablemente más grande, y el atril/
  Preparación/Pozo se quedan del tamaño real que necesitan, sin hueco.
- La mesa cambiaba de tamaño según cuántos juegos había bajados — ahora es de tamaño fijo, siempre 2
  juegos por fila, con scroll interno si hay más de los que entran.
- Arreglado: en Preparación, arrastrar una ficha de vuelta al atril podía no funcionar en celular (el
  navegador a veces interpretaba el arrastre como un scroll de la pantalla) y la ficha quedaba pegada
  visualmente sin volver a su lugar.

### Partida en mobile — tercera ronda (el arreglo anterior se pasó de rosca)
- El atril seguía mostrando solo 2 filas con scroll (el ajuste dinámico por cantidad de fichas ya no
  hacía falta y solo escondía la 3ra fila) — eliminado, ahora el atril tiene una altura fija que entra
  cómoda para las 3 filas sin scroll en la gran mayoría de celulares.
- La mesa había quedado "un poco grande" al absorber todo el espacio libre disponible — pasó a un
  tamaño fijo (no dinámico), más chico, a pedido explícito de que todo fuera más estático y predecible.

### Partida en mobile — cuarta ronda
- El atril ahora queda pegado justo arriba de la barra de acciones (sin superponerse) en vez de flotar
  con un hueco debajo — el espacio libre, si sobra, se ve como aire entre la mesa y Preparación.
- Arreglado: al armar un juego en Preparación, una ficha podía quedar tapada detrás de otra — una regla
  pensada solo para la mesa se estaba aplicando también a Preparación por error.

### Música
- El Menú y el Lobby sonaban melancólicos (tenían un acorde menor y eran lentos) — reescritos con una
  progresión totalmente mayor y más rápida, más alegres.


Continuación directa de las Fases 1-10 (ver `docs/redesign/00-roadmap.md`), sobre el mismo sistema ya construido — sin rediseño desde cero. Roadmap detallado de esta fase en `docs/redesign/11-roadmap.md`.

### Portada / Login / Registro
- Arco del logo (`fanLogoHTML`) reescrito con matemática de arco circular real (radio + spread), reemplazando el posicionamiento manual que dejaba la B y la O desalineadas.
- Transición Portada → Login/Registro convertida en una animación GSAP Flip sobre el mismo logo (`withLogoFlip`), en vez de una recarga a una pantalla distinta — el logo se achica y la tarjeta de usuario/contraseña aparece en su lugar, todo en la misma composición.

### Fondo unificado
- Un solo sistema de fondo azul/violeta (tokens `--bg-deep`/`--bg-mid`) para portada, login, menú, perfil, tienda, lobby y partida, en vez de gradientes sueltos por pantalla.
- Arreglado un bug real en `classList.toggle("galactico-mode", G.online && ...)`: cuando `G.online` era `undefined` (no `false`), el navegador interpretaba el segundo argumento como "no especificado" y el toggle invertía la clase en cada render, haciendo que el resplandor/estrellas del lobby aparecieran y desaparecieran al azar (incluido al volver atrás). El fondo estrellado ahora queda como una capa ambiente siempre visible a baja intensidad, a intensidad completa dentro de una sala galáctica real.

### Menú y Perfil
- Menú: reemplazado el logo chico "☰ Burako" de la esquina superior izquierda por un mini-perfil clickeable (avatar + nombre + nivel) que lleva directo al Perfil.
- Perfil reorganizado como un hub con pestañas (Perfil, Logros, Rangos, Pase, Pase Galáctico, Colección) en vez de pantallas sueltas con navegación inconsistente — el Pase de Batalla y el Pase Galáctico, que antes tenían un botón "atrás" que te devolvía al lugar equivocado, ahora viven adentro del Perfil como una pestaña más.
- Encabezado del Perfil: nombre en tamaño más grande, con nivel y rango actual visibles al lado.
- Auditoría y eliminación de ~22 botones "← Volver" redundantes en pantallas que ya tenían su propia X de cierre con la misma acción (verificado programáticamente, comparando el `onclick` de cada botón contra el de la X de su misma pantalla antes de borrar).

### Partida
- Los paneles de HUD (Historial, Preparación, Atril, Pozo) dejaron de ser rectángulos marrones independientes — ahora comparten un mismo panel azul oscuro translúcido con borde dorado, en línea con la identidad visual del resto de la app. La madera queda reservada para la mesa física.

### Skins de fichas (34 en total)
- Se encontraron y eliminaron reglas de CSS duplicadas/en conflicto para 8 skins (fuego tenía 3 versiones distintas de la misma regla; hielo, arácnido, tecno, sombra, oro, neón y galáctica tenían 2), causa técnica de la sensación de "capa pegada" reportada — se conservó la versión más nueva y mejor resuelta de cada una, reatachando animaciones y glifos únicos que no estaban redefinidos en el bloque sobreviviente.
- Auditoría completa de legibilidad: 18 skins (madera, negra, piedra, oriental, élite, samurái, cristal, dragón, arcoíris, holograma, sakura, pirata, plata, steampunk, vikingo, y las tres de temporada — Halloween, Navideña, San Valentín) tenían el número de la ficha fijado a un único color con `!important`, sin distinguir rojo/azul/verde/amarillo — el mismo patrón de bug reportado explícitamente por el usuario. Reescritas todas con `color:currentColor` en la regla base + un override por `.dotc-{color}` con un tono saturado y distinguible propio de cada material, verificado visualmente con las 34 skins renderizadas en simultáneo (0 errores de consola).

### Tienda
- Nuevo botón de vista previa (👁) en cada fila de skin — abre un panel entre las pestañas y la lista con las 5 fichas (rojo/azul/verde/amarillo/comodín) a 56×76px en vez de las miniaturas de 24×33px de la fila, con el nombre, precio/estado y el mismo botón de compra. Se puede cambiar de skin sin cerrar el panel y cerrarlo con su propia X.

### Portada / Login / Opciones / Bienvenida inicial
- Se sacó `.panel-wood` (tarjeta de madera marrón) de las 6 pantallas que la usaban — portada, login/registro/reconectando, Opciones y la pantalla de bienvenida para jugadores nuevos — era la única superficie marrón fuera de la mesa de juego y rompía la identidad de "un solo universo" justo en las primeras pantallas que ve cualquiera. Ahora todas comparten la misma tarjeta de vidrio oscuro azul/dorado que ya usan menú, perfil, tienda y lobby.
- La pantalla de bienvenida (nombre + avatar la primera vez que se abre el juego) tenía el logo como texto plano — ahora usa el mismo abanico de fichas que portada y login.
- Evaluado Three.js para la profundidad de la portada y descartado con justificación técnica: el sistema de partículas compartido que ya cubre toda la app (nebulosa, estrellas, fichas flotando de fondo) cumple mejor el pedido que un canvas aislado a una sola pantalla, sin el costo de un contexto WebGL nuevo.

### Transiciones entre pantallas
- Auditoría de las 22 pantallas de la app: 17 ya animaban su entrada de forma consistente (fade + pop, 400ms) desde fases anteriores; de las 5 restantes, 4 no lo necesitaban (la mesa/atril en vivo ya tiene su propia animación de reparto, y el conteo regresivo 2v2 y la portada ya tenían su propia coreografía dedicada) y una sí era un hueco real: el Menú aparecía de golpe sin ninguna transición. Ahora entra con un fade + slide suave (300ms), igual que el resto de la app.

### Música original por contexto
- Se reemplazó la única pista de fondo (sonaba a casino, exactamente lo que se pidió sacar) por 4 pistas propias con identidad según dónde estás — Menú (calma, algo mágica), Lobby/preparativos (expectante), Partida (deliberadamente muy sutil, sin bajo ni melodía, para no competir con la concentración de jugar) y Modo Galáctico (espacial y misterioso, con un leve shimmer y eco) — más un stinger corto de victoria/derrota al terminar una partida. El cambio de pista es un crossfade suave, nunca un corte.

### Login/registro — tamaño del logo y centrado
- El logo BURAKO en login/registro/reconectando/onboarding volvió a su tamaño real (se veía achicado, no como en la portada). Además esas pantallas centran la tarjeta de forma independiente del logo, igual que la portada — antes el grupo logo+tarjeta se centraba junto y la tarjeta quedaba corrida y la transición se sentía como un salto.

### Testing de cierre de la Fase 11
- Verificación en Chromium real de todo lo que cambió en esta fase dentro de una partida jugable de verdad (no solo en aislado): paneles del HUD y skins sobre fichas reales de mano, Modo Galáctico con la ambientación cósmica y la música correcta, 2v2 en equipo, un logro desbloqueándose en vivo, y el Pase/Pase Galáctico mostrando progreso real en el Perfil. Conectividad con el servidor de WebSocket confirmada sin cambios. 0 errores de consola en todos los casos.

## [2.3.0] - 2026-08-13 — Rediseño visual, Fase 1

### Agregado — Design tokens semánticos
- Nuevo bloque de tokens en `:root` (`--color-bg/surface/blue/blue-electric/violet/gold/wood/text/muted`, `--radius-sm/md/lg`, `--shadow-card/gold`, `--transition-fast/normal`) — TODOS alias de valores que ya existían y ya se usaban en decenas de lugares (no se tocó ningún valor real, solo se les puso nombre). Nada cambia visualmente con esto; a partir de ahora, cualquier CSS nuevo debería salir de estos nombres en vez de repetir colores sueltos.

### Rediseñado — Material de las fichas
- La ficha pasó de un gradiente plano a un material con relieve real: brillo superior fijo (`::before`, un "glass highlight" que ninguna de las 30+ skins toca — solo `sk-tecno` define su propio `::before`, y por especificidad CSS sigue ganando ahí sin romper nada), sombra de contacto + sombra difusa (la ficha "flota" un poco sobre el fieltro), y filo superior iluminado / sombra interna inferior para dar sensación de grosor.
- Nuevo estado `:hover` (se levanta apenas al pasar el mouse, respetando `.sel`/`.hint`/`.back`).
- El comodín (🃏) ahora tiene un brillo violeta que respira (`opacity`, no `box-shadow`, para que sea liviano en fps con varios comodines en pantalla) — se distingue de un vistazo de una ficha normal.
- El punto de color de la skin "Clásica" (la que usa todo el mundo por defecto) ganó un pequeño relieve (luz arriba, sombra abajo) en vez de ser un círculo plano.
- Cero cambios de JS: todo esto es CSS puro sobre el HTML que `tileHTML`/`tileBtn` ya generaban — las 30+ skins, el drag-and-drop, y toda la lógica de juego quedan exactamente iguales.
- Verificado explícitamente que este trabajo NO tocó `.col-rack`/`.rackpersp`/`.rack`/`.rackgrid`/`RACK_ROWS` (el área que costó 7 versiones estabilizar esta misma noche) — el tamaño/layout del atril queda intacto.

### Cambiado — Botones
- `.btn-gold` (el botón principal de toda la app) ganó un estado `:hover` que le faltaba — `.btn-ghost` ya lo tenía, ahora los dos se sienten parte del mismo lenguaje. Transiciones migradas a los tokens `--transition-fast`/`--motion-ease` en vez de un valor suelto.

### Nota de alcance
- Esta es la Fase 1 (Design System + fichas) de un rediseño visual mayor en curso. Fases siguientes: Portada/login/registro, Perfil/tienda/pase/ranking/logros, Lobby, Mesa/atril/preparación, GSAP/Motion/Three.js, Audio, Responsive, Testing. Sin verificación visual en navegador (no disponible en este entorno) — todo lo de arriba está verificado a nivel de código (sintaxis, especificidad CSS, ausencia de cambios en JS) pero falta la confirmación visual del usuario.

## [2.2.7] - 2026-08-13

### Arreglado — revertido por completo al atril original
- La cadena de ajustes 2.2.1→2.2.6 (scroll, achicar fichas, agrandar a 950px, hacerlo elástico) nunca terminó de convencer y en el camino se rompió también el atril OFFLINE — como `renderPlaying()` es la MISMA función para online y offline, cualquier cambio en `.col-rack` afecta a los dos por igual, cosa que no se tuvo en cuenta.
- Se revirtió `.col-rack`/`.rackpersp`/`.rack`/`.rackgrid` línea por línea al estado exacto de antes de 2.2.1 (ancho fijo de 780px, sin scroll, sin flex-column interno, tamaño de ficha de siempre). Se mantiene únicamente el cambio de UI que sí se pidió aparte y no tocaba tamaños: en Modo Galáctico, la fila de fichas de habilidad va arriba de la grilla en vez de abajo.
- El corte de fichas que originó todo esto (ver 2.2.1) queda sin resolver por ahora — se prioriza volver a un estado conocido y estable antes de reintentar, y la próxima vez conviene verificar el efecto en offline Y online antes de dar un cambio por bueno.

## [2.2.6] - 2026-08-13

### Cambiado
- El atril de la pantalla de juego online volvió a ser elástico (`flex-grow:1`) en vez de tener un ancho fijo — ahora ocupa todo el espacio que sobra entre Preparación y el Pozo (casi tocándolos), en vez de quedar angosto con huecos vacíos a los costados. Las columnas de al lado (Historial/Preparación/Pozo) siguen con ancho fijo como siempre; el atril es la única que crece para llenar lo que queda.

## [2.2.5] - 2026-08-12

### Cambiado
- El atril de la pantalla de juego online se agrandó (contenedor de 780px a 950px de ancho) a pedido explícito — como el ancho de columna define el alto de cada ficha (aspect-ratio), esto agranda las fichas en las dos direcciones, aprovechando el espacio vacío que había quedado abajo en la captura que mandó el usuario.

## [2.2.4] - 2026-08-12

### Arreglado — el achique de fichas de 2.2.3 quedó mal, revertido
- El usuario mandó una captura de pantalla real: con el achique de 2.2.3, el atril quedaba con las fichas chiquitas y un hueco vacío enorme abajo (2 de las 3 filas sin usar) — evidencia directa de que el contenedor ya tenía espacio de sobra y el achique nunca hacía falta.
- Se revirtió el tamaño de ficha al original (`aspect-ratio`/fuente de siempre). Se mantiene: sin scroll, y la fila de habilidades de Modo Galáctico arriba de la grilla.

## [2.2.3] - 2026-08-12

### Cambiado — vuelta atrás del scroll del atril, por pedido explícito
- 2.2.1 había resuelto el corte de fichas agregando scroll propio al atril; el usuario prefiere que el atril NO scrollee nunca (que se sienta como un atril fijo, no una lista) — se sacó el scroll.
- En su lugar: la fila de habilidades de Modo Galáctico pasó a ir ARRIBA de la grilla de fichas normales (antes iba abajo), y las fichas dentro de la pantalla de juego online achican un poco su tamaño (`aspect-ratio` más bajo + fuente más chica) para que las 3 filas + la fila de habilidades entren siempre sin cortarse ni necesitar scroll. Sigue siendo una solución "a ciegas" sin verificación visual en navegador real — si en algún tamaño de pantalla puntual todavía se corta algo, avisar para seguir ajustando el achique.

## [2.2.2] - 2026-08-12

### Arreglado
- El atril había quedado más alto de lo debido (30→50 casilleros, 3→5 filas) al arreglar el corte de fichas en 2.2.1 — revertido a las 3 filas de siempre.

## [2.2.1] - 2026-08-12

### Arreglado — causa real encontrada: fichas "invisibles" en el atril jugando online
- Investigado a partir de un reporte de comodines/fichas que "desaparecían" del atril — se descartaron varias hipótesis (pérdida de datos, excepción silenciosa en el render, reconexión) hasta que el propio usuario encontró la pista real: bajando el zoom del navegador al 80%, las fichas "perdidas" volvían a aparecer.
- Causa: `.col-rack .rackpersp` (el contenedor del atril en la pantalla de juego online) tenía `overflow:hidden` con una altura fija — si la mano tenía más fichas de las que entraban en ese alto (por ejemplo, justo después de terminar el reparto, con las últimas fichas dealt), la fila sobrante quedaba CORTADA e invisible, sin scroll ni ningún aviso. Durante la pantalla de REPARTO (antes de entrar a jugar) el atril no usa ese contenedor, por eso ahí las mismas fichas se veían bien — recién al pasar a la pantalla de juego (que sí lo usa) se cortaban.
- Ahora ese contenedor tiene scroll propio (`overflow-y:auto`) en vez de recortar en silencio — cualquier cantidad de fichas queda alcanzable sin cortar nada. (Se había subido también el tamaño del atril de 30 a 50 casilleros como refuerzo extra, pero eso hacía que el atril se viera más alto de lo debido — se revirtió a los 30 de siempre; el scroll solo alcanza para resolver el problema real.)
- De yapa quedó un blindaje agregado en el camino (`render()` ahora atrapa cualquier excepción al armar una pantalla y la loguea bien visible en la consola en vez de dejar la pantalla vieja congelada en silencio) — no era la causa de este bug puntual, pero es una red de seguridad real para la próxima vez que algo similar pase.

### Agregado — 2v2: reorganizar juegos de la mesa
- En 2v2 online, el botón para abrir un juego ya bajado (para reacomodarlo con fichas de la mano) estaba deshabilitado a propósito desde que se armó el modo — quedó pendiente para "más adelante". Ahora funciona: cualquiera de los dos integrantes del equipo puede abrir un juego de la mesa (propio o rival, mismas reglas que el resto del modo — gratis si no tiene comodín, gasta una ruptura si lo tiene) durante el turno del equipo, y el compañero lo ve reflejado al instante en la misma zona de preparación compartida que ya usan para armar jugadas juntos.
- Si se cancela la preparación (o se acaba el tiempo) con un juego abierto a mitad de reorganizar, vuelve a la mesa exactamente como estaba — mismo criterio que ya usa el modo individual.
- Verificado con un test de integración por WebSocket: el guardrail de "necesitás salir con 30 primero" rechaza el intento correctamente sin romper la sala.

## [2.2.0] - 2026-08-12

### Agregado — Reconexión a partidas online en curso
- Hasta ahora, CUALQUIER cierre de la conexión durante una partida online (cerrar la pestaña, un refresh, un wifi que corta un instante) se trataba exactamente igual que abandonar a propósito: el server eliminaba al jugador al instante, sus fichas volvían al pozo, y no había forma de volver a esa partida (comentario del propio código: "No hay reconexión..."). Esto se investigó a partir de un reporte de fichas "desaparecidas" en el atril que no se pudo reproducir por lectura de código — no se confirmó que fuera la causa, pero de cualquier forma era un agujero real: cualquier corte de red perdía la partida sin aviso.
- El server ahora da un margen de 25 segundos antes de aplicar la rendición automática por desconexión — si el jugador manda `rejoin` a tiempo (mismo `playerId` + logueado con la MISMA cuenta que tenía ese asiento), recupera exactamente su lugar: mano intacta, rupturas de comodín intactas, turno donde estaba. Rechaza el intento si no está logueado, o si está logueado con otra cuenta (no se puede robar el asiento de otro jugador solo adivinando su `playerId`).
- El cliente ahora guarda en qué sala estaba (código + su propio playerId, con vencimiento de 3 minutos) cada vez que entra a una — y al abrir el juego de nuevo (F5 incluido), si hay una sala reciente guardada Y ya tenía usuario/contraseña recordados en este navegador, intenta reconectarse solo antes de mostrar el login manual (con tope de 6s: si no hay respuesta a tiempo, cae al login normal sin quedarse colgado). Se limpia esa sala guardada al salir de la sala/partida a propósito o al cerrar sesión.
- Los demás jugadores ahora ven una etiqueta "🔌 reconectando…" junto al nombre de quien se desconectó momentáneamente, en vez de que parezca que el juego se congeló sin explicación.
- Verificado con 9 tests de integración por WebSocket: reconexión con la mano exactamente intacta, sin ser eliminado por el corte, y los dos casos de seguridad (rejoin sin login, rejoin con otra cuenta apuntando al asiento de alguien más) correctamente rechazados.

## [2.1.3] - 2026-08-12

### Arreglado
- Modo offline: la ruptura de comodín (el "candado" 🔓/🔒 que limita a 3 veces por partida abrir un juego con comodín) era un contador ÚNICO compartido entre el humano y TODOS los rivales IA — desde que la IA empezó a reorganizar la mesa (v2.1.2), cada vez que un bot abría un juego con comodín, le gastaba una ruptura al HUMANO (bajaba el contador que el jugador ve en pantalla), aunque nunca la hubiese usado. Ahora cada rival IA tiene su propia cuota de 3 rupturas, separada de la del humano — mismo criterio que ya usaba correctamente el modo online (`room.jokerBreaks` ya era por jugador ahí).

### Agregado
- "✨ IA-Claude" ahora aparece como opción al agregar un bot en una sala online "todos contra todos" (y 2v2, donde ya se podía agregar cualquier dificultad) — antes solo se podía crear un bot IA-Claude editando la sala desde afuera; el servidor ya soportaba `difficulty:"claude"` desde que se agregó la dificultad, solo faltaba el botón en el lobby.

## [2.1.2] - 2026-08-12

### Arreglado
- Modo Galáctico: las fichas de habilidad que te tocaban durante el REPARTO (antes de que arranque la partida) no se veían en ningún lado — el contador de "X/14 fichas" sí las contaba (llegaban de verdad a la mano), pero la pantalla de reparto online (`renderNetDealing`) llamaba a `rackHTML(true)` sin el segundo parámetro que activa el panel de habilidades, a diferencia de la pantalla de juego (`renderPlaying`) que sí lo pasa. Resultado: parecía que "no se agarraban" cuando en realidad sí estaban en la mano, solo invisibles hasta llegar a jugar. Corregido pasando `G.gameMode==="galactico"` como segundo argumento también en el reparto (online y, por consistencia, offline).

### Agregado — Motor de IA: reorganizar la mesa (abrir y rearmar juegos), no solo bajar/pegar
- Nueva `findBestReorg` (+ `solveCoveringMelds`, su motor de búsqueda interno) en el core compartido: cuando la IA no tiene nada para bajar directo de la mano ni para pegar una ficha suelta, ahora prueba ABRIR un juego ya bajado en la mesa (propio o de un rival — mismo criterio sin restricción de dueño que ya usa `handleReorganize` para jugadores humanos) y volver a armar sus fichas junto con fichas de su mano en uno o más juegos válidos nuevos, reutilizando el 100% de lo que abrió (mismo requisito que el server le exige a un humano: "no pueden quedar fichas de la mesa sin usar").
- Respeta las mismas reglas que un jugador real: abrir un juego SIN comodín es gratis; abrir uno CON comodín consume una de las 3 rupturas limitadas por partida (y no lo intenta si no le quedan). Recorre TODOS los juegos de la mesa (no se detiene en el primero) y se queda con el que le permite sacarse MÁS fichas de la mano de encima — descarta cualquier reorganización que no sume ninguna ficha de mano (sería gastar el turno sin ganar nada).
- Conectado en `server.js` (`maybeAIPlay`, bots online — Difícil/Extremo/IA-Claude, mismo umbral que ya usaba el intento de pegar) y en `client/burako.js` (`runAi`, IA offline Extremo/IA-Claude) — mismo motor, misma lógica en los dos lugares.
- Verificado con 12 tests unitarios nuevos corridos directo con Node: arma la reorganización correcta con un grupo sin comodín, descarta reorganizaciones que no suman fichas de mano, respeta el límite de rupturas (0 disponibles → no toca juegos con comodín; 1 disponible → sí puede), y recorre TODA la mesa sin sesgo de orden (elige el juego útil sin importar si está primero o último en la lista). Más una partida real de ~20s por WebSocket contra un bot IA-Claude sin errores del servidor.

### Cambiado — Rendimiento: menos repintado continuo
- El brillo pulsante de la tarjeta del jugador en turno (`.opp-card.a-glow`, visible EN TODA PARTIDA, en la pantalla de TODOS los jugadores, todo el tiempo que dura el turno de esa persona) animaba `box-shadow` directamente — eso obliga al navegador a repintar esa zona en cada cuadro, sin parar, durante toda la partida. Se reemplazó por un pseudo-elemento con una sombra fija cuya `opacity` es lo único que se anima (mismo pulso visual, pero solo trabajo del compositor/GPU, no repintado).
- Mismo cambio para el halo de selección de fichas agregado en la versión anterior (`tileSelPulse`): pasó de animar `box-shadow` a animar `opacity` sobre una sombra fija.
- Reducida la frecuencia de partículas de las estelas Fuego (18ms→42ms) y Alquimia (40ms→60ms) — menos elementos creados/destruidos por segundo durante el vuelo de una ficha, mismo efecto visual.
- Alcance de esta pasada: se optimizó lo agregado en las últimas versiones (estelas + halo de selección) más el caso de "siempre visible en toda la partida" más evidente (`.opp-card.a-glow`). Quedan afuera, sin tocar por ahora (requieren verificación visual en navegador real, que no está disponible en este entorno de trabajo): varias skins de fichas (Fuego Ardiente, Océano Profundo, Plata Cromada, Arcoíris, Holograma, Tecno Futurista, Galáctico Espacial) que animan `background-position`/`background-size` de forma continua — más caro que animar `transform`/`opacity`, pero afecta selectivamente solo a quien tenga esa skin puesta, así que un perfilado real (Chrome DevTools → Performance) diciendo qué pantalla/skin/acción específica se siente lenta ayudaría mucho a apuntar el resto de esta optimización con precisión en vez de reescribir a ciegas.

## [2.1.1] - 2026-08-11

### Agregado — Motor de IA: mira TODA la mesa, no solo el primer juego
- `findJokerSwap` pasó a `findAllJokerSwaps`: en vez de quedarse con el PRIMER juego de la mesa que tenga un comodín cambiable, ahora recorre TODOS (1, 2, 3 o más) y junta un candidato de cada uno.
- `planBestMove` evalúa cada candidato por separado (qué jugada arma la mano si se hace ESE cambio en particular) y se queda con el que da el mejor resultado — no con el que aparece primero en la mesa.
- Verificado con tests unitarios nuevos: un caso con 3 juegos-candidato confirma que `findAllJokerSwaps` los encuentra los 3 (no solo el primero), y un caso más fino donde el único candidato que sirve de verdad es el ÚLTIMO en la mesa confirma que `planBestMove` lo elige igual, no el primero. 8/8 nuevos + 12/12 anteriores = 20/20.
- Mismo alcance que la vez anterior: motor compartido (`server/burako-core.js` + `client/burako-core.js`), usado por Difícil/Extremo/IA-Claude online y offline, aplicado también en "todos contra todos" online (los bots de esas salas ya comparten este mismo motor, no hizo falta nada especial para ese modo). Deliberadamente NO se agregó a Novedades — mismo criterio que la vez anterior con el motor de IA.

### Arreglado
- La ficha seleccionada en el atril ahora se ve bien con cualquier skin (antes, el brillo de selección chocaba con el decorado de casi 30 skins de fichas, que también usan ese mismo lugar del dibujo — se movió a un elemento propio).
- El reloj de cada turno ahora se actualiza segundo a segundo jugando offline (antes solo se veía avanzar en salas online).

## [2.1.0] - 2026-08-11

### Agregado — Motor de IA: ahora considera cambiar comodines sueltos de la mesa
- Nueva función compartida (`server/burako-core.js` y su copia `client/burako-core.js`) `findJokerSwap`: detecta un juego de la mesa con exactamente un comodín donde el jugador tiene en mano la ficha real exacta que puede ocupar su lugar — es un intercambio 1x1 siempre legal (no es "abrir juego": no cuesta ninguna de las 3 rupturas limitadas, porque nunca puede quedar inválido).
- Nueva función `planBestMove`: antes de decidir su jugada, arma la mano "hipotética" con ese cambio ya hecho y compara — si el comodín liberado arma algo mejor (o directamente el único juego posible), hace el cambio de verdad; si no mejora nada, no toca la mesa. Reemplaza el `findBestMove` liso en los dos lugares donde se llama: `server.js` (bots online) y `client/burako.js` (`runAi`, IA offline nivel Extremo/IA-Claude).
- `findBestAttach` (pegar una ficha suelta a un juego ya bajado) pasó de devolver la PRIMERA combinación válida que encuentra a evaluar todas y devolver la de mayor valor de ficha — mismo criterio en online y offline.
- Verificado con una batería de tests unitarios corridos directo contra `burako-core.js` con Node (sin necesidad de navegador): detecta el cambio correcto, no propone cambios inválidos, ignora juegos con 2+ comodines a propósito, y en `planBestMove` solo ejecuta el cambio cuando genuinamente mejora la jugada (probado con casos donde mejora y casos donde no) — 12/12 casos pasaron.

### Agregado — Nueva dificultad "✨ IA-Claude" (sin anunciar en Novedades, a pedido del usuario)
- Nuevo nivel de IA en `AI_CONFIG` (profundidad 5, la más alta de todas) que además es la única que usa `planBestMove` con el análisis de comodines sueltos siempre activo.
- Seleccionable en los selectores de dificultad de "IA-Casual" y "2v2 vs IA · offline", con su propio texto descriptivo. La primera rival generada con esta dificultad se llama "IA-Claude" (avatar ✨) en vez del nombre genérico por color.
- Server: agregada a `aiAvatars`/`aiNames` para poder agregarla también como bot en salas online (2v2, etc.).
- Deliberadamente NO se agregó ninguna entrada a "Novedades" (la pantalla in-game) para esta dificultad — el usuario pidió específicamente que no se anuncie ahí.

## [2.0.1] - 2026-08-11

### Agregado — Estelas de vuelo visibles para todos en salas online
- Cuando otro jugador real (no vos) baja una jugada en una sala online, ahora también ves sus fichas volar hasta la mesa — con la estela que ESA persona tiene equipada, saliendo desde su tarjeta en pantalla (`.opp-card[data-pid]`, nuevo). Antes el vuelo solo se veía en tus propias jugadas; las de los demás aparecían directo.
- No hace falta nada nuevo del lado servidor: el campo `trail` que ya viaja en cada combinación de `room.table` (agregado en 2.0.0) alcanza para que cualquier cliente sepa qué estela mostrar, sea o no la propia.
- Si la tarjeta de esa persona no está en pantalla por algún motivo, la jugada aparece directo, sin forzar nada — mismo criterio defensivo que el resto del sistema.

## [2.0.0] - 2026-08-11

### Agregado — Estelas de vuelo (nueva categoría de la Tienda)
- Cuando bajás una jugada, cada ficha ahora VUELA desde su lugar en el atril hasta su lugar en la mesa, en vez de aparecer de golpe — independiente del efecto de bajada de siempre (Rayo, Confeti, etc.), se combinan entre sí.
- **11 estelas**, cada una con su propio recorrido (no solo su color): Clásica, Viento 💨 (curva en S), Dorada 🪙 (gira como una moneda), Terremoto 🪨 (dos rebotes con polvo), Hielo ❄ (patina y frena, esquirlas), Alquimia 🧪 (burbujea), Fuego 🔥 (zigzag, brasas que suben), Estrella Fugaz 🌠 (cola larga continua), Arcoíris 🌈 (arco que cambia de color), Cósmica 🌌 (portal — no viaja, se hunde y reaparece; exclusiva del Pase Galáctico) y Vacío 🕳 (se estira como espagueti; exclusiva del Pase de temporada).
- Nueva pestaña "☄ Estelas" en la Tienda, con vista previa (👁) y precios de 500 a 3200 monedas para las 8 compra­bles.
- Servidor: `CATALOG.trails`, `inventory.trails`/`active.trail` (con migración para cuentas viejas), compra/equipar reutilizando los mismos mensajes `buyItem`/`setActive` genéricos que ya existían.
- Recompensas de Pase: Cósmica se agregó al nivel 14 del Pase Galáctico (junto a las monedas que ya daba ese nivel), Vacío al nivel 60 del Pase de temporada (junto a monedas + avatares que ya daba ese nivel) — sin reordenar ningún nivel existente.
- Alcance de v1: el vuelo se ve en TUS PROPIAS jugadas (offline y online, en cualquier modo incluido Galáctico) — pegar una ficha suelta a un juego ya bajado y bajar varios juegos desde Preparación todavía aparecen directo, igual que las jugadas de un rival en una sala online (nunca vimos su atril, así que no hay de dónde volar). Queda como punto de partida para seguir sumando.
- Antes de tocar código real se armaron y compartieron dos bocetos interactivos (mockups) para validar visualmente el diseño del vuelo y el catálogo antes de implementarlo.
- Respeta "menos movimiento" (`prefers-reduced-motion`): con esa preferencia activada, las fichas aparecen directo, sin vuelo ni partículas.

## [1.22.2] - 2026-08-11

### Cambiado — Novedades in-game reformuladas
- Revisadas las ~37 versiones del historial de "Novedades": toda entrada que admitía un error de código ("Arreglado: X no funcionaba") se reescribió como mejora ("X ahora hace Y"). El archivo `CHANGELOG.md` (este archivo, de uso interno) sigue documentando bugs normalmente — el cambio es solo en lo que ve el jugador dentro del juego.

### Rediseñado — Atril de habilidades en Modo Galáctico
- Las fichas de habilidad dejaron de vivir en una caja aparte debajo del atril (con su propio título y borde punteado) — ahora son una fila más DENTRO del mismo atril de madera, sin chrome propio.
- Los indicadores de Escudo/Bloqueada/Ya usada se mudaron a íconos chicos junto a los corazones de vida, en la cabecera del atril.
- El cartelito de "qué hace esta habilidad" pasó de ser un bloque que empujaba el atril hacia abajo a una ventana flotante sobre toda la pantalla — abrirlo ya no cambia el tamaño de nada alrededor. Se puede cerrar tocando afuera, además del botón "✖ Cerrar".
- Antes de tocar el código real se armó y compartió un boceto interactivo comparando el antes/después, para validar el resultado visual antes de implementarlo.

## [1.22.1] - 2026-08-11

### Agregado — Paso 3 y 5 del plan de animaciones: fichas y botones
- **Ficha seleccionada con halo pulsante**: la ficha que tenés tocada en el atril ahora "respira" con un brillo dorado suave y constante, en vez de quedar con un brillo fijo — usa `--motion-slow` (mismo ritmo ambiental que el resto de los loops de fondo). Va en una capa aparte (`::after`) para no chocar con el `!important` que ya tenía el brillo fijo (necesario para que la selección se note por encima de cualquier skin de tapete/ficha).
- **Botones "← Volver" y secundarios (`.btn-ghost`) menos planos**: ahora se levantan un poco y suman un brillo dorado tenue al pasar el mouse/dedo, con las mismas curvas de movimiento (`--motion-fast`) que ya usa el resto de la app — antes era la única familia de botón sin ninguna reacción más allá de un cambio de color. No se tocó `.btn-gold` (el botón principal ya tenía su propia identidad).

Con esto quedan hechos los 5 pasos del plan de animaciones armado a partir del catálogo de Prismic (lenguaje compartido, brillo de fondo del tapete "Clásico", prueba en botones de Jugar, halo de selección de fichas, balance de `.btn-ghost`). El rediseño del panel de habilidades en el atril (Modo Galáctico) sigue pendiente, a pedido explícito para retomarlo más adelante.

## [1.22.0] - 2026-08-11

### Agregado — Navegación consistente en todas las pantallas
- **Botón "← Volver" flotante**: ahora es `sticky` al fondo de cada ventana con scroll — ya no hace falta bajar hasta el final para volver atrás, queda siempre visible con un fondo con blur para no tapar el contenido.
- **Botón "✕" en todas las ventanas**: se agregó a cada pantalla del juego (perfil, tienda, rangos, pase, pase Galáctico, opciones, ayuda, novedades, crear sala, unirse a sala, salas públicas, tabla de posiciones, sala de espera, fin de partida, sorteo, y más) — cierra la ventana volviendo al paso anterior, igual que "Volver". Reemplaza a la flechita "←" que tenían algunas pantallas viejas (ahora unificadas al mismo estilo).

### Arreglado
- El botón "Volver" de la pantalla "Crear sala" en Modo Galáctico no funcionaba (quedó una variable local mal referenciada en un `onclick` de un cambio anterior) — ya vuelve correctamente al lobby de Galáctico.

### Agregado — Límite de tiempo en Modo Galáctico
- La pantalla de crear sala Galáctico ahora también muestra el selector "Límite de tiempo" (10/20/30/45/60 min o sin límite), igual que los demás modos. Al agotarse el tiempo, la partida termina y gana quien tenga menos puntos en fichas normales en la mano (las fichas de habilidad no puntúan). La variante de victoria "por puntaje" se sigue ocultando y bloqueando del lado servidor — Galáctico solo se gana vaciando las fichas normales del atril o por límite de tiempo.

## [1.21.3] - 2026-08-11

### Agregado — Paso 2 del plan de animaciones: fondo
- `.tp-clasico .mesa` suma `--tapete-glow:rgba(251,191,36,.07)` (mismo tono que el tapete "Salón dorado", a mucha menos intensidad) — reusa el mecanismo `tapeteGlow` que ya tenían TODOS los demás tapetes, sin agregar ningún keyframe ni mecanismo nuevo. Antes era el único tapete sin ningún brillo ambiental (quedaba "apagado" al lado del resto), ahora tiene una versión apenas perceptible que mantiene su identidad sobria.

## [1.21.2] - 2026-08-11

### Agregado — Paso 1 del plan de animaciones: lenguaje compartido
- **Tokens de movimiento** en `:root`: `--motion-fast` (.15s, feedback inmediato), `--motion-normal` (.4s, efecto de una acción puntual), `--motion-slow` (1.6s, ambiental/loop), más `--motion-ease`/`--motion-ease-soft`. Documentados con un comentario que explica el criterio — para que las próximas animaciones (fondo, fichas, atril de habilidades) salgan de ahí en vez de valores sueltos. Los ~70 `@keyframes` preexistentes quedan sin tocar por ahora (retocarlos sin poder verlos en un navegador real es demasiado riesgo).
- **Convención única de color de contexto**: `--fx-rgb` (terna "R,G,B", ej. `168,85,247`) reemplaza al par `--ab-color`/`--ab-rgb` que había quedado específico de habilidades — ahora es genérico, pensado para cualquier componente que necesite "su propio color" (habilidades, efectos de nombre, banners, futuras skins). `--ab-color` estaba definido pero nunca leído en ningún lado — se eliminó por completo.
- **Consolidación**: la ficha de habilidad (`tileHTML`/`tileBtn`) arma su color+glow con la misma variable `--fx-rgb` que ya usaban el modal y el tooltip de activación — antes construía su propio string de estilo a mano en JS (`abilityTileStyle`, eliminada), duplicando la receta visual en dos lugares distintos. Ahora la definición vive en un solo lugar (`.tile.tile-ability` en el CSS).
- Nota: el sistema de brillo de fichas recién bajadas (`--fx-color`/`--fxc`, dos nombres para casos parecidos) queda señalado como legado a revisar en una pasada futura — no se tocó en este paso por ser un efecto que se dispara muy seguido y no queremos romper sin poder verlo.

## [1.21.1] - 2026-08-11

### Agregado — prueba de animaciones
- Dos técnicas del catálogo de [prismic.io/blog/css-animation-examples](https://prismic.io/blog/css-animation-examples) aplicadas como prueba en los botones de la pantalla "Elegí modo de juego": `.fx-fizzy` (burbujas subiendo, estilo "CSS Fizzy Button") en "🎮 Jugar Casual (IA)", y `.fx-spark` (barrido de luz + glow, estilo "Storm Button") en "🌐 Multijugador". Ambas se disparan con hover Y con `:active` (para que también se vean en touch), y respetan `prefers-reduced-motion`.

## [1.21.0] - 2026-08-11

### Agregado — Pase Galáctico
- **Progreso nuevo y separado** del Pase de temporada existente: `p.galactico = {xp, claimed}` en el perfil, con su propia curva de XP (`galacticoXpForNextLevel`, 15 niveles — `80 + (nivel-1)*15`) y su propio catálogo `GALACTICO_PASS_LEVELS` (idéntico en `server/db.js` y `client/burako.js`, mismo criterio de paridad que el pase original).
- **Se sube SOLO jugando Modo Galáctico**: `DB.resolveMatch` acepta `opts.gameMode` y, cuando es `"galactico"`, además de todo lo de siempre suma XP al pase nuevo dentro de la MISMA transacción (30 XP por partida terminada + 50 de bono si ganó) — devuelve un bloque `galactico:{gained,level,leveledUp,...}` en el `update` que ya viaja en `matchResult`, sin pedidos extra al servidor.
- **Recompensas exclusivas, nunca comprables con monedas**: 2 categorías de inventario nuevas (`inventory.nameeffects`, `inventory.banners`) y sus `active.nameeffect`/`active.banner` — 4 efectos de nombre (Fuego, Hielo, Plasma, Vacío Cósmico), 2 banners (Aureola Dorada, Anillo de Plasma) y una skin de fichas exclusiva ("Agujero Negro", oculta de la tienda vía el nuevo flag `passOnly`). `_invKey`/`setActive` extendidos para estos 2 kinds nuevos; a diferencia de skin/tapete/efecto (que siempre tienen algo activo), nombre y banner son opcionales — `id:"none"` los desequipa sin necesitar poseerlos.
- **Se ven en vivo en la mesa**: el `player` de cada sala guarda `nameeffect`/`banner` leídos del perfil autoritativo (no de lo que mande el cliente) al entrar, `stateFor` los manda a todos, y un nuevo mensaje `setNameCosmetics` los actualiza si cambiás el equipo mientras ya estás en una sala. Aplicado en cliente a: tarjeta de rival, compañera de equipo 2v2, espectador, listas de sala de espera/equipos, selector de objetivo de habilidades, y el propio perfil/hub.
- Migración automática para perfiles viejos (login rellena los campos nuevos si faltan, mismo patrón que las migraciones anteriores).

## [1.20.0] - 2026-08-11

### Agregado — moderación de cuentas
- `DB.login()` acepta un `pendingAlert` opcional en el perfil del jugador: si está seteado, se entrega UNA sola vez en el próximo login (campo `alert` en la respuesta `authOk`, aparte de `profile` — nunca se persiste en `publicProfile()`) y se borra al toque. El cliente lo muestra como una ventana emergente que se superpone a cualquier pantalla en la que hayas terminado de loguearte.

## [1.19.0] - 2026-08-11

### Agregado — Modo Galáctico: ambientación "sala VIP" + fichas en el atril
- **Ambientación cósmica de toda la app**: nuevo layer `#galacticoBg` (estrellas titilando + nebulosa a la deriva + estrellas fugaces), visible mientras estás en cualquier pantalla de una sala de este modo (sala de espera, cuenta regresiva, reparto, partida, resultado) — no solo la mesa. `body.galactico-mode` retiñe las variables compartidas de panel (`--panel-bg`, `--panel-border`) para que el look violeta llegue a toda tarjeta/panel sin reescribir cada selector.
- **Fichas de habilidad en el atril**: dejaron de vivir en un panel aparte — ahora es una tira propia justo debajo de las fichas normales del atril (`.rack-abilities`), cada una con su color distintivo (`ABILITY_META.color`, nuevo campo) en vez de todas moradas por igual.
- **Tocar para describir**: tocar una ficha de habilidad muestra un cartelito (`.ability-tip`) con su descripción corta antes de activarla — recién con "⚡ Usar" ahí dentro se dispara la acción real.
- **Ventanas de activación rediseñadas**: `abilityModalWrap` ahora arma un cabezal con ícono circular con glow, nombre y descripción de la habilidad, coloreado según `ABILITY_META.color` — reemplaza el `<h2>` de texto plano de antes.
- **Botones de modo**: el menú Multijugador y el hub de Modo Galáctico ya usan el diseño de píldora con chip de ícono (ver entrada anterior), ahora con más brillo/animación acorde a la ambientación nueva.

### Agregado — Atracción: completar combinaciones desde la mano
- `useAtraccion` ahora acepta `msg.handTileIds`: en vez de (o adempas de) agregar la ficha atraída a una combinación tuya ya en la mesa, podés combinarla con fichas de tu MANO para armar una combinación nueva, que se baja directo a la mesa (ej. tenés 5 y 7 rojo en la mano, atraés el 6 rojo de una combinación rival → se arma 5-6-7 rojo). Si eso te deja sin fichas normales, se gana la partida.

### Arreglado
- **Índice de la ficha de habilidad gastada, otra vez**: mismo problema de fondo que el de Teletransporte (ver v1.18.0), variante nueva — `useAtraccion` en el camino "armar desde la mano" REEMPLAZA `room.hands[jugador]` por un array nuevo (`.filter(...)`), así que la variable `hand` que el dispatcher había capturado ANTES de correr el handler quedaba apuntando a un array viejo y descartado; splicearla ahí no sacaba la ficha de la mano real. Ahora el dispatcher siempre relee `room.hands[player.id]` en vivo, recién al final, antes de sacar la ficha usada.

## [1.18.0] - 2026-08-11

### Arreglado
- **Rivales de los costados desbordando su columna**: `.opp-card` pedía hasta 220px de ancho pero la columna de la grilla de mesa (`.seat-left`/`.seat-right`) es de 150px — como `align-items:flex-start/flex-end` no encoge el ítem, la tarjeta se desbordaba hacia el centro y, según el orden del DOM, quedaba pintada atrás del tablero (izquierda) o encima de él (derecha). Ahora, en el layout de escritorio, esas tarjetas se angostan a 136px y se apilan en vertical (avatar arriba, nombre y datos centrados abajo) para entrar enteras en su columna.
- **Robo dirigido decía "no tenés esa ficha" con la ficha en mano**: el cliente ponía `G.abilityModal` en `null` apenas mandaba `requestAbilityInfo` (paso 1 de 2), así que cuando llegaba la respuesta del servidor con la mano del rival ya no tenía guardado con qué ficha de habilidad se había arrancado el flujo — mandaba `tileId:null` en el `useAbility` final. Ahora ese id se guarda aparte mientras se espera la respuesta.

### Agregado — Modo Galáctico: anuncios y ambientación
- **Cartel de habilidad usada**: cada `useAbility` exitoso ahora manda también `abilityBy` (nombre de quien la usó) y `abilityKey` junto al toast — el cliente arma un cartel grande y animado en el centro de la pantalla, "NOMBRE USÓ 🦹 ROBO", visible para todos los jugadores de la sala (no solo en el historial, que quedaba escondido salvo que abrieras la pausa).
- **Mesa temática**: nueva clase `tp-galactico` (siempre activa en este modo, no depende del tapete elegido) con fondo violeta/nebulosa, borde con brillo y un layer de estrellas titilando + nebulosa a la deriva detrás de toda la zona de mesa (asientos + tablero).
- **Botones de modo rediseñados**: los tres accesos del menú Multijugador (Todos contra todos / 2v2 en equipo / Modo Galáctico) pasan de botones planos a un diseño tipo píldora con chip de ícono circular, inspirado en las referencias visuales aportadas — dorado para FFA, celeste para 2v2, cósmico (violeta/dorado con brillo animado) para Galáctico. El hub de Modo Galáctico también suma una tarjeta con estrellas de fondo y un banner de título con el mismo estilo.

## [1.17.0] - 2026-08-10

### Agregado — Modo Galáctico (M6: pulido final)
- Ícono 🛡 visible junto al nombre de cualquier rival con Escudo activo en su tarjeta de la mesa (antes el estado de Escudo solo se veía en el panel propio) — ayuda a no gastar una habilidad contra alguien protegido.
- Nueva categoría `ability` en `HISTORY_KINDS` del cliente: las jugadas de habilidad ahora tienen su propio ícono (🌌) y color en el historial, en vez de mostrarse genéricas.
- Retirada la instrumentación de test (`__testGiveAbility`, `__testGiveMeld`, gateada por `BURAKO_TEST=1`) usada durante el desarrollo de M2-M5 para forzar fichas/combinaciones determinísticas en los smoke tests — ya no hace falta con las 10 habilidades completas y probadas.

### Con esta entrega, Modo Galáctico queda completo
Las 10 habilidades (🦹 Robo, 🔄 Intercambio, 🎯 Robo dirigido, 🛡 Escudo, 🃏 Comodín, ✋ Robo doble, 🚫 Bloqueo, 👁 Visión, 🌀 Teletransporte, 🧲 Atracción) están activables, validadas de punta a punta contra el servidor autoritativo, con indicadores en pantalla y la condición de victoria (vaciar fichas normales) funcionando. Sigue pendiente para una fase futura: IA que sepa jugar este modo, y combinarlo con Ranked/Monedas/2v2.

## [1.16.0] - 2026-08-10

### Agregado — Modo Galáctico (M5: interacción con combinaciones existentes — últimas 2 habilidades)
- **🃏 Comodín**: convierte una ficha normal elegida de tu propia mano en `{joker:true, color:"comodin"}` de forma permanente. Sin objetivo rival, no consulta Escudo. Rechaza convertir una ficha que ya es comodín.
- **🧲 Atracción**: mueve una ficha visible de una combinación rival a una combinación PROPIA ya en la mesa — valida con `meldInfo` que la ficha entra de forma legal ANTES de tocar nada; si no encaja, la habilidad no se puede usar y no se consume. Si es válida, usa el mismo `removeTileFromMeld` de Robo/M3 para sacarla del origen (rompiendo esa combinación si queda inválida) y la agrega al destino.
- Con esto, las 10 habilidades del Modo Galáctico ya están completas y activables desde el panel "🌌 Habilidades".

## [1.15.0] - 2026-08-10

### Agregado — Modo Galáctico (M4: revelado de mano rival)
- **🎯 Robo dirigido**: protocolo de 2 pasos — `requestAbilityInfo` revela la mano completa de un rival, PERO solo al que preguntó (mismo patrón de privacidad que `teammateHand`/`markTiles` de 2v2); el Escudo se chequea en este primer paso, antes de revelar nada. Con la mano a la vista, `useAbility{chosenTileId}` mueve la ficha elegida a la mano del activador. Pedir la info todavía no gasta la habilidad — solo el paso 2 la consume.
- **👁 Visión**: de un solo paso (no hay elección posterior a hacer). Revela 3 fichas al azar de la mano de un rival — el resultado viaja por un canal privado (`result.private`, mandado solo al `ws` del activador) mientras el resto de la sala solo recibe el toast genérico sin contenido.
- Cliente: nuevos modales — elegir de qué rival robar/espiar, y para Robo dirigido un segundo modal mostrando la mano revelada para elegir la ficha específica.

## [1.14.0] - 2026-08-10

### Agregado — Modo Galáctico (M3: objetivo simple)
- **🦹 Robo**: saca una ficha visible de una combinación rival de la mesa y pasa a tu mano. Nuevo helper compartido `removeTileFromMeld(room, meldId, tileId)`: revalida lo que queda de la combinación con `meldInfo`; si deja de ser un juego válido (o queda con menos de 3 fichas), toda la combinación se rompe y sus fichas restantes vuelven a la mano de su dueño original.
- **🔄 Intercambio**: das una ficha propia elegida a cambio de una ficha AL AZAR de la mano de un rival elegido.
- **🚫 Bloqueo**: el rival elegido no puede activar ninguna habilidad durante su próximo turno (`room.blockedNextTurn`, ya existía la bandera desde M1; ahora una habilidad la usa de verdad).
- Las tres respetan el Escudo: si el objetivo (dueño de la combinación / del intercambio / del bloqueo) lo tiene activo, la habilidad se rechaza sin consumirse.
- Cliente: modal de selección de objetivo en el panel "🌌 Habilidades", con tres variantes — lista de rivales (Bloqueo), selección de ficha propia + rival (Intercambio), y navegación por las combinaciones rivales de la mesa (Robo).

## [1.13.0] - 2026-08-10

### Agregado — Modo Galáctico (M2: habilidades sin objetivo)
- **🛡 Escudo**: activa `room.shieldActive[jugador]`, que protege de cualquier habilidad rival que lo tenga como objetivo hasta que vuelva a ser su propio turno (cubre todos los turnos rivales intermedios).
- **✋ Robo doble**: marca `room.doubleDrawPending[jugador]`; el próximo `draw` de ese jugador saca 2 fichas del pozo en vez de 1 (respetando el stock disponible) y consume la bandera.
- **🌀 Teletransporte**: devuelve una ficha propia elegida (normal o de habilidad, pero no la misma que se está gastando) al pozo, lo mezcla y roba una nueva de inmediato.
- Nuevo mensaje WS `useAbility{ability, tileId, ...}` con validación completa ANTES de mutar nada: si el efecto no se puede aplicar, la ficha de habilidad no se consume y el turno de habilidad no se gasta. Máximo 1 habilidad por turno (`abilityUsedThisTurn`), reforzado en el propio dispatcher.
- Panel "🌌 Habilidades" del cliente ahora tiene botones "Usar" funcionales para estas 3 (las 7 restantes siguen visibles pero inertes, llegan en próximas fases). Nuevo modal chico de selección de objetivo para Teletransporte.
- Arreglado durante el desarrollo (nunca llegó a producción): el índice de la ficha de habilidad a descontar se recalculaba mal si el propio handler ya había mutado la mano (caso de Teletransporte, que hace `splice`+`push` antes de que el dispatcher descuente la ficha gastada) — podía borrar la ficha equivocada. Se recalcula el índice por id después de aplicar el efecto.

## [1.12.0] - 2026-08-10

### Agregado — Modo Galáctico (M1: infraestructura)
- **Nuevo modo online, todos-contra-todos**: `gameMode:"galactico"`, con su propio camino en el menú Multijugador (junto a "Todos contra todos" y "2v2 en equipo"). Se gana únicamente vaciando las fichas **normales** de la mano — sin variantes por tiempo ni por puntaje (`matchMinutes` y `winMode` quedan forzados/ocultos para este modo, tanto en la UI de crear sala como del lado servidor).
- **20 fichas de habilidad** (2 de cada una de las 10: 🦹 Robo, 🔄 Intercambio, 🎯 Robo dirigido, 🛡 Escudo, 🃏 Comodín, ✋ Robo doble, 🚫 Bloqueo, 👁 Visión, 🌀 Teletransporte, 🧲 Atracción) mezcladas en el mazo — aparecen al robar del pozo y se guardan en un panel aparte ("🌌 Habilidades"), separadas del atril normal (`splitHand()`, nuevo helper compartido en `burako-core.js`, server y cliente).
- La IA todavía no sabe usar habilidades — por ahora Modo Galáctico es siempre entre jugadores reales (`addAI` rechazado en salas de este modo).
- Esta entrega deja el modo jugable como un Burako normal con las fichas de habilidad visibles pero inertes; activarlas llega en próximas actualizaciones.

## [1.11.0] - 2026-08-10

### Agregado
- **Pase de temporada a 100 niveles** (antes 10): cada nivel da algo — monedas escalando con el nivel, skins/tapetes/efectos/sonidos cada 5 niveles, y un "hito" de avatares cada 10 niveles (28 avatares repartidos en 10 hitos). Tabla fija e idéntica en cliente y servidor (verificado con un script comparador, no generada en runtime, para que nunca puedan desincronizarse).
- **Nueva curva de nivel por décadas** (`xpForNextLevel` en `server/db.js` y `client/burako.js`): cada banda de 10 niveles es apenas más cara que la anterior, reemplazando la curva exponencial (`120 * 1.3^nivel`) que pasado el nivel ~30 volvía el resto del pase inalcanzable. Nivel 100 ahora demanda ~66.300 XP acumulados — largo pero realmente jugable.
- **Avatares con inventario**: dejaron de ser todos gratis. `server/db.js` agrega `inventory.avatars` (arranca con 6 gratis: 🀄😎🐺🦊👑🃏) y `setAvatar` valida propiedad en vez de una lista abierta; migración automática para cuentas viejas (nadie pierde el avatar que ya tenía puesto). Los 28 restantes se ganan vía el Pase.
- **Rango Legendario** (6000+ pts) arriba de Diamante, con badge propio y logro `reach_legendary`. Nueva pantalla "🏅 Ver todos los rangos" en Perfil, listando los 6 rangos y los puntos que necesita cada uno.
- Botón para cerrar (✖, arriba a la derecha) en la pantalla de Novedades.

## [1.10.3] - 2026-08-10

### Agregado
- **2v2 con IA**: el admin ya puede agregar bots a una sala 2v2 online. Regla estricta de composición: cada equipo tiene que ser IA+IA o Jugador+Jugador — nunca mezclados, validado tanto al asignar equipo como al arrancar la partida. Un equipo 100% IA juega su turno de forma completamente automática (reutiliza el motor de IA existente, ahora con "salir con 30" compartido a nivel de equipo igual que los humanos).

## [1.10.2] - 2026-08-10

### Arreglado
- **Desincronización al sacar fichas de la Preparación en 2v2**: arrastrar una ficha (propia o del compañero) de vuelta al atril desde la zona de preparación compartida solo se aplicaba localmente — el dueño original de la ficha no se enteraba y la seguía viendo en el pool. Ahora ese movimiento también se manda al servidor (`teamRemoveLoose`), que la devuelve a la mano de su dueño real y sincroniza a los dos, sea la ficha suelta o esté dentro de un grupo ya armado.
- **Desconexión innecesaria al volver a Multijugador tras terminar una partida online**: `leaveRoomToMenu()` cerraba toda la conexión con el servidor, así que había que reconectarse a mano (IP + login) para volver a jugar. Ahora usa el mismo mensaje liviano `leaveRoom` que ya se usaba para salir de una sala de espera — sale de la sala sin cortar la conexión, y "Multijugador" te lleva directo a la lista de salas de nuevo.

## [1.10.1] - 2026-08-10

### Cambiado — Confirmación mutua y ajustes de UI en 2v2
- **"Ficha y pasar" y "Bajar todo" pasaron a requerir confirmación de los dos**: cuando un integrante del equipo toca cualquiera de los dos botones, queda como una propuesta pendiente — al compañero le aparece un cartel para Confirmar o Cancelar, y recién con el "Sí" se ejecuta de verdad (roba la ficha o baja el juego). Si cancela, o si mientras tanto cualquiera de los dos vuelve a tocar la zona de preparación compartida, la propuesta queda sin efecto sin ninguna sanción.
- **Historial siempre visible**: en 2v2 volvió a la fila de abajo (se había escondido en la pausa cuando no entraba en pantalla junto al atril del compañero); el chat rápido general de esa columna queda oculto en 2v2 porque la coordinación de equipo ya tiene su propio chat aparte.
- **Aviso de turno para los dos**: el cartel "¡TU TURNO!" y su sonido ahora se disparan para ambos integrantes del equipo apenas arranca su turno, no solo para quien es el jugador "de base" en ese momento.

## [1.10.0] - 2026-08-10

### Cambiado — Turno de equipo real en 2v2 online
- El turno en salas 2v2 pasó de ser individual (por jugador) a ser **del equipo**: durante la ventana de turno de tu equipo, cualquiera de los dos integrantes puede tomar ficha, bajar juegos o armar jugadas — no hace falta esperar que le "toque" a uno en particular.
- **Zona de preparación compartida server-authoritative**: en vez de ser una copia local por pantalla (como en todos los demás modos), en 2v2 la mesa de armado vive en el servidor y se sincroniza en vivo entre los dos compañeros. Cada uno agrega SUS propias fichas al mismo pool compartido (`teamAddLoose`), pueden agrupar/desagrupar juntos (`teamFormGroup`/`teamDissolveGroup`/`teamAddToGroup`), y cualquiera de los dos puede confirmar (`teamConfirm`) para bajar el juego a la mesa — incluso si lo armó el otro.
- El puntaje de un juego armado entre los dos se reparte ficha por ficha a su dueño real, no todo a quien confirmó.
- Si el equipo decide tomar ficha del pozo en vez de bajar, o se acaba el tiempo del turno, cualquier ficha que hubiera quedado a mitad de armar en el pool compartido vuelve automáticamente a la mano de quien la puso.
- Reorganizar un juego de la mesa con comodín queda deshabilitado en 2v2 por ahora (su mecánica de "abrir localmente y rearmar" no es compatible todavía con la mesa de preparación compartida — se integrará en una fase futura).

## [1.9.1] - 2026-08-10

### Cambiado — Multijugador reordenado
- Multijugador pasó a tener dos caminos claramente separados desde una pantalla propia: **"👥 Todos contra todos"** (Casual/Ranked/Monedas) y **"🤝 2v2 en equipo"** (salas 2v2 online) — cada uno con su propio Crear sala / Unirse a una sala / Salas públicas. Antes el 2v2 online vivía escondido como un botón más dentro del selector de "Modo de juego" al crear una sala normal, muy difícil de encontrar.
- El modo offline contra IA se renombró a "🤖 2v2 vs IA · offline (Beta)" (antes "2v2 en equipo (Beta)") para no confundirse con el 2v2 online nuevo — son features distintas: una es offline con una compañera IA que comparte tu atril, la otra es online con 4 personas reales cada una con su propio atril.
- "Salir de la sala" en una sala de espera ahora vuelve al sub-menú correcto (Todos contra todos o 2v2, según de dónde viniste), no al selector de arriba de todo.

## [1.9.0] - 2026-08-10

### Agregado — 2v2 en equipo ONLINE (fase 1: jugadores reales)
- **Salas 2v2**: nuevo `gameMode` en Multijugador. El admin arma Equipo Azul y Equipo Rojo en la sala de espera (dos jugadores por equipo); siempre 4 jugadores reales, sin relleno de bots IA.
- **Sorteo con capitanes + alternancia estricta**: el jugador con mayor valor de sorteo de cada equipo es su "capitán" (cosmético); el orden de turno queda armado Azul/Rojo/Azul/Rojo, así ningún equipo juega dos veces seguidas.
- **Cuenta regresiva**: tras repartir, una pantalla de "5-4-3-2-1 ¡EMPIEZA!" antes de arrancar la partida.
- **Atril del compañero en vivo**: cada uno reparte y juega con su propio atril (no comparten fichas), pero ves un atril chico de solo lectura de tu compañero/a a la izquierda del tuyo, actualizado en tiempo real — durante el reparto y durante toda la partida.
- **Vidas de equipo compartidas** (3, como siempre): si el jugador en turno no actúa a tiempo, el equipo entero pierde una vida — con un aviso bien visible en pantalla para AMBOS integrantes unos segundos antes de que se acabe el turno (antes solo lo veía quien tenía el turno puesto).
- **Chat de equipo**: frases rápidas cerradas ("Necesito la N", "¿Pasamos?", Sí/No, etc.) que solo ve tu compañero — nunca los rivales (canal separado del chat rápido normal).
- **Marcado táctico multi-ficha**: tocá una o varias fichas del atril de tu compañero para sugerirle una jugada; se le resaltan en su propio atril.
- **Vista en vivo de la jugada en progreso** del compañero (zona de preparación) + botón para pedirle que la cancele (sin tocar su estado de forma remota, solo un aviso).
- **Ranking justo al ganar**: el compañero del equipo ganador ya no puede quedar ordenado peor que un jugador del equipo perdedor.

### Diferido a una fase futura
- IA como compañera de equipo (online u offline) — el motor de IA actual no tiene noción de equipo.
- Reparto exactamente parejo de premios/XP entre ambos ganadores del equipo (hoy se ordenan bien, pero la recompensa nominal todavía puede diferir levemente entre los dos).
- 2v2 arranca siempre como partida no-ranked (sin puntos de rango).

## [1.8.0] - 2026-08-10

### Agregado
- **6 tapetes de mesa nuevos**: Terciopelo Púrpura, Ónix Negro, Coral Tropical, Ártico, Bambú Zen y Vitral.
- **3 efectos de bajada nuevos, no puntuales**: Ola de Mesa 🌊 (una onda de color recorre toda la mesa), Pulso de Atril 💫 (tu propio atril destella al jugar) y Luces de Fiesta 🪩 (barrido giratorio de luces de colores sobre la mesa) — hasta ahora todos los efectos eran del estilo "explosión" en un punto fijo.
- **3 sonidos de ficha nuevos**: Burbuja, Cristal y Arcade.
- **Más avatares**: se duplicó la variedad disponible (animales, símbolos y más), tanto en el onboarding como en Perfil.

### Cambiado
- **Música de fondo**: tempo más rápido, osciladores más brillantes (triangle/square en vez de sine puro) y ataques más cortos, con bajo caminante y una melodía de 2 notas por compás — sonaba lenta y melancólica, ahora suena animada tipo casino.
- **Multijugador**: tanto al tocar "🌐 Multijugador" desde Jugar y querer volver, como al salir de una sala de espera ("Salir de la sala"), ahora se vuelve un paso atrás (a Jugar o a la lista de salas) en vez de ir directo al menú principal — y es instantáneo porque ya no cierra y reabre la conexión.
- **Casual IA**: el botón para volver pasó de una flechita chica arriba de la pantalla a un botón "← Volver" abajo, igual que en el resto de las pantallas.

### Arreglado
- **Scroll de la Tienda**: cambiar de pestaña o comprar un ítem reseteaba la posición del scroll a arriba de todo.

## [1.7.0] - 2026-08-08

### Agregado
- **Entrada al juego rediseñada**: pantalla de introducción a Burako, luego iniciar sesión (usuario/contraseña, Enter para enviar) o registrarte con confirmación de contraseña. Si el usuario no existe, el login te redirige automáticamente a registro con el nombre precargado. Nuevo botón **Salir** (cierra sesión y vuelve a la intro).
- **Menú principal reordenado**: Jugar, Perfil, Tienda, Opciones, Novedades, Cómo jugar, Salir.
- **Jugar → Casual (IA)** con dos modos nuevos: **Partida rápida** (10 min, 10 fichas iniciales, 1 a 3 rivales y dificultad al azar, arranca directo) e **IA-Casual configurable** (elegís condición de victoria —por tiempo o por puntaje objetivo—, duración, dificultad y cantidad de rivales). El viejo modo "Competitivo" queda absorbido acá. El modo 1 jugador no cambia.
- **Nivel de IA Extremo**: el motor de búsqueda combinatoria que ya tenía el servidor para bots online (antes inalcanzable, ningún botón lo seleccionaba) ahora se movió a `burako-core.js` compartido y se usa tanto para bots online como para la IA offline en el nivel Extremo. El lobby online ahora deja elegir dificultad (Fácil/Medio/Difícil/Extremo) al agregar un bot.
- **Salas públicas y privadas** en Multijugador: al crear sala elegís nombre y visibilidad; las salas públicas aparecen en un nuevo listado "🌍 Salas públicas" para unirse con un toque, sin código. Las privadas siguen requiriendo el código de 4 letras.
- **Opciones** (antes "Config") pasó a ser solo ajustes de audio: sonido y música de fondo, cada uno con su propio slider de volumen además del on/off. Los ajustes de partida (dificultad, rivales, tiempo por turno, duración) se movieron a la pantalla de configuración de IA-Casual.

## [1.6.1] - 2026-08-07

### Agregado
- **Skins de temporada**: Noche de Brujas 🎃 (octubre), Espíritu Navideño 🎄 (diciembre) y San Valentín 💘 (febrero). Solo se pueden comprar durante su mes correspondiente cada año; si ya la tenés, la seguís usando el resto del año sin problema. Se muestran en la Tienda con una etiqueta "🎁 Edición limitada" y desaparecen de la lista (para quien no las tiene) fuera de temporada.

### Arreglado
- **5 skins que no se podían comprar online.** Steampunk Gears, Furia Vikinga, Samurái de Élite, Reino de Cristal y Senda del Dragón se habían agregado al cliente pero nunca al catálogo del servidor (`db.js`), así que intentar comprarlas jugando online daba "Ítem no encontrado". Ya están en el catálogo.

## [1.6.0] - 2026-08-07

### Agregado
- **Tapetes de mesa animados**: luz ambiente que se mueve despacio, con color propio por tapete, en vez de un fondo estático.
- **Animación de reparto mejorada**: las fichas vuelan desde la bolsa una atrás de otra (con su sonido), no todas de golpe — tanto en el reparto inicial como al robar del pozo durante la partida, offline y online.
- **Música de fondo ambiente**: loop de acordes suaves (generado con Web Audio, mismo mecanismo que los efectos de sonido), con botón propio en Configuración, independiente del sonido de efectos.

## [1.5.0] - 2026-08-07

### Arreglado
- **Avatar que no se veía.** `netApplyState()` nunca copiaba el campo `avatar` (ni `rankPts`/`level`) al armar la lista de jugadores en el cliente, así que todos los rivales mostraban el mismo ícono por defecto en vez del que cada uno eligió. También hacía que el emblema de rango nunca apareciera junto a los rivales.

### Agregado
- **Modo espectador**: al quedar eliminado en una partida online de 3+ (por rendirte o quedarte sin vidas), ahora seguís viendo la mesa y los puntajes en vivo hasta que termine, con opción de salir cuando quieras.
- **3 efectos de bajada nuevos**: Arcoíris 🌈, Glitch 📺 (con tirón de pantalla estilo señal cortada) y Holograma 🔮.
- **Emblemas de rango rediseñados**: insignia con degradé metálico propio por rango (Bronce/Plata/Oro/Platino/Diamante — este último con brillo animado) en vez del emoji suelto, en Perfil, tarjetas de rival, tabla de posiciones y resultado de partida.

### Cambiado — reglas de vidas
- **3 vidas por partida** (antes 5).
- **El turno vencido ya no come fichas del pozo.** Antes, dejar pasar el timer costaba una vida pero regalaba 3 fichas — lo que permitía a un jugador dejar pasar el tiempo a propósito para "comprar" fichas extra a cambio de una vida. Ahora el turno vencido solo cuesta una vida y pasa el turno, sin fichas de por medio.

## [1.4.1] - 2026-08-07

### Arreglado
- **Chat en ventana negra.** El chat rápido se movió de un popup superpuesto (con fondo oscuro tapando la pantalla) a una fila compacta pegada al panel de Historial.
- **La mesa se reseteaba sola.** Con el paneo de la mesa (v1.4.0), cada vez que otro jugador jugaba se perdía la posición — mismo problema que ya se había arreglado para el historial, ahora aplicado también a la mesa.
- **Dos "Niveles" distintos para la misma XP.** El Pase de temporada tenía su propia curva de XP separada de la del Nivel de cuenta (mostrado arriba del perfil), así que mostraban números distintos para la misma XP — confuso. Ahora el Pase usa el mismo Nivel de cuenta en todos lados.

### Cambiado
- **Curva de XP por nivel más rápida al principio**: el nivel 1 pasó de pedir 500 XP a pedir 120, para que el progreso se sienta mejor desde el arranque (después sigue creciendo ~30% por nivel, igual que antes).
- Nuevo texto en Perfil que explica que **Nivel** (sube jugando cualquier partida) y **Rango** (Bronce/Plata/Oro/Platino/Diamante, solo cambia en partidas Ranked) son sistemas independientes.

### Investigado
- **Recompensas del Pase que "se desreclaman"**: se verificó contra la base de datos real del servidor y las reclamaciones sí persisten correctamente del lado del servidor. Si esto se sigue viendo, probablemente el navegador esté sirviendo una versión vieja en caché del cliente — probar con un refresco forzado (Ctrl+Shift+R) y confirmar que el servidor esté corriendo la versión actual (hay que reiniciar `node server.js` después de cada actualización, no se recarga solo).

## [1.4.0] - 2026-08-07

### Agregado
- **Arrastrar fichas a la zona de Preparación** desde el atril, y sacar una ficha suelta (o ya agrupada) arrastrándola de vuelta al atril. Las fichas que ya están en la mesa (juegos bajados) siguen sin poder arrastrarse directo al atril — solo se pueden mover las propias.
- **Mesa rediseñada**: 5-6 juegos por fila (antes 3-4, desperdiciando espacio a los costados) y sin barra de scroll visible — se arrastra con el mouse para moverse (paneo), con el límite natural del propio contenido.
- **Chat rápido**: emojis y frases predefinidas (👏 🔥 💀 ⏱️ ¡Apurate! y más) visibles para toda la sala, 1 mensaje cada 15 segundos por jugador para evitar spam.

### Arreglado
- **Scroll del historial que se reseteaba.** Como toda la pantalla se vuelve a dibujar en cada acción, el panel de historial perdía la posición de scroll constantemente. Ahora la mantiene.
- **Rendirse en modo Monedas no hacía perder la apuesta** en partidas de 2-3 jugadores (el "último puesto" nunca llegaba al índice que perdía la apuesta en la fórmula). Ahora rendirse siempre pierde la apuesta entera, sin importar cuántos jugadores había.

## [1.3.2] - 2026-08-07

### Arreglado
- **La sala no mostraba errores.** `renderLobby()` no tenía ningún lugar para mostrar `G.message`, así que cualquier error del servidor (apuesta rechazada, etc.) pasaba en silencio y daba la sensación de que la sala "no dejaba hacer nada". Ahora los errores se muestran arriba, en la sala.
- **"Volver al menú" con reconexión automática.** El botón de la pantalla de fin de partida cerraba la conexión y automáticamente reconectaba y volvía a loguear en segundo plano — un flujo innecesariamente frágil que podía sentirse como un cuelgue. Ahora solo desconecta; para volver a jugar online se entra de nuevo por "Multijugador", que conecta desde cero.
- **Rendirse online se sentía colgado.** Al confirmar la rendición, la pantalla de pausa se quedaba visible hasta que llegaba la respuesta del servidor. Ahora se cierra al instante.
- **Rendirse "premiaba" con buen puesto.** Al rendirse, la mano queda vacía (las fichas vuelven al pozo), y el cálculo de puesto final ordenaba por puntos en mano — una mano vacía ordenaba mejor que una mano real, dándole a quien se rindió un puesto (y en modo Monedas, un pago) mejor del que le correspondía. Ahora quien se rinde queda último sin importar cuántas fichas le quedaban.

## [1.3.1] - 2026-08-07

### Arreglado
- **Modo Monedas no pedía apostar al crear la sala.** El cliente mandaba el mensaje de crear sala y recién 300ms después el de configuración (que incluye el modo de juego); en esa ventana la sala quedaba en modo Casual y el cuadro de apuesta no se mostraba. Ahora el modo de juego viaja en el mismo mensaje de creación, sin demora.
- Se agregó un freno: no te podés marcar como listo en una sala Monedas sin haber apostado antes, para que la apuesta no pase desapercibida.

## [1.3.0] - 2026-08-07

### Arreglado
- **Recompensas del Pase de temporada online.** `claimPass()` solo tocaba el perfil local; en modo online el servidor nunca se enteraba del reclamo y la próxima sincronización de perfil lo pisaba (por eso una skin reclamada, como Madera, "desaparecía"). Ahora el servidor registra el reclamo de verdad (nuevo mensaje `claimPass`, con umbrales/recompensas espejados en `db.js`).
- **Fondo azul plano al entrar a jugar.** La clase `ingame` (que pone el fondo cálido de mesa) no se aplicaba durante el sorteo, así que justo al arrancar una partida se veía un flash de fondo azul liso antes de pasar al reparto.

### Agregado
- **Inventario en Perfil.** Nueva sección para elegir skin, tapete y efecto activos sin tener que entrar a la Tienda.
- **Modo de sala "Monedas"** (solo online, junto a Casual/Ranked). Cada jugador apuesta sus propias monedas al entrar a la sala (reemplaza al selector de skin en el lobby). Al terminar: 1° puesto recupera su apuesta + el doble de premio (x3 en total), 2° recupera su apuesta + la mitad (x1.5), 3° recupera solo lo apostado, y del 4° en adelante se pierde la apuesta. Se acredita/descuenta directo desde el servidor, no es un pozo compartido.
- **Explicaciones al crear sala**: qué significa cada modo de juego, el tiempo por turno, el límite de tiempo y el modo de victoria. Se sacaron las opciones "Rápido" y "Tiempo" (modo de victoria) porque no tenían ninguna lógica propia implementada y solo generaban confusión.
- **Formas de partículas distintas por efecto** (rayo, diamante, estrella, destello…), no solo círculos de colores.
- **Fondo decorativo global**: fichas flotando de fondo ahora se ven en todas las pantallas (antes solo en el menú), viviendo fuera de `#app` para no parpadear al cambiar de pantalla.
- **Enter para enviar formularios** de usuario/contraseña y código de sala.

### Cambiado
- Se retocó el detalle visual de las skins más planas (Océano Profundo, Plata Cromada, Esmeralda Tallada, Arcoíris, Holograma), que antes eran solo un degradé sin ningún ícono ni acento por color.

## [1.2.0] - 2026-08-07

### Arreglado
- **"Ganaste" repetido en el lobby.** El `winnerId` de la sala no se limpiaba hasta el próximo `startGame()`, así que cualquier broadcast posterior (alguien tildando listo, etc.) te volvía a mandar a la pantalla de fin de partida y repetía el sonido de victoria/derrota. Ahora el resultado se festeja/lamenta una sola vez, y "Volver al menú" desconecta realmente de la sala en vez de solo cambiar de pantalla localmente.

### Agregado
- **Bono de bienvenida de 10.000 monedas** para todos los jugadores — los que ya juegan y los que se registren de acá en más — con un aviso visible al entrar (antes había un regalo de 50.000 invisible, pensado solo para pruebas internas).
- **Modo 8 jugadores**, offline contra IA y en salas LAN online (además del modo normal de hasta 4). Con 8 en mesa se juega con 2 mazos completos (216 fichas) para que alcancen, y los asientos alrededor de la mesa se reparten automáticamente entre los rivales.
- **2 efectos de bajada nuevos**: Aurora Boreal 🌌 y Plasma Eléctrico 🌐, con más luces y colores; además el efecto Rayo ahora dispara un destello real de relámpago en toda la pantalla.

### Cambiado
- **Pase de temporada movido a Perfil.** Ya no es un botón aparte en el menú principal — se ve y se reclama desde adentro de tu Perfil.

## [1.1.0] - 2026-08-07

### Agregado
- **Contador regresivo de partida.** Nuevo selector de duración total (∞ / 10 / 20 / 30 / 45 / 60 minutos) tanto en la Configuración offline como en la sala online. Durante la partida se muestra un reloj ⏳ mm:ss en la barra superior que corre en vivo; al llegar a 0 la partida termina automáticamente y gana quien tenga menos puntos en la mano (igual que cuando se acaba el pozo).
- **5 skins de fichas nuevas**, con textura propia en CSS (no solo color plano):
  - Steampunk Gears ⚙️ — cobre remachado con engranaje animado.
  - Furia Vikinga 🪓 — madera curtida con runas nórdicas por color.
  - Samurái de Élite ⚔ — laca negra con borde carmesí y kanji.
  - Reino de Cristal 💎 — gema facetada translúcida con brillo animado.
  - Senda del Dragón 🐉 — escamas oscuras con veta dorada.
- **Indicador visual de jugada legal al arrastrar.** Al arrastrar fichas sobre un juego de la mesa o sobre la mesa vacía, se resalta en verde si la jugada sería válida o en rojo si no, antes de soltar.
- **Aviso al cerrar la pestaña.** Si cerrás o recargás con una partida en curso, el navegador confirma que vas a perderla (y, si es online, que quedás afuera).
- **Sonidos y efectos nuevos al jugar fichas:**
  - Sonido distinto y más liviano al pegar una ficha a un juego existente, separado del golpe fuerte de bajar un juego nuevo.
  - Fanfarria dorada "¡GRAN JUGADA!" (sonido + banner) para juegos de 50+ puntos.
  - Banner y sonido "¡COMBO x2/x3!" al bajar varios juegos en un mismo turno.

### Cambiado
- **Rendición por desconexión real.** Si un jugador cierra la pestaña o se desconecta en medio de una partida online, el servidor ahora lo trata como una rendición: queda eliminado, sus fichas vuelven mezcladas al pozo y la partida sigue para el resto. Antes solo se marcaba como "desconectado" y podía trabar la sala si le tocaba el turno.
- Se centralizó la lógica de rendición (`surrender`) y de forfeit por desconexión en una sola función del servidor (`forfeitPlayer`) para evitar duplicación y mantener el mismo comportamiento en ambos casos.

## [1.0.0] - baseline

- Versión inicial: single-player contra IA (3 niveles) y multijugador LAN con servidor autoritativo (Node.js + WebSocket).
- Sistema de rangos y competitivo, tienda con 25 skins de fichas, 11 tapetes y 5 efectos de bajada.
- Perfiles persistentes (JSON), logros, pase de temporada.

[Ver README.md](README.md) para el detalle completo de arquitectura y funcionamiento.
