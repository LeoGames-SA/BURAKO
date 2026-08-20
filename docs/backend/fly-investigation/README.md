# Investigación Fly.io São Paulo (gru) — agosto 2026

Investigación de migrar el backend de Render Free (sin región en Sudamérica,
duerme tras 15 min sin tráfico) a Fly.io en `gru` (São Paulo), buscando bajar
el piso de latencia de red para jugadores de Uruguay/LatAm. **Conclusión:
pausada — Render sigue siendo producción.**

## Resumen ejecutivo

- **Fly tiene mejor latencia base**: operaciones de gameplay sin DB
  (`draw`/`layMultiple`/`attach`/`setReady`/`start`) — ~40-160ms en Fly vs
  ~205-260ms típico en Render. Confirmado de forma consistente en las 3
  corridas.
- **Pero no tiene estabilidad suficiente** en pruebas largas (20-28 min,
  conexiones WS persistentes reales, no el benchmark corto que abre/cierra
  sockets): las 3 corridas mostraron desconexiones inesperadas (código WS
  1006) agrupadas, típicamente entre los minutos 4 y 15, con huecos de
  ~24-35s antes del corte. `finishMatch` falló en las 3 corridas (timeout
  esperando la respuesta tras rendirse).
- **Render sigue siendo producción.** Fly queda desplegado (`fly.toml`,
  `Dockerfile` en la raíz del repo) como entorno de prueba, sin tráfico real,
  para retomar la investigación más adelante o abrir un ticket de soporte
  con Fly usando estos mismos datos.

## Qué se descartó (con evidencia, no supuesto)

| Hipótesis | Resultado |
|---|---|
| Presión de CPU/RAM | Descartada — ~70MB de 459MB usados, load average ~0.03-0.04, constante en las 3 corridas |
| OOM | Descartada — `dmesg` sin ninguna línea de oom/killed process |
| Reinicios de la máquina Fly | Descartados como causa — 2 reinicios reales, pero ambos correlacionan con mis propios `fly deploy` (reinicio normal de rolling deploy), no con las corridas del soak test; 0 reinicios durante las 3 corridas |
| `concurrency.type = "requests"` mal configurado | Corregido a `"connections"` (el valor correcto según el blog oficial de Fly sobre WebSockets) — **no resolvió el problema** |
| Bug propio: heartbeat bloqueado por el loop de turnos secuencial | Real, corregido (heartbeat pasó a `setInterval` independiente por conexión) — **tampoco resolvió el problema** |

Con esas dos causas descartadas mediante fixes reales (no solo teoría), el
patrón de desconexiones persistió igual en la 3ra corrida — apunta a algo
más profundo de la plataforma/región/proxy que no se llegó a aislar con la
configuración disponible desde `fly.toml`. Candidato para un ticket de
soporte de Fly, con estos logs como evidencia.

## Archivos de esta carpeta

- `soak-1-output.log` — 1ra corrida (21 min). `concurrency=requests`,
  heartbeat con el bug del loop (sin corregir todavía). 3 desconexiones,
  errores crecientes, `finishMatch` con timeout final.
- `soak-2-output.log` / `soak-2-result.json` — 2da corrida (28 min).
  `concurrency=connections` ya corregido, heartbeat TODAVÍA con el bug.
  10 desconexiones (7 de ellas del mismo jugador en cadena), `finishMatch`
  con timeout.
- `soak-3-output.log` / `soak-3-result.json` — 3ra corrida (28 min).
  `concurrency=connections` + heartbeat corregido (setInterval real,
  independiente por conexión — ver `server/scripts/soak-test-fly.mjs`).
  7 desconexiones agrupadas (códigos 1006, huecos de 24-34s), además de
  degradación progresiva de latencia (p50 subió de ~120ms a ~595ms y se
  quedó ahí). `finishMatch` con timeout otra vez.

Los `*-result.json` incluyen `connectionLog`: un registro por conexión
(`connectionId`, apertura, pings de mantenimiento enviados, último mensaje
recibido, código/motivo de cierre) para poder correlacionar exactamente
qué pasó con cada jugador — sin credenciales ni tokens (verificado).

## Infraestructura que queda preparada (no desplegar sin revisar esto primero)

- `Dockerfile` y `.dockerignore` (raíz del repo) — build de `server/` +
  `client/` para Fly. **Ojo con `.dockerignore`**: los patrones sin `**/`
  adelante NO son recursivos (a diferencia de `.gitignore`) — ya hubo un
  leak real de `server/.env` por este motivo, corregido, pero es una trampa
  fácil de volver a pisar si se edita.
- `fly.toml` — región `gru`, `auto_stop_machines=false`,
  `min_machines_running=1`, `concurrency.type=connections`. **Nunca**
  correr `fly scale count` por encima de 1 — el estado de las salas vive en
  memoria de un solo proceso Node.
- App Fly ya creada: `burako-server-gru` (secrets ya cargados vía
  `fly secrets set`, nunca en este repo).
- `server/scripts/soak-test-fly.mjs` — el script de soak test realista
  (3 conexiones WS persistentes, partida real, heartbeat desacoplado). Para
  repetirlo: `TARGET_WS_URL=wss://burako-server-gru.fly.dev SOAK_DURATION_MS=1680000 node scripts/soak-test-fly.mjs`.
- `server/scripts/measure-latency-ops.mjs` — benchmark corto por operación
  (el que sí mostró a Fly ganando en piso de latencia).

## Próximos pasos si se retoma

1. Abrir un ticket de soporte a Fly con `soak-3-output.log` +
   `soak-3-result.json` — pedir explicación puntual de los cierres 1006 con
   huecos de 24-34s pese a tráfico de mantenimiento cada 15s y
   `concurrency.type=connections`.
2. Alternativa a probar: región distinta de Fly, o un plan pago con IP
   dedicada (una IP compartida puede tener comportamiento de proxy distinto).
3. Repetir el soak test si Fly/soporte sugiere un cambio de config concreto
   — no repetir a ciegas sin una hipótesis nueva y verificable.
