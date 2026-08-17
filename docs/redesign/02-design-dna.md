# Design DNA + arquitectura visual — Burako

Basado en `01-audit.md`. Regla general: **extender lo que ya existe, no reinventar** — alguien ya dejó un bloque de tokens en
`burako.css:51-66` con nombres casi correctos pero desconectado (349 colores hardcodeados vs 1 uso real). Este documento define
qué va DENTRO de esos tokens y cómo se organiza todo alrededor. La implementación (migrar las 349 ocurrencias, tocar componentes)
es Fase 2 — esto es la decisión de diseño, no el código.

## 1. Paleta de color

### Núcleo (ya declarado, se mantiene — son correctos para la identidad pedida)

| Token | Valor | Rol |
|---|---|---|
| `--bg-deep` | `#06132b` | Azul profundo — fondo base de toda la app |
| `--bg-mid` | `#1f5aa8` | Azul medio — degradés de fondo, superficies elevadas |
| `--color-blue-electric` | `#38bdf8` | Azul eléctrico — acentos activos, focus, links, energía (hoy casi sin uso real) |
| `--color-violet` | `#a855f7` | Violeta — segundo protagonista, debe ganar presencia (hoy 1 uso real) |
| `--gold` / `--gold-dark` / `--gold-text` | `#fbbf24` / `#d99b00` / `#ffe9a8` | Dorado — reservado ESTRICTAMENTE para: CTA primario, bordes premium, estados activos, recompensas, logros, info importante. Nunca decorativo suelto. |

**Regla de dominancia** (pedido §1): en cualquier pantalla, azul+violeta deben cubrir la mayor superficie; dorado aparece solo en
puntos de atención (1-3 elementos por pantalla, nunca de fondo). Si una pantalla tiene más de ~15% de área dorada, está mal usado.

### Gap detectado: falta madera real

`--wood`/`--wood-dark`/`--wood-edge` (`#1c3a63`/`#122845`/`#0d1f3a`) son en realidad **azules oscuros**, no marrones — hoy cumplen
un rol estructural (paneles) pero no dan la sensación de "mesa de juego premium" que pide el §1. Se agregan tokens nuevos,
separados, para superficies que sí deben leerse como madera física (mesa de juego, marcos de cartas premium, bordes de atril):

| Token nuevo | Valor propuesto | Rol |
|---|---|---|
| `--wood-brown` | `#4a2f1c` | Madera oscura cálida — base de la mesa, marcos premium |
| `--wood-brown-light` | `#6b4226` | Veta/highlight de madera |
| `--wood-brown-edge` | `#2e1b0f` | Borde/sombra de madera |

Los `--wood*` azules existentes se renombran conceptualmente a "superficie estructural" (siguen usándose para paneles de UI,
donde SÍ deben seguir siendo azules, no marrones) — no se tocan sus valores, solo se documenta su rol real para no confundirlos
con la madera nueva.

### Gap detectado: sin tonos cálidos secundarios

El §1 pide "tonos cálidos secundarios" separados del dorado (que está reservado para premium). Se agrega una familia ámbar/cobre
para: barras de XP, glows secundarios, acentos de calidez que no compiten con el dorado premium:

| Token nuevo | Valor propuesto | Rol |
|---|---|---|
| `--color-amber` | `#f97316` | Calidez secundaria — XP, progreso, acentos no-premium |
| `--color-amber-soft` | `rgba(249,115,22,.18)` | Fondos/glows sutiles de la misma familia |

### Estados semánticos (formalizar lo que ya existe disperso)

| Token nuevo | Valor | Basado en |
|---|---|---|
| `--color-success` | `#22c55e` | ya usado como `--seat-verde` |
| `--color-danger` | `#c0392b` | ya usado como `--rojo` |
| `--color-info` | `#38bdf8` | = `--color-blue-electric`, reutilizado, no duplicado |

## 2. Materiales (recetas reutilizables de superficie)

Cuatro materiales cubren toda la app — cualquier panel/botón/tarjeta nueva elige uno, no inventa su propio gradiente:

1. **Cristal** (paneles, HUD, modales) — `--panel-bg` + `--panel-border` + `--panel-shadow` ya existentes, con blur de fondo.
2. **Madera premium** (mesa, marcos de cartas especiales, bordes de atril) — gradiente `--wood-brown` → `--wood-brown-light` con
   veta sutil (`repeating-linear-gradient` de bajo contraste), borde `--wood-brown-edge`.
3. **Metal dorado** (botones importantes, bordes premium, iconos de logro) — `--btn-gold-grad` + `--btn-gold-shadow` ya
   existentes, con highlight especular superior.
4. **Piedra/ébano** (fondos secundarios oscuros, tooltips, back de ficha) — variante más oscura de `--bg-deep`, casi sin
   saturación, para no competir con azul/violeta dominante.

## 3. Tipografía

Problema confirmado en auditoría: `Cinzel Decorative` se mezcla con `Georgia` suelto en al menos 6 lugares distintos
(`burako.css:311,381,519,706,757,991`) sin criterio, y el body usa `system-ui` — cero coherencia tipográfica.

Sistema nuevo (3 roles, sin excepciones sueltas de `Georgia`):

- **Display** (`--font-display`) — `Cinzel Decorative` ya cargado. Uso EXCLUSIVO: logo, título de pantalla nivel 1, momentos
  hero (logro, level-up, victoria/derrota). Nunca en botones ni texto de UI corriente.
- **Heading** (`--font-heading`, nuevo) — `Cinzel` (variante no-decorative, misma familia tipográfica, mismo `@import`, más
  legible en tamaños chicos) para subtítulos y nombres de sección. Reemplaza todos los `Georgia` sueltos.
- **Body/UI** (`--font-body`, nuevo) — reemplaza `system-ui` por `Manrope`. **Implementado en Fase 2**: vendorizado como
  `.woff2` local en `client/fonts/` (Cinzel y Manrope como fuentes variables, un solo archivo cada una; Cinzel Decorative en
  3 instancias estáticas 400/700/900), servido por `client/fonts/fonts.css`. Se sacó el `<link>` a `fonts.googleapis.com` del
  HTML y el `@import` que quedaba suelto en `burako.css` — el offline (`file://`) ya no depende de internet para tipografía.
- Números de HUD (timer, contadores, monedas): no fuente nueva, `font-variant-numeric:tabular-nums` para que no salten de ancho.

## 4. Motion — extender el sistema ya iniciado

Ya existe un bloque `--motion-fast/normal/slow` + `--motion-ease` (`burako.css:38-42`) con una convención bien escrita en
comentarios ("toda animación nueva sale de acá"). Se mantiene y se le agrega el tier que falta para eventos grandes:

| Token | Valor | Uso (pedido §7) |
|---|---|---|
| `--motion-fast` (existente) | `.15s` | Microinteracciones: hover, click, selección, focus |
| `--motion-normal` (existente) | `.4s` | Entradas/salidas de paneles, cambio de pantalla, toasts |
| `--motion-hero` (nuevo) | `.8–1.2s`, coreografiado con timelines GSAP (Fase 7) | Solo eventos grandes: iniciar partida, repartir, bajar Burako, romper comodín, ganar/perder, subir nivel, desbloquear skin, logro, recompensa de pase |

Regla explícita: **un mismo tipo de interacción usa siempre el mismo tier** — nunca "click → rebote exagerado" en todo (queja
directa del §7). El patrón `--fx-rgb` (terna R,G,B por componente, ya documentado en el CSS) se mantiene como estándar para
cualquier color dinámico de efecto.

`prefers-reduced-motion` ya tiene 9 reglas dedicadas en el CSS actual — buena disciplina existente que se **debe extender** a
todo lo nuevo, incluyendo timelines de GSAP y el canvas de Three.js (pausar/omitir partículas, no solo CSS).

## 5. Sistema de capas (pedido §18)

Los z-index actuales (auditoría §11) ya tienen una jerarquía relativa coherente, solo sin nombrar. Se tokeniza sin romper el
orden existente:

| Token nuevo | Rango | Mapea a (hoy) |
|---|---|---|
| `--z-bg` | 0 | fondo, floaters, menu-elegant |
| `--z-ambient` | 1 | *(nuevo — reservado para partículas ambientales / canvas Three.js de portada, hoy no existía capa separada)* |
| `--z-table` | 2 | mesa, mesa-wave-fx, mesa-disco-fx |
| `--z-objects` | 4–10 | sel-halo, sel border, timerbar, variantes `tile.sel` |
| `--z-ui` | 20–30 | *(nuevo rango — hoy el HUD compartía 2 con efectos de mesa; se separa para que un efecto de mesa nunca tape al HUD)* |
| `--z-notification` | 40–50 | toast, banner |
| `--z-modal` | 60–70 | pauseovl, ability-modal-ovl |
| `--z-critical` | 90–99 | trail particles, glitch/lightning flash |

Implementación (remapear las 20+ reglas existentes) es Fase 2, no ahora.

## 6. Estado local de UI vs. estado compartido de juego (pedido §15)

Regla dura, sin excepciones: **una animación se dispara desde el estado compartido (`netApplyState`) solo si el cambio que
representa es parte real del estado de juego.** Si es puramente local (abrir un modal, hover, un drag en curso, previsualizar
una skin), nunca debe:
- mandarse por WebSocket, ni
- estar contenida en el diff que produce `netApplyState`.

El sistema de "vuelo de ficha" actual (`flightAnimate` y compañía, `burako.js:816-1290`) ya sigue este patrón — se dispara
localmente ante acciones propias del jugador que las ejecuta. Al reemplazar/potenciar con GSAP en Fase 7 hay que preservar
explícitamente esta separación (auditar caso por caso, no asumir).

## 7. Pantallas confirmadas (24, vs. 15 del README)

`intro, auth, onboarding, menu, help, changelog, play, casualIA, iaCasualSetup, team2v2Setup, netConnect, lobby, netCountdown,
sorteo, netSorteo, dealing, netDealing, playing, gameover, shop, profile, config, pass, galacticoPass, rangos`

Todas deben terminar hablando el mismo Design DNA. Incluye dos sistemas completos no mencionados en el pedido original pero que
deben recibir el mismo tratamiento: **Modo Galáctico** (tapete y HUD propios, pase de progreso propio) y **modo Equipo 2v2**
(work-zone compartida, chat rápido).

## 8. Arquitectura de build (Vite — implementada en Fase 2, revisada respecto al plan original)

**Decisión final (distinta de lo planeado acá originalmente, con motivo):** `burako.js`/`burako-core.js` NO se convirtieron a ES
modules y NO pasan por Vite. Son ~5500 líneas de código legacy en sloppy mode, nunca antes probadas en un navegador real dentro
de este entorno — convertirlas a módulos las fuerza a strict mode (obligatorio en ES modules) sin ninguna forma de verificar
que nada se rompe silenciosamente. El riesgo no valía la pena para lo que Vite necesitaba resolver en Fase 2 (dar acceso a
GSAP/Three.js vía npm).

Lo implementado:
- `client/package.json` nuevo (separado de `server/package.json`), con Vite como devDependency y GSAP como dependency.
  Three.js **no se instaló todavía** — se agrega en Fase 3 solo si la portada decide que aporta valor real (§3 del pedido:
  "no usar Three.js simplemente por usarlo").
- `client/vite.config.js`: build en **modo librería** (`build.lib`, formato `iife`) que bundlea SOLO las dependencias npm desde
  `client/src/vendor.js` en un único archivo `client/vendor/vendor-bundle.js`, exponiendo `window.gsap` como global clásica.
- `client/burako.html` carga ese archivo con un `<script src="vendor/vendor-bundle.js">` normal, ANTES de `burako-core.js` y
  `burako.js` — que siguen siendo scripts clásicos sin cambios, exactamente como antes.
- **`server/server.js` NO cambió su lógica de servido estático** (sigue sirviendo `client/` directo) — no hizo falta, porque
  no hay `dist/` ni salida de Vite fuera de `client/vendor/`. Solo se agregó `.woff2` al mapa MIME (para las fuentes
  vendorizadas, ver más abajo).
- `client/burako.html` sigue siendo el archivo que se abre con doble clic (`file://`) en modo offline, sin ningún dev server —
  `vendor-bundle.js` es un archivo local más, versionado en disco, regenerado con `npm run build:vendor` cuando cambian las
  dependencias.
- Verificado en Fase 2 con Playwright real (Chromium headless): la app carga sin errores de consola ni requests fallidos,
  `window.gsap` está disponible, las fuentes vendorizadas cargan correctamente. Ver `docs/redesign/screenshots/fase2-intro.png`.

Si en una fase futura (probablemente Fase 7, al meter animaciones grandes de verdad) conviene modularizar `burako.js`, esa
conversión a ES modules se evalúa aparte, con tiempo para probar cada pantalla en navegador — no como efecto secundario de
"agregar Vite".

## 9. No-goals (reafirmados, ver también `00-roadmap.md`)

No se tocan sin preguntar: reglas de Burako, protocolo WS, lógica de pase/logros/ranking (son reales y server-autoritativos —
el rediseño es visual sobre datos existentes, confirmado en auditoría §7-8).
