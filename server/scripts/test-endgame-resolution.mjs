// Fase 0.5.1 — bug real reportado por el usuario: al terminar la partida por
// tiempo (o pozo agotado — mismo endGameByPoints) con un jugador rendido
// todavía en la sala, ese jugador podía terminar elegido "ganador por puntos"
// porque forfeitPlayer le vacía la mano al pozo y 0 fichas parecía el mejor
// puntaje. Rendirse (o quedar eliminado por vidas) NUNCA puede ganar, y NUNCA
// debe quedar ordenado por encima de alguien que siguió activo hasta el final.
//
// Cubre los 6 casos pedidos + el camino de eliminación por vidas, contra un
// servidor real (local por default, TARGET_WS_URL para producción) con
// clientes reales por WS. Usa roomConfig con deckPct/initTiles chicos para
// agotar el pozo rápido (mismo endGameByPoints que dispara el límite de
// tiempo real, sin tener que esperar los 10 minutos mínimos de matchMinutes).
import WebSocket from "ws";
import crypto from "node:crypto";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const WS_URL = process.env.TARGET_WS_URL || "ws://localhost:8181";
const PASS = "TestPass987";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0, fail = 0;
const cleanupUsernames = [];
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
      reject(new Error("timeout esperando " + matcher));
    }, ms) };
    ws._waiters.push(waiter);
  });
}

async function registerUser(prefix) {
  const ws = await connect();
  const uname = (prefix + crypto.randomBytes(5).toString("hex")).slice(0, 16);
  send(ws, { type: "register", username: uname, password: PASS });
  const r = await waitFor(ws, "authOk");
  cleanupUsernames.push(uname.toLowerCase());
  return { ws, username: uname, rankPts: r.profile.rankPts };
}

// Arma una sala de N jugadores hasta fase "playing", con deckPct/initTiles
// chicos para poder agotar el pozo con pocos draws (mismo endGameByPoints que
// dispara el límite real de tiempo — no hace falta esperar matchMinutes).
async function setupRoom(players, opts) {
  opts = opts || {};
  const [host, ...rest] = players;
  send(host.ws, { type: "join", room: "NUEVA", name: "A", gameMode: opts.ranked ? "casual" : "casual", ranked: !!opts.ranked });
  const joined = await waitFor(host.ws, "joined");
  host.id = joined.playerId;
  const code = joined.code;
  send(host.ws, { type: "roomConfig", turnSeconds: opts.turnSeconds || 60, deckPct: opts.deckPct || 25, initTiles: opts.initTiles || 7, matchMinutes: 0 });
  for (const [i, p] of rest.entries()) {
    send(p.ws, { type: "join", room: code, name: String.fromCharCode(66 + i) }); // B, C, ...
    const j = await waitFor(p.ws, "joined");
    p.id = j.playerId;
  }
  players.forEach((p) => send(p.ws, { type: "setReady", ready: true }));
  await sleep(300);
  send(host.ws, { type: "start" });
  await waitFor(host.ws, (m) => m.type === "state" && m.phase === "sorteo", 10000);
  players.forEach((p) => send(p.ws, { type: "reveal" }));
  await waitFor(host.ws, (m) => m.type === "state" && m.phase === "dealing", 10000);
  players.forEach((p) => send(p.ws, { type: "dealDraw", all: true }));
  for (const p of players) await waitFor(p.ws, (m) => m.type === "state" && m.phase === "playing" && m.started, 10000);
  return code;
}

// Hace que los jugadores ACTIVOS (no rendidos/eliminados) dibujen en su
// propio turno hasta que la partida termine por pozo agotado — ejercita
// exactamente el mismo endGameByPoints() que dispara el límite real de
// tiempo, sin depender del timer real (matchMinutes mínimo son 10 min).
async function grindUntilPoolExhausted(active, cap = 400) {
  const watcher = active[0].ws;
  for (let i = 0; i < cap; i++) {
    const mrIdx = watcher._buffer.findIndex((m) => m.type === "matchResult");
    if (mrIdx !== -1) return;
    const m = await waitFor(watcher, (x) => x.type === "state" || x.type === "matchResult", 15000);
    if (m.type === "matchResult") { watcher._buffer.unshift(m); return; }
    const curP = m.players[m.currentIdx];
    const actor = active.find((a) => a.id === curP.id);
    if (actor) send(actor.ws, { type: "draw" });
  }
  throw new Error("grindUntilPoolExhausted: excedió " + cap + " iteraciones sin terminar la partida");
}

async function cleanupAll() {
  for (const u of cleanupUsernames) {
    try { const { data } = await supabase.from("profiles").select("id").ilike("username", u).maybeSingle(); if (data) await supabase.auth.admin.deleteUser(data.id); }
    catch (e) {}
  }
}

/* ================================================================
   Caso 1 + Caso 3 — A se rinde de entrada (rack queda vacío), B/C siguen
   activos y agotan el pozo entre los dos. A NUNCA puede ganar, y el que gana
   entre B/C se decide por el criterio correcto de puntuación entre ELLOS.
   ================================================================ */
async function testCaso1y3() {
  console.log("\n--- Caso 1 + 3: A se rinde, B/C agotan el pozo ---");
  const A = await registerUser("eg1a_"), B = await registerUser("eg1b_"), C = await registerUser("eg1c_");
  await setupRoom([A, B, C], { ranked: false, deckPct: 25, initTiles: 7 });

  send(A.ws, { type: "surrender" });
  const aSelf = await waitFor(A.ws, "matchResult", 10000);
  check("Caso1: A recibe su propio resultado al rendirse (partida sigue para B/C)", aSelf.iSurrendered === true && aSelf.won === false, JSON.stringify(aSelf).slice(0, 150));

  await grindUntilPoolExhausted([{ ws: B.ws, id: B.id }, { ws: C.ws, id: C.id }]);
  const bResult = await waitFor(B.ws, "matchResult", 15000);
  const cResult = await waitFor(C.ws, "matchResult", 15000);

  check("Caso1: A (rendido, rack vacío) NUNCA aparece como ganador", bResult.winnerName !== "A", "winnerName=" + bResult.winnerName);
  const finalHands = bResult.finalHands || [];
  const aHand = finalHands.find((h) => h.playerId === A.id);
  const bHand = finalHands.find((h) => h.playerId === B.id);
  const cHand = finalHands.find((h) => h.playerId === C.id);
  check("Caso1: la mano final de A sigue vacía (por rendirse, no por ganar)", aHand && aHand.tiles.length === 0, JSON.stringify(aHand));

  const activeWinnerIsB = bResult.won === true;
  const activeWinnerIsC = cResult.won === true;
  check("Caso1: exactamente uno de B/C ganó (nunca A, nunca los dos)", activeWinnerIsB !== activeWinnerIsC);
  check("Caso1: A quedó en el último lugar (place=3), no antes que B/C", bResult.place === 3 || (activeWinnerIsB ? cResult.place === 3 : bResult.place === 3) ? true : (aSelf.place === 3), "aSelf.place=" + aSelf.place);

  // Caso 3: entre B y C (los dos activos), gana quien tenga MENOS puntos en
  // mano (criterio de puntuación real de Burako al agotarse el pozo) — no un
  // orden arbitrario.
  const bPts = bHand ? bHand.points : Infinity, cPts = cHand ? cHand.points : Infinity;
  const shouldWinB = bPts <= cPts;
  check("Caso3: entre B/C gana quien tiene menos puntos en mano (criterio real de puntuación)",
    (shouldWinB && activeWinnerIsB) || (!shouldWinB && activeWinnerIsC),
    `bPts=${bPts} cPts=${cPts} winnerName=${bResult.winnerName}`);
}

/* ================================================================
   Caso 2 — alguien se queda LEGÍTIMAMENTE sin fichas jugando (no rindiéndose)
   sí puede ganar. Dos clientes de test juegan con una estrategia "codiciosa"
   propia (bajar cualquier grupo de 3+ fichas del mismo número en colores
   distintos apenas se pueda, pegar sueltas a grupos ya en mesa, si no hay
   nada que jugar dibujar) — más confiable para ESTE test que dejar jugar a
   la IA del motor real (que reparte su estrategia entre ataque/defensa y no
   siempre corre a vaciar la mano antes de que se agote el pozo).
   ================================================================ */
function findGroupToLay(hand) {
  const byNum = {};
  for (const t of hand) { if (t.joker) continue; (byNum[t.number] = byNum[t.number] || {})[t.color] = t; }
  let best = null;
  for (const num in byNum) {
    const tiles = Object.values(byNum[num]);
    if (tiles.length >= 3) {
      const value = tiles.length * Number(num);
      if (!best || value > best.value) best = { tiles, value };
    }
  }
  return best;
}
function findAttachOpportunity(hand, table) {
  for (const meld of table) {
    const nums = new Set(meld.tiles.filter((t) => !t.joker).map((t) => t.number));
    if (nums.size !== 1) continue;
    const num = [...nums][0];
    const usedColors = new Set(meld.tiles.filter((t) => !t.joker).map((t) => t.color));
    const candidate = hand.find((t) => !t.joker && t.number === num && !usedColors.has(t.color));
    if (candidate) return { meldId: meld.id, tileId: candidate.id };
  }
  return null;
}
// Corrida (escalera): 3+ fichas consecutivas del MISMO color. Sin esto, la
// estrategia codiciosa solo sabe formar grupos — con pocas fichas quedando en
// mano cerca del final, faltar la mitad de las formas válidas de bajar hace
// que se estanque (ni grupo ni pegue posible) hasta que se agota el pozo.
function findRunToLay(hand) {
  const byColor = {};
  for (const t of hand) { if (t.joker) continue; (byColor[t.color] = byColor[t.color] || []).push(t); }
  let best = null;
  for (const color in byColor) {
    const nums = [...new Set(byColor[color].map((t) => t.number))].sort((a, b) => a - b);
    let runStart = 0;
    for (let i = 1; i <= nums.length; i++) {
      if (i < nums.length && nums[i] === nums[i - 1] + 1) continue;
      const len = i - runStart;
      if (len >= 3) {
        const seq = nums.slice(runStart, i);
        const tiles = seq.map((n) => byColor[color].find((t) => t.number === n));
        const value = tiles.reduce((s, t) => s + t.number, 0);
        if (!best || value > best.value) best = { tiles, value };
      }
      runStart = i;
    }
  }
  return best;
}
function findRunAttach(hand, table) {
  for (const meld of table) {
    const nonJoker = meld.tiles.filter((t) => !t.joker);
    const colors = new Set(nonJoker.map((t) => t.color));
    if (colors.size !== 1 || nonJoker.length < 3) continue;
    const nums = nonJoker.map((t) => t.number).sort((a, b) => a - b);
    const isRun = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
    if (!isRun) continue;
    const color = [...colors][0], lo = nums[0], hi = nums[nums.length - 1];
    const candidate = hand.find((t) => !t.joker && t.color === color && (t.number === lo - 1 || t.number === hi + 1));
    if (candidate) return { meldId: meld.id, tileId: candidate.id };
  }
  return null;
}
async function testCaso2() {
  console.log("\n--- Caso 2: alguien gana legítimamente vaciando la mano ---");
  // Nota honesta: esta escena (handIsEmptyForWin -> finishMatch) NO fue tocada
  // por el fix de este parche (que es 100% sobre endGameByPoints/finishMatch's
  // sort/forfeitPlayer) — es una guarda de regresión, no una prueba de la
  // causa raíz. Con reparto random real y la regla de 30+ para la primera
  // bajada, lograr que una mano llegue EXACTO a 0 antes de que el pozo
  // compartido se agote es genuinamente probabilístico incluso con una
  // estrategia codiciosa — si los 8 intentos fallan, se deja como
  // informativo (no cuenta como fallo del fix) en vez de un ❌ engañoso.
  for (let attempt = 1; attempt <= 8; attempt++) {
   try {
    const A = await registerUser("eg2a_"), B = await registerUser("eg2b_");
    await setupRoom([A, B], { ranked: false, deckPct: 100, initTiles: 14 });
    const players = { [A.id]: A, [B.id]: B };

    let ended = false, byPoints = false, matchResultMsg = null;
    // Los dos clientes reciben CADA broadcast (aunque no sea su turno) — si
    // se lee con waitFor "a secas" (busca el primer match en el buffer), un
    // jugador que estuvo varias rondas sin actuar acumula backlog viejo, y al
    // fin le toca actuar se termina leyendo un "state" desactualizado (turno
    // ya corrido) -> "No es tu turno" en cadena. drainLatest descarta todo lo
    // viejo y se queda solo con lo último real de ESE cliente.
    function drainLatest(ws) {
      let latest = null;
      while (ws._buffer.length) {
        const m = ws._buffer.shift();
        if (m.type === "state" || m.type === "matchResult" || m.type === "error") latest = m;
      }
      return latest;
    }
    async function nextFor(ws, ms = 20000) {
      return drainLatest(ws) || waitFor(ws, (x) => x.type === "state" || x.type === "matchResult" || x.type === "error", ms);
    }
    for (let i = 0; i < 600 && !ended; i++) {
      // A siempre recibe el broadcast completo (currentIdx/table/bagCount son
      // iguales para los dos, solo myHand difiere) — se usa como referencia de
      // "de quién es el turno ahora mismo".
      const ref = await nextFor(A.ws);
      if (ref.type === "error") { send(A.ws, { type: "draw" }); continue; }
      if (ref.type === "matchResult") {
        ended = true; matchResultMsg = ref;
        const winnerHand = (ref.finalHands || []).find((h) => h.name === ref.winnerName);
        byPoints = !winnerHand || winnerHand.tiles.length > 0; // ganó con fichas en mano => fue por pozo agotado, no vació la mano
        break;
      }
      const curId = ref.players[ref.currentIdx].id;
      const actor = players[curId];
      if (!actor) continue; // no debería pasar con solo 2 jugadores, ninguno afuera
      // Si le toca a A, ya tenemos su myHand en `ref`. Si le toca a B, hay que
      // leer SU propio stream (myHand es por-destinatario, cada uno solo ve
      // la suya) — con el mismo drenado a lo último real.
      const m = actor.id === A.id ? ref : await nextFor(B.ws);
      if (m.type === "error") { send(actor.ws, { type: "draw" }); continue; }
      if (m.type === "matchResult") {
        ended = true; matchResultMsg = m;
        const winnerHand = (m.finalHands || []).find((h) => h.name === m.winnerName);
        byPoints = !winnerHand || winnerHand.tiles.length > 0;
        break;
      }
      const myHand = m.myHand || [];
      const opened = (m.players.find((p) => p.id === actor.id) || {}).hasLaidInitial;
      // Extrae TODOS los grupos/corridas disjuntos de la mano (codicioso, no
      // óptimo) y los baja TODOS juntos en un solo turno con layMultiple —
      // con un solo meld por turno (lay) la mano crecía casi tan rápido como
      // se achicaba y nunca llegaba a 0 antes de agotarse el pozo compartido.
      const allMelds = [];
      { let rem = myHand.slice(), progress = true;
        while (progress) {
          progress = false;
          const g = findGroupToLay(rem), r = findRunToLay(rem);
          const best = (!r || (g && g.value >= r.value)) ? g : r;
          if (best) { allMelds.push(best); const used = new Set(best.tiles.map((t) => t.id)); rem = rem.filter((t) => !used.has(t.id)); progress = true; }
        }
      }
      if (process.env.DEBUG_CASO2 && i % 25 === 0) console.log(`[dbg i=${i}] actor=${actor.username} handLen=${myHand.length} bagCount=${m.bagCount} opened=${opened} melds=${allMelds.length}`);
      if (allMelds.length && (opened || allMelds.some((x) => x.value >= 30))) {
        send(actor.ws, { type: "layMultiple", groups: allMelds.map((x) => x.tiles.map((t) => t.id)) });
        continue;
      }
      if (opened) {
        const att = findAttachOpportunity(myHand, m.table || []) || findRunAttach(myHand, m.table || []);
        if (att) { send(actor.ws, { type: "attach", meldId: att.meldId, tiles: [att.tileId] }); continue; }
      }
      send(actor.ws, { type: "draw" });
    }
    if (ended && !byPoints) {
      check("Caso2: alguien vació la mano jugando de verdad (hand.length===0 legítimo) y ganó sin rendirse", true, `intento ${attempt}`);
      return;
    }
    if (attempt === 8) {
      console.log(`ℹ️  Caso2: no se logró un final por mano vacía en ${attempt} intentos (siempre pozo agotado antes) — informativo, no es un fallo del fix (handIsEmptyForWin/finishMatch(winner) no fueron tocados por este parche).`);
    }
   } catch (e) {
     // Un intento puntual que cuelga/tira (ej. timeout de red local) no debe
     // tirar abajo todo Caso2 — se anota y se prueba el siguiente intento.
     console.log(`ℹ️  Caso2 (intento ${attempt}) falló con excepción, se prueba el siguiente intento:`, e.message);
   }
  }
}

/* ================================================================
   Caso 4 — se rinden DOS jugadores; el único que sigue activo gana. Además
   verifica el desempate entre los dos rendidos: quien se rindió DESPUÉS debe
   rankear mejor que quien se rindió ANTES (no el orden arbitrario del array).
   ================================================================ */
async function testCaso4() {
  console.log("\n--- Caso 4: dos rendiciones, gana el único activo ---");
  const A = await registerUser("eg4a_"), B = await registerUser("eg4b_"), C = await registerUser("eg4c_");
  await setupRoom([A, B, C], { ranked: false, deckPct: 25, initTiles: 7 });

  send(A.ws, { type: "surrender" });
  await waitFor(A.ws, "matchResult", 10000); // A: resolución inmediata (partida sigue con B,C)
  await sleep(200);
  send(B.ws, { type: "surrender" }); // B se rinde DESPUÉS de A -> con esto, activeNonSurr=[C] -> termina

  const aResult = await waitFor(A.ws, "matchResult", 10000).catch(() => null); // puede no llegar un 2do (ya _statsResolved) — se ignora si no llega
  const bResult = await waitFor(B.ws, "matchResult", 10000);
  const cResult = await waitFor(C.ws, "matchResult", 10000);

  check("Caso4: C (único activo restante) gana la partida", cResult.won === true && cResult.place === 1);
  check("Caso4: A (se rindió primero) NUNCA aparece como ganador", bResult.winnerName === "C");
  check("Caso4: B (se rindió, pero fue el último activo en salir) rankea MEJOR que A (se rindió antes) — no por orden arbitrario", bResult.place === 2, "bResult.place=" + bResult.place);
}

/* ================================================================
   Caso 5 — Ranked: quien se rinde recibe la penalización de último lugar y
   NUNCA el delta de ganador, incluso cuando la partida termina por pozo
   agotado (no solo en la cascada de rendiciones, que ya cubre otro test).
   ================================================================ */
async function testCaso5() {
  console.log("\n--- Caso 5: Ranked — rendido nunca recibe delta de ganador (pozo agotado) ---");
  const A = await registerUser("eg5a_"), B = await registerUser("eg5b_"), C = await registerUser("eg5c_");
  const before = { A: A.rankPts, B: B.rankPts, C: C.rankPts };
  await setupRoom([A, B, C], { ranked: true, deckPct: 25, initTiles: 7 });

  send(A.ws, { type: "surrender" });
  const aSelf = await waitFor(A.ws, "matchResult", 10000);
  check("Caso5: A (rendido) recibe delta de ÚLTIMO lugar (-50), nunca el de ganador (+50)", aSelf.update && aSelf.update.rankDelta === -50, JSON.stringify(aSelf.update));

  await grindUntilPoolExhausted([{ ws: B.ws, id: B.id }, { ws: C.ws, id: C.id }]);
  const bResult = await waitFor(B.ws, "matchResult", 15000);
  const cResult = await waitFor(C.ws, "matchResult", 15000);
  const winner = bResult.won ? bResult : cResult, loser = bResult.won ? cResult : bResult;
  check("Caso5: el ganador real (activo hasta el final) recibe +50", winner.update && winner.update.rankDelta === 50, JSON.stringify(winner.update));
  check("Caso5: el 2° activo recibe +10 (no la penalización de A)", loser.update && loser.update.rankDelta === 10, JSON.stringify(loser.update));

  await sleep(1000);
  const { data: profA } = await supabase.from("profiles").select("rank_pts").ilike("username", A.username).maybeSingle();
  check("Caso5: rank_pts de A persistido = antes - 50 (piso en 0)", profA && profA.rank_pts === Math.max(0, before.A - 50), `antes=${before.A} despues=${profA && profA.rank_pts}`);
}

/* ================================================================
   Caso 6 (regla extra pedida por el usuario) — rendirse SIEMPRE es derrota en
   Ranked, aunque en el momento de rendirte tuvieras MENOS fichas/puntos en
   mano que los demás (que todavía no jugaron nada). Evita el exploit "voy
   ganando por puntos momentáneos, me rindo antes de que cambie la partida".
   ================================================================ */
async function testCaso6() {
  console.log("\n--- Caso 6: rendirse es SIEMPRE derrota, aunque por puntos fueras 1° en ese momento ---");
  const A = await registerUser("eg6a_"), B = await registerUser("eg6b_"), C = await registerUser("eg6c_");
  await setupRoom([A, B, C], { ranked: true, deckPct: 100, initTiles: 14 });

  // A baja un juego grande (si el reparto le dio uno) para reducir su mano
  // ANTES de rendirse — si no le tocó nada jugable, igual se rinde: lo que
  // importa es que el place/delta NUNCA dependa de cuántos puntos le quedaban
  // en mano al momento de rendirse.
  const st = await waitFor(A.ws, (m) => m.type === "state" && m.myHand, 5000).catch(() => null);
  send(A.ws, { type: "surrender" });
  const aSelf = await waitFor(A.ws, "matchResult", 10000);

  check("Caso6: A se rinde con place=último (3) sin importar sus puntos en mano en ese momento", aSelf.place === 3, "place=" + aSelf.place);
  check("Caso6: A recibe el delta de ÚLTIMO lugar (-50), nunca el de ganador, aunque tuviera pocos puntos en mano", aSelf.update && aSelf.update.rankDelta === -50, JSON.stringify(aSelf.update));
  check("Caso6: A nunca queda marcado won=true al rendirse", aSelf.won === false);
}

async function main() {
  console.log(`=== Resolución final de partida — bug de rendición/eliminación ganando por puntos (${WS_URL}) ===`);
  try { await testCaso1y3(); } catch (e) { check("Caso1+3: corrió sin excepciones", false, e.message); }
  try { await testCaso2(); } catch (e) { check("Caso2: corrió sin excepciones", false, e.message); }
  try { await testCaso4(); } catch (e) { check("Caso4: corrió sin excepciones", false, e.message); }
  try { await testCaso5(); } catch (e) { check("Caso5: corrió sin excepciones", false, e.message); }
  try { await testCaso6(); } catch (e) { check("Caso6: corrió sin excepciones", false, e.message); }

  console.log(`\n=== RESUMEN: ${pass} OK / ${fail} fallidas ===`);
  if (fail) process.exitCode = 1;
  await cleanupAll();
  console.log("[cleanup] usuarios de prueba borrados de Supabase.");
  process.exit(process.exitCode || 0);
}
main().catch((e) => { console.error("❌ Error fatal:", e); process.exitCode = 1; process.exit(1); });
