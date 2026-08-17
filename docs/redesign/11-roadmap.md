# Fase 11 — Art Direction & Polish Pass

Segunda pasada sobre el sistema ya construido en las Fases 1-10 (`00-roadmap.md`). No es un rediseño nuevo — es
corrección de composición, continuidad, jerarquía y coherencia entre pantallas que ya funcionan.

## Marco de decisión (en vez de "skills" literales)

No existen skills instalables llamadas Three.js/GSAP/Design DNA/Motion Design/Genjutsu en este entorno (confirmado en
Fase 1). Se aplican como criterio real, no como texto decorativo:

- **Design DNA**: toda decisión de color/material/tipografía se valida contra `02-design-dna.md` — si algo nuevo no
  encaja en la paleta ya definida (azul profundo, azul eléctrico, violeta, dorado, madera cálida, ámbar), se ajusta la
  paleta con justificación, no se inventa color suelto.
- **Motion Design**: cada animación nueva declara su tier (`--motion-fast` microinteracción, `--motion-normal`
  transición de pantalla, `--motion-hero` evento grande) — nunca una duración inventada.
- **Genjutsu** (lente transversal de composición/jerarquía/UX): antes de tocar CSS en una pantalla, se nombra
  explícitamente qué problema de composición se está resolviendo (densidad, jerarquía, continuidad, foco) — no se
  cambia "porque sí".
- **GSAP**: confirmado Flip (gratis desde abril 2025, ya incluido en `gsap` 3.15 instalado) como técnica para
  continuidad entre pantallas — un elemento (ej. el logo) se mide en su posición actual y GSAP anima la diferencia
  hacia la nueva posición, en vez de destruir y recrear.
- **Three.js**: se reconsidera puntualmente para la portada (pedido explícito del usuario), con el canvas viviendo en
  `#bgdecor` (persistente fuera de `#app`, ver `02-design-dna.md` §8) para no recrear el contexto WebGL en cada
  render.

## Sub-fases

- [x] **11.1** — Sistema de fondo unificado — 2026-08-13 (menú + partida; portada/perfil/tienda ya compartían el mismo azul de `body`)
- [x] **11.2** — Portada: arco del logo (geometría de arco circular real) — 2026-08-13. Profundidad: resuelta sin
  Three.js (ver nota de avance) + sacado `.panel-wood` de portada/login/registro/opciones/onboarding (única superficie
  marrón fuera de la mesa, rompía el universo azul/violeta) + logo de fichas también en onboarding (antes texto plano).
- [x] **11.3** — Menú: resolver el vacío (mini perfil + destacado de pase) — 2026-08-13
- [x] **11.4** — Partida: unificar paneles HUD (madera solo en la mesa física, HUD azul-dorado translúcido) — 2026-08-13
- [x] **11.5** — Continuidad Portada → Login → Registro (GSAP Flip) — 2026-08-13
- [x] **11.6** — Perfil: hub con tabs + mover Pase Galáctico ahí — 2026-08-13
- [x] **11.7** — Botones "Volver": auditoría y poda donde ya hay X — 2026-08-13 (22 removidos, 100% eran duplicados)
- [x] **11.8** — Tienda: pasada de densidad/jerarquía + preview grande — 2026-08-13 (densidad ya estaba bien de una
  fase anterior; se agregó el botón 👁 de vista previa grande por fila, que faltaba)
- [x] **11.9** — Skins: revisión material por material (34 skins) — 2026-08-13
- [x] **11.10** — Números/colores: legibilidad de identidad por color, cualquier skin — 2026-08-13 (18 skins con el
  bug de color fijo encontradas y corregidas, ver nota de avance)
- [~] **11.11** — Modo Galáctico ↔ Pase Galáctico: conexión visual (resuelto de hecho por 11.6 — el botón en netConnect
  sigue mostrando "Pase Galáctico Nv. X" como preview, pero ahora abre el tab del perfil en vez de una pantalla propia)
- [x] **11.12** — Música: composición original nueva por contexto — 2026-08-13 (4 pistas + 2 stingers, ver nota de avance)
- [x] **11.13** — Transiciones entre todas las secciones — 2026-08-13 (ver nota de avance: la app ya tenía casi
  cobertura total vía `.a-pop`/`G._enterCls`; el único hueco real era el Menú)
- [x] **11.14** — Testing ampliado — 2026-08-13 (ver nota de avance: cobertura real de los puntos que cambiaron en
  esta fase, no una re-verificación de lógica de juego que no se tocó)

Dado el tamaño, se ejecuta por tandas dentro de esta fase, con verificación en Chromium real en cada una (mismo
estándar que las Fases 1-10) y reporte de avance — no se cierra "Fase 11" hasta cubrir la lista completa.

## Nota de avance — tanda 4 (11.8-11.10, cierre de 11.2)

- **Skins (11.9/11.10), auditoría completa**: el primer barrido (fuego/hielo/neón/oro/galáctica/tecno/sombra/aracnido,
  reglas CSS duplicadas) y el hallazgo de madera (color fijo `#291807 !important` para los 4 colores del juego) hicieron
  sospechar que el patrón se repetía en más skins. Auditoría con grep sobre las 34 (no reportarse solo a los 2-3 casos
  obvios, pedido explícito §10): encontró el MISMO bug — un `color:X !important` fijo en la regla base, sin un solo
  override por `.dotc-{color}` — en otras **17 skins**: negra, piedra, oriental, élite, samurái, cristal, dragón,
  steampunk, vikingo (más el rune/glifo por color que sí variaba, pero el número no), plata, arcoíris, holograma,
  sakura, pirata, y las 3 de temporada (halloween, navideña, sanvalentín). El primer intento de auditoría automática
  (regex de una sola línea) dio falsos negativos en varias de estas porque la regla CSS está partida en varias líneas
  (selector en una línea, `color:` en otra) — se corrigió leyendo cada bloque completo antes de confiar en el grep.
  Mismo arreglo que madera en las 17: `color:currentColor !important` en la base + 5 reglas `.tile.dotc-{color}` con un
  tono saturado propio del material de cada skin. Verificado renderizando las 34 skins × 5 fichas (rojo/azul/verde/
  amarillo/comodín) en simultáneo — 0 errores de consola, cada color distinguible a simple vista incluso en fondos muy
  saturados (oro, tecno, fuego).
- **Tienda (11.8)**: la densidad/jerarquía ya estaba resuelta de una fase anterior (filas compactas con fichas mini,
  nombre/precio/botón bien jerarquizados) — lo único que faltaba del pedido era el "preview grande al elegir una skin".
  Se agregó un botón 👁 por fila (mismo patrón ya usado en Efectos/Estelas/Sonidos) que abre un panel entre las
  pestañas y la lista con las 5 fichas a 56×76px (vs. 24×33px de la fila), nombre, precio/estado y el botón de
  compra — se puede cambiar de skin sin cerrarlo. Verificado en desktop y mobile.
- **Portada, cierre de 11.2 — decisión sobre Three.js**: NO se agregó Three.js. Justificación (Marco de decisión, no
  "porque sí"): la app ya tiene un sistema de partículas/profundidad compartido fuera de `#app`
  (`#bgdecor` + `#galacticoBg`: nebulosa con drift, estrellas titilando, estrellas fugaces, fichas flotando) que corre
  en TODA la pantalla, no solo la portada — eso cumple mejor el pedido real (§2 pedía profundidad en portada, pero §4
  pedía además "un solo universo" en todas las pantallas) que un canvas WebGL aislado a una sola pantalla, sin pagar el
  costo de un nuevo contexto WebGL, bundle más pesado, ni el gasto de batería en mobile que implica. Se evaluó y
  descartó también un parallax por puntero con GSAP: `.fan` y `.portada-glow` centran con `transform:translateX(-50%)`
  vía CSS (no inline), y `gsap.quickTo` sobre `x`/`y` fija un valor absoluto en cada llamada — pisaría ese centrado en
  vez de sumarse a él, y arreglarlo bien requeriría reescribir el centrado a JS. Costo/beneficio no lo justifica para
  un efecto puramente decorativo.
- **Encontrado en el camino, corregido**: `.panel-wood` (madera premium) era la ÚNICA superficie marrón fuera de la
  mesa de juego — se usaba en portada, login/registro/reconectando (las 3 variantes), Opciones y Onboarding, mientras
  el resto de la app (menú, perfil, tienda, lobby) ya usa el mismo `.card` de vidrio oscuro azul/dorado. Rompía
  "un solo universo" justo en las primeras pantallas que ve cualquier usuario nuevo (§4/§18). Sacada de las 6 pantallas
  que la usaban (ahora todas comparten `.card`) y borrada la clase (quedaba sin ningún uso). De paso, Onboarding tenía
  el logo como texto plano (`BURAKO` en `.logo-text`) en vez del abanico de fichas que usa el resto del flujo — ahora
  usa `fan-compact`, igual que portada/login.
- Verificado en Chromium real (desktop 1280px y mobile 390px), 0 errores de consola en cada pantalla tocada.

## Nota de avance — tanda 5 (11.13)

- **Auditoría de cobertura**: script que recorre las 22 funciones `renderX(app)` despachadas desde `render()` y busca
  `_enterCls` en el cuerpo de cada una. Resultado: 17 de 22 YA tenían la transición de entrada (`.a-pop`, 400ms,
  escala+fade, aplicada vía `G._enterCls` solo cuando `G.screen!==G._lastScreen` — nunca en un re-render de la misma
  pantalla) desde fases anteriores. De las 5 sin `_enterCls`: `renderNetCountdown` no la necesita (ya anima cada
  número del conteo regresivo con `.a-pop` fijo, a propósito, en cada tick); `renderIntro` tiene su propia coreografía
  GSAP dedicada (`animatePortadaEntrance`) en vez de la genérica; `renderDealing`/`renderNetDealing`/`renderPlaying`
  son las pantallas de mesa/atril en vivo — se dejaron sin tocar a propósito: son las que menos margen de error tienen
  (el atril costó 7 versiones estabilizar en una sesión anterior, ver CHANGELOG 2.2.7) y ya tienen su propia animación
  de reparto ficha por ficha, con lo que una animación de pantalla completa encima sería redundante y no gratis en
  riesgo. La única pantalla realmente sin ninguna transición de entrada era el **Menú** (no usa `.card`, así que nunca
  entró en el patrón `${G._enterCls}` de las demás) — se le agregó `.a-slidein` (fade + slide-down, 300ms, ya existía
  como clase pero no se usaba en ningún lado) a `.menu-layout`, gateado por el mismo `G._enterCls`. Verificado que las
  fichas del logo (que ya animan su propio `fanIn` con stagger) siguen viéndose bien combinadas con el nuevo slide del
  contenedor padre — las dos animaciones componen sin pelearse porque son transforms independientes.
- **Por qué CSS y no GSAP para el caso general**: se reafirma el criterio del Marco de decisión — GSAP se reserva para
  continuidad real entre estados (Flip mide posición antes/después, como portada↔login) o coreografías con múltiples
  pasos secuenciados (`animatePortadaEntrance`). Para "esta pantalla entra con fade+pop", una clase CSS con
  `animation` hace exactamente lo mismo con menos código y sin tocar JS en cada red-render — agregar GSAP ahí sería
  complejidad sin beneficio real, no "GSAP porque sí".
- Verificado en Chromium real, desktop y mobile, 0 errores de consola.

## Nota de avance — tanda 6 (11.12)

- **Reemplazo completo de la música**: la única pista anterior (comentario propio del código:
  "para que suene a casino animado") era exactamente lo que el usuario pidió sacar (§13: nada
  de casino, sensación cercana a Terraria). Se reescribió `Music` de punta a punta manteniendo
  la API pública intacta (`Music.on`/`.volume`/`.setVolume`/`.toggle`/`.start`/`.stop`, los
  mismos sliders de Opciones siguen funcionando sin tocarlos) pero generalizando el motor para
  sostener **4 pistas con identidad propia**, todas compuestas para este archivo (progresiones,
  bajo y melodía escritos a mano, ninguna es una recreación de un tema de otro juego):
  - **Menú** (portada/login/menú/perfil/tienda/ayuda/novedades/opciones): I-vi-IV-V bien
    espaciado (3.2s por compás), ondas triangle/sine cálidas, campanas dispersas con silencios
    — calmo y algo mágico.
  - **Lobby** (todo lo previo a jugar: setup, sorteo, reparto, sala de espera, cuenta
    regresiva): mismo círculo armónico pero al doble de velocidad (1.85s) con bajo pulsante —
    expectante.
  - **Partida** (mesa en vivo): deliberadamente el más simple de los 4 — un pad sostenido en
    seno, sin bajo ni melodía separados, a volumen reducido (`gainScale:0.4`) — pedido explícito
    de que sea "muy sutil" y no compita con la concentración de jugar.
  - **Galáctico** (cualquier pantalla de una sala de este modo, pisa a Lobby/Partida mientras
    dure): quintas abiertas en vez de tríadas comunes, compás lento (4.4s), melodía con un
    segundo oscilador desafinado ±7 cents (shimmer "cristal cósmico") y un delay con feedback
    (grafo de audio compartido, no se crea uno nuevo por nota) para sensación de vacío —
    espacial y misterioso.
  - **Stingers** de victoria/derrota: no son parte del loop — `Music.playStinger("victory"|
    "defeat")`, 3-5 notas escritas a mano (arpegio ascendente brillante / motivo descendente
    suave, no punitivo), shalf-second, suenan una vez al entrar a la pantalla de resultado.
- **Selección de pista centralizada en `render()`**: mismo lugar donde ya se decidía
  `body.galactico-mode`/`body.ingame` — un mapeo pantalla→pista (`MENU_SCREENS`/`LOBBY_SCREENS`/
  `"playing"`/`isGalacticoRoom`) pide el cambio solo cuando la pista realmente cambia, así el
  scheduler no se reinicia en cada re-render de la misma pantalla (mismo cuidado que ya tenía
  `G._enterCls`).
- **Transición entre pistas sin corte abrupto**: `Music.setTrack()` hace un fade-out de 350ms +
  fade-in de 500ms en vez de cortar en seco — mismo criterio de continuidad que el resto de la
  Fase 11 (nada de "clic → cambia de golpe").
- **Bug evitado antes de que existiera**: la primera versión llamaba a `Music.init()`/arrancaba
  el scheduler directo desde `render()`, que corre desde el primer paint — sin gesto del
  usuario, el `AudioContext` nace `suspended` y `ctx.currentTime` no avanza, así que el
  `setInterval` seguiría creando osciladores reales cada pocos segundos sin que ninguno llegue
  a sonar NI a limpiarse (quedan con su `.stop()` programado para un tiempo que nunca llega).
  Se agregó una bandera `_unlocked` que solo se activa en el listener de `pointerdown` que ya
  existía al final del archivo — antes de eso, `setTrack()` solo anota qué pista corresponde,
  no crea nada. Verificado con Playwright: 0 nodos de audio antes del primer clic, arranca
  limpio después.
- Verificado en Chromium real: pista correcta por pantalla (menú/tienda/perfil→"menu",
  lobby/sorteo→"lobby", mesa→"partida", sala galáctica en cualquier pantalla→"galactico" pisando
  a las demás), stinger de derrota al perder una partida online, silencio/mute/volumen desde
  Opciones, y 6 cambios de pantalla seguidos en rápida sucesión (stress test del crossfade) —
  0 errores de consola en todos los casos.

## Nota de avance — tanda 7 (11.14, cierre de la Fase 11)

- **Criterio**: esta fase no tocó reglas de juego, IA, ni protocolo — el riesgo real de regresión está en los
  puntos que SÍ se modificaron (skins en fichas reales, colores del HUD, música por contexto, navegación del
  Perfil, portada/login). Por eso el testing se enfocó ahí en vez de perseguir un playthrough 100% automatizado
  por consola (se intentó automatizar una partida offline completa con `drawAndPass()` en loop — funciona, pero el
  delay deliberado de la IA hace que cada ronda tarde varios minutos reales; no vale la pena para lo que hay que
  cubrir, ver más abajo por qué).
- **Partida en vivo (offline, IA)**: sorteo → reparto → mesa jugable, con fichas reales de mano. Verificado que los
  paneles HUD (Historial/Preparación/Atril/Pozo) se ven consistentes en la mesa REAL (no solo en el preview
  aislado de la Tienda) y que la pista de música cambia a "partida" (la más sutil) justo al entrar. 0 errores de
  consola.
- **Modo Galáctico en partida**: `body.galactico-mode` se activa correctamente (nebulosa a intensidad completa),
  la pista de música pasa a "galactico" pisando a "partida", y la fila de fichas de habilidad aparece arriba del
  atril como se rediseñó en 11.6/11.11 — todo con los paneles del mismo azul/dorado que el resto de la app, sin
  ningún resabio marrón.
- **2v2 en equipo**: HUD de 4 asientos (vos + compañera + 2 rivales) con el color de borde por equipo intacto
  (verde compañera, rojo rivales), atril rotulado "Atril del equipo" — sigue funcionando igual con los nuevos
  colores de panel.
- **Logro desbloqueado en partida**: `renderAchievementToasts()` sobre `#achToastZone` (vive dentro de la mesa,
  no fuera de `#app`) — toast con ícono, nombre y recompensa, esquina superior derecha, estilo dorado consistente.
  0 errores.
- **Pase / Pase Galáctico post-progreso**: seteado `P.level`/`P.xpInLevel`/`P.rankPts` a valores intermedios
  (Nivel 9, Plata) y renderizado el hub — el encabezado ya muestra nivel y rango (pedido explícito del usuario en
  esta misma sesión), la pestaña Pase hace scroll automático hasta el nivel actual con lo reclamable resaltado, y
  la pestaña Galáctico muestra su propio progreso (XP propia, distinta a la del pase normal) sin mezclarse.
- **Conectividad WebSocket**: smoke test de un cliente real conectándose a `server.js` (el mismo servidor que ya
  estaba corriendo) — conecta y cierra limpio, confirmando que nada de esta fase (que fue 100% cliente) rompió el
  servidor ni el handshake. La verificación completa de una partida 2v2 online con dos navegadores reales ya se
  había hecho en una tanda anterior de esta misma sesión (ver más arriba) y no se repitió para no gastar tiempo en
  algo que esta fase no tocó.
- **Responsive**: desktop (1280px) y mobile (390px) revisados a lo largo de toda la fase para cada pantalla que se
  tocó (portada, login, onboarding, menú, perfil, tienda, mesa offline) — sin desbordes ni cortes.
- Con esto se cierran las 14 sub-fases de la Fase 11. Quedan solo los "No-goals" ya documentados (no se tocaron).

## Correcciones puntuales (a pedido del usuario, entre tandas)

- **Logo achicado en login y "escalón" al pasar de portada a login**: el usuario reportó que el logo BURAKO se veía
  "chiquito" en login/registro (comparado con la portada) y que se sentía un salto/escalón en la transición, y por
  separado que la tarjeta de login no se veía centrada. Causa doble: (1) `.fan-compact` escalaba el logo a 42% — se
  sacó el `transform:scale`, el logo ahora es el mismo tamaño real en las dos pantallas; (2) en la portada el logo
  está en `position:absolute` (no ocupa espacio en el flujo), así que `.screen-center` centra SOLO la tarjeta —
  pero en login el logo estaba en flujo normal junto a la tarjeta, así que el grupo (logo+tarjeta) se centraba
  como bloque, corriendo la tarjeta hacia abajo y desalineándola respecto a la portada. Se replicó exactamente el
  mismo `position:absolute;top:14%` de `.portada .fan` en `.auth-screen .fan-compact`, así la tarjeta vuelve a ser
  la única hija en flujo en ambas pantallas y se centra igual. Verificado con `getBoundingClientRect()`: el centro
  vertical de la tarjeta de portada y de login coinciden en el mismo píxel.
- **Bug real encontrado y corregido**: `document.body.classList.toggle("galactico-mode", G.online && G.gameMode==="galactico" && [...])` — cuando `G.online`
  es `undefined` (no `false` — pasa antes de loguearse), la expresión completa evalúa a `undefined`, no a `false`.
  `classList.toggle(clase, undefined)` NO fuerza la clase a ausente — el navegador lo trata como "sin especificar" y
  ALTERNA la clase en cada render. Resultado real: entrar/interactuar en una sala Galáctica prendía y apagaba las
  estrellas de fondo de forma impredecible según cuántos renders habían pasado — coincide exactamente con lo que
  reportó el usuario ("si voy para atrás se pierde ese efecto"). Fix: `!!(...)` para forzar un booleano real antes de
  pasarlo a `toggle()`. Verificado: la clase ahora persiste correctamente a través de múltiples re-renders dentro de
  la misma sala, y se limpia bien recién al salir de verdad.
- **Navegación del Pase de temporada**: "← Volver" siempre mandaba a Perfil sin importar desde dónde se había abierto
  el pase — ahora `goPass()` recuerda la pantalla de origen (`G.passReturnTo`) y el botón vuelve ahí (funciona tanto
  si se abre desde Perfil como desde el nuevo destacado del menú).
- **Mini-perfil del menú**: se mudó de tarjeta grande en la barra lateral a un chip compacto en el header, donde antes
  estaba el "☰ Burako" decorativo (que no hacía nada al tocarlo — ahora si, abre Perfil). La columna derecha (pase de
  temporada) se mantiene; la izquierda queda como espaciador invisible en desktop para centrado óptico.

## Nota de avance — tanda 3 (11.6, la más grande)

- **Perfil pasó de un único panel larguísimo con scroll a un hub real con 6 tabs**: Perfil, Logros, Rangos, Pase, Galáctico,
  Colección — header (avatar/nombre/nivel/rango) persistente arriba, tabs abajo reusando `.shop-tabs`/`.shop-content`
  (mismo componente que ya usaba la Tienda, no uno nuevo). Pase de temporada, Pase Galáctico y Rangos DEJARON de ser
  pantallas propias — sus `render*()` se convirtieron en funciones que devuelven el contenido del tab (`profileTabPaseHTML`,
  `profileTabGalacticoHTML`, `profileTabRangosHTML`) y sus `go*()` (`goPass`, `goGalacticoPass`, `goRangos`) ahora abren el
  hub en el tab correspondiente en vez de cambiar de pantalla — ningún call site existente tuvo que tocarse.
  Como consecuencia, `G.passReturnTo`/`backFromPass()` de la tanda 1 quedaron innecesarios y se sacaron (ya no se "sale"
  de pantalla, solo cambia el tab activo).
  **Pase Galáctico queda de verdad dentro del perfil** (pedido explícito, reforzado dos veces) — el botón en el hub de
  Modo Galáctico (netConnect) se mantiene mostrando "Pase Galáctico Nv. X" como preview rápido antes de entrar a jugar,
  pero ahora lleva al tab del perfil en vez de abrir su propia pantalla — administración vive en un solo lugar.
  Arquitectura queda preparada para los requisitos económicos futuros (nivel mínimo, costo mensual) que el usuario pidió
  NO implementar todavía — el tab ya es un punto único de entrada/salida, agregar una condición de acceso ahí no
  requiere tocar ningún otro lugar del código.
  Efecto secundario bueno: la X de cerrar ya no necesita el hack `.card-x-sticky` para Pase/Galáctico — el header y los
  tabs quedan fijos (`flex-shrink:0`) y solo el contenido del tab scrollea, así que la X nunca se va de la pantalla sin
  necesidad de position:sticky.
- Verificado en Chromium real (desktop y mobile): las 6 tabs, sin errores de consola. Categorización de Logros en
  subcategorías (Generales/Partidas/Competitivo/etc., pedido en §5) quedó pendiente — el catálogo del servidor no tiene
  campo de categoría todavía, agregarlo es un cambio de datos, no solo visual.

## Nota de avance — tanda 2 (11.5, 11.7 + correcciones en vivo)

- **GSAP Flip instalado** (`gsap/Flip`, gratis desde abril 2025, ya en el `gsap` 3.15 que estaba instalado — solo hubo
  que agregarlo al vendor bundle y reconstruirlo). Se creó `withLogoFlip(fn)`: mide el `.fan` ANTES del cambio de
  pantalla, deja que `render()` reconstruya todo como siempre, y Flip anima la diferencia — el logo se ve "encogerse y
  subir" de la portada al login en vez de cortar. Mismo `.fan` (con `data-flip-id="logo-fan"`) en portada y en las 3
  variantes de auth (conectando/reconectando/formulario), a tamaño chico (`.fan-compact`) — es el MISMO logo, no un
  texto distinto. Se apagó el `fanIn` propio de cada ficha en la versión chica para que no compita con Flip por la
  misma transformación (misma lección que el bug de escala pegada de Fase 3). Verificado en Chromium desktop y mobile,
  login y registro, sin errores.
- **22 de 22 botones "← Volver" eran duplicados exactos** de una X que ya estaba en la misma pantalla (mismo
  `onclick`, verificado programáticamente uno por uno, no a ojo) — se sacaron todos junto con el CSS ya huérfano
  (`.btn-back-sticky`). Excepción encontrada Y corregida: en pantallas de scroll MUY largo (Pase de temporada, 100
  niveles) la X es `position:absolute` dentro del propio scroll del `.card` — al bajar del todo, la X se iba de la
  pantalla (confirmado por medición: quedaba a -4809px). Se agregó `.card-x-sticky` (position:sticky) solo para esas
  3 pantallas (Pase, Pase Galáctico, Tienda) — el resto sigue con el comportamiento normal.

## Correcciones puntuales — ronda 2 (a pedido del usuario, en vivo)

- **Bug real #2, encontrado en vivo**: el usuario reportó que las estrellas/nebulosa violeta que le gustaban
  desaparecían al volver del lobby. Investigando, esas estrellas SOLO deberían existir en salas de Modo Galáctico
  (`#galacticoBg`) — pero por el bug de `classList.toggle` de la ronda 1, estaban apareciendo por accidente en TODA la
  app (confirmado: en la portada, recién cargada, sin loguearse, `body.className` ya era `"galactico-mode"`). Al
  arreglar ese bug correctamente, el efecto que el usuario había visto (por accidente) desapareció de donde no
  correspondía — y él lo extrañó. Decisión: en vez de reintroducir el bug, se hizo INTENCIONAL — `#galacticoBg` ahora
  tiene opacity base .5 siempre (nebulosa + estrellas como ambientación de TODA la app, cumple además el pedido de
  profundidad de portada del §2) y sube a 1 (full intensidad) cuando estás de verdad en una sala Galáctica.
- **Header de Perfil agrandado**: avatar 44px→56px, nombre 18px→24px, rango y nivel pasaron a badges/pills en vez de
  texto chico — pedido explícito del usuario.
- Ver también la nota de "Correcciones puntuales" más abajo (ronda 1: navegación del Pase, mini-perfil al header).

## Nota de avance — tanda 1 (11.1-11.4)

- **Causa raíz encontrada para §4/§B (paneles marrones)**: no eran los paneles individuales — `body.ingame` pintaba TODA
  la pantalla de partida con un radial-gradient marrón madera de pared a pared (`#7a5433`→`#3a2513`), y como
  `.col-history`/`.col-prep`/`.col-rack`/`.col-pouch` son translúcidos, ese marrón se transparentaba a través de todos
  por igual — de ahí la sensación de "muchos rectángulos marrones separados". Se cambió `body.ingame` al mismo azul/
  violeta del resto de la app, y se le dio a esos 5 paneles un fondo azul oscuro translúcido explícito (no solo
  incidental) con borde dorado — la madera queda exclusivamente en el tapete de la mesa (`.tp-*`), como pidió el
  usuario. Mismo hallazgo para el menú: `.menu-elegant` tenía su propio gradiente marrón/negro "estilo casino"
  totalmente aislado — ahora usa los mismos tokens `--bg-mid`/`--bg-deep` que `body`, solo más oscuro.
- **Logo**: geometría reescrita de cero con matemática de arco circular real (posición Y rotación salen del MISMO
  ángulo, `ARC_R=480px`, `ARC_SPREAD=34°`) — ya no son dos sistemas separados (antes xOff lineal + yOff cuadrático sin
  relación con la rotación). Verificado por medición de píxeles: B/O caen ~24px más abajo que R/A, simétrico,
  exactamente la forma que pidió el usuario en su diagrama ASCII.
- **Menú**: nuevo layout de 3 columnas en desktop (mini-perfil izquierda, menú centro, pase de temporada derecha) que
  se apila en mobile — llena el espacio vacío con datos reales (nivel, XP, monedas, rango, progreso del pase), no
  contenido inventado.
- Verificado en Chromium real, desktop y mobile, partida offline completa (sorteo→reparto→mesa) — sin errores de
  consola. Screenshots en `docs/redesign/screenshots/fase11-*.png`.
- **Pendiente explícitamente para tandas siguientes**: Three.js en la portada (11.2 sigue abierta para eso),
  continuidad Login/Registro con GSAP Flip (11.5), hub de Perfil con tabs + mover Pase Galáctico (11.6), auditoría de
  botones Volver (11.7), tienda (11.8), las 30 skins una por una (11.9-11.10), conexión Modo Galáctico↔Pase Galáctico
  (11.11), música original (11.12), transiciones entre TODAS las pantallas (11.13), testing ampliado (11.14).

## No-goals reafirmados para esta pasada

- No tocar reglas de juego ni el protocolo WebSocket (confirmado funcionando en Fase 10 con servidor real).
- No implementar todavía los requisitos económicos del Pase Galáctico (nivel mínimo, costo mensual) — solo dejar la
  arquitectura preparada (a pedido explícito del usuario).
- No usar música con derechos de terceros ni recreaciones reconocibles — composición 100% original dentro del motor
  de síntesis ya existente (`Music`, Web Audio API).
