// Test unitario puro (Fase 4A) de server/serial-queue.js — sin red, sin
// servidor, sin Supabase. Cubre las propiedades genéricas que server.js
// asume al usarla: orden FIFO, aislamiento por instancia (no es una cola
// global), y que una tarea que tira una excepción no rompe las siguientes.
import { makeSerialQueue } from "../serial-queue.js";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { console.log("✅ " + name); pass++; }
  else { console.log("❌ " + name + (detail ? " — " + detail : "")); fail++; }
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  console.log("=== Test unitario: serial-queue.js (Fase 4A) ===\n");

  // ---------------------------------------------------------------
  // Orden FIFO: aunque la tarea 1 tarde más que la 2, el resultado debe
  // reflejar que 1 terminó ANTES de que 2 arrancara — exactamente lo que
  // necesita server.js para que resumeSession termine antes que el mensaje
  // que llegó justo después.
  // ---------------------------------------------------------------
  {
    const enqueue = makeSerialQueue();
    const order = [];
    const p1 = enqueue(async () => { order.push("1-start"); await sleep(100); order.push("1-end"); return 1; });
    const p2 = enqueue(async () => { order.push("2-start"); await sleep(10); order.push("2-end"); return 2; });
    const [r1, r2] = await Promise.all([p1, p2]);
    check("orden FIFO: la tarea 2 no arranca hasta que la 1 termina", JSON.stringify(order) === JSON.stringify(["1-start", "1-end", "2-start", "2-end"]), JSON.stringify(order));
    check("ambas tareas resuelven con su valor correcto", r1 === 1 && r2 === 2, `r1=${r1} r2=${r2}`);
  }

  // ---------------------------------------------------------------
  // Aislamiento por instancia: dos colas independientes (= dos sockets) NO
  // se bloquean entre sí — un socket lento no debe frenar a otro usuario.
  // ---------------------------------------------------------------
  {
    const enqueueA = makeSerialQueue();
    const enqueueB = makeSerialQueue();
    const order = [];
    const slow = enqueueA(async () => { order.push("A-start"); await sleep(200); order.push("A-end"); });
    await sleep(20); // dar tiempo a que A arranque de verdad
    const fast = enqueueB(async () => { order.push("B-start"); order.push("B-end"); });
    await Promise.all([slow, fast]);
    check("dos colas independientes: B termina ANTES que A aunque A haya arrancado primero (no se bloquean entre sí)", order.indexOf("B-end") < order.indexOf("A-end"), JSON.stringify(order));
  }

  // ---------------------------------------------------------------
  // Resiliencia a errores: una tarea que tira una excepción no debe romper
  // la cola para la siguiente — ni la de esta misma instancia.
  // ---------------------------------------------------------------
  {
    const enqueue = makeSerialQueue();
    const origConsoleError = console.error; console.error = () => {}; // silencia el log esperado del error atrapado
    let threw = false;
    try { await enqueue(async () => { throw new Error("boom de prueba"); }); }
    catch (e) { threw = true; }
    console.error = origConsoleError;
    check("la tarea que tira sigue rechazando su propia promesa (el caller SÍ se entera)", threw);
    const after = await enqueue(async () => "sigo vivo");
    check("la SIGUIENTE tarea en la misma cola se procesa normalmente tras el error", after === "sigo vivo", "after=" + after);
  }

  // ---------------------------------------------------------------
  // Varias tareas rápidas seguidas (equivalente a "varios mensajes normales
  // rápidos después de autenticarse") — deben resolver en orden y con sus
  // valores correctos, sin mezclarse entre sí.
  // ---------------------------------------------------------------
  {
    const enqueue = makeSerialQueue();
    const results = await Promise.all([1, 2, 3, 4, 5].map((n) => enqueue(async () => { await sleep(Math.random() * 10); return n; })));
    check("5 tareas rápidas seguidas resuelven en el orden en que se encolaron", JSON.stringify(results) === JSON.stringify([1, 2, 3, 4, 5]), JSON.stringify(results));
  }

  console.log(`\n=== RESUMEN: ${pass} OK / ${fail} fallidas ===`);
  if (fail) process.exitCode = 1;
}
main().catch((e) => { console.error("❌ Error fatal:", e); process.exitCode = 1; });
