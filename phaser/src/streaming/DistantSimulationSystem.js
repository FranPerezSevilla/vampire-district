import { pedestrianRoutes } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";
import { chunkIdAt } from "./CityChunkManifest.js";
import { ENTITY_STREAM_STATES } from "./EntityStreamPolicy.js";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function hashText(value) {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicPause(npcId, completedSegments) {
  const hash = hashText(`${npcId}:${completedSegments}`);
  return 0.24 + (hash % 37) / 100;
}

function routeMap() {
  return new Map(pedestrianRoutes.map(route => [route.id, route]));
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

export class DistantSimulationSystem {
  constructor(scene, {
    intervalSeconds = 1,
    entityBudget = 16,
    maxCatchUpTicks = 4
  } = {}) {
    if (!scene?.entityStreamSystem || !scene?.cityStreamSystem || !scene?.pedestrianSystem) {
      throw new TypeError("DistantSimulationSystem requires city, entity and pedestrian streaming systems.");
    }
    this.scene = scene;
    this.routes = routeMap();
    this.intervalSeconds = Math.max(0.25, finite(intervalSeconds, 1));
    this.entityBudget = Math.max(1, Math.floor(finite(entityBudget, 16)));
    this.maxCatchUpTicks = Math.max(1, Math.floor(finite(maxCatchUpTicks, 4)));
    this.accumulator = 0;
    this.tick = 0;
    this.cursor = 0;
    this.totalAdvanced = 0;
    this.lastAdvancedIds = [];
    this.lastSkipped = 0;
    this.byChunk = {};
    this.destroyed = false;
    this.installBrowserApi();
    this.publish();
    scene.events?.once?.(globalThis.Phaser?.Scenes?.Events?.SHUTDOWN || "shutdown", this.destroy, this);
  }

  dormantPedestrians() {
    return (this.scene.pedestrianSystem?.pedestrians || []).filter(npc => (
      npc?.type === NPC_TYPES.CIVILIAN
      && npc?.pedestrian
      && npc.streamState === ENTITY_STREAM_STATES.DORMANT
      && !npc.dead
      && !npc.inactive
      && !npc.hiddenBody
      && !npc.dragged
      && !npc.intercepted
      && !npc.alarmed
      && !npc.chasingPlayer
      && !npc.enemyAttack
      && finite(npc.stunnedTimer) <= 0
    ));
  }

  advancePedestrian(npc, seconds) {
    const state = npc?.pedestrian;
    const route = this.routes.get(state?.routeId);
    if (!route?.points?.length) return false;
    let remaining = Math.max(0, finite(seconds));
    let guard = route.points.length * 3 + 4;
    let moved = false;

    while (remaining > 0.0001 && guard-- > 0) {
      if (finite(state.wait) > 0) {
        const consumed = Math.min(remaining, state.wait);
        state.wait = Math.max(0, state.wait - consumed);
        remaining -= consumed;
        if (remaining <= 0.0001) break;
      }

      const target = route.points[state.pointIndex] || route.points[0];
      const dx = finite(target.x) - finite(npc.x);
      const dy = finite(target.y) - finite(npc.y);
      const distance = Math.hypot(dx, dy);
      const speed = Math.max(4, finite(npc.speed, 9));

      if (distance <= 0.001) {
        npc.x = finite(target.x);
        npc.y = finite(target.y);
        state.pointIndex = (state.pointIndex + 1) % route.points.length;
        state.completedSegments = finite(state.completedSegments) + 1;
        if (target.crosswalk) state.wait = deterministicPause(npc.id, state.completedSegments);
        continue;
      }

      const travelAvailable = speed * remaining;
      if (travelAvailable + 0.001 >= distance) {
        npc.x = finite(target.x);
        npc.y = finite(target.y);
        npc.dirX = dx / distance;
        npc.dirY = dy / distance;
        npc.vx = npc.dirX * speed;
        npc.vy = npc.dirY * speed;
        remaining = Math.max(0, remaining - distance / speed);
        state.pointIndex = (state.pointIndex + 1) % route.points.length;
        state.completedSegments = finite(state.completedSegments) + 1;
        if (target.crosswalk) state.wait = deterministicPause(npc.id, state.completedSegments);
        moved = true;
        continue;
      }

      const ratio = travelAvailable / distance;
      npc.dirX = dx / distance;
      npc.dirY = dy / distance;
      npc.vx = npc.dirX * speed;
      npc.vy = npc.dirY * speed;
      npc.x = finite(npc.x) + dx * ratio;
      npc.y = finite(npc.y) + dy * ratio;
      remaining = 0;
      moved = true;
    }

    return moved;
  }

  rebuildMacroCounts() {
    const city = this.scene.cityStreamSystem;
    const chunkSize = city.manifest?.chunkSize;
    const npcCounts = new Map();
    const vehicleCounts = new Map();
    if (chunkSize) {
      for (const npc of this.scene.npcSystem?.npcs || []) {
        if (npc.streamState !== ENTITY_STREAM_STATES.DORMANT || npc.dead || npc.inactive) continue;
        increment(npcCounts, chunkIdAt(npc.x, npc.y, chunkSize));
      }
      for (const vehicle of this.scene.vehicleSystem?.vehicles || []) {
        if (vehicle.streamState !== ENTITY_STREAM_STATES.DORMANT) continue;
        increment(vehicleCounts, chunkIdAt(vehicle.x, vehicle.y, chunkSize));
      }
    }
    const chunkIds = new Set([...npcCounts.keys(), ...vehicleCounts.keys()]);
    this.byChunk = Object.fromEntries([...chunkIds].sort().map(id => [id, {
      dormantNpcs: npcCounts.get(id) || 0,
      dormantVehicles: vehicleCounts.get(id) || 0
    }]));
    return this.byChunk;
  }

  simulateTick(seconds = this.intervalSeconds) {
    if (this.destroyed) return 0;
    const pedestrians = this.dormantPedestrians();
    const count = Math.min(this.entityBudget, pedestrians.length);
    const advanced = [];
    for (let offset = 0; offset < count; offset++) {
      const index = pedestrians.length ? (this.cursor + offset) % pedestrians.length : 0;
      const npc = pedestrians[index];
      if (npc && this.advancePedestrian(npc, seconds)) advanced.push(npc.id);
    }
    if (pedestrians.length) this.cursor = (this.cursor + count) % pedestrians.length;
    this.tick++;
    this.totalAdvanced += advanced.length;
    this.lastAdvancedIds = advanced;
    this.lastSkipped = Math.max(0, pedestrians.length - count);
    this.rebuildMacroCounts();
    this.publish();
    return advanced.length;
  }

  update(dt = 0) {
    if (this.destroyed || this.scene.registry?.get?.("uiPaused")) return false;
    this.accumulator += Math.max(0, finite(dt));
    let ticks = 0;
    while (this.accumulator >= this.intervalSeconds && ticks < this.maxCatchUpTicks) {
      this.accumulator -= this.intervalSeconds;
      this.simulateTick(this.intervalSeconds);
      ticks++;
    }
    if (ticks >= this.maxCatchUpTicks) this.accumulator = Math.min(this.accumulator, this.intervalSeconds);
    return ticks > 0;
  }

  snapshot() {
    const dormantPedestrians = this.dormantPedestrians();
    const dormantVehicles = (this.scene.vehicleSystem?.vehicles || [])
      .filter(vehicle => vehicle.streamState === ENTITY_STREAM_STATES.DORMANT).length;
    return {
      tick: this.tick,
      intervalSeconds: this.intervalSeconds,
      entityBudget: this.entityBudget,
      accumulator: Number(this.accumulator.toFixed(3)),
      dormantPedestrians: dormantPedestrians.length,
      dormantVehicles,
      totalAdvanced: this.totalAdvanced,
      lastAdvancedIds: [...this.lastAdvancedIds],
      lastSkipped: this.lastSkipped,
      byChunk: this.byChunk
    };
  }

  publish() {
    const snapshot = this.snapshot();
    this.scene.statePublisher?.setMany?.({
      distantSimulationText: `Distant simulation · ${snapshot.dormantPedestrians} pedestrians · tick ${snapshot.tick}`,
      distantSimulationState: snapshot
    });
    if (typeof window !== "undefined") window.NBD_DISTANT_SIM_READY = true;
    return snapshot;
  }

  installBrowserApi() {
    if (typeof window === "undefined") return;
    window.NBD_DISTANT_SIM = Object.freeze({
      snapshot: () => this.snapshot(),
      forceTick: (seconds = this.intervalSeconds) => this.simulateTick(Math.max(0, finite(seconds, this.intervalSeconds)))
    });
    window.NBD_DISTANT_SIM_READY = true;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.routes.clear();
    this.byChunk = {};
    if (typeof window !== "undefined") {
      delete window.NBD_DISTANT_SIM;
      window.NBD_DISTANT_SIM_READY = false;
    }
  }
}
