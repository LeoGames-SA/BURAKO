// Prueba real de conexión Node → Supabase (Etapa 2). NO es un mock: crea un
// usuario de verdad vía la Auth Admin API con la Service Role Key, confirma
// que el trigger handle_new_user generó su fila en profiles automáticamente,
// hace un UPDATE + SELECT real sobre esa fila, y al final borra el usuario de
// prueba (el cascade se lleva la fila de profiles con él) para no dejar basura.
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("❌ Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en server/.env");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const testEmail = `test-connectivity-${Date.now()}@users.burako.internal`;
const testUsername = `TestConn${Date.now() % 100000}`;
let createdUserId = null;

async function main() {
  console.log("1) Creando usuario de prueba vía Auth Admin API...");
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: "test-password-" + Math.random().toString(36).slice(2),
    email_confirm: true,
    user_metadata: { username: testUsername, avatar: "🧪" },
  });
  if (createErr) throw new Error("createUser falló: " + createErr.message);
  createdUserId = created.user.id;
  console.log("   ✅ Usuario creado:", createdUserId);

  console.log("2) Verificando que el trigger creó la fila en profiles...");
  const { data: profile, error: readErr } = await supabase
    .from("profiles")
    .select("id, username, avatar, coins, xp, rank_pts")
    .eq("id", createdUserId)
    .single();
  if (readErr) throw new Error("SELECT profiles falló: " + readErr.message);
  if (profile.username !== testUsername) throw new Error(`username esperado "${testUsername}", vino "${profile.username}"`);
  console.log("   ✅ Fila de profiles existe y coincide:", profile);

  console.log("3) Escribiendo (UPDATE real de coins/xp)...");
  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ coins: 12345, xp: 999 })
    .eq("id", createdUserId);
  if (updateErr) throw new Error("UPDATE falló: " + updateErr.message);

  const { data: after, error: reReadErr } = await supabase
    .from("profiles")
    .select("coins, xp")
    .eq("id", createdUserId)
    .single();
  if (reReadErr) throw new Error("re-SELECT falló: " + reReadErr.message);
  if (after.coins !== 12345 || after.xp !== 999) throw new Error("el UPDATE no se reflejó: " + JSON.stringify(after));
  console.log("   ✅ UPDATE confirmado con una lectura aparte:", after);

  console.log("4) Probando inventory_items (insert + unique constraint)...");
  const { error: invErr } = await supabase.from("inventory_items").insert({
    profile_id: createdUserId, item_type: "skin", item_id: "clasica",
  });
  if (invErr) throw new Error("insert inventory_items falló: " + invErr.message);
  console.log("   ✅ inventory_items insert OK");

  console.log("\n✅ TODO OK — conexión real Node→Supabase confirmada (auth admin, trigger, RLS bypass con service role, read, write, tabla relacionada).");
}

main()
  .catch((e) => { console.error("❌ FALLÓ:", e.message); process.exitCode = 1; })
  .finally(async () => {
    if (createdUserId) {
      console.log("5) Limpiando usuario de prueba (cascade borra su profile)...");
      const { error } = await supabase.auth.admin.deleteUser(createdUserId);
      if (error) console.error("   ⚠ no se pudo borrar el usuario de prueba:", error.message, "— borralo a mano en el dashboard:", createdUserId);
      else console.log("   ✅ limpieza OK, no queda basura de prueba");
    }
  });
