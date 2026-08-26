// Fase 5 — soak test: 30+ minutos de desconexiones/reconexiones repetidas
// sobre las 3 superficies de sesión (menú, lobby, partida en curso), con
// TIMINGS de producción reales (sin acelerar RECONNECT_GRACE_MS ni
// HEARTBEAT_MS — a diferencia de test-e2e-fase5-scenarios.mjs, que sí los
// acelera para poder correr rápido). El objetivo es confirmar que ninguna
// de las tres superficies se degrada, corrompe Session, duplica jugadores,
// o pierde la sala/partida bajo cientos de ciclos seguidos, y que el
// proceso del servidor no crece de memoria de forma descontrolada (timers o
// sockets fantasma).
import { chromium } from "playwright";
import { spawn, execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.join(__dirname, "..");
const PORT = Number(process.env.SOAK_PORT) || 8196;
const APP_URL = `http://localhost:${PORT}`;
const PASS = "TestPass123";
const TOTAL_MS = (Number(process.env.SOAK_MINUTES) || 32) * 60 * 1000;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function waitUntil(page, fn, timeoutMs = 15000, stepMs = 150) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await page.evaluate(fn).catch(() => false)) return true;
    await page.waitForTimeout(stepMs);
  }
  return false;
}
function stats(arr) {
  if (!arr.length) return { n: 0 };
  const s = [...arr].sort((a, b) => a - b);
  const sum = s.reduce((a, b) => a + b, 0);
  return { n: s.length, min: s[0], max: s[s.length - 1], avg: Math.round(sum / s.length), p95: s[Math.floor(s.length * 0.95)] };
}

const createdUsernames = [];
async function cleanupUser(u) {
  try { const { data } = await supabase.from("profiles").select("id").ilike("username", u.toLowerCase()).maybeSingle(); if (data) await supabase.auth.admin.deleteUser(data.id); } catch (e) {}
}

function startServer() {
  return new Promise((resolve, reject) => {
    // Sin overrides de RECONNECT_GRACE_MS/HEARTBEAT_MS a propósito — timings
    // de producción real, es el punto del soak test.
    const proc = spawn(process.execPath, ["server.js"], {
      cwd: SERVER_DIR,
      env: { ...process.env, PORT: String(PORT) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let ready = false;
    const t = setTimeout(() => { if (!ready) reject(new Error("el servidor no arrancó a tiempo")); }, 10000);
    proc.stdout.on("data", (d) => { if (!ready && String(d).includes("corriendo")) { ready = true; clearTimeout(t); resolve(proc); } });
    proc._stderrLines = [];
    proc.stderr.on("data", (d) => { const s = String(d); proc._stderrLines.push(s); });
    return proc;
  });
}

function serverMemMB(pid) {
  try {
    const out = execSync(`powershell -NoProfile -Command "(Get-Process -Id ${pid}).WorkingSet64"`, { encoding: "utf8" });
    return Math.round(Number(out.trim()) / (1024 * 1024));
  } catch (e) { return null; }
}

// [Fase 5 — mismo hallazgo de metodología que Esc.14 de test-e2e-fase5-scenarios.mjs]
// Connection.isConnected()/NET.roomCode/G.screen se ponen en su valor "bueno"
// apenas abre el TRANSPORTE o simplemente porque nunca se tocaron durante el
// corte — NINGUNO de los dos prueba que el round-trip real de resumeSession
// (y, en sala, el "joined" de rejoin) ya haya terminado. Cerrar de nuevo
// guiándose por esas señales mata el socket del que depende un resumeSession
// todavía pendiente, y a diferencia de Connection.scheduleReconnect() (que
// reintenta solo con backoff infinito), attemptMatchReconnect()/
// tryAutoReconnect() NO tienen reintento propio si esa vuelta puntual
// fracasa — así que una sola colisión así puede agotar el grace period del
// servidor sin que nadie vuelva a intentarlo. Por eso acá, igual que en
// Esc.14, cada pista espera la confirmación real (authOk para menú; el
// "joined" que responde a rejoin para lobby/partida) antes de cortar de nuevo.
async function installMsgLog(page) {
  await page.evaluate(() => {
    window.__msgLog = [];
    const origNetConnect = window.netConnect;
    window.netConnect = function (host) {
      const p = origNetConnect(host);
      setTimeout(() => {
        if (NET.ws) NET.ws.addEventListener("message", (ev) => {
          try { const m = JSON.parse(ev.data); if (["authOk", "sessionExpired", "error", "joined"].includes(m.type)) window.__msgLog.push({ t: Date.now(), type: m.type }); } catch (e) {}
        });
      }, 0);
      return p;
    };
  });
}
async function waitForFreshMsg(page, timeoutMs) {
  const t0 = Date.now();
  const before = await page.evaluate(() => window.__msgLog.length);
  while (Date.now() - t0 < timeoutMs) {
    const cur = await page.evaluate(() => window.__msgLog.slice(-3));
    const len = await page.evaluate(() => window.__msgLog.length);
    if (len > before) return { ok: true, tail: cur };
    await page.waitForTimeout(150);
  }
  return { ok: false, tail: await page.evaluate(() => window.__msgLog.slice(-3)) };
}

// Instrumentación rica (solo para diagnosticar la pista de partida): además
// de authOk/sessionExpired/joined/error, registra CADA send de resumeSession
// (con la cola del token que manda) y cada apertura/cierre de socket — para
// poder ver la secuencia exacta send->recv alrededor de una falla real.
async function installRichLog(page) {
  await page.evaluate(() => {
    window.__richLog = [];
    const RealWS = window.WebSocket;
    window.WebSocket = new Proxy(RealWS, {
      construct(target, args) {
        const inst = new target(...args);
        const id = Math.random().toString(36).slice(2, 8);
        window.__richLog.push({ t: Date.now(), ev: "ws-new", id });
        inst.addEventListener("open", () => window.__richLog.push({ t: Date.now(), ev: "ws-open", id }));
        inst.addEventListener("close", (e) => window.__richLog.push({ t: Date.now(), ev: "ws-close", id, code: e.code }));
        const origSend = inst.send.bind(inst);
        inst.send = (data) => {
          try { const m = JSON.parse(data); if (m.type === "resumeSession") window.__richLog.push({ t: Date.now(), ev: "send", id, type: m.type, tokenTail: (m.refreshToken || "").slice(-8) }); else if (m.type !== "ping") window.__richLog.push({ t: Date.now(), ev: "send", id, type: m.type }); } catch (e) {}
          return origSend(data);
        };
        inst.addEventListener("message", (ev) => {
          try { const m = JSON.parse(ev.data); if (["authOk", "sessionExpired", "error", "joined"].includes(m.type)) window.__richLog.push({ t: Date.now(), ev: "recv", id, type: m.type, msg: m.msg || null, tokenTail: (m.session && m.session.refreshToken || "").slice(-8) }); } catch (e) {}
        });
        return inst;
      },
    });
  });
}

async function registerUser(browser, prefix) {
  const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
  page.on("pageerror", (e) => console.log(`[PAGEERROR ${prefix}]`, e.message));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) console.log(`[CONSOLE-ERROR ${prefix}]`, m.text()); });
  const user = (prefix + crypto.randomBytes(4).toString("hex")).slice(0, 16);
  createdUsernames.push(user);
  await page.goto(APP_URL);
  await page.waitForTimeout(300);
  await page.evaluate(() => { G.screen = "auth"; G.authMode = "register"; G.authStep = "register"; render(); });
  await page.fill("#authuser", user);
  await page.fill("#authpass", PASS);
  await page.fill("#authpass2", PASS);
  await page.evaluate(() => submitAuth("register"));
  await waitUntil(page, () => Session.isAuthenticated(), 10000);
  return { page, user };
}

async function main() {
  console.log(`=== Fase 5 — SOAK TEST (${(TOTAL_MS / 60000).toFixed(0)} min, timings de producción reales, ${APP_URL}) ===\n`);
  const serverProc = await startServer();
  console.log("[setup] servidor de prueba listo en puerto " + PORT + " (pid=" + serverProc.pid + ")\n");
  const browser = await chromium.launch();

  const timings = { menu: [], lobby: [], match: [] };
  const failures = { menu: 0, lobby: 0, match: 0 };
  const memSamples = [];
  let cycles = 0;

  try {
    // --- Pista "menu": un usuario sentado en el menú principal, sin sala.
    const { page: pMenu } = await registerUser(browser, "soakm");
    await installMsgLog(pMenu);
    await pMenu.evaluate(() => goMenu());

    // --- Pista "lobby": un usuario con una sala de lobby creada una sola
    // vez al arrancar, reusada durante todo el soak.
    const { page: pLobby } = await registerUser(browser, "soakl");
    await installMsgLog(pLobby);
    await pLobby.evaluate(() => { G.roomConf = { turnSeconds: 60, deckPct: 100, initTiles: 14, matchMinutes: 0, winMode: "classic", gameMode: "casual", roomName: "", public: false }; });
    await pLobby.evaluate(() => doCreateRoom());
    await waitUntil(pLobby, () => G.screen === "lobby" && NET.roomCode, 8000);
    const lobbyRoomCode = await pLobby.evaluate(() => NET.roomCode);
    console.log("[setup] sala de lobby persistente para el soak:", lobbyRoomCode);

    // --- Pista "match": una partida real con 2 humanos llevada a "playing"
    // una sola vez al arrancar; el soak solo corta/recupera al jugador A
    // repetidas veces mientras la partida se mantiene en curso.
    const { page: pMatchA, user: userMatchA } = await registerUser(browser, "soaka");
    const { page: pMatchB } = await registerUser(browser, "soakb");
    await installRichLog(pMatchA);
    await pMatchA.evaluate(() => { G.roomConf = { turnSeconds: 120, deckPct: 100, initTiles: 14, matchMinutes: 0, winMode: "classic", gameMode: "casual", roomName: "", public: false }; });
    await pMatchA.evaluate(() => doCreateRoom());
    await waitUntil(pMatchA, () => G.screen === "lobby" && NET.roomCode, 8000);
    const matchRoomCode = await pMatchA.evaluate(() => NET.roomCode);
    await pMatchB.evaluate((c) => { netSend({ type: "join", room: c, name: "SoakB", skin: "clasica" }); }, matchRoomCode);
    await waitUntil(pMatchB, () => NET.roomCode, 5000);
    await pMatchA.evaluate(() => netSend({ type: "setReady", ready: true }));
    await pMatchB.evaluate(() => netSend({ type: "setReady", ready: true }));
    await pMatchA.evaluate(() => netSend({ type: "start" }));
    await waitUntil(pMatchA, () => ["sorteo", "playing", "dealing", "netSorteo", "netDealing", "netCountdown"].includes(G.screen), 8000);
    await sleep(300);
    await pMatchA.evaluate(() => netSend({ type: "reveal" }));
    await pMatchB.evaluate(() => netSend({ type: "reveal" }));
    await waitUntil(pMatchA, () => G.screen === "dealing" || G.screen === "playing", 6000);
    await pMatchA.evaluate(() => netSend({ type: "dealDraw", all: true }));
    await pMatchB.evaluate(() => netSend({ type: "dealDraw", all: true }));
    const reachedPlaying = await waitUntil(pMatchA, () => G.screen === "playing", 8000);
    console.log("[setup] partida real de soak llegó a 'playing':", reachedPlaying, "código:", matchRoomCode, "\n");

    const t0 = Date.now();
    let lastMemSampleAt = 0;
    memSamples.push({ atMin: 0, mb: serverMemMB(serverProc.pid) });

    const STOP_ON_FIRST_MATCH_FAILURE = process.env.SOAK_STOP_ON_FAILURE === "1";
    let matchEnded = false;
    while (Date.now() - t0 < TOTAL_MS) {
      cycles++;
      const elapsedMin = ((Date.now() - t0) / 60000).toFixed(1);
      if (STOP_ON_FIRST_MATCH_FAILURE && failures.match > 0) break;

      // --- menú --- (señal real: authOk, no solo Connection.isConnected())
      {
        const tStart = Date.now();
        await pMenu.evaluate(() => { if (NET.ws) NET.ws.close(); });
        const res = await waitForFreshMsg(pMenu, 20000);
        const ok = res.ok && res.tail.some((m) => m.type === "authOk");
        if (ok) timings.menu.push(Date.now() - tStart); else { failures.menu++; console.log(`   [ciclo ${cycles}, t=${elapsedMin}min] FALLÓ recuperación menú — msgs=${JSON.stringify(res.tail)}`); }
      }
      // --- lobby --- (señal real: "joined", la confirmación de que el rejoin prosperó)
      {
        const tStart = Date.now();
        await pLobby.evaluate(() => { if (NET.ws) NET.ws.close(); });
        const res = await waitForFreshMsg(pLobby, 20000);
        const gotJoined = res.tail.some((m) => m.type === "joined");
        const sameRoom = gotJoined && (await pLobby.evaluate((rc) => NET.roomCode === rc, lobbyRoomCode));
        if (res.ok && gotJoined && sameRoom) timings.lobby.push(Date.now() - tStart);
        else { failures.lobby++; console.log(`   [ciclo ${cycles}, t=${elapsedMin}min] FALLÓ recuperación lobby — msgs=${JSON.stringify(res.tail)} sameRoom=${sameRoom}`); }
      }
      // --- partida en curso --- (señal real: "joined" del rejoin de partida)
      // Nota: la partida simulada nunca juega turnos reales (solo reveal+
      // dealDraw al armar), así que eventualmente el temporizador de turno
      // (tope 120s server-side) la termina por inactividad — eso es normal
      // y NO es una falla de reconexión, así que una vez que el juego
      // termina de verdad ("gameover") se deja de exigir esta pista sin
      // contarlo como falla.
      if (!matchEnded) {
        const tStart = Date.now();
        const before = await pMatchA.evaluate(() => window.__richLog.length);
        await pMatchA.evaluate(() => { if (NET.ws) NET.ws.close(); });
        let gotJoined = false;
        const tEnd = Date.now() + 20000;
        while (Date.now() < tEnd) {
          const tail = await pMatchA.evaluate((b) => window.__richLog.slice(b), before);
          if (tail.some((m) => m.ev === "recv" && m.type === "joined")) { gotJoined = true; break; }
          await pMatchA.waitForTimeout(150);
        }
        const screen = gotJoined ? await pMatchA.evaluate(() => G.screen) : null;
        if (gotJoined && screen === "playing") timings.match.push(Date.now() - tStart);
        else if (gotJoined && screen === "gameover") {
          matchEnded = true;
          console.log(`   [ciclo ${cycles}, t=${elapsedMin}min] pista de partida: el juego terminó de verdad por inactividad de turnos (no es una falla de reconexión) — se deja de exigir esta pista`);
        } else {
          failures.match++;
          console.log(`   [ciclo ${cycles}, t=${elapsedMin}min] FALLÓ recuperación partida (gotJoined=${gotJoined}, screen=${screen})`);
        }
      }

      if (Date.now() - lastMemSampleAt > 5 * 60000) {
        lastMemSampleAt = Date.now();
        const mb = serverMemMB(serverProc.pid);
        memSamples.push({ atMin: Number(((Date.now() - t0) / 60000).toFixed(1)), mb });
        console.log(`[soak] t=${elapsedMin}min — ciclo ${cycles} — memoria servidor: ${mb}MB — fallas hasta ahora: menu=${failures.menu} lobby=${failures.lobby} match=${failures.match}`);
      }

      // [Fase 5] 15s de por medio entre vueltas — con 6s todavía se
      // acumulaba suficiente volumen combinado entre las 3 pistas (menú +
      // lobby + partida, mismo proceso/IP) como para pisar el rate-limit
      // propio de la API de Auth de Supabase bajo ráfagas sostenidas de
      // varios minutos (confirmado en vivo: 429 "over_request_rate_limit").
      // Eso no es un bug de código — es una cadencia de reconexión MUCHO
      // más agresiva que cualquier uso real (ni el wifi más inestable
      // reconecta cada pocos segundos de forma continua durante muchos
      // minutos). Con 15s entre vueltas se sigue estresando muy por encima
      // de un uso real (varias decenas de ciclos en la corrida), sin
      // autoinducir un límite de infraestructura ajeno al código.
      await sleep(15000);
    }
    memSamples.push({ atMin: Number((TOTAL_MS / 60000).toFixed(1)), mb: serverMemMB(serverProc.pid) });

    console.log(`\n=== SOAK terminado: ${cycles} ciclos por pista en ${(TOTAL_MS / 60000).toFixed(0)} minutos ===\n`);

    // --- Chequeos finales de consistencia cruzada ---
    const finalMenu = await pMenu.evaluate(() => ({ sess: Session.state(), conn: Connection.state() }));
    const finalLobby = await pLobby.evaluate((rc) => ({ sess: Session.state(), conn: Connection.state(), room: NET.roomCode === rc }), lobbyRoomCode);
    const finalMatch = await pMatchA.evaluate(() => ({ sess: Session.state(), conn: Connection.state(), screen: G.screen }));
    console.log("Estado final menú:", JSON.stringify(finalMenu));
    console.log("Estado final lobby:", JSON.stringify(finalLobby));
    console.log("Estado final partida:", JSON.stringify(finalMatch));

    // Sin jugadores duplicados: la sala de lobby debe seguir teniendo
    // exactamente 1 jugador (nunca se "clona" al reconectar).
    const lobbyPlayerCount = await pLobby.evaluate(() => new Promise((resolve) => {
      const onMsg = (ev) => { try { const m = JSON.parse(ev.data); if (m.type === "state") { NET.ws.removeEventListener("message", onMsg); resolve((m.players || []).length); } } catch (e) {} };
      NET.ws.addEventListener("message", onMsg);
      netSend({ type: "setSkin", skin: "clasica" });
      setTimeout(() => { NET.ws.removeEventListener("message", onMsg); resolve(-1); }, 4000);
    }));
    console.log("Cantidad de jugadores en la sala de lobby al final (debe ser 1):", lobbyPlayerCount);

    const stderrAll = serverProc._stderrLines.join("");
    const uncaughtCount = (stderrAll.match(/Uncaught|unhandledRejection/gi) || []).length;
    const authErrLines = stderrAll.split("\n").filter((l) => l.includes("[auth] resumeSession"));
    if (authErrLines.length) console.log(`[auth] resumeSession — errores de Supabase durante el soak (${authErrLines.length}):\n` + authErrLines.join("\n"));
    else console.log("(sin errores de Supabase en resumeSession durante todo el soak)");

    console.log("\n=== RESUMEN SOAK ===");
    console.log("ciclos por pista:", cycles);
    console.log("menu   :", JSON.stringify(stats(timings.menu)), "fallas:", failures.menu);
    console.log("lobby  :", JSON.stringify(stats(timings.lobby)), "fallas:", failures.lobby);
    console.log("match  :", JSON.stringify(stats(timings.match)), "fallas:", failures.match);
    console.log("memoria servidor (MB) por muestra:", JSON.stringify(memSamples));
    console.log("excepciones no atrapadas en stderr del servidor durante todo el soak:", uncaughtCount);
    console.log("estado final consistente (sess=authenticated, conn=connected en las 3 pistas):",
      finalMenu.sess === "authenticated" && finalMenu.conn === "connected" &&
      finalLobby.sess === "authenticated" && finalLobby.conn === "connected" && finalLobby.room &&
      finalMatch.sess === "authenticated" && finalMatch.conn === "connected" &&
      (matchEnded ? finalMatch.screen === "gameover" : finalMatch.screen === "playing"));
    if (matchEnded) console.log("(la pista de partida terminó de verdad por inactividad de turnos durante el soak — esperado, no es una falla)");
    console.log("sin jugadores duplicados en la sala de lobby:", lobbyPlayerCount === 1);

  } finally {
    await browser.close();
    serverProc.kill();
    for (const u of createdUsernames) await cleanupUser(u);
    console.log("\n[cleanup] usuarios de prueba borrados de Supabase.");
  }
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
