// Test de regresión (Fase 1, docs/ai/AUDIT-SESSION-ARCHITECTURE.md /
// docs/ai/FROM-CLAUDE.md) — reproduce en navegador real, contra servidor y
// Supabase reales, el bug confirmado en la Fase 0: arrancar la app en frío
// con una sesión guardada dejaba Logros mostrando "Conectate online para ver
// tus logros" indefinidamente (G.serverAchievementsCatalog nunca se volvía a
// pedir), mientras Perfil se veía perfecto (lee P.*, que sí persiste).
//
// Cubre las dos partes del fix:
//  1) resumeSessionSilently() ahora pide "catalog" ella misma en su rama
//     authOk (punto central) — así el catálogo se autocorrige solo tras
//     CUALQUIER reconexión exitosa, no solo en login/registro.
//  2) el catálogo se persiste junto con P.* (P.achievementsCatalog) y se usa
//     para sembrar G.serverAchievementsCatalog al arrancar — así un segundo
//     arranque en frío ya no muestra el estado vacío ni un instante.
//
// Usuario de prueba con prefijo único, borrado y verificado por ID exacto al
// final — mismo criterio de seguridad que el resto de scripts/test-*.mjs.
import { chromium } from "playwright";
import crypto from "node:crypto";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const APP_URL = process.env.APP_URL || "http://localhost:8181";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const USER = ("csa" + crypto.randomBytes(4).toString("hex")).slice(0, 16);
const PASS = "TestPass123";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { console.log("✅ " + name); pass++; }
  else { console.log("❌ " + name + (detail ? " — " + detail : "")); fail++; }
}

async function cleanupTestUser() {
  const { data } = await supabase.from("profiles").select("id").ilike("username", USER.toLowerCase()).maybeSingle();
  if (data) { await supabase.auth.admin.deleteUser(data.id); console.log("[cleanup] borrado " + USER + " (id=" + data.id + ")"); }
}

async function logrosText(page) {
  await page.evaluate(() => goProfile("perfil"));
  await page.evaluate(() => goProfileTab("logros"));
  await page.waitForTimeout(60);
  return page.locator("#app").first().innerText().catch(() => "");
}
// El registro real (primera vez que se crea el usuario en Supabase) tarda
// variable — 1.5 a 3.8s medido en la Fase 0 (creación en Supabase Auth +
// polling del trigger de "profiles") — así que se espera por condición, no
// por un timeout fijo que podría ser flaky sin que sea un fallo real.
async function waitUntil(page, fn, timeoutMs = 10000, stepMs = 200) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await page.evaluate(fn)) return true;
    await page.waitForTimeout(stepMs);
  }
  return false;
}

async function main() {
  console.log(`=== Regresión: Logros tras arranque en frío (${APP_URL}) — usuario ${USER} ===\n`);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
  page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

  try {
    await page.goto(APP_URL);
    await page.waitForTimeout(400);

    // --- Registro real ---
    await page.evaluate(() => { G.screen = "auth"; G.authMode = "register"; G.authStep = "register"; render(); });
    await page.waitForTimeout(150);
    await page.fill("#authuser", USER);
    await page.fill("#authpass", PASS);
    await page.fill("#authpass2", PASS);
    await page.evaluate(() => submitAuth("register"));
    const registered = await waitUntil(page, () => G.online === true, 10000);
    check("registro real terminó (authOk) dentro de 10s", registered);
    const afterReg = await page.evaluate(() => ({ online: G.online, catalogLen: (G.serverAchievementsCatalog || []).length }));
    check("tras registro: online=true", afterReg.online === true, JSON.stringify(afterReg));
    check("tras registro: catálogo ya llegó (camino de login, no tocado por esta fase)", afterReg.catalogLen > 0, JSON.stringify(afterReg));

    const logrosTrasRegistro = await logrosText(page);
    check("Logros tras registro: NO dice 'Conectate online'", !/Conectate online/i.test(logrosTrasRegistro));

    // Simula un dispositivo que ya pasó por onboarding antes (el caso real de
    // "reabrir la app" — ver Fase 0 sobre por qué esto hace falta para tomar
    // la rama de arranque en frío en vez de volver a onboarding).
    await page.evaluate(() => { try { localStorage.setItem("burako_onboarded_v2", "true"); } catch (e) {} });

    // ---------------------------------------------------------------
    // 1er arranque en frío: primera vez que este "dispositivo" recarga con
    // sesión guardada. Todavía no hay nada persistido en P.achievementsCatalog
    // de una corrida anterior — este paso prueba la PARTE 1 del fix (que
    // resumeSessionSilently() pida "catalog" ella misma y Logros se
    // autocorrija solo, sin acción manual del usuario).
    // ---------------------------------------------------------------
    await page.reload();
    await page.waitForTimeout(250);
    page.evaluate(() => { goIntroEnter(); }); // fire-and-forget, como tocar el botón real
    await page.waitForTimeout(80); // ventana corta: entrar a Logros ANTES de que resumeSession complete

    const logrosInmediato = await logrosText(page);
    const perfilInmediato = await (async () => { await page.evaluate(() => goProfileTab("perfil")); await page.waitForTimeout(60); return page.locator("#app").first().innerText().catch(() => ""); })();
    check("1er arranque en frío: Perfil se ve poblado ANTES de que termine resumeSession (comportamiento esperado de P.*, no es el bug)", perfilInmediato.includes(USER), "no es un fallo si no lo contiene, solo diagnóstico");

    // Esperar a que resumeSessionSilently() + su pedido de catalog terminen.
    await waitUntil(page, () => (G.serverAchievementsCatalog || []).length > 0, 10000);
    const logrosAutocorregido = await logrosText(page);
    check("1er arranque en frío: Logros SE AUTOCORRIGE tras resumeSession (ya no dice 'Conectate online')", !/Conectate online/i.test(logrosAutocorregido), logrosAutocorregido.slice(0, 120));
    const catalogState1 = await page.evaluate(() => ({ catalogLen: (G.serverAchievementsCatalog || []).length, persistedLen: (JSON.parse(localStorage.getItem("burako_profile") || "{}").achievementsCatalog || []).length }));
    check("1er arranque en frío: el catálogo quedó persistido en P.achievementsCatalog", catalogState1.persistedLen > 0, JSON.stringify(catalogState1));

    // ---------------------------------------------------------------
    // 2do arranque en frío: ahora SÍ hay una copia persistida de una
    // reconexión anterior. Prueba la PARTE 2 del fix (semilla desde caché) —
    // Logros no debería mostrar el estado vacío NI UN INSTANTE esta vez.
    // ---------------------------------------------------------------
    await page.reload();
    await page.waitForTimeout(250);
    page.evaluate(() => { goIntroEnter(); });
    await page.waitForTimeout(30); // ventana TODAVÍA más corta — antes de cualquier respuesta de red

    const catalogInmediato2 = await page.evaluate(() => (G.serverAchievementsCatalog || []).length);
    check("2do arranque en frío: el catálogo YA está poblado desde el caché persistido, sin esperar red", catalogInmediato2 > 0, "catalogLen=" + catalogInmediato2);
    const logrosInmediato2 = await logrosText(page);
    check("2do arranque en frío: Logros nunca muestra 'Conectate online' (ni siquiera brevemente)", !/Conectate online/i.test(logrosInmediato2), logrosInmediato2.slice(0, 120));

    await page.waitForTimeout(1500); // deja terminar la reconexión de fondo, sin asserts extra
  } finally {
    await browser.close();
    await cleanupTestUser();
  }

  console.log(`\n=== RESUMEN: ${pass} OK / ${fail} fallidas ===`);
  if (fail) process.exitCode = 1;
}
main().catch(async (e) => { console.error("❌ Error fatal:", e); await cleanupTestUser().catch(() => {}); process.exitCode = 1; });
