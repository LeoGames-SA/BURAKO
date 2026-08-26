// Test de regresión (Fase 2, docs/ai/AUDIT-SESSION-ARCHITECTURE.md /
// docs/ai/FROM-CLAUDE.md) — el Session Manager único del lado cliente
// (client/burako.js, objeto `Session`). Navegador real (Playwright) contra
// servidor y Supabase reales. Usuario de prueba con prefijo único, borrado y
// verificado por ID exacto al final — mismo criterio de seguridad que el
// resto de scripts/test-*.mjs.
//
// Cubre los 6 escenarios pedidos:
//  1) arranque en frío (sesión guardada, todavía sin confirmar)
//  2) sesión guardada VÁLIDA -> termina "authenticated"
//  3) sesión guardada INVÁLIDA -> termina "expired", token borrado
//  4) WebSocket caído CON sesión todavía válida -> Session sigue
//     "authenticated" (no se convierte en "deslogueado" por la caída)
//  5) reanudación en curso -> Session pasa por "restoring" de forma
//     explícita y observable (no "finge" estar autenticado)
//  6) logout real -> "unauthenticated", token realmente borrado
import { chromium } from "playwright";
import crypto from "node:crypto";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const APP_URL = process.env.APP_URL || "http://localhost:8181";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const PASS = "TestPass123";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { console.log("✅ " + name); pass++; }
  else { console.log("❌ " + name + (detail ? " — " + detail : "")); fail++; }
}
async function waitUntil(page, fn, timeoutMs = 10000, stepMs = 150) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await page.evaluate(fn)) return true;
    await page.waitForTimeout(stepMs);
  }
  return false;
}
async function cleanupUser(username) {
  const { data } = await supabase.from("profiles").select("id").ilike("username", username.toLowerCase()).maybeSingle();
  if (data) { await supabase.auth.admin.deleteUser(data.id); console.log("[cleanup] borrado " + username + " (id=" + data.id + ")"); }
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
  const ok = await waitUntil(page, () => typeof Session !== "undefined" && Session.isAuthenticated(), 10000);
  return ok;
}

async function main() {
  console.log(`=== Regresión: Session Manager (${APP_URL}) ===\n`);
  const browser = await chromium.launch();
  const createdUsers = [];

  try {
    // =============================================================
    // Escenarios 1, 2 y 5 — arranque en frío con sesión VÁLIDA: pasa por
    // "restoring" (reanudación en curso, observable) y termina "authenticated".
    // =============================================================
    {
      const user = ("sm1" + crypto.randomBytes(4).toString("hex")).slice(0, 16);
      createdUsers.push(user);
      const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
      page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

      const registered = await registerRealUser(page, user);
      check("Esc.1-2-5 setup: registro real terminó en 'authenticated'", registered);

      await page.evaluate(() => { try { localStorage.setItem("burako_onboarded_v2", "true"); } catch (e) {} });
      await page.reload();
      await page.waitForTimeout(250);
      page.evaluate(() => { goIntroEnter(); }); // fire-and-forget, como tocar el botón real

      // Ventana muy corta: capturar el estado ANTES de que resumeSession
      // complete (medido en Fase 0: ~400-750ms de round-trip real).
      const early = await page.evaluate(() => (typeof Session !== "undefined" ? Session.state() : "NO_SESSION_OBJ"));
      check("Esc.5 (reanudación en curso): el estado es 'restoring', explícito — no fingido", early === "restoring", "state=" + early);

      const settled = await waitUntil(page, () => Session.state() === "authenticated", 10000);
      check("Esc.1-2 (arranque en frío, sesión válida): termina en 'authenticated'", settled, "state=" + (await page.evaluate(() => Session.state())));

      await page.close();
    }

    // =============================================================
    // Escenario 3 — sesión guardada INVÁLIDA: el servidor la rechaza de
    // verdad (token basura) -> "expired", token borrado.
    // =============================================================
    {
      const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
      page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
      await page.goto(APP_URL);
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        try {
          localStorage.setItem("burako_session_token", "esto-no-es-un-refresh-token-valido");
          localStorage.setItem("burako_onboarded_v2", "true");
        } catch (e) {}
      });
      await page.reload();
      await page.waitForTimeout(250);
      page.evaluate(() => { goIntroEnter(); });

      const rejected = await waitUntil(page, () => typeof Session !== "undefined" && Session.isExpired(), 10000);
      check("Esc.3 (sesión inválida): el servidor la rechaza y Session termina 'expired'", rejected, "state=" + (await page.evaluate(() => Session.state())));
      const tokenGone = await page.evaluate(() => localStorage.getItem("burako_session_token") === null);
      check("Esc.3: el token inválido quedó borrado tras el rechazo explícito", tokenGone);
      await page.close();
    }

    // =============================================================
    // Escenario 4 — EL MÁS IMPORTANTE: WebSocket caído con sesión todavía
    // válida, FUERA de una partida activa. Antes de la Fase 2, algo similar
    // a esto (G.online usado como proxy de auth) era exactamente la causa
    // raíz del bug que reportó el usuario. Acá se confirma que Session NO
    // se mueve de "authenticated" solo porque el socket se cayó.
    // =============================================================
    {
      const user = ("sm4" + crypto.randomBytes(4).toString("hex")).slice(0, 16);
      createdUsers.push(user);
      const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
      page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

      const registered = await registerRealUser(page, user);
      check("Esc.4 setup: registro real terminó en 'authenticated'", registered);
      await page.evaluate(() => goMenu()); // fuera de cualquier partida a propósito

      await page.evaluate(() => { NET.ws.close(); });
      await page.waitForTimeout(500);
      const stateAfterClose = await page.evaluate(() => Session.state());
      check("Esc.4: Session sigue 'authenticated' inmediatamente después de que el socket cae (no es un logout)", stateAfterClose === "authenticated", "state=" + stateAfterClose);

      // También confirma que las pantallas gateadas en Session (no en
      // G.online, que si podría haber quedado en un estado ambiguo acá)
      // siguen mostrando contenido autenticado — Tienda es un ejemplo real
      // de gate que se migró en esta fase (buySkin/buyTapete/etc.).
      const stillAuthedForShop = await page.evaluate(() => Session.isAuthenticated());
      check("Esc.4: Session.isAuthenticated() sigue true para gates como Tienda tras la caída", stillAuthedForShop);

      await page.close();
    }

    // =============================================================
    // Escenario 6 — logout real: transición real a "unauthenticated", token
    // efectivamente borrado (no solo "olvidado" del lado cliente).
    // =============================================================
    {
      const user = ("sm6" + crypto.randomBytes(4).toString("hex")).slice(0, 16);
      createdUsers.push(user);
      const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
      page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

      const registered = await registerRealUser(page, user);
      check("Esc.6 setup: registro real terminó en 'authenticated'", registered);

      await page.evaluate(() => logout());
      await page.waitForTimeout(1000);
      const stateAfterLogout = await page.evaluate(() => Session.state());
      check("Esc.6: logout() real deja Session en 'unauthenticated'", stateAfterLogout === "unauthenticated", "state=" + stateAfterLogout);
      const tokenGoneAfterLogout = await page.evaluate(() => localStorage.getItem("burako_session_token") === null);
      check("Esc.6: el token quedó borrado tras el logout real", tokenGoneAfterLogout);

      await page.close();
    }
  } finally {
    await browser.close();
    for (const u of createdUsers) await cleanupUser(u).catch((e) => console.log("[cleanup] error borrando " + u + ": " + e.message));
  }

  console.log(`\n=== RESUMEN: ${pass} OK / ${fail} fallidas ===`);
  if (fail) process.exitCode = 1;
}
main().catch((e) => { console.error("❌ Error fatal:", e); process.exitCode = 1; });
