function timestamp(now) {
  return Math.max(0, Math.trunc(Number(now()) || 0));
}

function optionalId(value) {
  const text = String(value || "").trim();
  return text || null;
}

function plainData(value) {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Checkpoint payload must be a plain object.");
  }
  return JSON.parse(JSON.stringify(value));
}

function equivalentCheckpoint(a, b) {
  if (!a || !b) return false;
  return a.id === b.id
    && a.kind === b.kind
    && a.missionId === b.missionId
    && a.objectiveId === b.objectiveId
    && a.locationId === b.locationId
    && JSON.stringify(a.payload || {}) === JSON.stringify(b.payload || {});
}

export class CampaignCheckpointSystem {
  constructor(state, {
    events = null,
    now = () => Date.now(),
    onDirty = null
  } = {}) {
    if (!state || typeof state !== "object") throw new TypeError("CampaignCheckpointSystem requires campaign state.");
    this.state = state;
    this.events = events;
    this.now = now;
    this.onDirty = typeof onDirty === "function" ? onDirty : null;
  }

  capture({
    id,
    kind = "objective",
    missionId = null,
    objectiveId = null,
    locationId = null,
    payload = {}
  } = {}) {
    const checkpointId = String(id || "").trim();
    if (!checkpointId) throw new TypeError("Checkpoint id is required.");

    const next = {
      id: checkpointId,
      kind: String(kind || "objective"),
      missionId: optionalId(missionId),
      objectiveId: optionalId(objectiveId),
      locationId: optionalId(locationId),
      capturedAt: timestamp(this.now),
      payload: plainData(payload)
    };

    if (equivalentCheckpoint(this.state.checkpoint, next)) return this.snapshot();
    this.state.checkpoint = next;
    this.events?.emit?.("checkpoint:captured", {
      checkpointId: next.id,
      kind: next.kind,
      missionId: next.missionId,
      objectiveId: next.objectiveId,
      locationId: next.locationId
    });
    this.onDirty?.(this.state, { eventType: "checkpoint:captured", checkpoint: next });
    return this.snapshot();
  }

  clear(reason = "manual") {
    const previous = this.state.checkpoint;
    if (!previous?.id) return false;
    this.state.checkpoint = {
      id: null,
      kind: "none",
      missionId: null,
      objectiveId: null,
      locationId: null,
      capturedAt: timestamp(this.now),
      payload: {}
    };
    this.events?.emit?.("checkpoint:cleared", {
      checkpointId: previous.id,
      reason: String(reason || "manual")
    });
    this.onDirty?.(this.state, { eventType: "checkpoint:cleared", checkpoint: this.state.checkpoint });
    return true;
  }

  snapshot() {
    return JSON.parse(JSON.stringify(this.state.checkpoint || null));
  }
}
