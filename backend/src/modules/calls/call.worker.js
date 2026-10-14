const { createCallService } = require('./call.service');
const service = createCallService();
let busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try {
    await service.enqueue();
    for (let n = 0; n < 5; n++) {
      const r = await service.dispatchOne();
      if (r.empty || r.skipped) break;
    }
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
