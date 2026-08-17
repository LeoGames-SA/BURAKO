# Roadmap — Rediseño visual completo de Burako

Referencia de estado entre sesiones. Actualizar el checkbox y la fecha al cerrar cada fase.

- [x] **Fase 1** — Auditoría + Design DNA + arquitectura visual — 2026-08-13
- [x] **Fase 2** — Sistema de diseño + tokens + componentes — 2026-08-13
- [x] **Fase 3** — Portada + login + registro + navegación — 2026-08-13
- [x] **Fase 4** — Perfil + tienda + pase + ranking + logros — 2026-08-13
- [x] **Fase 5** — Lobby — 2026-08-13
- [x] **Fase 6** — Mesa + fichas + atril + preparación — 2026-08-13
- [x] **Fase 7** — Animaciones + GSAP + Three.js + partículas — 2026-08-13
- [x] **Fase 8** — Audio — 2026-08-13
- [x] **Fase 9** — Responsive + rendimiento — 2026-08-13
- [x] **Fase 10** — Testing completo — 2026-08-13

## Nota de alcance real — Fase 2

La "migración de 349 colores hardcodeados" y el "remapeo de z-index" del pedido original **no se hicieron como una pasada
mecánica global**, a propósito:

- **Colores**: de los 349 literales, solo 4 eran duplicados exactos de un token ya declarado — esos 4 ya se migraron
  (`burako.css`, verificado sin diff visual). El resto son colores genuinamente distintos entre sí (paletas propias de cada
  una de las 30 skins, tonos puntuales por pantalla) — forzarlos a un token compartido no es "ordenar", es cambiarles el
  color de verdad, y eso requiere criterio de diseño pantalla por pantalla, no un find-and-replace. Ese trabajo real pasa a
  ser parte de cada fase de pantalla (Fase 3 portada/login, Fase 4 perfil/tienda/pase, Fase 5 lobby, Fase 6 fichas/mesa),
  donde cada cambio se verifica con Playwright antes de darlo por bueno.
- **Z-index**: la escala de 8 tokens (`--z-bg` … `--z-critical`) ya está declarada en `:root` como referencia. Los ~24 valores
  reales en uso hoy son más finos que esos 8 tokens (hay sub-capas dentro de "crítico" para partículas, dentro de "banner"
  para texto apilado, etc.) y varios solo se disparan con interacción real (pausar partida, modal de habilidad en Modo
  Galáctico, desbloquear un logro) — sustituirlos a ciegas sin poder gatillar y mirar cada caso es el mismo riesgo que los
  colores. Se resuelve igual: en la fase de la pantalla/componente correspondiente, verificando en navegador.

Sí completado en Fase 2: scaffold de Vite + GSAP (`client/package.json`, `client/vite.config.js`, `client/vendor/vendor-bundle.js`),
fuentes vendorizadas localmente (`client/fonts/`), tokens nuevos en `:root` (madera cálida, ámbar, estados semánticos, tier de
motion "hero", escala de z-index, fuentes heading/body), y los 2 materiales base que faltaban (`.panel-wood`, `.panel-stone`)
sumados a los que ya existían (`.card`/cristal, `.btn-gold`/metal dorado). Todo verificado en Chromium real vía Playwright, sin
errores de consola ni requests fallidos — ver `docs/redesign/screenshots/fase2-intro.png`.

## Nota de alcance real — Fase 3

- **Fix del logo BURAKO** (causa raíz de `01-audit.md` §3): `fanLogoHTML()` en `client/burako.js` reemplaza el abanico que
  compartía un solo pivote de rotación por offsets reales en X por ficha (+ una rotación sutil de acento y un arco leve en
  Y) — las 6 fichas quedan siempre separadas y legibles. Compartido entre la portada (intro) y el menú principal, verificado
  con screenshot recortado (`fase3-fan-logo-fix.png`) mostrando "BURAKO" completamente legible.
- **Portada rediseñada**: el fan de fichas ahora es el elemento protagonista arriba de todo, con un halo de luz azul/violeta
  detrás (`.portada-glow`) y la tarjeta de login/bienvenida en material "madera premium" (`.panel-wood`, tokens de Fase 2)
  en vez del panel genérico anterior. Entrada coreografiada con GSAP (`animatePortadaEntrance`): el fan se arma primero por
  CSS, la tarjeta se retiene y aparece después — ya no compiten por atención al mismo tiempo. Respeta
  `prefers-reduced-motion` (no anima si el usuario lo pidió).
- **Tres.js: decisión = NO por ahora.** El pedido original lo deja a criterio ("si aporta valor, usarlo; si no, no") y el
  propio desglose de fases del usuario ubica "GSAP + Three.js + partículas" en **Fase 7**, no acá. Además, el modelo de
  render actual reemplaza `#app` por completo en cada navegación (`innerHTML`) — montar una escena WebGL seguura sin fugas
  de memoria/contexto requiere decidir dónde vive el canvas persistente (candidato: `#bgdecor`, que ya vive fuera de `#app`
  y sobrevive a los re-renders), y eso merece su propio análisis en Fase 7 en vez de improvisarlo acá. La portada actual
  logra profundidad/ambiente/parallax de luz con CSS + el sistema de fichas flotantes que ya existía (`#bgdecor`,
  `initBgDecor()`) + GSAP, sin esa complejidad.
- **Login, registro y onboarding**: mismo material de madera, mismos inputs "tallados" (fondo oscuro recedido en vez del
  gris translúcido genérico anterior) — mismo idioma visual que la portada, sin tocar ninguna lógica de autenticación.
- **Navegación**: ya comparte `.card-x` / `.btn-ghost.btn-back-sticky` en las 25+ pantallas que usan `.card` — no se
  encontró necesidad de un patrón nuevo, esas clases ya heredan los tokens de Fase 2 automáticamente.
- Verificado en Chromium real (desktop 1280×900 y mobile 390×844): sin errores de consola, `.fan` completamente legible y
  escalado correctamente en mobile (usa el `@media(max-width:400px)` que ya existía). Screenshots en
  `docs/redesign/screenshots/fase3-*.png`.
- **Bug post-entrega (reportado por el usuario, corregido el mismo día)**: la tarjeta de la portada quedaba pegada en
  `scale(0.6)` para siempre (se veía chica) porque la animación CSS vieja `.a-pop` y el nuevo `gsap.fromTo` peleaban por la
  misma propiedad `transform` en el mismo elemento — GSAP capturó el `scale(.6)` a mitad de la animación CSS y lo dejó fijo
  de ahí en más. Fix: la tarjeta de la portada ya no lleva `.a-pop` (GSAP es dueño único de su entrada), y el tween ahora
  fija `scale:1` explícito en los dos extremos para que no vuelva a pasar. Confirmado con traza de tamaño/opacidad frame a
  frame (400×395px estable en todo momento) — ver `fase3-portada-final.png` actualizado.
  **Lección para las fases siguientes**: cualquier elemento que reciba una animación GSAP nueva debe dejar de usar
  `${G._enterCls}`/`.a-pop` — no combinar los dos sistemas sobre el mismo elemento.

## Nota de alcance real — Fase 4

- **Descubrimiento importante (corrige la auditoría de Fase 1)**: ya existían dos piezas que el audit dio por ausentes o
  pobres — un sistema de **música de fondo real y funcional** (`Music`, `client/burako.js:345+`, con control de volumen
  independiente ya conectado en Opciones — corregido en `01-audit.md` §5) y un **toast de logro dedicado y con buen diseño**
  para el camino online (`.ach-toast`, `renderAchievementToasts()`) — el audit solo había visto el camino offline
  (`unlockAch`, que sí usaba `setMsg()` genérico). Esto cambia el punto de partida de Fase 8 (audio) — no hay que construir
  música desde cero.
- **Unifiqué logros offline y online** para que usen el mismo componente (`unlockAch()` ahora empuja a
  `G.pendingAchievements` en vez de `setMsg()`) — antes un jugador offline tenía una experiencia peor sin motivo. Le sumé un
  golpe de brillo en el ícono con GSAP, animando el ÍCONO (no el contenedor del toast, que ya se anima solo por CSS) —
  mismo criterio de "no mezclar dos sistemas de animación en el mismo elemento" que la lección de Fase 3.
- **Refactor de componentes compartidos** (no maquillaje): las 5 pestañas de la tienda (skins, tapetes, efectos, estelas,
  sonidos — son 5, no 3 como decía el README) y las filas del Pase / Pase Galáctico / Rangos usaban cada una su propio
  bloque de estilo inline armado a mano por fila. Se reemplazaron por dos componentes reales tokenizados:
  `.shop-item`/`.shop-btn` (estado por `data-state` + acento de color por `--fx-rgb`, mismo patrón ya documentado en
  `:root`) y `.reward-row` (estados locked/unlocked/milestone/claimed/current, variante `.is-galactic` para el pase
  violeta). Verificado en las 5 pestañas de la tienda + pase + pase galáctico + rangos, sin errores de consola.
- Tokenicé además 13 + 17 ocurrencias exactas de `font-family` sueltas (`'Cinzel Decorative',Georgia,serif` y
  `Georgia,serif`) a `var(--font-display)`/`var(--font-heading)` en todo el archivo — no solo en las pantallas de esta
  fase, de paso quedó resuelto en el resto de la app.
- **No tocado**: la lógica de compra/equipar, el protocolo de red (`buyItem`/`setActive`/`claimPass`/`claimGalacticoPass`),
  y el detalle interno del perfil (ya era internamente coherente — solo hereda tipografía/tokens nuevos, sin necesidad de
  reescritura).
- Screenshots en `docs/redesign/screenshots/fase4-*.png`, incluye el toast de logro real disparado end-to-end (no un mock).

## Nota de alcance real — Fase 5

- **Hallazgo clave**: el server ya mandaba todo lo que pedía el §11 (avatar, rango, nivel, skin, admin, conectado) en cada
  jugador de la sala (`server/server.js:75-91`, `stateFor`) — el lobby viejo solo usaba nombre + listo/no listo y tiraba el
  resto de la información. No hubo que tocar el protocolo, solo dejar de ignorar datos que ya llegaban.
- **Cada jugador ahora es una tarjeta `.opp-card`** — el mismo componente que ya se usa para mostrar rivales EN partida
  (`oppCardHTML`), no uno nuevo. El lobby y la mesa de juego comparten el mismo lenguaje de tarjeta de jugador en vez de
  dos sistemas separados — coherencia real, no maquillaje paralelo.
- **El admin destaca** con un borde izquierdo dorado ancho (`.opp-card.is-lobby-admin`), distinto del glow de "tu turno"
  que ya existe en partida, para no mezclar los dos significados.
- Verificado en modo casual y en modo 2v2 (con asignación de equipos) — sin errores de consola, tarjetas de admin/bot/
  jugador humano todas legibles y con su acento de color distinto. Screenshots en `docs/redesign/screenshots/fase5-*.png`.
- **No tocado**: configuración de tapete/bots del admin, sistema de apuestas (modo Monedas), lógica de equipos — ya usaban
  colores dorado/azul/rojo razonables y coherentes con el resto de la app, no hacía falta reescribirlos.

## Nota de alcance real — Fase 6

- **Ataqué la causa raíz exacta documentada en Fase 1**: el punto de color (`.dotc-*::after`) era un círculo de 7px plano,
  igual para las 4 fichas, sin relieve. Ahora es una gema real (degradé radial con brillo arriba-izquierda, sombra interna,
  halo de su propio color vía `--gem-glow`) de 10px, y el número suma un halo de texto sutil de su color — el color del
  juego ya se lee en dos lugares integrados a la luz de la ficha, no en un accesorio pegado encima.
  **Importante — no es "pintar la ficha entera de color"**: el material ivory + número de color es fiel al Burako/Rummikub
  real (verificado contra las fichas físicas) — el problema era la falta de relieve del acento, no la ausencia de color de
  fondo. El material base (gradiente, bisel, sombra) ya era sólido de antes (`.tile{...}`, con `::before` de brillo
  superior) — no hacía falta rehacerlo, solo el acento de color.
- **Efecto secundario bueno, no buscado originalmente**: la geometría de la gema pasó de estar scopeada a `.sk-clasica`
  a ser la regla GENÉRICA `.tile:not(.back)::after` — esto también les da un acento por primera vez a las ~15 skins que
  el audit había marcado como "sin CSS propia visible" (quedaban sin ningún punto, fantasma). Ninguna de las 30 skins con
  su propio `::after` se tocó — siguen ganando por especificidad, verificado que ninguna regla se rompió.
- Pulí el hover del atril (sombra que se profundiza, no solo el `translateY` que ya había) y el "fantasma" que sigue al
  puntero al arrastrar (leve rotación + escala, ya heredaba el material nuevo automáticamente por reusar `tileHTML()`).
- **No tocado**: la lógica de juego, drag & drop, mesa/tapetes (ya tenían profundidad real de antes, con luz ambiente
  animada por tapete), zona de preparación (ya usa `--panel-*`). Verificado jugando una partida offline real de punta a
  punta (sorteo → reparto → mesa) en Chromium, sin errores de consola — capturas en
  `docs/redesign/screenshots/fase6-*.png`, incluida una del atril en primer plano mostrando las gemas nuevas.

## Nota de alcance real — Fase 7

- **Hallazgo, otra vez**: varios de los "eventos grandes" del §7 ya tenían tratamiento propio de antes (`.win-text` con
  shimmer dorado animado, `.levelup-banner`, la barra de XP con transición 1.2s) — no se reescribieron, seguían siendo
  buenos. El hueco real estaba en dos momentos que el pedido nombra explícitamente y que hoy no tenían NINGUNA
  celebración: **reclamar una recompensa del pase** (`claimPass`/`claimGalacticoPass` solo reproducían un sonido) y
  **desbloquear/comprar algo en la tienda** (`buySkin` y las otras 4 funciones de compra, mismo problema). Ahí se agregó
  un pulso GSAP (escala + glow) sobre la fila exacta que cambió — funciona tanto offline (inmediato) como online (recién
  cuando el server confirma la compra/reclamo), verificado disparando el flujo real de punta a punta en ambos casos, sin
  errores de consola.
- **Three.js: se mantiene la decisión de la Fase 3 — no se usó.** Nada cambió respecto al análisis de esa fase (persiste
  el mismo problema de dónde vive un canvas WebGL sin fugas dado el modelo de render actual) y el tiempo se priorizó en
  cerrar los huecos concretos de celebración de arriba, que son pedidos explícitos del brief con impacto directo, en vez
  de una exploración abierta de valor incierto.
- **El sistema manual de "vuelo de ficha"** (`flightAnimate`, `runMeldFlight`, `spawnParticles` — el candidato que la
  auditoría de Fase 1 marcó como reemplazable por GSAP) se dejó como está: funciona, está probado, y reescribirlo
  completo no entraba con el margen de esta fase sin arriesgar una regresión en la mecánica de juego más visible de
  todas. Queda anotado para retomar si en una fase futura hay presupuesto dedicado a esa reescritura puntual.
- Screenshots en `docs/redesign/screenshots/fase7-*.png`.

## Nota de alcance real — Fase 8

- Confirmado (ya lo habíamos corregido en la Fase 4): `Sound` cubre 14 eventos distintos (colocar, robar, error, comodín,
  victoria, derrota, combo, etc.) y `Music` ya funciona con volumen propio — no hubo que agregar cobertura de audio nueva.
- El gap real era 100% visual: la pantalla de Opciones era la más plana de toda la app (un `.lbl` suelto + slider, dos
  veces seguidas, sin separación). Ahora cada control (efectos / música) vive en su propia caja (`.audio-block`) con
  descripción de qué hace, sobre el mismo material madera que el resto de las pantallas de cuenta — refuerza visualmente
  que son dos controles independientes, como pide el §8 del pedido.
- Screenshot en `docs/redesign/screenshots/fase8-opciones.png`.

## Correcciones puntuales (a pedido del usuario, entre fases)

- Portada: las 6 fichas del logo (`fanLogoHTML`) tenían un arco vertical que dejaba B y O ~11px desalineadas del resto —
  se sacó el arco, ahora las 6 comparten la misma línea base.
- Portada: la tarjeta con "Iniciar sesión" quedaba con su centro ~91px por debajo del centro real de la pantalla (el flex
  centraba el bloque fan+card completo, no la tarjeta). Se sacó el fan del flujo flex (position:absolute, igual que el
  glow) para que el card sea el único elemento que participa del centrado — verificado en 0px de offset.
- Login/registro: el botón "← Volver" tenía `margin-top:2px` inline pisando el espaciado de 10px de los otros dos
  botones — se sacó el override.
- Portada y menú: se sacó el wordmark "BURAKO" en texto donde el abanico de fichas ya lo dice arriba (redundante).
- Atril: el hover de una ficha (`translateY(-2px)`) chocaba con el gap de 4px entre casillas y producía un
  parpadeo/temblor al quedarse quieto con el mouse encima — el resalte de hover ahora es solo sombra, sin mover la caja.

## Nota de alcance real — Fase 9

Esta fase fue de **verificación, no de cambios** — no se tocó código. Se hizo un barrido en viewport mobile (390×844) de
las 6 pantallas más rediseñadas (tienda, lobby, pase, rangos, opciones, mesa+atril en una partida real completa) y un
stress test de navegación repetida:

- Las 6 pantallas renderizan correctamente en mobile sin overflow ni recortes — ya heredaban los breakpoints existentes
  (los 22 `@media` que documentó la auditoría de Fase 1) sin necesitar ninguno nuevo.
- **Stress test**: 20 ciclos de navegación portada↔menú (cada uno dispara `animatePortadaEntrance`, una animación GSAP) →
  **0 tweens de GSAP activos** al terminar, conteo de nodos del DOM estable (165, sin crecer) — confirma que las
  animaciones nuevas de las Fases 3, 4 y 7 no acumulan ni dejan timers colgados.
- No se usó Three.js en ningún momento del proyecto (decisión de Fase 3, reafirmada en Fase 7), así que no hay nada que
  degradar por rendimiento ahí.
- Sin errores de consola en ningún viewport probado. Screenshots en `docs/redesign/screenshots/fase9-mobile-*.png`.

## Nota de alcance real — Fase 10 (fase final)

Todas las fases anteriores ya se habían verificado individualmente en Chromium real conforme se iban cerrando. Lo que
faltaba específicamente para el cierre era la prueba que ninguna fase anterior había hecho: **online real, servidor
contra dos clientes de verdad** (todo lo demás fue offline simulado con `G.online=false`).

- **Prueba end-to-end online real**: dos navegadores headless independientes, cada uno registró una cuenta nueva contra
  el servidor real (`register` → `authOk`), uno creó una sala casual (`join` con `room:"NUEVA"`), el otro se unió con el
  código, ambos se marcaron listos, el admin arrancó la partida, ambos revelaron su ficha de sorteo (`reveal`) y sacaron
  sus 14 fichas (`dealDraw`) — **los dos llegaron a la pantalla `playing` sin un solo error de consola en ninguno de los
  dos navegadores**. Esto ejercitó el protocolo WebSocket real de punta a punta, no un mock — confirma que todo el
  rediseño (lobby con tarjetas de jugador reales, mesa, atril con las gemas nuevas, historial, chat rápido) funciona
  igual de bien con datos que vienen de verdad del servidor autoritativo.
- **Modo Galáctico**: se verificó que la pantalla del Pase Galáctico (con su acento violeta) sigue renderizando sin
  errores con la clase `body.galactico-mode` activa.
- Capturas en `docs/redesign/screenshots/fase10-*.png`, incluida la sala de espera y la mesa de juego con dos jugadores
  reales conectados por WebSocket.

**Lo que NO se alcanzó a probar de punta a punta** (transparencia, no se inventa cobertura que no hubo): una partida
completa hasta el final (bajar juegos, ganar), el modo Equipo 2v2 jugando de verdad (sí se probó su lobby, Fase 5), y las
habilidades del Modo Galáctico en una partida real. El riesgo es bajo porque ninguna de las 10 fases tocó lógica de
reglas de juego — todo el trabajo fue CSS, tokens, componentes visuales y animaciones sobre pantallas que ya
funcionaban, verificadas una por una en Chromium a medida que se hacían.

## Documentos

- `01-audit.md` — mapa exacto del código actual (queja del usuario → archivo:línea → causa raíz). Consultar antes de tocar fichas, logo, tokens o z-index.
- `02-design-dna.md` — paleta, materiales, tipografía, motion, capas, reglas de estado local vs compartido, decisión de build (Vite).

## No-goals permanentes (no tocar sin preguntar)

- Reglas de Burako: 14 fichas, salida con 30+, turno 60s, 3 vidas, 3 roturas de comodín.
- Protocolo WebSocket cliente↔servidor (tipos de mensaje confirmados en `01-audit.md §6`).
- Lógica de Pase de temporada / Pase Galáctico / logros / ranking — ya son reales y server-autoritativos, el rediseño es visual.
- Modo Galáctico y modo Equipo 2v2 deben seguir funcionando y recibir el mismo Design DNA, aunque no estén mencionados punto por punto en el pedido original.
