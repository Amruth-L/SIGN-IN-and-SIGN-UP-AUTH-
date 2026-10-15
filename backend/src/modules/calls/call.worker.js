const { createCallService } = require('./call.service');
const service = createCallService();
let busy = false;
async function tick() {
  if (busy) return { busy: true };
  busy = true;
  try {
    const result = await service.enqueue();
    const dispatches = [];
    for (let n = 0; n < 5; n++) {
      const r = await service.dispatchOne();
      dispatches.push(r);
      if (r.empty || r.skipped) break;
    }
    return { ...result, dispatches };
  } finally {
    busy = false;
  }
}
function start() {
  const timer = globalThis.setInterval(
    () => tick().catch((e) => console.error('[call-worker]', e.message)),
    60000,
  );
  timer.unref?.();
  return timer;
}
module.exports = { tick, start };
