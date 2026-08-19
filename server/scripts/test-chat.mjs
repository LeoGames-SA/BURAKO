// Mini-fase de chat — valida el chat de texto libre nuevo (server.js,
// msg.type==="sendChat") contra un servidor real (local por default,
// TARGET_WS_URL para producción): buffer capado por sala, historial al
// unirse, validación de largo/vacío, rate-limit básico.
import WebSocket from "ws";
import crypto from "node:crypto";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const WS_URL = process.env.TARGET_WS_URL || "ws://localhost:8181";
const PASS = "TestPass987";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { console.log("✅ " + name); pass++; }
  else { console.log("❌ " + name + (detail ? " — " + detail : "")); fail++; }
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws._buffer = []; ws._waiters = [];
    const t = setTimeout(() => reject(new Error("timeout conectando a " + WS_URL)), 15000);
    ws.once("open", () => { clearTimeout(t); resolve(ws); });
    ws.once("error", reject);
    ws.on("message", (raw) => {
      const m = JSON.parse(raw);
      const wi = ws._waiters.findIndex((w) => w.test(m));
      if (wi !== -1) { const w = ws._waiters.splice(wi, 1)[0]; clearTimeout(w.timer); w.resolve(m); }
      else ws._buffer.push(m);
    });
  });
}
function send(ws, obj) { ws.send(JSON.stringify(obj)); }
function waitFor(ws, matcher, ms = 15000) {
  const test = typeof matcher === "function" ? matcher : (m) => m.type === matcher;
  const bi = ws._buffer.findIndex(test);
  if (bi !== -1) return Promise.resolve(ws._buffer.splice(bi, 1)[0]);
  return new Promise((resolve, reject) => {
    const waiter = { test, resolve, timer: setTimeout(() => {
      const i = ws._waiters.indexOf(waiter); if (i !== -1) ws._waiters.splice(i, 1);
      reject(new Error("timeout esperando " + matcher));
    }, ms) };
    ws._waiters.push(waiter);
  });
}
function noMessageWithin(ws, matcher, ms) {
  return waitFor(ws, matcher, ms).then(() => true, () => false);
}

const cleanupUsernames = [];
async function registerUser(prefix) {
  const ws = await connect();
  const uname = (prefix + crypto.randomBytes(5).toString("hex")).slice(0, 16);
  send(ws, { type: "register", username: uname, password: PASS });
  await waitFor(ws, "authOk");
  cleanupUsernames.push(uname.toLowerCase());
  return { ws, username: uname };
}
async function cleanupAll() {
  for (const u of cleanupUsernames) {
    try { const { data } = await supabase.from("profiles").select("id").ilike("username", u).maybeSingle(); if (data) await supabase.auth.admin.deleteUser(data.id); }
    catch (e) {}
  }
}

async function main() {
  console.log(`=== Chat de texto libre (${WS_URL}) ===\n`);

  const A = await registerUser("chat_a_"), B = await registerUser("chat_b_");
  send(A.ws, { type: "join", room: "NUEVA", name: "A", gameMode: "casual", ranked: false });
  const joined = await waitFor(A.ws, "joined");
  const code = joined.code;
  send(B.ws, { type: "join", room: code, name: "B" });
  await waitFor(B.ws, "joined");

  // ---------- Mensaje simple, relay correcto ----------
  send(A.ws, { type: "sendChat", text: "Hola equipo" });
  const gotB = await waitFor(B.ws, "chat", 5000);
  check("B recibe el mensaje de A con el texto correcto", gotB.text === "Hola equipo", JSON.stringify(gotB));
  check("el mensaje trae playerName", gotB.playerName === "A", "playerName=" + gotB.playerName);
  check("el mensaje trae un id único (para key estable en el DOM)", !!gotB.id);

  // ---------- Vacío / solo espacios: rechazado en silencio (sin broadcast) ----------
  await sleep(900); // fuera de la ventana de rate-limit del mensaje anterior
  send(A.ws, { type: "sendChat", text: "   " });
  check("mensaje vacío/solo espacios NO se relaya", !(await noMessageWithin(B.ws, "chat", 1200)));

  // ---------- Más de 200 caracteres: rechazado con error ----------
  await sleep(900);
  const longText = "x".repeat(201);
  send(A.ws, { type: "sendChat", text: longText });
  const err = await waitFor(A.ws, "error", 3000).catch(() => null);
  check("mensaje >200 caracteres devuelve error", !!err && /largo/i.test(err.msg || ""), JSON.stringify(err));
  check("mensaje >200 caracteres NO se relaya a B", !(await noMessageWithin(B.ws, (m) => m.type === "chat" && m.text === longText, 1200)));

  // ---------- Rate-limit básico: 2 mensajes pegados, el segundo se descarta ----------
  await sleep(900);
  send(A.ws, { type: "sendChat", text: "primero" });
  await waitFor(B.ws, (m) => m.type === "chat" && m.text === "primero", 5000);
  send(A.ws, { type: "sendChat", text: "segundo-inmediato" }); // <800ms después del anterior
  check("rate-limit: mensaje mandado <800ms después del anterior se descarta", !(await noMessageWithin(B.ws, (m) => m.type === "chat" && m.text === "segundo-inmediato", 1000)));

  // ---------- Buffer por sala capado a 25 + historial al unirse ----------
  await sleep(900);
  for (let i = 0; i < 30; i++) {
    send(A.ws, { type: "sendChat", text: "msg" + i });
    await waitFor(B.ws, (m) => m.type === "chat" && m.text === "msg" + i, 5000);
    await sleep(850); // > CHAT_COOLDOWN_MS del server
  }
  const C = await registerUser("chat_c_");
  send(C.ws, { type: "join", room: code, name: "C" });
  await waitFor(C.ws, "joined");
  const hist = await waitFor(C.ws, "chatHistory", 5000);
  check("C (recién unido) recibe chatHistory", !!hist && Array.isArray(hist.messages));
  check("chatHistory trae como máximo 25 mensajes (buffer capado por sala)", hist.messages.length <= 25, "length=" + hist.messages.length);
  check("chatHistory trae los ÚLTIMOS mensajes (msg29 presente, msg0 ya no)", hist.messages.some((m) => m.text === "msg29") && !hist.messages.some((m) => m.text === "msg0"));

  console.log(`\n=== RESUMEN: ${pass} OK / ${fail} fallidas ===`);
  if (fail) process.exitCode = 1;
  try { A.ws.close(); B.ws.close(); C.ws.close(); } catch (e) {}
  await cleanupAll();
  console.log("[cleanup] usuarios de prueba borrados de Supabase.");
  process.exit(process.exitCode || 0);
}
main().catch((e) => { console.error("❌ Error fatal:", e); process.exitCode = 1; process.exit(1); });
