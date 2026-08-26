/* ============================================================
   BURAKO LAN SERVER
   - Servidor autoritativo: el estado del juego vive acá, no en
     los navegadores. Cada jugada se valida en el servidor.
   - Sirve también el cliente (burako-online.html) por HTTP, así
     cualquiera en la misma red solo necesita abrir tu IP:PUERTO
     en el navegador, sin instalar nada.
   ============================================================ */
require("dotenv").config();
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { WebSocketServer } = require("ws");
const C = require("./burako-core.js");
const DB = require("./db.js");

const PORT = process.env.PORT || 8181;
const TURN_SECONDS = 60;
const MAX_LIVES = 3;
// Turno vencido = perdés 1 vida y pasás, SIN comer fichas del pozo (antes comías 3, lo
// que dejaba que alguien dejara pasar el timer a propósito para "comprar" fichas extra).
const MAX_PLAYERS = 8; // modo 8 jugadores: mazo doble en startGame() cuando se supera el máximo normal (4)
const GAME_MODES = ["casual", "ranked", "monedas", "team2v2", "galactico"];
const QUICK_CHAT_COOLDOWN_MS = 15000;
// Lista cerrada (no texto libre) para que el chat rápido no se pueda usar para spam/insultos.
const QUICK_CHAT_OPTIONS = ["👏","😅","🔥","💀","😂","👍","🎉","😱","🤔","⏱️ ¡Apurate!","😎 Buena jugada","🤝 Buena partida"];
// Chat de equipo (2v2): solo lo ve tu compañero, no los rivales. Lista cerrada, mismo
// motivo anti-spam que QUICK_CHAT_OPTIONS.
const TEAM_CHAT_OPTIONS = [
  ...Array.from({ length: 13 }, (_, i) => "Necesito la " + (i + 1)),
  "Sí", "No", "¿Pasamos?", "👍 Dale", "🚫 No tengo", "⏳ Esperá",
];
// Chat de texto libre (reemplaza el quick chat de presets en la UI, el
// handler de quickChat/QUICK_CHAT_OPTIONS queda intacto server-side por si
// una APK vieja todavía lo usa). Sin whitelist acá — texto real — así que sí
// hace falta límite de largo y un rate-limit básico.
const CHAT_MAX_LEN = 200;
const CHAT_COOLDOWN_MS = 800;
const CHAT_LOG_MAX = 25; // buffer por sala, para historial de recién unidos/reconectados — no para siempre (nunca se guardó nada hoy)

/* ---------- servidor HTTP: sirve el cliente ---------- */
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".webmanifest": "application/manifest+json", ".json": "application/json" };
const CLIENT_DIR = path.join(__dirname, "..", "client"); // carpeta client/ con burako.html/css/js
const server = http.createServer((req, res) => {
  let file = req.url === "/" ? "/burako.html" : req.url.split("?")[0];
  // buscar primero en la carpeta del server (por burako-core.js), luego en la del cliente
  let filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) filePath = path.join(CLIENT_DIR, file);
  if (!filePath.startsWith(__dirname) && !filePath.startsWith(CLIENT_DIR)) { res.writeHead(403); return res.end("no"); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end("404"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

/* ---------- Keepalive del WebSocket ----------
   Sin esto, las redes móviles y el proxy de Render cierran las conexiones que
   quedan un rato inactivas (esperando al rival, "pensando"), y del lado del
   cliente se sentía como "el servidor se desconectó solo". El servidor manda
   un ping a cada cliente cada 25s; el navegador/WebView responde con pong
   automáticamente (frame de protocolo, no hace falta código en el cliente).
   Si un cliente no respondió el pong del ciclo anterior, se lo considera
   muerto y se cierra (lo que dispara el ws.on("close") de siempre, con su
   margen de gracia para reconexión de partida en curso). */
const HEARTBEAT_MS = 25000;
wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });
});
const heartbeatTimer = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) { try { ws.terminate(); } catch (e) {} return; }
    ws.isAlive = false;
    try { ws.ping(); } catch (e) {}
  });
}, HEARTBEAT_MS);
wss.on("close", () => clearInterval(heartbeatTimer));

/* ---------- estado de salas en memoria ---------- */
/** rooms[code] = {
 *   code, players:[{id,ws,name,connected}], deck, bag, table, meldCounter,
 *   currentIdx, hasLaidInitial:{id:bool}, hands:{id:[tile]}, started, turnTimer, timeLeft, passStreak
 * } */
const rooms = new Map();

/* ---------- Limpieza periódica de salas fantasma/abandonadas ----------
   Antes, una sala solo se borraba si TODOS sus jugadores estaban
   "!connected" — pero los bots se crean con connected:true para siempre
   (nunca disparan ws.on("close")), así que cualquier sala con al menos un
   bot vivía en memoria para siempre, incluso mucho después de que se fueran
   todos los humanos o de que la partida terminara. Este sweep corre cada
   minuto e ignora bots: si una sala lleva más de ROOM_CLEANUP_MS sin NINGÚN
   humano conectado, se borra. Si vuelve a conectarse un humano antes de
   ese plazo, el contador se reinicia solo (se limpia roomNoHumansSince). */
// Overridables por env var SOLO para que los tests no tengan que esperar 3
// minutos reales — en producción (sin la env var puesta) quedan en 1min/3min.
const ROOM_SWEEP_INTERVAL_MS = Number(process.env.ROOM_SWEEP_INTERVAL_MS) || 60 * 1000;
const ROOM_CLEANUP_MS = Number(process.env.ROOM_CLEANUP_MS) || 3 * 60 * 1000;
const roomSweepTimer = setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const hasHuman = room.players.some((p) => !p.isAI && p.connected);
    if (hasHuman) { room.noHumansSince = null; continue; }
    if (!room.noHumansSince) { room.noHumansSince = now; continue; }
    if (now - room.noHumansSince >= ROOM_CLEANUP_MS) {
      clearInterval(room.turnTimer);
      clearTimeout(room.matchTimer);
      rooms.delete(code);
    }
  }
}, ROOM_SWEEP_INTERVAL_MS);

// [Fase 4B] Mismo margen de gracia (25s) para dos casos que antes eran
// asimétricos sin motivo: reconectar a una partida YA INICIADA (existía
// desde antes) y reconectar a una sala EN LOBBY, todavía sin iniciar
// (nuevo en esta fase — ver ws.on("close") más abajo). Una sola constante
// compartida en vez de dos "25000" sueltos — mismo criterio, un solo lugar
// para ajustarlo. Overridable por env var solo para que los tests no
// tengan que esperar 25s reales cada vez (mismo patrón que ROOM_CLEANUP_MS).
const RECONNECT_GRACE_MS = Number(process.env.RECONNECT_GRACE_MS) || 25000;
wss.on("close", () => clearInterval(roomSweepTimer));

function makeRoomCode() {
  let c;
  do { c = Math.random().toString(36).slice(2, 6).toUpperCase(); } while (rooms.has(c));
  return c;
}

function publicPlayer(p) {
  return { id: p.id, name: p.name, connected: p.connected };
}

function stateFor(room, playerId) {
  const me = room.players.find((p) => p.id === playerId);
  return {
    type: "state",
    code: room.code,
    started: room.started,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      handCount: room.started ? (room.hands[p.id] || []).length : 0,
      hasLaidInitial: !!room.hasLaidInitial[p.id], username: p.username||null,
      ready: !!p.ready, isAI: !!p.isAI, isAdmin: room.players[0] && room.players[0].id === p.id, skin: p.skin || "clasica",
      team: p.team || null,
      lives: room.gameMode === "team2v2"
        ? (room.teamLives ? (room.teamLives[p.team] ?? MAX_LIVES) : MAX_LIVES)
        : (room.lives ? (room.lives[p.id] ?? MAX_LIVES) : MAX_LIVES),
      eliminated: !!p.eliminated,
      avatar: p.avatar || "🀄", rankPts: p.rankPts || null, level: p.level || null,
      bet: p.bet || 0,
      shielded: room.gameMode === "galactico" ? !!(room.shieldActive && room.shieldActive[p.id]) : false,
      nameeffect: p.nameeffect || null, banner: p.banner || null,
    })),
    myHand: room.started ? room.hands[playerId] || [] : [],
    myAbilityUsed: room.gameMode === "galactico" ? !!(room.abilityUsedThisTurn && room.abilityUsedThisTurn[playerId]) : false,
    myBlocked: room.gameMode === "galactico" ? !!(room.blockedNextTurn && room.blockedNextTurn[playerId]) : false,
    table: room.table,
    bagCount: room.bag.length,
    currentIdx: room.currentIdx,
    timeLeft: room.timeLeft,
    winnerId: room.winnerId || null, surrendererId: room.surrendererId || null, ranked: !!room.ranked,
    gameMode: room.gameMode || (room.ranked ? "ranked" : "casual"),
    phase: room.phase || "playing",
    sorteo: room.sorteo ? room.sorteo.map(s => ({
      playerId: s.playerId, playerName: s.playerName, team: s.team || null,
      value: s.revealed ? s.value : null, revealed: s.revealed,
    })) : null,
    teammateHand: (() => {
      if (room.gameMode !== "team2v2" || !room.started) return null;
      const mate = room.players.find(p => p.id !== playerId && me && p.team && p.team === me.team);
      return mate ? (room.hands[mate.id] || []) : null;
    })(),
    teamWork: (room.gameMode === "team2v2" && room.started && me && me.team && room.teamWork)
      ? room.teamWork[me.team] : null,
    teamProposal: (room.gameMode === "team2v2" && room.started && me && me.team && room.teamProposal)
      ? room.teamProposal[me.team] : null,
    dealCount: room.dealCounts ? (room.dealCounts[playerId] || 0) : 14,
    jokerBreaks: room.started ? (room.jokerBreaks[playerId] || 0) : 3,
    tapete: room.tapete || "clasico",
    matchEndsAt: room.matchEndsAt || null,
    scores: room.scores || {},
    config: room.config || null,
    isAdmin: room.players[0] && room.players[0].id === playerId,
  };
}

function broadcast(room) {
  room.players.forEach((p) => {
    if (p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify(stateFor(room, p.id)));
  });
}

function send(ws, obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

// Mini-fase de chat: el chat es 100% efímero (nunca se guardó nada), así que
// quien recién entra o reconecta a una sala con conversación previa no veía
// nada — se manda una vez al entrar, no en cada broadcast de stateFor().
function sendChatHistory(ws, room) {
  if (room.chatLog && room.chatLog.length) send(ws, { type: "chatHistory", messages: room.chatLog });
}

/* Chequea logros "en vivo" (durante la jugada) y notifica al jugador (recompensa) y a la sala (historial) */
async function reportLiveAchievements(room, player, ctx) {
  if (!player || !player.username) return;
  try {
    const newly = await DB.checkLive(player.username, ctx);
    if (newly && newly.length) {
      if (player.ws) send(player.ws, { type: "achievementsUnlocked", achievements: newly });
      if (room) newly.forEach(a => {
        room.players.forEach(p => { if (p.ws) send(p.ws, { type: "toast", msg: `${player.name} consiguió el logro "${a.name}"`, kind: "achievement" }); });
      });
    }
  } catch (e) {}
}

function startGame(room) {
  const cfg = room.config || {};
  const TURN_SEC = cfg.turnSeconds || TURN_SECONDS;
  room.turnSecondsActive = TURN_SEC;
  const INIT_TILES = cfg.initTiles || 14;
  room.initTiles = INIT_TILES;

  // Deck size — con más de 4 jugadores (modo 8 jugadores) un mazo solo no alcanza
  // (14 fichas c/u ya suman más de 108), así que se juega con 2 mazos completos.
  let deck = room.players.length > 4 ? C.shuffle(C.makeDeck().concat(C.makeDeck())) : C.shuffle(C.makeDeck());
  if (room.gameMode === "galactico") {
    // 20 fichas de habilidad (2 de cada una de las 10) mezcladas con las normales.
    deck = C.shuffle(deck.concat(C.makeAbilityTiles()));
  }
  const deckPct = cfg.deckPct || 100;
  if (deckPct < 100) {
    const target = Math.floor(deck.length * deckPct / 100);
    deck = deck.slice(0, Math.max(target, room.players.length * INIT_TILES + 10));
  }

  room.hands = {};
  room.hasLaidInitial = {};
  room.players.forEach((p) => {
    room.hands[p.id] = [];
    room.hasLaidInitial[p.id] = false;
  });
  room.bag = deck;
  room.table = [];
  room.meldCounter = 0;
  room.passStreak = 0;
  room.jokerBreaks = {};
  room.scores = {};
  room.lives = {};
  room.players.forEach(p => { room.jokerBreaks[p.id] = 3; room.scores[p.id] = 0; room.lives[p.id] = MAX_LIVES; });
  room.teamLives = room.gameMode === "team2v2" ? { blue: MAX_LIVES, red: MAX_LIVES } : null;
  // Zona de preparación COMPARTIDA en tiempo real entre los dos integrantes de cada
  // equipo (turno de equipo real: cualquiera de los dos arma/confirma). Cada ficha
  // conserva ownerId para poder devolverla a su mano si se cancela o vence el tiempo.
  room.teamWork = room.gameMode === "team2v2" ? { blue: { loose: [], groups: [] }, red: { loose: [], groups: [] } } : null;
  // Propuesta pendiente de "ficha y pasar" o "bajar todo": uno propone, el OTRO
  // integrante del equipo tiene que confirmar antes de que se ejecute de verdad.
  room.teamProposal = room.gameMode === "team2v2" ? { blue: null, red: null } : null;
  // Modo Galáctico: estado de habilidades. abilityUsedThisTurn se resetea en cada
  // advanceTurn (máximo 1 habilidad por turno por jugador). shieldActive protege a
  // un jugador de CUALQUIER habilidad rival que lo tenga como objetivo, hasta que
  // vuelva a ser su turno. blockedNextTurn le impide usar habilidades en su próximo
  // turno. doubleDrawPending hace que su próximo robo del pozo saque 2 fichas.
  if (room.gameMode === "galactico") {
    room.abilityUsedThisTurn = {};
    room.shieldActive = {};
    room.blockedNextTurn = {};
    room.doubleDrawPending = {};
  } else {
    room.abilityUsedThisTurn = null;
    room.shieldActive = null;
    room.blockedNextTurn = null;
    room.doubleDrawPending = null;
  }
  room.startedAt = Date.now();
  // Galáctico admite límite de tiempo total igual que los demás modos (roomConfig
  // ya fuerza winMode="classic" para este modo, así que al agotarse el tiempo
  // igual se decide por puntos en mano — las fichas de habilidad no puntúan).
  const matchMin = (cfg && cfg.matchMinutes) || 0;
  room.matchEndsAt = matchMin > 0 ? room.startedAt + matchMin * 60000 : null;
  if (matchMin > 0) {
    clearTimeout(room.matchTimer);
    room.matchTimer = setTimeout(() => {
      if (!room.started) return;
      room.players.forEach(p => { if (p.ws) send(p.ws, { type: "toast", msg: "⏰ ¡Tiempo! Termina la partida por límite de tiempo." }); });
      endGameByPoints(room);
    }, matchMin * 60000);
  }
  room.started = true;
  room.winnerId = null;

  // FASE 1: Sorteo — cada jugador saca una ficha al azar para determinar el orden
  const sorteoValues = C.shuffle(Array.from({length:13},(_,i)=>i+1)).slice(0, room.players.length);
  room.sorteo = room.players.map((p, i) => ({
    playerId: p.id,
    playerName: p.name,
    team: p.team || null,
    value: sorteoValues[i],
    revealed: false,
  }));
  room.phase = "sorteo";
  room.sorteoRevealed = 0;
  room.dealCounts = {};
  room.players.forEach(p => room.dealCounts[p.id] = 0);
  broadcast(room);
  // IA revela automática
  room.players.forEach((p, i) => {
    if (p.isAI) setTimeout(() => autoReveal(room, p.id), 800 + i * 400);
  });
}

function autoReveal(room, playerId) {
  if (!room.sorteo) return;
  const entry = room.sorteo.find(s => s.playerId === playerId);
  if (!entry || entry.revealed) return;
  entry.revealed = true;
  room.sorteoRevealed++;
  broadcast(room);
  if (room.sorteoRevealed >= room.players.length) {
    setTimeout(() => finishSorteo(room), 2000);
  }
}

function finishSorteo(room) {
  const order = room.sorteo.slice().sort((a, b) => b.value - a.value);
  let orderedPlayers, toastMsg;
  if (room.gameMode === "team2v2") {
    // Alternancia estricta Azul/Rojo/Azul/Rojo: dentro de `order` (ya de mayor a menor
    // valor de sorteo), el jugador con más valor de cada equipo es su "capitán" y
    // arranca por su equipo. Así ningún equipo juega dos turnos seguidos.
    const blueEntries = order.filter(o => o.team === "blue");
    const redEntries = order.filter(o => o.team === "red");
    const firstIsBlue = (blueEntries[0] ? blueEntries[0].value : -1) >= (redEntries[0] ? redEntries[0].value : -1);
    const teamsInOrder = firstIsBlue ? [blueEntries, redEntries] : [redEntries, blueEntries];
    const byId = (id) => room.players.find(p => p.id === id);
    orderedPlayers = [
      byId(teamsInOrder[0][0].playerId), byId(teamsInOrder[1][0].playerId),
      byId(teamsInOrder[0][1].playerId), byId(teamsInOrder[1][1].playerId),
    ];
    const capName = (entries) => entries[0].playerName + " (" + entries[0].value + ")";
    toastMsg = "Arranca " + (firstIsBlue ? "🔵 Equipo Azul" : "🔴 Equipo Rojo") + " · Capitanes — 🔵 " + capName(blueEntries) + " · 🔴 " + capName(redEntries);
  } else {
    orderedPlayers = order.map(o => room.players.find(p => p.id === o.playerId));
    toastMsg = "Orden: " + order.map((o,i) => (i+1)+"° "+o.playerName+" ("+o.value+")").join(" · ");
  }
  room.players = orderedPlayers;
  room.currentIdx = 0;
  room.phase = "dealing";
  room.players.forEach(p => { if (p.ws) send(p.ws, { type: "toast", msg: toastMsg }); });
  broadcast(room);
  // IA agarra fichas automáticamente
  room.players.forEach((p, i) => {
    if (p.isAI) setTimeout(() => autoDeal(room, p.id), 500 + i * 300);
  });
}

function autoDeal(room, playerId) {
  if (room.phase !== "dealing") return;
  const target = room.players.find(p => p.id === playerId);
  if (!target) return;
  const _init = room.initTiles || 14;
  while (room.bag.length > 0 && (room.dealCounts[playerId] || 0) < _init) {
    room.hands[playerId].push(room.bag.shift());
    room.dealCounts[playerId] = (room.dealCounts[playerId] || 0) + 1;
  }
  broadcast(room);
  const allDealt = room.players.every(p => (room.dealCounts[p.id] || 0) >= (room.initTiles||14));
  if (allDealt) {
    setTimeout(() => startPlayingPhase(room), 800);
  }
}

/* Transición de "dealing" a "playing". En team2v2 se intercala una fase "countdown"
   (5-4-3-2-1 ¡EMPIEZA! en el cliente) antes de arrancar el timer de turno; en los
   demás modos arranca directo, sin cambiar el comportamiento existente. */
function startPlayingPhase(room) {
  if (!room.started) return;
  if (room.gameMode === "team2v2") {
    room.phase = "countdown";
    broadcast(room);
    setTimeout(() => {
      if (!room.started) return;
      room.phase = "playing";
      resetTurnTimer(room);
      room.players.forEach(p => { if (p.ws) send(p.ws, { type: "toast", msg: "¡Empieza la partida! Turno: " + room.players[0].name }); });
      broadcast(room);
      maybeAIPlay(room);
    }, 5200);
  } else {
    room.phase = "playing";
    resetTurnTimer(room);
    room.players.forEach(p => { if (p.ws) send(p.ws, { type: "toast", msg: "¡Empieza la partida! Turno: " + room.players[0].name }); });
    broadcast(room);
    maybeAIPlay(room);
  }
}

/* IA juega su turno automáticamente */
/* ================================================================
   IA MEJORADA — dificultades: easy / normal / hard / expert
   El motor (AI_CONFIG, enumerateMelds, findBestMove, findBestAttach)
   vive en burako-core.js, compartido con el cliente offline (nivel
   "Extremo" usa exactamente este mismo código).
   ================================================================ */
const AI_CONFIG = C.AI_CONFIG;
const findBestMove = C.findBestMove;
const findBestAttach = C.findBestAttach;
const planBestMove = C.planBestMove;
const findBestReorg = C.findBestReorg;

/* --- Mayora principal de AI --- */
function maybeAIPlay(room) {
  if (!room.started || room.phase !== "playing") return;
  const cur = room.players[room.currentIdx];
  if (!cur || !cur.isAI) return;

  const diff = cur.aiDifficulty || "normal";
  const cfg = AI_CONFIG[diff] || AI_CONFIG.normal;
  const delay = cfg.delay[0] + Math.random() * (cfg.delay[1] - cfg.delay[0]);

  setTimeout(() => {
    if (!room.started || room.phase !== "playing") return;
    if (room.players[room.currentIdx].id !== cur.id) return;

    let hand = room.hands[cur.id];
    // En team2v2 "salir con 30" es de equipo (equipo IA+IA incluido): si el otro bot
    // ya salió, este no necesita volver a juntar 30+ para su propia primera jugada.
    const hasLaid = teamOpened(room, cur);

    // Antes de buscar la mejor jugada, ve si conviene cambiar un comodín suelto
    // de la mesa por la ficha real que le corresponde (intercambio 1x1, siempre
    // legal, no cuesta rupturas) — solo lo hace si eso arma algo mejor.
    const plan = planBestMove(hand, hasLaid, room.table, room.scores, cur.id, cfg.depth, cfg.jokerUse);
    if (plan.swap) {
      const targetMeld = room.table.find(m => m.id === plan.swap.meld.id);
      if (targetMeld) {
        targetMeld.tiles = C.sortMeldTiles(
          targetMeld.tiles.filter(t => t.id !== plan.swap.jokerTile.id).concat([plan.swap.realTile])
        );
      }
      hand = hand.filter(t => t.id !== plan.swap.realTile.id).concat([plan.swap.jokerTile]);
      room.hands[cur.id] = hand;
    }

    // Try to play best meld
    const meld = plan.move;
    if (meld) {
      const idSet = new Set(meld.tiles.map(t => t.id));
      room.hands[cur.id] = hand.filter(t => !idSet.has(t.id));
      room.table.push({ id: C.nid("m"), tiles: C.sortMeldTiles(meld.tiles), ownerName: cur.name, ownerId: cur.id, order: ++room.meldCounter });
      markOpened(room, cur);
      room.passStreak = 0;
      room.scores[cur.id] = (room.scores[cur.id] || 0) + meld.info.value;

      if (room.hands[cur.id].length === 0) {
        room.players.forEach(p => { if (p.ws) send(p.ws, { type: "toast", msg: "¡" + cur.name + " ganó la partida! 🤖" }); });
        finishMatch(room, cur.id);
        return;
      }

      // Hard/Expert: try attach after laying
      if (cfg.depth >= 3 && Math.random() < cfg.attachProb) {
        const att = findBestAttach(room.hands[cur.id], room.table);
        if (att) {
          room.hands[cur.id] = room.hands[cur.id].filter(t => t.id !== att.tile.id);
          const targetMeld = room.table.find(m => m.id === att.meld.id);
          if (targetMeld) { targetMeld.tiles = C.sortMeldTiles([...targetMeld.tiles, att.tile]); }
          const addedVal = att.tile.joker ? 25 : att.tile.number;
          room.scores[cur.id] = (room.scores[cur.id] || 0) + addedVal;
        }
      }

      advanceTurn(room, cur.name + " 🤖 bajó un juego (" + meld.info.value + " pts).", "lay");
    } else if (hasLaid && cfg.depth >= 2) {
      // Try attach to existing meld
      const att = findBestAttach(hand, room.table);
      if (att) {
        room.hands[cur.id] = hand.filter(t => t.id !== att.tile.id);
        const targetMeld = room.table.find(m => m.id === att.meld.id);
        if (targetMeld) { targetMeld.tiles = C.sortMeldTiles([...targetMeld.tiles, att.tile]); }
        const addedVal = att.tile.joker ? 25 : att.tile.number;
        room.scores[cur.id] = (room.scores[cur.id] || 0) + addedVal;
        room.passStreak = 0;

        if (room.hands[cur.id].length === 0) {
          room.players.forEach(p => { if (p.ws) send(p.ws, { type: "toast", msg: "¡" + cur.name + " ganó la partida! 🤖" }); });
          finishMatch(room, cur.id);
          return;
        }
        advanceTurn(room, cur.name + " 🤖 pegó una ficha.", "attach");
        return;
      }
      // Reorganizar la mesa: si no hay nada para bajar ni pegar directo, un
      // jugador fuerte todavía prueba abrir un juego YA bajado (propio o
      // rival — mismo criterio que un humano) y rearmarlo junto con fichas
      // de la mano en uno o más juegos válidos, antes de simplemente robar.
      // Solo Difícil/Extremo/Claude (mismo umbral que ya usa el intento de
      // pegar) — es la búsqueda más cara del motor.
      if (cfg.depth >= 3) {
        const reorg = findBestReorg(hand, room.table, room.jokerBreaks[cur.id] || 0, cfg.jokerUse);
        if (reorg) {
          const openedMeld = room.table.find(m => m.id === reorg.meldId);
          if (openedMeld && openedMeld.tiles.some(t => t.joker)) {
            room.jokerBreaks[cur.id] = (room.jokerBreaks[cur.id] || 0) - 1;
            reportLiveAchievements(room, cur, { jokerBreakUsedNow: true });
          }
          const usedHandIds = new Set(reorg.handTiles.map(t => t.id));
          room.hands[cur.id] = hand.filter(t => !usedHandIds.has(t.id));
          room.table = room.table.filter(m => m.id !== reorg.meldId);
          reorg.newMelds.forEach(nm => {
            room.table.push({ id: C.nid("m"), tiles: C.sortMeldTiles(nm.tiles), ownerName: cur.name, ownerId: cur.id, fx: "clasico", trail: "clasica", order: ++room.meldCounter });
          });
          room.scores[cur.id] = (room.scores[cur.id] || 0) + reorg.value;
          room.passStreak = 0;

          if (room.hands[cur.id].length === 0) {
            room.players.forEach(p => { if (p.ws) send(p.ws, { type: "toast", msg: "¡" + cur.name + " ganó la partida! 🤖" }); });
            finishMatch(room, cur.id);
            return;
          }
          advanceTurn(room, cur.name + " 🤖 reorganizó la mesa" + (reorg.value > 0 ? " (+" + reorg.value + " pts)" : "") + ".", "attach");
          return;
        }
      }
      // Draw
      if (!room.bag.length) {
        room.passStreak++;
        if (room.passStreak >= room.players.length) { endGameByPoints(room); return; }
        advanceTurn(room, cur.name + " 🤖 pasa.", "pass");
      } else {
        room.hands[cur.id].push(room.bag.shift());
        advanceTurn(room, cur.name + " 🤖 tomó una ficha.", "draw");
      }
    } else {
      if (!room.bag.length) {
        room.passStreak++;
        if (room.passStreak >= room.players.length) { endGameByPoints(room); return; }
        advanceTurn(room, cur.name + " 🤖 pasa.", "pass");
      } else {
        room.hands[cur.id].push(room.bag.shift());
        advanceTurn(room, cur.name + " 🤖 tomó una ficha.", "draw");
      }
    }
    maybeAIPlay(room);
  }, delay);
}


function resetTurnTimer(room) {
  clearInterval(room.turnTimer);
  room.timeLeft = room.turnSecondsActive || TURN_SECONDS;
  const cur = room.players[room.currentIdx];
  if (cur && cur.isAI) return; // no timer para IA
  room.turnTimer = setInterval(() => {
    room.timeLeft--;
    if (room.timeLeft <= 0) {
      clearInterval(room.turnTimer);
      const cur2 = room.players[room.currentIdx];
      if (room.gameMode === "team2v2") {
        const team = cur2.team;
        returnTeamWorkToHands(room, team); // si quedó algo a mitad de armar, vuelve a las manos antes de restar la vida
        room.teamLives[team] = Math.max(0, (room.teamLives[team] ?? MAX_LIVES) - 1);
        const teammates = room.players.filter(p => p.team === team);
        if (room.teamLives[team] <= 0) {
          teammates.forEach(p => { p.eliminated = true; p.surrenderedAt = Date.now(); });
          const teamLabel = team === "blue" ? "🔵 Equipo Azul" : "🔴 Equipo Rojo";
          room.players.forEach(p => { if (p.ws) send(p.ws, { type: "toast", msg: teamLabel + " se quedó sin vidas y perdió la partida.", kind: "elim" }); });
          const winnerP = room.players.find(p => p.team !== team);
          if (winnerP) { finishMatch(room, winnerP.id, { eliminatedId: cur2.id }); return; }
        }
        advanceTurn(room, cur2.name + " no jugó a tiempo: su equipo perdió una vida (❤ " + room.teamLives[team] + ").", "life");
      } else {
        room.lives[cur2.id] = Math.max(0, (room.lives[cur2.id] ?? MAX_LIVES) - 1);
        if (room.lives[cur2.id] <= 0) {
          cur2.eliminated = true;
          cur2.surrenderedAt = Date.now();
          const remaining = room.players.filter(p => !p.eliminated);
          room.players.forEach(p => { if (p.ws) send(p.ws, { type: "toast", msg: cur2.name + " se quedó sin vidas y quedó eliminado.", kind: "elim" }); });
          if (remaining.length <= 1) {
            // solo queda uno (o ninguno): termina la partida
            const winnerP = remaining[0] || room.players.find(p => p.id !== cur2.id);
            if (winnerP) { finishMatch(room, winnerP.id, { eliminatedId: cur2.id }); return; }
          }
        }
        advanceTurn(room, cur2.name + " se quedó sin tiempo y perdió una vida (❤ " + room.lives[cur2.id] + ").", "life");
      }
    } else {
      // Aviso anticipado y claro para el equipo del jugador en turno (2v2): unos
      // segundos antes de perder la vida compartida por descoordinación, avisa a
      // AMBOS integrantes (hoy el jugador de turno ya ve su propio timer, pero su
      // compañero no tenía ninguna señal de que el reloj se está por acabar).
      if (room.gameMode === "team2v2" && room.timeLeft === 5) {
        room.players.filter(p => p.team === cur.team).forEach(p => {
          if (p.ws) send(p.ws, { type: "teamWarn", secsLeft: room.timeLeft, turnPlayerId: cur.id, turnPlayerName: cur.name });
        });
      }
      room.players.forEach((p) => { if (p.ws) send(p.ws, { type: "tick", timeLeft: room.timeLeft }); });
    }
  }, 1000);
}

/* Fase 1 — historial real de partida: matches/match_participants existían en
   el esquema desde el inicio pero nunca se escribían (0 filas siempre). Se
   crea (o reusa, cacheada en room._matchDbId) UNA fila de "matches" por
   partida real — tanto forfeitPlayer (rendición a mitad de partida, sigue
   para el resto) como finishMatch (cierre real) la comparten, así todos los
   jugadores de la MISMA partida quedan bajo el mismo matchId. También sirve
   de source_id real para el guard de idempotencia de DB.resolveMatch (antes
   solo existía _statsResolved, en memoria de este proceso — ver db.js). */
async function ensureMatchDbId(room) {
  if (room._matchDbId) return room._matchDbId;
  room._matchDbId = await DB.ensureMatchRow({ roomCode: room.code, gameMode: room.gameMode, ranked: !!room.ranked, startedAt: room.startedAt });
  return room._matchDbId;
}

/* [Fase 4B] Saca a un jugador de una sala TODAVÍA EN LOBBY (nunca de una ya
   iniciada — para eso está forfeitPlayer) y limpia la sala si queda vacía.
   Un solo lugar para "salir de lobby de verdad", usado por abandono
   explícito (leaveRoom), logout real, y el vencimiento del grace period de
   una caída transitoria (ver ws.on("close")) — antes esta lógica solo vivía
   duplicada dentro del handler de "leaveRoom". No hace su propio broadcast
   a propósito: cada caller ya sabe cuándo corresponde avisar a los demás
   (leaveRoom y el close síncrono ya tenían su propio broadcast(); el
   vencimiento del grace, al ser async/diferido, dispara el suyo aparte). */
function removeLobbyPlayer(room, player) {
  if (!room || room.started || !player) return;
  const idx = room.players.indexOf(player);
  if (idx !== -1) room.players.splice(idx, 1);
  if (room.players.length === 0) {
    clearInterval(room.turnTimer);
    rooms.delete(room.code);
  }
}

/* Rinde a un jugador (rendición explícita o desconexión en partida en curso):
   sus fichas vuelven al pozo mezcladas y la partida sigue para el resto. */
async function forfeitPlayer(room, player, opts) {
  opts = opts || {};
  if (!room || !room.started || !player) return;
  if (player.surrendered || player.eliminated) return; // ya estaba afuera
  player.surrendered = true;
  player.eliminated = true;
  player.surrenderedAt = Date.now(); // desempate cuando se rinden 2+ (ver finishMatch)

  const tilesInHand = room.hands[player.id] || [];
  room.bag.push(...tilesInHand);
  room.bag = C.shuffle(room.bag);
  room.hands[player.id] = [];

  const activeNonSurr = room.players.filter(p => !p.surrendered && !p.eliminated);
  const totalHuman = room.players.filter(p => p.username).length;
  // finishMatch() más abajo construye SU resultado a partir de room.players
  // completo (ganador + el resto), lo que incluye a este mismo jugador que se
  // rinde — si además lo resolvemos acá siempre, cobra XP/monedas/logros DOS
  // VECES por la misma partida cada vez que el fin de partida termina pasando
  // por finishMatch (que es siempre, tarde o temprano). Por eso: se resuelve
  // acá SOLO si con esta rendición la partida NO termina todavía (sigue para
  // el resto); si termina, lo resuelve finishMatch una única vez para todos.
  const endsMatchNow = activeNonSurr.length <= 1;
  if (player.username && !endsMatchNow) {
    const placeForSurr = room.players.filter(p => p.username).length; // último
    try {
      const matchId = await ensureMatchDbId(room);
      const selfUpdate = await DB.resolveMatch([{ username: player.username, place: placeForSurr, surrendered: true, jokerBreaksUsed: 3 - (room.jokerBreaks[player.id] || 0), opponentsTilesLeft: 0 }], { ranked: !!room.ranked, playersCount: totalHuman, gameMode: room.gameMode, matchId });
      player._statsResolved = true;
      const su = selfUpdate[0];
      if (matchId && su) {
        DB.recordMatchParticipants(matchId, [{ profile_id: su.profileId, place: placeForSurr, score: room.scores[player.id] || 0, surrendered: true, xp_gained: su.xpGained, coins_gained: su.coinsGained, rank_delta: su.rankDelta }]);
      }
      if (player.ws) send(player.ws, { type: "matchResult", won: false, place: placeForSurr, winnerName: null, surrendererId: player.id, iSurrendered: true, ranked: !!room.ranked, update: selfUpdate[0] || null, betResult: null });
    } catch (e) { console.error("[forfeitPlayer] DB.resolveMatch falló para", player.username, "-", e.message); }
  }

  const reasonMsg = opts.viaClose ? " cerró la partida y fue eliminado. Sus fichas volvieron al pozo." : " se rindió y fue eliminado. Sus fichas volvieron al pozo.";
  room.players.forEach(p => {
    if (!p.ws) return;
    if (p.id === player.id) send(p.ws, { type: "toast", msg: opts.viaClose ? "Te desconectaste. Perdiste la partida." : "Te rendiste. Perdés la partida.", kind: "elim" });
    else send(p.ws, { type: "toast", msg: player.name + reasonMsg, kind: "elim" });
  });

  // Si queda solo 1 jugador no-eliminado → terminar
  if (activeNonSurr.length <= 1) {
    const lastStanding = activeNonSurr[0];
    if (lastStanding) {
      room.players.forEach(p => { if (p.ws) send(p.ws, { type: "toast", msg: "¡" + lastStanding.name + " es el último en pie!" }); });
      await finishMatch(room, lastStanding.id, { surrendererId: player.id, reason: "lastStandingByForfeit" });
    }
    return;
  }

  // La partida continúa. Si era turno del que se fue, avanzar.
  if (room.players[room.currentIdx] && room.players[room.currentIdx].id === player.id) {
    advanceTurn(room, player.name + reasonMsg, "elim");
  } else {
    broadcast(room);
  }
}

/* ---------- Helpers de turno de EQUIPO (team2v2) ----------
   El turno sigue rotando por room.currentIdx (M2 ya fuerza alternancia estricta
   Azul/Rojo/Azul/Rojo), pero en team2v2 el PERMISO para actuar es del equipo
   entero, no de un jugador puntual: cualquiera de los dos integrantes puede
   jugar durante la ventana de turno de su equipo. */
/* Modo Galáctico: se gana al quedarte sin fichas NORMALES — las de habilidad que
   te queden no cuentan ni impiden ganar. */
function handIsEmptyForWin(room, playerId) {
  const hand = room.hands[playerId] || [];
  if (room.gameMode === "galactico") return C.splitHand(hand).tiles.length === 0;
  return hand.length === 0;
}
function isMyTurn(room, player) {
  const cur = room.players[room.currentIdx];
  if (!cur) return false;
  if (room.gameMode === "team2v2") return !!player.team && cur.team === player.team;
  return cur.id === player.id;
}
function teamMateOf(room, player) {
  if (!player.team) return null;
  return room.players.find(p => p.id !== player.id && p.team === player.team) || null;
}
function teamOpened(room, player) {
  if (room.gameMode !== "team2v2") return !!room.hasLaidInitial[player.id];
  const mate = teamMateOf(room, player);
  return !!room.hasLaidInitial[player.id] || (mate && !!room.hasLaidInitial[mate.id]);
}
function markOpened(room, player) {
  room.hasLaidInitial[player.id] = true;
  if (room.gameMode === "team2v2") {
    const mate = teamMateOf(room, player);
    if (mate) room.hasLaidInitial[mate.id] = true;
  }
}

function advanceTurn(room, msg, kind) {
  if (room.gameMode === "team2v2" && room.teamProposal) { room.teamProposal.blue = null; room.teamProposal.red = null; }
  const endingPlayer = room.players[room.currentIdx];
  do {
    room.currentIdx = (room.currentIdx + 1) % room.players.length;
  } while (room.players[room.currentIdx] && room.players[room.currentIdx].eliminated && room.players.some(p => !p.eliminated));
  if (room.gameMode === "galactico") {
    const newPlayer = room.players[room.currentIdx];
    // El bloqueo de habilidades dura "su próximo turno": termina cuando ese turno termina.
    if (endingPlayer) room.blockedNextTurn[endingPlayer.id] = false;
    // El escudo protege hasta que vuelva a ser el turno de quien lo activó.
    if (newPlayer) { room.shieldActive[newPlayer.id] = false; room.abilityUsedThisTurn[newPlayer.id] = false; }
  }
  resetTurnTimer(room);
  if (msg) room.players.forEach((p) => { if (p.ws) send(p.ws, { type: "toast", msg, kind: kind || "system" }); });
  broadcast(room);
  maybeAIPlay(room);
}

async function endGameByPoints(room) {
  // BUG real encontrado: acá se rankeaba por puntos a TODOS room.players sin
  // excluir a quien ya se rindió — forfeitPlayer le vacía la mano al pozo
  // (room.hands[id]=[]), así que su "puntaje" quedaba en 0, el mínimo posible,
  // y terminaba eligiéndolo ganador por tiempo/pozo agotado con 2+ jugadores
  // todavía activos en la mesa. Rendirse NUNCA puede ganar esta partida — el
  // candidato a ganador por puntos sale SOLO de quienes siguieron activos.
  const active = room.players.filter((p) => !p.surrendered && !p.eliminated);
  // Salvaguarda: si por algún motivo no quedara nadie activo (forfeitPlayer ya
  // debería haber terminado la partida antes de llegar a este estado), no
  // romper — resolver igual entre todos para no dejar la sala colgada.
  const pool = active.length ? active : room.players;
  const ranking = pool
    .map((p) => ({ id: p.id, name: p.name, points: C.handPoints(room.hands[p.id] || []) }))
    .sort((a, b) => a.points - b.points);
  room.players.forEach((p) => {
    if (p.ws) send(p.ws, { type: "toast", msg: "Pozo vacío: gana " + ranking[0].name + " por puntos." });
  });
  await finishMatch(room, ranking[0].id);
}


/* ---------- Fin de partida centralizado ---------- */
// Se llama en todos los sitios que hoy setean winnerId directamente.
// Calcula el ranking (ganador primero, resto por fichas restantes ascendente),
// llama a DB.resolveMatch (que siempre da XP + monedas + logros),
// envía matchResult a cada jugador con feedback rico.
async function finishMatch(room, winnerId, opts) {
  opts = opts || {};
  if (!winnerId) return;
  // Torre semanal (v1.3): SIEMPRE tower, sin importar qué reason haya mandado
  // el llamador (empate mano vacía, pozo agotado, rendición en cascada...) —
  // se decide acá, una sola vez, por la PRESENCIA de room.towerFloor (seteado
  // al crear la sala en towerStart), no repitiendo este chequeo en cada
  // call-site de finishMatch. Así ningún camino de victoria/derrota existente
  // necesitó tocarse para que Torre funcione con el mismo motor.
  const reason = room.towerFloor ? "tower" : (opts.reason || "normal");
  if (reason === "tower") {
    clearInterval(room.turnTimer);
    room.winnerId = winnerId;
    room.started = false;
    const winner = room.players.find(p => p.id === winnerId);
    const humanPlayer = room.players.find(p => p.username);
    // Solo entrega el premio del piso si ganó el HUMANO — perder (por juego
    // real, rendición o desconexión) es derrota sin recompensa, sin excepción.
    let towerResult = null;
    if (humanPlayer && winner && winner.id === humanPlayer.id) {
      try { towerResult = await DB.claimTowerFloor(humanPlayer.username, room.towerWeekId, room.towerFloor); }
      catch (e) { console.error("[finishMatch/tower] DB.claimTowerFloor falló -", e.message); }
      if (towerResult && towerResult.ok && towerResult.profile) send(humanPlayer.ws, { type: "profile", profile: towerResult.profile });
    }
    room.players.forEach((p) => {
      if (!p.ws) return;
      send(p.ws, {
        type: "matchResult", won: p.id === winnerId, place: p.id === winnerId ? 1 : 2,
        winnerName: winner ? winner.name : null, ranked: false, reason: "tower",
        towerFloor: room.towerFloor, towerWeekId: room.towerWeekId,
        towerResult: (p.id === (humanPlayer && humanPlayer.id)) ? towerResult : null,
        update: null, betResult: null, finalHands: [],
      });
    });
    broadcast(room);
    return;
  }
  const matchId = await ensureMatchDbId(room);
  clearInterval(room.turnTimer);
  room.winnerId = winnerId;
  room.started = false;
  const winner = room.players.find(p => p.id === winnerId);
  const others = room.players
    .filter(p => p.id !== winnerId)
    .sort((a, b) => {
      // Quien se rindió, se desconectó O quedó eliminado por vidas queda
      // último, sin importar cuántos puntos le quedaran en la mano (rendirse
      // vacía la mano al pozo — "premiaba" con buen puesto a quien abandonó;
      // quedarse eliminado por vidas NO vacía la mano, así que sin este mismo
      // criterio alguien eliminado con pocas fichas podía rankear MEJOR que
      // un jugador que siguió activo hasta el final con más fichas en mano.
      // Nunca por encima de quien siguió jugando de verdad, sea cual sea el
      // motivo por el que quedó afuera.
      const aOut = !!(a.surrendered || a.eliminated), bOut = !!(b.surrendered || b.eliminated);
      if (aOut !== bOut) return aOut ? 1 : -1;
      // Ambos afuera (2+ rendiciones/eliminaciones): desempate por orden real
      // de salida, no por la posición que tenían en room.players — quien
      // quedó afuera DESPUÉS rankea mejor que quien lo hizo antes.
      if (aOut && bOut) return (b.surrenderedAt || 0) - (a.surrenderedAt || 0);
      return C.handPoints(room.hands[a.id]||[]) - C.handPoints(room.hands[b.id]||[]);
    });
  // 2v2: el compañero del ganador nunca puede quedar ordenado peor que un rival del
  // equipo perdedor (fase 1 — repartir el premio exactamente parejo entre ambos
  // integrantes del equipo ganador queda para una fase futura, ver CHANGELOG).
  if (room.gameMode === "team2v2" && winner && winner.team) {
    const mateIdx = others.findIndex(p => p.team === winner.team);
    if (mateIdx > 0) others.unshift(others.splice(mateIdx, 1)[0]);
  }
  const ordered = [winner, ...others].filter(Boolean);

  // Modo Monedas: liquidar apuestas según el puesto, ANTES de resolveMatch para que
  // el saldo que se muestra en el resultado ya venga sumado. No es un pozo compartido
  // (no sale de lo que pierden los demás): 1° recupera su apuesta + el doble como premio
  // (x3 en total), 2° recupera su apuesta + la mitad como premio (x1.5), 3° solo recupera
  // lo apostado, 4° en adelante pierde la apuesta (ya se le había descontado al confirmarla).
  let betResults = null;
  if (room.gameMode === "monedas") {
    betResults = {};
    for (const [i, p] of ordered.entries()) {
      if (!p.username || !p.bet) continue;
      // Rendirse siempre pierde la apuesta entera, sin importar en qué índice haya
      // quedado ordenado — en partidas de 2-3 jugadores "el último" nunca llega al
      // índice 3 (el que pierde en la fórmula normal), así que sin este caso especial
      // alguien podía rendirse y recuperar igual toda su apuesta.
      const mult = (p.surrendered || p.eliminated) ? 0 : (i === 0 ? 3 : i === 1 ? 1.5 : i === 2 ? 1 : 0);
      const payout = Math.round(p.bet * mult);
      if (payout > 0) {
        try { await DB.creditCoins(p.username, payout); }
        catch (e) { console.error("[finishMatch] DB.creditCoins falló para", p.username, "-", e.message); }
      }
      betResults[p.id] = { bet: p.bet, payout, net: payout - p.bet };
    }
  }

  // build results with per-player context — se excluye a quien ya se resolvió
  // individualmente al rendirse ANTES de que esta partida terminara (ver
  // forfeitPlayer): si no, cobraría XP/monedas/logros dos veces por la misma
  // partida (una al rendirse, otra acá al construir el resultado final a
  // partir de room.players completo).
  const results = ordered
    .map((p, i) => ({
      username: p.username || null,
      place: i + 1, // índice real en `ordered` — se calcula ANTES de filtrar, para no correr los puestos
      // Antes esto solo miraba opts.surrendererId/opts.eliminatedId — el jugador
      // específico cuya salida disparó ESTA llamada a finishMatch. Si la partida
      // terminaba por otro camino (ej. alguien más ganó legítimamente mientras
      // este ya estaba afuera de antes), su propio abandono no quedaba reflejado
      // acá. Se deriva directo del estado real del jugador, no de cuál corrida
      // de finishMatch resultó ser la que cerró la partida.
      surrendered: !!(p.surrendered || p.eliminated),
      jokerBreaksUsed: 3 - (room.jokerBreaks[p.id] || 0),
      opponentsTilesLeft: (i === 0)
        ? ordered.slice(1).reduce((s, o) => s + (room.hands[o.id]||[]).length, 0)
        : 0,
      _skip: !!p._statsResolved,
    }))
    .filter(r => !r._skip)
    .map(({ _skip, ...r }) => r);

  let updates = [];
  try {
    updates = await DB.resolveMatch(results, {
      ranked: !!room.ranked,
      // Misma base que forfeitPlayer (totalHuman, arriba) — antes acá se contaba
      // room.players.length (incluye bots) y allá solo humanos, así que la misma
      // partida podía consultar una tabla RANK_DELTAS[n] distinta según por cuál
      // camino se resolviera cada jugador.
      playersCount: room.players.filter(p => p.username).length,
      // Motivo de cierre explícito (ver DB.resolveMatch): "lastStandingByForfeit"
      // cuando esta llamada viene del cascadeo de forfeitPlayer (todos los demás
      // se rindieron), "normal" en cualquier otro cierre. La recompensa por
      // rendición de cada jugador puntual sale de `results[].surrendered`, no de
      // este `reason` — el reason solo afecta al GANADOR de un cierre en cascada.
      reason,
      gameMode: room.gameMode,
      matchId,
    });
  } catch (e) {
    console.error("[finishMatch] DB.resolveMatch falló -", e.message);
  }

  // Historial real de partida (Fase 1) — un participant por jugador
  // efectivamente resuelto ACÁ (los ya resueltos antes por forfeitPlayer ya
  // escribieron el suyo, y quedaron fuera de `results`/`updates` por el
  // mismo filtro `_statsResolved` de arriba, así que no hay duplicados).
  if (matchId && updates.length) {
    const rows = updates.map((u) => {
      const rp = room.players.find((pp) => pp.username === u.username);
      const r = results.find((rr) => rr.username === u.username);
      return { profile_id: u.profileId, place: u.place, score: rp ? (room.scores[rp.id] || 0) : 0, surrendered: !!(r && r.surrendered), xp_gained: u.xpGained, coins_gained: u.coinsGained, rank_delta: u.rankDelta };
    });
    DB.recordMatchParticipants(matchId, rows);
  }

  // enviar matchResult a cada humano con SU update completo — a quien ya se
  // resolvió y notificó individualmente al rendirse (_statsResolved) no se le
  // vuelve a mandar acá, ya recibió el suyo desde forfeitPlayer.
  // Fichas restantes de TODOS al terminar — para mostrar en resultados el
  // desglose real (valor de cada ficha, no solo la cantidad). El ganador
  // normalmente queda con el atril vacío; en fin por puntos (pozo agotado
  // o tiempo) puede ganar con fichas de todos modos.
  const finalHands = ordered.map((p) => ({
    playerId: p.id,
    name: p.name,
    tiles: room.hands[p.id] || [],
    points: C.handPoints(room.hands[p.id] || []),
  }));

  ordered.forEach((p, i) => {
    if (!p.ws || p._statsResolved) return;
    const upd = updates.find(u => u.username === p.username);
    send(p.ws, {
      type: "matchResult",
      won: (i === 0),
      place: i + 1,
      winnerName: winner ? winner.name : null,
      surrendererId: opts.surrendererId || null,
      iSurrendered: opts.surrendererId === p.id,
      ranked: !!room.ranked,
      // Si tenían perfil (username), acá va el detalle de XP/monedas/logros
      update: upd || null,
      betResult: betResults ? (betResults[p.id] || null) : null,
      finalHands,
    });
  });

  broadcast(room);
}

/* ---------- validación de acciones de juego ---------- */
function handleLay(room, player, tileIds) {
  if (room.phase !== "playing") return "La partida no está en fase de juego.";
  if (!isMyTurn(room, player)) return "No es tu turno.";
  // Baja rápida (tap + "Bajar y pasar") directo desde el atril, sin pasar por la zona de
  // preparación compartida — si el equipo tenía algo a mitad de armar en team2v2, se
  // devuelve a sus dueños para no dejarlo "huérfano" al terminar el turno con otra jugada.
  if (room.gameMode === "team2v2") returnTeamWorkToHands(room, player.team);
  const hand = room.hands[player.id];
  const tiles = hand.filter((t) => tileIds.includes(t.id));
  if (tiles.length !== tileIds.length || tiles.length < 3) return "Selección inválida.";
  const info = C.meldInfo(tiles);
  if (!info.valid) return "Ese conjunto no forma un juego válido.";
  if (!teamOpened(room, player) && info.value < 30)
    return `Ese juego suma ${info.value}: para salir necesitás 30 o más.`;

  const idSet = new Set(tileIds);
  room.hands[player.id] = hand.filter((t) => !idSet.has(t.id));
  room.table.push({
    id: C.nid("m"),
    tiles: C.sortMeldTiles(tiles),
    ownerName: player.name,
    ownerId: player.id,
    fx: player.fx || "clasico",
    trail: player.trail || "clasica",
    order: ++room.meldCounter,
  });
  markOpened(room, player);
  room.passStreak = 0;
  room.scores[player.id] = (room.scores[player.id] || 0) + info.value;

  // winMode: score victory
  if ((room.config && room.config.winMode === "points") && room.scores[player.id] >= (room.config.targetScore || 200)) {
    room.players.forEach(p => { if (p.ws) send(p.ws, { type: "toast", msg: player.name + " alcanzó el puntaje objetivo. ¡Gana!" }); });
    finishMatch(room, player.id);
    return null;
  }

  // Logros en vivo: escalera, 4 colores, jugada grande
  const uniqueColors = new Set(tiles.filter(t => !t.joker).map(t => t.color)).size;
  reportLiveAchievements(room, player, {
    playedEscalera: info.type === "escalera",
    fourColors: info.type === "grupo" && uniqueColors === 4,
    meldValue: info.value,
  });

  if (handIsEmptyForWin(room, player.id)) {
    room.players.forEach((p) => { if (p.ws) send(p.ws, { type: "toast", msg: "¡" + player.name + " ganó la partida! 🎉" }); });
    finishMatch(room, player.id);
    return null;
  }
  advanceTurn(room, `${player.name} bajó un ${info.type} de ${info.value} pts.`, "lay");
  return null;
}

/* Bajar VARIOS juegos en un mismo turno (equivalente a "Preparación → Bajar todo") */
function handleLayMultiple(room, player, groups) {
  if (room.phase !== "playing") return "La partida no está en fase de juego.";
  if (!isMyTurn(room, player)) return "No es tu turno.";
  if (!Array.isArray(groups) || !groups.length) return "No armaste ningún juego.";
  const hand = room.hands[player.id];
  const handIds = new Set(hand.map((t) => t.id));
  const seen = new Set();
  const tileGroups = [];
  for (const ids of groups) {
    if (!Array.isArray(ids) || ids.length < 3) return "Hay un juego con menos de 3 fichas.";
    for (const id of ids) {
      if (!handIds.has(id) || seen.has(id)) return "Selección inválida (ficha repetida o que no es tuya).";
      seen.add(id);
    }
    const tiles = ids.map((id) => hand.find((t) => t.id === id));
    const info = C.meldInfo(tiles);
    if (!info.valid) return "Hay un juego inválido en la selección.";
    tileGroups.push({ tiles, info });
  }
  if (!teamOpened(room, player)) {
    // Regla definitiva: la salida tiene que ser UN ÚNICO juego que por sí solo valga
    // 30+ — no se permite sumar el valor de varios juegos chicos para llegar a 30,
    // aunque se puedan bajar varios juegos juntos en la misma jugada (con tal de que
    // AL MENOS UNO de ellos ya llegue a 30 por su cuenta).
    if (!tileGroups.some((g) => (g.info.value || 0) >= 30)) {
      const best = Math.max(0, ...tileGroups.map((g) => g.info.value || 0));
      return `Ningún juego llega a 30 (el mejor suma ${best}): tu primera bajada tiene que ser UN juego que por sí solo valga 30 o más.`;
    }
  }

  room.hands[player.id] = hand.filter((t) => !seen.has(t.id));
  tileGroups.forEach(({ tiles }) => {
    room.table.push({ id: C.nid("m"), tiles: C.sortMeldTiles(tiles), ownerName: player.name, ownerId: player.id, fx: player.fx || "clasico", trail: player.trail || "clasica", order: ++room.meldCounter });
  });
  markOpened(room, player);
  room.passStreak = 0;

  if (handIsEmptyForWin(room, player.id)) {
    room.players.forEach((p) => { if (p.ws) send(p.ws, { type: "toast", msg: "¡" + player.name + " ganó la partida! 🎉" }); });
    finishMatch(room, player.id);
    return null;
  }
  const totalPts = tileGroups.reduce((s, g) => s + g.info.value, 0);
  room.scores[player.id] = (room.scores[player.id] || 0) + totalPts;
  tileGroups.forEach(g => {
    const uniqC = new Set(g.tiles.filter(t=>!t.joker).map(t=>t.color)).size;
    reportLiveAchievements(room, player, { playedEscalera: g.info.type==="escalera", fourColors: g.info.type==="grupo"&&uniqC===4, meldValue: g.info.value });
  });
  advanceTurn(room, `${player.name} bajó ${tileGroups.length} juego(s) (${totalPts} pts).`, "lay");
  return null;
}


/* Reorganizar la mesa: el jugador abrió juegos, los rearmó con sus fichas y confirma */
function handleReorganize(room, player, openedMeldIds, newGroups) {
  if (room.phase !== "playing") return "La partida no está en fase de juego.";
  if (!isMyTurn(room, player)) return "No es tu turno.";
  if (!teamOpened(room, player)) return "Primero tenés que salir con 30.";
  
  // Recolectar todas las fichas involucradas: las de los melds abiertos + las del jugador usadas
  const hand = room.hands[player.id];
  const allHandIds = new Set(hand.map(t => t.id));
  
  // Fichas de los melds abiertos
  const openedTiles = [];
  const remainingTable = [];
  for (const m of room.table) {
    if (openedMeldIds.includes(m.id)) {
      if (m.tiles.some(t => t.joker)) {
        if (!room.jokerBreaks || (room.jokerBreaks[player.id] || 0) <= 0)
          return "No podés abrir un juego con comodín (sin rupturas disponibles).";
        room.jokerBreaks[player.id]--;
        reportLiveAchievements(room, player, { jokerBreakUsedNow: true });
      }
      openedTiles.push(...m.tiles);
    } else {
      remainingTable.push(m);
    }
  }
  
  // Pool: fichas de melds abiertos + fichas del jugador
  const pool = [...openedTiles, ...hand];
  const poolById = {};
  pool.forEach(t => poolById[t.id] = t);
  
  // Validar cada grupo nuevo
  const usedIds = new Set();
  const newMelds = [];
  for (const ids of newGroups) {
    if (!Array.isArray(ids) || ids.length < 3) return "Un juego tiene menos de 3 fichas.";
    const tiles = [];
    for (const id of ids) {
      if (!poolById[id]) return "Ficha no encontrada en el pool disponible.";
      if (usedIds.has(id)) return "Ficha usada dos veces.";
      usedIds.add(id);
      tiles.push(poolById[id]);
    }
    const info = C.meldInfo(tiles);
    if (!info.valid) return "Hay un juego inválido en la reorganización.";
    newMelds.push({ tiles: C.sortMeldTiles(tiles), info });
  }
  
  // Verificar que TODAS las fichas de los melds abiertos fueron reutilizadas
  for (const t of openedTiles) {
    if (!usedIds.has(t.id)) return "Hay fichas de la mesa que quedaron sin usar. Tenés que rearmar todo.";
  }
  
  // Fichas del jugador que se usaron
  const playerUsedIds = new Set();
  for (const id of usedIds) {
    if (allHandIds.has(id)) playerUsedIds.add(id);
  }
  
  // Aplicar cambios
  room.hands[player.id] = hand.filter(t => !playerUsedIds.has(t.id));
  room.table = remainingTable;
  newMelds.forEach(({ tiles }) => {
    room.table.push({ id: C.nid("m"), tiles, ownerName: player.name, ownerId: player.id, fx: player.fx || "clasico", trail: player.trail || "clasica", order: ++room.meldCounter });
  });
  room.passStreak = 0;
  
  if (handIsEmptyForWin(room, player.id)) {
    room.players.forEach((p) => { if (p.ws) send(p.ws, { type: "toast", msg: "¡" + player.name + " ganó la partida! 🎉" }); });
    finishMatch(room, player.id);
    return null;
  }
  
  let _handValue = 0;
  for (const id of playerUsedIds) {
    const t = poolById[id];
    if (t) _handValue += (t.joker ? 25 : t.number);
  }
  if (_handValue > 0) room.scores[player.id] = (room.scores[player.id] || 0) + _handValue;
  const _msg = _handValue > 0
    ? player.name + " reorganizó y agregó fichas (+" + _handValue + " pts)."
    : player.name + " reorganizó la mesa (sin sumar puntos).";
  advanceTurn(room, _msg, "attach");
  return null;
}

function handleAttach(room, player, meldId, tileIds) {
  if (room.phase !== "playing") return "La partida no está en fase de juego.";
  if (!isMyTurn(room, player)) return "No es tu turno.";
  if (!teamOpened(room, player)) return "Primero tenés que salir con 30.";
  if (room.gameMode === "team2v2") returnTeamWorkToHands(room, player.team);
  const meld = room.table.find((m) => m.id === meldId);
  if (!meld) return "Ese juego ya no está en la mesa.";
  const meldHasJoker = meld.tiles.some((t) => t.joker);
  if (meldHasJoker && (!room.jokerBreaks || (room.jokerBreaks[player.id] || 0) <= 0)) {
    return "Ese juego tiene comodín (sin rupturas disponibles).";
  }
  const hand = room.hands[player.id];
  const tiles = hand.filter((t) => tileIds.includes(t.id));
  if (tiles.length !== tileIds.length || !tiles.length) return "Selección inválida.";
  const combined = meld.tiles.concat(tiles);
  const info = C.meldInfo(combined);
  if (!info.valid) return "Esas fichas no encajan ahí.";
  // El candado se descuenta acá, recién con la jugada ya confirmada válida — antes
  // se descontaba ANTES de este chequeo y se perdía igual si la combinación
  // resultaba inválida.
  if (meldHasJoker) {
    room.jokerBreaks[player.id]--;
    reportLiveAchievements(room, player, { jokerBreakUsedNow: true });
  }

  const idSet = new Set(tileIds);
  room.hands[player.id] = hand.filter((t) => !idSet.has(t.id));
  meld.tiles = C.sortMeldTiles(combined);
  room.passStreak = 0;
  const _addedValue = tiles.reduce((s, t) => s + (t.joker ? 25 : t.number), 0);
  room.scores[player.id] = (room.scores[player.id] || 0) + _addedValue;

  if (handIsEmptyForWin(room, player.id)) {
    room.players.forEach((p) => { if (p.ws) send(p.ws, { type: "toast", msg: "¡" + player.name + " ganó la partida! 🎉" }); });
    finishMatch(room, player.id);
    return null;
  }
  advanceTurn(room, `${player.name} sumó una ficha al juego #${meld.order}.`, "attach");
  return null;
}

/* ---------- team2v2: zona de preparación COMPARTIDA en tiempo real ----------
   Cualquiera de los dos integrantes del equipo puede armar/tocar esta zona
   durante el turno de su equipo — cada ficha conserva ownerId (de qué mano
   salió) para poder devolverla si se cancela, se vence el tiempo, o alguien
   decide robar del pozo en vez de bajar algo. */
function teamWorkOf(room, player) {
  return room.teamWork && room.teamWork[player.team];
}
function returnTeamWorkToHands(room, team) {
  if (!room.teamWork || !room.teamWork[team]) return;
  const work = room.teamWork[team];
  const all = [...work.loose, ...work.groups.flatMap((g) => g.tiles)];
  all.forEach((t) => { if (t.ownerId && room.hands[t.ownerId]) room.hands[t.ownerId].push(t); });
  // Cualquier juego que el equipo haya ABIERTO de la mesa para reorganizar
  // (ver handleTeamOpenMeld) vuelve TAL CUAL estaba — con sus mismas fichas,
  // sin importar cómo las hayan movido mientras tanto — nunca fueron "de"
  // ninguna mano en particular, así que no les corresponde ninguna.
  if (work.openedMelds) Object.values(work.openedMelds).forEach((meld) => { room.table.push(meld); });
  room.teamWork[team] = { loose: [], groups: [] };
}
function handleTeamOpenMeld(room, player, meldId) {
  if (!isMyTurn(room, player)) return "No es tu turno.";
  if (!teamOpened(room, player)) return "Primero tenés que salir con 30.";
  const work = teamWorkOf(room, player);
  if (!work) return "Esta sala no es 2v2.";
  const meld = room.table.find((m) => m.id === meldId);
  if (!meld) return "Ese juego ya no está en la mesa.";
  if (meld.tiles.some((t) => t.joker)) {
    if (!room.jokerBreaks || (room.jokerBreaks[player.id] || 0) <= 0)
      return "Ese juego tiene comodín (sin rupturas disponibles).";
    room.jokerBreaks[player.id]--;
    reportLiveAchievements(room, player, { jokerBreakUsedNow: true });
  }
  if (room.teamProposal) room.teamProposal[player.team] = null;
  // Las fichas de un juego abierto quedan sin "dueño" de mano (ownerId:null) —
  // solo pueden terminar en un juego nuevo confirmado, o volver a la mesa tal
  // cual si se cancela (ver returnTeamWorkToHands/handleTeamRemoveLoose).
  meld.tiles.forEach((t) => { t.ownerId = null; });
  work.loose.push(...meld.tiles);
  room.table = room.table.filter((m) => m.id !== meldId);
  work.openedMelds = work.openedMelds || {};
  work.openedMelds[meldId] = meld;
  broadcast(room);
  return null;
}
function handleTeamAddLoose(room, player, tileIds) {
  if (room.phase !== "playing") return "La partida no está en fase de juego.";
  if (!isMyTurn(room, player)) return "No es tu turno.";
  if (room.teamProposal) room.teamProposal[player.team] = null;
  const work = teamWorkOf(room, player);
  if (!work) return "Esta sala no es 2v2.";
  const ids = Array.isArray(tileIds) ? tileIds : [];
  const hand = room.hands[player.id];
  const tiles = hand.filter((t) => ids.includes(t.id));
  if (!tiles.length) return "Selección inválida.";
  room.hands[player.id] = hand.filter((t) => !ids.includes(t.id));
  tiles.forEach((t) => { t.ownerId = player.id; work.loose.push(t); });
  broadcast(room);
  return null;
}
function handleTeamRemoveLoose(room, player, tileIds) {
  if (!isMyTurn(room, player)) return "No es tu turno.";
  if (room.teamProposal) room.teamProposal[player.team] = null;
  const work = teamWorkOf(room, player);
  if (!work) return "Esta sala no es 2v2.";
  const ids = new Set(Array.isArray(tileIds) ? tileIds : []);
  // La ficha puede estar suelta O adentro de un grupo ya armado (ej. al arrastrarla de
  // vuelta al atril) — se busca en los dos lugares y siempre vuelve a la mano de quien
  // la puso originalmente (ownerId), sea quien sea el que la saca del pool.
  // Una ficha que vino de un juego ABIERTO de la mesa (ver handleTeamOpenMeld)
  // no tiene mano propia a la que volver — solo puede volver a la mesa como
  // parte del juego original completo, vía "Cancelar" (returnTeamWorkToHands).
  // Si se permitiera sacarla suelta acá, se perdería para siempre (no iría a
  // ninguna mano ni volvería a la mesa).
  const noHomeIds = new Set(
    [...work.loose, ...work.groups.flatMap((g) => g.tiles)]
      .filter((t) => ids.has(t.id) && !t.ownerId)
      .map((t) => t.id)
  );
  if (noHomeIds.size) return "Esa ficha es de un juego que abrieron de la mesa — para deshacerlo, cancelá toda la preparación.";
  const moved = [];
  const stillLoose = [];
  work.loose.forEach((t) => { if (ids.has(t.id)) moved.push(t); else stillLoose.push(t); });
  work.loose = stillLoose;
  work.groups.forEach((g) => {
    const keep = [];
    g.tiles.forEach((t) => { if (ids.has(t.id)) moved.push(t); else keep.push(t); });
    g.tiles = keep;
  });
  work.groups = work.groups.filter((g) => g.tiles.length > 0);
  moved.forEach((t) => { if (room.hands[t.ownerId]) room.hands[t.ownerId].push(t); });
  broadcast(room);
  return null;
}
function handleTeamFormGroup(room, player, tileIds) {
  if (!isMyTurn(room, player)) return "No es tu turno.";
  if (room.teamProposal) room.teamProposal[player.team] = null;
  const work = teamWorkOf(room, player);
  if (!work) return "Esta sala no es 2v2.";
  const ids = Array.isArray(tileIds) ? tileIds : [];
  if (ids.length < 3) return "Un juego necesita al menos 3 fichas.";
  const looseIds = new Set(work.loose.map((t) => t.id));
  if (!ids.every((id) => looseIds.has(id))) return "Alguna ficha ya no está disponible.";
  const tiles = work.loose.filter((t) => ids.includes(t.id));
  work.loose = work.loose.filter((t) => !ids.includes(t.id));
  work.groups.push({ id: C.nid("g"), tiles });
  broadcast(room);
  return null;
}
function handleTeamDissolveGroup(room, player, groupId) {
  if (!isMyTurn(room, player)) return "No es tu turno.";
  if (room.teamProposal) room.teamProposal[player.team] = null;
  const work = teamWorkOf(room, player);
  if (!work) return "Esta sala no es 2v2.";
  const idx = work.groups.findIndex((g) => g.id === groupId);
  if (idx === -1) return "Ese grupo ya no existe.";
  const [g] = work.groups.splice(idx, 1);
  work.loose.push(...g.tiles);
  broadcast(room);
  return null;
}
function handleTeamAddToGroup(room, player, groupId, tileIds) {
  if (!isMyTurn(room, player)) return "No es tu turno.";
  if (room.teamProposal) room.teamProposal[player.team] = null;
  const work = teamWorkOf(room, player);
  if (!work) return "Esta sala no es 2v2.";
  const group = work.groups.find((g) => g.id === groupId);
  if (!group) return "Ese grupo ya no existe.";
  const ids = Array.isArray(tileIds) ? tileIds : [];
  const looseIds = new Set(work.loose.map((t) => t.id));
  if (!ids.length || !ids.every((id) => looseIds.has(id))) return "Alguna ficha ya no está disponible.";
  const tiles = work.loose.filter((t) => ids.includes(t.id));
  work.loose = work.loose.filter((t) => !ids.includes(t.id));
  group.tiles.push(...tiles);
  broadcast(room);
  return null;
}
function handleTeamClearWork(room, player) {
  if (!isMyTurn(room, player)) return "No es tu turno.";
  if (room.teamProposal) room.teamProposal[player.team] = null;
  returnTeamWorkToHands(room, player.team);
  broadcast(room);
  return null;
}
function handleTeamConfirm(room, player) {
  if (room.phase !== "playing") return "La partida no está en fase de juego.";
  if (!isMyTurn(room, player)) return "No es tu turno.";
  const work = teamWorkOf(room, player);
  if (!work) return "Esta sala no es 2v2.";
  if (work.loose.length) return "Hay fichas sueltas sin agrupar.";
  if (!work.groups.length) return "No armaron ningún juego.";
  const infos = work.groups.map((g) => ({ g, info: C.meldInfo(g.tiles) }));
  if (infos.some((x) => !x.info.valid)) return "Hay un juego inválido en la selección.";
  if (!teamOpened(room, player)) {
    if (!infos.some((x) => (x.info.value || 0) >= 30)) {
      const best = Math.max(0, ...infos.map((x) => x.info.value || 0));
      return `Ningún juego llega a 30 (el mejor suma ${best}): la salida tiene que ser UN juego que por sí solo valga 30 o más.`;
    }
  }
  infos.forEach(({ g, info }) => {
    room.table.push({ id: C.nid("m"), tiles: C.sortMeldTiles(g.tiles), ownerName: player.name, ownerId: player.id, fx: player.fx || "clasico", trail: player.trail || "clasica", order: ++room.meldCounter });
    g.tiles.forEach((t) => {
      const val = t.joker ? 25 : t.number;
      room.scores[t.ownerId] = (room.scores[t.ownerId] || 0) + val;
    });
  });
  const totalPts = infos.reduce((s, x) => s + x.info.value, 0);
  markOpened(room, player);
  room.passStreak = 0;
  room.teamWork[player.team] = { loose: [], groups: [] };

  const mate = teamMateOf(room, player);
  const winner = [player, mate].filter(Boolean).find((p) => (room.hands[p.id] || []).length === 0);
  if (winner) {
    const teamLabel = player.team === "blue" ? "🔵 Azul" : "🔴 Rojo";
    room.players.forEach((p) => { if (p.ws) send(p.ws, { type: "toast", msg: "¡Equipo " + teamLabel + " ganó la partida! 🎉" }); });
    finishMatch(room, winner.id);
    return null;
  }
  advanceTurn(room, `${player.name} y su equipo bajaron ${infos.length} juego(s) (${totalPts} pts).`, "lay");
  return null;
}

/* ---------- team2v2: propuesta + confirmación mutua ----------
   "Ficha y pasar" y "Bajar todo" ya no se ejecutan apenas uno de los dos toca el
   botón: quedan como una PROPUESTA pendiente hasta que el otro integrante del
   equipo la confirma (o la rechaza/cancela). Reusan handleDraw/handleTeamConfirm
   tal cual para ejecutar la acción real una vez confirmada. */
function handleTeamProposeDraw(room, player) {
  if (room.phase !== "playing") return "La partida no está en fase de juego.";
  if (!isMyTurn(room, player)) return "No es tu turno.";
  room.teamProposal[player.team] = { type: "draw", byId: player.id, byName: player.name };
  broadcast(room);
  return null;
}
function handleTeamProposeConfirm(room, player) {
  if (room.phase !== "playing") return "La partida no está en fase de juego.";
  if (!isMyTurn(room, player)) return "No es tu turno.";
  const work = teamWorkOf(room, player);
  if (!work) return "Esta sala no es 2v2.";
  if (work.loose.length) return "Hay fichas sueltas sin agrupar.";
  if (!work.groups.length) return "No armaron ningún juego.";
  room.teamProposal[player.team] = { type: "confirm", byId: player.id, byName: player.name };
  broadcast(room);
  return null;
}
function handleTeamRespond(room, player, agree) {
  if (!room.teamProposal) return;
  const proposal = room.teamProposal[player.team];
  if (!proposal) return;
  room.teamProposal[player.team] = null;
  if (!agree || player.id === proposal.byId) { broadcast(room); return; }
  const proposer = room.players.find((p) => p.id === proposal.byId);
  if (!proposer) { broadcast(room); return; }
  const err = proposal.type === "draw" ? handleDraw(room, proposer) : handleTeamConfirm(room, proposer);
  if (err) {
    room.players.forEach((p) => { if (p.ws) send(p.ws, { type: "toast", msg: "No se pudo completar la jugada propuesta: " + err, kind: "error" }); });
    broadcast(room);
  }
}

function handleDraw(room, player) {
  if (room.phase !== "playing") return "La partida no está en fase de juego.";
  if (!isMyTurn(room, player)) return "No es tu turno.";
  if (room.gameMode === "team2v2") returnTeamWorkToHands(room, player.team);
  if (!room.bag.length) {
    room.passStreak++;
    if (room.passStreak >= room.players.length) { endGameByPoints(room); return null; }
    advanceTurn(room, `${player.name} pasa (pozo vacío).`, "pass");
    return null;
  }
  // ✋ Robo doble (Modo Galáctico): la próxima vez que este jugador robe, saca 2 en vez de 1.
  const doubleDraw = room.gameMode === "galactico" && room.doubleDrawPending && room.doubleDrawPending[player.id];
  const drawCount = doubleDraw ? 2 : 1;
  for (let i = 0; i < drawCount && room.bag.length; i++) {
    room.hands[player.id].push(room.bag.shift());
  }
  if (doubleDraw) room.doubleDrawPending[player.id] = false;
  advanceTurn(room, `${player.name} tomó ${doubleDraw ? "2 fichas (✋ Robo doble)" : "una ficha"}.`, "draw");
  return null;
}

/* ============================================================
   MODO GALÁCTICO — activación de habilidades.
   Regla general (pedida explícitamente por el diseño): cada handler valida
   TODO el efecto antes de mutar nada. Si algo falla, se devuelve {ok:false,
   err}, el caller NO consume la ficha ni marca abilityUsedThisTurn — la
   habilidad queda intacta en la mano, como si nunca se hubiese intentado.
   ============================================================ */
function canActivateAbility(room, player) {
  if (room.gameMode !== "galactico") return "Esto no es una partida de Modo Galáctico.";
  if (room.phase !== "playing") return "La partida no está en fase de juego.";
  if (!isMyTurn(room, player)) return "No es tu turno.";
  if (room.blockedNextTurn && room.blockedNextTurn[player.id]) return "Tenés las habilidades bloqueadas este turno.";
  if (room.abilityUsedThisTurn && room.abilityUsedThisTurn[player.id]) return "Ya usaste una habilidad este turno.";
  return null;
}

function useEscudo(room, player) {
  room.shieldActive[player.id] = true;
  return { ok: true, msg: `🛡 ${player.name} activó Escudo.` };
}

function useRoboDoble(room, player) {
  room.doubleDrawPending[player.id] = true;
  return { ok: true, msg: `✋ ${player.name} activó Robo doble — la próxima ficha que robe del pozo va a ser doble.` };
}

function useTeletransporte(room, player, msg) {
  const hand = room.hands[player.id];
  const targetId = msg.chosenTileId;
  if (!targetId) return { ok: false, err: "Elegí una ficha para teletransportar." };
  if (targetId === msg.tileId) return { ok: false, err: "No podés teletransportar la misma ficha de habilidad que estás usando." };
  const tIdx = hand.findIndex((t) => t.id === targetId);
  if (tIdx === -1) return { ok: false, err: "Esa ficha no está en tu mano." };
  if (!room.bag.length) return { ok: false, err: "El pozo está vacío, no se puede teletransportar." };
  const [removed] = hand.splice(tIdx, 1);
  room.bag.push(removed);
  room.bag = C.shuffle(room.bag);
  hand.push(room.bag.shift());
  return { ok: true, msg: `🌀 ${player.name} usó Teletransporte.` };
}

/* Saca una ficha de una combinación de la mesa y la devuelve. Si lo que queda
   deja de ser un juego válido (o queda con menos de 3 fichas), TODA la
   combinación se rompe y sus fichas restantes vuelven a la mano de su dueño
   original — regla explícita del diseño para cualquier habilidad que toque
   la mesa (Robo, Atracción). Devuelve null si el meld/ficha no existen. */
function removeTileFromMeld(room, meldId, tileId) {
  const meldIdx = room.table.findIndex((m) => m.id === meldId);
  if (meldIdx === -1) return null;
  const meld = room.table[meldIdx];
  const tileIdx = meld.tiles.findIndex((t) => t.id === tileId);
  if (tileIdx === -1) return null;
  const removedTile = meld.tiles[tileIdx];
  const remaining = meld.tiles.filter((t) => t.id !== tileId);
  const info = remaining.length >= 3 ? C.meldInfo(remaining) : { valid: false };
  if (!info.valid) {
    room.table.splice(meldIdx, 1);
    const ownerHand = room.hands[meld.ownerId];
    if (ownerHand) remaining.forEach((t) => ownerHand.push(t));
    return { removedTile, broke: true, ownerId: meld.ownerId, ownerName: meld.ownerName };
  }
  meld.tiles = C.sortMeldTiles(remaining);
  return { removedTile, broke: false, ownerId: meld.ownerId, ownerName: meld.ownerName };
}

function useRobo(room, player, msg) {
  const meld = room.table.find((m) => m.id === msg.meldId);
  if (!meld) return { ok: false, err: "Esa combinación ya no existe." };
  if (meld.ownerId === player.id) return { ok: false, err: "No podés robar de tu propia combinación." };
  if (room.shieldActive && room.shieldActive[meld.ownerId]) return { ok: false, err: `${meld.ownerName} tiene Escudo activo.` };
  if (!meld.tiles.some((t) => t.id === msg.targetTileId)) return { ok: false, err: "Esa ficha no está en esa combinación." };
  const res = removeTileFromMeld(room, msg.meldId, msg.targetTileId);
  if (!res) return { ok: false, err: "Esa combinación o ficha ya no existe." };
  room.hands[player.id].push(res.removedTile);
  return { ok: true, msg: `🦹 ${player.name} le robó una ficha de la mesa a ${res.ownerName}.${res.broke ? " La combinación se rompió y el resto volvió a su mano." : ""}` };
}

function useIntercambio(room, player, msg) {
  const target = room.players.find((p) => p.id === msg.targetPlayerId);
  if (!target) return { ok: false, err: "Ese jugador no existe." };
  if (target.id === player.id) return { ok: false, err: "No podés intercambiar con vos mismo." };
  if (room.shieldActive && room.shieldActive[target.id]) return { ok: false, err: `${target.name} tiene Escudo activo.` };
  const myHand = room.hands[player.id];
  const myIdx = myHand.findIndex((t) => t.id === msg.offerTileId);
  if (myIdx === -1) return { ok: false, err: "Esa ficha no está en tu mano." };
  const targetHand = room.hands[target.id];
  if (!targetHand || !targetHand.length) return { ok: false, err: `${target.name} no tiene fichas para intercambiar.` };
  const randIdx = Math.floor(Math.random() * targetHand.length);
  const myTile = myHand[myIdx], theirTile = targetHand[randIdx];
  myHand[myIdx] = theirTile;
  targetHand[randIdx] = myTile;
  return { ok: true, msg: `🔄 ${player.name} intercambió una ficha con ${target.name}.` };
}

function useBloqueo(room, player, msg) {
  const target = room.players.find((p) => p.id === msg.targetPlayerId);
  if (!target) return { ok: false, err: "Ese jugador no existe." };
  if (target.id === player.id) return { ok: false, err: "No podés bloquearte a vos mismo." };
  if (room.shieldActive && room.shieldActive[target.id]) return { ok: false, err: `${target.name} tiene Escudo activo.` };
  room.blockedNextTurn[target.id] = true;
  return { ok: true, msg: `🚫 ${player.name} bloqueó las habilidades de ${target.name} para su próximo turno.` };
}

/* 🎯 Robo dirigido: a diferencia de Robo (que apunta a una ficha visible en una
   combinación de la mesa), esta apunta a una ficha específica DENTRO DE LA MANO
   de un rival — por eso necesita el protocolo de 2 pasos: primero "requestAbilityInfo"
   revela esa mano (privado, solo al que preguntó) para que pueda elegir con qué
   `chosenTileId` cerrar el useAbility. */
function useRoboDirigido(room, player, msg) {
  const target = room.players.find((p) => p.id === msg.targetPlayerId);
  if (!target) return { ok: false, err: "Ese jugador no existe." };
  if (target.id === player.id) return { ok: false, err: "Elegí a un rival." };
  if (room.shieldActive && room.shieldActive[target.id]) return { ok: false, err: `${target.name} tiene Escudo activo.` };
  const targetHand = room.hands[target.id] || [];
  const idx = targetHand.findIndex((t) => t.id === msg.chosenTileId);
  if (idx === -1) return { ok: false, err: "Esa ficha ya no está en la mano de ese jugador." };
  const [tile] = targetHand.splice(idx, 1);
  room.hands[player.id].push(tile);
  return { ok: true, msg: `🎯 ${player.name} le robó una ficha específica a ${target.name}.` };
}

/* 👁 Visión: a diferencia de Robo dirigido, acá no hay elección posterior — revelar
   3 fichas al azar de la mano rival ES el efecto completo, así que alcanza con un
   solo mensaje. El resultado privado (qué fichas son) viaja en result.private y el
   caller lo manda SOLO al que activó la habilidad, nunca al resto de la sala. */
function useVision(room, player, msg) {
  const target = room.players.find((p) => p.id === msg.targetPlayerId);
  if (!target) return { ok: false, err: "Ese jugador no existe." };
  if (target.id === player.id) return { ok: false, err: "Elegí a un rival." };
  if (room.shieldActive && room.shieldActive[target.id]) return { ok: false, err: `${target.name} tiene Escudo activo.` };
  const targetHand = room.hands[target.id] || [];
  if (!targetHand.length) return { ok: false, err: `${target.name} no tiene fichas.` };
  const revealed = C.shuffle(targetHand).slice(0, Math.min(3, targetHand.length));
  return {
    ok: true,
    msg: `👁 ${player.name} espió la mano de ${target.name}.`,
    private: { type: "abilityInfo", ability: "vision", targetPlayerId: target.id, targetName: target.name, tiles: revealed },
  };
}

/* 🃏 Comodín: convierte una ficha NORMAL de tu propia mano en comodín permanente
   (interpretación elegida para no necesitar un sistema de "temporalidad" aparte —
   el comodín resultante es indistinguible de uno del mazo). Sin objetivo rival,
   no aplica chequeo de Escudo. */
function useComodin(room, player, msg) {
  const hand = room.hands[player.id];
  const idx = hand.findIndex((t) => t.id === msg.chosenTileId);
  if (idx === -1) return { ok: false, err: "Esa ficha no está en tu mano." };
  const tile = hand[idx];
  if (tile.ability) return { ok: false, err: "Elegí una ficha normal, no una de habilidad." };
  if (tile.joker) return { ok: false, err: "Esa ficha ya es un comodín." };
  hand[idx] = { id: tile.id, color: "comodin", number: null, joker: true };
  return { ok: true, msg: `🃏 ${player.name} convirtió una ficha en comodín.` };
}

/* 🧲 Atracción: mueve una ficha visible de una combinación rival — se valida con
   meldInfo ANTES de tocar nada; si no entra, la habilidad no se puede usar. Dos
   destinos posibles:
   1) msg.destMeldId — una combinación PROPIA ya en la mesa (se le agrega la ficha).
   2) msg.handTileIds — fichas TUYAS EN LA MANO que, junto con la atraída, arman
      una combinación nueva (ej. tenés 5 y 7 rojo en la mano, atraés el 6 rojo de
      la mesa: se arma 5-6-7 rojo y se baja como combinación nueva). */
function useAtraccion(room, player, msg) {
  const srcMeld = room.table.find((m) => m.id === msg.sourceMeldId);
  if (!srcMeld) return { ok: false, err: "Esa combinación de origen ya no existe." };
  if (srcMeld.ownerId === player.id) return { ok: false, err: "Elegí una combinación de un rival como origen." };
  if (room.shieldActive && room.shieldActive[srcMeld.ownerId]) return { ok: false, err: `${srcMeld.ownerName} tiene Escudo activo.` };
  const srcTile = srcMeld.tiles.find((t) => t.id === msg.sourceTileId);
  if (!srcTile) return { ok: false, err: "Esa ficha no está en esa combinación." };

  if (msg.destMeldId) {
    const destMeld = room.table.find((m) => m.id === msg.destMeldId);
    if (!destMeld) return { ok: false, err: "Esa combinación de destino ya no existe." };
    if (destMeld.ownerId !== player.id) return { ok: false, err: "Elegí una combinación TUYA como destino." };
    if (destMeld.id === srcMeld.id) return { ok: false, err: "El origen y el destino no pueden ser la misma combinación." };
    // Insertar una ficha en una combinación propia que YA tiene comodín consume un
    // candado, igual que handleAttach — antes esta rama de Atracción era una vía
    // gratis para esquivar esa regla.
    const destHasJoker = destMeld.tiles.some((t) => t.joker);
    if (destHasJoker && (!room.jokerBreaks || (room.jokerBreaks[player.id] || 0) <= 0)) {
      return { ok: false, err: "Esa combinación tiene comodín (sin rupturas disponibles)." };
    }
    const extended = [...destMeld.tiles, srcTile];
    const info = C.meldInfo(extended);
    if (!info.valid) return { ok: false, err: "Esa ficha no se puede colocar de forma legal en esa combinación." };
    const res = removeTileFromMeld(room, msg.sourceMeldId, msg.sourceTileId);
    if (!res) return { ok: false, err: "Esa combinación o ficha ya no existe." };
    destMeld.tiles = C.sortMeldTiles(extended);
    // El candado se descuenta recién acá, con la jugada ya confirmada válida — no
    // se pierde si algo de arriba hubiera rechazado la combinación.
    if (destHasJoker) {
      room.jokerBreaks[player.id]--;
      reportLiveAchievements(room, player, { jokerBreakUsedNow: true });
    }
    return { ok: true, msg: `🧲 ${player.name} usó Atracción sobre una ficha de ${res.ownerName}.${res.broke ? " La combinación de origen se rompió y el resto volvió a su mano." : ""}` };
  }

  if (Array.isArray(msg.handTileIds) && msg.handTileIds.length) {
    const hand = room.hands[player.id] || [];
    const handTiles = [];
    for (const id of msg.handTileIds) {
      const t = hand.find((x) => x.id === id);
      if (!t) return { ok: false, err: "Una de las fichas elegidas ya no está en tu mano." };
      if (t.ability) return { ok: false, err: "No podés usar una ficha de habilidad para armar la combinación." };
      handTiles.push(t);
    }
    const combined = [...handTiles, srcTile];
    const info = C.meldInfo(combined);
    if (!info.valid) return { ok: false, err: "Esas fichas más la atraída no forman una combinación válida." };
    if (!teamOpened(room, player) && info.value < 30) return { ok: false, err: `Ese juego suma ${info.value}: para salir necesitás 30 o más.` };
    const res = removeTileFromMeld(room, msg.sourceMeldId, msg.sourceTileId);
    if (!res) return { ok: false, err: "Esa combinación o ficha ya no existe." };
    const idSet = new Set(msg.handTileIds);
    room.hands[player.id] = hand.filter((t) => !idSet.has(t.id));
    room.table.push({ id: C.nid("m"), tiles: C.sortMeldTiles(combined), ownerName: player.name, ownerId: player.id, fx: player.fx || "clasico", trail: player.trail || "clasica", order: ++room.meldCounter });
    markOpened(room, player);
    return { ok: true, msg: `🧲 ${player.name} usó Atracción y armó una combinación nueva con una ficha de ${res.ownerName}.${res.broke ? " La combinación de origen se rompió y el resto volvió a su mano." : ""}`, checkWin: true };
  }

  return { ok: false, err: "Elegí una combinación tuya en la mesa o fichas de tu mano como destino." };
}

/* ---------- Matchmaking automático (Casual/Ranked) ----------
   Colas en memoria — separado del roomSweepTimer de arriba (ese es
   limpieza de salas abandonadas, esto es emparejamiento). Un intervalo
   propio intenta armar mesas de 4 cada MATCHMAKING_TICK_MS. Si no junta 4
   jugadores reales a tiempo, rellena el resto con bots — misma política
   que ya usan las salas ranked armadas a mano (un bot no tiene username,
   así que resolveMatch/checkAchievements ya lo ignoran para todo lo que
   puntúa: solo ocupa asiento, no rompe nada). */
// v1.3: Casual se separó en dos colas con objetivo propio — antes había una
// sola cola "casual" de 2-4 (FIFO). "Duelo rápido" siempre arranca en 2 en
// cuanto hay pareja; "Mesa abierta" acumula 2-8 (reusa el mazo doble que
// startGame() ya aplica solo con room.players.length>4). Ranked no cambió:
// sigue 2-4 con ventana de MMR progresiva, cola separada de las de Casual.
const matchQueues = { casualQuick2: [], casualOpen: [], ranked: [] };
const MATCHMAKING_TICK_MS = Number(process.env.MATCHMAKING_TICK_MS) || 2000;
// Techo real por cola (nunca se rellena de más con bots — mínimo real es 2,
// ver formMatchmakingRoom: solo agrega 1 IA cuando queda exactamente 1 humano).
const QUEUE_TARGET_SIZE = { casualQuick2: 2, casualOpen: 8, ranked: 4 };
const MATCH_WAIT_TIMEOUT_MS = Number(process.env.MATCH_WAIT_TIMEOUT_MS) || 30000;
// Ranked: ventana de MMR que se agranda con el tiempo esperado por el más
// antiguo de la cola (el "ancla") — arranca angosta (parejas de nivel
// similar) y se va abriendo hasta cubrir prácticamente cualquiera para
// cuando se cumple el timeout. Una sola cola (sin sub-colas por bracket).
const RANKED_RANGE_BASE = Number(process.env.RANKED_RANGE_BASE) || 100;
const RANKED_RANGE_GROWTH_PER_SEC = Number(process.env.RANKED_RANGE_GROWTH_PER_SEC) || 40;

function removeFromMatchQueues(ws) {
  for (const mode of Object.keys(matchQueues)) {
    const idx = matchQueues[mode].findIndex((q) => q.ws === ws);
    if (idx !== -1) matchQueues[mode].splice(idx, 1);
  }
}

function makeMatchmakingBot(usedNames) {
  // Dificultad al azar entre las "de relleno" — expert/claude quedan afuera
  // a propósito, son niveles que alguien elige, no un default de cola.
  const pool = ["easy", "normal", "hard"];
  const diff = pool[Math.floor(Math.random() * pool.length)];
  const aiAvatars = { easy: "🤖", normal: "👾", hard: "💀" };
  const aiNames = { easy: ["Bot Fácil", "Bot Blanda", "Bot Novato"], normal: ["Bot Alpha", "Bot Beta", "Bot Gamma"], hard: ["Bot Dura", "Bot Cruel", "Bot Salvaje"] };
  const pickedName = (aiNames[diff] || aiNames.normal).find((n) => !usedNames.includes(n)) || "Bot " + (usedNames.length + 1);
  return { id: C.nid("ai"), ws: null, name: pickedName, connected: true, isAI: true, ready: true, username: null, aiDifficulty: diff, avatar: aiAvatars[diff] || "🤖", skin: "clasica" };
}

/* Arma y arranca una sala a partir de un grupo de entradas de cola — MISMO
   shape de room y MISMA secuencia que join:"NUEVA" + start (server.js más
   abajo): matchmaking no reinventa un segundo pipeline de sorteo/reparto,
   arma la sala con esa forma exacta y llama al mismo startGame() de siempre.
   Composición: mínimo 2, máximo 4 — nunca se rellena con bots hasta 4. Si
   al momento de armar el grupo quedó UN SOLO humano (nadie más entró a
   tiempo), se le agrega exactamente 1 bot (arranca 1v1 contra IA). Con 2, 3
   o 4 humanos reales, arranca así, sin agregar ningún bot — la IA es
   solamente el fallback para que una persona sola no espere para siempre. */
async function formMatchmakingRoom(entries, mode) {
  const ranked = mode === "ranked";
  const roomNames = { casualQuick2: "Duelo rápido automático", casualOpen: "Mesa abierta automática", ranked: "Ranked automático" };
  const room = {
    code: makeRoomCode(), name: roomNames[mode] || "Casual automático",
    public: false, players: [], started: false, table: [], bag: [], hands: {},
    hasLaidInitial: {}, currentIdx: 0, meldCounter: 0, passStreak: 0,
    ranked, gameMode: ranked ? "ranked" : "casual", chatLog: [],
  };
  rooms.set(room.code, room);

  for (const entry of entries) {
    const player = {
      id: C.nid("p"), ws: entry.ws, name: entry.name, connected: true,
      username: entry.username, skin: entry.skin || "clasica", nameeffect: entry.nameeffect || null,
      banner: entry.banner || null, team: null, ready: true,
      avatar: entry.avatar, rankPts: entry.rankPts, level: entry.level,
      fx: entry.fx || "clasico", trail: entry.trail || "clasica",
    };
    room.players.push(player);
    // Bug real (encontrado en prueba manual): sin esto, la conexión emparejada
    // recibía "joined" y veía la sala, pero room/player de ESA conexión (las
    // variables de closure que usa cada handler de juego) nunca quedaban
    // seteadas — formMatchmakingRoom corre desde el timer global, no desde el
    // handler de mensajes de esa conexión. Resultado: sorteo/reparto/draw/lay
    // pisaban el guard `if (!room || !player) return` de cada handler y no
    // hacían nada, en silencio. Ver el setter `ws._applyRoomPlayer` (armado
    // por conexión en wss.on("connection")).
    if (entry.ws._applyRoomPlayer) entry.ws._applyRoomPlayer(room, player);
    send(entry.ws, { type: "queueMatched", humanCount: entries.length, mode });
    send(entry.ws, { type: "joined", code: room.code, playerId: player.id });
    sendChatHistory(entry.ws, room);
  }
  if (room.players.length === 1) {
    const bot = makeMatchmakingBot(room.players.map((p) => p.name));
    room.players.push(bot);
  }
  broadcast(room);
  // Mismo pipeline que la sala manual (join → ready → start): entrar a la
  // cola YA es "estoy listo", así que se salta directo a startGame(), pero
  // es EL MISMO startGame() que usa el flujo manual, no una copia.
  startGame(room);
}

function tryMatchQueue(mode) {
  const queue = matchQueues[mode];
  if (!queue.length) return;
  for (let i = queue.length - 1; i >= 0; i--) { // conexiones muertas antes de armar nada
    if (queue[i].ws.readyState !== 1) queue.splice(i, 1);
  }
  if (!queue.length) return;

  const target = QUEUE_TARGET_SIZE[mode];
  const oldestWaitMs = Date.now() - queue[0].joinedAt;
  const timedOut = oldestWaitMs >= MATCH_WAIT_TIMEOUT_MS;
  const sendWaitingStatus = () => queue.forEach((q) => send(q.ws, {
    type: "queueStatus", mode,
    waitingSeconds: Math.floor((Date.now() - q.joinedAt) / 1000),
    queueSize: Math.min(queue.length, target),
    targetSize: target,
    maxWaitSeconds: Math.max(0, Math.ceil((MATCH_WAIT_TIMEOUT_MS - (Date.now() - q.joinedAt)) / 1000)),
  }));

  let group;
  if (mode === "ranked") {
    const anchor = queue[0];
    const allowedRange = timedOut ? Infinity : RANKED_RANGE_BASE + RANKED_RANGE_GROWTH_PER_SEC * (oldestWaitMs / 1000);
    const within = queue.slice(1)
      .filter((q) => Math.abs((q.rankPts || 1000) - (anchor.rankPts || 1000)) <= allowedRange)
      .sort((a, b) => Math.abs((a.rankPts || 1000) - (anchor.rankPts || 1000)) - Math.abs((b.rankPts || 1000) - (anchor.rankPts || 1000)));
    const candidate = [anchor, ...within].slice(0, target);
    if (candidate.length >= target || timedOut) group = candidate;
    else { sendWaitingStatus(); return; }
  } else {
    // Casual (Duelo rápido de 2 o Mesa abierta de 2-8): FIFO puro, sin rango.
    if (queue.length >= target) group = queue.slice(0, target);
    else if (timedOut) group = queue.slice(0, queue.length);
    else { sendWaitingStatus(); return; }
  }
  if (!group.length) return;
  for (const g of group) { const idx = queue.indexOf(g); if (idx !== -1) queue.splice(idx, 1); }
  formMatchmakingRoom(group, mode).catch((e) => console.error("[matchmaking] formMatchmakingRoom falló -", e.message));
}

const matchmakingTimer = setInterval(() => { tryMatchQueue("casualQuick2"); tryMatchQueue("casualOpen"); tryMatchQueue("ranked"); }, MATCHMAKING_TICK_MS);
wss.on("close", () => clearInterval(matchmakingTimer));

// [Fase 4A — docs/ai/AUDIT-SESSION-ARCHITECTURE.md hallazgo #2/#5, confirmado
// en vivo en la Fase 0] Serializa el procesamiento de mensajes de UN MISMO
// socket, en el orden en que llegaron. Antes, ws.on("message", async ...)
// no serializaba nada por sí solo: Node arranca un handler async nuevo por
// cada frame que llega, así que si el primero estaba a mitad de un await
// (p. ej. resumeSession esperando la respuesta de Supabase), un segundo
// mensaje que llegara mientras tanto se evaluaba con authUser TODAVÍA null,
// antes de que el primero terminara de autenticar. Con esta cola, el
// mensaje N+1 de ESE socket no arranca hasta que el N termine (éxito o
// error) — la serialización es POR SOCKET (cada conexión tiene la suya, ver
// más abajo), así que un socket lento nunca bloquea a otros usuarios.
// makeSerialQueue vive en su propio módulo (serial-queue.js) para poder
// probarla en aislamiento (server/scripts/test-message-serialization.mjs).
const { makeSerialQueue } = require("./serial-queue.js");

/* ---------- conexiones WebSocket ---------- */
wss.on("connection", (ws) => {
  let room = null, player = null;
  // Bug real (matchmaking): room/player son variables de closure de ESTA
  // conexión, seteadas normalmente adentro del handler de "join" de ESTA
  // MISMA conexión. formMatchmakingRoom corre desde el timer global de
  // matchmaking — un contexto de ejecución totalmente distinto, sin acceso
  // a estos bindings — así que un jugador emparejado nunca tenía room/player
  // seteados: recibía "joined" y veía la sala, pero cualquier acción de
  // juego (reveal, draw, lay...) pisaba el guard `if (!room || !player)
  // return` de cada handler y no hacía nada, en silencio. Este setter,
  // colgado del ws, es el único punto de entrada que le permite a código
  // EXTERNO a este closure (formMatchmakingRoom) actualizar el room/player
  // reales de esta conexión.
  ws._applyRoomPlayer = (r, p) => { room = r; player = p; };

  let authUser = null; // username del jugador autenticado en este WS
  // [Fase 4B] Distingue, en ws.on("close"), un logout REAL de una caída de
  // red transitoria — ambas cierran el socket, pero solo el logout debe
  // liberar el asiento de lobby al instante (ver el handler de "logout" más
  // abajo, que la prende, y ws.on("close")).
  let explicitLogout = false;

  // [Fase 4A] Cola de serialización propia de ESTA conexión — ver
  // makeSerialQueue() más arriba. El listener real queda sin "async" a
  // propósito: solo encola, nunca procesa nada directamente, así que Node
  // no puede arrancar un segundo handler para este socket mientras el
  // anterior sigue en un await. El cuerpo de abajo es EXACTAMENTE el mismo
  // de antes (mismo protocolo, mismas respuestas) — no se reindentó a
  // propósito, para que el diff de esta fase se pueda revisar línea por
  // línea sin ruido de espacios.
  const enqueueMessage = makeSerialQueue();
  ws.on("message", (raw) => { enqueueMessage(async () => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    // Keepalive a nivel app: el cliente (sobre todo en móvil) manda esto cada
    // ~20s para mantener viva la conexión del lado del cliente (mapeo NAT) y
    // detectar rápido si el servidor dejó de responder. Se contesta y listo.
    if (msg.type === "ping") { ws.isAlive = true; send(ws, { type: "pong" }); return; }

    if (msg.type === "register") {
      const r = await DB.register(msg.username, msg.password);
      if (r.ok) { authUser = msg.username.trim(); send(ws, { type: "authOk", profile: r.profile, session: r.session || null, welcomeBonus: r.welcomeBonus || null }); }
      else send(ws, { type: "error", msg: r.error });
      return;
    }
    if (msg.type === "login") {
      const r = await DB.login(msg.username, msg.password);
      if (r.ok) { authUser = msg.username.trim(); send(ws, { type: "authOk", profile: r.profile, session: r.session || null, welcomeBonus: r.welcomeBonus || null, alert: r.alert || null }); }
      else send(ws, { type: "error", msg: r.error });
      return;
    }
    if (msg.type === "resumeSession") {
      // Restaura identidad a partir del refresh token guardado por el
      // cliente (ver client/burako.js) en vez de reenviar la contraseña.
      // authUser sale del usuario verificado por Supabase, nunca de lo que
      // mande el cliente acá (no hay username en este mensaje).
      const r = await DB.resumeSession(msg.refreshToken);
      if (r.ok) { authUser = r.username; send(ws, { type: "authOk", profile: r.profile, session: r.session, resumed: true }); }
      // [Fase 5] Solo un "expired" de verdad (token inválido/ya usado) manda
      // sessionExpired — un fallo transitorio (rate-limit, red) no debe
      // desloguear a nadie; ver DB.resumeSession, que ya distingue los dos casos.
      else if (r.error === "transient") send(ws, { type: "error", msg: "No se pudo confirmar la sesión por un problema transitorio. Reintentando…" });
      else send(ws, { type: "sessionExpired" });
      return;
    }
    if (msg.type === "logout") {
      explicitLogout = true; // [Fase 4B] el close que sigue a esto debe liberar el asiento de lobby al instante, no reservarlo
      await DB.invalidateSession(msg.refreshToken);
      authUser = null;
      send(ws, { type: "loggedOut" });
      return;
    }
    if (msg.type === "leaderboard") {
      send(ws, { type: "leaderboard", data: await DB.leaderboard(20) });
      return;
    }
    if (msg.type === "listRooms") {
      const list = Array.from(rooms.values())
        .filter(r => r.public && !r.started)
        .map(r => ({
          code: r.code, name: r.name || r.code, gameMode: r.gameMode || "casual",
          adminName: (r.players[0] && r.players[0].name) || "?",
          playerCount: r.players.length, maxPlayers: MAX_PLAYERS,
        }));
      send(ws, { type: "roomList", rooms: list });
      return;
    }
    if (msg.type === "queueJoin") {
      if (!authUser) return send(ws, { type: "error", msg: "No estás logueado." });
      if (room) return send(ws, { type: "error", msg: "Salí de la sala actual antes de buscar partida." });
      // "casual" es el nombre viejo (clientes 1.2.5 ya instalados, antes de
      // separar Casual en dos colas) — se mapea a Mesa abierta, el equivalente
      // más cercano al Casual 2-4 original. No romper a esos clientes.
      const mode = msg.mode === "ranked" ? "ranked" : msg.mode === "casualQuick2" ? "casualQuick2" : "casualOpen";
      removeFromMatchQueues(ws); // por si ya estaba en otra cola
      const name = (msg.name || "Jugador").slice(0, 16);
      const prof = await DB.getProfileByName(authUser);
      const entry = {
        ws, name, username: authUser, skin: msg.skin || "clasica", joinedAt: Date.now(),
        avatar: prof ? prof.avatar : undefined, rankPts: prof ? prof.rankPts : undefined, level: prof ? prof.level : undefined,
        fx: prof && prof.active ? (prof.active.effect || "clasico") : "clasico",
        trail: prof && prof.active ? (prof.active.trail || "clasica") : "clasica",
        nameeffect: prof && prof.active ? prof.active.nameeffect || null : null,
        banner: prof && prof.active ? prof.active.banner || null : null,
      };
      matchQueues[mode].push(entry);
      send(ws, { type: "queueStatus", mode, waitingSeconds: 0, queueSize: matchQueues[mode].length });
      return;
    }
    if (msg.type === "queueLeave") {
      removeFromMatchQueues(ws);
      send(ws, { type: "queueLeft" });
      return;
    }
    if (msg.type === "buyItem") {
      if (!authUser) return send(ws, { type: "error", msg: "No estás logueado." });
      const kind = msg.kind; // 'skin' | 'tapete' | 'effect'
      const id = msg.id;
      const r = await DB.buyItem(authUser, kind, id);
      if (r.ok) {
        send(ws, { type: "profile", profile: r.profile });
        if (r.newAchievements && r.newAchievements.length) send(ws, { type: "achievementsUnlocked", achievements: r.newAchievements });
      } else send(ws, { type: "error", msg: r.error });
      return;
    }
    if (msg.type === "setActive") {
      if (!authUser) return send(ws, { type: "error", msg: "No estás logueado." });
      const r = await DB.setActive(authUser, msg.kind, msg.id);
      if (r.ok) {
        if (player && msg.kind === "effect") player.fx = msg.id || "clasico";
        if (player && msg.kind === "trail") player.trail = msg.id || "clasica";
        send(ws, { type: "profile", profile: r.profile });
      }
      else send(ws, { type: "error", msg: r.error });
      return;
    }
    if (msg.type === "setAvatar") {
      if (!authUser) return send(ws, { type: "error", msg: "No estás logueado." });
      const r = await DB.setAvatar(authUser, msg.avatar);
      if (r.ok) send(ws, { type: "profile", profile: r.profile });
      else send(ws, { type: "error", msg: r.error });
      return;
    }
    if (msg.type === "claimPass") {
      if (!authUser) return send(ws, { type: "error", msg: "No estás logueado." });
      const r = await DB.claimPass(authUser, msg.level);
      if (r.ok) send(ws, { type: "profile", profile: r.profile });
      else send(ws, { type: "error", msg: r.error });
      return;
    }
    if (msg.type === "claimGalacticoPass") {
      if (!authUser) return send(ws, { type: "error", msg: "No estás logueado." });
      const r = await DB.claimGalacticoPass(authUser, msg.level);
      if (r.ok) send(ws, { type: "profile", profile: r.profile });
      else send(ws, { type: "error", msg: r.error });
      return;
    }
    if (msg.type === "catalog") {
      send(ws, { type: "catalog", catalog: DB.CATALOG, achievements: DB.ACHIEVEMENTS.map(a => ({ id: a.id, name: a.name, desc: a.desc, coinReward: a.coinReward, xpReward: a.xpReward })) });
      return;
    }
        if (msg.type === "myProfile") {
      if (!authUser) return send(ws, { type: "error", msg: "No estás logueado." });
      const p = await DB.getProfileByName(authUser);
      if (p) send(ws, { type: "profile", profile: p });
      return;
    }
    // Ruleta diaria (v1.3) — DB.dailyStatus/claimDailyReward hacen todo el trabajo
    // (fecha de Uruguay, racha, azar server-side, idempotencia vía reward_grants).
    if (msg.type === "dailyStatus") {
      if (!authUser) return send(ws, { type: "error", msg: "No estás logueado." });
      const r = await DB.dailyStatus(authUser);
      if (!r.ok) return send(ws, { type: "error", msg: r.error || "No se pudo consultar la ruleta." });
      send(ws, { type: "dailyStatus", claimedToday: r.claimedToday, streakDay: r.streakDay, msUntilNext: r.msUntilNext });
      return;
    }
    if (msg.type === "dailySpin") {
      if (!authUser) return send(ws, { type: "error", msg: "No estás logueado." });
      const r = await DB.claimDailyReward(authUser);
      if (!r.ok) return send(ws, { type: "dailyResult", ok: false, alreadyClaimed: !!r.alreadyClaimed, msUntilNext: r.msUntilNext || null, msg: r.error || "No se pudo reclamar la ruleta." });
      send(ws, { type: "dailyResult", ok: true, streakDay: r.streakDay, coins: r.coins, msUntilNext: r.msUntilNext });
      if (r.profile) send(ws, { type: "profile", profile: r.profile });
      return;
    }
    // Torre semanal (v1.3) — DB.towerStatus/claimTowerFloor hacen todo el
    // trabajo real (semana de Uruguay, piso actual, idempotencia). Acá solo
    // arma la sala 1 humano + 1 IA reusando EXACTAMENTE el mismo pipeline que
    // matchmaking/salas manuales (ws._applyRoomPlayer + startGame()) — no hay
    // un segundo motor de Burako para Torre.
    if (msg.type === "towerStatus") {
      if (!authUser) return send(ws, { type: "error", msg: "No estás logueado." });
      const r = await DB.towerStatus(authUser);
      if (!r.ok) return send(ws, { type: "error", msg: r.error || "No se pudo consultar la Torre." });
      send(ws, { type: "towerStatus", weekId: r.weekId, floor: r.floor, complete: r.complete, clearedFloors: r.clearedFloors, pending: r.pending || [] });
      return;
    }
    // [Torre — premios pendientes] El jugador tocó un regalo (piso ya
    // superado o el bonus de completar) para abrirlo — la plata/ítem YA se
    // había otorgado en el momento de superar el piso (grant_rewards es
    // atómico); esto solo marca que ya lo vio, para que dejen de aparecer
    // como "pendiente" en la Torre. Idempotente: tocarlo de nuevo no rompe
    // nada. `kind`/`id` vienen de lo que ya mandó towerStatus en `pending`
    // (floor+weekId o weekId del bonus), nunca un piso inventado por el
    // cliente — igual no hay plata en juego acá, solo el flag de visto.
    if (msg.type === "towerAcknowledge") {
      if (!authUser) return send(ws, { type: "error", msg: "No estás logueado." });
      const kind = msg.kind === "complete" ? "complete" : "floor";
      const id = kind === "complete" ? msg.weekId : (msg.weekId + ":" + msg.floor);
      const r = await DB.acknowledgeTowerReward(authUser, kind, id);
      if (!r.ok) return send(ws, { type: "error", msg: r.error || "No se pudo confirmar." });
      send(ws, { type: "towerAcknowledged", kind, weekId: msg.weekId, floor: msg.floor });
      return;
    }
    if (msg.type === "towerStart") {
      if (!authUser) return send(ws, { type: "error", msg: "No estás logueado." });
      if (room) return send(ws, { type: "error", msg: "Salí de la sala actual antes de entrar a la Torre." });
      const status = await DB.towerStatus(authUser);
      if (!status.ok) return send(ws, { type: "error", msg: status.error || "No se pudo iniciar la Torre." });
      if (status.complete) return send(ws, { type: "error", msg: "Ya superaste los 10 pisos de esta semana. Volvé el lunes." });
      const floor = status.floor;
      const prof = await DB.getProfileByName(authUser);
      // La dificultad SIEMPRE sale de DB.TOWER_FLOOR_DIFFICULTY según el piso
      // real del servidor — nunca de nada que mande el cliente.
      const diff = DB.TOWER_FLOOR_DIFFICULTY[floor] || "easy";
      const towerRoom = {
        code: makeRoomCode(), name: "Torre — piso " + floor,
        public: false, players: [], started: false, table: [], bag: [], hands: {},
        hasLaidInitial: {}, currentIdx: 0, meldCounter: 0, passStreak: 0,
        ranked: false, gameMode: "casual", chatLog: [],
        towerFloor: floor, towerWeekId: status.weekId,
      };
      rooms.set(towerRoom.code, towerRoom);
      const humanPlayer = {
        id: C.nid("p"), ws, name: (msg.name || authUser).slice(0, 16), connected: true,
        username: authUser, skin: msg.skin || "clasica", team: null, ready: true,
        avatar: prof ? prof.avatar : undefined, rankPts: prof ? prof.rankPts : undefined, level: prof ? prof.level : undefined,
        fx: prof && prof.active ? (prof.active.effect || "clasico") : "clasico",
        trail: prof && prof.active ? (prof.active.trail || "clasica") : "clasica",
      };
      towerRoom.players.push(humanPlayer);
      if (ws._applyRoomPlayer) ws._applyRoomPlayer(towerRoom, humanPlayer);
      const rivalNames = { easy: "Aprendiz", normal: "Retador", hard: "Veterano", expert: "Maestro", claude: "Claude" };
      const bot = makeMatchmakingBot([humanPlayer.name]);
      bot.aiDifficulty = diff;
      bot.name = "Torre · " + (rivalNames[diff] || "Rival");
      if (diff === "claude") bot.avatar = "🧠";
      towerRoom.players.push(bot);
      send(ws, { type: "towerStarted", code: towerRoom.code, floor, weekId: status.weekId });
      send(ws, { type: "joined", code: towerRoom.code, playerId: humanPlayer.id });
      sendChatHistory(ws, towerRoom);
      broadcast(towerRoom);
      startGame(towerRoom);
      return;
    }
    if (msg.type === "join") {
      const code = (msg.room || "").toUpperCase().trim();
      const name = (msg.name || "Jugador").slice(0, 16);
      if (code === "NUEVA") {
        const gm0 = GAME_MODES.includes(msg.gameMode) ? msg.gameMode : (msg.ranked ? "ranked" : "casual");
        room = { code: makeRoomCode(), name: (msg.roomName || "").trim().slice(0, 24) || ("Sala de " + name), public: !!msg.public, players: [], started: false, table: [], bag: [], hands: {}, hasLaidInitial: {}, currentIdx: 0, meldCounter: 0, passStreak: 0, ranked: gm0 === "team2v2" ? false : !!msg.ranked, gameMode: gm0, chatLog: [] };
        rooms.set(room.code, room);
      } else {
        room = rooms.get(code);
        if (!room) return send(ws, { type: "error", msg: "No existe esa sala." });
        if (room.started) {
          if (room.gameMode === "team2v2") return send(ws, { type: "error", msg: "Esta sala es 2v2 y ya está en curso: no se puede entrar a mitad de partida." });
          const elapsed = Date.now() - (room.startedAt || 0);
          if (elapsed > 5 * 60 * 1000) return send(ws, { type: "error", msg: "Esa partida ya lleva más de 5 minutos, no se puede unir." });
          // late join: se le reparten fichas del pozo
          if (room.players.length >= MAX_PLAYERS) return send(ws, { type: "error", msg: "Sala llena (máx " + MAX_PLAYERS + ")." });
          player = { id: C.nid("p"), ws, name, connected: true, username: authUser || null, skin: msg.skin || "clasica", nameeffect: null, banner: null, team: null };
          if (player.username) { const prof = await DB.getProfileByName(player.username); if (prof) { player.avatar = prof.avatar; player.rankPts = prof.rankPts; player.level = prof.level; player.fx = prof.active && prof.active.effect || "clasico"; player.trail = prof.active && prof.active.trail || "clasica"; player.nameeffect = prof.active && prof.active.nameeffect || null; player.banner = prof.active && prof.active.banner || null; } }
          room.players.push(player);
          room.hands[player.id] = room.bag.splice(0, Math.min(14, room.bag.length));
          room.hasLaidInitial[player.id] = false;
          room.jokerBreaks[player.id] = 3;
          send(ws, { type: "joined", code: room.code, playerId: player.id });
          sendChatHistory(ws, room);
          room.players.forEach(p => send(p.ws, { type: "toast", msg: name + " se unió a la partida en curso." }));
          broadcast(room);
          return;
        }
        if (room.players.length >= MAX_PLAYERS) return send(ws, { type: "error", msg: "Sala llena (máx " + MAX_PLAYERS + ")." });
        if (room.gameMode === "team2v2" && room.players.length >= 4) return send(ws, { type: "error", msg: "Sala llena (2v2 = 4 jugadores)." });
      }
      player = { id: C.nid("p"), ws, name, connected: true, username: authUser || null, skin: msg.skin || "clasica", nameeffect: null, banner: null, team: null };
      if (player.username) { const prof = await DB.getProfileByName(player.username); if (prof) { player.avatar = prof.avatar; player.rankPts = prof.rankPts; player.level = prof.level; player.nameeffect = prof.active && prof.active.nameeffect || null; player.banner = prof.active && prof.active.banner || null; } }
      room.players.push(player);
      send(ws, { type: "joined", code: room.code, playerId: player.id });
      sendChatHistory(ws, room);
      broadcast(room);
      return;
    }

    if (msg.type === "rejoin") {
      // Recuperar el asiento después de un refresh/corte de wifi momentáneo,
      // en vez de tratar CUALQUIER cierre de conexión como abandono. Sirve
      // para los dos casos que dan un margen de gracia en ws.on("close") más
      // abajo — partida ya iniciada (forfeitPlayer diferido) y, desde la
      // Fase 4B, sala todavía en lobby (asiento reservado) — este handler no
      // necesitó cambios para el caso de lobby: la identidad ya se resuelve
      // por playerId + authUser (username verificado por el servidor, nunca
      // por el objeto ws en sí), así que "recuperar cualquier sala donde el
      // jugador siga en room.players" ya cubría ambos casos.
      if (!authUser) return send(ws, { type: "error", msg: "No estás logueado." });
      const code = (msg.room || "").toUpperCase().trim();
      const targetRoom = rooms.get(code);
      if (!targetRoom) return send(ws, { type: "error", msg: "Esa sala ya no existe." });
      const existing = targetRoom.players.find(p => p.id === msg.playerId);
      if (!existing || !existing.username || existing.username.toLowerCase() !== authUser.toLowerCase()) {
        return send(ws, { type: "error", msg: "No se pudo reconectar a esa sala." });
      }
      // [Fase 5 — bug crítico real, solo visible con latencia de red real
      // (Render), nunca en local] Antes, este guard RECHAZABA el rejoin
      // nuevo si `existing.ws` apuntaba a otro socket — pero cuando la
      // MISMA sesión reconecta (cierra el viejo, abre uno nuevo), el aviso
      // de cierre del socket viejo tarda un viaje de red real en llegar al
      // servidor. Ni `existing.connected` ni `existing.ws.readyState` sirven
      // como señal confiable de "¿el otro lado sigue vivo de verdad?" —
      // ambos reflejan lo que el SERVIDOR sabe hasta ahora, no lo que
      // realmente pasa del otro lado; un intento de arreglarlo chequeando
      // `readyState===1` seguía fallando igual contra Render real, porque el
      // frame de cierre en sí viaja con la misma latencia que cualquier
      // mensaje. La identidad ya está confirmada arriba (playerId + mismo
      // username autenticado) — no hace falta adivinar si el otro socket
      // sigue vivo: el rejoin más reciente SIEMPRE gana la butaca, y si
      // había otro socket real y genuinamente activo (dos pestañas/
      // dispositivos de verdad), se lo avisa y se lo cierra en vez de
      // rechazar al que se está reconectando de buena fe.
      if (existing.ws && existing.ws !== ws) {
        try { send(existing.ws, { type: "error", msg: "Te conectaste a esta sala desde otra pestaña/dispositivo." }); existing.ws.close(); } catch (e) {}
      }
      if (existing._forfeitGraceTimer) { clearTimeout(existing._forfeitGraceTimer); existing._forfeitGraceTimer = null; }
      if (existing._lobbyGraceTimer) { clearTimeout(existing._lobbyGraceTimer); existing._lobbyGraceTimer = null; }
      existing.ws = ws;
      existing.connected = true;
      player = existing;
      room = targetRoom;
      send(ws, { type: "joined", code: room.code, playerId: existing.id });
      sendChatHistory(ws, room);
      room.players.forEach(p => { if (p.ws && p.id !== existing.id) send(p.ws, { type: "toast", msg: existing.name + " se reconectó." }); });
      broadcast(room);
      return;
    }

    if (msg.type === "leaveRoom") {
      // Salir de una sala de espera (todavía no arrancó) sin cerrar la conexión ni
      // desloguear — a diferencia de cerrar el WS, esto deja al jugador conectado
      // y logueado, listo para volver a la lista de salas al instante.
      if (room && player && !room.started) {
        removeLobbyPlayer(room, player);
        broadcast(room);
      }
      room = null; player = null;
      send(ws, { type: "leftRoom" });
      return;
    }

    if (!room || !player) return;

    if (msg.type === "setSkin") {
      if (!room) return;
      player.skin = msg.skin || "clasica";
      broadcast(room);
      return;
    }
    if (msg.type === "setNameCosmetics") {
      // Mismo patrón que setSkin: si cambiás tu efecto de nombre o banner (Pase
      // Galáctico) mientras ya estás en una sala, se refleja en vivo para los demás.
      // A diferencia de setSkin, no confía en lo que mande el cliente — relee el
      // perfil autoritativo del servidor (mismo criterio que avatar/rankPts/level).
      if (!room || !player.username) return;
      const prof = await DB.getProfileByName(player.username);
      if (prof) {
        player.nameeffect = (prof.active && prof.active.nameeffect) || null;
        player.banner = (prof.active && prof.active.banner) || null;
      }
      broadcast(room);
      return;
    }
    if (msg.type === "setReady") {
      if (!room || room.started) return;
      player.ready = !!msg.ready;
      broadcast(room);
      return;
    }
    if (msg.type === "placeBet") {
      if (!room || room.started) return;
      if (room.gameMode !== "monedas") return send(ws, { type: "error", msg: "Esta sala no es de modo Monedas." });
      if (player.isAI || !player.username) return send(ws, { type: "error", msg: "Los bots no apuestan." });
      if (player.bet) return send(ws, { type: "error", msg: "Ya apostaste. Cancelá tu apuesta si querés cambiarla." });
      const amount = Math.floor(Number(msg.amount));
      const r = await DB.reserveBet(player.username, amount);
      if (!r.ok) return send(ws, { type: "error", msg: r.error });
      player.bet = amount;
      send(ws, { type: "profile", profile: r.profile });
      broadcast(room);
      return;
    }
    if (msg.type === "cancelBet") {
      if (!room || room.started) return;
      if (!player.bet) return;
      const r = await DB.creditCoins(player.username, player.bet);
      player.bet = 0;
      if (r.ok) send(ws, { type: "profile", profile: r.profile });
      broadcast(room);
      return;
    }
    if (msg.type === "setTapete") {
      if (!room || room.started) return;
      if (room.players[0].id !== player.id) return send(ws, { type: "error", msg: "Solo el admin puede cambiar la mesa." });
      const tapete = msg.tapete || "clasico";
      // El cliente ya filtra el selector por lo que el admin compró, pero la
      // autoridad real es el servidor: sin esto, cualquiera podía mandar
      // cualquier id de tapete a mano y usarlo sin haberlo desbloqueado.
      if (tapete !== "clasico") {
        const profile = player.username ? await DB.getProfileByName(player.username) : null;
        const owned = (profile && profile.inventory && profile.inventory.tapetes) || [];
        if (!owned.includes(tapete)) return send(ws, { type: "error", msg: "No tenés ese tapete." });
      }
      room.tapete = tapete;
      broadcast(room);
      return;
    }
    if (msg.type === "setTeam") {
      if (!room || room.started) return;
      if (room.gameMode !== "team2v2") return;
      if (room.players[0].id !== player.id) return send(ws, { type: "error", msg: "Solo el admin puede asignar equipos." });
      const target = room.players.find(p => p.id === msg.playerId);
      if (!target) return;
      const team = ["blue", "red", null].includes(msg.team) ? msg.team : null;
      if (team) {
        const teammates = room.players.filter(p => p.team === team && p.id !== target.id);
        if (teammates.length >= 2) return send(ws, { type: "error", msg: "Ese equipo ya tiene 2 jugadores." });
        // Un equipo tiene que ser IA+IA o jugador+jugador — nunca mezclados (la IA
        // no puede coordinarse con un humano dentro del turno de equipo compartido).
        if (teammates.length === 1 && teammates[0].isAI !== target.isAI) {
          return send(ws, { type: "error", msg: "Un equipo no puede mezclar jugador real con IA — los dos tienen que ser del mismo tipo." });
        }
      }
      target.team = team;
      broadcast(room);
      return;
    }
    if (msg.type === "addAI") {
      if (!room || room.started) return;
      if (room.players[0].id !== player.id) return send(ws, { type: "error", msg: "Solo el admin puede agregar IA." });
      // La IA todavía no sabe usar habilidades (fase futura) — para no romper con
      // fichas de habilidad mezcladas en su mano, Galáctico es siempre entre reales.
      if (room.gameMode === "galactico") return send(ws, { type: "error", msg: "Modo Galáctico es siempre entre jugadores reales, sin IA (por ahora)." });
      if (room.gameMode === "team2v2" && room.players.length >= 4) return send(ws, { type: "error", msg: "Sala llena (2v2 = 4 jugadores)." });
      if (room.players.length >= MAX_PLAYERS) return send(ws, { type: "error", msg: "Sala llena (máx " + MAX_PLAYERS + ")." });
      const diff = msg.difficulty || "normal";
      const aiAvatars = {"easy":"🤖","normal":"👾","hard":"💀","expert":"🧠","claude":"✨"};
      const aiNames = { easy:["Bot Fácil","Bot Blanda","Bot Novato"], normal:["Bot Alpha","Bot Beta","Bot Gamma"], hard:["Bot Dura","Bot Cruel","Bot Salvaje"], expert:["Bot Experta","Bot Genio","Bot IA+"], claude:["IA-Claude"] };
      const pool = aiNames[diff] || aiNames.normal;
      const usedNames = room.players.map(p => p.name);
      const name = pool.find(n => !usedNames.includes(n)) || "Bot " + (room.players.length + 1);
      const aiPlayer = { id: C.nid("ai"), ws: null, name, connected: true, isAI: true, ready: true, username: null, aiDifficulty: diff, avatar: aiAvatars[diff]||"🤖", skin: "clasica" };
      room.players.push(aiPlayer);
      broadcast(room);
      return;
    }
    if (msg.type === "kickAI") {
      if (!room || room.started) return;
      if (room.players[0].id !== player.id) return send(ws, { type: "error", msg: "Solo el admin puede." });
      const aiIdx = room.players.findIndex(p => p.isAI && p.id === msg.aiId);
      if (aiIdx > 0) { room.players.splice(aiIdx, 1); broadcast(room); }
      return;
    }
    if (msg.type === "roomConfig") {
      if (!room || room.started) return;
      if (room.players[0].id !== player.id) return send(ws, { type: "error", msg: "Solo el admin puede configurar." });
      room.config = {
        turnSeconds: Math.min(120, Math.max(10, msg.turnSeconds || 60)),
        deckPct: [25, 50, 75, 100].includes(msg.deckPct) ? msg.deckPct : 100,
        initTiles: [7, 10, 14, 18].includes(msg.initTiles) ? msg.initTiles : 14,
        matchMinutes: [0, 10, 20, 30, 45, 60].includes(msg.matchMinutes) ? msg.matchMinutes : 0,
        winMode: ["classic","points"].includes(msg.winMode) ? msg.winMode : "classic",
        targetScore: msg.targetScore > 0 ? Math.min(500, msg.targetScore) : 200,
      };
      room.gameMode = GAME_MODES.includes(msg.gameMode) ? msg.gameMode : (room.ranked ? "ranked" : "casual");
      if (room.gameMode === "team2v2") room.ranked = false;
      // Galáctico solo se gana vaciando la mano de fichas normales — sin variante
      // "por puntaje" (la UI ya la oculta, esto es el resguardo del lado servidor).
      if (room.gameMode === "galactico") room.config.winMode = "classic";
      broadcast(room);
      return;
    }
    if (msg.type === "start") {
      if (room.players[0].id !== player.id) return send(ws, { type: "error", msg: "Solo el admin puede empezar la partida." });
      if (room.players.length < 2) return send(ws, { type: "error", msg: "Necesitás al menos 2 jugadores." });
      const humansNotReady = room.players.filter(p => !p.isAI && !p.ready);
      if (humansNotReady.length > 0) return send(ws, { type: "error", msg: "Faltan jugadores listos: " + humansNotReady.map(p => p.name).join(", ") });
      if (room.gameMode === "monedas") {
        const missingBet = room.players.filter(p => !p.isAI && !p.bet);
        if (missingBet.length > 0) return send(ws, { type: "error", msg: "Todos tienen que apostar antes de empezar: " + missingBet.map(p => p.name).join(", ") });
      }
      if (room.gameMode === "team2v2") {
        if (room.players.length !== 4) return send(ws, { type: "error", msg: "2v2 necesita exactamente 4 jugadores." });
        const blue = room.players.filter(p => p.team === "blue");
        const red = room.players.filter(p => p.team === "red");
        if (blue.length !== 2 || red.length !== 2) {
          return send(ws, { type: "error", msg: "Asigná 2 jugadores a cada equipo antes de empezar." });
        }
        // Equipos homogéneos: los dos IA o los dos jugadores reales, nunca mezclados.
        if (blue[0].isAI !== blue[1].isAI) return send(ws, { type: "error", msg: "El equipo Azul mezcla jugador real con IA — tienen que ser del mismo tipo." });
        if (red[0].isAI !== red[1].isAI) return send(ws, { type: "error", msg: "El equipo Rojo mezcla jugador real con IA — tienen que ser del mismo tipo." });
      }
      startGame(room);
      return;
    }
    if (msg.type === "lay") {
      const err = handleLay(room, player, msg.tiles || []);
      if (err) send(ws, { type: "error", msg: err });
      return;
    }
    if (msg.type === "layMultiple") {
      const err = handleLayMultiple(room, player, msg.groups || []);
      if (err) send(ws, { type: "error", msg: err });
      return;
    }
    if (msg.type === "reorganize") {
      const err = handleReorganize(room, player, msg.openedMeldIds || [], msg.groups || []);
      if (err) send(ws, { type: "error", msg: err });
      return;
    }
    if (msg.type === "attach") {
      const err = handleAttach(room, player, msg.meldId, msg.tiles || []);
      if (err) send(ws, { type: "error", msg: err });
      return;
    }
    if (msg.type === "surrender") {
      forfeitPlayer(room, player, { viaClose: false });
      return;
    }
    if (msg.type === "reveal") {
      // Jugador revela su ficha del sorteo
      if (!room || !room.sorteo || room.phase !== "sorteo") return;
      const entry = room.sorteo.find(s => s.playerId === player.id);
      if (!entry || entry.revealed) return;
      entry.revealed = true;
      room.sorteoRevealed++;
      broadcast(room);
      // Si todos revelaron, determinar orden y pasar a dealing
      if (room.sorteoRevealed >= room.players.length) {
        setTimeout(() => finishSorteo(room), 2000);
      }
      return;
    }
    if (msg.type === "dealDraw") {
      // Jugador agarra fichas de la bolsa durante el reparto
      if (!room || room.phase !== "dealing") return;
      const count = msg.all ? (14 - (room.dealCounts[player.id]||0)) : 1;
      for (let i = 0; i < count; i++) {
        if (room.bag.length === 0 || (room.dealCounts[player.id]||0) >= (room.initTiles||14)) break;
        room.hands[player.id].push(room.bag.shift());
        room.dealCounts[player.id] = (room.dealCounts[player.id]||0) + 1;
      }
      broadcast(room);
      // Si todos tienen 14, pasar a playing
      const allDealt = room.players.every(p => (room.dealCounts[p.id]||0) >= (room.initTiles||14));
      if (allDealt) {
        setTimeout(() => startPlayingPhase(room), 800);
      }
      return;
    }
    if (msg.type === "activity") {
      // el jugador informa qué está haciendo (zona de trabajo) para que los demás lo vean.
      // En team2v2 esto lleva las fichas REALES (no solo conteos) porque el destinatario
      // es únicamente el propio compañero de equipo, que de todos modos ya ve su mano
      // completa vía teammateHand — no se expone nada nuevo a un rival.
      player.activity = msg.info || null; // ej: {groups:2, loose:3} o, en 2v2, {groups:[...], loose:[...]}
      const recipients = room.gameMode === "team2v2"
        ? room.players.filter((p) => p.id !== player.id && p.team && p.team === player.team)
        : room.players.filter((p) => p.id !== player.id);
      recipients.forEach((p) => {
        if (p.ws) send(p.ws, { type: "playerActivity", playerId: player.id, playerName: player.name, info: player.activity });
      });
      return;
    }
    if (msg.type === "nudgeCancel") {
      // "Empujón" para pedirle al compañero que cancele su jugada en progreso — SIN
      // tocar su estado de forma remota (eso lo decidimos explícitamente evitar): solo
      // le llega un aviso, y quien cancela sigue siendo él mismo con su propio botón.
      if (!room || room.gameMode !== "team2v2" || !player.team) return;
      const mate = room.players.find((p) => p.id !== player.id && p.team === player.team);
      if (mate && mate.ws) send(mate.ws, { type: "nudgeCancel", byId: player.id, byName: player.name });
      return;
    }
    if (msg.type === "markTiles") {
      // Marcado táctico multi-ficha: sugerirle al compañero qué fichas de SU mano usar.
      // Se valida contra la mano real del compañero para no poder "marcar" cualquier cosa.
      if (!room || room.gameMode !== "team2v2" || !player.team) return;
      const mate = room.players.find((p) => p.id !== player.id && p.team === player.team);
      if (!mate || !mate.ws) return;
      const mateHand = room.hands[mate.id] || [];
      const validIds = (msg.tileIds || []).filter((id) => mateHand.some((t) => t.id === id));
      send(mate.ws, { type: "tilesMarked", byId: player.id, byName: player.name, tileIds: validIds });
      return;
    }
    if (msg.type === "draw") {
      const err = handleDraw(room, player);
      if (err) send(ws, { type: "error", msg: err });
      return;
    }
    if (msg.type === "useAbility") {
      const gateErr = canActivateAbility(room, player);
      if (gateErr) { send(ws, { type: "error", msg: gateErr }); return; }
      const hand = room.hands[player.id] || [];
      const idx = hand.findIndex((t) => t.id === msg.tileId && t.ability);
      if (idx === -1) { send(ws, { type: "error", msg: "No tenés esa ficha de habilidad." }); return; }
      if (hand[idx].ability !== msg.ability) { send(ws, { type: "error", msg: "La ficha no coincide con la habilidad indicada." }); return; }

      let result;
      if (msg.ability === "escudo") result = useEscudo(room, player);
      else if (msg.ability === "robo_doble") result = useRoboDoble(room, player);
      else if (msg.ability === "teletransporte") result = useTeletransporte(room, player, msg);
      else if (msg.ability === "robo") result = useRobo(room, player, msg);
      else if (msg.ability === "intercambio") result = useIntercambio(room, player, msg);
      else if (msg.ability === "bloqueo") result = useBloqueo(room, player, msg);
      else if (msg.ability === "robo_dirigido") result = useRoboDirigido(room, player, msg);
      else if (msg.ability === "vision") result = useVision(room, player, msg);
      else if (msg.ability === "comodin") result = useComodin(room, player, msg);
      else if (msg.ability === "atraccion") result = useAtraccion(room, player, msg);
      else result = { ok: false, err: "Esa habilidad todavía no está disponible." };

      if (!result.ok) { send(ws, { type: "error", msg: result.err || "No se pudo usar la habilidad." }); return; }
      // Recalcular DESPUÉS del handler, y desde room.hands[player.id] en vivo (no la
      // variable `hand` capturada arriba): algunos handlers (ej. Teletransporte) mutan
      // ese mismo array con splice/push, y otros (ej. Atracción armando una combinación
      // nueva desde la mano) lo REEMPLAZAN por un array nuevo — en ese segundo caso,
      // `hand` queda apuntando a un array viejo y descartado, así que splicearlo ahí no
      // saca la ficha de la mano real.
      const finalHand = room.hands[player.id] || [];
      const finalIdx = finalHand.findIndex((t) => t.id === msg.tileId);
      if (finalIdx !== -1) finalHand.splice(finalIdx, 1);
      room.abilityUsedThisTurn[player.id] = true;
      // Resultado privado (ej. Visión): SOLO al que activó la habilidad, nunca al resto.
      if (result.private) send(ws, result.private);
      // abilityBy/abilityKey van aparte del texto largo del toast — el cliente los usa
      // para el cartel grande "NOMBRE USÓ HABILIDAD" (no parsea el mensaje en español).
      room.players.forEach((p) => { if (p.ws) send(p.ws, { type: "toast", msg: result.msg, kind: "ability", abilityBy: player.name, abilityKey: msg.ability }); });
      // Algunas habilidades pueden bajar una combinación nueva (ej. Atracción armando
      // un juego con fichas de la mano) — si eso vacía las fichas normales, se gana.
      if (result.checkWin && handIsEmptyForWin(room, player.id)) {
        room.players.forEach((p) => { if (p.ws) send(p.ws, { type: "toast", msg: "¡" + player.name + " ganó la partida! 🎉" }); });
        finishMatch(room, player.id);
        return;
      }
      broadcast(room);
      return;
    }
    if (msg.type === "requestAbilityInfo") {
      // Paso 1 de 2 de Robo dirigido: revela la mano completa del rival, PERO solo al
      // que preguntó (mismo patrón de privacidad que teammateHand/markTiles en 2v2) —
      // todavía no consume la ficha de habilidad ni cuenta como "usada" esta habilidad.
      const gateErr = canActivateAbility(room, player);
      if (gateErr) { send(ws, { type: "error", msg: gateErr }); return; }
      if (msg.ability !== "robo_dirigido") { send(ws, { type: "error", msg: "Esa habilidad no necesita consulta previa." }); return; }
      const hasTile = (room.hands[player.id] || []).some((t) => t.id === msg.tileId && t.ability === "robo_dirigido");
      if (!hasTile) { send(ws, { type: "error", msg: "No tenés esa ficha de habilidad." }); return; }
      const target = room.players.find((p) => p.id === msg.targetPlayerId);
      if (!target) { send(ws, { type: "error", msg: "Ese jugador no existe." }); return; }
      if (target.id === player.id) { send(ws, { type: "error", msg: "Elegí a un rival." }); return; }
      if (room.shieldActive && room.shieldActive[target.id]) { send(ws, { type: "error", msg: `${target.name} tiene Escudo activo.` }); return; }
      send(ws, { type: "abilityInfo", ability: "robo_dirigido", targetPlayerId: target.id, targetName: target.name, tiles: room.hands[target.id] || [] });
      return;
    }
    if (msg.type === "teamAddLoose") {
      const err = handleTeamAddLoose(room, player, msg.tileIds || []);
      if (err) send(ws, { type: "error", msg: err });
      return;
    }
    if (msg.type === "teamRemoveLoose") {
      const err = handleTeamRemoveLoose(room, player, msg.tileIds || []);
      if (err) send(ws, { type: "error", msg: err });
      return;
    }
    if (msg.type === "teamFormGroup") {
      const err = handleTeamFormGroup(room, player, msg.tileIds || []);
      if (err) send(ws, { type: "error", msg: err });
      return;
    }
    if (msg.type === "teamDissolveGroup") {
      const err = handleTeamDissolveGroup(room, player, msg.groupId);
      if (err) send(ws, { type: "error", msg: err });
      return;
    }
    if (msg.type === "teamAddToGroup") {
      const err = handleTeamAddToGroup(room, player, msg.groupId, msg.tileIds || []);
      if (err) send(ws, { type: "error", msg: err });
      return;
    }
    if (msg.type === "teamClearWork") {
      const err = handleTeamClearWork(room, player);
      if (err) send(ws, { type: "error", msg: err });
      return;
    }
    if (msg.type === "teamOpenMeld") {
      const err = handleTeamOpenMeld(room, player, msg.meldId);
      if (err) send(ws, { type: "error", msg: err });
      return;
    }
    if (msg.type === "teamConfirm") {
      const err = handleTeamConfirm(room, player);
      if (err) send(ws, { type: "error", msg: err });
      return;
    }
    if (msg.type === "teamProposeDraw") {
      if (!room || room.gameMode !== "team2v2") return;
      const err = handleTeamProposeDraw(room, player);
      if (err) send(ws, { type: "error", msg: err });
      return;
    }
    if (msg.type === "teamProposeConfirm") {
      if (!room || room.gameMode !== "team2v2") return;
      const err = handleTeamProposeConfirm(room, player);
      if (err) send(ws, { type: "error", msg: err });
      return;
    }
    if (msg.type === "teamRespond") {
      if (!room || room.gameMode !== "team2v2" || !player.team) return;
      handleTeamRespond(room, player, !!msg.agree);
      return;
    }
    if (msg.type === "quickChat") {
      if (!room) return;
      if (!QUICK_CHAT_OPTIONS.includes(msg.text)) return;
      const now = Date.now();
      if (player.lastChatAt && now - player.lastChatAt < QUICK_CHAT_COOLDOWN_MS) {
        return send(ws, { type: "error", msg: "Esperá un toque antes de mandar otro mensaje." });
      }
      player.lastChatAt = now;
      room.players.forEach((p) => {
        if (p.ws) send(p.ws, { type: "chat", playerId: player.id, playerName: player.name, text: msg.text });
      });
      return;
    }
    if (msg.type === "sendChat") {
      if (!room) return;
      const text = String(msg.text || "").trim();
      if (!text) return;
      if (text.length > CHAT_MAX_LEN) return send(ws, { type: "error", msg: `Mensaje demasiado largo (máx ${CHAT_MAX_LEN} caracteres).` });
      const now = Date.now();
      if (player.lastFreeChatAt && now - player.lastFreeChatAt < CHAT_COOLDOWN_MS) return; // silencioso: no vale la pena un toast por cada tecleo rápido
      player.lastFreeChatAt = now;
      const chatMsg = { id: C.nid("cm"), playerId: player.id, playerName: player.name, text };
      if (!room.chatLog) room.chatLog = [];
      room.chatLog.push(chatMsg);
      if (room.chatLog.length > CHAT_LOG_MAX) room.chatLog.shift();
      room.players.forEach((p) => { if (p.ws) send(p.ws, { type: "chat", ...chatMsg }); });
      return;
    }
    if (msg.type === "teamChat") {
      // Chat de equipo (2v2): mensaje NUEVO y aparte de quickChat (no una bandera sobre
      // el mismo camino) a propósito — así no se toca el broadcast de quickChat, que hoy
      // manda a TODA la sala sin filtro; acá el filtro por equipo es explícito.
      if (!room || room.gameMode !== "team2v2" || !player.team) return;
      if (!TEAM_CHAT_OPTIONS.includes(msg.text)) return;
      const now = Date.now();
      if (player.lastTeamChatAt && now - player.lastTeamChatAt < QUICK_CHAT_COOLDOWN_MS) {
        return send(ws, { type: "error", msg: "Esperá un toque antes de mandar otro mensaje." });
      }
      player.lastTeamChatAt = now;
      room.players.filter((p) => p.team === player.team).forEach((p) => {
        if (p.ws) send(p.ws, { type: "teamChat", playerId: player.id, playerName: player.name, text: msg.text });
      });
      return;
    }
  }); }); // [Fase 4A] cierra enqueueMessage(async()=>{...}) y el listener "message" que solo encola

  ws.on("close", () => {
    removeFromMatchQueues(ws); // si estaba esperando en una cola de matchmaking (nunca llegó a tener room/player), sale sin quedar "fantasma" emparejable
    if (!room || !player) return;
    // [Fase 5] Si ya hubo un rejoin más nuevo para este jugador, `player.ws`
    // (mismo objeto compartido) ya no es ESTE socket — este close es el
    // aviso, atrasado por la red, de una conexión que el jugador ya
    // abandonó. Seguir de largo pisaría `connected`/armaría un grace timer
    // sobre una sesión que ya está perfectamente reconectada; no corresponde
    // hacer nada acá.
    if (player.ws !== ws) return;
    const closedPlayer = player, closedRoom = room;
    closedPlayer.connected = false;
    if (!closedRoom.started) {
      if (explicitLogout) {
        // Logout real: libera el asiento al instante, igual que un
        // "leaveRoom" explícito — nunca debe quedar reservado esperando un
        // regreso que no va a pasar (la sesión ya se invalidó del lado
        // servidor, ver el handler de "logout").
        removeLobbyPlayer(closedRoom, closedPlayer);
      } else {
        // [Fase 4B] Caída TRANSITORIA en lobby (wifi, refresh, background) —
        // antes esto perdía el asiento al instante, a diferencia de una
        // partida ya iniciada (rama de abajo), que sí daba un margen de
        // gracia. Ahora usan el MISMO criterio: se reserva el asiento (no se
        // saca de room.players todavía, así que ni se duplica ni se libera
        // para que otro lo ocupe) y, si "rejoin" llega a tiempo (ver el
        // handler más arriba), ese mismo timer se cancela y no pasa nada.
        // Si el que se desconectó era el admin (players[0] — ver stateFor,
        // el admin no es un flag propio sino la posición 0 del array), sigue
        // siéndolo mientras dure la gracia, porque no se toca su posición;
        // nadie más puede mandar "start" en su lugar mientras tanto (ver el
        // handler de "start", que exige room.players[0].id === player.id) —
        // es la política de host ya establecida, no una nueva.
        closedPlayer._lobbyGraceTimer = setTimeout(() => {
          closedPlayer._lobbyGraceTimer = null;
          if (closedPlayer.connected) return; // ya se reconectó mientras tanto
          removeLobbyPlayer(closedRoom, closedPlayer);
          broadcast(closedRoom); // recién ACÁ se libera de verdad — avisar a los demás en ese momento, no antes
        }, RECONNECT_GRACE_MS);
      }
    } else if (closedRoom.phase === "playing" && !closedPlayer.isAI) {
      // Margen de gracia antes de tratar el cierre como rendición: un refresh de
      // página o un corte de wifi momentáneo cierra el WS igual que cerrar la
      // pestaña de verdad — sin esto, CUALQUIER micro-corte perdía la partida al
      // instante. Si el jugador manda "rejoin" a tiempo (ver arriba), este timer
      // se cancela y no pasa nada; si no, se aplica la rendición de siempre.
      closedPlayer._forfeitGraceTimer = setTimeout(() => {
        closedPlayer._forfeitGraceTimer = null;
        if (closedPlayer.connected) return; // ya se reconectó por otro lado mientras tanto
        forfeitPlayer(closedRoom, closedPlayer, { viaClose: true });
      }, RECONNECT_GRACE_MS);
    }
    broadcast(room);
    // La limpieza real de la sala (si queda sin humanos conectados) la hace el
    // sweep periódico de abajo — cubre este caso y también el de una sala con
    // bots (que nunca se desconectan solos) o abandonada en el lobby sin que
    // nadie mande "leaveRoom" explícito.
  });
});

server.listen(PORT, () => {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) ips.push(net.address);
    }
  }
  console.log("\n🀄 Burako LAN server corriendo");
  console.log(`   Local:  http://localhost:${PORT}`);
  ips.forEach((ip) => console.log(`   Red:    http://${ip}:${PORT}`));
  console.log("\n   Compartí la URL de 'Red' con los demás jugadores en tu misma wifi/LAN.\n");
});
