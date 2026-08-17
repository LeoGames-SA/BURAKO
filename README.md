# 🀄 BURAKO

Juego de Burako (variante uruguaya de Rummikub) completo — single-player contra IA y multijugador en red local (LAN) con servidor autoritativo.

**Total del proyecto:** ~3.970 líneas de código en 5 archivos (cliente + servidor).

---

## 📋 Índice

1. [¿Qué es Burako?](#qué-es-burako)
2. [Estructura del proyecto](#estructura-del-proyecto)
3. [Cómo instalar y jugar](#cómo-instalar-y-jugar)
4. [Arquitectura general](#arquitectura-general)
5. [Cliente por dentro](#cliente-por-dentro)
6. [Servidor por dentro](#servidor-por-dentro)
7. [Protocolo cliente ↔ servidor](#protocolo-cliente--servidor)
8. [Base de datos de perfiles](#base-de-datos-de-perfiles)
9. [Sistema de rangos y competitivo](#sistema-de-rangos-y-competitivo)
10. [Skins, tapetes y efectos](#skins-tapetes-y-efectos)
11. [IA (single-player y multiplayer)](#ia)
12. [Cosas que se pueden mejorar](#cosas-que-se-pueden-mejorar)

---

## ¿Qué es Burako?

Burako es un juego de mesa con 108 fichas (2 sets de 1-13 en 4 colores + 4 comodines). Cada jugador arma **grupos** (mismo número, distintos colores) o **escaleras** (mismo color, consecutivos) para bajar a la mesa y quedarse sin fichas.

Reglas implementadas:
- 14 fichas por jugador al arrancar.
- Para **salir** (primera bajada) hay que llegar a **30 puntos o más** en un solo juego.
- Turno de **60 segundos**: si se vence, perdés una vida y pasás el turno (sin comer fichas del pozo).
- **3 vidas** por partida (0 vidas = abandonada).
- **3 rupturas de comodín** por partida: para tocar un juego que ya tiene comodín.
- Se gana vaciando el atril o, si el pozo se acaba, quien tenga menos puntos en la mano.

---

## Estructura del proyecto

```
burako-final/
├── README.md                    ← este archivo
├── client/                      ← el juego (se abre en el navegador)
│   ├── burako.html   (568 B)    ← archivo HTML principal
│   ├── burako.css    (48 KB)    ← estilos, skins, animaciones
│   └── burako.js     (116 KB)   ← toda la lógica: juego, IA, tienda, red, UI
└── server/                      ← servidor multijugador Node.js
    ├── package.json             ← dependencia: ws (WebSocket)
    ├── server.js     (32 KB)    ← servidor autoritativo + HTTP estático
    ├── burako-core.js (4 KB)    ← reglas puras compartidas
    ├── db.js         (4 KB)     ← base de datos de perfiles (JSON)
    └── players.json             ← se crea automáticamente al primer registro
```

---

## Cómo instalar y jugar

### Modo offline (solo contra IA)

Abrí `client/burako.html` con doble clic en cualquier navegador. Nada más. La primera vez te pregunta nombre y avatar.

### Modo multijugador (LAN)

En la PC que va a hacer de servidor:
```bash
cd server
npm install       # una sola vez
node server.js
```

Muestra:
```
🀄 Burako LAN server corriendo
   Local:  http://localhost:8181
   Red:    http://192.168.0.5:8181
```

Todos los jugadores (incluido el host) abren esa URL de "Red" en el navegador — están todos en la misma wifi. La primera vez se registran con usuario/contraseña; después inician sesión.

Para cortar el servidor: `Ctrl+C` en la terminal.

---

## Arquitectura general

Hay **dos modos** que corren en el mismo cliente:

- **Modo offline:** cuando abrís `burako.html` como archivo (`file://`), todo corre local — la IA vive en el navegador, el perfil se guarda en `localStorage`.
- **Modo online:** cuando abrís desde `http://IP:puerto`, el cliente autodetecta el servidor, exige login, y todas las jugadas se envían al servidor que las valida y responde con el nuevo estado. El servidor es la **única fuente de verdad** — nadie puede hacer trampa editando su cliente.

En online, el cliente es "delgado": muestra lo que dice el server y le manda intenciones. La lógica de reglas, la IA de los bots, el timer, la validación de jugadas — todo vive en el servidor.

---

## Cliente por dentro

`client/burako.js` (~2200 líneas) contiene todo.

### Módulos principales

| Sección | Qué hace |
|---|---|
| **Constants** | `RACK_COLS/ROWS`, `TURN_SECONDS`, `TIERS` (rangos), `COLOR_KEYS`, IDs de skins/tapetes |
| **Store (P)** | Perfil persistente en `localStorage` (nombre, avatar, monedas, skins compradas, rango, XP) |
| **Game state (G)** | Estado transitorio de la partida (fichas, mesa, turno, timer, jugadores) |
| **Sound** | Web Audio API — chiptune para tocar ficha, bajar juego, ganar, error |
| **`meldInfo()`** | Validación de si un conjunto de fichas es un juego válido (grupo o escalera) |
| **`makeDeck()` / `shuffle()`** | Mazo de 108 fichas + jokers |
| **Rack functions** | `placeInRack`, `moveRackTile`, `sortRack('color'\|'numero')` |
| **Preparation zone** | `sendToWork`, `formGroup`, `dissolveGroup`, `confirmTurn`, `openMeld` |
| **AI** | `scheduleAi`, `aiTurn`, `aiFindBestMeld`, `aiFindAttach` — 3 niveles |
| **Networking (NET)** | `netConnect`, `netSend`, `netApplyState`, interceptores de acciones |
| **Render functions** | `renderMenu`, `renderPlay`, `renderShop`, `renderProfile`, `renderLobby`, `renderNetSorteo`, `renderNetDealing`, `renderPlaying`, `renderGameover` |
| **Drag & drop** | Handlers de pointer para arrastrar fichas al atril / mesa / preparación |

### Sistema de pantallas

El cliente usa una máquina de estados simple: `G.screen` toma un valor y `render()` decide qué mostrar.

- `onboarding` — primera vez, elige nombre + avatar
- `serverAuth` — login/registro (solo si abrió desde HTTP)
- `menu` — menú principal (JUGAR / PERFIL / TIENDA)
- `play` — submenú de JUGAR (Casual IA / Competitivo / Multi LAN)
- `shop` — tienda con tabs (Skins / Tapetes / Efectos)
- `profile` — perfil con avatar, rango, estadísticas, logros
- `config` — dificultad IA, timer
- `help` — cómo jugar
- `netConnect` — conexión al servidor (con sub-pasos: connect, joinRoom, createRoom, enterCode, leaderboard)
- `lobby` — sala de espera con jugadores, ready, admin controls
- `netSorteo` — sorteo online (bolsa para tocar y revelar)
- `netDealing` — reparto online (bolsa para agarrar fichas 1 a 1)
- `sorteo` / `dealing` — versiones offline de lo mismo
- `playing` — partida en curso (misma pantalla para offline/online)
- `gameover` — ganaste / perdiste / rendición

### Interceptores online

Cuando `G.online === true`, funciones como `layFromRack()`, `drawAndPass()`, `attachToMeld()`, `confirmTurn()` y `layGroupByDrag()` **no ejecutan lógica local** — envían el intento al servidor por WebSocket con `netSend()` y esperan a que el server responda con un nuevo estado (`netApplyState`).

---

## Servidor por dentro

`server/server.js` (~800 líneas) es un WebSocket server que también sirve los archivos estáticos del cliente por HTTP.

### Módulos

| Función | Qué hace |
|---|---|
| **HTTP server** | Sirve `burako.html`, `burako.css`, `burako.js` desde `../client/` |
| **WebSocket server (`ws`)** | Recibe conexiones y mensajes JSON |
| **`rooms` (Map)** | Salas activas en memoria — se limpian solas cuando quedan vacías 5 min |
| **`makeRoomCode()`** | Genera código de 4 letras único |
| **`stateFor(room, playerId)`** | Arma el estado a enviar (oculta las manos de los demás) |
| **`broadcast(room)`** | Envía state a todos los jugadores humanos de la sala |
| **`startGame(room)`** | Arma mazo, inicializa hands, entra en fase `sorteo` |
| **`autoReveal` / `autoDeal` / `maybeAIPlay`** | Bots juegan solos con timers |
| **`handleLay` / `handleLayMultiple` / `handleReorganize` / `handleAttach` / `handleDraw`** | Validan y aplican cada tipo de jugada |
| **`resetTurnTimer`** | 60s por turno; si se vence, 3 fichas + advanceTurn |
| **Auth handlers** | `register`, `login`, `leaderboard`, `myProfile` |
| **Lobby handlers** | `setReady`, `setTapete`, `addAI`, `kickAI`, `start` |

### Ciclo de vida de una sala

1. Alguien manda `{type:"join", room:"NUEVA"}`.
2. Server crea sala con código de 4 letras y lo marca como admin (`players[0]`).
3. Otros mandan `{type:"join", room:"ABCD"}` para unirse.
4. Admin puede: cambiar tapete, agregar/quitar bots. Todos: marcarse listos.
5. Cuando todos los humanos están listos y hay ≥ 2 jugadores, el admin manda `{type:"start"}`.
6. `startGame(room)` → fase `sorteo`. Cada jugador saca una ficha (bots auto-revelan).
7. Cuando todos revelaron → 2s → fase `dealing`. Se reordenan por valor y cada uno agarra 14 fichas.
8. Cuando todos tienen 14 → fase `playing`. Timer arranca. Turnos con `advanceTurn`.
9. Alguien vacía el atril **o** el pozo se acaba y todos pasan → `winnerId`. Si es ranked, se actualiza el ranking.
10. Sala queda esperando revancha o se limpia tras 5 min sin conexiones.

---

## Protocolo cliente ↔ servidor

Todo pasa por JSON sobre WebSocket. Formato: `{type: "...", ...datos}`.

### Cliente → Servidor

| Tipo | Datos | Cuándo |
|---|---|---|
| `register` | `{username, password}` | Crear cuenta |
| `login` | `{username, password}` | Iniciar sesión |
| `leaderboard` | — | Pedir top 20 |
| `myProfile` | — | Refrescar mi perfil |
| `join` | `{room, name, ranked?}` | Crear/unirse a sala |
| `setReady` | `{ready: bool}` | Marcar listo |
| `setTapete` | `{tapete: "id"}` | (Admin) Cambiar tapete |
| `addAI` | — | (Admin) Agregar bot |
| `kickAI` | `{aiId}` | (Admin) Sacar bot |
| `start` | — | (Admin) Empezar partida |
| `reveal` | — | Revelar ficha de sorteo |
| `dealDraw` | `{all?: bool}` | Agarrar 1 (o todas) del reparto |
| `lay` | `{tiles: [ids]}` | Bajar un juego |
| `layMultiple` | `{groups: [[ids]]}` | Bajar varios juegos |
| `attach` | `{meldId, tiles: [ids]}` | Pegar fichas a un juego existente |
| `reorganize` | `{openedMeldIds, groups}` | Abrir juego(s) y rearmar |
| `draw` | — | Tomar ficha del pozo |
| `surrender` | — | Rendirse |
| `activity` | `{info}` | Notificar que estás armando algo (visual) |

### Servidor → Cliente

| Tipo | Datos | Cuándo |
|---|---|---|
| `authOk` | `{profile}` | Login/registro exitoso |
| `error` | `{msg}` | Cualquier error |
| `joined` | `{code, playerId}` | Entraste a una sala |
| `state` | (todo el estado) | Cada cambio del juego |
| `tick` | `{timeLeft}` | Cada segundo del timer |
| `toast` | `{msg}` | Aviso corto ("X tomó ficha") |
| `leaderboard` | `{data: [...]}` | Respuesta a `leaderboard` |
| `rankUpdate` | `{delta, before, after, place, profile}` | Al final de una ranked |
| `playerActivity` | `{playerId, playerName, info}` | Actividad de un rival |

---

## Base de datos de perfiles

`server/db.js` usa **un archivo JSON** (`players.json`) como storage. Para LAN con pocos jugadores es más que suficiente y no requiere instalar nada.

Estructura por jugador:
```json
{
  "leo": {
    "username": "Leo",
    "passwordHash": "sha256...",
    "rankPts": 1000,
    "fichas": 50000,
    "wins": 0,
    "losses": 0,
    "games": 0,
    "streak": 0,
    "bestStreak": 0,
    "level": 1,
    "xp": 0,
    "createdAt": 1691234567890
  }
}
```

Contraseñas hasheadas con **SHA-256**. La key del objeto es el username en minúsculas.

Funciones expuestas:
- `register(user, pass)` → crea si no existe
- `login(user, pass)` → verifica hash
- `getProfile(username)` → sin passwordHash
- `resolveRanked([...], totalPlayers)` → actualiza puntos, fichas, XP, level, rachas
- `leaderboard(n)` → top N ordenados por rankPts

---

## Sistema de rangos y competitivo

### Rangos por puntos

| Rango | Puntos | Icono |
|---|---|---|
| Bronce | 0 – 1499 | 🥉 |
| Plata | 1500 – 2499 | 🥈 |
| Oro | 2500 – 3499 | 🥇 |
| Platino | 3500 – 4499 | 💠 |
| Diamante | 4500+ | 💎 |

### Al final de una partida ranked (solo online)

- **2 jugadores:** 1° +50pts, 2° -50pts
- **3 jugadores:** 1° +50pts, 2° +10pts, 3° -50pts
- **4 jugadores:** 1° +50pts, 2° +30pts, 3° +10pts, 4° -50pts

Además cada jugador gana:
- **Fichas** (moneda): 100 al ganar (+ bonus racha), 40 segundo, 10 el resto
- **XP**: 150 ganar, 100 segundo, 50 el resto
- **Level up**: cada 500 XP subís 1 nivel
- **Streak**: se resetea si perdés

Los bots **no cuentan** para el ranking (no tienen username registrado).

---

## Skins, tapetes y efectos

### 15 Skins de fichas

| ID | Nombre | Precio | Estilo |
|---|---|---|---|
| `clasica` | Clásica | 0 | Marfil, número en color de la ficha |
| `negra` | Negra con Dorado 👑 | 1500 | Fondo negro, bordes dorados |
| `circulo` | Círculo de Color | 2000 | Blanca, punto grande de color |
| `madera` | Madera Premium | 2500 | Fondo tipo mesa antigua |
| `piedra` | Piedra Antigua | 3000 | Textura piedra gris |
| `oriental` | Místico Oriental 🀄 | 3000 | Ideogramas orientales (火水木土金) |
| `elite` | Diseño Élite | 3500 | Negro con símbolos de póker (♥ ♠ ♣ ♦) |
| `fuego` | Fuego Ardiente 🔥 | 4000 | Llamas animadas |
| `hielo` | Hielo Glacial ❄ | 4000 | Cristal celeste con copo de nieve |
| `neon` | Tecno Futurista ⚡ | 7000 | Negro con neón vibrante del color propio |
| `galaxia` | Galáctico Espacial 🪐 | 8000 | Fondo estrellado |
| `oro` | Oro Real 👑 | 6500 | Dorado premium |
| `aracnido` | Héroe Arácnido | 5000 | Malla decorativa negra |
| `tecno` | Héroe Tecno | 5000 | Armadura roja con LED |
| `sombra` | Héroe Sombra | 5000 | Gris oscuro con aura del color |

### 8 Tapetes de mesa

`clasico` (gratis) · `fieltroverde` · `fieltroazul` · `fieltrorojo` · `caoba` · `marmol` · `dorado` · `neon`

En multijugador, el **admin** elige el tapete y todos lo ven.

### 5 Efectos de bajada (partículas)

`clasico` (gratis) · `explosion` 🔥 · `escarcha` ❄ · `rayo` ⚡ · `confeti` 🎉

Cuando bajás un juego, se disparan partículas del color del efecto elegido.

---

## IA

### Single-player (en el cliente)

`scheduleAi()` corre 3 niveles:
- **Fácil**: 12s pensando, busca solo el primer juego encontrado
- **Normal**: 10s, ordena por puntos y toma el mejor
- **Difícil**: 8s, además extiende juegos de la mesa antes de bajar

Estrategia base:
1. Si no salió, busca un juego que sume 30+
2. Si ya salió, busca cualquier juego válido en la mano
3. Intenta pegar fichas a juegos de la mesa (sin comodines)
4. Si nada funciona, toma ficha del pozo

### Multiplayer (en el servidor)

`maybeAIPlay(room)` — los bots agregados por el admin juegan solos:
- Delay de 1.5-3s por turno (más natural)
- Estrategia simple: buscan el mejor grupo/escalera posible, si no, toman ficha
- Al bot no le corre el timer de 60s
- Al ganar la partida un bot, muestra "🤖 ganó" pero no afecta el ranking

---

## Cosas que se pueden mejorar

### Bugs conocidos / rincones ásperos

- El **arrastrar (drag & drop)** puede ser flakey en Firefox móvil por diferencias en pointer events.
- La **reconexión automática** no está: si se te cae el WebSocket en medio de una partida, tenés que refrescar y volver a loguearte (aunque tu perfil sigue guardado en el server).
- El **historial de jugadas** no se persiste — si refrescás mid-partida, perdés lo que pasó antes.
- **Múltiples pestañas del mismo usuario** confunden al server (el WebSocket viejo queda huérfano). Cada usuario debería usar un solo tab.

### Features que faltan y estarían buenas

**Gameplay:**
- **Chat en la sala** (aunque sea con reacciones rápidas: 👏 😅 🔥 💀)
- **Deshacer última acción** dentro del mismo turno
- **Historial de jugadas** en un panel lateral ("Leo bajó 7-8-9 (24 pts)")
- **Indicador visual "esta jugada es legal"** al arrastrar sobre un juego de la mesa (verde/rojo)
- **Zoom en la mesa** cuando hay muchos juegos
- **Vibración en móvil** al bajar un juego (`navigator.vibrate`)
- **Modo espectador** cuando quedás afuera en partidas de 3-4

**Sistema:**
- **Base de datos real** (SQLite en vez de JSON) para más de 50 jugadores
- **Recuperación de contraseña** (aunque sea con pregunta secreta)
- **Reconexión automática** al WebSocket con exponential backoff
- **Guardar partida en curso** para retomar después
- **Rankings semanales/mensuales** con reseteo periódico
- **Historial de partidas** por jugador
- **Anti-cheat**: rate limiting en el server, detección de patrones raros

**Visual:**
- **Música de fondo** (loops de casino/jazz)
- **Más efectos** de bajada (arcoíris, glitch, holograma)
- **Animación de reparto** con cartas volando desde la bolsa
- **Estilos de mesa animados** (ondas sutiles, luces que se mueven)
- **Skins pack de temporada** que van y vuelven
- **Emblemas de rango** más elaborados

**Multijugador avanzado:**
- **Internet real** (no solo LAN) — necesitaría port-forwarding o hosting en la nube
- **Salas privadas con contraseña**
- **Sistema de amigos** (agregar por username, invitar a sala)
- **Matchmaking automático** para ranked (te empareja con alguien de rango similar)
- **Torneos** con eliminatorias
- **Espectadores en salas activas** (ver partidas en vivo)
- **Replay de partidas** guardadas

**Distribución:**
- **PWA** (Progressive Web App): instalable como app en el celular
- **APK con Capacitor** para tener una app real en Android
- **Electron** para desktop con menú de sistema
- **Docker** para el servidor (deploy más fácil)

**Accesibilidad:**
- **Tamaño de fichas ajustable** por preferencia
- **Alto contraste** para daltónicos (los colores están hardcoded)
- **Navegación por teclado** completa
- **Lectores de pantalla** con ARIA labels

---

## Cómo modificar cosas rápido

- **Agregar una skin nueva**: agregá el objeto a `SKINS` en `burako.js` y las reglas `.sk-tuID` en `burako.css`.
- **Cambiar la dificultad de la IA**: buscá `aiTurn()` en `burako.js`.
- **Cambiar el turno a 90 segundos**: editá `TURN_SECONDS` en `server.js` (multijugador) y en `burako.js` (offline).
- **Debug del servidor**: los `console.log` van a la terminal. Agregá los que necesites.
- **Ver estado de salas en vivo**: agregá un endpoint GET `/debug/rooms` en `server.js` que devuelva `Array.from(rooms.entries())`.

---

## Licencia

Uso personal / privado. No hay licencia comercial.

---

**Hecho en Uruguay 🇺🇾**
