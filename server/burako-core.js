/* ============================================================
   BURAKO CORE — reglas puras del juego, compartidas por
   el servidor (Node) y el cliente (navegador).
   No toca el DOM ni nada de UI: solo datos y validación.
   ============================================================ */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(); // Node (server.js hace require)
  } else {
    root.BurakoCore = factory(); // navegador (<script> lo cuelga en window)
  }
})(typeof self !== "undefined" ? self : this, function () {
  const COLOR_KEYS = ["rojo", "azul", "verde", "amarillo"];

  let __id = 0;
  function nid(p) {
    return p + "_" + ++__id + "_" + Math.random().toString(36).slice(2, 8);
  }

  function makeDeck() {
    const d = [];
    for (let s = 0; s < 2; s++)
      for (const c of COLOR_KEYS)
        for (let n = 1; n <= 13; n++)
          d.push({ id: nid("t"), color: c, number: n, joker: false });
    for (let j = 0; j < 4; j++)
      d.push({ id: nid("j"), color: "comodin", number: null, joker: true });
    return d;
  }

  /* ---------- Modo Galáctico: fichas de habilidad ----------
     Una ficha de habilidad NUNCA participa de meldInfo/sortMeldTiles/handPoints —
     hay que separarla de la mano con splitHand() antes de armar/validar una jugada. */
  const ABILITIES = ["robo", "intercambio", "robo_dirigido", "escudo", "comodin",
    "robo_doble", "bloqueo", "vision", "teletransporte", "atraccion"];
  function makeAbilityTiles() {
    const out = [];
    for (const a of ABILITIES) {
      for (let i = 0; i < 2; i++) out.push({ id: nid("ab"), ability: a, color: null, number: null, joker: false });
    }
    return out;
  }
  function splitHand(hand) {
    const tiles = [], abilities = [];
    (hand || []).forEach((t) => { if (t.ability) abilities.push(t); else tiles.push(t); });
    return { tiles, abilities };
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Evalúa si un conjunto de fichas forma un juego válido (grupo o escalera)
  function meldInfo(tiles) {
    if (!tiles || tiles.length < 3) return { valid: false };
    const jokers = tiles.filter((t) => t.joker);
    const normals = tiles.filter((t) => !t.joker);
    if (normals.length === 0) return { valid: false };
    // Cualquier juego necesita al menos 2 fichas reales — con 1 sola ficha real,
    // "colorsSet.size===1" es trivialmente cierto y el resto de comodines podía
    // colarse como grupo O como escalera armando cualquier secuencia con un único
    // punto de referencia real (nunca fue una regla real de Burako).
    if (normals.length < 2) return { valid: false };

    const numsSet = new Set(normals.map((t) => t.number));
    const colorsSet = new Set(normals.map((t) => t.color));
    if (numsSet.size === 1 && colorsSet.size === normals.length && tiles.length <= 4) {
      const num = normals[0].number;
      return { valid: true, type: "grupo", value: num * tiles.length, number: num };
    }

    if (colorsSet.size === 1) {
      const nums = normals.map((t) => t.number);
      if (new Set(nums).size !== nums.length) return { valid: false };
      const minN = Math.min(...nums), maxN = Math.max(...nums);
      const span = maxN - minN + 1;
      if (span > tiles.length) return { valid: false };
      const gaps = span - normals.length;
      if (gaps > jokers.length) return { valid: false };
      let rem = jokers.length - gaps, lo = minN, hi = maxN;
      while (rem > 0) {
        if (hi < 13) { hi++; rem--; }
        else if (lo > 1) { lo--; rem--; }
        else return { valid: false };
      }
      if (hi - lo + 1 !== tiles.length) return { valid: false };
      let value = 0;
      for (let n = lo; n <= hi; n++) value += n;
      return { valid: true, type: "escalera", value, color: normals[0].color };
    }
    return { valid: false };
  }

  function sortMeldTiles(tiles) {
    const info = meldInfo(tiles);
    const jokers = tiles.filter((t) => t.joker);
    const normals = tiles.filter((t) => !t.joker);
    if (info.valid && info.type === "grupo") {
      const s = normals.slice().sort((a, b) => COLOR_KEYS.indexOf(a.color) - COLOR_KEYS.indexOf(b.color));
      return [...s, ...jokers];
    }
    if (info.valid && info.type === "escalera") {
      const arr = normals.map((t) => t.number);
      const mn = Math.min(...arr), mx = Math.max(...arr), span = mx - mn + 1;
      let rem = jokers.length - (span - normals.length), lo = mn, hi = mx;
      while (rem > 0) { if (hi < 13) { hi++; rem--; } else { lo--; rem--; } }
      const byNum = {}; normals.forEach((t) => (byNum[t.number] = t));
      const out = []; let ji = 0;
      for (let n = lo; n <= hi; n++) out.push(byNum[n] || jokers[ji++]);
      return out;
    }
    const s = normals.slice().sort((a, b) => a.number - b.number || COLOR_KEYS.indexOf(a.color) - COLOR_KEYS.indexOf(b.color));
    return [...s, ...jokers];
  }

  function tilePoints(t) {
    return t.joker ? 25 : t.number;
  }
  function handPoints(hand) {
    return hand.reduce((s, t) => s + tilePoints(t), 0);
  }

  /* ============================================================
     MOTOR DE IA — dificultades easy / normal / hard / expert.
     Compartido por el servidor (bots online) y el cliente (IA
     offline, nivel "Extremo") para que ambos jueguen exactamente
     igual de fuerte en el nivel más alto.
     ============================================================ */
  const AI_CONFIG = {
    easy:   { depth: 1, delay: [2000, 3000], attachProb: 0.3, jokerUse: false },
    normal: { depth: 2, delay: [1200, 2000], attachProb: 0.6, jokerUse: false },
    hard:   { depth: 3, delay: [800,  1400], attachProb: 0.9, jokerUse: true  },
    expert: { depth: 4, delay: [500,  900],  attachProb: 1.0, jokerUse: true  },
    // IA-Claude: la más fuerte de todas — mismo motor que "expert" pero con más
    // profundidad de búsqueda y, a diferencia del resto, SIEMPRE evalúa si
    // cambiar un comodín suelto de la mesa (ver findJokerSwap/planBestMove)
    // le arma una jugada mejor antes de decidir. Es una marca/dificultad
    // aparte, no una versión más del resto.
    claude: { depth: 5, delay: [350, 650],   attachProb: 1.0, jokerUse: true  },
  };

  // Enumerar todos los juegos válidos que se pueden armar con una mano
  function enumerateMelds(hand, jokers, useJokers) {
    const melds = [];
    // Grupos: mismo número, distinto color
    const byNum = {};
    hand.forEach((t) => { byNum[t.number] = byNum[t.number] || {}; byNum[t.number][t.color] = t; });
    for (const n in byNum) {
      const tiles = Object.values(byNum[n]);
      for (let a = 0; a < tiles.length; a++) for (let b = a + 1; b < tiles.length; b++) for (let cc = b + 1; cc < tiles.length; cc++) {
        const s = [tiles[a], tiles[b], tiles[cc]];
        if (new Set(s.map((t) => t.color)).size === s.length) { const i = meldInfo(s); if (i.valid) melds.push({ tiles: s, info: i }); }
        if (tiles[cc + 1]) {
          const s4 = [tiles[a], tiles[b], tiles[cc], tiles[cc + 1]];
          if (new Set(s4.map((t) => t.color)).size === s4.length) { const i = meldInfo(s4); if (i.valid) melds.push({ tiles: s4, info: i }); }
        }
      }
    }
    // Escaleras: mismo color, consecutivos
    const byColor = {};
    hand.forEach((t) => { byColor[t.color] = byColor[t.color] || []; byColor[t.color].push(t); });
    for (const c in byColor) {
      const sorted = byColor[c].slice().sort((a, b) => a.number - b.number);
      for (let i = 0; i < sorted.length - 2; i++) {
        for (let len = 3; len <= sorted.length - i; len++) {
          const run = sorted.slice(i, i + len);
          let ok = true; for (let k = 1; k < run.length; k++) if (run[k].number !== run[k - 1].number + 1) { ok = false; break; }
          if (ok) { const info = meldInfo(run); if (info.valid) melds.push({ tiles: run, info }); }
        }
      }
    }
    // Con comodines (solo si useJokers)
    if (useJokers && jokers.length > 0) {
      for (const c in byColor) {
        const sorted = byColor[c].slice().sort((a, b) => a.number - b.number);
        for (let i = 0; i < sorted.length - 1; i++) {
          for (let len = 3; len <= sorted.length - i + 1; len++) {
            const raw = sorted.slice(i, i + len - 1);
            const withJoker = [...raw, { ...jokers[0], number: raw[raw.length - 1].number + 1, color: c }];
            const ws = withJoker.slice().sort((a, b) => a.number - b.number);
            let ok = true; for (let k = 1; k < ws.length; k++) if (ws[k].number !== ws[k - 1].number + 1) { ok = false; break; }
            if (ok) { const info = meldInfo(ws); if (info.valid) melds.push({ tiles: ws, info, usedJoker: true }); }
          }
        }
      }
    }
    return melds;
  }

  // Evaluar la "calidad" de un estado de mano (heurística, para IA con lookahead)
  function evaluateHand(hand, hasLaid, scores, playerId) {
    const handPts = handPoints(hand);
    const score = scores[playerId] || 0;
    return score * 2 - handPts - hand.length * 3;
  }

  // Buscar el mejor movimiento posible, considerando combinaciones de varios juegos
  function findBestMove(hand, hasLaid, table, scores, playerId, depth, useJokers) {
    const jokers = hand.filter((t) => t.joker);
    const nonJokers = hand.filter((t) => !t.joker);
    const melds = enumerateMelds(nonJokers, jokers, useJokers);

    const eligible = hasLaid ? melds : melds.filter((m) => m.info.value >= 30);
    if (!eligible.length) return null;

    if (depth <= 1) {
      return eligible.sort((a, b) => b.info.value - a.info.value)[0];
    }

    let bestCombo = null;
    let bestValue = -1;
    const tryCombo = (remaining, usedIds, combo, totalVal) => {
      if (combo.length > 0 && totalVal > bestValue) {
        bestValue = totalVal;
        bestCombo = combo.slice();
      }
      if (combo.length >= Math.min(depth, 4)) return;
      const remMelds = enumerateMelds(remaining.filter((t) => !t.joker), jokers, useJokers)
        .filter((m) => !m.tiles.some((t) => usedIds.has(t.id)))
        .filter((m) => hasLaid || combo.length > 0 || m.info.value >= 30);
      for (const m of remMelds.slice(0, 8)) {
        const newIds = new Set(usedIds);
        m.tiles.forEach((t) => newIds.add(t.id));
        const newRem = remaining.filter((t) => !newIds.has(t.id));
        tryCombo(newRem, newIds, [...combo, m], totalVal + m.info.value);
      }
    };
    tryCombo(hand, new Set(), [], 0);
    return bestCombo && bestCombo.length > 0 ? bestCombo[0] : eligible.sort((a, b) => b.info.value - a.info.value)[0];
  }

  // Buscar la MEJOR ficha para pegar a un juego ya bajado en la mesa — evalúa
  // TODAS las combinaciones válidas (meld, ficha) y se queda con la de mayor
  // valor de ficha (bajar puntos es la prioridad: cuanto más alta la ficha que
  // te sacás de encima, mejor), no la primera que encuentra.
  function findBestAttach(hand, table) {
    let best = null, bestVal = -1;
    for (const meld of table) {
      for (const tile of hand) {
        if (tile.joker) continue;
        const extended = [...meld.tiles, tile];
        const info = meldInfo(extended);
        if (info.valid) {
          const val = tilePoints(tile);
          if (val > bestVal) { bestVal = val; best = { meld, tile }; }
        }
      }
    }
    return best;
  }

  // Busca un conjunto de juegos válidos armados con "pool" que entre TODOS
  // cubran por completo las fichas de mustCoverIds (ninguna puede quedar sin
  // usar — mismo requisito que exige el server en handleReorganize para
  // aceptar una reorganización humana). Puede sumar de más fichas del resto
  // del pool si eso arma un juego válido. Devuelve la solución que MÁS fichas
  // extra usa (o null si no hay ninguna forma de cubrir todo). Tiene un tope
  // de nodos explorados para nunca colgar el servidor con una mesa rara.
  function solveCoveringMelds(pool, mustCoverIds, useJokers) {
    const jokers = pool.filter((t) => t.joker);
    const nonJokers = pool.filter((t) => !t.joker);
    const allMelds = enumerateMelds(nonJokers, jokers, useJokers)
      .filter((m) => m.tiles.some((t) => mustCoverIds.has(t.id))); // solo candidatos que aportan
    if (!allMelds.length) return null;

    let best = null;
    let nodes = 0;
    const NODE_LIMIT = 4000;
    const tryFrom = (remainingCover, usedIds, chosen, extraUsed) => {
      if (nodes++ > NODE_LIMIT) return;
      if (remainingCover.size === 0) {
        if (!best || extraUsed.length > best.extraUsed.length) {
          best = { melds: chosen.slice(), extraUsed: extraUsed.slice() };
        }
        return;
      }
      if (chosen.length >= 4) return; // profundidad razonable: no hace falta más para una mesa típica
      for (const m of allMelds) {
        if (m.tiles.some((t) => usedIds.has(t.id))) continue; // ficha ya comprometida en otro juego elegido
        if (!m.tiles.some((t) => remainingCover.has(t.id))) continue; // no aporta nada nuevo, no vale la pena
        const newUsed = new Set(usedIds);
        m.tiles.forEach((t) => newUsed.add(t.id));
        const newCover = new Set(remainingCover);
        m.tiles.forEach((t) => newCover.delete(t.id));
        const newExtra = extraUsed.concat(m.tiles.filter((t) => !mustCoverIds.has(t.id)));
        tryFrom(newCover, newUsed, chosen.concat([m]), newExtra);
      }
    };
    tryFrom(new Set(mustCoverIds), new Set(), [], []);
    return best;
  }

  // Reorganizar la mesa: abrir UN juego ya bajado (propio o de un rival — mismo
  // criterio que ya usa handleReorganize/openMeld para jugadores humanos: sin
  // restricción de dueño, solo el costo de ruptura si tiene comodín) y volver
  // a armar sus fichas junto con fichas de la mano en uno o más juegos válidos,
  // reutilizando el 100% de lo que se abrió — igual que le exige el server a un
  // humano ("Hay fichas de la mesa que quedaron sin usar. Tenés que rearmar
  // todo."). Recorre TODOS los juegos de la mesa (no se detiene en el primero)
  // y se queda con el que le permite sacarse MÁS fichas de la mano de encima;
  // descarta cualquier reorganización que no sume ninguna ficha de mano (sería
  // gastar el turno sin ganar nada). Devuelve null si ninguna sirve.
  function findBestReorg(hand, table, jokerBreaksLeft, useJokers) {
    if (!useJokers) return null;
    let best = null;
    for (const meld of table) {
      const hasJoker = meld.tiles.some((t) => t.joker);
      if (hasJoker && jokerBreaksLeft <= 0) continue; // sin rupturas disponibles, no se puede tocar
      const openedTiles = meld.tiles;
      const mustCoverIds = new Set(openedTiles.map((t) => t.id));
      const pool = [...openedTiles, ...hand];
      const sol = solveCoveringMelds(pool, mustCoverIds, useJokers);
      if (!sol) continue;
      const handTiles = sol.extraUsed; // fichas del pool que NO eran de la mesa == vinieron de la mano
      if (!handTiles.length) continue; // reorganizar sin sumar ninguna ficha de mano no sirve de nada
      const value = handTiles.reduce((s, t) => s + tilePoints(t), 0);
      if (!best || handTiles.length > best.handTiles.length ||
          (handTiles.length === best.handTiles.length && value > best.value)) {
        best = { meldId: meld.id, newMelds: sol.melds.map((m) => ({ tiles: m.tiles, info: m.info })), handTiles, value };
      }
    }
    return best;
  }

  // Comodín "cambiable": UN juego de la mesa con EXACTAMENTE un comodín, donde
  // el jugador tiene en mano la ficha real exacta que puede ocupar su lugar sin
  // romper la validez del juego. A diferencia de "abrir un juego" (que saca TODO
  // a Preparación para rearmar libre, y cuesta una de las rupturas limitadas),
  // esto es un intercambio 1x1 siempre legal — nunca rompe nada, así que no
  // consume ningún recurso limitado del juego.
  //
  // findAllJokerSwaps mira TODOS los juegos de la mesa (no se detiene en el
  // primero que encuentra) y devuelve un candidato de cambio por cada uno que
  // tenga uno posible — así planBestMove puede comparar entre ellos y elegir
  // el que arme la mejor jugada, sin importar si hay 1, 2, 3 o más juegos.
  function findAllJokerSwaps(hand, table) {
    const results = [];
    for (const meld of table) {
      const jokers = meld.tiles.filter((t) => t.joker);
      if (jokers.length !== 1) continue; // simple y seguro: solo juegos con UN comodín
      const joker = jokers[0];
      const others = meld.tiles.filter((t) => t !== joker);
      for (const cand of hand) {
        if (cand.joker) continue;
        const trial = [...others, cand];
        const info = meldInfo(trial);
        if (info.valid && trial.length === meld.tiles.length) {
          results.push({ meld, jokerTile: joker, realTile: cand });
          break; // un candidato por juego alcanza para compararlo con los demás
        }
      }
    }
    return results;
  }
  // Compatibilidad: un solo resultado (el primero que encuentre), para uso puntual.
  function findJokerSwap(hand, table) {
    const all = findAllJokerSwaps(hand, table);
    return all.length ? all[0] : null;
  }

  // Como findBestMove, pero primero mira TODOS los juegos de la mesa que tengan
  // un comodín cambiable y evalúa, para cada uno, si cambiarlo arma una jugada
  // mejor que sin tocar nada — se queda con el MEJOR de todos los candidatos
  // (no con el primero que encuentra), sin importar cuántos juegos haya en la
  // mesa. Quien llama a esto es responsable de aplicar swap.meld/jokerTile/
  // realTile al estado real (mesa + mano) si vino un swap — esta función solo
  // decide, no muta nada.
  function planBestMove(hand, hasLaid, table, scores, playerId, depth, useJokers) {
    const baseline = findBestMove(hand, hasLaid, table, scores, playerId, depth, useJokers);
    if (!useJokers) return { move: baseline, swap: null };
    const candidates = findAllJokerSwaps(hand, table);
    if (!candidates.length) return { move: baseline, swap: null };
    let bestSwap = null, bestMove = baseline, bestVal = baseline ? baseline.info.value : -1;
    for (const cand of candidates) {
      const hypHand = hand.filter((t) => t.id !== cand.realTile.id).concat([cand.jokerTile]);
      const withSwap = findBestMove(hypHand, hasLaid, table, scores, playerId, depth, useJokers);
      const val = withSwap ? withSwap.info.value : -1;
      if (withSwap && val > bestVal) { bestVal = val; bestMove = withSwap; bestSwap = cand; }
    }
    return { move: bestMove, swap: bestSwap };
  }

  return {
    COLOR_KEYS, nid, makeDeck, shuffle, meldInfo, sortMeldTiles, tilePoints, handPoints,
    AI_CONFIG, enumerateMelds, evaluateHand, findBestMove, findBestAttach,
    findJokerSwap, findAllJokerSwaps, planBestMove, findBestReorg,
    ABILITIES, makeAbilityTiles, splitHand,
  };
});
