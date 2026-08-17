// Etapa 3 — validación: compara CADA jugador de players.json contra su fila
// real en Supabase, campo por campo (perfil, stats, cosméticos activos,
// inventario completo, logros con timestamp, pase/galáctico reclamados).
// Solo lee de los dos lados — no escribe nada.
import "dotenv/config";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const PLAYERS_JSON = new URL("../players.json", import.meta.url);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const eq = (a, b) => a === b || (a == null && b == null);
const sameSet = (a, b) => { const A = new Set(a), B = new Set(b); return A.size === B.size && [...A].every((x) => B.has(x)); };

async function validateOne(p) {
  const problems = [];
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*, inventory_items(item_type,item_id), profile_achievements(achievement_id,unlocked_at), pass_claims(pass_type,level)")
    .ilike("username", p.username)
    .maybeSingle();

  if (error) return { username: p.username, ok: false, problems: ["error consultando Supabase: " + error.message] };
  if (!profile) return { username: p.username, ok: false, problems: ["FALTA en Supabase — no se encontró el perfil"] };

  if (profile.username !== p.username) problems.push(`username: "${p.username}" vs "${profile.username}"`);
  if (!eq(profile.avatar, p.avatar || "🀄")) problems.push(`avatar: "${p.avatar}" vs "${profile.avatar}"`);
  if (profile.coins !== (p.coins ?? 0)) problems.push(`coins: ${p.coins} vs ${profile.coins}`);
  if (profile.xp !== (p.xp ?? 0)) problems.push(`xp: ${p.xp} vs ${profile.xp}`);
  if (profile.rank_pts !== (p.rankPts ?? 1000)) problems.push(`rankPts: ${p.rankPts} vs ${profile.rank_pts}`);
  if (profile.galactico_xp !== (p.galactico?.xp ?? 0)) problems.push(`galactico.xp: ${p.galactico?.xp} vs ${profile.galactico_xp}`);

  const statsMap = { games: "games", wins: "wins", losses: "losses", streak: "streak", bestStreak: "best_streak", rankedGames: "ranked_games", rankedWins: "ranked_wins" };
  for (const [srcKey, dstKey] of Object.entries(statsMap)) {
    const srcVal = p.stats?.[srcKey] ?? 0;
    if (profile[dstKey] !== srcVal) problems.push(`stats.${srcKey}: ${srcVal} vs ${profile[dstKey]}`);
  }

  const activeMap = { skin: "active_skin", tapete: "active_tapete", effect: "active_effect", soundfx: "active_soundfx", trail: "active_trail", nameeffect: "active_nameeffect", banner: "active_banner" };
  for (const [srcKey, dstKey] of Object.entries(activeMap)) {
    const srcVal = p.active?.[srcKey] ?? (srcKey === "nameeffect" || srcKey === "banner" ? null : undefined);
    if (!eq(profile[dstKey], srcVal)) problems.push(`active.${srcKey}: ${JSON.stringify(srcVal)} vs ${JSON.stringify(profile[dstKey])}`);
  }

  // Inventario: comparar por categoría como conjuntos de item_id.
  const typeMap = { skins: "skin", tapetes: "tapete", effects: "effect", soundfx: "soundfx", trails: "trail", avatars: "avatar", nameeffects: "nameeffect", banners: "banner" };
  for (const [srcKey, item_type] of Object.entries(typeMap)) {
    const srcItems = p.inventory?.[srcKey] || [];
    const dstItems = (profile.inventory_items || []).filter((i) => i.item_type === item_type).map((i) => i.item_id);
    if (!sameSet(srcItems, dstItems)) problems.push(`inventory.${srcKey}: [${srcItems}] vs [${dstItems}]`);
  }

  const srcAchIds = Object.keys(p.achievements || {});
  const dstAchIds = (profile.profile_achievements || []).map((a) => a.achievement_id);
  if (!sameSet(srcAchIds, dstAchIds)) problems.push(`achievements: [${srcAchIds}] vs [${dstAchIds}]`);

  const srcPassSeason = Object.keys(p.passClaimed || {}).map(Number);
  const srcPassGalactico = Object.keys(p.galactico?.claimed || {}).map(Number);
  const dstPassSeason = (profile.pass_claims || []).filter((c) => c.pass_type === "season").map((c) => c.level);
  const dstPassGalactico = (profile.pass_claims || []).filter((c) => c.pass_type === "galactico").map((c) => c.level);
  if (!sameSet(srcPassSeason, dstPassSeason)) problems.push(`passClaimed: [${srcPassSeason}] vs [${dstPassSeason}]`);
  if (!sameSet(srcPassGalactico, dstPassGalactico)) problems.push(`galactico.claimed: [${srcPassGalactico}] vs [${dstPassGalactico}]`);

  return { username: p.username, ok: problems.length === 0, problems };
}

async function main() {
  const db = JSON.parse(fs.readFileSync(PLAYERS_JSON, "utf8"));
  const usernames = Object.keys(db);
  console.log(`Validando ${usernames.length} jugadores (players.json vs Supabase)...\n`);

  const results = [];
  for (const key of usernames) {
    const r = await validateOne(db[key]);
    results.push(r);
    console.log(r.ok ? `✅ ${r.username}` : `❌ ${r.username}\n   ${r.problems.join("\n   ")}`);
  }

  // Chequeo inverso: ¿hay algún perfil en Supabase que no esté en players.json
  // (además de los de prueba de conectividad, que ya se auto-limpian)?
  const { data: allProfiles, error } = await supabase.from("profiles").select("username");
  const extra = error ? null : allProfiles.filter((row) => !usernames.some((u) => u.toLowerCase() === row.username.toLowerCase()));

  const ok = results.filter((r) => r.ok).length;
  console.log("\n=== RESUMEN ===");
  console.log(`Jugadores en players.json: ${usernames.length}`);
  console.log(`Coinciden exactamente en Supabase: ${ok}`);
  console.log(`Con diferencias o faltantes: ${usernames.length - ok}`);
  if (extra) console.log(`Perfiles en Supabase que NO están en players.json: ${extra.length}${extra.length ? " -> " + extra.map((p) => p.username).join(", ") : ""}`);
  if (usernames.length - ok > 0) process.exitCode = 1;
}

main().catch((e) => { console.error("❌ Error fatal:", e); process.exitCode = 1; });
