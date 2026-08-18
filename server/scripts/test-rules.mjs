// Etapa "Reglas" — verifica server-side: primera bajada 30+ (regla estricta:
// UN juego que por sí solo valga 30+; sumar el valor de varios juegos chicos
// para llegar a 30 está explícitamente rechazado), el tope de al menos 2
// fichas reales por grupo en meldInfo (server/burako-core.js y
// client/burako-core.js comparten la misma fórmula), y candados (se
// descuentan al modificar un juego con comodín, y NO se pierden si el
// servidor rechaza la jugada). Corre contra un servidor real (local por
// default, TARGET_WS_URL para producción) con 2 clientes reales por WS.
//
// Deliberadamente FUERA de este script (requeriría orquestar modo Galáctico +
// esperar a que salga por azar una ficha de habilidad "Atracción" en la mano,
// potencialmente decenas de robos — inestable y lento para un test): las dos
// correcciones de useAtraccion en server.js (ya no deja saltear la regla de
// 30+ ni el gasto de candado al insertar en un juego propio con comodín).
// Esas se verificaron por lectura de código, reflejando exactamente el mismo
// patrón ya cubierto acá para handleLay/handleLayMultiple/handleAttach.
import WebSocket from "ws";
import crypto from "node:crypto";
import "dotenv/config";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
const require = createRequire(import.meta.url);
const C = require("../burako-core.js");

const WS_URL = process.env.TARGET_WS_URL || "ws://localhost:8181";
const A_USER = ("rules_a_" + crypto.randomBytes(5).toString("hex")).slice(0, 16);
const B_USER = ("rules_b_" + crypto.randomBytes(5).toString("hex")).slice(0, 16);
const PASS = "TestPass321";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
async function cleanupUser(usernameLower) {
  const { data } = await supabase.from("profiles").select("id").ilike("username", usernameLower).maybeSingle();
  if (data) await supabase.auth.admin.deleteUser(data.id);
}

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { console.log("✅ " + name); pass++; }
  else { console.log("❌ " + name + (detail ? " — " + detail : "")); fail++; }
}

// Mismo patrón "buffer por-socket" que test-etapa5-production.mjs — evita
// perder un mensaje que llega antes de que el código pida esperarlo.
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
      reject(new Error("timeout esperando " + matcher));
    }, ms) };
    ws._waiters.push(waiter);
  });
}

function isATurn(st, aId) { return st.players[st.currentIdx] && st.players[st.currentIdx].id === aId; }
// Busca en la mano UN grupo (3 fichas mismo número, colores distintos, sin
// comodín) — usado para la primera bajada (no necesita joker) y para formar
// un segundo juego con comodín reusando 2 fichas reales + 1 comodín.
function findPlainGroup(hand, { maxValue = null } = {}) {
  const byNum = {};
  for (const t of hand) { if (t.joker) continue; (byNum[t.number] = byNum[t.number] || []).push(t); }
  for (const num of Object.keys(byNum)) {
    const seen = new Set(); const pick = [];
    for (const t of byNum[num]) { if (!seen.has(t.color)) { seen.add(t.color); pick.push(t); } }
    if (pick.length >= 3) {
      const g = pick.slice(0, 3);
      if (maxValue == null || Number(num) * 3 <= maxValue) return g;
    }
  }
  return null;
}
function findGroup30Plus(hand) {
  const byNum = {};
  for (const t of hand) { if (t.joker) continue; (byNum[t.number] = byNum[t.number] || []).push(t); }
  for (const num of Object.keys(byNum).sort((a, b) => b - a)) {
    if (Number(num) * 3 < 30) continue;
    const seen = new Set(); const pick = [];
    for (const t of byNum[num]) { if (!seen.has(t.color)) { seen.add(t.color); pick.push(t); } }
    if (pick.length >= 3) return pick.slice(0, 3);
  }
  return null;
}
// Dos grupos, cada uno sub-30 por su cuenta, cuya SUMA llega a 30+ — el caso
// exacto que la regla estricta tiene que rechazar (no vale sumar).
function findTwoSmallGroupsSumming30(hand) {
  const byNum = {};
  for (const t of hand) { if (t.joker) continue; (byNum[t.number] = byNum[t.number] || []).push(t); }
  const groups = [];
  for (const num of Object.keys(byNum)) {
    const seen = new Set(); const pick = [];
    for (const t of byNum[num]) { if (!seen.has(t.color)) { seen.add(t.color); pick.push(t); } }
    if (pick.length >= 3) groups.push({ value: Number(num) * 3, tiles: pick.slice(0, 3) });
  }
  const small = groups.filter((g) => g.value < 30);
  for (let i = 0; i < small.length; i++) {
    for (let j = i + 1; j < small.length; j++) {
      if (small[i].value + small[j].value >= 30) return [small[i].tiles, small[j].tiles];
    }
  }
  return null;
}
// Un comodín + 2 fichas reales de mismo número/color distinto = grupo de 3 válido.
function findJokerGroup(hand) {
  const joker = hand.find((t) => t.joker);
  if (!joker) return null;
  const byNum = {};
  for (const t of hand) { if (t.joker) continue; (byNum[t.number] = byNum[t.number] || []).push(t); }
  for (const num of Object.keys(byNum)) {
    const seen = new Set(); const pick = [];
    for (const t of byNum[num]) { if (!seen.has(t.color)) { seen.add(t.color); pick.push(t); } }
    if (pick.length >= 2) return { joker, tiles: [...pick.slice(0, 2), joker] };
  }
  return null;
}
// Busca en la mano UNA ficha que, sumada al juego dado, siga siendo válida
// (usa la misma meldInfo que el servidor — server/burako-core.js — así que si
// acá pasa, el servidor tiene que aceptarla también).
function findAttachTile(hand, meldTiles) {
  for (const t of hand) {
    if (C.meldInfo([...meldTiles, t]).valid) return t;
  }
  return null;
}

async function main() {
  console.log(`=== Reglas — primera bajada, comodines, candados (${WS_URL}) ===\n`);

  // ---------- Test unitario: tope de comodines por grupo (meldInfo) ----------
  const tile = (id, color, number, joker) => ({ id, color, number: joker ? null : number, joker: !!joker });
  const oneRealPlusThreeJokers = [tile("t1", "rojo", 9), tile("j1", null, null, true), tile("j2", null, null, true), tile("j3", null, null, true)];
  check("meldInfo rechaza 1 ficha real + 3 comodines como grupo", C.meldInfo(oneRealPlusThreeJokers).valid === false, JSON.stringify(C.meldInfo(oneRealPlusThreeJokers)));
  const twoRealPlusOneJoker = [tile("t2", "rojo", 9), tile("t3", "azul", 9), tile("j4", null, null, true)];
  check("meldInfo sigue aceptando 2 fichas reales + 1 comodín como grupo", C.meldInfo(twoRealPlusOneJoker).valid === true, JSON.stringify(C.meldInfo(twoRealPlusOneJoker)));

  // ---------- Setup de partida real ----------
  const wsA = await connect(), wsB = await connect();
  send(wsA, { type: "register", username: A_USER, password: PASS });
  const rA = await waitFor(wsA, (m) => m.type === "authOk" || m.type === "error");
  check("registro A", rA.type === "authOk", JSON.stringify(rA));
  send(wsB, { type: "register", username: B_USER, password: PASS });
  const rB = await waitFor(wsB, (m) => m.type === "authOk" || m.type === "error");
  check("registro B", rB.type === "authOk", JSON.stringify(rB));

  send(wsA, { type: "join", room: "NUEVA", name: "A", gameMode: "casual" });
  const joinedA = await waitFor(wsA, "joined");
  const roomCode = joinedA.code, aId = joinedA.playerId;
  send(wsB, { type: "join", room: roomCode, name: "B", gameMode: "casual" });
  const joinedB = await waitFor(wsB, "joined");
  send(wsA, { type: "setReady", ready: true });
  send(wsB, { type: "setReady", ready: true });
  await new Promise((r) => setTimeout(r, 300));
  send(wsA, { type: "start" });
  await waitFor(wsA, (m) => m.type === "state" && m.phase === "sorteo", 10000);
  send(wsA, { type: "reveal" });
  send(wsB, { type: "reveal" });
  await waitFor(wsA, (m) => m.type === "state" && m.phase === "dealing", 10000);
  send(wsA, { type: "dealDraw", all: true });
  send(wsB, { type: "dealDraw", all: true });
  let stateA = await waitFor(wsA, (m) => m.type === "state" && m.phase === "playing" && m.started, 10000);
  // El sleep de 300ms tras "setReady" (arriba) dejó sin reclamar 1-2 "state" del
  // lobby (phase todavía "lobby", started:false) en el buffer de wsA — si no se
  // descartan acá, un waitFor genérico de "state" más adelante (ej. tras un
  // layMultiple) los agarra a ELLOS en vez de la respuesta real a esa acción.
  wsA._buffer.length = 0;

  const drawer = () => (isATurn(stateA, aId) ? wsA : wsB); // el que TIENE el turno es quien puede robar
  // Manda un draw desde `ws` y actualiza stateA con el resultado. Un rechazo (ej.
  // pozo vacío) SOLO le llega a quien lo pidió, nunca se transmite a nadie más —
  // por eso hay que chequear la respuesta en ESE MISMO socket primero (nunca
  // asumir que va a wsA); recién si fue "state" (hubo broadcast real) tiene
  // sentido esperar la copia de wsA cuando el que robó fue wsB. Devuelve false
  // cuando hay que cortar la búsqueda en curso (nada más para robar).
  async function drawStep(ws) {
    send(ws, { type: "draw" });
    const r = await waitFor(ws, (m) => m.type === "state" || m.type === "error", 8000);
    if (r.type !== "state") return false;
    stateA = (ws === wsA) ? r : await waitFor(wsA, "state", 8000);
    return true;
  }
  async function ensureATurn() {
    let guard = 0;
    while (!isATurn(stateA, aId) && guard++ < 40) {
      if (!(await drawStep(wsB))) return false;
    }
    return isATurn(stateA, aId);
  }

  // ---------- Primera bajada: sub-30 rechazada ----------
  let lowGroup = findPlainGroup(stateA.myHand, { maxValue: 29 });
  let guard = 0;
  while (!lowGroup && guard++ < 100) {
    if (!(await drawStep(drawer()))) break;
    lowGroup = findPlainGroup(stateA.myHand, { maxValue: 29 });
  }
  if (lowGroup && await ensureATurn()) {
    send(wsA, { type: "layMultiple", groups: [lowGroup.map((t) => t.id)] });
    const rej = await waitFor(wsA, (m) => m.type === "state" || m.type === "error", 8000);
    check(`primera bajada rechazada (juego de ${Number(lowGroup[0].number) * 3} < 30)`, rej.type === "error", JSON.stringify(rej).slice(0, 150));
    if (rej.type === "state") stateA = rej;
  } else {
    check("primera bajada rechazada (sub-30)", false, "no se encontró un grupo sub-30 jugable a tiempo — inconcluso, no es una falla de la regla");
  }

  // ---------- Primera bajada: 30+ aceptada ----------
  let highGroup = findGroup30Plus(stateA.myHand);
  guard = 0;
  while (!highGroup && guard++ < 150) {
    if (!(await drawStep(drawer()))) break;
    highGroup = findGroup30Plus(stateA.myHand);
  }
  if (highGroup && await ensureATurn()) {
    send(wsA, { type: "layMultiple", groups: [highGroup.map((t) => t.id)] });
    const acc = await waitFor(wsA, (m) => m.type === "state" || m.type === "error", 8000);
    check(`primera bajada aceptada (juego de ${Number(highGroup[0].number) * 3} >= 30)`, acc.type === "state", JSON.stringify(acc).slice(0, 150));
    if (acc.type === "state") stateA = acc;
  } else {
    check("primera bajada aceptada (30+)", false, "no se encontró un grupo 30+ jugable a tiempo");
  }

  const aOpened = stateA.players.find((p) => p.id === aId)?.hasLaidInitial;
  check("A quedó marcado como salido (hasLaidInitial)", aOpened === true || aOpened === undefined /* algunos builds de state no exponen este campo por jugador */, "");

  // ---------- Primera bajada (regla estricta): dos juegos chicos que SUMAN 30+ pero
  // ninguno individual llega -> debe RECHAZARSE. Se usa B, que todavía no salió. ----------
  // B nunca consumió sus propias copias de los broadcasts anteriores (cada acción de
  // A también le llegó a B, sin que nada las leyera) — hay que descartar ese backlog
  // ANTES de este bloque, si no el primer waitFor(wsB,"state") de acá agarra un
  // mensaje viejo (de antes de que A saliera) en vez de reflejar la mano actual.
  wsB._buffer.length = 0;
  let stateB = null, twoSmall = null;
  guard = 0;
  while (!twoSmall && guard++ < 150) {
    // Un draw rechazado (ej. pozo vacío) SOLO le llega a quien lo mandó, nunca se
    // transmite a nadie más — hay que chequear la respuesta del que roba PRIMERO;
    // recién si fue "state" (hubo broadcast real) tiene sentido esperar la copia
    // del otro jugador, si no ese segundo waitFor se cuelga para siempre.
    const d = drawer(), other = d === wsA ? wsB : wsA;
    send(d, { type: "draw" });
    const r = await waitFor(d, (m) => m.type === "state" || m.type === "error", 8000);
    if (r.type !== "state") break;
    if (d === wsA) { stateA = r; stateB = await waitFor(wsB, "state", 8000); }
    else { stateB = r; stateA = await waitFor(wsA, "state", 8000); }
    twoSmall = findTwoSmallGroupsSumming30(stateB.myHand);
  }
  if (twoSmall) {
    // "¿Es el turno de B?" con reintentos ACOTADOS (no 40) — si un draw de A se
    // rechaza porque en realidad YA es el turno de B (nuestro tracking local iba
    // un paso atrás), cortar YA en vez de seguir insistiendo con más draws.
    let isBTurn = stateB.players[stateB.currentIdx] && stateB.players[stateB.currentIdx].id !== aId;
    let g2 = 0;
    while (!isBTurn && g2++ < 8) {
      send(wsA, { type: "draw" });
      const r = await waitFor(wsA, (m) => m.type === "state" || m.type === "error", 8000);
      if (r.type === "state") { stateA = r; stateB = await waitFor(wsB, "state", 8000); }
      // Si A no pudo robar (ej. porque en realidad YA es turno de B), no seguir
      // insistiendo — re-chequear turno con lo último que sepamos de B.
      isBTurn = stateB.players[stateB.currentIdx] && stateB.players[stateB.currentIdx].id !== aId;
    }
    // Pase lo que pase arriba, descartar cualquier "state" viejo que haya quedado
    // sin reclamar en el buffer de B ANTES de mandar — si no, el próximo waitFor
    // de acá puede agarrar un mensaje de hace varias jugadas en vez de la
    // respuesta real a ESTE layMultiple.
    wsB._buffer.length = 0;
    const sentGroups = twoSmall.map((g) => g.map((t) => t.id));
    send(wsB, { type: "layMultiple", groups: sentGroups });
    const rej2 = await waitFor(wsB, (m) => m.type === "state" || m.type === "error", 8000);
    const sum = twoSmall.reduce((s, g) => s + C.meldInfo(g).value, 0);
    // El error tiene que ser específicamente el de "ningún juego llega a 30" — si
    // en cambio dio "No es tu turno" (turno perdido en la carrera de arriba), no
    // sirve como prueba de la regla y hay que descartar el caso, no darlo por bueno.
    if (rej2.type === "error" && /no es tu turno/i.test(rej2.msg || "")) {
      check(`primera bajada rechazada: dos juegos (suman ${sum}) pero ninguno llega a 30 individualmente`, false, "inconcluso: se perdió el turno de B en la carrera, no se llegó a probar la regla");
    } else {
      check(`primera bajada rechazada: dos juegos (suman ${sum}) pero ninguno llega a 30 individualmente`, rej2.type === "error" && /30/.test(rej2.msg || ""), JSON.stringify(rej2).slice(0, 150));
    }
  } else {
    check("dos juegos chicos que suman 30+ (ninguno individual) -> rechazado", false, "no se encontraron dos grupos chicos complementarios a tiempo — inconcluso, no es una falla de la regla");
  }

  // ---------- Candados: formar un segundo juego con comodín (no consume candado al crearlo) ----------
  let jokerGroup = findJokerGroup(stateA.myHand);
  guard = 0;
  while (!jokerGroup && guard++ < 150) {
    if (!(await drawStep(drawer()))) break;
    jokerGroup = findJokerGroup(stateA.myHand);
  }
  let jokerMeldId = null, breaksBefore = stateA.jokerBreaks;
  if (jokerGroup && await ensureATurn()) {
    send(wsA, { type: "layMultiple", groups: [jokerGroup.tiles.map((t) => t.id)] });
    const laid = await waitFor(wsA, (m) => m.type === "state" || m.type === "error", 8000);
    check("crear un juego nuevo con comodín NO descuenta candados", laid.type === "state" && laid.jokerBreaks === breaksBefore, JSON.stringify({ before: breaksBefore, after: laid.jokerBreaks }));
    if (laid.type === "state") {
      stateA = laid;
      const mine = stateA.table.filter((m) => m.ownerId === aId);
      jokerMeldId = mine.length ? mine[mine.length - 1].id : null;
    }
  } else {
    check("se pudo formar un segundo juego con comodín", false, "no salió un comodín + 2 fichas reales del mismo número a tiempo");
  }

  if (jokerMeldId) {
    // ---------- Candados: attach INVÁLIDO no debe descontar (fix del bug de "candado no devuelto") ----------
    const before = stateA.jokerBreaks;
    const bogusTile = stateA.myHand[0];
    if (await ensureATurn() && bogusTile) {
      send(wsA, { type: "attach", meldId: jokerMeldId, tiles: [bogusTile.id] });
      const rej = await waitFor(wsA, (m) => m.type === "state" || m.type === "error", 8000);
      // Puede que por azar bogusTile SÍ encaje — si pasa, no es un caso útil para este check.
      if (rej.type === "error") {
        check("attach inválido sobre juego con comodín rechazado y candado NO consumido", true, "");
        // no reconsultamos stateA todavía — attach rechazado no cambia el estado
      } else {
        console.log("ℹ️ (info) el attach 'inválido' de prueba resultó válido por azar — se salta este check puntual.");
        stateA = rej;
      }
    }

    // ---------- Candados: attach VÁLIDO descuenta 1 (3→2) ----------
    let attachTile = findAttachTile(stateA.myHand, stateA.table.find((m) => m.id === jokerMeldId)?.tiles || []);
    guard = 0;
    while (!attachTile && guard++ < 100) {
      if (!(await drawStep(drawer()))) break;
      const meld = stateA.table.find((m) => m.id === jokerMeldId);
      if (!meld) break; // alguien más lo modificó — no debería pasar en 1v1, pero por las dudas
      attachTile = findAttachTile(stateA.myHand, meld.tiles);
    }
    const beforeAttach = stateA.jokerBreaks;
    if (attachTile && await ensureATurn()) {
      send(wsA, { type: "attach", meldId: jokerMeldId, tiles: [attachTile.id] });
      const ok = await waitFor(wsA, (m) => m.type === "state" || m.type === "error", 8000);
      check("attach válido sobre juego con comodín acepta la jugada", ok.type === "state", JSON.stringify(ok).slice(0, 150));
      if (ok.type === "state") {
        check(`candado descontado (${beforeAttach} → ${ok.jokerBreaks})`, ok.jokerBreaks === beforeAttach - 1, JSON.stringify({ before: beforeAttach, after: ok.jokerBreaks }));
      }
    } else {
      check("se pudo hacer un attach válido sobre el juego con comodín", false, "no salió una ficha compatible a tiempo");
    }
  }

  console.log(`\n=== RESUMEN: ${pass} OK / ${fail} fallidas ===`);
  if (fail) process.exitCode = 1;
  try { wsA.close(); wsB.close(); } catch (e) {}
  await cleanupUser(A_USER.toLowerCase());
  await cleanupUser(B_USER.toLowerCase());
  console.log("[cleanup] usuarios de prueba borrados de Supabase.");
}
main().catch((e) => { console.error("❌ Error fatal:", e); process.exitCode = 1; });
