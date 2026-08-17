# Burako — Etapa 5: deploy a Render (servidor público con wss://)

## 1. Qué cambió en el código para esto

- **`server.js`**: ya usaba `process.env.PORT || 8181` y `server.listen(PORT, ...)`
  sin fijar host — Node escucha en todas las interfaces por default, que es
  justo lo que Render necesita. No hizo falta tocar nada acá.
- **`client/burako.js`**: el auto-connect (`netConnect(location.host)`)
  armaba siempre `ws://` a mano. Ahora:
  - `wsUrlFor(host)` decide `ws://` vs `wss://` según `location.protocol`
    (una página servida por HTTPS no puede abrir `ws://` plano — mixed
    content, lo bloquea el navegador).
  - `defaultHost()` cubre el caso de la app empaquetada (Android/Capacitor):
    ahí `location.host` no sirve de nada porque el WebView sirve los
    assets desde un origen local, así que se usa `PROD_BACKEND_HOST`
    (constante al principio del archivo — **actualizar si el nombre del
    servicio en Render cambia**).
  - La web (servida directo por el propio servidor, en Render o en LAN)
    sigue sin necesitar ningún cambio manual: `location.host` ya es
    correcto en los dos casos.
- **`server/db.js`**: `LEGACY_DB_PATH` ahora puede venir de la env var
  `LEGACY_PLAYERS_JSON_PATH` (ver §4 — Render no tiene `players.json` en el
  filesystem porque nunca se sube al repo).
- **`render.yaml`** (nuevo, en la raíz): blueprint del servicio.

## 2. Qué NO cambió (a propósito)

- El protocolo WebSocket (tipos de mensaje, formato JSON) es exactamente el
  mismo — Render solo hace de proxy TLS delante del mismo `http.Server` que
  ya manejaba el upgrade a WS.
- LAN y desarrollo local siguen funcionando idénticos: abrir
  `http://localhost:8181` o `http://<ip-lan>:8181` sigue resolviendo
  `ws://` como siempre (confirmado con `npm run test:auth` corriendo
  local después de estos cambios, ver Etapa 4).

## 3. Variables de entorno a cargar en Render (dashboard → Environment)

| Variable | Valor | Notas |
|---|---|---|
| `SUPABASE_URL` | `https://yucsjceobsavknogrwyb.supabase.co` | No es secreta, pero se carga igual como env var (nunca hardcodeada). |
| `SUPABASE_SERVICE_ROLE_KEY` | (la clave real) | **Secreta.** Solo servidor. Nunca en el repo, nunca en el cliente/APK. |
| `LEGACY_PLAYERS_JSON_PATH` | `/etc/secrets/players.json` | Ver §4 — solo hace falta mientras sigan quedando usuarios de los 16 originales sin loguearse todavía con el flujo nuevo. |
| `NODE_VERSION` | `20` | Ya declarada en `render.yaml`, no hace falta cargarla a mano. |

`PORT` la inyecta Render solo — no se declara.

## 4. `players.json` en Render — Secret File

`players.json` nunca se sube al repo (contiene hashes de contraseñas
reales) pero el fallback de migración perezosa de contraseña (Etapa 4) lo
necesita disponible en el servidor la primera vez que cada uno de los 16
usuarios existentes se loguee contra Render. Solución: **Render Secret
Files** (dashboard → servicio → Environment → Secret Files) — un archivo
que se sube una sola vez desde el dashboard, vive solo en el filesystem del
servicio (nunca en git, nunca visible en el repo), y Render lo monta en
`/etc/secrets/<nombre>`.

Pasos:
1. Dashboard → tu servicio → **Environment** → **Secret Files** → **Add
   Secret File**.
2. Nombre del archivo: `players.json`. Contenido: pegar el `players.json`
   real (el mismo que ya está en `server/players.json` local).
3. Con el nombre `players.json`, Render lo monta en `/etc/secrets/players.json`
   — coincide con el valor de `LEGACY_PLAYERS_JSON_PATH` de la tabla de arriba.
4. Una vez que los 16 usuarios originales ya se hayan logueado contra
   Render al menos una vez (y por lo tanto ya migraron su contraseña a
   Supabase), este Secret File y la env var dejan de ser necesarios — se
   pueden borrar sin afectar a nadie.

Si no se carga este Secret File, el servidor arranca y funciona igual
(usuarios nuevos, usuarios ya migrados en Supabase) — lo único que no
funciona es el login de un usuario legacy que TODAVÍA no migró su
contraseña, hasta que se cargue el archivo.

## 5. Pasos de configuración del servicio en Render

1. **New** → **Blueprint** (o **Web Service** manual si se prefiere sin
   `render.yaml`) → conectar el repo de GitHub.
2. Si usa el Blueprint, Render lee `render.yaml` solo: nombre del servicio
   `burako-server`, `rootDir: server`, `npm install` / `npm start`.
3. Cargar las env vars de la tabla de §3 (las que tienen `sync: false` en
   `render.yaml` las pide el propio dashboard al crear el servicio).
4. Cargar el Secret File de §4 si corresponde.
5. Deploy. Render asigna una URL pública `https://<nombre>.onrender.com`
   (TLS/HTTPS automático, sin configuración extra).
6. Actualizar `PROD_BACKEND_HOST` en `client/burako.js` con el nombre real
   del servicio si difiere de `burako-server.onrender.com`, commitear y
   pushear (ver §1) — solo afecta al APK, la web no lo necesita.

## 6. Limitaciones conocidas del plan gratuito de Render

- **Sleep por inactividad**: un Web Service free "duerme" tras ~15 minutos
  sin tráfico entrante. El primer request/conexión después de dormido tarda
  bastante más (cold start, puede ser 30-60s) — un jugador que intente
  conectarse justo en ese momento va a ver el login/conexión colgado más de
  lo normal, no un error, pero sí una demora notoria.
- **Conexiones WebSocket activas NO evitan el sleep** por sí solas de forma
  garantizada en el plan free — si no hay tráfico HTTP nuevo, el servicio
  puede dormirse igual con partidas en curso, cortando las conexiones WS
  activas. Esto es una limitación real para partidas largas.
- **750 horas/mes compartidas** entre todos los servicios free de la cuenta
  — con un solo servicio corriendo 24/7 alcanza justo (730-744 hs/mes según
  el mes), pero no deja margen para un segundo servicio free simultáneo.
- **Sin disco persistente** en el plan free — no es un problema para este
  proyecto porque Supabase ya es la fuente de verdad; el único archivo que
  "necesitaría" persistir (`players.json`, vía Secret File) es de solo
  lectura y se sube una vez a mano, no se escribe en runtime.
- **Deploys redeploy el proceso completo** — cualquier partida en curso en
  memoria en ese momento se pierde (estado de sala/mano/turno, que siempre
  fue solo-en-memoria, ver arquitectura). No afecta lo ya guardado en
  Supabase.

Si estas limitaciones (sobre todo el sleep) terminan siendo un problema
real para jugar, la salida es pasar a un plan pago de Render (sin sleep) —
no se cambia de proveedor sin consultar antes, como pediste.

## 7. Resultado de las pruebas reales (a completar después del deploy)

Ver el reporte de fin de etapa en la conversación — esta sección documenta
el mecanismo, los resultados puntuales de cada corrida no se repiten acá
para no duplicar información que cambia con cada deploy.
