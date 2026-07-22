import { LAYERS } from "../data/district.js";
import { vehicleArchetype } from "../data/vehicles.js";
import { paintVehicle } from "../vehicles/VehicleView.js";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, finite(value)));
}

function hashText(value) {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function distanceSquared(a, b) {
  const dx = finite(a?.x) - finite(b?.x);
  const dy = finite(a?.y) - finite(b?.y);
  return dx * dx + dy * dy;
}

function vehicleRadius(archetype) {
  return Math.max(finite(archetype?.width, 28), finite(archetype?.height, 14)) * 0.43;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(finite(value) * factor) / factor;
}

export const DEFAULT_TRAFFIC_LANES_URL = new URL(
  "../../assets/city/packs/traffic-lanes.json",
  import.meta.url
).toString();

export function pointAlongPolyline(points, progress) {
  const list = Array.isArray(points) ? points : [];
  if (!list.length) return { x: 0, y: 0, angle: 0 };
  if (list.length === 1) return { x: finite(list[0].x), y: finite(list[0].y), angle: 0 };

  const segments = [];
  let total = 0;
  for (let index = 0; index < list.length - 1; index++) {
    const from = list[index];
    const to = list[index + 1];
    const length = Math.hypot(finite(to.x) - finite(from.x), finite(to.y) - finite(from.y));
    if (length <= 0.0001) continue;
    segments.push({ from, to, length });
    total += length;
  }
  if (!segments.length || total <= 0.0001) {
    return { x: finite(list[0].x), y: finite(list[0].y), angle: 0 };
  }

  let remaining = clamp01(progress) * total;
  for (const segment of segments) {
    if (remaining <= segment.length) {
      const local = remaining / segment.length;
      const dx = finite(segment.to.x) - finite(segment.from.x);
      const dy = finite(segment.to.y) - finite(segment.from.y);
      return {
        x: finite(segment.from.x) + dx * local,
        y: finite(segment.from.y) + dy * local,
        angle: Math.atan2(dy, dx)
      };
    }
    remaining -= segment.length;
  }

  const last = segments[segments.length - 1];
  return {
    x: finite(last.to.x),
    y: finite(last.to.y),
    angle: Math.atan2(finite(last.to.y) - finite(last.from.y), finite(last.to.x) - finite(last.from.x))
  };
}

export class TrafficMaterializationSystem {
  constructor(scene, {
    lanesUrl = DEFAULT_TRAFFIC_LANES_URL,
    fetchImpl = globalThis.fetch?.bind?.(globalThis),
    maxActiveVehicles = null,
    materializeRadius = null,
    despawnRadius = null
  } = {}) {
    if (!scene?.cityStreamSystem || !scene?.macroTrafficPoliceSystem || !scene?.vehicleSystem) {
      throw new TypeError("TrafficMaterializationSystem requires city, macro traffic and vehicle systems.");
    }
    if (typeof fetchImpl !== "function") throw new TypeError("TrafficMaterializationSystem requires fetch().");

    this.scene = scene;
    this.macro = scene.macroTrafficPoliceSystem;
    this.fetchImpl = fetchImpl;
    this.lanesUrl = new URL(String(lanesUrl), globalThis.document?.baseURI || import.meta.url).toString();
    this.lanes = null;
    this.maxActiveVehicles = maxActiveVehicles;
    this.materializeRadius = materializeRadius;
    this.despawnRadius = despawnRadius;
    this.pool = [];
    this.assignments = new Map();
    this.ready = false;
    this.destroyed = false;
    this.lastCandidateCount = 0;
    this.lastBlockedCandidateCount = 0;
    this.lastPublishedKey = "";
    this.originalVehicleCanOccupy = null;
    this.trafficAwareCanOccupy = null;
    this.initializationError = null;

    this.installVehicleCollisionHook();
    this.installBrowserApi();
    const macroReady = this.macro.initialization || Promise.resolve(this.macro);
    this.initialization = Promise.all([macroReady, this.loadLanes()])
      .then(() => {
        this.configure();
        this.ready = true;
        this.reconcile(true);
        this.publish(true);
        return this;
      })
      .catch(error => {
        this.initializationError = error;
        this.publish(true);
        throw error;
      });

    scene.events?.once?.(globalThis.Phaser?.Scenes?.Events?.SHUTDOWN || "shutdown", this.destroy, this);
  }

  async loadLanes() {
    const response = await this.fetchImpl(this.lanesUrl, { cache: "no-store" });
    if (!response?.ok) throw new Error(`HTTP ${response?.status || 0} while loading ${this.lanesUrl}`);
    const lanes = await response.json();
    if (!lanes?.edges || typeof lanes.edges !== "object") {
      throw new TypeError("Traffic lane manifest is malformed.");
    }
    this.lanes = lanes;
    return lanes;
  }

  configure() {
    const defaults = this.lanes?.defaults || {};
    this.maxActiveVehicles = Math.max(1, Math.floor(finite(
      this.maxActiveVehicles,
      finite(defaults.maxActiveVehicles, 10)
    )));
    this.materializeRadius = Math.max(64, finite(
      this.materializeRadius,
      finite(defaults.materializeRadius, 620)
    ));
    this.despawnRadius = Math.max(this.materializeRadius, finite(
      this.despawnRadius,
      finite(defaults.despawnRadius, 760)
    ));

    const missing = (this.macro.graph?.edgeIds || []).filter(edgeId => {
      const lane = this.lanes.edges[edgeId];
      return !Array.isArray(lane?.forward) || lane.forward.length < 2
        || !Array.isArray(lane?.reverse) || lane.reverse.length < 2;
    });
    if (missing.length) throw new Error(`Traffic lanes missing macro edges: ${missing.join(", ")}`);

    this.ensurePool(this.maxActiveVehicles);
  }

  ensurePool(count) {
    while (this.pool.length < count) this.pool.push(this.createSlot(this.pool.length));
    return this.pool;
  }

  createSlot(index) {
    const archetypeIds = ["compact", "sedan", "van"];
    const archetypeId = archetypeIds[index % archetypeIds.length];
    const archetype = vehicleArchetype(archetypeId);
    if (!archetype) throw new Error(`Unknown traffic archetype ${archetypeId}.`);
    const definition = {
      id: `traffic-pool-${index}`,
      name: "City traffic",
      archetypeId,
      angle: 0
    };
    const container = this.scene.add.container(0, 0).setDepth(45.5).setActive(false).setVisible(false);
    const visual = paintVehicle(this.scene, container, definition, archetype);
    visual.label?.setVisible?.(false);
    container.setAlpha?.(0.94);
    return {
      slotIndex: index,
      id: definition.id,
      tokenId: null,
      edgeId: null,
      tokenIndex: -1,
      direction: null,
      phase: 0,
      x: 0,
      y: 0,
      angle: 0,
      archetype,
      archetypeId,
      radius: vehicleRadius(archetype),
      container,
      visual
    };
  }

  trafficTokens() {
    const graph = this.macro.graph;
    if (!graph || !this.lanes || !(this.macro.trafficFlows instanceof Map)) return [];
    const interpolationSeconds = Math.max(0, finite(this.macro.accumulator));
    const tokens = [];

    for (const edgeId of graph.edgeIds) {
      const edge = graph.edges[edgeId];
      const flow = this.macro.trafficFlows.get(edgeId);
      const lane = this.lanes.edges[edgeId];
      if (!edge || !flow || !lane) continue;
      const phaseOffset = interpolationSeconds / Math.max(1, finite(edge.travelSeconds, 6));
      flow.phases.forEach((phase, tokenIndex) => {
        const direction = tokenIndex % 2 === 0 ? "forward" : "reverse";
        const smoothedPhase = (finite(phase) + phaseOffset) % 1;
        const point = pointAlongPolyline(lane[direction], smoothedPhase);
        tokens.push({
          tokenId: `${edgeId}#${tokenIndex}`,
          edgeId,
          tokenIndex,
          direction,
          phase: smoothedPhase,
          x: point.x,
          y: point.y,
          angle: point.angle
        });
      });
    }
    return tokens;
  }

  focus() {
    return this.scene.cityStreamSystem?.focus?.() || this.scene.renderFocus?.() || this.scene.player || { x: 0, y: 0 };
  }

  pointReady(token, assigned = false) {
    const city = this.scene.cityStreamSystem;
    const resident = city.isPointReady?.(token.x, token.y) ?? true;
    if (!resident) return false;
    return assigned ? true : Boolean(city.isPointActive?.(token.x, token.y) ?? true);
  }

  safeFromPersistentVehicles(token, radius) {
    for (const vehicle of this.scene.vehicleSystem?.vehicles || []) {
      const otherRadius = vehicleRadius(vehicle.archetype);
      if (Math.hypot(finite(vehicle.x) - token.x, finite(vehicle.y) - token.y) < radius + otherRadius + 8) {
        return false;
      }
    }
    const player = this.scene.player;
    if (!this.scene.vehicleSystem?.isDriving?.() && player
      && Math.hypot(finite(player.x) - token.x, finite(player.y) - token.y) < radius + 24) {
      return false;
    }
    return true;
  }

  safeFromTraffic(token, radius, ignoreTokenId = null) {
    for (const slot of this.pool) {
      if (!slot.tokenId || slot.tokenId === ignoreTokenId) continue;
      if (Math.hypot(slot.x - token.x, slot.y - token.y) < radius + slot.radius + 6) return false;
    }
    return true;
  }

  eligible(token, assigned = false) {
    if (this.scene.currentLayer !== LAYERS.STREET) return false;
    const focus = this.focus();
    const limit = assigned ? this.despawnRadius : this.materializeRadius;
    if (distanceSquared(token, focus) > limit * limit) return false;
    if (!this.pointReady(token, assigned)) return false;
    const slot = assigned ? this.assignments.get(token.tokenId) : null;
    const radius = slot?.radius || 16;
    return this.safeFromPersistentVehicles(token, radius)
      && this.safeFromTraffic(token, radius, token.tokenId);
  }

  assign(slot, token) {
    slot.tokenId = token.tokenId;
    this.assignments.set(token.tokenId, slot);
    slot.container.setActive(true).setVisible(true);
    this.updateSlot(slot, token);
    return slot;
  }

  release(slot) {
    if (!slot?.tokenId) return false;
    this.assignments.delete(slot.tokenId);
    slot.tokenId = null;
    slot.edgeId = null;
    slot.tokenIndex = -1;
    slot.direction = null;
    slot.container.setActive(false).setVisible(false);
    return true;
  }

  updateSlot(slot, token) {
    slot.edgeId = token.edgeId;
    slot.tokenIndex = token.tokenIndex;
    slot.direction = token.direction;
    slot.phase = token.phase;
    slot.x = token.x;
    slot.y = token.y;
    slot.angle = token.angle;
    slot.container
      .setPosition(token.x, token.y)
      .setRotation(token.angle)
      .setActive(true)
      .setVisible(this.scene.currentLayer === LAYERS.STREET);
    slot.visual.label?.setRotation?.(-token.angle);
    return slot;
  }

  reconcile(force = false) {
    if (this.destroyed || !this.ready) return false;
    const tokens = this.trafficTokens();
    const byId = new Map(tokens.map(token => [token.tokenId, token]));
    let changed = false;

    for (const slot of this.pool) {
      if (!slot.tokenId) continue;
      const token = byId.get(slot.tokenId);
      if (!token || !this.eligible(token, true)) changed = this.release(slot) || changed;
    }

    const focus = this.focus();
    const candidates = tokens
      .filter(token => !this.assignments.has(token.tokenId))
      .map(token => ({ token, distance: distanceSquared(token, focus) }))
      .sort((left, right) => left.distance - right.distance || left.token.tokenId.localeCompare(right.token.tokenId));

    this.lastCandidateCount = candidates.length;
    this.lastBlockedCandidateCount = 0;
    for (const candidate of candidates) {
      if (this.assignments.size >= this.maxActiveVehicles) break;
      if (!this.eligible(candidate.token, false)) {
        this.lastBlockedCandidateCount++;
        continue;
      }
      const free = this.pool.find(slot => !slot.tokenId);
      if (!free) break;
      this.assign(free, candidate.token);
      changed = true;
    }

    for (const [tokenId, slot] of this.assignments) {
      const token = byId.get(tokenId);
      if (token) this.updateSlot(slot, token);
    }

    this.publish(force || changed);
    return changed;
  }

  update() {
    return this.reconcile(false);
  }

  blocksVehicle(x, y, radius = 0, { ignoreTokenId = null } = {}) {
    const ownRadius = Math.max(0, finite(radius));
    return this.pool.some(slot => (
      slot.tokenId
      && slot.tokenId !== ignoreTokenId
      && slot.container?.active !== false
      && Math.hypot(slot.x - finite(x), slot.y - finite(y)) < ownRadius + slot.radius
    ));
  }

  installVehicleCollisionHook() {
    const vehicleSystem = this.scene.vehicleSystem;
    this.originalVehicleCanOccupy = vehicleSystem.canOccupy;
    const materializer = this;
    this.trafficAwareCanOccupy = function trafficAwareCanOccupy(vehicle, x, y, angle) {
      if (!materializer.originalVehicleCanOccupy.call(this, vehicle, x, y, angle)) return false;
      return !materializer.blocksVehicle(x, y, vehicleRadius(vehicle?.archetype));
    };
    vehicleSystem.canOccupy = this.trafficAwareCanOccupy;
  }

  snapshot() {
    return {
      ready: this.ready,
      lanesId: this.lanes?.id || null,
      poolSize: this.pool.length,
      maxActiveVehicles: this.maxActiveVehicles || 0,
      materializeRadius: round(this.materializeRadius),
      despawnRadius: round(this.despawnRadius),
      tokenCount: this.trafficTokens().length,
      candidateCount: this.lastCandidateCount,
      blockedCandidateCount: this.lastBlockedCandidateCount,
      materializedCount: this.assignments.size,
      materialized: this.pool
        .filter(slot => slot.tokenId)
        .map(slot => ({
          slotIndex: slot.slotIndex,
          tokenId: slot.tokenId,
          edgeId: slot.edgeId,
          tokenIndex: slot.tokenIndex,
          direction: slot.direction,
          archetypeId: slot.archetypeId,
          phase: round(slot.phase, 3),
          x: round(slot.x),
          y: round(slot.y),
          angle: round(slot.angle, 3)
        }))
        .sort((left, right) => left.slotIndex - right.slotIndex),
      initializationError: this.initializationError ? String(this.initializationError.message || this.initializationError) : null
    };
  }

  publish(force = false) {
    const snapshot = this.snapshot();
    const key = JSON.stringify([
      snapshot.ready,
      snapshot.poolSize,
      snapshot.materialized.map(item => item.tokenId),
      snapshot.initializationError
    ]);
    if (!force && key === this.lastPublishedKey) return snapshot;
    this.lastPublishedKey = key;
    this.scene.statePublisher?.setMany?.({
      trafficMaterializationText: `Local traffic ${snapshot.materializedCount}/${snapshot.poolSize}`,
      trafficMaterializationState: snapshot
    });
    if (typeof window !== "undefined") window.NBD_TRAFFIC_READY = snapshot.ready;
    return snapshot;
  }

  installBrowserApi() {
    if (typeof window === "undefined") return;
    window.NBD_TRAFFIC = Object.freeze({
      snapshot: () => this.snapshot(),
      resync: () => this.reconcile(true),
      tokens: () => this.trafficTokens().map(token => ({ ...token })),
      blocks: (x, y, radius = 0) => this.blocksVehicle(x, y, radius)
    });
    window.NBD_TRAFFIC_READY = false;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    const vehicleSystem = this.scene.vehicleSystem;
    if (vehicleSystem && vehicleSystem.canOccupy === this.trafficAwareCanOccupy) {
      vehicleSystem.canOccupy = this.originalVehicleCanOccupy;
    }
    for (const slot of this.pool) slot.container?.destroy?.();
    this.pool = [];
    this.assignments.clear();
    this.lanes = null;
    this.ready = false;
    if (typeof window !== "undefined") {
      delete window.NBD_TRAFFIC;
      window.NBD_TRAFFIC_READY = false;
    }
  }
}
