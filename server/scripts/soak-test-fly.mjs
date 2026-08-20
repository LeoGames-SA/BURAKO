// Soak test realista contra Fly.io São Paulo — a diferencia de
// measure-latency-ops.mjs (que abre/cierra muchas conexiones seguidas para
// medir cada operación por separado), esto simula 3 jugadores reales con
// UNA conexión WS persistente cada uno, jugando una partida real de al
// menos 20 minutos de reloj real (sin comprimir tiempo), con el pacing de
// un jugador humano (pausa entre acciones), midiendo estabilidad: RTT
// durante gameplay, desconexiones/reconexiones, errores, y p50/p95 de
// login/resumeSession/acciones de juego/finishMatch.
import WebSocket from "ws";
import crypto from "node:crypto";
import fs from "node:fs";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const C = require("../burako-core.js");

const WS_URL = process.env.TARGET_WS_URL || "wss://burako-server-gru.fly.dev";
const DURATION_MS = Number(process.env.SOAK_DURATION_MS) || 21 * 60 * 1000; // 21 min de reloj real
const MAINTENANCE_PING_MS = Number(process.env.SOAK_PING_MS) || 15000; // tráfico de mantenimiento (pedido explícito para el retest)
const PASS = "SoakTest123456";
const OUT_JSON = process.env.SOAK_OUT_JSON || "soak-result.json";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const createdUsernames = [];

function log(...a) { console.log(`[${new Date().toISOString()}]`, ...a); }

// Instrumentación por conexión (pedido explícito): open -> heartbeat -> lastMessage
// -> close(code/reason) -> reconnect, para poder correlacionar EXACTAMENTE por qué
// se cerró cada conexión. Nunca loguea credenciales/tokens, solo metadata de timing.
let __connSeq = 0;
const connectionLog = []; // [{connectionId, player, openedAt, closedAt, closeCode, closeReason, lastMessageAt, pingsSent, msgsReceived}]

function connect(url = WS_URL, playerLabel = "?") {
  const connectionId = `c${++__connSeq}`;
  const entry = { connectionId, player: playerLabel, openedAt: null, closedAt: null, closeCode: null, closeReason: null, lastMessageAt: null, pingsSent: 0, msgsReceived: 0 };
  connectionLog.push(entry);
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws._buffer = []; ws._waiters = [];
    ws.connectionId = connectionId;
    ws._logEntry = entry;
    const t = setTimeout(() => reject(new Error("timeout conectando")), 20000);
    ws.once("open", () => {
      clearTimeout(t);
      entry.openedAt = new Date().toISOString();
      log(`[conn ${connectionId}/${playerLabel}] open`);
      resolve(ws);
    });
    ws.once("error", reject);
    ws.on("close", (code, reasonBuf) => {
      entry.closedAt = new Date().toISOString();
      entry.closeCode = code;
      entry.closeReason = String(reasonBuf || "");
      const gapMs = entry.lastMessageAt ? (Date.now() - new Date(entry.lastMessageAt).getTime()) : null;
      log(`[conn ${connectionId}/${playerLabel}] close code=${code} reason="${entry.closeReason}" msgsRecibidos=${entry.msgsReceived} gapDesdeUltimoMsg=${gapMs}ms intencional=${!!ws._intentionalClose}`);
      if (!ws._intentionalClose) {
        metrics.disconnects.push({ player: playerLabel, connectionId, at: entry.closedAt, code, reason: entry.closeReason, gapMs });
      }
    });
    ws.on("message", (raw) => {
      entry.lastMessageAt = new Date().toISOString();
      entry.msgsReceived++;
      let m; try { m = JSON.parse(raw); } catch (e) { return; }
      const wi = ws._waiters.findIndex((w) => w.test(m));
      if (wi !== -1) { const w = ws._waiters.splice(wi, 1)[0]; clearTimeout(w.timer); w.resolve(m); }
      else ws._buffer.push(m);
    });
  });
}
function send(ws, obj) { ws.send(JSON.stringify(obj)); }
function waitFor(ws, matcher, ms = 15000) {
  const test = typeof matcher === "function" ? matcher : (m) => m.type === matcher;
  const bi = ws._buffer.findIndex(test);
  if (bi !== -1) return Promise.resolve(ws._buffer.splice(bi, 1)[0]);
  return new Promise((resolve, reject) => {
    const waiter = { test, resolve, timer: setTimeout(() => {
      const i = ws._waiters.indexOf(waiter); if (i !== -1) ws._waiters.splice(i, 1);
      reject(new Error("timeout esperando " + (typeof matcher === "string" ? matcher : "matcher")));
    }, ms) };
    ws._waiters.push(waiter);
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (base, spread) => base + Math.floor(Math.random() * spread);

// ---------- métricas ----------
const metrics = {
  gameplayRttMs: [],       // draw/lay/attach/reorganize round trips durante la partida
  pingRttMs: [],           // "catalog" — round trip puro, sin lógica de juego
  loginMs: null,
  resumeSessionMs: null,
  finishMatchMs: null,
  disconnects: [],         // {player, at, code, reason}
  reconnects: [],          // {player, at, ms, ok}
  errors: [],              // {player, at, type, detail}
};
function percentile(arr, p) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
}

function findGroup30Plus(hand) {
  const byNum = {};
  for (const t of hand || []) { if (t.joker) continue; (byNum[t.number] = byNum[t.number] || []).push(t); }
  for (const num of Object.keys(byNum).sort((a, b) => b - a)) {
    if (Number(num) * 3 < 30) continue;
    const seen = new Set(); const pick = [];
    for (const t of byNum[num]) { if (!seen.has(t.color)) { seen.add(t.color); pick.push(t); } }
    if (pick.length >= 3) return pick.slice(0, 3);
  }
  return null;
}
function findAttachTile(hand, meldTiles) {
  // busca en la mano una ficha que extienda el juego (mismo color, número consecutivo)
  const nums = (meldTiles || []).filter((t) => !t.joker).map((t) => Number(t.number));
  if (!nums.length) return null;
  const color = (meldTiles.find((t) => !t.joker) || {}).color;
  const lo = Math.min(...nums) - 1, hi = Math.max(...nums) + 1;
  return (hand || []).find((t) => !t.joker && t.color === color && (Number(t.number) === lo || Number(t.number) === hi)) || null;
}

// ---------- setup de un jugador (registro + conexión persistente) ----------
async function setupPlayer(prefix, label) {
  const username = (prefix + crypto.randomBytes(4).toString("hex")).slice(0, 16);
  createdUsernames.push(username.toLowerCase());
  const ws = await connect(WS_URL, label);
  send(ws, { type: "register", username, password: PASS });
  const r = await waitFor(ws, (m) => m.type === "authOk" || m.type === "error");
  if (r.type !== "authOk") throw new Error("register falló para " + username + ": " + JSON.stringify(r));
  const refreshToken = r.session && r.session.refreshToken;
  return { username, label, ws, refreshToken, lastMaintenancePingAt: Date.now() };
}

async function main() {
  log(`=== Soak test realista contra ${WS_URL} (duración objetivo: ${(DURATION_MS / 60000).toFixed(1)} min) ===`);

  // ---------- Jugador A: login + resumeSession explícitos (medidos) ----------
  const A = await setupPlayer("soakA_", "A");
  A.ws._intentionalClose = true; A.ws.close(); // cerramos para probar login real (no reusar la conexión del register)
  {
    const t0 = performance.now();
    A.ws = await connect(WS_URL, "A");
    send(A.ws, { type: "login", username: A.username, password: PASS });
    const r = await waitFor(A.ws, (m) => m.type === "authOk" || m.type === "error");
    metrics.loginMs = performance.now() - t0;
    if (r.type !== "authOk") throw new Error("login de A falló: " + JSON.stringify(r));
    log(`login (A) = ${metrics.loginMs.toFixed(1)}ms`);
  }
  A.ws._intentionalClose = true; A.ws.close();
  {
    const t0 = performance.now();
    A.ws = await connect(WS_URL, "A");
    send(A.ws, { type: "resumeSession", refreshToken: A.refreshToken });
    const r = await waitFor(A.ws, (m) => m.type === "authOk" || m.type === "error");
    metrics.resumeSessionMs = performance.now() - t0;
    if (r.type !== "authOk") throw new Error("resumeSession de A falló: " + JSON.stringify(r));
    log(`resumeSession (A) = ${metrics.resumeSessionMs.toFixed(1)}ms`);
  }

  const B = await setupPlayer("soakB_", "B");
  const C = await setupPlayer("soakC_", "C");
  const players = [A, B, C];
  log("3 jugadores logueados:", players.map((p) => p.username).join(", "));

  // ---------- crear/unirse a sala, ready, start ----------
  send(A.ws, { type: "join", room: "NUEVA", name: "A", gameMode: "casual" });
  const joinedA = await waitFor(A.ws, "joined");
  const roomCode = joinedA.code;
  A.id = joinedA.playerId;
  send(B.ws, { type: "join", room: roomCode, name: "B" });
  const joinedB = await waitFor(B.ws, "joined"); B.id = joinedB.playerId;
  send(C.ws, { type: "join", room: roomCode, name: "C" });
  const joinedC = await waitFor(C.ws, "joined"); C.id = joinedC.playerId;
  log("los 3 en la sala", roomCode);

  for (const p of players) { p.ws._buffer.length = 0; send(p.ws, { type: "setReady", ready: true }); }
  await sleep(500);
  for (const p of players) p.ws._buffer.length = 0;
  send(A.ws, { type: "start" });
  await waitFor(A.ws, (m) => m.type === "state" && m.phase === "sorteo", 15000);
  for (const p of players) send(p.ws, { type: "reveal" });
  await waitFor(A.ws, (m) => m.type === "state" && m.phase === "dealing", 15000);
  for (const p of players) send(p.ws, { type: "dealDraw", all: true });
  let stateA = await waitFor(A.ws, (m) => m.type === "state" && m.phase === "playing" && m.started, 15000);
  for (const p of players) p.ws._buffer.length = 0;
  log("partida arrancada, fase playing");

  // Tráfico de mantenimiento — MISMO mecanismo app-level que usa el cliente real
  // (netConnect/startClientHeartbeat en burako.js, ver auditoría de heartbeat):
  // {type:"ping"} cada ~15s POR CONEXIÓN, independiente entre jugadores.
  //
  // OJO — bug real encontrado en el intento anterior: esto estaba chequeado
  // una vez por vuelta del loop de juego, que es SECUENCIAL (una sola acción
  // de juego a la vez, por diseño del turno). Si la acción de UN jugador se
  // colgaba (timeout de 12s + reintento de reconexión hasta 15s más), el loop
  // entero quedaba bloqueado ahí, y los OTROS jugadores se quedaban sin su
  // ping de mantenimiento durante esa ventana — coincidía sospechosamente
  // con los huecos de ~24-40s vistos antes de cada corte. Un cliente real
  // (pestaña/dispositivo aparte) nunca tendría este problema: su heartbeat
  // corre en su propio timer, sin depender de qué le esté pasando a otro
  // jugador. Por eso ahora es un setInterval real por conexión, desacoplado
  // del loop de turnos — lee `p.ws` en vivo, así que sigue funcionando solo
  // tras una reconexión sin tener que reiniciarlo a mano.
  const pingTimers = players.map((p) => setInterval(() => {
    if (p.ws && p.ws.readyState === 1) {
      try { send(p.ws, { type: "ping" }); if (p.ws._logEntry) p.ws._logEntry.pingsSent++; } catch (e) {}
    }
  }, MAINTENANCE_PING_MS));

  // ---------- chat de prueba ----------
  send(B.ws, { type: "sendChat", text: "dale que arrancamos 👋" });
  await sleep(300);

  // ---------- loop de gameplay real, ~21 min de reloj ----------
  const deadline = Date.now() + DURATION_MS;
  let round = 0, laySucceeded = false, attachSucceeded = false;
  let lastPingAt = 0;

  function byId(id) { return players.find((p) => p.id === id); }
  function currentPlayer() {
    const cur = stateA.players[stateA.currentIdx];
    return byId(cur.id);
  }

  while (Date.now() < deadline) {
    round++;
    const actor = currentPlayer();
    if (!actor) { await sleep(1000); continue; }
    actor.ws._buffer.length = 0;

    // periódicamente, un ping puro (sin lógica de juego) para separar RTT de red de RTT de acción
    if (Date.now() - lastPingAt > 30000) {
      lastPingAt = Date.now();
      const p = players[round % players.length];
      const t0 = performance.now();
      try {
        send(p.ws, { type: "catalog" });
        await waitFor(p.ws, "catalog", 8000);
        metrics.pingRttMs.push(performance.now() - t0);
      } catch (e) { metrics.errors.push({ player: p.username, at: new Date().toISOString(), type: "ping-timeout", detail: e.message }); }
    }

    try {
      const myHand = stateA.myHand; // ojo: myHand viene solo en el `state` que recibió A — para B/C se resuelve más abajo
      let action = { type: "draw" };
      let usedSpecial = false;

      if (actor === A && !laySucceeded) {
        const group = findGroup30Plus(stateA.myHand || []);
        if (group) { action = { type: "layMultiple", groups: [group.map((t) => t.id)] }; usedSpecial = "lay"; }
      } else if (actor === A && laySucceeded && !attachSucceeded && stateA.table && stateA.table.length) {
        const myMeld = stateA.table.find((m) => m.ownerId === A.id);
        if (myMeld) {
          const tile = findAttachTile(stateA.myHand || [], myMeld.tiles);
          if (tile) { action = { type: "attach", meldId: myMeld.id, tiles: [tile.id] }; usedSpecial = "attach"; }
        }
      }

      const t0 = performance.now();
      send(actor.ws, action);
      const resp = await waitFor(actor.ws, (m) => m.type === "state" || m.type === "error", 12000);
      const rtt = performance.now() - t0;
      metrics.gameplayRttMs.push(rtt);

      if (resp.type === "error") {
        // un layMultiple/attach rechazado por regla NO es un error de infraestructura —
        // se cuenta aparte, no infla el conteo de errores reales de conexión/servidor.
        if (usedSpecial) log(`(${usedSpecial} rechazado, esperable: ${resp.msg})`);
        else metrics.errors.push({ player: actor.username, at: new Date().toISOString(), type: "gameplay-error", detail: resp.msg });
      } else {
        stateA = resp; // el broadcast de "state" que recibió QUIEN actuó también refleja la partida completa
        if (usedSpecial === "lay") laySucceeded = true;
        if (usedSpecial === "attach") attachSucceeded = true;
      }
    } catch (e) {
      metrics.errors.push({ player: actor.username, at: new Date().toISOString(), type: "action-timeout", detail: e.message });
      // intento de reconexión — mismo patrón que usaría el cliente real
      if (actor.ws.readyState !== 1) {
        const t0 = performance.now();
        try {
          actor.ws = await connect(WS_URL, actor.label);
          send(actor.ws, { type: "resumeSession", refreshToken: actor.refreshToken });
          const r = await waitFor(actor.ws, (m) => m.type === "authOk" || m.type === "error", 15000);
          const ms = performance.now() - t0;
          metrics.reconnects.push({ player: actor.username, at: new Date().toISOString(), ms, ok: r.type === "authOk" });
          log(`reconexión de ${actor.username}: ${r.type === "authOk" ? "OK" : "FALLÓ"} en ${ms.toFixed(0)}ms`);
        } catch (e2) {
          metrics.reconnects.push({ player: actor.username, at: new Date().toISOString(), ms: performance.now() - t0, ok: false });
        }
      }
    }

    if (round % 15 === 0) {
      const elapsedMin = ((DURATION_MS - (deadline - Date.now())) / 60000).toFixed(1);
      log(`ronda ${round} — ${elapsedMin}/${(DURATION_MS / 60000).toFixed(1)} min — gameplayRTT p50=${percentile(metrics.gameplayRttMs, 0.5)?.toFixed(0)}ms p95=${percentile(metrics.gameplayRttMs, 0.95)?.toFixed(0)}ms — desconexiones=${metrics.disconnects.length} errores=${metrics.errors.length}`);
    }
    if (round % 40 === 0) send(players[round % 3].ws, { type: "sendChat", text: "sigue la partida, todo ok 🎲" });

    await sleep(jitter(3500, 3000)); // pacing humano: ~3.5-6.5s entre acciones
  }

  log(`Duración de gameplay cumplida (${round} rondas). Cerrando la partida...`);

  // ---------- rendición de C (mid-match), luego B (deja a A ganando -> finishMatch) ----------
  // Envuelto en try/catch: la vez pasada un timeout ACÁ tiró todo el proceso y
  // se perdieron 21 minutos de datos de gameplay ya recolectados. Ahora, pase
  // lo que pase, el resumen se escribe igual con lo que se pudo confirmar.
  let rejoinOk = false;
  try {
    C.ws._buffer.length = 0;
    send(C.ws, { type: "surrender" });
    await sleep(1500);
    await sleep(jitter(2000, 2000));

    B.ws._buffer.length = 0; A.ws._buffer.length = 0;
    const t0fm = performance.now();
    send(B.ws, { type: "surrender" });
    const matchResult = await waitFor(A.ws, (m) => m.type === "matchResult", 20000);
    metrics.finishMatchMs = performance.now() - t0fm;
    log(`finishMatch = ${metrics.finishMatchMs.toFixed(1)}ms — ganó ${matchResult.won ? A.username : "?"}`);

    // ---------- volver al menú + entrar a otra partida SIN volver a loguearse ----------
    send(A.ws, { type: "leaveRoom" });
    await sleep(500);
    A.ws._buffer.length = 0;
    send(A.ws, { type: "join", room: "NUEVA", name: "A", gameMode: "casual" });
    const rejoinedA = await waitFor(A.ws, (m) => m.type === "joined" || m.type === "error", 10000);
    rejoinOk = rejoinedA.type === "joined";
    log(`entrar a OTRA partida sin re-loguearse: ${rejoinOk ? "OK" : "FALLÓ"} (${JSON.stringify(rejoinedA).slice(0, 100)})`);
  } catch (e) {
    log(`⚠ el cierre de partida (finishMatch/rejoin) falló: ${e.message}`);
    metrics.errors.push({ player: "cierre", at: new Date().toISOString(), type: "finishMatch-o-rejoin-fallo", detail: e.message });
  }

  // ---------- cierre ----------
  pingTimers.forEach(clearInterval);
  for (const p of players) { p.ws._intentionalClose = true; try { p.ws.close(); } catch (e) {} }

  const summary = {
    wsUrl: WS_URL,
    durationTargetMin: DURATION_MS / 60000,
    rounds: round,
    gameplay: { p50: percentile(metrics.gameplayRttMs, 0.5), p95: percentile(metrics.gameplayRttMs, 0.95), samples: metrics.gameplayRttMs.length },
    pingPuro: { p50: percentile(metrics.pingRttMs, 0.5), p95: percentile(metrics.pingRttMs, 0.95), samples: metrics.pingRttMs.length },
    loginMs: metrics.loginMs,
    resumeSessionMs: metrics.resumeSessionMs,
    finishMatchMs: metrics.finishMatchMs,
    disconnects: metrics.disconnects,
    reconnects: metrics.reconnects,
    errors: metrics.errors,
    rejoinWithoutReloginOk: rejoinOk,
    connectionLog, // open->heartbeat->lastMessage->close por cada conexión (connectionId), sin credenciales
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(summary, null, 2));

  log("\n=== RESUMEN SOAK TEST ===");
  log(`Rondas jugadas: ${round} en ${(DURATION_MS / 60000).toFixed(1)} min`);
  log(`Gameplay RTT — p50=${summary.gameplay.p50?.toFixed(1)}ms p95=${summary.gameplay.p95?.toFixed(1)}ms (n=${summary.gameplay.samples})`);
  log(`Ping puro (sin DB) — p50=${summary.pingPuro.p50?.toFixed(1)}ms p95=${summary.pingPuro.p95?.toFixed(1)}ms (n=${summary.pingPuro.samples})`);
  log(`login=${metrics.loginMs?.toFixed(1)}ms resumeSession=${metrics.resumeSessionMs?.toFixed(1)}ms finishMatch=${metrics.finishMatchMs?.toFixed(1)}ms`);
  log(`Desconexiones inesperadas: ${metrics.disconnects.length}`);
  log(`Reconexiones intentadas: ${metrics.reconnects.length} (ok: ${metrics.reconnects.filter((r) => r.ok).length})`);
  log(`Errores: ${metrics.errors.length}`);
  log(`Entrar a otra partida sin re-loguearse: ${rejoinOk ? "OK" : "FALLÓ"}`);
  log(`Resultado escrito en ${OUT_JSON}`);

  for (const u of createdUsernames) {
    try { const { data } = await supabase.from("profiles").select("id").ilike("username", u).maybeSingle(); if (data) await supabase.auth.admin.deleteUser(data.id); }
    catch (e) {}
  }
  log("[cleanup] usuarios de prueba borrados de Supabase.");
  process.exit(0);
}
main().catch((e) => {
  console.error("❌ Error fatal en el soak test:", e);
  // red de seguridad: aunque main() explote en cualquier punto, no perder los
  // datos ya recolectados (esto fue exactamente lo que pasó la corrida
  // anterior — un timeout al final tiró todo el proceso sin dejar rastro).
  try {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ crashed: true, error: e.message, metrics, connectionLog }, null, 2));
    console.error(`(datos parciales igual escritos en ${OUT_JSON})`);
  } catch (e2) {}
  process.exit(1);
});
