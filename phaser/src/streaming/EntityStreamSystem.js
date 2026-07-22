import { chunkIdAt } from "./CityChunkManifest.js";
import {
  ENTITY_STREAM_STATES,
  npcStreamDecision,
  vehicleStreamDecision
} from "./EntityStreamPolicy.js";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function sortedCounts(records) {
  const counts = Object.fromEntries(Object.values(ENTITY_STREAM_STATES).map(state => [state, 0]));
  for (const record of records.values()) counts[record.state] = (counts[record.state] || 0) + 1;
  return counts;
}

export class EntityStreamSystem {
  constructor(scene) {
    if (!scene?.cityStreamSystem || !scene?.npcSystem) {
      throw new TypeError("EntityStreamSystem requires city and NPC streaming authorities.");
    }
    this.scene = scene;
    this.npcRecords = new Map();
    this.vehicleRecords = new Map();
    this.transitionLog = [];
    this.tick = 0;
    this.lastPublishedKey = "";
    this.destroyed = false;
    this.update(0, { force: true });
    scene.events?.once?.(globalThis.Phaser?.Scenes?.Events?.SHUTDOWN || "shutdown", this.destroy, this);
  }

  chunkStateAt(x, y) {
    const city = this.scene.cityStreamSystem;
    const id = chunkIdAt(x, y, city.manifest.chunkSize);
    return {
      id,
      active: city.isChunkActive(id),
      prefetched: city.prefetchedChunkIds.has(id),
      chunkState: city.stateOf(id)
    };
  }

  npcDecision(npc) {
    const chunk = this.chunkStateAt(npc?.x, npc?.y);
    return {
      ...npcStreamDecision(npc, {
        ...chunk,
        exposureLevel: this.scene.exposureSystem?.level?.() || 0
      }),
      chunkId: chunk.id,
      chunkState: chunk.chunkState
    };
  }

  vehicleDecision(vehicle) {
    const chunk = this.chunkStateAt(vehicle?.x, vehicle?.y);
    return {
      ...vehicleStreamDecision(vehicle, {
        ...chunk,
        currentVehicleId: this.scene.vehicleSystem?.currentVehicleId || null
      }),
      chunkId: chunk.id,
      chunkState: chunk.chunkState
    };
  }

  transition(kind, entity, decision) {
    const records = kind === "npc" ? this.npcRecords : this.vehicleRecords;
    const id = String(entity?.id || "");
    if (!id) return null;
    let record = records.get(id);
    if (!record) {
      record = {
        id,
        kind,
        state: decision.state,
        reason: decision.reason,
        chunkId: decision.chunkId,
        chunkState: decision.chunkState,
        transitions: 0,
        dormantSeconds: 0,
        lastChangedTick: this.tick
      };
      records.set(id, record);
      return record;
    }
    const changed = record.state !== decision.state
      || record.reason !== decision.reason
      || record.chunkId !== decision.chunkId;
    if (changed) {
      this.transitionLog.push({
        tick: this.tick,
        kind,
        id,
        from: record.state,
        to: decision.state,
        reason: decision.reason,
        chunkId: decision.chunkId
      });
      if (this.transitionLog.length > 64) this.transitionLog.shift();
      record.transitions++;
      record.lastChangedTick = this.tick;
    }
    record.state = decision.state;
    record.reason = decision.reason;
    record.chunkId = decision.chunkId;
    record.chunkState = decision.chunkState;
    if (record.state !== ENTITY_STREAM_STATES.DORMANT) record.dormantSeconds = 0;
    return record;
  }

  advanceDormantNpc(npc, dt, record) {
    const seconds = Math.max(0, finite(dt));
    record.dormantSeconds += seconds;
    for (const key of ["stunnedTimer", "luredTimer", "soundReactionTimer", "reactionTimer"]) {
      if (Number.isFinite(Number(npc[key])) && npc[key] > 0) npc[key] = Math.max(0, npc[key] - seconds);
    }
    npc.container?.setActive?.(false).setVisible?.(false);
    npc.__nbdWtfLabel?.setVisible?.(false);
  }

  applyNpcState(npc, dt = 0) {
    const decision = this.npcDecision(npc);
    const record = this.transition("npc", npc, decision);
    npc.streamState = decision.state;
    npc.streamReason = decision.reason;
    npc.streamChunkId = decision.chunkId;
    if (decision.state === ENTITY_STREAM_STATES.DORMANT) {
      this.advanceDormantNpc(npc, dt, record);
    } else {
      npc.container?.setActive?.(true);
    }
    return decision;
  }

  applyVehicleState(vehicle) {
    const decision = this.vehicleDecision(vehicle);
    this.transition("vehicle", vehicle, decision);
    vehicle.streamState = decision.state;
    vehicle.streamReason = decision.reason;
    vehicle.streamChunkId = decision.chunkId;
    vehicle.container?.setActive?.(decision.state !== ENTITY_STREAM_STATES.DORMANT);
    return decision;
  }

  update(dt = 0, { force = false } = {}) {
    if (this.destroyed) return false;
    this.tick++;
    for (const npc of this.scene.npcSystem?.npcs || []) this.applyNpcState(npc, dt);
    for (const vehicle of this.scene.vehicleSystem?.vehicles || []) this.applyVehicleState(vehicle);
    this.publish(force);
    return true;
  }

  shouldSimulateNpc(npc) {
    const state = npc?.streamState || this.applyNpcState(npc).state;
    return state !== ENTITY_STREAM_STATES.DORMANT;
  }

  shouldIndexNpc(npc) {
    return this.shouldSimulateNpc(npc);
  }

  shouldRenderNpc(npc) {
    return this.shouldSimulateNpc(npc);
  }

  shouldRenderVehicle(vehicle) {
    const state = vehicle?.streamState || this.applyVehicleState(vehicle).state;
    return state !== ENTITY_STREAM_STATES.DORMANT;
  }

  stateOf(id) {
    return this.npcRecords.get(String(id))?.state
      || this.vehicleRecords.get(String(id))?.state
      || ENTITY_STREAM_STATES.DORMANT;
  }

  snapshot() {
    const npcCounts = sortedCounts(this.npcRecords);
    const vehicleCounts = sortedCounts(this.vehicleRecords);
    return {
      tick: this.tick,
      npcCounts,
      vehicleCounts,
      simulatedNpcCount: npcCounts.active + npcCounts.pinned,
      dormantNpcCount: npcCounts.dormant,
      activeVehicleCount: vehicleCounts.active + vehicleCounts.pinned,
      dormantVehicleCount: vehicleCounts.dormant,
      pinned: [...this.npcRecords.values(), ...this.vehicleRecords.values()]
        .filter(record => record.state === ENTITY_STREAM_STATES.PINNED)
        .map(record => ({ id: record.id, kind: record.kind, reason: record.reason, chunkId: record.chunkId }))
        .sort((left, right) => left.id.localeCompare(right.id)),
      recentTransitions: this.transitionLog.slice(-16)
    };
  }

  publish(force = false) {
    const snapshot = this.snapshot();
    const key = JSON.stringify([snapshot.npcCounts, snapshot.vehicleCounts, snapshot.pinned]);
    if (!force && key === this.lastPublishedKey) return snapshot;
    this.lastPublishedKey = key;
    this.scene.statePublisher?.setMany?.({
      entityStreamText: `Entities ${snapshot.simulatedNpcCount} NPC active · ${snapshot.dormantNpcCount} dormant · ${snapshot.activeVehicleCount} vehicles active`,
      entityStreamState: snapshot
    });
    if (typeof window !== "undefined") {
      window.NBD_ENTITY_STREAM = Object.freeze({
        snapshot: () => this.snapshot(),
        stateOf: id => this.stateOf(id),
        resync: () => this.update(0, { force: true })
      });
      window.NBD_ENTITY_STREAM_READY = true;
    }
    return snapshot;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.npcRecords.clear();
    this.vehicleRecords.clear();
    this.transitionLog = [];
    if (typeof window !== "undefined") {
      if (window.NBD_ENTITY_STREAM) delete window.NBD_ENTITY_STREAM;
      window.NBD_ENTITY_STREAM_READY = false;
    }
  }
}