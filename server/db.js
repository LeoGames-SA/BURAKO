/* ============================================================
   BASE DE DATOS DE PERFILES — Supabase (Postgres + Auth)

   Etapa 4: Supabase es la fuente PRINCIPAL para login, perfil, monedas, XP,
   ranking, inventario, logros y pases. players.json queda solo como
   fallback TEMPORAL para migrar en caliente la contraseña de cuentas viejas
   que todavía no hicieron su primer login post-migración (ver login()).

   El SERVIDOR (con la Service Role Key, que nunca sale de acá) es la única
   fuente de verdad para:
   - XP, nivel, rango, monedas, rachas
   - Inventario (skins/tapetes/efectos comprados)
   - Cosméticos activos (skin, tapete, efecto, avatar)
   - Estadísticas (partidas, victorias, derrotas, %WR, mejor racha, etc)
   - Logros desbloqueados

   El cliente solo muestra lo que le manda el servidor.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno (server/.env).");
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// players.json: fallback de SOLO LECTURA para la migración perezosa de
// contraseñas (ver login()). No se borra ni se escribe desde acá.
// En local/LAN, players.json vive junto a este archivo. En Render, el
// filesystem es efímero y este archivo nunca se sube al repo (ver
// .gitignore) — para que la migración perezosa de contraseña también
// funcione ahí para los usuarios legacy, se sube como "Secret File" del
// dashboard de Render (nunca en git) y se apunta acá con esta env var.
const LEGACY_DB_PATH = process.env.LEGACY_PLAYERS_JSON_PATH || path.join(__dirname, "players.json");
function loadLegacyDb() {
  try { return JSON.parse(fs.readFileSync(LEGACY_DB_PATH, "utf8")); }
  catch (e) { return {}; }
}
function legacyHash(pw) {
  return crypto.createHash("sha256").update(pw).digest("hex");
}
const SYNTHETIC_EMAIL_DOMAIN = "@users.burako.internal";
function syntheticEmail(usernameLower) { return usernameLower + SYNTHETIC_EMAIL_DOMAIN; }

/* IMPORTANTE: nunca llamar auth.signInWithPassword() sobre el cliente
   "supabase" de arriba — ese cliente es COMPARTIDO por todas las conexiones
   del servidor y sirve con la Service Role Key (bypassa RLS). Un signIn
   exitoso muta la sesión interna del cliente y hace que TODAS las queries
   siguientes (de cualquier otro jugador) pasen a correr como ESE usuario
   autenticado en vez de como service role, rompiendo todo lo que no sea
   leer su propia fila. Por eso cada verificación de contraseña usa un
   cliente nuevo y descartable, aislado del resto del servidor. */
function freshAuthClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/* Token de sesión persistente = el refresh token que Supabase Auth ya emite
   al loguear. El cliente (Web/Android) lo guarda y lo manda de vuelta para
   restaurar identidad sin reenviar la contraseña (ver resumeSession). No es
   un mecanismo nuevo: se reusa lo que Supabase ya ofrece (expiración,
   rotación single-use, revocación vía admin.signOut) en vez de armar una
   tabla de sesiones o JWT propios. */
async function mintSession(usernameLower, password) {
  try {
    const { data, error } = await freshAuthClient().auth.signInWithPassword({ email: syntheticEmail(usernameLower), password });
    if (error || !data || !data.session) return null;
    return { refreshToken: data.session.refresh_token, expiresAt: data.session.expires_at };
  } catch (e) {
    console.error("[auth] mintSession: error para", usernameLower, "-", e.message);
    return null;
  }
}

/* ---------- Catálogo maestro de cosméticos ---------- */
const CATALOG = {
  skins: [
    { id: "clasica",  name: "Clásica",             price: 0 },
    { id: "negra",    name: "Negra con Dorado",    price: 1500 },
    { id: "circulo",  name: "Círculo de Color",    price: 2000 },
    { id: "madera",   name: "Madera Premium",      price: 2500 },
    { id: "piedra",   name: "Piedra Antigua",      price: 3000 },
    { id: "oriental", name: "Místico Oriental",    price: 3000 },
    { id: "elite",    name: "Diseño Élite",        price: 3500 },
    { id: "fuego",    name: "Fuego Ardiente",      price: 4000 },
    { id: "hielo",    name: "Hielo Glacial",       price: 4000 },
    { id: "aracnido", name: "Héroe Arácnido",      price: 5000 },
    { id: "tecno",    name: "Héroe Tecno",         price: 5000 },
    { id: "sombra",   name: "Héroe Sombra",        price: 5000 },
    { id: "oro",      name: "Oro Real",            price: 6500 },
    { id: "neon",     name: "Tecno Futurista",     price: 7000 },
    { id: "galaxia",  name: "Galáctico Espacial",  price: 8000 },
    { id: "pinguino",  name: "Pingüino Tux",        price: 1800 },
    { id: "oceano",    name: "Océano Profundo",     price: 2200 },
    { id: "carbon",    name: "Fibra de Carbono",    price: 2600 },
    { id: "sakura",    name: "Sakura",              price: 2800 },
    { id: "pixel",     name: "Retro Pixel",         price: 3200 },
    { id: "pirata",    name: "Tesoro Pirata",       price: 3800 },
    { id: "plata",     name: "Plata Cromada",       price: 4500 },
    { id: "esmeralda", name: "Esmeralda Tallada",   price: 5200 },
    { id: "arcoiris",  name: "Arcoíris",            price: 6000 },
    { id: "holograma", name: "Holograma",           price: 7200 },
    { id: "steampunk", name: "Steampunk Gears",     price: 9200 },
    { id: "vikingo",   name: "Furia Vikinga",       price: 9800 },
    { id: "samurai",   name: "Samurái de Élite",    price: 10500 },
    { id: "cristal",   name: "Reino de Cristal",    price: 11200 },
    { id: "dragon",    name: "Senda del Dragón",    price: 12000 },
    { id: "halloween",  name: "Noche de Brujas",      price: 4500, season: [10] },
    { id: "navidena",   name: "Espíritu Navideño",    price: 4800, season: [12] },
    { id: "sanvalentin",name: "San Valentín",         price: 4200, season: [2] },
  ],
  tapetes: [
    { id: "clasico",      name: "Mesa oscura",     price: 0 },
    { id: "fieltroverde", name: "Fieltro verde",   price: 1200 },
    { id: "fieltroazul",  name: "Fieltro azul",    price: 1200 },
    { id: "fieltrorojo",  name: "Fieltro carmesí", price: 1500 },
    { id: "caoba",        name: "Madera caoba",    price: 2000 },
    { id: "marmol",       name: "Mármol",          price: 2800 },
    { id: "dorado",       name: "Salón dorado",    price: 3500 },
    { id: "neon",         name: "Grilla neón",     price: 4000 },
    { id: "esmeraldatp",  name: "Fieltro esmeralda", price: 2400 },
    { id: "medianoche",   name: "Medianoche estelar", price: 3000 },
    { id: "cobre",        name: "Cobre Real",       price: 3800 },
    { id: "purpura",      name: "Terciopelo Púrpura", price: 3200 },
    { id: "onix",         name: "Ónix Negro",       price: 2900 },
    { id: "coral",        name: "Coral Tropical",   price: 2600 },
    { id: "artico",       name: "Ártico",           price: 3100 },
    { id: "bambu",        name: "Bambú Zen",        price: 2200 },
    { id: "vitral",       name: "Vitral",           price: 3600 },
  ],
  effects: [
    { id: "clasico",   name: "Clásico",   price: 0 },
    { id: "explosion", name: "Explosión", price: 1200 },
    { id: "escarcha",  name: "Escarcha",  price: 1200 },
    { id: "rayo",      name: "Rayo",      price: 1500 },
    { id: "confeti",   name: "Confeti",   price: 2000 },
    { id: "aurora",    name: "Aurora Boreal", price: 2600 },
    { id: "plasma",    name: "Plasma Eléctrico", price: 3000 },
    { id: "destello",  name: "Destello Pro", price: 3500 },
    { id: "arcoiris",  name: "Arcoíris", price: 3500 },
    { id: "glitch",    name: "Glitch", price: 3800 },
    { id: "holograma", name: "Holograma", price: 4200 },
    { id: "olamesa",   name: "Ola de Mesa", price: 2800 },
    { id: "pulsoatril",name: "Pulso de Atril", price: 2400 },
    { id: "discoluces",name: "Luces de Fiesta", price: 3900 },
    // Impactos de color (v1.3) — deben coincidir EXACTO (id y price) con EFFECTS en client/burako.js.
    { id: "impacto_rojo",    name: "Brasa Roja",     price: 1400 },
    { id: "impacto_azul",    name: "Ola Azul",       price: 1400 },
    { id: "impacto_verde",   name: "Aura Verde",     price: 1400 },
    { id: "impacto_violeta", name: "Pulso Violeta",  price: 1600 },
    { id: "impacto_dorado",  name: "Impacto Dorado", price: 2000 },
  ],
  soundfx: [
    { id: "clasico",   name: "Clásico",     price: 0 },
    { id: "suave",     name: "Suave",       price: 1200 },
    { id: "retro8bit", name: "Retro 8-bit", price: 1800 },
    { id: "madera",    name: "Madera",      price: 2000 },
    { id: "casino",    name: "Casino",      price: 2200 },
    { id: "campana",   name: "Campana",     price: 2600 },
    { id: "burbuja",   name: "Burbuja",     price: 1600 },
    { id: "cristal",   name: "Cristal",     price: 3000 },
    { id: "arcade",    name: "Arcade",      price: 3200 },
  ],
  // Estelas: el camino que recorre cada ficha al volar del atril a la mesa al
  // bajar una jugada — independiente del efecto de bajada (Rayo, Confeti, etc.),
  // se combinan entre sí. "cosmica" y "vacio" NO están acá: son exclusivas de
  // pase (ver PASS_LEVELS/GALACTICO_PASS_LEVELS), nunca se compran con monedas.
  trails: [
    { id: "clasica",   name: "Clásica",        price: 0 },
    { id: "viento",    name: "Viento",         price: 500 },
    { id: "dorada",    name: "Dorada",         price: 800 },
    { id: "terremoto", name: "Terremoto",      price: 1000 },
    { id: "hielo",     name: "Hielo",          price: 1200 },
    { id: "alquimia",  name: "Alquimia",       price: 1400 },
    { id: "fuego",     name: "Fuego",          price: 1500 },
    { id: "fugaz",     name: "Estrella Fugaz", price: 2600 },
    { id: "arcoiris",  name: "Arcoíris",       price: 3200 },
  ],
};

/* ---------- Avatares ----------
   Antes eran todos gratis; ahora solo un puñado arranca disponible y el resto se
   gana subiendo de nivel en el Pase de temporada (ver PASS_LEVELS más abajo).
   Debe coincidir EXACTAMENTE con AVATARS/FREE_AVATARS en client/burako.js. */
const ALL_AVATARS = ["🀄","😎","🐺","🦊","🐉","👑","🎩","🃏","⚡","🔥","❄","🌟","💀","🦁","🤖","🇺🇾",
  "🐯","🐼","🦄","🦉","🐙","🦅","🐍","🥷","🧙","🎭","🍀","💎","🎯","🎲","🚀","🌙","🌈","🏆"];
const FREE_AVATARS = ["🀄","😎","🐺","🦊","👑","🃏"];

/* ---------- Sistema de rangos ---------- */
const TIERS = [
  { min: 0,    name: "Bronce",     icon: "🥉", color: "#cd7f32" },
  { min: 1500, name: "Plata",      icon: "🥈", color: "#c0c0c0" },
  { min: 2500, name: "Oro",        icon: "🥇", color: "#ffd700" },
  { min: 3500, name: "Platino",    icon: "💠", color: "#00e5ff" },
  { min: 4500, name: "Diamante",   icon: "💎", color: "#b9f2ff" },
  { min: 6000, name: "Legendario", icon: "🔱", color: "#ff5ec4" },
];
function tierOf(rankPts) {
  return TIERS.slice().reverse().find(t => rankPts >= t.min) || TIERS[0];
}

/* ---------- Sistema de niveles: curva por décadas ----------
   Cada banda de 10 niveles es apenas más cara que la anterior (en vez de multiplicar
   por 1.3 en CADA nivel, que pasado el nivel ~30 se vuelve casi imposible de alcanzar).
   L1=100, L10=172, L20=292, L50=652, L99=1244 XP — total acumulado a nivel 100 ≈ 66.300 XP,
   una temporada larga pero realmente alcanzable jugando seguido. */
function xpForNextLevel(level) {
  const bracket = Math.floor((level - 1) / 10); // 0 para niveles 1-10, 1 para 11-20, ..., 9 para 91-100
  return 100 + bracket * 40 + (level - 1) * 8;
}
function levelFromXp(xp) {
  let lvl = 1, remaining = xp;
  while (remaining >= xpForNextLevel(lvl)) {
    remaining -= xpForNextLevel(lvl);
    lvl++;
    if (lvl >= 100) break; // cap
  }
  return { level: lvl, xpInLevel: remaining, xpForNext: xpForNextLevel(lvl) };
}

/* ---------- Catálogo de logros ---------- */
// Cada logro tiene:
//   id, name, desc, coinReward, xpReward
//   check(profile, ctx): retorna true si se acaba de cumplir en esta partida
// ctx: { won, place, playersCount, ranked, meldsPlayed, tilesLeftInHand, jokerBreaksUsed, timeoutCount, wasHumanOpponents }
const ACHIEVEMENTS = [
  {
    id: "first_game", name: "Primera partida", desc: "Jugá tu primera partida",
    coinReward: 100, xpReward: 50,
    check: (p) => p.stats.games >= 1,
  },
  {
    id: "first_win", name: "Primera victoria", desc: "Ganá tu primera partida",
    coinReward: 250, xpReward: 100,
    check: (p) => p.stats.wins >= 1,
  },
  {
    id: "win_5", name: "Habitué", desc: "Ganá 5 partidas",
    coinReward: 500, xpReward: 200,
    check: (p) => p.stats.wins >= 5,
  },
  {
    id: "win_25", name: "Veterano", desc: "Ganá 25 partidas",
    coinReward: 1500, xpReward: 500,
    check: (p) => p.stats.wins >= 25,
  },
  {
    id: "win_100", name: "Leyenda", desc: "Ganá 100 partidas",
    coinReward: 5000, xpReward: 2000,
    check: (p) => p.stats.wins >= 100,
  },
  {
    id: "streak_3", name: "En racha", desc: "Ganá 3 partidas seguidas",
    coinReward: 400, xpReward: 150,
    check: (p) => p.stats.streak >= 3,
  },
  {
    id: "streak_5", name: "Imparable", desc: "Ganá 5 partidas seguidas",
    coinReward: 800, xpReward: 300,
    check: (p) => p.stats.streak >= 5,
  },
  {
    id: "streak_10", name: "Dominio total", desc: "Ganá 10 partidas seguidas",
    coinReward: 2500, xpReward: 800,
    check: (p) => p.stats.streak >= 10,
  },
  {
    id: "clean_win", name: "Victoria limpia", desc: "Ganá sin usar rupturas de comodín",
    coinReward: 300, xpReward: 150,
    check: (p, ctx) => ctx.won && ctx.jokerBreaksUsed === 0,
  },
  {
    id: "quick_win", name: "Victoria fulminante", desc: "Ganá dejando al rival con 10+ fichas",
    coinReward: 400, xpReward: 200,
    check: (p, ctx) => ctx.won && (ctx.opponentsTilesLeft || 0) >= 10,
  },
  {
    id: "reach_silver", name: "A la Plata", desc: "Alcanzá el rango Plata",
    coinReward: 500, xpReward: 200,
    check: (p) => p.rankPts >= 1500,
  },
  {
    id: "reach_gold", name: "Al Oro", desc: "Alcanzá el rango Oro",
    coinReward: 1000, xpReward: 400,
    check: (p) => p.rankPts >= 2500,
  },
  {
    id: "reach_platinum", name: "Al Platino", desc: "Alcanzá el rango Platino",
    coinReward: 2000, xpReward: 800,
    check: (p) => p.rankPts >= 3500,
  },
  {
    id: "reach_diamond", name: "Al Diamante", desc: "Alcanzá el rango Diamante",
    coinReward: 5000, xpReward: 2000,
    check: (p) => p.rankPts >= 4500,
  },
  {
    id: "reach_legendary", name: "Legendario", desc: "Alcanzá el rango Legendario",
    coinReward: 10000, xpReward: 4000,
    check: (p) => p.rankPts >= 6000,
  },
  {
    id: "level_10", name: "Nivel 10", desc: "Alcanzá el nivel 10",
    coinReward: 500, xpReward: 0,
    check: (p) => levelFromXp(p.xp).level >= 10,
  },
  {
    id: "level_25", name: "Nivel 25", desc: "Alcanzá el nivel 25",
    coinReward: 2000, xpReward: 0,
    check: (p) => levelFromXp(p.xp).level >= 25,
  },
  {
    id: "collector_skins_5", name: "Coleccionista", desc: "Poseé 5 skins",
    coinReward: 500, xpReward: 200,
    check: (p) => (p.inventory.skins || []).length >= 5,
  },
  {
    id: "collector_skins_10", name: "Coleccionista avanzado", desc: "Poseé 10 skins",
    coinReward: 1500, xpReward: 500,
    check: (p) => (p.inventory.skins || []).length >= 10,
  },
  {
    id: "collector_all_skins", name: "Colección completa", desc: "Poseé todas las skins",
    coinReward: 5000, xpReward: 2000,
    check: (p) => (p.inventory.skins || []).length >= 15,
  },
  {
    id: "played_10", name: "Compromiso", desc: "Jugá 10 partidas",
    coinReward: 200, xpReward: 100,
    check: (p) => p.stats.games >= 10,
  },
  {
    id: "played_50", name: "Fiel", desc: "Jugá 50 partidas",
    coinReward: 800, xpReward: 300,
    check: (p) => p.stats.games >= 50,
  },
  // --- Logros "en vivo", detectados durante la partida (no al final) ---
  {
    id: "first_escalera", name: "Primera escalera", desc: "Bajá tu primera escalera",
    coinReward: 100, xpReward: 50,
    check: (p, ctx) => !!(ctx && ctx.playedEscalera),
  },
  {
    id: "four_colors", name: "Cuatro colores", desc: "Bajá un grupo con los 4 colores",
    coinReward: 150, xpReward: 75,
    check: (p, ctx) => !!(ctx && ctx.fourColors),
  },
  {
    id: "joker_break_first", name: "Rompiste un comodín", desc: "Usá tu primera ruptura de comodín",
    coinReward: 100, xpReward: 50,
    check: (p, ctx) => !!(ctx && ctx.jokerBreakUsedNow),
  },
  {
    id: "big_meld", name: "Jugada maestra", desc: "Bajá un juego de 40+ puntos",
    coinReward: 200, xpReward: 100,
    check: (p, ctx) => !!(ctx && ctx.meldValue >= 40),
  },
];

/* ---------- Pase de temporada ----------
   Un solo sistema de nivel para todo el juego: cada recompensa del pase se
   desbloquea al llegar a ese NIVEL DE CUENTA (el mismo que se ve en el perfil),
   en vez de tener su propia curva de XP aparte — antes había dos números de
   "nivel" distintos para la misma XP, que confundía.
   100 niveles, tabla fija (no generada en runtime, para que client y server
   nunca puedan quedar desincronizados): cada nivel múltiplo de 10 es un "hito"
   que reparte los 28 avatares bloqueados (ver FREE_AVATARS) + monedas extra;
   cada múltiplo de 5 (no de 10) da un cosmético (skin/tapete/efecto/sonido,
   sin las 3 skins estacionales); el resto de los niveles da monedas, creciendo
   con el nivel. Debe coincidir EXACTAMENTE con PASS_LEVELS en client/burako.js
   (mismos niveles y mismas recompensas, cada archivo con su propia convención
   de nombres de campo). */
const PASS_LEVELS = [
  { lv: 1, reward: { coins: 92 } },
  { lv: 2, reward: { coins: 104 } },
  { lv: 3, reward: { coins: 116 } },
  { lv: 4, reward: { coins: 128 } },
  { lv: 5, reward: { skin: "negra" } },
  { lv: 6, reward: { coins: 152 } },
  { lv: 7, reward: { coins: 164 } },
  { lv: 8, reward: { coins: 176 } },
  { lv: 9, reward: { coins: 188 } },
  { lv: 10, reward: { avatars: ["🐉","🎩","⚡"], coins: 250 } },
  { lv: 11, reward: { coins: 212 } },
  { lv: 12, reward: { coins: 224 } },
  { lv: 13, reward: { coins: 236 } },
  { lv: 14, reward: { coins: 248 } },
  { lv: 15, reward: { tapete: "fieltroverde" } },
  { lv: 16, reward: { coins: 272 } },
  { lv: 17, reward: { coins: 284 } },
  { lv: 18, reward: { coins: 296 } },
  { lv: 19, reward: { coins: 308 } },
  { lv: 20, reward: { avatars: ["🔥","❄","🌟"], coins: 300 } },
  { lv: 21, reward: { coins: 332 } },
  { lv: 22, reward: { coins: 344 } },
  { lv: 23, reward: { coins: 356 } },
  { lv: 24, reward: { coins: 368 } },
  { lv: 25, reward: { effect: "explosion" } },
  { lv: 26, reward: { coins: 392 } },
  { lv: 27, reward: { coins: 404 } },
  { lv: 28, reward: { coins: 416 } },
  { lv: 29, reward: { coins: 428 } },
  { lv: 30, reward: { avatars: ["💀","🦁","🤖"], coins: 350 } },
  { lv: 31, reward: { coins: 452 } },
  { lv: 32, reward: { coins: 464 } },
  { lv: 33, reward: { coins: 476 } },
  { lv: 34, reward: { coins: 488 } },
  { lv: 35, reward: { soundfx: "suave" } },
  { lv: 36, reward: { coins: 512 } },
  { lv: 37, reward: { coins: 524 } },
  { lv: 38, reward: { coins: 536 } },
  { lv: 39, reward: { coins: 548 } },
  { lv: 40, reward: { avatars: ["🇺🇾","🐯","🐼"], coins: 400 } },
  { lv: 41, reward: { coins: 572 } },
  { lv: 42, reward: { coins: 584 } },
  { lv: 43, reward: { coins: 596 } },
  { lv: 44, reward: { coins: 608 } },
  { lv: 45, reward: { skin: "circulo" } },
  { lv: 46, reward: { coins: 632 } },
  { lv: 47, reward: { coins: 644 } },
  { lv: 48, reward: { coins: 656 } },
  { lv: 49, reward: { coins: 668 } },
  { lv: 50, reward: { avatars: ["🦄","🦉","🐙"], coins: 450 } },
  { lv: 51, reward: { coins: 692 } },
  { lv: 52, reward: { coins: 704 } },
  { lv: 53, reward: { coins: 716 } },
  { lv: 54, reward: { coins: 728 } },
  { lv: 55, reward: { tapete: "fieltroazul" } },
  { lv: 56, reward: { coins: 752 } },
  { lv: 57, reward: { coins: 764 } },
  { lv: 58, reward: { coins: 776 } },
  { lv: 59, reward: { coins: 788 } },
  { lv: 60, reward: { avatars: ["🦅","🐍","🥷"], coins: 500, trail: "vacio" } },
  { lv: 61, reward: { coins: 812 } },
  { lv: 62, reward: { coins: 824 } },
  { lv: 63, reward: { coins: 836 } },
  { lv: 64, reward: { coins: 848 } },
  { lv: 65, reward: { effect: "escarcha" } },
  { lv: 66, reward: { coins: 872 } },
  { lv: 67, reward: { coins: 884 } },
  { lv: 68, reward: { coins: 896 } },
  { lv: 69, reward: { coins: 908 } },
  { lv: 70, reward: { avatars: ["🧙","🎭","🍀"], coins: 550 } },
  { lv: 71, reward: { coins: 932 } },
  { lv: 72, reward: { coins: 944 } },
  { lv: 73, reward: { coins: 956 } },
  { lv: 74, reward: { coins: 968 } },
  { lv: 75, reward: { soundfx: "retro8bit" } },
  { lv: 76, reward: { coins: 992 } },
  { lv: 77, reward: { coins: 1004 } },
  { lv: 78, reward: { coins: 1016 } },
  { lv: 79, reward: { coins: 1028 } },
  { lv: 80, reward: { avatars: ["💎","🎯","🎲"], coins: 600 } },
  { lv: 81, reward: { coins: 1052 } },
  { lv: 82, reward: { coins: 1064 } },
  { lv: 83, reward: { coins: 1076 } },
  { lv: 84, reward: { coins: 1088 } },
  { lv: 85, reward: { skin: "madera" } },
  { lv: 86, reward: { coins: 1112 } },
  { lv: 87, reward: { coins: 1124 } },
  { lv: 88, reward: { coins: 1136 } },
  { lv: 89, reward: { coins: 1148 } },
  { lv: 90, reward: { avatars: ["🚀","🌙"], coins: 650 } },
  { lv: 91, reward: { coins: 1172 } },
  { lv: 92, reward: { coins: 1184 } },
  { lv: 93, reward: { coins: 1196 } },
  { lv: 94, reward: { coins: 1208 } },
  { lv: 95, reward: { tapete: "fieltrorojo" } },
  { lv: 96, reward: { coins: 1232 } },
  { lv: 97, reward: { coins: 1244 } },
  { lv: 98, reward: { coins: 1256 } },
  { lv: 99, reward: { coins: 1268 } },
  { lv: 100, reward: { avatars: ["🌈","🏆"], coins: 700 } },
];

/* ---------- Pase Galáctico: progreso APARTE del pase de temporada de arriba,
   solo sube jugando partidas de Modo Galáctico (XP por partida + bono por
   ganar, ver awardGalacticoXp más abajo). Más corto (15 niveles) porque es
   secundario — sus recompensas son cosméticos EXCLUSIVOS de esta vía (efectos
   de nombre, banners, y una skin de fichas), nunca comprables con monedas.
   Debe coincidir EXACTAMENTE con GALACTICO_PASS_LEVELS en client/burako.js. ---------- */
function galacticoXpForNextLevel(level) {
  return 80 + (level - 1) * 15;
}
function galacticoLevelFromXp(xp) {
  let lvl = 1, remaining = xp;
  while (remaining >= galacticoXpForNextLevel(lvl)) {
    remaining -= galacticoXpForNextLevel(lvl);
    lvl++;
    if (lvl >= 15) break; // cap
  }
  return { level: lvl, xpInLevel: remaining, xpForNext: galacticoXpForNextLevel(lvl) };
}
const GALACTICO_PASS_LEVELS = [
  { lv: 2,  reward: { coins: 100 } },
  { lv: 3,  reward: { nameeffect: "fuego" } },
  { lv: 4,  reward: { coins: 120 } },
  { lv: 5,  reward: { banner: "aureola_dorada" } },
  { lv: 6,  reward: { coins: 140 } },
  { lv: 7,  reward: { nameeffect: "hielo" } },
  { lv: 8,  reward: { coins: 160 } },
  { lv: 9,  reward: { skin: "agujero_negro" } },
  { lv: 10, reward: { coins: 200 } },
  { lv: 11, reward: { nameeffect: "plasma" } },
  { lv: 12, reward: { coins: 220 } },
  { lv: 13, reward: { banner: "anillo_plasma" } },
  { lv: 14, reward: { coins: 260, trail: "cosmica" } },
  { lv: 15, reward: { nameeffect: "vacio", coins: 400 } },
];

/* ---------- Supabase: capa de acceso a datos ----------
   Estrategia: leer una fila de "profiles" (+ sus tablas hijas) y convertirla
   al MISMO shape interno que usaba el players.json viejo (username, coins,
   xp, inventory{...}, active{...}, stats{...}, achievements{}, passClaimed{},
   galactico{}). Así toda la lógica de negocio (checkAchievements, buyItem,
   resolveMatch, etc.) queda IDÉNTICA a la de antes — lo único que cambia es
   de dónde sale y adónde vuelve ese objeto. */
async function fetchProfileRaw(usernameLower) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*, inventory_items(item_type,item_id), profile_achievements(achievement_id,unlocked_at), pass_claims(pass_type,level)")
    .ilike("username", usernameLower)
    .maybeSingle();
  if (error) throw new Error("fetchProfileRaw: " + error.message);
  return data; // null si no existe
}

function rowToProfileShape(row) {
  const inv = { skin: [], tapete: [], effect: [], soundfx: [], trail: [], avatar: [], nameeffect: [], banner: [], title: [] };
  (row.inventory_items || []).forEach((i) => { if (inv[i.item_type]) inv[i.item_type].push(i.item_id); });
  const achievements = {};
  (row.profile_achievements || []).forEach((a) => { achievements[a.achievement_id] = new Date(a.unlocked_at).getTime(); });
  const passClaimed = {}, galacticoClaimed = {};
  (row.pass_claims || []).forEach((c) => {
    if (c.pass_type === "season") passClaimed[c.level] = true;
    else galacticoClaimed[c.level] = true;
  });
  return {
    _id: row.id,
    username: row.username,
    avatar: row.avatar,
    rankPts: row.rank_pts,
    coins: row.coins,
    xp: row.xp,
    inventory: {
      skins: inv.skin, tapetes: inv.tapete, effects: inv.effect, soundfx: inv.soundfx,
      trails: inv.trail, avatars: inv.avatar, nameeffects: inv.nameeffect, banners: inv.banner,
      titles: inv.title,
    },
    active: {
      skin: row.active_skin, tapete: row.active_tapete, effect: row.active_effect,
      soundfx: row.active_soundfx, trail: row.active_trail,
      nameeffect: row.active_nameeffect, banner: row.active_banner,
      title: row.active_title,
    },
    stats: {
      games: row.games, wins: row.wins, losses: row.losses,
      streak: row.streak, bestStreak: row.best_streak,
      totalCoinsEarned: row.total_coins_earned || 0, totalXpEarned: row.total_xp_earned || 0,
      rankedGames: row.ranked_games, rankedWins: row.ranked_wins,
    },
    achievements,
    passClaimed,
    galactico: { xp: row.galactico_xp, claimed: galacticoClaimed },
  };
}

/* Guarda de vuelta en Supabase todo lo que la lógica de negocio (sin cambios)
   pudo haber mutado sobre el objeto con forma "vieja". Los campos escalares
   de "profiles" se pisan con un UPDATE; las colecciones (inventario, logros,
   pases) son de solo-agregar en la lógica actual, así que un upsert con
   ignoreDuplicates alcanza sin tener que diffear contra lo que ya había. */
async function persistProfile(p, opts) {
  const { error } = await supabase
    .from("profiles")
    .update({
      avatar: p.avatar,
      coins: p.coins,
      xp: p.xp,
      rank_pts: p.rankPts,
      galactico_xp: p.galactico.xp,
      games: p.stats.games, wins: p.stats.wins, losses: p.stats.losses,
      streak: p.stats.streak, best_streak: p.stats.bestStreak,
      ranked_games: p.stats.rankedGames, ranked_wins: p.stats.rankedWins,
      total_coins_earned: p.stats.totalCoinsEarned, total_xp_earned: p.stats.totalXpEarned,
      active_skin: p.active.skin, active_tapete: p.active.tapete, active_effect: p.active.effect,
      active_soundfx: p.active.soundfx, active_trail: p.active.trail,
      active_nameeffect: p.active.nameeffect, active_banner: p.active.banner,
      active_title: p.active.title,
    })
    .eq("id", p._id);
  if (error) throw new Error("persistProfile (profiles): " + error.message);

  const invRows = [];
  const typeMap = { skins: "skin", tapetes: "tapete", effects: "effect", soundfx: "soundfx", trails: "trail", avatars: "avatar", nameeffects: "nameeffect", banners: "banner", titles: "title" };
  for (const [srcKey, item_type] of Object.entries(typeMap)) {
    for (const item_id of p.inventory[srcKey] || []) invRows.push({ profile_id: p._id, item_type, item_id });
  }
  if (invRows.length) {
    const { error: e1 } = await supabase.from("inventory_items").upsert(invRows, { onConflict: "profile_id,item_type,item_id", ignoreDuplicates: true });
    if (e1) throw new Error("persistProfile (inventory_items): " + e1.message);
  }

  // Perf: por default re-sube TODO el historial de logros (compat total con
  // los demás call sites, sin cambiar su comportamiento) — es idempotente
  // (upsert+ignoreDuplicates) pero redundante en el camino caliente de fin
  // de partida, donde YA sabemos exactamente cuáles son nuevos. Si el
  // llamador pasa `opts.newAchievementIds`, se sube SOLO esa lista — los
  // demás ya están persistidos de cuando se desbloquearon la primera vez,
  // no hace falta re-escribirlos en cada partida.
  const achSource = (opts && opts.newAchievementIds)
    ? opts.newAchievementIds.map((id) => [id, p.achievements[id]]).filter(([, ts]) => ts != null)
    : Object.entries(p.achievements);
  const achRows = achSource.map(([achievement_id, ts]) => ({ profile_id: p._id, achievement_id, unlocked_at: new Date(ts).toISOString() }));
  if (achRows.length) {
    const { error: e2 } = await supabase.from("profile_achievements").upsert(achRows, { onConflict: "profile_id,achievement_id", ignoreDuplicates: true });
    if (e2) throw new Error("persistProfile (profile_achievements): " + e2.message);
  }

  const passRows = [
    ...Object.keys(p.passClaimed || {}).map((level) => ({ profile_id: p._id, pass_type: "season", level: Number(level) })),
    ...Object.keys(p.galactico.claimed || {}).map((level) => ({ profile_id: p._id, pass_type: "galactico", level: Number(level) })),
  ];
  if (passRows.length) {
    const { error: e3 } = await supabase.from("pass_claims").upsert(passRows, { onConflict: "profile_id,pass_type,level", ignoreDuplicates: true });
    if (e3) throw new Error("persistProfile (pass_claims): " + e3.message);
  }
}

/* ============================================================
   MOTOR DE RECOMPENSAS (Fase 1) — ver docs/backend/ o el changelog de esta
   fase para el diseño completo. Dos primitivas:

   - claimGrantSlot(profileId, sourceType, sourceId, rewards): el gate de
     idempotencia real (antes no existía ninguno a nivel DB — un logro o un
     nivel de pase podían pagarse dos veces por una carrera entre dos
     requests casi simultáneos, aunque el registro de "desbloqueado" en su
     tabla quedara una sola vez). Un INSERT liso a reward_grants con su
     unique constraint — si ya existe, el insert falla con 23505
     (unique_violation) y acá se traduce a claimed:false sin tocar nada más.
     Se usa como guard ANTES de la lógica existente de otorgar (logros,
     pases, resultado de partida) sin reescribir esa lógica.
   - grantRewards(username, rewards, source): el motor completo para
     features NUEVAS (Ranked rewards, Ruleta, Misiones, Torre — no
     implementadas todavía) que no tienen ya un objeto de perfil cargado en
     memoria — aplica coins/xp/rankPts/items de forma atómica vía el RPC
     grant_rewards (una función = una transacción: si algo falla a mitad,
     Postgres hace rollback de todo, nunca queda "coins sí, skin no").

   rewards: [{type:'coins',amount}, {type:'xp',amount},
             {type:'item',itemType,itemId}, {type:'title',itemId},
             {type:'rank_delta',amount}]
   source: {type:'match'|'achievement'|'pass'|'pass_galactico'|futuro, id}
   ============================================================ */
async function claimGrantSlot(profileId, sourceType, sourceId, rewards) {
  const { data, error } = await supabase
    .from("reward_grants")
    .insert({ profile_id: profileId, source_type: sourceType, source_id: String(sourceId), rewards: rewards || [] })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") return { claimed: false }; // ya existía — otra request ya lo otorgó
    throw new Error("claimGrantSlot: " + error.message);
  }
  return { claimed: true, grant: data };
}

// [Torre — premios pendientes] acknowledged=false es SOLO para la Torre: el
// grant paga coins/xp/inventory al toque, igual que siempre (grant_rewards
// es atómico, la plata nunca se pierde) — lo único que queda en "pendiente"
// es si el jugador ya vio/abrió la animación del regalo. Cualquier otro
// llamador (match, achievement, pass, ranked) no pasa este parámetro y
// sigue exactamente igual que antes (acknowledged=true, el default de la
// función SQL — ver 20260826180000_tower_pending_rewards.sql).
async function grantRewards(username, rewards, source, acknowledged) {
  try {
    const row = await fetchProfileRaw(username.trim().toLowerCase());
    if (!row) return { ok: false, error: "Usuario inexistente." };
    const params = {
      p_profile_id: row.id,
      p_source_type: source.type,
      p_source_id: String(source.id),
      p_rewards: rewards,
    };
    if (acknowledged === false) params.p_acknowledged = false;
    const { data, error } = await supabase.rpc("grant_rewards", params);
    if (error) return { ok: false, error: error.message };
    return { ok: true, ...data };
  } catch (e) {
    console.error("[db] grantRewards: error para", username, "-", e.message);
    return { ok: false, error: "Servidor no disponible en este momento. Probá de nuevo." };
  }
}

/* Catálogo central de recompensas — a propósito vacío/mínimo en esta fase
   (no hay Ruleta/Misiones/Torre todavía, ver Fase 1). Es el lugar donde
   esas fases futuras van a agregar entradas (rank_promo_gold,
   tower_rank_3, daily_first_win, mission_x, ...) en vez de hardcodear
   números mágicos en server.js — cada entrada es un array `rewards` listo
   para pasarle directo a grantRewards/claimGrantSlot. */
const REWARD_DEFINITIONS = {};

/* Historial de partida — matches/match_participants existían en el esquema
   desde el inicio pero nunca se escribían (0 filas siempre). ensureMatchRow
   crea (o reusa, cacheada en room._matchDbId) la fila de "matches" al
   resolver una partida, dando un id real para usar como source_id del
   guard de idempotencia de resolveMatch. Best-effort: un fallo acá nunca
   debe frenar el resultado real de la partida. */
async function ensureMatchRow({ roomCode, gameMode, ranked, startedAt }) {
  try {
    const { data, error } = await supabase
      .from("matches")
      .insert({ room_code: roomCode || null, game_mode: gameMode || "casual", ranked: !!ranked, started_at: new Date(startedAt || Date.now()).toISOString() })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id;
  } catch (e) {
    console.error("[db] ensureMatchRow: error -", e.message);
    return null;
  }
}
async function recordMatchParticipants(matchId, rows) {
  if (!matchId || !rows || !rows.length) return;
  try {
    const { error } = await supabase.from("match_participants").insert(rows.map(r => ({ match_id: matchId, ...r })));
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("[db] recordMatchParticipants: error -", e.message);
  }
}

async function usernameExists(usernameLower) {
  const { data, error } = await supabase.from("profiles").select("id").ilike("username", usernameLower).maybeSingle();
  if (error) throw new Error("usernameExists: " + error.message);
  return !!data;
}

/* Tras auth.admin.createUser(), el trigger handle_new_user() crea la fila de
   "profiles" en la misma transacción — pero a veces tarda un instante en verse
   reflejada del lado de PostgREST. Reintenta unas pocas veces antes de fallar. */
async function waitForProfileRowById(id, tries = 5, delayMs = 200) {
  for (let i = 0; i < tries; i++) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*, inventory_items(item_type,item_id), profile_achievements(achievement_id,unlocked_at), pass_claims(pass_type,level)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error("waitForProfileRowById: " + error.message);
    if (data) return data;
    await new Promise((res) => setTimeout(res, delayMs));
  }
  return null;
}

/* Bono de bienvenida de la v1.1: ya se aplicó una sola vez a cada cuenta
   existente ANTES de la migración a Supabase (Etapa 3) — su valor final ya
   está reflejado en el "coins" migrado. Para cuentas nuevas se suma acá mismo
   en register(). No hace falta re-chequearlo en cada login. */
const WELCOME_BONUS_COINS = 10000;

/* Perfil público (sin passwordHash), con datos derivados */
function publicProfile(p) {
  const lvl = levelFromXp(p.xp);
  const tier = tierOf(p.rankPts);
  const winRate = p.stats.games > 0 ? Math.round(p.stats.wins / p.stats.games * 100) : 0;
  const gp = p.galactico || { xp: 0, claimed: {} };
  const glvl = galacticoLevelFromXp(gp.xp);
  return {
    username: p.username,
    avatar: p.avatar,
    rankPts: p.rankPts,
    coins: p.coins,
    xp: p.xp,
    level: lvl.level,
    xpInLevel: lvl.xpInLevel,
    xpForNext: lvl.xpForNext,
    tier: { name: tier.name, icon: tier.icon, color: tier.color, min: tier.min },
    inventory: p.inventory,
    active: p.active,
    stats: { ...p.stats, winRate },
    achievements: Object.keys(p.achievements),
    achievementsCount: Object.keys(p.achievements).length,
    achievementsTotal: ACHIEVEMENTS.length,
    passClaimed: p.passClaimed || {},
    galactico: {
      xp: gp.xp, level: glvl.level, xpInLevel: glvl.xpInLevel, xpForNext: glvl.xpForNext,
      claimed: gp.claimed || {},
    },
  };
}

/* ---------- Auth ---------- */
async function register(username, password) {
  if (!username || !password) return { ok: false, error: "Nombre y contraseña requeridos." };
  username = username.trim().slice(0, 16);
  if (username.length < 2) return { ok: false, error: "El nombre debe tener al menos 2 caracteres." };
  if (password.length < 3) return { ok: false, error: "La contraseña debe tener al menos 3 caracteres." };
  const usernameLower = username.toLowerCase();

  try {
    if (await usernameExists(usernameLower)) return { ok: false, error: "Ese nombre ya está registrado. Iniciá sesión." };

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: syntheticEmail(usernameLower),
      password,
      email_confirm: true,
      user_metadata: { username, avatar: "🀄" },
    });
    if (createErr) {
      if (/already/i.test(createErr.message || "")) return { ok: false, error: "Ese nombre ya está registrado. Iniciá sesión." };
      console.error("[auth] register: createUser falló para", username, "-", createErr.message);
      return { ok: false, error: "No se pudo crear la cuenta. Probá de nuevo en un momento." };
    }
    const profileId = created.user.id;

    // El trigger handle_new_user crea la fila de "profiles" en la misma
    // transacción del alta en auth.users, pero puede tardar un instante en
    // quedar visible para PostgREST — se espera con reintentos cortos.
    const initialRow = await waitForProfileRowById(profileId);
    if (!initialRow) {
      console.error("[auth] register: la fila de profiles no apareció a tiempo para", username);
      return { ok: false, error: "No se pudo terminar de crear la cuenta. Probá iniciar sesión en un momento." };
    }

    // Saldo inicial + bono de bienvenida (el trigger solo pone los defaults, coins:0).
    const { error: updErr } = await supabase.from("profiles").update({ coins: 500 + WELCOME_BONUS_COINS }).eq("id", profileId);
    if (updErr) console.error("[auth] register: no se pudo aplicar el saldo inicial a", username, "-", updErr.message);

    const row = await fetchProfileRaw(usernameLower);
    const p = rowToProfileShape(row || { ...initialRow, coins: 500 + WELCOME_BONUS_COINS });
    // admin.createUser() no devuelve sesión — se loguea una vez más (mismo
    // cliente descartable) solo para emitir el primer token de sesión.
    const session = await mintSession(usernameLower, password);
    return { ok: true, profile: publicProfile(p), welcomeBonus: WELCOME_BONUS_COINS, session };
  } catch (e) {
    console.error("[auth] register: error inesperado para", username, "-", e.message);
    return { ok: false, error: "Servidor no disponible en este momento. Probá de nuevo." };
  }
}

async function login(username, password) {
  if (!username || !password) return { ok: false, error: "Nombre y contraseña requeridos." };
  const usernameLower = username.trim().toLowerCase();

  let row;
  try {
    row = await fetchProfileRaw(usernameLower);
  } catch (e) {
    console.error("[auth] login: Supabase no disponible buscando perfil de", username, "-", e.message);
    return { ok: false, error: "Servidor no disponible en este momento. Probá de nuevo en unos segundos." };
  }

  let authOk = false;
  let session = null;
  if (row) {
    try {
      const { data, error: signInErr } = await freshAuthClient().auth.signInWithPassword({ email: syntheticEmail(usernameLower), password });
      authOk = !signInErr;
      if (authOk && data && data.session) session = { refreshToken: data.session.refresh_token, expiresAt: data.session.expires_at };
      if (signInErr && !/invalid login credentials/i.test(signInErr.message || "")) {
        console.warn("[auth] login: signInWithPassword devolvió un error no estándar para", username, "-", signInErr.message);
      }
    } catch (e) {
      console.error("[auth] login: Supabase no disponible autenticando a", username, "-", e.message);
      return { ok: false, error: "Servidor no disponible en este momento. Probá de nuevo en unos segundos." };
    }
  }

  if (!authOk) {
    // Fallback perezoso: ¿coincide con el hash SHA-256 viejo de players.json?
    // Si coincide, se migra la contraseña a Supabase Auth acá mismo y no hace
    // falta volver a tocar este camino en el próximo login de este usuario.
    const legacy = loadLegacyDb()[usernameLower];
    if (!legacy) return { ok: false, error: row ? "Contraseña incorrecta." : "No existe ese jugador. ¿Querés registrarte?" };
    if (legacy.passwordHash !== legacyHash(password)) return { ok: false, error: "Contraseña incorrecta." };
    if (!row) return { ok: false, error: "Tu cuenta todavía no está disponible en el nuevo sistema. Contactá soporte." };

    try {
      const { error: updPwErr } = await supabase.auth.admin.updateUserById(row.id, { password });
      if (updPwErr) {
        console.error("[auth-migration] no se pudo actualizar la contraseña en Supabase para", username, "-", updPwErr.message);
        return { ok: false, error: "No se pudo migrar tu cuenta. Probá de nuevo." };
      }
      console.log("[auth-migration] contraseña migrada de players.json a Supabase — usuario:", username);
    } catch (e) {
      console.error("[auth-migration] error inesperado migrando a", username, "-", e.message);
      return { ok: false, error: "Servidor no disponible en este momento. Probá de nuevo." };
    }
    session = await mintSession(usernameLower, password);
  }

  const p = rowToProfileShape(row);
  return { ok: true, profile: publicProfile(p), welcomeBonus: null, alert: null, session };
}

/* Restaura identidad a partir del refresh token guardado por el cliente, sin
   volver a pedir contraseña. El username se deriva del usuario verificado
   por Supabase (user_metadata), nunca de lo que mande el cliente. Los
   refresh tokens de Supabase son single-use/rotativos: el "session" que se
   devuelve acá SIEMPRE reemplaza al anterior del lado del cliente.

   [Fase 5 — bug crítico real encontrado en el soak test] Antes, CUALQUIER
   error que devolviera Supabase acá (incluido un simple 429 de rate-limit de
   la propia API de Auth, visto en vivo bajo ráfagas de reconexión) se
   trataba igual que un refresh token genuinamente inválido: el llamador
   (server.js) mandaba "sessionExpired" y el cliente borraba el token y
   mandaba al usuario al login, aunque su sesión fuera perfectamente válida
   y el refresh token ni siquiera se hubiera llegado a consumir. Ahora se
   distingue: solo un status 4xx que NO sea rate-limit (Supabase realmente
   dijo "este token es inválido/ya usado/no existe") cuenta como expiración
   de verdad; un 429, un 5xx, o cualquier falla sin status HTTP claro (error
   de red, timeout) es TRANSITORIO — el refresh token nunca llegó a
   consumirse, así que el cliente puede reintentar más tarde con el mismo. */
async function resumeSession(refreshToken) {
  if (!refreshToken) return { ok: false, error: "expired" };
  try {
    const { data, error } = await freshAuthClient().auth.refreshSession({ refresh_token: refreshToken });
    if (error) {
      const status = error.status || 0;
      const transient = status === 429 || status === 0 || status >= 500;
      console.error("[auth] resumeSession: Supabase devolvió error -", JSON.stringify({ message: error.message, status: error.status, code: error.code }), transient ? "(transitorio, la sesión sigue siendo válida)" : "(token inválido, sesión vencida de verdad)");
      return { ok: false, error: transient ? "transient" : "expired" };
    }
    if (!data || !data.session || !data.user) return { ok: false, error: "expired" };
    const rawUsername = data.user.user_metadata && data.user.user_metadata.username;
    if (!rawUsername) return { ok: false, error: "expired" };
    const row = await fetchProfileRaw(rawUsername.trim().toLowerCase());
    if (!row) return { ok: false, error: "expired" };
    const p = rowToProfileShape(row);
    return {
      ok: true,
      username: row.username,
      profile: publicProfile(p),
      session: { refreshToken: data.session.refresh_token, expiresAt: data.session.expires_at },
    };
  } catch (e) {
    console.error("[auth] resumeSession: error -", e.message);
    return { ok: false, error: "transient" };
  }
}

/* Revoca la sesión (logout explícito) — invalida el token en todos los
   dispositivos de ese usuario (scope 'global'). Si el token ya venció o es
   inválido no hay nada que revocar: se trata como éxito silencioso, el
   objetivo (que ya no sirva) ya está cumplido igual. */
async function invalidateSession(refreshToken) {
  if (!refreshToken) return { ok: true };
  try {
    const { data, error } = await freshAuthClient().auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data || !data.session) return { ok: true };
    const { error: signOutErr } = await supabase.auth.admin.signOut(data.session.access_token, "global");
    if (signOutErr) console.error("[auth] invalidateSession: signOut falló -", signOutErr.message);
    return { ok: true };
  } catch (e) {
    console.error("[auth] invalidateSession: error -", e.message);
    return { ok: true };
  }
}

async function getProfileByName(username) {
  try {
    const row = await fetchProfileRaw(username.trim().toLowerCase());
    return row ? publicProfile(rowToProfileShape(row)) : null;
  } catch (e) {
    console.error("[db] getProfileByName: error para", username, "-", e.message);
    return null;
  }
}

/* Carga una fila para mutar, con el mismo chequeo de "no estás logueado" que
   usaban todas las funciones viejas cuando el usuario no existía. */
async function loadForMutation(username) {
  const row = await fetchProfileRaw(username.trim().toLowerCase());
  if (!row) return { ok: false, error: "No estás logueado." };
  return { ok: true, p: rowToProfileShape(row) };
}

/* ---------- Compras (validadas server-side) ---------- */
function _findItem(kind, id) {
  const cat = CATALOG[kind === "skin" ? "skins" : kind === "tapete" ? "tapetes" : kind === "effect" ? "effects" : kind === "soundfx" ? "soundfx" : kind === "trail" ? "trails" : null];
  if (!cat) return null;
  return cat.find(x => x.id === id);
}
function _invKey(kind) {
  return kind === "skin" ? "skins" : kind === "tapete" ? "tapetes" : kind === "soundfx" ? "soundfx"
    : kind === "nameeffect" ? "nameeffects" : kind === "banner" ? "banners" : kind === "trail" ? "trails"
    : kind === "title" ? "titles" : "effects";
}

async function buyItem(username, kind, id) {
  const item = _findItem(kind, id);
  if (!item) return { ok: false, error: "Ítem no encontrado." };
  try {
    const lp = await loadForMutation(username);
    if (!lp.ok) return lp;
    const p = lp.p;
    const invKey = _invKey(kind);
    if (p.inventory[invKey].includes(id)) return { ok: false, error: "Ya lo tenés." };
    if (item.season && !item.season.includes(new Date().getMonth() + 1)) return { ok: false, error: "Esta skin es de temporada y no está disponible ahora." };
    if (p.coins < item.price) return { ok: false, error: "No te alcanzan las monedas (necesitás " + item.price + ")." };
    p.coins -= item.price;
    p.inventory[invKey].push(id);
    const newAchs = await checkAchievements(p, {});
    await persistProfile(p);
    return { ok: true, profile: publicProfile(p), newAchievements: newAchs };
  } catch (e) {
    console.error("[db] buyItem: error para", username, "-", e.message);
    return { ok: false, error: "Servidor no disponible en este momento. Probá de nuevo." };
  }
}

async function setActive(username, kind, id) {
  try {
    const lp = await loadForMutation(username);
    if (!lp.ok) return lp;
    const p = lp.p;
    const activeKey = kind === "skin" ? "skin" : kind === "tapete" ? "tapete" : kind === "soundfx" ? "soundfx"
      : kind === "nameeffect" ? "nameeffect" : kind === "banner" ? "banner" : kind === "trail" ? "trail"
      : kind === "title" ? "title" : "effect";
    // Nombre, banner y título son adornos OPCIONALES (a diferencia de skin/tapete/
    // efecto, que siempre tienen algo activo) — "none" los apaga sin necesitar poseer nada.
    if (id === "none" && (kind === "nameeffect" || kind === "banner" || kind === "title")) {
      p.active[activeKey] = null;
      await persistProfile(p);
      return { ok: true, profile: publicProfile(p) };
    }
    const invKey = _invKey(kind);
    if (!p.inventory[invKey].includes(id)) return { ok: false, error: "No lo tenés." };
    p.active[activeKey] = id;
    await persistProfile(p);
    return { ok: true, profile: publicProfile(p) };
  } catch (e) {
    console.error("[db] setActive: error para", username, "-", e.message);
    return { ok: false, error: "Servidor no disponible en este momento. Probá de nuevo." };
  }
}

/* ---------- Modo Monedas: apostar para jugar (solo online) ---------- */
// Descuenta la apuesta del saldo al confirmarla (queda "reservada" hasta el fin de la partida).
async function reserveBet(username, amount) {
  try {
    const lp = await loadForMutation(username);
    if (!lp.ok) return lp;
    const p = lp.p;
    if (!(amount > 0)) return { ok: false, error: "Apuesta inválida." };
    if (amount > p.coins) return { ok: false, error: "No te alcanzan las monedas." };
    p.coins -= amount;
    await persistProfile(p);
    return { ok: true, profile: publicProfile(p) };
  } catch (e) {
    console.error("[db] reserveBet: error para", username, "-", e.message);
    return { ok: false, error: "Servidor no disponible en este momento. Probá de nuevo." };
  }
}
// Acredita monedas directo (devolución de apuesta al cancelar, o pago al terminar la partida).
async function creditCoins(username, amount) {
  try {
    const lp = await loadForMutation(username);
    if (!lp.ok) return lp;
    const p = lp.p;
    p.coins += amount;
    await persistProfile(p);
    return { ok: true, profile: publicProfile(p) };
  } catch (e) {
    console.error("[db] creditCoins: error para", username, "-", e.message);
    return { ok: false, error: "Servidor no disponible en este momento. Probá de nuevo." };
  }
}

/* ---------- Pase de temporada: reclamar recompensa de un nivel ---------- */
async function claimPass(username, level) {
  try {
    const lp = await loadForMutation(username);
    if (!lp.ok) return lp;
    const p = lp.p;
    const L = PASS_LEVELS.find(x => x.lv === level);
    if (!L) return { ok: false, error: "Nivel de pase inválido." };
    if (p.passClaimed[level]) return { ok: false, error: "Ya reclamaste esa recompensa." };
    if (levelFromXp(p.xp).level < level) return { ok: false, error: "Todavía no llegaste a ese nivel." };
    // Gate real de idempotencia (antes el único guard era p.passClaimed[level]
    // en memoria — dos clicks/reintentos casi simultáneos podían pagar la
    // recompensa dos veces aunque pass_claims, con su propia PK, terminara
    // mostrando un solo claim registrado).
    const slot = await claimGrantSlot(p._id, "pass", level, [L.reward]);
    if (!slot.claimed) return { ok: false, error: "Ya reclamaste esa recompensa." };
    p.passClaimed[level] = true;
    const r = L.reward;
    if (r.coins) p.coins += r.coins;
    if (r.skin && !p.inventory.skins.includes(r.skin)) p.inventory.skins.push(r.skin);
    if (r.tapete && !p.inventory.tapetes.includes(r.tapete)) p.inventory.tapetes.push(r.tapete);
    if (r.effect && !p.inventory.effects.includes(r.effect)) p.inventory.effects.push(r.effect);
    if (r.soundfx && !p.inventory.soundfx.includes(r.soundfx)) p.inventory.soundfx.push(r.soundfx);
    if (r.trail && !p.inventory.trails.includes(r.trail)) p.inventory.trails.push(r.trail);
    if (r.avatars) {
      if (!p.inventory.avatars) p.inventory.avatars = FREE_AVATARS.slice();
      r.avatars.forEach(a => { if (!p.inventory.avatars.includes(a)) p.inventory.avatars.push(a); });
    }
    await persistProfile(p);
    return { ok: true, profile: publicProfile(p) };
  } catch (e) {
    console.error("[db] claimPass: error para", username, "-", e.message);
    return { ok: false, error: "Servidor no disponible en este momento. Probá de nuevo." };
  }
}

/* ---------- Pase Galáctico: reclamar recompensa de un nivel (progreso aparte, ver arriba) ---------- */
async function claimGalacticoPass(username, level) {
  try {
    const lp = await loadForMutation(username);
    if (!lp.ok) return lp;
    const p = lp.p;
    const L = GALACTICO_PASS_LEVELS.find(x => x.lv === level);
    if (!L) return { ok: false, error: "Nivel de pase inválido." };
    if (p.galactico.claimed[level]) return { ok: false, error: "Ya reclamaste esa recompensa." };
    if (galacticoLevelFromXp(p.galactico.xp).level < level) return { ok: false, error: "Todavía no llegaste a ese nivel." };
    const slot = await claimGrantSlot(p._id, "pass_galactico", level, [L.reward]);
    if (!slot.claimed) return { ok: false, error: "Ya reclamaste esa recompensa." };
    p.galactico.claimed[level] = true;
    const r = L.reward;
    if (r.coins) p.coins += r.coins;
    if (r.skin && !p.inventory.skins.includes(r.skin)) p.inventory.skins.push(r.skin);
    if (r.nameeffect && !p.inventory.nameeffects.includes(r.nameeffect)) p.inventory.nameeffects.push(r.nameeffect);
    if (r.banner && !p.inventory.banners.includes(r.banner)) p.inventory.banners.push(r.banner);
    if (r.trail && !p.inventory.trails.includes(r.trail)) p.inventory.trails.push(r.trail);
    await persistProfile(p);
    return { ok: true, profile: publicProfile(p) };
  } catch (e) {
    console.error("[db] claimGalacticoPass: error para", username, "-", e.message);
    return { ok: false, error: "Servidor no disponible en este momento. Probá de nuevo." };
  }
}

async function setAvatar(username, avatar) {
  try {
    const lp = await loadForMutation(username);
    if (!lp.ok) return lp;
    const p = lp.p;
    if (!ALL_AVATARS.includes(avatar)) return { ok: false, error: "Avatar no válido." };
    if (!(p.inventory && p.inventory.avatars && p.inventory.avatars.includes(avatar))) {
      return { ok: false, error: "Todavía no ganaste ese avatar — subí de nivel en el Pase de temporada." };
    }
    p.avatar = avatar;
    await persistProfile(p);
    return { ok: true, profile: publicProfile(p) };
  } catch (e) {
    console.error("[db] setAvatar: error para", username, "-", e.message);
    return { ok: false, error: "Servidor no disponible en este momento. Probá de nuevo." };
  }
}

/* ---------- Logros: se corren después de cada acción relevante ---------- */
async function checkAchievements(profile, ctx) {
  // Perf (medición de latencia, ago/2026): antes, cada logro que calificaba
  // hacía SU PROPIO claimGrantSlot (1 insert secuencial c/u) — hasta 26
  // round trips a Supabase en el peor caso real (la primera partida de un
  // jugador nuevo, donde varios logros se cumplen a la vez: first_game +
  // first_win + clean_win + ... juntos). Ahora: el chequeo `ach.check()` es
  // puro en memoria (sin tocar DB) para juntar TODOS los candidatos, y se
  // reclaman con UN SOLO upsert por lote — mismo mecanismo de idempotencia
  // (unique constraint de reward_grants vía onConflict+ignoreDuplicates: si
  // otra request ya lo otorgó, esa fila simplemente no vuelve en `.select()`,
  // sin error), pero en un único round trip en vez de N. Verificado
  // empíricamente contra Supabase real que ignoreDuplicates+select() SOLO
  // devuelve las filas realmente insertadas, nunca las que ya existían.
  const candidates = [];
  for (const ach of ACHIEVEMENTS) {
    if (profile.achievements[ach.id]) continue;
    try { if (ach.check(profile, ctx)) candidates.push(ach); } catch (e) {}
  }
  if (!candidates.length) return [];

  const rows = candidates.map((ach) => ({
    profile_id: profile._id, source_type: "achievement", source_id: ach.id,
    rewards: [{ type: "coins", amount: ach.coinReward }, { type: "xp", amount: ach.xpReward }],
  }));
  const { data, error } = await supabase
    .from("reward_grants")
    .upsert(rows, { onConflict: "profile_id,source_type,source_id", ignoreDuplicates: true })
    .select("source_id");
  if (error) { console.error("[db] checkAchievements: upsert de reward_grants falló -", error.message); return []; }
  const claimedIds = new Set((data || []).map((r) => r.source_id));

  const newly = [];
  for (const ach of candidates) {
    if (!claimedIds.has(ach.id)) continue; // otra request lo ganó la carrera — no volver a sumar
    profile.achievements[ach.id] = Date.now();
    profile.coins += ach.coinReward;
    profile.xp += ach.xpReward;
    profile.stats.totalCoinsEarned += ach.coinReward;
    profile.stats.totalXpEarned += ach.xpReward;
    newly.push({
      id: ach.id, name: ach.name, desc: ach.desc,
      coinReward: ach.coinReward, xpReward: ach.xpReward,
    });
  }
  return newly;
}

/* ---------- Fin de partida: XP, monedas, rankPts, logros ----------
   results: [{ username, place, surrendered, jokerBreaksUsed, opponentsTilesLeft }]
   opts: { ranked, playersCount, gameMode, matchId, reason }
   reason: "normal" (default) | "lastStandingByForfeit" (todos los demás se
   rindieron y este ganó por abandono ajeno, no jugando hasta el final) |
   "tower" (Torre semanal, no implementado todavía — el motor ya lo soporta).
   Cada jugador se carga/persiste de forma independiente: si Supabase falla
   para uno, no arrastra ni corrompe el resultado de los demás (se reporta el
   fallo puntual en vez de fingir un update que nunca se guardó).

   Reglas de recompensa (v1.3, decisión explícita del usuario):
   - Quien se rinde (`r.surrendered`): la partida cuenta (games/losses/streak),
     pero CERO XP, CERO monedas, CERO progreso de Pase Galáctico y CERO logros
     de esta partida. La penalización de MMR en Ranked se sigue aplicando
     normal (vía `place`, siempre el último) — rendirse no evade esa parte.
   - Ganador por abandono ajeno (`reason==="lastStandingByForfeit"`): todos los
     demás se rindieron, no jugó hasta el final contra rivales activos.
     Recompensa reducida y FIJA: 40 XP, 20 monedas, sin bonos de puesto ni de
     racha. El MMR de Ranked se resuelve normal (deltas de siempre).
   - Partida terminada normalmente (nadie se rindió en la posición evaluada):
     base de participación completa (30 XP / 20 monedas, igual que siempre,
     incluso perdiendo) + bono de puesto/racha ESCALADO según cuántos humanos
     arrancaron la partida (`opts.playersCount`, estable desde que la sala
     arranca — ver server.js) — 2 humanos (o 1+IA) = 40%, 3 = 70%, 4+ = 100%.
     Evita "farmear" el bono de 1° en duelos 1v1 al mismo ritmo que en mesas
     completas, sin tocar la base que se gana por participar hasta el final. */
const RANK_DELTAS = { 2: [50, -50], 3: [50, 10, -50], 4: [50, 30, 10, -50] };
async function resolveMatch(results, opts) {
  const totalPlayers = opts.playersCount || results.length;
  const deltas = opts.ranked ? (RANK_DELTAS[totalPlayers] || RANK_DELTAS[4]) : null;
  const reason = opts.reason || "normal";
  const positionBonusScale = totalPlayers <= 2 ? 0.4 : totalPlayers === 3 ? 0.7 : 1;

  const jobs = results.map(async (r, i) => {
    if (!r.username) return null; // bots no tienen perfil
    let row;
    try {
      row = await fetchProfileRaw(r.username.trim().toLowerCase());
    } catch (e) {
      console.error("[db] resolveMatch: no se pudo leer el perfil de", r.username, "-", e.message);
      return null;
    }
    if (!row) return null;
    const p = rowToProfileShape(row);

    // Gate real de idempotencia a nivel DB — antes de esto, el único
    // mecanismo era `player._statsResolved` en server.js: un flag
    // puramente EN MEMORIA de ese proceso/sala, que no protege contra un
    // reinicio del server, dos instancias, ni un reintento/replay del
    // mismo mensaje. Con matchId real (ver ensureMatchRow en server.js),
    // el unique constraint de reward_grants decide atómicamente si esta
    // combinación (jugador, partida) ya se resolvió — si `opts.matchId` no
    // vino (llamador viejo/defensivo), no bloquea, sigue como antes.
    if (opts.matchId) {
      try {
        const slot = await claimGrantSlot(p._id, "match", opts.matchId, [{ note: "resultado de partida", place: r.place }]);
        if (!slot.claimed) return null; // ya resuelto — no volver a aplicar
      } catch (e) {
        console.error("[db] resolveMatch: claimGrantSlot falló para", r.username, "-", e.message);
        return null; // ante la duda, no aplicar dos veces
      }
    }

    const before = {
      xp: p.xp, level: levelFromXp(p.xp).level,
      coins: p.coins, rankPts: p.rankPts,
    };
    // place viene del llamador (finishMatch/forfeitPlayer), que ya lo calcula
    // correctamente sobre el orden REAL de la partida — antes acá se ignoraba y se
    // recalculaba a partir de `i`, el índice dentro de ESTE array `results`. Eso
    // rompía en dos casos reales: forfeitPlayer resuelve a quien se rinde a mitad
    // de partida en un array de UN solo elemento (i siempre 0 → se lo trataba como
    // ganador en vez de aplicarle la penalización de último lugar), y finishMatch
    // filtra a quien ya se resolvió por ese camino antes de llamar acá, corriendo
    // los índices de todos los que quedan (alguien podía terminar con un `place`
    // mejor del que le correspondía). El fallback a `i+1` es solo por seguridad
    // para un futuro llamador que no mande `place`.
    const place = r.place || (i + 1);
    const isWinner = (place === 1);
    const surrendered = !!r.surrendered;
    const lastStandingByForfeit = isWinner && reason === "lastStandingByForfeit";

    // === XP y monedas ===
    let xpGained, coinsGained;
    if (surrendered) {
      xpGained = 0;
      coinsGained = 0;
    } else if (lastStandingByForfeit) {
      xpGained = 40;
      coinsGained = 20;
    } else {
      const placeBonusXp = isWinner ? 150 : place === 2 ? 80 : place === 3 ? 40 : 0;
      xpGained = 30 + Math.round(placeBonusXp * positionBonusScale);
      const placeBonusCoins = isWinner ? 80 : place === 2 ? 30 : place === 3 ? 15 : 0;
      coinsGained = 20 + Math.round(placeBonusCoins * positionBonusScale);
    }
    if (opts.ranked) xpGained = Math.round(xpGained * 1.5);
    p.xp += xpGained;
    p.stats.totalXpEarned += xpGained;

    // === Stats (la partida cuenta SIEMPRE, incluso rendida) ===
    p.stats.games++;
    if (opts.ranked) p.stats.rankedGames++;
    if (isWinner) {
      p.stats.wins++;
      if (opts.ranked) p.stats.rankedWins++;
      p.stats.streak++;
      if (p.stats.streak > p.stats.bestStreak) p.stats.bestStreak = p.stats.streak;
      if (!surrendered && !lastStandingByForfeit) {
        const streakBonus = Math.round(25 * Math.min(p.stats.streak, 5) * positionBonusScale);
        coinsGained += streakBonus;
      }
    } else {
      p.stats.losses++;
      p.stats.streak = 0;
    }
    p.coins += coinsGained;
    p.stats.totalCoinsEarned += coinsGained;

    // === Ranked: rankPts ===
    let rankDelta = 0;
    if (opts.ranked && deltas) {
      rankDelta = deltas[Math.min(place - 1, deltas.length - 1)];
      p.rankPts = Math.max(0, p.rankPts + rankDelta);
    }

    // === Logros: ninguno para quien se rindió esta partida ===
    let newAchievements = [];
    if (!surrendered) {
      const ctx = {
        won: isWinner,
        place,
        playersCount: totalPlayers,
        ranked: opts.ranked,
        jokerBreaksUsed: r.jokerBreaksUsed || 0,
        opponentsTilesLeft: r.opponentsTilesLeft || 0,
      };
      newAchievements = await checkAchievements(p, ctx);
    }

    // === Pase Galáctico: progreso APARTE, solo si la partida fue de ese modo
    // y no se rindió (mismo criterio de cero-recompensa-por-rendición) ===
    let galactico = null;
    if (opts.gameMode === "galactico" && !surrendered) {
      const gBefore = galacticoLevelFromXp(p.galactico.xp).level;
      const gGained = 30 + (isWinner ? 50 : 0);
      p.galactico.xp += gGained;
      const gAfter = galacticoLevelFromXp(p.galactico.xp);
      galactico = { gained: gGained, level: gAfter.level, xpInLevel: gAfter.xpInLevel, xpForNext: gAfter.xpForNext, leveledUp: gAfter.level > gBefore };
    }

    const after = levelFromXp(p.xp);
    const leveledUp = after.level > before.level;

    try {
      await persistProfile(p, { newAchievementIds: newAchievements.map((a) => a.id) });
    } catch (e) {
      console.error("[db] resolveMatch: no se pudo guardar el resultado de", r.username, "-", e.message);
      return null; // no se confirma un update que no llegó a guardarse
    }

    return {
      username: p.username,
      profileId: p._id, // para escribir match_participants sin tener que resolver username -> id de nuevo
      place,
      won: isWinner,
      xpGained,
      coinsGained,
      rankDelta,
      before,
      after: {
        xp: p.xp, level: after.level, xpInLevel: after.xpInLevel, xpForNext: after.xpForNext,
        coins: p.coins, rankPts: p.rankPts,
      },
      leveledUp,
      newAchievements,
      galactico,
      profile: publicProfile(p),
    };
  });

  const settled = await Promise.all(jobs);
  return settled.filter(Boolean);
}

/* ============================================================
   RULETA DIARIA (v1.3) — una tirada por día calendario de Uruguay, racha de
   1 a 7 (se reinicia a 1 si se salta un día; tras el día 7 vuelve a 1).

   Decisión de diseño (desvío deliberado de la especificación original, que
   pedía una tabla nueva `daily_reward_state`): en vez de esa tabla, la
   idempotencia Y la racha se derivan enteramente de `reward_grants` — la
   misma tabla y el mismo RPC `grant_rewards` que YA están desplegados en
   producción desde la Fase 1 (motor de recompensas). Cada tirada se guarda
   como una fila con source_type='roulette', source_id=fecha ISO del día
   (Uruguay) — el unique constraint (profile_id, source_type, source_id) ya
   impide dos premios el mismo día (doble click, replay, reinicio del
   server, todo cubierto por el mismo mecanismo ya probado en
   test-reward-engine.mjs). La racha se calcula contando cuántos días
   consecutivos ANTERIORES a hoy tienen una fila 'roulette' — sin necesitar
   guardar el número aparte. Ventaja real: no hace falta aplicar NINGUNA
   migración nueva para que esto funcione — se puede probar de punta a
   punta contra Supabase real hoy mismo, en vez de código sin probar a la
   espera de que alguien corra una migración a mano.
   ============================================================ */
const DAILY_TZ = "America/Montevideo";
// [min,max] de monedas por día de racha (1..7) — fase inicial solo monedas.
const DAILY_REWARD_RANGES = [[50, 80], [60, 100], [80, 120], [100, 150], [130, 190], [170, 240], [250, 400]];
// Segmentos discretos dentro de cada rango — nunca un monto continuo/manipulable.
const DAILY_REWARD_SEGMENTS = 5;

function uruguayDateStr(d) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DAILY_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d || new Date());
}
// Suma/resta días CALENDARIO (no horas) a una fecha "YYYY-MM-DD" — evita
// arrastrar horas/husos horarios al aritmética de días.
function addDaysISO(iso, delta) {
  const [y, m, dd] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, dd));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}
// Offset real (minutos) entre la hora de pared de Montevideo y UTC en el
// instante `d` — vía Intl (no hardcodea -03:00): si IANA algún día vuelve a
// aplicar horario de verano en América/Montevideo, esto lo sigue resolviendo bien.
function uruguayOffsetMinutes(d) {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: DAILY_TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  const asIfUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, parts.hour === "24" ? 0 : +parts.hour, +parts.minute, +parts.second);
  return Math.round((asIfUTC - d.getTime()) / 60000);
}
function msUntilNextUruguayMidnight(now) {
  now = now || new Date();
  const todayStr = uruguayDateStr(now);
  const tomorrowStr = addDaysISO(todayStr, 1);
  const offsetMin = uruguayOffsetMinutes(now);
  const tomorrowMidnightUTC = new Date(Date.parse(tomorrowStr + "T00:00:00Z") - offsetMin * 60000);
  return Math.max(0, tomorrowMidnightUTC.getTime() - now.getTime());
}
function pickDailyCoins(streakDay) {
  const [lo, hi] = DAILY_REWARD_RANGES[Math.min(Math.max(streakDay, 1), 7) - 1];
  const step = (hi - lo) / (DAILY_REWARD_SEGMENTS - 1);
  const idx = crypto.randomInt(0, DAILY_REWARD_SEGMENTS); // azar del SERVIDOR, nunca del cliente
  return Math.round(lo + step * idx);
}
async function getDailyClaimedDates(profileId) {
  const { data, error } = await supabase
    .from("reward_grants")
    .select("source_id")
    .eq("profile_id", profileId)
    .eq("source_type", "roulette")
    .order("source_id", { ascending: false })
    .limit(400); // de sobra para cualquier racha real (7) + margen amplio
  if (error) throw new Error("getDailyClaimedDates: " + error.message);
  return new Set((data || []).map((r) => r.source_id));
}
// Cuenta días consecutivos con tirada, empezando AYER hacia atrás (nunca
// incluye "hoy" — así el resultado es el mismo antes y después de reclamar
// el día de hoy, y sirve para calcular tanto "próxima racha" como "racha ya
// asignada hoy" con la misma fórmula: streakDay = (consecutivos % 7) + 1).
function countConsecutivePriorDays(claimedSet, todayStr) {
  let count = 0, cursor = addDaysISO(todayStr, -1);
  for (let i = 0; i < 3650; i++) {
    if (!claimedSet.has(cursor)) break;
    count++; cursor = addDaysISO(cursor, -1);
  }
  return count;
}

async function dailyStatus(username) {
  const row = await fetchProfileRaw(username.trim().toLowerCase());
  if (!row) return { ok: false, error: "Usuario inexistente." };
  const claimed = await getDailyClaimedDates(row.id);
  const today = uruguayDateStr();
  const claimedToday = claimed.has(today);
  const streakDay = (countConsecutivePriorDays(claimed, today) % 7) + 1;
  return { ok: true, claimedToday, streakDay, msUntilNext: msUntilNextUruguayMidnight() };
}

async function claimDailyReward(username) {
  const usernameLower = username.trim().toLowerCase();
  const row = await fetchProfileRaw(usernameLower);
  if (!row) return { ok: false, error: "Usuario inexistente." };
  const claimed = await getDailyClaimedDates(row.id);
  const today = uruguayDateStr();
  if (claimed.has(today)) return { ok: false, error: "Ya reclamaste la ruleta de hoy.", alreadyClaimed: true, msUntilNext: msUntilNextUruguayMidnight() };
  const streakDay = (countConsecutivePriorDays(claimed, today) % 7) + 1;
  const coins = pickDailyCoins(streakDay);
  let grantResult;
  try {
    grantResult = await grantRewards(username, [{ type: "coins", amount: coins }], { type: "roulette", id: today });
  } catch (e) {
    return { ok: false, error: "Servidor no disponible en este momento. Probá de nuevo." };
  }
  if (!grantResult.ok) return grantResult;
  if (grantResult.alreadyGranted) {
    // Carrera real: otra request para el mismo día ganó primero (mismo mecanismo
    // probado en test-reward-engine.mjs) — no hay premio nuevo que animar.
    return { ok: false, error: "Ya reclamaste la ruleta de hoy.", alreadyClaimed: true, msUntilNext: msUntilNextUruguayMidnight() };
  }
  let profile = null;
  try {
    const freshRow = await fetchProfileRaw(usernameLower);
    if (freshRow) profile = publicProfile(rowToProfileShape(freshRow));
  } catch (e) {}
  return { ok: true, streakDay, coins, profile, msUntilNext: msUntilNextUruguayMidnight() };
}

/* ============================================================
   TORRE SEMANAL (v1.3) — 10 pisos contra IA escalonada, reinicio semanal
   (lunes 00:00 Uruguay). MISMA decisión de diseño que Ruleta diaria: SIN
   tabla `tower_progress` nueva — se evaluó explícitamente (pedido de la
   tarea) si el progreso se puede derivar de `reward_grants` con
   source_type='tower', source_id='{weekId}:{floor}', y la respuesta es que
   SÍ alcanza para validación e idempotencia correctas: el piso actual es
   "el primero de 1-10 sin una fila para week_id actual", y superar un piso
   ya superado simplemente no vuelve a otorgar nada (mismo unique constraint
   de siempre). No se necesitó crear ninguna migración.

   IMPORTANTE (restricción de esta pasada): estas funciones NO se probaron
   contra Supabase real — la tarea prohibió explícitamente conectarse al
   proyecto de producción en esta segunda pasada. Sí están cubiertas por
   tests puros (weekId, computeCurrentFloor, tabla de premios/dificultad) en
   scripts/test-tower.mjs. La integración real contra Supabase queda
   pendiente de una corrida futura con autorización explícita o un proyecto
   de staging separado.
   ============================================================ */
const TOWER_FLOOR_DIFFICULTY = { 1: "easy", 2: "easy", 3: "normal", 4: "normal", 5: "hard", 6: "hard", 7: "hard", 8: "expert", 9: "expert", 10: "claude" };
// [v1.3.4 — rediseño de recompensas] Progresión balanceada contra la
// economía real del juego (no simulada): skins comprables van de 1500 a
// 12000 🪙, tapetes de 1200 a 4000, efectos de 1200 a 3500 (ver SKINS/
// TAPETES/FX_LIST en client/burako.js); la Ruleta diaria da 50-400 🪙/día
// al azar (~1000-1400/semana en un uso normal). Completar los 10 pisos de
// punta a punta (algo que exige ganarle a una IA que escala hasta "Claude"
// en el piso 10, no es gratis) da ~2725 🪙 + 950 XP + 2 efectos exclusivos
// + el bonus de completar — un empujón real hacia un cosmético de gama
// media, sin regalar los de gama alta ni superar lo que ya se puede ganar
// jugando/con la Ruleta en una semana normal. Cofres = solo un nombre/ícono
// para el salto de monto en la UI (piso 3/5/7), no una mecánica de loot
// aparte — mantiene todo predecible y fácil de balancear.
const TOWER_FLOOR_PRIZES = {
  1: [{ type: "coins", amount: 60 }, { type: "xp", amount: 20 }],
  2: [{ type: "coins", amount: 75 }, { type: "xp", amount: 25 }],
  3: [{ type: "coins", amount: 100 }, { type: "xp", amount: 30 }], // "Cofre Común"
  4: [{ type: "coins", amount: 140 }, { type: "xp", amount: 45 }],
  5: [{ type: "coins", amount: 190 }, { type: "xp", amount: 65 }], // "Cofre Raro"
  6: [{ type: "coins", amount: 240 }, { type: "xp", amount: 85 }],
  7: [{ type: "coins", amount: 320 }, { type: "xp", amount: 110 }], // "Cofre Épico"
  8: [{ type: "coins", amount: 400 }, { type: "xp", amount: 140 }],
  // Recompensa premium — único efecto NUEVO exclusivo de Torre antes del
  // 10 (reusa el sistema genérico de efectos por id+forma+paleta, sin CSS
  // nuevo — ver FX_SHAPES/paletas en client/burako.js).
  9: [{ type: "coins", amount: 500 }, { type: "xp", amount: 180 }, { type: "item", itemType: "effect", itemId: "torre_relampago" }],
  // Gran recompensa semanal — Torre Celestial ya existía; ahora además el
  // piso 10 por sí solo también sube de monto (antes 400/150).
  10: [{ type: "coins", amount: 700 }, { type: "xp", amount: 250 }, { type: "item", itemType: "effect", itemId: "torre_celestial" }],
};
// [Duplicados de cosmético — pedido explícito] Los efectos exclusivos de
// Torre (torre_relampago en piso 9, torre_celestial en piso 10) se pueden
// volver a ganar en una semana FUTURA (los pisos se resetean cada lunes,
// el cosmético no) — sin esto, un jugador que ya lo tiene de una semana
// anterior perdería la parte más vistosa del premio en silencio (el
// `on conflict do nothing` de inventory_items lo absorbe sin avisar). En
// vez de eso, si ya lo tiene, se le da esta conversión en monedas —
// ni la mitad del precio de un efecto comprable comparable (1200-3500 🪙),
// pero tampoco nada: es un "ya lo tenés, tomá esto en cambio" honesto.
const TOWER_ITEM_DUPLICATE_COINS = { torre_relampago: 300, torre_celestial: 400 };
async function ownsItem(profileId, itemType, itemId) {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("item_id")
    .eq("profile_id", profileId)
    .eq("item_type", itemType)
    .eq("item_id", itemId)
    .maybeSingle();
  if (error) { console.error("[db] ownsItem: error -", error.message); return false; }
  return !!data;
}
// Devuelve la lista de rewards de un piso, cambiando cualquier ítem que el
// jugador YA tenga por su conversión en monedas — nunca se pierde nada en
// silencio. El resto de los rewards (coins/xp) queda intacto.
async function resolveTowerRewards(profileId, floor) {
  const base = TOWER_FLOOR_PRIZES[floor];
  const out = [];
  for (const r of base) {
    if (r.type === "item" && (await ownsItem(profileId, r.itemType, r.itemId))) {
      const coins = TOWER_ITEM_DUPLICATE_COINS[r.itemId] || 0;
      if (coins > 0) out.push({ type: "coins", amount: coins });
      continue;
    }
    out.push(r);
  }
  return out;
}
// Bonus aparte por completar los 10 pisos en la semana — se otorga UNA vez
// por semana (idempotente por su propio source_id, separado del premio del
// piso 10) apenas se confirma floor===10, ya que superar el 10 siempre
// implica que la Torre quedó completa (los pisos se hacen en orden).
const TOWER_COMPLETE_BONUS = [{ type: "coins", amount: 500 }, { type: "xp", amount: 200 }];
// Semana ancla: fecha (YYYY-MM-DD, Uruguay) del lunes que abre la semana de
// `d`. Reinicio real a las 00:00 de Uruguay del lunes (uruguayDateStr ya
// resuelve la zona horaria) — se usa como weekId directamente (comparable
// como texto/fecha, sin ambigüedad de qué semana es).
function towerWeekId(d) {
  const todayStr = uruguayDateStr(d || new Date());
  const [y, m, dd] = todayStr.split("-").map(Number);
  const monday = new Date(Date.UTC(y, m - 1, dd));
  const dow = monday.getUTCDay(); // 0=domingo..6=sábado
  monday.setUTCDate(monday.getUTCDate() - ((dow + 6) % 7)); // retrocede al lunes de esa semana
  return monday.toISOString().slice(0, 10);
}
// Piso actual = el primero de 1..10 SIN fila de tirada superada. null = Torre
// completada esta semana (los 10 pisos ya tienen fila).
function computeCurrentFloor(clearedFloorsSet) {
  for (let f = 1; f <= 10; f++) if (!clearedFloorsSet.has(f)) return f;
  return null;
}
async function getTowerClearedFloors(profileId, weekId) {
  const { data, error } = await supabase
    .from("reward_grants")
    .select("source_id")
    .eq("profile_id", profileId)
    .eq("source_type", "tower")
    .like("source_id", weekId + ":%");
  if (error) throw new Error("getTowerClearedFloors: " + error.message);
  const set = new Set();
  (data || []).forEach((r) => {
    const floor = Number(String(r.source_id).split(":")[1]);
    if (floor >= 1 && floor <= 10) set.add(floor);
  });
  return set;
}
async function towerStatus(username) {
  const row = await fetchProfileRaw(username.trim().toLowerCase());
  if (!row) return { ok: false, error: "Usuario inexistente." };
  const weekId = towerWeekId();
  const cleared = await getTowerClearedFloors(row.id, weekId);
  const floor = computeCurrentFloor(cleared);
  const pendingResult = await getPendingTowerRewards(username);
  return {
    ok: true, weekId, floor, complete: floor === null, clearedFloors: [...cleared].sort((a, b) => a - b),
    pending: pendingResult.ok ? pendingResult.pending : [],
  };
}
// Se llama SOLO desde server.js (finishMatch) cuando el HUMANO ganó una
// partida de Torre — nunca a pedido directo del cliente con un piso
// arbitrario: `weekId`/`floor` vienen de room.towerWeekId/room.towerFloor,
// capturados al ARRANCAR esa partida (así si la semana rota justo mientras
// la partida está en curso, el resultado se acredita a la semana en la que
// arrancó, no a la vigente al terminar — regla explícita y simple).
async function claimTowerFloor(username, weekId, floor) {
  if (!(floor >= 1 && floor <= 10)) return { ok: false, error: "Piso inválido." };
  const usernameLower = username.trim().toLowerCase();
  const row = await fetchProfileRaw(usernameLower);
  if (!row) return { ok: false, error: "Usuario inexistente." };
  const cleared = await getTowerClearedFloors(row.id, weekId);
  const currentFloor = computeCurrentFloor(cleared);
  // Server-authoritative: el piso a premiar tiene que ser exactamente el que
  // ya le tocaba a este jugador esa semana — nunca el que mande el cliente
  // "porque sí" (protege contra piso inválido/bloqueado/ya superado/manipulado).
  if (currentFloor !== floor) return { ok: false, error: "Ese piso no está disponible para vos ahora mismo." };
  const rewards = await resolveTowerRewards(row.id, floor);
  let grantResult;
  try {
    // acknowledged:false — el premio YA se paga acá mismo (atómico, de
    // una), pero queda marcado como "todavía no visto/abierto" hasta que
    // el jugador toque el regalo (ver acknowledgeTowerReward más abajo) —
    // así nunca se pierde (la plata/ítem ya está en su cuenta) pero la
    // Torre puede mostrarle "tenés un premio pendiente" si salió sin verlo.
    grantResult = await grantRewards(username, rewards, { type: "tower", id: weekId + ":" + floor }, false);
  } catch (e) {
    return { ok: false, error: "Servidor no disponible en este momento. Probá de nuevo." };
  }
  if (!grantResult.ok) return grantResult;
  if (grantResult.alreadyGranted) return { ok: false, error: "Ese piso ya estaba superado.", alreadyClaimed: true };
  // Bonus de Torre completa — separado del premio del piso 10, su propio
  // source_id así grant_rewards lo trata como una recompensa aparte e
  // idempotente por su cuenta (una sola vez por semana, sin importar
  // cuántas veces se reintente esta llamada).
  if (floor === 10) {
    try { await grantRewards(username, TOWER_COMPLETE_BONUS, { type: "tower_complete", id: weekId }, false); }
    catch (e) { console.error("[db] claimTowerFloor: no se pudo otorgar el bonus de Torre completa -", e.message); }
  }
  let profile = null;
  try {
    const freshRow = await fetchProfileRaw(usernameLower);
    if (freshRow) profile = publicProfile(rowToProfileShape(freshRow));
  } catch (e) {}
  const nextCleared = new Set(cleared); nextCleared.add(floor);
  const nextFloor = computeCurrentFloor(nextCleared);
  // rewards: lo REALMENTE otorgado esta vez (puede diferir de
  // TOWER_FLOOR_PRIZES si un cosmético se convirtió a monedas por
  // duplicado, ver resolveTowerRewards) — el cliente lo usa para mostrar
  // el regalo con el monto real en vez de confiar ciegamente en su tabla
  // espejo estática.
  return { ok: true, floor, complete: nextFloor === null, nextFloor, profile, rewards: grantResult.rewards || rewards };
}
// [Torre — premios pendientes] Todos los grants de Torre (piso a piso Y el
// bonus de completar) que el jugador todavía no reconoció — a propósito SIN
// filtrar por semana actual: si cambió la semana y el jugador nunca vio el
// premio de la anterior, tiene que seguir apareciendo acá (pedido explícito:
// "no borres recompensas ganadas simplemente porque cambió la semana").
async function getPendingTowerRewards(username) {
  const row = await fetchProfileRaw(username.trim().toLowerCase());
  if (!row) return { ok: false, error: "Usuario inexistente." };
  const { data, error } = await supabase
    .from("reward_grants")
    .select("source_type, source_id, rewards")
    .eq("profile_id", row.id)
    .in("source_type", ["tower", "tower_complete"])
    .eq("acknowledged", false)
    .order("granted_at", { ascending: true });
  if (error) return { ok: false, error: error.message };
  const pending = (data || []).map((r) => {
    if (r.source_type === "tower_complete") return { kind: "complete", weekId: r.source_id, rewards: r.rewards };
    const [weekId, floorStr] = String(r.source_id).split(":");
    return { kind: "floor", weekId, floor: Number(floorStr), rewards: r.rewards };
  });
  return { ok: true, pending };
}
// Marca un premio de Torre como reconocido/abierto — se llama cuando el
// jugador toca el regalo (en el gameover o desde la Torre). Idempotente:
// tocarlo dos veces (doble click, reintento de red) no hace nada raro, la
// segunda vez simplemente confirma que ya estaba abierto.
async function acknowledgeTowerReward(username, kind, id) {
  const row = await fetchProfileRaw(username.trim().toLowerCase());
  if (!row) return { ok: false, error: "Usuario inexistente." };
  const sourceType = kind === "complete" ? "tower_complete" : "tower";
  const { data, error } = await supabase.rpc("acknowledge_reward_grant", {
    p_profile_id: row.id,
    p_source_type: sourceType,
    p_source_id: String(id),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, acknowledged: !!data };
}

/* ---------- Logros en vivo (durante la partida, no al final) ---------- */
async function checkLive(username, ctx) {
  if (!username) return [];
  try {
    const lp = await loadForMutation(username);
    if (!lp.ok) return [];
    const p = lp.p;
    const newly = await checkAchievements(p, ctx);
    if (newly.length) await persistProfile(p, { newAchievementIds: newly.map((a) => a.id) });
    return newly;
  } catch (e) {
    console.error("[db] checkLive: error para", username, "-", e.message);
    return [];
  }
}

/* ---------- Leaderboard ---------- */
async function leaderboard(n = 20) {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*, inventory_items(item_type,item_id), profile_achievements(achievement_id,unlocked_at), pass_claims(pass_type,level)")
      .order("rank_pts", { ascending: false })
      .order("wins", { ascending: false })
      .limit(n);
    if (error) throw new Error(error.message);
    return (data || []).map(row => publicProfile(rowToProfileShape(row)));
  } catch (e) {
    console.error("[db] leaderboard: error -", e.message);
    return [];
  }
}

module.exports = {
  CATALOG, TIERS, ACHIEVEMENTS, PASS_LEVELS, GALACTICO_PASS_LEVELS, REWARD_DEFINITIONS,
  register, login,
  resumeSession, invalidateSession,
  getProfileByName,
  buyItem, setActive, setAvatar,
  claimPass, claimGalacticoPass,
  reserveBet, creditCoins,
  resolveMatch,
  checkLive, // bugfix Fase 1: nunca estaba exportado — "logros en vivo" durante la partida no funcionaba nunca (silenciado por un try/catch vacío en reportLiveAchievements)
  leaderboard,
  levelFromXp, tierOf, galacticoLevelFromXp,
  grantRewards, claimGrantSlot, ensureMatchRow, recordMatchParticipants,
  dailyStatus, claimDailyReward,
  // Exportadas para tests de lógica pura (sin tocar Supabase) — ver scripts/test-daily-reward.mjs.
  uruguayDateStr, addDaysISO, countConsecutivePriorDays, pickDailyCoins, msUntilNextUruguayMidnight,
  towerStatus, claimTowerFloor, getPendingTowerRewards, acknowledgeTowerReward, TOWER_FLOOR_DIFFICULTY, TOWER_FLOOR_PRIZES, TOWER_COMPLETE_BONUS,
  // Exportadas para tests de lógica pura — ver scripts/test-tower.mjs.
  towerWeekId, computeCurrentFloor,
};
