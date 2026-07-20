function plainPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const result = {};
  for (const [key, value] of Object.entries(payload)) {
    if (["string", "number", "boolean"].includes(typeof value) || value == null) result[key] = value;
  }
  return result;
}

export class CampaignEventBus {
  constructor(state, { now = () => Date.now(), maxLogEntries = 250 } = {}) {
    this.state = state;
    this.now = now;
    this.maxLogEntries = Math.max(10, Math.trunc(Number(maxLogEntries) || 250));
    this.listeners = new Map();
  }

  on(type, listener) {
    if (typeof listener !== "function") throw new TypeError("Campaign event listener must be a function.");
    const key = String(type || "*");
    const listeners = this.listeners.get(key) || new Set();
    listeners.add(listener);
    this.listeners.set(key, listeners);
    return () => this.off(key, listener);
  }

  once(type, listener) {
    const dispose = this.on(type, event => {
      dispose();
      listener(event);
    });
    return dispose;
  }

  off(type, listener) {
    const key = String(type || "*");
    const listeners = this.listeners.get(key);
    if (!listeners) return false;
    const deleted = listeners.delete(listener);
    if (!listeners.size) this.listeners.delete(key);
    return deleted;
  }

  emit(type, payload = {}, { record = true } = {}) {
    const eventType = String(type || "").trim();
    if (!eventType) throw new TypeError("Campaign event type is required.");
    const timestamp = Math.max(0, Math.trunc(Number(this.now()) || 0));
    this.state.sequences.event = Math.max(0, Number(this.state.sequences.event) || 0) + 1;
    const event = Object.freeze({
      id: `evt-${String(this.state.sequences.event).padStart(6, "0")}`,
      type: eventType,
      timestamp,
      payload: Object.freeze(plainPayload(payload))
    });

    if (record) {
      this.state.eventLog.push({
        id: event.id,
        type: event.type,
        timestamp: event.timestamp,
        payload: { ...event.payload }
      });
      if (this.state.eventLog.length > this.maxLogEntries) {
        this.state.eventLog.splice(0, this.state.eventLog.length - this.maxLogEntries);
      }
    }

    for (const listener of this.listeners.get(eventType) || []) listener(event);
    for (const listener of this.listeners.get("*") || []) listener(event);
    return event;
  }

  clear() {
    this.listeners.clear();
  }
}
