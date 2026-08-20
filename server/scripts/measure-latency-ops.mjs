// Medición de latencia real por OPERACIÓN de gameplay, contra un servidor
// real (local o producción vía TARGET_WS_URL). Objetivo: separar
// "red/Render" de "trabajo del servidor" y de "tiempo en Supabase" para cada
// operación pedida: login/resumeSession, crear sala, unirse a sala, ready,
// iniciar partida, ficha y pasar (=finalizar turno, ver nota abajo), bajar
// juego, finalizar partida.
//
// Cómo se mide "tiempo en DB" por operación: el server, cuando corre con
// LATENCY_DEBUG=1, loguea una línea `[LAT] type=<msg> total=<ms> db=<ms>`
// por cada mensaje WS procesado (ver server.js). Contra producción no
// podemos leer stdout del proceso remoto, así que esta corrida mide SOLO
// el round-trip real que ve el cliente (total = red + Render + server +
// DB); para la descomposición total/DB por operación hay que correr este
// mismo script con TARGET_WS_URL apuntando a un server LOCAL levantado con
// LATENCY_DEBUG=1 (ver measure-latency-report.mjs, que hace ambas cosas).
//
// Nota (arquitectura real, confirmada leyendo server.js): en Burako no
// existe un mensaje "finalizar turno" separado — robar ficha ("draw")
// SIEMPRE termina el turno (advanceTurn se llama adentro de handleDraw en
// los dos caminos: robaste, o pozo vacío = pasás). Por eso "Ficha y pasar"
// y "finalizar turno" son la MISMA operación de servidor acá: una sola
// medición ("draw") cubre ambas.
import WebSocket from "ws";
import crypto from "node:crypto";
import "dotenv/config";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const C = require("../burako-core.js");

const WS_URL = process.env.TARGET_WS_URL || "ws://localhost:8181";
const PASS = "LatOps123456";

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws._buffer = []; ws._waiters = [];
    const t = setTimeout(() => reject(new Error("timeout conectando a " + WS_URL)), 20000);
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
function waitFor(ws, matcher, ms = 20000) {
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

const rows = [];
async function timeit(op, fn) {
  const t0 = performance.now();
  let note = "";
  try { note = (await fn()) || ""; }
  finally {
    const ms = performance.now() - t0;
    rows.push({ op, ms, note });
    console.log(`  ${op.padEnd(28)} ${ms.toFixed(1).padStart(8)}ms  ${note}`);
  }
}

async function runPass(label) {
  console.log(`\n=== Pasada: ${label} (${WS_URL}) ===`);
  const hostUser = ("lho_" + crypto.randomBytes(4).toString("hex")).slice(0, 16);
  const guestUser = ("lgu_" + crypto.randomBytes(4).toString("hex")).slice(0, 16);
  let refreshToken = null;

  let wsHost;
  await timeit(`${label}:wsConnect`, async () => { wsHost = await connect(); });

  await timeit(`${label}:register(host)`, async () => {
    send(wsHost, { type: "register", username: hostUser, password: PASS });
    const r = await waitFor(wsHost, (m) => m.type === "authOk" || m.type === "error");
    if (r.type !== "authOk") throw new Error("register falló: " + JSON.stringify(r));
    refreshToken = r.session && r.session.refreshToken;
  });
  wsHost.close();

  await timeit(`${label}:login`, async () => {
    wsHost = await connect();
    send(wsHost, { type: "login", username: hostUser, password: PASS });
    const r = await waitFor(wsHost, (m) => m.type === "authOk" || m.type === "error");
    if (r.type !== "authOk") throw new Error("login falló: " + JSON.stringify(r));
  });

  await timeit(`${label}:resumeSession`, async () => {
    const wsProbe = await connect();
    send(wsProbe, { type: "resumeSession", refreshToken });
    const r = await waitFor(wsProbe, (m) => m.type === "authOk" || m.type === "error");
    wsProbe.close();
    if (r.type !== "authOk") return "no-ok: " + JSON.stringify(r).slice(0, 80);
  });

  let wsGuest;
  await timeit(`${label}:register(guest)`, async () => {
    wsGuest = await connect();
    send(wsGuest, { type: "register", username: guestUser, password: PASS });
    const r = await waitFor(wsGuest, (m) => m.type === "authOk" || m.type === "error");
    if (r.type !== "authOk") throw new Error("register guest falló: " + JSON.stringify(r));
  });

  let roomCode, hostId;
  await timeit(`${label}:crearSala(join NUEVA)`, async () => {
    send(wsHost, { type: "join", room: "NUEVA", name: "Host", gameMode: "casual" });
    const j = await waitFor(wsHost, "joined");
    roomCode = j.code; hostId = j.playerId;
  });

  await timeit(`${label}:unirseSala(join code)`, async () => {
    send(wsGuest, { type: "join", room: roomCode, name: "Guest", gameMode: "casual" });
    await waitFor(wsGuest, "joined");
  });

  // Ojo: "join"/"setReady" hacen broadcast(room) a TODOS los jugadores — el
  // buffer de un socket puede tener un "state" viejo (de la acción del OTRO
  // jugador) esperando sin reclamar. Se limpia cada buffer justo antes de
  // mandar SU PROPIO mensaje para no confundir esa sobra con la respuesta real.
  await timeit(`${label}:setReady(host)`, async () => {
    wsHost._buffer.length = 0;
    send(wsHost, { type: "setReady", ready: true });
    await waitFor(wsHost, (m) => m.type === "state");
  });
  await timeit(`${label}:setReady(guest)`, async () => {
    wsGuest._buffer.length = 0;
    send(wsGuest, { type: "setReady", ready: true });
    await waitFor(wsGuest, (m) => m.type === "state");
  });

  let stateHost;
  await timeit(`${label}:iniciarPartida(start)`, async () => {
    wsHost._buffer.length = 0;
    send(wsHost, { type: "start" });
    await waitFor(wsHost, (m) => m.type === "state" && m.phase === "sorteo", 25000);
  });

  send(wsHost, { type: "reveal" });
  send(wsGuest, { type: "reveal" });
  await waitFor(wsHost, (m) => m.type === "state" && m.phase === "dealing", 10000);
  send(wsHost, { type: "dealDraw", all: true });
  send(wsGuest, { type: "dealDraw", all: true });
  stateHost = await waitFor(wsHost, (m) => m.type === "state" && m.phase === "playing" && m.started, 10000);
  wsHost._buffer.length = 0; wsGuest._buffer.length = 0;

  // "Bajar juego": intenta la salida (30+) directo con la mano inicial, sin
  // robar antes (las reglas lo permiten) — mide handleLay/handleLayMultiple
  // tal cual, sea aceptada o rechazada (el trabajo del servidor es el mismo).
  await timeit(`${label}:bajarJuego(layMultiple)`, async () => {
    const group = findGroup30Plus(stateHost.myHand);
    send(wsHost, { type: "layMultiple", groups: group ? [group.map((t) => t.id)] : [[stateHost.myHand[0]?.id, stateHost.myHand[1]?.id, stateHost.myHand[2]?.id]] });
    const r = await waitFor(wsHost, (m) => m.type === "state" || m.type === "error", 10000);
    if (r.type === "state") stateHost = r;
    return r.type === "state" ? "aceptada" : "rechazada (esperable si no había 30+ en la mano inicial)";
  });

  // "Ficha y pasar" / "finalizar turno" — ver nota al inicio del archivo.
  await timeit(`${label}:fichaYPasar/finalizarTurno(draw)`, async () => {
    send(wsHost, { type: "draw" });
    await waitFor(wsHost, (m) => m.type === "state" || m.type === "error", 10000);
  });

  // "Finalizar partida": con 2 jugadores, que el guest se rinda cierra la
  // partida para el host en el mismo golpe (forfeitPlayer -> finishMatch) —
  // dispara la secuencia completa: ensureMatchRow + resolveMatch (perfil +
  // idempotencia + logros + persistProfile) + recordMatchParticipants.
  await timeit(`${label}:finalizarPartida(surrender->finishMatch)`, async () => {
    wsHost._buffer.length = 0;
    send(wsGuest, { type: "surrender" });
    // OJO: forfeitPlayer manda un "toast" INMEDIATO (antes de tocar la DB) y
    // recién después el "matchResult" real (tras ensureMatchRow+resolveMatch+
    // recordMatchParticipants) — hay que esperar puntualmente matchResult, un
    // matcher que acepte cualquiera de los dos mediría solo el toast y
    // subestimaría el costo real de DB de esta operación.
    await waitFor(wsHost, (m) => m.type === "matchResult", 15000);
  });

  wsHost.close(); wsGuest.close();
  return { hostUser, guestUser };
}

async function main() {
  const created = [];
  const r1 = await runPass("1ra (recién conectado)");
  created.push(r1.hostUser, r1.guestUser);
  const r2 = await runPass("2da (caliente, inmediatamente después)");
  created.push(r2.hostUser, r2.guestUser);

  console.log("\n=== TABLA RESUMEN (ms) ===");
  const ops = [...new Set(rows.map((r) => r.op.split(":")[1]))];
  for (const op of ops) {
    const rs = rows.filter((r) => r.op.endsWith(op));
    console.log(op.padEnd(38) + rs.map((r) => (r.op.split(":")[0] + "=" + r.ms.toFixed(0) + "ms").padEnd(28)).join(" "));
  }

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    for (const u of created) {
      try { const { data } = await supabase.from("profiles").select("id").ilike("username", u).maybeSingle(); if (data) await supabase.auth.admin.deleteUser(data.id); }
      catch (e) {}
    }
    console.log("\n[cleanup] usuarios de prueba borrados de Supabase.");
  }
}
main().catch((e) => { console.error("❌ Error fatal:", e); process.exit(1); });
