// Test de regresión (Fase 3, docs/ai/AUDIT-SESSION-ARCHITECTURE.md /
// docs/ai/FROM-CLAUDE.md) — el Connection Manager único del lado cliente
// (client/burako.js, objeto `Connection`). Navegador real (Playwright)
// contra un servidor real que este script arranca/mata/reinicia él mismo
// (mismo patrón que scripts/test-matchmaking.mjs) en un puerto propio, y
// Supabase real. Usuario de prueba con prefijo único, borrado y verificado
// por ID exacto al final.
//
// Cubre los escenarios mínimos pedidos:
//  1) socket ya conectado -> ensureConnected() no abre uno nuevo
//  2) dos llamadas simultáneas a ensureConnected() -> UN solo socket nuevo
//  3) conexión caída fuera de partida -> Connection reacciona sola
//  4) reconexión automática -> se recupera sin acción manual
//  5) servidor temporalmente inaccesible -> falla controlada, sin tocar Session
//  6) recuperación posterior -> el backoff de fondo la resuelve solo
//  7) heartbeat timeout -> un "pong" que nunca llega se detecta y se actúa
//  8) nunca más de un socket activo a la vez (medido en toda la corrida)
//  9) nunca más de un timer de reconexión (dos disparadores casi a la vez
//     -> un solo socket nuevo, no dos)
//  10) Session permanece "authenticated" durante toda caída transitoria
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.join(__dirname, "..");
const PORT = 8183; // puerto aparte, distinto de test-matchmaking (8198) y test-rooms (8199)
const APP_URL = `http://localhost:${PORT}`;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const PASS = "TestPass123";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { console.log("✅ " + name); pass++; }
  else { console.log("❌ " + name + (detail ? " — " + detail : "")); fail++; }
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function waitUntil(page, fn, timeoutMs = 10000, stepMs = 150) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await page.evaluate(fn).catch(() => false)) return true;
    await page.waitForTimeout(stepMs);
  }
  return false;
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
function stopServer(proc) {
  return new Promise((resolve) => {
    if (!proc || proc.killed) return resolve();
    proc.once("exit", () => resolve());
    proc.kill();
    setTimeout(resolve, 3000); // por si el exit no llega a tiempo, no colgar el test
  });
}

async function cleanupUser(username) {
  const { data } = await supabase.from("profiles").select("id").ilike("username", username.toLowerCase()).maybeSingle();
  if (data) { await supabase.auth.admin.deleteUser(data.id); console.log("[cleanup] borrado " + username + " (id=" + data.id + ")"); }
}

// Instrumenta window.WebSocket ANTES de que cargue burako.js — cuenta
// construcciones y sockets simultáneamente activos (CONNECTING u OPEN, no
// los que ya recibieron close()). Puramente de test, no toca el código real.
async function installWsProbe(page) {
  await page.addInitScript(() => {
    window.__wsLog = [];
    window.__wsActive = 0;
    window.__wsMaxConcurrent = 0;
    const RealWS = window.WebSocket;
    function ProbedWS(...args) {
      const inst = new RealWS(...args);
      window.__wsActive++;
      window.__wsMaxConcurrent = Math.max(window.__wsMaxConcurrent, window.__wsActive);
      window.__wsLog.push({ t: Date.now() });
      let decremented = false;
      const dec = () => { if (!decremented) { decremented = true; window.__wsActive--; } };
      inst.addEventListener("close", dec);
      const origClose = inst.close.bind(inst);
      inst.close = (...a) => { dec(); return origClose(...a); };
      return inst;
    }
    ProbedWS.prototype = RealWS.prototype;
    ProbedWS.CONNECTING = RealWS.CONNECTING; ProbedWS.OPEN = RealWS.OPEN; ProbedWS.CLOSING = RealWS.CLOSING; ProbedWS.CLOSED = RealWS.CLOSED;
    window.WebSocket = ProbedWS;
  });
}
async function wsLogCountSince(page, tsMs) {
  return page.evaluate((ts) => window.__wsLog.filter((e) => e.t >= ts).length, tsMs);
}

async function registerRealUser(page, user) {
  await page.goto(APP_URL);
  await page.waitForTimeout(300);
  await page.evaluate(() => { G.screen = "auth"; G.authMode = "register"; G.authStep = "register"; render(); });
  await page.waitForTimeout(150);
  await page.fill("#authuser", user);
  await page.fill("#authpass", PASS);
  await page.fill("#authpass2", PASS);
  await page.evaluate(() => submitAuth("register"));
  return waitUntil(page, () => typeof Session !== "undefined" && Session.isAuthenticated(), 10000);
}

async function main() {
  console.log(`=== Regresión: Connection Manager (${APP_URL}) ===\n`);
  let serverProc = await startServer();
  console.log("[setup] servidor de prueba listo en puerto " + PORT + "\n");
  const browser = await chromium.launch();
  const createdUsers = [];

  try {
    const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
    page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
    await installWsProbe(page);

    const user = ("cm" + crypto.randomBytes(4).toString("hex")).slice(0, 16);
    createdUsers.push(user);
    const registered = await registerRealUser(page, user);
    check("setup: registro real termina 'authenticated' y 'connected'", registered && (await page.evaluate(() => Connection.isConnected())));
    await page.evaluate(() => goMenu());

    // =============================================================
    // 1) socket ya conectado -> ensureConnected() no abre uno nuevo
    // =============================================================
    {
      const before = await page.evaluate(() => window.__wsLog.length);
      const ok = await page.evaluate(() => ensureConnected());
      const after = await page.evaluate(() => window.__wsLog.length);
      check("Esc.1: ensureConnected() con socket ya abierto devuelve true sin crear un socket nuevo", ok === true && after === before, `before=${before} after=${after}`);
    }

    // =============================================================
    // 2) dos llamadas simultáneas a ensureConnected() -> UN solo socket nuevo
    // =============================================================
    {
      await page.evaluate(() => { NET.ws.close(); });
      await page.waitForTimeout(300);
      const t0 = Date.now();
      const [r1, r2] = await page.evaluate(() => Promise.all([ensureConnected(), ensureConnected()]));
      const created = await wsLogCountSince(page, t0);
      check("Esc.2: dos ensureConnected() concurrentes devuelven true", r1 === true && r2 === true, `r1=${r1} r2=${r2}`);
      check("Esc.2: ...pero solo abrieron UN socket nuevo (idempotente, no se pisan)", created === 1, "sockets creados=" + created);
    }

    // =============================================================
    // 3) conexión caída fuera de partida -> Connection reacciona sola
    // 10) Session sigue "authenticated" durante la caída
    // =============================================================
    {
      await page.evaluate(() => goMenu());
      await page.evaluate(() => { NET.ws.close(); });
      // readyState pasa a CLOSING de forma síncrona, pero el EVENTO "close"
      // (el que dispara Connection.onClosed()/scheduleReconnect) es async —
      // hay que esperarlo de verdad, no asumir un delay fijo.
      await waitUntil(page, () => Connection.state() !== "connected", 5000);
      const stateRightAfter = await page.evaluate(() => ({ conn: Connection.state(), sess: Session.state() }));
      check("Esc.3: Connection reacciona sola tras el close (no se queda 'disconnected' sin plan)", stateRightAfter.conn === "reconnecting", JSON.stringify(stateRightAfter));
      check("Esc.10: Session sigue 'authenticated' durante la caída transitoria", stateRightAfter.sess === "authenticated", JSON.stringify(stateRightAfter));

      // =============================================================
      // 4) reconexión automática -> se recupera sin ninguna acción manual
      // =============================================================
      const recovered = await waitUntil(page, () => Connection.isConnected() && NET.ws && NET.ws.readyState === 1, 15000);
      check("Esc.4: la reconexión automática (backoff, sin tocar nada) recupera la conexión", recovered);
      const sessStillOk = await page.evaluate(() => Session.state());
      check("Esc.4: Session sigue 'authenticated' después de la reconexión automática", sessStillOk === "authenticated", "state=" + sessStillOk);
    }

    // =============================================================
    // 9) dos disparadores de reconexión casi a la vez -> UN solo socket nuevo
    // (no dos timers/dos sockets compitiendo)
    // =============================================================
    {
      await page.evaluate(() => goMenu());
      await waitUntil(page, () => Connection.isConnected(), 10000); // arrancar desde un estado limpio y confirmado
      const t0 = Date.now();
      await page.evaluate(() => { NET.ws.close(); }); // dispara onclose -> Connection.scheduleReconnect()
      await page.evaluate(() => { resumeReconnect(); }); // "casi a la vez", como si visibilitychange disparara justo después
      const recovered = await waitUntil(page, () => Connection.isConnected() && NET.ws && NET.ws.readyState === 1, 25000);
      if(!recovered){
        const diag = await page.evaluate(() => ({ conn: Connection.state(), sess: Session.state(), wsReadyState: NET.ws?NET.ws.readyState:"null", resumeReconnecting: !!G._resumeReconnecting, sessionOpInFlight: !!G._sessionOpInFlight }));
        console.log("[Esc.9 diag]", JSON.stringify(diag));
      }
      check("Esc.9 setup: se recuperó tras los dos disparadores", recovered);
      const created = await wsLogCountSince(page, t0);
      check("Esc.9: dos disparadores casi simultáneos -> exactamente UN socket nuevo, no dos", created === 1, "sockets creados=" + created);
    }

    // =============================================================
    // 5) servidor temporalmente inaccesible -> falla controlada
    // 6) recuperación posterior -> el backoff de fondo la resuelve solo
    // =============================================================
    {
      await page.evaluate(() => goMenu());
      const settledBefore=await waitUntil(page, () => Connection.isConnected(), 10000);
      check("setup Esc.5-6: conectado antes de matar el servidor", settledBefore);
      console.log("[Esc.5-6] matando el servidor de prueba...");
      await stopServer(serverProc);
      await page.evaluate(() => { if (NET.ws) NET.ws.close(); }); // fuerza que el cliente note la caída ahora, no cuando el TCP haga timeout solo
      await page.waitForTimeout(1500);
      const stateWhileDown = await page.evaluate(() => ({ conn: Connection.state(), sess: Session.state() }));
      check("Esc.5: sin servidor, Connection queda 'reconnecting' (sigue intentando, controlado)", stateWhileDown.conn === "reconnecting", JSON.stringify(stateWhileDown));
      check("Esc.5: Session NO se corrompe por la caída — sigue 'authenticated', no 'expired' ni 'unauthenticated'", stateWhileDown.sess === "authenticated", JSON.stringify(stateWhileDown));

      console.log("[Esc.5-6] esperando un par de reintentos fallidos contra el puerto muerto...");
      await page.waitForTimeout(4000);
      const stillTryingNotExpired = await page.evaluate(() => Session.state());
      check("Esc.5: varios reintentos fallidos seguidos TAMPOCO tocan Session", stillTryingNotExpired === "authenticated", "state=" + stillTryingNotExpired);

      console.log("[Esc.5-6] reiniciando el servidor de prueba...");
      serverProc = await startServer();
      const recovered = await waitUntil(page, () => Connection.isConnected() && NET.ws && NET.ws.readyState === 1, 40000);
      check("Esc.6: el backoff de fondo, SIN ninguna acción manual, recupera la conexión cuando el servidor vuelve", recovered);
      const sessAfterRecover = await page.evaluate(() => Session.state());
      check("Esc.6: Session termina 'authenticated' tras la recuperación (se re-validó sola)", sessAfterRecover === "authenticated", "state=" + sessAfterRecover);
    }

    // =============================================================
    // 7) heartbeat timeout — un pong que nunca llega se detecta solo
    // =============================================================
    {
      await page.evaluate(() => goMenu());
      await waitUntil(page, () => Connection.isConnected(), 10000);
      check("setup Esc.7: conectado antes de la prueba de heartbeat", await page.evaluate(() => Connection.isConnected()));
      // Silencia los pings a propósito (el servidor nunca los recibe, así que
      // nunca puede llegar un pong) — puramente en la página de prueba, no
      // toca client/burako.js.
      await page.evaluate(() => {
        const real = NET.ws.send.bind(NET.ws);
        NET.ws.send = (data) => {
          try { if (JSON.parse(data).type === "ping") return; } catch (e) {}
          return real(data);
        };
      });
      console.log("[Esc.7] esperando el ciclo de heartbeat (~20s) + timeout de pong (~10s)...");
      const detected = await waitUntil(page, () => Connection.state() !== "connected", 35000, 500);
      check("Esc.7: sin pong, el cliente deja de creer que sigue 'connected' (detecta el socket muerto solo)", detected, "state=" + (await page.evaluate(() => Connection.state())));
      const sessDuringHeartbeatLoss = await page.evaluate(() => Session.state());
      check("Esc.7: Session sigue 'authenticated' pese al timeout de heartbeat", sessDuringHeartbeatLoss === "authenticated", "state=" + sessDuringHeartbeatLoss);
      const recovered = await waitUntil(page, () => Connection.isConnected() && NET.ws && NET.ws.readyState === 1, 15000);
      check("Esc.7: tras detectar el socket muerto, reconecta solo con un socket real y fresco", recovered);
    }

    // =============================================================
    // 8) nunca más de un socket activo a la vez, en TODA la corrida
    // =============================================================
    {
      const maxConcurrent = await page.evaluate(() => window.__wsMaxConcurrent);
      check("Esc.8: nunca hubo más de 1 socket activo a la vez en toda la corrida", maxConcurrent <= 1, "max observado=" + maxConcurrent);
    }

    await page.close();
  } finally {
    await browser.close();
    await stopServer(serverProc);
    for (const u of createdUsers) await cleanupUser(u).catch((e) => console.log("[cleanup] error borrando " + u + ": " + e.message));
  }

  console.log(`\n=== RESUMEN: ${pass} OK / ${fail} fallidas ===`);
  if (fail) process.exitCode = 1;
}
main().catch((e) => { console.error("❌ Error fatal:", e); process.exitCode = 1; });
