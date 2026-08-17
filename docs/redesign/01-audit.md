# Auditoría técnica — estado real del código (2026-08-13)

> El README del root está desactualizado (dice burako.js = 116KB/2200 líneas). Estado real medido hoy:
> `client/burako.js` 5535 líneas (342KB) · `client/burako.css` 1965 líneas (131KB) · `client/burako-core.js` 399 líneas ·
> `server/server.js` 2017 líneas (102KB) · `server/burako-core.js` 389 líneas · `server/db.js` 915 líneas (39KB).
> El juego creció MUCHO más allá de lo documentado: hay un modo **2v2 en equipo** (con work-zone compartida, consenso de robo, chat rápido) y
> un **"Modo Galáctico"** completo con fichas de habilidad (Escudo, Robo, RoboDoble, Teletransporte, Intercambio, Bloqueo, RoboDirigido, Visión,
> Atracción, Comodín-habilidad), tapete propio, fondo animado propio y su propio pase de progreso ("Pase Galáctico", aparte del pase de temporada normal).
> Ninguno de los dos está mencionado en el README.

## 1. Sistema de fichas (tiles) — EL PROBLEMA RAÍZ de "capa pegada"

DOM real (`client/burako.js:3016-3027`, función `tileHTML`/`tileBtn`):
```js
const cname=t.joker?"comodin":t.color;
const content=t.joker?"★":t.number;
const core=`<div class="tile c-${cname} dotc-${cname} ${cls}" data-c="${cname}" data-tid="${t.id}">${content}<span class="sel-halo"></span></div>`;
return t.skin?`<span class="sk-${t.skin}" style="display:contents">${core}</span>`:core;
```
Una ficha es UN SOLO `<div class="tile c-rojo dotc-rojo">7</div>` (no dos capas superpuestas en el DOM). El material base es siempre el mismo marfil
(`client/burako.css:200-213`, gradiente `--ivory1/2/3`), y el "cuadrado pegado" que se queja el usuario es el `::after` que generan las reglas
`.dotc-*` (`client/burako.css:792-796`):
```css
.dotc-rojo::after{background:#e74c3c;border-color:#e74c3c;color:#e74c3c}
.dotc-azul::after{background:#3b82f6;...}
```
Ese `::after` es un puntito circular de 7×7px pegado abajo-centro de la ficha (definido genéricamente en `.sk-clasica .tile:not(.back)::after`,
`burako.css:919`, con `border-radius:50%` y sombras internas — es un círculo, no un cuadrado, pero visualmente sí es "una forma de color flotando
sobre la ficha base", separada del material real). El número (`content`) se pinta con `color:var(--rojo)` vía `.c-rojo{color:var(--rojo)}`
(`burako.css:233`) — es decir, el color del juego solo llega a dos lugares: el texto del número y ese punto decorativo. El resto de la ficha
(fondo, borde, sombra) es 100% igual para las 4 fichas de colores. **Esta es la causa exacta de la queja del usuario** — hay que rediseñar
`.tile` para que el color/material sea parte real de la superficie, no un accesorio.

## 2. Sistema de skins

`SKINS` array: `client/burako.js:690-729` — 30 skins definidas (no 15 como dice el README), + 3 skins de temporada (`season:[mes]`,
solo comprables en su mes) + 1 exclusiva de pase (`agujero_negro`, `passOnly:true`, nivel 9 del Pase Galáctico).//
Cada skin se aplica envolviendo la ficha en `<span class="sk-{id}" style="display:contents">` y el CSS pinta con selectores
`.sk-{id} .tile:not(.back){...}` (`burako.css:715` en adelante — negra, circulo, madera, piedra, elite, oriental, fuego, hielo, aracnido, tecno,
sombra, neon, galaxia, oro...). **Cada skin SÍ reemplaza background/border/box-shadow/color/text-shadow del contenedor `.tile` completo** (no es
solo una capa encima) — ejemplo `sk-fuego` (`burako.css:835`): gradiente + borde + animación `bordefuego` propia. Lo que NO cambia por skin es
el punto `.dotc-*::after` (varias skins lo redefinen a mano: `sk-elite`, `sk-oriental`, `sk-hielo`, `sk-neon`, `sk-fuego` tienen sus propios
`::after`, pero varias otras — negra, madera, piedra, aracnido, tecno, sombra, oro — se quedan con el punto genérico circular). Faltan ~15 skins
listadas en el objeto sin regla CSS propia visible en el grep rápido (pinguino, oceano, carbon, sakura, pixel, pirata, plata, esmeralda, arcoiris,
holograma, steampunk, vikingo, samurai, cristal, dragon) — **hay que confirmar en Fase 2 si tienen CSS en otro rango de líneas no cubierto por
este grep o si son skins "fantasma" (compra ble pero visualmente = clásica)**.

## 3. Animación del logo — LA CAUSA EXACTA de "fichas ocultas detrás de otras"

`client/burako.js:3488-3496` (dentro de `renderMenu`), genera 6 fichas (B-U-R-A-K-O) así:
```js
const spread=58; // grados totales del abanico
const fan=word.map((w,i)=>{
  const ang=-spread/2 + spread*(i/(n-1));
  return `<div class="tile c-${cols[i]} dotc-${cols[i]}" style="--rot:rotate(${ang}deg);
    transform:translateX(-50%) rotate(${ang}deg) translateY(-6px);animation-delay:${i*0.16}s">...`;
}).join("");
```
Y en CSS (`burako.css:978-990`):
```css
.fan{position:relative;height:150px;margin:10px auto 4px;width:340px}
.fan .tile{position:absolute;left:50%;top:20px;width:56px;height:76px;...
  transform-origin:50% 130%; animation:fanIn 1.1s ... backwards}
@keyframes fanIn{
  0%{opacity:0;transform:translateX(-50%) rotate(0deg) translateY(46px) scale(.5)}
  ...
  100%{transform:translateX(-50%) var(--rot) translateY(-6px) scale(1)}
}
```
**Causa raíz confirmada**: las 6 fichas comparten el mismo `left:50%` y el mismo punto de anclaje (`position:absolute`, sin ningún `margin-left`
ni `translateX` individual más allá del `-50%` compartido). La única separación entre ellas es la **rotación** alrededor de
`transform-origin:50% 130%` (un pivote por debajo de la ficha). Con un `spread` de solo 58° repartido en 6 fichas (~11.6° entre cada una) y sin
ningún desplazamiter real en X, las fichas quedan casi apiladas en abanico cerrado — exactamente el síntoma que describe el usuario
("las fichas quedan unas detrás de otras, muchas quedan ocultas"). Esta es la única animación de "logo" encontrada en el proyecto (no hay
ninguna en `renderIntro`, que es solo texto `.logo-text` sin fichas — ver `client/burako.js:4873-4887`).

## 4. Sistema de pantallas (`G.screen` state machine)

Dispatcher completo en `render()`, `client/burako.js:3248-3334`. Valores confirmados (bastantes más que los 15 del README):
`intro, auth, onboarding, menu, help, changelog, play, casualIA, iaCasualSetup, team2v2Setup, netConnect, lobby, netCountdown, sorteo, netSorteo,
dealing, netDealing, playing, gameover, shop, profile, config, pass, galacticoPass, rangos`. Cada uno tiene su `render*(app)` dedicada (lista de
funciones en la sección de research, todas ubicables por nombre con Grep — no hace falta repetirlas acá).

## 5. Sonido — CORRECCIÓN (encontrado durante Fase 4, 2026-08-13)

El punto §5 original de esta auditoría decía que no existía música de fondo. Es **incorrecto** — hay un objeto `Music`
completo (`client/burako.js:345+`) con progresión de acordes (Web Audio API, síntesis, mismo enfoque que `Sound`), volumen
independiente persistido en `localStorage` (`burako_music_on`/`burako_music_vol`, separado de `Sound.volume`), y ya está
conectado en `renderConfig` con sus propios controles Sí/No + slider — y arranca solo al primer click/tap
(`client/burako.js:5567`, patrón estándar para esquivar las políticas de autoplay del navegador). El grep original de la
auditoría buscó `bgMusic|music` en minúscula y no encontró el objeto `Music` (con M mayúscula) — un falso negativo. **Esto
cambia el alcance de Fase 8**: no hay que construir música de fondo desde cero, ya existe y funciona — el trabajo ahí será
visual (integrar el control en el nuevo Design System) y, como mucho, revisar si la composición/loop en sí vale la pena
mejorar.

## 5b. Sonido — texto original de esta sección (mantenido por trazabilidad, ver corrección arriba)

`Sound` (`client/burako.js:308+`) es **síntesis Web Audio API pura** (osciladores generados en runtime, no hay ni un solo archivo de audio
cargado). Confirmado por Grep: **no existe música de fondo** (no hay `<audio>`, no hay loop, no hay ningún `bgMusic`/`music` en todo el archivo).
Solo hay **un** control: `Sound.on` (bool) + `Sound.volume` (0-1, un único slider, `client/burako.js:1967`, dentro de `renderConfig`). No hay
separación entre música y efectos porque música no existe. Eventos que sí disparan sonido hoy: `Sound.meld()`, `Sound.win()`, `Sound.select()`,
`Sound.turn()`, `Sound.snap()`, y otros invocados desde los flujos de juego — la lista completa de métodos de `Sound` está en el objeto literal
que arranca en la línea 308 (revisar directamente ahí en Fase 8, no fue necesario volcarla acá).

## 6. WebSocket / protocolo — server más rico que el README

`server/server.js` sirve estático con `http.createServer` + `fs.readFile` manual (línea 37-49, **no usa Express**, sirve directo desde
`../client/`) y levanta `WebSocketServer` sobre el mismo server HTTP (línea 50). Handlers confirmados muy por encima del README: además de
`lay/layMultiple/attach/reorganize/draw/surrender`, hay todo un set de mensajes de **equipo 2v2** (`handleTeamOpenMeld`, `handleTeamAddLoose`,
`handleTeamRemoveLoose`, `handleTeamFormGroup`, `handleTeamDissolveGroup`, `handleTeamAddToGroup`, `handleTeamClearWork`, `handleTeamConfirm`,
`handleTeamProposeDraw`, `handleTeamProposeConfirm`, `handleTeamRespond`) y de **Modo Galáctico** (`useEscudo`, `useRoboDoble`,
`useTeletransporte`, `useRobo`, `useIntercambio`, `useBloqueo`, `useRoboDirigido`, `useVision`, `useComodin`, `useAtraccion`) — ver
`server/server.js:1209-1437`. También hay `catalog` (server manda `DB.CATALOG` + `DB.ACHIEVEMENTS` al cliente, línea 1491), listado de salas
públicas (línea 1437), y sistema de apuestas (`doPlaceBet` en cliente, `client/burako.js:5268` — **no auditado en profundidad, revisar en
Fase 4/5**).

## 7. Pase de temporada — YA EXISTE, completo, en cliente Y servidor (no hay que construirlo desde cero)

`PASS_LEVELS` (`client/burako.js:1308-1409`) define **100 niveles** con recompensas (monedas, skins, tapetes, efectos, sonidos, avatares) ligadas
directamente al nivel de cuenta (mismo XP/nivel del perfil, no una curva separada — el comentario en el código dice explícitamente que ANTES
tenía curva propia y se unificó). Curva de XP: `xpForNextLevel(level)` (línea 1413) por "décadas" (bandas de 10 niveles), **replicada
idéntica en `server/db.js`** (confirmado: `PASS_LEVELS` y `GALACTICO_PASS_LEVELS` también existen server-side, exportados en
`server/db.js:906`). Además existe un **segundo pase, "Pase Galáctico"** (`client/burako.js:1472-1530`, `galacticoPassLevel()`,
`claimGalacticoPass()`) con su propia progresión (sube solo jugando Modo Galáctico) que desbloquea efectos de nombre (`nameEffectHTML`),
banners (`bannerClass`) y la skin exclusiva `agujero_negro`. **Conclusión para el punto 10 del pedido del usuario: NO hay que inventar un pase
de batalla — hay que rediseñarlo visualmente sobre datos reales que ya vienen sincronizados del servidor** (`claimPass`/`claimGalacticoPass`
mandan `netSend({type:"claimPass",...})` cuando `G.online`, `client/burako.js:1429`).

## 8. Logros — también ya existen, servidor autoritativo

`ACHIEVEMENTS` cliente (`client/burako.js:732-740`, 7 logros) vs servidor (`server/db.js:164+`, con `coinReward`/`xpReward` separados — revisar
en Fase 4 si la lista larga del servidor es superset de la corta del cliente, parece que sí por el comentario "reportLiveAchievements" en
`server/server.js:136`). Notificación actual: `unlockAch()` (`client/burako.js:741-749`) hace `setMsg("🏅 Logro: "+a.name+...)` — **`setMsg` es
un toast de texto genérico** (mismo sistema que cualquier otro mensaje del juego, no hay animación ni componente dedicado a logros). Esto
confirma la queja del punto 19 del pedido: no hay ni `alert()` ni nada peor, pero tampoco hay nada especial — es un toast de una línea igual
a cualquier otro aviso.

## 9. Responsive

22 `@media` queries en total en `burako.css` (breakpoints reales usados: `max-width:400px`, `540px`, `640px`, `760px`, `820px`, `900px`, `430px`,
más varios `min-width:820px` para el layout desktop de mesa). 9 de esas 22 son `prefers-reduced-motion:reduce` (buena señal — ya hay bastante
disciplina de accesibilidad de movimiento en el código actual, hay que preservar ese patrón en el rediseño, no perderlo).

## 10. Colores hardcodeados — confirma la falta de design tokens real

**349 ocurrencias** de literales hex (`#xxxxxx`/`#xxx`) en `burako.css`, contra **1 sola** ocurrencia de uso real de `var(--color-*)` en todo el
archivo (la propia declaración circular en `:root`, línea 51-59). Es decir: **el bloque de design tokens ya existe** (`burako.css:51-66`:
`--color-bg`, `--color-surface`, `--color-blue`, `--color-blue-electric`, `--color-violet`, `--color-gold`, `--color-wood`, `--color-text`,
`--color-muted`, `--radius-sm/md/lg`, `--shadow-card`, `--shadow-gold`, `--transition-fast/normal` — nombres CASI IDÉNTICOS a los que pide el
punto 17 del brief) **pero está completamente desconectado del resto de la hoja de estilos** — 0 reglas reales lo consumen. Es trabajo muerto
que alguien dejó a medio empezar. **Hallazgo clave para Fase 2**: no hay que inventar los tokens, hay que (a) auditar si los nombres/valores
actuales son los correctos para la nueva identidad visual (azul profundo + violeta + dorado + madera — a primera vista SÍ calzan, ya declaran
`--color-blue`, `--color-violet`, `--color-gold`, `--color-wood`), y (b) migrar sistemáticamente los 349 literales a usarlos.

## 11. Capas / z-index

Inventario de z-index encontrados (no exhaustivo, hay más fuera de este grep pero da la escala): `0` (fondo/floaters/menu-elegant),
`1` (#app, mesa>*), `2` (elegant-hud, meld:hover, mesa-wave-fx, mesa-disco-fx), `4` (sel-halo), `5` (sel border, timerbar sticky),
`5-7` (tile.sel variants), `40` (toast), `50` (banner grande), `60` (pauseovl), `65` (ability-modal-ovl), `79-81` (trail particles),
`96-97` (glitch/lightning flash). **No es un sistema de capas nombrado** (no hay constantes `--z-modal`, `--z-overlay`, etc. — son números
mágicos repartidos en 20+ reglas distintas). El pedido del punto 18 (Background → Ambient → Table → Game objects → UI → Notifications →
Modal → Critical overlay) hay que construirlo desde cero como escala de tokens (`--z-bg`, `--z-table`, etc.) y remapear cada uso existente,
sin romper el orden relativo actual (que en general ya es coherente: fondo en 0, mesa en 1-2, HUD/selección en 4-7, toasts/banners en 40-50,
overlays de pausa/modal en 60-65, flashes de efectos en 96-97 como capa crítica — la jerarquía real ya funciona, solo falta nombrarla).

## 12. Servidor sirviendo estático (relevante para decidir Vite)

`server/server.js:37-49`: `http.createServer` con `fs.readFile` manual sobre rutas mapeadas a `../client/` — no hay ningún middleware, no hay
`express.static`, no hay soporte de rutas anidadas más allá de lo servido hoy (`burako.html`, `burako.css`, `burako.js`, `burako-core.js`).
**Importante para Fase 2 (Vite ya decidido por el usuario)**: para no romper el arranque actual (`node server.js` sirviendo también el HTTP
del juego), el build de Vite deberá apuntar su `outDir` a una carpeta (ej. `client/dist/`) y este bloque de `server.js` deberá actualizarse
para servir desde ahí en vez de la raíz de `client/` — cambio quirúrgico de rutas, no una reescritura del server.

## 13. `server/package.json`

```json
{ "name":"burako-lan-server","version":"2.3.0","main":"server.js","scripts":{"start":"node server.js"},
  "dependencies":{"ws":"^8.18.0"} }
```
Sin `devDependencies`, sin bundler, sin versión de Node fijada (`engines` no está declarado). Al introducir Vite habrá que agregar
`devDependencies` (`vite`, y wrappers de Three.js/GSAP si se instalan por npm) y decidir si el build vive en `server/` o en un nuevo
`client/package.json` propio (recomendado: `client/package.json` separado, ya que hoy `client/` no tiene ninguno y el server no debería
depender de devDependencies de frontend).

## 14. Librerías de animación ya cargadas

`client/burako.html` (19 líneas completas, ya leído entero): solo carga Google Fonts (`Cinzel`, `Cinzel Decorative`) + `burako-core.js` +
`burako.js` como `<script>` planos. **No hay GSAP, no hay anime.js, no hay Three.js, no hay ningún framework de animación** — todo el motion
actual es CSS `@keyframes`/`transition` + JS manual (`flightAnimate`, `runMeldFlight`, funciones de partículas tipo `spawnParticles`,
`flightSpark`, `flightShard`, etc., todas en `client/burako.js:816-1290`, un sistema de animación de vuelo de fichas hecho a mano con DOM
clonado — "ghost" elements posicionados con `getBoundingClientRect` y animados a mano). Esto es relevante: **ya existe un sistema de animación
de "vuelo de ficha" (clonar elemento, animar por coordenadas, destruir) que GSAP puede reemplazar/mejorar directamente** sin rediseñar el
concepto, solo la implementación.

---

## Problemas encontrados (mapa directo queja → código)

| Queja del usuario | Ubicación exacta | Causa raíz confirmada |
|---|---|---|
| "Ficha normal + cuadrado pegado encima" | `client/burako.js:3016-3027` (tileHTML) + `client/burako.css:792-796,919` (`.dotc-*::after`) | El color del juego solo pinta el número (texto) y un `::after` circular decorativo de 7px; el material de fondo/borde/sombra es idéntico para los 4 colores. |
| "Logo con fichas ocultas unas detrás de otras" | `client/burako.js:3488-3496` (generación del fan) + `client/burako.css:978-990` (`.fan`/`.fan .tile`/`@keyframes fanIn`) | Las 6 fichas comparten `left:50%` sin ningún desplazamiento horizontal individual; solo rotan (`spread:58deg` repartido entre 6) alrededor de un pivote común, quedando casi apiladas. |
| "Todo parece de proyectos distintos" / falta de Design DNA único | Todo `burako.css` | 349 colores hex hardcodeados repartidos en reglas puntuales por skin/pantalla/componente, contra 1 solo uso real del bloque de tokens ya declarado en `:root` (líneas 51-66) — cada pantalla/skin define su paleta localmente en vez de heredar del sistema. |
| Falta de design tokens (§17 del pedido) | `client/burako.css:51-66` | El bloque de tokens YA EXISTE con nombres casi idénticos a los pedidos (`--color-blue`, `--color-violet`, `--color-gold`, `--color-wood`, `--radius-*`, `--shadow-card`, `--shadow-gold`, `--transition-*`) pero nunca se conecta a ninguna regla real — es código muerto, no ausente. |
| Sistema de capas / z-index desordenado (§18) | Repartido en 20+ reglas de `burako.css` | No hay tokens de z-index; los valores (0,1,2,4,5,6,7,40,50,60,65,79-81,96,97) SÍ tienen una jerarquía relativa coherente hoy, pero sin nombrar ni centralizar — riesgo de colisión según se agreguen capas nuevas (Three.js canvas, partículas GSAP). |
| Pase de batalla "no debe simular progreso" (§10) | `client/burako.js:1304-1530` + `server/db.js` (`PASS_LEVELS`, `GALACTICO_PASS_LEVELS`) | Ya está conectado a datos reales de servidor (`claimPass` manda `netSend` en modo online) — el rediseño es puramente visual, no hay que tocar la lógica de progreso. |
| Música/efectos con volúmenes separados (§8) | `client/burako.js:308+` (`Sound`) | No existe música de fondo en absoluto (0 archivos de audio, síntesis pura); solo hay un volumen único. Hay que construir el sistema de música desde cero, incluyendo el control independiente música/efectos que hoy no existe ni parcialmente. |
| Logros con animación pobre (§19) | `client/burako.js:741-749` (`unlockAch`) | Usa el mismo `setMsg()` toast genérico que cualquier aviso del juego — no hay `alert()` (mejor de lo que el usuario temía) pero tampoco hay ningún tratamiento especial. |

## Notas para planificación de fases posteriores

- **Vite decidido por el usuario** (bundler real). Requiere: `client/package.json` nuevo, `vite.config.js`, actualizar `server/server.js:37-49`
  para servir el `outDir` del build en vez de `client/` directo, y decidir estrategia de dev (`vite dev` con proxy al WS del server, o servir
  todo por el server Node en dev también — a resolver en Fase 2).
- El **Modo Galáctico** y el **modo Equipo 2v2** son sistemas completos no mencionados en el pedido del usuario ni en el README — deben
  mantenerse funcionales (mismo Design DNA aplicado a sus pantallas/tapetes/HUD propios) aunque no fueron mencionados explícitamente punto por
  punto en el brief.
- El sistema de "vuelo de ficha" manual (`flightAnimate` y compañía, `client/burako.js:816-1290`) es el candidato más directo para
  reemplazar/potenciar con GSAP en Fase 7 — ya resuelve el mismo problema conceptualmente, solo con una implementación más rígida.
- 15 de las 30 skins declaradas en `SKINS` no tienen regla CSS confirmada en el grep rápido (pinguino, oceano, carbon, sakura, pixel, pirata,
  plata, esmeralda, arcoiris, holograma, steampunk, vikingo, samurai, cristal, dragon) — **verificar en Fase 2/6** si tienen CSS en un rango no
  cubierto o si hoy se ven como la skin clásica pese a estar a la venta (posible bug preexistente a reportar, no asumir).
