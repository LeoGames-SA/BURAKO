// Etapa 4 — completa total_coins_earned/total_xp_earned (columnas agregadas
// después de la migración inicial de Etapa 3) para los 16 jugadores ya
// migrados, tomando el valor real desde players.json. Solo lee de un lado,
// solo escribe en Supabase, no toca players.json.
import "dotenv/config";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const PLAYERS_JSON = new URL("../players.json", import.meta.url);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  const db = JSON.parse(fs.readFileSync(PLAYERS_JSON, "utf8"));
  const usernames = Object.keys(db);
  let updated = 0, failed = 0;
  for (const key of usernames) {
    const p = db[key];
    const { error } = await supabase
      .from("profiles")
      .update({
        total_coins_earned: p.stats?.totalCoinsEarned ?? 0,
        total_xp_earned: p.stats?.totalXpEarned ?? 0,
      })
      .ilike("username", p.username);
    if (error) { console.log(`❌ ${p.username}: ${error.message}`); failed++; }
    else { console.log(`✅ ${p.username}`); updated++; }
  }
  console.log(`\n=== RESUMEN ===\nActualizados: ${updated}\nFallidos: ${failed}`);
  if (failed) process.exitCode = 1;
}
main().catch((e) => { console.error("❌ Error fatal:", e); process.exitCode = 1; });
