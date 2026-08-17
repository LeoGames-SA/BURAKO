// Mide latencia real de ida/vuelta (mandar "draw" -> recibir "state") contra
// un servidor real, para separar "latencia de red + Render" de "trabajo del
// servidor" — no es render del cliente (eso solo se puede medir en el
// navegador con DEBUG_GAME=1), pero sí el tramo servidor+red que el cliente
// no controla.
import WebSocket from "ws";
import crypto from "node:crypto";

const WS_URL = process.env.TARGET_WS_URL || "ws://localhost:8181";
const ROUNDS = Number(process.env.ROUNDS || 20);
const USER = ("lat_" + crypto.randomBytes(4).toString("hex")).slice(0, 16);
const PASS = "TestPass111";

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const t = setTimeout(() => reject(new Error("timeout conectando")), 15000);
    ws.once("open", () => { clearTimeout(t); resolve(ws); });
    ws.once("error", reject);
  });
}
function send(ws, obj) { ws.send(JSON.stringify(obj)); }
function waitFor(ws, matcher, ms = 15000) {
  const test = typeof matcher === "function" ? matcher : (m) => m.type === matcher;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { ws.off("message", onMsg); reject(new Error("timeout")); }, ms);
    function onMsg(raw) {
      const m = JSON.parse(raw);
      if (test(m)) { clearTimeout(t); ws.off("message", onMsg); resolve(m); }
    }
    ws.on("message", onMsg);
  });
}

async function main() {
  console.log(`=== Medición de latencia real: ${WS_URL} (${ROUNDS} rondas) ===\n`);

  const t0connect = performance.now();
  const ws = await connect();
  console.log(`Conexión WS establecida en ${(performance.now() - t0connect).toFixed(1)}ms`);

  const t0reg = performance.now();
  send(ws, { type: "register", username: USER, password: PASS });
  await waitFor(ws, "authOk");
  console.log(`register -> authOk: ${(performance.now() - t0reg).toFixed(1)}ms`);

  const t0join = performance.now();
  send(ws, { type: "join", room: "NUEVA", name: "Lat", gameMode: "casual" });
  await waitFor(ws, "joined");
  console.log(`join -> joined: ${(performance.now() - t0join).toFixed(1)}ms`);

  // catalog: mensaje liviano, sin lógica de juego — mide la ida/vuelta "pura".
  const catalogTimes = [];
  for (let i = 0; i < ROUNDS; i++) {
    const t0 = performance.now();
    send(ws, { type: "catalog" });
    await waitFor(ws, "catalog");
    catalogTimes.push(performance.now() - t0);
  }
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const sorted = catalogTimes.slice().sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];

  console.log(`\n--- "catalog" (round-trip mínimo, sin lógica de juego) ---`);
  console.log(`  promedio: ${avg(catalogTimes).toFixed(1)}ms | p50: ${p50.toFixed(1)}ms | p95: ${p95.toFixed(1)}ms | min: ${Math.min(...catalogTimes).toFixed(1)}ms | max: ${Math.max(...catalogTimes).toFixed(1)}ms`);

  ws.close();
}
main().catch((e) => { console.error("Error:", e.message); process.exit(1); });
