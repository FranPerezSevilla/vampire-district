/** A cancellable task source for finite resource work, never a simulation loop.
 * MessageChannel yields to the event loop without inventing a frame-sized delay.
 * A timer is used only for waiting on I/O or when channels are unavailable.
 */
export function createPreparationTask(callback, host = globalThis) {
  let channel = null;
  let timer = null;
  let pending = false;
  let closed = false;
  const run = () => {
    if (closed || !pending) return;
    pending = false;
    timer = null;
    callback();
  };
  try {
    if (typeof host.MessageChannel === 'function') {
      channel = new host.MessageChannel();
      channel.port1.onmessage = run;
    }
  } catch {
    channel = null;
  }
  return {
    schedule(delayMs = 0) {
      if (closed || pending) return;
      pending = true;
      if (channel && delayMs === 0) channel.port2.postMessage(null);
      else timer = host.setTimeout(run, delayMs);
    },
    cancel() {
      if (closed) return;
      closed = true;
      pending = false;
      if (timer !== null) host.clearTimeout(timer);
      timer = null;
      if (channel) {
        channel.port1.onmessage = null;
        channel.port1.close();
        channel.port2.close();
      }
    }
  };
}
