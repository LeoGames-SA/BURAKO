// Etapa 5 — prueba real de punta a punta contra la URL pública de Render
// (wss://, Supabase real, dos clientes reales por WebSocket). No usa mocks:
// registra 2 usuarios de prueba, crea una sala, une un segundo cliente,
// pasa sorteo y reparto, llega a la mesa, prueba una reconexión básica, y
// termina la partida (uno se rinde) para verificar que XP/monedas/stats
// persisten en Supabase — y que NO se duplican (bug de doble resolución
// encontrado y corregido en esta misma etapa).
import WebSocket from "ws";
import crypto from "node:crypto";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const WS_URL = process.env.TARGET_WS_URL || "wss://burako-server.onrender.com";
const A_USER = ("e5a_" + crypto.randomBytes(5).toString("hex")).slice(0, 16);
const B_USER = ("e5b_" + crypto.randomBytes(5).toString("hex")).slice(0, 16);
const PASS = "TestPass789";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { console.log("✅ " + name); pass++; }
  else { console.log("❌ " + name + (detail ? " — " + detail : "")); fail++; }
}

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const t = setTimeout(() => reject(new Error("timeout conectando a " + WS_URL)), 15000);
    ws.once("open", () => { clearTimeout(t); resolve(ws); });
    ws.once("error", reject);
  });
}
function send(ws, obj) { ws.send(JSON.stringify(obj)); }
// Espera el próximo mensaje cuyo type matchee el predicado (string o función).
function waitFor(ws, matcher, ms = 15000) {
  const test = typeof matcher === "function" ? matcher : (m) => m.type === matcher;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { ws.off("message", onMsg); reject(new Error("timeout esperando " + matcher)); }, ms);
    function onMsg(raw) {
      const m = JSON.parse(raw);
      if (test(m)) { clearTimeout(t); ws.off("message", onMsg); resolve(m); }
    }
    ws.on("message", onMsg);
  });
}
async function cleanupUser(usernameLower) {
  const { data } = await supabase.from("profiles").select("id").ilike("username", usernameLower).maybeSingle();
  if (data) await supabase.auth.admin.deleteUser(data.id);
}

async function main() {
  console.log(`=== Etapa 5 — prueba end-to-end contra producción (${WS_URL}) ===\n`);
  await cleanupUser(A_USER.toLowerCase());
  await cleanupUser(B_USER.toLowerCase());

  // --- Registro de los 2 usuarios de prueba, cada uno en su propia conexión ---
  const wsA = await connect();
  send(wsA, { type: "register", username: A_USER, password: PASS });
  const rA = await waitFor(wsA, (m) => m.type === "authOk" || m.type === "error");
  check("registro jugador A contra producción", rA.type === "authOk", JSON.stringify(rA));

  const wsB = await connect();
  send(wsB, { type: "register", username: B_USER, password: PASS });
  const rB = await waitFor(wsB, (m) => m.type === "authOk" || m.type === "error");
  check("registro jugador B contra producción", rB.type === "authOk", JSON.stringify(rB));

  const coinsABefore = rA.profile?.coins, coinsBBefore = rB.profile?.coins;

  // --- A crea sala, B se une ---
  send(wsA, { type: "join", room: "NUEVA", name: "TestA", gameMode: "casual" });
  const joinedA = await waitFor(wsA, "joined");
  const roomCode = joinedA.code;
  check("A crea sala", !!roomCode, JSON.stringify(joinedA));

  send(wsB, { type: "join", room: roomCode, name: "TestB", gameMode: "casual" });
  const joinedB = await waitFor(wsB, (m) => m.type === "joined" || m.type === "error");
  check("B se une a la sala de A", joinedB.type === "joined", JSON.stringify(joinedB));
  const bPlayerId = joinedB.playerId;

  // --- Ambos listos, A arranca ---
  send(wsA, { type: "setReady", ready: true });
  send(wsB, { type: "setReady", ready: true });
  await waitFor(wsB, (m) => m.type === "state"); // deja asentar el broadcast de ready
  send(wsA, { type: "start" });
  const sorteoState = await waitFor(wsA, (m) => m.type === "state" && m.phase === "sorteo", 10000);
  check("la partida arranca y entra en fase de sorteo", sorteoState.phase === "sorteo", JSON.stringify(sorteoState.phase));

  // --- Sorteo: ambos revelan ---
  send(wsA, { type: "reveal" });
  send(wsB, { type: "reveal" });
  const dealingState = await waitFor(wsA, (m) => m.type === "state" && m.phase === "dealing", 10000);
  check("sorteo completo -> pasa a reparto (dealing)", dealingState.phase === "dealing", JSON.stringify(dealingState.phase));

  // --- Reparto: ambos agarran toda su mano ---
  send(wsA, { type: "dealDraw", all: true });
  send(wsB, { type: "dealDraw", all: true });
  const playingState = await waitFor(wsA, (m) => m.type === "state" && m.phase === "playing", 10000);
  check("reparto completo -> llega a la mesa (playing)", playingState.phase === "playing" && playingState.myHand.length === 14, "phase=" + playingState.phase + " handLen=" + playingState.myHand?.length);

  // --- Reconexión básica: B cierra su conexión y vuelve a entrar con "rejoin" ---
  wsB.close();
  await new Promise((r) => setTimeout(r, 2000));
  const wsB2 = await connect();
  send(wsB2, { type: "login", username: B_USER, password: PASS });
  await waitFor(wsB2, "authOk");
  send(wsB2, { type: "rejoin", room: roomCode, playerId: bPlayerId });
  const rejoined = await waitFor(wsB2, (m) => m.type === "joined" || m.type === "error");
  check("B se reconecta a la partida en curso (rejoin)", rejoined.type === "joined" && rejoined.playerId === bPlayerId, JSON.stringify(rejoined));
  const rejoinState = await waitFor(wsB2, (m) => m.type === "state", 10000);
  check("el estado recuperado tras reconectar sigue en fase playing con la mano completa", rejoinState.phase === "playing" && rejoinState.myHand.length === 14, "phase=" + rejoinState.phase + " handLen=" + rejoinState.myHand?.length);

  // --- Terminar la partida: B se rinde (camino real y válido de fin de partida) ---
  send(wsB2, { type: "surrender" });
  const matchResultA = await waitFor(wsA, "matchResult", 10000);
  check("A recibe matchResult (ganó por rendición de B)", matchResultA.won === true && matchResultA.update, JSON.stringify(matchResultA).slice(0, 300));
  const matchResultB = await waitFor(wsB2, "matchResult", 10000);
  check("B recibe SU PROPIO matchResult (se rindió)", matchResultB.iSurrendered === true && matchResultB.update, JSON.stringify(matchResultB).slice(0, 300));

  // --- Verificar persistencia real en Supabase (no solo lo que vino por WS) ---
  await new Promise((r) => setTimeout(r, 1500)); // margen para que terminen los await internos del server
  const { data: profA } = await supabase.from("profiles").select("*").ilike("username", A_USER).maybeSingle();
  const { data: profB } = await supabase.from("profiles").select("*").ilike("username", B_USER).maybeSingle();
  check("perfil de A persistido en Supabase con 1 partida jugada y 1 ganada", profA && profA.games === 1 && profA.wins === 1, JSON.stringify(profA && { games: profA.games, wins: profA.wins, coins: profA.coins }));
  check("perfil de B persistido en Supabase con 1 partida jugada, 0 ganadas (SIN duplicar)", profB && profB.games === 1 && profB.wins === 0, JSON.stringify(profB && { games: profB.games, wins: profB.wins, coins: profB.coins }));
  check("las monedas de A subieron respecto al registro (ganó la partida)", profA && profA.coins > coinsABefore, `antes=${coinsABefore} despues=${profA?.coins}`);
  // games===1/wins===0 arriba ya prueba que resolveMatch corrió UNA sola vez
  // para B (si se hubiera duplicado, games sería 2). Acá solo se registra el
  // delta real para que quede en el log, sin asumir un monto fijo (varía según
  // qué logros dispare "primera partida", que también suman una sola vez).
  console.log(`   (info) delta de monedas de B: ${profB ? profB.coins - coinsBBefore : "?"}`);

  console.log(`\n=== RESUMEN: ${pass} OK / ${fail} fallidas ===`);
  if (fail) process.exitCode = 1;

  try { wsA.close(); } catch (e) {}
  try { wsB2.close(); } catch (e) {}
  await cleanupUser(A_USER.toLowerCase());
  await cleanupUser(B_USER.toLowerCase());
  console.log("[cleanup] usuarios de prueba borrados de Supabase.");
}

main().catch((e) => { console.error("❌ Error fatal:", e); process.exitCode = 1; });
