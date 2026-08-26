// Fase 5 — smoke test post-deploy contra la URL REAL de producción (Render).
// Navegador real (Playwright), servidor real de producción, Supabase real.
// Cubre exactamente lo pedido: login, cold start, Logros, Perfil, crear
// sala, rejoin lobby, iniciar partida, reconectar partida, matchmaking,
// logout/login, y que no aparezcan falsos "iniciá sesión".
import { chromium } from "playwright";
import crypto from "node:crypto";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const APP_URL = process.env.TARGET_APP_URL || "https://burako-server.onrender.com";
const PASS = "TestPass789";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { console.log("✅ " + name); pass++; }
  else { console.log("❌ " + name + (detail ? " — " + detail : "")); fail++; }
}
async function waitUntil(page, fn, timeoutMs = 20000, stepMs = 250) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await page.evaluate(fn).catch(() => false)) return true;
    await page.waitForTimeout(stepMs);
  }
  return false;
}
async function screenText(page) { return page.locator("#app").first().innerText().catch(() => ""); }
function looksLoggedOut(text) { return /iniciá sesión|inicia sesión|conectate online|necesitás estar conectado/i.test(text); }
const createdUsernames = [];
async function cleanupUser(u) {
  try { const { data } = await supabase.from("profiles").select("id").ilike("username", u.toLowerCase()).maybeSingle(); if (data) await supabase.auth.admin.deleteUser(data.id); } catch (e) {}
}

async function main() {
  console.log(`=== Fase 5 — SMOKE TEST de producción (${APP_URL}) ===\n`);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
    page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
    await page.addInitScript(() => {
      window.__wslog = [];
      const RealWS = window.WebSocket;
      window.WebSocket = new Proxy(RealWS, {
        construct(target, args) {
          const inst = new target(...args);
          const id = Math.random().toString(36).slice(2, 8);
          window.__wslog.push({ t: Date.now(), ev: "ws-new", id });
          inst.addEventListener("close", (e) => window.__wslog.push({ t: Date.now(), ev: "ws-close", id, code: e.code }));
          const origSend = inst.send.bind(inst);
          inst.send = (data) => { try { const m = JSON.parse(data); window.__wslog.push({ t: Date.now(), ev: "send", id, type: m.type }); } catch (e) {} return origSend(data); };
          inst.addEventListener("message", (ev) => { try { const m = JSON.parse(ev.data); if (m.type !== "pong" && m.type !== "tick") window.__wslog.push({ t: Date.now(), ev: "recv", id, type: m.type, msg: m.msg || null }); } catch (e) {} });
          return inst;
        },
      });
    });
    const user = ("smk" + crypto.randomBytes(4).toString("hex")).slice(0, 16);
    createdUsernames.push(user);

    // 1) Cold start real — abrir sin sesión.
    await page.goto(APP_URL, { timeout: 60000 });
    await page.waitForTimeout(500);
    const cold = await page.evaluate(() => ({ sess: typeof Session !== "undefined" ? Session.state() : "NO_SESSION" }));
    check("1) Cold start real contra Render: Session arranca 'unauthenticated'", cold.sess === "unauthenticated");

    // 2) Login (registro) real.
    await page.evaluate(() => { G.screen = "auth"; G.authMode = "register"; G.authStep = "register"; render(); });
    await page.waitForTimeout(200);
    await page.fill("#authuser", user);
    await page.fill("#authpass", PASS);
    await page.fill("#authpass2", PASS);
    const tLogin = Date.now();
    await page.evaluate(() => submitAuth("register"));
    const loggedIn = await waitUntil(page, () => Session.isAuthenticated(), 20000);
    check("2) Login real contra Render", loggedIn, `${Date.now() - tLogin}ms`);
    await page.evaluate(() => { try { localStorage.setItem("burako_onboarded_v2", "true"); } catch (e) {} });

    // 3) Logros y Perfil — sin falsos "iniciá sesión".
    await page.evaluate(() => goProfileTab("logros"));
    await page.waitForTimeout(400);
    check("3) Logros: no muestra falso 'iniciá sesión' (Render real)", !looksLoggedOut(await screenText(page)));
    await page.evaluate(() => goProfile("perfil"));
    await page.waitForTimeout(400);
    check("3) Perfil: no muestra falso 'iniciá sesión' (Render real)", !looksLoggedOut(await screenText(page)));
    await page.evaluate(() => goMenu());

    // 4) Crear sala real.
    await page.evaluate(() => { G.roomConf = { turnSeconds: 60, deckPct: 100, initTiles: 14, matchMinutes: 0, winMode: "classic", gameMode: "casual", roomName: "", public: false }; });
    await page.evaluate(() => doCreateRoom());
    const roomCreated = await waitUntil(page, () => G.screen === "lobby" && NET.roomCode, 15000);
    const roomCode = roomCreated ? await page.evaluate(() => NET.roomCode) : null;
    check("4) Crear sala real contra Render", roomCreated, roomCode);

    // 5) Rejoin de lobby (cortar y recuperar).
    const tRejoin = Date.now();
    await page.evaluate(() => { if (NET.ws) NET.ws.close(); });
    const lobbyBack = await waitUntil(page, () => Connection.isConnected() && NET.ws && NET.ws.readyState === 1 && NET.roomCode, 25000);
    check("5) Rejoin de lobby tras corte de WS (Render real)", lobbyBack, `${Date.now() - tRejoin}ms`);

    // 6-7) Segundo usuario real, iniciar partida real, reconectar durante partida.
    const page2 = await browser.newPage({ viewport: { width: 420, height: 860 } });
    const user2 = ("smk" + crypto.randomBytes(4).toString("hex")).slice(0, 16);
    createdUsernames.push(user2);
    await page2.goto(APP_URL, { timeout: 60000 });
    await page2.waitForTimeout(400);
    await page2.evaluate(() => { G.screen = "auth"; G.authMode = "register"; G.authStep = "register"; render(); });
    await page2.fill("#authuser", user2); await page2.fill("#authpass", PASS); await page2.fill("#authpass2", PASS);
    await page2.evaluate(() => submitAuth("register"));
    await waitUntil(page2, () => Session.isAuthenticated(), 20000);
    await page2.evaluate((c) => { netSend({ type: "join", room: c, name: "SmokeB", skin: "clasica" }); }, roomCode);
    await waitUntil(page2, () => NET.roomCode, 10000);
    await page.evaluate(() => netSend({ type: "setReady", ready: true }));
    await page2.evaluate(() => netSend({ type: "setReady", ready: true }));
    await page.waitForTimeout(500);
    await page.evaluate(() => netSend({ type: "start" }));
    const started = await waitUntil(page, () => ["sorteo", "playing", "dealing", "netSorteo", "netDealing", "netCountdown"].includes(G.screen), 30000);
    check("6) Iniciar partida real con 2 humanos (Render real)", started, "G.screen=" + (await page.evaluate(() => G.screen)));
    // Diagnóstico completo solo si falla — el log de WS ya está instrumentado arriba (addInitScript).
    if (!started) console.log("   [wslog completo]:\n" + JSON.stringify(await page.evaluate(() => window.__wslog), null, 1));
    await page.waitForTimeout(800);
    await page.evaluate(() => netSend({ type: "reveal" }));
    await page2.evaluate(() => netSend({ type: "reveal" }));
    await waitUntil(page, () => G.screen === "dealing" || G.screen === "playing", 15000);
    await page.evaluate(() => netSend({ type: "dealDraw", all: true }));
    await page2.evaluate(() => netSend({ type: "dealDraw", all: true }));
    const reachedPlaying = await waitUntil(page, () => G.screen === "playing", 20000);
    check("6) Llega a fase 'playing' de verdad (Render real)", reachedPlaying);

    const tGameCut = Date.now();
    await page.evaluate(() => { if (NET.ws) NET.ws.close(); });
    const gameBack = await waitUntil(page, () => Connection.isConnected() && NET.ws && NET.ws.readyState === 1 && G.screen === "playing", 25000);
    check("7) Reconectar durante partida real (Render real)", gameBack, `${Date.now() - tGameCut}ms`);
    check("7) Session sigue 'authenticated' tras reconectar en partida", await page.evaluate(() => Session.isAuthenticated()));

    await page.evaluate(() => leaveRoomToMenu());
    await page2.evaluate(() => leaveRoomToMenu());
    await page2.close();

    // 8) Matchmaking real (Duelo rápido / casualQuick2) con 2 usuarios frescos.
    const page3 = await browser.newPage({ viewport: { width: 420, height: 860 } });
    const page4 = await browser.newPage({ viewport: { width: 420, height: 860 } });
    const user3 = ("smk" + crypto.randomBytes(4).toString("hex")).slice(0, 16);
    const user4 = ("smk" + crypto.randomBytes(4).toString("hex")).slice(0, 16);
    createdUsernames.push(user3, user4);
    for (const [p, u] of [[page3, user3], [page4, user4]]) {
      await p.goto(APP_URL, { timeout: 60000 });
      await p.waitForTimeout(400);
      await p.evaluate(() => { G.screen = "auth"; G.authMode = "register"; G.authStep = "register"; render(); });
      await p.fill("#authuser", u); await p.fill("#authpass", PASS); await p.fill("#authpass2", PASS);
      await p.evaluate(() => submitAuth("register"));
      await waitUntil(p, () => Session.isAuthenticated(), 20000);
    }
    await page3.evaluate(() => netSend({ type: "queueJoin", mode: "casualQuick2" }));
    await page4.evaluate(() => netSend({ type: "queueJoin", mode: "casualQuick2" }));
    const matched3 = await waitUntil(page3, () => NET.roomCode, 20000);
    const matched4 = await waitUntil(page4, () => NET.roomCode, 20000);
    check("8) Matchmaking real (Render real) empareja a los 2", matched3 && matched4 && (await page3.evaluate((rc) => NET.roomCode === rc, await page4.evaluate(() => NET.roomCode))));
    await page3.close(); await page4.close();

    // 9) Logout real + volver a loguearse.
    await page.evaluate(() => goMenu());
    await page.evaluate(() => logout());
    const loggedOut = await waitUntil(page, () => Session.state() === "unauthenticated", 15000);
    check("9) Logout real (Render real)", loggedOut);
    await page.evaluate(() => { G.screen = "auth"; G.authMode = "login"; G.authStep = "login"; render(); });
    await page.waitForTimeout(200);
    await page.fill("#authuser", user);
    await page.fill("#authpass", PASS);
    await page.evaluate(() => submitAuth("login"));
    const loggedBackIn = await waitUntil(page, () => Session.isAuthenticated(), 20000);
    check("9) Volver a loguearse tras logout (Render real)", loggedBackIn);

    // 10) Chequeo final — sin falsos "iniciá sesión" en Logros tras todo el recorrido.
    await page.evaluate(() => goProfileTab("logros"));
    await page.waitForTimeout(400);
    check("10) Logros sin falso 'iniciá sesión' tras todo el recorrido (Render real)", !looksLoggedOut(await screenText(page)));

  } finally {
    await browser.close();
    for (const u of createdUsernames) await cleanupUser(u);
    console.log("\n[cleanup] usuarios de prueba borrados de Supabase.");
  }
  console.log(`\n=== RESUMEN: ${pass} OK / ${fail} fallidas ===`);
  process.exit(fail > 0 ? 1 : 0);
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
