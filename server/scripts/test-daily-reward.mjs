// Ruleta diaria (v1.3) — cubre la lógica pura (fecha de Uruguay, aritmética de
// días, fórmula de racha, monedas por segmentos discretos) SIN tocar Supabase,
// y el flujo real de punta a punta (WS + Supabase real, servidor local) usando
// la infraestructura YA DESPLEGADA (reward_grants/grant_rewards de Fase 1 — ver
// el comentario de diseño en server/db.js sobre por qué NO hace falta una tabla
// nueva `daily_reward_state`: la idempotencia y la racha se derivan de
// reward_grants, lo que permite probar esto real hoy mismo, sin depender de que
// alguien aplique una migración a mano primero).
import WebSocket from "ws";
import crypto from "node:crypto";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import * as DB from "../db.js";

const WS_URL = process.env.TARGET_WS_URL || "ws://localhost:8181";
const PASS = "TestPass456";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0, fail = 0;
const cleanupUsernames = [];
function check(name, cond, detail) {
  if (cond) { console.log("✅ " + name); pass++; }
  else { console.log("❌ " + name + (detail ? " — " + detail : "")); fail++; }
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/* ---------------- Parte 1: lógica pura, sin Supabase ---------------- */
function testPureLogic() {
  console.log("--- Lógica pura (fecha/racha/monedas) ---");

  const today = DB.uruguayDateStr(new Date());
  check("uruguayDateStr: formato YYYY-MM-DD", /^\d{4}-\d{2}-\d{2}$/.test(today), today);

  check("addDaysISO: +1 día cruza de mes correctamente (2026-01-31 -> 2026-02-01)", DB.addDaysISO("2026-01-31", 1) === "2026-02-01");
  check("addDaysISO: -1 día cruza de año correctamente (2027-01-01 -> 2026-12-31)", DB.addDaysISO("2027-01-01", -1) === "2026-12-31");
  check("addDaysISO: +1 día en año bisiesto (2028-02-29 -> 2028-03-01)", DB.addDaysISO("2028-02-28", 1) === "2028-02-29");

  // countConsecutivePriorDays: cuenta hacia atrás desde AYER (nunca incluye "hoy").
  const T = "2026-06-15";
  const y1 = DB.addDaysISO(T, -1), y2 = DB.addDaysISO(T, -2), y3 = DB.addDaysISO(T, -3);
  check("countConsecutivePriorDays: sin ninguna tirada previa -> 0 (próxima racha = día 1)", DB.countConsecutivePriorDays(new Set(), T) === 0);
  check("countConsecutivePriorDays: ayer tirado, antes de ayer no -> 1", DB.countConsecutivePriorDays(new Set([y1]), T) === 1);
  check("countConsecutivePriorDays: 3 días consecutivos antes de hoy -> 3", DB.countConsecutivePriorDays(new Set([y1, y2, y3]), T) === 3);
  check("countConsecutivePriorDays: hueco (ayer sí, antes de ayer NO, hace 3 sí) -> corta en 1, no sigue de largo", DB.countConsecutivePriorDays(new Set([y1, y3]), T) === 1);
  check("countConsecutivePriorDays: 'hoy' en el set NO cuenta (solo mira estrictamente antes de hoy)", DB.countConsecutivePriorDays(new Set([T, y1, y2]), T) === 2);

  // Fórmula de racha: streakDay = (consecutivos % 7) + 1 — wrap correcto en 7 -> 1.
  const streakFor = (consec) => (consec % 7) + 1;
  check("racha: 0 días previos -> día 1", streakFor(0) === 1);
  check("racha: 6 días previos consecutivos -> día 7", streakFor(6) === 7);
  check("racha: 7 días previos consecutivos -> vuelve a día 1 (no día 8)", streakFor(7) === 1);
  check("racha: 13 días previos consecutivos -> día 7 de nuevo (13%7=6 -> +1=7)", streakFor(13) === 7);
  check("racha: 14 días previos consecutivos -> día 1 de nuevo (segundo ciclo completo)", streakFor(14) === 1);

  // Monedas: siempre dentro del rango del día, siempre uno de los 8 valores discretos
  // (subido de 5 a 8 junto con el rediseño de la Ruleta — la rueda nueva tiene 8 gajos
  // físicos dibujados, y cada uno necesita su propio monto real para que el giro
  // pueda frenar siempre en el centro de un gajo, ver DAILY_REWARD_SEGMENTS en db.js).
  const ranges = { 1: [50, 80], 2: [60, 100], 3: [80, 120], 4: [100, 150], 5: [130, 190], 6: [170, 240], 7: [250, 400] };
  let allInRange = true, allDiscrete = true, sawVariety = false;
  const seenByDay = {};
  for (let day = 1; day <= 7; day++) {
    const [lo, hi] = ranges[day];
    const step = (hi - lo) / 7;
    const validValues = new Set([0, 1, 2, 3, 4, 5, 6, 7].map((i) => Math.round(lo + step * i)));
    seenByDay[day] = new Set();
    for (let i = 0; i < 60; i++) {
      const c = DB.pickDailyCoins(day);
      if (c < lo || c > hi) allInRange = false;
      if (!validValues.has(c)) allDiscrete = false;
      seenByDay[day].add(c);
    }
    if (seenByDay[day].size > 1) sawVariety = true;
  }
  check("pickDailyCoins: siempre cae dentro del rango [min,max] de su día (1..7)", allInRange);
  check("pickDailyCoins: siempre es uno de los 8 valores discretos del rango, nunca un monto arbitrario", allDiscrete);
  check("pickDailyCoins: hay variedad real entre tiradas (no siempre el mismo valor fijo)", sawVariety);
  check("pickDailyCoins: día 7 apunta más alto que día 1 (racha larga paga más)", Math.max(...seenByDay[7]) > Math.max(...seenByDay[1]));

  const ms = DB.msUntilNextUruguayMidnight(new Date());
  check("msUntilNextUruguayMidnight: devuelve un valor positivo y menor a 24hs", ms > 0 && ms <= 24 * 3600 * 1000, "ms=" + ms);
}

/* ---------------- Parte 2: flujo real end-to-end (WS + Supabase real) ---------------- */
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
function waitFor(ws, matcher, ms = 10000) {
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
async function registerUser(prefix) {
  const ws = await connect();
  const username = (prefix + crypto.randomBytes(5).toString("hex")).slice(0, 16);
  send(ws, { type: "register", username, password: PASS });
  const r = await waitFor(ws, "authOk");
  cleanupUsernames.push(username.toLowerCase());
  return { ws, username, profileId: null, coinsBefore: r.profile.coins };
}

async function testLiveFlow() {
  console.log("\n--- Flujo real (WS + Supabase) ---");
  const u = await registerUser("dr_");
  const { data: prof } = await supabase.from("profiles").select("id").ilike("username", u.username).maybeSingle();
  u.profileId = prof && prof.id;

  send(u.ws, { type: "dailyStatus" });
  const st1 = await waitFor(u.ws, "dailyStatus", 10000);
  check("dailyStatus (usuario nuevo): claimedToday=false", st1.claimedToday === false, JSON.stringify(st1));
  check("dailyStatus (usuario nuevo): streakDay=1 (nunca tiró antes)", st1.streakDay === 1, JSON.stringify(st1));
  check("dailyStatus: manda msUntilNext > 0", typeof st1.msUntilNext === "number" && st1.msUntilNext > 0);

  send(u.ws, { type: "dailySpin" });
  const spin1 = await waitFor(u.ws, "dailyResult", 10000);
  check("dailySpin día 1: ok=true", spin1.ok === true, JSON.stringify(spin1));
  check("dailySpin día 1: streakDay=1", spin1.streakDay === 1, JSON.stringify(spin1));
  check("dailySpin día 1: coins dentro de [50,80]", spin1.coins >= 50 && spin1.coins <= 80, "coins=" + spin1.coins);
  const profMsg = await waitFor(u.ws, "profile", 5000).catch(() => null);
  check("dailySpin: manda un 'profile' actualizado con las monedas ya sumadas", !!profMsg && profMsg.profile.coins === u.coinsBefore + spin1.coins, JSON.stringify(profMsg && profMsg.profile));

  // Reclamar de nuevo el MISMO día -> rechazado, sin importar reintentos.
  send(u.ws, { type: "dailySpin" });
  const spin2 = await waitFor(u.ws, "dailyResult", 10000);
  check("dailySpin (mismo día, 2do intento): ok=false, alreadyClaimed=true", spin2.ok === false && spin2.alreadyClaimed === true, JSON.stringify(spin2));

  send(u.ws, { type: "dailyStatus" });
  const st2 = await waitFor(u.ws, "dailyStatus", 10000);
  check("dailyStatus tras reclamar: claimedToday=true", st2.claimedToday === true);
  check("dailyStatus tras reclamar: streakDay sigue siendo 1 (el de HOY, no cambia hasta mañana)", st2.streakDay === 1);

  // Doble click real: 2 dailySpin CASI simultáneos -> exactamente uno se aplica
  // (mismo mecanismo que test-reward-engine.mjs, pero ejercitado por Ruleta).
  const u2 = await registerUser("drrace_");
  send(u2.ws, { type: "dailySpin" });
  send(u2.ws, { type: "dailySpin" });
  const r1 = await waitFor(u2.ws, "dailyResult", 10000);
  const r2 = await waitFor(u2.ws, "dailyResult", 10000);
  const oks = [r1, r2].filter((r) => r.ok).length;
  check("Doble click: de 2 dailySpin casi simultáneos, exactamente UNO se aplica", oks === 1, JSON.stringify([r1, r2]));

  // Simular que AYER también tiró (insert directo en reward_grants, mismo
  // mecanismo real que usa claimDailyReward) -> hoy la racha debe avanzar a 2.
  const u3 = await registerUser("drstreak_");
  const { data: prof3 } = await supabase.from("profiles").select("id").ilike("username", u3.username).maybeSingle();
  const yesterday = DB.addDaysISO(DB.uruguayDateStr(new Date()), -1);
  const { error: insErr } = await supabase.from("reward_grants").insert({ profile_id: prof3.id, source_type: "roulette", source_id: yesterday, rewards: [{ type: "coins", amount: 60 }] });
  check("[setup] se insertó una tirada simulada de AYER para el usuario de racha", !insErr, insErr && insErr.message);
  send(u3.ws, { type: "dailyStatus" });
  const st3 = await waitFor(u3.ws, "dailyStatus", 10000);
  check("dailyStatus: con ayer tirado, hoy la racha muestra día 2", st3.streakDay === 2, JSON.stringify(st3));
  send(u3.ws, { type: "dailySpin" });
  const spin3 = await waitFor(u3.ws, "dailyResult", 10000);
  check("dailySpin: con racha de día 2, el premio cae en el rango de día 2 [60,100]", spin3.ok === true && spin3.coins >= 60 && spin3.coins <= 100, JSON.stringify(spin3));

  [u, u2, u3].forEach((x) => x.ws.close());
}

async function cleanupAll() {
  for (const uname of cleanupUsernames) {
    try { const { data } = await supabase.from("profiles").select("id").ilike("username", uname).maybeSingle(); if (data) await supabase.auth.admin.deleteUser(data.id); }
    catch (e) {}
  }
}

async function main() {
  console.log(`=== Ruleta diaria (${WS_URL}) ===\n`);
  try { testPureLogic(); } catch (e) { check("Lógica pura: corrió sin excepciones", false, e.message); }
  try { await testLiveFlow(); } catch (e) { check("Flujo real: corrió sin excepciones", false, e.message); }
  console.log(`\n=== RESUMEN: ${pass} OK / ${fail} fallidas ===`);
  await cleanupAll();
  console.log("[cleanup] usuarios de prueba borrados de Supabase.");
  if (fail) process.exitCode = 1;
  process.exit(process.exitCode || 0);
}
main().catch((e) => { console.error("❌ Error fatal:", e); process.exitCode = 1; process.exit(1); });
