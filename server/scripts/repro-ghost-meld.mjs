// Investigación (no forma parte del release) — reproducción real del reporte
// de usuario: "armo un juego en Preparación, lo bajo, pasa el turno, más
// adelante vuelve a ser mi turno y el juego sigue apareciendo en
// Preparación" + "Ficha y pasar no funcionó". Corre contra un servidor real
// (local o TARGET_WS_URL) con 2 clientes reales, deja bajar un grupo válido,
// y audita cada "state" recibido para confirmar si el SERVIDOR alguna vez
// vuelve a incluir esas fichas en myHand (si nunca lo hace, el bug del
// "fantasma" es 100% del lado cliente).
import WebSocket from "ws";
import crypto from "node:crypto";

const WS_URL = process.env.TARGET_WS_URL || "ws://localhost:8181";
const A = ("gm_a_" + crypto.randomBytes(4).toString("hex")).slice(0, 16);
const B = ("gm_b_" + crypto.randomBytes(4).toString("hex")).slice(0, 16);
const PASS = "TestPass000";

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const t = setTimeout(() => reject(new Error("timeout")), 15000);
    ws.once("open", () => { clearTimeout(t); resolve(ws); });
    ws.once("error", reject);
  });
}
function send(ws, obj) { ws.send(JSON.stringify(obj)); }
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
// Para la salida (primera bajada de la partida) Burako exige 30+ puntos —
// un grupo de 3 fichas del mismo número necesita número>=10 para llegar solo.
function findGroupOf3(hand, minValue = 30) {
  const byNum = {};
  for (const t of hand) { if (t.joker) continue; (byNum[t.number] = byNum[t.number] || []).push(t); }
  for (const num of Object.keys(byNum).sort((a, b) => b - a)) {
    if (Number(num) * 3 < minValue) continue;
    const seenColors = new Set(); const pick = [];
    for (const t of byNum[num]) { if (!seenColors.has(t.color)) { seenColors.add(t.color); pick.push(t); } }
    if (pick.length >= 3) return pick.slice(0, 3);
  }
  return null;
}

async function main() {
  console.log(`=== Repro ghost meld / Ficha y pasar (${WS_URL}) ===\n`);
  const wsA = await connect();
  send(wsA, { type: "register", username: A, password: PASS });
  await waitFor(wsA, "authOk");
  const wsB = await connect();
  send(wsB, { type: "register", username: B, password: PASS });
  await waitFor(wsB, "authOk");

  send(wsA, { type: "join", room: "NUEVA", name: "A", gameMode: "casual" });
  const joinedA = await waitFor(wsA, "joined");
  const roomCode = joinedA.code, aId = joinedA.playerId;
  send(wsB, { type: "join", room: roomCode, name: "B", gameMode: "casual" });
  const joinedB = await waitFor(wsB, "joined");
  const bId = joinedB.playerId;
  send(wsA, { type: "setReady", ready: true });
  send(wsB, { type: "setReady", ready: true });
  await waitFor(wsB, "state");
  send(wsA, { type: "start" });
  await waitFor(wsA, (m) => m.type === "state" && m.phase === "sorteo", 10000);
  send(wsA, { type: "reveal" });
  send(wsB, { type: "reveal" });
  await waitFor(wsA, (m) => m.type === "state" && m.phase === "dealing", 10000);
  send(wsA, { type: "dealDraw", all: true });
  send(wsB, { type: "dealDraw", all: true });
  let stateA = await waitFor(wsA, (m) => m.type === "state" && m.phase === "playing", 10000);
  console.log("Fase mesa alcanzada. players orden:", stateA.players.map(p => p.id === aId ? "A" : "B").join(","));

  wsA.on("message", (raw) => {
    const m = JSON.parse(raw);
    if (m.type === "error") console.log(`[ERROR->A] ${m.msg}`);
  });
  wsB.on("message", (raw) => {
    const m = JSON.parse(raw);
    if (m.type === "error") console.log(`[ERROR->B] ${m.msg}`);
  });

  const isATurn = (st) => st.players[st.currentIdx] && st.players[st.currentIdx].id === aId;

  let group = null, guard = 0;
  while (guard++ < 80 && !group) {
    group = findGroupOf3(stateA.myHand);
    if (group) break;
    if (isATurn(stateA)) {
      send(wsA, { type: "draw" });
    } else {
      send(wsB, { type: "draw" });
    }
    stateA = await waitFor(wsA, "state", 8000);
  }
  if (!group) { console.log("❌ No se encontró grupo jugable en 80 vueltas, aborto."); process.exit(1); }
  console.log("A tiene grupo jugable:", group.map(t => `${t.color}${t.number}`).join(" "), "- es turno de A ahora?", isATurn(stateA));

  // Asegurar que es el turno de A antes de intentar el lay.
  guard = 0;
  while (!isATurn(stateA) && guard++ < 20) {
    send(wsB, { type: "draw" });
    stateA = await waitFor(wsA, "state", 8000);
  }
  if (!isATurn(stateA)) { console.log("❌ No se pudo esperar el turno de A."); process.exit(1); }

  console.log("\n--- Bajando el grupo con layMultiple ---");
  send(wsA, { type: "layMultiple", groups: [group.map(t => t.id)] });
  const afterLay = await waitFor(wsA, (m) => m.type === "state" || m.type === "error", 8000);
  if (afterLay.type === "error") { console.log("❌ El server RECHAZÓ el lay:", afterLay.msg); process.exit(1); }
  const stillHasPlayed = group.some(g => afterLay.myHand.some(t => t.id === g.id));
  console.log("✅ Lay aceptado. myHand después:", afterLay.myHand.length, "fichas — ¿todavía incluye alguna del grupo jugado?", stillHasPlayed);
  stateA = afterLay;

  console.log("\n--- Dando varias vueltas más para ver si el server ALGUNA VEZ vuelve a mandar esas fichas en myHand ---");
  let everReappeared = false;
  for (let i = 0; i < 6; i++) {
    if (isATurn(stateA)) send(wsA, { type: "draw" }); else send(wsB, { type: "draw" });
    stateA = await waitFor(wsA, "state", 8000).catch(() => stateA);
    const reappeared = group.some(g => stateA.myHand.some(t => t.id === g.id));
    if (reappeared) everReappeared = true;
    console.log(`vuelta ${i}: ¿fichas jugadas reaparecen en myHand?`, reappeared);
  }

  console.log("\n=== Conclusión ===");
  console.log(everReappeared
    ? "🔴 El SERVIDOR volvió a mandar las fichas jugadas en myHand — bug real del lado servidor."
    : "🟢 El servidor NUNCA volvió a mandar esas fichas — el 'fantasma' reportado es 100% responsabilidad de la reconciliación del lado CLIENTE (netApplyState / G.workGroups).");
  wsA.close(); wsB.close();
}
main().catch(e => { console.error("Error fatal:", e); process.exit(1); });
