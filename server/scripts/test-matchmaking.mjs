// Matchmaking automático (Casual/Ranked) — colas que emparejan solas, con
// relleno de bots SOLO cuando queda un único humano (nunca se rellena hasta
// 4 a propósito: mínimo 2, máximo 4, la IA es fallback para no dejar a una
// persona sola esperando para siempre). Levanta su PROPIO servidor local
// (puerto aparte) con MATCHMAKING_TICK_MS/MATCH_WAIT_TIMEOUT_MS bajados a
// milisegundos chicos (ver server.js) para no tener que esperar los 30s
// reales de producción.
//
// Cada caso que arma una sala real MANDA LA PARTIDA HASTA "playing" DE
// VERDAD (reveal -> dealDraw -> confirmar fase "playing") — no alcanza con
// chequear started:true, que ya viene en true desde ANTES de "sorteo" (ver
// startGame() en server.js) y por eso un bug real se coló sin que los tests
// viejos lo detectaran: las salas armadas por matchmaking nunca dejaban
// setear room/player (variables de closure de CADA conexión, ver
// ws._applyRoomPlayer) porque formMatchmakingRoom corre desde el timer
// global, no desde el handler de mensajes de esa conexión — reveal/
// dealDraw/draw pisaban el guard `if (!room || !player) return` de cada
// handler y no hacían nada, en silencio, aunque el cliente ya viera la
// sala. Forzar la fase hasta "playing" de verdad es la única forma de que
// un test hubiera agarrado esto.
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
      reject(new Error("timeout esperando " + (typeof matcher === "string" ? matcher : "matcher")));
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

// Empuja una sala YA armada (recién "joined") hasta fase "playing" de
// verdad, mandando reveal/dealDraw desde CADA jugador humano — la prueba
// real de que room/player quedaron bien seteados para esas conexiones.
async function driveToPlaying(humanPlayers, timeoutMs = 10000) {
  const first = humanPlayers[0].ws;
  humanPlayers.forEach((p) => send(p.ws, { type: "reveal" }));
  await waitFor(first, (m) => m.type === "state" && m.phase === "dealing", timeoutMs);
  humanPlayers.forEach((p) => send(p.ws, { type: "dealDraw", all: true }));
  const st = await waitFor(first, (m) => m.type === "state" && m.phase === "playing" && m.started, timeoutMs);
  return st;
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
    // ---------- Caso D: 4 humanos casual -> arranca YA, sin bots, gameplay real funciona ----------
    {
      const players = await Promise.all([1, 2, 3, 4].map(() => registerUser("mmd_")));
      players.forEach((p) => send(p.ws, { type: "queueJoin", mode: "casual", name: "P" }));
      const joined = await Promise.all(players.map((p) => waitFor(p.ws, "joined", 10000)));
      const codes = new Set(joined.map((j) => j.code));
      check("CasoD: los 4 humanos terminan en la MISMA sala", codes.size === 1, "codes=" + JSON.stringify([...codes]));
      const ids = new Set(joined.map((j) => j.playerId));
      check("CasoD: los 4 tienen playerId distintos (4 asientos reales)", ids.size === 4);
      const named = players.map((p, i) => ({ ws: p.ws, id: joined[i].playerId }));
      const st = await driveToPlaying(named);
      check("CasoD: la partida llega a fase playing DE VERDAD (reveal+dealDraw funcionaron)", st.phase === "playing" && st.started === true);
      check("CasoD: arranca con 4 humanos, CERO bots (no se rellena hasta 4)", st.players.length === 4 && st.players.filter((p) => p.isAI).length === 0, JSON.stringify(st.players.map((p) => p.isAI)));
    }

    // ---------- Caso C: 3 humanos casual, timeout -> arranca con 3, SIN bots ----------
    {
      const players = await Promise.all([1, 2, 3].map(() => registerUser("mmc3_")));
      players.forEach((p) => send(p.ws, { type: "queueJoin", mode: "casual", name: "P" }));
      const joined = await Promise.all(players.map((p) => waitFor(p.ws, "joined", TIMEOUT_MS + 8000)));
      const codes = new Set(joined.map((j) => j.code));
      check("CasoC: los 3 humanos terminan en la MISMA sala tras el timeout", codes.size === 1);
      const named = players.map((p, i) => ({ ws: p.ws, id: joined[i].playerId }));
      const st = await driveToPlaying(named);
      check("CasoC: llega a fase playing con los 3 (reveal+dealDraw de los 3 funcionaron)", st.phase === "playing");
      check("CasoC: arranca con exactamente 3 jugadores, CERO bots", st.players.length === 3 && st.players.filter((p) => p.isAI).length === 0, `total=${st.players.length} bots=${st.players.filter((p) => p.isAI).length}`);
    }

    // ---------- Caso B: 2 humanos casual, timeout -> arranca con 2, SIN bots ----------
    {
      const players = await Promise.all([1, 2].map(() => registerUser("mmb2_")));
      players.forEach((p) => send(p.ws, { type: "queueJoin", mode: "casual", name: "P" }));
      const joined = await Promise.all(players.map((p) => waitFor(p.ws, "joined", TIMEOUT_MS + 8000)));
      check("CasoB: los 2 humanos terminan en la MISMA sala tras el timeout", joined[0].code === joined[1].code);
      const named = players.map((p, i) => ({ ws: p.ws, id: joined[i].playerId }));
      const st = await driveToPlaying(named);
      check("CasoB: llega a fase playing con los 2 (reveal+dealDraw de ambos funcionaron)", st.phase === "playing");
      check("CasoB: arranca con exactamente 2 jugadores, CERO bots", st.players.length === 2 && st.players.filter((p) => p.isAI).length === 0, `total=${st.players.length}`);
    }

    // ---------- Caso A: 1 humano, timeout -> exactamente 1 bot (total 2), gameplay funciona ----------
    {
      const p = await registerUser("mma1_", 1000);
      send(p.ws, { type: "queueJoin", mode: "ranked", name: "Solo" });
      const matched = await waitFor(p.ws, "queueMatched", TIMEOUT_MS + 8000);
      check("CasoA: queueMatched informa humanCount=1 (para el \"Completando con IA…\" del cliente)", matched.humanCount === 1, JSON.stringify(matched));
      const j = await waitFor(p.ws, "joined", 5000);
      const st = await driveToPlaying([{ ws: p.ws, id: j.playerId }]);
      check("CasoA: llega a fase playing (reveal+dealDraw del humano funcionaron)", st.phase === "playing");
      check("CasoA: arranca con exactamente 2 jugadores (1 humano + 1 bot), NO se rellena hasta 4", st.players.length === 2 && st.players.filter((pl) => pl.isAI).length === 1, `total=${st.players.length} bots=${st.players.filter((pl) => pl.isAI).length}`);
    }

    // ---------- Ranked: ventana de MMR agrupa a los cercanos, excluye al outlier ----------
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
      check("Ranked-MMR: los 4 más cercanos en rank_pts (1000,1010,1020,1030) quedan en la misma sala", j1.code === j2.code && j2.code === j3.code && j3.code === j4.code, JSON.stringify({ j1: j1.code, j2: j2.code, j3: j3.code, j4: j4.code }));
      const p5GotMatched = await noMessageWithin(p5.ws, (m) => m.type === "joined" && m.code === j1.code, 300);
      check("Ranked-MMR: el outlier (5000 pts) NO entró en ese grupo (ventana angosta al principio)", !p5GotMatched);
      send(p5.ws, { type: "queueLeave" }); // limpieza: no interfiere con el resto del test
    }

    // ---------- Ranked: ventana de MMR se AMPLÍA con el tiempo — dos jugadores lejos igual matchean tras esperar ----------
    {
      const RANGE_ENV_TICK = 300; // este bloque usa su propio server con constantes más chicas para el rango
      const wideServerPort = PORT + 1;
      const wideProc = spawn(process.execPath, ["server.js"], {
        cwd: SERVER_DIR,
        env: { ...process.env, PORT: String(wideServerPort), MATCHMAKING_TICK_MS: String(RANGE_ENV_TICK), MATCH_WAIT_TIMEOUT_MS: "2500", RANKED_RANGE_BASE: "50", RANKED_RANGE_GROWTH_PER_SEC: "2000" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let ready2 = false;
      wideProc.stdout.on("data", (d) => { if (String(d).includes("corriendo")) ready2 = true; });
      for (let i = 0; i < 50 && !ready2; i++) await sleep(200);
      const wideUrl = `ws://localhost:${wideServerPort}`;
      function connectWide() { return new Promise((resolve, reject) => { const ws = new WebSocket(wideUrl); ws._buffer = []; ws._waiters = []; const t = setTimeout(() => reject(new Error("timeout")), 15000); ws.once("open", () => { clearTimeout(t); resolve(ws); }); ws.once("error", reject); ws.on("message", (raw) => { const m = JSON.parse(raw); const wi = ws._waiters.findIndex((w) => w.test(m)); if (wi !== -1) { const w = ws._waiters.splice(wi, 1)[0]; clearTimeout(w.timer); w.resolve(m); } else ws._buffer.push(m); }); }); }
      async function registerWide(prefix, rankPts) {
        const ws = await connectWide();
        const username = (prefix + crypto.randomBytes(5).toString("hex")).slice(0, 16);
        send(ws, { type: "register", username, password: PASS });
        await waitFor(ws, "authOk");
        createdUsernames.push(username.toLowerCase());
        const { data: prof } = await supabase.from("profiles").select("id").ilike("username", username).maybeSingle();
        if (prof) await supabase.from("profiles").update({ rank_pts: rankPts }).eq("id", prof.id);
        return { ws, username };
      }
      try {
        const a = await registerWide("mmw_", 1000);
        const b = await registerWide("mmw_", 1800); // 800 de distancia — fuera del rango base (50), dentro del rango ya ampliado antes del timeout (crece 2000/seg)
        send(a.ws, { type: "queueJoin", mode: "ranked", name: "A" });
        const gotEarly = await noMessageWithin(a.ws, "joined", 200); // recién entró, todavía con rango angosto
        check("Ranked-widen: recién entrado, con rango angosto, NO matchea con alguien lejos", !gotEarly);
        send(b.ws, { type: "queueJoin", mode: "ranked", name: "B" });
        const ja = await waitFor(a.ws, "joined", 3000);
        const jb = await waitFor(b.ws, "joined", 3000);
        check("Ranked-widen: tras esperar, el rango se amplió y matcheó a los dos igual (sin llegar al timeout+bots)", ja.code === jb.code);
        const stw = await driveToPlaying([{ ws: a.ws, id: ja.playerId }, { ws: b.ws, id: jb.playerId }]);
        check("Ranked-widen: la sala resultante llega a fase playing con los 2 (sin bots)", stw.phase === "playing" && stw.players.length === 2 && stw.players.filter((p) => p.isAI).length === 0);
      } finally {
        wideProc.kill();
      }
    }

    // ---------- queueLeave cancela — no matchea después ----------
    {
      const p = await registerUser("mml_", 1000);
      send(p.ws, { type: "queueJoin", mode: "casual", name: "Cancela" });
      await waitFor(p.ws, "queueStatus", 5000);
      send(p.ws, { type: "queueLeave" });
      await waitFor(p.ws, "queueLeft", 5000);
      const gotMatched = await noMessageWithin(p.ws, "joined", TIMEOUT_MS + 3000);
      check("Cancelación: tras cancelar la cola, el jugador NO termina emparejado", !gotMatched);
    }

    // ---------- desconectar en cola no deja un "fantasma" emparejable ----------
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
      check("Fantasma: tras desconectar en cola, otros 4 jugadores igual matchean bien entre sí (sin fantasma)", codes.size === 1, JSON.stringify([...codes]));
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
