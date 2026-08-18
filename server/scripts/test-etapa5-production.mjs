// Etapa 5 — prueba real de punta a punta contra la URL pública de Render
// (wss://, Supabase real, dos clientes reales por WebSocket). No usa mocks:
// registra 2 usuarios de prueba, crea una sala, une un segundo cliente,
// pasa sorteo y reparto, llega a la mesa, prueba una reconexión básica, y
// termina la partida (uno se rinde) para verificar que XP/monedas/stats
// persisten en Supabase — y que NO se duplican (bug de doble resolución
// encontrado y corregido en esta misma etapa).
import WebSocket from "ws";
import crypto from "node:crypto";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const WS_URL = process.env.TARGET_WS_URL || "wss://burako-server.onrender.com";
const A_USER = ("e5a_" + crypto.randomBytes(5).toString("hex")).slice(0, 16);
const B_USER = ("e5b_" + crypto.randomBytes(5).toString("hex")).slice(0, 16);
const PASS = "TestPass789";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { console.log("✅ " + name); pass++; }
  else { console.log("❌ " + name + (detail ? " — " + detail : "")); fail++; }
}

// Cada ws lleva su propio buffer de mensajes no reclamados + una cola de
// waitFor() pendientes — así, si dos respuestas (p. ej. "joined" seguido de
// inmediato por el "state" del broadcast de rejoin) llegan juntas en el mismo
// tick ANTES de que el código de la prueba llegue a pedir la segunda, la
// segunda igual la encuentra esperando en el buffer en vez de perderse. Contra
// Render (latencia real) esto casi nunca se nota porque el código siempre
// llega a tiempo a registrar el siguiente listener; corriendo contra
// localhost (latencia ~0) las dos respuestas pueden llegar en el mismo evento
// y con un listener "de un solo uso" la segunda se pierde sin dejar rastro.
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
      if (wi !== -1) {
        const w = ws._waiters.splice(wi, 1)[0];
        clearTimeout(w.timer);
        w.resolve(m);
      } else {
        ws._buffer.push(m);
      }
    });
  });
}
function send(ws, obj) { ws.send(JSON.stringify(obj)); }
// Espera el próximo mensaje cuyo type matchee el predicado (string o función)
// — primero revisa el buffer de lo ya llegado, y solo si no hay nada todavía
// se suma a la cola de espera.
function waitFor(ws, matcher, ms = 15000) {
  const test = typeof matcher === "function" ? matcher : (m) => m.type === matcher;
  const bi = ws._buffer.findIndex(test);
  if (bi !== -1) return Promise.resolve(ws._buffer.splice(bi, 1)[0]);
  return new Promise((resolve, reject) => {
    const waiter = {
      test,
      resolve,
      timer: setTimeout(() => {
        const i = ws._waiters.indexOf(waiter);
        if (i !== -1) ws._waiters.splice(i, 1);
        reject(new Error("timeout esperando " + matcher));
      }, ms),
    };
    ws._waiters.push(waiter);
  });
}
async function cleanupUser(usernameLower) {
  const { data } = await supabase.from("profiles").select("id").ilike("username", usernameLower).maybeSingle();
  if (data) await supabase.auth.admin.deleteUser(data.id);
}

async function main() {
  console.log(`=== Etapa 5 — prueba end-to-end contra producción (${WS_URL}) ===\n`);
  await cleanupUser(A_USER.toLowerCase());
  await cleanupUser(B_USER.toLowerCase());

  // --- Registro de los 2 usuarios de prueba, cada uno en su propia conexión ---
  const wsA = await connect();
  send(wsA, { type: "register", username: A_USER, password: PASS });
  const rA = await waitFor(wsA, (m) => m.type === "authOk" || m.type === "error");
  check("registro jugador A contra producción", rA.type === "authOk", JSON.stringify(rA));

  const wsB = await connect();
  send(wsB, { type: "register", username: B_USER, password: PASS });
  const rB = await waitFor(wsB, (m) => m.type === "authOk" || m.type === "error");
  check("registro jugador B contra producción", rB.type === "authOk", JSON.stringify(rB));

  const coinsABefore = rA.profile?.coins, coinsBBefore = rB.profile?.coins;
  check("registro de A incluye token de sesión", !!rA.session?.refreshToken, JSON.stringify(rA.session));

  // --- Sesión persistente: resumeSession SIN partida activa (el caso normal
  // de "cerré la app desde el menú y la vuelvo a abrir") usando el token que
  // vino en el registro, en una conexión nueva — no debe hacer falta mandar
  // la contraseña de nuevo. ---
  const wsAResume = await connect();
  send(wsAResume, { type: "resumeSession", refreshToken: rA.session.refreshToken });
  const resumed = await waitFor(wsAResume, (m) => m.type === "authOk" || m.type === "sessionExpired");
  check("resumeSession sin partida activa restaura la sesión de A sin contraseña", resumed.type === "authOk" && resumed.profile?.username?.toLowerCase() === A_USER.toLowerCase(), JSON.stringify(resumed).slice(0, 200));
  let aToken = resumed.session?.refreshToken || rA.session.refreshToken;
  wsAResume.close();

  // --- A crea sala, B se une ---
  send(wsA, { type: "join", room: "NUEVA", name: "TestA", gameMode: "casual" });
  const joinedA = await waitFor(wsA, "joined");
  const roomCode = joinedA.code;
  check("A crea sala", !!roomCode, JSON.stringify(joinedA));

  send(wsB, { type: "join", room: roomCode, name: "TestB", gameMode: "casual" });
  const joinedB = await waitFor(wsB, (m) => m.type === "joined" || m.type === "error");
  check("B se une a la sala de A", joinedB.type === "joined", JSON.stringify(joinedB));
  const bPlayerId = joinedB.playerId;

  // --- Ambos listos, A arranca ---
  send(wsA, { type: "setReady", ready: true });
  send(wsB, { type: "setReady", ready: true });
  // Deja asentar el broadcast de ready — una pausa fija, no un waitFor genérico:
  // con el buffer por-socket (ver connect()) un waitFor sin filtro de fase
  // devolvería de una el "state" ya encolado del broadcast de "join" (previo a
  // ready), no el que realmente interesa esperar acá.
  await new Promise((r) => setTimeout(r, 300));
  send(wsA, { type: "start" });
  const sorteoState = await waitFor(wsA, (m) => m.type === "state" && m.phase === "sorteo", 10000);
  check("la partida arranca y entra en fase de sorteo", sorteoState.phase === "sorteo", JSON.stringify(sorteoState.phase));

  // --- Sorteo: ambos revelan ---
  send(wsA, { type: "reveal" });
  send(wsB, { type: "reveal" });
  const dealingState = await waitFor(wsA, (m) => m.type === "state" && m.phase === "dealing", 10000);
  check("sorteo completo -> pasa a reparto (dealing)", dealingState.phase === "dealing", JSON.stringify(dealingState.phase));

  // --- Reparto: ambos agarran toda su mano ---
  send(wsA, { type: "dealDraw", all: true });
  send(wsB, { type: "dealDraw", all: true });
  // OJO: room.phase es undefined antes de que arranque el sorteo, y stateFor
  // (server.js) usa "phase: room.phase || 'playing'" como default — así que la
  // sala recién creada YA manda un "state" con phase:"playing" (started:false,
  // sin mano) antes de que el juego arranque de verdad. Filtrar también por
  // "started" para no confundir ese estado de lobby con el de la mesa real.
  const playingState = await waitFor(wsA, (m) => m.type === "state" && m.phase === "playing" && m.started, 10000);
  check("reparto completo -> llega a la mesa (playing)", playingState.phase === "playing" && playingState.myHand.length === 14, "phase=" + playingState.phase + " handLen=" + playingState.myHand?.length);

  // --- Reconexión básica: B cierra su conexión y vuelve a entrar con "rejoin",
  // restaurando la sesión con el token guardado (NO con la contraseña). ---
  wsB.close();
  await new Promise((r) => setTimeout(r, 2000));
  const wsB2 = await connect();
  send(wsB2, { type: "resumeSession", refreshToken: rB.session.refreshToken });
  const bResumed = await waitFor(wsB2, (m) => m.type === "authOk" || m.type === "sessionExpired");
  check("B reconecta a mitad de partida vía resumeSession (sin contraseña)", bResumed.type === "authOk", JSON.stringify(bResumed).slice(0, 200));
  send(wsB2, { type: "rejoin", room: roomCode, playerId: bPlayerId });
  const rejoined = await waitFor(wsB2, (m) => m.type === "joined" || m.type === "error");
  check("B se reconecta a la partida en curso (rejoin)", rejoined.type === "joined" && rejoined.playerId === bPlayerId, JSON.stringify(rejoined));
  const rejoinState = await waitFor(wsB2, (m) => m.type === "state", 10000);
  check("el estado recuperado tras reconectar sigue en fase playing con la mano completa", rejoinState.phase === "playing" && rejoinState.myHand.length === 14, "phase=" + rejoinState.phase + " handLen=" + rejoinState.myHand?.length);

  // --- Terminar la partida: B se rinde (camino real y válido de fin de partida) ---
  send(wsB2, { type: "surrender" });
  const matchResultA = await waitFor(wsA, "matchResult", 10000);
  check("A recibe matchResult (ganó por rendición de B)", matchResultA.won === true && matchResultA.update, JSON.stringify(matchResultA).slice(0, 300));
  const matchResultB = await waitFor(wsB2, "matchResult", 10000);
  check("B recibe SU PROPIO matchResult (se rindió)", matchResultB.iSurrendered === true && matchResultB.update, JSON.stringify(matchResultB).slice(0, 300));

  // --- Verificar persistencia real en Supabase (no solo lo que vino por WS) ---
  await new Promise((r) => setTimeout(r, 1500)); // margen para que terminen los await internos del server
  const { data: profA } = await supabase.from("profiles").select("*").ilike("username", A_USER).maybeSingle();
  const { data: profB } = await supabase.from("profiles").select("*").ilike("username", B_USER).maybeSingle();
  check("perfil de A persistido en Supabase con 1 partida jugada y 1 ganada", profA && profA.games === 1 && profA.wins === 1, JSON.stringify(profA && { games: profA.games, wins: profA.wins, coins: profA.coins }));
  check("perfil de B persistido en Supabase con 1 partida jugada, 0 ganadas (SIN duplicar)", profB && profB.games === 1 && profB.wins === 0, JSON.stringify(profB && { games: profB.games, wins: profB.wins, coins: profB.coins }));
  check("las monedas de A subieron respecto al registro (ganó la partida)", profA && profA.coins > coinsABefore, `antes=${coinsABefore} despues=${profA?.coins}`);
  // games===1/wins===0 arriba ya prueba que resolveMatch corrió UNA sola vez
  // para B (si se hubiera duplicado, games sería 2). Acá solo se registra el
  // delta real para que quede en el log, sin asumir un monto fijo (varía según
  // qué logros dispare "primera partida", que también suman una sola vez).
  console.log(`   (info) delta de monedas de B: ${profB ? profB.coins - coinsBBefore : "?"}`);

  // --- Logout explícito: debe invalidar el token — un resumeSession posterior
  // con el MISMO token tiene que fallar con sessionExpired, no con authOk. ---
  const wsALogout = await connect();
  send(wsALogout, { type: "resumeSession", refreshToken: aToken });
  const preLogout = await waitFor(wsALogout, (m) => m.type === "authOk" || m.type === "sessionExpired");
  check("token de A todavía válido justo antes del logout", preLogout.type === "authOk", JSON.stringify(preLogout).slice(0, 200));
  aToken = preLogout.session?.refreshToken || aToken;
  send(wsALogout, { type: "logout", refreshToken: aToken });
  const loggedOut = await waitFor(wsALogout, "loggedOut");
  check("logout responde loggedOut", loggedOut.type === "loggedOut", JSON.stringify(loggedOut));
  wsALogout.close();

  const wsAAfterLogout = await connect();
  send(wsAAfterLogout, { type: "resumeSession", refreshToken: aToken });
  const afterLogout = await waitFor(wsAAfterLogout, (m) => m.type === "authOk" || m.type === "sessionExpired");
  check("tras logout, resumeSession con el mismo token da sessionExpired (no authOk)", afterLogout.type === "sessionExpired", JSON.stringify(afterLogout).slice(0, 200));
  wsAAfterLogout.close();

  console.log(`\n=== RESUMEN: ${pass} OK / ${fail} fallidas ===`);
  if (fail) process.exitCode = 1;

  try { wsA.close(); } catch (e) {}
  try { wsB2.close(); } catch (e) {}
  await cleanupUser(A_USER.toLowerCase());
  await cleanupUser(B_USER.toLowerCase());
  console.log("[cleanup] usuarios de prueba borrados de Supabase.");
}

main().catch((e) => { console.error("❌ Error fatal:", e); process.exitCode = 1; });
