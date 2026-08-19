// Matchmaking automático (Casual/Ranked) — colas que emparejan solas, con
// relleno de bots si no aparecen suficientes rivales a tiempo. Levanta su
// PROPIO servidor local (puerto aparte) con MATCHMAKING_TICK_MS/
// MATCH_WAIT_TIMEOUT_MS bajados a milisegundos chicos (ver server.js) para
// no tener que esperar los 20s reales de producción.
import WebSocket from "ws";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.join(__dirname, "..");
const PORT = 8198; // puerto aparte, distinto del de test-rooms.mjs (8199) y el normal (8181)
const WS_URL = `ws://localhost:${PORT}`;
const TICK_MS = 400, TIMEOUT_MS = 2000; // rápido, solo para este test
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
      reject(new Error("timeout esperando " + matcher));
    }, ms) };
    ws._waiters.push(waiter);
  });
}
function noMessageWithin(ws, matcher, ms) {
  return waitFor(ws, matcher, ms).then(() => true, () => false);
}

async function registerUser(prefix, rankPts) {
  const ws = await connect();
  const username = (prefix + crypto.randomBytes(5).toString("hex")).slice(0, 16);
  send(ws, { type: "register", username, password: PASS });
  await waitFor(ws, "authOk");
  createdUsernames.push(username.toLowerCase());
  if (rankPts != null) {
    const { data: prof } = await supabase.from("profiles").select("id").ilike("username", username).maybeSingle();
    if (prof) await supabase.from("profiles").update({ rank_pts: rankPts }).eq("id", prof.id);
  }
  return { ws, username };
}

async function main() {
  console.log(`=== Matchmaking automático (${WS_URL}) ===\n`);

  const serverProc = spawn(process.execPath, ["server.js"], {
    cwd: SERVER_DIR,
    env: { ...process.env, PORT: String(PORT), MATCHMAKING_TICK_MS: String(TICK_MS), MATCH_WAIT_TIMEOUT_MS: String(TIMEOUT_MS) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverReady = false;
  serverProc.stdout.on("data", (d) => { if (String(d).includes("corriendo")) serverReady = true; if (process.env.DEBUG_MM) process.stdout.write(String(d)); });
  serverProc.stderr.on("data", (d) => console.error("[server stderr]", String(d).trim()));
  for (let i = 0; i < 50 && !serverReady; i++) await sleep(200);
  if (!serverReady) { console.error("❌ el servidor local de prueba no arrancó a tiempo"); process.exitCode = 1; serverProc.kill(); return; }
  console.log("[setup] servidor listo.\n");

  try {
    // ---------- Caso 1: 4 casual en cola se emparejan entre sí ----------
    {
      const players = await Promise.all([1, 2, 3, 4].map(() => registerUser("mmc_")));
      players.forEach((p) => send(p.ws, { type: "queueJoin", mode: "casual", name: "P" }));
      const joined = await Promise.all(players.map((p) => waitFor(p.ws, "joined", 10000)));
      const codes = new Set(joined.map((j) => j.code));
      check("Caso1: los 4 jugadores de la cola casual terminan en la MISMA sala", codes.size === 1, "codes=" + JSON.stringify([...codes]));
      const ids = new Set(joined.map((j) => j.playerId));
      check("Caso1: los 4 tienen playerId distintos (4 asientos reales, no bots)", ids.size === 4);
    }

    // ---------- Caso 2: ranked empareja por cercanía de rank_pts ----------
    {
      const p1 = await registerUser("mmr_", 1000);
      const p2 = await registerUser("mmr_", 1010);
      const p3 = await registerUser("mmr_", 1020);
      const p4 = await registerUser("mmr_", 1030);
      const p5 = await registerUser("mmr_", 5000); // outlier — no debería entrar en el grupo de los otros 4
      send(p1.ws, { type: "queueJoin", mode: "ranked", name: "P1" });
      await sleep(50); // asegura que p1 sea el más antiguo (ancla) de forma determinística
      [p2, p3, p4, p5].forEach((p) => send(p.ws, { type: "queueJoin", mode: "ranked", name: "P" }));
      const j1 = await waitFor(p1.ws, "joined", 10000);
      const j2 = await waitFor(p2.ws, "joined", 10000);
      const j3 = await waitFor(p3.ws, "joined", 10000);
      const j4 = await waitFor(p4.ws, "joined", 10000);
      check("Caso2: los 4 más cercanos en rank_pts (1000,1010,1020,1030) quedan en la misma sala", j1.code === j2.code && j2.code === j3.code && j3.code === j4.code, JSON.stringify({ j1: j1.code, j2: j2.code, j3: j3.code, j4: j4.code }));
      const p5GotMatched = await noMessageWithin(p5.ws, (m) => m.type === "joined" && m.code === j1.code, 300);
      check("Caso2: el outlier (5000 pts) NO entró en ese grupo", !p5GotMatched);
      // limpieza: p5 se queda solo en cola — lo saca el timeout+bots más abajo, cancelamos explícito para no interferir con el resto del test.
      send(p5.ws, { type: "queueLeave" });
    }

    // ---------- Caso 3: 1 solo jugador ranked, timeout -> arranca con bots hasta 4 ----------
    {
      const p = await registerUser("mms_", 1000);
      send(p.ws, { type: "queueJoin", mode: "ranked", name: "Solo" });
      const j = await waitFor(p.ws, "joined", TIMEOUT_MS + 8000);
      const st = await waitFor(p.ws, (m) => m.type === "state" && m.started, 10000);
      check("Caso3: con timeout y sin rivales, la partida arranca igual (started=true)", st.started === true);
      const bots = st.players.filter((pl) => pl.isAI);
      check("Caso3: se completó hasta 4 jugadores con bots de relleno", st.players.length === 4 && bots.length === 3, `total=${st.players.length} bots=${bots.length}`);
    }

    // ---------- Caso 4: queueLeave cancela — no matchea después ----------
    {
      const p = await registerUser("mml_", 1000);
      send(p.ws, { type: "queueJoin", mode: "casual", name: "Cancela" });
      await waitFor(p.ws, "queueStatus", 5000);
      send(p.ws, { type: "queueLeave" });
      await waitFor(p.ws, "queueLeft", 5000);
      const gotMatched = await noMessageWithin(p.ws, "joined", TIMEOUT_MS + 3000);
      check("Caso4: tras cancelar la cola, el jugador NO termina emparejado", !gotMatched);
    }

    // ---------- Caso 5: desconectar en cola no deja un "fantasma" emparejable ----------
    {
      const ghost = await registerUser("mmg_", 1000);
      send(ghost.ws, { type: "queueJoin", mode: "casual", name: "Fantasma" });
      await waitFor(ghost.ws, "queueStatus", 5000);
      ghost.ws.close();
      await sleep(300);
      // 4 jugadores nuevos deberían poder emparejarse entre sí sin que el server cuelgue/rompa por el fantasma.
      const players = await Promise.all([1, 2, 3, 4].map(() => registerUser("mmg2_")));
      players.forEach((pl) => send(pl.ws, { type: "queueJoin", mode: "casual", name: "P" }));
      const joined = await Promise.all(players.map((pl) => waitFor(pl.ws, "joined", 10000)));
      const codes = new Set(joined.map((j) => j.code));
      check("Caso5: tras desconectar en cola, otros 4 jugadores igual matchean bien entre sí (sin fantasma)", codes.size === 1, JSON.stringify([...codes]));
      players.forEach((pl) => pl.ws.close());
    }
  } catch (e) {
    check("matchmaking: corrió sin excepciones", false, e.message);
  }

  console.log(`\n=== RESUMEN: ${pass} OK / ${fail} fallidas ===`);
  if (fail) process.exitCode = 1;
  for (const u of createdUsernames) await cleanupUser(u);
  console.log("[cleanup] usuarios de prueba borrados de Supabase.");
  serverProc.kill();
  process.exit(process.exitCode || 0);
}
main().catch((e) => { console.error("❌ Error fatal:", e); process.exitCode = 1; process.exit(1); });
