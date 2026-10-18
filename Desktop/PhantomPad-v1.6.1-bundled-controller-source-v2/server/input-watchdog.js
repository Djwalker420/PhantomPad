/**
 * Release a player's controls if their input stream becomes stale.
 *
 * This protects against backgrounded mobile browsers, suspended animation
 * frames, and brief transport failures that would otherwise leave held input
 * active on the host. A fresh input packet rearms the watchdog.
 */
function createInputWatchdog(socketId, inputHandler, timeoutMs = 300) {
  let timer = null;
  let stopped = false;

  function refresh() {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      inputHandler.releasePlayerInput(socketId);
    }, timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();
  }

  function stop() {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
  }

  return { refresh, stop };
}

module.exports = { createInputWatchdog };
