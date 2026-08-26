// Test de integración (Fase 4A, docs/ai/AUDIT-SESSION-ARCHITECTURE.md /
// docs/ai/FROM-CLAUDE.md) — confirma en vivo, contra un servidor real que
// este script levanta/mata él mismo (puerto propio) y Supabase real, que la
// race de mensajes confirmada en la Fase 0 (un mensaje gateado en authUser
// evaluado ANTES de que resumeSession termine) desapareció.
//
// La resiliencia genérica de la cola ante errores/orden/aislamiento por
// socket ya está cubierta con un test unitario puro aparte
// (test-serial-queue-unit.mjs) — acá el foco es el comportamiento real
// sobre el protocolo WS.
import WebSocket from "ws";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.join(__dirname, "..");
const PORT = 8185; // puerto propio, distinto de los demás tests con servidor dedicado (8183/8198/8199)
const WS_URL = `ws://localhost:${PORT}`;
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

function startServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ["server.js"], {
      cwd: SERVER_DIR,
      env: { ...process.env, PORT: String(PORT) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let ready = false;
    const t = setTimeout(() => { if (!ready) reject(new Error("el servidor no arrancó a tiempo")); }, 10000);
    proc.stdout.on("data", (d) => { if (!ready && String(d).includes("corriendo")) { ready = true; clearTimeout(t); resolve(proc); } });
    proc.stderr.on("data", (d) => console.error("[server stderr]", String(d).trim()));
    proc.on("exit", () => {});
  });
}

async function main() {
  console.log(`=== Fase 4A — serialización de mensajes por socket (${WS_URL}) ===\n`);
  const serverProc = await startServer();
  console.log("[setup] servidor de prueba listo en puerto " + PORT + "\n");

  try {
    // =============================================================
    // Caso base para todos los escenarios "resumeSession + X en el mismo
    // tick": registrar, cerrar esa conexión, abrir una NUEVA (así
    // resumeSession() de verdad tiene que ir a buscar la sesión a Supabase,
    // reproduciendo la ventana real de la race).
    // =============================================================
    async function freshTokenUser(prefix) {
      const reg = await registerUser(prefix);
      reg.ws.close();
      await sleep(200);
      return reg;
    }

    // ---------------------------------------------------------------
    // 1) resumeSession + dailyStatus en el MISMO tick — EXACTAMENTE el
    // caso que la Fase 0 confirmó roto en vivo (log real del servidor:
    // dailyStatus rechazado 454ms ANTES de que resumeSession terminara).
    // ---------------------------------------------------------------
    {
      const { refreshToken } = await freshTokenUser("s4a");
      const ws2 = await connect();
      send(ws2, { type: "resumeSession", refreshToken });
      send(ws2, { type: "dailyStatus" }); // sin esperar la respuesta de resumeSession — a propósito
      const dailyRes = await waitFor(ws2, (m) => m.type === "dailyStatus" || (m.type === "error" && /logueado/i.test(m.msg || "")));
      const authRes = await waitFor(ws2, "authOk");
      check("Esc.1: resumeSession+dailyStatus en el mismo tick — dailyStatus YA NO es rechazado por falta de auth", dailyRes.type === "dailyStatus", JSON.stringify(dailyRes));
      check("Esc.1: resumeSession de todas formas confirma bien la sesión", authRes.type === "authOk");
      ws2.close();
    }

    // ---------------------------------------------------------------
    // 2) resumeSession + catalog en el mismo tick
    // ---------------------------------------------------------------
    {
      const { refreshToken } = await freshTokenUser("s4a");
      const ws2 = await connect();
      send(ws2, { type: "resumeSession", refreshToken });
      send(ws2, { type: "catalog" });
      const catalogRes = await waitFor(ws2, (m) => m.type === "catalog" || (m.type === "error" && /logueado/i.test(m.msg || "")));
      check("Esc.2: resumeSession+catalog en el mismo tick — catalog responde normal (catalog no depende de authUser, pero confirma que no se rompió nada en la cola)", catalogRes.type === "catalog", JSON.stringify(catalogRes));
      await waitFor(ws2, "authOk");
      ws2.close();
    }

    // ---------------------------------------------------------------
    // 3) resumeSession + creación de sala en el mismo tick
    // ---------------------------------------------------------------
    {
      const { refreshToken, username } = await freshTokenUser("s4a");
      const ws2 = await connect();
      send(ws2, { type: "resumeSession", refreshToken });
      send(ws2, { type: "join", room: "NUEVA", name: username, gameMode: "casual" });
      const joinRes = await waitFor(ws2, (m) => m.type === "joined" || (m.type === "error"));
      check("Esc.3: resumeSession+join(NUEVA) en el mismo tick — la sala se crea, no se rechaza por falta de auth", joinRes.type === "joined", JSON.stringify(joinRes));
      await waitFor(ws2, "authOk");
      ws2.close();
    }

    // ---------------------------------------------------------------
    // 4) varios mensajes normales rápidos DESPUÉS de autenticarse — deben
    // procesarse todos y en orden, sin que ninguno se pierda ni se mezcle.
    // ---------------------------------------------------------------
    {
      const { ws } = await registerUser("s4a");
      send(ws, { type: "catalog" });
      send(ws, { type: "dailyStatus" });
      send(ws, { type: "towerStatus" });
      send(ws, { type: "leaderboard" });
      const r1 = await waitFor(ws, "catalog");
      const r2 = await waitFor(ws, "dailyStatus");
      const r3 = await waitFor(ws, "towerStatus");
      const r4 = await waitFor(ws, "leaderboard");
      check("Esc.4: 4 mensajes normales rápidos tras autenticarse — todos responden con su tipo correcto", r1.type === "catalog" && r2.type === "dailyStatus" && r3.type === "towerStatus" && r4.type === "leaderboard");
      ws.close();
    }

    // ---------------------------------------------------------------
    // 5) dos sockets DISTINTOS mandando mensajes a la vez — deben seguir
    // procesándose en paralelo (la serialización es por socket, no global;
    // un socket lento no debe frenar al otro).
    // ---------------------------------------------------------------
    {
      const u1 = await registerUser("s4a");
      const u2 = await registerUser("s4a");
      const t0 = Date.now();
      send(u1.ws, { type: "catalog" });
      send(u2.ws, { type: "catalog" });
      const [r1, r2] = await Promise.all([waitFor(u1.ws, "catalog"), waitFor(u2.ws, "catalog")]);
      const elapsed = Date.now() - t0;
      check("Esc.5: dos sockets distintos responden ambos", r1.type === "catalog" && r2.type === "catalog");
      // Si estuvieran serializados entre sí (cola global, no por socket),
      // no necesariamente se notaría en el tiempo con un solo mensaje cada
      // uno — la prueba de fondo real es Esc.4 vs. este caso: acá además se
      // confirma que ninguno tuvo que esperar al otro más allá de lo normal.
      check("Esc.5: el tiempo total no sugiere que se hayan puesto en fila uno detrás del otro", elapsed < 5000, "elapsed=" + elapsed + "ms");
      u1.ws.close(); u2.ws.close();
    }

    // ---------------------------------------------------------------
    // 6) handler que lanza una excepción -> el siguiente mensaje del MISMO
    // socket sigue funcionando. La resiliencia genérica de la cola ante
    // errores ya está probada de forma aislada y rigurosa en
    // test-serial-queue-unit.mjs; acá solo se confirma que, tal como está
    // hoy el protocolo real (validado defensivamente en casi todos los
    // handlers — ver server.js/db.js), un mensaje con un type desconocido
    // (que no matchea ningún handler) no deja a la cola de ese socket
    // inutilizable para el siguiente mensaje real.
    // ---------------------------------------------------------------
    {
      const { ws } = await registerUser("s4a");
      send(ws, { type: "esto-no-existe-como-mensaje" });
      send(ws, { type: "catalog" });
      const r = await waitFor(ws, "catalog");
      check("Esc.6: un mensaje con type desconocido no deja la cola de ese socket rota para el siguiente mensaje real", r.type === "catalog");
      ws.close();
    }

    // ---------------------------------------------------------------
    // 7) socket cerrado con mensajes pendientes — sin crash, sin fuga. Se
    // confirma indirectamente: el servidor sigue vivo y atendiendo
    // conexiones NUEVAS con normalidad después de esto.
    // ---------------------------------------------------------------
    {
      const { refreshToken } = await freshTokenUser("s4a");
      const ws2 = await connect();
      send(ws2, { type: "resumeSession", refreshToken }); // real round-trip a Supabase, todavía en vuelo
      ws2.close(); // cerramos ANTES de que llegue la respuesta
      await sleep(1000);
      const probe = await registerUser("s4a"); // si el server se hubiera caído o quedado trabado, esto fallaría
      check("Esc.7: cerrar un socket con un mensaje real todavía pendiente no tira abajo al servidor (conexión nueva funciona normal después)", !!probe.refreshToken);
      probe.ws.close();
    }

    // ---------------------------------------------------------------
    // 8) Repetición EXACTA del experimento de la Fase 0 que confirmó la
    // race en vivo (mismo patrón: resumeSession + dailyStatus sin esperar),
    // repetido varias veces seguidas para no depender de una sola corrida.
    // ---------------------------------------------------------------
    {
      let allOk = true;
      for (let i = 0; i < 5; i++) {
        const { refreshToken } = await freshTokenUser("s4a");
        const ws2 = await connect();
        send(ws2, { type: "resumeSession", refreshToken });
        send(ws2, { type: "dailyStatus" });
        const dailyRes = await waitFor(ws2, (m) => m.type === "dailyStatus" || m.type === "error");
        if (dailyRes.type !== "dailyStatus") { allOk = false; console.log("  [Esc.8] intento " + (i + 1) + " FALLÓ:", JSON.stringify(dailyRes)); }
        ws2.close();
        await sleep(150);
      }
      check("Esc.8: repetición de la Fase 0 (5 corridas seguidas) — la race YA NO se reproduce ni una vez", allOk);
    }
  } finally {
    serverProc.kill();
    for (const u of createdUsernames) await cleanupUser(u);
  }

  console.log(`\n=== RESUMEN: ${pass} OK / ${fail} fallidas ===`);
  if (fail) process.exitCode = 1;
}
main().catch((e) => { console.error("❌ Error fatal:", e); process.exitCode = 1; });
