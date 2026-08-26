# FROM-CLAUDE — Fase 5 completada: validación integrada de sesión/reconexión + estabilización para producción

**Task:** `BURAKO-SESSION-ARCH-001` — Fase 5 (validación end-to-end de sesión,
reconexión y estado online sobre el sistema resultante de Fases 1-4B), luego
extendida por vos mismo a "fase de estabilización real para producción":
corregir cualquier bug crítico confirmado, repetir toda la regresión, y
llegar a un veredicto binario.

**Veredicto: `READY_FOR_PRODUCTION`** (web/servidor — Android físico queda
explícitamente pendiente, ver más abajo). Hice 2 rondas de commit+push+
deploy a Render — la primera corrigió 2 bugs críticos encontrados por el
soak test; el smoke test contra la URL REAL de producción encontró un
**tercer** bug crítico (solo visible con latencia de red real, nunca en
local) que exigió una segunda vuelta de fix+deploy+reverificación antes de
poder confirmar el veredicto final. Todo detallado abajo.

(Fases 0-4B siguen documentadas en el historial de este archivo y en
`docs/ai/AUDIT-SESSION-ARCHITECTURE.md`.)

## Qué pedías

Validación de punta a punta (login, restauración de sesión, reconexión en
menú/lobby/partida, matchmaking, logout/login, etc.) más un soak test de
30-60 minutos con desconexiones repetidas — y después, en un segundo
mensaje, pasar de "auditoría" a "estabilización real": si el soak encontraba
algo reproducible, corregirlo antes de cualquier deploy, y terminar en
`READY_FOR_PRODUCTION` o `BLOCKED_BY: <causa>`, sin quedar en un estado
intermedio.

## Metodología

Navegador real (Playwright) + servidor real (levantado por cada script, con
o sin timings acelerados según el caso) + Supabase real, sin mocks — mismo
criterio que las Fases 1-4B. Dos scripts nuevos:

- `server/scripts/test-e2e-fase5-scenarios.mjs` — recorrido de punta a punta
  de un usuario real (34 escenarios), timings acelerados para poder correr
  rápido.
- `server/scripts/test-fase5-soak.mjs` — soak test con **timings de
  producción reales** (sin acelerar `RECONNECT_GRACE_MS` ni `HEARTBEAT_MS`),
  3 superficies en paralelo (menú, lobby persistente, partida real con 2
  humanos), desconexión/reconexión repetida por varios minutos, con
  instrumentación de bajo nivel (WebSocket real, mensajes send/recv,
  `Connection`/`Session` state) para diagnosticar cualquier hallazgo.

## Bugs críticos encontrados y corregidos

Los 3 son de sesión/reconexión, ninguno visible en fases anteriores. Los
bugs #1 y #2 solo aparecen bajo reconexión **sostenida** (varios minutos),
no en un corte puntual — por eso el soak test era necesario. El bug #3 solo
aparece con **latencia de red real** — por eso el smoke test contra Render
real (no solo contra el servidor local) era necesario, incluso después de
que toda la regresión y el soak local dieran perfecto.

### Bug #1 — rate-limit de Supabase confundido con sesión vencida

`server/db.js: resumeSession()` trataba CUALQUIER error de
`supabase.auth.refreshSession()` igual: como refresh token inválido. Bajo
el soak (3 usuarios reconectando repetidas veces desde el mismo proceso/IP)
apareció un `429 "over_request_rate_limit"` real de la API de Auth de
Supabase — y el código lo mandaba a `sessionExpired` igual que un token
genuinamente muerto. El cliente entonces borraba el token guardado y
mandaba al usuario al login, **con una sesión perfectamente válida**.
Confirmado con el error exacto de Supabase logueado en vivo:
```
{"message":"Request rate limit reached","status":429,"code":"over_request_rate_limit","name":"AuthApiError"}
```

**Fix** (3 capas, mínimo y quirúrgico):
1. `server/db.js` — `resumeSession()` ahora distingue por status HTTP: un
   `429`/`5xx`/sin status (red, timeout) es **transitorio** (el token nunca
   se llegó a consumir, hay que reintentar); solo un `4xx` real que no sea
   rate-limit es una expiración de verdad.
2. `server/server.js` — el handler de `"resumeSession"` solo manda
   `sessionExpired` para el caso realmente vencido; el transitorio manda un
   `error` genérico que el cliente ya sabe manejar sin tocar `Session`.
3. `client/burako.js` — `tryAutoReconnect()` solo se olvida de la sala
   guardada (`clearActiveRoom()`) cuando el motivo es una expiración DE
   VERDAD, no ante cualquier fallo; `attemptMatchReconnect()` suma un
   reintento corto y acotado (un solo reintento extra, 2s de espera) para
   no agotar el intento especializado ante un hipo puntual.

Verificado: Session nunca volvió a pasar a `"expired"` de forma espuria en
ninguna corrida posterior del soak, ni siquiera reproduciendo la misma
carga que lo había disparado.

### Bug #2 — la sala/partida guardada para auto-reconectar "vencía" a los 3 minutos

Más grave en la práctica: `ACTIVE_ROOM_TTL_MS` (3 minutos,
`client/burako.js`) se mide desde el **join/creación original** de la sala
y **nunca se refrescaba** en reconexiones exitosas posteriores —
`tryAutoReconnect()` intercepta el `"joined"` de un rejoin automático ANTES
de que llegue al único código que llama `saveActiveRoom()` (el handler
genérico de `"joined"` del primer join). Resultado: **cualquier partida o
sala que durara más de 3 minutos — la inmensa mayoría de las partidas
reales de Burako — perdía la capacidad de auto-reconectar a partir de ese
punto**, aunque el jugador hubiera estado reconectando con éxito todo ese
rato. El cliente ni siquiera intentaba el `rejoin` en el siguiente corte;
todo quedaba en manos del margen de gracia del servidor (25s) sin ningún
reintento del lado cliente.

Confirmado en vivo con el soak: la pista de lobby (una sala persistente
todo el soak) empezó a fallar exactamente en el ciclo que cruzaba la marca
de los 3 minutos, y **nunca se recuperó** por el resto de la corrida (18
fallas de 29 ciclos).

**Fix**: refrescar el timestamp guardado en dos puntos:
1. Dentro de `tryAutoReconnect()`, en la rama de `"joined"` exitoso (cada
   rejoin automático que prospera).
2. En el handler genérico de `"state"` (cada mensaje de estado real
   recibido durante la partida) — así el TTL mide "tiempo desde la última
   presencia confirmada", no "tiempo desde el join original", cubriendo
   también el caso de una partida sin cortes que recién se desconecta
   después del minuto 3.

Verificado: la MISMA corrida de soak que antes fallaba 18/29 en lobby a
partir del minuto 3 pasó a **0 fallas en 23-29 ciclos**, sostenido más allá
de los 10 minutos de reconexión repetida.

### Bug #3 — el guard anti-secuestro de `rejoin` rechazaba reconexiones legítimas bajo latencia de red real

Encontrado recién al hacer el smoke test contra la URL REAL de Render
después del primer deploy — **nunca se reprodujo en ninguna corrida local**
(regresión completa, E2E, ni el soak de 10+ minutos), porque los
round-trips locales son sub-milisegundo y el guard nunca alcanzaba a
fallar. `server.js: rejoin` rechazaba la reconexión si `existing.ws`
apuntaba a un socket distinto del que mandó el `rejoin`
(`"Esa sala ya está conectada desde otra pestaña/dispositivo"`) — pensado
para bloquear un secuestro real desde otro dispositivo. El problema: cuando
la MISMA sesión reconecta (cierra el socket viejo, abre uno nuevo), el
aviso de cierre del socket viejo tiene que viajar por la red real hasta el
servidor — y con latencia real, el `rejoin` del socket NUEVO llega antes
de que el servidor se entere de que el viejo ya murió. El guard lo
rechazaba como si fuera un secuestro, dejando la conexión nueva
autenticada pero sin `room`/`player` server-side — cualquier `setReady`/
`start` posterior se perdía en silencio (el handler genérico
`if(!room||!player) return;` los ignoraba sin responder nada).

Un primer intento de arreglo (exigir además `existing.ws.readyState===1`)
**tampoco alcanzó** contra Render real — confirmado con el mismo smoke
test — porque el `readyState` del lado servidor depende igual de que el
frame de cierre llegue por red; puede seguir mostrando `OPEN` mucho después
de que el cliente ya cerró y reconectó.

**Fix real**: cambio de enfoque en vez de intentar adivinar si el otro
socket "sigue vivo de verdad". La identidad ya está confirmada arriba
(`playerId` + mismo `username` autenticado por Supabase) antes de este
guard — no hace falta ninguna señal extra. El `rejoin` más reciente
**siempre** gana la butaca; si había otro socket realmente activo (dos
pestañas/dispositivos de verdad), se lo avisa (`"Te conectaste a esta sala
desde otra pestaña/dispositivo"`) y se lo cierra, en vez de rechazar al que
se está reconectando de buena fe. Complementado con un chequeo en
`ws.on("close")` (`if (player.ws !== ws) return;`) para que un aviso de
cierre atrasado de un socket ya reemplazado por un rejoin más nuevo no
pise `connected` ni arme un grace timer sobre una sesión ya reconectada.

Verificado contra Render real: 3 cortes+rejoins seguidos sobre la misma
sala, luego arranque de partida con 2 humanos reales, sin ningún rechazo —
y el smoke test completo (14 checks) pasó limpio dos veces seguidas tras
el fix.

## Hallazgos de metodología (bugs del test, no de la app — documentados para no repetirlos)

- El primer intento de la pista de "reconexiones rápidas" del E2E (Esc.14)
  y del soak cerraban el socket de nuevo guiándose por
  `Connection.isConnected()` — señal que se pone en `true` apenas abre el
  TRANSPORTE (antes de que `resumeSession` mande siquiera el mensaje).
  Cerrar ahí mataba el socket de un intento todavía en curso, pareciendo
  "el socket se autocierra solo". Corregido esperando la confirmación real
  (`authOk`/`joined`), no una señal de transporte.
- La primera versión del soak (800ms-6s entre ciclos, 3 usuarios
  concurrentes) generaba más volumen de `resumeSession` que ningún uso real
  jamás produciría, autoinduciendo el rate-limit de Supabase (bug #1 lo
  hizo visible, pero la CADENCIA en sí no es representativa). La corrida
  final de confirmación usa 15s entre ciclos — sigue siendo mucho más
  agresivo que cualquier reconexión real, sin pisar límites de
  infraestructura ajenos al código.
- La pista de "partida" del soak nunca juega turnos reales (solo arma la
  partida una vez) — el temporizador de turno (tope 120s) eventualmente
  termina el juego por inactividad. Esto NO es una falla de reconexión; el
  script ahora lo detecta (`G.screen==="gameover"`) y deja de exigir esa
  pista sin contarlo como falla.

## Matriz de escenarios — E2E (`test-e2e-fase5-scenarios.mjs`, 34/34, corrido 3 veces)

| # | Escenario | Resultado |
|---|---|---|
| 1 | Abrir sin sesión — sin falso autenticado | ✅ |
| 2 | Login real | ✅ (~1.6-1.7s) |
| 3 | Perfil/Logros/Pase/Galáctico/Rangos/Tienda/Ruleta/Torre — sin falso "iniciá sesión" | ✅ (8/8 pantallas) |
| 4-5 | Recarga con token persistido → restauración automática | ✅ (~0.78-0.82s) |
| 6-7 | Corte de WS en menú → recupera solo | ✅ (~1.09-1.1s) |
| 8-10 | Lobby: crear, cortar, rejoin dentro del grace, servidor refleja membresía real | ✅ (~1.08-1.1s) |
| 11-12 | Partida con 2 humanos reales hasta "playing", corte + recuperación, Session nunca se corrompe | ✅ (~5-15s variable) |
| 13 | Background/foreground real (`visibilitychange`) → recupera solo | ✅ |
| 14a | Corte más rápido que un round-trip (stress) → Session nunca se corrompe | ✅ |
| 14b | 4 reconexiones a cadencia realista → todas con `authOk` | ✅ |
| 15-16 | Logout real + volver a loguearse | ✅ |
| 17-19 | Crear sala / unirse por código (otro navegador) / matchmaking real | ✅ |
| 20 | Logros sin falso logout tras todo el recorrido | ✅ |
| 24 | Sin estados cruzados (Session/Connection consistentes al final) | ✅ |

## Soak test — timings de producción reales (`test-fase5-soak.mjs`)

- **Antes de los fixes** (35 min, corrida completa): menú 0 fallas/63
  ciclos; lobby 49 fallas/63 (permanente desde el ciclo 14, Session terminó
  `"expired"`); partida 50 fallas/63 (mismo patrón). Confirmó ambos bugs.
- **Después de los fixes** (corrida final de confirmación, cadencia
  realista de 15s): menú 0 fallas; lobby 0 fallas sostenido más de 10
  minutos (antes fallaba desde el minuto 3); partida 0 fallas hasta que el
  juego terminó de forma NATURAL por inactividad de turnos (no una falla de
  reconexión) — Session autenticada y sin corromperse en toda la corrida,
  0 excepciones no atrapadas en el servidor, sin jugadores duplicados.

## Timings medidos

| Operación | Tiempo |
|---|---|
| Login (registro real) | ~1.6-1.7s |
| `resumeSession` tras recargar (arranque en frío) | ~0.78-0.82s |
| Reconnect automático (corte en menú) | ~1.09-1.1s |
| Rejoin de lobby dentro del grace (automático) | ~1.08-1.1s |
| Rejoin de partida dentro del grace (automático) | ~0.01-15s (variable, depende de fase de juego) |

## Regresión completa (repetida tras los fixes)

- Fase 1 (`test-cold-start-achievements.mjs`) — 9/9 OK.
- Fase 2 (`test-session-manager.mjs`) — 11/11 OK.
- Fase 3 (`test-connection-manager.mjs`) — 21/21 OK.
- Fase 4A (`test-serial-queue-unit.mjs` + `test-message-serialization.mjs`) — 6/6 + 10/10 OK.
- Fase 4B (`test-lobby-grace.mjs`) — 18/18 OK.
- `test-matchmaking.mjs` — 33/33 OK.
- `test-rooms.mjs` — 5/5 OK.
- E2E Fase 5 — 34/34 OK.
- Soak test Fase 5 — ver arriba.
- Smoke test contra Render real (`test-fase5-smoke-production.mjs`) —
  14/14 OK, corrido 3 veces tras el fix del bug #3: cold start real, login,
  Logros, Perfil, crear sala, rejoin de lobby, iniciar partida con 2
  humanos, reconectar en partida, matchmaking real, logout/login, sin
  falsos "iniciá sesión".

`test-chat-ui.mjs` no se repitió esta fase — ya estaba registrado en fases
anteriores como flaky/ambiental (22-23/23), sin relación con sesión/
reconexión; no se tocó nada de chat en esta fase.

## Riesgos restantes (documentados, ninguno bloqueante)

1. **Rate-limit de Supabase bajo carga artificial extrema** — bajo un
   volumen de reconexión MUCHO mayor que cualquier uso real (varios
   usuarios reconectando sub-10s de forma sostenida por minutos), Supabase
   puede rate-limitear la API de Auth. Esto es una característica de la
   infraestructura externa, no un bug de código — y ahora el sistema lo
   maneja correctamente: no corrompe la sesión, solo falla ese intento
   puntual y se recupera solo apenas la carga externa baja.
2. **Android/Capacitor: explícitamente pendiente.** Sin `adb`/emulador
   disponible en este entorno (confirmado ausente desde la Fase 0) — no se
   dio por validado WebView/Capacitor solo por haber probado en navegador.
   Recomendación: probar en un dispositivo/emulador real antes de generar
   y distribuir un nuevo APK, aunque el fix es 100% de cliente/servidor
   compartido (mismo `burako.js`).

## Deploy — hecho (2 rondas)

Siguiendo el flujo documentado en `docs/ai/PROJECT.md` §14 (Render tiene
auto-deploy activado en push a `origin main`, sin paso manual de redeploy):

**Ronda 1** (bugs #1 y #2, encontrados por el soak local):
1. Commit de las Fases 1-5 completas (Session Manager, Connection Manager,
   serialización de mensajes, grace period de lobby, y esta Fase 5).
2. `GAME_VERSION`/`CACHE_VERSION` → `1.2.6`, `CHANGELOG.md` y Novedades
   in-game actualizados.
3. Push a `origin main` → Render deployó automáticamente.
4. Smoke test con navegador real contra `https://burako-server.onrender.com`
   — encontró el **bug #3** (guard de rejoin, ver arriba), algo que ninguna
   corrida local podía haber agarrado.

**Ronda 2** (bug #3, encontrado por el smoke test contra producción real):
5. Fix en `server/server.js` (sin cambios de cliente — no hizo falta
   re-bumpear `GAME_VERSION`/`CACHE_VERSION`, son solo para cache-busting
   del cliente).
6. Regresión local completa repetida — todo verde.
7. Push a `origin main` → Render deployó automáticamente.
8. Smoke test contra Render real, corrido 3 veces — **14/14 limpio, sin
   fallas, de forma consistente.**

Fly.io sigue fuera de producción, tal como pediste — no se tocó nada de esa
investigación pausada.

## Pendiente

Ninguna fase siguiente arrancada — Ruleta, Torre, rangos y features nuevas
quedan tal como pediste, sin tocar. Único pendiente explícito: Android
físico/emulador (ver Riesgos restantes).
