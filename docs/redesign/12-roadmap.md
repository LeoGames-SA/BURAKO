# Fase 12 — Mobile Game Layout + Battle Pass UX + Animaciones persistentes

Pasada específica sobre la pantalla de partida (sobre todo móvil) + bugs concretos en Pase de Batalla,
animaciones y Modo Galáctico. No es un rediseño total — composición responsive específica para móvil,
no `scale()` de la versión desktop ni apilar el layout existente.

## Correcciones puntuales — ronda 2 (a pedido del usuario, después de probar la primera pasada)

El usuario probó la primera pasada de 12.1-12.14 en un celular real y reportó 4 problemas concretos:

1. **"El atril está muy arriba y hay mucho espacio libre abajo, entre los botones y el atril, y el atril
   tiene scroll con solo 2 filas."** Causa raíz: `.bottomrow` tenía el renglón del atril en
   `grid-template-rows:auto minmax(0,1fr)` — se estiraba a TODO el espacio sobrante de `.bottomzone`
   (que a su vez era `flex:1 1 auto`, absorbiendo todo el espacio libre de `#app`). `adjustMobileRackHeight()`
   después recortaba `.rackgrid` a 2-3 filas de contenido real — quedaba un hueco enorme entre ese
   contenido recortado y el borde real del contenedor estirado. Fix: se invirtió qué elemento absorbe el
   espacio libre. Ahora `.table-felt` (la mesa) es `flex:1 1 auto` y `.bottomzone`/`.bottomrow` son
   `flex:0 1 auto` / `grid-template-rows:auto auto` — se quedan del tamaño de su contenido real, sin
   estirarse. El atril sigue limitándose a las filas que hacen falta, pero ya no dentro de un contenedor
   artificialmente más alto — el hueco desaparece.
2. **"En Preparación puedo mover una ficha pero no puedo devolverla al atril con el arrastre, se queda
   ahí."** Causa raíz: las fichas de Preparación (`.prep-loose .tile`/`.prep-group-row .tile`) no tenían
   `touch-action:none` — a diferencia de `.slot` (las casillas del atril), que sí lo tiene. En mobile,
   sin esa propiedad, el navegador puede interpretar el arrastre como un gesto de scroll nativo de
   alguno de los contenedores scrolleables que ya envuelven esas fichas (`.prep-loose`/`.prep-groups`/
   `.col-prep`, este último nuevo de esta misma fase) y quedarse con el gesto — el `pointermove` deja de
   llegarle a `prepDragMove()` a mitad de camino y la ficha queda "pegada" sin volver. Fix: mismo
   `touch-action:none` que ya usa `.slot`, aplicado a las fichas de Preparación.
3. **"La mesa está muy pequeña."** Con el reordenamiento del punto 1 (la mesa ahora absorbe el espacio
   libre en vez del atril), el máximo pasó de `29dvh` a `44dvh` y el mínimo de `118px` a `150px` — mesa
   notablemente más grande en la práctica, no solo en el tope teórico.
4. **"Con 2 juegos en la mesa, se agrandó para abajo. Dejalo con máximo 2 juegos de lado y 2-3 para
   abajo, pero que sea fijo, si no se hace lío."** `.mesa-inner` pasó de `flex-wrap` (cada meld con ancho
   variable según su propio contenido — según cuántas fichas tuviera, entraban 1, 2 o hasta 3 por fila)
   a **CSS Grid de exactamente 2 columnas fijas** (`grid-template-columns:repeat(2,1fr)`). El tamaño de
   la mesa ya no depende de cuántos juegos entren por fila — con más juegos de los que entran en las
   filas visibles, la mesa scrollea internamente (ya tenía `overflow:auto`) en vez de crecer. Verificado
   con 0 y 4 melds: la caja de la mesa mide exactamente lo mismo en los dos casos.

## Correcciones puntuales — ronda 3 (el arreglo de la ronda 2 se pasó de rosca)

Después de probar la ronda 2, el usuario reportó que el atril seguía con scroll (solo 2 filas visibles,
"muy chico"), la mesa ahora quedaba "un poco grande", y pidió explícitamente que las cosas fueran **más
estáticas** ("si no, queda raro") — es decir, tamaños fijos y predecibles en vez de que la mesa/atril se
repartan el espacio libre de forma dinámica según cuánto ocupe el resto.

- **Causa del "solo 2 filas"**: `adjustMobileRackHeight()` (la función JS que limitaba el atril a las
  filas que hacían falta según la cantidad real de fichas) seguía activa de la ronda anterior — pensada
  para un contenedor que se estiraba de más, pero con el fix de la ronda 2 (el contenedor de abajo ya NO
  se estira, se queda del tamaño de su contenido) ese recorte dinámico ya no ahorraba nada: solo
  escondía la 3ra fila detrás de un scroll innecesario. **Se eliminó por completo** (la función y su
  llamada en `renderPlaying`) — el atril en mobile ahora es una altura FIJA en `dvh` (`30dvh`, calculada
  con Playwright midiendo el alto real de un slot + cabecera + pie para que 3 filas entren sin apretar
  en la gran mayoría de celulares), sin ningún cálculo de JS de por medio.
- **Mesa "un poco grande" + pedido de "más estático"**: la mesa había pasado a `flex:1 1 auto` en la
  ronda 2 (absorbía TODO el espacio libre disponible, que variaba según cuántos rivales/qué contenido
  hubiera alrededor — exactamente el comportamiento "dinámico" que el usuario pide evitar). Se cambió a
  una altura FIJA (`height:28dvh`, sin `flex-grow`) — ya no depende de cuánto espacio sobre, es siempre
  el mismo tamaño relativo a la pantalla, y algo más chica que el máximo teórico de la ronda 2 (44dvh).
- **Landscape** (viewports de altura ≤480px): 3 filas fijas de atril (~190px que hacen falta) no entran
  en un celular acostado (390px de alto en total). Se mantiene como caso aparte: en ese rango de altura
  el atril vuelve a ser de altura automática con scroll interno (en vez de la altura fija de portrait),
  y la mesa se achica más (22dvh) para dejarle más lugar.
- Verificado con Playwright: `.rackpersp.scrollHeight === .rackpersp.clientHeight` (sin necesidad de
  scroll) con 14 y 24 fichas en 390×844; mesa fija con 0 y 4 melds; arrastre de Preparación al atril
  sigue funcionando; regresión completa en 412×915, landscape 844×390, desktop 1366×768/1920×1080 — 0
  errores de consola, desktop sin cambios.

Verificado con Playwright en 390×844 (los 4 casos de arriba) y regresión completa en 412×915, 844×390
landscape, 1366×768 y 1920×1080 — 0 errores de consola, desktop sin cambios visuales.

## Correcciones puntuales — ronda 4 (pegar el atril abajo + bug de fichas escondidas al armar)

1. **"Que el atril se pegue a la parte de abajo de donde están los botones, pero sin superponerse."**
   Con la ronda 3, `.bottomzone` había vuelto a ser de tamaño de contenido (no absorbía espacio libre),
   así que si sobraba algo de alto en la pantalla, quedaba como un hueco DEBAJO del atril, antes de la
   barra de acciones fija — el atril no se sentía "anclado" a los botones. Fix: `.bottomzone` volvió a
   `flex:1 1 auto` (llena el espacio libre de `#app`, seguro ahora porque la mesa ya es de altura FIJA,
   no compite por el mismo espacio) pero con `display:flex;flex-direction:column;justify-content:
   flex-end` — así el contenido (`.bottomrow`, con Preparación+Pozo+Atril) se empuja al FONDO de ese
   espacio en vez de quedar pegado arriba. El sobrante (si lo hay) ahora se ve como aire entre la mesa y
   Preparación, no como un hueco raro pegado a los botones.
2. **"Al armar juego, una ficha se esconde."** Causa raíz encontrada: la regla `body.ingame .meld .tiles
   {flex-wrap:wrap}` de la ronda 2 (pensada solo para que los melds de la MESA pudieran wrappear sus
   fichas en 2 columnas) no estaba acotada a la mesa — por especificidad CSS (el selector con
   `body.ingame` le gana a `.prep-group-row .meld .tiles{flex-wrap:nowrap;overflow-x:auto}` sin importar
   el orden en el archivo) también pisaba a los juegos armados en Preparación. Un juego con 4+ fichas
   pasaba de scrollear horizontal a ENVOLVER a una 2da fila — y como el efecto de abanico de esa fila usa
   `margin-left` NEGATIVO pensado para una sola fila, la primera ficha de la 2da fila quedaba tapada
   debajo de la última de la 1ra ("se esconde"). Fix: la regla se acotó a `.mesa-inner .meld .tiles`
   (solo la mesa) — Preparación recupera su scroll horizontal de siempre. De paso se subió el
   `max-height` de `.col-prep` de 15dvh a 20dvh (15 quedaba justo para mostrar la pista de "fichas
   sueltas van acá" + un juego armado a la vez sin scrollear).
- Verificado con Playwright: computed style de `.prep-group-row .meld .tiles` confirma `flex-wrap:nowrap`
  y `overflow-x:auto` restaurados, las 4 fichas de un grupo de prueba quedan en la MISMA fila (mismo `y`)
  sin superponerse; captura visual confirma el grupo completo visible. Regresión completa (412×915,
  landscape, desktop 1366/1920) — 0 errores de consola, desktop sin cambios.

## Sub-fases

- [x] **12.9/12.10** — Bug de animaciones/ficha flotante en Preparación — 2026-08-13 (ver nota de avance,
  causa raíz real encontrada y corregida: `pointercancel` sin manejar en los 3 sistemas de drag)
- [x] **12.1** — Layout móvil de partida (composición nueva) — 2026-08-14
- [x] **12.2** — Compactar tarjetas de jugadores/oponentes en móvil — 2026-08-14
- [x] **12.3** — Mover el pozo junto a Preparación en móvil — 2026-08-14
- [x] **12.4** — Preparación: altura dinámica con scroll interno — 2026-08-14
- [x] **12.5** — Mesa compacta y adaptable a contenido + tokens de tamaño de ficha — 2026-08-14
- [x] **12.6** — Atril móvil: grilla inteligente sin casillas vacías gigantes — 2026-08-14
- [x] **12.7** — Toast "Tu turno" + historial como drawer en móvil — 2026-08-14
- [x] **12.8** — Action bar inferior fija con safe-area-inset-bottom — 2026-08-14 (ya existía de una
  fase anterior, se mantuvo y se afinó tamaño de botones)
- [x] **12.11** — Modo Galáctico: atril cortado/oculto — 2026-08-14
- [x] **12.12** — Pase de Batalla: botón "Reclamar todo" — 2026-08-14
- [x] **12.13** — Bug: scroll salta al reclamar recompensa del pase — 2026-08-14
- [x] **12.14** — Regression test desktop + testing ampliado multi-resolución — 2026-08-14
- [x] **12.15** — PWA instalable en Android (pantalla completa + offline), en vez de APK nativo — 2026-08-14
- [x] **12.15b** — APK real (.apk) instalable, a pedido explícito tras la PWA — 2026-08-14
- [x] **12.16b** — Ronda de feedback tras instalar el APK real (scroll de Preparación, música de
  partida, leaderboard "undefined", pistas con comodín, delay IA-Claude, historial offline, pantalla
  completa nativa + exclusión de gestos de borde) — 2026-08-14
- [x] **12.17b — Cierre "versión final"**: reinicio de `players.json` (con backup) + onboarding
  rediseñado en 3 pasos (registro nombre+contraseña → mini tutorial → avatar), reemplazando el
  onboarding viejo de un solo campo de nombre. Ver detalle completo en `CHANGELOG.md` [3.0.0]. Con
  esto se cierra la Fase 12 y el pedido explícito del usuario de "versión final de Burako" —
  2026-08-14

## Nota de avance — bug de animaciones / ficha flotante (12.9 + 12.10)

**Investigación de 12.9 (animaciones que se reinician en cada render)**: antes de tocar nada se verificó
qué partes del sistema YA estaban bien resueltas de fases anteriores, para no reescribir lo que
funciona:
- `G.freshMelds` (Set de IDs) ya limita la animación de entrada (`a-slam`/`a-snap`) a los melds
  REALMENTE nuevos, con un `setTimeout` de 700ms que la limpia — un meld viejo nunca recibe la clase
  de animación en un render posterior. Correcto, no se tocó.
- El timer de turno (`startTurnTimer`) NO llama a `render()` cada segundo — actualiza directamente
  `.timer-num`/`.timer-ring` por DOM query. Correcto, no se tocó.
- `.opp-card.a-glow{animation:none}` ya neutraliza el pulso genérico de "es su turno" en las tarjetas
  de rival (usa `border-color`/`box-shadow` con `transition`, no `animation`) — ya arreglado de antes.
- `tileBtn`/`meldHTML` no tienen ninguna animación de montaje incondicional.

**Causa raíz real encontrada (12.10, el bug que reportó el usuario: "toco una ficha ya acomodada en
Preparación y queda flotando")**: los 3 sistemas de arrastre del juego (`slotPointerDown`/`dragMove`/
`dragUp` del atril, `prepTilePointerDown`/`prepDragMove`/`prepDragUp` de Preparación, y `MESA_PAN` para
paneo de mesa con mouse) registraban un listener de `pointerup` con `{once:true}` pero **ninguno
escuchaba `pointercancel`**. En mobile el navegador manda `pointercancel` en vez de `pointerup` cuando
reinterpreta el gesto a mitad de camino (típicamente cuando decide que en realidad es un scroll) — sin
ese listener, el `pointerup` pendiente nunca llega, el elemento "ghost" (el clon visual de la ficha que
sigue al dedo, creado con `position:fixed` y agregado a `document.body`, FUERA de `#app`) se queda
pegado en pantalla para siempre — ningún `render()` lo toca porque vive fuera del árbol que `render()`
reescribe. Eso es exactamente "queda flotando raro ahí".

Se agregó un handler de `pointercancel` a los 3 sistemas (`dragCancel`, `prepDragCancel`, y el listener
inline de `MESA_PAN`) que limpia el ghost, saca las clases `dropover`/`drop-ok`/`drop-bad` que hayan
quedado pegadas, y resetea el estado de arrastre — mismo criterio en los tres para no dejar la misma
clase de bug sin corregir en alguno.

**Bug secundario encontrado en el camino**: `workTileClick` (el handler de tap sobre una ficha en
Preparación) no chequeaba `G.suppressClick` — un flag que SÍ chequean `slotClick`/`slotReserveClick`
(los equivalentes del atril) para ignorar el click sintetizado que el navegador dispara justo después
de un drag. Sin el guard, después de un drag-que-no-se-completó (jitter, o un `pointercancel`) el click
fantasma togglaba la selección de la ficha igual, sumando a la sensación de "algo raro pasó" en esa
ficha. Se agregó el mismo guard que ya usan los otros dos handlers.

Verificado con Playwright disparando `pointerdown`→`pointermove`(pasa el umbral, crea el ghost)→
`pointercancel` sintéticos sobre una ficha real de Preparación y del atril: el ghost queda conectado al
DOM antes del cancel y se desconecta correctamente después, en los dos sistemas. `workTileClick` con
`G.suppressClick=true` confirmado como no-op. 0 errores de consola.

## Nota de avance — layout móvil de partida (12.1-12.8)

- **Diagnóstico antes de tocar CSS**: el layout mobile anterior (`@media(max-width:640px)`) apilaba la
  versión desktop en columna y dejaba scrollear la PÁGINA ENTERA — una decisión de una fase anterior,
  documentada en su propio comentario, tomada específicamente para evitar un bug de paneles
  colapsando a alto 0 en el flex anidado. Esa decisión es exactamente lo que el usuario pidió no
  repetir ("no apilar la versión desktop"). Se reemplazó por una composición propia con viewport fijo
  otra vez (sin scroll de página), pero esta vez dándole a cada zona un `flex-basis`/`min-height:0`
  explícito en vez de evitar el problema con scroll de página — el mismo bug que se quería evitar en su
  momento, atacado de raíz en vez de rodeado.
- **Scope**: todo el bloque nuevo vive bajo `body.ingame` (la clase que `render()` ya togglea para las
  pantallas de partida) DENTRO de `@media(max-width:640px)` — así el menú/perfil/tienda/etc en mobile
  siguen con el scroll de página de antes, sin tocarlos.
- **Oponentes**: `.opp-card` pasa de tarjeta (`width:min(220px,44vw)`, avatar 26px, layout vertical en
  los costados) a chip horizontal compacto (`border-radius:999px`, avatar 15px, sin el ícono de skin ni
  las etiquetas secundarias tipo "✓30"/"🛡" que no entran cómodas en un chip chico). La distribución
  alrededor de la mesa (`seatForOppIndex` — arriba/izquierda/derecha según cuántos oponentes hay) ya
  existía de una fase anterior y no se tocó, solo el tamaño de cada tarjeta.
- **Pozo + Preparación**: `.bottomrow` pasa de fila de 4 columnas (Historial|Preparación|Atril|Pozo) a
  CSS Grid con áreas nombradas: `"prep pouch" / "rack rack"` — Preparación y Pozo comparten la fila de
  arriba, Atril ocupa todo el ancho de la fila de abajo. Ningún cambio de JS/markup para esto, es
  puramente reflow por `grid-area` sobre el mismo HTML que ya se generaba.
- **Atril inteligente** (`adjustMobileRackHeight()`, nueva función en `burako.js`): el atril SIGUE
  renderizando sus 30 slots fijos (`RACK_SLOTS`) — no se tocó esa lógica ni los índices que usa el
  drag & drop, es la misma que costó varias vueltas estabilizar (ver CHANGELOG 2.2.7). En vez de eso,
  después de cada `render()` de la pantalla de partida, en mobile se mide el alto real de un slot ya
  renderizado y se limita `.rackgrid` (`max-height` + `overflow-y:auto`) a las filas que hacen falta
  según la cantidad REAL de fichas + un margen de una fila, con un piso de 2 filas y sin límite si ya
  hay 3 filas llenas. Los slots de más siguen en el DOM (se puede soltar una ficha ahí igual), solo
  quedan fuera del alto visible por defecto. Verificado con 5, 14 y 24 fichas: 2 filas, 2 filas, 3
  filas respectivamente.
- **Tokens de tamaño de ficha** (`--tile-size-table`/`--tile-size-preparation`/`--tile-size-preview` en
  `:root`): la mesa y la preparación tenían tamaños de ficha fijos en px sueltos en su regla — ahora
  son variables redefinibles por breakpoint. El atril NO tiene un token equivalente a propósito: su
  tamaño sale del ancho real del contenedor dividido en 10 columnas, ya es responsive por diseño —
  forzarlo a un valor fijo lo empeoraría. En mobile, mesa y preparación quedan más chicas que el atril
  (mesa ~27×37px vs. atril ~34-38px según el viewport, preparación ~29×40px).
- **"Tu turno"**: el banner gigante (`.turnbanner`, hasta 60px de fuente, centrado sobre la mesa,
  ~2.4s) se reescribió como un toast HUD chico cerca del header (mismo lenguaje visual que el toast de
  logro desbloqueado), 1.6s de punta a punta. De paso se encontró que el `setTimeout` que sacaba
  `G.turnBanner` (1850ms) cortaba la animación CSS a mitad de su propio fade-out (que arrancaba recién
  a los 1900ms) — quedaba invisible de golpe en vez de desvanecerse. Ahora los tiempos calzan (1650ms
  de JS vs. 1.6s de animación). También se sacó un `setMsg()` redundante que disparaba EL MISMO aviso
  dos veces (el toast de texto Y el banner) en los dos lugares donde arranca el turno del jugador.
- **Historial → drawer**: en mobile, el botón 📜 del header togglea `G.historyDrawerOpen` y
  `.col-history` pasa de panel fijo en la fila a bottom-sheet superpuesto (`position:fixed`,
  `transform:translateY(105%)` ↔ `translateY(0)`, con backdrop). En desktop el mismo HTML sigue
  siendo el panel de siempre — el botón y el backdrop están en `display:none` fuera del media query.
- **Landscape / viewports muy bajos** (ej. 844×390): por ancho (844>640) esto caería en el layout de
  escritorio, que a esa altura no entra (botones solapados con la mesa). Se extendieron las 3 media
  queries relevantes (apilado de mesa, layout compacto de partida, historial-drawer) para disparar
  TAMBIÉN por `(max-height:480px)`, no solo por ancho. Quedó funcional pero ajustado — no es el foco
  principal de esta fase (el usuario priorizó explícitamente el layout portrait, §19), documentado acá
  como área abierta si se quiere pulir más adelante.
  **Lección de esta sub-fase**: una regla `body.ingame .bottomrow{...}` metida ANIDADA dentro de un
  `@media(max-height:480px){}` que a su vez estaba ANTES de la regla base `body.ingame .bottomrow{...}`
  en el archivo perdía el conflicto de cascada (misma especificidad, gana quien está último en el
  archivo, no quien "sinstintivamente parece más específico por estar en un media query más
  chico"). Se resolvió sacando ese override a un `@media(max-height:480px)` propio, standalone, DESPUÉS
  de todas las reglas base — repetir este orden si se agregan más ajustes de landscape.
- Verificado con Playwright en 390×844, 412×915, 844×390 (landscape) y 1366×768/1920×1080 (desktop),
  con escenarios de 1/2/3 oponentes, mesa vacía/con 4 melds, atril con 5/14/24 fichas, y preparación
  con fichas sueltas + un grupo — 0 errores de consola en todos los casos.

## Nota de avance — Modo Galáctico: atril cortado (12.11)

- **Causa raíz**: Modo Galáctico agrega `.rack-abilities-row` (la fila de fichas de habilidad) ANTES de
  la grilla normal del atril, dentro del mismo `.rack` — una fila más de contenido que el contenedor
  padre (`.col-rack .rackpersp`) no tenía reservada en su presupuesto de alto. Como esa regla tenía
  `overflow:hidden` (no `auto`), cuando el contenido total (fila de habilidades + grilla) superaba el
  alto disponible, el excedente (típicamente la última fila de fichas reales) se recortaba en
  silencio — invisible y sin forma de llegar a ella, ni con scroll. Coincide exactamente con "una parte
  inferior del atril queda oculta/cortada".
- **Fix**: `overflow:hidden` → `overflow-y:auto` en las dos ocurrencias de `.col-rack .rackpersp`
  (la base y la de mobile). Ahora, si el contenido excede el alto disponible, se puede scrollear hasta
  verlo en vez de perderlo — funciona igual en modo normal (nunca hace falta el scroll, no hay fila de
  habilidades) y en Modo Galáctico (con la fila de más, ahora si hace falta scrollear un poco, se
  puede).
- Verificado con 24 fichas + 2 fichas de habilidad en desktop (1366×768) y mobile (390×844): antes del
  fix la ficha #24 quedaba fuera del área visible sin forma de alcanzarla; después, scrolleando el
  contenedor llega a estar completamente visible. 0 errores de consola.

## Nota de avance — Pase de Batalla: "Reclamar todo" + scroll (12.12/12.13)

- **Bug de scroll (12.13), causa raíz**: `renderProfile()` tenía un `scrollIntoView({block:"center"})`
  hacia la fila del nivel actual que corría en CUALQUIER render mientras el tab activo fuera
  Pase/Pase Galáctico — incluido el render que dispara `claimPass()`/`claimGalacticoPass()` al
  reclamar. El mecanismo de scroll preservation (`data-preserve-scroll="profile-${tab}"`) SÍ
  funcionaba, pero este scroll-to-nivel-actual corría DESPUÉS (en un `setTimeout`) y lo pisaba.
  Fix: se gatea a que el tab realmente haya cambiado desde el render anterior (`G._lastProfileTab`,
  mismo patrón que `G._lastScreen`/`screenChanged` en `render()`) — el salto a "tu nivel actual" sigue
  pasando al ENTRAR al tab (útil), pero no en cada re-render mientras ya estás ahí (reclamando o no).
- **"Reclamar todo"**: nuevo botón (banner dorado arriba de la lista, solo visible si hay algo
  reclamable) que llama a `claimAllPass()`/`claimAllGalacticoPass()` — reusan `claimPass()`/
  `claimGalacticoPass()` nivel por nivel (mismo camino online/offline que ya usaba el botón individual,
  sin protocolo nuevo) en vez de reimplementar la lógica de recompensas. El resumen (🪙 total + lista de
  items) se arma ANTES de reclamar, a partir de la tabla de niveles (determinista, es la misma que ya
  valida el server) — así no depende de esperar confirmaciones de red una por una para el Pase
  Galáctico, que es 100% server-autoritativo (no tiene camino offline). Una sola tarjeta de resumen con
  un único pulso de entrada (`.a-pop`), nada de 15 animaciones seguidas — pedido explícito del usuario.
- Verificado reclamando 9 niveles de una (fichas + 1 skin) en offline: total correcto, item listado
  correctamente, el banner desaparece solo una vez que no queda nada reclamable, y funciona igual en
  mobile. 0 errores de consola.

## Nota de avance — ronda 5 (sonido de botones, música real del usuario, logo en más pantallas)

- **12.18 — Sonido por botón + swoosh de cierre**: en vez de agregar `Sound.click()` a mano en cientos
  de `onclick` sueltos (mucho riesgo de tocar algo que no correspondía), se agregó UN listener delegado
  en `document` que cubre cualquier `<button>` presente o futuro. Los botones de cerrar (`.card-x`,
  `.hist-drawer-close`, `.ability-tip-cancel`, o `title="Cerrar"`) reciben `Sound.closeUI()` (un barrido
  de frecuencia descendente, no un beep fijo — se siente a "cierre/deslizar" en vez de un tap más); el
  resto recibe `Sound.click()` (dos tonos triangle cortos y suaves). Para no duplicar sonido en botones
  que YA reproducen algo propio (colocar ficha, error, etc.), `Sound.beep()`/`closeUI()` guardan
  `_lastAt` (timestamp) y el listener delegado se salta el genérico si algo sonó en los últimos 40ms —
  como los `onclick` inline corren ANTES que un listener delegado en `document` (fase de burbujeo), el
  guard detecta correctamente "esto ya sonó". Verificado con Playwright: botón sin sonido propio → suena
  `click`; X de cerrar → suena `closeUI` (no `click`); botón con `Sound.place()` propio → no duplica.
- **12.17 — Música de fondo real del usuario**: el usuario dejó `sound/musica de fondo.mp3` — se copió a
  `client/audio/musica-fondo.mp3` (servible) y el servidor ganó los MIME types que le faltaban (`.mp3`,
  `.ogg`, `.wav` — antes cualquier audio se servía como `application/octet-stream`, hubo que reiniciar el
  proceso de `server.js` para que el cambio tomara efecto, Node no hace hot-reload). `Music` ganó
  `initFileTrack()`: un `<audio>` real ruteado a través del MISMO grafo de Web Audio que las pistas
  sintetizadas (`createMediaElementSource` → gain propio → `this.master`), así el volumen/mute de
  Opciones le pegan igual sin lógica aparte. Reemplaza específicamente la pista sintetizada de **Menú**
  (la que más se escucha) — Lobby/Partida/Galáctico siguen siendo las sintetizadas de Fase 11/12, no se
  tocaron. `playbackRate:0.92` (♪ "bajale un poquito la velocidad", ~8% más lento). Si el archivo no
  carga (falta, error de red), cae de vuelta a la pista sintetizada de menú en vez de quedar en silencio.
  Verificado: fetch da `200`/`audio/mpeg` correcto, cambiar a otra pantalla pausa el archivo, volver a
  Menú lo retoma, el slider de volumen y el mute de Opciones lo afectan igual que a las demás pistas.
- **12.16 — Logo con brillo en más pantallas**: el usuario notó que el logo compacto + halo (el mismo
  que ya tenía login/registro desde Fase 11 §5) faltaba en el resto del flujo de "jugar" — "Elegí modo de
  juego" (`renderPlay`, donde vive el botón Multijugador), "Casual contra IA" (`renderCasualIA`), y las 3
  pantallas de entrada al multijugador (`renderNetConnect`: conectando / conectar / elegir modo online).
  Las 5 pantallas pasaron del wordmark plano `BURAKO` a `fanLogoHTML()` + `.fan-compact` (mismo patrón
  que login: logo fuera de la card, `position:absolute` vía `.auth-screen`, así solo la card se centra).
  Las pantallas MÁS profundas del flujo online (elegir Todos-contra-todos/2v2/Galáctico, crear sala,
  unirse por código, salas públicas, tabla de posiciones) se dejaron con su `<h2>` de título en vez del
  logo — mismo criterio que ya usan Perfil/Tienda (el logo identifica el juego en las pantallas de
  entrada, un título identifica la tarea en las pantallas de una tarea puntual, no cada pantalla repite
  el logo). Verificado en desktop y mobile, 0 errores de consola.

## Nota de avance — ronda 6 (atril pegado al fondo de verdad + botón "Bajar todo" unificado)

El usuario pidió bajar el atril "hasta tocar abajo" y señaló que el botón flotante "✔ Bajar todo" de
Preparación debería reemplazar al botón normal de la barra en vez de aparecer como una franja aparte.

- **Botón "Bajar todo" integrado**: `.prep-confirm` era un botón flotante separado
  (`position:fixed`, apilado ARRIBA de la barra de 3 botones normal) que aparecía además de "⬇ Bajar y
  pasar" cuando había algo armado en Preparación — dos acciones de "bajar" distintas visibles a la vez.
  Se eliminó por completo (JS y CSS, código muerto) y en su lugar la barra de acciones normal
  REEMPLAZA el botón "⬇ Bajar y pasar" por "✔ Bajar todo" (mismo `onclick="confirmTurn()"`) cuando
  `hasWork` es cierto — un solo botón, un solo lugar, en PC y en mobile. De paso libera la franja de
  espacio que ocupaba el botón flotante.
- **Bug real encontrado detrás de "el atril sigue arriba"**: el ajuste de la ronda 4
  (`.bottomzone{justify-content:flex-end}`, para empujar Preparación+Pozo+Atril al fondo del espacio
  libre) nunca tuvo efecto visible — `.bottomrow` heredaba `flex-grow:1;flex-basis:0%` de la regla BASE
  de escritorio (`.bottomrow{flex:1;...}`, la fila de 4 columnas), y el override de mobile solo pisaba
  `flex-shrink` sin tocar `flex-grow`/`flex-basis`. Con `flex-grow:1` heredado, `.bottomrow` crecía a
  ocupar TODO el espacio libre de `.bottomzone` él mismo — no quedaba nada de espacio libre para que
  `justify-content:flex-end` reparta. Medido con Playwright: `.bottomrow` medía 475px de alto (¡el
  contenido real solo necesita ~330px!). Fix: `flex:0 0 auto` explícito (no solo `flex-shrink:0`) en el
  override de mobile. Resultado medido: el hueco entre el pie del atril y el techo de la barra de
  acciones bajó de 62px a **3px** — el atril queda tocando el fondo de verdad.
- De paso se ajustó `.bottomzone{padding-bottom}` de 60px a 50px (más cerca del alto real de la barra de
  acciones, ~47px) para no reservar más colchón del necesario.
- Verificado con Playwright: un solo `.act-ok` en la barra (no dos "bajar" simultáneos), sin
  `.prep-confirm` en el DOM; arrastre de Preparación al atril y sonido de botones siguen funcionando;
  regresión completa (412×915, landscape, desktop 1366/1920) — 0 errores de consola, desktop sin cambios.

## Nota de avance — ronda 7 (bug crítico de reglas + música consistente + sonido + pausa + header)

- **BUG CRÍTICO encontrado y corregido — robo de fichas de la mesa**: el usuario reportó que al abrir
  (romper) un juego de la mesa con comodín, "el comodín vuelve a mí, o las fichas del rival vuelven a
  mí" — sospechó bien. Causa raíz: `openMeld()` manda TODAS las fichas del juego roto (comodín + el
  resto, sean tuyas o de un rival — la mesa es de todos una vez jugada) a `G.workLoose`, con la regla de
  que hay que reconstruir juegos válidos con TODO antes de confirmar. Pero `pullTileFromPrep()` (arrastrar
  una ficha de Preparación de vuelta al atril — pensada SOLO para fichas que vos mandaste desde tu propia
  mano con `sendToWork()`) no distinguía el origen de la ficha: cualquier ficha en la zona de armado,
  incluidas las de un juego de la mesa recién roto, se podía arrastrar derecho a tu atril. Fix: nueva
  `openedMeldTileIds()` (reutilizada también en `fullCancel()`, que ya tenía la misma lógica duplicada)
  — `pullTileFromPrep()` ahora RECHAZA el arrastre con un mensaje claro si la ficha pertenece a un juego
  de mesa abierto. Verificado con Playwright reproduciendo el escenario exacto (juego rival con comodín
  en la mesa → `openMeld()` → intentar `pullTileFromPrep()` con el comodín y una ficha rival): antes el
  atril terminaba con esas fichas, ahora `rackFilled` se queda en 0 y muestra el error — mientras que
  devolver una ficha que SÍ mandaste vos desde tu mano sigue funcionando igual que siempre.
- **Música inconsistente entre pantallas**: "Elegí modo de juego"/"Casual IA"/setup de multijugador
  usaban la pista sintetizada "lobby" mientras el resto de la app usaba la música real del usuario — se
  sentía como que cambiaba sin razón. Se unificaron todas esas pantallas bajo la pista "menu" (la real);
  "lobby" queda definida en `Music.tracks` sin uso por ahora. Verificado con las 5 pantallas del flujo de
  jugar: todas reportan `Music.current === "menu"`.
- **Sonido de "bajar fichas" rediseñado**: `Sound.slam()` usaba un sawtooth grave (90Hz) que sonaba a
  buzz áspero — reemplazado por un golpe cálido en triangle+sine (sin distorsión) más un mini-arpegio
  mayor ascendente, sensación de "éxito" en vez de solo impacto.
- **Volumen/mute desde la pausa**: el menú de pausa (tocando "☰ Burako" arriba a la izquierda durante una
  partida) ganó los mismos controles de Efectos/Música que ya existían en Opciones (reusa `.audio-block`,
  ningún componente nuevo) — ya no hace falta salir de la partida para bajar el volumen.
- **Header de Perfil, más contenido**: se agregaron 🪙 monedas y 🔥 racha actual (si hay) como badges
  junto a Rango/Nivel — el header queda más grande y con más información de un vistazo, a pedido
  explícito del usuario.
- **Investigado y no reproducido — "el fondo desaparece en el menú de jugar"**: se armó una captura de
  pantalla de la pantalla "Elegí modo de juego" con Playwright verificando `#galacticoBg`/`#bgdecor`/el
  gradiente del body — todo presente y con la opacidad correcta. Puede ser un parpadeo transitorio
  durante una animación real que una captura estática no agarra — queda abierto, se necesita una captura
  del usuario en el momento exacto si persiste.
- **Pendiente — sensación de que las animaciones no van a 60fps**: sin acceso a profiling de un
  dispositivo real en este entorno, no se puede medir FPS real. Se hizo un barrido rápido de qué
  propiedades animan `box-shadow` (7 reglas, cuesta más — fuerza repintado) vs `transform` (10 reglas,
  acelerado por GPU) — no es una cantidad alarmante, pero es un punto de partida concreto si se quiere
  profundizar con reportes más específicos (qué pantalla, qué momento) o con un dispositivo real.
- Verificado con Playwright: regresión completa (390×844, 412×915, landscape, desktop 1366/1920) — 0
  errores de consola en todos los casos.

## Nota de avance — ronda 8 (12.15: PWA instalable en vez de APK nativo)

- **Decisión — PWA en vez de APK**: el pedido original era "generame una APK para poder jugar al menos
  en modo offline en el celular". Esta máquina de desarrollo no tiene Android SDK, Java (JDK) ni Gradle
  instalados — armar ese toolchain (por ejemplo vía Capacitor) implica instalar Android Studio + SDK +
  varios GB de descarga antes de poder compilar nada. Se le presentó la alternativa al usuario, que
  eligió explícitamente la PWA: da el mismo resultado percibido (ícono propio en el celular, pantalla
  completa sin barra de navegador, funciona sin conexión) sin esa dependencia pesada, y funciona en
  minutos sobre el servidor que ya existe.
- **Qué se agregó**: `client/manifest.webmanifest` (nombre, `display:"fullscreen"` con fallback a
  `"standalone"` vía `display_override`, `theme_color`/`background_color` acordes a `--bg-deep`, 3
  íconos), `client/sw.js` (service worker cache-first + revalidación en segundo plano de todos los
  assets estáticos: HTML/CSS/JS, fuentes vendorizadas, la música de fondo, el manifest y los íconos),
  y los `<link>`/`<meta>` correspondientes en `burako.html` (`rel="manifest"`, `apple-touch-icon`,
  `apple-mobile-web-app-*`) más el registro del service worker al final del body.
- **Íconos**: no había ningún asset de imagen en el proyecto (todo el arte es CSS/JS) — se generaron 5
  PNG (`icon-192`, `icon-512`, `icon-512-maskable`, `apple-touch-icon`, `favicon-32`) renderizando HTML
  simple con Playwright (fondo `--bg-deep` con gradiente radial, borde `--gold`, letra "B") en vez de
  depender de una librería de imágenes — no había ninguna instalada y no hacía falta agregar una para
  esto.
- **`server.js`**: el `MIME` map no tenía entrada para `.webmanifest`/`.json` — mismo tipo de bug que ya
  había mordido al `.mp3` de la música (round 5): sin la entrada correcta, cae a
  `application/octet-stream`, lo que hace que Chrome no reconozca el manifest para el prompt de
  instalación. Se agregaron ambas entradas.
- **Alcance real del offline**: el service worker no distingue entre modos — cachea el cliente entero,
  así que la app siempre carga sin conexión una vez visitada. Pero **Casual contra IA es el único modo
  que se puede *jugar* offline**, porque corre 100% en el cliente (`burako-core.js`); el modo Online
  sigue necesitando el WebSocket contra `server.js`, así que sin conexión esa pantalla se queda
  esperando como es lógico — no se intentó (ni tenía sentido) hacerlo funcionar sin servidor.
- Verificado con Playwright: `manifest.webmanifest` responde con `content-type:application/manifest+json`
  y 3 íconos declarados; el service worker queda `active:true` tras la carga inicial; los 4 PNG cargan
  con `200`; con el contexto del navegador puesto en `offline:true` y recargando la página, la app
  sigue rindiendo (mismo título, `#app` con contenido) sin errores de consola; y — la prueba más
  concreta — una partida completa de Casual contra IA (sorteo → revelar → repartir fichas → llegar a
  `G.screen==="playing"` con 10 fichas en el atril) se jugó de punta a punta con la red completamente
  cortada. Regresión completa (mobile/landscape/desktop) también sin errores tras el cambio.
- **Cómo instalarlo en el celular** (para el usuario): abrir `http://<IP-de-esta-PC>:8181` en Chrome
  desde el celular (misma red Wi-Fi que ya usa para jugar online), tocar el menú ⋮ → "Agregar a
  pantalla de inicio" (o el banner de instalación que Chrome puede mostrar solo). Con eso ya tiene el
  ícono en el celular y abre en pantalla completa; después de esa primera visita, el modo Casual contra
  IA queda disponible aunque se corte el Wi-Fi.

## Nota de avance — ronda 9 (12.15b: APK real, a pedido explícito)

- **Por qué se volvió sobre esto**: la ronda 8 entregó una PWA (instalar desde el navegador con
  "Agregar a pantalla de inicio"). El usuario aclaró que quería "algo físico" en el celular — un
  archivo `.apk` de verdad — no un atajo del navegador. Se armó el toolchain completo de Android
  faltante y se compiló un APK real.
- **Toolchain instalado (sin permisos de administrador)**: esta máquina no tenía Java, Android SDK ni
  Gradle. Chocolatey (`choco`) está instalado pero requiere admin, así que se optó por la vía portátil:
  se descargaron y extrajeron manualmente (sin instalador, sin admin) Temurin JDK 17 y JDK 21 (el
  módulo `capacitor-android` exige `sourceCompatibility 21` — con JDK 17 solo la build fallaba con
  "invalid source release: 21"; JDK 17 se dejó igual por si algo más lo necesita) y los Android SDK
  command-line tools (`platform-tools`, `platforms;android-34`, `build-tools;34.0.0` — Gradle además
  auto-instaló `build-tools;35` y `platform;36` al construir, usando las licencias ya aceptadas). Todo
  vive en `C:\Users\wilrodriguez\android-tools\` (`jdk-17.0.20+8/`, `jdk-21.0.12+8/`, `android-sdk/`),
  fuera del proyecto — persiste entre sesiones para rebuilds futuros sin volver a descargar ~530MB.
- **Empaquetado con Capacitor**: se agregó `@capacitor/core`, `@capacitor/android` y `@capacitor/cli` a
  `client/package.json`. `client/sync-www.mjs` (nuevo) copia los archivos del cliente a `client/www/`
  (con `burako.html` renombrado a `index.html`, que es lo único que exige el empaquetado nativo de
  Capacitor) — correr `node sync-www.mjs && npx cap sync android` antes de cada rebuild para reflejar
  cambios recientes del juego. `client/capacitor.config.json` fija `appId:"com.burako.app"`,
  `appName:"Burako"`, `webDir:"www"` y `server:{androidScheme:"http", cleartext:true}` — sin esto
  último, Android bloquea por defecto el `ws://` (no `wss://`) que usa el modo Online para conectarse a
  la IP LAN del servidor, algo que ya viene funcionando en el navegador de escritorio/PWA sin este
  problema porque ahí no aplica esa restricción.
- **Un service worker no tiene sentido dentro de la app nativa** (los archivos ya están empaquetados
  adentro, no hace falta cachear nada) y además podía interferir con el esquema de WebView local — se
  guardó el registro del SW en `burako.html` detrás de `!Capacitor.isNativePlatform()`, así el mismo
  `burako.html` sirve para el servidor normal, la PWA y la fuente del APK sin duplicar código.
- **Íconos del launcher**: no existía ningún asset de imagen en el proyecto — se generaron con
  Playwright (mismo enfoque que los íconos de la PWA) los PNG de `ic_launcher`/`ic_launcher_round`
  para las 5 densidades (`mdpi` a `xxxhdpi`) más `ic_launcher_foreground` (capa transparente para el
  ícono adaptativo de Android 8+, con la letra "B" dentro de la zona segura), y se cambió
  `ic_launcher_background` a `#06132B` (el mismo `--bg-deep` del juego) en vez del blanco por defecto.
- **Build**: `android/local.properties` apunta `sdk.dir` al SDK portátil. `./gradlew.bat assembleDebug`
  (con `JAVA_HOME`/`ANDROID_HOME` apuntando a `android-tools/`) genera
  `client/android/app/build/outputs/apk/debug/app-debug.apk` — firmado automáticamente por Gradle con
  el certificado de debug estándar de Android (`apksigner verify` lo confirma), instalable
  directamente sin pasos de firma adicionales. `versionName` del APK ajustado a `"2.8.0"` para que
  coincida con `GAME_VERSION`. Copiado también a `Desktop\Burako.apk` para que sea fácil de encontrar
  y pasar al celular.
- **Qué funciona offline y qué no, en la app nativa**: exactamente igual que en la PWA — Casual contra
  IA corre 100% en el cliente y no necesita red; el modo Online sigue necesitando conexión al servidor
  (`ws://<IP-LAN>:puerto`, que el usuario ya tipea a mano en la pantalla de conectar, sin cambios ahí).
- **Verificado**: build exitoso (`BUILD SUCCESSFUL`), `apksigner verify` confirma la firma, `aapt dump
  badging` confirma `package com.burako.app`, `minSdkVersion 24`, `versionName 2.8.0`, el label
  "Burako" en todos los idiomas empaquetados y el permiso de `INTERNET`. No se pudo probar la
  instalación real en un dispositivo físico ni visualmente el ícono del launcher (no hay emulador ni
  celular conectado a esta máquina de desarrollo) — el usuario deberá confirmar tras instalarlo.
- **Cómo instalar el `.apk`**: pasar `Desktop\Burako.apk` al celular (cable USB, o subirlo a alguna
  nube/Drive y descargarlo ahí) y abrirlo — Android va a pedir habilitar "Instalar apps de fuentes
  desconocidas" la primera vez, algo esperable para un APK que no viene de Play Store. Una vez
  instalado queda con su propio ícono, pantalla completa nativa, y sigue las mismas reglas de
  online/offline que la PWA.

## No-goals de esta fase

- Reglas de juego, protocolo WebSocket, límites de partida (igual que Fases 1-11).
- No romper el layout de desktop — cambios estructurales compartidos se prueban en los dos.
