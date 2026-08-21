# BURAKO — Estado actual

> Snapshot al 2026-08-21. Esto es un corte en el tiempo, no una fuente viva —
> para el estado real al momento de leer esto, cruzar con `git log` y
> `CHANGELOG.md`.

## Commit / versión

- **Commit actual**: `5efe3eb` — "Matchmaking: fix crítico de sorteo/reparto
  trabado + composición 2-4 sin bots de más" — `main`, sincronizado con
  `origin/main`, working tree limpio.
- **Versión de cliente (`GAME_VERSION`, `client/burako.js`)**: `1.2.5`.
- **`CACHE_VERSION` (`client/sw.js`)**: `burako-v1.2.5` — en sync con
  `GAME_VERSION`, como corresponde.
- **`server/package.json` versión interna**: `2.3.0` — numeración separada e
  independiente de `GAME_VERSION` (histórico, del server standalone LAN
  original), no se usa como versión "de producto" — no confundir las dos.

## Producción

- **Render** (`burako-server.onrender.com`) es el backend activo. Deploy
  automático desde push a `main` (confirmado por el usuario — no requiere un
  paso manual adicional de redeploy).
- **Commit `5efe3eb` verificado en producción real hoy**, no solo local:
  - Suite end-to-end completa (`test-etapa5-production.mjs`) contra
    `wss://burako-server.onrender.com`: **20/20 OK** (registro, sesión,
    salas, sorteo, reparto, reconexión mid-partida, resolución de partida,
    persistencia en Supabase sin duplicar).
  - Smoke test específico de matchmaking contra producción, con los timeouts
    reales (30s, no acelerados): 1 humano en cola → backfill de exactamente 1
    bot → mismo pipeline `joined` que sala manual → `reveal` real → `dealDraw`
    real → fase `playing` con mano repartida. **5/5 OK.**
- **Fly.io**: pausado, sin endpoint activo, sin tráfico de producción. Ver
  DECISIONS.md y `docs/backend/fly-investigation/`.

## Últimas fases cerradas (más reciente primero)

1. **v1.2.5 — Matchmaking: fix crítico de sorteo/reparto + composición 2-4
   sin bots de más** (`5efe3eb`). Auditoría previa confirmó que matchmaking
   Casual/Ranked ya existía desde 1.2.3 — no se duplicó nada. Bug real
   encontrado por el usuario jugando (sorteo/reparto no respondían tras
   matchmaking), causa raíz identificada y corregida (`ws._applyRoomPlayer`),
   composición corregida a mínimo 2 / máximo 4, ventana de MMR progresiva en
   Ranked, UX de estados de búsqueda explícitos. Verificado en producción real
   (ver arriba). APK `burako-v1.2.5-matchmaking-fix.apk` entregado.
2. **Investigación Fly.io São Paulo** (`b8ad019`) — pausada, Render sigue en
   producción (ver DECISIONS.md).
3. **v1.2.4 — Fix: reconexión en PC/web** (`0f97c5e`) — `goOnlineConnect` caía
   en la pantalla de IP LAN cuando `resumeSessionSilently()` fallaba, en vez de
   mandar a login como ya hacía la rama nativa. Reportado por el usuario
   jugando desde Uruguay.
4. **Perf: menos round-trips a Supabase en `resolveMatch`/`checkAchievements`**
   (`1f0fed6`) — batching de logros (1 upsert en vez de hasta 26 inserts
   secuenciales).
5. **Matchmaking automático (Casual/Ranked) con relleno de bots** (`17f676b`)
   — versión original, v1.2.3 (luego corregida en el punto 1).
6. **Fase 1: infraestructura de recompensas y progresión** (`b1b6523`) — motor
   centralizado (`grantRewards`/`claimGrantSlot`/`REWARD_DEFINITIONS`, ver
   PROJECT.md §11).

Historial completo: `CHANGELOG.md` (raíz del repo) y `git log`.

## Tests actuales

- Regresión general (reglas, ranked, salas, fin de partida, chat, auth, motor
  de recompensas): **104/104** a la fecha del cierre de matchmaking.
- `test-matchmaking.mjs` (local, servidor propio con timeouts acelerados):
  **20/20** — cubre las 4 composiciones (1+bot, 2, 3, 4 humanos), ventana de
  MMR angosta y su expansión, cancelación, limpieza de fantasmas, y empuja
  cada sala real hasta fase `playing` de verdad (no solo `started:true`).
- Verificación puntual contra producción real (hoy, ver arriba): e2e 20/20 +
  smoke de matchmaking 5/5.
- Ver PROJECT.md §13 para la lista completa de scripts y cuáles son
  one-off/soporte (no regresión).

## Bugs conocidos / limitaciones abiertas

- **Cold start de Render Free** (~30-60s tras ~15 min sin tráfico) sigue
  siendo la limitación de latencia/UX dominante en producción — decisión
  explícita de mantenerlo así por ahora (ver DECISIONS.md, Fly pausado).
- **Sin guard contra doble sesión del mismo usuario** (multi-tab / multi-
  dispositivo simultáneo) — no hay código en `server.js` que lo detecte o
  impida. Limitación heredada de notas antiguas del README, **no reverificada
  activamente** en esta auditoría (puede que ya no reproduzca igual con el
  esquema de sesión por token actual).
- **Landmine de serialización encontrada en esta auditoría** (no confirmado
  impacto real en usuarios, no tocado): el primer `broadcast` que manda
  `formMatchmakingRoom`, antes de `startGame()`, sale con `phase:"playing"`
  por el default `room.phase || "playing"` en `stateFor` — ver PROJECT.md §7
  para el detalle completo.
- **Drag & drop en Firefox móvil**: nota histórica del README viejo sobre
  comportamiento flakey por diferencias de pointer events — no reverificada
  en esta auditoría, listada acá solo para no perderla.
- Datos de historial de partidas (`matches`/`match_participants`) se escriben
  en cada cierre de partida pero **no hay ninguna UI de cliente que los
  muestre** — no es un bug, es trabajo no iniciado (ver BACKLOG.md).

## Trabajo en curso

Ninguno. Matchmaking quedó formalmente cerrado (checklist completo entregado
al usuario). Esta misma tarea (`docs/ai/*`) es documentación pura, sin cambios
de funcionalidad, sin deploy — pendiente de revisión y commit por el usuario.

## Pendiente

Ver `docs/ai/BACKLOG.md`.
