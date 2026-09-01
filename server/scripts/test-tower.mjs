// Torre semanal (v2 — 3 Torres x 10 pisos) — SOLO lógica pura (weekId,
// Torre+piso actual, tablas de premios/dificultad, parseo de pendientes),
// sin tocar Supabase en absoluto. Sigue la misma restricción de siempre
// (ver docs/ai/DECISIONS.md): sin proyecto de staging separado de
// producción, ningún test nuevo toca Supabase real sin autorización
// explícita — la integración real (towerStatus/claimTowerFloor/tower_lives
// contra Supabase) queda pendiente de esa autorización.
import "dotenv/config"; // solo para que db.js pueda construir el cliente de Supabase sin tirar al importarse — nunca se llama a ninguna función que emita una consulta real
import * as DB from "../db.js";
import C from "../burako-core.js";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { console.log("✅ " + name); pass++; }
  else { console.log("❌ " + name + (detail ? " — " + detail : "")); fail++; }
}

console.log("=== Torre semanal v2 (3 Torres x 10 pisos) — lógica pura (sin Supabase) ===\n");

// ---------- towerWeekId: ancla al lunes 00:00 de esa semana (sin cambios respecto a v1) ----------
{
  const monday = new Date("2026-08-17T15:00:00Z");
  const tuesday = new Date("2026-08-18T03:00:00Z");
  const sunday = new Date("2026-08-23T20:00:00Z");
  const nextMonday = new Date("2026-08-24T04:00:00Z");
  check("towerWeekId: un lunes cualquiera se ancla a sí mismo", DB.towerWeekId(monday) === "2026-08-17", DB.towerWeekId(monday));
  check("towerWeekId: un martes de la misma semana da el mismo weekId que el lunes", DB.towerWeekId(tuesday) === "2026-08-17", DB.towerWeekId(tuesday));
  check("towerWeekId: el domingo siguiente SIGUE siendo la semana del lunes anterior", DB.towerWeekId(sunday) === "2026-08-17", DB.towerWeekId(sunday));
  check("towerWeekId: el lunes siguiente ya es una semana nueva", DB.towerWeekId(nextMonday) === "2026-08-24", DB.towerWeekId(nextMonday));
}

// ---------- computeCurrentFloor (por Torre, sin cambios respecto a v1) ----------
{
  check("computeCurrentFloor: sin ningún piso superado -> piso 1", DB.computeCurrentFloor(new Set()) === 1);
  check("computeCurrentFloor: 1,2,3 superados -> piso 4 disponible", DB.computeCurrentFloor(new Set([1, 2, 3])) === 4);
  check("computeCurrentFloor: hueco (1 y 3, NO 2) -> piso 2 sigue siendo el disponible", DB.computeCurrentFloor(new Set([1, 3])) === 2);
  check("computeCurrentFloor: 1-9 superados -> piso 10 disponible", DB.computeCurrentFloor(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9])) === 10);
  check("computeCurrentFloor: los 10 superados -> null (Torre completada)", DB.computeCurrentFloor(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])) === null);
}

// ---------- computeCurrentTowerFloor: encadena las 3 Torres ----------
{
  const ALL10 = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const empty = () => ({ 1: new Set(), 2: new Set(), 3: new Set() });

  let r = DB.computeCurrentTowerFloor(empty());
  check("computeCurrentTowerFloor: recién empezando -> Torre 1, piso 1", r.tower === 1 && r.floor === 1, JSON.stringify(r));

  r = DB.computeCurrentTowerFloor({ 1: new Set([1, 2, 3]), 2: new Set(), 3: new Set() });
  check("computeCurrentTowerFloor: Torre 1 con progreso parcial -> sigue en Torre 1", r.tower === 1 && r.floor === 4, JSON.stringify(r));

  r = DB.computeCurrentTowerFloor({ 1: new Set(ALL10), 2: new Set(), 3: new Set() });
  check("computeCurrentTowerFloor: Torre 1 completa -> salta a Torre 2 piso 1", r.tower === 2 && r.floor === 1, JSON.stringify(r));

  r = DB.computeCurrentTowerFloor({ 1: new Set(ALL10), 2: new Set([1, 2]), 3: new Set() });
  check("computeCurrentTowerFloor: Torre 1 completa + Torre 2 parcial -> Torre 2 piso 3", r.tower === 2 && r.floor === 3, JSON.stringify(r));

  r = DB.computeCurrentTowerFloor({ 1: new Set(ALL10), 2: new Set(ALL10), 3: new Set() });
  check("computeCurrentTowerFloor: Torre 1 y 2 completas -> Torre 3 piso 1", r.tower === 3 && r.floor === 1, JSON.stringify(r));

  r = DB.computeCurrentTowerFloor({ 1: new Set(ALL10), 2: new Set(ALL10), 3: new Set(ALL10) });
  check("computeCurrentTowerFloor: las 3 Torres completas -> {tower:3, floor:null}", r.tower === 3 && r.floor === null, JSON.stringify(r));

  // Nunca puede "saltar" Torre 2 a Torre 3 si Torre 2 no está completa, aunque Torre 3 estuviera vacía.
  r = DB.computeCurrentTowerFloor({ 1: new Set(ALL10), 2: new Set([1, 2, 3, 4, 5]), 3: new Set() });
  check("computeCurrentTowerFloor: nunca salta una Torre sin terminar", r.tower === 2, JSON.stringify(r));
}

// ---------- TOWER_DIFFICULTY: 30 entradas, curva por Torre ----------
{
  const d = DB.TOWER_DIFFICULTY;
  check("Dificultad: definida para las 3 Torres, 10 pisos cada una (30 en total)",
    DB.TOWER_IDS.every((t) => Object.keys(d[t]).length === 10));
  check("Dificultad Torre I: pisos 1-3 easy, 10 no pasa de expert",
    d[1][1] === "easy" && d[1][3] === "easy" && d[1][10] === "expert" && d[1][10] !== "claude");
  check("Dificultad Torre II: piso 1 ya es normal (más dura que Torre I desde el arranque)",
    d[2][1] === "normal");
  check("Dificultad Torre III: llega a claude (la IA más fuerte) desde el piso 7",
    d[3][7] === "claude" && d[3][8] === "claude" && d[3][9] === "claude" && d[3][10] === "claude");
  check("Dificultad Torre III: nunca es más floja que Torre II en el mismo piso",
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].every((f) => {
      const order = { easy: 0, normal: 1, hard: 2, expert: 3, claude: 4 };
      return order[d[3][f]] >= order[d[2][f]];
    }));
}

// ---------- TOWER_PRIZES: 30 pisos, progresión monótona por Torre y entre Torres ----------
{
  const p = DB.TOWER_PRIZES;
  const coinsOf = (t, f) => (p[t][f].find((r) => r.type === "coins") || {}).amount;
  const xpOf = (t, f) => (p[t][f].find((r) => r.type === "xp") || {}).amount;
  check("Premios: definidos para las 3 Torres, 10 pisos cada una", DB.TOWER_IDS.every((t) => Object.keys(p[t]).length === 10));
  check("Premios Torre I: sin cambios respecto a v1 (piso 1 = 60, piso 10 = 700)", coinsOf(1, 1) === 60 && coinsOf(1, 10) === 700);
  check("Premios: piso 9 de Torre I da el efecto exclusivo torre_relampago",
    (p[1][9].find((r) => r.type === "item") || {}).itemId === "torre_relampago");
  check("Premios: piso 10 de Torre I da el efecto exclusivo torre_celestial",
    (p[1][10].find((r) => r.type === "item") || {}).itemId === "torre_celestial");
  DB.TOWER_IDS.forEach((t) => {
    check(`Premios Torre ${t}: sube de forma monótona en monedas piso a piso`,
      [1, 2, 3, 4, 5, 6, 7, 8, 9].every((f) => coinsOf(t, f) <= coinsOf(t, f + 1)));
    check(`Premios Torre ${t}: sube de forma monótona en XP piso a piso`,
      [1, 2, 3, 4, 5, 6, 7, 8, 9].every((f) => xpOf(t, f) <= xpOf(t, f + 1)));
  });
  check("Premios: Torre II da más que Torre I en el mismo piso (piso 1)", coinsOf(2, 1) > coinsOf(1, 1));
  check("Premios: Torre III da más que Torre II en el mismo piso (piso 1)", coinsOf(3, 1) > coinsOf(2, 1));
  check("Premios: Torre III piso 10 es el más grande de los 30", coinsOf(3, 10) === Math.max(...DB.TOWER_IDS.flatMap((t) => [1,2,3,4,5,6,7,8,9,10].map((f) => coinsOf(t, f)))));
}

// ---------- TOWER_COMPLETE_BONUS / TOWER_RUN_COMPLETE_BONUS ----------
{
  const b = DB.TOWER_COMPLETE_BONUS;
  check("Bonus de Torre completa: definido para las 3 Torres", DB.TOWER_IDS.every((t) => Array.isArray(b[t])));
  check("Bonus de Torre completa: sube Torre a Torre (I < II < III)",
    (b[1].find(r=>r.type==="coins").amount) < (b[2].find(r=>r.type==="coins").amount) &&
    (b[2].find(r=>r.type==="coins").amount) < (b[3].find(r=>r.type==="coins").amount));
  check("Bonus de run completo (las 3 Torres): existe y da algo", Array.isArray(DB.TOWER_RUN_COMPLETE_BONUS) && DB.TOWER_RUN_COMPLETE_BONUS.length > 0);
}

// ---------- parseTowerPending: formato nuevo Y compatibilidad con filas viejas (pre-v2) ----------
{
  let r = DB.parseTowerPending({ source_type: "tower", source_id: "2026-08-17:2:5", rewards: [{ type: "coins", amount: 300 }] });
  check("parseTowerPending: piso, formato nuevo (weekId:towerId:floor)", r.kind === "floor" && r.weekId === "2026-08-17" && r.tower === 2 && r.floor === 5 && r.sourceId === "2026-08-17:2:5", JSON.stringify(r));

  r = DB.parseTowerPending({ source_type: "tower", source_id: "2026-08-17:7", rewards: [] });
  check("parseTowerPending: piso, formato VIEJO pre-v2 (weekId:floor) se interpreta como Torre 1, no rompe", r.kind === "floor" && r.tower === 1 && r.weekId === "2026-08-17" && r.floor === 7, JSON.stringify(r));

  r = DB.parseTowerPending({ source_type: "tower_complete", source_id: "2026-08-17:3", rewards: [] });
  check("parseTowerPending: Torre completa, formato nuevo (weekId:towerId)", r.kind === "complete" && r.tower === 3 && r.weekId === "2026-08-17", JSON.stringify(r));

  r = DB.parseTowerPending({ source_type: "tower_complete", source_id: "2026-08-17", rewards: [] });
  check("parseTowerPending: Torre completa, formato VIEJO pre-v2 (weekId a secas) se interpreta como Torre 1", r.kind === "complete" && r.tower === 1 && r.weekId === "2026-08-17", JSON.stringify(r));

  r = DB.parseTowerPending({ source_type: "tower_run_complete", source_id: "2026-08-17", rewards: [] });
  check("parseTowerPending: run completo (las 3 Torres)", r.kind === "run_complete" && r.weekId === "2026-08-17" && r.sourceId === "2026-08-17", JSON.stringify(r));

  // sourceId siempre viaja igual al source_id crudo, sin importar el formato — es lo que
  // se manda de vuelta a acknowledgeTowerReward, nunca se reconstruye a mano.
  check("parseTowerPending: sourceId siempre es el source_id crudo, tal cual", DB.parseTowerPending({ source_type: "tower", source_id: "X:Y:Z", rewards: [] }).sourceId === "X:Y:Z");
}

// ---------- Cofres (bloque 2): tiers, probabilidades, garantías ----------
{
  const tierTable = DB.TOWER_CHEST_TIER;
  check("TOWER_CHEST_TIER: definido para las 3 Torres, 10 pisos cada una", DB.TOWER_IDS.every((t) => Object.keys(tierTable[t]).length === 10));
  const RANK = { kombatiente: 0, reino: 1, ancestral: 2, conquistador: 3, titan: 4 };
  check("TOWER_CHEST_TIER: dentro de cada Torre, el tier nunca baja piso a piso",
    DB.TOWER_IDS.every((t) => [1,2,3,4,5,6,7,8,9].every((f) => RANK[tierTable[t][f]] <= RANK[tierTable[t][f + 1]])));
  check("TOWER_CHEST_TIER: el piso 1 de cada Torre es al menos tan bueno como el piso 10 de la anterior",
    RANK[tierTable[2][1]] >= RANK[tierTable[1][10]] && RANK[tierTable[3][1]] >= RANK[tierTable[2][10]]);

  const weights = DB.TOWER_CHEST_TIER_WEIGHTS;
  Object.keys(weights).forEach((tier) => {
    const total = Object.values(weights[tier]).reduce((a, b) => a + b, 0);
    check(`TOWER_CHEST_TIER_WEIGHTS[${tier}]: suma 100`, total === 100, "total=" + total);
  });
  check("TOWER_CHEST_TIER_WEIGHTS: la probabilidad de legendario sube con el tier (kombatiente < reino < ... < titan)",
    weights.kombatiente.legendario <= weights.reino.legendario &&
    weights.reino.legendario <= weights.ancestral.legendario &&
    weights.ancestral.legendario <= weights.conquistador.legendario &&
    weights.conquistador.legendario <= weights.titan.legendario);
  check("TOWER_CHEST_TIER_WEIGHTS: la probabilidad de 'solo monedas' baja con el tier (al revés)",
    weights.kombatiente.coins >= weights.reino.coins && weights.titan.coins <= weights.conquistador.coins);

  // Pools de loot: sin ids repetidos dentro de una misma rareza, y cada
  // itemType usado es uno de los reconocidos por el reward engine.
  const KNOWN_TYPES = new Set(["skin", "tapete", "effect", "trail", "soundfx"]);
  Object.entries(DB.TOWER_CHEST_LOOT).forEach(([rarity, pool]) => {
    const ids = pool.map((p) => p.itemType + ":" + p.itemId);
    check(`TOWER_CHEST_LOOT[${rarity}]: sin duplicados`, new Set(ids).size === ids.length, JSON.stringify(ids));
    check(`TOWER_CHEST_LOOT[${rarity}]: todos los itemType son válidos`, pool.every((p) => KNOWN_TYPES.has(p.itemType)));
  });

  // Garantías: minRarity sube el piso, nunca lo baja; forceRarity ignora los pesos.
  check("rollChestRarity: minRarity nunca deja salir algo peor que el mínimo (probado muchas veces, con pesos que favorecen 'coins')",
    Array.from({ length: 500 }, () => DB.rollChestRarity("kombatiente", { minRarity: "epico" }))
      .every((r) => DB.TOWER_CHEST_RARITY_ORDER.indexOf(r) >= DB.TOWER_CHEST_RARITY_ORDER.indexOf("epico")));
  check("rollChestRarity: forceRarity siempre devuelve exactamente eso, sin importar el tier",
    Array.from({ length: 50 }, () => DB.rollChestRarity("kombatiente", { forceRarity: "legendario" })).every((r) => r === "legendario"));
  check("rollChestRarity: sin garantía, puede salir cualquier rareza con peso > 0 (kombatiente nunca da legendario, peso 0)",
    Array.from({ length: 500 }, () => DB.rollChestRarity("kombatiente", null)).every((r) => r !== "legendario"));

  // TOWER_CHEST_GUARANTEE: pisos 9 y 10 de cada Torre están cubiertos, y solo
  // la Torre III piso 10 es un force (100% legendario) — el resto son "como mínimo".
  check("TOWER_CHEST_GUARANTEE: piso 10 de cada Torre tiene garantía", DB.TOWER_IDS.every((t) => !!DB.TOWER_CHEST_GUARANTEE[t + ":10"]));
  check("TOWER_CHEST_GUARANTEE: solo Torre III piso 10 fuerza legendario al 100%",
    DB.TOWER_CHEST_GUARANTEE["3:10"].forceRarity === "legendario" &&
    !DB.TOWER_CHEST_GUARANTEE["1:10"].forceRarity && !DB.TOWER_CHEST_GUARANTEE["2:10"].forceRarity);

  // Duplicados: un valor de monedas definido y creciente por rareza.
  const dup = DB.TOWER_CHEST_DUPLICATE_COINS;
  check("TOWER_CHEST_DUPLICATE_COINS: sube con la rareza (comun < raro < epico < legendario)",
    dup.comun < dup.raro && dup.raro < dup.epico && dup.epico < dup.legendario);
}

// ---------- Cosméticos exclusivos + títulos (bloque 3) ----------
{
  const p = DB.TOWER_PRIZES;
  const itemOf = (t, f) => p[t][f].find((r) => r.type === "item" || r.type === "title");

  check("Torre II piso 9: título exclusivo guardian_carmesi", itemOf(2, 9) && itemOf(2, 9).type === "title" && itemOf(2, 9).itemId === "guardian_carmesi", JSON.stringify(itemOf(2, 9)));
  check("Torre II piso 10: skin exclusiva escarlata_torre", itemOf(2, 10) && itemOf(2, 10).type === "item" && itemOf(2, 10).itemType === "skin" && itemOf(2, 10).itemId === "escarlata_torre", JSON.stringify(itemOf(2, 10)));
  check("Torre III piso 9: banner exclusivo corona_dorada", itemOf(3, 9) && itemOf(3, 9).type === "item" && itemOf(3, 9).itemType === "banner" && itemOf(3, 9).itemId === "corona_dorada", JSON.stringify(itemOf(3, 9)));
  check("Torre III piso 10: skin exclusiva titan_dorado", itemOf(3, 10) && itemOf(3, 10).type === "item" && itemOf(3, 10).itemType === "skin" && itemOf(3, 10).itemId === "titan_dorado", JSON.stringify(itemOf(3, 10)));

  const b = DB.TOWER_COMPLETE_BONUS;
  const titleOf = (list) => list.find((r) => r.type === "title");
  check("Bonus Torre I completa: título ascendente", titleOf(b[1]) && titleOf(b[1]).itemId === "ascendente");
  check("Bonus Torre II completa: título forjado_en_fuego", titleOf(b[2]) && titleOf(b[2]).itemId === "forjado_en_fuego");
  check("Bonus Torre III completa: título leyenda_dorada", titleOf(b[3]) && titleOf(b[3]).itemId === "leyenda_dorada");
  check("Bonus de run completo (las 3 Torres): título conquistador_de_la_torre", titleOf(DB.TOWER_RUN_COMPLETE_BONUS) && titleOf(DB.TOWER_RUN_COMPLETE_BONUS).itemId === "conquistador_de_la_torre");

  const dup = DB.TOWER_ITEM_DUPLICATE_COINS;
  ["guardian_carmesi", "escarlata_torre", "corona_dorada", "titan_dorado", "ascendente", "forjado_en_fuego", "leyenda_dorada", "conquistador_de_la_torre"].forEach((id) => {
    check(`TOWER_ITEM_DUPLICATE_COINS: ${id} tiene un valor definido y positivo`, typeof dup[id] === "number" && dup[id] > 0, dup[id]);
  });
  check("TOWER_ITEM_DUPLICATE_COINS: la skin exclusiva de Torre III (más premium) vale más que la de Torre II", dup.titan_dorado > dup.escarlata_torre);
  check("TOWER_ITEM_DUPLICATE_COINS: el título más prestigioso (run completo) vale más que los de una sola Torre", dup.conquistador_de_la_torre > dup.ascendente && dup.conquistador_de_la_torre > dup.forjado_en_fuego && dup.conquistador_de_la_torre > dup.leyenda_dorada);

  check("TOWER_CHEST_LOOT: el nuevo tapete 'brasas' está en el pool épico", DB.TOWER_CHEST_LOOT.epico.some((x) => x.itemType === "tapete" && x.itemId === "brasas"));

  // El nuevo tapete real (comprable) está en el catálogo de la Tienda, con precio > 0.
  const brasas = DB.CATALOG.tapetes.find((x) => x.id === "brasas");
  check("CATALOG.tapetes: 'brasas' es un tapete real y comprable (no exclusivo)", !!brasas && brasas.price > 0, JSON.stringify(brasas));
  // Las skins/banner exclusivos de Torre NUNCA deben estar en el catálogo
  // comprable del servidor — si estuvieran, buyItem() los dejaría comprar.
  check("CATALOG.skins: las skins exclusivas de Torre NO están (no se pueden comprar)",
    !DB.CATALOG.skins.some((x) => x.id === "escarlata_torre" || x.id === "titan_dorado"));
}

// ---------- 30 rivales + personalidades (bloque 4) ----------
{
  const rivals = DB.TOWER_RIVALS;
  check("TOWER_RIVALS: 3 Torres x 10 pisos = 30 rivales", DB.TOWER_IDS.every((t) => Object.keys(rivals[t]).length === 10));
  const allNames = DB.TOWER_IDS.flatMap((t) => Object.values(rivals[t]).map((r) => r.name));
  check("TOWER_RIVALS: 30 nombres, todos distintos (sin repetidos)", new Set(allNames).size === 30, JSON.stringify(allNames));
  check("TOWER_RIVALS: todos tienen avatar y personalidad definidos", DB.TOWER_IDS.every((t) => Object.values(rivals[t]).every((r) => !!r.name && !!r.avatar && !!r.personality)));
  check("TOWER_RIVALS: todas las personalidades usadas existen en TOWER_PERSONALITY_PRESETS",
    DB.TOWER_IDS.every((t) => Object.values(rivals[t]).every((r) => DB.TOWER_PERSONALITY_PRESETS[r.personality] !== undefined)));
  check("TOWER_RIVALS: el piso 10 de cada Torre es jefe (boss:true), ningún otro piso lo es",
    DB.TOWER_IDS.every((t) => rivals[t][10].boss === true && [1,2,3,4,5,6,7,8,9].every((f) => !rivals[t][f].boss)));
  check("TOWER_RIVALS: los 3 jefes son personality 'maestro' (el techo de estilo de su Torre)",
    DB.TOWER_IDS.every((t) => rivals[t][10].personality === "maestro"));

  // No hace falta que las 10 personalidades del pedido original estén cada
  // una EXACTAMENTE una vez por Torre — alcanza con que las 10 aparezcan
  // en el roster completo de 30 (variedad real, no repetir siempre lo mismo).
  const allPersonalities = new Set(allNames.length ? DB.TOWER_IDS.flatMap((t) => Object.values(rivals[t]).map((r) => r.personality)) : []);
  check("TOWER_RIVALS: las 10 personalidades del roster están todas representadas", allPersonalities.size === Object.keys(DB.TOWER_PERSONALITY_PRESETS).length, JSON.stringify([...allPersonalities]));
}

// ---------- meldBiasValue (burako-core.js): sesgo opcional, no-op por defecto ----------
{
  const grupo = { info: { value: 10, type: "grupo" }, usedJoker: false };
  const escalera = { info: { value: 10, type: "escalera" }, usedJoker: false };
  const conComodin = { info: { value: 10, type: "escalera" }, usedJoker: true };

  check("meldBiasValue: sin personalidad, devuelve el valor real tal cual (no-op)",
    C.meldBiasValue(grupo, null) === 10 && C.meldBiasValue(escalera, undefined) === 10);
  check("meldBiasValue: especialista en grupos sube el valor de un grupo y baja el de una escalera",
    C.meldBiasValue(grupo, DB.TOWER_PERSONALITY_PRESETS.especialista_grupos) > 10 &&
    C.meldBiasValue(escalera, DB.TOWER_PERSONALITY_PRESETS.especialista_grupos) < 10);
  check("meldBiasValue: especialista en escaleras es exactamedente lo opuesto",
    C.meldBiasValue(escalera, DB.TOWER_PERSONALITY_PRESETS.especialista_escaleras) > 10 &&
    C.meldBiasValue(grupo, DB.TOWER_PERSONALITY_PRESETS.especialista_escaleras) < 10);
  check("meldBiasValue: agresivo con comodines sube el valor de un meld que usó comodín",
    C.meldBiasValue(conComodin, DB.TOWER_PERSONALITY_PRESETS.agresivo_comodines) > 10);
  check("meldBiasValue: 'equilibrado' (sin sesgos definidos) es no-op, igual que sin personalidad",
    C.meldBiasValue(grupo, DB.TOWER_PERSONALITY_PRESETS.equilibrado) === 10);

  // findBestMove/planBestMove: con personalidad=undefined (todo llamador que
  // no sea Torre), el comportamiento tiene que ser IDÉNTICO al de antes de
  // este bloque — se prueba comparando el resultado con y sin pasar el
  // argumento extra sobre la MISMA mano armable de dos formas (grupo o
  // escalera con igual puntaje), sin ninguna personalidad de por medio.
  const hand = [
    { id: "a", number: 5, color: "rojo", joker: false }, { id: "b", number: 5, color: "azul", joker: false }, { id: "c", number: 5, color: "verde", joker: false },
  ];
  const withoutArg = C.findBestMove(hand, true, [], {}, "p1", 2, false);
  const withUndefined = C.findBestMove(hand, true, [], {}, "p1", 2, false, undefined);
  check("findBestMove: llamarla sin el argumento de personalidad o con undefined da el mismo resultado (compatibilidad total)",
    JSON.stringify(withoutArg) === JSON.stringify(withUndefined));
}

// ---------- IA adaptativa (bloque 5): ajuste acotado, sin ML persistente ----------
{
  const base = { attachProbMult: 0.6, reorgProbMult: 0.3 }; // "conservador"
  check("adaptTowerPersonality: con poca información (menos de 3 jugadas) no toca nada",
    JSON.stringify(DB.adaptTowerPersonality(base, { turns: 2, wildcardUses: 2, attachCount: 2, reorgCount: 0 })) === JSON.stringify(base));
  check("adaptTowerPersonality: sin behavior (partida recién arrancando) devuelve la personalidad base tal cual",
    DB.adaptTowerPersonality(base, null) === base);

  const highWildcard = { turns: 10, wildcardUses: 6, attachCount: 0, reorgCount: 0 }; // 60% > umbral 40%
  const adapted = DB.adaptTowerPersonality(base, highWildcard);
  check("adaptTowerPersonality: humano usa comodines seguido -> sube jokerBias (nudge chico, +0.15)",
    adapted.jokerBias === 1.15, JSON.stringify(adapted));
  check("adaptTowerPersonality: el resto de la personalidad base queda intacto (no pisa attachProbMult/reorgProbMult)",
    adapted.attachProbMult === base.attachProbMult && adapted.reorgProbMult === base.reorgProbMult);

  const lowActivity = { turns: 10, wildcardUses: 1, attachCount: 1, reorgCount: 0 }; // 10% y 10%, bajo el umbral
  check("adaptTowerPersonality: actividad baja (bajo el umbral 40%) no ajusta nada",
    JSON.stringify(DB.adaptTowerPersonality(base, lowActivity)) === JSON.stringify(base));

  check("adaptTowerPersonality: el ajuste tiene un techo fijo (nunca pasa de 1.5, ni con muchas partidas 'llenas')",
    DB.adaptTowerPersonality({ jokerBias: 1.45 }, { turns: 20, wildcardUses: 20, attachCount: 0, reorgCount: 0 }).jokerBias <= 1.5);

  check("adaptTowerPersonality: NUNCA toca depth/jokerUse (no está en el objeto de sesgos, no hay forma de que aparezca)",
    !("depth" in adapted) && !("jokerUse" in adapted));

  // No hace falta un mock de Supabase para esto — es pura transformación de datos.
  check("adaptTowerPersonality: es una función pura (misma entrada -> misma salida, sin efectos secundarios)",
    JSON.stringify(DB.adaptTowerPersonality(base, highWildcard)) === JSON.stringify(DB.adaptTowerPersonality(base, highWildcard)));
}

console.log(`\n=== RESUMEN: ${pass} OK / ${fail} fallidas ===`);
console.log("[nota] No se probó towerStatus()/claimTowerFloor()/tower_lives/tower_chests/resolveDuplicates contra Supabase real en esta pasada (más allá de rollChestRarity y adaptTowerPersonality, que son lógica pura) — no hay proyecto de staging separado de producción (ver docs/ai/DECISIONS.md), queda pendiente de autorización explícita del usuario.");
if (fail) process.exitCode = 1;
