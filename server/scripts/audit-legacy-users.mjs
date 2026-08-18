// Etapa "Datos legacy" (0.6) — SOLO LISTA candidatos a limpieza + genera un
// backup/export. NO borra nada. Corre de solo-lectura contra Supabase de
// producción (o el proyecto que apunte server/.env).
//
// Criterio:
//  1) "Certeza alta" — el username matea EXACTAMENTE los prefijos que generan
//     los propios scripts de test de este repo (server/scripts/*.mjs), todos
//     con un sufijo hex de crypto.randomBytes. No es una suposición: es el
//     patrón literal que ese código produce.
//  2) "Sospechosas, revisar a mano" — cuentas con juegos=0 y ranked_games=0
//     (nunca jugaron) que NO matchean ningún prefijo conocido. Se listan
//     aparte, nunca se tratan como candidatas automáticas de borrado.
// El resto (cualquier cuenta con al menos 1 partida jugada, o que no matchee
// ninguno de los dos grupos de arriba) NUNCA se lista como candidata acá.
import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "backups");
mkdirSync(OUT_DIR, { recursive: true });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// Prefijos EXACTOS generados por server/scripts/*.mjs (todos con sufijo hex de
// crypto.randomBytes) — certeza alta, no una suposición.
const KNOWN_TEST_PREFIXES = [
  "testuser_", "gm_a_", "gm_b_", "e5a_", "e5b_", "lat_", "visualtest",
  "rules_a_", "rules_b_", "rules_", "room_a_", "room_b_", "room_c_", "room_d_",
  "rk_a_", "rk_b_", "rk_c_",
];
function matchesKnownPrefix(username) {
  const u = username.toLowerCase();
  return KNOWN_TEST_PREFIXES.some((p) => u.startsWith(p));
}

async function main() {
  console.log("=== Auditoría de usuarios legacy/de prueba — SOLO LECTURA, no borra nada ===\n");

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, username, coins, xp, rank_pts, games, wins, ranked_games, ranked_wins, created_at");
  if (error) { console.error("❌ No se pudo leer profiles:", error.message); process.exitCode = 1; return; }

  console.log(`[info] ${profiles.length} perfiles totales en la base.\n`);

  const knownTest = profiles.filter((p) => matchesKnownPrefix(p.username));
  const suspicious = profiles
    .filter((p) => !matchesKnownPrefix(p.username))
    .filter((p) => (p.games || 0) === 0 && (p.ranked_games || 0) === 0);
  const real = profiles.filter((p) => !matchesKnownPrefix(p.username) && !((p.games || 0) === 0 && (p.ranked_games || 0) === 0));

  console.log(`--- Grupo 1: certeza alta (prefijo de script de test conocido) — ${knownTest.length} cuentas ---`);
  knownTest.forEach((p) => console.log(`  ${p.username}  creado=${p.created_at}  coins=${p.coins} games=${p.games} ranked_games=${p.ranked_games}`));

  console.log(`\n--- Grupo 2: sospechosas, SIN prefijo conocido, nunca jugaron (games=0 y ranked_games=0) — revisar a mano, ${suspicious.length} cuentas ---`);
  suspicious.forEach((p) => console.log(`  ${p.username}  creado=${p.created_at}  coins=${p.coins}`));

  console.log(`\n--- Cuentas con progreso real (al menos 1 partida jugada, o prefijo desconocido) — ${real.length} cuentas, NUNCA se listan como candidatas ---`);
  console.log(`  (no se listan individualmente a propósito — no son candidatas a nada)`);

  // Backup de las filas candidatas (grupo 1 + grupo 2) + datos relacionados,
  // ANTES de que exista cualquier posibilidad de borrado futuro.
  const candidateIds = [...knownTest, ...suspicious].map((p) => p.id);
  let inventory = [], achievements = [], passClaims = [];
  if (candidateIds.length) {
    const [{ data: inv }, { data: ach }, { data: pc }] = await Promise.all([
      supabase.from("inventory_items").select("*").in("profile_id", candidateIds),
      supabase.from("profile_achievements").select("*").in("profile_id", candidateIds),
      supabase.from("pass_claims").select("*").in("profile_id", candidateIds),
    ]);
    inventory = inv || []; achievements = ach || []; passClaims = pc || [];
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(OUT_DIR, `legacy-users-backup-${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    criterio: "grupo1=prefijo de test conocido (certeza alta) · grupo2=sin prefijo, nunca jugó (revisar a mano)",
    grupo1_certeza_alta: knownTest,
    grupo2_sospechosas_revisar: suspicious,
    inventory_items: inventory,
    profile_achievements: achievements,
    pass_claims: passClaims,
  }, null, 2));

  console.log(`\n[backup] export completo (perfiles candidatos + inventario/logros/pases relacionados) guardado en:\n  ${backupPath}`);
  console.log(`\n=== NINGÚN borrado se ejecutó. Esto es solo un listado + backup para revisión manual. ===`);
}
main().catch((e) => { console.error("❌ Error fatal:", e); process.exitCode = 1; });
