/* ================================================================
   BURAKO — app completa: menú, tutorial, sonidos, IA con delay
   ================================================================ */

const GAME_VERSION = "1.2.18";
const MAX_PLAYERS_ONLINE = 8; // el server acepta hasta 8 en sala (mazo doble si se supera 4)
const QUICK_CHAT_COOLDOWN_MS = 15000;
const QUICK_CHAT_OPTIONS = [
  {send:"👏", show:"👏"}, {send:"😅", show:"😅"}, {send:"🔥", show:"🔥"}, {send:"💀", show:"💀"},
  {send:"😂", show:"😂"}, {send:"👍", show:"👍"}, {send:"🎉", show:"🎉"}, {send:"😱", show:"😱"},
  {send:"🤔", show:"🤔"}, {send:"⏱️ ¡Apurate!", show:"⏱️"}, {send:"😎 Buena jugada", show:"😎"}, {send:"🤝 Buena partida", show:"🤝"},
];
// Chat de equipo (2v2 online): solo lo ve tu compañero, no los rivales. Debe coincidir
// EXACTAMENTE con TEAM_CHAT_OPTIONS en server.js (server valida contra esa lista).
const TEAM_CHAT_OPTIONS = [
  ...Array.from({length:13},(_,i)=>({send:"Necesito la "+(i+1), show:String(i+1)})),
  {send:"Sí", show:"✅ Sí"}, {send:"No", show:"❌ No"}, {send:"¿Pasamos?", show:"🤝 ¿Pasamos?"},
  {send:"👍 Dale", show:"👍"}, {send:"🚫 No tengo", show:"🚫"}, {send:"⏳ Esperá", show:"⏳"},
];
const CHANGELOG = [
  {version:"1.2.18", date:"02/09/2026", items:[
    "🀄 Arreglado de verdad el salto instantáneo del logo BURAKO entre la portada y el login (la v1.2.17 lo mejoró pero no lo sacó del todo) — ahora se desliza de una pantalla a la otra con una animación fluida.",
    "🔌 Rediseñada la pantalla \"Conectando con el servidor\" (y su reintento) con el mismo estilo nuevo del login, en vez del diseño viejo que había quedado sin actualizar.",
  ]},
  {version:"1.2.17", date:"28/08/2026", items:[
    "🀄 Arreglado: al abrir la app, el logo BURAKO podía \"volar a su lugar\" dos veces seguidas (una al conectar, otra al llegar al login) — ahora esa animación de entrada se ve una sola vez.",
    "🎨 El subtítulo \"El juego de Burako definitivo\" del menú pasa a dorado (antes gris apagado). El aviso de recompensa pendiente en Pase/Torre es más grande y salta un poco al aparecer.",
    "🗼 En la tarjeta de Torre semanal, el botón \"Ir a la Torre\" pasó a la izquierda (y es más grande) y el cofre de recompensa a la derecha; la torre bajó un poco para calzar mejor con el borde de la tarjeta.",
  ]},
  {version:"1.2.16", date:"28/08/2026", items:[
    "🏠 Reacomodado el menú: el título BURAKO y los botones quedan un poco más arriba que Pase/Ruleta/Torre y perfectamente centrados en la pantalla (antes se corrían un poco hacia la izquierda). La tarjeta de Pase de temporada también tiene el escudo de nivel y el cofre de recompensa más grandes, usando todo el alto de la tarjeta en vez de dejar un hueco vacío abajo.",
  ]},
  {version:"1.2.15", date:"28/08/2026", items:[
    "🕹 JUGAR/PERFIL/TIENDA/NOVEDADES tienen arte nuevo (botones dorados propios) y ahora responden de verdad: se elevan e iluminan al pasar el mouse, se \"presionan\" al tocarlos, un reflejo los recorre de vez en cuando y entran de a uno al abrir el menú. NOVEDADES sumó una burbuja roja con el número real de novedades que te perdiste (antes era solo un punto).",
  ]},
  {version:"1.2.14", date:"28/08/2026", items:[
    "🪪 Tu tarjeta de jugador (arriba a la izquierda del menú) tiene diseño nuevo, más grande y con arte propio: avatar en marco circular dorado, nombre, nivel + barra de XP y tu rango real (medalla) en un escudo — todo con tus datos de siempre, solo cambió la presentación.",
    "🖥 En monitores grandes (1080p o más) el menú ahora se ve más \"zoomeado\", aprovechando mejor la pantalla; en laptops más chicas queda como antes. También se arregló que el contenido del menú se pegara abajo en vez de quedar centrado, y el logo de BURAKO ahora arranca a la misma altura que la tarjeta de Pase de temporada.",
  ]},
  {version:"1.2.13", date:"27/08/2026", items:[
    "🎰 Ruleta diaria completamente renovada, adentro y en el menú: la pantalla de girar tiene fondo, banner y ruleta con la B de Burako como ilustraciones propias, con giro real (la rueda gira de verdad y frena exactamente en tu premio, con ticks del indicador) en vez de una animación de mentira. La tarjeta del menú también tiene arte nuevo y ya no se queda pegada en \"Consultando tu progreso\". Botón dorado nuevo, acorde al resto del juego.",
    "🏠 Ajustado el menú principal: Pase de temporada, Ruleta y Torre ahora quedan alineados prolijamente (arriba y abajo) entre sí, JUGAR y el resto del menú central quedaron perfectamente centrados (antes se corrían un poco a la izquierda), y JUGAR/PERFIL/TIENDA/NOVEDADES suman un ícono dorado propio y un brillo sutil.",
  ]},
  {version:"1.2.12", date:"27/08/2026", items:[
    "🎫 La tarjeta de Pase de temporada del menú tiene arte nuevo: marco/fondo, banner \"Temporada activa\", escudo de nivel y cofre de recompensa como ilustraciones propias — tu nivel, XP, barra de progreso y próxima recompensa siguen siendo los datos reales de siempre.",
  ]},
  {version:"1.2.11", date:"27/08/2026", items:[
    "🗼 La tarjeta de Torre semanal del menú tiene arte nuevo: fondo de tormenta violeta, la torre gótica y el cofre de la mejor recompensa como ilustraciones propias, con el mismo piso actual, barra de progreso y recompensa reales de siempre.",
  ]},
  {version:"1.2.10", date:"27/08/2026", items:[
    "🎰 Arreglado: si dejabas la app abierta de un día para el otro, la tarjeta de Ruleta diaria en el menú podía quedarse mostrando \"ya la giraste hoy\" con el dato de ayer, sin dejarte entrar a girar la de hoy. Ya se refresca sola y, aunque llegara a pasar, ahora tocarla siempre te lleva a la Ruleta real (con el estado correcto del día).",
  ]},
  {version:"1.2.9", date:"26/08/2026", items:[
    "🏰🎁 Torre semanal: ningún premio se pierde más. Si ganás un piso y salís sin abrir el regalo, queda pendiente — un piso pendiente se ve con un ícono de regalo brillante en el mapa, y podés abrirlo cuando quieras (o reclamar todos de una desde la Torre). También rediseñamos la progresión de premios de los 10 pisos: ahora escala de verdad (más monedas y XP cuanto más arriba llegás), con 2 efectos visuales exclusivos de Torre (pisos 9 y 10) y un premio extra grande por completar los 10 pisos en la semana.",
  ]},
  {version:"1.2.8", date:"26/08/2026", items:[
    "🏠 Menú principal rediseñado: Pase de temporada, Ruleta diaria y Torre semanal ahora son tarjetas grandes con tu progreso real a la vista (nivel y próxima recompensa, racha y estado de la ruleta, piso actual y premio de la Torre) — antes eran accesos chicos, ahora invitan mucho más a entrar. Pase a la izquierda, Ruleta y Torre a la derecha; en el celular se apilan debajo de Jugar.",
  ]},
  {version:"1.2.7", date:"26/08/2026", items:[
    "🎰🏰 Ruleta diaria y Torre semanal: rediseño con ambientación mística (gemas y chispas flotando) igual al resto del juego. La ruleta gira distinto cada vez (antes siempre giraba igual, solo cambiaba dónde frenaba). En la Torre, los pisos que todavía no llegaste muestran el premio como sorpresa (🎁 ???) en vez de mostrarlo de entrada, y tocar cualquier piso lo centra en pantalla. Al superar un piso, ahora abrís un regalo para ver el premio en vez de solo leerlo en un renglón. También se reordenó el menú: Ruleta y Torre ahora están debajo del Pase de temporada.",
  ]},
  {version:"1.2.6", date:"26/08/2026", items:[
    "🔌 Arreglado un bug de sesión: si se cortaba la conexión repetidas veces en una partida o sala larga (más de unos minutos), podías dejar de poder reconectarte solo, aunque tu sesión siguiera siendo válida — a veces incluso te mandaba al login sin haber cerrado sesión. Ya está resuelto: la reconexión automática ahora es confiable durante toda la partida, no solo al principio.",
  ]},
  {version:"1.2.5", date:"20/08/2026", items:[
    "🐛 Arreglado un bug importante: en algunos casos, entrar a una partida por Matchmaking (Casual/Ranked rápido) dejaba la pantalla del sorteo/reparto sin responder — no se podía tomar la ficha ni recibir las fichas iniciales. Ya está resuelto.",
    "🎲⚡ Matchmaking: ahora las partidas arrancan con 2, 3 o 4 jugadores reales tal cual entran, sin completar de más con IA — la IA solo entra si quedaste solo en la búsqueda, para no dejarte esperando para siempre. Pantalla de búsqueda con estados más claros (jugadores encontrados, \"¡Partida encontrada!\", \"Iniciando…\").",
  ]},
  {version:"1.2.4", date:"20/08/2026", items:[
    "🔌 Arreglado: si la conexión se cortaba (por ejemplo al volver de una partida) y no lograba reconectarse sola, en PC/navegador podías quedar en una pantalla vieja pidiendo una IP de red local, sin forma clara de volver a jugar. Ahora reintenta la conexión de forma visible y, si hace falta, te manda directo al login — nunca a esa pantalla.",
  ]},
  {version:"1.2.3", date:"19/08/2026", items:[
    "🎲⚡ Matchmaking automático: nuevos botones \"Casual rápido\" y \"Ranked rápido\" en Todos contra todos — buscan rivales solos, sin compartir código de sala. Si no aparecen suficientes a tiempo, la partida arranca igual completando con IA.",
  ]},
  {version:"1.2.2", date:"19/08/2026", items:[
    "🏆 Arreglado: los logros que se desbloquean EN VIVO durante la partida (jugar una escalera, un grupo de 4 colores, romper un candado) nunca te avisaban ni se acreditaban — quedaba silenciado por un bug interno. Ahora sí se notifican y se acreditan al toque.",
  ]},
  {version:"1.2.1", date:"19/08/2026", items:[
    "🛠 Arreglado: el fondo animado (estrellas/fichas flotando) podía no verse en el menú por archivos viejos guardados en caché del celular/navegador. Con esta actualización se limpia el caché viejo automáticamente.",
  ]},
  {version:"1.2.0", date:"19/08/2026", items:[
    "💬 Chat nuevo: ahora podés escribir mensajes de texto libre en las salas online (antes solo había frases/emojis predefinidos). Botón claro \"💬 Chat\" con aviso de mensajes nuevos, panel compacto en PC y una bandeja que se desliza desde abajo en el celular — no tapa la mesa ni el atril.",
  ]},
  {version:"1.1.2", date:"18/08/2026", items:[
    "🏳 Arreglado: si alguien se rendía y la partida terminaba después por tiempo o pozo agotado, podía llegar a figurar como ganador (por quedar con el atril vacío). Ahora rendirse siempre es derrota, sin importar cómo termine la partida después.",
  ]},
  {version:"1.1.1", date:"18/08/2026", items:[
    "🌡 Optimizaciones de rendimiento: menos consumo/calentamiento en partidas largas con la mesa cargada de juegos — menos trabajo repetido al procesar cada jugada, animaciones de fondo en pausa mientras jugás (no se ven, pero seguían consumiendo).",
  ]},
  {version:"1.1.0", date:"17/08/2026", items:[
    "⚡ La partida ya no se siente como si se recargara en cada jugada: arreglada la causa de fondo (se deseleccionaban fichas y se perdía lo armado en Preparación con solo esperar al rival).",
    "🛠 Preparación ahora es un espacio de trabajo real: arrastrá una ficha suelta sobre un juego armado para sumarla, sacala arrastrándola afuera, o movela directo de un juego a otro — sin desarmar nada.",
    "📜 En PC ahora podés ocultar el Historial para darle más lugar a la mesa y al atril en ventanas angostas — se acuerda tu preferencia.",
    "⛶ Nuevo modo Ver mesa: ampliá la mesa a pantalla completa con fichas grandes y bien legibles, en PC y en el celular. El botón vive anclado al borde de la mesa y la vista crece desde ahí, con el fondo difuminado en vez de negro.",
    "📱 En el celular, todos los rivales se agrupan arriba de la mesa (antes alguno quedaba flotando raro al costado) — la mesa aprovecha ese espacio y queda notablemente más grande.",
    "🩹 Arreglado el efecto de Ver mesa: ahora crece de forma prolija y estable (antes se veía trancado/roto), en PC y en celular.",
    "🏳 Rendirse ahora tiene su propia confirmación dentro del juego, ya no la alerta genérica del navegador.",
    "👤 En Perfil, cambiar entre Logros/Rangos/Pase/etc. ya no hace que la ventana salte de arriba a abajo.",
    "🎭 Los rivales offline (Partida rápida / IA-Casual) ahora tienen nombres y avatares variados en vez de \"IA Rojo\", \"IA Azul\", etc.",
    "🧠 La dificultad de la IA offline ahora viene de qué tan bien juega (mismo motor que los bots online), no de cuánto tarda en responder — todos los niveles deciden en pocos segundos.",
    "🏆 Nuevo: Ranked Offline. Rango y nivel propios, separados de tu progreso online, 1 contra 1 contra un rival generado a tu medida (nombre, nivel y skin coherentes con tu rango offline).",
    "📷 Arreglado en Android: la app ya usa toda la pantalla en celulares con cámara/recorte en la parte de arriba — antes quedaba una franja muerta sin usar y el título empujado más abajo de lo necesario.",
    "🀄 Modo Ver mesa en celular: las fichas ya no se agrandan — quedan al tamaño normal para que entren varios juegos a la vez sin scrollear tanto.",
    "📱 Ajuste fino de la franja de arriba en celulares con cámara: el título ya no queda más abajo que el resto del encabezado.",
    "📜 Arreglado: el Historial en celular quedaba tapado por los botones de abajo (Bajar/Preparación/Ficha y pasar).",
    "🛠 \"Agrupar\"/\"Vaciar\" en Preparación ya no pueden quedar scrolleados fuera de vista.",
    "⚡ Sacada la inclinación 3D de la mesa en celular — de paso, debería sentirse más fluido con muchos juegos bajados.",
    "📊 Nuevo: \"Ver mi progreso offline\" en Casual contra IA — tu nivel, XP, rango y récord de Ranked Offline en cualquier momento, no solo al terminar una partida. Aclarado: no reparte nada del Pase, es progreso aparte.",
  ]},
  {version:"1.0.1", date:"14/08/2026", items:[
    "🔧 Arreglado: salir de la partida armando 30+ puntos entre VARIOS juegos en Preparación (no solo con un único juego) — antes lo rechazaba.",
    "🔓 Con eso también se destraba el sistema de comodines/candados en Modo Galáctico, que dependía de haber salido primero.",
    "🔊 Subido el volumen de los efectos de sonido (clics, fichas, etc.) — quedaban tapados por la música de Partida.",
    "🖼 Arreglado: la primera ficha de un juego armado en Preparación se veía un poco cortada por el borde.",
  ]},
  {version:"1.0.0", date:"14/08/2026", items:[
    "🎉 ¡Bienvenido a Burako! La variante uruguaya de Rummikub: armá grupos y escaleras, usá comodines y quedate sin fichas antes que nadie.",
    "🎮 Jugá contra la IA (varios niveles de dificultad) o en Multijugador por red local.",
    "🏆 Perfil con nivel, rango competitivo, logros, Pase de temporada y Pase Galáctico.",
    "🛍 Tienda con skins de fichas, tapetes y efectos de bajada, todo comprable con las monedas que ganás jugando.",
    "🌌 Modo Galáctico: fichas de habilidad especiales mezcladas en el mazo.",
    "📲 Instalable como app en el celular (o como .apk en Android), con modo offline contra la IA.",
  ]},
];
const COLOR_KEYS = ["rojo","azul","verde","amarillo"];
const RACK_COLS = 10, RACK_ROWS = 3, RACK_SLOTS = RACK_COLS * RACK_ROWS;
const AI_DELAY_MS = 10000; // ~10 segundos por decisión de la IA
let __id = 0;
const nid = p => p + "_" + (++__id) + "_" + Math.random().toString(36).slice(2,6);
const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* Catálogo de tienda: sonidos de ficha (comprables) — redefinen los golpes de
   place()/meld()/snap() de Sound. Cada beep es [freq, dur, type, vol, delay]. */
const SOUNDFX=[
  {id:"clasico",  name:"Clásico",     desc:"El golpe de siempre",               price:0,
    place:[340,0.05,"square",0.1],
    meld:[[523,0.1,"square",0.11,0],[659,0.1,"square",0.11,0.07],[784,0.1,"square",0.11,0.14],[1046,0.1,"square",0.11,0.21]],
    snap:[[700,0.05,"triangle",0.12,0],[980,0.06,"triangle",0.1,0.05]]},
  {id:"suave",    name:"Suave",       desc:"Golpe redondeado y bajito",         price:1200,
    place:[420,0.08,"sine",0.08],
    meld:[[392,0.18,"sine",0.09,0],[494,0.18,"sine",0.09,0.09],[587,0.22,"sine",0.1,0.18]],
    snap:[[520,0.09,"sine",0.08,0],[660,0.1,"sine",0.07,0.06]]},
  {id:"retro8bit",name:"Retro 8-bit", desc:"Chiptune bien cuadrado",            price:1800,
    place:[220,0.04,"square",0.14],
    meld:[[220,0.06,"square",0.16,0],[330,0.06,"square",0.16,0.06],[440,0.06,"square",0.16,0.12],[660,0.1,"square",0.17,0.18]],
    snap:[[300,0.04,"square",0.13,0],[500,0.05,"square",0.12,0.04]]},
  {id:"madera",   name:"Madera",      desc:"Golpe seco de bloque de madera",    price:2000,
    place:[180,0.06,"sawtooth",0.1],
    meld:[[150,0.1,"sawtooth",0.14,0],[200,0.09,"sawtooth",0.13,0.05],[260,0.08,"sawtooth",0.12,0.1]],
    snap:[[220,0.05,"sawtooth",0.11,0],[280,0.05,"sawtooth",0.09,0.04]]},
  {id:"casino",   name:"Casino",      desc:"Campanitas brillantes de máquina",  price:2200,
    place:[880,0.05,"triangle",0.1],
    meld:[[659,0.09,"triangle",0.12,0],[880,0.09,"triangle",0.12,0.06],[1108,0.09,"triangle",0.12,0.12],[1318,0.14,"triangle",0.14,0.18]],
    snap:[[988,0.05,"triangle",0.11,0],[1318,0.06,"triangle",0.09,0.05]]},
  {id:"campana",  name:"Campana",     desc:"Tañido grave tipo gong suave",      price:2600,
    place:[660,0.14,"sine",0.08],
    meld:[[523,0.4,"sine",0.13,0],[784,0.35,"sine",0.11,0.05],[1046,0.3,"sine",0.09,0.1]],
    snap:[[784,0.16,"sine",0.1,0],[1046,0.15,"sine",0.08,0.05]]},
  {id:"burbuja",  name:"Burbuja",     desc:"Pop redondo y acuático",            price:1600,
    place:[500,0.07,"sine",0.09],
    meld:[[440,0.12,"sine",0.11,0],[600,0.12,"sine",0.11,0.06],[760,0.14,"sine",0.12,0.12]],
    snap:[[600,0.06,"sine",0.1,0],[900,0.08,"sine",0.09,0.05]]},
  {id:"cristal",  name:"Cristal",     desc:"Tintineo agudo tipo copa de vidrio",price:3000,
    place:[1200,0.06,"triangle",0.08],
    meld:[[1046,0.12,"triangle",0.1,0],[1318,0.12,"triangle",0.1,0.06],[1568,0.14,"triangle",0.11,0.12],[1976,0.16,"triangle",0.1,0.18]],
    snap:[[1400,0.05,"triangle",0.09,0],[1760,0.06,"triangle",0.08,0.04]]},
  {id:"arcade",   name:"Arcade",      desc:"Bips rápidos de máquina recreativa",price:3200,
    place:[300,0.04,"square",0.13],
    meld:[[400,0.05,"square",0.15,0],[500,0.05,"square",0.15,0.05],[600,0.05,"square",0.15,0.1],[800,0.08,"square",0.16,0.15]],
    snap:[[350,0.04,"square",0.12,0],[550,0.04,"square",0.11,0.04]]},
];
const SOUNDFX_BY_ID=Object.fromEntries(SOUNDFX.map(s=>[s.id,s]));
function curSoundFx(){ return SOUNDFX_BY_ID[P&&P.soundfx] || SOUNDFX_BY_ID.clasico; }

const AVATARS=["🀄","😎","🐺","🦊","🐉","👑","🎩","🃏","⚡","🔥","❄","🌟","💀","🦁","🤖","🇺🇾",
  "🐯","🐼","🦄","🦉","🐙","🦅","🐍","🥷","🧙","🎭","🍀","💎","🎯","🎲","🚀","🌙","🌈","🏆"];
// Solo estos arrancan disponibles gratis — el resto se gana subiendo de nivel en el Pase
// de temporada (ver PASS_LEVELS). Debe coincidir EXACTAMENTE con FREE_AVATARS en server/db.js.
const FREE_AVATARS=["🀄","😎","🐺","🦊","👑","🃏"];
// Nombres para rivales offline (Partida rápida / IA-Casual): antes eran "IA Rojo",
// "IA Azul", etc — el usuario pidió específicamente nombres que parezcan usernames
// reales, no etiquetas de bot ("no quiero fingir que son personas conectadas
// realmente, solo que la presentación sea más natural e inmersiva"). Pool grande
// para no repetir seguido en partidas consecutivas.
const AI_BOT_NAMES=[
  "Manolo87","Jorge231","NicoUY","MateConAzucar","Sofi92","Fede_77","Rami21",
  "Lucho_10","Vale.mvd","Gonza95","Cami_23","Tabare88","Pauli_uy","Bruno_44",
  "AguslinaUY","Marito_ta","Flor_del_9","Diego0k","Naty.gs","ElPatoRuso",
  "Ceci_montevideo","Santi_uy19","Belu92","Facu_1","Romi_del_este","ElTanoUY",
  "Xime_23","Mati_98","Agus_canario","Vero_maldonado","Nacho_84","Ana_pocitos",
  "Willy_uy","Cintia07","Toto_salto","Male_rocha","Bicho_uy","LaNegra22",
  "Peti_uy","Coco_paysandu",
];
function pickBotNames(n){
  return shuffle(AI_BOT_NAMES.slice()).slice(0,n);
}

/* ---------------- SONIDO (Web Audio, chiptune) ---------------- */
const Sound = {
  ctx:null, on:true,
  get volume(){ try{ const v=localStorage.getItem("burako_sound_vol"); return v===null?1:parseFloat(v); }catch(e){ return 1; } },
  set volume(v){ try{ localStorage.setItem("burako_sound_vol", String(v)); }catch(e){} },
  init(){ if(!this.ctx){ try{ this.ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } if(this.ctx&&this.ctx.state==="suspended") this.ctx.resume(); },
  beep(freq, dur=0.09, type="square", vol=0.12, when=0){
    if(!this.on||!this.ctx) return;
    this._lastAt=performance.now();
    // Subido ~45% (a pedido del usuario: "el sonido está bajo en la sala") — quedaba
    // opacado por la música de Partida, que subimos de volumen en una ronda anterior.
    vol=vol*this.volume*1.45;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },
  /* Click genérico (Fase 12, a pedido del usuario: "audio por botón que toque,
     agradable y cortito") — dos tonos triangle muy juntos y suaves, distinto
     del "select" cuadrado más seco que ya usan atril/preparación. Lo dispara
     el listener delegado de abajo, no cada botón a mano. */
  click(){ this.beep(880,0.035,"triangle",0.055); this.beep(1180,0.03,"triangle",0.04,0.02); },
  /* "Swoosh" de cierre (X) — un barrido de frecuencia descendente, no un beep
     fijo, para que se sienta como algo que se cierra/desliza en vez de un tap más. */
  closeUI(){
    if(!this.on||!this.ctx) return;
    this._lastAt=performance.now();
    const t=this.ctx.currentTime, vol=0.11*this.volume*1.45;
    const o=this.ctx.createOscillator(), g=this.ctx.createGain();
    o.type="sine";
    o.frequency.setValueAtTime(820,t);
    o.frequency.exponentialRampToValueAtTime(240,t+0.13);
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(vol,t+0.015);
    g.gain.exponentialRampToValueAtTime(0.0001,t+0.15);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t+0.17);
  },
  draw(){ this.beep(520,0.06,"triangle",0.15); this.beep(760,0.05,"triangle",0.1,0.05); },
  place(){ const b=curSoundFx().place; this.beep(b[0],b[1],b[2],b[3]); },
  select(){ this.beep(660,0.04,"square",0.07); },
  wheelTick(){ this.beep(1500,0.018,"square",0.04); },
  meld(){ curSoundFx().meld.forEach(b=>this.beep(b[0],b[1],b[2],b[3],b[4])); },
  error(){ this.beep(180,0.15,"sawtooth",0.12); this.beep(140,0.18,"sawtooth",0.1,0.1); },
  flip(){ this.beep(880,0.07,"triangle",0.12); },
  tick(){ this.beep(1200,0.03,"square",0.05); },
  turn(){ this.beep(440,0.08,"triangle",0.1); this.beep(660,0.1,"triangle",0.1,0.09); },
  /* Rediseñado a pedido del usuario ("suena feo") — el sawtooth grave de antes era
     un buzz áspero. Ahora es un golpe cálido (triangle+sine, sin distorsión) más un
     mini-arpegio mayor ascendente que le da sensación de "éxito", no solo de impacto. */
  slam(){
    this.beep(110,0.14,"triangle",0.16);
    this.beep(55,0.18,"sine",0.2,0.01);
    [392,494,587].forEach((f,i)=>this.beep(f,0.09,"triangle",0.08,0.05+i*0.035));
  },
  win(){ [523,659,784,1046,784,1046,1318].forEach((f,i)=>this.beep(f,0.14,"square",0.13,i*0.12)); },
  lose(){ [400,350,300,250].forEach((f,i)=>this.beep(f,0.2,"sawtooth",0.1,i*0.15)); },
  snap(){ curSoundFx().snap.forEach(b=>this.beep(b[0],b[1],b[2],b[3],b[4])); },
  combo(){ [440,554,659,880,1108].forEach((f,i)=>this.beep(f,0.09,"square",0.12,i*0.06)); },
  bigmeld(){ [392,494,587,784,988,1175].forEach((f,i)=>this.beep(f,0.11,"triangle",0.13,i*0.055)); this.beep(1568,0.28,"sine",0.16,0.35); }
};

/* ---------------- MÚSICA DE FONDO (Web Audio 100% sintetizado, sin archivos) ----------------
   Fase 11 §13: la única pista "casino" anterior se reemplaza por composiciones ORIGINALES
   propias (ninguna es una recreación de un tema de otro juego) con identidad propia por
   contexto — chiptune/aventura/fantasía, no lounge de casino. Cada pista es una progresión de
   acordes + línea de bajo + melodía escrita a mano para este archivo (ver Music.tracks). El
   motor de programación (playChord/playBass/playMelody/el scheduler) es el mismo de antes,
   generalizado para que cualquier pista lo use con su propio tempo/timbre/volumen. */
const Music = {
  ctx:null, master:null, timer:null, stepIdx:0, current:null, _unlocked:false,
  get on(){ try{ const v=localStorage.getItem("burako_music_on"); return v===null?true:v==="1"; }catch(e){ return true; } },
  set on(v){ try{ localStorage.setItem("burako_music_on", v?"1":"0"); }catch(e){} },
  get volume(){ try{ const v=localStorage.getItem("burako_music_vol"); return v===null?1:parseFloat(v); }catch(e){ return 1; } },
  set volume(v){ try{ localStorage.setItem("burako_music_vol", String(v)); }catch(e){} },
  setVolume(v){ this.volume=v; if(this.master) this.master.gain.value=this._targetGain(); },
  _targetGain(){ const tr=this.tracks[this.current]||{}; return 0.07*(tr.gainScale||1)*this.volume; },
  // Cada pista: acordes (arrays de frecuencias Hz), raíz de bajo por acorde, melodía (0-2
  // notas por compás, null = silencio — el aire entre notas es parte de la composición),
  // duración de compás en segundos, forma de onda de cada capa y volumen relativo (gainScale).
  tracks:{
    // MENÚ / portada / perfil / tienda — alegre (Fase 12, a pedido explícito del
    // usuario: la versión anterior tenía un acorde menor y era demasiado lenta/
    // espaciada, sonaba melancólica en vez de cálida). Ahora es un I-IV-V-I bien
    // mayor de punta a punta, más rápido, con bajo pulsante y melodía activa en
    // cada compás (sin los huecos largos de antes) — sigue siendo original, más
    // cerca de un tema de pueblo/aventura alegre que de un pad ambiental.
    menu:{
      stepDur:2.15, gainScale:1,
      chordWave:"triangle", bassWave:"triangle", melWave:"triangle",
      chords:[[261.63,329.63,392.00],[174.61,220.00,261.63],[196.00,246.94,293.66],[261.63,329.63,392.00]],
      bass:[130.81,87.31,98.00,130.81],
      bassPulse:true,
      melody:[[392.00,523.25],[349.23,440.00],[392.00,493.88],[523.25,659.26]],
    },
    // LOBBY / preparativos / sorteo / reparto — expectante pero igual de mayor/
    // alegre que el menú (mismo ajuste, se sacó el acorde menor que compartía),
    // más rápido y con la melodía en square para que se sienta un poco más
    // "alerta", como quien tamborilea los dedos esperando su turno.
    lobby:{
      stepDur:1.85, gainScale:1,
      chordWave:"triangle", bassWave:"triangle", melWave:"square",
      chords:[[196.00,246.94,293.66],[261.63,329.63,392.00],[174.61,220.00,261.63],[196.00,246.94,293.66]],
      bass:[98.00,130.81,87.31,98.00],
      bassPulse:true,
      melody:[[440.00,523.25],[392.00,493.88],[440.00,349.23],[523.25,440.00]],
    },
    // PARTIDA — pad sostenido en seno, sin bajo separado ni melodía (para no competir
    // con la concentración de jugar), pero con volumen real: la versión anterior
    // (gainScale 0.4) quedaba prácticamente inaudible en el celular sobre los efectos
    // de sonido del juego, y el usuario reportó "no hay música en partida".
    partida:{
      stepDur:5.2, gainScale:0.95,
      chordWave:"sine", bassWave:"sine", melWave:"sine",
      chords:[[146.83,174.61,220.00],[130.81,164.81,196.00]], // Re menor ↔ Do mayor, sin tensión
      bass:[null,null],
      melody:[null,null],
    },
    // GALÁCTICO — espacial y misterioso: quintas abiertas (no tríadas comunes) bien
    // separadas en el tiempo, un leve detune en la melodía (dos osciladores a +7 cents)
    // para un shimmer de "cristal cósmico", y un delay largo que da sensación de vacío.
    galactico:{
      stepDur:4.4, gainScale:0.85,
      chordWave:"sine", bassWave:"sine", melWave:"triangle",
      chords:[[130.81,196.00,293.66],[110.00,164.81,246.94],[123.47,185.00,277.18],[110.00,196.00,277.18]],
      bass:[65.41,55.00,61.74,55.00],
      melody:[[783.99,null],[null,null],[659.26,987.77],[null,null]],
      detuneMelody:true, delay:true,
    },
  },
  init(){
    if(this.ctx) return;
    try{ this.ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return; }
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.07*this.volume;
    this.master.connect(this.ctx.destination);
    // Delay/feedback simple para la pista galáctica — reutilizado por cualquier pista que
    // pida `delay:true`, así no se instancia un grafo de audio nuevo por cada compás.
    this.delayNode=this.ctx.createDelay(1.2); this.delayNode.delayTime.value=0.55;
    this.delayFeedback=this.ctx.createGain(); this.delayFeedback.gain.value=0.32;
    this.delayWet=this.ctx.createGain(); this.delayWet.gain.value=0.5;
    this.delayNode.connect(this.delayFeedback); this.delayFeedback.connect(this.delayNode);
    this.delayNode.connect(this.delayWet); this.delayWet.connect(this.master);
  },
  playChord(freqs, t, dur, wave){
    freqs.forEach((f)=>{
      const o=this.ctx.createOscillator(), g=this.ctx.createGain();
      o.type=wave||"triangle"; o.frequency.value=f;
      g.gain.setValueAtTime(0.0001,t);
      g.gain.exponentialRampToValueAtTime(0.5/freqs.length, t+dur*0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t+dur+0.1);
    });
  },
  playBass(freq, t, dur, wave){
    if(!freq) return;
    const o=this.ctx.createOscillator(), g=this.ctx.createGain();
    o.type=wave||"triangle"; o.frequency.value=freq;
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(0.45,t+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t+dur+0.05);
  },
  playMelody(freq, t, dur, wave, detune, sendDelay){
    if(!freq) return;
    const o=this.ctx.createOscillator(), g=this.ctx.createGain();
    o.type=wave||"triangle"; o.frequency.value=freq;
    if(detune) o.detune.value=7;
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(0.26,t+0.05);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g); g.connect(this.master);
    if(sendDelay && this.delayNode) g.connect(this.delayNode);
    o.start(t); o.stop(t+dur+0.15);
    if(detune){
      // segundo oscilador desafinado hacia abajo para el shimmer, mismo envelope
      const o2=this.ctx.createOscillator(), g2=this.ctx.createGain();
      o2.type=wave||"triangle"; o2.frequency.value=freq; o2.detune.value=-7;
      g2.gain.setValueAtTime(0.0001,t);
      g2.gain.exponentialRampToValueAtTime(0.2,t+0.05);
      g2.gain.exponentialRampToValueAtTime(0.0001,t+dur);
      o2.connect(g2); g2.connect(this.master);
      if(sendDelay && this.delayNode) g2.connect(this.delayNode);
      o2.start(t); o2.stop(t+dur+0.15);
    }
  },
  /* Música de fondo REAL para el Menú (Fase 12, a pedido del usuario: "te dejé una carpeta
     con la música de fondo que quiero"). Es la única pista que no es sintetizada — un
     <audio> real, ruteado a través del mismo grafo de Web Audio que las demás (mismo
     this.master, así el volumen/mute de Opciones le pega igual) con su propia ganancia para
     poder hacerle fade-in/out independiente. playbackRate reducido un poco a pedido
     explícito ("bajale un poquito la velocidad"). Si el archivo no carga (falta el mp3, error
     de red), cae de vuelta a la pista sintetizada de menu — nunca silencio total. */
  initFileTrack(){
    if(this.fileTrackEl) return;
    this.fileTrackEl=new Audio("audio/musica-fondo.mp3");
    this.fileTrackEl.loop=true;
    this.fileTrackEl.playbackRate=0.92;
    this.fileTrackReady=true;
    this.fileTrackEl.addEventListener("error",()=>{ this.fileTrackReady=false; });
    try{
      const src=this.ctx.createMediaElementSource(this.fileTrackEl);
      this.fileTrackGain=this.ctx.createGain();
      this.fileTrackGain.gain.value=0;
      src.connect(this.fileTrackGain);
      this.fileTrackGain.connect(this.master);
    }catch(e){ this.fileTrackReady=false; }
  },
  scheduleStep(){
    const tr=this.tracks[this.current]; if(!tr) return;
    const t=this.ctx.currentTime+0.1;
    const i=this.stepIdx%tr.chords.length;
    const dur=tr.stepDur;
    this.playChord(tr.chords[i], t, dur*0.92, tr.chordWave);
    if(tr.bassPulse){
      this.playBass(tr.bass[i], t, dur*0.4, tr.bassWave);
      this.playBass((tr.bass[i]||0)*1.5, t+dur*0.5, dur*0.4, tr.bassWave);
    } else {
      this.playBass(tr.bass[i], t, dur*0.75, tr.bassWave);
    }
    const mel=tr.melody[i]||[];
    this.playMelody(mel[0], t+dur*0.1, dur*0.55, tr.melWave, tr.detuneMelody, tr.delay);
    this.playMelody(mel[1], t+dur*0.55, dur*0.4, tr.melWave, tr.detuneMelody, tr.delay);
    this.stepIdx++;
  },
  /* Arranca (o cambia a) una pista por nombre. Si ya está sonando otra, hace un crossfade
     corto en vez de cortar en seco — coherente con el resto de Fase 11 (nada de cortes
     abruptos entre estados). Si no se pasa nombre, sigue con la actual o usa "menu". */
  setTrack(name){
    if(!this.tracks[name]) name="menu";
    const alreadyPlaying=this.timer || (this.current==="menu" && this.fileTrackEl && !this.fileTrackEl.paused);
    if(this.current===name && alreadyPlaying) return;
    const switching=this.current && alreadyPlaying;
    this.current=name;
    // Antes del primer gesto del usuario (ver el listener de "pointerdown" al final del
    // archivo) no se crea el AudioContext ni se programa nada — arrancarlo suspendido
    // dejaría el setInterval acumulando osciladores que nunca llegan a sonar ni a
    // limpiarse. Solo se guarda qué pista corresponde; el listener la arranca de verdad.
    if(!this._unlocked) return;
    if(!this.on) return;
    this.init();
    if(!this.ctx) return;
    if(this.ctx.state==="suspended") this.ctx.resume();
    clearInterval(this.timer); this.timer=null;
    if(this.fileTrackEl) this.fileTrackEl.pause();
    const useFile=name==="menu"&&(()=>{ this.initFileTrack(); return this.fileTrackReady; })();
    const restart=()=>{
      if(useFile){
        this.fileTrackEl.currentTime=this.fileTrackEl.currentTime||0;
        this.fileTrackEl.play().catch(()=>{});
        const gg=this.fileTrackGain.gain, now=this.ctx.currentTime;
        gg.cancelScheduledValues(now);
        gg.setValueAtTime(0.0001,now);
        gg.linearRampToValueAtTime(1,now+0.5);
        return;
      }
      this.stepIdx=0;
      this.scheduleStep();
      this.timer=setInterval(()=>this.scheduleStep(), this.tracks[name].stepDur*1000);
    };
    if(switching){
      const g=this.master.gain, now=this.ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0.0001, now+0.35);
      setTimeout(()=>{
        g.cancelScheduledValues(this.ctx.currentTime);
        g.setValueAtTime(0.0001, this.ctx.currentTime);
        g.linearRampToValueAtTime(this._targetGain(), this.ctx.currentTime+0.5);
        restart();
      },360);
    } else {
      this.master.gain.value=this._targetGain();
      restart();
    }
  },
  start(){ this._unlocked=true; if(!this.on) return; this.setTrack(this.current||"menu"); },
  stop(){ clearInterval(this.timer); this.timer=null; if(this.fileTrackEl) this.fileTrackEl.pause(); },
  toggle(){ this.on=!this.on; if(this.on) this.start(); else this.stop(); },
  /* Stinger corto de victoria/derrota — one-shot independiente del loop (no lo interrumpe,
     suenan encima ya que el loop está bajo de volumen). Nada de archivos: 3-4 notas escritas
     a mano, arpegio ascendente brillante para la victoria, motivo descendente suave (no
     punitivo) para la derrota. */
  playStinger(kind){
    if(!this.on) return;
    this.init(); if(!this.ctx) return;
    if(this.ctx.state==="suspended") this.ctx.resume();
    const t0=this.ctx.currentTime+0.05;
    const vol=0.3*this.volume;
    const note=(freq,t,dur,wave)=>{
      const o=this.ctx.createOscillator(), g=this.ctx.createGain();
      o.type=wave; o.frequency.value=freq;
      g.gain.setValueAtTime(0.0001,t);
      g.gain.exponentialRampToValueAtTime(vol,t+0.03);
      g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t+dur+0.05);
    };
    if(kind==="victory"){
      [523.25,659.26,783.99,1046.50].forEach((f,i)=>note(f,t0+i*0.11,0.32,"triangle"));
      note(1046.50,t0+0.44,0.6,"square");
    } else {
      [392.00,349.23,293.66].forEach((f,i)=>note(f,t0+i*0.14,0.4,"sine"));
    }
  },
};

/* ---------------- MOTOR ---------------- */
function makeDeck(){
  const d=[];
  for(let s=0;s<2;s++) for(const c of COLOR_KEYS) for(let n=1;n<=13;n++) d.push({id:nid("t"),color:c,number:n,joker:false});
  for(let j=0;j<4;j++) d.push({id:nid("j"),color:"comodin",number:null,joker:true});
  return d;
}
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

function meldInfo(tiles){
  if(!tiles||tiles.length<3) return {valid:false};
  const jokers=tiles.filter(t=>t.joker), normals=tiles.filter(t=>!t.joker);
  if(!normals.length) return {valid:false};
  const nums=new Set(normals.map(t=>t.number)), cols=new Set(normals.map(t=>t.color));
  if(nums.size===1 && cols.size===normals.length && tiles.length<=4){
    const n=normals[0].number;
    return {valid:true,type:"grupo",value:n*tiles.length,number:n};
  }
  if(cols.size===1){
    const arr=normals.map(t=>t.number);
    if(new Set(arr).size!==arr.length) return {valid:false};
    const mn=Math.min(...arr), mx=Math.max(...arr), span=mx-mn+1;
    if(span>tiles.length) return {valid:false};
    const gaps=span-normals.length;
    if(gaps>jokers.length) return {valid:false};
    let rem=jokers.length-gaps, lo=mn, hi=mx;
    while(rem>0){ if(hi<13){hi++;rem--;} else if(lo>1){lo--;rem--;} else return {valid:false}; }
    if(hi-lo+1!==tiles.length) return {valid:false};
    let v=0; for(let n=lo;n<=hi;n++) v+=n;
    return {valid:true,type:"escalera",value:v,color:normals[0].color};
  }
  return {valid:false};
}

function findGroupsInHand(hand){
  const used=new Set(), melds=[];
  for(let n=1;n<=13;n++){
    const byColor={};
    hand.forEach(t=>{ if(!t.joker&&t.number===n&&!used.has(t.id)&&!byColor[t.color]) byColor[t.color]=t; });
    const tiles=Object.values(byColor);
    if(tiles.length>=3){ const use=tiles.slice(0,4); use.forEach(t=>used.add(t.id)); melds.push(use); }
    else if(tiles.length===2){
      const fj=hand.find(t=>t.joker&&!used.has(t.id));
      if(fj){ used.add(fj.id); tiles.forEach(t=>used.add(t.id)); melds.push([...tiles,fj]); }
    }
  }
  return {melds,used};
}
function findRunsInHand(hand, exclude){
  const used=new Set(exclude||[]), melds=[];
  for(const color of COLOR_KEYS){
    const tiles=hand.filter(t=>!t.joker&&t.color===color&&!used.has(t.id))
      .sort((a,b)=>a.number-b.number)
      .filter((t,i,arr)=>i===0||arr[i-1].number!==t.number);
    let i=0;
    while(i<tiles.length){
      let run=[tiles[i]], j=i+1;
      while(j<tiles.length){
        const last=run[run.length-1];
        if(tiles[j].number===last.number+1){ run.push(tiles[j]); j++; }
        else if(tiles[j].number===last.number+2){
          const fj=hand.find(t=>t.joker&&!used.has(t.id));
          if(fj){ used.add(fj.id); run.push(fj); run.push(tiles[j]); j++; } else break;
        } else break;
      }
      if(run.length>=3){ run.forEach(t=>{ if(!t.joker) used.add(t.id); }); melds.push(run); i=j; }
      else i++;
    }
  }
  return {melds,used};
}
function aiFindAllMelds(hand){
  const g=findGroupsInHand(hand);
  const r=findRunsInHand(hand,g.used);
  return [...g.melds,...r.melds];
}

/* Ordena las fichas de un juego para mostrarlas prolijas:
   escalera → orden numérico con comodines en su hueco; grupo → por color */
function sortMeldTiles(tiles){
  const info=meldInfo(tiles);
  const jokers=tiles.filter(t=>t.joker);
  const normals=tiles.filter(t=>!t.joker);
  if(info.valid&&info.type==="grupo"){
    const s=normals.slice().sort((a,b)=>COLOR_KEYS.indexOf(a.color)-COLOR_KEYS.indexOf(b.color));
    return [...s,...jokers];
  }
  if(info.valid&&info.type==="escalera"){
    // reconstruir rango lo..hi igual que meldInfo
    const arr=normals.map(t=>t.number);
    const mn=Math.min(...arr), mx=Math.max(...arr), span=mx-mn+1;
    let rem=jokers.length-(span-normals.length), lo=mn, hi=mx;
    while(rem>0){ if(hi<13){hi++;rem--;} else {lo--;rem--;} }
    const byNum={}; normals.forEach(t=>byNum[t.number]=t);
    const out=[]; let ji=0;
    for(let n=lo;n<=hi;n++) out.push(byNum[n]||jokers[ji++]);
    return out;
  }
  const s=normals.slice().sort((a,b)=>a.number-b.number||COLOR_KEYS.indexOf(a.color)-COLOR_KEYS.indexOf(b.color));
  return [...s,...jokers];
}

/* ---------------- ESTADO ---------------- */
// Turno vencido = perdés 1 vida y pasás el turno, SIN comer fichas del pozo (antes comías 3,
// lo que dejaba que alguien dejara pasar el timer a propósito para "comprar" fichas extra).
const MAX_LIVES = 3;
const G = {
  screen:"menu",          // menu | help | sorteo | dealing | playing | gameover
  numOpponents:1,
  players:[], bag:[], table:[], meldCounter:0,
  currentIdx:0, timeLeft:60, timerHandle:null,
  message:"", winner:null,
  sorteoTiles:[], sorteoDone:false, myRevealed:false,
  rack:Array(RACK_SLOTS).fill(null), reserve:[], dealCount:0, dealtStagger:{},
  rackMode:"ordenar", moveFrom:null,
  selHand:new Set(), hinted:new Set(),
  workLoose:[], workGroups:[], selWork:new Set(),
  openedMeldIds:[], openedBackup:{},
  freshMelds:new Set(), freshMeldKind:{}, bigPlayBanner:null, abilityBanner:null, pendingWelcomeBonus:null,
  aiTimeouts:[],
  passStreak:0, finalRanking:null,
  // configuración y economía de partida
  aiLevel:"normal",        // facil | normal | dificil | extremo | claude
  turnSeconds:60,
  initTiles:14,            // fichas iniciales por jugador (offline); 10 en Partida rápida
  winMode:"time",          // time = por tiempo (o vaciar atril) | points = a puntaje objetivo
  targetScore:200,         // puntaje objetivo cuando winMode==="points"
  matchMinutes:0,          // 0 = sin límite; si no, duración total de la partida
  matchEndsAt:null,        // epoch ms en que termina la partida (offline u online)
  matchTimerHandle:null,
  matchTimeoutFired:false,
  scores:{},               // playerId -> puntos acumulados por juegos bajados
  lives:MAX_LIVES,          // se pierde 1 por cada turno vencido (sin comer fichas); 0 = abandono
  hintsLeft:10,            // usos del botón 💡 Jugadas
  jokerBreaksLeft:3,       // veces que podés abrir un juego con comodín
  timeoutFired:false,      // guard anti doble disparo del timer
  historyPanelClosed:false, // PC/pantallas angostas: historial plegado para dejarle sitio a mesa/prep/atril (se pisa con la preferencia guardada apenas Store está listo, ver abajo)
  tableViewOpen:false,     // modo "Ver mesa" (⛶): vista ampliada/focus — efímero, no se persiste entre partidas
  surrenderConfirmOpen:false, // confirmación propia de "Rendirse" (antes usaba confirm() nativo)
  offlineStatsOpen:false, // modal "Ver mi progreso offline" (Ranked Offline)
  chatLog:[], chatOpen:false, chatUnread:0, // chat de texto libre — separado de G.history a propósito (ver appendChatMessageDOM)
};
function tilePoints(t){ return t.joker?25:t.number; }
function handPoints(p){ return p.hand.reduce((s,t)=>s+tilePoints(t),0); }
/* Modo "IA-Casual · por puntaje": termina apenas alguien llega al objetivo, sin esperar a vaciar el atril. */
function checkPointsWin(p){
  if(G.online||G.winMode!=="points") return false;
  if((G.scores[p.id]||0)>=(G.targetScore||200)){ endGame(p); return true; }
  return false;
}
function endGameByPoints(){
  const ranking=G.players.map(p=>({name:p.name,isHuman:p.isHuman,tiles:p.hand.length,points:handPoints(p)}))
    .sort((a,b)=>a.points-b.points||a.tiles-b.tiles);
  G.finalRanking=ranking;
  const w=G.players.find(p=>p.name===ranking[0].name);
  endGame(w);
}
const human = () => G.players.find(p=>p.isHuman);
const rackTiles = () => G.rack.filter(Boolean);
function syncHumanHand(){ const h=human(); if(h) h.hand=handTiles(); }
function firstEmpty(){ return G.rack.findIndex(s=>s===null); }
function placeInRack(t){ const i=firstEmpty(); if(i!==-1) G.rack[i]=t; else G.reserve.push(t); }
function handTiles(){ return G.rack.filter(Boolean).concat(G.reserve); }
function removeFromHand(ids){
  G.rack=G.rack.map(t=>t&&ids.has(t.id)?null:t);
  G.reserve=G.reserve.filter(t=>!ids.has(t.id));
}
function reserveToRack(){
  const sel=G.reserve.filter(t=>G.selHand.has(t.id));
  const pick=sel.length?sel:G.reserve.slice();
  for(const t of pick){
    const i=firstEmpty(); if(i===-1) break;
    G.rack[i]=t; G.reserve=G.reserve.filter(x=>x.id!==t.id);
  }
  Sound.place(); render();
}
function setMsg(m){
  G.message=m; clearTimeout(G._mt); G._mt=setTimeout(()=>{ G.message=""; render(); },3500);
  // Historial offline: mismo criterio que el server usa para las partidas online
  // (todo evento de juego, errores incluidos, vive en el historial — ver el
  // manejo de msg.type==="toast" más abajo) para que el botón 📜 tenga contenido
  // real también jugando Casual/2v2 contra IA, no solo en Multijugador.
  if(m && G.screen==="playing" && !G.online && !m.endsWith("está pensando")){
    G.history=G.history||[];
    G.history.push({time:new Date().toLocaleTimeString('es-UY',{hour:'2-digit',minute:'2-digit',second:'2-digit'}), text:m, kind:"system"});
    if(G.history.length>50) G.history.shift();
  }
}
function clearAiTimeouts(){ G.aiTimeouts.forEach(clearTimeout); G.aiTimeouts=[]; }


/* ================================================================
   PERFIL, RANGOS, LOGROS, ECONOMÍA Y SKINS
   ================================================================ */
const Store={
  mem:{},
  get(k,d){ try{ const v=localStorage.getItem(k); return v!==null?JSON.parse(v):d; }catch(e){ return k in this.mem?this.mem[k]:d; } },
  set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){ this.mem[k]=v; } }
};
const WELCOME_BONUS_COINS=10000;
const DEFAULT_PROFILE={rankPts:1000,fichas:0,streak:0,wins:0,games:0,skin:"clasica",owned:["clasica"],ach:{},
  name:"Jugador",avatar:"🀄",xp:0,effect:"clasico",ownedFx:["clasico"],passClaimed:{},bonusV11Given:false,
  tapete:"clasico",ownedTapetes:["clasico"],soundfx:"clasico",ownedSoundFx:["clasico"],lastSeenVersion:null,
  trail:"clasica",ownedTrails:["clasica"],
  ownedAvatars:FREE_AVATARS.slice(),
  achievementsCatalog:[]};
let P=Object.assign({},DEFAULT_PROFILE,Store.get("burako_profile",{}));
G.historyPanelClosed=Store.get("burako_historyPanelClosed",false);
// Fase 1 (docs/ai/AUDIT-SESSION-ARCHITECTURE.md) — semilla de arranque en frío:
// el catálogo de logros vive normalmente en G.serverAchievementsCatalog (solo
// memoria), así que un arranque en frío con sesión guardada mostraba Logros
// vacío hasta que algo lo volviera a pedir — y confirmado en vivo (Fase 0),
// nada en el camino de resumeSessionSilently() lo pedía nunca. Acá se
// precarga con la última copia conocida (persistida junto al resto de P.*)
// para que Logros nunca arranque en blanco; ver el handler de "catalog" más
// abajo, que la mantiene al día, y resumeSessionSilently(), que ahora la
// vuelve a pedir sola tras cada reconexión exitosa. Esto es SOLO caché de
// visualización — no reemplaza ni imita a Session, ninguna
// pantalla debe usar "hay catálogo" como señal de "estoy autenticado".
if(P.achievementsCatalog&&P.achievementsCatalog.length) G.serverAchievementsCatalog=P.achievementsCatalog;
// 🎁 Bono de bienvenida (v1.1): 10.000 monedas, una sola vez, con aviso visible en el menú.
if(!P.bonusV11Given){ P.fichas+=WELCOME_BONUS_COINS; P.bonusV11Given=true; G.pendingWelcomeBonus=WELCOME_BONUS_COINS; }
function saveP(){ Store.set("burako_profile",P); }

/* ---------------- Progreso de Ranked Offline: SEPARADO del perfil online -----------------
   Pedido explícito (Fase offline §19): nunca contaminar rankPts/xp/monedas/logros online
   jugando contra bots. Guarda en su propia key de Store, nunca toca P/saveP/Store del
   perfil real. Reusa funciones PURAS que ya existen para online (tierOf, levelFromXp,
   RANK_DELTAS_BY_COUNT) porque son solo fórmulas — no tocan estado, así que compartirlas acá
   no mezcla nada; lo que NO se comparte es el objeto de estado en sí (P vs PO) ni el guardado. */
const DEFAULT_OFFLINE_PROFILE={rankPts:1000,xp:0,level:1,wins:0,games:0,streak:0};
let PO=Object.assign({},DEFAULT_OFFLINE_PROFILE,Store.get("burako_offline_profile",{}));
function savePO(){ Store.set("burako_offline_profile",PO); }
function addOfflineXP(n){
  PO.xp=(PO.xp||0)+n;
  const L=levelFromXp(PO.xp);
  PO.level=L.level;
}
// Bots de Ranked Offline con dificultad/rango/skin coherentes al progreso offline del
// jugador (Fase offline §7/§8: "no encontrar un rival nivel 85 con skin de 8000 monedas
// siendo nivel 2") — todo generado, nada de esto desbloquea ni gasta nada real.
function aiLevelForOfflineTier(tierName){
  return {Bronce:"facil", Plata:"normal", Oro:"dificil", Platino:"dificil", Diamante:"extremo", Legendario:"extremo"}[tierName]||"normal";
}
function pickOfflineOpponent(){
  const tier=tierOf(PO.rankPts);
  const name=pickBotNames(1)[0];
  const avatar=shuffle(AVATARS.slice())[0];
  // Nivel/rango del rival: cerca del propio, con variación chica — nunca un salto absurdo.
  const oppLevel=Math.max(1,PO.level+Math.round((Math.random()*6)-3));
  const oppRankPts=Math.max(0,PO.rankPts+Math.round((Math.random()*300)-150));
  // Skin "que pueda pagar" alguien de ese nivel — igual que un jugador real, no le
  // asignamos un cosmético de precio absurdo a un rival de nivel bajo.
  const budget=oppLevel*70+200;
  const afford=SKINS.filter(s=>s.price<=budget);
  const skin=(afford.length?afford[Math.floor(Math.random()*afford.length)]:SKINS[0]).id;
  return {name, avatar, level:oppLevel, rankPts:oppRankPts, tier:tierOf(oppRankPts), skin, aiLevel:aiLevelForOfflineTier(tier.name)};
}
function goRankedOffline(){
  Sound.init();
  G.rankedOfflineOpponent=pickOfflineOpponent();
  G.aiLevel=G.rankedOfflineOpponent.aiLevel;
  G.numOpponents=1;
  G.matchMinutes=0; G.winMode="time";
  G.initTiles=14; G.turnSeconds=60;
  G.rankedOffline=true; G.ranked=false;
  goSorteo(false);
}
function rankedOfflineResolve(winner){
  if(!G.rankedOffline) return null;
  const others=G.players.filter(p=>p!==winner)
    .sort((a,b)=>(G.scores[b.id]||0)-(G.scores[a.id]||0)||handPoints(a)-handPoints(b));
  let order=[winner,...others];
  if(G.abandoned){
    const me=G.players.find(p=>p.isHuman);
    order=order.filter(p=>p!==me); order.push(me);
  }
  const meIdx=order.findIndex(p=>p.isHuman);
  const deltas=RANK_DELTAS_BY_COUNT[G.players.length]||RANK_DELTAS_BY_COUNT[2];
  const delta=deltas[Math.min(meIdx,deltas.length-1)];
  const beforePts=PO.rankPts, beforeLevel=PO.level;
  PO.rankPts=Math.max(0,PO.rankPts+delta);
  PO.games++;
  if(meIdx===0){ PO.wins++; PO.streak++; } else PO.streak=0;
  addOfflineXP(60+(meIdx===0?100:0));
  savePO();
  return {place:meIdx+1, delta, beforePts, afterPts:PO.rankPts, beforeLevel, afterLevel:PO.level, leveledUp:PO.level>beforeLevel, beforeTier:tierOf(beforePts), afterTier:tierOf(PO.rankPts)};
}

/* Sincroniza el perfil del servidor con las variables locales P.* */
function syncProfileFromServer(profile){
  if(!profile) return;
  const skinChanged = profile.active && profile.active.skin !== P.skin;
  const nameCosmeticsChanged = profile.active && (profile.active.nameeffect !== P.nameeffect || profile.active.banner !== P.banner);
  G.serverProfile = profile;
  P.name = profile.username;
  P.fichas = profile.coins;
  P.rankPts = profile.rankPts;
  P.wins = profile.stats.wins;
  P.losses = profile.stats.losses;
  P.games = profile.stats.games;
  P.streak = profile.stats.streak;
  P.bestStreak = profile.stats.bestStreak;
  P.level = profile.level;
  P.xp = profile.xp;
  P.avatar = profile.avatar;
  P.skin = profile.active.skin;
  P.tapete = profile.active.tapete;
  P.effect = profile.active.effect;
  P.trail = profile.active.trail || "clasica";
  P.soundfx = profile.active.soundfx || "clasico";
  P.nameeffect = profile.active.nameeffect || null;
  P.banner = profile.active.banner || null;
  P.title = profile.active.title || null;
  P.owned = profile.inventory.skins.slice();
  P.ownedTapetes = profile.inventory.tapetes.slice();
  P.ownedFx = profile.inventory.effects.slice();
  P.ownedTrails = (profile.inventory.trails || ["clasica"]).slice();
  P.ownedSoundFx = (profile.inventory.soundfx || ["clasico"]).slice();
  P.ownedAvatars = (profile.inventory.avatars || FREE_AVATARS.slice()).slice();
  P.ownedNameEffects = (profile.inventory.nameeffects || []).slice();
  P.ownedBanners = (profile.inventory.banners || []).slice();
  P.ownedTitles = (profile.inventory.titles || []).slice();
  P.achievements = profile.achievements.slice();
  P.passClaimed = profile.passClaimed || {};
  P.stats = profile.stats;
  P.xpInLevel = profile.xpInLevel;
  P.xpForNext = profile.xpForNext;
  P.tier = profile.tier;
  if(profile.galactico){
    P.galacticoXp = profile.galactico.xp;
    P.galacticoLevel = profile.galactico.level;
    P.galacticoXpInLevel = profile.galactico.xpInLevel;
    P.galacticoXpForNext = profile.galactico.xpForNext;
    P.galacticoClaimed = profile.galactico.claimed || {};
  }
  saveP();
  // Si estamos en una sala y cambió la skin activa, avisar al server para que se refleje en la mesa
  if(skinChanged && NET.ws && NET.roomCode) netSend({type:"setSkin", skin:P.skin});
  if(nameCosmeticsChanged && NET.ws && NET.roomCode) netSend({type:"setNameCosmetics"});
}

saveP();

const TIERS=[
  {min:0,   name:"Bronce",    icon:"🥉", color:"#cd7f32"},
  {min:1500,name:"Plata",     icon:"🥈", color:"#c0c0c0"},
  {min:2500,name:"Oro",       icon:"🥇", color:"#ffd700"},
  {min:3500,name:"Platino",   icon:"💠", color:"#00e5ff"},
  {min:4500,name:"Diamante",  icon:"💎", color:"#b9f2ff"},
  {min:6000,name:"Legendario",icon:"🔱", color:"#ff5ec4"},
];
function tierOf(pts){ let t=TIERS[0]; for(const x of TIERS){ if(pts>=x.min) t=x; } return t; }
/* Emblema de rango: insignia con degradé metálico propio por rango (no solo el emoji suelto) */
function tierBadgeHTML(t, size){
  size=size||20;
  const cls="tier-"+(t.name||"bronce").toLowerCase();
  return `<span class="tier-badge ${cls}" style="width:${size}px;height:${size}px;font-size:${Math.round(size*0.56)}px" title="${esc(t.name)}">${t.icon}</span>`;
}

const SKINS=[
  {id:"clasica", name:"Clásica",        price:0},
  {id:"negra",   name:"Negra con Dorado 👑",price:1500},
  {id:"circulo", name:"Círculo de Color",price:2000},
  {id:"madera",  name:"Madera Premium 🍃",price:2500},
  {id:"piedra",  name:"Piedra Antigua 🪨",price:3000},
  {id:"oriental",name:"Místico Oriental ⛩",price:3000},
  {id:"elite",   name:"Diseño Élite",   price:3500},
  {id:"fuego",   name:"Fuego Ardiente 🔥",price:4000},
  {id:"hielo",   name:"Hielo Eterno ❄", price:4000},
  {id:"aracnido",name:"Héroe Arácnido", price:5000},
  {id:"tecno",   name:"Héroe Tecno",    price:5000},
  {id:"sombra",  name:"Héroe Sombra",   price:5000},
  {id:"oro",     name:"Oro Real 👑",    price:6500},
  {id:"neon",    name:"Tecno Futurista ⚡",price:7000},
  {id:"galaxia", name:"Galáctico Espacial 🪐",price:8000},
  {id:"pinguino",name:"Pingüino Tux 🐧", price:1800},
  {id:"oceano",  name:"Océano Profundo 🌊",price:2200},
  {id:"carbon",  name:"Fibra de Carbono ⚫",price:2600},
  {id:"sakura",  name:"Sakura 🌸",       price:2800},
  {id:"pixel",   name:"Retro Pixel 🕹",  price:3200},
  {id:"pirata",  name:"Tesoro Pirata ☠", price:3800},
  {id:"plata",   name:"Plata Cromada ⚙", price:4500},
  {id:"esmeralda",name:"Esmeralda Tallada 💚",price:5200},
  {id:"arcoiris",name:"Arcoíris ✨",     price:6000},
  {id:"holograma",name:"Holograma 🔮",  price:7200},
  {id:"steampunk",name:"Steampunk Gears ⚙️",price:9200},
  {id:"vikingo",  name:"Furia Vikinga 🪓",price:9800},
  {id:"samurai",  name:"Samurái de Élite ⚔",price:10500},
  {id:"cristal",  name:"Reino de Cristal 💎",price:11200},
  {id:"dragon",   name:"Senda del Dragón 🐉",price:12000},
  // Skins de temporada: solo se pueden COMPRAR durante su mes (todos los años). Si ya la
  // tenés, la seguís usando el resto del año igual — season solo bloquea la compra nueva.
  {id:"halloween",name:"Noche de Brujas 🎃",price:4500, season:[10]},
  {id:"navidena", name:"Espíritu Navideño 🎄",price:4800, season:[12]},
  {id:"sanvalentin",name:"San Valentín 💘",price:4200, season:[2]},
  // Exclusiva del Pase Galáctico (nivel 9) — nunca se vende, no aparece en la tienda
  // salvo que ya la tengas (mismo criterio que las de temporada, ver skinRow).
  {id:"agujero_negro",name:"Agujero Negro 🕳",price:0, passOnly:true},
  // [Torre — bloque 3] Exclusivas de Torre II/III — mismo patrón que
  // torre_relampago/torre_celestial en EFFECTS: price:null + sourceOnly,
  // nunca están en CATALOG.skins del servidor así que buyItem las rechaza
  // aunque alguien intentara comprarlas a mano.
  {id:"escarlata_torre",name:"Fichas del Escarlata 🔥",price:null,sourceOnly:"la Torre Roja (piso 10)"},
  {id:"titan_dorado",name:"Fichas del Titán Dorado 👑",price:null,sourceOnly:"la Torre Dorada (piso 10)"},
];
function isSkinInSeason(s){ return !s.season || s.season.includes(new Date().getMonth()+1); }

const ACHIEVEMENTS=[
  {id:"grupo4",     name:"Cuarteto perfecto",   desc:"Formá un grupo de 4 colores",          reward:200},
  {id:"escalera13", name:"La escalera completa",desc:"Bajá una escalera del 1 al 13",        reward:1000},
  {id:"salida50",   name:"Entrada triunfal",    desc:"Salí con un juego de 50+ puntos",      reward:300},
  {id:"primera",    name:"Primera sangre",      desc:"Ganá tu primera partida",              reward:300},
  {id:"racha3",     name:"Imparable",           desc:"Ganá 3 partidas seguidas",             reward:500},
  {id:"cincoJuegos",name:"Fábrica de juegos",   desc:"Bajá 5 juegos en una partida",         reward:400},
  {id:"sinPistas",  name:"Sin ayuda",           desc:"Ganá sin usar ninguna pista",          reward:300},
];
function unlockAch(id){
  if(P.ach[id]) return;
  const a=ACHIEVEMENTS.find(x=>x.id===id); if(!a) return;
  P.ach[id]=Date.now();
  P.fichas+=a.reward;
  saveP();
  // Mismo componente elegante que usan los logros online (renderAchievementToasts,
  // #achToastZone) en vez del setMsg() de texto plano que tenía antes — logros
  // offline y online se ven y se sienten igual (§19 del pedido de rediseño).
  G.pendingAchievements=G.pendingAchievements||[];
  G.pendingAchievements.push({name:a.name, coinReward:a.reward, xpReward:0});
  renderAchievementToasts();
  Sound.win();
}
function checkMeldAchievements(tiles){
  const info=meldInfo(tiles);
  if(!info.valid) return;
  if(info.type==="grupo"&&tiles.length===4) unlockAch("grupo4");
  if(info.type==="escalera"&&tiles.length===13) unlockAch("escalera13");
  G.humanMeldsThisGame=(G.humanMeldsThisGame||0)+1;
  if(G.humanMeldsThisGame>=5) unlockAch("cincoJuegos");
}

/* resolución de partida competitiva: 50 / 30 / 10 / -50 */
const RANK_DELTAS_BY_COUNT={2:[50,-50],3:[50,10,-50],4:[50,30,10,-50]};
function rankedResolve(winner){
  if(!G.ranked) return null;
  let others=G.players.filter(p=>p!==winner)
    .sort((a,b)=>(G.scores[b.id]||0)-(G.scores[a.id]||0)||handPoints(a)-handPoints(b));
  let order=[winner,...others];
  if(G.abandoned){ // abandonar = último puesto directo
    const me=G.players.find(p=>p.isHuman);
    order=order.filter(p=>p!==me); order.push(me);
  }
  const meIdx=order.findIndex(p=>p.isHuman);
  const deltas=RANK_DELTAS_BY_COUNT[G.players.length]||RANK_DELTAS_BY_COUNT[4];
  const delta=deltas[Math.min(meIdx,deltas.length-1)];
  const before=P.rankPts;
  P.rankPts=Math.max(0,P.rankPts+delta);
  P.games++;
  let fichasWon=0;
  if(meIdx===0){
    P.wins++; P.streak++;
    fichasWon=100+Math.max(0,P.streak-1)*50; // racha paga
    P.fichas+=fichasWon;
    unlockAch("primera");
    if(P.streak>=3) unlockAch("racha3");
    if(G.hintsLeft===10) unlockAch("sinPistas");
  } else {
    P.streak=0;
    if(meIdx<G.players.length-1){ fichasWon=meIdx===1?40:20; P.fichas+=fichasWon; }
  }
  addXP(100+(meIdx===0?150:0)+Math.max(0,P.streak)*50);
  saveP();
  return {place:meIdx+1,delta,before,after:P.rankPts,fichasWon,order};
}



const EFFECTS=[
  {id:"clasico",  name:"Impacto clásico", desc:"Onda blanca al bajar",      price:0},
  {id:"explosion",name:"Explosión 🔥",    desc:"Onda de fuego naranja",     price:1200},
  {id:"escarcha", name:"Escarcha ❄",      desc:"Onda helada celeste",       price:1200},
  {id:"rayo",     name:"Rayo ⚡",          desc:"Onda eléctrica dorada",     price:1500},
  {id:"confeti",  name:"Confeti 🎉",      desc:"Onda violeta festiva",      price:2000},
  {id:"destello", name:"Destello Pro ✨", desc:"Chispas doradas + brillo de mesa",price:3500},
  {id:"aurora",   name:"Aurora Boreal 🌌", desc:"Ondas de luces verdes y violetas + brillo de mesa",price:2600},
  {id:"plasma",   name:"Plasma Eléctrico 🌐", desc:"Rayos de energía azul y blanco, más intensos",price:3000},
  {id:"arcoiris", name:"Arcoíris 🌈",     desc:"Estela de todos los colores + brillo de mesa",price:3500},
  {id:"glitch",   name:"Glitch 📺",       desc:"Bloques digitales y un tirón de pantalla al bajar",price:3800},
  {id:"holograma",name:"Holograma 🔮",    desc:"Destellos iridiscentes + brillo de mesa",price:4200},
  // Estos 3 no son más chispas puntuales: cada uno mueve una parte distinta de la
  // pantalla (la mesa entera, tu atril, o un barrido de luces), no solo un estallido.
  {id:"olamesa",  name:"Ola de Mesa 🌊",  desc:"Una onda de color recorre TODA la mesa",price:2800},
  {id:"pulsoatril",name:"Pulso de Atril 💫",desc:"Tu propio atril destella al jugar",price:2400},
  {id:"discoluces",name:"Luces de Fiesta 🪩",desc:"Barrido de luces de colores sobre la mesa",price:3900},
  // Impactos de color (v1.3) — chispas contenidas alrededor del juego bajado,
  // mismo mecanismo que el resto (spawnParticles), sin brillo de mesa extra:
  // son un escalón intermedio de precio, cada uno con su paleta e identidad.
  {id:"impacto_rojo",   name:"Brasa Roja 🔴",     desc:"Chispas de ascuas rojas",     price:1400},
  {id:"impacto_azul",   name:"Ola Azul 🔵",       desc:"Chispas cristalinas azules",  price:1400},
  {id:"impacto_verde",  name:"Aura Verde 🟢",     desc:"Chispas de aura verde",       price:1400},
  {id:"impacto_violeta",name:"Pulso Violeta 🟣",  desc:"Chispas de energía violeta",  price:1600},
  {id:"impacto_dorado", name:"Impacto Dorado 🟡", desc:"Chispas doradas brillantes",  price:2000},
  // Exclusivo de Torre semanal (v1.3) — NO está en el catálogo del servidor
  // (CATALOG.effects en db.js), así que buyItem lo rechaza si alguien intenta
  // comprarlo igual: solo se obtiene superando el piso 10, vía grantRewards.
  {id:"torre_celestial", name:"Torre Celestial 🏰", desc:"Destellos celestiales dorados, exclusivo de la Torre", price:null, sourceOnly:"la Torre semanal (piso 10)"},
  {id:"torre_relampago", name:"Relámpago de Torre ⚡", desc:"Chispas eléctricas violeta y celeste, exclusivo de la Torre", price:null, sourceOnly:"la Torre semanal (piso 9)"},
];
/* Encola el efecto del jugador para el juego recién bajado; se dispara cuando el DOM
   de ese juego ya existe (ver el final de renderPlaying), así nace DESDE el juego
   en la mesa y no desde un punto fijo de la pantalla. */
function queueMeldFx(meldId, fx){ G._pendingFx={id:meldId, fx:fx||"clasico"}; }

const FX_GLOW_COLOR={
  clasico:"rgba(255,255,255,.55)", explosion:"rgba(249,115,22,.7)",
  escarcha:"rgba(125,211,252,.7)", rayo:"rgba(253,224,71,.75)",
  confeti:"rgba(192,132,252,.65)", destello:"rgba(251,191,36,.8)",
  aurora:"rgba(74,222,128,.75)", plasma:"rgba(96,165,250,.85)",
  arcoiris:"rgba(244,114,182,.8)", glitch:"rgba(34,211,238,.8)", holograma:"rgba(196,181,253,.8)",
  olamesa:"rgba(45,212,191,.75)", pulsoatril:"rgba(251,191,36,.8)", discoluces:"rgba(232,121,249,.75)",
  impacto_rojo:"rgba(239,68,68,.75)", impacto_azul:"rgba(59,130,246,.75)", impacto_verde:"rgba(34,197,94,.75)",
  impacto_violeta:"rgba(139,92,246,.8)", impacto_dorado:"rgba(251,191,36,.85)",
  torre_celestial:"rgba(253,230,138,.9)", torre_relampago:"rgba(167,139,250,.85)",
};
/* Efecto premium alrededor del juego: aro de luz + chispas naciendo de sus bordes
   (no solo partículas sueltas flotando en el medio de la pantalla). */
function triggerMeldFx(el, fx){
  if(!el) return;
  el.style.setProperty("--fx-color", FX_GLOW_COLOR[fx]||FX_GLOW_COLOR.clasico);
  el.classList.remove("meld-fx-glow"); void el.offsetWidth; el.classList.add("meld-fx-glow");
  setTimeout(()=>el.classList.remove("meld-fx-glow"),1100);
  spawnParticles(fx, el);
  if(fx==="rayo"||fx==="plasma") lightningFlash(fx);
  if(fx==="glitch") glitchFlash();
  if(fx==="olamesa") mesaWaveFX();
  if(fx==="pulsoatril") rackPulseFX();
  if(fx==="discoluces") discoLightsFX();
}
/* Ola de Mesa: una onda de color recorre la mesa ENTERA, no solo un punto */
function mesaWaveFX(){
  const mesa=document.querySelector(".mesa"); if(!mesa) return;
  const w=document.createElement("div");
  w.className="mesa-wave-fx";
  mesa.appendChild(w);
  setTimeout(()=>w.remove(),1150);
}
/* Pulso de Atril: el atril del jugador (no la mesa) es el que destella */
function rackPulseFX(){
  const rack=document.querySelector(".rack"); if(!rack) return;
  rack.classList.remove("rack-pulse-fx"); void rack.offsetWidth; rack.classList.add("rack-pulse-fx");
  setTimeout(()=>rack.classList.remove("rack-pulse-fx"),1000);
}
/* Luces de Fiesta: barrido giratorio de luces de colores sobre toda la mesa */
function discoLightsFX(){
  const mesa=document.querySelector(".mesa"); if(!mesa) return;
  const d=document.createElement("div");
  d.className="mesa-disco-fx";
  mesa.appendChild(d);
  setTimeout(()=>d.remove(),1350);
}
/* Destello rápido de Rayo/Plasma, CONTENIDO en la mesa (no en toda la
   pantalla — antes iluminaba #app entero, muy agresivo con partidas largas). */
function lightningFlash(fx){
  const app=document.querySelector(".mesa"); if(!app) return;
  const f=document.createElement("div");
  f.className="lightning-flash"+(fx==="plasma"?" plasma":"");
  app.appendChild(f);
  setTimeout(()=>f.remove(),300);
}
/* Tirón de pantalla estilo error de señal: bandas RGB desfasadas un instante */
/* Igual que lightningFlash(): antes corría sobre #app entero (el split RGB
   cubría toda la pantalla). Ahora corre sobre .mesa — el pequeño translate()
   de la animación hace que .mesa sea el "containing block" de sus pseudo-
   elementos position:fixed, así que el overlay queda confinado a la mesa. */
function glitchFlash(){
  const app=document.querySelector(".mesa"); if(!app) return;
  app.classList.remove("a-glitch"); void app.offsetWidth; app.classList.add("a-glitch");
  setTimeout(()=>app.classList.remove("a-glitch"),350);
}

/* Forma de partícula por efecto — no todas son círculos: cada efecto tiene su propia
   silueta (clip-path) además de su paleta de colores, para que se note la diferencia
   de un vistazo y no solo por el color. */
const FX_SHAPES={clasico:"circle",explosion:"circle",escarcha:"diamond",rayo:"bolt",confeti:"square",destello:"star",aurora:"streak",plasma:"bolt",arcoiris:"star",glitch:"square",holograma:"diamond",olamesa:"streak",pulsoatril:"star",discoluces:"square",impacto_rojo:"circle",impacto_azul:"diamond",impacto_verde:"star",impacto_violeta:"bolt",impacto_dorado:"star",torre_celestial:"star",torre_relampago:"bolt"};
const SHAPE_CLIP={
  diamond:"polygon(50% 0%,100% 50%,50% 100%,0% 50%)",
  bolt:"polygon(58% 0%,14% 55%,42% 55%,30% 100%,86% 40%,55% 40%)",
  star:"polygon(50% 0%,63% 34%,100% 38%,72% 61%,82% 98%,50% 78%,18% 98%,28% 61%,0% 38%,37% 34%)",
};
function spawnParticles(fx, originEl){
  const palettes={clasico:["#ffffff"],explosion:["#f97316","#fbbf24","#ef4444"],escarcha:["#7dd3fc","#e0f2fe","#38bdf8"],rayo:["#fde047","#ffffff"],confeti:["#f87171","#60a5fa","#34d399","#fbbf24","#c084fc"],destello:["#fff7d6","#fde68a","#fbbf24","#ffffff"],aurora:["#4ade80","#22d3ee","#a78bfa","#f472b6"],plasma:["#60a5fa","#a78bfa","#ffffff","#38bdf8"],arcoiris:["#f87171","#fb923c","#fbbf24","#4ade80","#38bdf8","#818cf8","#e879f9"],glitch:["#22d3ee","#f472b6","#a3e635","#ffffff"],holograma:["#f0abfc","#93c5fd","#5eead4","#fef08a"],olamesa:["#2dd4bf","#5eead4","#0891b2"],pulsoatril:["#fbbf24","#fde68a","#f59e0b"],discoluces:["#f87171","#fbbf24","#4ade80","#38bdf8","#c084fc"],impacto_rojo:["#ef4444","#f97316","#7f1d1d"],impacto_azul:["#3b82f6","#38bdf8","#1e3a8a"],impacto_verde:["#22c55e","#4ade80","#14532d"],impacto_violeta:["#8b5cf6","#a78bfa","#4c1d95"],impacto_dorado:["#fbbf24","#f59e0b","#fef08a"],torre_celestial:["#fef3c7","#fde68a","#fbbf24","#fff7ed","#f0abfc"],torre_relampago:["#a78bfa","#c4b5fd","#38bdf8","#e0e7ff"]};
  const colors=palettes[fx]||palettes.clasico;
  const shape=FX_SHAPES[fx]||"circle";
  const premium=fx==="destello"||fx==="aurora"||fx==="plasma"||fx==="arcoiris"||fx==="glitch"||fx==="holograma"||fx==="torre_celestial"||fx==="torre_relampago";
  const n=fx==="clasico"?8:premium?32:20;
  let ox=window.innerWidth/2, oy=window.innerHeight*0.42, spread=1;
  if(originEl){
    const r=originEl.getBoundingClientRect();
    ox=r.left+r.width/2; oy=r.top+r.height/2;
    spread=Math.max(.5,Math.min(1.3,(r.width+r.height)/220)); // juegos grandes = chispas más lejos
  }
  const wrap=document.createElement("div");
  wrap.style.cssText="position:fixed;left:"+ox+"px;top:"+oy+"px;z-index:98;pointer-events:none";
  for(let i=0;i<n;i++){
    const s=document.createElement("span");
    const ang=Math.random()*Math.PI*2, dist=((premium?70:45)+Math.random()*(premium?150:100))*spread;
    const size=premium?(3+Math.random()*7):(4+Math.random()*6);
    const w=shape==="streak"?size*3:size, h=shape==="streak"?size*0.55:size;
    const shapeCss=shape==="circle"?"border-radius:50%":shape==="square"?"border-radius:2px":shape==="streak"?"border-radius:50px":"clip-path:"+SHAPE_CLIP[shape];
    s.style.cssText="position:absolute;width:"+w+"px;height:"+h+"px;"+shapeCss+";background:"+colors[i%colors.length]+";box-shadow:0 0 "+(premium?10:6)+"px "+colors[i%colors.length]+";transform:translate(-50%,-50%);opacity:1;transition:transform "+(premium?".9s":".65s")+" cubic-bezier(.2,.8,.4,1),opacity "+(premium?".9s":".65s");
    wrap.appendChild(s);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      s.style.transform="translate(calc(-50% + "+(Math.cos(ang)*dist)+"px),calc(-50% + "+(Math.sin(ang)*dist)+"px)) rotate("+(Math.random()*360)+"deg)";
      s.style.opacity="0";
    }));
  }
  document.body.appendChild(wrap);
  setTimeout(()=>wrap.remove(),premium?950:750);
  // Efecto premium: además de las chispas, un brillo dorado breve en el borde de la mesa
  if(premium){
    const mesa=document.querySelector(".mesa");
    if(mesa){ mesa.classList.remove("mesa-premium-glow"); void mesa.offsetWidth; mesa.classList.add("mesa-premium-glow");
      setTimeout(()=>mesa.classList.remove("mesa-premium-glow"),900); }
  }
}

function slamFX(){
  Sound.slam();
  const app=document.querySelector("#app");
  if(app){ app.classList.remove("shake-it"); void app.offsetWidth; app.classList.add("shake-it");
    setTimeout(()=>app.classList.remove("shake-it"),400); }
}
/* Feedback liviano para pegar UNA ficha a un juego ya bajado (sin sacudir toda la pantalla) */
function snapFX(){ Sound.snap(); }
/* Destello + banner dorado para jugadas grandes: combos (2+ juegos en un turno) o 50+ puntos */
function bigPlayFX(text){
  Sound.bigmeld();
  G.bigPlayBanner=text;
  render();
  clearTimeout(G._bigPlayT);
  G._bigPlayT=setTimeout(()=>{ G.bigPlayBanner=null; render(); },1700);
}
/* Modo Galáctico: cartel grande "NOMBRE USÓ HABILIDAD" cada vez que alguien activa
   una — mismo patrón que bigPlayFX pero con su propio estilo (violeta cósmico). */
function abilityBannerFX(name,key){
  const meta=ABILITY_META[key]||{emoji:"✨",label:key};
  Sound.bigmeld();
  G.abilityBanner={name, meta};
  render();
  clearTimeout(G._abilityBannerT);
  G._abilityBannerT=setTimeout(()=>{ G.abilityBanner=null; render(); },2000);
}

/* ============================================================
   ESTELAS DE VUELO — el camino que recorre cada ficha al volar del atril a la
   mesa al bajar una jugada, independiente del efecto de bajada de arriba (se
   combinan, no se reemplazan). Catálogo de Tienda, ver TRAILS más abajo.

   Captura de posiciones: cuando se confirma una jugada (layTiles offline, o el
   pedido "lay" online ANTES de mandarlo al server), las fichas que se van a
   jugar todavía están físicamente en el atril — ahí se guarda su posición real
   en pantalla (getBoundingClientRect) en G._flightSrc, indexado por su id. Más
   tarde, cuando el juego nuevo ya existe en el DOM (mismo momento en que se
   dispara triggerMeldFx), se compara esa posición guardada contra la posición
   FINAL de cada ficha dentro del juego recién bajado, y cada una vuela de una
   a la otra. Si una ficha no tiene posición de origen guardada (por ejemplo,
   una jugada de un RIVAL en una sala online — nunca vimos su atril), esa ficha
   simplemente aparece como siempre, sin vuelo — no rompe nada.
   ============================================================ */
const TRAILS=[
  {id:"clasica",  name:"Clásica",        desc:"Línea recta, un solo destello — la de siempre.", price:0},
  {id:"viento",   name:"Viento 💨",      desc:"Curva suave en S, como una hoja llevada por el aire.", price:500},
  {id:"dorada",   name:"Dorada 🪙",      desc:"Gira como una moneda al aire, con un arco hacia arriba.", price:800},
  {id:"terremoto",name:"Terremoto 🪨",   desc:"Dos rebotes con polvo en cada impacto, en vez de un vuelo liso.", price:1000},
  {id:"hielo",    name:"Hielo ❄",        desc:"Patina y frena con un pequeño sobrepaso, dejando esquirlas que caen.", price:1200},
  {id:"alquimia", name:"Alquimia 🧪",    desc:"Burbujea de arriba a abajo, dejando burbujas que explotan.", price:1400},
  {id:"fuego",    name:"Fuego 🔥",       desc:"Serpentea en zigzag, con brasas que suben en vez de apagarse quietas.", price:1500},
  {id:"fugaz",    name:"Estrella Fugaz 🌠", desc:"Cola larga y continua detrás, no un destello puntual.", price:2600},
  {id:"arcoiris", name:"Arcoíris 🌈",    desc:"Traza un arco alto cambiando de color en el camino.", price:3200},
  {id:"cosmica",  name:"Cósmica 🌌",     desc:"No viaja: se hunde en un portal y reaparece del otro lado.", price:0, passOnly:true},
  {id:"vacio",    name:"Vacío 🕳",       desc:"Se estira como espagueti hacia el destino y aparece con un rebote elástico.", price:0, passOnly:true},
];
const TRAIL_RGB={
  clasica:"255,255,255", viento:"226,232,240", dorada:"251,191,36", terremoto:"214,180,130",
  hielo:"125,211,252", alquimia:"163,230,53", fuego:"249,115,22", fugaz:"224,242,254",
  arcoiris:"244,114,182", cosmica:"168,85,247", vacio:"124,58,237",
};
function flightSpark(x,y,color){
  const s=document.createElement("div");
  s.className="trail-spark";
  const size=4+Math.random()*4;
  s.style.left=x+"px"; s.style.top=y+"px"; s.style.width=size+"px"; s.style.height=size+"px";
  s.style.background=color; s.style.boxShadow="0 0 6px "+color;
  s.style.setProperty("--sx",(Math.random()*30-15)+"px");
  s.style.setProperty("--sy",(Math.random()*30-15)+"px");
  document.body.appendChild(s);
  setTimeout(()=>s.remove(),340);
}
function flightShard(x,y){
  const s=document.createElement("div");
  s.className="trail-shard";
  s.style.left=x+"px"; s.style.top=y+"px";
  s.style.setProperty("--dx",(Math.random()*20-10)+"px");
  document.body.appendChild(s);
  setTimeout(()=>s.remove(),500);
}
function flightEmber(x,y){
  const s=document.createElement("div");
  s.className="trail-ember";
  const size=4+Math.random()*5;
  s.style.left=x+"px"; s.style.top=y+"px"; s.style.width=size+"px"; s.style.height=size+"px";
  s.style.background=Math.random()>.5?"#f97316":"#fbbf24"; s.style.boxShadow="0 0 7px #f97316";
  s.style.setProperty("--dx",(Math.random()*18-9)+"px");
  document.body.appendChild(s);
  setTimeout(()=>s.remove(),520);
}
function flightRing(x,y,rgb){
  const s=document.createElement("div");
  s.className="trail-ring";
  s.style.left=x+"px"; s.style.top=y+"px";
  s.style.setProperty("--fx",rgb);
  document.body.appendChild(s);
  setTimeout(()=>s.remove(),420);
}
function flightPop(x,y,bg){
  const s=document.createElement("div");
  s.className="trail-pop";
  s.style.left=x+"px"; s.style.top=y+"px";
  if(bg) s.style.background=bg;
  document.body.appendChild(s);
  setTimeout(()=>s.remove(),420);
}
function flightStreak(sx,sy,ex,ey,rgb,bg){
  const dist=Math.hypot(ex-sx,ey-sy);
  const angle=Math.atan2(ey-sy,ex-sx)*180/Math.PI;
  const el=document.createElement("div");
  el.className="trail-streak";
  el.style.left=sx+"px"; el.style.top=sy+"px"; el.style.width=dist+"px";
  el.style.setProperty("--ang",angle+"deg");
  if(rgb) el.style.setProperty("--fx",rgb);
  if(bg) el.style.background=bg;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),300);
}
function flightAnimate(el,kfs,dur,easing){
  return el.animate(kfs,{duration:dur,easing:easing||"ease-out",fill:"forwards"}).finished.catch(()=>{});
}
/* La ficha "fantasma" que vuela es un CLON de la ficha real ya en su posición
   final (oculta con opacity:0 hasta que el vuelo termina) — así tiene el color,
   la skin y el comodín exactos, sin tener que reconstruir esos datos a mano. */
function makeFlightGhost(cloneEl,rect){
  const wrap=document.createElement("div");
  wrap.style.cssText="position:fixed;left:0;top:0;z-index:82;pointer-events:none;width:"+rect.width+"px;height:"+rect.height+"px;will-change:transform";
  // cloneEl puede ser la ficha misma, o (si tiene skin) el <span class="sk-…"> que la
  // envuelve — en ambos casos hay que encontrar el .tile real adentro para dimensionarlo;
  // el span queda tal cual para que las reglas CSS de esa skin le sigan aplicando.
  const tileNode=cloneEl.classList&&cloneEl.classList.contains("tile")?cloneEl:cloneEl.querySelector(".tile");
  if(tileNode){ tileNode.style.width="100%"; tileNode.style.height="100%"; tileNode.style.opacity="1"; tileNode.classList.remove("sel","hint"); }
  wrap.appendChild(cloneEl);
  document.body.appendChild(wrap);
  return wrap;
}
const FLY_TRAIL={
  clasica(srcRect,destRect,ghostEl,rgb,onDone){
    const sx=srcRect.left+srcRect.width/2, sy=srcRect.top+srcRect.height/2;
    const dx=destRect.left+destRect.width/2, dy=destRect.top+destRect.height/2;
    for(let i=0;i<3;i++) flightSpark(sx,sy,"rgb("+rgb+")");
    flightStreak(sx,sy,dx,dy,rgb);
    const g=makeFlightGhost(ghostEl,srcRect);
    flightAnimate(g,[
      {transform:"translate("+(sx-srcRect.width/2)+"px,"+(sy-srcRect.height/2)+"px)"},
      {transform:"translate("+(dx-srcRect.width/2)+"px,"+(dy-srcRect.height/2)+"px)"}
    ],140,"linear").then(()=>{ for(let i=0;i<4;i++) flightSpark(dx,dy,"rgb("+rgb+")"); g.remove(); onDone(); });
  },
  dorada(srcRect,destRect,ghostEl,rgb,onDone){
    const sx=srcRect.left+srcRect.width/2, sy=srcRect.top+srcRect.height/2;
    const dx=destRect.left+destRect.width/2, dy=destRect.top+destRect.height/2;
    const midX=(sx+dx)/2, midY=Math.min(sy,dy)-22;
    flightStreak(sx,sy,dx,dy,rgb);
    const g=makeFlightGhost(ghostEl,srcRect);
    flightAnimate(g,[
      {transform:"translate("+(sx-srcRect.width/2)+"px,"+(sy-srcRect.height/2)+"px) rotate(0deg)"},
      {transform:"translate("+(midX-srcRect.width/2)+"px,"+(midY-srcRect.height/2)+"px) rotate(360deg) scale(.85)"},
      {transform:"translate("+(dx-srcRect.width/2)+"px,"+(dy-srcRect.height/2)+"px) rotate(720deg)"}
    ],220,"ease-out").then(()=>{ for(let i=0;i<5;i++) flightSpark(dx,dy,"rgb("+rgb+")"); g.remove(); onDone(); });
    setTimeout(()=>flightSpark(midX,midY,"rgb("+rgb+")"),90);
  },
  hielo(srcRect,destRect,ghostEl,rgb,onDone){
    const sx=srcRect.left+srcRect.width/2, sy=srcRect.top+srcRect.height/2;
    const dx=destRect.left+destRect.width/2, dy=destRect.top+destRect.height/2;
    const overX=dx+(dx-sx)*.08, overY=dy+(dy-sy)*.08;
    flightStreak(sx,sy,dx,dy,rgb,"linear-gradient(90deg,transparent,rgba(224,242,254,.9) 55%,#fff)");
    const g=makeFlightGhost(ghostEl,srcRect);
    flightAnimate(g,[
      {transform:"translate("+(sx-srcRect.width/2)+"px,"+(sy-srcRect.height/2)+"px)"},
      {transform:"translate("+(overX-srcRect.width/2)+"px,"+(overY-srcRect.height/2)+"px)", offset:.8},
      {transform:"translate("+(dx-srcRect.width/2)+"px,"+(dy-srcRect.height/2)+"px)"}
    ],230,"cubic-bezier(.2,.9,.2,1)").then(()=>{
      for(let i=0;i<4;i++) flightShard(dx+(Math.random()*16-8),dy+(Math.random()*10-5));
      g.remove(); onDone();
    });
    for(let i=1;i<=3;i++) setTimeout(()=>flightShard(sx+(dx-sx)*i/4,sy+(dy-sy)*i/4),i*45);
  },
  fuego(srcRect,destRect,ghostEl,rgb,onDone){
    const sx=srcRect.left+srcRect.width/2, sy=srcRect.top+srcRect.height/2;
    const dx=destRect.left+destRect.width/2, dy=destRect.top+destRect.height/2;
    const ang=Math.atan2(dy-sy,dx-sx), perp=ang+Math.PI/2, off=12;
    const p1x=sx+(dx-sx)*.33+Math.cos(perp)*off, p1y=sy+(dy-sy)*.33+Math.sin(perp)*off;
    const p2x=sx+(dx-sx)*.66-Math.cos(perp)*off, p2y=sy+(dy-sy)*.66-Math.sin(perp)*off;
    const g=makeFlightGhost(ghostEl,srcRect);
    let emberTimer=setInterval(()=>{ const t=Math.random(); flightEmber(sx+(dx-sx)*t,sy+(dy-sy)*t); },42);
    flightAnimate(g,[
      {transform:"translate("+(sx-srcRect.width/2)+"px,"+(sy-srcRect.height/2)+"px) rotate(-6deg)"},
      {transform:"translate("+(p1x-srcRect.width/2)+"px,"+(p1y-srcRect.height/2)+"px) rotate(6deg)"},
      {transform:"translate("+(p2x-srcRect.width/2)+"px,"+(p2y-srcRect.height/2)+"px) rotate(-5deg)"},
      {transform:"translate("+(dx-srcRect.width/2)+"px,"+(dy-srcRect.height/2)+"px) rotate(0deg)"}
    ],260,"ease-in-out").then(()=>{ clearInterval(emberTimer); for(let i=0;i<5;i++) flightEmber(dx,dy); g.remove(); onDone(); });
  },
  arcoiris(srcRect,destRect,ghostEl,rgb,onDone){
    const sx=srcRect.left+srcRect.width/2, sy=srcRect.top+srcRect.height/2;
    const dx=destRect.left+destRect.width/2, dy=destRect.top+destRect.height/2;
    const palette=["#f87171","#fb923c","#fbbf24","#4ade80","#38bdf8","#a78bfa","#e879f9"];
    const midX=(sx+dx)/2, midY=Math.min(sy,dy)-42;
    const g=makeFlightGhost(ghostEl,srcRect);
    for(let i=0;i<=6;i++){
      const t=i/6;
      const x=(1-t)*(1-t)*sx+2*(1-t)*t*midX+t*t*dx;
      const y=(1-t)*(1-t)*sy+2*(1-t)*t*midY+t*t*dy;
      setTimeout(()=>flightStreak(x-8,y,x+8,y,null,palette[i]),t*190);
    }
    flightAnimate(g,[
      {transform:"translate("+(sx-srcRect.width/2)+"px,"+(sy-srcRect.height/2)+"px)"},
      {transform:"translate("+(midX-srcRect.width/2)+"px,"+(midY-srcRect.height/2)+"px)", offset:.5},
      {transform:"translate("+(dx-srcRect.width/2)+"px,"+(dy-srcRect.height/2)+"px)"}
    ],220,"ease-out").then(()=>{ palette.forEach((c,i)=>setTimeout(()=>flightSpark(dx,dy,c),i*12)); g.remove(); onDone(); });
  },
  cosmica(srcRect,destRect,ghostEl,rgb,onDone){
    const sx=srcRect.left+srcRect.width/2, sy=srcRect.top+srcRect.height/2;
    const dx=destRect.left+destRect.width/2, dy=destRect.top+destRect.height/2;
    flightRing(sx,sy,rgb);
    const g1=makeFlightGhost(ghostEl,srcRect);
    flightAnimate(g1,[
      {transform:"translate("+(sx-srcRect.width/2)+"px,"+(sy-srcRect.height/2)+"px) rotate(0deg) scale(1)"},
      {transform:"translate("+(sx-srcRect.width/2)+"px,"+(sy-srcRect.height/2)+"px) rotate(480deg) scale(0)"}
    ],150,"ease-in").then(()=>{
      g1.remove();
      flightRing(dx,dy,rgb);
      for(let i=0;i<5;i++) flightSpark(dx,dy,"rgb("+rgb+")");
      const g2=makeFlightGhost(ghostEl.cloneNode(true),destRect);
      flightAnimate(g2,[
        {transform:"translate("+(dx-destRect.width/2)+"px,"+(dy-destRect.height/2)+"px) rotate(-480deg) scale(0)"},
        {transform:"translate("+(dx-destRect.width/2)+"px,"+(dy-destRect.height/2)+"px) rotate(0deg) scale(1)"}
      ],150,"ease-out").then(()=>{ g2.remove(); onDone(); });
    });
  },
  viento(srcRect,destRect,ghostEl,rgb,onDone){
    const sx=srcRect.left+srcRect.width/2, sy=srcRect.top+srcRect.height/2;
    const dx=destRect.left+destRect.width/2, dy=destRect.top+destRect.height/2;
    const ang=Math.atan2(dy-sy,dx-sx), perp=ang+Math.PI/2, off=26;
    const p1x=sx+(dx-sx)*.35+Math.cos(perp)*off, p1y=sy+(dy-sy)*.35+Math.sin(perp)*off;
    const p2x=sx+(dx-sx)*.7-Math.cos(perp)*off*.7, p2y=sy+(dy-sy)*.7-Math.sin(perp)*off*.7;
    const g=makeFlightGhost(ghostEl,srcRect);
    const pts=[[sx,sy],[p1x,p1y],[p2x,p2y],[dx,dy]];
    for(let i=0;i<3;i++) setTimeout(()=>flightStreak(pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],null,"rgba(226,232,240,.55)"),i*.35*220);
    flightAnimate(g,[
      {transform:"translate("+(sx-srcRect.width/2)+"px,"+(sy-srcRect.height/2)+"px) rotate(-8deg)"},
      {transform:"translate("+(p1x-srcRect.width/2)+"px,"+(p1y-srcRect.height/2)+"px) rotate(10deg)"},
      {transform:"translate("+(p2x-srcRect.width/2)+"px,"+(p2y-srcRect.height/2)+"px) rotate(-6deg)"},
      {transform:"translate("+(dx-srcRect.width/2)+"px,"+(dy-srcRect.height/2)+"px) rotate(0deg)"}
    ],260,"ease-in-out").then(()=>{ for(let i=0;i<3;i++) flightSpark(dx,dy,"rgba(226,232,240,.8)"); g.remove(); onDone(); });
  },
  alquimia(srcRect,destRect,ghostEl,rgb,onDone){
    const sx=srcRect.left+srcRect.width/2, sy=srcRect.top+srcRect.height/2;
    const dx=destRect.left+destRect.width/2, dy=destRect.top+destRect.height/2;
    const q1x=sx+(dx-sx)*.33, q1y=sy+(dy-sy)*.33-14;
    const q2x=sx+(dx-sx)*.66, q2y=sy+(dy-sy)*.66+10;
    const g=makeFlightGhost(ghostEl,srcRect);
    let bubbleTimer=setInterval(()=>{ const t=Math.random(); flightPop(sx+(dx-sx)*t,sy+(dy-sy)*t,"radial-gradient(circle at 35% 30%,rgba(190,242,100,.9),rgba(101,163,13,.7) 70%)"); },60);
    flightAnimate(g,[
      {transform:"translate("+(sx-srcRect.width/2)+"px,"+(sy-srcRect.height/2)+"px) scale(1)"},
      {transform:"translate("+(q1x-srcRect.width/2)+"px,"+(q1y-srcRect.height/2)+"px) scale(1.12)"},
      {transform:"translate("+(q2x-srcRect.width/2)+"px,"+(q2y-srcRect.height/2)+"px) scale(.92)"},
      {transform:"translate("+(dx-srcRect.width/2)+"px,"+(dy-srcRect.height/2)+"px) scale(1)"}
    ],250,"ease-in-out").then(()=>{
      clearInterval(bubbleTimer);
      for(let i=0;i<4;i++) flightPop(dx+(Math.random()*14-7),dy+(Math.random()*14-7),"radial-gradient(circle at 35% 30%,rgba(190,242,100,.9),rgba(101,163,13,.7) 70%)");
      g.remove(); onDone();
    });
  },
  fugaz(srcRect,destRect,ghostEl,rgb,onDone){
    const sx=srcRect.left+srcRect.width/2, sy=srcRect.top+srcRect.height/2;
    const dx=destRect.left+destRect.width/2, dy=destRect.top+destRect.height/2;
    const g=makeFlightGhost(ghostEl,srcRect);
    const steps=10, dur=230, len=Math.hypot(dx-sx,dy-sy)||1;
    for(let i=1;i<=steps;i++){
      const t=i/steps;
      setTimeout(()=>{
        const x=sx+(dx-sx)*t, y=sy+(dy-sy)*t, tailLen=46*(1-t*.5);
        const bx=x-(dx-sx)/len*tailLen, by=y-(dy-sy)/len*tailLen;
        flightStreak(bx,by,x,y,null,"linear-gradient(90deg,transparent,rgba(224,242,254,.9) 60%,#fff)");
      },t*dur);
    }
    flightAnimate(g,[
      {transform:"translate("+(sx-srcRect.width/2)+"px,"+(sy-srcRect.height/2)+"px)"},
      {transform:"translate("+(dx-srcRect.width/2)+"px,"+(dy-srcRect.height/2)+"px)"}
    ],dur,"ease-in").then(()=>{ for(let i=0;i<5;i++) flightSpark(dx,dy,"#e0f2fe"); g.remove(); onDone(); });
  },
  terremoto(srcRect,destRect,ghostEl,rgb,onDone){
    const sx=srcRect.left+srcRect.width/2, sy=srcRect.top+srcRect.height/2;
    const dx=destRect.left+destRect.width/2, dy=destRect.top+destRect.height/2;
    const b1x=sx+(dx-sx)*.4, b1y=sy+(dy-sy)*.4;
    const b2x=sx+(dx-sx)*.75, b2y=sy+(dy-sy)*.75;
    const g=makeFlightGhost(ghostEl,srcRect);
    flightAnimate(g,[
      {transform:"translate("+(sx-srcRect.width/2)+"px,"+(sy-srcRect.height/2)+"px) translateY(0px) rotate(0deg)"},
      {transform:"translate("+(b1x-srcRect.width/2)+"px,"+(b1y-srcRect.height/2)+"px) translateY(-16px) rotate(-8deg)", offset:.28},
      {transform:"translate("+(b1x-srcRect.width/2)+"px,"+(b1y-srcRect.height/2)+"px) translateY(0px) rotate(0deg)", offset:.44},
      {transform:"translate("+(b2x-srcRect.width/2)+"px,"+(b2y-srcRect.height/2)+"px) translateY(-8px) rotate(6deg)", offset:.72},
      {transform:"translate("+(dx-srcRect.width/2)+"px,"+(dy-srcRect.height/2)+"px) translateY(0px) rotate(0deg)"}
    ],260,"ease-in-out").then(()=>{ flightPop(dx,dy,"radial-gradient(ellipse,rgba(214,180,130,.7),transparent 70%)"); for(let i=0;i<4;i++) flightSpark(dx,dy,"rgb("+rgb+")"); g.remove(); onDone(); });
    setTimeout(()=>flightPop(b1x,b1y,"radial-gradient(ellipse,rgba(214,180,130,.7),transparent 70%)"),260*.44);
  },
  vacio(srcRect,destRect,ghostEl,rgb,onDone){
    const sx=srcRect.left+srcRect.width/2, sy=srcRect.top+srcRect.height/2;
    const dx=destRect.left+destRect.width/2, dy=destRect.top+destRect.height/2;
    const ang=Math.atan2(dy-sy,dx-sx)*180/Math.PI;
    flightRing(sx,sy,rgb);
    for(let i=0;i<4;i++) setTimeout(()=>flightSpark(sx+(Math.random()*10-5),sy+(Math.random()*10-5),"rgb("+rgb+")"),i*20);
    const g=makeFlightGhost(ghostEl,srcRect);
    flightAnimate(g,[
      {transform:"translate("+(sx-srcRect.width/2)+"px,"+(sy-srcRect.height/2)+"px) rotate("+ang+"deg) scaleX(1) scaleY(1)"},
      {transform:"translate("+((sx+dx)/2-srcRect.width/2)+"px,"+((sy+dy)/2-srcRect.height/2)+"px) rotate("+ang+"deg) scaleX(2.4) scaleY(.5)", offset:.55},
      {transform:"translate("+(dx-srcRect.width/2)+"px,"+(dy-srcRect.height/2)+"px) rotate("+ang+"deg) scaleX(.7) scaleY(1.2)", offset:.85},
      {transform:"translate("+(dx-srcRect.width/2)+"px,"+(dy-srcRect.height/2)+"px) rotate(0deg) scaleX(1) scaleY(1)"}
    ],220,"ease-in-out").then(()=>{ flightRing(dx,dy,rgb); for(let i=0;i<5;i++) flightSpark(dx,dy,"rgb("+rgb+")"); g.remove(); onDone(); });
  },
};
/* Guarda dónde estaba cada ficha en el atril JUSTO ANTES de mandar/ejecutar una
   jugada — tiene que llamarse mientras el DOM viejo todavía existe (antes de
   removeFromHand()/render(), o antes del netSend online). */
function captureFlightSources(tileIds){
  const map={};
  (tileIds||[]).forEach(id=>{
    const el=document.querySelector('.col-rack [data-tid="'+id+'"]');
    if(el) map[id]=el.getBoundingClientRect();
  });
  G._flightSrc=map;
}
/* Se llama cuando el juego nuevo ya existe en el DOM (mismo momento que
   triggerMeldFx). Por cada ficha del juego que tenga una posición de origen
   guardada, la oculta y lanza su vuelo — el resto queda visible como siempre. */
function runMeldFlight(meldEl, srcMap, trailId){
  // Respeta "menos movimiento": las fichas aparecen directo, sin volar ni dejar partículas.
  if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const flyFn=FLY_TRAIL[trailId]||FLY_TRAIL.clasica;
  const rgb=TRAIL_RGB[trailId]||TRAIL_RGB.clasica;
  const tileEls=[...meldEl.querySelectorAll(".tiles .tile")];
  tileEls.forEach(el=>{
    const tid=el.getAttribute("data-tid");
    if(!tid||!srcMap[tid]) return;
    const srcRect=srcMap[tid];
    const destRect=el.getBoundingClientRect();
    const skinWrap=el.parentElement&&el.parentElement.className&&/(^|\s)sk-/.test(el.parentElement.className)?el.parentElement:null;
    const ghost=(skinWrap||el).cloneNode(true);
    el.style.opacity="0";
    flyFn(srcRect,destRect,ghost,rgb,()=>{ el.style.opacity=""; });
  });
}
/* Jugada de un RIVAL (llegó por la red): nunca vimos su atril, así que no hay
   posición real por ficha — en cambio, todas vuelan desde SU tarjeta en pantalla
   (.opp-card[data-pid]), con la estela que tenía activa quien la bajó. Si esa
   tarjeta no está en pantalla por algún motivo, no se fuerza nada: la jugada
   aparece directo, como pasaba antes de este sistema. */
function runMeldFlightFromOrigin(meldEl, ownerId, trailId){
  if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const originEl=document.querySelector('.opp-card[data-pid="'+ownerId+'"]');
  if(!originEl) return;
  const cardRect=originEl.getBoundingClientRect();
  const cx=cardRect.left+cardRect.width/2, cy=cardRect.top+cardRect.height/2;
  const flyFn=FLY_TRAIL[trailId]||FLY_TRAIL.clasica;
  const rgb=TRAIL_RGB[trailId]||TRAIL_RGB.clasica;
  const tileEls=[...meldEl.querySelectorAll(".tiles .tile")];
  tileEls.forEach((el,i)=>{
    const destRect=el.getBoundingClientRect();
    // rect "virtual" del mismo tamaño que la ficha de destino, centrado en la
    // tarjeta del rival — así el fantasma que vuela sale con tamaño de ficha,
    // no del tamaño de la tarjeta entera.
    const srcRect={left:cx-destRect.width/2, top:cy-destRect.height/2, width:destRect.width, height:destRect.height};
    const skinWrap=el.parentElement&&el.parentElement.className&&/(^|\s)sk-/.test(el.parentElement.className)?el.parentElement:null;
    const ghost=(skinWrap||el).cloneNode(true);
    el.style.opacity="0";
    setTimeout(()=>{ flyFn(srcRect,destRect,ghost,rgb,()=>{ el.style.opacity=""; }); }, i*30);
  });
}
function goMenu(){
  clearInterval(G.timerHandle); clearInterval(G.matchTimerHandle); clearInterval(G._chatCooldownTick); clearAiTimeouts(); G.abandoned=false;
  G.surrenderedOnline=false; G.iSurrendered=false; G.rankUpdate=null;
  G.rankedOffline=false; G.rankedOfflineResult=null; G.rankedOfflineOpponent=null;
  G.screen="menu"; render();
  // [v1.3.3 — rediseño de menú, bug real corregido en v1.3.5] Las tarjetas
  // grandes de Ruleta/Torre en el menú necesitan el mismo status real que ya
  // se pedía recién al ENTRAR a esas pantallas (dailyStatus/towerStatus).
  // La primera versión de esto lo pedía UNA sola vez por sesión de página
  // "para siempre" — pero si alguien dejaba la pestaña abierta de un día
  // para el otro (algo muy normal), la tarjeta de Ruleta se quedaba
  // mostrando "ya la giraste hoy" con el dato de AYER, sin refrescarse
  // nunca más, aunque el servidor ya tuviera el día nuevo listo para girar
  // (reportado en vivo: "no puedo reclamar la ruleta de día 2" con el
  // servidor confirmando que sí estaba disponible). Ahora se refresca cada
  // vez que pasaron 5+ minutos desde el último pedido — sigue sin saturar
  // al servidor en visitas seguidas al menú, pero nunca queda pegado en el
  // dato de un día que ya terminó.
  const MENU_STATUS_REFRESH_MS=5*60*1000;
  if(Session.isAuthenticated()&&NET.ws&&NET.ws.readyState===1){
    const now=Date.now();
    if(!G._menuDailyRequestedAt||now-G._menuDailyRequestedAt>MENU_STATUS_REFRESH_MS){ G._menuDailyRequestedAt=now; netSend({type:"dailyStatus"}); }
    if(!G._menuTowerRequestedAt||now-G._menuTowerRequestedAt>MENU_STATUS_REFRESH_MS){ G._menuTowerRequestedAt=now; netSend({type:"towerStatus"}); }
  }
}
function goHelp(){ G.screen="help"; render(); }
function goChangelog(){ G.screen="changelog"; P.lastSeenVersion=GAME_VERSION; saveP(); render(); }
/* Antes NOVEDADES solo mostraba un puntito rojo (viste/no viste el
   changelog, sin número). El botón nuevo tiene una burbuja real con
   contador — en vez de inventar un número, se deriva de CHANGELOG (ya
   existe, ordenado del más nuevo al más viejo): cuántas entradas hay antes
   de la última que el jugador vio. Si nunca abrió Novedades (lastSeenVersion
   null), cuenta como que le faltan todas — mismo criterio que ya usaba el
   puntito (P.lastSeenVersion!==GAME_VERSION) para decidir si mostrar algo. */
function unseenChangelogCount(){
  if(!P.lastSeenVersion) return CHANGELOG.length;
  const idx=CHANGELOG.findIndex(c=>c.version===P.lastSeenVersion);
  return idx===-1?CHANGELOG.length:idx;
}
function closeWelcomeBonus(){ G.pendingWelcomeBonus=null; Sound.meld(); saveP(); render(); }
function closeSanctionAlert(){ G.pendingSanctionAlert=null; render(); }
function goConfig(){ G.screen="config"; render(); }



/* ---------- PASE DE TEMPORADA ---------- */
/* Pase de temporada: cada recompensa se desbloquea al llegar a ese NIVEL DE CUENTA
   (el mismo número que se ve en el resto del perfil) — antes tenía su propia curva
   de XP aparte, y mostraba un "Nivel" distinto al de arriba para la misma XP. */
const PASS_LEVELS=[
  {lv:1, reward:{fichas:92}, label:"92 🪙"},
  {lv:2, reward:{fichas:104}, label:"104 🪙"},
  {lv:3, reward:{fichas:116}, label:"116 🪙"},
  {lv:4, reward:{fichas:128}, label:"128 🪙"},
  {lv:5, reward:{skin:"negra"}, label:"Skin Negra"},
  {lv:6, reward:{fichas:152}, label:"152 🪙"},
  {lv:7, reward:{fichas:164}, label:"164 🪙"},
  {lv:8, reward:{fichas:176}, label:"176 🪙"},
  {lv:9, reward:{fichas:188}, label:"188 🪙"},
  {lv:10, reward:{avatars:["🐉","🎩","⚡"],fichas:250}, label:"🐉🎩⚡ + 250 🪙"},
  {lv:11, reward:{fichas:212}, label:"212 🪙"},
  {lv:12, reward:{fichas:224}, label:"224 🪙"},
  {lv:13, reward:{fichas:236}, label:"236 🪙"},
  {lv:14, reward:{fichas:248}, label:"248 🪙"},
  {lv:15, reward:{tapete:"fieltroverde"}, label:"Tapete Fieltro Verde"},
  {lv:16, reward:{fichas:272}, label:"272 🪙"},
  {lv:17, reward:{fichas:284}, label:"284 🪙"},
  {lv:18, reward:{fichas:296}, label:"296 🪙"},
  {lv:19, reward:{fichas:308}, label:"308 🪙"},
  {lv:20, reward:{avatars:["🔥","❄","🌟"],fichas:300}, label:"🔥❄🌟 + 300 🪙"},
  {lv:21, reward:{fichas:332}, label:"332 🪙"},
  {lv:22, reward:{fichas:344}, label:"344 🪙"},
  {lv:23, reward:{fichas:356}, label:"356 🪙"},
  {lv:24, reward:{fichas:368}, label:"368 🪙"},
  {lv:25, reward:{fx:"explosion"}, label:"Efecto Explosión"},
  {lv:26, reward:{fichas:392}, label:"392 🪙"},
  {lv:27, reward:{fichas:404}, label:"404 🪙"},
  {lv:28, reward:{fichas:416}, label:"416 🪙"},
  {lv:29, reward:{fichas:428}, label:"428 🪙"},
  {lv:30, reward:{avatars:["💀","🦁","🤖"],fichas:350}, label:"💀🦁🤖 + 350 🪙"},
  {lv:31, reward:{fichas:452}, label:"452 🪙"},
  {lv:32, reward:{fichas:464}, label:"464 🪙"},
  {lv:33, reward:{fichas:476}, label:"476 🪙"},
  {lv:34, reward:{fichas:488}, label:"488 🪙"},
  {lv:35, reward:{soundfx:"suave"}, label:"Sonido Suave"},
  {lv:36, reward:{fichas:512}, label:"512 🪙"},
  {lv:37, reward:{fichas:524}, label:"524 🪙"},
  {lv:38, reward:{fichas:536}, label:"536 🪙"},
  {lv:39, reward:{fichas:548}, label:"548 🪙"},
  {lv:40, reward:{avatars:["🇺🇾","🐯","🐼"],fichas:400}, label:"🇺🇾🐯🐼 + 400 🪙"},
  {lv:41, reward:{fichas:572}, label:"572 🪙"},
  {lv:42, reward:{fichas:584}, label:"584 🪙"},
  {lv:43, reward:{fichas:596}, label:"596 🪙"},
  {lv:44, reward:{fichas:608}, label:"608 🪙"},
  {lv:45, reward:{skin:"circulo"}, label:"Skin Círculo"},
  {lv:46, reward:{fichas:632}, label:"632 🪙"},
  {lv:47, reward:{fichas:644}, label:"644 🪙"},
  {lv:48, reward:{fichas:656}, label:"656 🪙"},
  {lv:49, reward:{fichas:668}, label:"668 🪙"},
  {lv:50, reward:{avatars:["🦄","🦉","🐙"],fichas:450}, label:"🦄🦉🐙 + 450 🪙"},
  {lv:51, reward:{fichas:692}, label:"692 🪙"},
  {lv:52, reward:{fichas:704}, label:"704 🪙"},
  {lv:53, reward:{fichas:716}, label:"716 🪙"},
  {lv:54, reward:{fichas:728}, label:"728 🪙"},
  {lv:55, reward:{tapete:"fieltroazul"}, label:"Tapete Fieltro Azul"},
  {lv:56, reward:{fichas:752}, label:"752 🪙"},
  {lv:57, reward:{fichas:764}, label:"764 🪙"},
  {lv:58, reward:{fichas:776}, label:"776 🪙"},
  {lv:59, reward:{fichas:788}, label:"788 🪙"},
  {lv:60, reward:{avatars:["🦅","🐍","🥷"],fichas:500}, label:"🦅🐍🥷 + 500 🪙"},
  {lv:61, reward:{fichas:812}, label:"812 🪙"},
  {lv:62, reward:{fichas:824}, label:"824 🪙"},
  {lv:63, reward:{fichas:836}, label:"836 🪙"},
  {lv:64, reward:{fichas:848}, label:"848 🪙"},
  {lv:65, reward:{fx:"escarcha"}, label:"Efecto Escarcha"},
  {lv:66, reward:{fichas:872}, label:"872 🪙"},
  {lv:67, reward:{fichas:884}, label:"884 🪙"},
  {lv:68, reward:{fichas:896}, label:"896 🪙"},
  {lv:69, reward:{fichas:908}, label:"908 🪙"},
  {lv:70, reward:{avatars:["🧙","🎭","🍀"],fichas:550}, label:"🧙🎭🍀 + 550 🪙"},
  {lv:71, reward:{fichas:932}, label:"932 🪙"},
  {lv:72, reward:{fichas:944}, label:"944 🪙"},
  {lv:73, reward:{fichas:956}, label:"956 🪙"},
  {lv:74, reward:{fichas:968}, label:"968 🪙"},
  {lv:75, reward:{soundfx:"retro8bit"}, label:"Sonido Retro 8-bit"},
  {lv:76, reward:{fichas:992}, label:"992 🪙"},
  {lv:77, reward:{fichas:1004}, label:"1004 🪙"},
  {lv:78, reward:{fichas:1016}, label:"1016 🪙"},
  {lv:79, reward:{fichas:1028}, label:"1028 🪙"},
  {lv:80, reward:{avatars:["💎","🎯","🎲"],fichas:600}, label:"💎🎯🎲 + 600 🪙"},
  {lv:81, reward:{fichas:1052}, label:"1052 🪙"},
  {lv:82, reward:{fichas:1064}, label:"1064 🪙"},
  {lv:83, reward:{fichas:1076}, label:"1076 🪙"},
  {lv:84, reward:{fichas:1088}, label:"1088 🪙"},
  {lv:85, reward:{skin:"madera"}, label:"Skin Madera"},
  {lv:86, reward:{fichas:1112}, label:"1112 🪙"},
  {lv:87, reward:{fichas:1124}, label:"1124 🪙"},
  {lv:88, reward:{fichas:1136}, label:"1136 🪙"},
  {lv:89, reward:{fichas:1148}, label:"1148 🪙"},
  {lv:90, reward:{avatars:["🚀","🌙"],fichas:650}, label:"🚀🌙 + 650 🪙"},
  {lv:91, reward:{fichas:1172}, label:"1172 🪙"},
  {lv:92, reward:{fichas:1184}, label:"1184 🪙"},
  {lv:93, reward:{fichas:1196}, label:"1196 🪙"},
  {lv:94, reward:{fichas:1208}, label:"1208 🪙"},
  {lv:95, reward:{tapete:"fieltrorojo"}, label:"Tapete Fieltro Carmesí"},
  {lv:96, reward:{fichas:1232}, label:"1232 🪙"},
  {lv:97, reward:{fichas:1244}, label:"1244 🪙"},
  {lv:98, reward:{fichas:1256}, label:"1256 🪙"},
  {lv:99, reward:{fichas:1268}, label:"1268 🪙"},
  {lv:100, reward:{avatars:["🌈","🏆"],fichas:700}, label:"🌈🏆 + 700 🪙"},
];
// Misma curva que el servidor (xpForNextLevel en db.js): por décadas, cada banda de 10
// niveles apenas más cara que la anterior — alcanzable hasta el nivel 100 (antes, con
// crecimiento del 30% CADA nivel, pasado el ~30 se volvía prácticamente imposible).
function xpForNextLevel(level){ const bracket=Math.floor((level-1)/10); return 100+bracket*40+(level-1)*8; }
function levelFromXp(xp){
  let lvl=1, remaining=xp;
  while(remaining>=xpForNextLevel(lvl)){ remaining-=xpForNextLevel(lvl); lvl++; if(lvl>=100) break; }
  return {level:lvl, xpInLevel:remaining, xpForNext:xpForNextLevel(lvl)};
}
function addXP(n){
  P.xp=(P.xp||0)+n;
  const L=levelFromXp(P.xp);
  P.level=L.level; P.xpInLevel=L.xpInLevel; P.xpForNext=L.xpForNext;
  saveP();
}
function passLevel(){ return P.level||1; }
// Momento "recompensa" (§7 del pedido) — antes reclamar solo cambiaba el
// texto del botón sin ninguna celebración. Funciona para offline (inmediato)
// Y online (el server tarda en confirmar): se guarda qué nivel se está
// reclamando y el próximo render de esa pantalla dispara el efecto apenas
// detecta que ya quedó claimed de verdad, sea cual sea el camino.
function animateClaimBurst(lv){
  if(!window.gsap) return;
  if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const row=document.querySelector(`[data-lv="${lv}"]`);
  if(!row) return;
  gsap.fromTo(row,
    {scale:1, boxShadow:"0 0 0px rgba(251,191,36,0)"},
    {scale:1.045, boxShadow:"0 0 22px rgba(251,191,36,.7)", duration:.22, yoyo:true, repeat:1, ease:"power1.inOut"});
}
// Mismo festejo que animateClaimBurst, para cuando se compra/desbloquea algo
// en la tienda (§7: "desbloquear skin" es un evento grande explícito del pedido,
// y hoy comprar cualquier cosa en la tienda no tenía ninguna celebración).
function animateShopBurst(id){
  if(!window.gsap) return;
  if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const row=document.querySelector(`.shop-item[data-shop-id="${id}"]`);
  if(!row) return;
  gsap.fromTo(row,
    {scale:1, boxShadow:"0 0 0px rgba(52,211,153,0)"},
    {scale:1.03, boxShadow:"0 0 20px rgba(52,211,153,.65)", duration:.22, yoyo:true, repeat:1, ease:"power1.inOut"});
}
function claimPass(lv){
  const L=PASS_LEVELS.find(x=>x.lv===lv); if(!L) return;
  if(P.passClaimed[lv]||passLevel()<lv) return;
  G._pendingClaimFx=lv;
  if(Session.isAuthenticated()){ markClaiming("s"+lv); netSend({type:"claimPass", level:lv}); Sound.meld(); render(); return; }
  P.passClaimed[lv]=true;
  const r=L.reward;
  if(r.fichas) P.fichas+=r.fichas;
  if(r.skin&&!P.owned.includes(r.skin)) P.owned.push(r.skin);
  if(r.tapete&&!P.ownedTapetes.includes(r.tapete)) P.ownedTapetes.push(r.tapete);
  if(r.fx&&!P.ownedFx.includes(r.fx)) P.ownedFx.push(r.fx);
  if(r.soundfx&&!P.ownedSoundFx.includes(r.soundfx)) P.ownedSoundFx.push(r.soundfx);
  if(r.avatars){ P.ownedAvatars=P.ownedAvatars||FREE_AVATARS.slice(); r.avatars.forEach(a=>{ if(!P.ownedAvatars.includes(a)) P.ownedAvatars.push(a); }); }
  saveP(); Sound.meld(); render();
}
/* Etiqueta legible de una recompensa de pase, para el resumen de "Reclamar todo"
   — reusa los mismos lookups que ya existen (skinName, TAPETES, EFFECTS,
   SOUNDFX) en vez de inventar nombres nuevos. */
function passRewardLabel(r){
  if(r.skin) return "🎨 Skin "+skinName(r.skin);
  if(r.tapete){ const t=TAPETES.find(x=>x.id===r.tapete); return "🎲 Tapete "+(t?t.name:r.tapete); }
  if(r.fx){ const f=EFFECTS.find(x=>x.id===r.fx); return "💥 Efecto "+(f?f.name:r.fx); }
  if(r.soundfx){ const s=SOUNDFX_BY_ID[r.soundfx]; return "🔊 Sonido "+(s?s.name:r.soundfx); }
  if(r.avatars) return "🎭 "+r.avatars.join(" ")+" nuevos avatares";
  if(r.nameeffect){ const n=NAME_EFFECTS[r.nameeffect]; return "✨ Efecto de nombre "+(n?n.emoji+" "+n.label:r.nameeffect); }
  if(r.banner) return "🚩 Banner "+r.banner.replace(/_/g," ");
  return null;
}
/* "Reclamar todo" (Fase 12 §13): reclama en un solo toque TODAS las recompensas
   del Pase que ya están desbloqueadas y sin reclamar — reusa claimPass() level
   por level (mismo camino online/offline que ya usa el botón individual, no un
   protocolo nuevo) y arma un resumen ANTES de reclamar (con los datos, que son
   deterministas — la tabla PASS_LEVELS es la misma que ya valida el server)
   para no depender de esperar confirmaciones de red una por una. Nada de 15
   animaciones seguidas: una sola tarjeta de resumen con un único pulso. */
function claimAllPass(){
  const lvl=passLevel();
  const claimable=PASS_LEVELS.filter(L=>lvl>=L.lv && !P.passClaimed[L.lv]);
  if(!claimable.length) return;
  let fichas=0; const items=[];
  claimable.forEach(L=>{
    if(L.reward.fichas) fichas+=L.reward.fichas;
    const label=passRewardLabel(L.reward);
    if(label) items.push(label);
  });
  claimable.forEach(L=>claimPass(L.lv));
  G.claimAllSummary={fichas, items, count:claimable.length, kind:"pase"};
  render();
}
function closeClaimAllSummary(){ G.claimAllSummary=null; render(); }
// Recuerda desde dónde se abrió el pase (menú o perfil) para que "← Volver"
// vuelva ahí y no siempre a Perfil — antes perdías el lugar de origen si
// entrabas desde el destacado del menú (Fase 11, reportado por el usuario).
// Fase 11 §6: el Pase de temporada ya no es una pantalla propia — es un tab
// más dentro del hub de Perfil (goProfileTab más abajo). goPass() se mantiene
// como punto de entrada único (lo usan el menú y otros lugares) para no tener
// que tocar cada call site — ya no hace falta recordar "de dónde vine"
// (G.passReturnTo) porque ya no se sale de pantalla, solo cambia el tab.
function goPass(){ G.screen="profile"; G.profileTab="pase"; render(); }
function claimAllBannerHTML(count, onclickAttr){
  if(!count) return "";
  return `<div class="claim-all-banner">
    <span>🎁 ${count} recompensa${count===1?"":"s"} disponible${count===1?"":"s"}</span>
    <button class="btn-sm" onclick="${onclickAttr}">Reclamar todo</button>
  </div>`;
}
/* Resumen de "Reclamar todo": UNA sola tarjeta con un único pulso de entrada
   (a-pop), no una animación por recompensa — pedido explícito (§13: "no
   reproducir 15 animaciones... podemos mostrar un resumen"). */
function claimAllSummaryHTML(s){
  return `<div class="pauseovl" onclick="if(event.target===this)closeClaimAllSummary()">
    <div class="pausecard claim-all-summary a-pop" style="text-align:center">
      <div style="font-size:40px;margin-bottom:6px">🎁</div>
      <h2 style="font-family:var(--font-heading);color:#ffe9a8;font-size:19px;margin-bottom:10px">Recompensas reclamadas</h2>
      <div style="display:flex;flex-direction:column;gap:6px;text-align:left;margin-bottom:16px">
        ${s.fichas?`<div style="font-size:14px;font-weight:800;color:#ffe9a8">🪙 +${s.fichas.toLocaleString("es-UY")}</div>`:""}
        ${s.items.map(i=>`<div style="font-size:13px;color:rgba(232,238,247,.85)">${i}</div>`).join("")}
      </div>
      <button class="btn btn-gold" onclick="closeClaimAllSummary()">¡Genial!</button>
    </div>
  </div>`;
}
function profileTabPaseHTML(){
  const lvl=passLevel();
  const xpInLevel=P.xpInLevel||0, xpForNext=P.xpForNext||xpForNextLevel(lvl);
  const claimableCount=PASS_LEVELS.filter(L=>lvl>=L.lv && !P.passClaimed[L.lv]).length;
  return `
      <p style="text-align:center;font-size:12px;color:rgba(232,238,247,.55);margin-bottom:4px">Nivel <b style="color:#ffe9a8">${lvl}</b> · ${xpInLevel} / ${xpForNext} XP para el próximo nivel</p>
      <p style="text-align:center;font-size:10px;color:rgba(232,238,247,.4);margin-bottom:12px">El mismo Nivel de tu perfil — subís jugando cualquier partida. Ganás XP jugando: +100 por partida competitiva, +150 extra si ganás, +50 por nivel de racha 🔥</p>
      ${claimAllBannerHTML(claimableCount,"claimAllPass()")}
      ${PASS_LEVELS.map(L=>{
        const unlocked=lvl>=L.lv, claimed=!!P.passClaimed[L.lv];
        const isMilestone=!!L.reward.avatars;
        const state=claimed?"claimed":unlocked?"unlocked":isMilestone?"milestone":"locked";
        return `<div class="reward-row" data-lv="${L.lv}" data-state="${state}">
          <span style="font-size:16px;font-weight:800;width:28px;text-align:center;color:${unlocked?"#ffe9a8":"inherit"}">${L.lv}</span>
          <div style="flex:1"><div style="font-size:12.5px;font-weight:800">${isMilestone?"🎖 Hito: ":""}${L.label}</div><div style="font-size:10px;color:rgba(232,238,247,.5)">Nivel ${L.lv}</div></div>
          ${claimed?'<span style="font-size:12px;color:#34d399;font-weight:800">✔ Reclamado</span>'
            :unlocked?(G._claiming&&G._claiming["s"+L.lv]?`<button class="shop-btn" data-state="owned" disabled>⏳ Reclamando…</button>`:`<button class="shop-btn" data-state="owned" onclick="claimPass(${L.lv})">Reclamar</button>`)
            :'<span style="font-size:14px">🔒</span>'}
        </div>`;
      }).join("")}`;
}

/* ================================================================
   PASE GALÁCTICO — progreso APARTE del pase de arriba, solo sube jugando
   Modo Galáctico. Recompensas exclusivas: efectos de nombre, banners y una
   skin de fichas — nunca comprables con monedas. Debe coincidir EXACTAMENTE
   con GALACTICO_PASS_LEVELS en server/db.js (mismos niveles y recompensas).
   ================================================================ */
const NAME_EFFECTS={
  fuego:  {emoji:"🔥", label:"Fuego",         css:"name-fx-fuego"},
  hielo:  {emoji:"❄",  label:"Hielo",         css:"name-fx-hielo"},
  plasma: {emoji:"⚡", label:"Plasma",        css:"name-fx-plasma"},
  vacio:  {emoji:"🌌", label:"Vacío Cósmico", css:"name-fx-vacio"},
};
const BANNERS={
  aureola_dorada: {emoji:"🟡", label:"Aureola Dorada", css:"banner-aureola"},
  anillo_plasma:  {emoji:"🔵", label:"Anillo de Plasma", css:"banner-plasma"},
  // [Torre — bloque 3] Exclusivo de Torre III piso 9, no del Pase Galáctico
  // — mismo catálogo/UI de equipar igual (ver profileTabGalacticoHTML).
  corona_dorada:  {emoji:"👑", label:"Corona Dorada", css:"banner-aureola"},
};
// [Torre — bloque 3] Primer contenido real de la categoría "title" del
// reward engine (existía en el esquema desde antes, nunca se había usado).
// Todos exclusivos de Torre — ninguno se compra ni se gana de otra forma.
const TITLES={
  ascendente: {label:"Ascendente", desc:"Completaste la Torre Violeta esta semana."},
  guardian_carmesi: {label:"Guardián Carmesí", desc:"Piso 9 de la Torre Roja."},
  forjado_en_fuego: {label:"Forjado en Fuego", desc:"Completaste la Torre Roja esta semana."},
  leyenda_dorada: {label:"Leyenda Dorada", desc:"Completaste la Torre Dorada esta semana."},
  conquistador_de_la_torre: {label:"Conquistador de la Torre", desc:"Completaste las 3 Torres en la misma semana — muy pocos lo logran."},
};
function equipTitle(key){
  if(key!=="none"&&!(P.ownedTitles||[]).includes(key)) return;
  if(!Session.isAuthenticated()){ setMsg("Necesitás estar conectado."); render(); return; }
  netSend({type:"setActive", kind:"title", id:key}); Sound.select();
}
const GALACTICO_PASS_LEVELS=[
  {lv:2,  reward:{coins:100}, label:"100 🪙"},
  {lv:3,  reward:{nameeffect:"fuego"}, label:"Efecto de nombre: 🔥 Fuego"},
  {lv:4,  reward:{coins:120}, label:"120 🪙"},
  {lv:5,  reward:{banner:"aureola_dorada"}, label:"Banner: 🟡 Aureola Dorada"},
  {lv:6,  reward:{coins:140}, label:"140 🪙"},
  {lv:7,  reward:{nameeffect:"hielo"}, label:"Efecto de nombre: ❄ Hielo"},
  {lv:8,  reward:{coins:160}, label:"160 🪙"},
  {lv:9,  reward:{skin:"agujero_negro"}, label:"Skin: Agujero Negro"},
  {lv:10, reward:{coins:200}, label:"200 🪙"},
  {lv:11, reward:{nameeffect:"plasma"}, label:"Efecto de nombre: ⚡ Plasma"},
  {lv:12, reward:{coins:220}, label:"220 🪙"},
  {lv:13, reward:{banner:"anillo_plasma"}, label:"Banner: 🔵 Anillo de Plasma"},
  {lv:14, reward:{coins:260}, label:"260 🪙"},
  {lv:15, reward:{nameeffect:"vacio",coins:400}, label:"Efecto de nombre: 🌌 Vacío + 400 🪙"},
];
function galacticoPassLevel(){ return P.galacticoLevel||1; }
// Envuelve un nombre con su efecto (si el jugador tiene uno equipado) — se usa
// tanto para el propio (P.nameeffect) como para cualquiera de G.players (p.nameeffect).
function nameEffectHTML(name, effectKey){
  const fx=effectKey&&NAME_EFFECTS[effectKey];
  return fx?`<span class="${fx.css}">${esc(name)}</span>`:esc(name);
}
function bannerClass(bannerKey){
  const b=bannerKey&&BANNERS[bannerKey];
  return b?b.css:"";
}
function claimGalacticoPass(lv){
  const L=GALACTICO_PASS_LEVELS.find(x=>x.lv===lv); if(!L) return;
  if((P.galacticoClaimed||{})[lv]||galacticoPassLevel()<lv) return;
  if(!Session.isAuthenticated()){ setMsg("El Pase Galáctico necesita estar conectado."); render(); return; }
  G._pendingClaimFx=lv;
  markClaiming("g"+lv);
  netSend({type:"claimGalacticoPass", level:lv}); Sound.meld(); render();
}
// Marca un nivel de pase como "reclamando" (esperando la respuesta del
// servidor) para que el botón muestre feedback inmediato en vez de parecer que
// no pasó nada mientras Render responde. Se limpia solo cuando llega el
// "profile" actualizado, o a los 8s por si la respuesta se perdió.
function markClaiming(key){
  G._claiming=G._claiming||{};
  G._claimingTimers=G._claimingTimers||{};
  G._claiming[key]=true;
  clearTimeout(G._claimingTimers[key]);
  G._claimingTimers[key]=setTimeout(()=>{ if(G._claiming){ delete G._claiming[key]; render(); } },8000);
}
function clearClaiming(){
  if(G._claiming&&Object.keys(G._claiming).length){ G._claiming={}; }
  if(G._claimingTimers){ Object.values(G._claimingTimers).forEach(t=>clearTimeout(t)); G._claimingTimers={}; }
}
/* Mismo patrón que markClaiming/clearClaiming, para las acciones de sala
   (crear/unirse/listo/iniciar) — antes ninguna de las 4 mostraba nada entre
   el click y la respuesta del servidor, así que en una conexión lenta el
   botón parecía no hacer nada. Se limpia solo con la respuesta real
   ("joined"/"state"/"error") o a los 9s por si se perdió. */
function markLobbyPending(key){
  G._lobbyPending=key;
  clearTimeout(G._lobbyPendingTimer);
  G._lobbyPendingTimer=setTimeout(()=>{ G._lobbyPending=null; render(); },9000);
}
function clearLobbyPending(){
  if(G._lobbyPending){ G._lobbyPending=null; clearTimeout(G._lobbyPendingTimer); }
}
/* Mismo "Reclamar todo" que el pase normal (ver claimAllPass) — acá cada nivel
   SIEMPRE pasa por el servidor (claimGalacticoPass no tiene camino offline), así
   que el resumen que se muestra es una PREDICCIÓN a partir de la misma tabla
   que ya valida el server (GALACTICO_PASS_LEVELS), no algo que ya se aplicó —
   coherente con que reclamar un nivel individual tampoco espera confirmación
   visual del server hoy (usa G._pendingClaimFx igual). */
function claimAllGalacticoPass(){
  if(!Session.isAuthenticated()){ setMsg("El Pase Galáctico necesita estar conectado."); render(); return; }
  const lvl=galacticoPassLevel(), claimed=P.galacticoClaimed||{};
  const claimable=GALACTICO_PASS_LEVELS.filter(L=>lvl>=L.lv && !claimed[L.lv]);
  if(!claimable.length) return;
  let fichas=0; const items=[];
  claimable.forEach(L=>{
    if(L.reward.coins) fichas+=L.reward.coins;
    const label=passRewardLabel(L.reward);
    if(label) items.push(label);
  });
  claimable.forEach(L=>claimGalacticoPass(L.lv));
  G.claimAllSummary={fichas, items, count:claimable.length, kind:"galactico"};
  render();
}
function equipNameEffect(key){
  if(key!=="none"&&!(P.ownedNameEffects||[]).includes(key)) return;
  if(!Session.isAuthenticated()){ setMsg("Necesitás estar conectado."); render(); return; }
  netSend({type:"setActive", kind:"nameeffect", id:key}); Sound.select();
}
function equipBanner(key){
  if(key!=="none"&&!(P.ownedBanners||[]).includes(key)) return;
  if(!Session.isAuthenticated()){ setMsg("Necesitás estar conectado."); render(); return; }
  netSend({type:"setActive", kind:"banner", id:key}); Sound.select();
}
// Fase 11 §6/§11 (pedido explícito): antes esto vivía pegado a "crear/entrar
// a una sala" — un pase de PROGRESO no tiene por qué depender de estar en el
// flujo de conectar a una sala. Ahora es un tab más del hub de Perfil, igual
// que el Pase de temporada. netConnect (el hub de Modo Galáctico) sigue
// mostrando el nivel como referencia rápida antes de entrar a jugar — ver
// más abajo — pero administrar/reclamar el pase vive acá.
function goGalacticoPass(){ G.screen="profile"; G.profileTab="galactico"; render(); }
function profileTabGalacticoHTML(){
  const lvl=galacticoPassLevel();
  const xpInLevel=P.galacticoXpInLevel||0, xpForNext=P.galacticoXpForNext||80;
  const claimed=P.galacticoClaimed||{};
  const ownedFx=P.ownedNameEffects||[], ownedBn=P.ownedBanners||[];
  const claimableCount=GALACTICO_PASS_LEVELS.filter(L=>lvl>=L.lv && !claimed[L.lv]).length;
  return `
      <p style="text-align:center;font-size:12px;color:rgba(232,238,247,.55);margin-bottom:4px">Nivel <b style="color:#e9d5ff">${lvl}</b>${lvl<15?` · ${xpInLevel} / ${xpForNext} XP para el próximo nivel`:" · ¡Completo!"}</p>
      <p style="text-align:center;font-size:10px;color:rgba(232,238,247,.4);margin-bottom:12px">Sube SOLO jugando Modo Galáctico: +30 XP por partida terminada, +50 extra si ganás.</p>
      ${claimAllBannerHTML(claimableCount,"claimAllGalacticoPass()")}
      ${GALACTICO_PASS_LEVELS.map(L=>{
        const unlocked=lvl>=L.lv, isClaimed=!!claimed[L.lv];
        const state=isClaimed?"claimed":unlocked?"unlocked":"locked";
        return `<div class="reward-row is-galactic" data-lv="${L.lv}" data-state="${state}">
          <span style="font-size:16px;font-weight:800;width:28px;text-align:center;color:${unlocked?"#e9d5ff":"inherit"}">${L.lv}</span>
          <div style="flex:1"><div style="font-size:12.5px;font-weight:800">${esc(L.label)}</div></div>
          ${isClaimed?'<span style="font-size:12px;color:#34d399;font-weight:800">✔ Reclamado</span>'
            :unlocked?(G._claiming&&G._claiming["g"+L.lv]?`<button class="shop-btn" style="background:linear-gradient(180deg,#a855f7,#6b21a8);color:#fff" disabled>⏳ Reclamando…</button>`:`<button class="shop-btn" style="background:linear-gradient(180deg,#a855f7,#6b21a8);color:#fff" onclick="claimGalacticoPass(${L.lv})">Reclamar</button>`)
            :'<span style="font-size:14px">🔒</span>'}
        </div>`;
      }).join("")}
      ${(ownedFx.length||ownedBn.length)?`
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(168,85,247,.3)">
        <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(216,180,254,.7);margin-bottom:8px;text-align:center">Equipar</div>
        ${ownedFx.length?`
        <div style="font-size:10px;color:rgba(232,238,247,.55);margin-bottom:5px">Efecto de nombre:</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px">
          <button class="btn-sm" style="border-radius:7px;background:${!P.nameeffect?"rgba(168,85,247,.35)":"rgba(255,255,255,.08)"};color:#e8eef7" onclick="equipNameEffect('none')">Ninguno</button>
          ${ownedFx.map(k=>{const fx=NAME_EFFECTS[k]; return `<button class="btn-sm" style="border-radius:7px;background:${P.nameeffect===k?"rgba(168,85,247,.35)":"rgba(255,255,255,.08)"};color:#e8eef7" onclick="equipNameEffect('${k}')">${fx.emoji} ${esc(fx.label)}</button>`;}).join("")}
        </div>`:""}
        ${ownedBn.length?`
        <div style="font-size:10px;color:rgba(232,238,247,.55);margin-bottom:5px">Banner:</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px">
          <button class="btn-sm" style="border-radius:7px;background:${!P.banner?"rgba(168,85,247,.35)":"rgba(255,255,255,.08)"};color:#e8eef7" onclick="equipBanner('none')">Ninguno</button>
          ${ownedBn.map(k=>{const b=BANNERS[k]; return `<button class="btn-sm" style="border-radius:7px;background:${P.banner===k?"rgba(168,85,247,.35)":"rgba(255,255,255,.08)"};color:#e8eef7" onclick="equipBanner('${k}')">${b.emoji} ${esc(b.label)}</button>`;}).join("")}
        </div>`:""}
      </div>`:""}`;
}

function goRangos(){ G.screen="profile"; G.profileTab="rangos"; render(); }
function profileTabRangosHTML(){
  const myTier=tierOf(P.rankPts);
  return `
      <p style="text-align:center;font-size:12px;color:rgba(232,238,247,.55);margin-bottom:14px">Tu rango sube o baja jugando partidas <b style="color:#ffe9a8">Ranked</b> — cada rango necesita esta cantidad de puntos.</p>
      ${TIERS.map((t,i)=>{
        const isMine=t.name===myTier.name;
        const next=TIERS[i+1];
        return `<div class="reward-row"${isMine?' data-state="current"':""} style="padding:10px 12px">
          ${tierBadgeHTML(t,34)}
          <div style="flex:1">
            <div style="font-weight:800;font-size:14px;color:${isMine?"#ffe9a8":"#e8eef7"}">${esc(t.name)}${isMine?" · vos":""}</div>
            <div style="font-size:10.5px;color:rgba(232,238,247,.5)">${t.min} pts${next?" — "+(next.min-t.min)+" para el siguiente":" en adelante"}</div>
          </div>
        </div>`;
      }).join("")}`;
}


const TAPETES=[
  {id:"clasico",     name:"Mesa oscura",       desc:"El tapete de siempre",  price:0},
  {id:"fieltroverde",name:"Fieltro verde",     desc:"Clásico casino",        price:1200},
  {id:"fieltroazul", name:"Fieltro azul",      desc:"Frío y elegante",       price:1200},
  {id:"fieltrorojo", name:"Fieltro carmesí",   desc:"Alto voltaje",          price:1500},
  {id:"caoba",       name:"Madera caoba",      desc:"Mesa de club privado",  price:2000},
  {id:"marmol",      name:"Mármol",            desc:"Lujo frío",             price:2800},
  {id:"dorado",      name:"Salón dorado",      desc:"Puro brillo",           price:3500},
  {id:"neon",        name:"Grilla neón",       desc:"Futurista",             price:4000},
  {id:"esmeraldatp", name:"Fieltro esmeralda", desc:"Verde profundo de club",price:2400},
  {id:"medianoche",  name:"Medianoche estelar",desc:"Azul noche con estrellas",price:3000},
  {id:"cobre",       name:"Cobre Real",        desc:"Metal cálido y elegante",price:3800},
  {id:"purpura",     name:"Terciopelo Púrpura",desc:"Sala VIP",              price:3200},
  {id:"onix",        name:"Ónix Negro",        desc:"Elegancia oscura",      price:2900},
  {id:"coral",       name:"Coral Tropical",    desc:"Aguas turquesas",       price:2600},
  {id:"artico",      name:"Ártico",            desc:"Hielo bajo las estrellas",price:3100},
  {id:"bambu",       name:"Bambú Zen",         desc:"Jardín japonés",        price:2200},
  {id:"vitral",      name:"Vitral",            desc:"Vidrio de colores",     price:3600},
  // [Torre — bloque 3] Nuevo, real y comprable (no exclusivo) — también
  // puede tocar en un cofre épico de Torre (ver server/db.js TOWER_CHEST_LOOT).
  {id:"brasas",      name:"Brasas",            desc:"Ascuas ardientes",      price:2600},
];
function buyTapete(id){
  const t=TAPETES.find(x=>x.id===id); if(!t) return;
  if(Session.isAuthenticated()){
    if((P.ownedTapetes||[]).includes(id)) netSend({type:"setActive",kind:"tapete",id});
    else if(P.fichas<t.price){ Sound.error(); setMsg("No te alcanzan las monedas."); render(); }
    else { G._pendingShopFx=id; Sound.meld(); netSend({type:"buyItem",kind:"tapete",id}); }
    return;
  }
  if(P.ownedTapetes.includes(id)){ P.tapete=id; saveP(); Sound.select(); return render(); }
  if(P.fichas<t.price){ Sound.error(); return render(); }
  G._pendingShopFx=id;
  P.fichas-=t.price; P.ownedTapetes.push(id); P.tapete=id; saveP(); Sound.meld(); render();
}

function goShop(){ G.screen="shop"; render(); }
function goProfile(tab){ G.screen="profile"; G.profileTab=tab||"perfil"; render(); }
function buySkin(id){
  const s=SKINS.find(x=>x.id===id); if(!s) return;
  if(Session.isAuthenticated()){
    if(P.owned.includes(id)) netSend({type:"setActive",kind:"skin",id});
    else if(s.season&&!isSkinInSeason(s)){ Sound.error(); setMsg("Esta skin es de temporada — no está disponible ahora."); render(); }
    else if(P.fichas<s.price){ Sound.error(); setMsg("No te alcanzan las monedas."); render(); }
    else { G._pendingShopFx=id; Sound.meld(); netSend({type:"buyItem",kind:"skin",id}); }
    return;
  }
  if(P.owned.includes(id)){ P.skin=id; saveP(); Sound.select(); return render(); }
  if(s.season&&!isSkinInSeason(s)){ Sound.error(); return render(); }
  if(P.fichas<s.price){ Sound.error(); return render(); }
  G._pendingShopFx=id;
  P.fichas-=s.price; P.owned.push(id); P.skin=id; saveP(); Sound.meld(); render();
}
var shopTab="skins";
function previewSkin(id){
  G.skinPreview=G.skinPreview===id?null:id;
  Sound.select();
  render();
}
function renderShop(app){
  const MONTH_NAMES=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  // Compartido por las 5 filas de abajo: mismo criterio de estado del botón
  // (activo / poseído-para-usar / comprable / no-alcanza) en toda la tienda.
  const shopBtnState=(owned,active,price)=>active?"active":owned?"owned":P.fichas>=price?"buy":"locked";
  const shopBtnLabel=(owned,active)=>active?"✔":owned?"Usar":"Comprar";
  const skinRow=(s)=>{
    const owned=P.owned.includes(s.id), active=P.skin===s.id;
    const inSeason=isSkinInSeason(s);
    if(s.season&&!inSeason&&!owned) return ""; // fuera de temporada y no la tenés: no se muestra
    if((s.passOnly||s.sourceOnly)&&!owned) return ""; // exclusiva (Pase Galáctico o Torre): no se vende, no se muestra hasta tenerla
    const seasonTag=s.season?`<span style="font-size:9px;font-weight:800;color:#f472b6;background:rgba(244,114,182,.15);border:1px solid rgba(244,114,182,.4);border-radius:5px;padding:1px 5px;margin-left:5px">🎁 Edición limitada</span>`:"";
    const priceLine=owned?(active?"En uso":"Comprada")+seasonTag:"🪙 "+s.price+(s.season?" · solo en "+MONTH_NAMES[s.season[0]-1]:"");
    return `<div class="shop-item${active?" is-active":""}${G.skinPreview===s.id?" is-previewing":""}" data-shop-id="${s.id}">
      <div class="sk-${s.id}" style="display:flex;gap:2px;flex-shrink:0">
        ${[{color:"rojo",number:7,joker:false},{color:"azul",number:3,joker:false},{color:"verde",number:11,joker:false},{color:"comodin",number:null,joker:true}].map(t=>tileHTML(t,"","width:24px;height:33px;font-size:11px")).join("")}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:800">${s.name}${!owned?seasonTag:""}</div>
        <div style="font-size:10px;color:rgba(232,238,247,.5)">${priceLine}</div>
      </div>
      <button class="shop-btn-ghost" onclick="previewSkin('${s.id}')" title="Vista previa">👁</button>
      <button class="shop-btn" data-state="${shopBtnState(owned,active,s.price)}" onclick="buySkin('${s.id}')">${shopBtnLabel(owned,active)}</button>
    </div>`;
  };
  const skinPreviewHTML=()=>{
    const s=SKINS.find(x=>x.id===G.skinPreview);
    if(!s) return "";
    const owned=P.owned.includes(s.id), active=P.skin===s.id;
    const priceLine=owned?(active?"En uso":"Comprada"):"🪙 "+s.price+(s.season?" · solo en "+MONTH_NAMES[s.season[0]-1]:"");
    const previewTiles=[{color:"rojo",number:7,joker:false},{color:"azul",number:3,joker:false},{color:"verde",number:11,joker:false},{color:"amarillo",number:9,joker:false},{color:"comodin",number:null,joker:true}];
    return `<div class="shop-skin-preview">
      <button class="card-x" style="position:absolute;top:8px;right:8px" onclick="previewSkin('${s.id}')" title="Cerrar vista previa">✕</button>
      <div class="sk-${s.id}" style="display:flex;gap:8px;justify-content:center">
        ${previewTiles.map(t=>tileHTML(t,"","width:var(--tile-size-preview);height:var(--tile-size-preview-h);font-size:24px")).join("")}
      </div>
      <div style="text-align:center;margin-top:10px">
        <div style="font-size:15px;font-weight:800;color:#ffe9a8">${s.name}</div>
        <div style="font-size:11px;color:rgba(232,238,247,.55);margin-top:2px">${priceLine}</div>
      </div>
      <button class="shop-btn" style="display:block;margin:10px auto 0;padding:7px 22px" data-state="${shopBtnState(owned,active,s.price)}" onclick="buySkin('${s.id}')">${shopBtnLabel(owned,active)}</button>
    </div>`;
  };
  const tapeteRow=(t)=>{
    const owned=(P.ownedTapetes||[]).includes(t.id), active=P.tapete===t.id;
    return `<div class="shop-item${active?" is-active":""}" data-shop-id="${t.id}">
      <div class="tp-${t.id}" style="width:36px;height:26px;border-radius:5px;overflow:hidden;flex-shrink:0"><div class="mesa" style="margin:0;height:100%;border:none;border-radius:5px"></div></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:800">${t.name}</div>
        <div style="font-size:10px;color:rgba(232,238,247,.5)">${t.desc} · ${owned?(active?"En uso":""):"🪙 "+t.price}</div>
      </div>
      <button class="shop-btn" data-state="${shopBtnState(owned,active,t.price)}" onclick="buyTapete('${t.id}')">${shopBtnLabel(owned,active)}</button>
    </div>`;
  };
  const fxRow=(f)=>{
    const owned=(P.ownedFx||[]).includes(f.id), active=P.effect===f.id;
    // Exclusivo de Torre (v1.3, ej. torre_celestial): no se compra con monedas —
    // se otorga solo al superar el piso 10. Si no lo tenés, ni preview ni compra;
    // si ya lo tenés, se equipa igual que cualquier otro efecto.
    if(f.sourceOnly && !owned){
      return `<div class="shop-item" data-shop-id="${f.id}" style="--fx-rgb:251,191,36;opacity:.6">
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:800">${f.name}</div>
          <div style="font-size:10px;color:rgba(232,238,247,.5)">${f.desc} · 🔒 ${f.sourceOnly}</div>
        </div>
        <button class="shop-btn" data-state="locked" disabled title="${f.sourceOnly}">🔒</button>
      </div>`;
    }
    return `<div class="shop-item${active?" is-active":""}" data-shop-id="${f.id}" style="--fx-rgb:56,189,248">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:800">${f.name}</div>
        <div style="font-size:10px;color:rgba(232,238,247,.5)">${f.desc} · ${owned?(active?"En uso":(f.sourceOnly?"✔ Obtenido":"")):"🪙 "+f.price}</div>
      </div>
      <button class="shop-btn-ghost" onclick="previewFx('${f.id}')" title="Vista previa">👁</button>
      <button class="shop-btn" data-state="${f.sourceOnly?(active?"active":"owned"):shopBtnState(owned,active,f.price)}" onclick="buyEffect('${f.id}')">${f.sourceOnly?(active?"✔":"Usar"):shopBtnLabel(owned,active)}</button>
    </div>`;
  };
  const sfxRow=(f)=>{
    const owned=(P.ownedSoundFx||[]).includes(f.id), active=P.soundfx===f.id;
    return `<div class="shop-item${active?" is-active":""}" data-shop-id="${f.id}" style="--fx-rgb:52,211,153">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:800">${f.name}</div>
        <div style="font-size:10px;color:rgba(232,238,247,.5)">${f.desc} · ${owned?(active?"En uso":""):"🪙 "+f.price}</div>
      </div>
      <button class="shop-btn-ghost" onclick="previewSoundFx('${f.id}')" title="Escuchar">🔊</button>
      <button class="shop-btn" data-state="${shopBtnState(owned,active,f.price)}" onclick="buySoundFx('${f.id}')">${shopBtnLabel(owned,active)}</button>
    </div>`;
  };
  const trailRow=(f)=>{
    const owned=(P.ownedTrails||[]).includes(f.id), active=P.trail===f.id;
    if(f.passOnly&&!owned) return ""; // exclusiva de un Pase: no se vende con monedas
    const passTag=f.passOnly?`<span style="font-size:9px;font-weight:800;color:#e9d5ff;background:rgba(168,85,247,.2);border:1px solid rgba(168,85,247,.45);border-radius:5px;padding:1px 6px;margin-left:5px">🔒 Del Pase</span>`:"";
    return `<div class="shop-item${active?" is-active":""}" data-shop-id="${f.id}" style="--fx-rgb:168,85,247">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:800">${f.name}${passTag}</div>
        <div style="font-size:10px;color:rgba(232,238,247,.5)">${f.desc} · ${owned?(active?"En uso":""):"🪙 "+f.price}</div>
      </div>
      <button class="shop-btn-ghost" onclick="previewTrail('${f.id}')" title="Vista previa">👁</button>
      <button class="shop-btn" data-state="${shopBtnState(owned,active,f.price)}" onclick="buyTrail('${f.id}')">${shopBtnLabel(owned,active)}</button>
    </div>`;
  };
  const tabs=[["skins","🀄 Skins"],["tapetes","🎲 Tapetes"],["efectos","💥 Efectos"],["estelas","☄ Estelas"],["sonidos","🔊 Sonidos"]];
  app.innerHTML=`
  <div class="screen-center"><div class="card shop-card ${G._enterCls}" style="max-height:90dvh;overflow:hidden;display:flex;flex-direction:column">
    <button class="card-x card-x-sticky" onclick="goMenu()" title="Cerrar">✕</button>
    <h2 style="font-family:var(--font-display);color:#ffe9a8;font-size:22px;text-align:center;margin-bottom:2px">Tienda</h2>
    <p style="text-align:center;font-size:12px;color:rgba(232,238,247,.55);margin-bottom:10px">🪙 <b style="color:#ffe9a8">${P.fichas}</b> fichas</p>
    <div class="shop-tabs">${tabs.map(([id,label])=>`<button class="${shopTab===id?"active":""}" onclick="shopTab='${id}';render()">${label}</button>`).join("")}</div>
    ${shopTab==="skins"?skinPreviewHTML():""}
    <div class="shop-content" data-preserve-scroll="shop-${shopTab}">
      <div class="shop-grid">
        ${shopTab==="skins"?SKINS.map(skinRow).join(""):""}
        ${shopTab==="tapetes"?TAPETES.map(tapeteRow).join(""):""}
        ${shopTab==="efectos"?EFFECTS.map(fxRow).join(""):""}
        ${shopTab==="estelas"?TRAILS.map(trailRow).join(""):""}
        ${shopTab==="sonidos"?SOUNDFX.map(sfxRow).join(""):""}
      </div>
    </div>
  </div></div>`;
  if(G._pendingShopFx){
    const id=G._pendingShopFx;
    const nowOwned=P.owned.includes(id)||(P.ownedTapetes||[]).includes(id)||(P.ownedFx||[]).includes(id)||(P.ownedTrails||[]).includes(id)||(P.ownedSoundFx||[]).includes(id);
    if(nowOwned){ G._pendingShopFx=null; setTimeout(()=>animateShopBurst(id),0); }
  }
}

function buyEffect(id){
  const f=EFFECTS.find(x=>x.id===id); if(!f) return;
  if(Session.isAuthenticated()){
    if((P.ownedFx||[]).includes(id)) netSend({type:"setActive",kind:"effect",id});
    else if(f.sourceOnly){ Sound.error(); setMsg(f.name+" se gana en "+f.sourceOnly+", no se compra."); render(); }
    else if(P.fichas<f.price){ Sound.error(); setMsg("No te alcanzan las monedas."); render(); }
    else { G._pendingShopFx=id; Sound.meld(); netSend({type:"buyItem",kind:"effect",id}); }
    return;
  }
  if(P.ownedFx.includes(id)){ P.effect=id; saveP(); Sound.select(); return render(); }
  if(f.sourceOnly) return render();
  if(P.fichas<f.price){ Sound.error(); return render(); }
  G._pendingShopFx=id;
  P.fichas-=f.price; P.ownedFx.push(id); P.effect=id; saveP(); Sound.meld(); render();
}
function previewFx(id){
  Sound.init(); Sound.meld();
  spawnParticles(id);
  // añadir clase de shake al app para el efecto
  const app=document.querySelector("#app");
  if(app){ app.classList.add("a-shake"); setTimeout(()=>app.classList.remove("a-shake"),400); }
}
function buyTrail(id){
  const f=TRAILS.find(x=>x.id===id); if(!f) return;
  if(Session.isAuthenticated()){
    if((P.ownedTrails||[]).includes(id)) netSend({type:"setActive",kind:"trail",id});
    else if(f.passOnly){ Sound.error(); setMsg("Esa estela se gana subiendo de nivel en el Pase."); render(); }
    else if(P.fichas<f.price){ Sound.error(); setMsg("No te alcanzan las monedas."); render(); }
    else { G._pendingShopFx=id; Sound.meld(); netSend({type:"buyItem",kind:"trail",id}); }
    return;
  }
  if(P.ownedTrails.includes(id)){ P.trail=id; saveP(); Sound.select(); return render(); }
  if(f.passOnly){ Sound.error(); return render(); }
  if(P.fichas<f.price){ Sound.error(); return render(); }
  G._pendingShopFx=id;
  P.fichas-=f.price; P.ownedTrails.push(id); P.trail=id; saveP(); Sound.meld(); render();
}
/* Vista previa de una estela: un par de fichas de mentira volando en el centro
   de la pantalla, mismo motor que usa la jugada real (FLY_TRAIL). */
function previewTrail(id){
  Sound.init(); Sound.meld();
  if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const rgb=TRAIL_RGB[id]||TRAIL_RGB.clasica;
  const flyFn=FLY_TRAIL[id]||FLY_TRAIL.clasica;
  const cx=window.innerWidth/2, cy=window.innerHeight*0.42;
  const w=44, h=60;
  const demoTile={color:"amarillo",number:9,joker:false};
  for(let i=0;i<2;i++){
    const srcRect={left:cx-90+i*10, top:cy+50, width:w, height:h};
    const destRect={left:cx-30+i*40, top:cy-20, width:w, height:h};
    const ghost=document.createElement("div");
    ghost.innerHTML=tileHTML(demoTile,"","width:100%;height:100%");
    const cloneEl=ghost.firstChild;
    setTimeout(()=>flyFn(srcRect,destRect,cloneEl,rgb,()=>{}), i*70);
  }
}
function buySoundFx(id){
  const f=SOUNDFX.find(x=>x.id===id); if(!f) return;
  if(Session.isAuthenticated()){
    if((P.ownedSoundFx||[]).includes(id)) netSend({type:"setActive",kind:"soundfx",id});
    else if(P.fichas<f.price){ Sound.error(); setMsg("No te alcanzan las monedas."); render(); }
    else { G._pendingShopFx=id; Sound.meld(); netSend({type:"buyItem",kind:"soundfx",id}); }
    return;
  }
  if(P.ownedSoundFx.includes(id)){ P.soundfx=id; saveP(); Sound.select(); return render(); }
  if(P.fichas<f.price){ Sound.error(); return render(); }
  G._pendingShopFx=id;
  P.fichas-=f.price; P.ownedSoundFx.push(id); P.soundfx=id; saveP(); Sound.meld(); render();
}
function previewSoundFx(id){
  Sound.init();
  const f=SOUNDFX.find(x=>x.id===id); if(!f) return;
  f.meld.forEach(b=>Sound.beep(b[0],b[1],b[2],b[3],b[4]));
}
/* ================================================================
   PERFIL como HUB con tabs (Fase 11 §5/§6, pedido explícito) — antes era un
   único panel larguísimo con scroll (avatar, inventario, XP, pase, rango,
   stats, logros, todo apilado). Ahora el header (avatar/nombre/nivel/rango)
   es lo único persistente, y el resto vive en tabs — Pase, Pase Galáctico y
   Rangos DEJAN de ser pantallas propias y pasan a ser tabs de acá (dejaron
   redirects en sus antiguos goPass()/goGalacticoPass()/goRangos() para no
   tener que tocar cada call site existente). Arquitectura preparada para
   agregar requisitos de acceso al Pase Galáctico más adelante (nivel mínimo,
   costo mensual) sin tener que reestructurar de nuevo — a pedido explícito
   del usuario, esos requisitos NO se implementan todavía.
   ================================================================ */
const PROFILE_TABS=[["perfil","👤 Perfil"],["logros","🏆 Logros"],["rangos","🏅 Rangos"],["pase","🎫 Pase"],["galactico","🌌 Galáctico"],["coleccion","🎒 Colección"]];
function goProfileTab(tab){ G.profileTab=tab; render(); }
function profileHeaderHTML(t){
  const stats=P.stats||{streak:P.streak||0};
  const streak=stats.streak||0;
  return `<div style="display:flex;align-items:center;gap:14px;padding:16px;background:rgba(0,0,0,.25);border-radius:14px;margin-bottom:10px;flex-shrink:0">
    <div style="font-size:64px;line-height:1;padding:10px 16px;background:rgba(184,150,63,.2);border:2px solid ${t.color};border-radius:14px;box-shadow:0 0 14px ${t.color}55;flex-shrink:0">${P.avatar||"🀄"}</div>
    <div style="flex:1;text-align:left;min-width:0">
      <div style="font-family:var(--font-display);font-size:26px;font-weight:800;color:#ffe9a8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nameEffectHTML(P.name||"Jugador",P.nameeffect)}</div>
      ${P.title&&TITLES[P.title]?`<div style="font-size:12px;font-weight:700;color:#fbbf24;margin-top:2px">🏆 ${esc(TITLES[P.title].label)}</div>`:""}
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
        <span style="display:inline-flex;align-items:center;gap:5px;font-size:13px;color:${t.color};font-weight:800;background:${t.color}22;border:1px solid ${t.color}55;border-radius:999px;padding:3px 10px">${tierBadgeHTML(t,16)} ${t.name} · ${P.rankPts} pts</span>
        <span class="badge-gold" style="font-size:12px">Nivel ${P.level||1}</span>
        <span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:800;color:#ffe9a8;background:rgba(251,191,36,.14);border:1px solid rgba(251,191,36,.4);border-radius:999px;padding:3px 10px">🪙 ${(P.fichas||0).toLocaleString("es-UY")}</span>
        ${streak>0?`<span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:800;color:#fca5a5;background:rgba(248,113,113,.14);border:1px solid rgba(248,113,113,.4);border-radius:999px;padding:3px 10px">🔥 Racha ${streak}</span>`:""}
      </div>
    </div>
  </div>`;
}
function profileTabPerfilHTML(t){
  const next = TIERS.find(x => x.min > P.rankPts);
  const level = P.level || 1, xpInLevel = P.xpInLevel || 0, xpForNext = P.xpForNext || 500;
  const xpPct = Math.min(100, Math.round(xpInLevel / xpForNext * 100));
  const stats = P.stats || { games:P.games||0, wins:P.wins||0, losses:P.losses||0, streak:P.streak||0, bestStreak:P.bestStreak||0, winRate:0 };
  const winRate = stats.winRate !== undefined ? stats.winRate : (stats.games>0 ? Math.round(stats.wins/stats.games*100) : 0);
  return `
      <p style="font-size:10px;color:rgba(232,238,247,.4);margin:0 0 12px;text-align:center;line-height:1.5">
        <b style="color:rgba(232,238,247,.6)">Nivel</b> = progreso por jugar (cualquier partida), desbloquea el Pase de temporada.<br>
        <b style="color:${t.color}">Rango (${t.name})</b> = solo sube o baja jugando partidas <b style="color:#ffe9a8">🏆 Ranked</b>. Son cosas distintas.
      </p>
      ${Session.isAuthenticated()?`<div style="margin-bottom:12px">
        <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(232,238,247,.45);margin-bottom:5px">Cambiar avatar</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${AVATARS.map(av=>{
            const owned=(P.ownedAvatars||FREE_AVATARS).includes(av);
            const active=P.avatar===av;
            if(!owned) return `<button disabled title="Se gana subiendo de nivel en el Pase de temporada" style="font-size:22px;padding:4px 8px;border-radius:8px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.06);opacity:.35;cursor:not-allowed;position:relative">${av}<span style="position:absolute;bottom:-2px;right:-2px;font-size:10px">🔒</span></button>`;
            return `<button onclick="netSend({type:'setAvatar',avatar:'${av}'})" style="font-size:22px;padding:4px 8px;border-radius:8px;background:${active?'rgba(251,191,36,.25)':'rgba(0,0,0,.25)'};border:1px solid ${active?'#fbbf24':'rgba(184,150,63,.2)'};cursor:pointer">${av}</button>`;
          }).join("")}
        </div>
      </div>`:""}
      <div style="background:rgba(0,0,0,.3);border:1px solid rgba(167,139,250,.35);border-radius:10px;padding:10px 12px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:rgba(232,238,247,.7);margin-bottom:4px">
          <span>Nivel ${level}</span>
          <span>${xpInLevel} / ${xpForNext} XP</span>
        </div>
        <div style="height:10px;border-radius:5px;background:rgba(0,0,0,.4);overflow:hidden">
          <div style="height:100%;width:${xpPct}%;background:linear-gradient(90deg,#a78bfa,#7c3aed);box-shadow:0 0 8px rgba(167,139,250,.5);transition:width .8s"></div>
        </div>
        <div style="font-size:10px;color:rgba(232,238,247,.5);text-align:right;margin-top:3px">Total: ${P.xp||0} XP</div>
      </div>
      ${next?`<div style="background:rgba(0,0,0,.3);border:1px solid ${next.color?next.color+"55":"rgba(184,150,63,.35)"};border-radius:10px;padding:10px 12px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:rgba(232,238,247,.7);margin-bottom:4px">
          <span>Próximo: ${next.icon||"🎖"} ${next.name}</span>
          <span>${P.rankPts}/${next.min}</span>
        </div>
        <div style="height:10px;border-radius:5px;background:rgba(0,0,0,.4);overflow:hidden">
          <div style="height:100%;width:${Math.min(100,Math.round(P.rankPts/next.min*100))}%;background:linear-gradient(90deg,#fcd34d,#f59e0b);transition:width .8s"></div>
        </div>
      </div>`:`<div style="text-align:center;font-size:11px;color:#fbbf24;padding:8px;background:rgba(251,191,36,.1);border-radius:10px;margin-bottom:10px">💎 Rango máximo alcanzado</div>`}
      <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(232,238,247,.45);margin:10px 0 6px">Estadísticas</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <div style="background:rgba(0,0,0,.25);padding:8px 10px;border-radius:8px;font-size:12px"><div style="font-size:10px;color:rgba(232,238,247,.55)">Partidas</div><div style="font-weight:800;color:#ffe9a8">${stats.games}</div></div>
        <div style="background:rgba(0,0,0,.25);padding:8px 10px;border-radius:8px;font-size:12px"><div style="font-size:10px;color:rgba(232,238,247,.55)">Victorias</div><div style="font-weight:800;color:#34d399">${stats.wins}</div></div>
        <div style="background:rgba(0,0,0,.25);padding:8px 10px;border-radius:8px;font-size:12px"><div style="font-size:10px;color:rgba(232,238,247,.55)">Derrotas</div><div style="font-weight:800;color:#f87171">${stats.losses}</div></div>
        <div style="background:rgba(0,0,0,.25);padding:8px 10px;border-radius:8px;font-size:12px"><div style="font-size:10px;color:rgba(232,238,247,.55)">% Victoria</div><div style="font-weight:800;color:#a78bfa">${winRate}%</div></div>
        <div style="background:rgba(0,0,0,.25);padding:8px 10px;border-radius:8px;font-size:12px"><div style="font-size:10px;color:rgba(232,238,247,.55)">Racha actual</div><div style="font-weight:800;color:#fbbf24">🔥 ${stats.streak}</div></div>
        <div style="background:rgba(0,0,0,.25);padding:8px 10px;border-radius:8px;font-size:12px"><div style="font-size:10px;color:rgba(232,238,247,.55)">Mejor racha</div><div style="font-weight:800;color:#fbbf24">🏆 ${stats.bestStreak}</div></div>
        <div style="background:rgba(0,0,0,.25);padding:8px 10px;border-radius:8px;font-size:12px"><div style="font-size:10px;color:rgba(232,238,247,.55)">🪙 Monedas</div><div style="font-weight:800;color:#fbbf24">${P.fichas||0}</div></div>
        <div style="background:rgba(0,0,0,.25);padding:8px 10px;border-radius:8px;font-size:12px"><div style="font-size:10px;color:rgba(232,238,247,.55)">Ranked jugadas</div><div style="font-weight:800;color:#ffe9a8">${stats.rankedGames||0}</div></div>
      </div>`;
}
function profileTabLogrosHTML(){
  const achievements = P.achievements || [];
  const achCatalog = G.serverAchievementsCatalog || [];
  if(!achCatalog.length) return `<p style="text-align:center;font-size:12px;color:rgba(232,238,247,.5);padding:30px 0">Conectate online para ver tus logros.</p>`;
  return `
      <div style="font-size:11px;color:rgba(232,238,247,.6);margin-bottom:8px;text-align:center">${achievements.length} / ${achCatalog.length} desbloqueados</div>
      <div style="display:grid;grid-template-columns:1fr;gap:4px">
        ${achCatalog.map(a=>{
          const unlocked=achievements.includes(a.id);
          return `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:${unlocked?'rgba(52,211,153,.1)':'rgba(0,0,0,.2)'};border:1px solid ${unlocked?'rgba(52,211,153,.4)':'rgba(184,150,63,.12)'};border-radius:8px;opacity:${unlocked?1:.55}">
            <div style="font-size:22px;line-height:1">${unlocked?"✅":"🔒"}</div>
            <div style="flex:1;text-align:left">
              <div style="font-size:12px;font-weight:800;color:${unlocked?'#ffe9a8':'rgba(232,238,247,.55)'}">${esc(a.name)}</div>
              <div style="font-size:10px;color:rgba(232,238,247,.55)">${esc(a.desc)} · 🪙 +${a.coinReward}${a.xpReward>0?" · ⭐ +"+a.xpReward:""}</div>
            </div>
          </div>`;
        }).join("")}
      </div>`;
}
function profileTabColeccionHTML(){
  return `
      <div style="font-size:10px;color:rgba(232,238,247,.5);margin-bottom:4px">Skin de fichas</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px">
        ${(P.owned&&P.owned.length?P.owned:["clasica"]).map(sid=>{
          const s=SKINS.find(x=>x.id===sid); if(!s) return "";
          const active=P.skin===sid;
          return `<button onclick="buySkin('${sid}')" title="${esc(s.name)}" style="padding:3px;border-radius:7px;background:${active?"rgba(251,191,36,.22)":"rgba(0,0,0,.25)"};border:1.5px solid ${active?"#fbbf24":"rgba(184,150,63,.2)"};cursor:pointer">
            <div class="sk-${sid}" style="display:flex;gap:1px">${[7,3].map(n=>`<div class="tile c-rojo" style="width:16px;height:22px;font-size:9px">${n}</div>`).join("")}</div>
          </button>`;
        }).join("")}
      </div>
      <div style="font-size:10px;color:rgba(232,238,247,.5);margin-bottom:4px">Tapete de mesa</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px">
        ${(P.ownedTapetes&&P.ownedTapetes.length?P.ownedTapetes:["clasico"]).map(tid=>{
          const tp=TAPETES.find(x=>x.id===tid); if(!tp) return "";
          const active=P.tapete===tid;
          return `<button onclick="buyTapete('${tid}')" title="${esc(tp.name)}" style="width:38px;height:28px;border-radius:6px;overflow:hidden;padding:0;border:1.5px solid ${active?"#fbbf24":"rgba(184,150,63,.2)"};cursor:pointer">
            <div class="tp-${tid}" style="width:100%;height:100%"><div class="mesa" style="margin:0;height:100%;border:none;border-radius:0"></div></div>
          </button>`;
        }).join("")}
      </div>
      <div style="font-size:10px;color:rgba(232,238,247,.5);margin-bottom:4px">Efecto de bajada</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">
        ${(P.ownedFx&&P.ownedFx.length?P.ownedFx:["clasico"]).map(fid=>{
          const f=EFFECTS.find(x=>x.id===fid); if(!f) return "";
          const active=P.effect===fid;
          return `<button onclick="buyEffect('${fid}')" style="font-size:10px;font-weight:800;padding:5px 9px;border-radius:7px;background:${active?"rgba(56,189,248,.22)":"rgba(0,0,0,.25)"};border:1.5px solid ${active?"#38bdf8":"rgba(184,150,63,.2)"};color:${active?"#7dd3fc":"#e8eef7"};cursor:pointer">${esc(f.name)}</button>`;
        }).join("")}
      </div>
      ${(P.ownedTitles&&P.ownedTitles.length)?`
      <div style="font-size:10px;color:rgba(232,238,247,.5);margin:14px 0 4px">Título <span style="opacity:.6">(exclusivo de la Torre)</span></div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">
        <button onclick="equipTitle('none')" style="font-size:10px;font-weight:800;padding:5px 9px;border-radius:7px;background:${!P.title?"rgba(251,191,36,.22)":"rgba(0,0,0,.25)"};border:1.5px solid ${!P.title?"#fbbf24":"rgba(184,150,63,.2)"};color:${!P.title?"#ffe9a8":"#e8eef7"};cursor:pointer">Ninguno</button>
        ${P.ownedTitles.map(tid=>{
          const t=TITLES[tid]; if(!t) return "";
          const active=P.title===tid;
          return `<button onclick="equipTitle('${tid}')" title="${esc(t.desc||"")}" style="font-size:10px;font-weight:800;padding:5px 9px;border-radius:7px;background:${active?"rgba(251,191,36,.22)":"rgba(0,0,0,.25)"};border:1.5px solid ${active?"#fbbf24":"rgba(184,150,63,.2)"};color:${active?"#ffe9a8":"#e8eef7"};cursor:pointer">🏆 ${esc(t.label)}</button>`;
        }).join("")}
      </div>`:""}`;
}
function renderProfile(app){
  const t = G.serverProfile ? G.serverProfile.tier : tierOf(P.rankPts);
  const tab = G.profileTab||"perfil";
  app.innerHTML = `
  <div class="screen-center">
    <div class="card profile-card ${G._enterCls}" style="max-height:92dvh;overflow:hidden;display:flex;flex-direction:column">
      <button class="card-x" onclick="goMenu()" title="Cerrar">✕</button>
      <h2 style="font-family:var(--font-display);color:#ffe9a8;font-size:22px;text-align:center;margin-bottom:10px;flex-shrink:0">Perfil</h2>
      ${profileHeaderHTML(t)}
      <div class="shop-tabs" style="flex-shrink:0">${PROFILE_TABS.map(([id,label])=>`<button class="${tab===id?"active":""}" onclick="goProfileTab('${id}')">${label}</button>`).join("")}</div>
      <div class="shop-content" data-preserve-scroll="profile-${tab}">
        ${tab==="perfil"?profileTabPerfilHTML(t):""}
        ${tab==="logros"?profileTabLogrosHTML():""}
        ${tab==="rangos"?profileTabRangosHTML():""}
        ${tab==="pase"?profileTabPaseHTML():""}
        ${tab==="galactico"?profileTabGalacticoHTML():""}
        ${tab==="coleccion"?profileTabColeccionHTML():""}
      </div>
    </div>
  </div>
  ${G.claimAllSummary?claimAllSummaryHTML(G.claimAllSummary):""}`;
  // Bug reportado (Fase 12 §14): esto corría en CUALQUIER render() mientras el tab
  // fuera pase/galáctico — incluido el que dispara claimPass()/claimGalacticoPass()
  // al reclamar, así que reclamar una recompensa siempre te mandaba de vuelta a tu
  // nivel actual sin importar dónde estuvieras mirando. El scroll-to-nivel-actual
  // es útil solo al ENTRAR al tab por primera vez — se gatea a que el tab
  // realmente haya cambiado desde el render anterior (mismo patrón que
  // G._lastScreen/screenChanged en render()). Reclamar ya tiene su propio
  // mecanismo de scroll preservation (data-preserve-scroll="profile-pase" más
  // arriba en render()), que sin este salto forzado encima queda intacto.
  const profileTabChanged = tab!==G._lastProfileTab;
  G._lastProfileTab = tab;
  if((tab==="pase"||tab==="galactico") && profileTabChanged){
    const lvl = tab==="pase"?passLevel():galacticoPassLevel();
    setTimeout(()=>{ const row=app.querySelector(`[data-lv="${lvl}"]`); if(row) row.scrollIntoView({block:"center"}); },0);
  }
  if(G._pendingClaimFx){
    const claimedNow = tab==="pase" ? !!P.passClaimed[G._pendingClaimFx] : tab==="galactico" ? !!(P.galacticoClaimed||{})[G._pendingClaimFx] : false;
    if(claimedNow){ const fxLv=G._pendingClaimFx; G._pendingClaimFx=null; setTimeout(()=>animateClaimBurst(fxLv),0); }
  }
}

function renderConfig(app){
  app.innerHTML=`
  <div class="screen-center">
    <div class="card ${G._enterCls}">
      <button class="card-x" onclick="goMenu()" title="Cerrar">✕</button>
      <h2 style="font-family:var(--font-heading);color:#ffe9a8;font-size:24px;text-align:center;margin-bottom:12px">⚙ Opciones</h2>
      <div class="audio-block">
        <div class="lbl" style="margin-top:0">🔊 Efectos de sonido</div>
        <p style="font-size:10.5px;color:rgba(232,238,247,.5);margin:-4px 0 8px">Ficha colocada, robada, comodín, logro, victoria…</p>
        <div class="seg">
          <button class="${Sound.on?"on":""}" onclick="Sound.on=true;Sound.init();Sound.turn();render()">🔊 Sí</button>
          <button class="${!Sound.on?"on":""}" onclick="Sound.on=false;render()">🔇 No</button>
        </div>
        <input type="range" min="0" max="100" value="${Math.round(Sound.volume*100)}" oninput="Sound.volume=this.value/100" onchange="Sound.select()" style="width:100%;margin:8px 0 0" ${Sound.on?"":"disabled"}>
      </div>
      <div class="audio-block">
        <div class="lbl" style="margin-top:0">🎵 Música de fondo</div>
        <p style="font-size:10.5px;color:rgba(232,238,247,.5);margin:-4px 0 8px">Independiente de los efectos — podés tener una prendida y la otra no.</p>
        <div class="seg">
          <button class="${Music.on?"on":""}" onclick="if(!Music.on)Music.toggle();render()">🎵 Sí</button>
          <button class="${!Music.on?"on":""}" onclick="if(Music.on)Music.toggle();render()">🔇 No</button>
        </div>
        <input type="range" min="0" max="100" value="${Math.round(Music.volume*100)}" oninput="Music.setVolume(this.value/100)" style="width:100%;margin:8px 0 0" ${Music.on?"":"disabled"}>
      </div>
    </div>
  </div>`;
}

function goSorteo(ranked,opponents){
  Sound.init();
  G.online=false;
  G.teamMode=false; G.teammate=null;
  G.ranked=!!ranked;
  if(G.ranked) G.numOpponents=opponents||3; // 1=1v1, 2=3 jugadores, 3=mesa de 4
  // Con dificultad IA-Claude, la primera rival se llama así (no un username al azar)
  // — es su propia marca, no una versión más de las otras dificultades. El resto de
  // los rivales (acá y en cualquier otra dificultad) usan nombres que parecen
  // usernames reales, no etiquetas de bot ("IA Rojo" etc) — pedido explícito.
  const botNames=pickBotNames(G.numOpponents);
  if(G.aiLevel==="claude") botNames[0]="IA-Claude";
  const botAvatars=shuffle(AVATARS.slice());
  // Ranked Offline: el rival ya se generó entero (nombre/avatar/skin coherentes al
  // rango del jugador) en pickOfflineOpponent() — se usa ESE en vez de uno al azar.
  if(G.rankedOffline && G.rankedOfflineOpponent){
    botNames[0]=G.rankedOfflineOpponent.name;
    botAvatars[0]=G.rankedOfflineOpponent.avatar;
  }
  const names=[(P.name||"Vos"),...botNames].slice(0,G.numOpponents+1);
  const vals=shuffle(Array.from({length:13},(_,i)=>i+1)).slice(0,names.length);
  G.sorteoTiles=names.map((n,i)=>({name:n,isHuman:i===0,revealed:false,
    avatar:i===0?null:(n==="IA-Claude"?"✨":botAvatars[(i-1)%botAvatars.length]),
    tile:{id:nid("s"),color:COLOR_KEYS[i%4],number:vals[i],joker:false}}));
  G.sorteoDone=false; G.myRevealed=false;
  G.screen="sorteo"; render();
}
function revealMine(){
  if(G.myRevealed) return;
  G.myRevealed=true; Sound.flip();
  G.sorteoTiles.forEach(s=>{ if(s.isHuman) s.revealed=true; });
  render();
  G.sorteoTiles.forEach((s,i)=>{
    if(!s.isHuman){
      setTimeout(()=>{ s.revealed=true; Sound.flip(); render(); }, 600+500*i);
    }
  });
  setTimeout(()=>{ G.sorteoDone=true; Sound.turn(); render(); }, 600+500*G.sorteoTiles.length+400);
}
function startDealing(){
  const order=G.sorteoTiles.slice().sort((a,b)=>b.tile.number-a.tile.number);
  // Modo 8 jugadores: con más de 4 en la mesa, un mazo solo (108 fichas) no alcanza
  // (14 c/u ya son 112) — se juega con 2 mazos completos (216 fichas), como en el resto.
  let deck=order.length>4?shuffle(makeDeck().concat(makeDeck())):shuffle(makeDeck());
  const aiSkinPool=shuffle(["madera","piedra","negra","circulo","oriental","elite","hielo","fuego"].filter(s=>s!==P.skin));
  let aiSkinIdx=0;
  G.players=order.map(o=>({id:nid("p"),name:o.name,isHuman:o.isHuman,hand:[],hasLaidInitial:false,
    team:G.teamMode?(o.isHuman?"A":"B"):undefined,
    avatar:o.isHuman?undefined:(o.avatar||"🀄"),
    skin:o.isHuman?(P.skin||"clasica"):aiSkinPool[aiSkinIdx++%aiSkinPool.length]}));
  // Ranked Offline: la skin del rival ya se decidió en pickOfflineOpponent() (coherente
  // con su nivel simulado, no una al azar del pool general) — se pisa acá.
  if(G.rankedOffline && G.rankedOfflineOpponent){
    const rival=G.players.find(p=>!p.isHuman);
    if(rival) rival.skin=G.rankedOfflineOpponent.skin;
  }
  const initTiles=G.initTiles||14;
  G.players.forEach(p=>{ if(!p.isHuman) p.hand=deck.splice(0,initTiles); });
  G.bag=deck; G.table=[]; G.meldCounter=0; G.history=[]; G.historyDrawerOpen=false;
  G.chatLog=[]; G.chatOpen=false; G.chatUnread=0;
  G.rack=Array(RACK_SLOTS).fill(null); G.reserve=[]; G.dealCount=0; G.currentIdx=0; G.dealtStagger={};
  G.workLoose=[]; G.workGroups=[]; G.selWork=new Set(); G.selHand=new Set();
  G.openedMeldIds=[]; G.openedBackup={};
  G.passStreak=0; G.finalRanking=null;
  G.scores={}; G.players.forEach(p=>G.scores[p.id]=0);
  G.lives=MAX_LIVES; G.hintsLeft=10; G.jokerBreaksLeft=3; G.timeoutFired=false;
  // Rupturas de comodín de cada rival IA — PROPIAS, separadas de G.jokerBreaksLeft
  // (que es la cuota del humano). Antes la IA reorganizaba consumiendo del mismo
  // contador que el humano, como si fuera un pozo compartido — con varios rivales
  // en la mesa, cada uno necesita su propia cuota de 3, igual que ya pasa online
  // (room.jokerBreaks es por jugador ahí).
  G.aiJokerBreaks={}; G.players.forEach(p=>{ if(!p.isHuman) G.aiJokerBreaks[p.id]=3; });
  G.humanMeldsThisGame=0; G.rankedResult=null; G.rankedOfflineResult=null; G.surrendered=false; G.paused=false;
  G.matchEndsAt=G.matchMinutes>0?Date.now()+G.matchMinutes*60000:null; G.matchTimeoutFired=false;
  G.consensus=null;
  if(G.teamMode){
    // La compañera IA no tiene turno propio: sus fichas se mezclan de una vez en el
    // atril compartido (marcadas owner:"teammate", ocupando huecos del rack igual que
    // cualquier ficha) mientras el humano reparte las suyas una por una como siempre —
    // arman juntos desde la misma zona de preparación.
    G.teammate={id:nid("mate"),name:G.teammateName||"Compañera IA",avatar:"🤖",
      skin:aiSkinPool[aiSkinIdx++%aiSkinPool.length]};
    for(let i=0;i<initTiles;i++){
      const t=G.bag.shift();
      if(!t) break;
      t.owner="teammate";
      placeInRack(t);
    }
  }
  setMsg("Tocá el pozo para ir agarrando tus "+initTiles+" fichas.");
  G.screen="dealing"; render();
}
function dealDraw(all){
  const initTiles=G.initTiles||14;
  if(G.dealCount>=initTiles) return;
  const n = all ? initTiles-G.dealCount : 1;
  const justDealt=[];
  for(let i=0;i<n;i++){
    const t=G.bag.shift();
    if(!t) break;
    if(G.teamMode) t.owner="me";
    placeInRack(t); G.dealCount++;
    justDealt.push(t.id);
  }
  // Fichas volando desde la bolsa: si se sacan varias de una, entran una atrás de
  // otra (no todas de golpe) — cada una con su propio retraso según el orden, con
  // un "tic" de sonido acompañando a cada una.
  G.dealtStagger={};
  justDealt.forEach((id,i)=>{
    G.dealtStagger[id]=i*90;
    if(i>0) setTimeout(()=>Sound.draw(),i*90);
  });
  // Limpiar después de que termine de volar la última, si no la animación se repetiría
  // en cada re-render posterior (cada vez que tocás cualquier otra ficha).
  clearTimeout(G._dealtStaggerT);
  G._dealtStaggerT=setTimeout(()=>{ G.dealtStagger={}; if(G.screen==="dealing"||G.screen==="playing") render(); },justDealt.length*90+500);
  Sound.draw();
  syncHumanHand();
  if(G.dealCount>=initTiles){
    setTimeout(()=>{
      G.screen="playing";
      const first=G.players[0];
      if(first.isHuman){
        G.turnBanner=true;
        setTimeout(()=>{ G.turnBanner=false; render(); },1650);
        Sound.turn();
      } else {
        setMsg("Empieza "+first.name+" (ganó el sorteo).");
        if(!G.online) scheduleAi(first);
      }
      startTurnTimer();
      startMatchTimer();
      render();
    },450);
  }
  render();
}

function startTurnTimer(){
  clearInterval(G.timerHandle);
  G.timeLeft=G.turnSeconds;
  G.timeoutFired=false;
  G.timerHandle=setInterval(()=>{
    G.timeLeft--;
    const cur=G.players[G.currentIdx];
    if(cur&&cur.isHuman){
      if(G.timeLeft<=10&&G.timeLeft>0) Sound.tick();
      if(G.timeLeft<=0){
        if(G.timeoutFired) return;      // guard: nunca dos veces
        G.timeoutFired=true;
        clearInterval(G.timerHandle);
        G.lives--;
        if(G.lives<=0){
          fullCancel(false);
          return endGameAbandon();
        }
        setMsg("⏱ ¡SE SALTEÓ TU TURNO! No jugaste a tiempo → perdiste una vida ("+G.lives+" restantes).");
        Sound.error();
        fullCancel(false);
        endTurn();
        return;
      }
      // Actualiza TODAS las instancias del reloj en pantalla (el del HUD arriba
      // y el del atril pueden estar los dos visibles a la vez) — antes buscaba
      // por #timer/#timerring, ids que timerHTML() nunca usó (usa las clases
      // .timer-num/.timer-ring), así que esto nunca actualizaba nada offline.
      document.querySelectorAll(".timer-num").forEach(el=>{
        el.textContent=G.timeLeft;
        el.classList.toggle("a-blink", G.timeLeft<=10);
      });
      document.querySelectorAll(".timer-ring").forEach(ring=>{
        const R=17,C=2*Math.PI*R;
        ring.setAttribute("stroke-dashoffset",C*(1-Math.max(0,G.timeLeft)/G.turnSeconds));
        ring.setAttribute("stroke",G.timeLeft<=10?"#ef4444":"#fbbf24");
      });
    } else {
      if(G.timeLeft<=0){ clearInterval(G.timerHandle); }
    }
  },1000);
}

function matchClockText(){
  if(!G.matchEndsAt) return null;
  const remaining=Math.max(0,G.matchEndsAt-Date.now());
  const mm=Math.floor(remaining/60000), ss=Math.floor((remaining%60000)/1000);
  return "⏳ "+mm+":"+(ss<10?"0":"")+ss;
}
function updateMatchClockDOM(){
  const el=$("#matchclock");
  if(!el) return;
  const txt=matchClockText();
  if(txt==null){ el.style.display="none"; return; }
  el.style.display="";
  el.textContent=txt;
  const remaining=G.matchEndsAt-Date.now();
  el.classList.toggle("a-blink", remaining<=60000&&remaining>0);
}
function startMatchTimer(){
  clearInterval(G.matchTimerHandle);
  updateMatchClockDOM();
  if(!G.matchEndsAt) return;
  G.matchTimerHandle=setInterval(()=>{
    updateMatchClockDOM();
    if(Date.now()>=G.matchEndsAt){
      clearInterval(G.matchTimerHandle);
      if(!G.online&&!G.matchTimeoutFired){
        G.matchTimeoutFired=true;
        setMsg("⏰ ¡Tiempo! Termina la partida por límite de tiempo.");
        Sound.error();
        clearInterval(G.timerHandle); clearAiTimeouts();
        endGameByPoints();
      }
    }
  },1000);
}

/* ---------- PAUSA Y RENDICIÓN ---------- */
function togglePause(v){ G.paused=v; Sound.select(); render(); }
/* Historial en mobile (Fase 12 §9): en desktop .col-history queda siempre visible
   (ver el layout de fila), en mobile pasa a un drawer que se abre/cierra con este
   botón — mismo panel, no un componente nuevo, solo una clase que la CSS de mobile
   convierte en bottom-sheet superpuesto. */
function toggleHistoryDrawer(){
  // En mobile (drawer tipo bottom-sheet, ver @media(max-width:640px)) el historial
  // arranca CERRADO y se abre por gesto — no tiene sentido persistir esa elección.
  // En PC, en cambio, el historial ocupa una columna fija todo el tiempo: acá el
  // pedido es poder PLEGARLA para que mesa/preparación/atril no compitan por
  // espacio en ventanas angostas, y que la app recuerde la preferencia entre
  // partidas (Fase responsive, §1: "guardar qué paneles tiene abiertos").
  if(window.matchMedia && window.matchMedia("(max-width:640px)").matches){
    G.historyDrawerOpen=!G.historyDrawerOpen;
  } else {
    G.historyPanelClosed=!G.historyPanelClosed;
    Store.set("burako_historyPanelClosed",G.historyPanelClosed);
  }
  Sound.select(); render();
}
/* El panel "crece" desde la esquina inferior-izquierda (donde vive el botón ⛶)
   con una animación CSS pura (@keyframes tvGrow/tvShrink en burako.css), NO con
   GSAP calculando el origen dinámicamente. Se probó con GSAP primero y salía
   roto: el panel es un nodo NUEVO en cada apertura (no persiste entre renders,
   a diferencia de lo que usa GSAP Flip en withLogoFlip), y cualquier render()
   de fondo durante la animación (timer, actividad online, IA, etc. — cosas que
   claramente pasan en una partida real, no en una prueba estática) volvía a
   sincronizar sus atributos vía morph() y le pisaba el estilo inline que GSAP
   estaba animando a mitad de camino — eso era el "pestañea y queda trancado"
   reportado. Una animación CSS declarada por clase no tiene ese problema:
   corre en su propio timeline del navegador, inmune a que el DOM alrededor se
   actualice, y como la clase/el atributo no cambian entre renders mientras el
   panel sigue abierto, morph() no tiene nada que pisarle. */
function openTableView(){
  G.tableViewOpen=true; Sound.select(); render();
}
function closeTableView(){
  const panel=document.querySelector(".tableview-panel");
  const reduced=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(!panel||reduced){ G.tableViewOpen=false; render(); return; }
  if(panel.classList.contains("closing")) return; // ya cerrando, no reiniciar
  panel.classList.add("closing");
  panel.addEventListener("animationend",()=>{ G.tableViewOpen=false; render(); },{once:true});
}
// Confirmación propia del juego para Rendirse — antes usaba el confirm() nativo
// del navegador ("no tiene nada programado, sale una alerta de navegador",
// reportado igual en mobile). Mismo patrón que el resto de los modales de acá
// (pauseovl/pausecard), apilado ARRIBA de la pausa (mayor z-index) ya que el
// botón vive adentro del menú de pausa.
function openSurrenderConfirm(){ G.surrenderConfirmOpen=true; render(); }
function closeSurrenderConfirm(){ G.surrenderConfirmOpen=false; render(); }
function confirmSurrender(){ G.surrenderConfirmOpen=false; surrender(); }
function surrenderConfirmModalHTML(){
  return `<div class="pauseovl" style="z-index:97" onclick="if(event.target===this)closeSurrenderConfirm()">
    <div class="pausecard a-pop" style="text-align:center;border-color:rgba(248,113,113,.5)">
      <div style="font-size:36px;margin-bottom:6px">🏳</div>
      <h2 style="font-family:var(--font-heading);color:#f87171;font-size:19px;margin-bottom:10px">¿Rendirte?</h2>
      <p style="font-size:12.5px;color:rgba(232,238,247,.8);line-height:1.5;margin-bottom:16px">${G.ranked?"En competitivo, rendirte te deja en el último puesto y perdés puntos de rango.":G.rankedOffline?"En Ranked Offline, rendirte cuenta como derrota y perdés puntos de tu rango offline.":"Vas a abandonar la partida para todos los jugadores."}</p>
      <div style="display:flex;gap:8px">
        <button class="btn-sm" style="flex:1;background:rgba(255,255,255,.08);color:#e8eef7;border-radius:9px;padding:11px 6px" onclick="closeSurrenderConfirm()">Cancelar</button>
        <button class="btn-sm" style="flex:1;background:linear-gradient(180deg,#ef4444,#b91c1c);color:#fff;border-radius:9px;padding:11px 6px;font-weight:800" onclick="confirmSurrender()">🏳 Rendirme</button>
      </div>
    </div>
  </div>`;
}
function surrender(){
  G.paused=false;
  if(G.online&&NET.ws){ netSend({type:"surrender"}); render(); return; }
  clearInterval(G.timerHandle); clearInterval(G.matchTimerHandle); clearAiTimeouts();
  if(G.ranked||G.rankedOffline){
    G.abandoned=true; G.surrendered=true;
    const rivals=G.players.filter(p=>!p.isHuman);
    const w=rivals.sort((a,b)=>(G.scores[b.id]||0)-(G.scores[a.id]||0))[0]||G.players[0];
    endGame(w);
  } else {
    goMenu();
  }
}

function endGameAbandon(){
  // perdiste todas las vidas: la partida se da por abandonada
  const rivals=G.players.filter(p=>!p.isHuman);
  const w=rivals.sort((a,b)=>handPoints(a)-handPoints(b))[0]||G.players[0];
  G.finalRanking=null;
  G.abandoned=true;
  endGame(w);
}

function endTurn(){
  G.selHand=new Set(); G.moveFrom=null; G.hinted=new Set();
  G.currentIdx=(G.currentIdx+1)%G.players.length;
  const cur=G.players[G.currentIdx];
  if(cur.isHuman){
    Sound.turn();
    G.turnBanner=true;
    setTimeout(()=>{ G.turnBanner=false; render(); },1650);
  }
  startTurnTimer();
  render();
  if(!cur.isHuman&&!G.online) scheduleAi(cur);
}
function endGame(p){
  G.winner=p; G.screen="gameover";
  clearInterval(G.timerHandle); clearInterval(G.matchTimerHandle); clearAiTimeouts();
  G.rankedResult=rankedResolve(p);
  G.rankedOfflineResult=rankedOfflineResolve(p);
  p.isHuman ? Sound.win() : Sound.lose();
  render();
}

/* ---------------- DRAG & DROP ---------------- */
let DRAG=null;
function slotPointerDown(e,idx){
  const t=G.rack[idx]; if(!t) return;
  DRAG={x0:e.clientX,y0:e.clientY,idx,tileId:t.id,active:false,ghost:null,group:null};
  window.addEventListener('pointermove',dragMove,{passive:false});
  window.addEventListener('pointerup',dragUp,{once:true});
  window.addEventListener('pointercancel',dragCancel,{once:true});
}
/* El navegador puede mandar 'pointercancel' en vez de 'pointerup' (típico en mobile:
   el sistema decide a mitad de gesto que en realidad era un scroll, o hay una
   interrupción cualquiera) — sin este handler el 'pointerup' con {once:true} nunca
   llega, el ghost del drag queda flotando pegado en la pantalla para siempre, y
   DRAG nunca se limpia (el próximo pointerdown reusa un estado viejo). Mismo cuidado
   que se hizo en prepDragCancel más abajo, para el drag principal del atril. */
function dragCancel(){
  window.removeEventListener('pointermove',dragMove);
  window.removeEventListener('pointerup',dragUp);
  if(DRAG&&DRAG.ghost) DRAG.ghost.remove();
  document.querySelectorAll('.slot.dropover').forEach(s=>s.classList.remove('dropover'));
  document.querySelectorAll('.meld.drop-ok,.meld.drop-bad').forEach(s=>s.classList.remove('drop-ok','drop-bad'));
  document.querySelectorAll('.mesa.drop-ok,.mesa.drop-bad').forEach(s=>s.classList.remove('drop-ok','drop-bad'));
  document.querySelectorAll('.col-prep.drop-ok').forEach(s=>s.classList.remove('drop-ok'));
  DRAG=null;
}
function dragMove(e){
  if(!DRAG) return;
  if(!DRAG.active){
    if(Math.hypot(e.clientX-DRAG.x0,e.clientY-DRAG.y0)<10) return;
    DRAG.active=true;
    DRAG.group = G.selHand.has(DRAG.tileId)
      ? handTiles().filter(t=>G.selHand.has(t.id))
      : [G.rack[DRAG.idx]];
    const g=document.createElement('div');
    g.className="sk-"+(P.skin||"clasica");
    g.style.cssText='position:fixed;z-index:99;pointer-events:none;display:flex;gap:2px;opacity:.95;transform:rotate(-3deg) scale(1.06);filter:drop-shadow(0 10px 16px rgba(0,0,0,.55))';
    g.innerHTML=DRAG.group.map(t=>tileHTML(t,'','width:34px;height:46px;font-size:15px')).join('');
    document.body.appendChild(g);
    DRAG.ghost=g;
    Sound.select();
  }
  e.preventDefault();
  DRAG.ghost.style.left=(e.clientX-18)+'px';
  DRAG.ghost.style.top=(e.clientY-52)+'px';
  document.querySelectorAll('.slot.dropover').forEach(s=>s.classList.remove('dropover'));
  document.querySelectorAll('.meld.drop-ok,.meld.drop-bad').forEach(s=>s.classList.remove('drop-ok','drop-bad'));
  document.querySelectorAll('.mesa.drop-ok,.mesa.drop-bad').forEach(s=>s.classList.remove('drop-ok','drop-bad'));
  document.querySelectorAll('.col-prep.drop-ok').forEach(s=>s.classList.remove('drop-ok'));
  const el=document.elementFromPoint(e.clientX,e.clientY);
  const slot=el&&el.closest?el.closest('.slot'):null;
  const myTurn=G.screen==="playing"&&G.players[G.currentIdx]&&(G.players[G.currentIdx].isHuman||G.players[G.currentIdx].isTeammate);
  if(slot){ slot.classList.add('dropover'); return; }
  if(!myTurn) return;
  const prepEl=el&&el.closest?el.closest('.col-prep'):null;
  if(prepEl){ prepEl.classList.add('drop-ok'); return; }
  const meldEl=el&&el.closest?el.closest('.meld[data-mid]'):null;
  if(meldEl){
    const m=G.table.find(x=>x.id===meldEl.dataset.mid);
    const legal=!!m&&!m.tiles.some(t=>t.joker)&&meldInfo(m.tiles.concat(DRAG.group)).valid;
    meldEl.classList.add(legal?'drop-ok':'drop-bad');
    return;
  }
  const mesaEl=el&&el.closest?el.closest('.mesa'):null;
  if(mesaEl){
    const h=human();
    const info=meldInfo(DRAG.group);
    const legal=info.valid&&(!h||h.hasLaidInitial||info.value>=30);
    mesaEl.classList.add(legal?'drop-ok':'drop-bad');
  }
}
function dragUp(e){
  window.removeEventListener('pointermove',dragMove);
  window.removeEventListener('pointercancel',dragCancel);
  if(!DRAG) return;
  if(DRAG.active){
    if(DRAG.ghost) DRAG.ghost.remove();
    const el=document.elementFromPoint(e.clientX,e.clientY);
    const myTurn=G.screen==="playing"&&G.players[G.currentIdx]&&(G.players[G.currentIdx].isHuman||G.players[G.currentIdx].isTeammate);
    const meldEl=el&&el.closest?el.closest('.meld[data-mid]'):null;
    const mesaEl=el&&el.closest?el.closest('.mesa'):null;
    const prepEl=el&&el.closest?el.closest('.col-prep'):null;
    const slot=el&&el.closest?el.closest('.slot'):null;
    if(!slot&&prepEl&&myTurn){
      G.suppressClick=true; setTimeout(()=>{G.suppressClick=false;},60);
      sendTilesToWork(DRAG.group);
      G.selHand=new Set();
      render();
      DRAG=null; return;
    }
    if(!slot&&meldEl&&myTurn){
      G.suppressClick=true; setTimeout(()=>{G.suppressClick=false;},60);
      attachToMeld(meldEl.dataset.mid,DRAG.group);
      DRAG=null; return;
    }
    if(!slot&&mesaEl&&myTurn){
      G.suppressClick=true; setTimeout(()=>{G.suppressClick=false;},60);
      layGroupByDrag(DRAG.group);
      render();
      DRAG=null; return;
    }
    if(slot){
      const target=+slot.dataset.idx;
      const ids=new Set(DRAG.group.map(t=>t.id));
      G.rack=G.rack.map(x=>x&&ids.has(x.id)?null:x);
      let pos=target;
      for(const tile of DRAG.group){
        while(pos<RACK_SLOTS&&G.rack[pos]!==null) pos++;
        if(pos>=RACK_SLOTS) pos=G.rack.findIndex(s=>s===null);
        G.rack[pos]=tile; pos++;
      }
      G.selHand=new Set();
      Sound.place(); syncHumanHand();
    }
    G.suppressClick=true; setTimeout(()=>{G.suppressClick=false;},60);
    render();
  }
  DRAG=null;
}

/* ---------------- BAJAR JUEGOS (núcleo reutilizable) ---------------- */
function layTiles(tiles){
  const h=human();
  if(tiles.length<3){ Sound.error(); setMsg("Elegí al menos 3 fichas que formen un juego."); render(); return false; }
  const info=meldInfo(tiles);
  if(!info.valid){ Sound.error(); setMsg("Esa selección no forma un juego válido."); render(); return false; }
  if(!h.hasLaidInitial&&info.value<30){ Sound.error(); setMsg("Ese juego suma "+info.value+": para salir necesitás 30 o más."); render(); return false; }
  captureFlightSources(tiles.map(t=>t.id));
  removeFromHand(new Set(tiles.map(t=>t.id)));
  syncHumanHand();
  const wasFirst=!h.hasLaidInitial;
  tiles.forEach(t=>t.skin=P.skin||"clasica");
  G.table.push({id:nid("m"),tiles,ownerName:h.name,ownerId:h.id,ownerSkin:P.skin||"clasica",fx:P.effect||"clasico",order:++G.meldCounter});
  G.scores[h.id]=(G.scores[h.id]||0)+info.value;
  checkMeldAchievements(tiles);
  if(wasFirst&&info.value>=50) unlockAch("salida50");
  const _newId=G.table[G.table.length-1].id;
  G.freshMelds=new Set([_newId]); G.freshMeldKind={[_newId]:"new"};
  slamFX();
  queueMeldFx(_newId, P.effect||"clasico");
  setTimeout(()=>{ G.freshMelds=new Set(); },700);
  h.hasLaidInitial=true;
  G.passStreak=0;
  G.selHand=new Set();
  Sound.meld();
  if(info.value>=50) setTimeout(()=>bigPlayFX((wasFirst?"¡SALIDA TRIUNFAL! ":"¡GRAN JUGADA! ")+"+"+info.value+" pts"),150);
  setMsg(wasFirst?"¡Saliste con "+info.value+" pts! 🎉":"Bajaste un "+info.type+" de "+info.value+" pts.");
  if(!handTiles().length){ endGame(h); return true; }
  if(checkPointsWin(h)) return true;
  return true;
}
function layFromRack(){
  const tiles=handTiles().filter(t=>G.selHand.has(t.id));
  if(layTiles(tiles)&&G.screen==="playing") finishTeamTurn();
}
/* arrastrar un grupo hasta la mesa = bajarlo y PASAR turno (para bajar varios, usar Preparación) */
function layGroupByDrag(tiles){
  if(G.online){
    if(tiles.length<3) return;
    captureFlightSources(tiles.map(t=>t.id));
    netSend({type:"lay", tiles: tiles.map(t=>t.id)});
    G.selHand=new Set();
    return;
  }
  if(layTiles(tiles)&&G.screen==="playing") finishTeamTurn();
}
/* arrastrar fichas sobre un juego existente: se pegan si el resultado es legal */
function attachToMeld(meldId,tiles){
  const h=human();
  if(!h.hasLaidInitial){ Sound.error(); setMsg("Primero tenés que salir con 30."); return render(); }
  const m=G.table.find(x=>x.id===meldId); if(!m) return;
  if(m.tiles.some(t=>t.joker)){ Sound.error(); setMsg("Ese juego tiene comodín: abrilo con 🔓 para modificarlo."); return render(); }
  const combined=m.tiles.concat(tiles);
  const before=meldInfo(m.tiles), after=meldInfo(combined);
  if(!after.valid){ Sound.error(); setMsg("Esa ficha no encaja legalmente en ese juego."); return render(); }
  removeFromHand(new Set(tiles.map(t=>t.id)));
  tiles.forEach(t=>t.skin=P.skin||"clasica");
  m.tiles=combined;
  G.scores[h.id]=(G.scores[h.id]||0)+Math.max(0,(after.value||0)-(before.value||0));
  G.passStreak=0;
  G.selHand=new Set();
  syncHumanHand();
  G.freshMelds=new Set([m.id]); G.freshMeldKind={[m.id]:"attach"};
  snapFX();
  queueMeldFx(m.id, P.effect||"clasico");
  setTimeout(()=>{ G.freshMelds=new Set(); },700);
  setMsg("Ficha agregada al juego #"+m.order+" ✔");
  if(!handTiles().length) return endGame(h);
  if(checkPointsWin(h)) return;
  if(G.screen==="playing") finishTeamTurn(); else render();
}

/* ---------------- INTERACCIÓN ATRIL (tap) ----------------
   Tocás fichas → se seleccionan. Tocás casilla vacía → la selección se mueve ahí.
   Arrastrar también funciona (ver DRAG arriba). */
function slotClick(idx){
  if(G.suppressClick) return;
  const t=G.rack[idx];
  if(t){
    if(G.selHand.has(t.id)) G.selHand.delete(t.id); else G.selHand.add(t.id);
    Sound.select();
  } else if(G.selHand.size){
    const sel=rackTiles().filter(x=>G.selHand.has(x.id));
    G.rack=G.rack.map(x=>x&&G.selHand.has(x.id)?null:x);
    let pos=idx;
    for(const tile of sel){
      while(pos<RACK_SLOTS&&G.rack[pos]!==null) pos++;
      if(pos>=RACK_SLOTS) pos=G.rack.findIndex(s=>s===null);
      G.rack[pos]=tile; pos++;
    }
    G.selHand=new Set();
    Sound.place(); syncHumanHand();
  }
  render();
}



function sortRack(mode){
  const tiles=G.rack.filter(Boolean).concat(G.reserve);
  tiles.sort((a,b)=>{
    if(a.joker&&!b.joker) return 1;
    if(b.joker&&!a.joker) return -1;
    if(mode==="color"){
      if(a.color!==b.color) return COLOR_KEYS.indexOf(a.color)-COLOR_KEYS.indexOf(b.color);
      return a.number-b.number;
    } else {
      if(a.number!==b.number) return a.number-b.number;
      return COLOR_KEYS.indexOf(a.color)-COLOR_KEYS.indexOf(b.color);
    }
  });
  G.rack=Array(RACK_SLOTS).fill(null);
  G.reserve=[];
  tiles.forEach(t=>{ const i=firstEmpty(); if(i!==-1) G.rack[i]=t; else G.reserve.push(t); });
  Sound.place(); syncHumanHand(); render();
}

function slotReserveClick(id){
  if(G.suppressClick) return;
  const t=G.reserve.find(x=>x.id===id); if(!t) return;
  if(G.selHand.has(id)) G.selHand.delete(id); else G.selHand.add(id);
  Sound.select(); render();
}

/* Núcleo reutilizable: mandar fichas del atril a la zona de preparación
   (lo usan tanto el botón "Preparación" con selección, como arrastrar). */
function sendTilesToWork(tiles){
  if(!tiles||!tiles.length) return;
  if(G.gameMode==="team2v2"){ netSend({type:"teamAddLoose", tileIds:tiles.map(t=>t.id)}); Sound.place(); return; }
  G.workLoose.push(...tiles);
  removeFromHand(new Set(tiles.map(t=>t.id)));
  syncHumanHand(); Sound.place();
}
function sendToWork(){ netSendActivity();
  if(!G.selHand.size) return;
  const moving=handTiles().filter(t=>G.selHand.has(t.id));
  sendTilesToWork(moving);
  G.selHand=new Set();
  render();
}
function workTileClick(id){
  // Faltaba este guard (slotClick/slotReserveClick del atril sí lo tienen): sin él,
  // el click sintetizado que el navegador dispara después de un drag-que-no-llegó-a-
  // moverse (o un pointercancel de un gesto de scroll en mobile, ver prepDragUp/
  // prepDragCancel) volvía a togglear la selección de la ficha justo después de que
  // el propio drag ya la había re-renderizado — la ficha quedaba visualmente "rara"
  // (seleccionada/flotando) sin que el usuario haya tocado nada en realidad.
  if(G.suppressClick) return;
  if(G.selWork.has(id)) G.selWork.delete(id); else G.selWork.add(id);
  Sound.select(); render();
}
/* ---------- Arrastrar una ficha FUERA de la preparación, de vuelta al atril ----------
   Independiente del DRAG del atril (que arma juegos/pega en la mesa): acá el origen
   es una ficha ya en G.workLoose o dentro de un G.workGroups[i].tiles. */
let PREP_DRAG=null;
function findPrepTile(id){
  let t=G.workLoose.find(x=>x.id===id);
  if(t) return t;
  for(const g of G.workGroups){ t=g.tiles.find(x=>x.id===id); if(t) return t; }
  return null;
}
function prepTilePointerDown(e,id){
  e.stopPropagation();
  PREP_DRAG={x0:e.clientX,y0:e.clientY,tileId:id,active:false,ghost:null};
  window.addEventListener('pointermove',prepDragMove,{passive:false});
  window.addEventListener('pointerup',prepDragUp,{once:true});
  window.addEventListener('pointercancel',prepDragCancel,{once:true});
}
/* Causa raíz del bug reportado ("toco una ficha ya acomodada en Preparación y queda
   flotando"): en mobile el navegador puede mandar 'pointercancel' en vez de
   'pointerup' a mitad de un gesto (típicamente cuando el sistema lo reinterpreta
   como un scroll) — como solo había un listener de 'pointerup' con {once:true},
   ese listener nunca se disparaba, el ghost (el clon visual de la ficha que sigue
   al dedo, creado en prepDragMove) quedaba pegado en pantalla para siempre —
   literalmente flotando, ya que vive fuera de #app y ningún render() lo toca — y
   PREP_DRAG nunca se limpiaba. */
function prepDragCancel(){
  window.removeEventListener('pointermove',prepDragMove);
  window.removeEventListener('pointerup',prepDragUp);
  if(PREP_DRAG&&PREP_DRAG.ghost) PREP_DRAG.ghost.remove();
  document.querySelectorAll('.slot.dropover').forEach(s=>s.classList.remove('dropover'));
  document.querySelectorAll('.prep-group-row .meld.drop-ok,.prep-group-row .meld.drop-bad').forEach(s=>s.classList.remove('drop-ok','drop-bad'));
  document.querySelectorAll('.prep-loose.drop-ok').forEach(s=>s.classList.remove('drop-ok'));
  PREP_DRAG=null;
}
function prepDragMove(e){
  if(!PREP_DRAG) return;
  if(!PREP_DRAG.active){
    if(Math.hypot(e.clientX-PREP_DRAG.x0,e.clientY-PREP_DRAG.y0)<10) return;
    const t=findPrepTile(PREP_DRAG.tileId); if(!t){ PREP_DRAG=null; return; }
    PREP_DRAG.active=true;
    const g=document.createElement('div');
    g.className="sk-"+(P.skin||"clasica");
    g.style.cssText='position:fixed;z-index:99;pointer-events:none;opacity:.92;filter:drop-shadow(0 8px 12px rgba(0,0,0,.6))';
    g.innerHTML=tileHTML(t,'','width:34px;height:46px;font-size:15px');
    document.body.appendChild(g);
    PREP_DRAG.ghost=g;
    Sound.select();
  }
  e.preventDefault();
  PREP_DRAG.ghost.style.left=(e.clientX-18)+'px';
  PREP_DRAG.ghost.style.top=(e.clientY-52)+'px';
  document.querySelectorAll('.slot.dropover').forEach(s=>s.classList.remove('dropover'));
  document.querySelectorAll('.prep-group-row .meld.drop-ok,.prep-group-row .meld.drop-bad').forEach(s=>s.classList.remove('drop-ok','drop-bad'));
  document.querySelectorAll('.prep-loose.drop-ok').forEach(s=>s.classList.remove('drop-ok'));
  const el=document.elementFromPoint(e.clientX,e.clientY);
  const slot=el&&el.closest?el.closest('.slot'):null;
  if(slot){ slot.classList.add('dropover'); return; }
  // Soltar sobre un grupo ya armado: "¿el juego seguiría siendo válido con esta
  // ficha adentro?" — mismo feedback visual (drop-ok/drop-bad) que ya existe para
  // soltar una ficha del atril sobre un juego de la mesa.
  const groupRow=(el&&el.closest)?el.closest('.prep-group-row[data-gid]'):null;
  if(groupRow&&G.gameMode!=="team2v2"){
    const gid=groupRow.getAttribute('data-gid');
    const grp=G.workGroups.find(x=>x.id===gid);
    const meldEl=groupRow.querySelector('.meld');
    if(grp&&meldEl){
      const draggedTile=findPrepTile(PREP_DRAG.tileId);
      const preview=grp.tiles.filter(t=>t.id!==PREP_DRAG.tileId).concat(draggedTile?[draggedTile]:[]);
      meldEl.classList.add(meldInfo(preview).valid?'drop-ok':'drop-bad');
    }
    return;
  }
  // Soltar sobre la zona de fichas sueltas: siempre válido (ahí no hay reglas).
  const looseZone=(el&&el.closest)?el.closest('.prep-loose'):null;
  if(looseZone&&G.gameMode!=="team2v2") looseZone.classList.add('drop-ok');
}
// Fichas que vinieron de un juego de la MESA que se rompió con openMeld() (tuyo o de
// un rival — la mesa es de todos) — nunca pueden volver a tu mano, solo pueden
// reordenarse en juegos válidos que vuelvan a la mesa. Sin este chequeo, arrastrar
// cualquiera de esas fichas de vuelta al atril (pullTileFromPrep, pensado para
// devolver SOLO fichas que vos mandaste desde tu propia mano con sendToWork) las
// metía derecho en tu atril — un comodín o fichas ajenas "robadas" de la mesa,
// bug real reportado por el usuario ("las fichas del rival vuelven a mí").
function openedMeldTileIds(){
  return new Set(G.openedMeldIds.flatMap(id=>(G.openedBackup[id]?G.openedBackup[id].tiles.map(t=>t.id):[])));
}
function pullTileFromPrep(id){
  if(G.gameMode==="team2v2"){
    // La ficha puede ser tuya o de tu compañero/a (pool compartido) — el server la
    // devuelve a la mano de quien la puso originalmente, sea quien sea el que arrastra.
    netSend({type:"teamRemoveLoose", tileIds:[id]});
    Sound.place();
    return;
  }
  if(openedMeldTileIds().has(id)){
    Sound.error();
    setMsg("Esa ficha es de un juego de la mesa que rompiste — armá un juego válido con ella, no puede volver a tu atril.");
    return render();
  }
  let tile=null;
  const li=G.workLoose.findIndex(x=>x.id===id);
  if(li!==-1){ tile=G.workLoose.splice(li,1)[0]; }
  else{
    for(const g of G.workGroups){
      const gi=g.tiles.findIndex(x=>x.id===id);
      if(gi!==-1){ tile=g.tiles.splice(gi,1)[0]; break; }
    }
    G.workGroups=G.workGroups.filter(g=>g.tiles.length>0);
  }
  if(!tile) return;
  G.selWork.delete(id);
  placeInRack(tile);
  syncHumanHand();
  Sound.place();
}
// Mover una ficha DENTRO de Preparación sin desarmar nada: de suelta a un grupo, de
// un grupo a suelta, o de un grupo a otro. Antes la única forma de "pegar" una ficha
// suelta a un juego ya armado era desarmarlo entero (dissolveGroup) y rehacerlo con
// formGroup — pedido explícito del usuario: "arrastrá [7] sobre [3][4][5][6] y
// obtené [3][4][5][6][7]" sin ese paso intermedio.
function moveTileInPrep(tileId,dest){
  let tile=null;
  const li=G.workLoose.findIndex(x=>x.id===tileId);
  if(li!==-1){ tile=G.workLoose.splice(li,1)[0]; }
  else{
    for(const g of G.workGroups){
      const gi=g.tiles.findIndex(x=>x.id===tileId);
      if(gi!==-1){ tile=g.tiles.splice(gi,1)[0]; break; }
    }
  }
  if(!tile) return false;
  if(dest.type==="group"){
    const g=G.workGroups.find(x=>x.id===dest.groupId);
    if(g) g.tiles.push(tile); else G.workLoose.push(tile); // el grupo ya no existe: no perder la ficha
  } else {
    G.workLoose.push(tile);
  }
  G.workGroups=G.workGroups.filter(g=>g.tiles.length>0);
  return true;
}
function prepDragUp(e){
  window.removeEventListener('pointermove',prepDragMove);
  window.removeEventListener('pointercancel',prepDragCancel);
  if(!PREP_DRAG) return;
  if(PREP_DRAG.active){
    if(PREP_DRAG.ghost) PREP_DRAG.ghost.remove();
    document.querySelectorAll('.slot.dropover').forEach(s=>s.classList.remove('dropover'));
    document.querySelectorAll('.prep-group-row .meld.drop-ok,.prep-group-row .meld.drop-bad').forEach(s=>s.classList.remove('drop-ok','drop-bad'));
    document.querySelectorAll('.prep-loose.drop-ok').forEach(s=>s.classList.remove('drop-ok'));
    const el=document.elementFromPoint(e.clientX,e.clientY);
    const rackZone=el&&el.closest?el.closest('.col-rack'):null;
    const groupRow=(el&&el.closest)?el.closest('.prep-group-row[data-gid]'):null;
    const looseZone=(el&&el.closest)?el.closest('.prep-loose'):null;
    if(rackZone){
      pullTileFromPrep(PREP_DRAG.tileId);
    } else if(groupRow&&G.gameMode!=="team2v2"){
      if(moveTileInPrep(PREP_DRAG.tileId,{type:"group",groupId:groupRow.getAttribute('data-gid')})) Sound.place();
    } else if(looseZone&&G.gameMode!=="team2v2"){
      if(moveTileInPrep(PREP_DRAG.tileId,{type:"loose"})) Sound.place();
    }
    G.suppressClick=true; setTimeout(()=>{G.suppressClick=false;},60);
    render();
  }
  PREP_DRAG=null;
}
function formGroup(){ netSendActivity();
  if(!G.selWork.size) return;
  if(G.gameMode==="team2v2"){ netSend({type:"teamFormGroup", tileIds:[...G.selWork]}); G.selWork=new Set(); Sound.place(); return; }
  const tiles=G.workLoose.filter(t=>G.selWork.has(t.id));
  G.workLoose=G.workLoose.filter(t=>!G.selWork.has(t.id));
  G.workGroups.push({id:nid("wg"),tiles});
  G.selWork=new Set(); Sound.place(); render();
}
function dissolveGroup(id){ netSendActivity();
  if(G.gameMode==="team2v2"){ netSend({type:"teamDissolveGroup", groupId:id}); return; }
  const g=G.workGroups.find(x=>x.id===id); if(!g) return;
  G.workLoose.push(...g.tiles);
  G.workGroups=G.workGroups.filter(x=>x.id!==id);
  render();
}
function addSelToGroup(id){
  if(!G.selWork.size) return;
  if(G.gameMode==="team2v2"){ netSend({type:"teamAddToGroup", groupId:id, tileIds:[...G.selWork]}); G.selWork=new Set(); Sound.place(); return; }
  const tiles=G.workLoose.filter(t=>G.selWork.has(t.id));
  G.workLoose=G.workLoose.filter(t=>!G.selWork.has(t.id));
  const g=G.workGroups.find(x=>x.id===id);
  if(g) g.tiles.push(...tiles);
  G.selWork=new Set(); Sound.place(); render();
}
function openMeld(id){
  if(G.online&&G.gameMode==="team2v2"){
    // 2v2 online: abrir un juego de la mesa es una acción del EQUIPO, autoritativa
    // en el server (mismo patrón que teamFormGroup/teamAddToGroup/etc.) — el server
    // valida el costo de ruptura, mueve las fichas a la zona compartida, y el
    // compañero ve exactamente lo mismo apenas llega el siguiente estado.
    netSend({type:"teamOpenMeld", meldId:id});
    return;
  }
  const h=human(); if(!h||!h.hasLaidInitial) return;
  const m=G.table.find(x=>x.id===id); if(!m) return;
  if(m.tiles.some(t=>t.joker)){
    if(G.jokerBreaksLeft<=0){
      Sound.error(); setMsg("Ese juego tiene comodín y ya no te quedan rupturas (0/3)."); return render();
    }
    G.jokerBreaksLeft--;
    setMsg("🔓 Rompiste un juego con comodín ("+G.jokerBreaksLeft+" rupturas restantes). Rearmalo con las mismas reglas.");
    Sound.flip();
  } else {
    Sound.place();
  }
  G.openedBackup[m.id]=m;
  G.workLoose.push(...m.tiles);
  G.table=G.table.filter(x=>x.id!==m.id);
  G.openedMeldIds.push(m.id);
  render();
}
function fullCancel(showMsg){ netSendActivity();
  if(G.gameMode==="team2v2"){
    netSend({type:"teamClearWork"});
    if(showMsg){ setMsg("Se vació la zona de preparación del equipo."); render(); }
    return;
  }
  // fichas que pertenecen a juegos abiertos de la mesa: vuelven con su juego, NO al atril
  const openedTileIds=openedMeldTileIds();
  const all=[...G.workLoose,...G.workGroups.flatMap(g=>g.tiles)];
  all.forEach(t=>{ if(!openedTileIds.has(t.id)) placeInRack(t); });
  const restored=G.openedMeldIds.map(id=>G.openedBackup[id]).filter(Boolean);
  G.table.push(...restored);
  G.openedMeldIds.forEach(id=>delete G.openedBackup[id]);
  G.workLoose=[]; G.workGroups=[]; G.selWork=new Set(); G.openedMeldIds=[];
  syncHumanHand();
  if(showMsg){ setMsg("Jugada cancelada: todo volvió a su lugar."); render(); }
}
function confirmTurn(){
  const h=human();
  if(G.workLoose.length){ Sound.error(); setMsg("Hay fichas sueltas en la zona de armado: agrupalas o cancelá."); return render(); }
  if(!G.workGroups.length){ Sound.error(); setMsg("No armaste ningún juego."); return render(); }
  const infos=G.workGroups.map(g=>meldInfo(g.tiles));
  if(infos.some(i=>!i.valid)){ Sound.error(); setMsg("Hay un juego inválido (revisá colores y números)."); return render(); }
  if(!h.hasLaidInitial){
    if(G.openedMeldIds.length){ Sound.error(); setMsg("Sin salir con 30 no podés tocar la mesa."); return render(); }
    // Regla definitiva: UN ÚNICO juego que por sí solo valga 30+ — no vale sumar
    // varios juegos chicos para llegar a 30 (se puede bajar más de uno junto, con
    // tal de que alguno de ellos ya llegue a 30 por su cuenta).
    if(!infos.some(i=>(i.value||0)>=30)){
      const best=Math.max(0,...infos.map(i=>i.value||0));
      Sound.error(); setMsg("Ningún juego llega a 30 (el mejor suma "+best+"): tu primera bajada tiene que ser UN juego que por sí solo valga 30 o más."); return render();
    }
  }
  const wasFirst=!h.hasLaidInitial;
  let gained=0;
  G.workGroups.forEach(g=>{
    gained+=meldInfo(g.tiles).value||0;
    g.tiles.forEach(t=>t.skin=P.skin||"clasica");
    G.table.push({id:nid("m"),tiles:g.tiles,ownerName:h.name,ownerId:h.id,ownerSkin:P.skin||"clasica",fx:P.effect||"clasico",order:++G.meldCounter});
    checkMeldAchievements(g.tiles);
    if(wasFirst&&(meldInfo(g.tiles).value||0)>=50) unlockAch("salida50");
  });
  G.scores[h.id]=(G.scores[h.id]||0)+gained;
  slamFX();
  const _newMelds=G.table.slice(-G.workGroups.length);
  G.freshMelds=new Set(_newMelds.map(m=>m.id));
  G.freshMeldKind=Object.assign({},...(_newMelds.map(m=>({[m.id]:"new"}))));
  if(_newMelds.length) queueMeldFx(_newMelds[_newMelds.length-1].id, P.effect||"clasico");
  setTimeout(()=>{ G.freshMelds=new Set(); },700);
  const comboCount=G.workGroups.length;
  G.workGroups=[]; G.openedMeldIds=[]; G.openedBackup={};
  h.hasLaidInitial=true;
  G.passStreak=0;
  Sound.meld();
  if(comboCount>=2||gained>=50) setTimeout(()=>bigPlayFX(comboCount>=2?"¡COMBO x"+comboCount+"! +"+gained+" pts":"¡GRAN JUGADA! +"+gained+" pts"),150);
  setMsg(wasFirst?"¡Saliste con tu juego inicial! 🎉":"Jugada confirmada.");
  syncHumanHand();
  if(!handTiles().length) return endGame(h);
  if(checkPointsWin(h)) return;
  finishTeamTurn();
}
function doDrawOnly(){
  if(!G.bag.length) return false;
  const t=G.bag.shift();
  placeInRack(t);
  G.dealtStagger={[t.id]:0};
  clearTimeout(G._dealtStaggerT);
  G._dealtStaggerT=setTimeout(()=>{ G.dealtStagger={}; if(G.screen==="playing") render(); },500);
  syncHumanHand(); Sound.draw();
  return true;
}
function doDrawAndPass(){
  if(!G.bag.length){
    G.passStreak++;
    if(G.passStreak>=G.players.length) return endGameByPoints();
    setMsg("Pozo vacío: pasás. Si nadie puede jugar, gana el que menos puntos tenga en mano.");
    return endTurn();
  }
  doDrawOnly();
  setMsg("Tomaste una ficha del pozo.");
  endTurn();
}
function drawAndPass(){
  if(G.workLoose.length||G.workGroups.length){ Sound.error(); setMsg("Cancelá la jugada de la zona de armado antes de tomar ficha."); return render(); }
  if(G.teamMode){ openConsensusModal(); return; }
  doDrawAndPass();
}

/* ================================================================
   2v2 EN EQUIPO: checkpoint de consenso "tomo ficha / paso"
   Al terminar el turno del equipo humano, tanto vos como tu compañera IA
   eligen independientemente. Si coinciden, se ejecuta; si no, el equipo
   pierde una vida y el turno pasa igual.
   ================================================================ */
function finishTeamTurn(){
  const cur=G.players[G.currentIdx];
  if(G.teamMode && cur && cur.isHuman){ openConsensusModal(); return; }
  endTurn();
}
function decideTeammateChoice(){
  if(!G.bag.length) return "paso";
  const remaining=handTiles().length;
  let drawChance=0.55;
  if(remaining<=6) drawChance=0.75;       // el equipo está cerca de ganar: conviene arriesgar
  else if(remaining>=24) drawChance=0.35; // todavía sobran fichas: no hay apuro
  return Math.random()<drawChance ? "ficha" : "paso";
}
function openConsensusModal(){
  G.consensus={step:"choosing"};
  render();
}
function chooseConsensus(choice){
  if(!G.consensus||G.consensus.step!=="choosing") return;
  Sound.select();
  const mate=decideTeammateChoice();
  G.consensus={step:"result", human:choice, mate, agree:choice===mate};
  render();
  setTimeout(resolveConsensus,1600);
}
function resolveConsensus(){
  const c=G.consensus;
  G.consensus=null;
  if(!c){ render(); return; }
  if(c.agree){
    if(c.human==="ficha"){
      if(doDrawOnly()) setMsg("El equipo se puso de acuerdo: tomaron una ficha del pozo.");
      else {
        G.passStreak++;
        if(G.passStreak>=G.players.length){ render(); endGameByPoints(); return; }
        setMsg("Pozo vacío: el equipo pasa.");
      }
    } else {
      setMsg("El equipo se puso de acuerdo: pasan el turno.");
    }
  } else {
    G.lives--;
    Sound.error();
    setMsg("😬 No coincidieron ("+(c.human==="ficha"?"vos: tomar ficha":"vos: pasar")+" · compañera: "+(c.mate==="ficha"?"tomar ficha":"pasar")+") — el equipo pierde una vida.");
    if(G.lives<=0){ fullCancel(false); render(); endGameAbandon(); return; }
  }
  render();
  endTurn();
}
function renderConsensusModal(){
  const c=G.consensus;
  if(c.step==="choosing"){
    return `<div class="pauseovl">
      <div class="pausecard a-pop" style="text-align:center">
        <h2 style="font-family:var(--font-heading);color:#ffe9a8;font-size:19px;margin-bottom:8px">🤝 ¿Qué hace el equipo?</h2>
        <p style="font-size:11.5px;color:rgba(232,238,247,.6);margin-bottom:14px;line-height:1.5">
          Elegí sin saber qué va a elegir tu compañera. Si no coinciden, pierden una vida igual.
        </p>
        <button class="btn btn-gold" onclick="chooseConsensus('ficha')">🎴 Tomo ficha</button>
        <button class="btn btn-ghost" style="margin-top:8px" onclick="chooseConsensus('paso')">🤚 Paso</button>
      </div>
    </div>`;
  }
  return `<div class="pauseovl">
    <div class="pausecard a-pop" style="text-align:center">
      <h2 style="font-family:var(--font-heading);color:${c.agree?"#34d399":"#f87171"};font-size:19px;margin-bottom:10px">${c.agree?"✔ ¡Coincidieron!":"✖ No coincidieron"}</h2>
      <div style="display:flex;justify-content:center;gap:18px;font-size:13px">
        <div><div style="color:rgba(232,238,247,.5);font-size:10.5px">VOS</div><b>${c.human==="ficha"?"🎴 Ficha":"🤚 Paso"}</b></div>
        <div><div style="color:rgba(232,238,247,.5);font-size:10.5px">COMPAÑERA</div><b>${c.mate==="ficha"?"🎴 Ficha":"🤚 Paso"}</b></div>
      </div>
      ${!c.agree?`<p style="font-size:11.5px;color:#f87171;margin-top:12px">💔 El equipo pierde una vida.</p>`:""}
    </div>
  </div>`;
}
function suggestPlays(){
  if(G.hintsLeft<=0){ Sound.error(); setMsg("No te quedan más pistas."); render(); return; }
  if(G.hintsLeft<=0){ Sound.error(); setMsg("Ya usaste tus 10 pistas de la partida."); return render(); }
  G.hintsLeft--;
  const h=human();
  const mine=handTiles();
  const melds=aiFindAllMelds(mine).filter(m=>meldInfo(m).valid);

  // jugadas sobre la mesa (solo si ya saliste)
  const tablePlays=[]; // {tile, desc, locked}
  if(h.hasLaidInitial){
    for(const meld of G.table){
      // Los juegos con comodín ("candado" 🔓) no se pueden extender con un simple
      // arrastre (attachToMeld los bloquea) — hay que abrirlos primero. Antes esto
      // hacía que la pista los ignorara del todo y dijera "no hay jugada" aunque sí
      // la había (con un paso extra): ahora se detectan igual, pero marcados como
      // "locked" y solo si todavía quedan rupturas de comodín disponibles.
      const hasJoker=meld.tiles.some(t=>t.joker);
      if(hasJoker&&G.jokerBreaksLeft<=0) continue;
      const info=meldInfo(meld.tiles);
      if(!info.valid) continue;
      if(info.type==="grupo"&&meld.tiles.length<4){
        const usedC=new Set(meld.tiles.filter(t=>!t.joker).map(t=>t.color));
        mine.forEach(t=>{
          if(!t.joker&&t.number===info.number&&!usedC.has(t.color))
            tablePlays.push({tile:t,locked:hasJoker,desc:(hasJoker?"🔓 abriendo el comodín, tu ":"tu ")+t.number+" "+t.color+" entra en el grupo #"+meld.order});
        });
      } else if(info.type==="escalera"){
        const normals=meld.tiles.filter(t=>!t.joker);
        const nums=normals.map(t=>t.number);
        const mn=Math.min(...nums), mx=Math.max(...nums);
        const color=normals[0].color;
        mine.forEach(t=>{
          if(!t.joker&&t.color===color&&(t.number===mn-1||t.number===mx+1))
            tablePlays.push({tile:t,locked:hasJoker,desc:(hasJoker?"🔓 abriendo el comodín, tu ":"tu ")+t.number+" "+t.color+" extiende la escalera #"+meld.order});
          // partir escalera larga con una ficha duplicada del medio
          if(!t.joker&&t.color===color&&t.number>mn+1&&t.number<mx-1&&meld.tiles.length>=5
             &&(t.number-mn+1)>=3&&(mx-t.number+1)>=3)
            tablePlays.push({tile:t,locked:hasJoker,desc:(hasJoker?"🔓 abriendo el comodín, con tu ":"con tu ")+t.number+" "+t.color+" podés partir la escalera #"+meld.order+" en dos"});
        });
      }
    }
  }

  if(!melds.length&&!tablePlays.length){
    G.hinted=new Set(); Sound.error();
    setMsg("No veo jugadas ni en tu atril ni en la mesa. Tomá ficha y pasá.");
    return render();
  }

  const ids=new Set([
    ...melds.flatMap(m=>m.map(t=>t.id)),
    ...tablePlays.map(p=>p.tile.id)
  ]);
  G.hinted=ids;
  setTimeout(()=>{ G.hinted=new Set(); render(); },5000);
  Sound.select();

  let msg="💡 ";
  if(!h.hasLaidInitial){
    const opener=melds.find(m=>meldInfo(m).value>=30);
    if(opener){ const i=meldInfo(opener); msg+="¡Podés salir! "+i.type+" de "+i.value+" pts."; }
    else if(melds.length){ const best=Math.max(...melds.map(m=>meldInfo(m).value)); msg+=melds.length+" juego(s) armables, el mejor suma "+best+" (falta para 30)."; }
    else msg+="Nada armable todavía.";
  } else {
    const parts=[];
    if(melds.length) parts.push(melds.length+" juego(s) para bajar");
    if(tablePlays.length) parts.push(tablePlays.length+" ficha(s) para colgar en la mesa: "+tablePlays.slice(0,2).map(p=>p.desc).join("; ")+(tablePlays.length>2?"…":""));
    msg+=parts.join(" · ");
  }
  setMsg(msg+" (fichas en celeste)");
  render();
}

/* ---------------- IA por niveles: la dificultad es CÓMO juega, no cuánto tarda ----------------
   Antes "fácil" tardaba 12s en responder y "extremo" 1.5s — la demora no tenía nada
   que ver con qué tan bien jugaba cada nivel (de hecho estaba al revés de lo intuitivo).
   Pedido explícito: cada bot decide en <5s siempre, la dificultad real viene de
   BurakoCore.AI_CONFIG (profundidad de búsqueda, uso de comodines, probabilidad de
   pegar fichas sueltas) — el MISMO motor que ya usan los bots online en server.js,
   así que "fácil" acá juega tan flojo como un bot fácil online, no es una IA aparte
   más simple. Ver runAi() más abajo: TODOS los niveles pasan por BurakoCore ahora
   (antes solo extremo/claude; facil/normal/dificil tenían su propia lógica más
   tosca con un 30% de "no ve su jugada" — reemplazado por la profundidad de
   búsqueda limitada de AI_CONFIG.easy, que es una forma más real de jugar peor). */
const AI_LEVEL_TO_CONFIG={facil:"easy", normal:"normal", dificil:"hard", extremo:"expert", claude:"claude"};
function scheduleAi(p){
  setMsg(p.name+" está pensando");
  render();
  const cfgKey=AI_LEVEL_TO_CONFIG[G.aiLevel]||"normal";
  const range=(window.BurakoCore&&BurakoCore.AI_CONFIG[cfgKey]&&BurakoCore.AI_CONFIG[cfgKey].delay)||[900,1800];
  const delay=range[0]+Math.random()*(range[1]-range[0]);
  const to=setTimeout(()=>runAi(p), delay);
  G.aiTimeouts.push(to);
}
function runAi(p){
  let hand=p.hand.slice(), played=false;
  const lvl=G.aiLevel;
  const commit=(melds)=>{
    const used=new Set(melds.flatMap(m=>m.map(t=>t.id)));
    hand=hand.filter(t=>!used.has(t.id));
    let gained=0;
    melds.forEach(tiles=>{
      gained+=meldInfo(tiles).value||0;
      tiles.forEach(t=>t.skin=p.skin||"clasica");
      G.table.push({id:nid("m"),tiles,ownerName:p.name,ownerId:p.id,ownerSkin:p.skin||"clasica",fx:"clasico",order:++G.meldCounter});
    });
    G.scores[p.id]=(G.scores[p.id]||0)+gained;
    G.freshMelds=new Set(G.table.slice(-melds.length).map(m=>m.id));
    slamFX();
    setTimeout(()=>{ G.freshMelds=new Set(); render(); },700);
    Sound.meld();
  };
  if(window.BurakoCore){
    // TODOS los niveles pasan por acá ahora (antes solo extremo/claude — facil/
    // normal/dificil tenían su propia lógica más tosca, con un 30% de "no ve su
    // jugada" para fácil). Mismo motor de búsqueda combinatoria que usan los bots
    // online (server/burako-core.js), con la profundidad/uso de comodines/prob.
    // de pegar que le toque a este nivel (AI_CONFIG, arriba en scheduleAi) — la
    // dificultad real es CUÁNTO Y QUÉ TAN BIEN busca, no un dado aparte.
    // planBestMove evalúa además si conviene cambiar un comodín suelto de la
    // mesa por la ficha real que le corresponde (intercambio 1x1, siempre legal)
    // cuando eso arma algo mejor que sin tocar nada.
    const BC = window.BurakoCore;
    const cfg = BC.AI_CONFIG[AI_LEVEL_TO_CONFIG[lvl]||"normal"];
    const plan = BC.planBestMove(hand, p.hasLaidInitial, G.table, G.scores, p.id, cfg.depth, cfg.jokerUse);
    if(plan.swap){
      const targetMeld=G.table.find(m=>m.id===plan.swap.meld.id);
      if(targetMeld){
        plan.swap.realTile.skin=p.skin||"clasica";
        targetMeld.tiles=sortMeldTiles(targetMeld.tiles.filter(t=>t.id!==plan.swap.jokerTile.id).concat([plan.swap.realTile]));
        setMsg(p.name+" cambió un comodín suelto de la mesa por su ficha real.");
      }
      hand=hand.filter(t=>t.id!==plan.swap.realTile.id).concat([plan.swap.jokerTile]);
    }
    const move=plan.move;
    if(move){
      commit([move.tiles]);
      const wasFirst=!p.hasLaidInitial;
      p.hasLaidInitial=true;
      setMsg(p.name+" bajó un "+move.info.type+" de "+move.info.value+" pts."+(wasFirst?" (salida)":""));
      played=true;
      if(Math.random()<cfg.attachProb){
        const att=BC.findBestAttach(hand, G.table);
        if(att){
          hand=hand.filter(t=>t.id!==att.tile.id);
          att.tile.skin=p.skin||"clasica";
          const targetMeld=G.table.find(m=>m.id===att.meld.id);
          if(targetMeld) targetMeld.tiles.push(att.tile);
          const addedVal=att.tile.joker?25:att.tile.number;
          G.scores[p.id]=(G.scores[p.id]||0)+addedVal;
          played=true;
        }
      }
    } else if(p.hasLaidInitial){
      // Reorganizar la mesa: si no hay nada para bajar ni pegar directo, abre
      // UN juego ya bajado (propio o rival) y lo rearma junto con fichas de la
      // mano en uno o más juegos válidos — mismo motor y misma regla que los
      // bots online (server.js maybeAIPlay), reusando el 100% de lo abierto.
      // Usa su PROPIA cuota de rupturas (G.aiJokerBreaks[p.id]), separada de
      // la del humano (G.jokerBreaksLeft) — antes compartían el mismo pozo.
      if(G.aiJokerBreaks[p.id]===undefined) G.aiJokerBreaks[p.id]=3;
      const reorg=BC.findBestReorg(hand, G.table, G.aiJokerBreaks[p.id], cfg.jokerUse);
      if(reorg){
        const openedMeld=G.table.find(m=>m.id===reorg.meldId);
        if(openedMeld&&openedMeld.tiles.some(t=>t.joker)) G.aiJokerBreaks[p.id]--;
        const usedHandIds=new Set(reorg.handTiles.map(t=>t.id));
        hand=hand.filter(t=>!usedHandIds.has(t.id));
        G.table=G.table.filter(m=>m.id!==reorg.meldId);
        reorg.newMelds.forEach(nm=>{
          nm.tiles.forEach(t=>t.skin=t.skin||p.skin||"clasica");
          G.table.push({id:nid("m"),tiles:sortMeldTiles(nm.tiles),ownerName:p.name,ownerId:p.id,ownerSkin:p.skin||"clasica",fx:"clasico",order:++G.meldCounter});
        });
        G.scores[p.id]=(G.scores[p.id]||0)+reorg.value;
        G.freshMelds=new Set(G.table.slice(-reorg.newMelds.length).map(m=>m.id));
        slamFX();
        setTimeout(()=>{ G.freshMelds=new Set(); },700);
        Sound.meld();
        setMsg(p.name+" reorganizó la mesa"+(reorg.value>0?" (+"+reorg.value+" pts)":"")+".");
        played=true;
      }
    }
  }

  p.hand=hand;
  if(!hand.length) return endGame(p);
  if(checkPointsWin(p)) return;
  if(played){ G.passStreak=0; }
  else {
    if(!G.bag.length){
      G.passStreak++;
      if(G.passStreak>=G.players.length) return endGameByPoints();
      setMsg(p.name+" pasa (pozo vacío).");
      return endTurn();
    }
    p.hand.push(G.bag.shift());
    Sound.draw();
    setMsg(p.name+" tomó una ficha.");
  }
  endTurn();
}
/* ================================================================
   RENDER
   ================================================================ */
// Modo Galáctico: mapa de emoji/nombre/color/descripción corta de cada habilidad —
// usado para pintar la cara de la ficha (tileHTML), la fila de habilidades del
// atril y el texto de los tooltips/modales cuando se toca o se usa una.
const ABILITY_META={
  robo:{emoji:"🦹",label:"Robo",color:"#ef4444",desc:"Robás una ficha visible de una combinación rival de la mesa."},
  intercambio:{emoji:"🔄",label:"Intercambio",color:"#14b8a6",desc:"Das una ficha tuya y recibís una al azar de la mano de un rival."},
  robo_dirigido:{emoji:"🎯",label:"Robo dirigido",color:"#f97316",desc:"Ves toda la mano de un rival y elegís exactamente qué ficha robarle."},
  escudo:{emoji:"🛡",label:"Escudo",color:"#38bdf8",desc:"Te protege de cualquier habilidad rival hasta que vuelva a ser tu turno."},
  comodin:{emoji:"🃏",label:"Comodín",color:"#facc15",desc:"Convertís una ficha normal tuya en comodín para siempre."},
  robo_doble:{emoji:"✋",label:"Robo doble",color:"#22c55e",desc:"La próxima vez que robes del pozo, sacás 2 fichas en vez de 1."},
  bloqueo:{emoji:"🚫",label:"Bloqueo",color:"#dc2626",desc:"Un rival elegido no puede usar habilidades en su próximo turno."},
  vision:{emoji:"👁",label:"Visión",color:"#818cf8",desc:"Espiás 3 fichas al azar de la mano de un rival, en privado."},
  teletransporte:{emoji:"🌀",label:"Teletransporte",color:"#06b6d4",desc:"Devolvés una ficha tuya al pozo y sacás una nueva al toque."},
  atraccion:{emoji:"🧲",label:"Atracción",color:"#e879f9",desc:"Movés una ficha rival de la mesa a una combinación tuya, si entra."},
};
function hexToRgb(hex){
  const h=(hex||"#a855f7").replace("#","");
  return `${parseInt(h.substring(0,2),16)},${parseInt(h.substring(2,4),16)},${parseInt(h.substring(4,6),16)}`;
}
function tileHTML(t, cls="", style=""){
  if(!t) return "";
  if(t.ability){
    const meta=ABILITY_META[t.ability]||{emoji:"✨",label:t.ability,color:"#a855f7"};
    return `<div class="tile tile-ability ${cls}" data-c="ability" data-tid="${t.id}" title="${esc(meta.label)}" style="--fx-rgb:${hexToRgb(meta.color)};${style}">${meta.emoji}<span class="sel-halo"></span></div>`;
  }
  const cname=t.joker?"comodin":t.color;
  const content=t.joker?"★":t.number;
  const mateBadge=t.owner==="teammate"?`<span class="tile-mate-badge" title="Ficha de tu compañera de equipo">🤖</span>`:"";
  const core=`<div class="tile c-${cname} dotc-${cname} ${cls}" data-c="${cname}" data-tid="${t.id}" style="${style}">${content}${mateBadge}<span class="sel-halo"></span></div>`;
  return t.skin?`<span class="sk-${t.skin}" style="display:contents">${core}</span>`:core;
}
function tileBtn(t, cls, onAttr){
  if(t.ability){
    const meta=ABILITY_META[t.ability]||{emoji:"✨",label:t.ability,color:"#a855f7"};
    return `<button class="tile tile-ability ${cls}" data-c="ability" data-tid="${t.id}" title="${esc(meta.label)}" style="--fx-rgb:${hexToRgb(meta.color)}" ${onAttr}>${meta.emoji}<span class="sel-halo"></span></button>`;
  }
  const cname=t.joker?"comodin":t.color;
  const mateBadge=t.owner==="teammate"?`<span class="tile-mate-badge" title="Ficha de tu compañera de equipo">🤖</span>`:"";
  return `<button class="tile c-${cname} dotc-${cname} ${cls}" data-c="${cname}" data-tid="${t.id}" ${onAttr}>${t.joker?"★":t.number}${mateBadge}<span class="sel-halo"></span></button>`;
}

/* Modo Galáctico: activar una habilidad sin objetivo (Escudo, Robo doble) es
   un solo mensaje directo. Las que necesitan elegir un objetivo (ficha propia,
   rival, o ficha de una combinación en la mesa) abren un modal chico — el
   contenido del modal depende de la habilidad, ver abilityModalHTML(). */
function doUseSimpleAbility(tileId, ability){
  netSend({type:"useAbility", ability, tileId});
}
// Tocar una ficha de habilidad en el atril muestra primero un cartelito con qué
// hace (en vez de activarla directo) — recién con "Usar" ahí dentro se dispara
// la acción real (directa si no tiene objetivo, o el modal de selección si sí).
function toggleAbilityTip(tileId, ability){
  if(G.abilityTip && G.abilityTip.tileId===tileId){ G.abilityTip=null; render(); return; }
  G.abilityTip={tileId, ability};
  render();
}
function closeAbilityTip(){ G.abilityTip=null; render(); }
function confirmAbilityTipUse(){
  if(!G.abilityTip) return;
  const {tileId, ability}=G.abilityTip;
  const targetless=ability==="escudo"||ability==="robo_doble";
  G.abilityTip=null;
  if(targetless) doUseSimpleAbility(tileId, ability);
  else openAbilityTargetModal(ability, tileId);
}
function openAbilityTargetModal(ability, tileId){
  G.abilityModal={ability, tileId, offerTileId:null};
  render();
}
function closeAbilityModal(){ G.abilityModal=null; render(); }
function pickAbilityTarget(chosenTileId){
  if(!G.abilityModal) return;
  const {ability, tileId}=G.abilityModal;
  netSend({type:"useAbility", ability, tileId, chosenTileId});
  G.abilityModal=null; render();
}
function setAbilityOfferTile(offerTileId){
  if(!G.abilityModal) return;
  G.abilityModal.offerTileId=offerTileId;
  render();
}
function finishAbilityWithTarget(targetPlayerId){
  if(!G.abilityModal) return;
  const {ability, tileId, offerTileId}=G.abilityModal;
  if(ability==="intercambio"&&!offerTileId) return;
  if(ability==="robo_dirigido"){
    // Paso 1 de 2: pedimos la mano del rival (privado) — todavía no gastamos la
    // habilidad. El modal se vuelve a abrir solo, con la elección de ficha, cuando
    // llegue la respuesta "abilityInfo" del servidor — guardamos el tileId acá
    // porque G.abilityModal se pone en null mientras esperamos esa respuesta
    // (si no, se perdía y el servidor terminaba respondiendo "no tenés esa ficha").
    G._pendingRoboDirigidoTileId=tileId;
    netSend({type:"requestAbilityInfo", ability:"robo_dirigido", tileId, targetPlayerId});
    G.abilityModal=null; render();
    return;
  }
  netSend({type:"useAbility", ability, tileId, targetPlayerId, offerTileId});
  G.abilityModal=null; render();
}
function finishRobo(meldId, targetTileId){
  if(!G.abilityModal) return;
  netSend({type:"useAbility", ability:"robo", tileId:G.abilityModal.tileId, meldId, targetTileId});
  G.abilityModal=null; render();
}
function finishRoboDirigido(chosenTileId){
  if(!G.abilityModal) return;
  const {tileId, targetPlayerId}=G.abilityModal;
  netSend({type:"useAbility", ability:"robo_dirigido", tileId, targetPlayerId, chosenTileId});
  G.abilityModal=null; render();
}
function pickAtraccionSource(meldId, tileId){
  if(!G.abilityModal) return;
  G.abilityModal.sourceMeldId=meldId;
  G.abilityModal.sourceTileId=tileId;
  render();
}
function finishAtraccion(destMeldId){
  if(!G.abilityModal||!G.abilityModal.sourceMeldId) return;
  const {tileId, sourceMeldId, sourceTileId}=G.abilityModal;
  netSend({type:"useAbility", ability:"atraccion", tileId, sourceMeldId, sourceTileId, destMeldId});
  G.abilityModal=null; render();
}
function toggleAtraccionHandTile(tileId){
  if(!G.abilityModal) return;
  G.abilityModal.handSel=G.abilityModal.handSel||new Set();
  if(G.abilityModal.handSel.has(tileId)) G.abilityModal.handSel.delete(tileId);
  else G.abilityModal.handSel.add(tileId);
  render();
}
function finishAtraccionFromHand(){
  if(!G.abilityModal||!G.abilityModal.handSel||!G.abilityModal.handSel.size) return;
  const {tileId, sourceMeldId, sourceTileId, handSel}=G.abilityModal;
  netSend({type:"useAbility", ability:"atraccion", tileId, sourceMeldId, sourceTileId, handTileIds:[...handSel]});
  G.abilityModal=null; render();
}
function abilityModalWrap(ability, stepLabel, bodyHTML, closeLabel){
  const meta=ABILITY_META[ability]||{emoji:"✨",label:ability,color:"#a855f7",desc:""};
  const rgb=hexToRgb(meta.color);
  return `<div class="pauseovl ability-modal-ovl" onclick="if(event.target===this)closeAbilityModal()">
    <div class="ability-modal-card a-pop" style="--fx-rgb:${rgb}">
      <div class="ability-modal-head">
        <span class="ability-modal-emoji">${meta.emoji}</span>
        <div class="ability-modal-headtext"><b>${esc(meta.label)}</b><span>${esc(meta.desc)}</span></div>
      </div>
      <div class="ability-modal-step">${stepLabel}</div>
      <div class="ability-modal-body">${bodyHTML}</div>
      <button class="btn btn-ghost" style="margin-top:10px" onclick="closeAbilityModal()">${closeLabel||"✖ Cancelar"}</button>
    </div>
  </div>`;
}
function abilityModalHTML(){
  const am=G.abilityModal; if(!am) return "";
  const h=human();
  const opps=(G.players||[]).filter(p=>!p.isHuman);
  if(am.ability==="teletransporte"){
    const pool=[...(h?h.hand:[]), ...(G.myAbilityTiles||[])].filter(t=>t.id!==am.tileId);
    return abilityModalWrap("teletransporte", "Elegí una ficha tuya para devolver al pozo", `
      <div class="ability-modal-grid">
        ${pool.length?pool.map(t=>tileBtn(t,"",`onclick="pickAbilityTarget('${t.id}')"`)).join(""):`<span class="ability-modal-empty">No te quedan otras fichas.</span>`}
      </div>
    `);
  }
  if(am.ability==="bloqueo"||am.ability==="vision"||am.ability==="robo_dirigido"){
    const steps={bloqueo:"Elegí a quién bloquear", vision:"Elegí a quién espiar", robo_dirigido:"Elegí de quién robar una ficha específica"};
    return abilityModalWrap(am.ability, steps[am.ability], `
      <div class="ability-modal-oppList">
        ${opps.length?opps.map(p=>`<button class="ability-modal-opp" onclick="finishAbilityWithTarget('${p.id}')">${esc(p.avatar||"🀄")} ${nameEffectHTML(p.name,p.nameeffect)}</button>`).join(""):`<span class="ability-modal-empty">No hay rivales.</span>`}
      </div>
    `);
  }
  if(am.ability==="robo_dirigido_pick"){
    return abilityModalWrap("robo_dirigido", `Mano de ${esc(am.targetName)} — elegí qué ficha robar`, `
      <div class="ability-modal-grid">
        ${am.tiles.length?am.tiles.map(t=>tileBtn(t,"",`onclick="finishRoboDirigido('${t.id}')"`)).join(""):`<span class="ability-modal-empty">No tiene fichas.</span>`}
      </div>
    `);
  }
  if(am.ability==="vision_reveal"){
    return abilityModalWrap("vision", `Fichas de ${esc(am.targetName)} — ya se revelaron`, `
      <div class="ability-modal-grid">${am.tiles.map(t=>tileHTML(t)).join("")}</div>
      <p class="ability-modal-note">La habilidad ya se gastó — esto es solo lo que viste.</p>
    `, "✖ Cerrar");
  }
  if(am.ability==="intercambio"){
    const pool=[...(h?h.hand:[]), ...(G.myAbilityTiles||[])].filter(t=>t.id!==am.tileId);
    return abilityModalWrap("intercambio", "1. Tu ficha a ofrecer · 2. Con quién intercambiar", `
      <div class="ability-modal-grid" style="margin-bottom:10px">
        ${pool.map(t=>tileBtn(t,(am.offerTileId===t.id?"sel":""),`onclick="setAbilityOfferTile('${t.id}')"`)).join("")}
      </div>
      <div class="ability-modal-oppList">
        ${opps.map(p=>`<button class="ability-modal-opp" ${am.offerTileId?"":"disabled"} onclick="finishAbilityWithTarget('${p.id}')">${esc(p.avatar||"🀄")} ${nameEffectHTML(p.name,p.nameeffect)}</button>`).join("")}
      </div>
      <p class="ability-modal-note">La ficha que te llega es al azar.</p>
    `);
  }
  if(am.ability==="robo"){
    const rivalMelds=(G.table||[]).filter(m=>m.ownerId!==(h?h.id:null));
    return abilityModalWrap("robo", "Elegí una ficha de la mesa para robar", `
      <div class="ability-modal-meldlist">
        ${rivalMelds.length?rivalMelds.map(m=>`<div class="ability-modal-meld">
          <div class="ability-modal-meld-owner">${esc(m.ownerName)}</div>
          <div class="ability-modal-grid">${m.tiles.map(t=>tileBtn(t,"",`onclick="finishRobo('${m.id}','${t.id}')"`)).join("")}</div>
        </div>`).join(""):`<span class="ability-modal-empty">No hay combinaciones rivales en la mesa.</span>`}
      </div>
    `);
  }
  if(am.ability==="comodin"){
    const pool=(h?h.hand:[]).filter(t=>!t.joker);
    return abilityModalWrap("comodin", "Elegí una ficha normal para convertir en comodín", `
      <div class="ability-modal-grid">
        ${pool.length?pool.map(t=>tileBtn(t,"",`onclick="pickAbilityTarget('${t.id}')"`)).join(""):`<span class="ability-modal-empty">No tenés fichas normales para convertir.</span>`}
      </div>
    `);
  }
  if(am.ability==="atraccion"){
    if(!am.sourceMeldId){
      const rivalMelds=(G.table||[]).filter(m=>m.ownerId!==(h?h.id:null));
      return abilityModalWrap("atraccion", "Elegí una ficha rival para atraer", `
        <div class="ability-modal-meldlist">
          ${rivalMelds.length?rivalMelds.map(m=>`<div class="ability-modal-meld">
            <div class="ability-modal-meld-owner">${esc(m.ownerName)}</div>
            <div class="ability-modal-grid">${m.tiles.map(t=>tileBtn(t,"",`onclick="pickAtraccionSource('${m.id}','${t.id}')"`)).join("")}</div>
          </div>`).join(""):`<span class="ability-modal-empty">No hay combinaciones rivales en la mesa.</span>`}
        </div>
      `);
    }
    const myMelds=(G.table||[]).filter(m=>m.ownerId===(h?h.id:null)&&m.id!==am.sourceMeldId);
    const handPool=h?h.hand:[];
    const handSel=am.handSel||new Set();
    const srcMeldObj=(G.table||[]).find(m=>m.id===am.sourceMeldId);
    const srcTileObj=srcMeldObj?srcMeldObj.tiles.find(t=>t.id===am.sourceTileId):null;
    const selTiles=handPool.filter(t=>handSel.has(t.id));
    const previewValid=!!(srcTileObj&&selTiles.length&&meldInfo([...selTiles,srcTileObj]).valid);
    return abilityModalWrap("atraccion", "Elegí el destino de la ficha atraída", `
      <div class="ability-modal-substep">Una combinación tuya ya en la mesa:</div>
      <div class="ability-modal-meldlist" style="max-height:130px;margin-bottom:10px">
        ${myMelds.length?myMelds.map(m=>`<div class="ability-modal-meld ability-modal-meld-click" onclick="finishAtraccion('${m.id}')">
          <div class="ability-modal-grid">${m.tiles.map(t=>tileHTML(t)).join("")}</div>
        </div>`).join(""):`<span class="ability-modal-empty">No tenés combinaciones propias en la mesa todavía.</span>`}
      </div>
      <div class="ability-modal-substep">…o armá una combinación NUEVA con fichas de tu mano (ej. tenés 5 y 7 rojo, atraés el 6 rojo):</div>
      <div class="ability-modal-grid" style="margin-bottom:6px">
        ${handPool.length?handPool.map(t=>tileBtn(t,(handSel.has(t.id)?"sel":""),`onclick="toggleAtraccionHandTile('${t.id}')"`)).join(""):`<span class="ability-modal-empty">No tenés fichas normales en la mano.</span>`}
      </div>
      ${selTiles.length?`<div class="ability-modal-preview ${previewValid?"ok":"bad"}">${previewValid?"✔ Con la ficha atraída forma una combinación válida":"✖ Todavía no forma una combinación válida"}</div>`:""}
      <button class="btn-sm ability-modal-confirm" ${previewValid?`onclick="finishAtraccionFromHand()"`:"disabled"}>🧲 Confirmar combinación nueva</button>
    `);
  }
  return "";
}

/* ================================================================
   MORPH — parchado de DOM con claves estables (Fase "Ronda 1"):
   antes, CADA actualización de la pantalla de juego (turno de un rival,
   un toast, el timer, un logro) reconstruía #app entero vía innerHTML,
   lo que deseleccionaba fichas, tiraba abajo lo que estabas armando en
   Preparación y hacía saltar el scroll — aunque esos datos no habían
   cambiado. En vez de reescribir cada sección de renderPlaying a mano,
   esta función reconcilia el árbol vivo contra el HTML nuevo (mismo
   string que siempre se generó) y solo toca lo que realmente cambió,
   reusando el nodo existente cuando su tag y su "clave" (data-tid,
   data-mid, data-pid, data-gid o data-idx — todas ya existían en el
   marcado) coinciden. Nodos sin match se crean/eliminan normalmente,
   así que una ficha o un juego realmente NUEVO sigue entrando con sus
   animaciones de siempre.
   Un contenedor con data-morph-keep NO se reconcilia por dentro (sus
   hijos los administra JS aparte, ej. #achToastZone con los toasts de
   logros) — mismo espíritu que data-preserve-scroll: un escape hatch
   explícito vía atributo en vez de una lista de casos especiales. */
function morphNodeKey(node){
  if(!node || node.nodeType!==1) return null;
  const KEY_ATTRS=["data-tid","data-mid","data-pid","data-gid","data-idx"];
  for(const a of KEY_ATTRS){ if(node.hasAttribute(a)) return a+":"+node.getAttribute(a); }
  // Un id de HTML ya es, por definición, un identificador estable — sin esto, un
  // elemento con id pero sin ninguno de los data-* de arriba (ej. #achToastZone,
  // marcado data-morph-keep) se emparejaba por POSICIÓN nomás. Si la pantalla
  // ANTERIOR tenía, en esa misma posición, un div de contenido totalmente distinto
  // (ej. la tarjeta de bienvenida del intro), ese contenido viejo terminaba
  // "disfrazado" de #achToastZone (mismo tag, atributos sincronizados) pero con
  // sus hijos intactos porque data-morph-keep corta la reconciliación de hijos —
  // bug real encontrado en Ronda 3: el logo/tarjeta del intro quedaba pegado
  // flotando sobre la partida tras un cambio de pantalla forzado.
  if(node.id) return "id:"+node.id;
  return null;
}
function morphSameKind(a,b){
  if(a.nodeType!==b.nodeType) return false;
  if(a.nodeType===1) return a.tagName===b.tagName;
  return true;
}
function morphSyncAttrs(oldEl,newEl){
  const oldAttrs=oldEl.attributes;
  for(let i=oldAttrs.length-1;i>=0;i--){
    const name=oldAttrs[i].name;
    if(!newEl.hasAttribute(name)) oldEl.removeAttribute(name);
  }
  const newAttrs=newEl.attributes;
  for(let i=0;i<newAttrs.length;i++){
    const {name,value}=newAttrs[i];
    if(oldEl.getAttribute(name)!==value) oldEl.setAttribute(name,value);
  }
}
function morphPatchNode(oldNode,newNode){
  if(oldNode.nodeType===3||oldNode.nodeType===8){ // texto / comentario
    if(oldNode.nodeValue!==newNode.nodeValue) oldNode.nodeValue=newNode.nodeValue;
    return;
  }
  if(oldNode.nodeType!==1) return;
  morphSyncAttrs(oldNode,newNode);
  if(oldNode.hasAttribute("data-morph-keep")) return; // hijos administrados aparte, no tocar
  const oldHasEl=oldNode.children.length>0, newHasEl=newNode.children.length>0;
  if(!oldHasEl && !newHasEl){
    if(oldNode.textContent!==newNode.textContent) oldNode.textContent=newNode.textContent;
    return;
  }
  morphChildren(oldNode,newNode);
}
function morphChildren(oldParent,newParent){
  const oldNodes=Array.from(oldParent.childNodes);
  const newNodes=Array.from(newParent.childNodes);
  const oldByKey=new Map();
  oldNodes.forEach(n=>{ const k=morphNodeKey(n); if(k) oldByKey.set(k,n); });
  const usedOld=new Set();
  let cursor=oldParent.firstChild;
  newNodes.forEach(newNode=>{
    const key=morphNodeKey(newNode);
    let matched=null;
    if(key){
      const cand=oldByKey.get(key);
      if(cand && !usedOld.has(cand) && cand.tagName===newNode.tagName) matched=cand;
    } else if(cursor && !usedOld.has(cursor) && morphNodeKey(cursor)==null && morphSameKind(cursor,newNode)){
      matched=cursor;
    }
    if(matched){
      usedOld.add(matched);
      if(matched!==cursor) oldParent.insertBefore(matched,cursor);
      morphPatchNode(matched,newNode);
      cursor=matched.nextSibling;
    } else {
      const imported=document.importNode(newNode,true);
      oldParent.insertBefore(imported,cursor);
    }
  });
  oldNodes.forEach(n=>{ if(!usedOld.has(n)) n.remove(); });
}
function morph(container,html){
  const tpl=document.createElement("template");
  tpl.innerHTML=html;
  morphChildren(container,tpl.content);
}

function render(){
  const app=$("#app");
  // El render reescribe #app entero, así que cualquier panel scrolleable (ej. el
  // historial) perdería su posición en cada acción. Los elementos marcados con
  // data-preserve-scroll guardan y recuperan su scroll alrededor del re-render.
  const _scrollSave={};
  app.querySelectorAll("[data-preserve-scroll]").forEach(el=>{
    _scrollSave[el.getAttribute("data-preserve-scroll")]={top:el.scrollTop,left:el.scrollLeft};
  });
  app.className="";
  document.body.classList.toggle("ingame", ["playing","dealing","netDealing","sorteo","netSorteo","gameover"].includes(G.screen));
  // Modo Galáctico: ambientación cósmica de toda la app (no solo la mesa) mientras
  // estás en cualquier pantalla de una sala de este modo — sala de espera, cuenta
  // regresiva, reparto, la partida en sí y la pantalla de resultado.
  // !! es necesario: classList.toggle(clase, valor) con valor===undefined NO
  // se comporta como "false" — el navegador lo trata como "sin especificar" y
  // ALTERNA la clase en vez de forzarla. Como G.online empieza undefined (no
  // false) hasta loguearse, esta línea prendía/apagaba galactico-mode en cada
  // render sin relación real con la sala — bug reportado por el usuario
  // ("al ir para atrás se pierde el efecto de estrellas"), Fase 11.
  const isGalacticoRoom=!!(G.online && G.gameMode==="galactico" && ["lobby","netCountdown","dealing","netDealing","sorteo","netSorteo","playing","gameover"].includes(G.screen));
  document.body.classList.toggle("galactico-mode", isGalacticoRoom);
  // Solo animar la entrada (a-pop) cuando REALMENTE cambia de pantalla o se abre un modal,
  // no en cada actualización de datos de la misma pantalla (evita el "rebote" en cada interacción).
  G._enterCls=(G.screen!==G._lastScreen)?"a-pop":"";
  const screenChanged=G.screen!==G._lastScreen;
  G._lastScreen=G.screen;
  // Música por contexto (Fase 11 §13/§12): cada pantalla pertenece a una de 4 pistas
  // (ver Music.tracks) — solo se pide el cambio cuando realmente hace falta, así el
  // scheduler de Music no se reinicia en cada re-render de la misma pantalla.
  {
    // A pedido del usuario ("que suene la misma música en todo"): antes "jugar"/
    // "casual IA"/las pantallas de setup de multijugador usaban la pista "lobby"
    // (sintetizada, distinta) mientras el resto usaba la música real del Menú —
    // se sentía como una pista distinta al azar. Ahora TODAS las pantallas que no
    // son la mesa en vivo comparten la misma pista de Menú; "lobby" queda sin uso
    // (se deja definida en Music.tracks por si se querés reactivar más adelante).
    const MENU_SCREENS=["intro","auth","onboarding","menu","help","changelog","config","shop","profile",
      "play","casualIA","iaCasualSetup","team2v2Setup","netConnect","netSorteo","netDealing","netCountdown","lobby","sorteo","dealing","dailyRoulette","tower"];
    const wantTrack = isGalacticoRoom ? "galactico"
      : (G.screen==="playing") ? "partida"
      : MENU_SCREENS.includes(G.screen) ? "menu"
      : G.screen==="gameover" ? "menu"
      : Music.current || "menu";
    if(wantTrack!==Music.current) Music.setTrack(wantTrack);
    if(G.screen==="gameover" && screenChanged){
      const online=G.online && G.matchResult;
      const iWon = online ? (!!G.matchResult.won)
        : G.teamMode ? (!!(G.winner && G.winner.team==="A") && !G.abandoned)
        : (!!(G.winner && G.winner.isHuman) && !G.abandoned);
      Music.playStinger(iWon?"victory":"defeat");
    }
  }
  G._pauseEnterCls=(!!G.paused&&!G._lastPaused)?"a-pop":"";
  G._lastPaused=!!G.paused;
  // Blindaje: si CUALQUIER pantalla revienta al armar su HTML (una excepción a
  // mitad de un template literal deja app.innerHTML intacto — la pantalla
  // VIEJA se queda pegada en el DOM, en silencio, sin ningún aviso), lo
  // atajamos acá. Se ve exactamente igual que un "no se actualiza nada" desde
  // afuera — por eso, en vez de tragárnoslo, lo logueamos BIEN visible en la
  // consola (F12 → Console) con todo el contexto necesario para diagnosticarlo,
  // y mostramos un aviso real en vez de dejar la pantalla vieja congelada.
  try{
    if(G.screen==="intro") renderIntro(app);
    else if(G.screen==="auth") renderAuthScreen(app);
    else if(G.screen==="onboarding") renderOnboarding(app);
    else if(G.screen==="menu") renderMenu(app);
    else if(G.screen==="help") renderHelp(app);
    else if(G.screen==="changelog") renderChangelog(app);
    else if(G.screen==="play") renderPlay(app);
    else if(G.screen==="dailyRoulette") renderDailyRoulette(app);
    else if(G.screen==="tower") renderTower(app);
    else if(G.screen==="casualIA") renderCasualIA(app);
    else if(G.screen==="iaCasualSetup") renderIACasualSetup(app);
    else if(G.screen==="team2v2Setup") renderTeam2v2Setup(app);
    else if(G.screen==="netConnect") renderNetConnect(app);
    else if(G.screen==="netSorteo") renderNetSorteo(app);
    else if(G.screen==="netDealing") renderNetDealing(app);
    else if(G.screen==="netCountdown") renderNetCountdown(app);
    else if(G.screen==="lobby") renderLobby(app);
    else if(G.screen==="config") renderConfig(app);
    else if(G.screen==="shop") renderShop(app);
    else if(G.screen==="profile") renderProfile(app);
    else if(G.screen==="sorteo") renderSorteo(app);
    else if(G.screen==="gameover") renderGameover(app);
    else if(G.screen==="dealing") renderDealing(app);
    else renderPlaying(app);
  }catch(renderErr){
    console.error("💥 render() rompió en pantalla '"+G.screen+"':", renderErr);
    console.error("Estado relevante:", {
      screen:G.screen, online:G.online, gameMode:G.gameMode,
      rackLen:(G.rack||[]).filter(Boolean).length, reserveLen:(G.reserve||[]).length,
      myHandLen:G.players?(G.players.find(p=>p.isHuman)||{}).hand?.length:undefined,
    });
    app.innerHTML=`<div class="screen-center" style="text-align:center">
      <div class="card"><h2 style="color:#f87171">⚠ Ocurrió un error al mostrar esta pantalla</h2>
      <p style="font-size:12px;color:rgba(232,238,247,.7);margin:10px 0">Apretá F12 → pestaña "Console" y mandá lo que diga en rojo — con eso se puede encontrar la causa exacta.</p>
      <button class="btn btn-gold" onclick="render()">🔄 Reintentar</button></div>
    </div>`;
  }
  // Aviso de sanción: se superpone a CUALQUIER pantalla en la que hayas terminado
  // de loguearte (no solo el menú), porque puede llegar justo yendo directo a
  // Multijugador — se agrega encima del HTML de la pantalla, no lo reemplaza.
  if(G.pendingSanctionAlert){
    app.innerHTML += `<div class="pauseovl" onclick="if(event.target===this)closeSanctionAlert()">
      <div class="pausecard a-pop" style="text-align:center;border-color:rgba(248,113,113,.5)">
        <div style="font-size:44px;margin-bottom:8px">⚠️</div>
        <h2 style="font-family:var(--font-heading);color:#f87171;font-size:20px;margin-bottom:12px">Aviso</h2>
        <p style="font-size:13px;color:rgba(232,238,247,.85);line-height:1.6;margin-bottom:16px">${esc(G.pendingSanctionAlert)}</p>
        <button class="btn btn-gold" onclick="closeSanctionAlert()">Entendido</button>
      </div>
    </div>`;
  }
  app.querySelectorAll("[data-preserve-scroll]").forEach(el=>{
    const saved=_scrollSave[el.getAttribute("data-preserve-scroll")];
    if(saved){ el.scrollTop=saved.top; el.scrollLeft=saved.left; }
  });
}

function goPlay(){ G.screen="play"; render(); }
function renderPlay(app){
  app.innerHTML=`
  <div class="screen-center auth-screen" style="position:relative"><div class="fan-compact">${fanLogoHTML()}</div>
    <div class="card ${G._enterCls}" style="position:relative;z-index:1">
      <button class="card-x" onclick="goMenu()" title="Cerrar">✕</button>
      <div class="lbl" style="text-align:center">Elegí modo de juego</div>
      <button class="btn btn-gold fx-fizzy" style="margin-top:10px" onclick="goCasualIA()">
        <span class="fizz-bubbles"><span></span><span></span><span></span><span></span><span></span></span>
        🎮 Jugar Casual (IA)
      </button>
      <button class="btn btn-ghost" style="margin-top:10px;opacity:.5;cursor:default" disabled title="Todavía no está disponible">🤖 2v2 vs IA · Próximamente</button>
      <button class="btn btn-ghost fx-spark" style="margin-top:10px" onclick="goOnlineConnect()">🌐 Multijugador</button>
      <div style="text-align:center;font-size:10px;color:rgba(232,238,247,.45);margin-top:4px">Servidor online</div>
      <div id="playmsg" style="text-align:center;font-size:11px;color:#7dd3fc;min-height:16px;margin-top:6px"></div>
    </div>
  </div>`;
}
function setMsg2(t){ const el=document.querySelector("#playmsg"); if(el) el.textContent=t; }

/* Pastillas de progreso de racha (1..7) — el día actual resaltado, los ya
   cumplidos en este ciclo marcados, el resto tenue. Puramente decorativo,
   el servidor ya mandó el número real (streakDay). */
function dailyStreakPipsHTML(streakDay){
  let html="";
  for(let d=1;d<=7;d++){
    const state=d<streakDay?"done":d===streakDay?"current":"pending";
    html+=`<span class="daily-pip daily-pip-${state}">${d}</span>`;
  }
  return `<div class="daily-pips" role="img" aria-label="Racha: día ${streakDay} de 7">${html}</div>`;
}

/* Rueda de Ruleta — asset nuevo con 8 gajos físicos dibujados (rediseño
   con PNGs, ver client/img/ruleta/). Espejo del server (server/db.js
   DAILY_REWARD_RANGES/DAILY_REWARD_SEGMENTS, ahora 8 — antes 5, subido
   justamente para que cada gajo real de la imagen tenga un monto propio y
   la rueda NUNCA pueda frenar entre dos gajos) SOLO para dibujar los montos
   posibles del día de racha — el premio real y el que se acredita siempre
   lo decide y confirma el servidor (dailyResult); esto nunca elige ni
   acredita nada, solo calcula en qué ángulo cae el gajo que el servidor ya
   eligió. Los gajos de la imagen tienen íconos fijos de "tipos de premio"
   (cartas, cofre, sobre, monedas...) que hoy no existen como tal en el
   sistema real (todo premio diario es SIEMPRE monedas) — a propósito no se
   les superpone ningún número: el monto real se revela abajo de la rueda
   (.daily-prize-amount), igual que antes. */
const DAILY_WHEEL_RANGES={1:[50,80],2:[60,100],3:[80,120],4:[100,150],5:[130,190],6:[170,240],7:[250,400]};
const DAILY_WHEEL_SEGMENTS=8;
function dailySegmentValues(streakDay){
  const [lo,hi]=DAILY_WHEEL_RANGES[Math.min(Math.max(streakDay,1),7)]||DAILY_WHEEL_RANGES[1];
  const n=DAILY_WHEEL_SEGMENTS, step=(hi-lo)/(n-1);
  return Array.from({length:n},(_,i)=>Math.round(lo+step*i));
}
function dailySegmentIndexForCoins(streakDay,coins){
  const values=dailySegmentValues(streakDay);
  let idx=values.indexOf(coins);
  if(idx===-1){
    // El monto real no coincidió con ninguno de los 5 que dibuja el cliente
    // (no debería pasar si el server usa la misma tabla) — apuntamos al más
    // cercano en vez de fallar en silencio o romper el cálculo del ángulo.
    let best=0,bestDiff=Infinity;
    values.forEach((v,i)=>{ const d=Math.abs(v-coins); if(d<bestDiff){bestDiff=d;best=i;} });
    idx=best;
  }
  return idx;
}
// Ángulo de reposo (0-360) que deja el segmento ganador exactamente bajo el
// puntero fijo de arriba — conic-gradient y rotate() comparten el mismo
// sistema de coordenadas (0deg = arriba, sentido horario), así que alcanza
// con rotar la rueda lo que le falte al centro de ese segmento para llegar a 0.
function dailyWheelRestAngle(streakDay,coins){
  const values=dailySegmentValues(streakDay), n=values.length, segAngle=360/n;
  const idx=dailySegmentIndexForCoins(streakDay,coins);
  const centerAngle=idx*segAngle+segAngle/2;
  return (360-centerAngle)%360;
}
/* [reconstrucción visual con assets — fondo.png/banner.png/ruleta.png/
   monedas.png/boton.png en client/img/ruleta/] Composición en capas:
   fondo < banner < contenido (texto+monedas a la izquierda, rueda a la
   derecha) < botón. La imagen de la rueda (con la B de Burako al centro,
   SIN tocar) es el elemento que gira de verdad — el indicador de arriba es
   un triángulo CSS aparte, fijo, para que nunca gire con ella. */
function dailyWheelPanelHTML(streakDay,state){
  state=state||{};
  const mode=state.mode||"idle"; // idle | spinning | result | locked
  const rot=mode==="result"&&state.restAngle!=null?state.restAngle:0;
  const spinning=mode==="spinning";
  const ctaDisabled=spinning||mode==="locked";
  let countdown;
  if(spinning) countdown=`<div class="daily-wheel-status">Girando…</div>`;
  else if(mode==="locked"||mode==="result") countdown=`<div class="daily-wheel-countdown">◷ Se reinicia en ${fmtHoursMin(G.dailyMsUntilNext)}</div>`;
  else countdown=`<div class="daily-wheel-countdown daily-wheel-countdown-ghost">Girá una vez al día</div>`;
  return `<div class="daily-wheel-panel">
    <img class="daily-wheel-bg" src="./img/ruleta/fondo.png" alt="" aria-hidden="true">
    <div class="daily-wheel-overlay" aria-hidden="true"></div>
    <img class="daily-wheel-banner" src="./img/ruleta/banner.png" alt="¡Premio diario!" aria-hidden="true">
    <div class="daily-wheel-content">
      <div class="daily-wheel-left">
        <div class="daily-wheel-heading">Ruleta diaria</div>
        <div class="daily-wheel-tagline">Girá cada día y ganá premios increíbles</div>
        ${dailyStreakPipsHTML(streakDay)}
        <div class="daily-wheel-coins-wrap" onclick="event.stopPropagation();dailyCoinsPoke(this)">
          <img class="daily-wheel-coins" src="./img/ruleta/monedas.png" alt="" aria-hidden="true">
        </div>
      </div>
      <div class="daily-wheel-right">
        <div class="daily-wheel-parallax" data-wheel-parallax>
          <div class="daily-wheel-hoverwrap${spinning?" daily-wheel-nohover":""}">
            <div class="daily-wheel-pointer-fixed" aria-hidden="true"></div>
            <img class="daily-wheel-image${!spinning&&mode!=="result"?" daily-wheel-image-idle":""}" data-daily-wheel src="./img/ruleta/ruleta.png" alt="Ruleta" style="transform:rotate(${rot}deg)">
            <div class="daily-wheel-winglow" data-wheel-winglow aria-hidden="true"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="daily-wheel-bottom">
      <button class="daily-wheel-spin-btn${ctaDisabled?" daily-wheel-spin-btn-off":""}" ${ctaDisabled?"disabled":""} onclick="event.stopPropagation();doDailySpin()" aria-label="Girar ahora">
        <img src="./img/ruleta/boton.png" alt="Girar ahora">
      </button>
      ${countdown}
    </div>
    <div id="daily-burst-host"></div>
  </div>`;
}
function dailyCoinsPoke(el){
  Sound.select();
  el.classList.remove("daily-wheel-coins-poke"); void el.offsetWidth; el.classList.add("daily-wheel-coins-poke");
}
// Dispara la animación de frenado UNA sola vez, justo cuando llega dailyResult
// (ver el handler de mensajes) — el HTML de arriba siempre puede renderizar el
// ángulo final "en reposo" directo (sin animar), así que un re-render de más
// nunca deja la rueda visualmente inconsistente con el premio ya confirmado.
// onDone (opcional) se llama cuando la rueda termina de frenar — se usa para
// disparar la explosión de partículas justo cuando cae el premio, no antes.
function spinDailyWheelTo(streakDay,coins,onDone){
  const el=document.querySelector("[data-daily-wheel]"); if(!el) return;
  const restAngle=dailyWheelRestAngle(streakDay,coins);
  const segAngle=360/DAILY_WHEEL_SEGMENTS;
  const reduceMotion=window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(reduceMotion){ el.style.transform=`rotate(${restAngle}deg)`; if(onDone) onDone(); return; }
  // [v1.4] Antes SIEMPRE eran exactamente 4 vueltas en 1.7s clavado — el
  // premio ya era 100% al azar del lado servidor (crypto.randomInt), pero
  // con la MISMA velocidad y cantidad de vueltas en cada giro, la animación
  // se sentía mecánica/idéntica y daba la sensación de estar trucada. Ahora
  // la cantidad de vueltas extra y la duración varían un poco en cada tirada
  // (puramente estético — el ángulo final sigue siendo el único que importa,
  // ya calculado arriba a partir del premio real).
  const extraSpins=5+Math.floor(Math.random()*3); // 5, 6 o 7 vueltas completas
  const duration=4.8+Math.random()*1.4; // 4.8s-6.2s (pedido: 4.5-6.5s)
  const finalAngle=extraSpins*360+restAngle;
  const ptr=document.querySelector(".daily-wheel-pointer-fixed");
  let lastBucket=-1;
  function fireTick(){
    if(ptr){ ptr.classList.remove("daily-wheel-pointer-hit"); void ptr.offsetWidth; ptr.classList.add("daily-wheel-pointer-hit"); }
    Sound.wheelTick();
  }
  // El tick se dispara comparando el ángulo REAL animado contra el ángulo
  // de cada gajo (no un timer aparte) — así siempre coincide con el
  // movimiento visual real, sea cual sea el easing, y se espacía solo cada
  // vez más al final (la rueda cruza menos gajos por segundo al frenar).
  function onAngle(angle){
    const bucket=Math.floor(angle/segAngle);
    if(bucket!==lastBucket){ lastBucket=bucket; fireTick(); }
    el.style.transform=`rotate(${angle}deg)`;
  }
  if(window.gsap){
    const state={angle:0};
    gsap.to(state,{angle:finalAngle,duration,ease:"power4.out",
      onUpdate:()=>onAngle(state.angle),
      onComplete:()=>{ onAngle(finalAngle); if(onDone) onDone(); },
    });
  } else {
    // Respaldo sin GSAP: mismo ángulo final, sin ticks finos (no hay forma
    // liviana de leer el valor intermedio de una transición CSS cuadro a
    // cuadro sin GSAP/WAAPI) — igual de correcto, menos vistoso.
    el.style.transition="none"; el.style.transform="rotate(0deg)";
    void el.offsetWidth;
    el.style.transition=`transform ${duration}s cubic-bezier(.1,.6,.15,1)`;
    el.style.transform=`rotate(${finalAngle}deg)`;
    if(onDone){ const h=()=>{ el.removeEventListener("transitionend",h); onDone(); }; el.addEventListener("transitionend",h); }
  }
}
// Explosión de partículas puramente decorativa cuando se confirma el premio
// (ver dailyResult en el handler de mensajes) — nunca decide ni muestra un
// monto, solo celebra el que ya vino confirmado por el servidor. Paleta
// dorado-forward (antes tenía violeta/rojo/azul/verde en partes iguales —
// pedido explícito del rediseño: "menos arcoíris, más protagonismo del
// dorado").
function dailyRouletteBurst(){
  const host=document.querySelector("#daily-burst-host"); if(!host) return;
  const glow=document.querySelector("[data-wheel-winglow]");
  if(glow){ glow.classList.remove("daily-wheel-winglow-active"); void glow.offsetWidth; glow.classList.add("daily-wheel-winglow-active"); }
  if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors=["#fde68a","#fbbf24","#d99b00","#fff7d6","#fbbf24","#1f5fa8"];
  for(let i=0;i<18;i++){
    const p=document.createElement("span");
    p.className="daily-burst-piece";
    const ang=(i/18)*360+(Math.random()*14-7);
    p.style.setProperty("--r",ang+"deg");
    p.style.setProperty("--d",(64+Math.random()*28)+"px");
    p.style.background=colors[i%colors.length];
    p.style.animation=`dailyBurstOut ${(.65+Math.random()*.35).toFixed(2)}s ease-out forwards`;
    p.style.animationDelay=(Math.random()*.1)+"s";
    host.appendChild(p);
  }
}

// [v1.3.2] Ambientación mística/espacial compartida por Ruleta y Torre —
// gemas de colores flotando despacio + chispas doradas subiendo, con los
// MISMOS colores que ya usan las fichas del juego (--rojo/--azul/--verde/
// --amarillo/--comodin), no colores nuevos inventados. Se arma como string
// HTML (no se toca el DOM aparte) porque estas pantallas re-renderizan
// pisando innerHTML entero — cualquier nodo agregado por fuera de acá se
// perdería en el próximo render. Puramente decorativo, respeta
// prefers-reduced-motion (ver burako.css).
function rtBgFloatHTML(){
  const colors=["var(--rojo)","var(--azul)","var(--verde)","var(--amarillo)","var(--comodin)"];
  let gems="";
  for(let i=0;i<5;i++){
    const c=colors[i%colors.length], size=(16+Math.random()*12).toFixed(0);
    gems+=`<span class="rt-bg-gem" style="color:${c};background:${c};width:${size}px;height:${size}px;left:${(Math.random()*90).toFixed(0)}%;top:${(Math.random()*88).toFixed(0)}%;animation-delay:${(Math.random()*6).toFixed(1)}s;animation-duration:${(11+Math.random()*8).toFixed(1)}s"></span>`;
  }
  let sparks="";
  for(let i=0;i<8;i++){
    sparks+=`<span class="rt-bg-spark" style="left:${(Math.random()*100).toFixed(0)}%;bottom:${(Math.random()*30).toFixed(0)}px;animation-delay:${(Math.random()*5).toFixed(1)}s;animation-duration:${(4+Math.random()*3).toFixed(1)}s"></span>`;
  }
  return `<div class="rt-bg-float" aria-hidden="true">${gems}${sparks}</div>`;
}
function renderDailyRoulette(app){
  const streakDay=G.dailyStreakDay||1;
  let body;
  if(G.dailyLoading){
    body=`<div class="searching-spinner" aria-hidden="true"></div><p style="font-size:12px;color:rgba(232,238,247,.6);margin-top:10px">Consultando tu ruleta…</p>`;
  } else if(G.dailySpinning){
    body=dailyWheelPanelHTML(streakDay,{mode:"spinning"});
  } else if(G.dailyResult){
    const restAngle=dailyWheelRestAngle(G.dailyResult.streakDay,G.dailyResult.coins);
    body=`${dailyWheelPanelHTML(G.dailyResult.streakDay,{mode:"result",restAngle})}
      <p class="daily-prize-amount a-pop" style="margin:14px 0 2px">+${G.dailyResult.coins.toLocaleString("es-UY")} monedas</p>
      <p style="font-size:11px;color:rgba(232,238,247,.6)">Racha: día ${G.dailyResult.streakDay} de 7</p>`;
  } else if(G.dailyClaimedToday){
    body=`${dailyWheelPanelHTML(streakDay,{mode:"locked"})}
      <div class="daily-claimed-badge" style="margin-top:16px">✔ Ya reclamaste la ruleta de hoy</div>`;
  } else {
    body=dailyWheelPanelHTML(streakDay,{mode:"idle"});
  }
  app.innerHTML=`<div class="screen-center"><div class="card rt-card rt-card-daily ${G._enterCls}">
    ${rtBgFloatHTML()}
    <div class="rt-topbar">
      <button class="rt-back" onclick="goMenu()" title="Volver al menú">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        <span class="rt-back-label">Volver</span>
      </button>
      <h2 class="rt-title">🎰 Ruleta diaria</h2>
    </div>
    <div class="rt-body rt-body-daily">
      ${body}
    </div>
  </div></div>`;
}

function goCasualIA(){ G.screen="casualIA"; render(); }
function renderCasualIA(app){
  const poTier=tierOf(PO.rankPts);
  app.innerHTML=`
  <div class="screen-center auth-screen"><div class="fan-compact">${fanLogoHTML()}</div>
    <div class="card ${G._enterCls}">
      <button class="card-x" onclick="goPlay()" title="Cerrar">✕</button>
      <div class="lbl" style="text-align:center">Casual contra IA</div>
      <button class="btn btn-gold" style="margin-top:10px" onclick="goQuickMatch()">⚡ Partida rápida</button>
      <p style="font-size:10.5px;color:rgba(232,238,247,.5);margin:6px 0 12px;text-align:center;line-height:1.4">10 min, 10 fichas iniciales, 1 a 3 rivales con dificultad al azar. Arranca al toque.</p>
      <button class="btn btn-ghost" onclick="goIACasualSetup()">🛠 IA-Casual (configurable)</button>
      <p style="font-size:10.5px;color:rgba(232,238,247,.5);margin:6px 0 12px;text-align:center;line-height:1.4">Elegís condición de victoria, duración, dificultad y rivales.</p>
      <button class="btn btn-ghost" style="border-color:rgba(184,150,63,.4)" onclick="goRankedOffline()">
        🏆 Ranked Offline <span style="opacity:.85">· ${tierBadgeHTML(poTier,14)} ${esc(poTier.name)}</span>
      </button>
      <p style="font-size:10.5px;color:rgba(232,238,247,.5);margin:6px 0 0 0;text-align:center;line-height:1.4">1 contra 1, un rival de nivel parecido al tuyo. Tu progreso acá es propio — no toca tu rango online.</p>
      <button class="btn-sm" style="width:100%;margin-top:8px;border-radius:8px;background:rgba(255,255,255,.06);color:rgba(232,238,247,.75)" onclick="openOfflineStats()">📊 Ver mi progreso offline</button>
    </div>
  </div>
  ${G.offlineStatsOpen?offlineStatsModalHTML():""}`;
}
function openOfflineStats(){ G.offlineStatsOpen=true; Sound.select(); render(); }
function closeOfflineStats(){ G.offlineStatsOpen=false; render(); }
// Pedido del usuario: "si subo de nivel offline, ¿dónde veo eso?" — antes solo se
// veía un instante en la tarjeta de resultado post-partida, o el tier suelto en el
// botón. Ojo: PO NUNCA reparte recompensas del Pase (skins/monedas/avatares reales)
// — esto es solo progreso/estadísticas propias, coherente con que Ranked Offline
// nunca contamina el perfil online (ver PO/savePO más arriba).
function offlineStatsModalHTML(){
  const L=levelFromXp(PO.xp);
  const t=tierOf(PO.rankPts);
  const xpPct=Math.min(100,Math.round(L.xpInLevel/L.xpForNext*100));
  return `<div class="pauseovl" onclick="if(event.target===this)closeOfflineStats()">
    <div class="pausecard a-pop" style="text-align:center">
      <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:rgba(232,238,247,.5);margin-bottom:10px">🏆 Progreso · Ranked Offline</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:14px">
        ${tierBadgeHTML(t,32)}
        <div style="text-align:left">
          <div style="font-weight:800;color:#ffe9a8;font-size:16px">${esc(t.name)}</div>
          <div style="font-size:11px;color:rgba(232,238,247,.6)">${PO.rankPts} pts</div>
        </div>
      </div>
      <div style="height:12px;border-radius:6px;background:rgba(0,0,0,.4);overflow:hidden;position:relative;margin-bottom:4px">
        <div style="height:100%;width:${xpPct}%;background:linear-gradient(90deg,#a78bfa,#7c3aed)"></div>
      </div>
      <div style="font-size:10px;color:rgba(232,238,247,.55);margin-bottom:14px">Nivel ${PO.level} · ${L.xpInLevel} / ${L.xpForNext} XP</div>
      <div style="display:flex;justify-content:space-around;background:rgba(0,0,0,.2);border-radius:10px;padding:10px;margin-bottom:14px">
        <div><div style="font-weight:800;color:#34d399;font-size:15px">${PO.wins}</div><div style="font-size:9px;color:rgba(232,238,247,.5)">Victorias</div></div>
        <div><div style="font-weight:800;color:#e8eef7;font-size:15px">${PO.games}</div><div style="font-size:9px;color:rgba(232,238,247,.5)">Partidas</div></div>
        <div><div style="font-weight:800;color:#fbbf24;font-size:15px">${PO.streak}</div><div style="font-size:9px;color:rgba(232,238,247,.5)">Racha</div></div>
      </div>
      <p style="font-size:10px;color:rgba(232,238,247,.45);line-height:1.4;margin-bottom:14px">Esto es aparte de tu Pase y tu rango online — no reparte skins ni monedas reales, es solo tu progreso jugando contra bots.</p>
      <button class="btn btn-gold" onclick="closeOfflineStats()">Cerrar</button>
    </div>
  </div>`;
}
function goQuickMatch(){
  Sound.init();
  G.rankedOffline=false; G.rankedOfflineOpponent=null;
  const levels=["facil","normal","dificil","extremo"];
  G.aiLevel=levels[Math.floor(Math.random()*levels.length)];
  G.numOpponents=1+Math.floor(Math.random()*3); // 1 a 3 rivales
  G.matchMinutes=10;
  G.initTiles=10;
  G.turnSeconds=60;
  G.winMode="time";
  goSorteo(false);
}
function goIACasualSetup(){
  G.initTiles=14;
  if(!G.matchMinutes||G.matchMinutes<30) G.matchMinutes=30;
  G.screen="iaCasualSetup"; render();
}
function goStartIACasual(){
  Sound.init();
  G.rankedOffline=false; G.rankedOfflineOpponent=null;
  if(G.winMode==="points") G.matchMinutes=0;
  goSorteo(false);
}
function renderIACasualSetup(app){
  app.innerHTML=`
  <div class="screen-center">
    <div class="card ${G._enterCls}" style="max-height:92dvh;overflow-y:auto">
      <button class="card-x" onclick="goCasualIA()" title="Cerrar">✕</button>
      <h2 style="font-family:var(--font-heading);color:#ffe9a8;font-size:20px;text-align:center;margin-bottom:4px">🛠 IA-Casual</h2>
      <div class="lbl">Condición de victoria</div>
      <div class="seg">
        <button class="${G.winMode==="time"?"on":""}" onclick="G.winMode='time';Sound.select();render()">⏱ Por tiempo</button>
        <button class="${G.winMode==="points"?"on":""}" onclick="G.winMode='points';Sound.select();render()">🎯 Por puntaje</button>
      </div>
      ${G.winMode==="points"?`
      <div class="lbl">Puntaje objetivo</div>
      <div class="seg">
        ${[150,200,300].map(s=>`<button class="${G.targetScore===s?"on":""}" onclick="G.targetScore=${s};Sound.select();render()">${s} pts</button>`).join("")}
      </div>
      <p style="font-size:10.5px;color:rgba(232,238,247,.5);margin:-4px 0 8px;text-align:center;line-height:1.4">Gana el primero que llegue a este puntaje bajado a la mesa, sin límite de tiempo.</p>
      `:`
      <div class="lbl">Duración</div>
      <div class="seg">
        ${[30,45,60].map(m=>`<button class="${G.matchMinutes===m?"on":""}" onclick="G.matchMinutes=${m};Sound.select();render()">${m}m</button>`).join("")}
      </div>
      <p style="font-size:10.5px;color:rgba(232,238,247,.5);margin:-4px 0 8px;text-align:center;line-height:1.4">Gana quien vacía el atril primero; si se acaba el tiempo o el pozo, gana quien tenga menos puntos en mano.</p>
      `}
      <div class="lbl">Dificultad de la IA</div>
      <div class="seg">
        ${[["facil","😊 Fácil"],["normal","🙂 Medio"],["dificil","😈 Difícil"],["extremo","🧠 Extremo"],["claude","✨ IA-Claude"]].map(([v,l])=>
          `<button class="${G.aiLevel===v?"on":""}" style="font-size:12px" onclick="G.aiLevel='${v}';Sound.select();render()">${l}</button>`).join("")}
      </div>
      ${G.aiLevel==="claude"?`<p style="font-size:10.5px;color:#e9d5ff;margin:-4px 0 8px;text-align:center;line-height:1.4">✨ La IA más avanzada del juego: no solo busca la mejor jugada posible en profundidad, también revisa la mesa buscando comodines sueltos que pueda cambiar por su ficha real para armar algo mejor — algo que ningún otro nivel hace.</p>`:""}
      <div class="lbl">Rivales</div>
      <div class="seg">
        ${[[1,"2"],[2,"3"],[3,"4"],[7,"👥 8"]].map(([v,l])=>
          `<button class="${G.numOpponents===v?"on":""}" style="font-size:13px" onclick="G.numOpponents=${v};Sound.select();render()">${l}</button>`).join("")}
      </div>
      ${G.numOpponents===7?`<p style="font-size:10.5px;color:#fbbf24;margin:-4px 0 10px;text-align:center">🃏 Modo 8 jugadores: se usan 2 mazos completos (216 fichas) para que alcance.</p>`:""}
      <div class="lbl">Tiempo por turno</div>
      <div class="seg">
        ${[[45,"45s"],[60,"1 min"],[90,"1:30"]].map(([v,l])=>
          `<button class="${G.turnSeconds===v?"on":""}" style="font-size:13px" onclick="G.turnSeconds=${v};Sound.select();render()">${l}</button>`).join("")}
      </div>
      <button class="btn btn-gold" style="margin-top:6px" onclick="goStartIACasual()">▶ Empezar partida</button>
    </div>
  </div>`;
}

function goTeam2v2Setup(){
  G.initTiles=14;
  G.screen="team2v2Setup"; render();
}
function renderTeam2v2Setup(app){
  app.innerHTML=`
  <div class="screen-center">
    <div class="card ${G._enterCls}" style="max-height:92dvh;overflow-y:auto">
      <button class="card-x" onclick="goPlay()" title="Cerrar">✕</button>
      <h2 style="font-family:var(--font-heading);color:#ffe9a8;font-size:20px;text-align:center;margin-bottom:4px">🤝 2v2 en equipo</h2>
      <p style="font-size:11.5px;color:rgba(232,238,247,.6);text-align:center;line-height:1.6;margin-bottom:10px">
        Jugás con una <b style="color:#ffe9a8">compañera IA</b> contra 2 rivales IA. Comparten mesa de preparación
        (sus fichas se ven junto a las tuyas, marcadas con su ícono), y el puntaje y las vidas son
        <b style="color:#ffe9a8">del equipo</b>. Al terminar tu turno, tenés que coincidir con tu compañera en
        <b style="color:#7dd3fc">tomar ficha</b> o <b style="color:#7dd3fc">pasar</b> — si no coinciden, el equipo pierde una vida.
      </p>
      <div class="lbl">Dificultad de la IA (compañera y rivales)</div>
      <div class="seg">
        ${[["facil","😊 Fácil"],["normal","🙂 Medio"],["dificil","😈 Difícil"],["extremo","🧠 Extremo"],["claude","✨ IA-Claude"]].map(([v,l])=>
          `<button class="${G.aiLevel===v?"on":""}" style="font-size:12px" onclick="G.aiLevel='${v}';Sound.select();render()">${l}</button>`).join("")}
      </div>
      ${G.aiLevel==="claude"?`<p style="font-size:10.5px;color:#e9d5ff;margin:-4px 0 8px;text-align:center;line-height:1.4">✨ La IA más avanzada del juego: no solo busca la mejor jugada posible en profundidad, también revisa la mesa buscando comodines sueltos que pueda cambiar por su ficha real para armar algo mejor — algo que ningún otro nivel hace.</p>`:""}
      <div class="lbl">Tiempo por turno</div>
      <div class="seg">
        ${[[45,"45s"],[60,"1 min"],[90,"1:30"]].map(([v,l])=>
          `<button class="${G.turnSeconds===v?"on":""}" style="font-size:13px" onclick="G.turnSeconds=${v};Sound.select();render()">${l}</button>`).join("")}
      </div>
      <button class="btn btn-gold" style="margin-top:6px" onclick="startTeam2v2()">▶ Empezar partida</button>
    </div>
  </div>`;
}
function startTeam2v2(){
  Sound.init();
  G.online=false; G.ranked=false; G.winMode="time"; G.matchMinutes=0;
  G.teamMode=true;
  G.teammateName=Math.random()<0.5?"Compañera IA":"Compañero IA";
  const rivalNames=shuffle(["IA Rojo","IA Azul","IA Verde","IA Morado"]).slice(0,2);
  const names=[(P.name||"Vos"), rivalNames[0], rivalNames[1]];
  const vals=shuffle(Array.from({length:13},(_,i)=>i+1)).slice(0,3);
  G.sorteoTiles=names.map((n,i)=>({name:n,isHuman:i===0,revealed:false,
    tile:{id:nid("s"),color:COLOR_KEYS[i%4],number:vals[i],joker:false}}));
  G.sorteoDone=false; G.myRevealed=false;
  G.screen="sorteo"; render();
}

/* Logo BURAKO en fichas: abanico de 6 fichas B-U-R-A-K-O. Antes las 6 compartían
   el mismo pivote (left:50%, transform-origin) y solo rotaban ±29° repartidas en
   6 — sin ningún desplazamiento horizontal real quedaban casi apiladas, muchas
   ocultas unas detrás de otras (docs/redesign/01-audit.md §3). Ahora cada ficha
   tiene su propio offset en X (xOff) real, y la rotación queda como un acento
   sutil de "mano de cartas" en vez del único mecanismo de separación — con esto
   las 6 quedan siempre completamente legibles. Compartido entre portada (intro)
   y menú principal para que el logo sea reconocible antes de leer nada más. */
// Bug real reportado: al arrancar la app, el logo BURAKO "volaba a su lugar"
// dos veces (portada → conectando → login son 3 render() distintos, cada
// uno con innerHTML= de cero, así que el .fan viejo se destruye y el nuevo
// siempre trae la animación fanIn desde 0% — Flip (ver withLogoFlip) anima
// la POSICIÓN del contenedor entre pantallas, pero no evita que cada ficha
// vuelva a jugar su propio fanIn por separado). Con este flag, la entrada
// "de verdad" (fade+scale+vuelo) solo se ve la primera vez que se pinta el
// logo en toda la sesión de la pestaña — de ahí en más, .fan-instant apaga
// esa animación por CSS y las fichas aparecen directo en su posición final
// (Flip se sigue encargando de que el movimiento entre pantallas sea suave).
let _fanAnimatedOnce=false;
function fanLogoHTML(){
  const skipEntrance=_fanAnimatedOnce;
  _fanAnimatedOnce=true;
  const word=[["B",""],["U",""],["R",""],["A",""],["K",""],["O",""]];
  const cols=["rojo","azul","verde","amarillo","rojo","azul"];
  const n=word.length;
  const mid=(n-1)/2;
  // Arco circular de verdad (Fase 11 §1): las 6 fichas se ubican sobre un
  // círculo imaginario de radio ARC_R, cada una a su ángulo ARC_SPREAD/2 desde
  // el centro. Posición (x,y) Y rotación salen del MISMO ángulo — por eso la
  // inclinación de cada ficha "acompaña" la curva en vez de ser un número
  // suelto sin relación con dónde cae la ficha (la queja de "inclinaciones
  // arbitrarias"). El resultado es una sonrisa simétrica — R y A (centro)
  // casi sin caída, B y O (bordes) más abajo — como pidió el usuario:
  //        R   A
  //     U         K
  //   B             O
  const ARC_R=480, ARC_SPREAD=34;
  const fan=word.map((w,i)=>{
    const t=(i-mid)/mid; // -1 .. 1
    const angDeg=t*(ARC_SPREAD/2);
    const angRad=angDeg*Math.PI/180;
    const xOff=Math.round(ARC_R*Math.sin(angRad));
    const yOff=Math.round(ARC_R*(1-Math.cos(angRad))); // siempre >=0: los bordes bajan solos, geometría real de arco
    const scale=(1-0.035*Math.abs(t)).toFixed(3); // leve profundidad: el centro queda un pelín más "cerca"
    const finalT=`translateX(calc(-50% + ${xOff}px)) translateY(${yOff-6}px) rotate(${angDeg.toFixed(1)}deg) scale(${scale})`;
    return `<div class="tile c-${cols[i]} dotc-${cols[i]}" style="--final-t:${finalT};animation-delay:${(i*0.09).toFixed(2)}s">
      <span class="letter">${w[0]}${w[1]?`<small>${w[1]}</small>`:""}</span></div>`;
  }).join("");
  // data-flip-id fijo: GSAP Flip lo necesita para encontrar "la misma" ficha
  // entre un render y el siguiente — el DOM viejo se destruye entero
  // (innerHTML) y se crea uno nuevo, así que sin este id Flip no tendría cómo
  // saber que el .fan de portada y el de login son "el mismo elemento".
  return `<div class="fan${skipEntrance?" fan-instant":""}" data-flip-id="logo-fan">${fan}</div>`;
}
// Continuidad portada→login→registro (Fase 11 §2, pedido dos veces): antes
// cada pantalla se reconstruía de cero y el logo "desaparecía y aparecía"
// distinto. Con Flip: se mide el .fan ANTES de cambiar de pantalla, se deja
// que render() reconstruya todo como siempre (nada de la arquitectura
// existente cambia), y Flip anima la diferencia de posición/tamaño entre el
// .fan viejo (ya destruido) y el nuevo — el logo se ve "encogerse y subir"
// en vez de cortar. Si no hay gsap/Flip o el usuario pidió menos movimiento,
// cae directo a el render normal sin animación (nunca rompe la navegación).
function withLogoFlip(fn){
  if(!window.gsap || !window.Flip || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)){
    fn(); return;
  }
  const state=Flip.getState('[data-flip-id="logo-fan"]');
  fn();
  // targets explícito: render() reemplaza app.innerHTML entero, así que el
  // <img> capturado en "state" queda DESVINCULADO del documento. Sin este
  // "targets", Flip.from() reusaba esa referencia vieja para medir el estado
  // "después" — un nodo desconectado mide {0,0,0,0} y Flip lo trata como
  // "el elemento se fue" (duration 0, sin animar) en vez de "se movió". Con
  // el selector explícito, vuelve a buscarlo en el DOM real y recién ahí
  // encuentra el <img> nuevo en su posición final.
  Flip.from(state, {duration:.65, ease:"power2.inOut", scale:true, absolute:true, targets:'[data-flip-id="logo-fan"]'});
}
// [Fix — "tac instantáneo" reportado entre portada y login] withLogoFlip
// anima UN solo salto de pantalla. Pero portada->login pasa por un estado
// intermedio ("conectando…") que puede durar desde 50ms (server local/ya
// despierto) hasta varios segundos (Render recién despertando) — encadenar
// DOS withLogoFlip seguidos (portada->conectando, después conectando->login)
// hacía que el segundo interrumpiera al primero a mitad de camino cuando el
// servidor respondía rápido, y el logo terminaba saltando en vez de
// animarse una sola vez de punta a punta. Esta versión mide el logo UNA
// sola vez en portada (start), deja que "conectando" aparezca sin animar
// (total no se nota, es un estado intermedio), y recién anima TODO el
// trayecto portada->login de una vez cuando se llama a settle() — sin
// importar cuánto haya durado la conexión en el medio.
function startLogoFlipSequence(){
  if(!window.gsap || !window.Flip || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)){
    return { settle(fn){ fn(); } };
  }
  const state=Flip.getState('[data-flip-id="logo-fan"]');
  return { settle(fn){
    fn();
    // Ver comentario en withLogoFlip: "targets" explícito es obligatorio acá
    // porque fn() ya reemplazó app.innerHTML (una o dos veces, si hubo
    // pantalla "conectando" en el medio) — sin esto, Flip.from() intentaría
    // re-medir el <img> viejo (ya desconectado del DOM) en vez del nuevo.
    Flip.from(state, {duration:.65, ease:"power2.inOut", scale:true, absolute:true, targets:'[data-flip-id="logo-fan"]'});
  } };
}
// [Login v2] Logo real BURAKO (client/img/login/logo.png) — reemplaza el
// abanico de fichas animado (fanLogoHTML) en portada y menú, pedido
// explícito del usuario ("el burako nuevo que se ve re lindo"). Mismo
// data-flip-id="logo-fan" que usaba el abanico: GSAP Flip solo necesita
// que el selector exista antes/después del cambio de pantalla para animar
// la diferencia de posición — funciona igual con una imagen estática.
// [Fix — "tac instantáneo" reportado] El wrapper lleva el float/entrada
// (CSS, transform), la imagen de adentro NO tiene ninguna animación CSS
// propia — es la que GSAP Flip mueve entre pantallas (data-flip-id), y una
// animación CSS de transform en el MISMO elemento le ganaba la cascada al
// transform inline que arma GSAP durante la transición, así que el flip
// quedaba invisible y se sentía como un salto en vez de una animación.
function burakoLogoHTML(cls){
  return `<div class="${cls}-wrap"><img class="${cls}" data-flip-id="logo-fan" src="./img/login/logo.png" alt="Burako"></div>`;
}
// [Login v2] Shell visual compartido por portada (renderIntro) y login/
// registro (renderAuthScreen) — mismas capas PNG en capas reales del
// usuario (fondo/fichas flotantes/logo/panel), mismo criterio de entrada
// (.login-v2-enter solo en el primer render de la pantalla, ver
// G._enterCls) para que no se repita la animación de entrada en cada
// re-render de fondo (ej. towerStatus llegando mientras se mira el menú).
function loginShellHTML(contentHTML, entering){
  return `<div class="login-v2 auth-screen${entering?" login-v2-enter":""}">
    <div class="login-v2-bg" aria-hidden="true"></div>
    <div class="login-v2-ambient" aria-hidden="true"></div>
    <img class="login-v2-tiles" src="./img/login/tiles.png" alt="" aria-hidden="true">
    <div class="login-v2-stage">
      ${burakoLogoHTML("login-v2-logo")}
      <div class="login-v2-panel">
        <div class="login-v2-panel-inner">
          <div class="login-v2-panel-content">
            ${contentHTML}
          </div>
        </div>
      </div>
    </div>
  </div>`;
}
/* [v1.3.3 — rediseño de menú] Tarjeta grande de Pase de temporada — mismo
   criterio de siempre (dato real, nunca simulado): nivel, XP, y ahora
   también la PRÓXIMA recompensa real de PASS_LEVELS (la primera con
   lv>nivel actual), para que la tarjeta venda "esto es lo que viene" en vez
   de solo mostrar una barra. Columna izquierda en desktop (antes derecha,
   compartida con Ruleta/Torre — ahora cada una tiene su propia tarjeta
   grande, ver menuRuletaHeroHTML/menuTowerHeroHTML). */
/* [reconstrucción visual con assets — fondo.png/banner.png/emblema.png/
   cofre.png/boton-ver-pase.png en client/img/pass/] Misma lógica y mismos
   datos reales de siempre (passLevel/P.xpInLevel/P.xpForNext/PASS_LEVELS/
   P.passClaimed) — acá solo cambia CÓMO se dibuja. El emblema NO trae
   número dibujado (a propósito, según el asset que pasó el usuario): el
   nivel es texto HTML real superpuesto (single source of truth: `lvl`, se
   usa tanto dentro del emblema como en "Nivel actual"). No existe ningún
   dato real de "número/nombre de temporada" en el proyecto (no hay
   currentSeason/seasonName en ningún lado — passLevel() usa P.level, el
   nivel general del jugador) — por eso NO se agrega ese subtítulo: hubiera
   sido inventar un dato, y esa regla se mantuvo en todo el rediseño. */
function menuPassCardHTML(){
  const lvl=passLevel();
  const xpInLevel=P.xpInLevel||0, xpForNext=P.xpForNext||xpForNextLevel(lvl);
  const xpPct=Math.min(100,Math.round(xpInLevel/xpForNext*100));
  const claimable=PASS_LEVELS.some(L=>lvl>=L.lv&&!P.passClaimed[L.lv]);
  const next=PASS_LEVELS.find(L=>L.lv>lvl);
  const lvlDigits=String(lvl).length;
  const lvlCls=lvlDigits>=3?"season-level-num-3":lvlDigits===2?"season-level-num-2":"season-level-num-1";
  return `<div class="menu-hero-card menu-hero-pass" onclick="goPass()">
    <img class="season-pass-bg" src="./img/pass/fondo.png" alt="" aria-hidden="true">
    <div class="season-pass-overlay" aria-hidden="true"></div>
    <img class="season-pass-banner" src="./img/pass/banner.png" alt="Temporada activa" aria-hidden="true">
    ${claimable?`<span class="menu-hero-badge">🎁</span>`:""}
    <div class="season-pass-content">
      <div class="menu-hero-title">Pase de temporada</div>
      <div class="season-pass-top-row">
        <div class="season-level-emblem">
          <img src="./img/pass/emblema.png" alt="" aria-hidden="true">
          <span class="season-level-number ${lvlCls}">${lvl}</span>
        </div>
        <div class="season-level-info">
          <div class="menu-hero-level-label">Nivel actual</div>
          <div class="menu-hero-level-value">${lvl}</div>
          <div class="menu-hero-bar"><div class="menu-hero-bar-fill menu-hero-bar-gold" style="width:${xpPct}%"></div></div>
          <div class="menu-hero-sub season-xp-sub">${xpInLevel}/${xpForNext} XP para el próximo nivel</div>
        </div>
      </div>
      ${next?`<div class="menu-hero-reward-box season-reward-box">
        <img class="season-reward-chest" src="./img/pass/cofre.png" alt="" aria-hidden="true">
        <div>
          <div class="menu-hero-reward-label">Recompensa destacada</div>
          <div class="menu-hero-reward-value">${esc(next.label)}</div>
          <div class="menu-hero-reward-sub">Reclamalo al nivel ${next.lv}</div>
        </div>
      </div>`:""}
      <button class="season-pass-button" onclick="event.stopPropagation();goPass()" aria-label="Ver pase">
        <img src="./img/pass/boton-ver-pase.png" alt="Ver pase">
      </button>
    </div>
  </div>`;
}
/* [v1.3.3] Tarjeta grande de Ruleta diaria en el menú — usa los MISMOS datos
   que ya trae dailyStatus (streak, reclamada hoy, tiempo hasta el próximo
   reset); goMenu() pide ese status si todavía no se cargó esta sesión (ver
   más abajo), así la tarjeta nunca inventa un estado. El botón lleva a la
   pantalla real de Ruleta — el giro en sí sigue pasando ahí (misma lógica,
   solo un acceso más atractivo desde el menú). */
/* [reconstrucción visual con assets — fondo.png/banner.png/ruleta.png/
   boton.png en client/img/ruleta/, mismos archivos que ya usa la pantalla
   completa de girar] Esta es la tarjeta CHICA del menú (la que vive al
   lado de Torre) — la rueda de acá es solo decorativa (leve balanceo, no
   gira de verdad ni decide nada); el giro real con premio real sigue
   pasando en la pantalla dedicada (goDailyRoulette/renderDailyRoulette),
   esta tarjeta solo invita a entrar, igual que ya hacen Pase y Torre.
   Mismos datos reales de siempre (G.dailyStreakDay/G.dailyClaimedToday de
   dailyStatus) — nunca inventa un estado. El botón de "ya reclamado" NO
   usa disabled nativo (bug ya encontrado antes: en algunos navegadores
   bloquea el click-bubbling) — sigue siendo clickeable y lleva a la
   pantalla real, solo se ve apagado. */
function menuRuletaHeroHTML(){
  const loaded=G.dailyStreakDay!=null;
  const claimedToday=!!G.dailyClaimedToday;
  return `<div class="menu-hero-card menu-hero-ruleta" onclick="goDailyRoulette()">
    <img class="ruleta-hero-bg" src="./img/ruleta/fondo.png" alt="" aria-hidden="true">
    <div class="ruleta-hero-overlay" aria-hidden="true"></div>
    <img class="ruleta-hero-banner" src="./img/ruleta/banner.png" alt="¡Premio diario!" aria-hidden="true">
    <div class="ruleta-hero-content">
      <div class="ruleta-hero-main">
        <div class="ruleta-hero-left">
          <div class="menu-hero-title">Ruleta diaria</div>
          <div class="menu-hero-sub ruleta-hero-tagline">Girá cada día y ganá premios increíbles</div>
          ${!loaded?`<div class="menu-hero-sub ruleta-hero-status">Consultando tu progreso…</div>`
            :claimedToday?`<div class="menu-hero-sub ruleta-hero-status">✔ Ya la giraste hoy · se reinicia ${fmtHoursMin(G.dailyMsUntilNext)}</div>`
            :`<div class="menu-hero-sub ruleta-hero-status">Racha: día ${G.dailyStreakDay} de 7</div>`}
        </div>
        <div class="ruleta-hero-right">
          <img class="ruleta-hero-wheel" src="./img/ruleta/ruleta.png" alt="" aria-hidden="true">
          <img class="ruleta-hero-coins" src="./img/ruleta/monedas.png" alt="" aria-hidden="true">
        </div>
      </div>
      <button class="ruleta-hero-button${claimedToday?" ruleta-hero-button-off":""}" onclick="event.stopPropagation();goDailyRoulette()" aria-label="Girar ahora">
        <img src="./img/ruleta/boton.png" alt="Girar ahora">
      </button>
    </div>
  </div>`;
}
/* [v1.3.3] Tarjeta grande de Torre semanal en el menú — mismos datos reales
   de towerStatus (piso actual, completa o no). El botón lleva a la Torre
   real; ahí es donde de verdad se arranca la partida (goTower()/
   doTowerStart()), esta tarjeta no duplica esa lógica. */
/* [reconstrucción visual con assets — torre.png/fondo.png/cofre.png/
   boton-ir-a-la-torre.png en client/img/tower/] Misma lógica y mismos datos
   reales de siempre (loaded/floor/pct/prizeLabel/pendingCount) — acá solo
   cambia CÓMO se dibuja el bloque: fondo como capa de imagen, torre PNG
   emergiendo a la izquierda, cofre PNG en "mejor recompensa" y el botón
   real es la imagen (sin texto HTML duplicado encima). El click de la
   tarjeta entera sigue yendo a goTower() — el botón-imagen llama a la
   misma función, solo con stopPropagation para no dispararla dos veces. */
function towerHeroFloorHTML(floor,pct,extraMsg){
  return `<div class="tower-hero-floor-block">
    <div class="tower-hero-floor-label">Piso actual</div>
    <div class="tower-hero-floor-value"><span class="tower-hero-floor-num">${floor}</span><span class="tower-hero-floor-max">/10</span></div>
    <div class="menu-hero-bar"><div class="menu-hero-bar-fill menu-hero-bar-violet" style="width:${pct}%"></div></div>
    ${extraMsg?`<div class="tower-hero-complete-msg">${extraMsg}</div>`:""}
  </div>`;
}
/* [cofre junto al botón] El cofre comparte la última fila con el botón para
   que la tarjeta quede compacta (sin colchón de fondo vacío abajo), pero la
   etiqueta "Mejor recompensa" vive en SU PROPIA línea arriba de esa fila —
   si comparte columna con el cofre, su ancho de texto termina siendo lo que
   más empuja esa columna y le deja el botón chiquito. Separada, el cofre
   puede ser angosto de verdad y el botón recupera tamaño.
   [interacción] El cofre ahora reacciona al toque (mismo lenguaje visual
   que el botón: escala + brillo) en vez de ser una imagen inerte, y el
   ícono "i" es tocable de verdad — muestra el aviso de siempre
   (setMsg, el mismo toast que usa el resto del juego) en vez de depender
   de un title que en el celular no se ve nunca. */
function towerHeroRewardLabelHTML(){
  return `<div class="tower-hero-reward-label-row">
    <span class="tower-hero-chest-label">Mejor recompensa</span>
    <span class="tower-hero-chest-info" onclick="event.stopPropagation();setMsg('🎁 Es lo que ganás al superar el próximo piso de la Torre')">i</span>
  </div>`;
}
function towerHeroChestMiniHTML(prizeLabel){
  if(!prizeLabel) return "";
  return `<div class="tower-hero-chest-mini" onclick="event.stopPropagation();goTower()">
    <img class="tower-hero-chest-img" src="./img/tower/cofre.png" alt="" aria-hidden="true">
    <span class="tower-hero-chest-text">${esc(prizeLabel)}</span>
  </div>`;
}
function menuTowerHeroHTML(){
  const loaded=G.towerFloor!=null||G.towerComplete;
  const floor=G.towerComplete?10:(G.towerFloor||1);
  const pct=Math.round((Math.min(floor,10)-1)/9*100);
  const prizeLabel=G.towerComplete?"Torre Celestial 🏰":towerFloorPrizeLabel(floor);
  const pendingCount=(G.towerPending||[]).length+(G.towerPendingChests||[]).length;
  const towerId=G.towerTower||1;
  const towerName=(TOWER_META_DISPLAY[towerId]||{}).name||"";
  return `<div class="menu-hero-card menu-hero-tower tower-theme-${towerId}" onclick="goTower()">
    <img class="tower-hero-bg" src="./img/tower/fondo.png" alt="" aria-hidden="true">
    <div class="tower-hero-ground" aria-hidden="true"></div>
    <img class="tower-hero-tower-img" src="./img/tower/torre.png" alt="" aria-hidden="true">
    <div class="tower-hero-overlay" aria-hidden="true"></div>
    ${pendingCount?`<span class="menu-hero-badge">🎁 ${pendingCount}</span>`:""}
    <div class="tower-hero-content">
      <span class="menu-hero-pill menu-hero-pill-violet">⚔ Desafío semanal</span>
      <div class="menu-hero-title">Torre ${loaded?esc(towerName):"semanal"}</div>
      <div class="menu-hero-sub tower-hero-desc">Subí pisos, superá desafíos y ganá recompensas épicas</div>
      ${!loaded?`<div class="menu-hero-sub">Consultando tu progreso…</div>`
        :towerHeroFloorHTML(floor,pct,G.towerComplete?"🎉 ¡Completaste la Torre esta semana!":"")}
      <div class="tower-hero-bottom-row">
        ${loaded&&prizeLabel?towerHeroRewardLabelHTML():""}
        <div class="tower-hero-bottom-inner">
          <button class="tower-enter-button" onclick="event.stopPropagation();goTower()" aria-label="Ir a la Torre">
            <img src="./img/tower/boton-ir-a-la-torre.png" alt="Ir a la Torre">
          </button>
          ${loaded?towerHeroChestMiniHTML(prizeLabel):""}
        </div>
      </div>
    </div>
  </div>`;
}
/* Tarjeta de jugador del menú (esquina superior izquierda) — reconstruida con los
   assets de "Imagenes de referencia/Perfil Lobby" (panel + marco circular + ícono
   sol por defecto + escudo de rango), reemplazando el viejo .hud-profile-chip.
   Ojo: Burako no tiene fotos de perfil reales, el "avatar" siempre es un emoji
   (ver AVATARS/P.avatar) — así que "la foto del jugador" de la spec es ese emoji;
   el ícono sol (imagen 3) queda como fallback defensivo para el caso raro de que
   P.avatar venga vacío. Nombre/nivel/XP/rango salen 100% de P.*, nada hardcodeado. */
function playerCardHTML(){
  const t=tierOf(P.rankPts);
  const xpForNext=P.xpForNext||500;
  const xpPct=Math.max(0,Math.min(100,Math.round((P.xpInLevel||0)/xpForNext*100)));
  return `<div class="player-card" onclick="goProfile()" title="Ver perfil">
    <div class="pcard-panel-wrap"><img class="pcard-panel" src="./img/profile/panel.png" alt="" aria-hidden="true"></div>
    <div class="pcard-avatar">
      ${P.avatar?`<span class="pcard-avatar-emoji">${P.avatar}</span>`:`<img class="pcard-avatar-default" src="./img/profile/avatar-default.png" alt="">`}
      <img class="pcard-avatar-ring" src="./img/profile/avatar-frame.png" alt="" aria-hidden="true">
    </div>
    <div class="pcard-info">
      <div class="pcard-name">${nameEffectHTML(P.name||"Jugador",P.nameeffect)}</div>
      <div class="pcard-level-row">
        <span class="pcard-level-pill">Nv. ${P.level||1}</span>
        <span class="pcard-xp-track"><span class="pcard-xp-fill" style="width:${xpPct}%"></span></span>
      </div>
    </div>
    <div class="pcard-rank" title="${esc(t.name)} · ${P.rankPts} pts">
      <img class="pcard-rank-shield" src="./img/profile/rank-shield.png" alt="" aria-hidden="true">
      <span class="pcard-rank-icon">${t.icon}</span>
      <span class="pcard-rank-pts">${P.rankPts}</span>
    </div>
  </div>`;
}
/* Botones dorados principales del menú (JUGAR/PERFIL/TIENDA/NOVEDADES) —
   reconstruidos sobre los PNG de "Imagenes de referencia/botones perfil"
   como componentes reales, no <img> sueltas: siguen siendo <button> de
   verdad (mismo onclick/lógica exacta de siempre, cero funcionalidad
   duplicada), la imagen es solo el arte de fondo, y el resto (glow, shine,
   badge) son capas HTML encima. Un solo lugar (acá) define tamaño/efectos
   para los 4 — GameMenuButton() se llama una vez por botón en renderMenu().
   asset: nombre de archivo en client/img/menu-buttons/ (sin extensión).
   action: el mismo string que antes iba en onclick="..." (se preserva tal
   cual, ver renderMenu). primary: JUGAR, ~10% más grande. notificationCount:
   entero real (0/undefined = sin badge) — ver unseenChangelogCount(). */
function GameMenuButton({asset,alt,action,primary,notificationCount}){
  const count=notificationCount||0;
  const badge=count>0?`<span class="notification-badge">${count>9?"9+":count}</span>`:"";
  return `<button class="game-menu-btn${primary?" game-menu-btn-primary":""}" onclick="${action}" aria-label="${esc(alt)}">
    <span class="gmb-clip">
      <span class="gmb-glow" aria-hidden="true"></span>
      <img class="gmb-art" src="./img/menu-buttons/${asset}.png" alt="" draggable="false">
      <span class="gmb-shine" aria-hidden="true"></span>
    </span>
    ${badge}
  </button>`;
}
function renderMenu(app){
  const fan=burakoLogoHTML("menu-logo-img"); // [pedido] logo real en vez del abanico animado — ver burakoLogoHTML()
  const ghostRack=(cls)=>`<div class="menu-rack-ghost ${cls} sk-clasica">${
    [3,7,11,4,9,13,2,5,8,1,10,6].map((v,i)=>`<div class="tile c-${["rojo","azul","verde","amarillo"][i%4]} dotc-${["rojo","azul","verde","amarillo"][i%4]}">${v}</div>`).join("")
  }</div>`;

  app.innerHTML=`
  ${G.pendingWelcomeBonus?`<div class="pauseovl" onclick="if(event.target===this)closeWelcomeBonus()">
    <div class="pausecard a-pop" style="text-align:center">
      <div style="font-size:46px;margin-bottom:6px">🎁</div>
      <h2 style="font-family:var(--font-heading);color:#ffe9a8;font-size:20px;margin-bottom:8px">¡Bono de bienvenida!</h2>
      <p style="font-size:13px;color:rgba(232,238,247,.75);margin-bottom:14px;line-height:1.5">Gracias por jugar Burako.<br>Te regalamos <b style="color:#fbbf24">🪙 ${G.pendingWelcomeBonus.toLocaleString("es-UY")} monedas</b> para gastar en la tienda.</p>
      <button class="btn btn-gold" onclick="closeWelcomeBonus()">¡Genial!</button>
    </div>
  </div>`:""}
  <div class="menu-elegant">
    ${ghostRack("left")}
    ${ghostRack("right")}
  </div>
  <div class="elegant-hud">
    ${playerCardHTML()}
    <button class="hud-coins" onclick="goShop()" title="Ir a la tienda">
      <span class="hud-coins-icon">🪙</span>
      <span class="hud-coins-value">${P.fichas.toLocaleString("es-UY")}</span>
      <span class="hud-coins-plus">+</span>
    </button>
  </div>
  <div class="screen-center" style="position:relative;z-index:1">
    <div class="menu-layout ${G._enterCls?"a-slidein":""}">
      <div class="menu-side menu-side-left">${menuPassCardHTML()}</div>
      <div class="menu-main">
        ${fan}
        <p class="elegant-sub" style="margin-top:2px">El juego de Burako definitivo <span style="opacity:.6">· v${GAME_VERSION.replace(/\.0$/,"")}</span></p>
        <div class="game-menu-btns${G._enterCls?" gmb-enter":""}">
          ${GameMenuButton({asset:"jugar",alt:"Jugar",action:"Sound.init();goPlay()",primary:true})}
          ${GameMenuButton({asset:"perfil",alt:"Perfil",action:"Sound.select();goProfile()"})}
          ${GameMenuButton({asset:"tienda",alt:"Tienda",action:"Sound.select();goShop()"})}
          ${GameMenuButton({asset:"novedades",alt:"Novedades",action:"Sound.select();goChangelog()",notificationCount:unseenChangelogCount()})}
        </div>
        <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-top:16px">
          <button onclick="goConfig()" style="background:none;border:none;color:#a5926a;font-size:12px;cursor:pointer">⚙ Opciones</button>
          <button onclick="goHelp()" style="background:none;border:none;color:#a5926a;font-size:12px;cursor:pointer">📖 Cómo jugar</button>
          <button onclick="logout()" style="background:none;border:none;color:#a5926a;font-size:12px;cursor:pointer">🚪 Salir</button>
        </div>
      </div>
      <div class="menu-side menu-side-right">
        ${menuRuletaHeroHTML()}
        ${menuTowerHeroHTML()}
      </div>
    </div>
    ${menuComingSoonRowHTML()}
  </div>`;
}
/* Fila inferior de "próximamente" — puramente visual/decorativa, a pedido
   explícito: NO hay funcionalidad real de racha diaria/eventos/invitar
   amigos todavía (no existe ese sistema en P.* / G.* ni en el servidor), así
   que ninguno de los 3 abre una pantalla real ni inventa datos — el click
   solo muestra el mismo toast "Próximamente" (setMsg, igual que el resto
   del juego) para que quede clarísimo que no es una función rota. */
function menuComingSoonRowHTML(){
  const items=[
    {icon:"📅",title:"Jugá todos los días",sub:"y conseguí grandes premios"},
    {icon:"🎁",title:"Eventos especiales",sub:"Muy pronto, nuevos eventos"},
    {icon:"👥",title:"Invitá a tus amigos",sub:"y ganá recompensas juntos"},
  ];
  return `<div class="menu-soon-row">
    ${items.map(it=>`<button class="menu-soon-item" onclick="setMsg('🔜 Próximamente')">
      <span class="menu-soon-icon">${it.icon}</span>
      <span class="menu-soon-text">
        <span class="menu-soon-title">${it.title}</span>
        <span class="menu-soon-sub">${it.sub}</span>
      </span>
      <span class="menu-soon-badge">Próximamente</span>
    </button>`).join("")}
  </div>`;
}

function renderHelp(app){
  const exEsc=[{color:"verde",number:5},{color:"verde",number:6},{color:"verde",number:7}];
  const exGrp=[{color:"rojo",number:9},{color:"azul",number:9},{color:"amarillo",number:9}];
  app.innerHTML=`
  <div class="screen-center">
    <div class="card help ${G._enterCls}" style="max-height:85dvh;overflow-y:auto">
      <button class="card-x" onclick="goMenu()" title="Cerrar">✕</button>
      <h2>Cómo jugar</h2>
      <h3>🎯 Objetivo</h3>
      <p>Quedarte sin fichas antes que los demás, bajando juegos a la mesa.</p>
      <h3>🀄 Las fichas</h3>
      <p>Dos sets del 1 al 13 en 4 colores, más 4 comodines (★). Cada jugador arranca con 14 fichas en su atril de 3 filas.</p>
      <h3>✅ Juegos válidos</h3>
      <p><b>Escalera:</b> 3 o más números seguidos del mismo color.</p>
      <div class="ex sk-clasica">${exEsc.map(t=>tileHTML(t)).join("")}</div>
      <p><b>Grupo:</b> el mismo número en colores distintos (máx. 4, sin repetir color).</p>
      <div class="ex sk-clasica">${exGrp.map(t=>tileHTML(t)).join("")}</div>
      <h3>🚪 Salir con 30</h3>
      <p>Tu primera bajada tiene que ser <b>un único juego que por sí solo valga 30 puntos o más</b> (ej: 10-10-10). No vale sumar dos juegos chicos para llegar a 30. Hasta que salgas, no podés tocar la mesa. Después ya bajás lo que quieras, hasta un 1-2-3.</p>
      <div class="ex sk-clasica">${[{color:"rojo",number:10},{color:"azul",number:10},{color:"amarillo",number:10}].map(t=>tileHTML(t)).join("")}</div>
      <p style="font-size:11px;color:rgba(232,238,247,.5);margin-top:-8px">10+10+10 = 30 → alcanza para salir con un solo juego.</p>
      <h3>🛠 Preparación</h3>
      <p>Es la zona de armado, aparte de tu atril: mandá fichas ahí (tocando o arrastrando) para probar combinaciones sin comprometerlas todavía. Podés armar varios juegos a la vez, deshacer y reacomodar las veces que quieras — recién se bajan de verdad cuando confirmás.</p>
      <h3>🔧 Reorganizar la mesa</h3>
      <p>Cuando ya saliste, podés "abrir" un juego de la mesa y rearmarlo con tus fichas (ej: partir 1-2-3-4-5 y con tu 3 armar 1-2-3 y 3-4-5). Eso sí: no puede quedar ningún juego inválido ni de menos de 3 fichas.</p>
      <h3>★ Comodines y 🔒 candados</h3>
      <p>Los comodines (★) valen por cualquier ficha. Pero cada juego que tenga un comodín queda "con candado": modificarlo (abrirlo, reacomodarlo, o insertarle una ficha tuya) gasta 1 de tus <b>3 candados por partida</b>. Un juego SIN comodín se puede tocar siempre, sin límite.</p>
      <p>Cuando se te acaban los 3, ya no podés modificar ningún juego con comodín por el resto de la partida — el botón te avisa por qué en vez de no hacer nada.</p>
      <h3>⏱ Tu turno (1 minuto)</h3>
      <p>1. Modo <b>✋ Ordenar</b>: acomodá tu atril tocando ficha y destino.<br>
      2. Modo <b>🎯 Jugar</b>: seleccioná fichas y mandalas a la zona de armado.<br>
      3. <b>Formá juegos</b> y confirmá, o <b>tomá una ficha</b> del pozo y pasá.<br>
      4. Botón <b>💡 Jugadas</b>: te marca qué juegos tenés armables.<br>
      5. Si se te vence el minuto, pasás el turno sin comer fichas <b>y perdés una vida</b>.</p>
      <h3>🏳 Rendirse</h3>
      <p>Desde el menú de pausa podés rendirte y salir de la partida en cualquier momento — cuenta como derrota, sin afectar tus fichas ni las de los demás.</p>
      <h3>🏁 Fin de partida y puntaje</h3>
      <p>Ganás vaciando el atril primero. Si se acaba el pozo (o el tiempo, en partidas con límite), gana quien tenga <b>menos puntos</b> en las fichas que le quedan — no importa cuántas fichas sean, importa cuánto valen: las numeradas valen su número, y cada comodín vale 25.</p>
      <div class="ex sk-clasica">${[{color:"rojo",number:3},{color:"azul",number:7},{joker:true}].map(t=>tileHTML(t)).join("")}</div>
      <p style="font-size:11px;color:rgba(232,238,247,.5);margin-top:-8px">3 + 7 + 25 (comodín) = 35 puntos restantes.</p>
      <div style="margin-top:14px;font-size:11.5px;color:rgba(232,238,247,.55);line-height:1.6;background:rgba(0,0,0,.2);border-radius:10px;padding:10px 12px">
        Por partida tenés: <b style="color:#ffe9a8">❤ ${MAX_LIVES} vidas</b> (si se vence tu turno, perdés una vida y pasás sin comer fichas; sin vidas, abandonás),
        <b style="color:#7dd3fc">💡 10 pistas</b> y <b style="color:#ffe9a8">🔓 3 candados</b> para modificar juegos con comodín.
      </div>
    </div>
  </div>`;
}

function renderChangelog(app){
  app.innerHTML=`
  <div class="screen-center">
    <div class="card help ${G._enterCls}" style="max-height:85dvh;overflow-y:auto">
      <button class="card-x" onclick="goMenu()" title="Cerrar">✕</button>
      <h2>📣 Novedades</h2>
      ${CHANGELOG.map((v,i)=>`
        <div style="margin-bottom:${i<CHANGELOG.length-1?"18px":"4px"}">
          <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px">
            <span style="font-family:var(--font-display);color:#ffe9a8;font-size:17px;font-weight:800">v${v.version}</span>
            <span style="font-size:11px;color:rgba(232,238,247,.45)">${esc(v.date)}</span>
            ${i===0?'<span style="font-size:9px;font-weight:800;letter-spacing:1px;color:#1a1200;background:linear-gradient(180deg,#fcd34d,#f59e0b);border-radius:6px;padding:2px 6px">ÚLTIMA</span>':""}
          </div>
          <ul style="margin:0;padding-left:18px;line-height:1.7">
            ${v.items.map(it=>`<li style="font-size:13px;color:rgba(232,238,247,.88)">${esc(it)}</li>`).join("")}
          </ul>
        </div>
      `).join("")}
    </div>
  </div>`;
}

function renderSorteo(app){
  const order=G.sorteoTiles.slice().sort((a,b)=>b.tile.number-a.tile.number);
  app.innerHTML=`
  <div class="screen-center">
    <div class="card ${G._enterCls}" style="text-align:center;position:relative">
      <button class="card-x" onclick="goPlay()" title="Cerrar">✕</button>
      <h2 style="font-family:var(--font-heading);color:#ffe9a8;font-size:24px;margin-bottom:6px;margin-top:6px">Sorteo de orden</h2>
      <p style="font-size:12px;color:rgba(232,238,247,.55);margin-bottom:16px">
        ${!G.myRevealed?"Sacá tu ficha de la bolsa 👇":(G.sorteoDone?"Orden definido:":"Los rivales sacan la suya…")}
      </p>
      ${!G.myRevealed?`
        <div class="bag anim-bag" onclick="revealMine()" style="width:90px;height:104px;margin:0 auto 16px;cursor:pointer">
          <div class="b" style="left:0;top:8px;width:66px;height:82px"></div>
          <div class="b" style="left:7px;top:4px;width:66px;height:82px"></div>
          <div class="b" style="left:14px;top:0;width:66px;height:82px"></div>
          <div class="cnt" style="font-size:26px">?</div>
        </div>
        <p style="font-size:11px;color:rgba(232,238,247,.4)">Tocá la bolsa</p>
      `:`
        <div class="sk-${P.skin||"clasica"}" style="display:flex;gap:18px;justify-content:center;flex-wrap:wrap;margin-bottom:18px">
          ${order.map(s=>`
            <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
              ${s.revealed
                ? tileHTML(s.tile,"a-flip","width:48px;height:66px;font-size:22px")
                : `<div class="tile back" style="width:48px;height:66px"></div>`}
              <span style="font-size:11px;color:${s.isHuman?"#ffe9a8":"rgba(232,238,247,.7)"};font-weight:${s.isHuman?800:400}">${esc(s.name)}${s.isHuman?" (vos)":""}</span>
            </div>`).join("")}
        </div>
      `}
      ${G.sorteoDone?`
        <p class="a-pop" style="font-size:12px;color:#ffe9a8;margin-bottom:14px">
          ${order.map((o,i)=>(i+1)+"° "+esc(o.name)+" ("+o.tile.number+")").join(" · ")}
        </p>
        <button class="btn btn-gold a-pop" onclick="startDealing()">Repartir fichas →</button>
      `:""}
    </div>
  </div>`;
}
function renderGameover(app){
  const w=G.winner;
  const byPoints=!!G.finalRanking;
  const online=G.online && G.matchResult;
  const mr = online ? G.matchResult : null;
  const upd = mr && mr.update ? mr.update : null;

  // Encabezado según resultado
  let headerHTML = "";
  if(online && mr.reason==="tower"){
    // Torre semanal (v1.3): nunca pasa por mr.update (Torre no da recompensas
    // normales) — el premio real, si lo hay, viene en mr.towerResult.
    const tr=mr.towerResult;
    const towerName=(TOWER_META_DISPLAY[mr.towerTower||1]||{}).name||"";
    if(mr.won){
      const prize=tr&&tr.ok?formatTowerRewardsReal(tr.rewards,mr.towerFloor):null;
      // [v1.3.4 — premios pendientes] El premio YA está confirmado y pagado
      // por el servidor (tr/prize) desde ANTES de que se dibuje este botón —
      // acá "abrir el regalo" es solo la presentación Y el aviso de "ya lo
      // vi" (towerAcknowledge) para que no vuelva a aparecer como pendiente
      // si el jugador vuelve más tarde a la Torre. Si salís de esta pantalla
      // sin abrirlo, NO se pierde — sigue en G.towerPending / lo puede abrir
      // después desde la Torre (ver renderTower/openTowerRewardQueue).
      const giftHTML = !prize ? `<p style="font-size:12px;color:rgba(232,238,247,.55);margin-bottom:4px">Piso superado.</p>`
        : !G._towerGiftOpened
          ? `<button class="tower-gift-box" onclick="ackTowerGameoverGift()" aria-label="Abrir tu premio">
               <span class="tower-gift-icon">🎁</span>
               <span class="tower-gift-hint">Tocá para abrir tu premio</span>
             </button>`
          : `<div class="tower-gift-prize a-pop">${prize}</div>
             ${tr&&tr.complete?`<div class="tower-gift-prize a-pop" style="font-size:16px;margin-top:6px">🏆 Bonus Torre completa: ${towerCompleteBonusLabel()}</div>`:""}`;
      headerHTML = `<div class="win-text a-pop">¡PISO ${mr.towerFloor} SUPERADO! 🏰</div>
        ${towerName?`<p style="font-size:12px;color:rgba(232,238,247,.55);margin-bottom:2px">Torre ${towerName}</p>`:""}
        ${giftHTML}
        ${tr&&tr.complete?`<p style="font-size:13px;color:#ffe9a8;font-weight:700;margin-bottom:8px">🎉 ¡Completaste los 10 pisos de la Torre ${towerName}!</p>`:""}`;
    } else {
      const lr=mr.towerLivesRemaining;
      const livesMsg=lr===0
        ?"Te quedaste sin intentos en esta Torre por esta semana. Volvé el lunes."
        :lr!=null?`Te queda${lr===1?"n":"n"} ${lr} vida${lr===1?"":"s"} en esta Torre esta semana.`:"Podés reintentar el mismo piso.";
      headerHTML = `<div style="font-size:56px;margin-bottom:6px">🏰</div>
        <h2 style="font-family:var(--font-heading);color:#ffe9a8;font-size:24px;margin-bottom:4px">Piso ${mr.towerFloor} no superado</h2>
        ${towerName?`<p style="font-size:12px;color:rgba(232,238,247,.55);margin-bottom:2px">Torre ${towerName}</p>`:""}
        <p style="font-size:12px;color:rgba(232,238,247,.55);margin-bottom:12px">Ganó ${esc(mr.winnerName||"el rival")}. ${livesMsg}</p>`;
    }
  } else if(online){
    if(mr.iSurrendered){
      headerHTML = `<div style="font-size:56px;margin-bottom:6px">💔</div>
        <h2 style="font-family:var(--font-heading);color:#f87171;font-size:26px;margin-bottom:4px">Te rendiste</h2>
        <p style="font-size:12px;color:rgba(232,238,247,.5);margin-bottom:12px">Perdés la partida.</p>`;
    } else if(mr.won){
      headerHTML = `<div class="win-text a-pop">¡GANASTE!</div>
        <p style="font-size:12px;color:rgba(232,238,247,.55);margin-bottom:12px">${mr.surrendererId?"Tu rival se rindió.":"Vaciaste tu atril primero."}</p>`;
    } else {
      headerHTML = `<div style="font-size:56px;margin-bottom:6px">🎯</div>
        <h2 style="font-family:var(--font-heading);color:#ffe9a8;font-size:24px;margin-bottom:4px">Puesto ${mr.place}°</h2>
        <p style="font-size:12px;color:rgba(232,238,247,.55);margin-bottom:12px">Ganó ${esc(mr.winnerName||"")}.</p>`;
    }
  } else if(G.teamMode){
    // Modo 2v2: el "ganador" individual (w) puede ser el humano (equipo A) o
    // un rival (equipo B) — se muestra como resultado del equipo, no de una persona.
    const teamWon = w && w.team==="A";
    headerHTML = teamWon&&!G.abandoned
      ? `<div class="win-text">¡GANÓ TU EQUIPO! 🎉</div>`
      : `<div style="font-size:56px;margin-bottom:8px">${G.abandoned?"💔":"🤖"}</div>
         <h2 style="font-family:var(--font-heading);color:#ffe9a8;font-size:28px;margin-bottom:6px">${G.abandoned?(G.surrendered?"Te rendiste":"Tu equipo se quedó sin vidas"):"Ganó el equipo rival"}</h2>`;
  } else {
    // Modo offline: comportamiento anterior
    headerHTML = w&&w.isHuman&&!G.abandoned
      ? `<div class="win-text">¡GANASTE!</div>`
      : `<div style="font-size:56px;margin-bottom:8px">${G.abandoned?"💔":"🤖"}</div>
         <h2 style="font-family:var(--font-heading);color:#ffe9a8;font-size:28px;margin-bottom:6px">${G.abandoned?(G.surrendered?"Te rendiste":"Partida abandonada"):"Ganó "+esc(w?w.name:"")}</h2>`;
  }

  // Bloque de progresión (solo si hay update del server)
  let progressHTML = "";
  if(upd){
    const before = upd.before, after = upd.after;
    const xpBarPct = Math.min(100, Math.round(after.xpInLevel / after.xpForNext * 100));
    const levelUpHTML = upd.leveledUp
      ? `<div class="a-pop levelup-banner" style="background:linear-gradient(90deg,#f59e0b,#fcd34d);color:#1a1200;font-weight:800;padding:8px 12px;border-radius:10px;margin:8px 0;text-align:center;font-size:14px;box-shadow:0 0 20px rgba(251,191,36,.5)">
          🎉 ¡Subiste a Nivel ${after.level}!
        </div>`
      : "";
    const rankDeltaHTML = mr.ranked ? `
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px">
        <span style="color:rgba(232,238,247,.7)">🏆 Rango</span>
        <span style="font-weight:800;color:${upd.rankDelta>=0?"#34d399":"#f87171"}">${upd.rankDelta>=0?"+":""}${upd.rankDelta} pts</span>
      </div>
      <div style="font-size:11px;color:rgba(232,238,247,.55);text-align:right;margin-top:-2px;display:flex;align-items:center;justify-content:flex-end;gap:4px">${before.rankPts} → ${after.rankPts} ${G.serverProfile?"· "+tierBadgeHTML(G.serverProfile.tier,14)+" "+G.serverProfile.tier.name:""}</div>
    ` : "";

    progressHTML = `
      <div class="a-pop" style="background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.25));border:1px solid rgba(184,150,63,.4);border-radius:12px;padding:14px;margin-bottom:14px">
        <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:rgba(232,238,247,.5);margin-bottom:8px;text-align:center">Progreso</div>

        <!-- XP -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:12px;color:rgba(232,238,247,.7)">⭐ XP ganada</span>
          <span style="font-weight:800;color:#a78bfa">+${upd.xpGained}</span>
        </div>
        <div style="height:12px;border-radius:6px;background:rgba(0,0,0,.4);overflow:hidden;position:relative;margin-bottom:2px">
          <div class="xpbar-fill" style="height:100%;width:${xpBarPct}%;background:linear-gradient(90deg,#a78bfa,#7c3aed);transition:width 1.2s ease-out;box-shadow:0 0 10px rgba(167,139,250,.6)"></div>
        </div>
        <div style="font-size:10px;color:rgba(232,238,247,.55);text-align:right;margin-bottom:8px">Nivel ${after.level} · ${after.xpInLevel} / ${after.xpForNext} XP</div>

        ${levelUpHTML}

        <!-- Monedas -->
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px">
          <span style="color:rgba(232,238,247,.7)">🪙 Monedas</span>
          <span style="font-weight:800;color:#fbbf24">+${upd.coinsGained}</span>
        </div>
        <div style="font-size:11px;color:rgba(232,238,247,.55);text-align:right;margin-top:-2px;margin-bottom:6px">${before.coins} → ${after.coins}</div>

        ${rankDeltaHTML}
      </div>
    `;

    // Pase Galáctico: progreso aparte, solo si la partida fue de ese modo
    if(upd.galactico){
      const g=upd.galactico;
      const gBarPct=Math.min(100, Math.round(g.xpInLevel/g.xpForNext*100));
      progressHTML += `
        <div class="a-pop galactico-card" style="border:1px solid rgba(168,85,247,.4);border-radius:12px;padding:14px;margin-bottom:14px">
          <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:rgba(216,180,254,.75);margin-bottom:8px;text-align:center">🌌 Pase Galáctico</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="font-size:12px;color:rgba(232,238,247,.7)">⭐ XP ganada</span>
            <span style="font-weight:800;color:#e9d5ff">+${g.gained}</span>
          </div>
          <div style="height:12px;border-radius:6px;background:rgba(0,0,0,.4);overflow:hidden;position:relative;margin-bottom:2px">
            <div style="height:100%;width:${gBarPct}%;background:linear-gradient(90deg,#a855f7,#6b21a8);transition:width 1.2s ease-out;box-shadow:0 0 10px rgba(168,85,247,.6)"></div>
          </div>
          <div style="font-size:10px;color:rgba(232,238,247,.55);text-align:right">Nivel ${g.level}${g.level<15?" · "+g.xpInLevel+" / "+g.xpForNext+" XP":" · ¡Completo!"}</div>
          ${g.leveledUp?`<div class="a-pop levelup-banner" style="background:linear-gradient(90deg,#a855f7,#c084fc);color:#1a0533;font-weight:800;padding:8px 12px;border-radius:10px;margin-top:8px;text-align:center;font-size:13px;box-shadow:0 0 20px rgba(168,85,247,.5)">🎉 ¡Subiste a Nivel ${g.level} del Pase Galáctico!</div>`:""}
        </div>
      `;
    }

    // Logros nuevos
    if(upd.newAchievements && upd.newAchievements.length){
      progressHTML += `
        <div class="a-pop" style="background:linear-gradient(180deg,rgba(251,191,36,.15),rgba(251,191,36,.05));border:1px solid rgba(251,191,36,.4);border-radius:12px;padding:12px;margin-bottom:14px">
          <div style="font-size:11px;font-weight:800;color:#ffe9a8;margin-bottom:8px;text-align:center">🏆 LOGRO${upd.newAchievements.length>1?"S":""} DESBLOQUEADO${upd.newAchievements.length>1?"S":""}</div>
          ${upd.newAchievements.map(a=>`<div style="background:rgba(0,0,0,.3);border-radius:8px;padding:8px 10px;margin-bottom:5px">
            <div style="font-weight:800;color:#ffe9a8;font-size:13px">${esc(a.name)}</div>
            <div style="font-size:11px;color:rgba(232,238,247,.7);margin-top:1px">${esc(a.desc)}</div>
            <div style="font-size:10px;color:#fbbf24;margin-top:3px">🪙 +${a.coinReward}${a.xpReward>0?" · ⭐ +"+a.xpReward+" XP":""}</div>
          </div>`).join("")}
        </div>
      `;
    }
  }

  // Ranked Offline: mismo tipo de tarjeta de progreso que la online (arriba), pero con
  // PO en vez de P — nunca se mezclan (Fase offline §19).
  const ro = G.rankedOfflineResult;
  if(ro){
    const roXpBarPct = Math.min(100, Math.round(levelFromXp(PO.xp).xpInLevel / levelFromXp(PO.xp).xpForNext * 100));
    progressHTML += `
      <div class="a-pop" style="background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.25));border:1px solid rgba(184,150,63,.4);border-radius:12px;padding:14px;margin-bottom:14px">
        <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:rgba(232,238,247,.5);margin-bottom:8px;text-align:center">🏆 Progreso · Ranked Offline</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:12px;color:rgba(232,238,247,.7)">Puesto</span>
          <span style="font-weight:800;color:#ffe9a8">${ro.place}°</span>
        </div>
        <div style="height:12px;border-radius:6px;background:rgba(0,0,0,.4);overflow:hidden;position:relative;margin-bottom:2px">
          <div class="xpbar-fill" style="height:100%;width:${roXpBarPct}%;background:linear-gradient(90deg,#a78bfa,#7c3aed);transition:width 1.2s ease-out;box-shadow:0 0 10px rgba(167,139,250,.6)"></div>
        </div>
        <div style="font-size:10px;color:rgba(232,238,247,.55);text-align:right;margin-bottom:8px">Nivel ${PO.level} (offline)</div>
        ${ro.leveledUp?`<div class="a-pop levelup-banner" style="background:linear-gradient(90deg,#f59e0b,#fcd34d);color:#1a1200;font-weight:800;padding:8px 12px;border-radius:10px;margin:8px 0;text-align:center;font-size:14px;box-shadow:0 0 20px rgba(251,191,36,.5)">🎉 ¡Subiste a Nivel ${PO.level} offline!</div>`:""}
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px">
          <span style="color:rgba(232,238,247,.7)">🏆 Rango offline</span>
          <span style="font-weight:800;color:${ro.delta>=0?"#34d399":"#f87171"}">${ro.delta>=0?"+":""}${ro.delta} pts</span>
        </div>
        <div style="font-size:11px;color:rgba(232,238,247,.55);text-align:right;margin-top:-2px;display:flex;align-items:center;justify-content:flex-end;gap:4px">${ro.beforePts} → ${ro.afterPts} · ${tierBadgeHTML(ro.afterTier,14)} ${esc(ro.afterTier.name)}</div>
      </div>
    `;
  }

  // Modo Monedas: resultado de la apuesta
  let betHTML = "";
  if(online && mr.betResult){
    const br=mr.betResult;
    const win=br.net>0, flat=br.net===0;
    betHTML = `
      <div class="a-pop" style="background:${win?"linear-gradient(180deg,rgba(52,211,153,.16),rgba(0,0,0,.2))":flat?"rgba(0,0,0,.25)":"linear-gradient(180deg,rgba(220,38,38,.18),rgba(0,0,0,.2))"};border:1px solid ${win?"rgba(52,211,153,.4)":flat?"rgba(184,150,63,.25)":"rgba(220,38,38,.4)"};border-radius:12px;padding:12px 14px;margin-bottom:14px;text-align:center">
        <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(232,238,247,.5);margin-bottom:6px">🪙 Resultado de tu apuesta</div>
        <div style="font-size:12px;color:rgba(232,238,247,.7);margin-bottom:2px">Apostaste 🪙 ${br.bet} · recibiste 🪙 ${br.payout}</div>
        <div style="font-size:16px;font-weight:800;color:${win?"#34d399":flat?"#e8eef7":"#f87171"}">${win?"+":""}${br.net} monedas</div>
      </div>
    `;
  }

  // Puntajes de la partida (siempre)
  const scoreRows = (G.online && G.scores)
    ? G.players.map(p=>({name:p.name,isHuman:p.isHuman,score:G.scores[p.id]||0})).sort((a,b)=>b.score-a.score)
    : G.players.map(p=>({name:p.name,isHuman:p.isHuman,score:G.scores[p.id]||0})).sort((a,b)=>b.score-a.score);

  const scoresHTML = `
    <div style="text-align:left;font-size:12px;background:rgba(0,0,0,.2);border-radius:10px;padding:8px 14px;margin-bottom:14px">
      <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(232,238,247,.45);margin-bottom:4px">Puntos por juegos bajados</div>
      ${scoreRows.map(r=>`<div style="display:flex;justify-content:space-between;padding:2px 0">
        <span>${esc(r.name)}</span><span>⭐ ${r.score}</span>
      </div>`).join("")}
    </div>
  `;

  // Fichas restantes en el atril al terminar — el VALOR de esas fichas (comodín=25,
  // numeradas=su número), no la cantidad. Online viene calculado por el servidor
  // (matchResult.finalHands); offline se arma acá mismo con la misma fórmula
  // (tilePoints/handPoints, línea 582-583) a partir de G.players, que todavía
  // conserva la mano de cada uno en este momento.
  const finalHandRows = online
    ? (mr.finalHands || []).map(r=>({name:r.name, tiles:r.tiles||[], points:r.points}))
    : G.players.map(p=>({name:p.name, tiles:p.hand||[], points:handPoints(p)})).filter(r=>r.tiles.length).sort((a,b)=>a.points-b.points);
  const withRemainingTiles = finalHandRows.filter(r=>r.tiles.length);
  const finalHandsHTML = withRemainingTiles.length ? `
    <div style="text-align:left;font-size:12px;background:rgba(0,0,0,.2);border-radius:10px;padding:8px 14px;margin-bottom:14px">
      <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(232,238,247,.45);margin-bottom:6px">Fichas restantes</div>
      ${withRemainingTiles.map(r=>`
        <div style="margin-bottom:6px">
          <div style="display:flex;justify-content:space-between;margin-bottom:3px">
            <span>${esc(r.name)}</span><span style="font-weight:800;color:#f87171">${r.tiles.map(t=>t.joker?25:t.number).join(" + ")} = ${r.points} pts</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:3px">${r.tiles.map(t=>tileHTML(t,"","width:22px;height:30px;font-size:11px")).join("")}</div>
        </div>
      `).join("")}
    </div>
  ` : "";

  app.innerHTML=`
  <div class="screen-center" style="padding:16px 8px">
    <div class="card ${G._enterCls}" style="text-align:center;max-height:92dvh;overflow-y:auto">
      <button class="card-x" onclick="G.matchResult=null;G.finalRanking=null;G.abandoned=false;G._handledWinnerId=null;${G.online?"leaveRoomToMenu()":"goMenu()"}" title="Cerrar">✕</button>
      ${headerHTML}
      ${betHTML}
      ${progressHTML}
      ${scoresHTML}
      ${finalHandsHTML}
      ${online&&mr.reason==="tower"
        ?`<button class="btn btn-gold" onclick="G.matchResult=null;G.finalRanking=null;G.abandoned=false;G._handledWinnerId=null;leaveRoomToTower()">🏰 Volver a la Torre</button>`
        :`<button class="btn btn-gold" onclick="G.matchResult=null;G.finalRanking=null;G.abandoned=false;G._handledWinnerId=null;${G.online?"leaveRoomToMenu()":G.rankedOffline?"goRankedOffline()":"goSorteo()"}">${G.online?"🏠 Volver al menú":"↻ Revancha"}</button>`}
      ${!G.online?`<button class="btn btn-ghost" onclick="G.matchResult=null;G.finalRanking=null;goMenu()">🏠 Menú</button>`:""}
    </div>
  </div>`;
}

function rackHTML(interactive, showAbilities){
  let cells="";
  for(let i=0;i<RACK_SLOTS;i++){
    const t=G.rack[i];
    const src=false;
    const dst=G.selHand.size>0&&!t;
    cells+=`<div class="slot ${src?"movesrc":""} ${dst?"movedst":""}" data-idx="${i}" ${interactive?`onclick="slotClick(${i})" onpointerdown="slotPointerDown(event,${i})"`:""}>
      ${t?(()=>{
        const stagger=G.dealtStagger&&G.dealtStagger[t.id];
        const dealt=stagger!==undefined;
        const marked=G.mateMarkedTileIds&&G.mateMarkedTileIds.has(t.id);
        const cls=(G.selHand.has(t.id)||src?"sel ":"")+(G.hinted.has(t.id)?"hint ":"")+(dealt?"a-deal ":"")+(marked?"marked-suggest":"");
        return tileHTML(t,cls,dealt&&stagger>0?"animation-delay:"+stagger+"ms":"");
      })():""}
    </div>`;
  }
  // Modo Galáctico: las fichas de habilidad son una fila más DENTRO del mismo
  // atril (no una caja aparte) — mismo estilo, mismo contenedor de madera.
  // Va ARRIBA de la grilla normal (no abajo): así siempre es lo primero que se
  // ve, sin depender de si el resto de la mano entra completa o no.
  const abilitiesRow=showAbilities?`<div class="rack-abilities-row">
    ${(G.myAbilityTiles&&G.myAbilityTiles.length)?G.myAbilityTiles.map(t=>{
      const active=G.abilityTip&&G.abilityTip.tileId===t.id;
      return tileBtn(t,active?"sel a-glow":"",`onclick="toggleAbilityTip('${t.id}','${t.ability}')"`);
    }).join(""):`<span class="rack-abilities-empty">Sin fichas de habilidad todavía — te van a tocar al robar del pozo.</span>`}
  </div>`:"";
  return `<div class="rack sk-${P.skin||"clasica"}">${abilitiesRow}<div class="rackgrid">${cells}</div></div>`;
}

/* Vista chica y de solo lectura del atril del compañero de equipo (2v2 online) — NO
   toca G.rack ni la lógica de arrastre/reordenado del atril propio (rackHTML), para no
   arriesgar esa UX. opts.marking habilita el tap-to-mark (ver toggleMateMark). */
function teammateRackHTML(tiles, opts){
  opts=opts||{};
  const markedIds=opts.markedIds||new Set();
  const tilesArr=tiles||[];
  return `<div class="rack rack-mini sk-${P.skin||"clasica"}"><div class="rackgrid-mini">
    ${tilesArr.map(t=>{
      const cls=markedIds.has(t.id)?"sel marked-suggest":"";
      const onAttr=opts.marking?`onclick="toggleMateMark('${t.id}')"`:"";
      return `<div class="slot-mini" ${onAttr}>${tileHTML(t,cls)}</div>`;
    }).join("")}
  </div></div>`;
}

// Badge chico e integrado (icono + número, sin card/borde alrededor) — vive
// en el HUD, no en una columna propia de la mesa (ver renderPlaying). Usa
// clases propias (.pozo-badge), NO .bag/.b/.cnt: esas las siguen usando
// renderSorteo/renderDealing/netSorteo/netDealing con su propio marcado más
// grande (la bolsa animada de esas pantallas), y no hay que tocarlas.
function bagHTML(onclickAttr){
  return `<span class="pozo-badge" ${onclickAttr||""} title="Fichas en el pozo">🀫<span class="pozo-cnt">${G.bag.length}</span></span>`;
}

function renderDealing(app){
  const initTiles=G.initTiles||14;
  const pct=Math.round(G.dealCount/initTiles*100);
  app.innerHTML=`
  <div class="screen-center" style="gap:16px">
    <h2 style="font-family:var(--font-heading);color:#ffe9a8;font-size:24px">Agarrá tus fichas de la bolsa</h2>
    <div style="width:220px;height:10px;border-radius:6px;background:rgba(0,0,0,.35);overflow:hidden">
      <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#fcd34d,#f59e0b);transition:width .3s"></div>
    </div>
    <p style="font-size:13px;color:rgba(232,238,247,.7);margin-top:-8px">${G.dealCount} / ${initTiles} fichas</p>
    <div class="bag anim-bag" onclick="dealDraw(false)" style="width:100px;height:116px;cursor:pointer">
      <div class="b" style="left:0;top:8px;width:74px;height:92px"></div>
      <div class="b" style="left:8px;top:4px;width:74px;height:92px"></div>
      <div class="b" style="left:16px;top:0;width:74px;height:92px"></div>
      <div class="cnt" style="font-size:20px">${G.bag.length}</div>
    </div>
    <p style="font-size:11px;color:rgba(232,238,247,.5);margin-top:-6px">Tocá la bolsa para sacar una ficha</p>
    <button class="btn-ghost btn-sm" style="border-radius:8px" onclick="dealDraw(true)">⚡ Sacar todas de una</button>
    <div class="sk-${P.skin||"clasica"}" style="width:100%;max-width:660px">${rackHTML(true,G.gameMode==="galactico")}</div>
    <p style="font-size:10px;color:rgba(232,238,247,.4)">Tocá fichas y una casilla vacía para acomodarlas a tu gusto.</p>
  </div>`;
}
const SEAT_ACCENTS=["rojo","azul","verde","morado","celeste","rosa","gris"];
function opponents(){ return G.players.filter(p=>!p.isHuman); }
function myId(){ const h=human(); return NET.myId||(h&&h.id); }
// Color estable por jugador real (por su ownerId, no por nombre) — así en
// partidas online con humanos de verdad cada uno se ve con su propio color,
// no todos con el dorado de "esto es mío".
function ownerAccent(ownerId){
  if(ownerId!=null&&ownerId===myId()) return "vos";
  const idx=opponents().findIndex(p=>p.id===ownerId);
  return SEAT_ACCENTS[idx>=0?idx:0]||"rojo";
}
function ownerClass(ownerId){
  return "own-"+ownerAccent(ownerId);
}
// Asiento alrededor de la mesa según cuántos oponentes hay (hasta 7, modo 8 jugadores).
function seatForOppIndex(idx,total){
  // En mobile (mismo corte que .table-felt{display:flex;flex-direction:column},
  // ver burako.css) la mesa deja de tener columnas laterales de verdad — seat-left/
  // seat-right pasan a apilarse ARRIBA y ABAJO de la mesa en vez de a los costados,
  // así que un oponente "a la derecha" terminaba flotando en un hueco raro debajo
  // de la mesa en vez de agruparse con el resto (bug visual encontrado en Ronda 5:
  // "los oponentes deben estar arriba, no comerse la mesa"). Todos a "top" acá.
  if(window.matchMedia&&(window.matchMedia("(max-width:820px)").matches||window.matchMedia("(max-height:480px)").matches)) return "top";
  if(total<=1) return "top";
  if(total===2) return idx===0?"left":"right";
  if(total===3) return idx===0?"left":idx===1?"top":"right";
  // 4+ oponentes: reparto balanceado entre las 3 zonas (arriba primero, después izq/der)
  const nTop=Math.ceil(total/3);
  const nLeft=Math.ceil((total-nTop)/2);
  if(idx<nTop) return "top";
  if(idx<nTop+nLeft) return "left";
  return "right";
}
function skinName(id){ const s=SKINS.find(x=>x.id===id); return s?s.name:"Clásica"; }
// Historial: un solo lugar persistente para todos los eventos, con ícono/color según tipo.
const HISTORY_KINDS={
  draw:{icon:"🎴",color:"#7dd3fc"},
  lay:{icon:"⬇",color:"#34d399"},
  attach:{icon:"➕",color:"#38bdf8"},
  pass:{icon:"⏭",color:"rgba(232,238,247,.5)"},
  life:{icon:"💔",color:"#f87171"},
  elim:{icon:"✖",color:"#ef4444"},
  achievement:{icon:"🏆",color:"#fbbf24"},
  ability:{icon:"🌌",color:"#c084fc"},
  system:{icon:"📣",color:"#ffe9a8"},
  error:{icon:"⚠",color:"#f87171"},
  chat:{icon:"💬",color:"#c084fc"},
};
function historyItemHTML(hh){
  const k=HISTORY_KINDS[hh.kind]||HISTORY_KINDS.system;
  return `<div class="history-item" style="border-left-color:${k.color}">
    <span class="history-icon" style="color:${k.color}">${k.icon}</span>
    <span class="history-body"><span class="history-time">${hh.time}</span>${esc(hh.text)}</span>
  </div>`;
}
function oppCardHTML(p,idx){
  const active=G.players[G.currentIdx]===p;
  const lives=p.lives!==undefined?p.lives:MAX_LIVES;
  const tier=p.rankPts!==undefined&&p.rankPts!==null?tierOf(p.rankPts):null;
  const accent=SEAT_ACCENTS[idx]||"rojo";
  const bubble=G.chatBubbles&&G.chatBubbles[p.id];
  return `<div class="opp-card acc-${accent} ${active?"active a-glow":""} ${p.eliminated?"eliminated":""}" data-pid="${p.id}">
    <div class="opp-avatar ${bannerClass(p.banner)}">${p.avatar||"🀄"}${p.eliminated?`<span class="opp-elim">✖</span>`:""}${bubble?`<span class="chat-bubble a-pop">${esc(bubble)}</span>`:""}</div>
    <div class="opp-info">
      <div class="opp-name">${nameEffectHTML(p.name,p.nameeffect)}${p.hasLaidInitial?` <span class="opp-tag">✓30</span>`:""}${p.shielded?` <span class="opp-tag" style="background:rgba(56,189,248,.25);color:#7dd3fc" title="Tiene Escudo activo — sus habilidades y su mesa están protegidas">🛡</span>`:""}${(!p.eliminated&&p.connected===false)?` <span class="opp-tag" style="background:rgba(251,191,36,.22);color:#fbbf24" title="Se le cortó la conexión — tiene un rato para volver antes de perder la partida">🔌 reconectando…</span>`:""}${G.rivalActivity&&G.rivalActivity[p.id]?" 🔧":""}</div>
      <div class="opp-meta">
        ${tier?`<span style="display:inline-flex;align-items:center;gap:2px">${tierBadgeHTML(tier,13)}${p.level?" Nv"+p.level:""}</span>`:""}
        <span title="Puntos de la partida">⭐${(G.scores&&G.scores[p.id])||0}</span>
        <span class="opp-lives" title="Vidas">${"❤".repeat(Math.max(0,lives))}${lives<MAX_LIVES?"🖤".repeat(MAX_LIVES-lives):""}</span>
        <span class="opp-handcount" title="Fichas en mano">🀫 ${p.hand.length}</span>
        <span class="opp-skin" title="Skin: ${esc(skinName(p.skin))}">🎨</span>
      </div>
    </div>
  </div>`;
}
function seatHTML(opps,seat){
  return opps.map((p,idx)=>({p,idx})).filter(({idx})=>seatForOppIndex(idx,opps.length)===seat).map(({p,idx})=>oppCardHTML(p,idx)).join("");
}
/* 2v2 en equipo: tarjeta de la compañera IA — no tiene turno propio ni rack aparte
   (sus fichas viven mezcladas en el atril compartido), así que no reusa oppCardHTML tal cual. */
function mateCardHTML(){
  const m=G.teammate; if(!m) return "";
  return `<div class="opp-card acc-celeste" style="margin:6px auto 10px;max-width:280px">
    <div class="opp-avatar">${m.avatar||"🤖"}</div>
    <div class="opp-info">
      <div class="opp-name">${esc(m.name)} <span class="opp-tag" style="background:rgba(56,189,248,.25);color:#7dd3fc">🤝 Tu compañera</span></div>
      <div class="opp-meta"><span class="opp-skin" title="Skin: ${esc(skinName(m.skin))}">🎨</span></div>
    </div>
  </div>`;
}

// Memoización por meld: renderPlaying() reconstruye TODA la mesa en cada
// render() (incluido cada "state" broadcast por la jugada de CUALQUIER
// jugador de la sala — no solo la propia), y la gran mayoría de los melds no
// cambiaron desde el render anterior. Cachear por meld.id evita rehacer
// meldInfo()/sortMeldTiles()/tileHTML() para juegos sin cambios; la clave
// incluye todo lo que meldHTML lee además de m (canOpen, candados, animación
// "fresh", y el orden de jugadores porque ownerClass depende de la posición
// del dueño en la mesa).
const _meldHtmlCache=new Map();
function meldHTML(m, canOpen, playersFingerprint){
  const hasJoker=m.tiles.some(t=>t.joker);
  const isFresh=G.freshMelds.has(m.id);
  const freshKind=isFresh?(G.freshMeldKind&&G.freshMeldKind[m.id]):"";
  const key=[m.id,canOpen,(hasJoker&&canOpen)?G.jokerBreaksLeft:"",isFresh,freshKind,m.fx||"",m.order,m.ownerId,m.ownerName||"",playersFingerprint||"",m.tiles.map(t=>t.id+(t.joker?"J":"")).join(",")].join("|");
  const cached=_meldHtmlCache.get(m.id);
  if(cached&&cached.key===key) return cached.html;
  const info=meldInfo(m.tiles);
  const shown=sortMeldTiles(m.tiles);
  const freshCls=isFresh?(freshKind==="attach"?"a-snap":"a-slam")+" fx-"+(m.fx||"clasico"):"";
  const html=`<div class="meld ${ownerClass(m.ownerId)} ${info.valid?"":"bad"} ${freshCls}" data-mid="${m.id}">
    ${m.order!=null?`<div class="badge">#${m.order}</div>`:""}
    <div class="tiles">${shown.map(t=>tileHTML(t)).join("")}</div>
    <div class="info">
      <span>${m.ownerName?`<b>${esc(m.ownerName)}</b> · `:""}${info.valid?info.type+" · "+info.value+"pts":"inválido"}</span>
      ${canOpen?(hasJoker?(G.jokerBreaksLeft>0?`<button class="openbtn" title="🔒 Candados: ${3-G.jokerBreaksLeft}/3 usados" onclick="openMeld('${m.id}')">🔓${G.jokerBreaksLeft}</button>`:`<button class="openbtn" title="🔒 Sin candados disponibles: no podés modificar este juego con comodín." onclick="setMsg('🔒 Sin candados disponibles: no podés modificar este juego con comodín.');render()">🔒</button>`):`<button class="openbtn" onclick="openMeld('${m.id}')">abrir</button>`):""}
    </div>
  </div>`;
  _meldHtmlCache.set(m.id,{key,html});
  return html;
}

function timerHTML(myTurn){
  const frac=Math.max(0,G.timeLeft)/60;
  const R=17, C=2*Math.PI*R;
  return `<div class="timerwrap">
    <svg width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="${R}" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="3.5"/>
      <circle class="timer-ring" cx="20" cy="20" r="${R}" fill="none"
        stroke="${G.timeLeft<=10&&myTurn?"#ef4444":"#fbbf24"}" stroke-width="3.5" stroke-linecap="round"
        stroke-dasharray="${C}" stroke-dashoffset="${C*(1-frac)}"
        style="transition:stroke-dashoffset 1s linear"/>
    </svg>
    <span class="num timer-num ${G.timeLeft<=10&&myTurn?"a-blink":""}">${G.timeLeft||"·"}</span>
  </div>`;
}


/* ===== Notificaciones de logros en tiempo real ===== */
let _achToastBusy = false;
function renderAchievementToasts(){
  if(_achToastBusy) return;
  const queue = G.pendingAchievements;
  if(!queue || !queue.length) return;
  _achToastBusy = true;
  const ach = queue.shift();
  const zone = document.querySelector("#achToastZone");
  if(!zone){ _achToastBusy=false; return; }
  const el = document.createElement("div");
  el.className = "ach-toast";
  el.innerHTML = `
    <div class="ach-toast-icon">🏆</div>
    <div class="ach-toast-body">
      <div class="ach-toast-title">Logro desbloqueado</div>
      <div class="ach-toast-name">${esc(ach.name)}</div>
      <div class="ach-toast-reward">${ach.coinReward?"🪙 +"+ach.coinReward+" ":""}${ach.xpReward?"⭐ +"+ach.xpReward+" XP":""}</div>
    </div>
  `;
  zone.appendChild(el);
  Sound.meld && Sound.meld();
  // El contenedor (.ach-toast) ya se anima solo por CSS (achSlideIn) — acá con
  // GSAP animamos únicamente el ÍCONO y su halo, un elemento distinto, así los
  // dos sistemas nunca compiten por la misma propiedad del mismo nodo (ver
  // docs/redesign/00-roadmap.md, lección del bug de la portada en Fase 3).
  if(window.gsap && !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)){
    const icon=el.querySelector(".ach-toast-icon");
    gsap.fromTo(icon, {scale:.3, rotate:-25}, {scale:1, rotate:0, duration:.55, delay:.15, ease:"back.out(2.4)"});
  }
  setTimeout(()=>{ el.classList.add("ach-toast-out"); }, 3200);
  setTimeout(()=>{
    el.remove();
    _achToastBusy = false;
    if(queue.length) renderAchievementToasts();
  }, 3700);
}

function renderPlaying(app){
  const cur=G.players[G.currentIdx];
  const myTurn=cur&&(cur.isHuman||cur.isTeammate);
  const h=human();
  // Quedaste eliminado (te rendiste o te quedaste sin vidas) pero la partida sigue para
  // el resto: en vez de congelarte la pantalla, seguís viendo la mesa en vivo como espectador.
  const iAmEliminated=G.online&&h&&h.eliminated;
  const opps=G.players.filter(p=>!p.isHuman&&!p.isTeammate);
  const mate=G.gameMode==="team2v2"?G.players.find(p=>p.isTeammate):null;
  const sortedTable=G.table.slice().sort((a,b)=>(a.order||0)-(b.order||0));
  const hasWork=G.workLoose.length||G.workGroups.length;
  const actionsBusy=G.online&&!!G._pendingAction;
  const playersFingerprint=G.players.map(p=>p.id).join(",");
  // Poda la caché de meldHTML: melds que ya no están en la mesa (bajados de una
  // mano anulada, fin de ronda, etc.) no deben acumularse en memoria por sesión.
  if(_meldHtmlCache.size){
    const liveIds=new Set(G.table.map(m=>m.id));
    for(const id of _meldHtmlCache.keys()) if(!liveIds.has(id)) _meldHtmlCache.delete(id);
  }

  const _playingHtml=`
  ${G.turnBanner?`<div class="turnbanner">✨ TU TURNO</div>`:""}
  ${G.bigPlayBanner?`<div class="bigplaybanner">${esc(G.bigPlayBanner)}</div>`:""}
  ${G.abilityBanner?`<div class="abilitybanner">${esc(G.abilityBanner.name.toUpperCase())} USÓ<br><span class="ab-emoji">${G.abilityBanner.meta.emoji}</span> ${esc(G.abilityBanner.meta.label.toUpperCase())}</div>`:""}
  ${G.teamWarnBanner?`<div class="teamwarnbanner">⏳ ${G.teamWarnBanner}</div>`:""}
  ${G.teamProposal?`<div class="teampropcard">
    <div class="teampropcard-title">🤝 ${G.teamProposal.byId===NET.myId?"Esperando confirmación de tu compañero/a…":esc(G.teamProposal.byName)+" propone:"}</div>
    <div class="teampropcard-desc">${G.teamProposal.type==="draw"?"🎴 Tomar ficha y pasar el turno":"⬇ Bajar esta jugada y pasar el turno"}</div>
    ${G.teamProposal.byId===NET.myId
      ?`<button class="btn-sm" style="width:100%;background:rgba(220,38,38,.6);color:#fff;border-radius:8px;margin-top:8px" onclick="netSend({type:'teamRespond',agree:false})">✖ Cancelar</button>`
      :`<div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn-sm" style="flex:1;background:linear-gradient(180deg,#34d399,#059669);color:#fff;border-radius:8px" onclick="netSend({type:'teamRespond',agree:true})">✔ Sí</button>
          <button class="btn-sm" style="flex:1;background:rgba(220,38,38,.6);color:#fff;border-radius:8px" onclick="netSend({type:'teamRespond',agree:false})">✖ No</button>
        </div>`}
  </div>`:""}
  ${G.paused?`<div class="pauseovl" onclick="if(event.target===this)togglePause(false)">
    <div class="pausecard ${G._pauseEnterCls}">
      <h2 style="font-family:var(--font-heading);color:#ffe9a8;font-size:22px;text-align:center;margin-bottom:16px">⏸ Pausa</h2>
      <button class="btn btn-gold" onclick="togglePause(false)">▶ Continuar</button>
      <div class="audio-block" style="margin-top:12px;padding:9px 10px">
        <div class="lbl" style="margin-top:0;font-size:10.5px">🔊 Efectos</div>
        <div class="seg" style="margin-bottom:0">
          <button class="${Sound.on?"on":""}" onclick="Sound.on=true;Sound.init();Sound.turn();render()">🔊 Sí</button>
          <button class="${!Sound.on?"on":""}" onclick="Sound.on=false;render()">🔇 No</button>
        </div>
        <input type="range" min="0" max="100" value="${Math.round(Sound.volume*100)}" oninput="Sound.volume=this.value/100" onchange="Sound.select()" style="width:100%;margin:6px 0 0" ${Sound.on?"":"disabled"}>
      </div>
      <div class="audio-block" style="padding:9px 10px">
        <div class="lbl" style="margin-top:0;font-size:10.5px">🎵 Música</div>
        <div class="seg" style="margin-bottom:0">
          <button class="${Music.on?"on":""}" onclick="if(!Music.on)Music.toggle();render()">🎵 Sí</button>
          <button class="${!Music.on?"on":""}" onclick="if(Music.on)Music.toggle();render()">🔇 No</button>
        </div>
        <input type="range" min="0" max="100" value="${Math.round(Music.volume*100)}" oninput="Music.setVolume(this.value/100)" style="width:100%;margin:6px 0 0" ${Music.on?"":"disabled"}>
      </div>
      ${!iAmEliminated?`<button class="btn btn-ghost" style="color:#f87171;border-color:rgba(248,113,113,.35)"
        onclick="openSurrenderConfirm()">🏳 Rendirse</button>`:""}
      ${(!G.ranked&&!G.rankedOffline)?`<button class="btn btn-ghost" onclick="${G.online?"leaveRoomToMenu()":"goMenu()"}">🏠 Salir al menú</button>`:""}
    </div>
  </div>`:""}
  ${G.surrenderConfirmOpen?surrenderConfirmModalHTML():""}
  ${G.consensus?renderConsensusModal():""}
  ${G.abilityModal?abilityModalHTML():""}

  <!-- Modo "Ver mesa" (⛶): vista ampliada/focus de la mesa, pedida por el usuario para
       poder inspeccionar todos los juegos con números grandes y claros sin tener que
       hacer zoom del navegador — reusa meldHTML/tileHTML tal cual (mismos skins, mismo
       estado en vivo) así que cualquier cambio en G.table se refleja acá solo, sin
       lógica de render aparte. La mesa acá NO lleva la inclinación 3D de la vista normal
       (.tableview-mesa .meld) — precisamente lo que se pedía mejorar ("ver los números
       claramente"). El pan-scroll con mouse (.mesa) y "abrir candado" (openMeld, vía
       meldHTML canOpen) funcionan igual acá porque están cableados por clase/selector,
       no por instancia. -->
  ${G.tableViewOpen?`<div class="tableview-backdrop" onclick="if(event.target===this)closeTableView()">
    <div class="tableview-panel board ${G.gameMode==="galactico"?"tp-galactico":"tp-"+((G.online&&G.serverTapete)||P.tapete||"clasico")}">
      <div class="tableview-head">
        <div class="mesa-label" style="margin:0">${G.gameMode==="galactico"?"🌌 Mesa":"Mesa"} · ${sortedTable.length} juego${sortedTable.length===1?"":"s"}</div>
        <button class="tableview-close" onclick="closeTableView()" title="Cerrar (Esc)">✕ Cerrar</button>
      </div>
      <div class="mesa tableview-mesa" data-preserve-scroll="tableview-mesa">
        <div class="mesa-inner">
          ${sortedTable.length?sortedTable.map(m=>meldHTML(m,myTurn&&h&&h.hasLaidInitial,playersFingerprint)).join(""):`<span class="mesa-empty">Todavía no hay juegos en la mesa.</span>`}
        </div>
      </div>
    </div>
  </div>`:""}

  <!-- Notificaciones de logros en vivo -->
  <div id="achToastZone" class="ach-toast-zone" data-morph-keep="1"></div>

  <div class="hud">
    <span class="title" onclick="togglePause(true)">☰ ${G.online&&NET.roomCode?"Sala "+NET.roomCode:"Burako"}</span>
    <div class="right">
      <button class="hist-toggle-btn ${G.historyPanelClosed?"":"on"}" onclick="toggleHistoryDrawer()" title="${G.historyPanelClosed?"Mostrar historial":"Ocultar historial"}">📜</button>
      ${(G.online&&G.gameMode!=="team2v2")?`<button id="chatToggleBtn" class="chat-toggle-btn" onclick="toggleChat()" title="Chat">💬 Chat<span id="chatBadge" class="chat-badge" style="${G.chatUnread?"":"display:none"}"> · ${G.chatUnread||0}</span></button>`:""}
      ${bagHTML()}
      <span id="matchclock" title="Tiempo restante de partida" class="hud-matchclock" style="${G.matchEndsAt?"":"display:none"}">${matchClockText()||""}</span>
      ${G.ranked?`<span style="font-size:11px;color:#ffe9a8">🏆 ${G.players.length}J</span>`:G.rankedOffline?`<span class="hud-ranked-badge" style="font-size:11px;color:#ffe9a8" title="Ranked Offline">🏆 Ranked</span>`:""}
      ${iAmEliminated?`<span style="font-size:12px;color:#c084fc;font-weight:800">👻 Espectando</span><span class="thinking">${esc(cur?cur.name:"")+" piensa"}</span>`:`
      <span title="${(G.teamMode||G.gameMode==="team2v2")?"Vidas del equipo":"Vidas restantes"}" class="hud-lives">${"❤".repeat(Math.max(0,G.lives))}${"🖤".repeat(Math.max(0,MAX_LIVES-G.lives))}</span>
      <span title="${G.teamMode?"Puntos del equipo":"Tus puntos"}" style="font-size:12px;color:#ffe9a8;font-weight:800">⭐${G.scores[h?h.id:""]||0}</span>
      <span style="${myTurn?"color:#ffe9a8;font-weight:800":""}" class="${!myTurn?"thinking":""}">${myTurn?(cur.isTeammate?"🤝 Turno de tu equipo":"Tu turno"):esc(cur?cur.name:"")+" piensa"}</span>
      ${timerHTML(myTurn)}`}
    </div>
  </div>
  ${G.message?`<div class="toast" key="${esc(G.message)}">${esc(G.message)}</div>`:""}

  <!-- ===== Mesa real: oponentes sentados alrededor, mesa en el medio ===== -->
  <div class="table-felt ${G.gameMode==="galactico"?"galactico-felt":""}">
    ${G.gameMode==="galactico"?`<div class="galactico-stars"></div>`:""}
    <div class="seat seat-top">${G.teamMode?mateCardHTML():""}${seatHTML(opps,"top")}</div>
    <div class="seat seat-left">${seatHTML(opps,"left")}</div>
    <div class="board ${G.gameMode==="galactico"?"tp-galactico":"tp-"+((G.online&&G.serverTapete)||P.tapete||"clasico")}">
      <div class="mesa3d" style="flex:1">
        <div class="mesa" data-preserve-scroll="mesa">
          <div class="mesa-label">${G.gameMode==="galactico"?"🌌 Mesa":"Mesa"}</div>
          <div class="mesa-inner">
            ${sortedTable.length?sortedTable.map(m=>meldHTML(m,myTurn&&h&&h.hasLaidInitial,playersFingerprint)).join(""):`<span class="mesa-empty">Arrastrá un juego acá para bajarlo.<br><small>El primero necesita 30+ puntos.</small></span>`}
          </div>
        </div>
        ${sortedTable.length?`<button class="tableview-btn" onclick="openTableView()" title="Ver mesa ampliada">⛶</button>`:""}
      </div>
    </div>
    <div class="seat seat-right">${seatHTML(opps,"right")}</div>
  </div>

  <!-- ===== Fila inferior: Historial | Preparación | Atril | Pozo ===== -->
  <div class="bottomzone">
    ${iAmEliminated?`
    <div class="spectator-banner">👻 Quedaste afuera de esta partida — la seguís viendo en vivo hasta que termine.</div>
    `:`
    <div class="actions ${myTurn?"":"actions-disabled"}">
      ${hasWork
        ?`<button class="act-ok act-confirm ${actionsBusy?"is-pending":""}" onclick="confirmTurn()" ${(myTurn&&!actionsBusy)?"":"disabled"} title="Confirma todo lo armado en Preparación y pasa tu turno">${actionsBusy?"⏳ Confirmando…":"✔ Bajar todo"}</button>`
        :`<button class="act-ok ${actionsBusy?"is-pending":""}" onclick="layFromRack()" ${(myTurn&&!actionsBusy&&G.selHand.size>=3)?"":"disabled"} title="Baja este juego y pasa tu turno">${actionsBusy?"⏳ Confirmando…":"⬇ Bajar y pasar ("+G.selHand.size+")"}</button>`}
      <button class="act-work" onclick="sendToWork()" ${(myTurn&&!actionsBusy&&G.selHand.size)?"":"disabled"} title="Enviá acá para bajar VARIOS juegos en el mismo turno">➜ Preparación</button>
      <button class="act-draw ${actionsBusy?"is-pending":""}" onclick="drawAndPass()" ${(myTurn&&!actionsBusy)?"":"disabled"}>${actionsBusy?"⏳ Confirmando…":"🎴 Ficha y pasar"}</button>
    </div>`}

    <div class="bottomrow">
      <!-- Historial (offline y online) + chat rápido (solo online — el chat rápido
           general no aplica en 2v2: la coordinación de equipo tiene su propio chat
           en .col-teammate) -->
      ${(()=>{
        const isTeam2v2=G.gameMode==="team2v2";
        return `<div class="hist-drawer-backdrop ${G.historyDrawerOpen?"open":""}" onclick="if(event.target===this)toggleHistoryDrawer()"></div>
        <div class="col-history ${G.historyDrawerOpen?"drawer-open":""} ${G.historyPanelClosed?"panel-closed":""}"${isTeam2v2?` style="flex:0 0 150px"`:""}>
        <button class="hist-drawer-close" onclick="toggleHistoryDrawer()" title="Cerrar">✕</button>
        <div class="ptitle">📜 Historial</div>
        <div class="history-list" data-preserve-scroll="history">
          ${(G.history&&G.history.length)?G.history.slice().reverse().map(historyItemHTML).join(""):`<span class="history-empty">Sin jugadas todavía.</span>`}
        </div>
      </div>`;
      })()}

      ${(G.gameMode==="team2v2"&&mate)?`
      <div class="col-teammate">
        <div class="teammate-head">
          <span style="font-size:16px">${mate.avatar||"🤖"}</span>
          <span style="font-size:10.5px;font-weight:800;color:#7dd3fc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${nameEffectHTML(mate.name,mate.nameeffect)}</span>
          ${G.teamChatBubble?`<span class="teammate-chat-bubble a-pop">${esc(G.teamChatBubble)}</span>`:""}
        </div>
        <div class="ptitle" style="margin-bottom:2px">Atril — tocá para marcarle una jugada (${(G.teammateHand||[]).length})</div>
        <div class="teammate-rack-wrap">${teammateRackHTML(G.teammateHand,{marking:true,markedIds:G.myMarksOnMate||new Set()})}</div>
        ${(G.myMarksOnMate&&G.myMarksOnMate.size)?`<button class="btn-sm" style="width:100%;border-radius:7px;background:rgba(251,191,36,.2);color:#ffe9a8;font-size:9.5px;margin-top:3px" onclick="G.myMarksOnMate.clear();netSend({type:'markTiles',tileIds:[]});render()">✖ Borrar marca (${G.myMarksOnMate.size})</button>`:""}
        <button class="btn-sm" style="width:100%;border-radius:7px;background:rgba(220,38,38,.35);color:#fecaca;font-size:9.5px;margin-top:4px" onclick="doNudgeCancel()">🚫 Pedile que cancele</button>
        ${(()=>{
          const left=Math.max(0,QUICK_CHAT_COOLDOWN_MS-(Date.now()-(G._lastTeamChatSentAt||0)));
          const secsLeft=Math.ceil(left/1000);
          return `<div class="teammate-chat-label">💬 chat de equipo${secsLeft>0?" · "+secsLeft+"s":""}</div>
          <div class="teammate-chat-grid">
            ${TEAM_CHAT_OPTIONS.map(o=>`<button ${secsLeft>0?"disabled":""} onclick="doTeamChat('${o.send.replace(/'/g,"\\'")}')" title="${esc(o.send)}">${esc(o.show)}</button>`).join("")}
          </div>`;
        })()}
      </div>
      `:""}

      ${iAmEliminated?`
      <!-- Espectador -->
      <div class="col-prep sk-${P.skin||"clasica"}">
        <div class="ptitle">🏆 Puntajes en vivo</div>
        <div class="spectator-scores">
          ${G.players.slice().sort((a,b)=>(G.scores[b.id]||0)-(G.scores[a.id]||0)).map(p=>`
            <div class="spectator-score-row ${p.eliminated?"out":""} ${G.players[G.currentIdx]===p?"turn":""}">
              <span>${p.avatar||"🀄"} ${nameEffectHTML(p.name,p.nameeffect)}${p.eliminated?" 👻":""}</span>
              <span>⭐ ${G.scores[p.id]||0}</span>
            </div>
          `).join("")}
        </div>
      </div>
      <div class="col-rack">
        <div class="spectator-exit">
          <p style="font-size:12px;color:rgba(232,238,247,.6);text-align:center;margin-bottom:10px">Podés esperar a que termine la partida, o salir cuando quieras.</p>
          <button class="btn btn-ghost" onclick="leaveRoomToMenu()">🏠 Salir de la sala</button>
        </div>
      </div>
      `:`
      <!-- Preparación -->
      <div class="col-prep sk-${P.skin||"clasica"}" data-preserve-scroll="prep">
        <div class="ptitle">🛠 Preparación</div>
        ${myTurn?`
          <div class="prep-toolbar">
            <button class="btn-sm" style="background:linear-gradient(180deg,#34d399,#059669);color:#fff;border-radius:7px;font-size:10px" onclick="formGroup()">Agrupar (${G.selWork.size})</button>
            <button class="btn-sm" style="background:rgba(220,38,38,.7);color:#fff;border-radius:7px;font-size:10px" onclick="fullCancel(true)">✖ Vaciar</button>
          </div>
          <div class="prep-loose" data-preserve-scroll="prep-loose">
            ${G.workLoose.slice().sort((a,b)=>(a.joker?99:a.number)-(b.joker?99:b.number)).map(t=>tileBtn(t,(G.selWork.has(t.id)?"sel":"")+" ", `onclick="workTileClick('${t.id}')" onpointerdown="prepTilePointerDown(event,'${t.id}')"`)).join("")||`<span class="prep-hint">Fichas sueltas van acá. Seleccioná y tocá "Agrupar" (o arrastrá desde el atril).</span>`}
          </div>
          <div class="prep-groups" data-preserve-scroll="prep-groups">
            ${G.workGroups.map(g=>{
              const info=meldInfo(g.tiles);
              return `<div class="prep-group-row" data-gid="${g.id}">
                <div class="meld ${info.valid?"":"bad"}">
                  <div class="tiles">${sortMeldTiles(g.tiles).map(t=>tileBtn(t,(G.selWork.has(t.id)?"sel":""),`onclick="workTileClick('${t.id}')" onpointerdown="prepTilePointerDown(event,'${t.id}')"`)).join("")}</div>
                  <div class="info"><span>${info.valid?info.value+"pts":"inválido"}</span></div>
                </div>
                <div class="wg-actions">
                  <button style="background:rgba(14,165,233,.7)" onclick="addSelToGroup('${g.id}')" title="Agregar seleccionadas">+sel</button>
                  <button style="background:rgba(120,120,120,.6)" onclick="dissolveGroup('${g.id}')" title="Deshacer">↩</button>
                </div>
              </div>`;
            }).join("")}
          </div>
        `:`<span class="prep-hint prep-hint-center">Zona para armar varios juegos a la vez</span>`}
      </div>

      <!-- Atril -->
      <div class="col-rack">
        <div class="rackhead">
          <span class="t" style="padding-left:10px">${G.teamMode?"Atril del equipo":"Tu atril"} (${handTiles().length})${h&&h.hasLaidInitial?" · saliste ✓":" · salí con 30"}${G.online&&G.scores?" · <b style=\"color:#ffe9a8\">"+(G.scores[h?h.id:NET.myId]||0)+" pts</b>":""}</span>
          <div class="modes">
            ${(G.gameMode==="galactico"&&!iAmEliminated)?`
              ${h&&h.shielded?`<span class="ab-badge ab-badge-shield" title="Escudo activo">🛡</span>`:""}
              ${G.myBlocked?`<span class="ab-badge ab-badge-blocked" title="No podés usar habilidades este turno">🚫</span>`:""}
              ${G.myAbilityUsed?`<span class="ab-badge ab-badge-used" title="Ya usaste una habilidad este turno">✓</span>`:""}
            `:""}
            <span class="hud-lives-sm" title="${(G.teamMode||G.gameMode==="team2v2")?"Vidas del equipo":"Vidas"}">${"❤".repeat(Math.max(0,G.lives))}</span>
            <button onclick="sortRack('color')" title="Ordenar por color" style="background:rgba(255,255,255,.1);color:#e8eef7">🎨</button>
            <button onclick="sortRack('numero')" title="Ordenar por número" style="background:rgba(255,255,255,.1);color:#e8eef7">🔢</button>
            ${myTurn?`<button onclick="suggestPlays()" style="background:linear-gradient(180deg,#38bdf8,#0369a1);color:#fff" ${G.hintsLeft?"":"disabled"}>💡 ${G.hintsLeft}</button>`:""}
            <div class="timer-inline">${timerHTML(myTurn)}</div>
          </div>
        </div>
        <div class="rackpersp">${rackHTML(true,G.gameMode==="galactico"&&!iAmEliminated)}</div>
        ${(G.gameMode==="galactico"&&!iAmEliminated&&G.abilityTip)?(()=>{
          const meta=ABILITY_META[G.abilityTip.ability]||{emoji:"✨",label:G.abilityTip.ability,color:"#a855f7",desc:""};
          const usable=myTurn&&!G.myAbilityUsed&&!G.myBlocked;
          const rgb=hexToRgb(meta.color);
          return `<div class="ability-tip-backdrop" onclick="if(event.target===this)closeAbilityTip()">
            <div class="ability-tip a-pop" style="--fx-rgb:${rgb}">
              <div class="ability-tip-head"><span class="ability-tip-emoji">${meta.emoji}</span><b>${esc(meta.label)}</b></div>
              <p>${esc(meta.desc)}</p>
              <div class="ability-tip-actions">
                <button class="btn-sm ability-tip-cancel" onclick="closeAbilityTip()">✖ Cerrar</button>
                <button class="btn-sm ability-tip-use" ${usable?`onclick="confirmAbilityTipUse()"`:"disabled"}>${usable?"⚡ Usar":(!myTurn?"No es tu turno":G.myBlocked?"Bloqueada":"Ya usaste una")}</button>
              </div>
            </div>
          </div>`;
        })():""}
        <div class="rackhint">${myTurn?"Bajar 1 juego pasa tu turno · para bajar VARIOS usá Preparación · 🎨/🔢 ordenan tu atril":"Esperando a "+esc(cur?cur.name:"")+"… acomodá tu atril mientras"}</div>
        ${G.reserve.length?`<div class="reserve-strip">
          <span class="reserve-label">Reserva (${G.reserve.length})</span>
          <div class="reserve-tiles">
            ${G.reserve.map(t=>tileBtn(t,(G.selHand.has(t.id)?"sel":"")+(G.hinted.has(t.id)?"hint ":""),`onclick="slotReserveClick('${t.id}')"`)).join("")}
          </div>
          <button class="btn-sm" style="background:rgba(255,255,255,.12);color:#e8eef7;border-radius:7px" onclick="reserveToRack()">⤴ Al atril</button>
        </div>`:""}
      </div>
      `}
    </div>
  </div>${chatPanelHTML()}`;
  morph(app,_playingHtml);

  renderAchievementToasts();

  // Disparar el efecto encolado (si hay) ahora que el juego recién bajado ya existe en el DOM.
  if(G._pendingFx){
    const _fx=G._pendingFx; G._pendingFx=null;
    const _el=document.querySelector('.meld[data-mid="'+_fx.id+'"]');
    if(_el){
      triggerMeldFx(_el, _fx.fx);
      const _meld=G.table.find(m=>m.id===_fx.id);
      if(G._flightSrc && Object.keys(G._flightSrc).length){
        // La jugada la iniciamos nosotros (ver captureFlightSources): ya tenemos la
        // posición real de cada ficha en nuestro propio atril.
        runMeldFlight(_el, G._flightSrc, (_meld&&_meld.trail)||P.trail||"clasica");
        G._flightSrc={};
      } else if(_meld && _meld.ownerId && _meld.ownerId!==myId()){
        // Jugada de otro jugador real (sala online): volamos desde SU tarjeta en
        // pantalla, con la estela que esa persona tiene equipada — así todos ven
        // de dónde salió, no solo quien la bajó.
        runMeldFlightFromOrigin(_el, _meld.ownerId, _meld.trail||"clasica");
      }
    }
  }
}



/* ================================================================
   MULTIJUGADOR ONLINE (LAN / red local)
   Usa las MISMAS funciones de render, atril, rack, skins, etc.
   Cuando G.online es true, las acciones se envían al servidor
   en vez de ejecutarse localmente.
   ================================================================ */
let NET={ws:null, myId:null, roomCode:null};

/* ---------------- Sesión persistente por token ----------------
   Reemplaza "guardar la contraseña y reenviarla" (lo que hacía este archivo
   hasta ahora vía burako_lan_pass) por un token de sesión — el refresh token
   que ya emite Supabase Auth al loguear (ver server/db.js resumeSession) —
   que el cliente guarda y usa para restaurar identidad sin volver a pedir
   contraseña. La contraseña queda SOLO para el login/registro inicial. */
const SESSION_TOKEN_KEY="burako_session_token";
function getSessionToken(){ try{ return localStorage.getItem(SESSION_TOKEN_KEY); }catch(e){ return null; } }
function saveSessionToken(tok){ try{ if(tok) localStorage.setItem(SESSION_TOKEN_KEY, tok); }catch(e){} }
function clearSessionToken(){ try{ localStorage.removeItem(SESSION_TOKEN_KEY); }catch(e){} }
// Instalaciones de antes de este cambio pueden tener la contraseña guardada
// en texto plano — se borra en cuanto haya un login/resume exitoso con token.
function migrateAwayFromStoredPassword(){ try{ localStorage.removeItem("burako_lan_pass"); }catch(e){} }

/* ================================================================
   SESSION MANAGER (Fase 2 — docs/ai/AUDIT-SESSION-ARCHITECTURE.md /
   docs/ai/FROM-CLAUDE.md). Única fuente de verdad de "¿el usuario está
   autenticado?", separada A PROPÓSITO de dos conceptos que antes vivían
   confundidos en la misma variable (G.online):

   - CONEXIÓN DE RED: sigue siendo NET.ws/NET.ws.readyState — el único lugar
     correcto para preguntar "¿hay un socket abierto ahora mismo?". Session
     NO reemplaza esos chequeos, y ninguno de los que ya existían se tocó.
   - SESIÓN DE JUEGO: G.online sigue significando exactamente lo mismo que
     antes en todo el código de partida (¿la partida actual es online u
     offline? — goSorteo()/interceptores de lay-draw-attach-confirm/HUD de
     juego/etc.), sin cambios. Esa lectura de G.online es legítima y no es
     un chequeo de autenticación disfrazado.

   Lo que SÍ cambia: los lugares donde G.online se usaba como PROXY de "estoy
   logueado" (Perfil, Tienda, Ruleta, Torre, Pase Galáctico, logout, la
   reconexión de segundo plano) ahora preguntan acá — ver auditoría §7 para
   el listado completo de dónde se duplicaba el concepto de sesión antes de
   este fix.

   Estados:
     "unauthenticated" — sin sesión válida (nunca logueado, logout explícito,
                          o un resumeSession que falló sin haber estado ya
                          autenticado antes en esta carga de página).
     "restoring"        — restaurando una sesión guardada, todavía sin
                          confirmar por el servidor. Solo se ve la PRIMERA
                          vez que esta carga de página intenta reconocer un
                          token guardado (arranque en frío) — es justamente
                          el estado explícito que pedía la Fase 2 en vez de
                          "fingir que ya está autenticado" mientras se espera
                          la confirmación real.
     "authenticated"    — el servidor confirmó la identidad.
     "expired"          — el servidor RECHAZÓ explícitamente el token
                          (resumeSession → sessionExpired). Es la única
                          transición real de "la sesión ya no vale", y la
                          única que borra el token guardado.

   Regla central: una caída de NET.ws (wifi, background, Render/Fly
   reiniciando) NUNCA mueve Session fuera de "authenticated" por sí sola. Si
   ya estábamos autenticados y una reconexión en segundo plano vuelve a
   confirmar la sesión, Session sigue "authenticated" en silencio durante
   todo el proceso — "restoring" no reaparece a mitad de sesión ni parpadea
   la UI en cada reconexión; solo existe antes de la PRIMERA confirmación.
   Ver resumeSessionSilently() más abajo, que es el único lugar que mueve
   este estado. */
const Session=(function(){
  let state="unauthenticated";
  return {
    state(){ return state; },
    isAuthenticated(){ return state==="authenticated"; },
    isRestoring(){ return state==="restoring"; },
    isExpired(){ return state==="expired"; },
    isUnauthenticated(){ return state==="unauthenticated"; },
    setAuthenticated(){ state="authenticated"; },
    setRestoring(){ state="restoring"; },
    setExpired(){ state="expired"; },
    setUnauthenticated(){ state="unauthenticated"; },
  };
})();

/* ================================================================
   CONNECTION MANAGER (Fase 3 — docs/ai/AUDIT-SESSION-ARCHITECTURE.md /
   docs/ai/FROM-CLAUDE.md). Única autoridad del lado cliente para el estado
   de la conexión WebSocket — unifica lo que antes eran 3 caminos separados
   (ensureConnected(), resumeReconnect()/attemptMatchReconnect(), y un
   onclose que fuera de partida no hacía nada) detrás de un solo punto de
   entrada idempotente: resumeSessionSilently() sigue siendo quien abre el
   socket Y reautentica, pero ahora TODOS los callers pasan por su mismo
   mutex (antes solo lo usaban algunos — ensureConnected() se salteaba la
   reautenticación por completo, hallazgo #4/#7 de la auditoría).

   Estados: "disconnected" | "connecting" | "connected" | "reconnecting".
   "connecting" = primer intento de conexión de esta carga de página.
   "reconnecting" = ya hubo una sesión autenticada antes y se está tratando
   de recuperar (mismo criterio que "restoring" en Session — no es
   casualidad, ver connectWithRetry()/resumeSessionSilently() más abajo).

   Regla central, pedida explícitamente: el estado de Connection NUNCA toca
   Session por sí solo. Ni abrir, ni cerrar, ni reintentar una conexión
   cambia si el usuario está autenticado — SOLO una respuesta explícita del
   servidor (sessionExpired, adentro de resumeSessionSilently) mueve a
   Session. Una caída de transporte es, para Session, indistinguible de
   "todavía no se confirmó de nuevo".

   Reconexión automática fuera de partida: antes, un close fuera de una
   partida activa no hacía nada — el socket quedaba muerto hasta que algo
   más (tocar un botón, volver de segundo plano) lo notara. Ahora, si había
   sesión (autenticada o restaurándose) cuando el socket cae, se programa un
   reintento con backoff creciente (1s, 3s, 8s, 15s, tope 30s — nunca un
   loop agresivo) usando UN solo timer (scheduleReconnect protege contra
   duplicarlo). Adentro de una partida activa, attemptMatchReconnect() sigue
   siendo el camino especializado (ventana de gracia de 25s del servidor,
   reintentos rápidos) — no se tocó su lógica de juego. */
const Connection=(function(){
  let state="disconnected";
  let reconnectTimer=null;
  let reconnectAttempt=0;
  let heartbeatTimer=null;
  let pongTimeoutTimer=null;

  function clearHeartbeat(){
    clearInterval(heartbeatTimer); heartbeatTimer=null;
    clearTimeout(pongTimeoutTimer); pongTimeoutTimer=null;
  }
  function cancelScheduledReconnect(){
    clearTimeout(reconnectTimer); reconnectTimer=null;
  }

  return {
    state(){ return state; },
    isConnected(){ return state==="connected"; },
    // [Fase 5 — bug real encontrado en el soak test] "connected" es la
    // confirmación de que estamos bien, sin importar qué camino nos trajo
    // hasta acá (el backoff propio de scheduleReconnect, o un resumeReconnect/
    // attemptMatchReconnect manual que canceló ese timer y reconectó por su
    // cuenta). Antes, reconnectAttempt SOLO se reseteaba dentro del propio
    // callback de scheduleReconnect — si un reconecte manual tenía éxito
    // mientras ya había un intento de fondo contado, ese conteo quedaba
    // pegado, y la PRÓXIMA vez que scheduleReconnect necesitara reintentar
    // arrancaba con un backoff más largo del que correspondía (reintentos
    // rápidos y repetidos podían terminar tardando mucho más de lo esperado).
    _set(s){ state=s; if(s==="connected") reconnectAttempt=0; },
    cancelScheduledReconnect,
    // Apagado completo y deliberado (solo logout real) — a diferencia de
    // onClosed() (que deja la puerta abierta a reconectar solo), acá cortamos
    // también cualquier reintento programado: no tiene sentido seguir
    // reconectando de fondo justo después de que el usuario se deslogueó.
    disconnect(){ cancelScheduledReconnect(); clearHeartbeat(); state="disconnected"; },

    // Heartbeat real: manda ping cada 20s Y ahora además espera un pong
    // dentro de 10s (antes el cliente mandaba el ping pero nunca comprobaba
    // que llegara respuesta — hallazgo #10 de la auditoría: un socket "medio
    // muerto", TCP half-open, común en redes móviles, podía quedar
    // reportando readyState===1 para siempre sin que nada lo notara). Si el
    // pong no llega a tiempo, se cierra el socket a mano — eso dispara el
    // mismo ws.onclose de siempre, así que la reconexión sigue el único
    // camino normal en vez de uno paralelo.
    startHeartbeat(ws){
      clearHeartbeat();
      heartbeatTimer=setInterval(()=>{
        if(!NET.ws||NET.ws!==ws||NET.ws.readyState!==1) return;
        try{ NET.ws.send(JSON.stringify({type:"ping"})); }catch(e){ return; }
        clearTimeout(pongTimeoutTimer);
        pongTimeoutTimer=setTimeout(()=>{
          if(NET.ws!==ws) return; // ya se reemplazó este socket, no corresponde
          try{ ws.close(); }catch(e){}
        },10000);
      },20000);
    },
    notePong(){ clearTimeout(pongTimeoutTimer); pongTimeoutTimer=null; },

    // Se llama SIEMPRE que un socket termina (onclose), sin importar el
    // motivo — deja todo en un estado limpio antes de que quien llamó
    // decida si corresponde reintentar (partida activa, sesión guardada, o
    // nada que reconectar).
    onClosed(){
      clearHeartbeat();
      state="disconnected";
    },

    // Reconexión automática con backoff, fuera de partida, cuando había
    // sesión al momento de la caída. Idempotente: si ya hay un reintento
    // programado, no se agrega un segundo timer.
    scheduleReconnect(){
      if(reconnectTimer) return;
      const BACKOFF_MS=[1000,3000,8000,15000,30000];
      const delay=BACKOFF_MS[Math.min(reconnectAttempt,BACKOFF_MS.length-1)];
      state="reconnecting";
      reconnectTimer=setTimeout(async()=>{
        reconnectTimer=null;
        reconnectAttempt++;
        // [Fase 5 — bug real encontrado en la validación end-to-end] Si había
        // una sala guardada (lobby o partida), reautenticar la sesión SIN
        // también mandar "rejoin" dejaba al cliente creyendo que seguía en
        // la sala (G.screen/NET.roomCode intactos, Session/Connection
        // "authenticated"/"connected") mientras el servidor no tenía room ni
        // player para el socket nuevo — cualquier acción de sala se perdía
        // en silencio, sin ningún error visible. Mismo patrón que ya usa
        // goIntroEnter() en el arranque en frío con sala activa.
        const activeRoom=readActiveRoom();
        const ok=activeRoom ? await tryAutoReconnect(activeRoom) : (await resumeSessionSilently()).ok;
        if(ok){ reconnectAttempt=0; render(); }
        else if(Session.isExpired()){ reconnectAttempt=0; } // Session ya quedó "expired" — no tiene sentido seguir reintentando a ciegas
        else { this.scheduleReconnect(); } // sigue con backoff creciente, sin tope de intentos (solo tope de demora) — no es un loop agresivo
      },delay);
    },
  };
})();

/* Único punto de entrada para "restaurar sesión con el token guardado".
   Reemplaza los candados sueltos que existían antes por conexión llamadora
   (uno en tryAutoReconnect, otro en resumeReconnect) por un solo mutex
   compartido: el refresh token es de un solo uso, así que si dos intentos
   de resume se dispararan casi a la vez (p. ej. volver de background justo
   cuando también se estaba reintentando una reconexión de partida) el
   segundo pisaría el token que el primero ya rotó, y se vería como una
   sesión vencida que en realidad no lo es. Con el mutex, el segundo
   llamador simplemente espera el resultado del primero.
   connectOpts se reenvía tal cual a connectWithRetry (p. ej. para usar el
   backoff corto de attemptMatchReconnect en vez del paciente de arranque
   en frío). Devuelve {ok:true, profile} o {ok:false, reason}. */
function resumeSessionSilently({onStatus, connectOpts}={}){
  if(G._sessionOpInFlight) return G._sessionOpInFlight;
  const token=getSessionToken();
  if(!token) return Promise.resolve({ok:false, reason:"no-token"});
  // Si YA estábamos autenticados (esto es una re-validación en segundo plano
  // — volver de background, reconectar tras una partida, etc.) seguimos
  // "authenticated" en silencio todo el proceso: no hay ninguna razón para
  // que la UI parpadee a "restoring" en cada reconexión de rutina. Solo la
  // PRIMERA confirmación de esta carga de página (arranque en frío) pasa
  // visiblemente por "restoring" — ver el comentario del Session Manager.
  const wasAlreadyAuthenticated=Session.isAuthenticated();
  if(!wasAlreadyAuthenticated) Session.setRestoring();
  const op=(async()=>{
    if(!NET.ws||NET.ws.readyState!==1){
      // reconnecting:wasAlreadyAuthenticated — mismo criterio que Session:
      // si ya había sesión confirmada, esto es Connection "reconnecting"; si
      // no, es la primera conexión de la página ("connecting"). Ver
      // connectWithRetry() más abajo, que es quien realmente mueve el
      // estado de Connection.
      const ok=await connectWithRetry(defaultHost(), Object.assign({onStatus, reconnecting:wasAlreadyAuthenticated}, connectOpts));
      if(!ok){
        // Falla TRANSITORIA (sin red, timeout de conexión) — nunca un
        // rechazo real de la sesión. Si ya estábamos autenticados, seguimos
        // así (la caída de WS no es un logout); si esta era la primera
        // confirmación, no hay nada que confirmar todavía, así que cae a
        // "unauthenticated" — el token SIGUE guardado (no se toca acá), un
        // reintento más tarde puede confirmar bien.
        if(!wasAlreadyAuthenticated) Session.setUnauthenticated();
        return {ok:false, reason:"no-connection"};
      }
    }
    G.serverConnected=true;
    return await new Promise((resolve)=>{
      let done=false;
      // [Fase 5 — bug real encontrado en el soak test] Este timeout de 8s NO
      // se cancelaba cuando la llamada terminaba bien por otra vía (authOk
      // llegando a tiempo) — seguía armado igual, y si esta MISMA llamada
      // había arrancado con wasAlreadyAuthenticated=false (p. ej. una
      // reconexión de fondo que se disparó en un instante en que Session
      // todavía no estaba "authenticated"), 8 segundos después igual
      // ejecutaba Session.setUnauthenticated() — pisando por atrás una
      // sesión que para entonces ya podía estar perfectamente autenticada
      // de nuevo por una llamada MÁS NUEVA. Reproducido en vivo con
      // reconexiones rápidas seguidas. clearTimeout acá adentro de finish()
      // asegura que, una vez resuelta esta llamada (por la vía que sea), su
      // propio timeout nunca vuelva a tocar Session después.
      let timeoutId=null;
      const finish=(res)=>{ if(done) return; done=true; clearTimeout(timeoutId); delete G._authCb; resolve(res); };
      timeoutId=setTimeout(()=>{ if(!wasAlreadyAuthenticated) Session.setUnauthenticated(); finish({ok:false, reason:"timeout"}); },8000);
      G._authCb=(msg)=>{
        if(msg.type==="authOk"){
          if(msg.session&&msg.session.refreshToken) saveSessionToken(msg.session.refreshToken);
          migrateAwayFromStoredPassword();
          Session.setAuthenticated(); G.online=true; G.serverConnected=true;
          Connection.cancelScheduledReconnect(); // ya confirmado — no dejar un timer de fondo viejo armado que reintente de nuevo más tarde sin necesidad
          syncProfileFromServer(msg.profile);
          // Fase 1 — único punto central que vuelve a pedir el catálogo de
          // logros tras CUALQUIER resumeSession exitoso (arranque en frío,
          // volver de segundo plano, reconexión tras partida — todos pasan
          // por acá). Antes esto solo se pedía en login/registro y nunca se
          // repetía, así que Logros quedaba con el catálogo vacío/viejo el
          // resto de la sesión de página tras la primera reconexión. Fire-
          // and-forget a propósito, igual que el resto de los pedidos de
          // catálogo — la respuesta la procesa el handler de "catalog" de
          // arriba, no bloquea esta resolución.
          try{ NET.ws.send(JSON.stringify({type:"catalog"})); }catch(e){}
          finish({ok:true, profile:msg.profile});
        } else if(msg.type==="sessionExpired"){
          // Único rechazo EXPLÍCITO del servidor — acá sí corresponde tratar
          // la sesión como inválida de verdad, sin importar el estado previo.
          clearSessionToken();
          Session.setExpired();
          finish({ok:false, reason:"expired"});
        } else {
          if(!wasAlreadyAuthenticated) Session.setUnauthenticated();
          finish({ok:false, reason:"error"});
        }
      };
      try{ NET.ws.send(JSON.stringify({type:"resumeSession", refreshToken:token})); }
      catch(e){ finish({ok:false, reason:"send-failed"}); }
    });
  })();
  G._sessionOpInFlight=op.finally(()=>{ delete G._sessionOpInFlight; });
  return G._sessionOpInFlight;
}

/* ---------------- Reconexión automática ----------------
   Antes, cerrar el WS por CUALQUIER motivo (refresh de página, un wifi que
   tilda un instante) se trataba en el server como si hubieras cerrado la
   pestaña a propósito — te eliminaba la partida al toque (ver server.js).
   Ahora el server te da un margen antes de eso; acá guardamos en qué sala
   estabas para, si volvés a entrar (F5 incluido) dentro de esos minutos,
   reconectarte solo en vez de mandarte al menú de siempre. */
const ACTIVE_ROOM_KEY="burako_activeRoom";
const ACTIVE_ROOM_TTL_MS=3*60*1000;
function saveActiveRoom(code,playerId){
  try{ localStorage.setItem(ACTIVE_ROOM_KEY, JSON.stringify({code,playerId,ts:Date.now()})); }catch(e){}
}
function clearActiveRoom(){
  try{ localStorage.removeItem(ACTIVE_ROOM_KEY); }catch(e){}
}
function readActiveRoom(){
  try{
    const raw=localStorage.getItem(ACTIVE_ROOM_KEY);
    if(!raw) return null;
    const data=JSON.parse(raw);
    if(!data||!data.code||!data.playerId||!data.ts) return null;
    if(Date.now()-data.ts>ACTIVE_ROOM_TTL_MS) return null;
    return data;
  }catch(e){ return null; }
}
/* Restaura sesión (con el token guardado, vía resumeSessionSilently) + rejoin
   a la sala activa. Si CUALQUIER paso falla (token vencido, la sala ya no
   existe, etc.) se resuelve en false y quien llama cae al login manual de
   siempre, sin romper nada. */
function tryAutoReconnect(activeRoom, opts){
  opts=opts||{};
  return new Promise((resolve)=>{
    resumeSessionSilently({onStatus:opts.onStatus, connectOpts:opts.connectOpts}).then((res)=>{
      if(!res.ok){
        // [Fase 5 — bug crítico real encontrado en el soak test] Solo una
        // expiración DE VERDAD (res.reason==="expired") justifica olvidarse
        // de la sala — cualquier otro motivo (timeout, sin conexión, o un
        // fallo transitorio de Supabase como un rate-limit bajo ráfagas de
        // reconexión) no debe borrar la sala guardada: el próximo intento
        // automático tiene que poder seguir encontrándola.
        if(res.reason==="expired") clearActiveRoom();
        resolve(false);
        return;
      }
      // El pedido de "catalog" ya lo manda resumeSessionSilently() en su
      // propia rama authOk (Fase 1, único punto central) — no repetirlo acá.
      // Nunca se queda colgado esperando: si en 6s no hubo respuesta (server
      // caído, mensaje perdido, etc.) cae al login manual de siempre. Un intento
      // previo de reconectar automáticamente en OTRO lugar (salir de una sala de
      // espera) se probó y se sintió como un cuelgue/bucle (ver doLeaveLobby) —
      // este timeout es justamente para que ACÁ nunca se sienta así, pase lo que
      // pase con la red.
      let done=false;
      const finish=(ok)=>{ if(done) return; done=true; delete G._rejoinCb; resolve(ok); };
      setTimeout(()=>finish(false),6000);
      G._rejoinCb=(rmsg)=>{
        if(rmsg.type==="joined"){
          NET.myId=rmsg.playerId; NET.roomCode=rmsg.code;
          // [Fase 5 — bug crítico real encontrado en el soak test] Este
          // camino (rejoin automático) intercepta el "joined" ANTES de que
          // llegue al handler genérico de más abajo — el único que llama
          // saveActiveRoom() — así que un rejoin automático exitoso nunca
          // refrescaba el timestamp guardado. Con ACTIVE_ROOM_TTL_MS de solo
          // 3 minutos medidos desde la creación original de la sala, CUALQUIER
          // partida u sala que durara más de 3 minutos (la inmensa mayoría)
          // perdía la capacidad de auto-reconectar a partir de ese punto —
          // el cliente ni siquiera intentaba el rejoin, aunque el jugador
          // hubiera estado reconectando con éxito todo ese tiempo. Ahora se
          // refresca acá también, así el TTL mide "tiempo desde la última
          // presencia confirmada", no "tiempo desde el join original".
          saveActiveRoom(rmsg.code,rmsg.playerId);
          finish(true);
        } else {
          clearActiveRoom();
          finish(false);
        }
      };
      NET.ws.send(JSON.stringify({type:"rejoin", room:activeRoom.code, playerId:activeRoom.playerId}));
    });
  });
}

// URL pública del backend en producción (Render) — se usa como default de
// conexión SOLO dentro de la app empaquetada (Android/Capacitor), donde
// location.host no sirve para nada (Capacitor sirve los assets desde un
// origen local). Actualizar tras cada deploy si el nombre del servicio cambia.
const PROD_BACKEND_HOST = "burako-server.onrender.com";

function isNativeApp(){
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}
// Host a usar cuando todavía no hay nada guardado: en la app nativa, el
// backend público de producción (no hay LAN "de la propia página" posible);
// en la web, location.host YA es el host correcto (Render en producción, o
// la IP/puerto LAN si esta página se abrió directamente vía esa URL).
function defaultHost(){
  if(isNativeApp()) return PROD_BACKEND_HOST;
  return location.host || "localhost:8181";
}
// Resuelve automáticamente ws:// vs wss:// según corresponda: servida por
// HTTPS (producción, ej. Render) exige wss:// (los navegadores bloquean
// ws:// plano desde una página https por "mixed content"); servida por HTTP
// (desarrollo local o LAN, ej. abrir la URL "Red" que imprime el server) usa
// ws:// como siempre. Dentro de la app nativa conectando al backend de
// producción también hace falta wss:// aunque el WebView reporte http:. Si
// el host ya trae un esquema explícito (alguien tipeó "wss://..." a mano en
// el campo de IP manual), se respeta tal cual.
function wsUrlFor(host){
  if(/^wss?:\/\//i.test(host)) return host;
  const forceWss = isNativeApp() && host===PROD_BACKEND_HOST;
  return (forceWss||location.protocol==="https:"?"wss://":"ws://")+host;
}

/* ================================================================
   Instrumentación de latencia (temporal, para medir dónde se va el tiempo:
   click → netSend → ida por WS → servidor → vuelta → onmessage → render).
   Apagada por default; se activa desde la consola con
   localStorage.setItem("burako_debug_game","1") y recargando — no hay
   ningún toggle de UI a propósito, para que no quede prendida sin querer
   ni se filtre a usuarios normales. No imprime nada sensible (passwords,
   tokens, Service Role Key ni corre del lado servidor).
   ================================================================ */
const DEBUG_GAME=(()=>{ try{ return localStorage.getItem("burako_debug_game")==="1"; }catch(e){ return false; } })();
function dlog(...args){ if(DEBUG_GAME) console.log("%c[burako]","color:#fbbf24;font-weight:700", ...args); }
let _lastAnySendAt=0, _lastAnySendType="";
// Reintenta la conexión inicial con backoff — Render free "duerme" tras un
// rato sin tráfico y el primer request lo despierta, lo que puede tardar
// 30-60s (cold start). Sin esto, un solo intento fallido/lento tiraba la app
// directo a "modo offline" en silencio: se veía todo normal (menú, jugar)
// pero cualquier cosa que dependa de estar online (cambiar avatar, comprar,
// pase, etc.) desaparecía sin que quedara claro por qué. onStatus(text) es
// opcional, para mostrar en pantalla en qué intento va.
// reconnecting (Fase 3): etiqueta el estado de Connection durante el intento
// — "reconnecting" si ya había una sesión confirmada antes (resumeSessionSilently
// se lo pasa según wasAlreadyAuthenticated), "connecting" si es la primera
// conexión de esta carga de página. Puramente informativo para quien mire
// Connection.state() — no cambia el comportamiento del reintento en sí.
function connectWithRetry(host,{attempts=4, delays=[0,4000,8000,15000], attemptTimeout=15000, onStatus, reconnecting=false}={}){
  Connection._set(reconnecting?"reconnecting":"connecting");
  return new Promise(async(resolve)=>{
    for(let i=0;i<attempts;i++){
      if(i>0){
        onStatus&&onStatus(i===1?"Iniciando servidor (puede tardar hasta un minuto)…":"Reintentando conexión…");
        await new Promise(r=>setTimeout(r,delays[i]||delays[delays.length-1]));
      }
      try{
        await Promise.race([
          netConnect(host),
          new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")),attemptTimeout)),
        ]);
        Connection._set("connected");
        resolve(true); return;
      }catch(e){ /* sigue al próximo intento */ }
    }
    Connection._set("disconnected");
    resolve(false);
  });
}
function netConnect(host){
  return new Promise((resolve,reject)=>{
    if(NET.ws && NET.ws.readyState<=1){ try{NET.ws.close();}catch(e){} }
    const ws=new WebSocket(wsUrlFor(host));
    NET.ws=ws;
    ws.onopen=()=>{
      // Guard de "viejo" (Fase 3) que faltaba acá — un intento lento que
      // recién abre DESPUÉS de que connectWithRetry ya pasó al siguiente
      // (o de que otra conexión más nueva ya ganó) no debía poder pisar el
      // heartbeat/estado del socket que realmente está activo ahora.
      if(ws!==NET.ws) { try{ws.close();}catch(e){} return; }
      Connection._set("connected"); Connection.startHeartbeat(ws); resolve();
    };
    ws.onerror=(e)=>{
      if(ws!==NET.ws) return; // viejo
      reject(new Error("No se pudo conectar a "+host));
    };
    ws.onmessage=(ev)=>{
      if(ws!==NET.ws) return; // viejo
      let msg; try{msg=JSON.parse(ev.data);}catch(e){return;}
      if(msg.type==="pong"){ Connection.notePong(); return; } // confirma que el socket sigue vivo de verdad (Fase 3 — antes se descartaba sin más)
      if(DEBUG_GAME){
        const recvAt=performance.now();
        const rtt=(_lastAnySendAt&&(msg.type==="state"||msg.type==="error"))?(recvAt-_lastAnySendAt).toFixed(1)+"ms desde el último "+_lastAnySendType:"";
        dlog("← recv", msg.type, rtt);
      }
      // Auth callbacks (register/login/resumeSession)
      if((msg.type==="authOk"||msg.type==="error"||msg.type==="sessionExpired")&&G._authCb){ G._authCb(msg); return; }
      if(msg.type==="loggedOut"&&G._logoutCb){ G._logoutCb(); return; }
      // Callback de reconexión automática (rejoin) — mismo patrón que _authCb.
      if((msg.type==="joined"||msg.type==="error")&&G._rejoinCb){ G._rejoinCb(msg); return; }
      // Leaderboard callback
      if(msg.type==="leaderboard"&&G._lbCb){ G._lbCb(msg); return; }
      if(msg.type==="roomList"){ G.publicRooms=msg.rooms||[]; if(G.screen==="netConnect"&&G.netStep==="publicRooms") render(); return; }
      if(msg.type==="queueStatus"){
        G.searchingSeconds=msg.waitingSeconds||0; G.searchingSize=msg.queueSize||0; G.searchingMaxWait=msg.maxWaitSeconds||0;
        if(G.screen==="netConnect"&&G.netStep==="searching"&&G.searchingPhase!=="found") render();
        return;
      }
      if(msg.type==="queueMatched"){
        // Estado intermedio explícito: "encontramos partida" ANTES de entrar —
        // el "joined" que sigue casi al toque queda demorado un toque (ver
        // handler de "joined" más abajo) solo para que este estado se alcance
        // a ver, en vez de saltar directo de "buscando" a la mesa.
        G.searchingPhase="found"; G.searchingHumanCount=msg.humanCount||1;
        if(G.screen==="netConnect"&&G.netStep==="searching") render();
        return;
      }
      if(msg.type==="queueLeft"){ return; }
      if(msg.type==="towerStatus"){
        G.towerLoading=false; G.towerWeekId=msg.weekId; G.towerTower=msg.tower; G.towerFloor=msg.floor;
        G.towerComplete=!!msg.complete; G.towersCompleted=msg.towersCompleted||0;
        const activeTower=(msg.towers&&msg.towers[msg.tower])||{};
        G.towerClearedFloors=activeTower.clearedFloors||[];
        G.towerLives=activeTower.livesRemaining!=null?activeTower.livesRemaining:3;
        G.towerPending=msg.pending||[]; // [v1.3.4] premios de piso/completar/run que el jugador todavía no vio
        G.towerPendingChests=msg.pendingChests||[]; // [bloque 2] cofres sorteados pero sin abrir, de cualquier semana
        if(G.screen==="tower"||G.screen==="menu") render();
        return;
      }
      // [v1.3.4] Confirmación de que un premio de Torre quedó marcado como
      // visto — solo saca esa entrada de G.towerPending (la plata/ítem ya
      // estaba pagada desde antes, esto es puramente el flag de "ya lo vi").
      if(msg.type==="towerAcknowledged"){
        G.towerPending=(G.towerPending||[]).filter(p=>p.sourceId!==msg.sourceId);
        if(G.screen==="tower"||G.screen==="menu") render();
        return;
      }
      // [Torre — cofres, bloque 2] Llega el contenido recién revelado del
      // cofre que se pidió abrir — se guarda para que el modal lo muestre,
      // y se saca de la lista general de pendientes.
      if(msg.type==="towerChestOpened"){
        G._towerChestRevealed={tower:msg.tower, floor:msg.floor, tier:msg.tier, rewards:msg.rewards};
        G.towerPendingChests=(G.towerPendingChests||[]).filter(c=>c.id!==msg.chestId);
        if(G.screen==="tower"||G.screen==="menu") render();
        return;
      }
      if(msg.type==="towerStarted"){
        G.towerStarting=false; // el "joined" que llega justo después ya entra a la sala real
        G.towerTower=msg.tower;
        G.towerRival=msg.rival||null; // {name,avatar,personality,boss} — el nombre/avatar real ya viaja también en room.players (bot.name/avatar), esto es solo para presentación extra (ej. aviso de jefe)
        if(G.towerRival&&G.towerRival.boss) setMsg("👑 ¡Es el jefe de la Torre! "+G.towerRival.avatar+" "+G.towerRival.name);
        return;
      }
      if(msg.type==="dailyStatus"){
        G.dailyLoading=false; G.dailyClaimedToday=!!msg.claimedToday; G.dailyStreakDay=msg.streakDay||1; G.dailyMsUntilNext=msg.msUntilNext||0;
        // [fix] antes solo re-renderizaba en "dailyRoulette" — la tarjeta del
        // menú (menuRuletaHeroHTML) quedaba pegada en "Consultando tu
        // progreso…" para siempre aunque el dato ya hubiera llegado, porque
        // nada disparaba un nuevo render() del menú. towerStatus (arriba) ya
        // contemplaba "menu" — esto lo deja simétrico.
        if(G.screen==="dailyRoulette"||G.screen==="menu") render();
        return;
      }
      if(msg.type==="dailyResult"){
        G.dailySpinning=false;
        if(msg.ok){
          G.dailyClaimedToday=true; G.dailyStreakDay=msg.streakDay||G.dailyStreakDay; G.dailyMsUntilNext=msg.msUntilNext||0;
          G.dailyResult={streakDay:msg.streakDay,coins:msg.coins};
          Sound.win();
          if(G.screen==="dailyRoulette"){
            render();
            // Doble rAF: deja que el navegador pinte la rueda en rotate(0) ANTES
            // de disparar la transición — si no, puede saltarse la animación.
            requestAnimationFrame(()=>requestAnimationFrame(()=>spinDailyWheelTo(msg.streakDay,msg.coins,dailyRouletteBurst)));
          }
        } else {
          if(msg.alreadyClaimed) G.dailyClaimedToday=true;
          if(msg.msUntilNext) G.dailyMsUntilNext=msg.msUntilNext;
          setMsg(msg.msg||"No se pudo reclamar la ruleta.");
          if(G.screen==="dailyRoulette") render();
        }
        return;
      }
      // Rank update
      if(msg.type==="rankUpdate"){ G.rankUpdate=msg; if(msg.profile) syncProfileFromServer(msg.profile); }
      else if(msg.type==="profile"){ clearClaiming(); syncProfileFromServer(msg.profile); render(); }
      else if(msg.type==="matchResult"){ G.matchResult=msg; G._towerGiftOpened=false; if(msg.update&&msg.update.profile) syncProfileFromServer(msg.update.profile); }
      else if(msg.type==="achievementsUnlocked"){
        // La celebración de esquina es solo para quien lo desbloqueó (trae el detalle de recompensa);
        // el anuncio para el historial de todos ya llega vía el toast normal (kind:"achievement").
        G.pendingAchievements=(G.pendingAchievements||[]).concat(msg.achievements||[]);
        if(G.screen==="playing") renderAchievementToasts();
      }
      else if(msg.type==="catalog"){
        G.serverCatalog=msg.catalog; G.serverAchievementsCatalog=msg.achievements;
        // Persistida junto con el resto de P.* (Fase 1) — mismo criterio que
        // nombre/nivel/monedas: caché de visualización, nunca fuente de
        // autenticación. Solo se guarda si vino poblada; una respuesta vacía
        // (no debería pasar, pero por las dudas) no pisa la última copia buena.
        if(msg.achievements&&msg.achievements.length){ P.achievementsCatalog=msg.achievements; saveP(); }
      }
      // Profile
      if(msg.type==="profile"){ G.serverProfile=msg.profile; }
      // Game messages
      if(msg.type==="joined"){
        const fromMatchmakingSearch=(G.screen==="netConnect"&&G.netStep==="searching");
        const enterRoom=()=>{
          clearLobbyPending(); NET.myId=msg.playerId; NET.roomCode=msg.code; saveActiveRoom(msg.code,msg.playerId);
          G._deferStateUntil=null;
          if(G._deferredState){ const st=G._deferredState; G._deferredState=null; netApplyState(st); }
          else { G.screen="lobby"; render(); }
        };
        if(fromMatchmakingSearch){
          // "Partida encontrada" (seteado por queueMatched, justo antes de esto)
          // -> "Iniciando..." -> recién ahí entra a la sala. Una sala armada por
          // matchmaking arranca SOLA del lado del server (ver formMatchmakingRoom):
          // el "state" de sorteo llega casi pisando a este "joined", así que
          // además de demorar el cambio de pantalla acá hay que frenar el handler
          // de "state" de abajo con el mismo plazo — si no, ese "state" cambia
          // G.screen solo (netApplyState fuerza pantalla según la fase) y este
          // paso de "Partida encontrada"/"Iniciando…" nunca llega a verse.
          G.searchingPhase="starting"; render();
          G._deferStateUntil=Date.now()+700;
          setTimeout(enterRoom, 700);
        } else enterRoom();
      }
      else if(msg.type==="state"){
        if(G._deferStateUntil && Date.now()<G._deferStateUntil){ G._deferredState=msg; return; }
        clearLobbyPending();
        resolvePendingAction(false);
        // [Fase 5 — bug crítico real encontrado en el soak test] Refresca el
        // timestamp de la sala activa guardada en cada "state" real (no solo
        // al (re)unirse) — así ACTIVE_ROOM_TTL_MS mide "tiempo desde la
        // última presencia confirmada", no "tiempo desde el join original".
        // Sin esto, cualquier partida o sala que durara más que el TTL (3
        // minutos — la inmensa mayoría de las partidas reales) perdía la
        // capacidad de auto-reconectar a partir de ese punto: el cliente ni
        // siquiera intentaba el rejoin en el próximo corte, aunque el
        // jugador hubiera estado presente y reconectando bien todo ese rato.
        if(msg.code&&NET.myId) saveActiveRoom(msg.code,NET.myId);
        if(DEBUG_GAME){ const t0=performance.now(); netApplyState(msg); dlog("netApplyState+morph tardó", (performance.now()-t0).toFixed(1)+"ms"); }
        else netApplyState(msg);
      }
      else if(msg.type==="tick"){ if(G.screen==="playing"){ G.timeLeft=msg.timeLeft; netUpdateTimerDOM(); } }
      else if(msg.type==="toast"){
        // Los eventos de juego (y ahora también los errores de validación) viven
        // SOLO en el historial — ya no hay ventana/pill flotante en partida online.
        G.history=G.history||[];
        G.history.push({time:new Date().toLocaleTimeString('es-UY',{hour:'2-digit',minute:'2-digit',second:'2-digit'}), text:msg.msg, kind:msg.kind||"system"});
        if(G.history.length>50) G.history.shift();
        // Modo Galáctico: además del historial, un cartel grande y dinámico en el
        // centro de la pantalla — "NOMBRE USÓ HABILIDAD" — para que se note en el momento.
        if(msg.kind==="ability"&&msg.abilityBy&&msg.abilityKey) abilityBannerFX(msg.abilityBy,msg.abilityKey);
        render();
      }
      else if(msg.type==="teamWarn"){
        // Aviso claro para AMBOS integrantes del equipo, unos segundos antes de perder
        // una vida compartida por no coordinarse a tiempo — a diferencia de un toast
        // normal (que solo queda en el historial, invisible salvo que abras la pausa),
        // esto se ve de una en pantalla.
        G.teamWarnBanner=(msg.turnPlayerId===NET.myId?"¡Coordiná ficha o pasar!":esc(msg.turnPlayerName)+" todavía no jugó")+" — quedan "+msg.secsLeft+"s";
        Sound.error();
        clearTimeout(G._teamWarnT);
        G._teamWarnT=setTimeout(()=>{ G.teamWarnBanner=null; if(G.screen==="playing") render(); },2600);
        if(G.screen==="playing") render();
      }
      else if(msg.type==="error"){
        clearLobbyPending();
        resolvePendingAction(true);
        G.towerStarting=false; // si towerStart falló (ej. "ya completaste"), no dejar el botón trabado
        if(G.screen==="playing"){
          G.history=G.history||[];
          G.history.push({time:new Date().toLocaleTimeString('es-UY',{hour:'2-digit',minute:'2-digit',second:'2-digit'}), text:msg.msg, kind:"error"});
          if(G.history.length>50) G.history.shift();
          // Además del historial (registro permanente), un toast visible en el momento —
          // antes esto quedaba invisible en partida online (el toast estaba condicionado a
          // "!G.online"), así que un rechazo del servidor se sentía como "no pasó nada".
          setMsg("⚠ "+msg.msg);
        } else setMsg("⚠ "+msg.msg);
        render();
      }
      else if(msg.type==="abilityInfo"){
        // Respuesta privada (solo yo la recibo) de Robo dirigido (paso 1: eligar de qué
        // ficha robar) o Visión (efecto ya completo, solo mostrar lo que se vio).
        if(msg.ability==="robo_dirigido"){
          G.abilityModal={ability:"robo_dirigido_pick", tileId:G._pendingRoboDirigidoTileId, targetPlayerId:msg.targetPlayerId, targetName:msg.targetName, tiles:msg.tiles||[]};
          G._pendingRoboDirigidoTileId=null;
        } else if(msg.ability==="vision"){
          G.abilityModal={ability:"vision_reveal", targetName:msg.targetName, tiles:msg.tiles||[]};
        }
        render();
      }
      else if(msg.type==="playerActivity"){
        G.rivalActivity=G.rivalActivity||{}; G.rivalActivity[msg.playerId]=msg;
        // En 2v2 esto SOLO puede venir del compañero (el server ya filtra por equipo) —
        // acá llegan fichas reales, no un conteo, para la vista en vivo de "qué está armando".
        if(G.gameMode==="team2v2") G.mateActivity=msg.info||null;
        render();
      }
      else if(msg.type==="nudgeCancel"){
        setMsg("🚫 "+esc(msg.byName)+" te pide que canceles la jugada en curso.");
        Sound.error();
        render();
      }
      else if(msg.type==="tilesMarked"){
        G.mateMarkedTileIds=new Set(msg.tileIds||[]);
        Sound.select();
        render();
      }
      else if(msg.type==="chat"){
        // Camino liviano a propósito (Fase 0.5): appendChatMessageDOM toca
        // solo el DOM del chat, nunca renderPlaying()/la mesa entera.
        appendChatMessageDOM({id:msg.id, playerId:msg.playerId, playerName:msg.playerName, text:msg.text});
        Sound.select();
      }
      else if(msg.type==="chatHistory"){
        // Historial que manda el server una sola vez al entrar/reconectar a
        // una sala que ya tenía mensajes — no dispara render tampoco; si el
        // panel ya está abierto en este momento (raro, recién se entró) se
        // repuebla, si no simplemente queda en G.chatLog para cuando se abra.
        G.chatLog=(msg.messages||[]).slice(-30);
        if(G.chatOpen){
          const list=document.querySelector("#chatMsgList");
          if(list){ list.innerHTML=G.chatLog.slice(-10).map(chatMsgHTML).join(""); list.scrollTop=list.scrollHeight; }
        }
      }
      else if(msg.type==="teamChat"){
        // Chat de equipo: solo llega de tu compañero (el server ya filtra), así que
        // alcanza con una sola "burbuja" — no hace falta indexar por playerId.
        const mine=msg.playerId===NET.myId;
        G.history=G.history||[];
        G.history.push({time:new Date().toLocaleTimeString('es-UY',{hour:'2-digit',minute:'2-digit',second:'2-digit'}), text:"🤝 "+(mine?"Vos":msg.playerName)+": "+msg.text, kind:"chat"});
        if(G.history.length>50) G.history.shift();
        if(!mine){
          G.teamChatBubble=msg.text;
          clearTimeout(G._teamChatBubbleT);
          G._teamChatBubbleT=setTimeout(()=>{ G.teamChatBubble=null; if(G.screen==="playing") render(); },4000);
          Sound.select();
        }
        if(G.screen==="playing") render();
      }
    };
    ws.onclose=()=>{
      if(ws!==NET.ws) return; // viejo
      Connection.onClosed();
      // Dos caminos, mutuamente excluyentes (Fase 3):
      // - En partida activa: attemptMatchReconnect(), el camino especializado
      //   de siempre (ventana de gracia de 25s del servidor, reintentos
      //   rápidos) — sin cambios en su lógica de juego.
      // - Fuera de partida: antes esto no hacía NADA — un wifi que titila
      //   estando en el menú/Perfil/Tienda dejaba el socket muerto hasta que
      //   algo más lo notara (tocar un botón, volver de segundo plano). Ahora,
      //   si había sesión (autenticada o restaurándose) al momento de la
      //   caída, se programa una reconexión controlada con backoff — un solo
      //   timer (scheduleReconnect protege contra duplicarlo).
      if(G.online && inActiveMatch()){
        G.online=false;
        attemptMatchReconnect();
      } else if(Session.isAuthenticated()||Session.isRestoring()){
        Connection.scheduleReconnect();
      }
    };
  });
}
// El servidor da un margen de gracia de 25s (GRACE_MS en server.js) antes de
// dar por rendido a alguien que se desconectó de una partida en curso — este
// reintento apunta a entrar bien adentro de esa ventana, con reintentos
// cortos y rápidos (no el backoff paciente del arranque en frío, que solo
// tiene sentido cuando no hay ninguna partida en juego esperando).
async function attemptMatchReconnect(){
  if(G._reconnectingMatch) return;
  const activeRoom=readActiveRoom();
  if(!activeRoom||!getSessionToken()) return;
  Connection.cancelScheduledReconnect(); // este camino especializado se hace cargo, no hace falta un segundo timer de fondo compitiendo
  G._reconnectingMatch=true;
  setMsg("Se perdió la conexión — reconectando…"); render();
  // [Fase 5 — bug crítico real encontrado en el soak test] Un solo reintento
  // corto y acotado: antes, UN fallo TRANSITORIO (p. ej. un rate-limit
  // puntual de la API de Auth bajo una ráfaga de reconexión — visto en vivo
  // en el soak test) agotaba el intento sin volver a probar, aunque sobrara
  // ventana de gracia (25s) y la sesión siguiera siendo perfectamente
  // válida. tryAutoReconnect() solo borra la sala guardada cuando el motivo
  // es una expiración DE VERDAD (ver ahí) — si sigue ahí después de un
  // intento fallido, es que fue transitorio y vale la pena UN reintento más.
  // A propósito no es una cadena larga de reintentos: cada intento ya trae
  // su propio backoff interno (connectOpts) y esto solo debe cubrir un
  // hipo puntual, no pelear indefinidamente contra una caída sostenida —
  // eso lo sigue manejando el margen de gracia del servidor como límite final.
  let rejoined=await tryAutoReconnect(activeRoom,{
    connectOpts:{attempts:2, delays:[0,2000], attemptTimeout:5000},
    onStatus:(t)=>{ setMsg(t); render(); },
  });
  if(!rejoined && readActiveRoom()){
    await new Promise((r)=>setTimeout(r,2000));
    rejoined=await tryAutoReconnect(activeRoom,{
      connectOpts:{attempts:2, delays:[0,2000], attemptTimeout:5000},
      onStatus:(t)=>{ setMsg(t); render(); },
    });
  }
  G._reconnectingMatch=false;
  if(rejoined){
    G.online=true;
    setMsg("✅ Reconectado.");
    render();
  } else {
    G.online=false;
    setMsg("⚠ No se pudo volver a entrar — puede que la partida ya haya terminado.");
    render();
  }
}



/* ================================================================
   Jugadas online que mutan estado local optimistamente (Preparación,
   selección) antes de tener confirmación del servidor: se registra qué
   hacer si el servidor la rechaza (restore) y un timeout de seguridad por
   si la respuesta nunca llega (conexión cortada a mitad de camino, típico
   en redes más lentas/Render free). Mientras hay una jugada pendiente, no
   se deja mandar otra — evita mezclar el rollback de una jugada vieja con
   el resultado de una nueva.
   Nota de diseño: el "state"/"error" que resuelve la jugada pendiente es
   SIEMPRE el que sigue inmediatamente a mandarla (el servidor procesa los
   mensajes de una misma conexión en orden y termina de mutar+broadcastear
   ANTES de atender cualquier otro evento), así que no hace falta un id de
   correlación explícito en el protocolo para que esto sea seguro.
   ================================================================ */
function sendGameAction(kind,msg,restoreFn){
  if(G._pendingAction){ Sound.error(); setMsg("Esperá la confirmación de la jugada anterior."); render(); return false; }
  if(!netSend(msg)){
    setMsg("⚠ Sin conexión al servidor. Reintentá."); render();
    return false;
  }
  G._pendingAction={
    kind, restore:restoreFn||null,
    timeoutId:setTimeout(()=>{
      if(!G._pendingAction||G._pendingAction.kind!==kind) return;
      const pa=G._pendingAction; G._pendingAction=null;
      if(pa.restore) pa.restore();
      setMsg("⚠ El servidor no respondió a tiempo. Probá de nuevo.");
      render();
    },9000),
  };
  return true;
}
function resolvePendingAction(isError){
  if(!G._pendingAction) return;
  const pa=G._pendingAction; G._pendingAction=null;
  clearTimeout(pa.timeoutId);
  if(isError&&pa.restore) pa.restore();
}

function netSend(obj){
  if(!NET.ws||NET.ws.readyState!==1){ setMsg("Sin conexión al servidor."); return false; }
  try{
    if(DEBUG_GAME){ _lastAnySendAt=performance.now(); _lastAnySendType=obj.type; dlog("→ send", obj.type, obj); }
    NET.ws.send(JSON.stringify(obj));
    return true;
  }catch(e){ setMsg("Error de conexión."); return false; }
}

function netUpdateTimerDOM(){
  // Actualizar todos los timers en pantalla (puede haber en HUD y rackhead)
  document.querySelectorAll(".timer-num").forEach(el=>{ el.textContent=G.timeLeft; if(G.timeLeft<=10) el.classList.add("a-blink"); });
  document.querySelectorAll(".timer-ring").forEach(ring=>{
    const R=17,C=2*Math.PI*R;
    ring.setAttribute("stroke-dashoffset",C*(1-Math.max(0,G.timeLeft)/(G.turnSeconds||60)));
    if(G.timeLeft<=10) ring.setAttribute("stroke","#ef4444");
  });
}


/* ===== SORTEO ONLINE ===== */
function renderNetSorteo(app){
  const sorteo=G.netSorteo||[];
  const allRevealed=sorteo.every(s=>s.revealed);
  const myEntry=sorteo.find(s=>s.playerId===NET.myId);
  const myRevealed=myEntry&&myEntry.revealed;
  const isTeam2v2=G.gameMode==="team2v2";
  // Capitán = el de mayor valor de sorteo dentro de cada equipo (solo cosmético, no altera reglas).
  const captainId=(team)=>{
    const entries=sorteo.filter(s=>s.team===team&&s.revealed);
    if(!entries.length) return null;
    return entries.slice().sort((a,b)=>b.value-a.value)[0].playerId;
  };
  const capBlue=isTeam2v2?captainId("blue"):null, capRed=isTeam2v2?captainId("red"):null;
  app.innerHTML=`
  <div class="screen-center">
    <div class="card ${G._enterCls}" style="text-align:center;position:relative">
      <h2 style="font-family:var(--font-display);color:#ffe9a8;font-size:22px;margin-bottom:6px">Sorteo de orden</h2>
      <p style="font-size:12px;color:rgba(232,238,247,.55);margin-bottom:16px">
        ${!myRevealed?"Tocá la bolsa para sacar tu ficha.":allRevealed?"¡Orden definido!":"Esperando a los demás…"}
      </p>
      ${!myRevealed?`
        <div class="bag" onclick="netSend({type:'reveal'})" style="width:90px;height:104px;margin:0 auto 16px;cursor:pointer">
          <div class="b" style="left:0;top:8px;width:66px;height:82px"></div>
          <div class="b" style="left:7px;top:4px;width:66px;height:82px"></div>
          <div class="b" style="left:14px;top:0;width:66px;height:82px"></div>
          <div class="cnt" style="font-size:26px">?</div>
        </div>
      `:""}
      <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:16px">
        ${sorteo.map(s=>{
          const isMe=s.playerId===NET.myId;
          const teamBadge=isTeam2v2?(s.team==="blue"?"🔵 ":s.team==="red"?"🔴 ":""):"";
          const isCap=s.revealed&&(s.playerId===capBlue||s.playerId===capRed);
          return `<div style="display:flex;flex-direction:column;align-items:center;gap:6px">
            ${s.revealed
              ? `<div class="tile c-${["rojo","azul","verde","amarillo"][s.value%4]} a-flip" style="width:48px;height:66px;font-size:22px">${s.value}</div>`
              : `<div class="tile back" style="width:48px;height:66px"></div>`}
            <span style="font-size:11px;color:${isMe?"#ffe9a8":"rgba(232,238,247,.7)"};font-weight:${isMe?800:400}">${teamBadge}${isCap?"🎖 ":""}${esc(s.playerName)}${isMe?" (vos)":""}</span>
            ${s.revealed?`<span style="font-size:10px;color:rgba(232,238,247,.5)">sacó ${s.value}</span>`:""}
          </div>`;
        }).join("")}
      </div>
      ${allRevealed?`
        <p class="a-pop" style="font-size:12px;color:#ffe9a8;margin-bottom:10px">
          ${isTeam2v2
            ?"🎖 Capitanes — 🔵 "+esc((sorteo.find(s=>s.playerId===capBlue)||{}).playerName||"?")+" · 🔴 "+esc((sorteo.find(s=>s.playerId===capRed)||{}).playerName||"?")
            :sorteo.slice().sort((a,b)=>b.value-a.value).map((s,i)=>(i+1)+"° "+esc(s.playerName)+" ("+s.value+")").join(" · ")}
        </p>
        <p style="font-size:11px;color:rgba(232,238,247,.4)">Repartiendo fichas…</p>
      `:""}
    </div>
  </div>`;
}

/* ===== DEALING ONLINE ===== */
function renderNetDealing(app){
  const count=G.netDealCount||0;
  const pct=Math.round(count/14*100);
  app.innerHTML=`
  <div class="screen-center" style="gap:16px">
    <h2 style="font-family:var(--font-display);color:#ffe9a8;font-size:24px">Agarrá tus fichas</h2>
    <div style="width:220px;height:10px;border-radius:6px;background:rgba(0,0,0,.35);overflow:hidden">
      <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#fcd34d,#f59e0b);transition:width .3s"></div>
    </div>
    <p style="font-size:13px;color:rgba(232,238,247,.7);margin-top:-8px">${count} / 14 fichas</p>
    ${count<14?`
      <div class="bag" onclick="netSend({type:'dealDraw'})" style="width:100px;height:116px;cursor:pointer">
        <div class="b" style="left:0;top:8px;width:74px;height:92px"></div>
        <div class="b" style="left:8px;top:4px;width:74px;height:92px"></div>
        <div class="b" style="left:16px;top:0;width:74px;height:92px"></div>
        <div class="cnt" style="font-size:20px">${G.bag?G.bag.length:"?"}</div>
      </div>
      <p style="font-size:11px;color:rgba(232,238,247,.5);margin-top:-6px">Tocá la bolsa para sacar una ficha</p>
      <button class="btn-ghost btn-sm" style="border-radius:8px" onclick="netSend({type:'dealDraw',all:true})">⚡ Sacar todas de una</button>
    `:`
      <p style="font-size:14px;color:#34d399;font-weight:800">¡Listo! Esperando a los demás…</p>
    `}
    <div class="sk-${P.skin||"clasica"}" style="width:100%;max-width:660px">${rackHTML(true,G.gameMode==="galactico")}</div>
    <p style="font-size:10px;color:rgba(232,238,247,.4)">Tocá fichas y una casilla vacía para acomodarlas.</p>
    ${G.gameMode==="team2v2"?`
      <div style="width:100%;max-width:420px;margin-top:4px">
        <div style="font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(232,238,247,.45);margin-bottom:5px;text-align:center">Compañero/a: ${(G.teammateHand||[]).length}/14</div>
        ${teammateRackHTML(G.teammateHand)}
      </div>
    `:""}
  </div>`;
}

/* ===== COUNTDOWN previo a la partida (solo 2v2 online) ===== */
function startNetCountdown(){
  G.countdownVal=5;
  clearInterval(G._countdownTimer);
  G._countdownTimer=setInterval(()=>{
    G.countdownVal--;
    if(G.countdownVal<=0){ clearInterval(G._countdownTimer); G._countdownTimer=null; }
    if(G.screen==="netCountdown") render();
  },1000);
}
function renderNetCountdown(app){
  const v=G.countdownVal!==undefined?G.countdownVal:5;
  app.innerHTML=`<div class="screen-center" style="text-align:center">
    <div class="logo-text" style="font-size:clamp(22px,5.5vw,32px);margin-bottom:26px">🤝 2v2</div>
    <div class="a-pop" style="font-size:clamp(64px,22vw,140px);font-weight:900;color:#ffe9a8;text-shadow:0 0 30px rgba(251,191,36,.5);line-height:1">
      ${v>0?v:"¡EMPIEZA!"}
    </div>
  </div>`;
}

function netApplyState(s){
  // Sincronizar el estado del servidor con el estado local G para que renderPlaying funcione igual
  const wasPlaying=G.screen==="playing";
  const prevIdx=G.currentIdx;
  // Detectar el arranque de una partida nueva (el server no tiene concepto de "pistas",
  // a diferencia de jokerBreaks que sí sincroniza; hay que resetear el contador acá).
  if(s.started && !G._wasRoomStarted){ G.hintsLeft=10; G.abilityModal=null; G.abilityTip=null; }
  G._wasRoomStarted=!!s.started;

  // Modo Galáctico: mi mano llega mezclada (fichas normales + de habilidad) — hay
  // que separarlas antes de que toquen el atril/armado de juegos, que no saben
  // manejar una ficha sin color/número. Las de habilidad van a su propio panel.
  const mySplit=(s.gameMode==="galactico"&&window.BurakoCore)?window.BurakoCore.splitHand(s.myHand||[]):{tiles:s.myHand||[],abilities:[]};
  G.myAbilityTiles=mySplit.abilities;
  G.myAbilityUsed=!!s.myAbilityUsed;
  G.myBlocked=!!s.myBlocked;

  // Crear los players locales con toda la info que necesita renderPlaying
  const myTeam=(s.players.find(p=>p.id===NET.myId)||{}).team||null;
  G.players=s.players.map(p=>({
    id:p.id, name:p.name, isHuman:p.id===NET.myId,
    // En 2v2, el compañero de equipo NO se muestra como rival en los asientos de
    // arriba/costados — tiene su propio panel chico (.col-teammate) en la fila inferior.
    isTeammate: s.gameMode==="team2v2" && !!myTeam && p.team===myTeam && p.id!==NET.myId,
    hand:p.id===NET.myId?mySplit.tiles:Array(p.handCount).fill({id:"x",color:"rojo",number:0,joker:false,hidden:true}),
    hasLaidInitial:p.hasLaidInitial,
    connected:p.connected,
    isAdmin:!!p.isAdmin, isAI:!!p.isAI, ready:!!p.ready, skin:p.skin||"clasica", team:p.team||null,
    lives:(p.lives!==undefined?p.lives:MAX_LIVES), eliminated:!!p.eliminated, bet:p.bet||0,
    avatar:p.avatar||"🀄", rankPts:p.rankPts||null, level:p.level||null, shielded:!!p.shielded,
    nameeffect:p.nameeffect||null, banner:p.banner||null,
  }));
  G.gameMode=s.gameMode||(s.ranked?"ranked":"casual");
  // Sincronizar MIS vidas desde el server (autoridad real en online)
  const mySrv = s.players.find(p=>p.id===NET.myId);
  if(mySrv && mySrv.lives!==undefined) G.lives = mySrv.lives;
  // Si el turno ya no es mío y todavía tengo Preparación sin confirmar, el turno se
  // fue sin que yo mandara nada (timeout → pérdida de vida) — el server nunca se
  // enteró de que esas fichas estaban "afuera" del atril (acá no es team2v2, donde
  // sí es server-authoritative vía room.teamWork). Si no se limpia ACÁ, antes de
  // sincronizar el atril más abajo, esas fichas quedan duplicadas: una copia sigue
  // en G.workLoose/workGroups y otra se vuelve a colocar en el atril porque el
  // server todavía las lista en la mano. Si en cambio SÍ confirmé mi jugada, estos
  // campos ya están vacíos (el interceptor de confirmTurn los vacía de forma
  // optimista al mandar la jugada), así que este bloque no hace nada en ese caso.
  const isMyTurnNow=s.players[s.currentIdx]&&s.players[s.currentIdx].id===NET.myId;
  if(!isMyTurnNow && s.gameMode!=="team2v2" && ((G.workGroups&&G.workGroups.length)||(G.workLoose&&G.workLoose.length)||(G.openedMeldIds&&G.openedMeldIds.length))){
    G.workGroups=[]; G.workLoose=[]; G.openedMeldIds=[]; G.openedBackup={}; G.selWork=new Set();
  }
  G.bag=Array(s.bagCount).fill(null);
  // Juegos nuevos desde el último estado (para animación "slam" + efecto de partículas
  // del dueño). Solo si ya estábamos jugando: al entrar recién a la mesa (inicio o
  // unión tardía) no hay que "explotar" todos los juegos ya existentes de una.
  const prevMeldIds=new Set((G.table||[]).map(m=>m.id));
  // En modo individual, "abrir" un juego con comodín (candado) es 100% local hasta
  // confirmar (openMeld, línea ~2791): saca el meld de G.table y sus fichas quedan
  // en G.workLoose, pero el server no se entera hasta el próximo "reorganize". Si no
  // lo protegemos acá, cualquier state que llegue mientras tengo un candado abierto
  // (ej. el rival juega su turno) pisa G.table con la copia del server —que todavía
  // tiene el meld entero— duplicando el juego en vez de dejarlo en preparación.
  const openedIdsNow=(s.gameMode!=="team2v2")?new Set(G.openedMeldIds):new Set();
  // Aplicar el skin del dueño a cada ficha de la mesa (persistencia visual por jugador)
  G.table=(s.table||[]).filter(meld=>!openedIdsNow.has(meld.id)).map(meld=>{
    const owner=G.players?G.players.find(p=>p.id===meld.ownerId):null;
    const ownerSkin=owner?owner.skin:"clasica";
    return {...meld, tiles:(meld.tiles||[]).map(t=>({...t, skin:t.skin||ownerSkin}))};
  });
  if(wasPlaying){
    const newMelds=(s.table||[]).filter(m=>!prevMeldIds.has(m.id));
    if(newMelds.length){
      G.freshMelds=new Set(newMelds.map(m=>m.id));
      G.freshMeldKind={};
      slamFX();
      queueMeldFx(newMelds[newMelds.length-1].id, newMelds[newMelds.length-1].fx||"clasico");
      setTimeout(()=>{ G.freshMelds=new Set(); render(); },700);
      // Combo / gran jugada: mismo criterio que el camino offline (confirmTurn/
      // layTiles, ver más abajo en el archivo), centralizado ACÁ para cubrir de una
      // sola vez lay/layMultiple/reorganize/attach online — antes esto solo pasaba
      // offline porque cada interceptor online (confirmTurn/layGroupByDrag/
      // attachToMeld) reemplaza la versión offline por completo sin recalcular nada
      // de esto. El servidor no necesita mandar nada nuevo: ownerId y las fichas de
      // cada meld ya viajan en "state".
      const myNewMelds=newMelds.filter(m=>m.ownerId===NET.myId);
      if(myNewMelds.length){
        const gained=myNewMelds.reduce((sum,m)=>sum+(meldInfo(m.tiles).value||0),0);
        if(myNewMelds.length>=2||gained>=50){
          setTimeout(()=>bigPlayFX(myNewMelds.length>=2?"¡COMBO x"+myNewMelds.length+"! +"+gained+" pts":"¡GRAN JUGADA! +"+gained+" pts"),150);
        }
      }
    }
  }
  G.currentIdx=s.currentIdx;
  G.timeLeft=s.timeLeft;
  G.meldCounter=s.table.length;
  if(s.jokerBreaks!==undefined) G.jokerBreaksLeft=s.jokerBreaks;
  if(s.tapete) G.serverTapete=s.tapete;
  if(s.matchEndsAt!==undefined){
    const changed=G.matchEndsAt!==s.matchEndsAt;
    G.matchEndsAt=s.matchEndsAt;
    if(changed) startMatchTimer();
  }
  if(s.scores){ G.scores=s.scores; }
  if(s.ranked!==undefined) G.ranked=s.ranked;
  G.teammateHand=s.teammateHand||null;

  const h=G.players.find(p=>p.isHuman);
  if(h){
    // Sincronizar el atril del jugador humano (solo fichas normales — las de
    // habilidad no pasan por el atril, viven en G.myAbilityTiles/.col-abilities)
    syncRackFromServer(mySplit.tiles);
    h.hand=mySplit.tiles;
  }
  // Limpiar marcado táctico (2v2) apenas las fichas marcadas ya no están en la mano
  // correspondiente — típicamente porque quien las tenía ya jugó su turno.
  if(G.mateMarkedTileIds&&G.mateMarkedTileIds.size){
    const myIds=new Set(mySplit.tiles.map(t=>t.id));
    G.mateMarkedTileIds.forEach(id=>{ if(!myIds.has(id)) G.mateMarkedTileIds.delete(id); });
  }
  if(G.myMarksOnMate&&G.myMarksOnMate.size){
    const mateIds=new Set((s.teammateHand||[]).map(t=>t.id));
    G.myMarksOnMate.forEach(id=>{ if(!mateIds.has(id)) G.myMarksOnMate.delete(id); });
  }

  if(s.winnerId){
    clearInterval(G.matchTimerHandle);
    const isNewResult=G._handledWinnerId!==s.winnerId;
    G._handledWinnerId=s.winnerId;
    G.winner=G.players.find(p=>p.id===s.winnerId);
    G.surrenderedOnline=!!s.surrendererId; G.iSurrendered=s.surrendererId===NET.myId;
    G.screen="gameover";
    // Solo festejar/lamentar UNA vez por resultado: sin esto, cualquier broadcast
    // posterior (alguien tildando listo, etc.) repetía el sonido y la pantalla de "ganaste".
    if(isNewResult) G.winner&&G.winner.isHuman?Sound.win():Sound.lose();
  } else if(s.started && s.phase==="sorteo"){
    G.screen="netSorteo";
    G.netSorteo=s.sorteo;
  } else if(s.started && s.phase==="dealing"){
    G.screen="netDealing";
    G.netDealCount=s.dealCount;
  } else if(s.started && s.phase==="countdown"){
    if(G.screen!=="netCountdown") startNetCountdown();
    G.screen="netCountdown";
  } else if(s.started){
    G.screen="playing";
    // Detectar cambio de turno para avisar
    const cur=G.players[G.currentIdx];
    if(cur&&(cur.isHuman||cur.isTeammate)&&(!wasPlaying||prevIdx!==G.currentIdx)){
      G.turnBanner=true;
      Sound.turn();
      setTimeout(()=>{ G.turnBanner=false; render(); },1650);
    }
  } else {
    G.screen="lobby";
  }

  // Reconciliar (no vaciar) selección/preparación: un "state" llega con la jugada de
  // CUALQUIER jugador de la sala, no solo la propia — vaciar esto en cada broadcast
  // deseleccionaba fichas y borraba lo que armaste en Preparación con solo esperar a
  // que el rival juegue (bug reportado: "cambia el turno... se pierde lo que estaba
  // haciendo"). En vez de eso, solo se descarta lo que realmente dejó de ser válido:
  // fichas que ya no están en mi mano (se jugaron con éxito) — todo lo demás persiste.
  const myHandIds=new Set(mySplit.tiles.map(t=>t.id));
  G.selHand=new Set([...(G.selHand||[])].filter(id=>myHandIds.has(id)));
  if(s.gameMode==="team2v2" && s.teamWork){
    // La Preparación en 2v2 es una zona COMPARTIDA de verdad (autoridad en el server,
    // no una copia local) — acá simplemente reflejamos lo que llegó, sin vaciarla en
    // cada broadcast (que en 2v2 va a ser seguido, porque el compañero también toca).
    G.workLoose=(s.teamWork.loose||[]).slice();
    G.workGroups=(s.teamWork.groups||[]).slice();
    const stillThere=new Set([...G.workLoose.map(t=>t.id), ...G.workGroups.flatMap(g=>g.tiles.map(t=>t.id))]);
    G.selWork=new Set([...(G.selWork||[])].filter(id=>stillThere.has(id)));
  } else {
    // Modo individual: la Preparación es puramente local (el server no la conoce hasta
    // que se confirma con layMultiple/reorganize) — NO se pisa desde s. Se protegen
    // tanto las fichas que siguen en mi mano como las de un candado abierto localmente
    // (openedMeldTileIds, línea ~2720 — vinieron de la mesa, no de la mano).
    const protectedIds=new Set([...myHandIds, ...openedMeldTileIds()]);
    G.workLoose=G.workLoose.filter(t=>protectedIds.has(t.id));
    G.workGroups=G.workGroups
      .map(g=>({...g, tiles:g.tiles.filter(t=>protectedIds.has(t.id))}))
      .filter(g=>g.tiles.length>0);
    const stillThere=new Set([...G.workLoose.map(t=>t.id), ...G.workGroups.flatMap(g=>g.tiles.map(t=>t.id))]);
    G.selWork=new Set([...(G.selWork||[])].filter(id=>stillThere.has(id)));
  }
  G.rivalActivity={};
  G.mateActivity=null;
  G.teamProposal=s.teamProposal||null;
  if(!s.started) G.history=[];
  render();
}

function syncRackFromServer(hand){
  const ids=new Set(hand.map(t=>t.id));
  G.rack=G.rack.map(t=>t&&ids.has(t.id)?t:null);
  G.reserve=G.reserve.filter(t=>ids.has(t.id));
  const already=new Set([...G.rack.filter(Boolean).map(t=>t.id),...G.reserve.map(t=>t.id)]);
  const arrived=[];
  hand.forEach(t=>{
    if(!already.has(t.id)){ placeInRack(t); arrived.push(t.id); }
  });
  // Fichas que acaban de llegar del servidor (reparto o robar del pozo): mismo vuelo
  // desde la bolsa que en offline, para que se vea igual jugando online.
  if(arrived.length){
    arrived.forEach((id,i)=>{ G.dealtStagger[id]=i*90; });
    clearTimeout(G._dealtStaggerT);
    G._dealtStaggerT=setTimeout(()=>{ G.dealtStagger={}; if(G.screen==="netDealing"||G.screen==="playing") render(); },arrived.length*90+500);
  }
}

/* -- Interceptores: cuando G.online, envían al server en vez de ejecutar local -- */
const _layFromRack_orig=layFromRack;
layFromRack=function(){
  if(!G.online) return _layFromRack_orig();
  const tiles=handTiles().filter(t=>G.selHand.has(t.id));
  if(tiles.length<3){ Sound.error(); return; }
  captureFlightSources(tiles.map(t=>t.id));
  const prevSel=new Set(G.selHand);
  const ok=sendGameAction("lay",{type:"lay", tiles: tiles.map(t=>t.id)},()=>{ G.selHand=prevSel; render(); });
  if(!ok) return;
  G.selHand=new Set();
  setMsg("Enviando jugada…"); render();
};

const _drawAndPass_orig=drawAndPass;
drawAndPass=function(){
  if(!G.online) return _drawAndPass_orig();
  if(G.gameMode==="team2v2"){
    // Ya no se ejecuta directo: queda como propuesta hasta que tu compañero/a confirme.
    // Si queda algo a mitad de armar en la zona compartida, el server lo devuelve solo
    // a sus dueños cuando se confirme el robo — no hace falta bloquear ni avisar antes.
    netSend({type:"teamProposeDraw"});
    return;
  }
  if(G.workLoose.length||G.workGroups.length){ Sound.error(); setMsg("Cancelá la preparación antes de tomar ficha."); return render(); }
  sendGameAction("draw",{type:"draw"},null);
};

const _attachToMeld_orig=attachToMeld;
attachToMeld=function(meldId,tiles){
  if(!G.online) return _attachToMeld_orig(meldId,tiles);
  const ids=tiles?tiles.map(t=>t.id):[...G.selHand];
  if(!ids.length) return;
  const prevSel=new Set(G.selHand);
  const ok=sendGameAction("attach",{type:"attach", meldId, tiles: ids},()=>{ G.selHand=prevSel; render(); });
  if(!ok) return;
  G.selHand=new Set();
  setMsg("Enviando jugada…"); render();
};

const _confirmTurn_orig=confirmTurn;
confirmTurn=function(){
  if(!G.online) return _confirmTurn_orig();
  if(G.gameMode==="team2v2"){
    if(G.workLoose.length){ Sound.error(); setMsg("Agrupá las fichas sueltas."); return render(); }
    if(!G.workGroups.length){ Sound.error(); setMsg("No armaron ningún juego."); return render(); }
    netSend({type:"teamProposeConfirm"});
    setMsg("Proponiendo la jugada a tu compañero/a…");
    return;
  }
  if(G.workLoose.length){ Sound.error(); setMsg("Agrupá las fichas sueltas."); return render(); }
  if(!G.workGroups.length){ Sound.error(); setMsg("No armaste ningún juego."); return render(); }
  const groups=G.workGroups.map(g=>g.tiles.map(t=>t.id));
  const isReorg=!!(G.openedMeldIds&&G.openedMeldIds.length>0);
  const wsMsg=isReorg?{type:"reorganize", openedMeldIds:G.openedMeldIds, groups}:{type:"layMultiple", groups};
  // Snapshot COMPLETO de la Preparación antes de vaciarla optimistamente. Si el
  // servidor rechaza la jugada (ej. combinación inválida que el chequeo local no
  // detectó, o dejó de ser el turno por una desconexión breve), se restaura tal
  // cual estaba para que el usuario pueda corregirla — nunca se pierde el trabajo
  // armado por un rechazo del servidor. Esto reemplaza depender ÚNICAMENTE de la
  // reconciliación pasiva en netApplyState (que solo actúa en el próximo "state").
  const snapshot={workGroups:G.workGroups, workLoose:G.workLoose, openedMeldIds:G.openedMeldIds, openedBackup:G.openedBackup, selWork:new Set(G.selWork), jokerBreaksLeft:G.jokerBreaksLeft};
  const ok=sendGameAction(isReorg?"reorganize":"layMultiple", wsMsg, ()=>{
    G.workGroups=snapshot.workGroups; G.workLoose=snapshot.workLoose;
    G.openedMeldIds=snapshot.openedMeldIds; G.openedBackup=snapshot.openedBackup; G.selWork=snapshot.selWork;
    // Los candados que se gastaron localmente al abrir melds con comodín (openMeld,
    // ~línea 3061) también se restauran acá — si no, el contador quedaba mal hasta
    // el próximo "state" del servidor.
    G.jokerBreaksLeft=snapshot.jokerBreaksLeft;
    render();
  });
  if(!ok) return;
  G.workGroups=[]; G.workLoose=[]; G.openedMeldIds=[]; G.openedBackup={}; G.selWork=new Set();
  setMsg("Enviando jugada…"); render();
};


function netSendActivity(){
  if(!G.online||!NET.ws||NET.ws.readyState!==1) return;
  // En 2v2 la Preparación pasó a ser una zona compartida de verdad (server-authoritative,
  // ver teamAddLoose/teamFormGroup/etc.) — el compañero ya ve exactamente lo mismo que vos
  // en G.workLoose/G.workGroups, así que esta vista previa aparte quedó redundante.
  if(G.gameMode==="team2v2") return;
  const info={groups:G.workGroups.length, loose:G.workLoose.length};
  try{ NET.ws.send(JSON.stringify({type:"activity", info})); }catch(e){}
}
function toggleMateMark(tileId){
  G.myMarksOnMate=G.myMarksOnMate||new Set();
  if(G.myMarksOnMate.has(tileId)) G.myMarksOnMate.delete(tileId);
  else G.myMarksOnMate.add(tileId);
  netSend({type:"markTiles", tileIds:Array.from(G.myMarksOnMate)});
  render();
}
function doNudgeCancel(){
  netSend({type:"nudgeCancel"});
  setMsg("Le avisamos a tu compañero/a que cancele.");
  render();
}
/* ---------------- Chat de texto libre ----------------
   Separado a propósito de G.history/renderPlaying(): un mensaje de chat NO
   debe disparar un render completo de la mesa (Fase 0.5 — el costo de
   render() escala con juegos en mesa). appendChatMessageDOM() toca solo el
   DOM del panel de chat, mismo criterio que netUpdateTimerDOM() para el
   timer. */
const CHAT_MAX_LEN=200;
function chatMsgHTML(m){
  const mine=m.playerId===NET.myId;
  return `<div class="chat-msg ${ownerClass(m.playerId)}" data-cid="${m.id}">
    <span class="chat-msg-name">${mine?"Vos":esc(m.playerName)}</span>
    <span class="chat-msg-text">${esc(m.text)}</span>
  </div>`;
}
function chatPanelHTML(){
  if(!(G.online&&G.gameMode!=="team2v2")) return "";
  return `<div id="chatBackdrop" class="chat-backdrop ${G.chatOpen?"chat-open":""}" onclick="if(event.target===this)toggleChat()"></div>
  <div id="chatPanel" class="chat-panel ${G.chatOpen?"chat-open":""}">
    <div class="chat-panel-head">
      <span class="chat-panel-title">💬 Chat</span>
      <button class="chat-panel-close" onclick="toggleChat()" title="Cerrar">✕</button>
    </div>
    <div id="chatMsgList" class="chat-msglist">
      ${(G.chatLog||[]).slice(-10).map(chatMsgHTML).join("")||`<span class="chat-empty">Sin mensajes todavía.</span>`}
    </div>
    <div class="chat-input-row">
      <input id="chatInput" type="text" maxlength="${CHAT_MAX_LEN}" placeholder="Escribí un mensaje..." onkeydown="chatInputKeydown(event)"/>
      <button class="chat-send-btn" onclick="sendChatMessage()">Enviar</button>
    </div>
  </div>`;
}
function appendChatMessageDOM(m){
  G.chatLog=G.chatLog||[];
  G.chatLog.push(m);
  if(G.chatLog.length>30) G.chatLog.shift();
  if(G.chatOpen){
    const list=document.querySelector("#chatMsgList");
    if(list){
      const atBottom=(list.scrollHeight-list.scrollTop-list.clientHeight)<40;
      list.insertAdjacentHTML("beforeend", chatMsgHTML(m));
      while(list.children.length>10) list.removeChild(list.firstElementChild);
      if(atBottom) list.scrollTop=list.scrollHeight;
    }
  } else {
    G.chatUnread=(G.chatUnread||0)+1;
    const badge=document.querySelector("#chatBadge");
    if(badge){ badge.textContent=" · "+G.chatUnread; badge.style.display=""; }
  }
}
function toggleChat(){
  G.chatOpen=!G.chatOpen;
  const panel=document.querySelector("#chatPanel");
  const backdrop=document.querySelector("#chatBackdrop");
  if(panel) panel.classList.toggle("chat-open", G.chatOpen);
  if(backdrop) backdrop.classList.toggle("chat-open", G.chatOpen);
  if(G.chatOpen){
    G.chatUnread=0;
    const badge=document.querySelector("#chatBadge"); if(badge) badge.style.display="none";
    const list=document.querySelector("#chatMsgList");
    if(list){
      list.innerHTML=(G.chatLog||[]).slice(-10).map(chatMsgHTML).join("");
      list.scrollTop=list.scrollHeight;
    }
    const input=document.querySelector("#chatInput"); if(input) input.focus();
  }
}
function sendChatMessage(){
  const input=document.querySelector("#chatInput");
  if(!input) return;
  const text=input.value.trim();
  if(!text) return;
  if(text.length>CHAT_MAX_LEN) return setMsg(`Mensaje demasiado largo (máx ${CHAT_MAX_LEN} caracteres).`);
  netSend({type:"sendChat", text});
  input.value="";
}
function chatInputKeydown(e){
  if(e.key==="Enter"){ e.preventDefault(); sendChatMessage(); }
}
function doTeamChat(text){
  const now=Date.now();
  if(G._lastTeamChatSentAt && now-G._lastTeamChatSentAt<QUICK_CHAT_COOLDOWN_MS) return;
  G._lastTeamChatSentAt=now;
  netSend({type:"teamChat", text});
  clearInterval(G._teamChatCooldownTick);
  G._teamChatCooldownTick=setInterval(()=>{
    if(Date.now()-G._lastTeamChatSentAt>=QUICK_CHAT_COOLDOWN_MS) clearInterval(G._teamChatCooldownTick);
    if(G.screen==="playing") render();
  },1000);
  render();
}

/* -- Pantallas online: conectar, lobby -- */

// [Login v2] Portada real con las capas PNG del usuario (antes: abanico de
// fichas armándose + .card genérica) — mismo shell que login/registro
// (loginShellHTML) para que la transición entre pantallas sea continua.
// Contenido real sin cambios: mismo texto descriptivo, mismo botón
// condicional (▶ Jugar la primera vez / Iniciar sesión → si ya hay
// cuenta), mismo goIntroEnter().
function renderIntro(app){
  const isFirstTime=checkFirstTime()||G.introMode==="offline";
  const ctaHTML=isFirstTime
    ?`<button class="login-v2-submit-html" onclick="goIntroEnter()">▶ Jugar</button>`
    :`<button class="login-v2-submit" onclick="goIntroEnter()" aria-label="Iniciar sesión"><img src="./img/login/boton.png" alt="" aria-hidden="true"></button>`;
  // [Pedido] El bloque de en medio pasa de explicar reglas/"sala de red
  // local" a mostrar lo que HOY tiene Burako de verdad (Pase de Temporada,
  // Torre Semanal, Ruleta diaria — las 3 features reales trabajadas esta
  // sesión), en la misma tipografía dorada de los títulos.
  app.innerHTML=loginShellHTML(`
    <p class="login-v2-desc">La variante uruguaya de Rummikub — grupos, escaleras y comodines.</p>
    <div class="login-v2-info-wrap">
      <div class="login-v2-info-bg" aria-hidden="true"></div>
      <div class="login-v2-fields login-v2-features">
        <div class="login-v2-feature"><span class="login-v2-feature-icon">🎫</span><span>Pase de Temporada — subí de nivel y desbloqueá recompensas</span></div>
        <div class="login-v2-feature"><span class="login-v2-feature-icon">🏰</span><span>Torre Semanal — 3 Torres, 30 pisos, premios exclusivos</span></div>
        <div class="login-v2-feature"><span class="login-v2-feature-icon">🎡</span><span>Ruleta Diaria — girá todos los días y ganá monedas</span></div>
      </div>
    </div>
    ${ctaHTML}
    <p class="login-v2-version">v${GAME_VERSION.replace(/\.0$/,"")}</p>
  `, !!G._enterCls);
}
async function goIntroEnter(){
  Sound.init();
  if(checkFirstTime()){
    // Primera vez, sea online u offline: SIEMPRE el onboarding propio (registro +
    // mini tutorial + avatar) — no el login/register genérico de renderAuthScreen.
    // Se intenta conectar en segundo plano (con reintentos — Render free puede
    // tardar en despertar) así, si hay servidor, el registro del paso 1 crea una
    // cuenta real; si no, el mismo paso queda como perfil local. El formulario ya
    // se ve mientras tanto (no bloquea), y submitOnboardRegister() tiene su propio
    // margen de espera si todavía no terminó de conectar cuando el usuario confirma.
    G.screen="onboarding"; G.onboardStep="register"; G._obNameTaken=null; render();
    const ok=await connectWithRetry(defaultHost());
    if(ok) G.serverConnected=true; else G.introMode="offline";
    return;
  }
  if(G.introMode==="offline"){
    G.screen="menu";
    render(); return;
  }
  const token=getSessionToken();
  const activeRoom=readActiveRoom();
  if(token&&activeRoom){
    // Quedó una partida activa reciente (refresh, wifi cortado un instante) y
    // hay sesión guardada — priorizar volver a ella antes que el menú. Si
    // cualquier paso falla, cae al login manual sin ningún efecto secundario.
    G.authIntent="menu";
    const flipSeq=startLogoFlipSequence();
    G.screen="auth"; G.authStep="reconnecting"; render();
    const okReconnect=await tryAutoReconnect(activeRoom);
    if(okReconnect) return;
    flipSeq.settle(()=>{ G.authStep="login"; G.authMode="login"; render(); });
    return;
  }
  if(token){
    // Sesión guardada, sin partida pendiente (el caso normal: se cerró la app
    // desde el menú) — entrar directo al menú con el perfil cacheado
    // localmente (P.*, ya se persiste vía saveP()/syncProfileFromServer) y
    // restaurar la sesión de fondo, en vez de mostrar SIEMPRE el formulario
    // de usuario/contraseña aunque las credenciales guardadas sigan valiendo.
    G.screen="menu"; render();
    const res=await resumeSessionSilently();
    if(!res.ok&&res.reason==="expired"){
      // El servidor dijo explícitamente que la sesión ya no vale — recién acá
      // corresponde pedir login de nuevo (nunca en silencio, para no
      // sorprender a alguien que ya estaba mirando el menú/perfil).
      G.authIntent="menu";
      withLogoFlip(()=>{ G.screen="auth"; G.authMode="login"; G.authStep="login"; render(); });
    } else {
      render();
    }
    return;
  }
  // Sin sesión guardada (primera conexión de este dispositivo/navegador, o
  // logout explícito): como antes, conectar y mostrar el login.
  G.authIntent="menu";
  // [Fix — "tac instantáneo" reportado entre portada (ventana 1) y login
  // (ventana 2)] Esta es la transición que más se nota: pasa SIEMPRE que se
  // abre la app sin sesión guardada. Antes eran DOS withLogoFlip seguidos
  // (portada->conectando, conectando->login) que se pisaban entre sí cuando
  // el servidor respondía rápido (local, o Render ya despierto) — el
  // segundo interrumpía al primero a mitad de camino y el logo terminaba
  // saltando en vez de animarse. Ahora es UN solo flip de punta a punta
  // (ver startLogoFlipSequence), sin importar cuánto haya durado "conectando"
  // en el medio.
  const flipSeq=startLogoFlipSequence();
  G.screen="auth"; G.authStep="connecting"; G._connectStatus=null; render();
  const ok=await connectWithRetry(defaultHost(),{onStatus:(t)=>{ G._connectStatus=t; render(); }});
  if(ok){
    G.serverConnected=true;
    flipSeq.settle(()=>{ G.authStep="login"; G.authMode="login"; render(); });
  } else {
    // Server no responde tras varios reintentos: en vez de caer en silencio a
    // "modo offline" (donde después no se entiende por qué faltan funciones que
    // necesitan estar online), se lo decimos claro con la opción de reintentar o
    // seguir sin conexión a propósito.
    G.authStep="offline-fail";
    render();
  }
}
function renderAuthScreen(app){
  // [Pedido — "esa ventana nueva no tiene el nuevo diseño"] Estos 3
  // sub-estados breves (conectando/reconectando/sin conexión) usaban el
  // viejo abanico de fichas + .card genérica — quedaban pegados en medio
  // del flujo nuevo. Mismo shell (loginShellHTML) que portada/login, con
  // el mismo logo estático (así withLogoFlip sigue animando sin saltos
  // entre estos 3 estados y el login real).
  if((G.authStep||"connecting")==="connecting"){
    app.innerHTML=loginShellHTML(`
      <p class="login-v2-subtitle">Conectando…</p>
      <div class="searching-spinner" aria-hidden="true" style="margin:6px auto 14px"></div>
      <p class="login-v2-desc">${esc(G._connectStatus||"Conectando al servidor…")}</p>
    `, !!G._enterCls);
    return;
  }
  if(G.authStep==="reconnecting"){
    app.innerHTML=loginShellHTML(`
      <p class="login-v2-subtitle">Reconectando…</p>
      <div class="searching-spinner" aria-hidden="true" style="margin:6px auto 14px"></div>
      <p class="login-v2-desc">Reconectando a tu partida…</p>
    `, !!G._enterCls);
    return;
  }
  if(G.authStep==="offline-fail"){
    app.innerHTML=loginShellHTML(`
      <p class="login-v2-subtitle">No se pudo conectar</p>
      <p class="login-v2-desc">No respondió el servidor tras varios intentos. Si es la primera vez en un rato, puede estar despertando — a veces tarda un poco.</p>
      <button class="login-v2-submit-html" onclick="goIntroEnter()">🔄 Reintentar</button>
      <button class="login-v2-ghost" onclick="G.introMode='offline';G.screen='menu';render()">Jugar sin conexión</button>
    `, !!G._enterCls);
    return;
  }
  const mode=G.authMode||"login";
  const lastName=G._authPrefillUser!==undefined?G._authPrefillUser:(localStorage.getItem("burako_lan_name")||"");
  // [Login v2 — capas PNG] El botón dorado real (login-button.png) ya trae
  // "INICIAR SESIÓN →" grabado en el propio PNG — se usa TAL CUAL para el
  // modo login (imagen dentro de un <button> real, con aria-label porque el
  // texto visible no es texto de verdad). Para "Crear cuenta" no existe un
  // PNG con ese texto (inventar uno rotulado distinto sería falsear el
  // asset), así que ese botón reusa .btn-gold (el mismo gradiente dorado
  // que ya usa el resto de la app) con texto HTML real — mismo lenguaje
  // visual, sin inventar un PNG que no está.
  const submitBtnHTML = mode==="register"
    ? `<button class="login-v2-submit-html" id="authsubmitbtn" onclick="submitAuth('register')">Crear cuenta →</button>`
    : `<button class="login-v2-submit" id="authsubmitbtn" onclick="submitAuth('login')" aria-label="Iniciar sesión">
         <img src="./img/login/boton.png" alt="" aria-hidden="true">
       </button>`;
  app.innerHTML=loginShellHTML(`
    <button class="login-v2-close" onclick="withLogoFlip(()=>{G.screen='intro';render()})" title="Cerrar">✕</button>
    <p class="login-v2-subtitle">${mode==="register"?"Creá tu cuenta":"Iniciá sesión"}</p>
    ${mode==="register"&&G._authNotice?`<p class="login-v2-notice">${esc(G._authNotice)}</p>`:""}
    <div class="login-v2-info-wrap">
      <div class="login-v2-info-bg" aria-hidden="true"></div>
      <div class="login-v2-fields">
        <label class="login-v2-lbl">Usuario</label>
        <div class="login-v2-input-wrap">
          <span class="login-v2-input-icon">👤</span>
          <input id="authuser" class="login-v2-input" placeholder="Tu nombre" value="${esc(lastName)}" maxlength="16"
            onkeydown="if(event.key==='Enter'){${mode==="register"?"document.querySelector('#authpass').focus()":"submitAuth('login')"}}">
        </div>
        <label class="login-v2-lbl">Contraseña</label>
        <div class="login-v2-input-wrap">
          <span class="login-v2-input-icon">🔒</span>
          <input id="authpass" class="login-v2-input" type="password" placeholder="Contraseña"
            onkeydown="if(event.key==='Enter'){${mode==="register"?"document.querySelector('#authpass2').focus()":"submitAuth('login')"}}">
        </div>
        ${mode==="register"?`
        <label class="login-v2-lbl">Repetir contraseña</label>
        <div class="login-v2-input-wrap">
          <span class="login-v2-input-icon">🔒</span>
          <input id="authpass2" class="login-v2-input" type="password" placeholder="Repetí la contraseña" onkeydown="if(event.key==='Enter')submitAuth('register')">
        </div>`:""}
      </div>
    </div>
    <p id="autherr" class="login-v2-error"></p>
    ${submitBtnHTML}
    ${mode==="register"
      ?`<button class="login-v2-ghost" onclick="switchAuthMode('login')">← Ya tengo cuenta</button>`
      :`<button class="login-v2-ghost" onclick="switchAuthMode('register')">Crear cuenta nueva</button>`}
  `, !!(G._enterCls||G._authModeSwitching));
}
// [Pedido] Antes cambiar entre "Iniciá sesión"/"Creá tu cuenta" era un
// corte seco (render() de golpe, sin transición) — se sentía tosco.
// G._authModeSwitching hace que renderAuthScreen trate este cambio como si
// fuera una entrada nueva (mismo stagger de fade-in que al llegar a la
// pantalla la primera vez), sin tocar la lógica real del toggle.
function switchAuthMode(mode, prefillUser, notice){
  G.authMode=mode;
  G._authPrefillUser=prefillUser!==undefined?prefillUser:(document.querySelector("#authuser")?document.querySelector("#authuser").value.trim():"");
  G._authNotice=notice||null;
  G._authModeSwitching=true;
  render();
  G._authModeSwitching=false;
}
// [Login v2] Refleja el estado "enviando" en el botón real sin re-renderizar
// toda la pantalla (un render() completo perdería el foco/el texto de
// #autherr, que se escribe directo al DOM — mismo criterio que showErr ya
// usaba antes de este cambio). El botón de login es la imagen real
// (login-button.png, con su texto grabado) — no se puede reescribir su
// texto, así que el loading es un cartel superpuesto que se agrega/saca;
// el de "Crear cuenta" es HTML real, ahí se cambia el texto sin más.
function setAuthSubmitting(submitting){
  G._authSubmitting=submitting;
  const btn=document.querySelector("#authsubmitbtn");
  if(!btn) return;
  btn.disabled=submitting;
  if((G.authMode||"login")==="register"){
    btn.textContent=submitting?"Creando…":"Crear cuenta →";
    return;
  }
  let overlay=btn.querySelector(".login-v2-submit-loading");
  if(submitting){
    if(!overlay){ overlay=document.createElement("span"); overlay.className="login-v2-submit-loading"; btn.appendChild(overlay); }
    overlay.textContent="Iniciando…";
  } else if(overlay){
    overlay.remove();
  }
}
function submitAuth(action){
  if(G._authSubmitting) return; // bloquea doble click mientras espera al servidor
  const userEl=document.querySelector("#authuser"), passEl=document.querySelector("#authpass");
  const user=userEl.value.trim(), pass=passEl.value;
  const showErr=(m)=>{ const el=document.querySelector("#autherr"); if(el) el.textContent=m; };
  if(!user||!pass){ showErr("Completá usuario y contraseña."); return; }
  if(action==="register"){
    const pass2=document.querySelector("#authpass2").value;
    if(pass!==pass2){ showErr("Las contraseñas no coinciden."); return; }
  }
  localStorage.setItem("burako_lan_name",user);
  setAuthSubmitting(true);
  const finish=(msg)=>{
    delete G._authCb;
    setAuthSubmitting(false);
    if(msg.type==="authOk"){
      G.online=true; Session.setAuthenticated();
      syncProfileFromServer(msg.profile);
      if(msg.welcomeBonus) G.pendingWelcomeBonus=msg.welcomeBonus;
      if(msg.alert) G.pendingSanctionAlert=msg.alert;
      Store.set("burako_onboarded",true);
      // Si se llegó acá desde "Ya tengo cuenta" en el onboarding de un dispositivo
      // nuevo, este dispositivo queda marcado como conocido — no vuelve a pedir
      // registro la próxima vez (mismo flag que marca finishOnboarding()).
      if(G._onboardingLoginShortcut){ Store.set("burako_onboarded_v2",true); G._onboardingLoginShortcut=false; }
      if(msg.session&&msg.session.refreshToken) saveSessionToken(msg.session.refreshToken);
      migrateAwayFromStoredPassword();
      Sound.init();
      try{ NET.ws.send(JSON.stringify({type:"catalog"})); }catch(e){}
      if(G.authIntent==="joinRoom"){ G.screen="netConnect"; G.netStep="joinRoom"; }
      else G.screen="menu";
      render();
    } else {
      if(action==="login" && /No existe ese jugador/i.test(msg.msg||"")){
        switchAuthMode("register", user, "Ese usuario todavía no existe — registrate para crearlo.");
        return;
      }
      showErr(msg.msg||"Error desconocido.");
    }
  };
  if(!NET.ws||NET.ws.readyState!==1){
    showErr("Conexión perdida. Reconectando…");
    const host=localStorage.getItem("burako_lan_host")||defaultHost();
    netConnect(host).then(()=>{
      G._authCb=finish;
      NET.ws.send(JSON.stringify({type:action, username:user, password:pass}));
    }).catch(e=>{ setAuthSubmitting(false); showErr("No se pudo reconectar: "+e.message); });
    return;
  }
  G._authCb=finish;
  NET.ws.send(JSON.stringify({type:action, username:user, password:pass}));
}
async function logout(){
  // Logout explícito: el único momento en que la identidad realmente
  // desaparece (a diferencia de volver al menú, terminar una partida, o
  // que se caiga la conexión — esos NUNCA deben tocar la sesión guardada).
  if(Session.isAuthenticated()&&NET.ws&&NET.ws.readyState===1){
    const token=getSessionToken();
    await new Promise((resolve)=>{
      let done=false; const finish=()=>{ if(done) return; done=true; delete G._logoutCb; resolve(); };
      setTimeout(finish,2000); // best-effort: si no contesta, cerramos igual
      G._logoutCb=finish;
      try{ NET.ws.send(JSON.stringify({type:"logout", refreshToken:token})); }
      catch(e){ finish(); }
    });
  }
  try{ if(NET.ws) NET.ws.close(); }catch(e){}
  NET.ws=null;
  Connection.disconnect(); // logout real: apagado completo, no seguir reintentando reconectar solos después de esto
  localStorage.removeItem("burako_lan_pass");
  clearSessionToken();
  clearActiveRoom();
  G.online=false; G.serverConnected=false; G.serverProfile=null;
  Session.setUnauthenticated();
  G._authNotice=null; G._authPrefillUser=undefined;
  G.screen="intro"; render();
}

async function goOnlineConnect(){
  if(G.serverConnected && NET.ws && NET.ws.readyState===1){
    // Ya estamos conectados al server, solo mostrar selector de sala
    G.screen="netConnect"; G.netStep="joinRoom"; render();
    return;
  }
  const token=getSessionToken();
  if(token){
    // El socket se cayó en segundo plano (común en redes móviles, y en Render
    // Free tras el sleep por inactividad) — reconectar solo antes de pedirle
    // nada al usuario.
    G.netConnectStatus=null;
    G.screen="netConnect"; G.netStep="connecting"; render();
    const res=await resumeSessionSilently({onStatus:(t)=>{ G.netConnectStatus=t; render(); }});
    if(res.ok){
      G.screen="netConnect"; G.netStep="joinRoom"; render();
      return;
    }
    if(res.reason!=="expired"){
      // Falla TEMPORAL (sin conexión / timeout / servidor recién despertando)
      // — NUNCA un problema de sesión, así que reintentar visible en vez de
      // mandar a loguearse de nuevo (y mucho menos a la pantalla de IP LAN,
      // que antes era el único destino posible acá y dejaba al usuario sin
      // ninguna pista de qué hacer). connectWithRetry ya reintenta con
      // backoff y avisa "puede tardar hasta un minuto" si hace falta.
      const ok=await connectWithRetry(defaultHost(), {onStatus:(t)=>{ G.netConnectStatus=t; render(); }});
      if(ok){
        const res2=await resumeSessionSilently();
        if(res2.ok){ G.screen="netConnect"; G.netStep="joinRoom"; render(); return; }
      }
    }
  }
  // Sin sesión válida: nunca hubo token, la sesión realmente venció/el token
  // es inválido, o seguimos sin poder conectar tras reintentar — en todos los
  // casos el único destino con sentido es el login normal (mismo camino en
  // PC/web y en la app nativa; la pantalla de "IP de red local" de abajo
  // queda como acceso manual para desarrollo, ya no es un fallback automático
  // para un usuario real).
  G.authIntent="joinRoom";
  withLogoFlip(()=>{ G.screen="auth"; G.authStep="login"; G.authMode="login"; render(); });
}
function renderNetConnect(app){
  const lastHost=localStorage.getItem("burako_lan_host")||defaultHost();
  const lastName=localStorage.getItem("burako_lan_name")||P.name||"Jugador";
  const step=G.netStep||"connect";
  if(step==="connecting"){
    app.innerHTML=`<div class="screen-center auth-screen"><div class="fan-compact">${fanLogoHTML()}</div><div class="card ${G._enterCls}" style="text-align:center"><p style="font-size:13px;color:rgba(232,238,247,.5);margin-top:12px">${esc(G.netConnectStatus||"Conectando al servidor…")}</p></div></div>`;return;
  }
  if(step==="connect"){
    app.innerHTML=`<div class="screen-center auth-screen"><div class="fan-compact">${fanLogoHTML()}</div><div class="card ${G._enterCls}">
      <button class="card-x" onclick="G.online=false;goPlay()" title="Cerrar">✕</button>
      <p class="subtitle" style="margin-bottom:14px">Multijugador · Red local</p>
      <label class="lbl">IP del servidor</label>
      <input id="nethost" placeholder="192.168.0.5:8181" value="${esc(lastHost)}" onkeydown="if(event.key==='Enter')doNetConnect()" style="width:100%;padding:11px;border-radius:9px;background:rgba(255,255,255,.06);border:1px solid rgba(184,150,63,.25);color:#fff;font-size:14px;margin-bottom:10px">
      <button class="btn btn-gold" style="margin-top:8px" onclick="doNetConnect()">Conectar al servidor</button>
      <p id="neterr" style="color:#f87171;font-size:12px;text-align:center;min-height:16px;margin-top:6px"></p>
    </div></div>`; return;
  }
  if(step==="joinRoom"){
    const tier=tierOf(G.serverProfile?G.serverProfile.rankPts:P.rankPts);
    const sp=G.serverProfile||{};
    app.innerHTML=`<div class="screen-center auth-screen"><div class="fan-compact">${fanLogoHTML()}</div><div class="card ${G._enterCls}" style="text-align:center">
      <button class="card-x" onclick="goPlay()" title="Cerrar">✕</button>
      <div style="margin:10px 0;font-size:12px;color:#ffe9a8;font-weight:800;display:flex;align-items:center;justify-content:center;gap:5px;flex-wrap:wrap">
        ${nameEffectHTML(sp.username||P.name,P.nameeffect)} · ${tierBadgeHTML(tier,15)} ${sp.rankPts||P.rankPts} pts · 🪙 ${sp.fichas||0}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px">
        <button class="mode-btn mode-btn-ffa" onclick="G.netStep='ffaHub';render()">
          <span class="mode-btn-icon">👥</span><span class="mode-btn-label">Todos contra todos</span>
        </button>
        <p style="font-size:10px;color:rgba(232,238,247,.5);margin:-4px 0 4px;text-align:center;line-height:1.3">Casual, Ranked o Monedas — cada jugador compite por su cuenta.</p>
        <button class="mode-btn mode-btn-team" disabled style="opacity:.5;cursor:default" title="Todavía no está disponible">
          <span class="mode-btn-icon">🤝</span><span class="mode-btn-label">2v2 en equipo · Próximamente</span>
        </button>
        <button class="mode-btn mode-btn-galactico" onclick="G.netStep='galacticoHub';render()">
          <span class="mode-btn-icon">🪐</span><span class="mode-btn-label">Modo Galáctico</span>
        </button>
        <p style="font-size:10px;color:rgba(232,238,247,.5);margin:-4px 0 0;text-align:center;line-height:1.3">Fichas de habilidad especiales mezcladas en el mazo — todos contra todos.</p>
      </div>
      <button class="btn btn-ghost" style="margin-top:10px;font-size:11px" onclick="doRequestLeaderboard()">🏅 Tabla de posiciones</button>
    </div></div>`; return;
  }
  if(step==="ffaHub"){
    app.innerHTML=`<div class="screen-center"><div class="card ${G._enterCls}" style="text-align:center">
      <button class="card-x" onclick="G.netStep='joinRoom';render()" title="Cerrar">✕</button>
      <h2 style="font-family:var(--font-display);color:#ffe9a8;font-size:20px;margin-bottom:12px">👥 Todos contra todos</h2>
      ${G.message?`<p style="text-align:center;font-size:12px;color:#f87171;font-weight:700;background:rgba(220,38,38,.12);border:1px solid rgba(220,38,38,.3);border-radius:8px;padding:6px 10px;margin:0 0 10px">⚠ ${esc(G.message)}</p>`:""}
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="btn btn-gold" onclick="doQueueJoin('casualQuick2')" style="background:linear-gradient(180deg,#38bdf8,#0369a1);color:#fff">⚔️ Duelo rápido (2)</button>
        <button class="btn btn-gold" onclick="doQueueJoin('casualOpen')" style="background:linear-gradient(180deg,#c084fc,#7e22ce);color:#fff">🎲 Mesa abierta (2-8)</button>
        <button class="btn btn-gold" onclick="doQueueJoin('ranked')" style="background:linear-gradient(180deg,#fbbf24,#b45309)">⚡ Ranked (2-4)</button>
        <p style="font-size:9.5px;color:rgba(232,238,247,.45);margin:-4px 0 4px;text-align:center;line-height:1.3">Arranca con los jugadores que haya al vencer el tiempo de espera. Si quedás solo, se agrega 1 IA para no dejarte esperando.</p>
        <button class="btn btn-ghost" onclick="goCreateRoom('ffa')">➕ Crear sala nueva</button>
        <button class="btn btn-ghost" onclick="G.netCategory='ffa';G.netStep='enterCode';render()">🚪 Unirse a una sala</button>
        <button class="btn btn-ghost" onclick="G.netCategory='ffa';doListPublicRooms()">🌍 Salas públicas</button>
      </div>
    </div></div>`; return;
  }
  if(step==="searching"){
    const mode=G.searchingMode||"casualOpen";
    const phase=G.searchingPhase||"searching";
    const modeTitles={casualQuick2:"⚔️ Buscando Duelo rápido…",casualOpen:"🎲 Buscando Mesa abierta…",ranked:"⚡ Buscando partida Ranked…"};
    let title,body,showCancel=true;
    if(phase==="starting"){
      title="✔ ¡Partida encontrada!";
      body=`<p style="font-size:13px;color:#ffe9a8;font-weight:700;margin:10px 0 4px">Iniciando…</p>`;
      showCancel=false;
    } else if(phase==="found"){
      title="✔ ¡Partida encontrada!";
      body=G.searchingHumanCount===1
        ? `<p style="font-size:13px;color:rgba(232,238,247,.8);margin:10px 0 4px">Completando con IA…</p>`
        : `<p style="font-size:13px;color:rgba(232,238,247,.8);margin:10px 0 4px">${G.searchingHumanCount} jugadores encontrados</p>`;
      showCancel=false;
    } else {
      title=modeTitles[mode]||"🔎 Buscando partida…";
      // No mostrar una capacidad tipo "N/4" (puede confundir — Mesa abierta llega a
      // 8, Duelo rápido arranca ya en 2): solo cuánta gente hay, con singular/plural
      // correcto, y el tiempo restante estimado antes del fallback con IA.
      const n=G.searchingSize||0;
      const foundLabel=n<=0?"Buscando…":n===1?"1 jugador encontrado":`${n} jugadores encontrados`;
      body=`<p style="font-size:12px;color:rgba(232,238,247,.7);margin:10px 0 4px">${foundLabel}${G.searchingSeconds?` · ${G.searchingSeconds}s buscando`:""}</p>
      <p style="font-size:10px;color:rgba(232,238,247,.45);margin-bottom:14px;line-height:1.3">${G.searchingMaxWait?`En ${G.searchingMaxWait}s arranca con los que haya (o con 1 IA si quedás solo).`:"Arranca con los jugadores que haya (o con 1 IA si quedás solo)."}</p>`;
    }
    app.innerHTML=`<div class="screen-center"><div class="card ${G._enterCls}" style="text-align:center">
      <h2 style="font-family:var(--font-display);color:#ffe9a8;font-size:18px;margin-bottom:6px">${title}</h2>
      <div class="searching-spinner" aria-hidden="true"></div>
      ${body}
      ${showCancel?`<button class="btn btn-ghost" onclick="doQueueLeave()">✖ Cancelar búsqueda</button>`:""}
    </div></div>`; return;
  }
  if(step==="teamHub"){
    app.innerHTML=`<div class="screen-center"><div class="card ${G._enterCls}" style="text-align:center">
      <button class="card-x" onclick="G.netStep='joinRoom';render()" title="Cerrar">✕</button>
      <h2 style="font-family:var(--font-display);color:#ffe9a8;font-size:20px;margin-bottom:6px">🤝 2v2 en equipo</h2>
      <p style="font-size:11px;color:rgba(232,238,247,.55);margin-bottom:12px;line-height:1.4">Salas de 4 jugadores reales — el admin arma Equipo Azul y Equipo Rojo (2 y 2) antes de empezar. Sin IA de relleno.</p>
      ${G.message?`<p style="text-align:center;font-size:12px;color:#f87171;font-weight:700;background:rgba(220,38,38,.12);border:1px solid rgba(220,38,38,.3);border-radius:8px;padding:6px 10px;margin:0 0 10px">⚠ ${esc(G.message)}</p>`:""}
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="btn btn-gold" onclick="goCreateRoom('team2v2')" style="background:linear-gradient(180deg,#38bdf8,#0369a1);color:#fff">➕ Crear sala 2v2</button>
        <button class="btn btn-gold" onclick="G.netCategory='team2v2';G.netStep='enterCode';render()">🚪 Unirse a una sala</button>
        <button class="btn btn-gold" onclick="G.netCategory='team2v2';doListPublicRooms()" style="background:linear-gradient(180deg,#34d399,#059669);color:#04231a">🌍 Salas públicas 2v2</button>
      </div>
    </div></div>`; return;
  }
  if(step==="galacticoHub"){
    app.innerHTML=`<div class="screen-center"><div class="card galactico-card ${G._enterCls}" style="text-align:center">
      <button class="card-x" onclick="G.netStep='joinRoom';render()" title="Cerrar">✕</button>
      <div class="galactico-title-banner"><span>🪐</span><span>Modo Galáctico</span></div>
      <p style="font-size:11px;color:rgba(232,238,247,.55);margin-bottom:12px;line-height:1.4">El mazo tiene, además de las fichas normales, 20 fichas de habilidad especiales — te las quedás en la mano al robarlas y las podés usar (máximo 1 por turno) para robar, protegerte, bloquear, espiar y más. Se gana vaciando la mano de fichas normales, sin límite de tiempo ni puntaje.</p>
      ${G.message?`<p style="text-align:center;font-size:12px;color:#f87171;font-weight:700;background:rgba(220,38,38,.12);border:1px solid rgba(220,38,38,.3);border-radius:8px;padding:6px 10px;margin:0 0 10px">⚠ ${esc(G.message)}</p>`:""}
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="btn btn-gold" onclick="goCreateRoom('galactico')" style="background:linear-gradient(180deg,#a855f7,#5b21b6);color:#fff">➕ Crear sala Galáctico</button>
        <button class="btn btn-gold" onclick="G.netCategory='galactico';G.netStep='enterCode';render()">🚪 Unirse a una sala</button>
        <button class="btn btn-gold" onclick="G.netCategory='galactico';doListPublicRooms()" style="background:linear-gradient(180deg,#34d399,#059669);color:#04231a">🌍 Salas públicas Galáctico</button>
        <button class="btn btn-ghost" onclick="goGalacticoPass()">🎫 Pase Galáctico${galacticoPassLevel()>1?" · Nv"+galacticoPassLevel():""}</button>
      </div>
    </div></div>`; return;
  }
  if(step==="createRoom"){
    G.roomConf=G.roomConf||{turnSeconds:60,deckPct:100,initTiles:14,matchMinutes:0,winMode:"classic",gameMode:"casual",roomName:"",public:false};
    const rc=G.roomConf;
    if(!rc.gameMode) rc.gameMode=rc.createRanked?"ranked":"casual"; // compat con salas viejas
    const isTeam=rc.gameMode==="team2v2";
    const isGalactico=rc.gameMode==="galactico";
    const GAME_MODES=[
      ["casual","Casual","Partida libre: no suma ni resta puntos de rango, y no se apuesta nada."],
      ["ranked","🏆 Ranked","Al terminar, subís o bajás puntos de tu rango competitivo según el puesto."],
      ["monedas","🪙 Monedas","Cada jugador apuesta sus propias monedas al entrar; el mejor puesto se lleva más de vuelta."],
    ];
    const WIN_MODES=[
      ["classic","Clásico","Gana quien vacía el atril primero (o, si se acaba el pozo, quien tenga menos puntos en la mano)."],
      ["points","Puntaje","Gana apenas alguien llega a 200 puntos bajados a la mesa, sin necesidad de vaciar el atril."],
    ];
    const curMode=GAME_MODES.find(m=>m[0]===rc.gameMode)||GAME_MODES[0];
    const curWin=WIN_MODES.find(m=>m[0]===rc.winMode)||WIN_MODES[0];
    app.innerHTML=`<div class="screen-center"><div class="card ${G._enterCls}" style="max-height:92dvh;overflow-y:auto">
      <button class="card-x" onclick="G.netStep=hubStepFor(G.roomConf.gameMode);render()" title="Cerrar">✕</button>
      <h2 style="font-family:var(--font-display);color:#ffe9a8;font-size:18px;margin-bottom:10px;text-align:center">${isTeam?"🤝 Crear sala 2v2":isGalactico?"🌌 Crear sala Galáctico":"⚙️ Crear sala"}</h2>
      ${G.message?`<p style="text-align:center;font-size:12px;color:#f87171;font-weight:700;background:rgba(220,38,38,.12);border:1px solid rgba(220,38,38,.3);border-radius:8px;padding:6px 10px;margin:0 0 10px">⚠ ${esc(G.message)}</p>`:""}
      <div style="font-size:9px;color:rgba(232,238,247,.45);letter-spacing:1.5px;text-transform:uppercase;margin:4px 0 3px">Nombre de la sala</div>
      <input id="roomname" placeholder="${esc((G.serverProfile?G.serverProfile.username:P.name)+"'s sala")}" value="${esc(rc.roomName||"")}" maxlength="24" oninput="G.roomConf.roomName=this.value"
        style="width:100%;padding:9px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid rgba(184,150,63,.25);color:#fff;font-size:13px;margin-bottom:8px">
      <div style="font-size:9px;color:rgba(232,238,247,.45);letter-spacing:1.5px;text-transform:uppercase;margin:4px 0 3px">Visibilidad</div>
      <div style="display:flex;gap:3px;margin-bottom:4px">
        <button onclick="G.roomConf.public=false;render()" style="flex:1;border-radius:6px;padding:6px 1px;font-size:10px;font-weight:800;border:none;cursor:pointer;background:${!rc.public?'linear-gradient(180deg,#fcd34d,#f59e0b);color:#1a1200':'rgba(255,255,255,.08);color:#e8eef7'}">🔒 Privada</button>
        <button onclick="G.roomConf.public=true;render()" style="flex:1;border-radius:6px;padding:6px 1px;font-size:10px;font-weight:800;border:none;cursor:pointer;background:${rc.public?'linear-gradient(180deg,#fcd34d,#f59e0b);color:#1a1200':'rgba(255,255,255,.08);color:#e8eef7'}">🌍 Pública</button>
      </div>
      <p style="font-size:10px;color:rgba(232,238,247,.5);margin:0 0 10px;text-align:center;line-height:1.4">${rc.public?"Cualquiera va a poder verla en “Salas públicas” y unirse sin código.":"Solo se puede entrar con el código de 4 letras (no aparece en ningún listado)."}</p>
      ${isTeam?`
      <div style="font-size:9px;color:rgba(232,238,247,.45);letter-spacing:1.5px;text-transform:uppercase;margin:4px 0 3px">Modo de juego</div>
      <p style="font-size:10.5px;color:rgba(232,238,247,.6);margin:0 0 10px;text-align:center;line-height:1.4;background:rgba(56,189,248,.1);border:1px solid rgba(56,189,248,.3);border-radius:8px;padding:8px">🤝 2v2 en equipo — vas a poder armar Equipo Azul y Equipo Rojo (2 y 2) en la sala de espera, antes de empezar.</p>
      `:isGalactico?`
      <div style="font-size:9px;color:rgba(232,238,247,.45);letter-spacing:1.5px;text-transform:uppercase;margin:4px 0 3px">Modo de juego</div>
      <p style="font-size:10.5px;color:rgba(232,238,247,.6);margin:0 0 10px;text-align:center;line-height:1.4;background:rgba(168,85,247,.1);border:1px solid rgba(168,85,247,.3);border-radius:8px;padding:8px">🌌 Modo Galáctico — 20 fichas de habilidad mezcladas en el mazo, todos contra todos. Se gana vaciando las fichas normales de la mano.</p>
      `:`
      <div style="font-size:9px;color:rgba(232,238,247,.45);letter-spacing:1.5px;text-transform:uppercase;margin:4px 0 3px">Modo de juego</div>
      <div style="display:flex;gap:3px;margin-bottom:4px">${GAME_MODES.map(([v,l])=>`<button onclick="G.roomConf.gameMode='${v}';render()" style="flex:1;border-radius:6px;padding:6px 1px;font-size:10px;font-weight:800;border:none;cursor:pointer;background:${rc.gameMode===v?'linear-gradient(180deg,#fcd34d,#f59e0b);color:#1a1200':'rgba(255,255,255,.08);color:#e8eef7'}">${l}</button>`).join("")}</div>
      <p style="font-size:10px;color:rgba(232,238,247,.5);margin:0 0 10px;text-align:center;line-height:1.4">${curMode[2]}</p>
      `}
      <button class="btn-sm" style="width:100%;margin:6px 0 4px;border-radius:8px;background:rgba(255,255,255,.06);color:rgba(232,238,247,.8);display:flex;justify-content:space-between;align-items:center;padding:8px 10px" onclick="G._roomConfAdvancedOpen=!G._roomConfAdvancedOpen;render()">
        <span>⚙ Opciones avanzadas</span><span>${G._roomConfAdvancedOpen?"▲":"▼"}</span>
      </button>
      ${G._roomConfAdvancedOpen?`
      <div style="font-size:9px;color:rgba(232,238,247,.45);letter-spacing:1.5px;text-transform:uppercase;margin:8px 0 3px">Tiempo por turno</div>
      <div style="display:flex;gap:3px;margin-bottom:4px">${[10,30,45,60,90].map(s=>`<button onclick="G.roomConf.turnSeconds=${s};render()" style="flex:1;border-radius:6px;padding:5px 1px;font-size:10px;font-weight:800;border:none;cursor:pointer;background:${rc.turnSeconds===s?'linear-gradient(180deg,#fcd34d,#f59e0b);color:#1a1200':'rgba(255,255,255,.08);color:#e8eef7'}">${s}s</button>`).join("")}</div>
      <p style="font-size:10px;color:rgba(232,238,247,.5);margin:0 0 10px;text-align:center;line-height:1.4">Cuánto tenés para jugar en tu turno antes de comerte 3 fichas del pozo por vencerte.</p>
      <div style="font-size:9px;color:rgba(232,238,247,.45);letter-spacing:1.5px;text-transform:uppercase;margin:4px 0 3px">Fichas iniciales</div>
      <div style="display:flex;gap:3px;margin-bottom:8px">${[7,10,14,18].map(n=>`<button onclick="G.roomConf.initTiles=${n};render()" style="flex:1;border-radius:6px;padding:5px 1px;font-size:10px;font-weight:800;border:none;cursor:pointer;background:${rc.initTiles===n?'linear-gradient(180deg,#fcd34d,#f59e0b);color:#1a1200':'rgba(255,255,255,.08);color:#e8eef7'}">${n}${n===14?" ★":""}</button>`).join("")}</div>
      <div style="font-size:9px;color:rgba(232,238,247,.45);letter-spacing:1.5px;text-transform:uppercase;margin:4px 0 3px">Tamaño del mazo</div>
      <div style="display:flex;gap:3px;margin-bottom:8px">${[25,50,75,100].map(p=>`<button onclick="G.roomConf.deckPct=${p};render()" style="flex:1;border-radius:6px;padding:5px 1px;font-size:10px;font-weight:800;border:none;cursor:pointer;background:${rc.deckPct===p?'linear-gradient(180deg,#fcd34d,#f59e0b);color:#1a1200':'rgba(255,255,255,.08);color:#e8eef7'}">${p}%</button>`).join("")}</div>
      <div style="font-size:9px;color:rgba(232,238,247,.45);letter-spacing:1.5px;text-transform:uppercase;margin:4px 0 3px">Límite de tiempo</div>
      <div style="display:flex;gap:3px;margin-bottom:4px">${[[0,"∞"],[10,"10m"],[20,"20m"],[30,"30m"],[45,"45m"],[60,"60m"]].map(([m,l])=>`<button onclick="G.roomConf.matchMinutes=${m};render()" style="flex:1;border-radius:6px;padding:5px 1px;font-size:10px;font-weight:800;border:none;cursor:pointer;background:${rc.matchMinutes===m?'linear-gradient(180deg,#fcd34d,#f59e0b);color:#1a1200':'rgba(255,255,255,.08);color:#e8eef7'}">${l}</button>`).join("")}</div>
      <p style="font-size:10px;color:rgba(232,238,247,.5);margin:0 0 10px;text-align:center;line-height:1.4">${isGalactico?"Duración máxima de la partida entera. Al agotarse, termina y gana quien tenga menos puntos en fichas normales en la mano.":"Duración máxima de la partida entera. Al agotarse, termina y gana quien tenga menos puntos en la mano."}</p>
      ${isGalactico?`
      <p style="font-size:10px;color:rgba(232,238,247,.5);margin:0 0 10px;text-align:center;line-height:1.4">🌌 Este modo se gana únicamente vaciando las fichas normales del atril (sin variante por puntaje).</p>
      `:`
      <div style="font-size:9px;color:rgba(232,238,247,.45);letter-spacing:1.5px;text-transform:uppercase;margin:4px 0 3px">Modo de victoria</div>
      <div style="display:flex;gap:3px;margin-bottom:4px">${WIN_MODES.map(([v,l])=>`<button onclick="G.roomConf.winMode='${v}';render()" style="flex:1;border-radius:6px;padding:5px 1px;font-size:10px;font-weight:800;border:none;cursor:pointer;background:${rc.winMode===v?'linear-gradient(180deg,#fcd34d,#f59e0b);color:#1a1200':'rgba(255,255,255,.08);color:#e8eef7'}">${l}</button>`).join("")}</div>
      <p style="font-size:10px;color:rgba(232,238,247,.5);margin:0 0 12px;text-align:center;line-height:1.4">${curWin[2]}</p>
      `}
      `:""}
      <p style="font-size:10px;color:rgba(232,238,247,.45);margin:10px 0;text-align:center">Sos el <b style="color:#ffe9a8">👑 administrador</b> de la sala</p>
      <button class="btn btn-gold" ${G._lobbyPending==="create"?"disabled":""} onclick="doCreateRoom()">${G._lobbyPending==="create"?"⏳ Creando sala…":"✔ Crear sala"}</button>
    </div></div>`; return;
  }
  if(step==="enterCode"){
    const cat=G.netCategory;
    const catLabel=cat==="team2v2"?" 2v2":cat==="galactico"?" Galáctico":"";
    app.innerHTML=`<div class="screen-center"><div class="card ${G._enterCls}" style="text-align:center">
      <button class="card-x" onclick="G.netStep=hubStepFor(G.netCategory);render()" title="Cerrar">✕</button>
      <h2 style="font-family:var(--font-display);color:#ffe9a8;font-size:20px;margin-bottom:12px">Unirse a sala${catLabel}</h2>
      ${G.message?`<p style="text-align:center;font-size:12px;color:#f87171;font-weight:700;background:rgba(220,38,38,.12);border:1px solid rgba(220,38,38,.3);border-radius:8px;padding:6px 10px;margin:0 0 10px">⚠ ${esc(G.message)}</p>`:""}
      <label class="lbl">Código de sala (4 letras)</label>
      <input id="netroom" placeholder="ABCD" onkeydown="if(event.key==='Enter')doJoinExistingRoom()" style="text-transform:uppercase;width:100%;padding:14px;border-radius:9px;background:rgba(255,255,255,.06);border:1px solid rgba(184,150,63,.25);color:#ffe9a8;font-size:24px;letter-spacing:6px;text-align:center;font-weight:800;margin-bottom:10px" maxlength="4">
      <button class="btn btn-gold" ${G._lobbyPending==="join"?"disabled":""} onclick="doJoinExistingRoom()">${G._lobbyPending==="join"?"⏳ Uniéndose…":"🚪 Entrar"}</button>
    </div></div>`; return;
  }
  if(step==="publicRooms"){
    const cat=G.netCategory;
    const catLabel=cat==="team2v2"?" 2v2":cat==="galactico"?" Galáctico":"";
    const list=(G.publicRooms||[]).filter(r=>cat==="team2v2"||cat==="galactico"?r.gameMode===cat:(r.gameMode!=="team2v2"&&r.gameMode!=="galactico"));
    app.innerHTML=`<div class="screen-center"><div class="card ${G._enterCls}" style="max-height:85dvh;overflow-y:auto">
      <button class="card-x" onclick="G.netStep=hubStepFor(G.netCategory);render()" title="Cerrar">✕</button>
      <h2 style="font-family:var(--font-display);color:#ffe9a8;font-size:20px;text-align:center;margin-bottom:10px">${cat==="team2v2"?"🤝 Salas públicas 2v2":cat==="galactico"?"🌌 Salas públicas Galáctico":"🌍 Salas públicas"}</h2>
      ${G.message?`<p style="text-align:center;font-size:12px;color:#f87171;font-weight:700;background:rgba(220,38,38,.12);border:1px solid rgba(220,38,38,.3);border-radius:8px;padding:6px 10px;margin:0 0 10px">⚠ ${esc(G.message)}</p>`:""}
      ${list.length?list.map(r=>`<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:9px;margin-bottom:5px;background:rgba(0,0,0,.2);border:1px solid rgba(184,150,63,.15)">
        <div style="flex:1;min-width:0">
          <div style="font-weight:800;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.name)}</div>
          <div style="font-size:10.5px;color:rgba(232,238,247,.55)">👑 ${esc(r.adminName)} · ${r.playerCount}/${r.maxPlayers} · ${r.gameMode==="ranked"?"🏆 Ranked":r.gameMode==="monedas"?"🪙 Monedas":r.gameMode==="team2v2"?"🤝 2v2":r.gameMode==="galactico"?"🌌 Galáctico":"Casual"}</div>
        </div>
        <button class="btn-sm" ${G._lobbyPending==="join"?"disabled":""} style="border-radius:8px;background:linear-gradient(180deg,#fcd34d,#f59e0b);color:#1a1200;flex-shrink:0" onclick="doJoinPublicRoom('${r.code}')">${G._lobbyPending==="join"?"⏳ Uniéndose…":"Unirse"}</button>
      </div>`).join(""):`<p style="text-align:center;color:rgba(232,238,247,.5)">No hay salas públicas${catLabel} abiertas ahora mismo.</p>`}
      <button class="btn btn-ghost" style="margin-top:8px" onclick="doListPublicRooms()">↻ Actualizar</button>
    </div></div>`; return;
  }
  if(step==="leaderboard"){
    const lb=G.leaderboardData||[];
    app.innerHTML=`<div class="screen-center"><div class="card ${G._enterCls}" style="max-height:85dvh;overflow-y:auto">
      <button class="card-x" onclick="G.netStep='joinRoom';render()" title="Cerrar">✕</button>
      <h2 style="font-family:var(--font-display);color:#ffe9a8;font-size:20px;text-align:center;margin-bottom:10px">🏅 Tabla de posiciones</h2>
      ${lb.length?lb.map((p,i)=>{const t=tierOf(p.rankPts);return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;border-radius:8px;margin-bottom:4px;background:${i<3?"rgba(251,191,36,.1)":"rgba(0,0,0,.2)"};border:1px solid ${i<3?"rgba(251,191,36,.3)":"rgba(184,150,63,.12)"}"><span style="font-weight:800;width:28px;color:${i===0?"#fcd34d":i===1?"#d1d5db":i===2?"#d97706":"rgba(232,238,247,.6)"}">${i+1}°</span><span style="flex:1;font-weight:700">${esc(p.username)}</span><span style="font-size:11px;color:rgba(232,238,247,.6)">${tierBadgeHTML(t,13)} ${p.rankPts} · Nv${p.level||1} · ${p.stats?p.stats.wins:0}W · 🔥${p.stats?p.stats.bestStreak:0}</span></div>`;}).join(""):`<p style="text-align:center;color:rgba(232,238,247,.5)">Sin jugadores registrados.</p>`}
    </div></div>`; return;
  }
}
// Mapea la categoría de sala (ffa/team2v2/galactico) al "hub" al que hay que
// volver — un solo lugar en vez de repetir el mismo ternario en cada pantalla.
function hubStepFor(cat){ return cat==="team2v2"?"teamHub":cat==="galactico"?"galacticoHub":"ffaHub"; }
function goCreateRoom(cat){
  G.netCategory=cat;
  G.roomConf=G.roomConf||{turnSeconds:60,deckPct:100,initTiles:14,matchMinutes:0,winMode:"classic",gameMode:"casual",roomName:"",public:false};
  if(cat==="team2v2"||cat==="galactico") G.roomConf.gameMode=cat;
  else if(G.roomConf.gameMode==="team2v2"||G.roomConf.gameMode==="galactico") G.roomConf.gameMode="casual"; // veníamos de armar una sala 2v2/galáctico y cambiamos de categoría
  G.netStep="createRoom"; render();
}
async function doNetConnect(){
  const host=document.querySelector("#nethost").value.trim();
  localStorage.setItem("burako_lan_host",host);
  try{
    G.online=true; G.rack=Array(RACK_SLOTS).fill(null); G.reserve=[];
    await netConnect(host);
    G.serverConnected=true;
    G.authIntent="joinRoom"; G.authMode="login"; G.authStep="login";
    G.screen="auth"; render();
  }
  catch(e){ G.online=false; const el=document.querySelector("#neterr"); if(el) el.textContent=e.message; }
}
// Antes de cualquier acción de sala (crear/unirse/listar), asegura que el WS
// esté realmente abierto — si se cortó (Render se durmió, wifi cortado un
// instante) netSend() fallaba en silencio y el botón "no hacía nada". Ahora
// reconecta con reintentos y avisa con un mensaje visible si no puede.
// Fase 3: ahora pasa SIEMPRE por resumeSessionSilently() en vez de abrir un
// socket "pelado" con connectWithRetry — antes era el único camino de
// reconexión que se saltaba la reautenticación (hallazgo #4/#7 de la
// auditoría): si el socket se había caído fuera de una partida, "Crear
// sala"/"Unirse"/matchmaking podían terminar mandando mensajes sobre un
// socket que el servidor nunca vio autenticarse. Como resumeSessionSilently
// ya tiene su propio mutex compartido (G._sessionOpInFlight), esto además
// hace que ensureConnected() sea naturalmente idempotente: dos callers
// concurrentes esperan la MISMA operación en vez de pisarse el socket entre
// sí (que era justo lo que producía el toast "Reconectando…" repetido).
async function ensureConnected(){
  if(NET.ws&&NET.ws.readyState===1) return true;
  const res=await resumeSessionSilently({onStatus:(t)=>{ setMsg(t); render(); }});
  if(res.ok) return true;
  if(res.reason==="expired") return false; // resumeSessionSilently ya dejó todo consistente (login de nuevo)
  if(res.reason!=="no-token"){
    setMsg("⚠ No se pudo conectar al servidor. Probá de nuevo en un momento."); render();
    return false;
  }
  // Caso límite: nunca hubo sesión guardada (no debería pasar en este punto
  // del flujo real, ver goOnlineConnect, pero se cubre por las dudas) — cae
  // a solo asegurar transporte, mismo comportamiento que existía antes.
  setMsg("Reconectando…"); render();
  const ok=await connectWithRetry(defaultHost(),{onStatus:(t)=>{ setMsg(t); render(); }});
  if(!ok){ setMsg("⚠ No se pudo conectar al servidor. Probá de nuevo en un momento."); render(); return false; }
  G.serverConnected=true;
  return true;
}
async function doCreateRoom(){
  if(!(await ensureConnected())) return;
  markLobbyPending("create"); render();
  const rc=G.roomConf||{};
  const gameMode=rc.gameMode||"casual";
  const name=G.serverProfile?G.serverProfile.username:P.name;
  netSend({type:"join", room:"NUEVA", name, roomName:(rc.roomName||"").trim(), public:!!rc.public, ranked: gameMode==="ranked", gameMode, skin: P.skin||"clasica"});
  setTimeout(()=>{
    netSend({type:"roomConfig", turnSeconds:rc.turnSeconds||60, deckPct:rc.deckPct||100, initTiles:rc.initTiles||14, matchMinutes:rc.matchMinutes||0, winMode:rc.winMode||"classic", gameMode});
  }, 300);
}
async function doJoinExistingRoom(){
  const room=document.querySelector("#netroom").value.trim().toUpperCase();
  if(!room||room.length!==4){ setMsg("Ingresá un código de 4 letras."); render(); return; }
  if(!(await ensureConnected())) return;
  markLobbyPending("join"); render();
  netSend({type:"join", room, name: G.serverProfile?G.serverProfile.username:P.name, skin: P.skin||"clasica"});
}
async function doListPublicRooms(){
  G.netStep="publicRooms"; G.publicRooms=G.publicRooms||[]; render();
  if(!(await ensureConnected())) return;
  netSend({type:"listRooms"});
}

/* ================================================================
   Ruleta diaria (v1.3) — 100% server-authoritative: el servidor decide fecha
   (Uruguay), racha y premio; acá solo se pide el estado y se anima el
   resultado que ya vino confirmado. Sin polling ni timers: se consulta una
   sola vez al entrar a la pantalla (ver Performance en la spec de la tarea).
   ================================================================ */
async function goDailyRoulette(){
  if(!Session.isAuthenticated()){ goOnlineConnect(); return; } // requiere estar logueado online — mismo flujo que "Multijugador"
  if(!(await ensureConnected())) return;
  G.screen="dailyRoulette"; G.dailyLoading=true; G.dailyResult=null; G.dailySpinning=false; render();
  netSend({type:"dailyStatus"});
}
function doDailySpin(){
  if(G.dailySpinning||G.dailyClaimedToday||G.dailyLoading) return; // bloquea doble click
  Sound.init(); Sound.select();
  G.dailySpinning=true; G.dailyResult=null; render();
  netSend({type:"dailySpin"});
}
/* ================================================================
   Torre semanal (v1.3) — 100% server-authoritative: el servidor decide
   semana (Uruguay), piso disponible, rival e IA por piso, y resultado. Acá
   solo se pide el estado (una vez al entrar, y de nuevo al volver de una
   partida) y se arranca el piso actual — nunca un piso elegido a mano.
   ================================================================ */
async function goTower(){
  if(!Session.isAuthenticated()){ goOnlineConnect(); return; }
  if(!(await ensureConnected())) return;
  G.screen="tower"; G.towerLoading=true; render();
  netSend({type:"towerStatus"});
}
function doTowerStart(){
  if(G.towerStarting||G.towerLoading||G.towerComplete) return; // bloquea doble click
  if((G.towerLives||0)<=0) return; // sin intentos esta semana en esta Torre — el servidor lo rechaza igual, esto es solo defensa en el cliente
  Sound.init(); Sound.select();
  G.towerStarting=true; render();
  netSend({type:"towerStart", name: G.serverProfile?G.serverProfile.username:P.name, skin: P.skin||"clasica"});
}
// Espejo del server (server/db.js TOWER_PRIZES/TOWER_DIFFICULTY, v2 — 3
// Torres x 10 pisos) — SOLO para pintar el mapa (premio/dificultad/rival de
// cada piso de la Torre ACTIVA). El servidor sigue siendo la única fuente
// real de qué piso está disponible y qué se otorga.
const TOWER_PRIZES_DISPLAY={
  1:{
    1:{coins:60,xp:20}, 2:{coins:75,xp:25}, 3:{coins:100,xp:30}, 4:{coins:140,xp:45},
    5:{coins:190,xp:65}, 6:{coins:240,xp:85}, 7:{coins:320,xp:110}, 8:{coins:400,xp:140},
    9:{coins:500,xp:180,item:"Relámpago de Torre ⚡"}, 10:{coins:700,xp:250,item:"Torre Celestial 🏰"},
  },
  2:{
    1:{coins:110,xp:35}, 2:{coins:140,xp:45}, 3:{coins:180,xp:55}, 4:{coins:230,xp:75},
    5:{coins:300,xp:100}, 6:{coins:380,xp:130}, 7:{coins:480,xp:165}, 8:{coins:600,xp:210},
    9:{coins:750,xp:260,item:"🏆 Guardián Carmesí"}, 10:{coins:1000,xp:350,item:"Fichas del Escarlata 🔥"},
  },
  3:{
    1:{coins:180,xp:60}, 2:{coins:230,xp:75}, 3:{coins:300,xp:95}, 4:{coins:380,xp:125},
    5:{coins:500,xp:165}, 6:{coins:640,xp:215}, 7:{coins:800,xp:270}, 8:{coins:1000,xp:340},
    9:{coins:1250,xp:420,item:"Corona Dorada 👑"}, 10:{coins:1800,xp:600,item:"Fichas del Titán Dorado 👑"},
  },
};
// Nombre/ícono de "cofre" que se le pone a algunos pisos en la UI — es solo
// presentación por ahora (el sistema real de 5 tiers de cofre con loot
// diferido se suma en un bloque aparte), no cambia el premio real del piso.
const TOWER_FLOOR_CHEST_LABEL={3:"📦 Cofre Común",5:"🎁 Cofre Raro",7:"💜 Cofre Épico"};
// Espejo de TOWER_COMPLETE_BONUS/TOWER_RUN_COMPLETE_BONUS en server/db.js —
// bonus aparte por completar cada Torre, y el bonus extra por completar
// las 3 en la misma semana.
const TOWER_COMPLETE_BONUS_DISPLAY={
  1:{coins:500,xp:200,title:"ascendente"}, 2:{coins:800,xp:300,title:"forjado_en_fuego"}, 3:{coins:1500,xp:500,title:"leyenda_dorada"},
};
const TOWER_RUN_COMPLETE_BONUS_DISPLAY={coins:500,title:"conquistador_de_la_torre"};
const TOWER_META_DISPLAY={1:{name:"Violeta"},2:{name:"Roja"},3:{name:"Dorada"}};
function towerCompleteBonusLabel(towerId){
  const b=TOWER_COMPLETE_BONUS_DISPLAY[towerId||G.towerTower||1];
  const t=b.title&&TITLES[b.title];
  return "🪙 "+b.coins+" + ⭐ "+b.xp+" XP"+(t?" + 🏆 "+t.label:"");
}
function towerRunCompleteBonusLabel(){
  const b=TOWER_RUN_COMPLETE_BONUS_DISPLAY, t=b.title&&TITLES[b.title];
  return "🪙 "+b.coins+(t?" + 🏆 "+t.label:"");
}
// [v1.3.4] Abrir el regalo en el gameover confirma las DOS cosas que se
// ganaron en este mismo instante (el piso Y, si corresponde, el bonus de
// completar esa Torre) — ambos ya están pagados, esto solo los marca como
// vistos. sourceId se reconstruye acá porque esto viene de una partida
// recién jugada (siempre formato nuevo, nunca una fila vieja pre-v2).
function ackTowerGameoverGift(){
  const mr=G.matchResult; if(!mr) return;
  G._towerGiftOpened=true;
  const tower=mr.towerTower||1;
  netSend({type:"towerAcknowledge", kind:"floor", sourceId:mr.towerWeekId+":"+tower+":"+mr.towerFloor});
  if(mr.towerResult&&mr.towerResult.complete) netSend({type:"towerAcknowledge", kind:"complete", sourceId:mr.towerWeekId+":"+tower});
  render();
}
const TOWER_DIFFICULTY_DISPLAY={
  1:{1:"easy",2:"easy",3:"easy",4:"normal",5:"normal",6:"normal",7:"hard",8:"hard",9:"hard",10:"expert"},
  2:{1:"normal",2:"normal",3:"normal",4:"hard",5:"hard",6:"hard",7:"hard",8:"hard",9:"hard",10:"expert"},
  3:{1:"hard",2:"hard",3:"hard",4:"expert",5:"expert",6:"expert",7:"claude",8:"claude",9:"claude",10:"claude"},
};
const TOWER_DIFF_LABEL={easy:"Fácil",normal:"Normal",hard:"Difícil",expert:"Experto",claude:"Claude"};
// Fallback genérico — solo se usa si algún piso no estuviera en el roster
// de abajo (no debería pasar nunca, los 30 están cubiertos).
const TOWER_RIVAL_NAME={easy:"Aprendiz",normal:"Retador",hard:"Veterano",expert:"Maestro",claude:"Claude"};
// [Torre — 30 rivales, bloque 4] Espejo de DB.TOWER_RIVALS en server/db.js
// — SOLO nombre/avatar/jefe para pintar el mapa y la presentación previa a
// la partida. La dificultad/personalidad real las decide el servidor.
const TOWER_RIVALS_DISPLAY={
  1:{
    1:{name:"Iniciado Bruma",avatar:"🌫️"}, 2:{name:"Aprendiz Espina",avatar:"🥀"}, 3:{name:"Centinela Gris",avatar:"🗿"},
    4:{name:"Errante del Bosque",avatar:"🌲"}, 5:{name:"Vigía Escarcha",avatar:"❄️"}, 6:{name:"Cazador de Sombras",avatar:"🐺"},
    7:{name:"Heraldo Violeta",avatar:"🔮"}, 8:{name:"Duelista Nocturno",avatar:"🗡️"}, 9:{name:"Guardiana del Umbral",avatar:"🕯️"},
    10:{name:"Señor Amatista",avatar:"👑",boss:true},
  },
  2:{
    1:{name:"Soldado Carmesí",avatar:"⚔️"}, 2:{name:"Verdugo de Brasas",avatar:"🔥"}, 3:{name:"Estratega de Hierro",avatar:"⚙️"},
    4:{name:"Centinela de Cenizas",avatar:"🌋"}, 5:{name:"Arquitecta de Fuego",avatar:"🏗️"}, 6:{name:"Cazadora Escarlata",avatar:"🏹"},
    7:{name:"Maestro Forjador",avatar:"🔨"}, 8:{name:"Guardián de Magma",avatar:"🪨"}, 9:{name:"Comandante Carmesí",avatar:"🎖️"},
    10:{name:"Emperatriz de Brasas",avatar:"👑",boss:true},
  },
  3:{
    1:{name:"Custodio Áureo",avatar:"🛡️"}, 2:{name:"Portador del Ocaso",avatar:"🌅"}, 3:{name:"Tejedora Celestial",avatar:"✨"},
    4:{name:"Centinela del Eclipse",avatar:"🌑"}, 5:{name:"Oráculo Dorado",avatar:"🔱"}, 6:{name:"Heraldo del Vacío",avatar:"🌀"},
    7:{name:"Guardián Ancestral",avatar:"🗿"}, 8:{name:"Campeona Solar",avatar:"☀️"}, 9:{name:"Sabio del Trono",avatar:"📜"},
    10:{name:"El Soberano Dorado",avatar:"👑",boss:true},
  },
};
function towerRivalFor(towerId,floor){
  return (TOWER_RIVALS_DISPLAY[towerId]||{})[floor]||null;
}
function towerFloorPrizeLabel(floor,towerId){
  const p=(TOWER_PRIZES_DISPLAY[towerId||G.towerTower||1]||{})[floor]; if(!p) return "";
  const parts=[];
  if(p.coins) parts.push("🪙 "+p.coins);
  if(p.xp) parts.push("⭐ "+p.xp+" XP");
  if(p.item) parts.push(p.item);
  return parts.join(" + ");
}
// [v1.3.4] Formatea lo que el servidor REALMENTE otorgó (mr.towerResult.
// rewards) — puede diferir de towerFloorPrizeLabel si un cosmético exclusivo
// se convirtió a monedas por ya tenerlo de una semana anterior (ver
// resolveTowerRewards/TOWER_ITEM_DUPLICATE_COINS en server/db.js). Usar esto
// en el momento de la revelación evita mostrarle al jugador un ítem que en
// realidad no recibió esta vez.
// [Cofres de Torre] Los cofres pueden dar cualquier categoría de cosmético
// (skin/tapete/effect/trail), no solo efectos — busca en el catálogo real
// que corresponda a itemType en vez de asumir siempre EFFECTS.
function towerItemCatalogName(itemType,itemId){
  const table={skin:SKINS,tapete:TAPETES,effect:EFFECTS,trail:TRAILS,soundfx:SOUNDFX}[itemType];
  const found=(table||[]).find(x=>x.id===itemId);
  return found?found.name:itemId;
}
function formatTowerRewardsReal(rewards,floor){
  if(!rewards||!rewards.length) return towerFloorPrizeLabel(floor);
  const parts=[];
  let coins=0, xp=0;
  rewards.forEach(r=>{
    if(r.type==="coins") coins+=r.amount;
    else if(r.type==="xp") xp+=r.amount;
    else if(r.type==="item") parts.push(towerItemCatalogName(r.itemType,r.itemId));
    else if(r.type==="title"){ const t=TITLES[r.itemId]; parts.push(t?("🏆 "+t.label):r.itemId); }
  });
  const out=[];
  if(coins) out.push("🪙 "+coins);
  if(xp) out.push("⭐ "+xp+" XP");
  return out.concat(parts).join(" + ");
}
// x/y ya vienen resueltos por towerMapHTML() (x en % de zigzag, y en px
// absolutos) — esta función solo arma el nodo+tarjeta de un piso.
function towerFloorNodeHTML(floor,status,x,y,side,pendingSourceId,pendingChestId){
  const towerId=G.towerTower||1;
  const diff=TOWER_DIFFICULTY_DISPLAY[towerId][floor];
  const isTop=floor===10;
  // Dos fuentes de "pendiente" independientes (premio de piso vs. cofre) —
  // cualquiera de las dos alcanza para mostrar el ícono de regalo. Si hay
  // cofre pendiente, tocar el piso abre ESE cofre primero (es lo más nuevo/
  // interesante); si solo queda el premio de piso por reconocer, abre ese.
  const pending=!!pendingSourceId||!!pendingChestId;
  // [v1.3.4 — premios pendientes] "pending" es un piso YA superado (el
  // premio ya está pagado) pero que el jugador todavía no abrió/vio — se
  // distingue de "done" (superado Y ya visto) con un ícono de regalo
  // brillante en vez del check, para que sea obvio que hay algo para tocar.
  const icon=isTop?"👑":pending?"🎁":status==="done"?"✔":status==="current"?"▶":"🔒";
  const chestLabel=TOWER_FLOOR_CHEST_LABEL[floor];
  const prizeHTML=status==="locked"
    ?`<span class="tower-floor-prize-mystery">🎁 ???</span>`
    :`${chestLabel?chestLabel+" · ":""}🎁 ${towerFloorPrizeLabel(floor,towerId)}`;
  // "sinIntentos": es el piso actual pero la Torre se quedó sin vidas esta
  // semana — no se puede reintentar hasta el reset del lunes.
  const sinIntentos=status==="current"&&(G.towerLives||0)<=0;
  const clickAction=pendingChestId?`openTowerChestQueue([{id:${JSON.stringify(pendingChestId)}}])`
    :pendingSourceId?`openTowerRewardQueue([{kind:'floor',sourceId:'${pendingSourceId}'}])`
    :`scrollToTowerFloor(${floor})`;
  return `<div class="tower-floor tower-floor-${status}${isTop?" tower-floor-top":""}${pending?" tower-floor-pending":""} side-${side}" style="left:${x}%;top:${y}px" data-tower-floor="${floor}" onclick="${clickAction}">
    <div class="tower-floor-node">${icon}</div>
    <div class="tower-floor-card">
      <div class="tower-floor-title">Piso ${floor}<span class="tower-floor-diff">${TOWER_DIFF_LABEL[diff]||diff}</span></div>
      <div class="tower-floor-meta">${(()=>{const r=towerRivalFor(towerId,floor); return r?r.avatar+" "+esc(r.name):(diff==="claude"?"🧠":"🤖")+" "+(TOWER_RIVAL_NAME[diff]||"Rival");})()} · ${prizeHTML}</div>
      ${pending?`<div class="tower-floor-pending-hint">Tocá para reclamar</div>`:""}
      ${status==="current"&&!sinIntentos?`<button class="tower-floor-play" onclick="event.stopPropagation();doTowerStart()" ${G.towerStarting?"disabled":""}>${G.towerStarting?"…":"JUGAR"}</button>`:""}
      ${sinIntentos?`<div class="tower-floor-pending-hint">Sin intentos esta semana — volvé el lunes</div>`:""}
    </div>
  </div>`;
}
// [v1.3.2] Tocar cualquier piso (bloqueado o no) lo centra en pantalla con un
// scroll suave — pura navegación, no cambia qué piso se puede jugar (eso lo
// sigue decidiendo únicamente el servidor en doTowerStart()).
function scrollToTowerFloor(floor){
  // Un click manual siempre gana contra el paneo automático al piso actual
  // (ver renderTower(), que programa ese paneo 500ms después de cada
  // render) — si no se cancela ese timer, podía "ganarle" al click del
  // jugador y arrastrar la vista de vuelta al piso actual justo después.
  clearTimeout(G._towerScrollT);
  const reduceMotion=window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el=document.querySelector(`[data-tower-floor="${floor}"]`);
  if(el) el.scrollIntoView({behavior:reduceMotion?"auto":"smooth", block:"center"});
}
// Senda serpenteante (v1.3.1, reemplaza la lista plana de 10 filas): piso 10
// arriba, piso 1 abajo, en zigzag conectado por una línea animada. Las
// posiciones X van en % (no px) a propósito — así el path del SVG (mismo
// sistema de coordenadas 0-100) queda alineado con los nodos sin importar el
// ancho real de la tarjeta en cada pantalla.
// [v1.3.4 — premios pendientes] Abre los regalos pendientes de a uno, en el
// orden que vengan (más viejo primero, ver getPendingTowerRewards). La
// plata/ítem de cada uno YA está pagada desde que se superó ese piso —
// "abrir" acá es la animación + avisarle al servidor que ya lo vio
// (towerAcknowledge), para que dos clicks o un reintento de red nunca
// puedan volver a pagarlo (idempotente del lado servidor) ni mostrarlo dos
// veces como pendiente.
function openTowerRewardQueue(items){
  if(!items||!items.length) return;
  G._towerRevealQueue=items.slice();
  const cur=G._towerRevealQueue[0];
  netSend({type:"towerAcknowledge", kind:cur.kind, sourceId:cur.sourceId});
  render();
}
function closeTowerRevealQueue(){
  if(!G._towerRevealQueue||!G._towerRevealQueue.length) return;
  G._towerRevealQueue.shift();
  const next=G._towerRevealQueue[0];
  if(next) netSend({type:"towerAcknowledge", kind:next.kind, sourceId:next.sourceId});
  else G._towerRevealQueue=null;
  render();
}
function towerRevealModalHTML(){
  const item=G._towerRevealQueue&&G._towerRevealQueue[0]; if(!item) return "";
  const remaining=G._towerRevealQueue.length-1;
  const label=item.kind==="run_complete"?"👑 ¡Las 3 Torres completas!":item.kind==="complete"?`🏆 Torre ${(TOWER_META_DISPLAY[item.tower]||{}).name||""} completa`:`🏰 Piso ${item.floor} superado`;
  const prize=item.kind==="run_complete"?towerRunCompleteBonusLabel():item.kind==="complete"?towerCompleteBonusLabel(item.tower):towerFloorPrizeLabel(item.floor,item.tower);
  return `<div class="pauseovl" onclick="if(event.target===this)closeTowerRevealQueue()">
    <div class="pausecard a-pop" style="text-align:center">
      <div style="font-size:46px;margin-bottom:6px">🎁</div>
      <h2 style="font-family:var(--font-heading);color:#ffe9a8;font-size:18px;margin-bottom:6px">${label}</h2>
      <div class="tower-gift-prize a-pop">${prize}</div>
      <button class="btn btn-gold" style="margin-top:14px" onclick="closeTowerRevealQueue()">${remaining>0?"Siguiente ("+remaining+" más) →":"¡Genial!"}</button>
    </div>
  </div>`;
}
// Mapa piso->sourceId de los pendientes de piso de la Torre ACTIVA (no de
// las otras 2) — el mapa serpenteante solo pinta la Torre en curso.
function towerPendingFloorMap(){
  const map=new Map();
  (G.towerPending||[]).forEach(p=>{ if(p.kind==="floor"&&p.tower===(G.towerTower||1)) map.set(p.floor,p.sourceId); });
  return map;
}
// [Cofres de Torre — bloque 2] Igual que towerPendingFloorMap pero para
// cofres sin abrir de la Torre activa (mapa piso->chestId).
function towerPendingChestFloorMap(){
  const map=new Map();
  (G.towerPendingChests||[]).forEach(c=>{ if(c.tower===(G.towerTower||1)) map.set(c.floor,c.id); });
  return map;
}
const TOWER_CHEST_TIER_LABEL={
  kombatiente:"⚔️ Cofre Kombatiente", reino:"🏰 Cofre del Reino", ancestral:"🗿 Cofre Ancestral",
  conquistador:"👑 Cofre del Conquistador", titan:"🔥 Cofre del Titán",
};
// Abre cofres de a uno — el contenido de cada uno llega recién por WS
// (towerChestOpened) porque el sorteo real es server-side; acá solo se
// pide abrir el primero de la cola y se espera esa respuesta.
function openTowerChestQueue(chests){
  if(!chests||!chests.length) return;
  G._towerChestQueue=chests.slice();
  G._towerChestRevealed=null;
  netSend({type:"towerOpenChest", chestId:G._towerChestQueue[0].id});
  render();
}
function closeTowerChestReveal(){
  if(!G._towerChestQueue||!G._towerChestQueue.length) return;
  G._towerChestQueue.shift();
  G._towerChestRevealed=null;
  const next=G._towerChestQueue[0];
  if(next) netSend({type:"towerOpenChest", chestId:next.id});
  else G._towerChestQueue=null;
  render();
}
function towerChestRevealModalHTML(){
  if(!G._towerChestQueue||!G._towerChestQueue.length) return "";
  const remaining=G._towerChestQueue.length-1;
  const revealed=G._towerChestRevealed;
  if(!revealed){
    return `<div class="pauseovl"><div class="pausecard a-pop" style="text-align:center">
      <div style="font-size:46px;margin-bottom:6px">🗝️</div>
      <h2 style="font-family:var(--font-heading);color:#ffe9a8;font-size:16px;margin-bottom:6px">Abriendo cofre…</h2>
    </div></div>`;
  }
  const tierLabel=TOWER_CHEST_TIER_LABEL[revealed.tier]||"🎁 Cofre";
  const prize=formatTowerRewardsReal(revealed.rewards,revealed.floor);
  return `<div class="pauseovl" onclick="if(event.target===this)closeTowerChestReveal()">
    <div class="pausecard a-pop" style="text-align:center">
      <div style="font-size:46px;margin-bottom:6px">🎁</div>
      <h2 style="font-family:var(--font-heading);color:#ffe9a8;font-size:16px;margin-bottom:2px">${esc(tierLabel)}</h2>
      <p style="font-size:11px;color:rgba(232,238,247,.55);margin-bottom:8px">Piso ${revealed.floor}</p>
      <div class="tower-gift-prize a-pop">${prize}</div>
      <button class="btn btn-gold" style="margin-top:14px" onclick="closeTowerChestReveal()">${remaining>0?"Siguiente ("+remaining+" más) →":"¡Genial!"}</button>
    </div>
  </div>`;
}
function towerMapHTML(statusFor){
  const STEP=104, TOP_PAD=40, BOT_PAD=26, XR=66, XL=34;
  const order=[10,9,8,7,6,5,4,3,2,1];
  const H=TOP_PAD+(order.length-1)*STEP+BOT_PAD;
  const pts=order.map((floor,i)=>({
    floor, side: i%2===0?"r":"l", x: i%2===0?XR:XL, y: TOP_PAD+i*STEP,
  }));
  let d="";
  pts.forEach((p,i)=>{
    if(i===0){ d+=`M ${p.x} ${p.y}`; return; }
    const prev=pts[i-1], midY=(prev.y+p.y)/2;
    d+=` C ${prev.x} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y}`;
  });
  const pendingMap=towerPendingFloorMap();
  const pendingChestMap=towerPendingChestFloorMap();
  const nodes=pts.map(p=>towerFloorNodeHTML(p.floor,statusFor(p.floor),p.x,p.y,p.side,pendingMap.get(p.floor),pendingChestMap.get(p.floor))).join("");
  // [Identidad por Torre — bloque 6] El degradé del camino cambia de punta
  // (color de esa Torre) a dorado (siempre el mismo, es el color "premio")
  // — mismo SVG, solo cambian los stops según G.towerTower.
  const pathFrom={1:"#a855f7",2:"#ef4444",3:"#facc15"}[G.towerTower||1];
  return `<div class="tower-map" id="tower-map" style="height:${H}px">
    <svg viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="towerPathGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${pathFrom}"/><stop offset="55%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#fbbf24"/>
      </linearGradient></defs>
      <path class="tower-path" d="${d}" vector-effect="non-scaling-stroke"/>
    </svg>
    ${nodes}
  </div>`;
}
function renderTower(app){
  const towerId=G.towerTower||1;
  const towerName=(TOWER_META_DISPLAY[towerId]||{}).name||"";
  let body;
  if(G.towerLoading){
    body=`<div class="searching-spinner" aria-hidden="true"></div><p style="font-size:12px;color:rgba(232,238,247,.6);margin-top:10px">Consultando tu progreso…</p>`;
  } else if(G.towerComplete){
    body=`<div class="tower-complete-banner a-pop">👑 ¡Completaste las 3 Torres de esta semana!<br><span style="font-size:11px;font-weight:400;color:rgba(232,238,247,.6)">Se reinicia el lunes 00:00.</span></div>
      ${towerMapHTML(()=>"done")}`;
  } else {
    const current=G.towerFloor||1;
    body=towerMapHTML(f=>f<current?"done":f===current?"current":"locked");
  }
  // Torre activa + vidas — el color de marca (jefe/corona/camino/tarjeta del
  // menú) sale de tower-theme-{towerId} en burako.css (recoloreo, bloque 6).
  const livesHTML=(!G.towerLoading&&!G.towerComplete)?`<p style="font-size:12px;text-align:center;margin:0 0 6px;color:rgba(232,238,247,.75)">Torre <strong style="color:#ffe9a8">${esc(towerName)}</strong> · ${"❤️".repeat(Math.max(0,G.towerLives!=null?G.towerLives:3))}${"🖤".repeat(Math.max(0,3-(G.towerLives!=null?G.towerLives:3)))}</p>`:"";
  // [v1.3.4 — premios pendientes] Banner + botón para abrir de a uno todos
  // los regalos que el jugador todavía no vio — incluye tanto pisos como el
  // bonus de completar, sin importar de qué semana sean (uno viejo sin
  // abrir nunca desaparece solo, ver getPendingTowerRewards en db.js).
  const pending=G.towerPending||[];
  const pendingBannerHTML=(!G.towerLoading&&pending.length)?`<div class="tower-pending-banner a-pop">
    <span>🎁 Tenés ${pending.length} recompensa${pending.length===1?"":"s"} por reclamar</span>
    <button class="btn btn-gold" style="margin-top:8px" onclick='openTowerRewardQueue(${JSON.stringify(pending)})'>Reclamar premios</button>
  </div>`:"";
  // [Cofres de Torre — bloque 2] Banner aparte de "reclamar premios": los
  // cofres se abren de a uno con su propia animación/sorpresa, nunca con un
  // botón de "abrir todos" (pedido explícito).
  const pendingChests=G.towerPendingChests||[];
  const pendingChestBannerHTML=(!G.towerLoading&&pendingChests.length)?`<div class="tower-pending-banner a-pop">
    <span>🗝️ Tenés ${pendingChests.length} cofre${pendingChests.length===1?"":"s"} por abrir</span>
    <button class="btn btn-gold" style="margin-top:8px" onclick='openTowerChestQueue(${JSON.stringify(pendingChests.map(c=>({id:c.id})))})'>Abrir cofres</button>
  </div>`:"";
  app.innerHTML=`<div class="screen-center"><div class="card rt-card tower-theme-${towerId} ${G._enterCls}">
    ${rtBgFloatHTML()}
    <div class="rt-topbar">
      <button class="rt-back" onclick="goMenu()" title="Volver al menú">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        <span class="rt-back-label">Volver</span>
      </button>
      <h2 class="rt-title">🏰 Torre ${G.towerLoading?"semanal":esc(towerName)}</h2>
    </div>
    <div class="rt-body">
      ${pendingBannerHTML}
      ${pendingChestBannerHTML}
      ${livesHTML}
      ${G.towerLoading?"":`<div class="tower-crown-deco"><span>👑</span></div><p style="font-size:11px;color:rgba(232,238,247,.55);text-align:center;margin:2px 0 4px;line-height:1.5">Piso 10 arriba, piso 1 abajo. Superá el actual para desbloquear el siguiente.</p>`}
      ${body}
    </div>
  </div></div>
  ${towerRevealModalHTML()}
  ${towerChestRevealModalHTML()}`;
  if(G.towerLoading) return;
  // Panorama breve y después paneo suave al piso actual — con reduced motion,
  // salta directo sin demora ni animación (ver spec de la tarea). El scroll
  // ahora es de .rt-body (mismo contenedor que Ruleta), no de .tower-map.
  const reduceMotion=window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scrollToCurrent=()=>{
    const cur=document.querySelector(".tower-floor-current");
    if(!cur) return;
    cur.scrollIntoView({behavior:reduceMotion?"auto":"smooth", block:"center"});
  };
  if(reduceMotion) requestAnimationFrame(scrollToCurrent);
  else { clearTimeout(G._towerScrollT); G._towerScrollT=setTimeout(scrollToCurrent,500); }
}
function fmtHoursMin(ms){
  if(!ms||ms<=0) return "en cualquier momento";
  const totalMin=Math.ceil(ms/60000), h=Math.floor(totalMin/60), m=totalMin%60;
  if(h<=0) return m===1?"1 minuto":m+" minutos";
  return h+"h"+(m>0?" "+m+"m":"");
}
async function doJoinPublicRoom(code){
  if(!(await ensureConnected())) return;
  markLobbyPending("join"); render();
  netSend({type:"join", room:code, name: G.serverProfile?G.serverProfile.username:P.name, skin: P.skin||"clasica"});
}
async function doQueueJoin(mode){
  if(!(await ensureConnected())) return;
  G.searchingMode=mode; G.searchingSeconds=0; G.searchingSize=0; G.searchingMaxWait=0;
  G.searchingPhase="searching"; G.searchingHumanCount=0;
  G.screen="netConnect"; G.netStep="searching"; render();
  netSend({type:"queueJoin", mode, name: G.serverProfile?G.serverProfile.username:P.name, skin: P.skin||"clasica"});
}
function doQueueLeave(){
  netSend({type:"queueLeave"});
  G.searchingPhase="searching";
  G.netStep="ffaHub"; render();
}
function doSetReady(ready){
  markLobbyPending("ready"); render();
  netSend({type:"setReady", ready});
}
function doStartMatch(){
  markLobbyPending("start"); render();
  netSend({type:"start"});
}
function doRequestLeaderboard(){
  G._lbCb=function(msg){ if(msg.type==="leaderboard"){ G.leaderboardData=msg.data; G.netStep="leaderboard"; delete G._lbCb; render(); } };
  netSend({type:"leaderboard"});
}

function doPlaceBet(){
  const el=document.querySelector("#betamount"); if(!el) return;
  const amount=Math.floor(Number(el.value));
  if(!(amount>0)){ setMsg("Ingresá una apuesta válida."); return render(); }
  if(amount>P.fichas){ Sound.error(); setMsg("No te alcanzan las monedas."); return render(); }
  Sound.select();
  netSend({type:"placeBet", amount});
}
/* Reusa el mismo componente que muestra a los rivales durante la partida
   (oppCardHTML/.opp-card) para la fila de cada jugador en el lobby — así la
   sala de espera y la mesa de juego hablan el mismo idioma visual en vez de
   dos sistemas de tarjeta distintos (§11 del pedido). */
function lobbyPlayerCardHTML(p, idx, isAdminView){
  const ready=p.ready||p.isAI;
  const tier=(p.rankPts!==undefined&&p.rankPts!==null)?tierOf(p.rankPts):null;
  const accent=SEAT_ACCENTS[idx%SEAT_ACCENTS.length]||"rojo";
  const isMe=p.id===NET.myId;
  return `<div class="opp-card acc-${accent}${p.isAdmin?" is-lobby-admin":""}" data-pid="${p.id}" style="width:100%;max-width:none">
    <div class="opp-avatar">${p.avatar||"🀄"}</div>
    <div class="opp-info">
      <div class="opp-name">${p.isAdmin?"👑 ":""}${p.isAI?"🤖 ":""}${nameEffectHTML(p.name,p.nameeffect)}${isMe?" (vos)":""}</div>
      <div class="opp-meta">
        ${tier?`<span style="display:inline-flex;align-items:center;gap:2px">${tierBadgeHTML(tier,13)}${p.level?" Nv"+p.level:""}</span>`:""}
        <span class="opp-skin" title="Skin: ${esc(skinName(p.skin))}">🎨</span>
        <span style="color:${p.connected?'#34d399':'#6b7280'}" title="${p.connected?'Conectado':'Desconectado'}">●</span>
      </div>
    </div>
    ${ready?`<span style="font-size:11px;color:#34d399;font-weight:800;flex-shrink:0">✔ Listo</span>`:`<span style="font-size:11px;color:rgba(232,238,247,.4);flex-shrink:0;white-space:nowrap">esperando…</span>`}
    ${isAdminView&&p.isAI?`<button onclick="netSend({type:'kickAI',aiId:'${p.id}'})" style="background:rgba(220,38,38,.6);color:#fff;border-radius:6px;font-size:10px;padding:3px 7px;border:none;cursor:pointer;flex-shrink:0;margin-left:2px">✖</button>`:""}
  </div>`;
}
function renderLobby(app){
  const players=G.players||[];
  const me=players.find(p=>p.id===NET.myId)||{};
  const isAdmin=me.isAdmin;
  const tapete=G.serverTapete||"clasico";
  const inMonedas=G.gameMode==="monedas";
  const inTeam2v2=G.gameMode==="team2v2";
  const myBet=me.bet||0;
  const readyCount=players.filter(p=>p.ready||p.isAI).length;
  const missingBets=inMonedas?players.filter(p=>!p.isAI&&!p.bet):[];
  const teamsFull=!inTeam2v2||(players.length===4&&players.filter(p=>p.team==="blue").length===2&&players.filter(p=>p.team==="red").length===2);
  const canStart=isAdmin&&players.length>=2&&readyCount===players.length&&!missingBets.length&&teamsFull;
  app.innerHTML=`
  <div class="screen-center"><div class="card ${G._enterCls}" style="max-height:88dvh;overflow-y:auto">
    <button class="card-x" onclick="doLeaveLobby()" title="Cerrar">✕</button>
    <h2 style="font-family:var(--font-display);color:#ffe9a8;font-size:22px;margin-bottom:2px;text-align:center">Sala ${G.gameMode==="ranked"?"🏆 Ranked":inMonedas?"🪙 Monedas":inTeam2v2?"🤝 2v2":"Casual"}</h2>
    ${G.message?`<p style="text-align:center;font-size:12px;color:#f87171;font-weight:700;background:rgba(220,38,38,.12);border:1px solid rgba(220,38,38,.3);border-radius:8px;padding:6px 10px;margin:6px 0">⚠ ${esc(G.message)}</p>`:""}
    <div style="text-align:center;font-family:var(--font-heading);font-size:38px;letter-spacing:8px;font-weight:800;color:#ffe9a8;margin:6px 0 2px;text-shadow:0 0 20px rgba(251,191,36,.3)">${NET.roomCode||"..."}</div>
    <p class="subtitle" style="text-align:center;margin-bottom:12px">Compartí este código con los demás</p>
    <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(232,238,247,.45);margin:8px 0 6px">Jugadores (${players.length}/${MAX_PLAYERS_ONLINE})</div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
      ${players.map((p,idx)=>lobbyPlayerCardHTML(p,idx,isAdmin)).join("")}
    </div>
    ${G.gameMode==="team2v2"?`
      <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(232,238,247,.45);margin:8px 0 6px">Equipos</div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        ${["blue","red"].map(team=>{
          const teamPlayers=players.filter(p=>p.team===team);
          const label=team==="blue"?"🔵 Equipo Azul":"🔴 Equipo Rojo";
          const color=team==="blue"?"#38bdf8":"#f87171";
          return `<div style="flex:1;background:rgba(0,0,0,.2);border:1px solid ${color}55;border-radius:10px;padding:8px;min-height:64px">
            <div style="font-size:11px;font-weight:800;color:${color};margin-bottom:6px;text-align:center">${label} (${teamPlayers.length}/2)</div>
            ${teamPlayers.length?teamPlayers.map(p=>`<div style="font-size:12px;padding:3px 0;text-align:center;color:#e8eef7">${p.isAdmin?"👑 ":""}${p.isAI?"🤖 ":""}${nameEffectHTML(p.name,p.nameeffect)}${p.id===NET.myId?" (vos)":""}</div>`).join(""):`<div style="font-size:10px;color:rgba(232,238,247,.35);text-align:center">Vacío</div>`}
          </div>`;
        }).join("")}
      </div>
      ${isAdmin?`
      <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(232,238,247,.45);margin:8px 0 6px">Asignar jugadores (admin)</div>
      <div style="margin-bottom:12px">
        ${players.map(p=>`<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:rgba(255,255,255,.05);border-radius:8px;margin-bottom:4px">
          <span style="flex:1;font-size:12px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.isAI?"🤖 ":""}${nameEffectHTML(p.name,p.nameeffect)}${p.id===NET.myId?" (vos)":""}</span>
          <button onclick="netSend({type:'setTeam',playerId:'${p.id}',team:'blue'})" style="border-radius:6px;padding:4px 9px;font-size:10px;font-weight:800;border:none;cursor:pointer;background:${p.team==='blue'?'linear-gradient(180deg,#38bdf8,#0369a1)':'rgba(255,255,255,.08)'};color:${p.team==='blue'?'#fff':'#e8eef7'}">🔵</button>
          <button onclick="netSend({type:'setTeam',playerId:'${p.id}',team:'red'})" style="border-radius:6px;padding:4px 9px;font-size:10px;font-weight:800;border:none;cursor:pointer;background:${p.team==='red'?'linear-gradient(180deg,#f87171,#b91c1c)':'rgba(255,255,255,.08)'};color:${p.team==='red'?'#fff':'#e8eef7'}">🔴</button>
          <button onclick="netSend({type:'setTeam',playerId:'${p.id}',team:null})" style="border-radius:6px;padding:4px 7px;font-size:10px;font-weight:800;border:none;cursor:pointer;background:rgba(255,255,255,.08);color:rgba(232,238,247,.5)">✖</button>
        </div>`).join("")}
      </div>
      `:""}
    `:""}
    ${inMonedas?`
      <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(232,238,247,.45);margin:8px 0 6px">🪙 Modo Monedas — tu apuesta</div>
      <div class="${myBet>0?"":"bet-pending"}" style="background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.3);border-radius:10px;padding:10px;margin-bottom:10px">
        ${myBet>0?`
          <p style="font-size:12px;color:#ffe9a8;margin-bottom:8px;text-align:center">Apostaste <b>🪙 ${myBet}</b></p>
          <button class="btn-sm" style="width:100%;border-radius:8px;background:rgba(220,38,38,.5);color:#fff;padding:8px" onclick="netSend({type:'cancelBet'})">Cancelar apuesta</button>
        `:`
          <p style="font-size:10px;color:rgba(232,238,247,.6);margin-bottom:8px;text-align:center;line-height:1.5">🥇 1° puesto: tu apuesta + el doble de premio.<br>🥈 2° puesto: tu apuesta + la mitad de premio.<br>🥉 3° puesto: recuperás solo lo apostado.<br>4° en adelante: la perdés.</p>
          <div style="display:flex;gap:6px">
            <input id="betamount" type="number" min="1" max="${P.fichas}" placeholder="Monedas" style="flex:1;min-width:0;padding:9px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid rgba(184,150,63,.25);color:#ffe9a8;font-size:14px;text-align:center" onkeydown="if(event.key==='Enter')doPlaceBet()">
            <button class="btn-sm" style="border-radius:8px;background:linear-gradient(180deg,#fcd34d,#f59e0b);color:#1a1200;padding:0 14px;flex-shrink:0" onclick="doPlaceBet()">Apostar</button>
          </div>
          <p style="font-size:10px;color:rgba(232,238,247,.4);margin-top:6px;text-align:center">Tenés 🪙 ${P.fichas}</p>
        `}
      </div>
    `:""}
    ${isAdmin?`
      <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(232,238,247,.45);margin:8px 0 6px">Configuración (admin)</div>
      <div style="background:rgba(0,0,0,.2);border:1px solid rgba(184,150,63,.15);border-radius:10px;padding:10px;margin-bottom:10px">
        ${(players.length<(G.gameMode==="team2v2"?4:MAX_PLAYERS_ONLINE))?`
        <div style="font-size:11px;color:rgba(232,238,247,.55);margin-bottom:5px">🤖 Agregar bot IA${G.gameMode==="team2v2"?" (después asignalo a un equipo — tiene que quedar IA con IA)":""}:</div>
        <div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap">
          ${[["easy","😊 Fácil"],["normal","🙂 Medio"],["hard","😈 Difícil"],["expert","🧠 Extremo"]].map(([v,l])=>
            `<button onclick="netSend({type:'addAI',difficulty:'${v}'})" style="flex:1;min-width:64px;background:linear-gradient(180deg,#38bdf8,#0369a1);color:#fff;border-radius:8px;padding:7px 2px;border:none;font-weight:800;font-size:10.5px;cursor:pointer">${l}</button>`).join("")}
          <button onclick="netSend({type:'addAI',difficulty:'claude'})" style="flex:1;min-width:64px;background:linear-gradient(180deg,#a855f7,#6b21a8);color:#fff;border-radius:8px;padding:7px 2px;border:none;font-weight:800;font-size:10.5px;cursor:pointer">✨ IA-Claude</button>
        </div>`:""}
        <div style="font-size:11px;color:rgba(232,238,247,.55);margin-bottom:5px">Tapete de mesa:</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px">
          ${(P.ownedTapetes&&P.ownedTapetes.length?P.ownedTapetes:["clasico"]).map(tid=>{
            const t=TAPETES.find(x=>x.id===tid); if(!t) return "";
            return `<button onclick="netSend({type:'setTapete',tapete:'${t.id}'})" style="padding:4px;border-radius:6px;background:${tapete===t.id?'rgba(251,191,36,.2)':'rgba(0,0,0,.25)'};border:1px solid ${tapete===t.id?'#fbbf24':'rgba(184,150,63,.2)'};cursor:pointer" title="${t.name}">
              <div class="tp-${t.id}" style="width:100%;height:22px;border-radius:4px;overflow:hidden"><div class="mesa" style="margin:0;height:100%;border:none;border-radius:4px"></div></div>
            </button>`;
          }).join("")}
        </div>
      </div>
    `:""}
    <button class="btn btn-gold" ${(inMonedas&&!myBet)||G._lobbyPending==="ready"?"disabled style='opacity:.4;cursor:not-allowed'":""} onclick="doSetReady(${!me.ready})" style="${me.ready?'background:linear-gradient(180deg,#34d399,#059669)':''};margin-bottom:6px">${G._lobbyPending==="ready"?"⏳ Confirmando…":inMonedas&&!myBet?"🪙 Apostá primero para poder marcarte listo":me.ready?"✔ Estoy listo (tocá para cancelar)":"Marcar como listo"}</button>
    ${isAdmin?`<button class="btn btn-gold" ${(!canStart)||G._lobbyPending==="start"?"disabled style='opacity:.4;cursor:not-allowed'":""} onclick="doStartMatch()" style="background:linear-gradient(180deg,#fcd34d,#f59e0b)">${G._lobbyPending==="start"?"⏳ Iniciando partida…":canStart?"▶ EMPEZAR PARTIDA":players.length<2?"Faltan jugadores (mín 2)":(!teamsFull)?"Asigná 2 y 2 por equipo (y completá 4 jugadores)":missingBets.length?"Faltan apostar: "+missingBets.map(p=>p.name).join(", "):"Esperando que todos estén listos…"}</button>`:""}
    <button class="btn btn-ghost" onclick="doLeaveLobby()">Salir de la sala</button>
    <p style="font-size:10px;color:rgba(232,238,247,.4);margin-top:8px;text-align:center">${isAdmin?"Solo vos podés empezar":"Solo el admin puede empezar"}</p>
  </div></div>`;
}

function doLeaveLobby(){
  // Salir de la sala de espera vuelve un paso atrás (a la lista de salas), no al
  // menú principal — y sin cerrar/reabrir la conexión, para que sea instantáneo
  // y no dependa de un reconecte+relogin automático (eso se probó antes y se sentía
  // como un cuelgue/bucle, ver leaveRoomToMenu).
  if(NET.ws && NET.ws.readyState===1) netSend({type:"leaveRoom"});
  G.players=[]; NET.roomCode=null; clearActiveRoom();
  G.screen="netConnect"; G.netStep=hubStepFor(G.netCategory); render();
}
/* Salir de la sala desde la pantalla de fin de partida: solo desconecta (sin
   reconectar/loguear de nuevo solo) para que ningún broadcast tardío te
   vuelva a arrastrar a la pantalla de resultado. Para volver a jugar online
   hay que entrar de nuevo por "Multijugador", que conecta desde cero. */
function leaveRoomToMenu(){
  // Al terminar la partida el server ya puso room.started=false, así que "leaveRoom"
  // (el mismo mensaje liviano que usa doLeaveLobby) alcanza para salir de la sala sin
  // cerrar la conexión entera — seguís conectado y logueado, listo para volver a entrar
  // a Multijugador al toque, en vez de tener que reconectar/loguearte de nuevo a mano.
  if(NET.ws && NET.ws.readyState===1) netSend({type:"leaveRoom"});
  clearInterval(G.timerHandle); clearInterval(G.matchTimerHandle); clearInterval(G._teamChatCooldownTick);
  G.players=[]; NET.roomCode=null; clearActiveRoom();
  G.chatLog=[]; G.chatOpen=false; G.chatUnread=0;
  G.screen="menu"; render();
}
// Mismo mecanismo que leaveRoomToMenu(), pero vuelve al mapa de la Torre en
// vez de al menú principal — pide el estado fresco (piso actual ya
// actualizado) en vez de reusar el que tenía antes de jugar ese piso.
function leaveRoomToTower(){
  if(NET.ws && NET.ws.readyState===1) netSend({type:"leaveRoom"});
  clearInterval(G.timerHandle); clearInterval(G.matchTimerHandle); clearInterval(G._teamChatCooldownTick);
  G.players=[]; NET.roomCode=null; clearActiveRoom();
  G.chatLog=[]; G.chatOpen=false; G.chatUnread=0;
  goTower();
}


/* ================================================================
   ONBOARDING: primera vez que abrís el juego — registro (nombre +
   contraseña) → mini tutorial → elegir avatar. Un solo flujo propio para
   TODOS los primeros ingresos (haya servidor disponible o no), en vez del
   login/register genérico de renderAuthScreen — ver goIntroEnter().
   ================================================================ */
function checkFirstTime(){
  if(Store.get("burako_onboarded_v2",false)) return false;
  return true;
}
function goOnboarding(){ G.screen="onboarding"; G.onboardStep=G.onboardStep||"register"; render(); }
function renderOnboarding(app){
  const step=G.onboardStep||"register";
  if(step==="register") return renderOnboardRegister(app);
  if(step==="tutorial") return renderOnboardTutorial(app);
  return renderOnboardAvatar(app);
}
function renderOnboardRegister(app){
  app.innerHTML=`
  <div class="screen-center auth-screen"><div class="fan-compact">${fanLogoHTML()}</div>
    <div class="card ${G._enterCls}" style="text-align:center">
      <p class="elegant-sub" style="margin:2px 0 16px">Creá tu perfil de Burako</p>
      <label class="lbl">¿Cómo te llamás?</label>
      <input id="obname" placeholder="Tu nombre" maxlength="16" autofocus onkeydown="if(event.key==='Enter')document.querySelector('#obpass').focus()"
        style="width:100%;padding:11px;border-radius:9px;background:rgba(0,0,0,.22);border:1px solid var(--panel-border);color:#fff;font-size:14px;margin-bottom:10px">
      <label class="lbl">Contraseña</label>
      <input id="obpass" type="password" placeholder="Contraseña" onkeydown="if(event.key==='Enter')document.querySelector('#obpass2').focus()"
        style="width:100%;padding:11px;border-radius:9px;background:rgba(0,0,0,.22);border:1px solid var(--panel-border);color:#fff;font-size:14px;margin-bottom:10px">
      <label class="lbl">Repetir contraseña</label>
      <input id="obpass2" type="password" placeholder="Repetí la contraseña" onkeydown="if(event.key==='Enter')submitOnboardRegister()"
        style="width:100%;padding:11px;border-radius:9px;background:rgba(0,0,0,.22);border:1px solid var(--panel-border);color:#fff;font-size:14px;margin-bottom:10px">
      ${G._obNameTaken?`
      <div style="background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.35);border-radius:10px;padding:10px 12px;margin-bottom:10px;text-align:left">
        <p style="font-size:12px;color:#fbbf24;margin:0 0 8px">"${esc(G._obNameTaken)}" ya tiene una cuenta — ¿es tuya, de otro dispositivo?</p>
        <button class="btn btn-gold" style="font-size:13px;padding:8px" onclick="goOnboardLogin(G._obNameTaken)">Iniciar sesión como "${esc(G._obNameTaken)}"</button>
      </div>`:""}
      <button class="btn btn-gold" style="font-size:16px" onclick="submitOnboardRegister()">Crear cuenta →</button>
      <button class="btn btn-ghost" style="margin-top:8px" onclick="goOnboardLogin()">Ya tengo cuenta → Iniciar sesión</button>
      <p id="oberr" style="color:#f87171;font-size:12px;text-align:center;min-height:16px;margin-top:8px"></p>
    </div>
  </div>`;
}
function submitOnboardRegister(){
  const name=(document.querySelector("#obname").value||"").trim();
  const pass=document.querySelector("#obpass").value;
  const pass2=document.querySelector("#obpass2").value;
  G._obNameTaken=null;
  const showErr=(m)=>{ const el=document.querySelector("#oberr"); if(el) el.textContent=m; };
  if(!name||name.length<2){ showErr("Poné un nombre de al menos 2 letras."); return; }
  if(!pass||pass.length<3){ showErr("La contraseña necesita al menos 3 caracteres."); return; }
  if(pass!==pass2){ showErr("Las contraseñas no coinciden."); return; }
  Sound.init();
  const proceedLocal=()=>{
    P.name=name; saveP();
    G.onboardStep="tutorial"; render();
  };
  if(!NET.ws||NET.ws.readyState!==1){
    // Sin servidor a mano: el nombre/contraseña quedan como perfil local
    // (misma idea que jugar offline en el celular) — nada que validar.
    proceedLocal();
    return;
  }
  localStorage.setItem("burako_lan_name",name);
  // Si el mensaje se manda pero la conexión se corta justo después (wifi
  // inestable, típico en celular) nunca llegaría respuesta y quedarías
  // trabado en este paso para siempre — a los 5s sin novedades, se sigue
  // igual como perfil local en vez de dejar a alguien esperando sin salida.
  const bailTimer=setTimeout(()=>{ delete G._authCb; proceedLocal(); },5000);
  G._authCb=(msg)=>{
    clearTimeout(bailTimer);
    delete G._authCb;
    if(msg.type==="authOk"){
      G.online=true; Session.setAuthenticated();
      syncProfileFromServer(msg.profile);
      if(msg.welcomeBonus) G.pendingWelcomeBonus=msg.welcomeBonus;
      if(msg.session&&msg.session.refreshToken) saveSessionToken(msg.session.refreshToken);
      try{ NET.ws.send(JSON.stringify({type:"catalog"})); }catch(e){}
      G.onboardStep="tutorial"; render();
    } else if(/ya está registrado|ya existe/i.test(msg.msg||"")){
      // Probablemente sea SU cuenta creada en otro dispositivo/navegador, no un
      // nombre elegido por otra persona — en vez de solo pedir "probá con otro",
      // se ofrece ir directo a login con ese mismo nombre ya cargado.
      G._obNameTaken=name; render();
    } else {
      showErr(msg.msg||"No se pudo crear la cuenta.");
    }
  };
  try{ NET.ws.send(JSON.stringify({type:"register", username:name, password:pass})); }
  catch(e){ clearTimeout(bailTimer); delete G._authCb; proceedLocal(); }
}
// Dispositivo nuevo (sin "burako_onboarded_v2" local) pero cuenta YA existente en
// otro lado: en vez de forzar el formulario de registro, esta salida lleva a la
// pantalla de login normal. submitAuth() ya marca el dispositivo como "conocido"
// al loguear con éxito (ver flag _onboardingLoginShortcut más abajo), así que no
// vuelve a pedir registro la próxima vez que se abra la app en este dispositivo.
function goOnboardLogin(prefillUser){
  G._onboardingLoginShortcut=true;
  G.authIntent="menu";
  if(prefillUser!==undefined) G._authPrefillUser=prefillUser;
  withLogoFlip(()=>{ G.screen="auth"; G.authMode="login"; G.authStep="login"; render(); });
}
function renderOnboardTutorial(app){
  app.innerHTML=`
  <div class="screen-center auth-screen"><div class="fan-compact">${fanLogoHTML()}</div>
    <div class="card ${G._enterCls}" style="text-align:center">
      <p class="elegant-sub" style="margin:2px 0 14px">¡Bienvenido a Burako! 🀄</p>
      <p style="font-size:12.5px;color:rgba(232,238,247,.75);line-height:1.6;margin-bottom:16px">
        Es un juego de fichas de colores y números: armás <b style="color:#ffe9a8">grupos</b> y
        <b style="color:#ffe9a8">escaleras</b>, y los <b style="color:#7dd3fc">comodines</b> reemplazan
        cualquier ficha que te falte. Gana quien se queda primero sin fichas en el atril.
      </p>
      <div style="display:flex;flex-direction:column;gap:10px;text-align:left;margin-bottom:18px">
        <div style="display:flex;gap:10px;align-items:flex-start;background:rgba(0,0,0,.2);border-radius:10px;padding:10px 12px">
          <span style="font-size:20px">👤</span>
          <span style="font-size:12px;color:rgba(232,238,247,.75);line-height:1.4"><b style="color:#ffe9a8">Tu Perfil</b> (arriba a la derecha) — nivel, rango, logros y tu avatar.</span>
        </div>
        <div style="display:flex;gap:10px;align-items:flex-start;background:rgba(0,0,0,.2);border-radius:10px;padding:10px 12px">
          <span style="font-size:20px">🛍</span>
          <span style="font-size:12px;color:rgba(232,238,247,.75);line-height:1.4"><b style="color:#ffe9a8">La Tienda</b> — gastá las 🪙 monedas que ganás jugando partidas en skins, tapetes y efectos.</span>
        </div>
      </div>
      <button class="btn btn-gold" style="font-size:16px" onclick="G.onboardStep='avatar';render()">Siguiente →</button>
    </div>
  </div>`;
}
function renderOnboardAvatar(app){
  app.innerHTML=`
  <div class="screen-center auth-screen"><div class="fan-compact">${fanLogoHTML()}</div>
    <div class="card ${G._enterCls}" style="text-align:center">
      <p class="elegant-sub" style="margin:2px 0 16px">Elegí tu foto de perfil</p>
      <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:8px 0 6px">
        ${FREE_AVATARS.map(a=>
          `<button style="font-size:24px;width:42px;height:42px;border-radius:10px;background:${(P.avatar===a)?"rgba(251,191,36,.3)":"rgba(255,255,255,.06)"};border:1px solid ${(P.avatar===a)?"#fbbf24":"rgba(255,255,255,.1)"}"
            onclick="P.avatar='${a}';saveP();if(Session.isAuthenticated())netSend({type:'setAvatar',avatar:'${a}'});render()">${a}</button>`).join("")}
      </div>
      <p style="font-size:9.5px;color:rgba(232,238,247,.4);margin:4px 0 20px">Más avatares se ganan subiendo de nivel en el Pase de temporada.</p>
      <button class="btn btn-gold" style="font-size:18px" onclick="finishOnboarding()">¡A jugar!</button>
    </div>
  </div>`;
}
function finishOnboarding(){
  if(!P.avatar) P.avatar=FREE_AVATARS[0];
  Store.set("burako_onboarded_v2",true); Store.set("burako_onboarded",true); saveP();
  Sound.meld();
  if(G.online){ G.screen="menu"; render(); } else goMenu();
}

/* Aviso al cerrar/recargar la pestaña con una partida en curso:
   no hay reconexión, así que cerrar equivale a perder todo (y, si es online, te saca de la partida). */
function inActiveMatch(){
  return ["sorteo","dealing","playing","netSorteo","netDealing"].includes(G.screen);
}
window.addEventListener("beforeunload",(e)=>{
  if(!inActiveMatch()) return;
  e.preventDefault();
  e.returnValue="Si cerrás la página perdés la partida en curso"+(G.online?" y quedás afuera (tus fichas vuelven al pozo)":"")+". ¿Seguro que querés salir?";
  return e.returnValue;
});

/* Micro-tilt 3D de los botones del menú (JUGAR/PERFIL/TIENDA/NOVEDADES) al
   mover el mouse — casi imperceptible (±2deg), solo desktop con mouse real
   (pointer:fine) y respetando prefers-reduced-motion. UN SOLO listener
   delegado en document (no uno por botón, y no se reengancha en cada
   render() — .game-menu-btn se resuelve en vivo con closest() así que
   sigue andando aunque renderMenu() reemplace el DOM). Solo toca las
   variables CSS --tiltX/--tiltY; el resto del transform (hover/active) lo
   sigue manejando el CSS normal, ver .game-menu-btn en burako.css. */
(function initMenuButtonTilt(){
  const fine=matchMedia("(pointer:fine)");
  const reduced=matchMedia("(prefers-reduced-motion:reduce)");
  let current=null;
  document.addEventListener("pointermove",(e)=>{
    if(!fine.matches||reduced.matches) return;
    const btn=e.target.closest&&e.target.closest(".game-menu-btn");
    if(btn!==current){ if(current){ current.style.setProperty("--tiltX","0deg"); current.style.setProperty("--tiltY","0deg"); } current=btn; }
    if(!btn) return;
    const r=btn.getBoundingClientRect();
    const px=(e.clientX-r.left)/r.width, py=(e.clientY-r.top)/r.height;
    btn.style.setProperty("--tiltX",((px-0.5)*4).toFixed(2)+"deg");
    btn.style.setProperty("--tiltY",((0.5-py)*4).toFixed(2)+"deg");
  });
})();

// La música (loop de fondo, Web Audio + <audio> de archivo para el menú) no se
// enteraba de que la pestaña dejó de estar visible — cambiar de pestaña, minimizar
// o pasar a otra app la dejaba sonando de fondo indefinidamente. document.hidden
// cubre tab-switch/minimizar en navegador y también background en la app empaquetada.
document.addEventListener("visibilitychange",()=>{
  if(document.hidden){
    Music._wasPlayingOnHide = Music.on && !!(Music.timer || (Music.fileTrackEl && !Music.fileTrackEl.paused));
    Music.stop();
  } else {
    if(Music._wasPlayingOnHide){ Music._wasPlayingOnHide=false; Music.start(); }
    // Volver de segundo plano (app minimizada, bloqueo de pantalla, cambio de
    // pestaña largo) puede haber matado el WebSocket sin que llegara a disparar
    // ws.onclose (el JS queda pausado/muy throttled en background). Al volver,
    // si el socket ya no está abierto pero deberíamos estar online, se
    // reconecta solo — antes esto solo pasaba en "playing", así que salir y
    // entrar a la app en el menú/tienda/perfil dejaba todo "desconectado"
    // hasta tocar algo. Ahora se recupera solo en cualquier pantalla.
    const socketDead = !NET.ws || NET.ws.readyState!==1;
    if(socketDead && inActiveMatch()){
      attemptMatchReconnect();
    } else if(socketDead && (Session.isAuthenticated()||Session.isRestoring())){
      // Antes preguntaba G.online||G.serverConnected — pero G.online puede
      // estar en false por motivos que no tienen nada que ver con la sesión
      // (p. ej. mid-match offline). Acá lo que importa es "¿creíamos tener
      // una sesión válida?", que es exactamente lo que sabe Session — no la
      // conexión de red, que ya está cubierta por socketDead arriba.
      resumeReconnect();
    }
  }
});
// Reconexión "suave" al volver a la app fuera de una partida: reconecta el
// WebSocket y restaura la sesión con el token guardado para recuperar el
// perfil, sin sacar al usuario de donde estaba. Silencioso salvo que falle.
async function resumeReconnect(){
  if(G._resumeReconnecting) return;
  Connection.cancelScheduledReconnect(); // este intento manual se hace cargo, no hace falta un segundo timer de fondo compitiendo
  G._resumeReconnecting=true;
  const connectOpts={attempts:3, delays:[0,2000,5000], attemptTimeout:8000};
  // [Fase 5 — mismo bug real que en Connection.scheduleReconnect()] Si había
  // una sala guardada (lobby o partida no detectada por inActiveMatch()),
  // reautenticar sin pedir "rejoin" dejaba al cliente creyendo que seguía
  // en la sala mientras el servidor no tenía room/player para el socket
  // nuevo. tryAutoReconnect() ya hace las dos cosas (reautentica + rejoin).
  const activeRoom=readActiveRoom();
  if(activeRoom){
    const rejoined=await tryAutoReconnect(activeRoom,{connectOpts});
    if(rejoined){ render(); }
    else if(Session.isExpired()){
      G.authIntent="menu";
      withLogoFlip(()=>{ G.screen="auth"; G.authMode="login"; G.authStep="login"; render(); });
    } else {
      G.serverConnected=(NET.ws&&NET.ws.readyState===1);
    }
    G._resumeReconnecting=false;
    return;
  }
  const res=await resumeSessionSilently({connectOpts});
  if(res.ok){
    render();
  } else if(res.reason==="expired"){
    // El servidor confirmó que la sesión ya no vale — este es justo el caso
    // en que sí corresponde volver a pedir login (nunca por las dudas, solo
    // cuando el servidor lo dice explícitamente).
    G.authIntent="menu";
    withLogoFlip(()=>{ G.screen="auth"; G.authMode="login"; G.authStep="login"; render(); });
  } else {
    G.serverConnected=(NET.ws&&NET.ws.readyState===1);
  }
  G._resumeReconnecting=false;
}

/* Fondo decorativo global: fichas subiendo lentamente, siempre visibles detrás
   de cualquier pantalla (vive fuera de #app, así no se recrea en cada render). */
function initBgDecor(){
  const el=document.querySelector("#bgdecor"); if(!el) return;
  let html="";
  for(let i=0;i<16;i++){
    const c=COLOR_KEYS[i%COLOR_KEYS.length];
    const n=1+Math.floor(Math.random()*13);
    const left=Math.random()*100;
    const size=26+Math.random()*22;
    const dur=22+Math.random()*22;
    const delay=-Math.random()*dur;
    html+=`<div class="tile c-${c} dotc-${c}" style="left:${left}%;width:${size}px;height:${(size*1.38).toFixed(0)}px;font-size:${(size*0.42).toFixed(0)}px;animation-duration:${dur.toFixed(1)}s;animation-delay:${delay.toFixed(1)}s">${n}</div>`;
  }
  el.innerHTML=html;
}
initBgDecor();

/* Fondo cósmico de Modo Galáctico: vive fuera de #app (como #bgdecor) para no
   recrearse en cada render — solo se hace visible via CSS (body.galactico-mode).
   Estrellas titilando a distinta velocidad + un par de "shooting stars" sueltas. */
function initGalacticoBg(){
  const stars=document.querySelector("#galacticoBg .gbg-stars");
  if(!stars) return;
  let html="";
  for(let i=0;i<70;i++){
    const left=Math.random()*100, top=Math.random()*100;
    const size=1+Math.random()*2.2;
    const dur=1.8+Math.random()*3.2;
    const delay=-Math.random()*dur;
    const hue=Math.random()<.7?"#fff":(Math.random()<.5?"#d8b4fe":"#93c5fd");
    html+=`<span class="gbg-star" style="left:${left.toFixed(2)}%;top:${top.toFixed(2)}%;width:${size.toFixed(1)}px;height:${size.toFixed(1)}px;background:${hue};animation-duration:${dur.toFixed(1)}s;animation-delay:${delay.toFixed(1)}s"></span>`;
  }
  for(let i=0;i<3;i++){
    const top=10+Math.random()*40;
    const dur=6+Math.random()*5;
    const delay=Math.random()*14;
    html+=`<span class="gbg-shoot" style="top:${top.toFixed(1)}%;animation-duration:${dur.toFixed(1)}s;animation-delay:${delay.toFixed(1)}s"></span>`;
  }
  stars.innerHTML=html;
}
initGalacticoBg();

/* "Arrastrar para mover" la mesa en vez de mostrar una barra de scroll — el límite
   natural lo pone el propio scroll (no se puede arrastrar más allá del contenido).
   Solo con mouse: en touch ya existe el gesto nativo de arrastrar para scrollear. */
let MESA_PAN=null;
document.addEventListener('pointerdown',(e)=>{
  if(e.pointerType!=='mouse') return;
  const mesa=e.target.closest && e.target.closest('.mesa');
  if(!mesa) return;
  if(e.target.closest('.meld,.openbtn,button')) return;
  if(typeof DRAG!=='undefined' && DRAG && DRAG.active) return;
  MESA_PAN={mesa,x0:e.clientX,y0:e.clientY,st:mesa.scrollTop,sl:mesa.scrollLeft,moved:false};
});
document.addEventListener('pointermove',(e)=>{
  if(!MESA_PAN) return;
  const dx=e.clientX-MESA_PAN.x0, dy=e.clientY-MESA_PAN.y0;
  if(!MESA_PAN.moved){
    if(Math.hypot(dx,dy)<6) return;
    MESA_PAN.moved=true;
    MESA_PAN.mesa.classList.add('panning');
  }
  e.preventDefault();
  MESA_PAN.mesa.scrollTop=MESA_PAN.st-dy;
  MESA_PAN.mesa.scrollLeft=MESA_PAN.sl-dx;
});
document.addEventListener('pointerup',()=>{ if(MESA_PAN) MESA_PAN.mesa.classList.remove('panning'); MESA_PAN=null; });
document.addEventListener('pointercancel',()=>{ if(MESA_PAN) MESA_PAN.mesa.classList.remove('panning'); MESA_PAN=null; });
document.addEventListener('keydown',(e)=>{ if(e.key==='Escape'&&G.tableViewOpen) closeTableView(); });

/* ---------------- Sonido de botón, delegado (Fase 12, a pedido del usuario) ----------------
   Antes cada botón necesitaba su propio Sound.xxx() escrito a mano en el onclick — la mayoría
   de los botones "de navegación" (menú, pestañas, X de cerrar) no tenían ninguno. En vez de ir
   a agregar Sound.click() a cientos de onclick sueltos (mucho riesgo de romper algo por el
   camino), un solo listener delegado en document cubre CUALQUIER <button> del juego, presente
   o futuro. Los que ya reproducen su propio sonido específico (colocar ficha, error, etc.) NO
   suenan dos veces: los listeners inline (onclick="...") corren ANTES que este (fase de
   burbujeo llega acá después), así que si Sound ya sonó algo en los últimos ~40ms para este
   mismo click, se salta el genérico. */
document.addEventListener("click",(e)=>{
  const btn=e.target.closest("button");
  if(!btn||btn.disabled) return;
  if(Sound._lastAt && performance.now()-Sound._lastAt<40) return;
  const isClose=btn.classList.contains("card-x")||btn.classList.contains("hist-drawer-close")||btn.classList.contains("ability-tip-cancel")||btn.title==="Cerrar";
  if(isClose) Sound.closeUI(); else Sound.click();
});

/* arranque */
document.addEventListener("pointerdown",()=>{ Sound.init(); Music.start(); },{once:true});
(function boot(){
  // Pantalla de introducción primero, tanto en modo offline (archivo local) como
  // online (servidor) — recién al tocar "Iniciar sesión" se intenta conectar.
  G.introMode = location.protocol==="file:" ? "offline" : "online";
  G.screen="intro";
  render();
})();
