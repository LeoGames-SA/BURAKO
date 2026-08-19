// Mini-fase de chat — pruebas de UI/DOM contra el cliente real (Playwright).
// El botón/panel de chat solo existe en salas ONLINE (G.online), pero para
// probar su comportamiento de DOM no hace falta una conexión real: se llega
// a la pantalla "playing" por el camino offline ya probado (Fase 0.5) y se
// fuerza G.online=true — appendChatMessageDOM/toggleChat/sendChatMessage son
// las mismas funciones reales que usa el chat de verdad, la única diferencia
// es que netSend() no tiene un servidor del otro lado (se mockea para poder
// verificar qué se intentó mandar).
import { chromium } from "playwright";

const APP_URL = process.env.APP_URL || "http://localhost:8181";
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { console.log("✅ " + name); pass++; }
  else { console.log("❌ " + name + (detail ? " — " + detail : "")); fail++; }
}

async function reachOfflinePlaying(page) {
  await page.goto(APP_URL);
  await page.waitForTimeout(1200);
  await page.click("text=Jugar").catch(() => {});
  await page.waitForTimeout(800);
  const uname = "chatui" + Date.now().toString().slice(-6);
  await page.fill("#obname", uname);
  await page.fill("#obpass", "TestPass123");
  await page.fill("#obpass2", "TestPass123");
  await page.click("text=Crear cuenta →");
  await page.waitForTimeout(1500);
  for (let i = 0; i < 3; i++) {
    const next = page.locator("text=Siguiente");
    if (await next.count()) { await next.click(); await page.waitForTimeout(500); continue; }
    const play = page.locator("text=¡A jugar!");
    if (await play.count()) { await play.click(); await page.waitForTimeout(1000); break; }
    break;
  }
  await page.waitForTimeout(1000);
  const bonus = page.locator("text=¡Genial!");
  if (await bonus.count()) { await bonus.click(); await page.waitForTimeout(500); }
  await page.evaluate(() => { Sound.init(); goPlay(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => goCasualIA());
  await page.waitForTimeout(400);
  await page.evaluate(() => goQuickMatch());
  await page.waitForTimeout(1200);
  for (let i = 0; i < 4; i++) { const bag = page.locator(".bag").first(); if (await bag.count()) await bag.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(1000); }
  const repartir = page.locator("text=Repartir fichas");
  if (await repartir.count()) { await repartir.click(); await page.waitForTimeout(600); }
  for (let i = 0; i < 20; i++) { const bag = page.locator(".bag").first(); if (!(await bag.count())) break; await bag.click({ timeout: 1000 }).catch(() => {}); await page.waitForTimeout(150); }
  await page.waitForTimeout(1000);
}

async function forceOnlineChatVisible(page) {
  // No hace falta una conexión real para probar el DOM del chat — se fuerza
  // el único flag del que depende su visibilidad (G.online) y se mockea
  // netSend para poder inspeccionar qué se intentó mandar sin servidor.
  await page.evaluate(() => {
    window.__sentMessages = [];
    window.__origNetSend = window.netSend;
    window.netSend = (obj) => { window.__sentMessages.push(obj); };
    G.online = true;
    render();
  });
  await page.waitForTimeout(200);
}

async function main() {
  console.log(`=== Chat — UI/DOM (Playwright, ${APP_URL}) ===\n`);
  const browser = await chromium.launch();

  // ---------- PC: badge, 1 mensaje, >10 mensajes, abrir/leer, Enter, botón ----------
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on("pageerror", (e) => console.log("[pageerror]", e.message));
    await reachOfflinePlaying(page);
    await forceOnlineChatVisible(page);

    check("botón de chat visible en HUD (💬 Chat) apenas G.online=true", await page.locator("#chatToggleBtn").count() === 1);
    check("badge oculto sin mensajes nuevos", await page.locator("#chatBadge").isHidden());

    // 1 mensaje con el chat CERRADO -> badge "· 1"
    await page.evaluate(() => appendChatMessageDOM({ id: "m1", playerId: "rival1", playerName: "Rival", text: "hola" }));
    const badgeText = await page.locator("#chatBadge").textContent();
    check("1 mensaje con chat cerrado -> badge muestra · 1", badgeText.includes("1"), "badge=" + badgeText);
    check("badge visible tras el mensaje", await page.locator("#chatBadge").isVisible());
    check("panel de chat sigue oculto (no se abrió solo)", !(await page.locator("#chatPanel").evaluate((el) => el.classList.contains("chat-open"))));

    // Abrir -> marca como leído
    await page.click("#chatToggleBtn");
    await page.waitForTimeout(150);
    check("al abrir, el panel queda visible (.chat-open)", await page.locator("#chatPanel").evaluate((el) => el.classList.contains("chat-open")));
    check("al abrir, el badge se oculta (marcado como leído)", await page.locator("#chatBadge").isHidden());
    const unreadAfterOpen = await page.evaluate(() => G.chatUnread);
    check("G.chatUnread vuelve a 0 al abrir", unreadAfterOpen === 0, "chatUnread=" + unreadAfterOpen);
    check("el mensaje ya recibido se ve en la lista al abrir", (await page.locator(".chat-msg").count()) === 1);

    // Más de 10 mensajes (chat ya abierto) -> solo se renderizan 10
    await page.evaluate(() => { for (let i = 2; i <= 14; i++) appendChatMessageDOM({ id: "m" + i, playerId: "rival1", playerName: "Rival", text: "msg" + i }); });
    await page.waitForTimeout(150);
    const rowCount = await page.locator(".chat-msg").count();
    check("con 14 mensajes recibidos, el DOM solo muestra 10 filas", rowCount === 10, "rowCount=" + rowCount);
    const lastText = await page.locator(".chat-msg").last().locator(".chat-msg-text").textContent();
    check("las filas visibles son las ÚLTIMAS (msg14 presente)", lastText === "msg14", "lastText=" + lastText);
    const chatLogLen = await page.evaluate(() => G.chatLog.length);
    check("G.chatLog interno no crece sin límite (capado)", chatLogLen <= 30, "chatLog.length=" + chatLogLen);

    // Enter envía
    await page.fill("#chatInput", "mensaje por enter");
    await page.locator("#chatInput").press("Enter");
    await page.waitForTimeout(100);
    let sent = await page.evaluate(() => window.__sentMessages);
    check("Enter en el input dispara sendChat con el texto correcto", sent.some((m) => m.type === "sendChat" && m.text === "mensaje por enter"), JSON.stringify(sent));
    const inputAfterEnter = await page.locator("#chatInput").inputValue();
    check("el input se limpia después de enviar con Enter", inputAfterEnter === "");

    // Botón Enviar
    await page.fill("#chatInput", "mensaje por boton");
    await page.click(".chat-send-btn");
    await page.waitForTimeout(100);
    sent = await page.evaluate(() => window.__sentMessages);
    check("botón Enviar dispara sendChat con el texto correcto", sent.some((m) => m.type === "sendChat" && m.text === "mensaje por boton"));

    // Layout PC: panel con posición/alto fijo (no ocupa el flujo de la mesa)
    const pcBox = await page.locator("#chatPanel").evaluate((el) => { const s = getComputedStyle(el); return { position: s.position, height: s.height }; });
    check("PC: el panel de chat es position:fixed (no empuja layout)", pcBox.position === "fixed", JSON.stringify(pcBox));
    check("PC: el panel tiene alto fijo ~280px (no crece con los mensajes)", pcBox.height === "280px", JSON.stringify(pcBox));

    await page.close();
  }

  // ---------- Android/mobile: drawer 40-50vh ----------
  {
    const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
    page.on("pageerror", (e) => console.log("[pageerror]", e.message));
    await reachOfflinePlaying(page);
    await forceOnlineChatVisible(page);
    await page.click("#chatToggleBtn");
    await page.waitForTimeout(150);
    const mobileBox = await page.locator("#chatPanel").evaluate((el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return { position: s.position, heightPx: r.height, viewportH: window.innerHeight }; });
    const pct = mobileBox.heightPx / mobileBox.viewportH;
    check("Android: el chat es un drawer (position:fixed)", mobileBox.position === "fixed", JSON.stringify(mobileBox));
    check("Android: el drawer ocupa ~40-50% de la pantalla", pct >= 0.38 && pct <= 0.52, `pct=${pct.toFixed(2)}`);
    check("Android: cerrar con el backdrop funciona", await (async () => {
      await page.click("#chatBackdrop", { position: { x: 5, y: 5 } });
      await page.waitForTimeout(150);
      return !(await page.locator("#chatPanel").evaluate((el) => el.classList.contains("chat-open")));
    })());
    await page.close();
  }

  // ---------- Performance: mensaje de chat con mesa cargada NO dispara renderPlaying() ----------
  {
    const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
    page.on("pageerror", (e) => console.log("[pageerror]", e.message));
    await reachOfflinePlaying(page);
    await forceOnlineChatVisible(page);
    // Mesa cargada, mismo truco de inyección que el harness de perf de Fase 0.5.
    await page.evaluate(() => {
      const colors = ["rojo", "azul", "verde", "amarillo"];
      const melds = [];
      for (let i = 0; i < 20; i++) {
        const num = 1 + (i % 13);
        const tiles = colors.slice(0, 3).map((c, j) => ({ id: "synt_" + i + "_" + j, color: c, number: num, joker: false }));
        melds.push({ id: "synmeld_" + i, tiles, ownerId: "p0", ownerName: "AI", order: i, fx: "clasico" });
      }
      G.table = melds; G.meldCounter = melds.length;
      render();
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      window.__renderPlayingCalls = 0;
      const orig = window.renderPlaying;
      window.renderPlaying = function (...args) { window.__renderPlayingCalls++; return orig.apply(this, args); };
    });
    // Chat cerrado: solo debe tocar el badge.
    await page.evaluate(() => appendChatMessageDOM({ id: "perf1", playerId: "rival1", playerName: "Rival", text: "durante partida cargada" }));
    await page.waitForTimeout(150);
    let calls = await page.evaluate(() => window.__renderPlayingCalls);
    check("mensaje de chat con chat CERRADO y mesa cargada: 0 llamadas a renderPlaying()", calls === 0, "calls=" + calls);
    // Chat abierto: tampoco debería tocar renderPlaying, solo el DOM del panel.
    await page.click("#chatToggleBtn");
    await page.waitForTimeout(150);
    await page.evaluate(() => { window.__renderPlayingCalls = 0; });
    await page.evaluate(() => appendChatMessageDOM({ id: "perf2", playerId: "rival1", playerName: "Rival", text: "otro mensaje con chat abierto" }));
    await page.waitForTimeout(150);
    calls = await page.evaluate(() => window.__renderPlayingCalls);
    check("mensaje de chat con chat ABIERTO y mesa cargada: 0 llamadas a renderPlaying()", calls === 0, "calls=" + calls);
    const meldCountStillThere = await page.locator(".meld").count();
    check("los juegos de la mesa siguen intactos en el DOM (no se tocaron)", meldCountStillThere === 20, "meldCount=" + meldCountStillThere);
    await page.close();
  }

  await browser.close();
  console.log(`\n=== RESUMEN: ${pass} OK / ${fail} fallidas ===`);
  if (fail) process.exitCode = 1;
}
main().catch((e) => { console.error("❌ Error fatal:", e); process.exitCode = 1; });
