# BURAKO — Decisiones cerradas

Solo decisiones ya confirmadas y reales, extraídas del código actual, el
CHANGELOG y la conversación con el usuario. No incluye ideas en evaluación ni
nada de `docs/ai/BACKLOG.md`. Si una decisión de acá contradice un doc viejo
(`README.md`, `docs/backend/01-architecture.md`), esta es la vigente.

## Infraestructura / hosting

- **Render sigue siendo producción.** `burako-server.onrender.com` es el único
  backend que sirve web y Android hoy.
- **Fly.io (São Paulo) queda pausado por inestabilidad**, no por costo ni
  latencia — Fly tenía MEJOR latencia base que Render, pero 3 soak tests reales
  (20-28 min, WS persistentes) mostraron desconexiones código 1006 que
  persistieron incluso después de corregir dos causas reales encontradas
  (`concurrency.type` mal configurado para WS, bug propio de heartbeat). Queda
  como entorno de prueba, infraestructura preservada (`fly.toml`, `Dockerfile`,
  logs en `docs/backend/fly-investigation/`), sin endpoint activo. Ver
  PROJECT.md §9.
- **Nunca escalar ningún backend por encima de 1 instancia** mientras el
  estado de las salas (`rooms`) viva en memoria de un solo proceso Node.

## Persistencia / datos

- **Supabase es la única fuente de persistencia y autenticación.** El
  cliente/APK nunca habla directo con Supabase — Node es el único cliente,
  usando la Service Role Key, que nunca sale del servidor.
- `players.json` queda solo como fallback de **solo lectura** para la
  migración perezosa de contraseña de los 16 usuarios originales — no es la
  fuente en vivo desde la Etapa 4.

## Autoridad del juego

- **Node es autoritativo.** Toda la validación de reglas, IA de bots, timers y
  resolución de partidas vive en `server.js`/`burako-core.js`. El cliente en
  modo online es "delgado": manda intenciones, nunca aplica lógica local.
- **Web y Android usan el mismo backend** (mismo protocolo WS, mismo
  `burako-server.onrender.com`). El APK apunta a producción vía
  `PROD_BACKEND_HOST` hardcodeado — nunca se generó un APK apuntando a Fly ni
  a ningún entorno de prueba.

## Reglas de juego

- **Primera bajada = un único juego que por sí solo sume 30 o más.** No se
  permite sumar el valor de varios juegos chicos para llegar a 30, aunque se
  puedan bajar varios juntos en la misma jugada (con tal de que al menos uno
  ya llegue a 30 por su cuenta).
- **Rendirse nunca puede ganar la partida** (fix Fase 0.5.1, bug real
  encontrado y corregido). El ganador por puntos/pozo agotado sale siempre del
  pool de jugadores activos, nunca de quien se rindió o fue eliminado.
- Turno de 60s, 3 vidas, 3 rupturas de comodín por partida — sin cambios desde
  el diseño original.

## Matchmaking

- **Mínimo 2, máximo 4 jugadores por sala.** Nunca se rellena con bots hasta
  completar 4 a propósito.
- **Si al vencer el timeout (30s) queda 1 solo humano, se agrega exactamente 1
  bot** — fallback para no dejar a una persona sola esperando indefinidamente,
  nunca relleno "hasta 4". Con 2 o 3 humanos al timeout, arranca con esos
  mismos, sin agregar bots.
- **Matchmaking reusa el mismo pipeline (`startGame()`) que las salas
  manuales** — decisión explícita de no duplicar sorteo/reparto en un segundo
  camino paralelo (el bug crítico de v1.2.5 fue justamente por no reusar
  correctamente el estado de conexión de ese mismo pipeline, ver PROJECT.md).
- **Ranked usa una sola cola** con ventana de MMR progresiva (arranca angosta,
  se amplía con el tiempo de espera) — explícitamente se descartó dividir en
  sub-colas por bracket.
- **El fallback de 1 bot cuando queda 1 humano solo aplica también en
  Ranked**, no solo en Casual — confirmado explícitamente por el usuario
  cuando se le preguntó si "Ranked solo humanos" implicaba sacar el backfill
  ("No, dejar el backfill con bots como está"). Los bots en Ranked ocupan
  asiento pero **nunca puntúan ni afectan MMR** (no tienen `username`,
  `resolveMatch` los ignora).
- Salas privadas (crear/unirse por código de 4 letras) son un camino
  completamente aparte del matchmaking automático — ya existían antes y
  siguen sin tocarse.

## Auth / sesión

- **Sesión persistente por refresh token reemplaza el reenvío de
  contraseña** — el cliente guarda un token de sesión, no la contraseña, y
  reconecta con `resumeSession`.
- Username no es email de cara al usuario — se sintetiza un email interno
  (`{username}@users.burako.internal`) solo para Supabase Auth.

## Disciplina de release

- **`GAME_VERSION` (cliente) y `CACHE_VERSION` (service worker) se bumpean
  siempre juntos** — evita que celulares con la app instalada queden con
  assets viejos cacheados.
- **Todo cambio se loguea en `CHANGELOG.md` y en el array `CHANGELOG` in-app**
  (pantalla de Novedades) — hábito establecido, no negociable por conveniencia.
- No exponer secretos (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`) en
  cliente, APK, repo ni logs — viven solo en `.env` local o el dashboard de
  Render.
