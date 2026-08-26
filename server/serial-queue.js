// Cola de serialización genérica (Fase 4A — docs/ai/AUDIT-SESSION-ARCHITECTURE.md
// hallazgo #2/#5). Un módulo aparte, sin dependencias del resto del server,
// a propósito: así se puede probar en aislamiento con un test puro
// (server/scripts/test-message-serialization.mjs) sin necesitar un socket
// real ni forzar que algún handler del protocolo tire una excepción de
// verdad. El uso real está en server.js (una instancia por conexión WS).
function makeSerialQueue() {
  let tail = Promise.resolve();
  return function enqueue(taskFn) {
    const run = tail.then(() => taskFn());
    // La cadena sigue pase lo que pase: si taskFn() rechaza, el error se
    // atrapa ACÁ (nunca deja la cola trabada para la siguiente tarea) pero
    // queda logueado en vez de perderse en silencio.
    tail = run.catch((e) => { console.error("[serial-queue] handler de mensaje falló:", e); });
    return run;
  };
}
module.exports = { makeSerialQueue };
