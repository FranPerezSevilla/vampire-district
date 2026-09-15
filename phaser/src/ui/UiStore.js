/** A cached, detached snapshot for React; no gameplay data is stored here as authority. */
export function createUiStore(initial = { ready: false, mode: null }) {
  let signature = JSON.stringify(initial), snapshot;
  const listeners = new Set();
  const freeze = value => {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  snapshot = freeze(JSON.parse(signature));
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    publish(value) {
      const next = JSON.stringify(value);
      if (next === signature) return false;
      signature = next;
      // Detach first: freezing a snapshot must never freeze live campaign objects.
      snapshot = freeze(JSON.parse(next));
      for (const listener of [...listeners]) listener();
      return true;
    },
    destroy() { listeners.clear(); }
  };
}
