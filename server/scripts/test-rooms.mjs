// Etapa "Lobby/salas" — ciclo de vida de salas: crear/entrar/salir, limpieza
// automática de salas vacías (incluidas las que solo tienen bots, que antes
// las dejaba vivas para siempre), y que reconectar antes del timeout cancele
// la limpieza. Levanta su PROPIO servidor local (puerto aparte) con
// ROOM_SWEEP_INTERVAL_MS/ROOM_CLEANUP_MS bajados a segundos (ver server.js)
// para no tener que esperar los 3 minutos reales de producción.
import WebSocket from "ws";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.join(__dirname, "..");
const PORT = 8199; // puerto aparte para no chocar con una instancia normal en 8181
const WS_URL = `ws://localhost:${PORT}`;
const SWEEP_MS = 1500, CLEANUP_MS = 3000; // rápido, solo para este test
const PASS = "TestPass654";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
async function cleanupUser(usernameLower) {
  try {
    const { data } = await supabase.from("profiles").select("id").ilike("username", usernameLower).maybeSingle();
    if (data) await supabase.auth.admin.deleteUser(data.id);
  } catch (e) {}
}

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { console.log("✅ " + name); pass++; }
  else { console.log("❌ " + name + (detail ? " — " + detail : "")); fail++; }
}

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
      reject(new Error("timeout esperando " + matcher));
    }, ms) };
    ws._waiters.push(waiter);
  });
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// No hay endpoint público para "¿existe esta sala?" (por diseño — no debería
// hacer falta uno para jugar) así que se infiere indirectamente: un "rejoin"
// a una sala borrada da el error "Esa sala ya no existe."; a una que sigue
// viva da "joined" (o, si ya no le corresponde a ESTE jugador, otro error).
async function roomStillExists(ws, code, playerId) {
  send(ws, { type: "rejoin", room: code, playerId });
  const r = await waitFor(ws, (m) => m.type === "joined" || m.type === "error", 8000);
  return r.type !== "error" || !/ya no existe/i.test(r.msg || "");
}

async function main() {
  console.log(`=== Salas — lifecycle y limpieza automática (${WS_URL}) ===\n`);
  console.log(`[setup] levantando servidor local en :${PORT} con sweep=${SWEEP_MS}ms cleanup=${CLEANUP_MS}ms…`);
  const serverProc = spawn(process.execPath, ["server.js"], {
    cwd: SERVER_DIR,
    env: { ...process.env, PORT: String(PORT), ROOM_SWEEP_INTERVAL_MS: String(SWEEP_MS), ROOM_CLEANUP_MS: String(CLEANUP_MS) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverReady = false;
  serverProc.stdout.on("data", (d) => { if (String(d).includes("corriendo")) serverReady = true; });
  serverProc.stderr.on("data", (d) => console.error("[server stderr]", String(d).trim()));
  for (let i = 0; i < 50 && !serverReady; i++) await sleep(200);
  if (!serverReady) {
    console.error("❌ el servidor local de prueba no arrancó a tiempo");
    process.exitCode = 1;
    serverProc.kill();
    return;
  }
  console.log("[setup] servidor listo.\n");

  const A_USER = ("room_a_" + crypto.randomBytes(5).toString("hex")).slice(0, 16);
  const B_USER = ("room_b_" + crypto.randomBytes(5).toString("hex")).slice(0, 16);
  const C_USER = ("room_c_" + crypto.randomBytes(5).toString("hex")).slice(0, 16);
  const D_USER = ("room_d_" + crypto.randomBytes(5).toString("hex")).slice(0, 16);

  try {
    // ---------- Caso 1: crear → entrar → salir ambos → la sala se borra sola ----------
    const wsA = await connect(), wsB = await connect();
    send(wsA, { type: "register", username: A_USER, password: PASS });
    await waitFor(wsA, "authOk");
    send(wsB, { type: "register", username: B_USER, password: PASS });
    await waitFor(wsB, "authOk");

    send(wsA, { type: "join", room: "NUEVA", name: "A", gameMode: "casual" });
    const joinedA = await waitFor(wsA, "joined");
    const roomCode = joinedA.code;
    send(wsB, { type: "join", room: roomCode, name: "B", gameMode: "casual" });
    const joinedB = await waitFor(wsB, "joined");
    check("A crea sala y B se une", !!roomCode && joinedB.code === roomCode, JSON.stringify({ roomCode, joinedB }));

    send(wsA, { type: "leaveRoom" });
    await waitFor(wsA, "leftRoom");
    send(wsB, { type: "leaveRoom" });
    await waitFor(wsB, "leftRoom");
    // "leaveRoom" en server.js ya borra la sala DE UNA cuando queda en 0
    // jugadores (sin esperar el sweep) — confirmar con un rejoin.
    const existsAfterBothLeave = await roomStillExists(wsA, roomCode, joinedA.playerId);
    check("sala vacía (todos salieron explícitamente) se borra al instante", !existsAfterBothLeave, "");
    wsA.close(); wsB.close();

    // ---------- Caso 2: sala con 1 bot y 0 humanos conectados se borra tras el timeout ----------
    const wsC = await connect();
    send(wsC, { type: "register", username: C_USER, password: PASS });
    await waitFor(wsC, "authOk");
    send(wsC, { type: "join", room: "NUEVA", name: "C", gameMode: "casual" });
    const joinedC = await waitFor(wsC, "joined");
    const roomC = joinedC.code;
    send(wsC, { type: "addAI", difficulty: "easy" });
    await waitFor(wsC, "state", 8000); // deja asentar el broadcast de que el bot entró
    wsC.close(); // el humano se va SIN mandar leaveRoom (simula wifi cortado/cerrar la app) — el bot queda solo, connected:true para siempre
    console.log(`[esperando] ~${CLEANUP_MS + SWEEP_MS * 2}ms para que el sweep note que no hay humanos y borre la sala con el bot adentro…`);
    await sleep(CLEANUP_MS + SWEEP_MS * 2);
    const wsC2 = await connect();
    send(wsC2, { type: "login", username: C_USER, password: PASS });
    await waitFor(wsC2, "authOk");
    const existsRoomC = await roomStillExists(wsC2, roomC, joinedC.playerId);
    check("sala con 1 bot y 0 humanos conectados se borra tras el timeout (antes vivía para siempre)", !existsRoomC, "");
    wsC2.close();

    // ---------- Caso 3: reconexión antes del timeout cancela la limpieza ----------
    const wsD = await connect();
    send(wsD, { type: "register", username: D_USER, password: PASS });
    const rD = await waitFor(wsD, "authOk");
    send(wsD, { type: "join", room: "NUEVA", name: "D", gameMode: "casual" });
    const joinedD = await waitFor(wsD, "joined");
    const roomD = joinedD.code;
    wsD.close(); // se cae la conexión sin avisar
    await sleep(SWEEP_MS + 200); // deja correr al menos 1 tick del sweep (marca noHumansSince, todavía no cumple CLEANUP_MS)
    const wsD2 = await connect();
    send(wsD2, { type: "resumeSession", refreshToken: rD.session.refreshToken });
    await waitFor(wsD2, "authOk");
    // Ojo: un corte de socket ESTANDO EN EL LOBBY (sala sin arrancar) saca a ese
    // jugador de room.players al instante (ver ws.on("close"), rama
    // "!closedRoom.started" — es un comportamiento previo, correcto e
    // independiente de este sweep: el margen de gracia con "rejoin" es solo
    // para partidas YA EMPEZADAS). Volver a un lobby abandonado es un "join"
    // normal con el mismo código, no un "rejoin".
    send(wsD2, { type: "join", room: roomD, name: "D" });
    const rejoinedD = await waitFor(wsD2, (m) => m.type === "joined" || m.type === "error", 8000);
    check("volver a entrar (mismo código) antes del timeout recupera la sala", rejoinedD.type === "joined" && rejoinedD.code === roomD, JSON.stringify(rejoinedD));
    await sleep(CLEANUP_MS + SWEEP_MS * 2); // si el timer no se hubiera cancelado, acá ya habría borrado la sala
    const stillExistsD = await roomStillExists(wsD2, roomD, rejoinedD.playerId);
    check("con el humano de vuelta, la sala sigue existiendo pasado el timeout original", stillExistsD, "");
    wsD2.close();
  } catch (e) {
    console.error("❌ Error fatal:", e);
    process.exitCode = 1;
  } finally {
    console.log(`\n=== RESUMEN: ${pass} OK / ${fail} fallidas ===`);
    if (fail) process.exitCode = 1;
    await cleanupUser(A_USER.toLowerCase());
    await cleanupUser(B_USER.toLowerCase());
    await cleanupUser(C_USER.toLowerCase());
    await cleanupUser(D_USER.toLowerCase());
    console.log("[cleanup] usuarios de prueba borrados de Supabase.");
    serverProc.kill();
  }
}
main();
