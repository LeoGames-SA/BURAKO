// Etapa "Ranked/MMR" — reproduce EXACTAMENTE el bug real encontrado: en una
// sala ranked de 3 jugadores humanos, si alguien se rinde a mitad de partida
// (con 2+ jugadores todavía activos), server/db.js resolveMatch() recalculaba
// "place"/"isWinner"/rankDelta a partir del ÍNDICE del array en vez del campo
// `place` ya calculado por el llamador — quien se rendía terminaba tratado
// como GANADOR (+50 en vez de -50), y el filtrado posterior en finishMatch
// podía correr los índices de los que seguían jugando. Corre contra un
// servidor real (local por default, TARGET_WS_URL para producción) con 3
// clientes reales por WS.
import WebSocket from "ws";
import crypto from "node:crypto";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const WS_URL = process.env.TARGET_WS_URL || "ws://localhost:8181";
const PASS = "TestPass987";
const A_USER = ("rk_a_" + crypto.randomBytes(5).toString("hex")).slice(0, 16);
const B_USER = ("rk_b_" + crypto.randomBytes(5).toString("hex")).slice(0, 16);
const C_USER = ("rk_c_" + crypto.randomBytes(5).toString("hex")).slice(0, 16);

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

async function main() {
  console.log(`=== Ranked/MMR — rendición a mitad de partida (${WS_URL}) ===\n`);

  const wsA = await connect(), wsB = await connect(), wsC = await connect();
  send(wsA, { type: "register", username: A_USER, password: PASS });
  const rA = await waitFor(wsA, "authOk");
  send(wsB, { type: "register", username: B_USER, password: PASS });
  const rB = await waitFor(wsB, "authOk");
  send(wsC, { type: "register", username: C_USER, password: PASS });
  const rC = await waitFor(wsC, "authOk");
  const rankBefore = { A: rA.profile.rankPts, B: rB.profile.rankPts, C: rC.profile.rankPts };
  console.log("[setup] rank_pts inicial:", rankBefore);

  send(wsA, { type: "join", room: "NUEVA", name: "A", gameMode: "ranked", ranked: true });
  const joinedA = await waitFor(wsA, "joined");
  const roomCode = joinedA.code;
  send(wsB, { type: "join", room: roomCode, name: "B" });
  await waitFor(wsB, "joined");
  send(wsC, { type: "join", room: roomCode, name: "C" });
  await waitFor(wsC, "joined");

  send(wsA, { type: "setReady", ready: true });
  send(wsB, { type: "setReady", ready: true });
  send(wsC, { type: "setReady", ready: true });
  await new Promise((r) => setTimeout(r, 400));
  send(wsA, { type: "start" });
  await waitFor(wsA, (m) => m.type === "state" && m.phase === "sorteo", 10000);
  send(wsA, { type: "reveal" }); send(wsB, { type: "reveal" }); send(wsC, { type: "reveal" });
  await waitFor(wsA, (m) => m.type === "state" && m.phase === "dealing", 10000);
  send(wsA, { type: "dealDraw", all: true }); send(wsB, { type: "dealDraw", all: true }); send(wsC, { type: "dealDraw", all: true });
  await waitFor(wsA, (m) => m.type === "state" && m.phase === "playing" && m.started, 10000);
  await waitFor(wsB, (m) => m.type === "state" && m.phase === "playing" && m.started, 10000);
  await waitFor(wsC, (m) => m.type === "state" && m.phase === "playing" && m.started, 10000);

  // ---------- C se rinde con A y B todavía activos (2 activos restantes) — el
  // caso exacto que disparaba forfeitPlayer's "resolución individual", donde el
  // array de un solo elemento hacía que C se tratara como ganador. ----------
  send(wsC, { type: "surrender" });
  const cResult = await waitFor(wsC, "matchResult", 10000);
  check("C recibe matchResult por su propia rendición (iSurrendered)", cResult.iSurrendered === true, JSON.stringify(cResult).slice(0, 200));
  check("C NO queda marcado como ganador al rendirse", cResult.won === false, JSON.stringify(cResult).slice(0, 150));
  const cUpd = cResult.update;
  check("C recibe un update de rank (perfil rankeado)", !!cUpd, JSON.stringify(cResult).slice(0, 150));
  if (cUpd) {
    check(`C (se rindió, 3 jugadores) recibe el delta de ÚLTIMO lugar (-50), no el de ganador (+50)`, cUpd.rankDelta === -50, `rankDelta=${cUpd.rankDelta}`);
    check("C recibe place=3 (último de 3), no place=1", cUpd.place === 3, `place=${cUpd.place}`);
  }

  // ---------- B también se rinde -> con solo A activo, termina la partida.
  // finishMatch debe resolver a A (1°) y B (2°) con SUS placements reales, sin
  // que el filtrado de C (ya resuelto) les corra el índice. ----------
  send(wsB, { type: "surrender" });
  const aResult = await waitFor(wsA, "matchResult", 10000);
  const bResult = await waitFor(wsB, "matchResult", 10000);
  check("A gana la partida (único activo restante)", aResult.won === true, JSON.stringify(aResult).slice(0, 150));
  const aUpd = aResult.update, bUpd = bResult.update;
  if (aUpd) check("A (ganador, 1°/3) recibe +50", aUpd.rankDelta === 50, `rankDelta=${aUpd.rankDelta}`);
  // B y C quedaron empatados en "se rindieron" — el desempate entre ellos lo hace
  // finishMatch por puntos en mano (sin relación con este fix, no se toca), así
  // que B puede terminar 2°/3 o 3°/3 según cuántos puntos tenía en mano en el
  // momento — lo que importa acá (justamente lo que rompía antes) es que el
  // delta que recibe coincida con SU place real, no que se le corra el índice
  // por el filtrado de C (ya resuelto) ni que nunca reciba el bonus de ganador.
  const RANK_DELTAS_3 = [50, 10, -50];
  if (bUpd) {
    check("B (se rindió, terminó 2° o 3° real, nunca 1°) no recibe el delta de ganador", bUpd.place !== 1 && bUpd.rankDelta !== 50, `place=${bUpd.place} rankDelta=${bUpd.rankDelta}`);
    check(`B recibe el delta correcto para SU place real (${bUpd.place})`, bUpd.rankDelta === RANK_DELTAS_3[bUpd.place - 1], `place=${bUpd.place} rankDelta=${bUpd.rankDelta} esperado=${RANK_DELTAS_3[bUpd.place - 1]}`);
  }

  // ---------- Verificación final contra Supabase: rank_pts persistido coincide
  // con antes + delta reportado (self-consistente, no un número fijo — el place
  // real de B depende del desempate por puntos en mano). ----------
  await new Promise((r) => setTimeout(r, 1000));
  const { data: profA } = await supabase.from("profiles").select("rank_pts").ilike("username", A_USER).maybeSingle();
  const { data: profB } = await supabase.from("profiles").select("rank_pts").ilike("username", B_USER).maybeSingle();
  const { data: profC } = await supabase.from("profiles").select("rank_pts").ilike("username", C_USER).maybeSingle();
  check("rank_pts de A persistido = antes + 50", profA && profA.rank_pts === rankBefore.A + 50, `antes=${rankBefore.A} despues=${profA && profA.rank_pts}`);
  if (bUpd) check("rank_pts de B persistido = antes + su delta real", profB && profB.rank_pts === rankBefore.B + bUpd.rankDelta, `antes=${rankBefore.B} delta=${bUpd.rankDelta} despues=${profB && profB.rank_pts}`);
  check("rank_pts de C persistido = antes - 50 (piso en 0)", profC && profC.rank_pts === Math.max(0, rankBefore.C - 50), `antes=${rankBefore.C} despues=${profC && profC.rank_pts}`);

  console.log(`\n=== RESUMEN: ${pass} OK / ${fail} fallidas ===`);
  if (fail) process.exitCode = 1;
  try { wsA.close(); wsB.close(); wsC.close(); } catch (e) {}
  await cleanupUser(A_USER.toLowerCase());
  await cleanupUser(B_USER.toLowerCase());
  await cleanupUser(C_USER.toLowerCase());
  console.log("[cleanup] usuarios de prueba borrados de Supabase.");
}
main().catch((e) => { console.error("❌ Error fatal:", e); process.exitCode = 1; });
