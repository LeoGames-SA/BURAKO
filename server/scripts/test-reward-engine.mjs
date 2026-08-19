// Fase 1 — motor de recompensas centralizado (server/db.js: grantRewards,
// claimGrantSlot, RPC grant_rewards). A diferencia de los otros scripts de
// test (que hablan por WS), este habla DIRECTO con db.js — grantRewards no
// tiene todavía ningún mensaje WS propio (es infraestructura para features
// futuras: Ranked rewards, Ruleta, Misiones, Torre — no implementadas en
// esta fase), así que se prueba en el mismo nivel en el que hoy se invoca.
// Corre contra Supabase real (mismo .env que usa el server).
import "dotenv/config";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const DB = (await import("../db.js")).default;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { console.log("✅ " + name); pass++; }
  else { console.log("❌ " + name + (detail ? " — " + detail : "")); fail++; }
}

const createdUsernames = [];
async function makeTestUser(prefix) {
  const username = (prefix + crypto.randomBytes(5).toString("hex")).slice(0, 16);
  const email = username.toLowerCase() + "@users.burako.internal";
  const { data, error } = await supabase.auth.admin.createUser({
    email, password: "TestPass987", email_confirm: true, user_metadata: { username },
  });
  if (error) throw new Error("no se pudo crear usuario de test: " + error.message);
  createdUsernames.push(username.toLowerCase());
  // el trigger handle_new_user() crea profiles en la misma transacción, pero
  // a veces tarda un instante en verse reflejado del lado de PostgREST.
  for (let i = 0; i < 8; i++) {
    const { data: prof } = await supabase.from("profiles").select("id,coins,xp").ilike("username", username).maybeSingle();
    if (prof) return { username, profileId: prof.id, startCoins: prof.coins, startXp: prof.xp };
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("profiles no apareció a tiempo para " + username);
}
async function cleanup() {
  for (const u of createdUsernames) {
    try { const { data } = await supabase.from("profiles").select("id").ilike("username", u).maybeSingle(); if (data) await supabase.auth.admin.deleteUser(data.id); }
    catch (e) {}
  }
}
async function getCoinsXp(username) {
  const { data } = await supabase.from("profiles").select("coins,xp").ilike("username", username).maybeSingle();
  return data;
}

async function main() {
  console.log("=== Motor de recompensas centralizado (Fase 1) ===\n");

  // ---------- Reward simple, una vez ----------
  {
    const u = await makeTestUser("rw1_");
    const r = await DB.grantRewards(u.username, [{ type: "coins", amount: 100 }], { type: "test", id: "simple1" });
    check("grantRewards ok:true en el primer intento", r.ok === true, JSON.stringify(r));
    check("alreadyGranted:false la primera vez", r.alreadyGranted === false);
    const after = await getCoinsXp(u.username);
    check("+100 coins aplicado exactamente una vez", after.coins === u.startCoins + 100, `antes=${u.startCoins} despues=${after.coins}`);
  }

  // ---------- Idempotencia: mismo source dos veces (secuencial) ----------
  {
    const u = await makeTestUser("rw2_");
    await DB.grantRewards(u.username, [{ type: "coins", amount: 200 }], { type: "test", id: "dup1" });
    const r2 = await DB.grantRewards(u.username, [{ type: "coins", amount: 200 }], { type: "test", id: "dup1" });
    check("segundo intento con el MISMO source devuelve alreadyGranted:true", r2.alreadyGranted === true, JSON.stringify(r2));
    const after = await getCoinsXp(u.username);
    check("el saldo sube UNA sola vez, no dos", after.coins === u.startCoins + 200, `esperado=${u.startCoins + 200} real=${after.coins}`);
  }

  // ---------- Reward múltiple: coins + xp + item, todo consistente ----------
  {
    const u = await makeTestUser("rw3_");
    const r = await DB.grantRewards(u.username, [
      { type: "coins", amount: 500 },
      { type: "xp", amount: 250 },
      { type: "item", itemType: "skin", itemId: "negra" },
    ], { type: "test", id: "multi1" });
    check("reward múltiple: ok:true", r.ok === true, JSON.stringify(r));
    const after = await getCoinsXp(u.username);
    check("coins +500", after.coins === u.startCoins + 500);
    check("xp +250", after.xp === u.startXp + 250);
    const { data: inv } = await supabase.from("inventory_items").select("*").eq("profile_id", u.profileId).eq("item_type", "skin").eq("item_id", "negra");
    check("el item quedó en inventory_items", inv && inv.length === 1);
  }

  // ---------- Reward fallido: item_type inválido no debe dejar estado parcial ----------
  {
    const u = await makeTestUser("rw4_");
    const r = await DB.grantRewards(u.username, [
      { type: "coins", amount: 999 },
      { type: "item", itemType: "tipo_que_no_existe", itemId: "x" },
    ], { type: "test", id: "fail1" });
    check("reward con item_type inválido devuelve ok:false (rechazado por el check constraint)", r.ok === false, JSON.stringify(r));
    const after = await getCoinsXp(u.username);
    check("las coins NO quedaron aplicadas a mitad (rollback completo de la transacción)", after.coins === u.startCoins, `antes=${u.startCoins} despues=${after.coins}`);
    const { data: grant } = await supabase.from("reward_grants").select("*").eq("profile_id", u.profileId).eq("source_type", "test").eq("source_id", "fail1");
    check("tampoco quedó un registro de grant a medio hacer", !grant || grant.length === 0);
  }

  // ---------- Usuario inexistente ----------
  {
    const r = await DB.grantRewards("usuario_que_no_existe_" + Date.now(), [{ type: "coins", amount: 100 }], { type: "test", id: "nouser" });
    check("usuario inexistente: ok:false", r.ok === false, JSON.stringify(r));
  }

  // ---------- Concurrencia: 2 requests simultáneos, mismo source ----------
  {
    const u = await makeTestUser("rw5_");
    const [ra, rb] = await Promise.all([
      DB.grantRewards(u.username, [{ type: "coins", amount: 300 }], { type: "test", id: "concurrent1" }),
      DB.grantRewards(u.username, [{ type: "coins", amount: 300 }], { type: "test", id: "concurrent1" }),
    ]);
    const oneGranted = (ra.alreadyGranted === false) !== (rb.alreadyGranted === false); // exactamente uno de los dos ganó
    check("2 requests concurrentes con el mismo source: exactamente uno se aplica", oneGranted, JSON.stringify({ ra, rb }));
    const after = await getCoinsXp(u.username);
    check("el saldo solo subió UNA vez pese a la carrera", after.coins === u.startCoins + 300, `esperado=${u.startCoins + 300} real=${after.coins}`);
    const { data: grants } = await supabase.from("reward_grants").select("*").eq("profile_id", u.profileId).eq("source_type", "test").eq("source_id", "concurrent1");
    check("solo quedó UN registro en el ledger, no dos", grants && grants.length === 1, "count=" + (grants && grants.length));
  }

  // ---------- Título: unlock + equip ----------
  {
    const u = await makeTestUser("rw6_");
    const r = await DB.grantRewards(u.username, [{ type: "title", itemId: "rey_de_la_torre" }], { type: "test", id: "title1" });
    check("grant de título: ok:true", r.ok === true, JSON.stringify(r));
    const eq = await DB.setActive(u.username, "title", "rey_de_la_torre");
    check("equip del título recién otorgado: ok:true", eq.ok === true, JSON.stringify(eq));
    check("el perfil devuelve el título como activo", eq.profile && eq.profile.active && eq.profile.active.title === "rey_de_la_torre", JSON.stringify(eq.profile && eq.profile.active));
    check("el título aparece en el inventario público", eq.profile && eq.profile.inventory && eq.profile.inventory.titles && eq.profile.inventory.titles.includes("rey_de_la_torre"));
    // Título es un adorno opcional — "none" lo apaga sin problema (mismo criterio que nameeffect/banner).
    const off = await DB.setActive(u.username, "title", "none");
    check("título se puede desequipar con \"none\"", off.ok === true && off.profile.active.title === null, JSON.stringify(off.profile && off.profile.active));
  }

  // ---------- Persistencia: releer el perfil (simula relogin/reconexión) mantiene el reward ----------
  {
    const u = await makeTestUser("rw7_");
    await DB.grantRewards(u.username, [{ type: "coins", amount: 777 }, { type: "xp", amount: 333 }], { type: "test", id: "persist1" });
    const profile = await DB.getProfileByName(u.username);
    check("releer el perfil (como en un relogin) refleja las coins otorgadas", profile && profile.coins === u.startCoins + 777, JSON.stringify(profile && { coins: profile.coins }));
    check("releer el perfil refleja el XP otorgado", profile && profile.xp === u.startXp + 333);
  }

  console.log(`\n=== RESUMEN: ${pass} OK / ${fail} fallidas ===`);
  if (fail) process.exitCode = 1;
  await cleanup();
  console.log("[cleanup] usuarios de prueba borrados de Supabase.");
}
main().catch((e) => { console.error("❌ Error fatal:", e); process.exitCode = 1; });
