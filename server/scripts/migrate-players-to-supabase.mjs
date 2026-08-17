// Etapa 3 — migración de server/players.json → Supabase.
// Requisitos del usuario: con backup, con validación, players.json/db.js NO se
// tocan ni se borran. Este script SOLO LEE players.json y SOLO ESCRIBE en
// Supabase — nunca modifica el archivo original.
//
// Contraseñas: las que hay en players.json son SHA-256 sin salt, no son
// recuperables a texto plano. Cada cuenta migrada arranca con una contraseña
// temporal aleatoria en Supabase Auth (nadie la va a usar todavía — el login
// real sigue yendo contra players.json hasta la Etapa 4). El plan para
// Etapa 4 es "migración perezosa": el primer login real de cada usuario
// después de reescribir server.js compara contra el SHA-256 viejo (que sigue
// disponible porque no borramos players.json) y si coincide, le actualiza la
// contraseña en Supabase Auth sola — nadie tiene que resetear nada a mano.
//
// Idempotente: si un username ya existe en Supabase (profiles.username, único
// sin distinguir mayúsculas), se saltea y se reporta como "ya migrado" en vez
// de duplicar o fallar. Se puede correr de nuevo tranquilo.
import "dotenv/config";
import fs from "node:fs";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const PLAYERS_JSON = new URL("../players.json", import.meta.url);

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("❌ Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en server/.env");
  process.exit(1);
}
const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

function readPlayersJson() {
  const raw = fs.readFileSync(PLAYERS_JSON, "utf8");
  return JSON.parse(raw);
}

function randomTempPassword() {
  return "migrated-" + crypto.randomBytes(24).toString("base64url");
}

async function profileExists(usernameLower) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", usernameLower)
    .maybeSingle();
  if (error) throw new Error("check exists falló: " + error.message);
  return !!data;
}

async function migrateOne(p) {
  const usernameLower = p.username.toLowerCase();

  if (await profileExists(usernameLower)) {
    return { username: p.username, status: "skipped", reason: "ya existe en Supabase" };
  }

  const syntheticEmail = `${usernameLower}@users.burako.internal`;
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: syntheticEmail,
    password: randomTempPassword(),
    email_confirm: true,
    user_metadata: { username: p.username, avatar: p.avatar || "🀄", migratedFromLegacy: true },
  });
  if (createErr) return { username: p.username, status: "failed", reason: "createUser: " + createErr.message };
  const profileId = created.user.id;

  // El trigger handle_new_user ya creó la fila de profiles con los defaults —
  // acá la pisamos con los valores REALES migrados.
  const { error: updateErr } = await supabase
    .from("profiles")
    .update({
      username: p.username, // preserva mayúsculas/minúsculas originales, no solo el lower
      avatar: p.avatar || "🀄",
      coins: p.coins ?? 0,
      xp: p.xp ?? 0,
      rank_pts: p.rankPts ?? 1000,
      galactico_xp: p.galactico?.xp ?? 0,
      games: p.stats?.games ?? 0,
      wins: p.stats?.wins ?? 0,
      losses: p.stats?.losses ?? 0,
      streak: p.stats?.streak ?? 0,
      best_streak: p.stats?.bestStreak ?? 0,
      ranked_games: p.stats?.rankedGames ?? 0,
      ranked_wins: p.stats?.rankedWins ?? 0,
      active_skin: p.active?.skin ?? "clasica",
      active_tapete: p.active?.tapete ?? "clasico",
      active_effect: p.active?.effect ?? "clasico",
      active_soundfx: p.active?.soundfx ?? "clasico",
      active_trail: p.active?.trail ?? "clasica",
      active_nameeffect: p.active?.nameeffect ?? null,
      active_banner: p.active?.banner ?? null,
      created_at: p.createdAt ? new Date(p.createdAt).toISOString() : undefined,
      updated_at: p.updatedAt ? new Date(p.updatedAt).toISOString() : undefined,
    })
    .eq("id", profileId);
  if (updateErr) return { username: p.username, status: "failed", reason: "update profile: " + updateErr.message };

  // Inventario: un row por item poseído, en las 8 categorías.
  const invRows = [];
  const inv = p.inventory || {};
  const typeMap = { skins: "skin", tapetes: "tapete", effects: "effect", soundfx: "soundfx", trails: "trail", avatars: "avatar", nameeffects: "nameeffect", banners: "banner" };
  for (const [srcKey, item_type] of Object.entries(typeMap)) {
    for (const item_id of inv[srcKey] || []) invRows.push({ profile_id: profileId, item_type, item_id });
  }
  if (invRows.length) {
    const { error } = await supabase.from("inventory_items").insert(invRows);
    if (error) return { username: p.username, status: "failed", reason: "inventory_items: " + error.message };
  }

  // Logros desbloqueados.
  const achRows = Object.entries(p.achievements || {}).map(([achievement_id, ts]) => ({
    profile_id: profileId, achievement_id, unlocked_at: new Date(ts).toISOString(),
  }));
  if (achRows.length) {
    const { error } = await supabase.from("profile_achievements").insert(achRows);
    if (error) return { username: p.username, status: "failed", reason: "profile_achievements: " + error.message };
  }

  // Pase de temporada + Pase Galáctico reclamados.
  const passRows = [
    ...Object.keys(p.passClaimed || {}).map((level) => ({ profile_id: profileId, pass_type: "season", level: Number(level) })),
    ...Object.keys(p.galactico?.claimed || {}).map((level) => ({ profile_id: profileId, pass_type: "galactico", level: Number(level) })),
  ];
  if (passRows.length) {
    const { error } = await supabase.from("pass_claims").insert(passRows);
    if (error) return { username: p.username, status: "failed", reason: "pass_claims: " + error.message };
  }

  return { username: p.username, status: "migrated", profileId, counts: { inventory: invRows.length, achievements: achRows.length, passClaims: passRows.length } };
}

async function main() {
  const db = readPlayersJson();
  const usernames = Object.keys(db);
  console.log(`Migrando ${usernames.length} jugadores desde players.json...\n`);

  const results = [];
  for (const key of usernames) {
    const p = db[key];
    process.stdout.write(`- ${p.username} ... `);
    try {
      const r = await migrateOne(p);
      results.push(r);
      console.log(r.status === "migrated" ? `✅ migrado (inv:${r.counts.inventory} ach:${r.counts.achievements} pase:${r.counts.passClaims})` : r.status === "skipped" ? "⏭ " + r.reason : "❌ " + r.reason);
    } catch (e) {
      results.push({ username: p.username, status: "failed", reason: e.message });
      console.log("❌ " + e.message);
    }
  }

  const migrated = results.filter((r) => r.status === "migrated").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "failed");

  console.log("\n=== RESUMEN ===");
  console.log(`Total en players.json: ${usernames.length}`);
  console.log(`Migrados ahora: ${migrated}`);
  console.log(`Ya existían (salteados): ${skipped}`);
  console.log(`Fallidos: ${failed.length}`);
  if (failed.length) {
    console.log("\nFallidos (detalle):");
    failed.forEach((f) => console.log(`  - ${f.username}: ${f.reason}`));
  }
  console.log("\nplayers.json NO fue modificado — sigue siendo la fuente original.");
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => { console.error("❌ Error fatal:", e); process.exitCode = 1; });
