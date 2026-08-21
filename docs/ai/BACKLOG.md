# BURAKO — Backlog

Solo pendientes reales ya definidos en conversación con el usuario o
confirmados como "infraestructura sin contenido" en la auditoría de código.
No incluye ideas especulativas nuevas. Explícitamente **no se avanza** con
nada de acá hasta que el usuario lo pida — ver DECISIONS.md e instrucciones
de la sesión de matchmaking ("no avanzar con Ruleta/Torre todavía").

## Matchmaking

Cerrado funcionalmente (v1.2.5, checklist entregado y verificado en
producción — ver STATUS.md). Nada pendiente de feature. Deuda técnica menor
detectada en la auditoría, no bloqueante:

- Landmine de `phase:"playing"` transitorio en el primer broadcast de
  matchmaking antes de `startGame()` (ver PROJECT.md §7) — evaluar si
  conviene un `room.phase = "forming"` explícito para evitar confusión futura
  en tests/tooling.
- Sin guard de doble sesión del mismo usuario (ver STATUS.md) — no específico
  de matchmaking, pero puede interactuar con "Cancelación/cleanup" si se
  reabre el tema.

## Rewards de rango (Ranked)

No implementado. `REWARD_DEFINITIONS` (motor de recompensas, `db.js`) está
vacío a propósito — es donde entrarían premios por alcanzar/mantener un tier
(ej. `rank_promo_gold`) o recompensas de fin de temporada. Hoy Ranked solo
aplica `rank_pts` (`RANK_DELTAS`) + XP/monedas genéricas iguales a Casual, sin
ningún premio extra por rango.

## Ruleta diaria

No implementada. No hay ninguna referencia en el código (`server.js`, `db.js`,
`burako.js`) a una ruleta o recompensa diaria. Debería apoyarse en
`grantRewards`/`REWARD_DEFINITIONS` (motor ya construido en Fase 1) en vez de
un mecanismo aparte.

## Misiones

No implementadas. Sin catálogo, sin tracking de progreso, sin UI. Mismo
comentario que Ruleta: el motor de recompensas ya está listo para recibirlas.

## Logros / títulos

- **Logros: ya implementados.** 26 achievements activos (`ACHIEVEMENTS` en
  `db.js`), con chequeo automático al cerrar cada partida
  (`checkAchievements`), premio de coins+XP, idempotencia real vía
  `reward_grants`. No es backlog, ya está en producción.
- **Títulos: infraestructura sin contenido.** El esquema ya soporta un slot de
  título (`inventory_items` tipo `title`, `profiles.active_title`,
  `setActive(kind:"title")` ya funciona en `db.js`), pero **no existe ningún
  título definido en ningún catálogo ni ninguna fuente que lo otorgue** —
  falta: (1) decidir qué títulos existen y qué los desbloquea, (2)
  conectarlos a `grantRewards`/logros/rango, (3) UI de cliente para elegir
  título activo (hoy no hay ningún lugar en `burako.js` que lo exponga).

## Torre semanal

No implementada. Sin referencias en el código. Mismo patrón esperado: apoyarse
en el motor de recompensas existente.

## Historial de partidas (detectado en auditoría, no en el pedido original)

Las tablas `matches`/`match_participants` (Postgres) **ya se escriben en cada
cierre de partida real** (`ensureMatchRow`/`recordMatchParticipants` en
`db.js`, llamados desde `finishMatch`/`forfeitPlayer`), pero no hay ninguna
pantalla en `client/burako.js` que lea o muestre ese historial al jugador. Los
datos ya existen — falta solo la UI de consumo. No estaba en la lista original
del usuario; se deja anotado acá porque apareció durante la auditoría de
código y encaja naturalmente como "mejora futura" de progresión.

## Mejoras futuras (sin fecha, sin compromiso)

- Guard de doble sesión / multi-tab del mismo usuario (ver STATUS.md).
- Revisar si la landmine de `phase:"playing"` transitorio en matchmaking
  merece un fix explícito (`room.phase = "forming"`) antes de que otra feature
  tropiece con ella.
- Reverificar si el drag & drop en Firefox móvil sigue siendo flakey (nota
  heredada del README viejo, sin reconfirmar).
