// Etapa 4 — prueba real de punta a punta contra el server.js corriendo en
// localhost:8181 (WebSocket real, no mocks). Simula un usuario "legacy" ya
// migrado (existe en players.json Y en Supabase, contraseña vieja SHA-256,
// contraseña nueva en Supabase todavía sin setear) para poder probar el
// fallback de migración perezosa sin tocar cuentas reales.
import WebSocket from "ws";
import fs from "node:fs";
import crypto from "node:crypto";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const PLAYERS_JSON = new URL("../players.json", import.meta.url);
const TEST_USER = "etapa4_legacy_test";
const TEST_PASS = "TestPass123";
// El servidor trunca username a 16 chars — se arma corto (<=16) desde el
// vamos para que no haya mismatch entre lo que pide este script y lo que
// termina guardado (Date.now() truncado a 16 colisionaba entre corridas del
// mismo día porque los dígitos más significativos casi no cambian).
const NEW_USER = ("e4n_" + crypto.randomBytes(5).toString("hex")).slice(0, 16);
const NEW_PASS = "NuevoPass456";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function hash(pw) { return crypto.createHash("sha256").update(pw).digest("hex"); }

function once(ws, matchType) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout esperando " + matchType)), 8000);
    function onMsg(raw) {
      const m = JSON.parse(raw);
      if (m.type === matchType || m.type === "error") { clearTimeout(t); ws.off("message", onMsg); resolve(m); }
    }
    ws.on("message", onMsg);
  });
}

async function connect() {
  const ws = new WebSocket("ws://localhost:8181");
  await new Promise((res, rej) => { ws.once("open", res); ws.once("error", rej); });
  return ws;
}

function send(ws, obj) { ws.send(JSON.stringify(obj)); }

async function cleanupTestUser(usernameLower) {
  const { data } = await supabase.from("profiles").select("id").ilike("username", usernameLower).maybeSingle();
  if (data) await supabase.auth.admin.deleteUser(data.id); // cascada borra profiles/inventory/etc.
}

async function main() {
  console.log("=== Etapa 4 — prueba end-to-end de auth ===\n");

  // Snapshot exacto del archivo real ANTES de tocarlo — se restaura tal cual al
  // final (finally), pase lo que pase, para no dejar ninguna huella permanente.
  const ORIGINAL_RAW = fs.readFileSync(PLAYERS_JSON, "utf8");

  // --- Preparar usuario "legacy ya migrado": existe en players.json (hash viejo)
  // Y en Supabase (contraseña Auth aleatoria, como quedaron los 16 reales tras
  // la migración de Etapa 3), pero SIN haber hecho login todavía con el flujo nuevo.
  console.log("[setup] limpiando restos de corridas previas...");
  await cleanupTestUser(TEST_USER.toLowerCase());
  await cleanupTestUser(NEW_USER.toLowerCase());

  const db = JSON.parse(ORIGINAL_RAW);
  db[TEST_USER.toLowerCase()] = {
    username: TEST_USER, passwordHash: hash(TEST_PASS), rankPts: 1000, coins: 777, xp: 0,
    avatar: "🀄",
    inventory: { skins: ["clasica"], tapetes: ["clasico"], effects: ["clasico"], soundfx: ["clasico"], trails: ["clasica"], avatars: ["🀄","😎","🐺","🦊","👑","🃏"], nameeffects: [], banners: [] },
    active: { skin: "clasica", tapete: "clasico", effect: "clasico", soundfx: "clasico", trail: "clasica", nameeffect: null, banner: null },
    stats: { games: 0, wins: 0, losses: 0, streak: 0, bestStreak: 0, totalCoinsEarned: 0, totalXpEarned: 0, rankedGames: 0, rankedWins: 0 },
    achievements: {}, passClaimed: {}, galactico: { xp: 0, claimed: {} },
    createdAt: Date.now(), updatedAt: Date.now(), bonusV11Given: true,
  };
  fs.writeFileSync(PLAYERS_JSON, JSON.stringify(db, null, 2));
  console.log("[setup] agregado " + TEST_USER + " a players.json (solo para esta prueba)");

  // Migrar a Supabase con contraseña temporal aleatoria (igual que los 16 reales
  // quedaron tras Etapa 3 — el login real todavía no les seteó su contraseña real).
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: TEST_USER.toLowerCase() + "@users.burako.internal",
    password: "temp-" + crypto.randomBytes(16).toString("hex"),
    email_confirm: true,
    user_metadata: { username: TEST_USER, avatar: "🀄" },
  });
  if (createErr) throw new Error("no se pudo crear el usuario de prueba en Supabase: " + createErr.message);
  // El trigger que crea la fila de "profiles" puede tardar un instante en
  // quedar visible para PostgREST — se espera con reintentos cortos antes de
  // updatear/leer (mismo comportamiento que ya maneja db.js en register()).
  let profileRow = null;
  for (let i = 0; i < 10 && !profileRow; i++) {
    const { data } = await supabase.from("profiles").select("id").eq("id", created.user.id).maybeSingle();
    if (data) profileRow = data; else await new Promise((r) => setTimeout(r, 200));
  }
  if (!profileRow) throw new Error("la fila de profiles del usuario de prueba no apareció a tiempo");
  await supabase.from("profiles").update({ username: TEST_USER, coins: 777 }).eq("id", created.user.id);
  console.log("[setup] " + TEST_USER + " migrado a Supabase con contraseña temporal aleatoria (estado = 16 usuarios reales antes de su primer login)\n");

  let pass = 0, fail = 0;
  function check(name, cond, detail) {
    if (cond) { console.log("✅ " + name); pass++; }
    else { console.log("❌ " + name + (detail ? " — " + detail : "")); fail++; }
  }

  try {
  // --- 1) Usuario legacy + contraseña INCORRECTA ---
  {
    const ws = await connect();
    send(ws, { type: "login", username: TEST_USER, password: "esta-no-es" });
    const r = await once(ws, "authOk");
    check("legacy + contraseña incorrecta -> rechazada", r.type === "error" && /incorrecta/i.test(r.msg), JSON.stringify(r));
    ws.close();
  }

  // --- 2) Usuario legacy + contraseña CORRECTA (dispara migración perezosa) ---
  {
    const ws = await connect();
    send(ws, { type: "login", username: TEST_USER, password: TEST_PASS });
    const r = await once(ws, "authOk");
    check("legacy + contraseña correcta -> login OK (migración perezosa)", r.type === "authOk" && r.profile && r.profile.coins === 777, JSON.stringify(r));
    ws.close();
  }

  // --- 3) Confirmar que ya NO depende del hash de players.json: lo borramos y
  //     el login debe seguir funcionando (ahora vía Supabase Auth directo) ---
  {
    const db2 = JSON.parse(fs.readFileSync(PLAYERS_JSON, "utf8"));
    delete db2[TEST_USER.toLowerCase()];
    fs.writeFileSync(PLAYERS_JSON, JSON.stringify(db2, null, 2));
    console.log("[test] quitado " + TEST_USER + " de players.json para probar que el re-login YA NO depende de ese archivo");

    const ws = await connect();
    send(ws, { type: "login", username: TEST_USER, password: TEST_PASS });
    const r = await once(ws, "authOk");
    check("re-login sin players.json -> sigue funcionando (Supabase directo)", r.type === "authOk" && r.profile && r.profile.coins === 777, JSON.stringify(r));
    ws.close();
  }

  // --- 4) Usuario nuevo: registro ---
  let newUserWs;
  {
    const ws = await connect();
    send(ws, { type: "register", username: NEW_USER, password: NEW_PASS });
    const r = await once(ws, "authOk");
    check("usuario nuevo -> registro OK", r.type === "authOk" && r.welcomeBonus === 10000 && r.profile.coins === 10500, JSON.stringify(r));
    newUserWs = ws;
  }

  // --- 5) Persistencia: comprar un ítem, cerrar conexión, reconectar y verificar ---
  {
    send(newUserWs, { type: "buyItem", kind: "tapete", id: "fieltroverde" });
    const rBuy = await once(newUserWs, "profile");
    check("compra persiste en la respuesta inmediata", rBuy.type === "profile" && rBuy.profile.inventory.tapetes.includes("fieltroverde"), JSON.stringify(rBuy));
    newUserWs.close();

    await new Promise(r => setTimeout(r, 300));
    const ws2 = await connect();
    send(ws2, { type: "login", username: NEW_USER, password: NEW_PASS });
    const r2 = await once(ws2, "authOk");
    check("re-login tras cerrar conexión -> compra sigue en Supabase", r2.type === "authOk" && r2.profile.inventory.tapetes.includes("fieltroverde") && r2.profile.coins === 10500 - 1200, JSON.stringify(r2));
    ws2.close();
  }

  console.log(`\n=== RESUMEN: ${pass} OK / ${fail} fallidas ===`);
  if (fail) process.exitCode = 1;
  } finally {
    // --- limpieza: SIEMPRE se ejecuta, incluso si algún check/paso de arriba tiró ---
    await cleanupTestUser(TEST_USER.toLowerCase());
    await cleanupTestUser(NEW_USER.toLowerCase());
    fs.writeFileSync(PLAYERS_JSON, ORIGINAL_RAW);
    const stillOriginal = fs.readFileSync(PLAYERS_JSON, "utf8") === ORIGINAL_RAW;
    console.log("[cleanup] usuarios de prueba borrados de Supabase. players.json restaurado byte-a-byte: " + (stillOriginal ? "✅ confirmado" : "❌ NO COINCIDE"));
  }
}

main().catch((e) => { console.error("❌ Error fatal:", e); process.exitCode = 1; });
