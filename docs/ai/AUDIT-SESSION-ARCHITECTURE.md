# Auditoría — Sesión, Autenticación, Reconexión y Estado Online

Pedida explícitamente por el usuario tras reportar inconsistencias de login/estado
online desde que el juego pasó a depender de un backend remoto. Alcance: **solo
lectura de código real** (`client/burako.js`, `server/server.js`, `server/db.js`).
No se tocó ni un archivo de producción para escribir esto. Metodología: dos
auditorías independientes en paralelo (cliente y servidor), cada hallazgo citado
con archivo:línea y código verbatim, después cruzadas entre sí en este documento.

## 0. Resumen ejecutivo

**El caso concreto que planteó el usuario (Perfil dice logueado, Logros dice que
no) está confirmado y tiene una causa exacta, no una sospecha.** Perfil y Logros
efectivamente leen de dos fuentes de verdad distintas — ver §3 para la traza
completa paso a paso con línea de código en cada paso.

No hace falta reescribir login/sesión desde cero. Varias partes ya están bien
diseñadas y deben **preservarse tal cual** (ver §10): el mutex contra
`resumeSession` concurrente, el alcance correcto de cuándo se borra el token, la
revocación real server-side en logout, el diseño de sala como `{id, ws}` en vez
de `ws` crudo, el grace timer de 25s para desconexiones en partida. El problema
está localizado en puntos específicos: falta un objeto de sesión único del lado
cliente, sobra un `onclose` que solo reacciona en partida activa, y del lado
servidor la identidad vive únicamente en el closure de la conexión sin ningún
registro independiente.

## 1. Arquitectura actual real

### Cliente (`client/burako.js`)

No existe un objeto `Session` único. El "¿estoy logueado?" está repartido en
**cinco variables independientes** que nadie sincroniza entre sí:

| Variable | Qué representa | Se persiste (localStorage) |
|---|---|---|
| `NET.ws` | socket WS activo | no (por diseño, es transporte) |
| `G.online` | booleano suelto, se pone/saca en ~7 lugares distintos | no |
| `G.serverConnected` | booleano suelto, similar a `G.online` pero no siempre igual | no |
| `G.auth.status` | `"unauthenticated"/"authenticated"/"sessionExpired"` | no, y **nunca se lee** en ninguna pantalla — es de solo escritura |
| `G.serverProfile` (presencia) | perfil recién bajado del servidor | no directamente, pero alimenta `P.*` |
| `G.serverAchievementsCatalog` (presencia) | catálogo de logros | **no, nunca** |
| `P.*` | caché de perfil (nombre, nivel, tier, logros propios) | **sí**, vía `saveP()`/`Store` |

`SESSION_TOKEN_KEY="burako_session_token"` guarda el refresh token de Supabase.
`ACTIVE_ROOM_KEY` guarda `{code, playerId}` de la sala activa con TTL de 3 min
para intentar `rejoin` tras una reconexión.

### Servidor (`server/server.js`, `server/db.js`)

Dentro de `wss.on("connection", ws => {...})` (server.js:1790), todo vive en
closures **por conexión**: `let room=null, player=null, authUser=null`. **No hay
ningún registro server-side que mapee `username → conexión(es) activa(s))`.**
La identidad del usuario literalmente no existe fuera del socket que la trajo.

`rooms` es un `Map` por código de sala (server.js:88); cada jugador dentro es
`{id, ws, username, connected, ...}` — el `id` se genera nuevo en cada
join/creación (`C.nid("p")`), **no es el id estable del usuario**, solo sirve
para que el cliente lo guarde en `ACTIVE_ROOM_KEY` y lo devuelva en `rejoin`.

No hay tabla propia de sesiones: se usa el mecanismo nativo de Supabase Auth
(refresh tokens rotativos de un solo uso, revocación real vía
`auth.admin.signOut(token,"global")`). Esto es una decisión de diseño correcta
y documentada (`db.js:63-68`) — no hay que reemplazarla.

## 2. Flujo completo actual (trazado línea por línea)

**Cold start:** `goIntroEnter()` navega a `menu` **inmediatamente**
(`burako.js:6499`) y recién después, en segundo plano, llama
`resumeSessionSilently()` (`:6500`). Es decir: la UI ya se muestra "logueada"
(desde el caché `P.*`) antes de que el servidor haya confirmado nada.

**Login/registro:** `submitAuth()` (`:6583`) envía `login`/`register` por WS →
servidor valida contra Supabase (`db.js:838-891` / `790-836`) → responde
`authOk` con `session.refreshToken` → cliente guarda token, marca
`G.online=true`, `G.auth.status="authenticated"`, llama
`syncProfileFromServer()` (llena `P.*`, persistido) y dispara
`netSend({type:"catalog"})` **sin esperar la respuesta** (fire-and-forget).

**`resumeSessionSilently`** (`:5415-5451`): correctamente protegida con un
mutex (`G._sessionOpInFlight`) contra llamados concurrentes — esta es una de
las partes mejor diseñadas del sistema. Reautentica el socket actual enviando
`resumeSession` con el token guardado. En éxito hace lo mismo que login
(perfil, `G.online`, etc.) pero **nunca vuelve a pedir `catalog`**.

**Reconexión de socket:** dos caminos que NO son equivalentes:
- `resumeSessionSilently()`-based (auto-reconnect, background→foreground,
  `resumeReconnect`) → sí re-autentica el nuevo socket.
- `ensureConnected()` (`:6946-6966`, usada antes de crear/unirse a salas,
  matchmaking) → solo reabre el socket, **nunca envía `resumeSession`**.

**Heartbeat:** cliente pinguea cada 20s (`:5579-5588`) pero **descarta el pong
sin timeout** — no hay forma de que el cliente note un socket "medio muerto"
(TCP half-open) que nunca dispara `close`. Servidor pinguea cada 25s
(`server.js:69-80`) y sí hace `ws.terminate()` si no hay pong, lo cual dispara
el `close` handler normal server-side.

**`close` del socket, lado cliente** (`:5809-5823`): **solo actúa si
`inActiveMatch()`** (fases `sorteo/dealing/playing/netSorteo/netDealing`). Fuera
de una partida — es decir, en Perfil, Logros, Tienda, el menú — un `close` no
hace absolutamente nada: ni marca `G.online=false`, ni intenta reconectar.

**`close` del socket, lado servidor** (`server.js:2509-2536`): dos caminos muy
distintos. Si la sala **no arrancó** (lobby), saca al jugador de
`room.players` **al instante, sin ninguna gracia** — un `rejoin` que llegue 50ms
después ya no encuentra nada. Si la sala **está jugando**, hay un grace timer
de 25s antes de aplicar el forfeit, que sí se cancela si llega el `rejoin` a
tiempo. Esta asimetría (instantáneo en lobby, gracioso en partida) es
inconsistente sin razón aparente.

**Background/foreground (`:7486-7526`):** único mecanismo es el evento DOM
`visibilitychange` — no existe ningún listener nativo de Capacitor (`App`
plugin). El propio comentario del código admite que en WebView Android el JS
puede pausarse sin que `ws.onclose` llegue a dispararse nunca.

**Matchmaking/salas:** `queueJoin` (`server.js:1859-1879`) exige `authUser`
pero no revisa si ese mismo usuario ya tiene otra entrada en cola desde otro
socket — dos pestañas o web+Android simultáneos pueden encolarse dos veces sin
que el servidor lo note.

## 3. El caso concreto del usuario, confirmado paso a paso

Esta es la reconstrucción exacta de *"entro correctamente → Perfil cree que
estoy logueado → el WebSocket cae/reconecta → Logros cree que no estoy
logueado"*, con cada paso citado:

1. Login exitoso → `syncProfileFromServer()` llena `P.*` y lo persiste en
   localStorage (`burako.js:748-787`). **Perfil no pregunta nada al
   WebSocket**: lee `P.*` directo (y en el caso del editor de avatar,
   `G.online`). Con `P.*` cacheado, Perfil se ve "logueado" incluso apenas
   arranca la app, antes de que el servidor confirme nada.
2. En ese mismo login, `netSend({type:"catalog"})` se manda **sin esperar
   respuesta**, en tres puntos distintos del código
   (`:5487`, `:6608`, `:7399`). La respuesta llena
   `G.serverAchievementsCatalog` (`:5677`) — **la única variable que la
   pantalla de Logros consulta** (`:2217-2220`):
   ```js
   function profileTabLogrosHTML(){
     const achCatalog = G.serverAchievementsCatalog || [];
     if(!achCatalog.length) return `<p ...>Conectate online para ver tus logros.</p>`;
   ```
   Esta variable **nunca se persiste** en localStorage.
3. El WebSocket cae mientras el usuario está fuera de una partida (Perfil,
   menú, Tienda). Por §2, `ws.onclose` del lado cliente **no hace nada** en
   ese caso — ningún estado cambia, nada se marca como desconectado.
4. El usuario reconecta (cambia de pestaña y vuelve, o hace F5).
   `resumeSessionSilently()` corre y re-autentica el socket nuevo
   correctamente — pero **en ninguna de sus ramas vuelve a pedir
   `catalog`** (`:5415-5451`, no hay ningún `netSend({type:"catalog"})`
   ahí dentro). `resumeReconnect()` (el camino de background→foreground,
   `:7510-7526`) tampoco lo pide.
5. Resultado: `P.*` sigue lleno (Perfil se ve perfecto),
   `G.serverAchievementsCatalog` sigue vacío **de esta sesión de página**
   (nunca se volvió a pedir), así que Logros muestra *"Conectate online para
   ver tus logros"* aunque el usuario esté 100% autenticado.

**Conclusión confirmada: Perfil y Logros no comparten fuente de verdad.**
Perfil confía en un caché local persistente que sobrevive cualquier cosa;
Logros confía en el resultado de un pedido *fire-and-forget* que se hace una
sola vez por sesión de página y nunca se reintenta al reconectar. Exactamente
la sospecha que planteó el usuario.

**Una segunda causa puede coexistir y agravar el síntoma general** (no específica
de Logros, más amplia): del lado servidor, `ws.on("message", async raw => {...})`
(`server.js:1807`) no serializa los mensajes de un mismo socket entre sí. El
handler de `resumeSession` hace un `await` real a Supabase (decenas/cientos de
ms). Si el cliente manda, inmediatamente después de reconectar y sin esperar
`authOk`, cualquier mensaje gateado en `authUser` (`queueJoin`, `buyItem`,
`dailyStatus`, `towerStatus`, `myProfile`, etc. — todos comparten el patrón
`if(!authUser) return send(ws,{type:"error", msg:"No estás logueado."})`), ese
segundo handler puede evaluarse **antes** de que el primero termine su `await`
y asigne `authUser`. El síntoma en el cliente: un error genuino de "no estás
logueado" en una función puntual, justo después de una reconexión que en
apariencia funcionó bien — coherente con *"a veces creo una partida... y
después no responde"* y con la sensación general de desincronía.

## 4. Problemas encontrados (severidad)

| # | Hallazgo | Severidad | Cita |
|---|---|---|---|
| 1 | No existe `session.isAuthenticated()`: 5 señales de "logueado" que pueden desacordar entre sí, una de ellas (`G.auth.status`) escrita pero nunca leída | **Crítica** | `burako.js` §1 |
| 2 | Logros gatea en `G.serverAchievementsCatalog` (efímero, fire-and-forget, nunca persistido ni re-pedido al reconectar) en vez de en el estado de sesión | **Crítica** | `:2217-2220`, `:5677` |
| 3 | `ws.onclose` (cliente) solo reacciona si hay partida activa; fuera de partida no marca desconexión ni reintenta nada | **Crítica** | `:5809-5823` |
| 4 | Servidor: `authUser`/`room`/`player` viven solo en el closure de la conexión, sin registro independiente de identidad | **Alta** | `server.js:1791-1805` |
| 5 | Race de mensajes: un handler gateado en `authUser` puede correr antes de que el `await` de `resumeSession` lo asigne | **Crítica** | `server.js:1807` + `1828-1837` |
| 6 | Race de token: `resumeSession` concurrente con un refresh token rotativo de un solo uso puede devolver `sessionExpired` para la llamada "perdedora" aunque la sesión sea válida | **Crítica** | `db.js:896-918` |
| 7 | `ensureConnected()` (usada por crear/unir sala, matchmaking) reabre el socket pero nunca reautentica (`resumeSession`) — diverge de los demás caminos de reconexión | **Alta** | `burako.js:6946-6966` |
| 8 | Servidor: al caer un socket en sala **no iniciada** (lobby), se saca al jugador al instante sin gracia — inconsistente con el grace timer de 25s que sí existe en partida | **Alta** | `server.js:2515-2517` vs `2524-2529` |
| 9 | Sin dedup de mismo usuario en dos sockets simultáneos (ni en login/resumeSession, ni en `matchQueues`) | **Media** | `server.js:1859-1879` |
| 10 | Sin timeout de pong del lado cliente — un socket "medio muerto" (TCP half-open) puede no disparar nunca `close` | **Media** | `burako.js:5579-5588` |
| 11 | Sin listener nativo de Capacitor `App` (pause/resume) — Android depende solo de `visibilitychange`, que el propio código admite que puede no dispararse en WebView | **Media** | `burako.js:7486-7526` |
| 12 | Rama `sessionExpired` de `resumeSessionSilently` no toca `G.online`/`G.serverProfile`, depende de que cada caller lo maneje bien | **Baja-media** | `burako.js:5437-5440` |
| 13 | Sin `ws.on("error")` en el servidor — el detalle de error de una caída nunca se loguea | **Baja** | `server.js` (no existe) |
| 14 | Dos registros separados de `wss.on("connection", ...)` (heartbeat aparte del resto) | **Baja** | `server.js:70` y `:1790` |

## 5. Race conditions identificadas

1. **Rotación de refresh token bajo `resumeSession` concurrente** (crítica) —
   dos intentos de resumir sesión casi simultáneos (p. ej. un reconnect
   automático más un reintento manual, o dos caídas de socket seguidas antes
   de que la primera respuesta llegue) usando el mismo token pre-rotación: el
   primero rota el token y gana, el segundo recibe `sessionExpired` aunque la
   sesión sea válida. Si el cliente trata `sessionExpired` como "andá al
   login", esto puede desloguear a un usuario con sesión perfectamente
   vigente.
2. **Mensajes que adelantan a `resumeSession`** (crítica) — ver §3, cierre.
3. **`rejoin` vs. remoción instantánea en lobby** (alta) — combinada con #2,
   una reconexión rápida en la etapa de lobby es estructuralmente
   irrecuperable aunque la misma situación en partida (`playing`) se maneje
   bien.
4. **Mismo usuario, dos sockets vivos** (media) — sin dedup, puede terminar
   con dos partidas simultáneas para una sola identidad.
5. **`ensureConnected()` abre un socket sin identidad server-side** (alta) —
   si el socket murió fuera de partida (por #3 del cliente, nadie lo notó) y
   el usuario después crea/une una sala, `ensureConnected()` abre un socket
   nuevo que el servidor nunca vio autenticarse, y sobre ese socket se manda
   `join`/`queueJoin` inmediatamente.

## 6. Código legado o defectuoso

- `burako_lan_pass`: completamente muerto (solo se borra, nunca se lee) — sin
  riesgo, se puede eliminar cuando se toque esa zona.
- `burako_lan_name`/`burako_lan_host`: vivos pero solo para prellenar campos
  de UI y overrides de host LAN — no forman parte del flujo de sesión, no
  aportan al problema.
- Fallback a `players.json` en `login()` (`db.js:867-886`): legado
  intencional, documentado, de solo lectura para migrar contraseñas viejas —
  **no es una fuente duplicada de identidad**, no tocar.
- `G.auth.status`: variable de sesión que se escribe consistentemente pero
  **nunca se lee** en ningún gate de pantalla — código muerto que aparenta
  ser la fuente de verdad y no lo es. Candidato natural a convertirse en el
  campo real del futuro `Session` (§11) en vez de descartarlo.

## 7. Dónde se duplica el concepto de sesión

**Cliente:** `G.online`, `G.serverConnected`, `G.auth.status`,
"¿`G.serverProfile` está seteado?", "¿`G.serverAchievementsCatalog` tiene
longitud?" — cinco lugares que deberían ser una sola pregunta
(`Session.isAuthenticated()`) y hoy son cinco variables mantenidas a mano en
puntos distintos del código, sin ninguna relación formal entre sí.

**Servidor:** no hay una segunda fuente por sí sola, pero el problema
equivalente es que la *única* fuente (`authUser` en el closure) no sobrevive
al socket — conceptualmente la identidad y la conexión son la misma cosa
hoy del lado servidor, que es exactamente lo que el usuario pidió separar.

## 8. Causa probable por síntoma

| Síntoma reportado | Causa raíz más probable |
|---|---|
| "Inicio sesión, entro a Logros y me pide loguearme aunque ya lo hice" | #2 — catálogo de logros fire-and-forget, nunca persistido ni re-pedido (confirmado en §3) |
| "Creo una partida y después no aparece / no responde" | #3 + #7 combinadas — socket murió en silencio fuera de partida, `ensureConnected()` reabre sin reautenticar, o #8 — se cayó en lobby y `rejoin` ya no encuentra el asiento |
| "Visualmente conectado pero ciertas funciones actúan como sin sesión" | #3 (onclose no marca nada fuera de partida) + #5/#6 (races de reconexión) |
| Comportamiento errático "desde que se migró al backend remoto" (no aislado) | Consistente con #1/#4: nunca hubo una única fuente de verdad, ni cliente ni servidor — antes (local) esto no importaba porque no existía reconexión de red |

## 9. Severidad global

- **Crítica** (bloquea la experiencia, reproducible, causa directa del reporte
  del usuario): #1, #2, #3, #5, #6.
- **Alta** (agrava o produce fallos secundarios reales): #4, #7, #8.
- **Media** (huecos reales pero de menor frecuencia/impacto): #9, #10, #11.
- **Baja** (higiene, no producen el síntoma reportado): #12, #13, #14.

## 10. Qué NO está roto (para no sobre-corregir)

- El mutex de `resumeSessionSilently` contra llamadas concurrentes
  (`G._sessionOpInFlight`) — bien diseñado, no tocar.
- El alcance de cuándo se borra el token (`clearSessionToken()`): solo en
  rechazo explícito del servidor o logout real — nunca ante un fallo
  transitorio. Ya es exactamente el comportamiento que pidió el usuario.
- `logout()` revoca de verdad del lado servidor (`auth.admin.signOut(...,
  "global")`), no es un simple "olvidalo del lado cliente".
- El diseño de Supabase Auth como única fuente de sesión (sin tabla propia) —
  correcto y documentado, no reinventar.
- El diseño de sala como `{id, ws, connected}` con `ws` reemplazable — ya es
  conceptualmente más parecido al `playerSession{userId,playerId,roomId,socket}`
  que propuso el usuario de lo que parecía a primera vista. Falta que `id` sea
  estable por *usuario* (hoy es estable solo por *ingreso a la sala*), no
  rehacer la estructura entera.
- El grace timer de 25s para desconexiones en partida en curso — funciona
  bien, es el modelo a copiar para el caso de lobby (#8).
- Los guards de socket obsoleto (`if(ws!==NET.ws) return; // viejo`) en
  `onerror`/`onmessage`/`onclose` del cliente — completos y consistentes, no
  hay listeners duplicados ni fugas de timers de reconexión.

## 11. Arquitectura objetivo propuesta

Tres capas, tal como las planteó el usuario, adaptadas a las restricciones
reales del proyecto (salas en memoria de un solo proceso, Supabase Auth como
única fuente de tokens — ver `DECISIONS.md`):

**SESSION MANAGER (cliente, nuevo)** — un objeto único que reemplaza las 5
variables de §7. Estados: `unauthenticated | authenticating | authenticated |
expired`. Guarda token, perfil (`P.*` pasa a vivir *dentro*, no al lado) y
catálogo de logros — y a partir de ahora el catálogo se persiste igual que el
resto del perfil, y se refresca en **cada** `resumeSession` exitoso, no solo
en el primer login de la página. Expone `Session.isAuthenticated()` como
única pregunta válida para Perfil, Logros, Tienda, Pase, Ranked. Es
prácticamente formalizar lo que `G.auth.status` ya intentaba ser, pero
haciendo que efectivamente se use.

**CONNECTION MANAGER (cliente, nuevo)** — envuelve `NET.ws`. Expone
`connection.isConnected()` para lo que sí debe preguntarle al socket (crear
partida, matchmaking). Unifica los dos caminos de reconexión hoy divergentes
(`resumeSessionSilently` vs `ensureConnected`) en uno solo: **todo** socket
nuevo pasa primero por reautenticación antes de considerarse utilizable.
Agrega timeout de pong real (hoy no existe del lado cliente).

**GAME SESSION (cliente+servidor)** — ya existe en germen (`ACTIVE_ROOM_KEY` +
`rejoin`); se refuerza igualando el grace period de cierre en lobby al que ya
existe en partida, y asegurando que `rejoin` se intente inmediatamente después
de que el Connection Manager confirme reautenticación, no en paralelo.

**Servidor** — sin inventar una tabla de sesiones nueva: agregar un registro
liviano *en memoria*, `authUser → conexión(es) activa(s)`, independiente del
closure de cada socket, para (a) poder decidir una política real ante
doble-sesión del mismo usuario, y (b) servir de base a futuro si se necesita
consultar "¿este usuario tiene alguna conexión viva ahora mismo?" desde
cualquier handler. Serializar (o poner mutex mínimo) el procesamiento de
mensajes por-socket para eliminar la race #2/#5.

## 12. Plan de migración por fases

Ninguna fase implica deploy, migración destructiva ni cambio de producción sin
aprobación explícita del usuario en ese momento. Cada fase cierra con tests
antes de pasar a la siguiente — nada de "big bang".

**Fase 0 — Confirmación en vivo (sin cambiar comportamiento).**
Instrumentar temporalmente (logs) los puntos exactos citados en §3 —
`ws.onclose` fuera de partida, el momento exacto en que
`G.serverAchievementsCatalog` se llena o no, y la ausencia de re-pedido de
`catalog` en `resumeSessionSilently` — y reproducir el flujo real (login,
esperar/forzar caída de socket fuera de partida, reconectar, entrar a Logros)
contra el servidor real de pruebas para convertir la traza de código en una
confirmación observada, no solo leída. Riesgo: ninguno, es solo logging
temporal, reversible al instante.

**Fase 1 — Arreglo puntual del bug reportado (Logros).**
Persistir el catálogo de logros junto al resto de `P.*`, y volver a pedirlo en
cada `resumeSessionSilently` exitoso (no solo en login/registro). Logros pasa
a leer del mismo "sesión lista" que ya usa Perfil, en vez de un flag aparte.
No toca WebSocket ni servidor. Riesgo bajo, acotado.

**Fase 2 — Cliente: Session Manager único.**
Introducir el objeto `Session` (envoltorio, no reescritura del login) que
consolida `G.online`/`G.auth.status`/perfil/catálogo detrás de
`Session.isAuthenticated()`. Migrar todas las pantallas gating (Perfil,
Logros, Tienda, Pase, Ranked) a usarlo. Riesgo medio — toca muchas pantallas,
pero de forma mecánica y verificable una por una.

**Fase 3 — Cliente: Connection Manager y `onclose` real.**
`ws.onclose` pasa a marcar siempre el estado de conexión (no solo en partida
activa) y a decidir reconexión de forma centralizada. `ensureConnected()` se
unifica con `resumeSessionSilently` para que todo socket nuevo reautentique.
Se agrega timeout de pong. Riesgo medio-alto — es la zona más sensible del
cliente, requiere los tests de §14 antes de darla por cerrada.

**Fase 4 — Servidor: serialización de mensajes y grace period de lobby.**
Eliminar la race #2/#5 (mensaje adelantándose a `resumeSession`) y equiparar
el cierre en lobby al grace timer que ya existe en partida. Riesgo medio —
toca el servidor real de partidas, requiere el patrón de tests de integración
real ya usado en el proyecto (Torre/matchmaking e2e).

**Fase 5 — Servidor: registro de identidad independiente del socket.**
`authUser → conexión(es) activa(s)` en memoria, y decisión explícita con el
usuario sobre política de doble-sesión (permitir vs. objetar). Riesgo medio,
depende de una decisión de producto, no solo técnica.

**Fase 6 (opcional, a evaluar) — Capacitor.**
Listener nativo de `App` (pause/resume) como respaldo de `visibilitychange`
en Android. Riesgo bajo, aislado a la build nativa.

## 13. Riesgos

- Tocar `onclose`/reconexión (Fase 3) es la parte más sensible: mal hecho
  puede generar reconexiones agresivas, salas duplicadas o loops de reconnect
  — mitigar con los tests de concurrencia de §14 antes de considerarla
  cerrada.
- Migrar el gating de pantallas (Fase 2) es mecánico pero de superficie
  amplia — regresión visual si se apura sin revisar cada pantalla migrada.
- Fases 4/5 tocan el servidor real de partidas en producción eventualmente —
  cualquier cambio ahí debe probarse contra el mismo patrón de e2e real que
  ya se usó para Torre/matchmaking antes de considerarse terminado, nunca
  solo con tests de lógica pura.
- Ninguna fase debe tocar el mecanismo de Supabase Auth en sí (rotación de
  tokens, revocación) — ya es sólido; el riesgo real sería reinventarlo peor.
- El plan completo (fases 0 a 6) es multi-sesión de trabajo — no se espera
  completarlo todo de una sola vez.

## 14. Tests necesarios

- **Reproducción dirigida del bug de Logros**: login → sacar el socket fuera
  de partida → reconectar → entrar a Logros. Antes y después de la Fase 1,
  como evidencia objetiva de que se corrigió.
- **Concurrencia de `resumeSession`**: dos intentos casi simultáneos con el
  mismo token pre-rotación — confirmar que el cliente no termina deslogueado
  si uno de los dos tuvo éxito.
- **Race de mensajes**: mandar un mensaje gateado en `authUser` inmediatamente
  después de `resumeSession`, sin esperar `authOk`, contra servidor real.
- **Reconexión en lobby**: cerrar el socket antes del `rejoin`, medir si hoy
  se pierde el asiento al instante; validar el nuevo grace period tras la
  Fase 4.
- **Multi-sesión**: mismo usuario en dos sockets a la vez, documentar y
  verificar la política que se adopte en la Fase 5.
- **Regresión completa existente** (matchmaking, endgame, Torre, Ruleta) en
  cada fase que toque servidor, para confirmar que nada de lo ya validado se
  rompe.
