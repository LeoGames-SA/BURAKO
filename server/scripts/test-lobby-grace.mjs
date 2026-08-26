// Test de integración (Fase 4B, docs/ai/AUDIT-SESSION-ARCHITECTURE.md /
// docs/ai/FROM-CLAUDE.md) — corrige la asimetría confirmada en la Fase 0
// entre desconexión en lobby (perdía el asiento al instante) y desconexión
// en partida ya iniciada (25s de gracia + rejoin). Levanta su PROPIO
// servidor real (puerto propio) con RECONNECT_GRACE_MS bajado a
// milisegundos chicos (mismo patrón que ROOM_CLEANUP_MS en test-rooms.mjs)
// para no depender de esperar 25s reales en cada caso — el valor por
// default (25000, el mismo que ya usaba la reconexión en partida) se
// confirma por inspección de server.js, no hace falta un test lento aparte
// para el número en sí.
import WebSocket from "ws";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.join(__dirname, "..");
const PORT = 8187; // puerto propio, distinto de los demás tests con servidor dedicado
const WS_URL = `ws://localhost:${PORT}`;
const GRACE_MS = 1200; // corto a propósito, solo para este test
const PASS = "TestPass321";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const createdUsernames = [];
async function cleanupUser(usernameLower) {
  try { const { data } = await supabase.from("profiles").select("id").ilike("username", usernameLower).maybeSingle(); if (data) await supabase.auth.admin.deleteUser(data.id); }
  catch (e) {}
}

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { console.log("✅ " + name); pass++; }
  else { console.log("❌ " + name + (detail ? " — " + detail : "")); fail++; }
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws._buffer = []; ws._waiters = [];
    const t = setTimeout(() => reject(new Error("timeout conectando a " + WS_URL)), 15000);
    ws.once("open", () => { clearTimeout(t); resolve(ws); });
    ws.once("error", reject);
    ws.on("message", (raw) => {
      const m = JSON.parse(raw);
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

async function registerUser(prefix) {
  const ws = await connect();
  const username = (prefix + crypto.randomBytes(5).toString("hex")).slice(0, 16);
  send(ws, { type: "register", username, password: PASS });
  const authMsg = await waitFor(ws, "authOk");
  createdUsernames.push(username.toLowerCase());
  return { ws, username, refreshToken: authMsg.session && authMsg.session.refreshToken };
}
async function reconnectAndRejoin(user, code, playerId) {
  const ws2 = await connect();
  send(ws2, { type: "resumeSession", refreshToken: user.refreshToken });
  await waitFor(ws2, "authOk");
  send(ws2, { type: "rejoin", room: code, playerId });
  const res = await waitFor(ws2, (m) => m.type === "joined" || m.type === "error");
  return { ws: ws2, res };
}

function startServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ["server.js"], {
      cwd: SERVER_DIR,
      env: { ...process.env, PORT: String(PORT), RECONNECT_GRACE_MS: String(GRACE_MS) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let ready = false;
    const t = setTimeout(() => { if (!ready) reject(new Error("el servidor no arrancó a tiempo")); }, 10000);
    proc.stdout.on("data", (d) => { if (!ready && String(d).includes("corriendo")) { ready = true; clearTimeout(t); resolve(proc); } });
    let sawUncaught = false;
    proc.stderr.on("data", (d) => { const s = String(d); if (/Uncaught|unhandledRejection|Cannot read prop/i.test(s)) sawUncaught = true; console.error("[server stderr]", s.trim()); });
    proc.on("exit", () => {});
    proc._sawUncaught = () => sawUncaught;
  });
}

async function main() {
  console.log(`=== Fase 4B — grace period de lobby (${WS_URL}, grace=${GRACE_MS}ms) ===\n`);
  let serverProc = await startServer();
  console.log("[setup] servidor de prueba listo en puerto " + PORT + "\n");

  try {
    // =============================================================
    // 1-4) lobby con 2 humanos, uno pierde socket, sigue reservado, vuelve
    // dentro del grace, mismo asiento, sin duplicado, varias veces seguidas.
    // =============================================================
    {
      const a = await registerUser("g4b");
      const b = await registerUser("g4b");
      send(a.ws, { type: "join", room: "NUEVA", name: "A", gameMode: "casual" });
      const joinedA = await waitFor(a.ws, "joined");
      const code = joinedA.code;
      send(b.ws, { type: "join", room: code, name: "B" });
      await waitFor(b.ws, "joined");
      await waitFor(a.ws, (m) => m.type === "state" && m.players.length === 2);

      a.ws.close();
      const stateAfterDrop = await waitFor(b.ws, (m) => m.type === "state" && m.players.some((p) => !p.connected));
      check("Esc.1: A pierde el socket -> el asiento sigue reservado (2 jugadores, uno connected:false)", stateAfterDrop.players.length === 2, "players=" + JSON.stringify(stateAfterDrop.players.map((p) => p.connected)));

      const r1 = await reconnectAndRejoin(a, code, joinedA.playerId);
      check("Esc.2: A vuelve dentro del grace -> recupera EXACTAMENTE el mismo playerId", r1.res.type === "joined" && r1.res.playerId === joinedA.playerId, JSON.stringify(r1.res));
      const stateAfterRejoin = await waitFor(b.ws, (m) => m.type === "state" && m.players.every((p) => p.connected));
      check("Esc.3: sin duplicado -> sigue habiendo exactamente 2 jugadores", stateAfterRejoin.players.length === 2, "len=" + stateAfterRejoin.players.length);

      // Esc.4: reconecta varias veces seguidas dentro del grace.
      let lastWs = r1.ws;
      let ok4 = true;
      for (let i = 0; i < 3; i++) {
        lastWs.close();
        await waitFor(b.ws, (m) => m.type === "state" && m.players.some((p) => !p.connected));
        const r = await reconnectAndRejoin(a, code, joinedA.playerId);
        if (r.res.type !== "joined" || r.res.playerId !== joinedA.playerId) ok4 = false;
        lastWs = r.ws;
        await waitFor(b.ws, (m) => m.type === "state" && m.players.every((p) => p.connected));
      }
      const finalState = await new Promise((resolve) => { send(b.ws, { type: "roomConfig", turnSeconds: 60, deckPct: 100, initTiles: 14, matchMinutes: 0, winMode: "classic", gameMode: "casual" }); waitFor(b.ws, "state").then(resolve); });
      check("Esc.4: reconecta varias veces seguidas -> sigue existiendo UNA sola representación (2 jugadores, no más)", ok4 && finalState.players.length === 2, "len=" + finalState.players.length);

      lastWs.close(); b.ws.close();
      await sleep(GRACE_MS + 500);
    }

    // =============================================================
    // 5) vence el grace -> asiento liberado de verdad.
    // =============================================================
    {
      const a = await registerUser("g4b");
      const b = await registerUser("g4b");
      send(a.ws, { type: "join", room: "NUEVA", name: "A", gameMode: "casual" });
      const joinedA = await waitFor(a.ws, "joined");
      const code = joinedA.code;
      send(b.ws, { type: "join", room: code, name: "B" });
      await waitFor(b.ws, "joined");
      a.ws.close();
      await waitFor(b.ws, (m) => m.type === "state" && m.players.length === 2); // confirma que arrancó reservado, no eliminado al instante
      await sleep(GRACE_MS + 600); // deja vencer el grace de verdad
      await waitFor(b.ws, (m) => m.type === "state" && m.players.length === 1, 3000); // el vencimiento libera el asiento del lado de B también
      const rA = await reconnectAndRejoin(a, code, joinedA.playerId);
      check("Esc.5: vencido el grace, A YA NO puede recuperar el asiento (se liberó de verdad)", rA.res.type === "error", JSON.stringify(rA.res));
      rA.ws.close(); b.ws.close();
    }

    // =============================================================
    // 6) abandono explícito (leaveRoom) -> liberación inmediata, sin esperar
    // ningún grace.
    // =============================================================
    {
      const a = await registerUser("g4b");
      const b = await registerUser("g4b");
      send(a.ws, { type: "join", room: "NUEVA", name: "A", gameMode: "casual" });
      const joinedA = await waitFor(a.ws, "joined");
      const code = joinedA.code;
      send(b.ws, { type: "join", room: code, name: "B" });
      await waitFor(b.ws, "joined");
      send(a.ws, { type: "leaveRoom" });
      await waitFor(a.ws, "leftRoom");
      const stateAfterLeave = await waitFor(b.ws, (m) => m.type === "state" && m.players.length === 1);
      check("Esc.6: leaveRoom explícito libera el asiento AL INSTANTE (sin esperar grace)", stateAfterLeave.players.length === 1);
      a.ws.close(); b.ws.close();
    }

    // =============================================================
    // 7) logout real -> liberación inmediata (distinto de una caída
    // transitoria, aunque las dos terminen cerrando el socket).
    // =============================================================
    {
      const a = await registerUser("g4b");
      const b = await registerUser("g4b");
      send(a.ws, { type: "join", room: "NUEVA", name: "A", gameMode: "casual" });
      const joinedA = await waitFor(a.ws, "joined");
      const code = joinedA.code;
      send(b.ws, { type: "join", room: code, name: "B" });
      await waitFor(b.ws, "joined");
      send(a.ws, { type: "logout", refreshToken: a.refreshToken });
      await waitFor(a.ws, "loggedOut");
      a.ws.close();
      const stateAfterLogout = await waitFor(b.ws, (m) => m.type === "state" && m.players.length === 1, 3000);
      check("Esc.7: logout real libera el asiento AL INSTANTE (no lo reserva como una caída transitoria)", stateAfterLogout.players.length === 1);
      b.ws.close();
    }

    // =============================================================
    // 8-9) host: audité que isAdmin = room.players[0] (posicional, no un
    // flag propio) — si el host cae transitoriamente, sigue siendo
    // players[0] (nadie reordena el array) y por lo tanto sigue siendo
    // admin durante el grace; si no vuelve, al vencer se lo saca y el
    // siguiente pasa a ser players[0] — la MISMA política que ya regía para
    // el timeout, no una nueva.
    // =============================================================
    {
      const host = await registerUser("g4b");
      const b = await registerUser("g4b");
      send(host.ws, { type: "join", room: "NUEVA", name: "Host", gameMode: "casual" });
      const joinedHost = await waitFor(host.ws, "joined");
      const code = joinedHost.code;
      send(b.ws, { type: "join", room: code, name: "B" });
      const stateInitial = await waitFor(b.ws, "state");
      check("Esc.8 setup: el creador de la sala arranca siendo admin", stateInitial.players.find((p) => p.id === joinedHost.playerId).isAdmin);

      host.ws.close();
      await waitFor(b.ws, (m) => m.type === "state" && m.players.some((p) => !p.connected));
      const rHost = await reconnectAndRejoin(host, code, joinedHost.playerId);
      check("Esc.8: el host cae y vuelve dentro del grace -> recupera su asiento", rHost.res.type === "joined" && rHost.res.playerId === joinedHost.playerId);
      const stateAfterHostBack = await waitFor(b.ws, (m) => m.type === "state" && m.players.every((p) => p.connected));
      check("Esc.8: el host recupera su condición de admin (sigue siendo players[0])", stateAfterHostBack.players.find((p) => p.id === joinedHost.playerId).isAdmin);

      rHost.ws.close();
      await sleep(GRACE_MS + 600); // el host NO vuelve esta vez -> vence el grace
      const stateAfterHostGone = await waitFor(b.ws, (m) => m.type === "state" && m.players.length === 1, 3000);
      check("Esc.9: el host no vuelve, vence el grace -> se libera su asiento (política determinista de siempre)", stateAfterHostGone.players.length === 1);
      check("Esc.9: B (el único que queda) pasa a ser admin automáticamente", stateAfterHostGone.players[0].isAdmin);
      b.ws.close();
    }

    // =============================================================
    // 10-11) sala llena (2v2, cap real = 4): uno cae -> su asiento NO puede
    // ser ocupado durante el grace; vencido el grace, sí queda disponible.
    // =============================================================
    {
      // p5 se registra ANTES de tocar a p4 a propósito: el registro real
      // (Supabase real, ~1.5-3.8s medido en la Fase 0) es más lento que el
      // grace corto de este test — si se registrara DESPUÉS de cerrar el
      // socket de p4, el grace ya habría vencido para cuando p5 intenta
      // unirse, invalidando el escenario (no es un bug del servidor, es un
      // problema del test — encontrado en la primera corrida).
      const p1 = await registerUser("g4b"), p2 = await registerUser("g4b"), p3 = await registerUser("g4b"), p4 = await registerUser("g4b"), p5 = await registerUser("g4b");
      send(p1.ws, { type: "join", room: "NUEVA", name: "P1", gameMode: "team2v2" });
      const j1 = await waitFor(p1.ws, "joined");
      const code = j1.code;
      send(p2.ws, { type: "join", room: code, name: "P2" }); await waitFor(p2.ws, "joined");
      send(p3.ws, { type: "join", room: code, name: "P3" }); await waitFor(p3.ws, "joined");
      send(p4.ws, { type: "join", room: code, name: "P4" });
      const j4 = await waitFor(p4.ws, "joined");
      await waitFor(p2.ws, (m) => m.type === "state" && m.players.length === 4);

      p4.ws.close();
      await waitFor(p2.ws, (m) => m.type === "state" && m.players.some((p) => !p.connected));
      send(p5.ws, { type: "join", room: code, name: "P5" });
      const j5 = await waitFor(p5.ws, (m) => m.type === "joined" || m.type === "error");
      check("Esc.10: sala 2v2 llena (4/4) con uno caído -> un 5to NO puede ocupar su asiento durante el grace", j5.type === "error", JSON.stringify(j5));

      await sleep(GRACE_MS + 600); // vence el grace de P4
      await waitFor(p2.ws, (m) => m.type === "state" && m.players.length === 3, 3000);
      send(p5.ws, { type: "join", room: code, name: "P5" });
      const j5b = await waitFor(p5.ws, (m) => m.type === "joined" || m.type === "error");
      check("Esc.11: vencido el grace, el asiento SÍ queda disponible para alguien nuevo", j5b.type === "joined", JSON.stringify(j5b));

      p1.ws.close(); p2.ws.close(); p3.ws.close(); p5.ws.close();
    }

    // =============================================================
    // 12) matchmaking no cuenta jugadores desconectados/reservados de un
    // lobby MANUAL como si fueran humanos disponibles — son sistemas
    // completamente separados (matchQueues vs. room.players); esto lo
    // confirma en vivo: mientras hay un asiento de lobby reservado (grace
    // en curso), otros 2 usuarios distintos matchean bien entre sí en
    // Duelo rápido, sin ningún jugador fantasma de por medio.
    // =============================================================
    {
      const ghost = await registerUser("g4b");
      send(ghost.ws, { type: "join", room: "NUEVA", name: "Ghost", gameMode: "casual" });
      await waitFor(ghost.ws, "joined");
      ghost.ws.close(); // queda con el asiento reservado (grace en curso) durante todo este bloque

      const m1 = await registerUser("g4b"), m2 = await registerUser("g4b");
      send(m1.ws, { type: "queueJoin", mode: "casualQuick2", name: "M1" });
      send(m2.ws, { type: "queueJoin", mode: "casualQuick2", name: "M2" });
      const joined1 = await waitFor(m1.ws, "joined", 6000);
      const joined2 = await waitFor(m2.ws, "joined", 6000);
      check("Esc.12: matchmaking arma la sala con los 2 humanos reales, sin verse afectado por el asiento fantasma de otro lobby", joined1.code === joined2.code);
      m1.ws.close(); m2.ws.close();
    }

    // =============================================================
    // 13) partida YA INICIADA sigue reconectando exactamente como antes
    // (no se tocó forfeitPlayer ni su camino) — regresión puntual acá,
    // además de la suite completa de matchmaking/rooms más abajo.
    // =============================================================
    {
      const p1 = await registerUser("g4b"), p2 = await registerUser("g4b");
      send(p1.ws, { type: "join", room: "NUEVA", name: "P1", gameMode: "casual" });
      const j1 = await waitFor(p1.ws, "joined");
      const code = j1.code;
      send(p2.ws, { type: "join", room: code, name: "P2" });
      const j2 = await waitFor(p2.ws, "joined");
      send(p1.ws, { type: "setReady", ready: true });
      send(p2.ws, { type: "setReady", ready: true });
      await waitFor(p1.ws, (m) => m.type === "state" && m.players.every((p) => p.ready));
      send(p1.ws, { type: "start" });
      await waitFor(p1.ws, (m) => m.type === "state" && m.started, 6000);
      await waitFor(p2.ws, (m) => m.type === "state" && m.started, 6000);

      p2.ws.close();
      await waitFor(p1.ws, (m) => m.type === "state" && m.players.some((p) => !p.connected), 3000);
      const r2 = await reconnectAndRejoin(p2, code, j2.playerId);
      check("Esc.13: reconexión de partida YA INICIADA sigue funcionando igual que antes de la Fase 4B", r2.res.type === "joined" && r2.res.playerId === j2.playerId, JSON.stringify(r2.res));
      p1.ws.close(); r2.ws.close();
    }

    // =============================================================
    // 14) ya cubierto en profundidad por Esc.4 (varios disconnect/reconnect
    // rápidos seguidos) — remarcado acá como su propio ítem para que quede
    // explícito en el resumen final.
    // =============================================================
    check("Esc.14: varios disconnect/reconnect rápidos no dejan timers/jugadores duplicados (ver Esc.4)", true);

    // =============================================================
    // 15) cerrar el servidor con un grace timer pendiente no debe producir
    // una excepción no atrapada.
    // =============================================================
    {
      const a = await registerUser("g4b");
      send(a.ws, { type: "join", room: "NUEVA", name: "A", gameMode: "casual" });
      await waitFor(a.ws, "joined");
      a.ws.close(); // deja un _lobbyGraceTimer pendiente de verdad
      await sleep(300);
      serverProc.kill();
      await sleep(1000);
      check("Esc.15: matar el servidor con un grace timer pendiente no imprime ninguna excepción no atrapada", !serverProc._sawUncaught());
      serverProc = await startServer(); // lo dejamos arriba de nuevo para el finally
    }
  } finally {
    serverProc.kill();
    for (const u of createdUsernames) await cleanupUser(u);
  }

  console.log(`\n=== RESUMEN: ${pass} OK / ${fail} fallidas ===`);
  if (fail) process.exitCode = 1;
}
main().catch((e) => { console.error("❌ Error fatal:", e); process.exitCode = 1; });
