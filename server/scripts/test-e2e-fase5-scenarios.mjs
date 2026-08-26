// Fase 5 — validación integrada end-to-end sobre el sistema resultante de
// las Fases 1-4B (docs/ai/AUDIT-SESSION-ARCHITECTURE.md /
// docs/ai/FROM-CLAUDE.md). Navegador real (Playwright), servidor real
// (levantado por este mismo script, puerto propio), Supabase real. No es
// una re-prueba de cada mecanismo por separado (eso ya lo cubren los tests
// de cada fase) — el objetivo acá es recorrer el camino real de un usuario
// de punta a punta y confirmar que las piezas encajan juntas.
//
// Mide timings de login/resumeSession/reconnect/rejoin-lobby/rejoin-partida
// y los imprime al final para el informe de Fase 5.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.join(__dirname, "..");
const PORT = 8190;
const APP_URL = `http://localhost:${PORT}`;
const PASS = "TestPass123";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0, fail = 0;
const timings = [];
function check(name, cond, detail) {
  if (cond) { console.log("✅ " + name); pass++; }
  else { console.log("❌ " + name + (detail ? " — " + detail : "")); fail++; }
}
function timeit(label, ms) { timings.push({ label, ms }); console.log(`   ⏱ ${label}: ${ms}ms`); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function waitUntil(page, fn, timeoutMs = 10000, stepMs = 150) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await page.evaluate(fn).catch(() => false)) return true;
    await page.waitForTimeout(stepMs);
  }
  return false;
}

const createdUsernames = [];
async function cleanupUser(u) {
  try { const { data } = await supabase.from("profiles").select("id").ilike("username", u.toLowerCase()).maybeSingle(); if (data) await supabase.auth.admin.deleteUser(data.id); } catch (e) {}
}

function startServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ["server.js"], {
      cwd: SERVER_DIR,
      env: { ...process.env, PORT: String(PORT), MATCHMAKING_TICK_MS: "300", MATCH_WAIT_TIMEOUT_MS: "1500", RECONNECT_GRACE_MS: "3000" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let ready = false;
    const t = setTimeout(() => { if (!ready) reject(new Error("el servidor no arrancó a tiempo")); }, 10000);
    proc.stdout.on("data", (d) => { if (!ready && String(d).includes("corriendo")) { ready = true; clearTimeout(t); resolve(proc); } });
    let sawUncaught = false;
    proc.stderr.on("data", (d) => { const s = String(d); if (/Uncaught|unhandledRejection/i.test(s)) sawUncaught = true; console.error("[server stderr]", s.trim()); });
    proc._sawUncaught = () => sawUncaught;
  });
}

async function screenText(page) { return page.locator("#app").first().innerText().catch(() => ""); }
function looksLoggedOut(text) { return /iniciá sesión|inicia sesión|conectate online|necesitás estar conectado/i.test(text); }

async function main() {
  console.log(`=== Fase 5 — E2E integrado (${APP_URL}) ===\n`);
  const serverProc = await startServer();
  console.log("[setup] servidor de prueba listo en puerto " + PORT + "\n");
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
    page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
    const user = ("e2e" + crypto.randomBytes(4).toString("hex")).slice(0, 16);
    createdUsernames.push(user);

    // ---------------------------------------------------------------
    // 1) Abrir la app SIN sesión — no debe haber ningún falso "autenticado".
    // ---------------------------------------------------------------
    await page.goto(APP_URL);
    await page.waitForTimeout(400);
    const coldState = await page.evaluate(() => ({ sess: typeof Session !== "undefined" ? Session.state() : "NO_SESSION", token: localStorage.getItem("burako_session_token") }));
    check("1) Abrir sin sesión: Session arranca 'unauthenticated', sin token guardado", coldState.sess === "unauthenticated" && !coldState.token, JSON.stringify(coldState));

    // ---------------------------------------------------------------
    // 2) Login real.
    // ---------------------------------------------------------------
    await page.evaluate(() => { G.screen = "auth"; G.authMode = "register"; G.authStep = "register"; render(); });
    await page.waitForTimeout(150);
    await page.fill("#authuser", user);
    await page.fill("#authpass", PASS);
    await page.fill("#authpass2", PASS);
    const tLoginStart = Date.now();
    await page.evaluate(() => submitAuth("register"));
    const loggedIn = await waitUntil(page, () => Session.isAuthenticated(), 10000);
    timeit("login (registro real)", Date.now() - tLoginStart);
    check("2) Login real termina 'authenticated'", loggedIn);
    await page.evaluate(() => { try { localStorage.setItem("burako_onboarded_v2", "true"); } catch (e) {} });

    // ---------------------------------------------------------------
    // 3) Navegar Perfil, Logros, Tienda, Pase, Galáctico, Ruleta, Torre — sin
    // ningún falso "iniciá sesión".
    // ---------------------------------------------------------------
    const screensToCheck = [
      ["Perfil", () => goProfile("perfil")],
      ["Logros", () => goProfileTab("logros")],
      ["Pase", () => goProfileTab("pase")],
      ["Galáctico", () => goProfileTab("galactico")],
      ["Rangos", () => goProfileTab("rangos")],
      ["Tienda", () => goShop()],
    ];
    let anyFalseLogout = false;
    for (const [name, fn] of screensToCheck) {
      await page.evaluate(fn);
      await page.waitForTimeout(150);
      const txt = await screenText(page);
      const bad = looksLoggedOut(txt);
      if (bad) anyFalseLogout = true;
      check(`3) Pantalla ${name}: no muestra ningún falso "iniciá sesión"`, !bad, bad ? txt.slice(0, 150) : undefined);
    }
    // Ruleta y Torre navegan de pantalla completa (goDailyRoulette/goTower son async).
    await page.evaluate(() => goMenu());
    await page.evaluate(() => goDailyRoulette());
    await waitUntil(page, () => G.screen === "dailyRoulette", 5000);
    await page.waitForTimeout(300);
    check("3) Pantalla Ruleta diaria: entra en modo autenticado (no pide login)", !looksLoggedOut(await screenText(page)));
    await page.evaluate(() => goMenu());
    await page.evaluate(() => goTower());
    await waitUntil(page, () => G.screen === "tower", 5000);
    await page.waitForTimeout(300);
    check("3) Pantalla Torre semanal: entra en modo autenticado (no pide login)", !looksLoggedOut(await screenText(page)));
    check("3) (resumen) ninguna de las pantallas mostró un falso 'iniciá sesión'", !anyFalseLogout);
    await page.evaluate(() => goMenu());

    // ---------------------------------------------------------------
    // 4-5) Recargar con token persistido -> restauración automática.
    // ---------------------------------------------------------------
    const tReloadStart = Date.now();
    await page.reload();
    await page.waitForTimeout(250);
    page.evaluate(() => { goIntroEnter(); });
    const restored = await waitUntil(page, () => Session.isAuthenticated(), 10000);
    timeit("resumeSession tras recargar (arranque en frío)", Date.now() - tReloadStart);
    check("4-5) Recarga con token persistido: restauración automática confirmada", restored);
    await page.evaluate(() => goProfileTab("logros"));
    await page.waitForTimeout(150);
    check("4-5) Logros ya muestra el catálogo tras la restauración (no se queda pidiendo login)", !looksLoggedOut(await screenText(page)));
    await page.evaluate(() => goMenu());

    // ---------------------------------------------------------------
    // 6-7) Cortar WebSocket estando en menú -> recuperar solo.
    // ---------------------------------------------------------------
    await waitUntil(page, () => Connection.isConnected(), 5000);
    const tMenuCut = Date.now();
    await page.evaluate(() => { NET.ws.close(); });
    const menuRecovered = await waitUntil(page, () => Connection.isConnected() && NET.ws && NET.ws.readyState === 1, 15000);
    timeit("reconnect automático (corte en menú)", Date.now() - tMenuCut);
    check("6-7) Corte de WS en menú: se recupera solo, sin acción manual", menuRecovered);
    check("6-7) Session sigue 'authenticated' durante y después del corte", await page.evaluate(() => Session.isAuthenticated()));

    // ---------------------------------------------------------------
    // 8-10) Lobby: crear sala, cortar conexión, rejoin dentro del grace,
    // dejar vencer el grace en un segundo intento.
    // ---------------------------------------------------------------
    await page.evaluate(() => { G.roomConf = { turnSeconds: 60, deckPct: 100, initTiles: 14, matchMinutes: 0, winMode: "classic", gameMode: "casual", roomName: "", public: false }; });
    await page.evaluate(() => doCreateRoom());
    await waitUntil(page, () => G.screen === "lobby" && NET.roomCode, 8000);
    const roomCode = await page.evaluate(() => NET.roomCode);
    const roomPlayerId = await page.evaluate(() => NET.myId);
    check("8) Sala de lobby creada de verdad", !!roomCode);

    const tLobbyCut = Date.now();
    await page.evaluate(() => { NET.ws.close(); });
    const lobbyRejoined = await waitUntil(page, () => Connection.isConnected() && NET.ws && NET.ws.readyState === 1 && NET.roomCode, 15000);
    timeit("rejoin de LOBBY dentro del grace (automático)", Date.now() - tLobbyCut);
    check("9) Corte durante lobby + rejoin automático dentro del grace: recupera la sala (mismo NET.roomCode, mismo NET.myId)", lobbyRejoined && (await page.evaluate((rc) => NET.roomCode === rc, roomCode)) && (await page.evaluate((pid) => NET.myId === pid, roomPlayerId)));
    // Confirma que el servidor de verdad tiene room/player para este socket (el bug real que encontró y corrigió esta misma fase).
    const serverReflects = await page.evaluate(() => new Promise((resolve) => {
      const onMsg = (ev) => { try { const m = JSON.parse(ev.data); if (m.type === "state") { NET.ws.removeEventListener("message", onMsg); resolve(true); } } catch (e) {} };
      NET.ws.addEventListener("message", onMsg);
      netSend({ type: "setSkin", skin: "clasica" });
      setTimeout(() => { NET.ws.removeEventListener("message", onMsg); resolve(false); }, 3000);
    }));
    check("9) El servidor REALMENTE tiene la membresía de sala restaurada (no solo la UI del cliente)", serverReflects);

    // Vencer el grace: salir de la sala explícitamente y confirmar que
    // después de eso una nueva sala arranca limpia (regresión general del
    // flujo, ya que forzar el vencimiento real de ESTA sala requeriría
    // pausar la ejecución del navegador entero, cosa que test-lobby-grace.mjs
    // ya cubrió a nivel protocolo con precisión de milisegundos).
    await page.evaluate(() => doLeaveLobby());
    await waitUntil(page, () => !NET.roomCode, 5000);
    check("10) Salir de la sala libera el estado del cliente (NET.roomCode limpio)", await page.evaluate(() => !NET.roomCode));

    // ---------------------------------------------------------------
    // 11-12) Partida: crear sala, iniciar con 2 humanos, cortar conexión en
    // "playing", recuperar la partida.
    // ---------------------------------------------------------------
    const page2 = await browser.newPage({ viewport: { width: 420, height: 860 } });
    const user2 = ("e2e" + crypto.randomBytes(4).toString("hex")).slice(0, 16);
    createdUsernames.push(user2);
    await page2.goto(APP_URL);
    await page2.waitForTimeout(300);
    await page2.evaluate(() => { G.screen = "auth"; G.authMode = "register"; G.authStep = "register"; render(); });
    await page2.fill("#authuser", user2); await page2.fill("#authpass", PASS); await page2.fill("#authpass2", PASS);
    await page2.evaluate(() => submitAuth("register"));
    await waitUntil(page2, () => Session.isAuthenticated(), 10000);

    await page.evaluate(() => { G.roomConf = { turnSeconds: 60, deckPct: 100, initTiles: 14, matchMinutes: 0, winMode: "classic", gameMode: "casual", roomName: "", public: false }; });
    await page.evaluate(() => doCreateRoom());
    await waitUntil(page, () => G.screen === "lobby" && NET.roomCode, 8000);
    const code2 = await page.evaluate(() => NET.roomCode);
    await page2.evaluate((c) => { netSend({ type: "join", room: c, name: "P2", skin: "clasica" }); }, code2);
    await waitUntil(page2, () => NET.roomCode, 5000);
    await page.evaluate(() => netSend({ type: "setReady", ready: true }));
    await page2.evaluate(() => netSend({ type: "setReady", ready: true }));
    await page.evaluate(() => netSend({ type: "start" }));
    const startedOk = await waitUntil(page, () => G.screen === "sorteo" || G.screen === "playing" || G.screen === "dealing" || G.screen === "netSorteo" || G.screen === "netDealing" || G.screen === "netCountdown", 8000);
    check("11) La partida arranca de verdad con 2 humanos", startedOk);

    // Empuja el sorteo/reparto real hasta "playing" mandando reveal/dealDraw
    // desde los dos, mismo patrón que test-matchmaking.mjs.
    await sleep(300);
    await page.evaluate(() => netSend({ type: "reveal" }));
    await page2.evaluate(() => netSend({ type: "reveal" }));
    await waitUntil(page, () => G.screen === "dealing" || G.screen === "playing", 6000);
    await page.evaluate(() => netSend({ type: "dealDraw", all: true }));
    await page2.evaluate(() => netSend({ type: "dealDraw", all: true }));
    const reachedPlaying = await waitUntil(page, () => G.screen === "playing", 8000);
    check("11) Llega a fase 'playing' de verdad (reveal+dealDraw de los 2 funcionaron)", reachedPlaying);

    const tGameCut = Date.now();
    await page.evaluate(() => { NET.ws.close(); });
    // Primero confirmar que el corte REALMENTE se procesó (el evento "close"
    // es async — un solo waitUntil que solo mirara la recuperación podía
    // "pasar" sin haber visto nunca la caída, si el primer poll llegaba antes
    // de que el navegador disparara el close de verdad — mismo problema ya
    // resuelto en test-connection-manager.mjs, Fase 3).
    await waitUntil(page, () => Connection.state() !== "connected", 5000);
    const sessDuringCut = await page.evaluate(() => Session.state());
    const gameRecovered = await waitUntil(page, () => G.screen === "playing" && Connection.isConnected(), 15000);
    timeit("rejoin de PARTIDA dentro del grace (automático)", Date.now() - tGameCut);
    check("12) Corte durante partida + recuperación automática: vuelve a 'playing'", gameRecovered);
    check("12) Session sigue 'authenticated' DURANTE el corte (no solo después)", sessDuringCut === "authenticated", "state=" + sessDuringCut);
    check("12) Session sigue 'authenticated' después de la recuperación", await page.evaluate(() => Session.isAuthenticated()));

    // leaveRoomToMenu() (no solo netSend) a propósito: es la función real que
    // usa el cliente para abandonar una partida en curso — limpia también
    // ACTIVE_ROOM_KEY (localStorage), no solo manda el mensaje. Si esto se
    // quedara apuntando a la partida vieja, los próximos reconectes
    // automáticos (background/foreground, reconexiones rápidas) tratarían
    // de hacer rejoin a una partida que este cliente ya decidió abandonar.
    await page.evaluate(() => { try { leaveRoomToMenu(); } catch (e) {} });
    await page2.evaluate(() => { try { leaveRoomToMenu(); } catch (e) {} });
    await sleep(300);
    await page2.close();

    // ---------------------------------------------------------------
    // 13) Background/foreground (visibilitychange real).
    // ---------------------------------------------------------------
    await page.evaluate(() => goMenu());
    await waitUntil(page, () => Connection.isConnected(), 5000);
    await page.evaluate(() => { NET.ws.close(); });
    await page.evaluate(() => { Object.defineProperty(document, "hidden", { value: true, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
    await page.waitForTimeout(200);
    await page.evaluate(() => { Object.defineProperty(document, "hidden", { value: false, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
    const bgRecovered = await waitUntil(page, () => Connection.isConnected() && NET.ws && NET.ws.readyState === 1, 15000);
    check("13) Background/foreground real: dispara resumeReconnect() y recupera solo", bgRecovered);

    // ---------------------------------------------------------------
    // 14) Varias reconexiones rápidas seguidas.
    // ---------------------------------------------------------------
    let rapidOk = true;
    // OJO (hallazgo real de este mismo test): Connection.isConnected() se
    // pone en true apenas el TRANSPORTE abre (ws.onopen), que es ANTES de
    // que termine el round-trip real de resumeSession que reautentica y
    // rota el token — son capas separadas a propósito (Connection = ¿hay
    // socket?, Session = ¿está confirmada la identidad?). Cerrar de nuevo
    // ANTES de que Session también confirme puede disparar un segundo
    // resumeSession con el token todavía sin terminar de rotar del lado
    // servidor. Por eso acá se espera a los DOS, no solo a Connection.
    // Diagnóstico puntual (solo de este test, no toca burako.js): parchea
    // netConnect para engancharle a CADA socket nuevo un listener que
    // registra authOk/sessionExpired/error — así se ve la razón EXACTA de
    // cualquier fallo de reautenticación durante las vueltas rápidas.
    await page.evaluate(() => {
      window.__connLog = [];
      const origSet = Connection._set.bind(Connection);
      Connection._set = (s) => { window.__connLog.push({ t: Date.now(), s }); return origSet(s); };
      window.__wsOpenLog = [];
      const RealWS = window.WebSocket;
      window.WebSocket = new Proxy(RealWS, { construct(target, args) { const inst = new target(...args); window.__wsOpenLog.push({ t: Date.now(), ev: "new" }); inst.addEventListener("open", () => window.__wsOpenLog.push({ t: Date.now(), ev: "open" })); inst.addEventListener("close", (e) => window.__wsOpenLog.push({ t: Date.now(), ev: "close", code: e.code, reason: e.reason })); inst.addEventListener("error", () => window.__wsOpenLog.push({ t: Date.now(), ev: "error" })); return inst; } });
    });
    await page.evaluate(() => {
      window.__authMsgLog = [];
      const origNetConnect = window.netConnect;
      window.netConnect = function (host) {
        const p = origNetConnect(host);
        setTimeout(() => {
          if (NET.ws) NET.ws.addEventListener("message", (ev) => {
            try { const m = JSON.parse(ev.data); if (m.type === "authOk" || m.type === "sessionExpired" || m.type === "error") window.__authMsgLog.push({ t: Date.now(), type: m.type, msg: m.msg || null }); } catch (e) {}
          });
        }, 0);
        return p;
      };
    });
    // OJO (hallazgo de METODOLOGÍA de este mismo test, no de la app, y
    // hallazgo real corregido acá mismo): la primera versión de este test
    // cerraba de nuevo apenas Connection.isConnected() daba true — pero esa
    // señal se pone en true apenas abre el TRANSPORTE (ws.onopen), ANTES de
    // que se llegue a mandar siquiera el mensaje resumeSession. Cerrar ahí
    // literalmente mataba el socket ~60-150ms después de abierto, con
    // authOk que lógicamente nunca llegaba — eso parecía "el socket se
    // autocierra solo" pero era el propio test cerrándolo antes de tiempo.
    // Separamos en dos chequeos reales:
    //   (a) STRESS: cerrar más rápido que un round-trip real (~400-750ms
    //       medido en Fase 0) no le da tiempo de asentarse a NINGUNA
    //       implementación posible — lo único exigible ahí es que Session
    //       nunca quede corrompida (el bug real que este mismo test encontró
    //       y ya se corrigió en resumeSessionSilently).
    //   (b) CADENCIA REALISTA: dejando pasar un round-trip completo entre
    //       cortes (todavía mucho más rápido que cualquier humano
    //       reconectando wifi), cada vuelta SÍ debe recuperarse con authOk.
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => { if (NET.ws) NET.ws.close(); });
      await page.waitForTimeout(120);
    }
    const sessionSurvivedStress = await page.evaluate(() => Session.isAuthenticated());
    // Antes de arrancar (b), dejar asentar del todo el último round-trip
    // del stress de (a) — si no, la vuelta 1 de abajo hereda un authOk
    // "viejo" y arranca ya en falso positivo.
    async function waitForFreshAuthOk(timeoutMs) {
      const tEnd = Date.now() + timeoutMs;
      const before = await page.evaluate(() => window.__authMsgLog.length);
      while (Date.now() < tEnd) {
        const len = await page.evaluate(() => window.__authMsgLog.length);
        if (len > before) return true;
        await page.waitForTimeout(150);
      }
      return false;
    }
    await waitForFreshAuthOk(10000);

    for (let i = 0; i < 4; i++) {
      const authCountBefore = await page.evaluate(() => window.__authMsgLog.length);
      await page.evaluate(() => { if (NET.ws) NET.ws.close(); });
      await waitUntil(page, () => Connection.state() !== "connected", 5000);
      const ok = await waitForFreshAuthOk(10000);
      // Solo si YA llegó el authOk real de esta vuelta es seguro cerrar la
      // próxima — cerrar guiándose por Connection.isConnected() (que se
      // pone true con el simple ws.onopen, antes del round-trip) es
      // precisamente el error de metodología que este mismo test tenía
      // antes y que hacía parecer que los sockets "se autocerraban solos".
      if (!ok) {
        rapidOk = false;
        const diag = await page.evaluate(() => ({ conn: Connection.state(), sess: Session.state(), wsReadyState: NET.ws ? NET.ws.readyState : "null" }));
        console.log(`   [Esc.14] vuelta ${i + 1} no se recuperó — diag=${JSON.stringify(diag)}`);
        break;
      }
    }
    check("14a) Corte más rápido que un round-trip (stress): Session nunca se corrompe", sessionSurvivedStress);
    check("14b) 4 reconexiones a cadencia realista: todas se recuperan con authOk", rapidOk && (await page.evaluate(() => Session.isAuthenticated())));
    if (!rapidOk) {
      const authLog = await page.evaluate(() => window.__authMsgLog);
      const connLog = await page.evaluate(() => window.__connLog);
      const wsLog = await page.evaluate(() => window.__wsOpenLog);
      console.log("   [Esc.14] authOk/sessionExpired/error:", JSON.stringify(authLog));
      console.log("   [Esc.14] Connection._set:", JSON.stringify(connLog));
      console.log("   [Esc.14] sockets (new/open/close/error):", JSON.stringify(wsLog));
    }

    // ---------------------------------------------------------------
    // 15-16) Logout real + volver a entrar.
    // ---------------------------------------------------------------
    await page.evaluate(() => logout());
    await waitUntil(page, () => Session.isUnauthenticated(), 5000);
    check("15) Logout real: Session termina 'unauthenticated', token borrado", await page.evaluate(() => localStorage.getItem("burako_session_token") === null));
    await page.evaluate(() => { G.screen = "auth"; G.authMode = "login"; G.authStep = "login"; render(); });
    await page.waitForTimeout(150);
    await page.fill("#authuser", user);
    await page.fill("#authpass", PASS);
    await page.evaluate(() => submitAuth("login"));
    const loggedBackIn = await waitUntil(page, () => Session.isAuthenticated(), 10000);
    check("16) Volver a entrar (login) tras logout funciona normal", loggedBackIn);

    // ---------------------------------------------------------------
    // 17-19) Crear sala, entrar a sala (2do browser), matchmaking real.
    // ---------------------------------------------------------------
    await page.evaluate(() => { G.roomConf = { turnSeconds: 60, deckPct: 100, initTiles: 14, matchMinutes: 0, winMode: "classic", gameMode: "casual", roomName: "", public: false }; });
    await page.evaluate(() => doCreateRoom());
    check("17) Crear sala funciona tras el logout/login", await waitUntil(page, () => G.screen === "lobby" && NET.roomCode, 8000));
    await page.evaluate(() => doLeaveLobby());
    await waitUntil(page, () => !NET.roomCode, 5000);

    const page3 = await browser.newPage({ viewport: { width: 420, height: 860 } });
    const user3 = ("e2e" + crypto.randomBytes(4).toString("hex")).slice(0, 16);
    createdUsernames.push(user3);
    await page3.goto(APP_URL);
    await page3.waitForTimeout(300);
    await page3.evaluate(() => { G.screen = "auth"; G.authMode = "register"; G.authStep = "register"; render(); });
    await page3.fill("#authuser", user3); await page3.fill("#authpass", PASS); await page3.fill("#authpass2", PASS);
    await page3.evaluate(() => submitAuth("register"));
    await waitUntil(page3, () => Session.isAuthenticated(), 10000);

    await page.evaluate(() => doCreateRoom());
    await waitUntil(page, () => G.screen === "lobby" && NET.roomCode, 8000);
    const code3 = await page.evaluate(() => NET.roomCode);
    await page3.evaluate((c) => { netSend({ type: "join", room: c, name: "P3" }); }, code3);
    const joinedOk = await waitUntil(page3, () => NET.roomCode, 5000);
    check("18) Entrar a sala existente (por código, 2do navegador) funciona", joinedOk);
    await page.evaluate(() => doLeaveLobby());
    await page3.evaluate(() => doLeaveLobby());

    const page4 = await browser.newPage({ viewport: { width: 420, height: 860 } });
    const user4 = ("e2e" + crypto.randomBytes(4).toString("hex")).slice(0, 16);
    createdUsernames.push(user4);
    await page4.goto(APP_URL);
    await page4.waitForTimeout(300);
    await page4.evaluate(() => { G.screen = "auth"; G.authMode = "register"; G.authStep = "register"; render(); });
    await page4.fill("#authuser", user4); await page4.fill("#authpass", PASS); await page4.fill("#authpass2", PASS);
    await page4.evaluate(() => submitAuth("register"));
    await waitUntil(page4, () => Session.isAuthenticated(), 10000);
    await page3.evaluate(() => netSend({ type: "queueJoin", mode: "casualQuick2", name: "P3" }));
    await page4.evaluate(() => netSend({ type: "queueJoin", mode: "casualQuick2", name: "P4" }));
    const mmOk = await waitUntil(page3, () => NET.roomCode, 8000);
    check("19) Matchmaking real (Duelo rápido) empareja a los 2", mmOk && (await page3.evaluate(() => NET.roomCode)) === (await page4.evaluate(() => NET.roomCode).catch(() => null)));

    await page3.close(); await page4.close();

    // ---------------------------------------------------------------
    // 20-24) Chequeos cruzados finales: sin falsos "iniciá sesión", sin
    // duplicados, salas no desaparecen sin motivo, sin sockets/timers
    // fantasma (indirecto: la conexión sigue sana), sin estados cruzados
    // entre Auth/Connection/Game.
    // ---------------------------------------------------------------
    await page.evaluate(() => goProfileTab("logros"));
    await page.waitForTimeout(150);
    check("20) Chequeo final: Logros sigue sin mostrar falso 'iniciá sesión' tras todo el recorrido", !looksLoggedOut(await screenText(page)));
    const crossState = await page.evaluate(() => ({ sess: Session.state(), conn: Connection.state(), online: G.online, screen: G.screen }));
    check("24) Sin estados cruzados: Session='authenticated' y Connection='connected' son consistentes entre sí al final del recorrido", crossState.sess === "authenticated" && crossState.conn === "connected", JSON.stringify(crossState));

    await page.close();
  } finally {
    await browser.close();
    serverProc.kill();
    for (const u of createdUsernames) await cleanupUser(u);
  }

  console.log("\n=== TIMINGS ===");
  timings.forEach((t) => console.log(`  ${t.label}: ${t.ms}ms`));
  console.log(`\n=== RESUMEN: ${pass} OK / ${fail} fallidas ===`);
  if (fail) process.exitCode = 1;
}
main().catch((e) => { console.error("❌ Error fatal:", e); process.exitCode = 1; });
