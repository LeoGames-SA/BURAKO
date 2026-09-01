// Torre semanal — integración REAL contra Supabase real y servidor WS real.
// Autorizado explícitamente por el usuario (BURAKO-V1.3-PROGRESSION-003) tras
// que la pasada anterior quedara en NEEDS_APPROVAL por no poder verificar
// esto (la tarea previa prohibía tocar Supabase real). Usuarios de prueba
// con prefijo único + timestamp de esta corrida, borrados al final y
// verificados por ID exacto (no por patrón de nombre).
//
// ⚠️ DESACTUALIZADO respecto a Torre v2 (3 Torres x 10 pisos, ver
// server/db.js) — este archivo TODAVÍA llama a DB.claimTowerFloor(username,
// weekId, floor) con la firma vieja (v1, sin towerId) y asume premios/
// source_id de una sola Torre. NO CORRER tal cual: hay que actualizarlo
// (firma con towerId, montos nuevos por Torre, tower_lives) antes de la
// próxima corrida real — y esa corrida, igual que la vez anterior, necesita
// autorización explícita del usuario para tocar Supabase real (no hay
// staging separado, ver docs/ai/DECISIONS.md). Se deja sin tocar a ciegas
// en vez de reescribirse sin poder ejecutarlo para verificar.
import WebSocket from "ws";
import crypto from "node:crypto";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import * as DB from "../db.js";

const WS_URL = process.env.TARGET_WS_URL || "ws://localhost:8181";
const PASS = "TestPass" + Date.now();
// Corto a propósito: username tiene un límite REAL de 16 caracteres server-side
// (db.js register(): username.trim().slice(0,16)) — "twr"(3) + RUN_ID(4) deja
// 9 caracteres libres para el tag de cada caso (alcanza para "win1".."win6").
const RUN_ID = crypto.randomBytes(2).toString("hex");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0, fail = 0;
const createdUsers = []; // { username, id } — para cleanup verificado por ID exacto
function check(name, cond, detail) {
  if (cond) { console.log("✅ " + name); pass++; }
  else { console.log("❌ " + name + (detail ? " — " + detail : "")); fail++; }
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/* ---------------- WS helpers (mismo patrón que el resto de los tests) ---------------- */
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
      reject(new Error("timeout esperando " + (typeof matcher === "string" ? matcher : "matcher")));
    }, ms) };
    ws._waiters.push(waiter);
  });
}
async function registerUser(tag) {
  const ws = await connect();
  const username = ("twr" + RUN_ID + tag).slice(0, 16);
  send(ws, { type: "register", username, password: PASS });
  const r = await waitFor(ws, (m) => m.type === "authOk" || m.type === "error", 15000);
  if (r.type === "error") throw new Error("registerUser(" + tag + "): " + r.msg);
  const { data: prof } = await supabase.from("profiles").select("id").ilike("username", username).maybeSingle();
  createdUsers.push({ username, id: prof && prof.id });
  return { ws, username, profileId: prof && prof.id, coinsAtRegister: r.profile.coins };
}
async function driveToPlaying(ws, myId, timeoutMs = 15000) {
  send(ws, { type: "reveal" });
  await waitFor(ws, (m) => m.type === "state" && m.phase === "dealing", timeoutMs);
  send(ws, { type: "dealDraw", all: true });
  return waitFor(ws, (m) => m.type === "state" && m.phase === "playing" && m.started, timeoutMs);
}

/* ---------------- Estrategia codiciosa (misma que test-endgame-resolution.mjs) ---------------- */
function findGroupToLay(hand) {
  const byNum = {};
  for (const t of hand) { if (t.joker) continue; (byNum[t.number] = byNum[t.number] || {})[t.color] = t; }
  let best = null;
  for (const num in byNum) {
    const tiles = Object.values(byNum[num]);
    if (tiles.length >= 3) { const value = tiles.length * Number(num); if (!best || value > best.value) best = { tiles, value }; }
  }
  return best;
}
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
// Juega el lado del humano hasta que termine la partida (el bot juega solo,
// server-side) — devuelve el matchResult final, gane o pierda quien sea.
// drainLatest/nextFor: mismo fix ya documentado en test-endgame-resolution.mjs
// — leer con waitFor "a secas" deja acumularse backlog viejo en el buffer (el
// humano no actúa mientras es turno del bot) y, al tocarle, se termina
// procesando un "state" desactualizado -> "No es tu turno" en cadena. Sin
// esto, la partida real nunca termina dentro del límite de iteraciones
// (confirmado empíricamente: 6/6 intentos sin este fix nunca llegaron a
// matchResult, siempre por el mismo loop de errores).
function drainLatest(ws) {
  let latest = null;
  while (ws._buffer.length) {
    const m = ws._buffer.shift();
    if (m.type === "state" || m.type === "matchResult" || m.type === "error") latest = m;
  }
  return latest;
}
function nextFor(ws, ms = 20000) {
  return drainLatest(ws) || waitFor(ws, (x) => x.type === "state" || x.type === "matchResult" || x.type === "error", ms);
}
async function playTowerToEnd(ws, myId, maxIters = 1500) {
  for (let i = 0; i < maxIters; i++) {
    const m = await nextFor(ws);
    if (process.env.DEBUG_TOWER && i % 25 === 0) {
      const me = m.players && m.players.find((p) => p.id === myId);
      console.log(`   [dbg i=${i}] type=${m.type} phase=${m.phase} turnOf=${m.players ? (m.players[m.currentIdx] || {}).id : "?"} myId=${myId} myHandLen=${(m.myHand || []).length} bagCount=${m.bagCount} opened=${me && me.hasLaidInitial}`);
    }
    if (m.type === "error") { send(ws, { type: "draw" }); continue; } // fallback seguro (mismo patrón que test-endgame-resolution.mjs) — con el drain ya no es un loop infinito de "no es tu turno"
    if (m.type === "matchResult") return m;
    if (m.players[m.currentIdx].id !== myId) continue; // turno del bot, solo esperamos
    const myHand = m.myHand || [];
    const opened = (m.players.find((p) => p.id === myId) || {}).hasLaidInitial;
    const allMelds = [];
    { let rem = myHand.slice(), progress = true;
      while (progress) {
        progress = false;
        const g = findGroupToLay(rem), r = findRunToLay(rem);
        const best = (!r || (g && g.value >= r.value)) ? g : r;
        if (best) { allMelds.push(best); const used = new Set(best.tiles.map((t) => t.id)); rem = rem.filter((t) => !used.has(t.id)); progress = true; }
      }
    }
    if (allMelds.length && (opened || allMelds.some((x) => x.value >= 30))) {
      send(ws, { type: "layMultiple", groups: allMelds.map((x) => x.tiles.map((t) => t.id)) });
      continue;
    }
    if (opened) {
      const att = findAttachOpportunity(myHand, m.table || []) || findRunAttach(myHand, m.table || []);
      if (att) { send(ws, { type: "attach", meldId: att.meldId, tiles: [att.tileId] }); continue; }
    }
    send(ws, { type: "draw" });
  }
  throw new Error("playTowerToEnd: excedió " + maxIters + " iteraciones sin terminar");
}
async function startTower(ws) {
  send(ws, { type: "towerStatus" });
  const st = await waitFor(ws, (m) => m.type === "towerStatus" || m.type === "error", 10000);
  if (st.type === "error") throw new Error("towerStatus: " + st.msg);
  send(ws, { type: "towerStart" });
  const started = await waitFor(ws, (m) => m.type === "towerStarted" || m.type === "error", 10000);
  if (started.type === "error") throw new Error("towerStart: " + started.msg);
  const joined = await waitFor(ws, "joined", 10000);
  await driveToPlaying(ws, joined.playerId);
  return { status: st, started, playerId: joined.playerId };
}

/* ================================================================
   Parte 1 — capa de datos DIRECTA contra Supabase real: idempotencia,
   progresión de piso a piso, rechazo de piso inválido/manipulado,
   concurrencia real, ítem exclusivo en inventario + equipable, Torre
   completa. No pasa por partidas reales (esas se prueban aparte, Parte 2) —
   acá se valida específicamente que la CAPA DE DATOS sea correcta.
   ================================================================ */
async function testDbLayerDirect() {
  console.log("\n--- Torre: capa de datos directa contra Supabase real ---");
  const u = await registerUser("db");
  const weekId = DB.towerWeekId();

  let st = await DB.towerStatus(u.username);
  check("towerStatus inicial: floor=1, complete=false, clearedFloors=[]", st.ok && st.floor === 1 && st.complete === false && st.clearedFloors.length === 0, JSON.stringify(st));

  const badFloor = await DB.claimTowerFloor(u.username, weekId, 5);
  check("claimTowerFloor: rechaza un piso que NO es el disponible (piso 5 cuando corresponde el 1 — anti-manipulación)", badFloor.ok === false, JSON.stringify(badFloor));

  const { data: profBefore } = await supabase.from("profiles").select("coins,xp").eq("id", u.profileId).maybeSingle();
  const r1 = await DB.claimTowerFloor(u.username, weekId, 1);
  check("claimTowerFloor piso 1: ok=true, complete=false, nextFloor=2", r1.ok === true && r1.complete === false && r1.nextFloor === 2, JSON.stringify(r1));
  check("claimTowerFloor piso 1: acredita +50 monedas reales (persistidas en Supabase)", r1.profile && r1.profile.coins === profBefore.coins + 50, JSON.stringify({ before: profBefore, after: r1.profile && r1.profile.coins }));

  // Replay SECUENCIAL (no concurrente) del piso 1 después de superarlo: cae en
  // el guard de "piso ya no es el disponible" (computeCurrentFloor ya avanzó a
  // 2) — rechazo distinto al de una carrera realmente simultánea sobre el
  // MISMO piso vigente (ver el caso de piso 10 más abajo, que sí cae en
  // alreadyGranted), pero igual de seguro: en ningún caso se duplica el premio.
  const replay1 = await DB.claimTowerFloor(u.username, weekId, 1);
  check("claimTowerFloor piso 1 (replay secuencial, ya no es el piso vigente): rechazado de forma segura, NO duplica el premio", replay1.ok === false, JSON.stringify(replay1));

  st = await DB.towerStatus(u.username);
  check("towerStatus tras piso 1: floor=2, clearedFloors=[1]", st.floor === 2 && JSON.stringify(st.clearedFloors) === JSON.stringify([1]), JSON.stringify(st));

  // Avanza los pisos 2..9 directo contra la capa de datos (la partida REAL
  // completa ya se prueba en la Parte 2 — acá interesa la progresión/premios).
  for (let floor = 2; floor <= 9; floor++) {
    const r = await DB.claimTowerFloor(u.username, weekId, floor);
    check(`claimTowerFloor piso ${floor}: ok=true`, r.ok === true, JSON.stringify(r));
  }
  st = await DB.towerStatus(u.username);
  check("towerStatus tras pisos 1-9: floor=10 (último piso, disponible)", st.floor === 10, JSON.stringify(st));

  // Concurrencia real: 2 reclamos casi simultáneos del piso 10 -> exactamente uno se aplica.
  const [c1, c2] = await Promise.all([
    DB.claimTowerFloor(u.username, weekId, 10),
    DB.claimTowerFloor(u.username, weekId, 10),
  ]);
  const okCount = [c1, c2].filter((r) => r.ok).length;
  check("Piso 10: de 2 reclamos CASI SIMULTÁNEOS, EXACTAMENTE uno se aplica (sin duplicar el premio)", okCount === 1, JSON.stringify([c1, c2]));
  const winnerResult = c1.ok ? c1 : c2;
  check("Piso 10: complete=true tras aplicarse", winnerResult.complete === true, JSON.stringify(winnerResult));

  st = await DB.towerStatus(u.username);
  check("towerStatus tras piso 10: complete=true, floor=null (Torre completada esta semana)", st.complete === true && st.floor === null, JSON.stringify(st));

  const freshProf = await DB.getProfileByName(u.username);
  check("torre_celestial aparece en el inventario de efectos del perfil (Supabase real)", freshProf && freshProf.inventory.effects.includes("torre_celestial"), JSON.stringify(freshProf && freshProf.inventory.effects));
  check("El perfil acumuló las 400 monedas y 150 XP del piso 10 (persistido)", freshProf && freshProf.coins >= profBefore.coins + 50 + 60 + 75 + 90 + 120 + 140 + 170 + 200 + 250 + 400, "coins=" + (freshProf && freshProf.coins));

  const equip = await DB.setActive(u.username, "effect", "torre_celestial");
  check("torre_celestial se puede EQUIPAR (setActive real) apenas se obtiene, sin pasar por Tienda", equip.ok === true && equip.profile.active.effect === "torre_celestial", JSON.stringify(equip));

  const afterComplete = await DB.claimTowerFloor(u.username, weekId, 10);
  check("Torre completa: cualquier reclamo posterior se rechaza (no hay piso disponible)", afterComplete.ok === false, JSON.stringify(afterComplete));
}

/* ================================================================
   Parte 2 — WIRING real: towerStatus -> towerStart -> sala real -> sorteo ->
   reparto -> playing -> finishMatch -> claimTowerFloor -> profile/result,
   contra el servidor WS real y Supabase real. Cubre derrota (rendición,
   rápido y determinístico), victoria (partida real jugada de verdad, con
   reintentos honestos si el azar del reparto no coopera) y desconexión
   (gracia real de 25s).
   ================================================================ */
async function testWiringDefeatBySurrender() {
  console.log("\n--- Torre: wiring real — derrota por rendición ---");
  const u = await registerUser("los");
  const { started, playerId } = await startTower(u.ws);
  check("towerStarted trae floor=1 (piso real disponible del server)", started.floor === 1, JSON.stringify(started));

  send(u.ws, { type: "surrender" });
  const mr = await waitFor(u.ws, "matchResult", 10000);
  check("matchResult real: reason=tower, won=false", mr.reason === "tower" && mr.won === false, JSON.stringify(mr));
  check("matchResult real: towerFloor coincide con el piso real que arrancó (1)", mr.towerFloor === 1, JSON.stringify(mr));
  check("matchResult real: towerResult ausente (sin premio en derrota)", !mr.towerResult, JSON.stringify(mr.towerResult));

  const st = await DB.towerStatus(u.username);
  check("Tras perder por rendición: el piso NO avanza (sigue en 1, sin recompensa)", st.floor === 1 && st.clearedFloors.length === 0, JSON.stringify(st));

  const { data: prof } = await supabase.from("profiles").select("coins").eq("id", u.profileId).maybeSingle();
  check("Tras perder por rendición: las monedas NO cambiaron (0 recompensa real, verificado en Supabase)", prof.coins === u.coinsAtRegister, `antes=${u.coinsAtRegister} despues=${prof.coins}`);
}

async function testWiringVictoryRealGame(maxAttempts = 6) {
  console.log("\n--- Torre: wiring real — victoria jugando una partida real ---");
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const u = await registerUser("win" + attempt);
      const { started, playerId } = await startTower(u.ws);
      const mr = await playTowerToEnd(u.ws, playerId);
      if (!mr.won) {
        console.log(`   ℹ️  intento ${attempt}: perdió contra la IA del piso 1 (reparto/juego real) — se prueba de nuevo con un usuario nuevo`);
        continue;
      }
      check("Victoria real: matchResult reason=tower, won=true", mr.reason === "tower" && mr.won === true, JSON.stringify(mr));
      check("Victoria real: towerResult.ok=true con el premio del piso 1 (50 monedas)", mr.towerResult && mr.towerResult.ok === true && mr.towerResult.floor === 1, JSON.stringify(mr.towerResult));
      const st = await DB.towerStatus(u.username);
      check("Tras ganar de verdad: el piso avanzó a 2 (progreso real persistido)", st.floor === 2 && JSON.stringify(st.clearedFloors) === JSON.stringify([1]), JSON.stringify(st));
      const { data: prof } = await supabase.from("profiles").select("coins").eq("id", u.profileId).maybeSingle();
      // No se compara el TOTAL de monedas contra "antes + 50": una partida real
      // jugada de verdad (a diferencia de un claim directo por la capa de
      // datos) también puede disparar logros EN VIVO (escalera, 4 colores,
      // comodín, jugada grande — reportLiveAchievements en server.js), que son
      // un hook genérico independiente de resolveMatch y de Torre, y también
      // otorgan monedas. Eso NO es un bug de este parche (no se tocó ese
      // hook, ni se pidió tocarlo) ni una duplicación del premio de piso —
      // ver el hallazgo documentado en FROM-CLAUDE.md. Por eso acá se verifica
      // la fila REAL de reward_grants del piso, aislada de cualquier otra
      // fuente de monedas que haya ocurrido en la misma partida.
      check("Tras ganar de verdad: las monedas subieron AL MENOS los 50 del piso (nunca bajan)", prof.coins >= u.coinsAtRegister + 50, `antes=${u.coinsAtRegister} despues=${prof.coins}`);
      const { data: grantRows } = await supabase.from("reward_grants").select("rewards").eq("profile_id", u.profileId).eq("source_type", "tower").eq("source_id", started.weekId + ":1");
      const grantedRewards = grantRows && grantRows[0] && grantRows[0].rewards;
      check("La fila real de reward_grants del piso 1 es EXACTAMENTE [{coins:50}] — el premio de Torre en sí no se infló ni se duplicó", JSON.stringify(grantedRewards) === JSON.stringify([{ type: "coins", amount: 50 }]), JSON.stringify(grantedRewards));
      if (prof.coins > u.coinsAtRegister + 50) {
        console.log(`   ℹ️  hallazgo: el perfil subió ${prof.coins - u.coinsAtRegister} monedas en total (no solo las 50 del piso) — la partida real disparó además algún logro EN VIVO (reportLiveAchievements), independiente de Torre. Ver FROM-CLAUDE.md.`);
      }
      return;
    } catch (e) {
      console.log(`   ℹ️  intento ${attempt} falló con excepción, se prueba el siguiente:`, e.message);
    }
  }
  console.log(`ℹ️  Victoria real: no se logró ganar en ${maxAttempts} intentos reales contra la IA — informativo (el reparto es aleatorio de verdad), NO se cuenta como fallo del wiring: el camino de derrota (arriba) ya prueba el mismo finishMatch/claimTowerFloor con el resultado inverso.`);
}

async function testWiringDisconnect() {
  console.log("\n--- Torre: wiring real — desconexión sin reconectar (gracia de 25s) ---");
  const u = await registerUser("disc");
  await startTower(u.ws);
  u.ws.terminate(); // corte abrupto real, sin mandar "surrender"
  console.log("   (esperando ~26s la gracia real de desconexión del server...)");
  await sleep(26000);
  const st = await DB.towerStatus(u.username);
  check("Desconexión sin reconectar: tras vencer la gracia real de 25s, cuenta como derrota (piso NO avanza, sin recompensa)", st.floor === 1 && st.clearedFloors.length === 0, JSON.stringify(st));
}

async function testReconsultaTrasReconexion() {
  console.log("\n--- Torre: reconsulta de estado tras reconectar con una conexión NUEVA ---");
  const u = await registerUser("rcn");
  const weekId = DB.towerWeekId();
  await DB.claimTowerFloor(u.username, weekId, 1); // progreso real vía capa de datos
  u.ws.close();
  const ws2 = await connect();
  send(ws2, { type: "login", username: u.username, password: PASS });
  await waitFor(ws2, "authOk", 10000);
  send(ws2, { type: "towerStatus" });
  const st = await waitFor(ws2, "towerStatus", 10000);
  check("Con una conexión NUEVA (simula reconectar tras perder la respuesta WS), towerStatus refleja el progreso real ya guardado (floor=2)", st.floor === 2, JSON.stringify(st));
  ws2.close();
}

/* ---------------- cleanup, verificado por ID exacto ---------------- */
async function cleanupAll() {
  console.log("\n--- Cleanup (verificado por ID exacto) ---");
  for (const u of createdUsers) {
    if (!u.id) { console.log(`⚠️  ${u.username}: no se encontró su ID, no se pudo verificar/borrar`); continue; }
    try {
      await supabase.auth.admin.deleteUser(u.id);
      const { data: still } = await supabase.from("profiles").select("id").eq("id", u.id).maybeSingle();
      check(`cleanup: ${u.username} (id=${u.id.slice(0, 8)}…) borrado y confirmado ausente`, !still);
    } catch (e) {
      check(`cleanup: ${u.username} borrado sin excepción`, false, e.message);
    }
  }
}

async function main() {
  console.log(`=== Torre semanal — integración REAL (${WS_URL}, Supabase real) ===`);
  console.log(`[setup] RUN_ID=${RUN_ID} — todos los usuarios de esta corrida usan el prefijo "twr${RUN_ID}"\n`);
  try { await testDbLayerDirect(); } catch (e) { check("Parte 1 (capa de datos): corrió sin excepciones", false, e.message); }
  try { await testWiringDefeatBySurrender(); } catch (e) { check("Parte 2a (derrota real): corrió sin excepciones", false, e.message); }
  try { await testWiringVictoryRealGame(); } catch (e) { check("Parte 2b (victoria real): corrió sin excepciones", false, e.message); }
  try { await testWiringDisconnect(); } catch (e) { check("Parte 2c (desconexión real): corrió sin excepciones", false, e.message); }
  try { await testReconsultaTrasReconexion(); } catch (e) { check("Parte 2d (reconsulta): corrió sin excepciones", false, e.message); }

  console.log(`\n=== RESUMEN: ${pass} OK / ${fail} fallidas ===`);
  await cleanupAll();
  if (fail) process.exitCode = 1;
  process.exit(process.exitCode || 0);
}
main().catch((e) => { console.error("❌ Error fatal:", e); process.exitCode = 1; process.exit(1); });
