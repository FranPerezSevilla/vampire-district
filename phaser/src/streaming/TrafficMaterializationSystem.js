import { AI_STATES } from "../data/ai.js";
import { LAYERS } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";
import { VEHICLE_OWNERSHIP, vehicleArchetype } from "../data/vehicles.js";
import { paintVehicle } from "../vehicles/VehicleView.js";

const TRAFFIC_ENTER_RADIUS = 30;
const SPAWN_CAMERA_MARGIN = 54;
const DESPAWN_CAMERA_MARGIN = 300;
const MAX_TRANSIENT_TRAFFIC_VEHICLES = 6;
const MAX_TRANSIENT_OCCUPANTS = 12;

function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, finite(value)));
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

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function safeId(value) {
  return String(value || "traffic").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "traffic";
}

export function cameraWorldBounds(scene) {
  const view = scene?.cameras?.main?.worldView;
  if (!view) return null;
  const width = Math.max(0, finite(view.width));
  const height = Math.max(0, finite(view.height));
  return {
    x: finite(view.x),
    y: finite(view.y),
    width,
    height,
    right: finite(view.x) + width,
    bottom: finite(view.y) + height
  };
}

export function pointInsideCamera(point, bounds, margin = 0) {
  if (!bounds || !point) return false;
  const padding = Math.max(0, finite(margin));
  return finite(point.x) >= bounds.x - padding
    && finite(point.x) <= bounds.right + padding
    && finite(point.y) >= bounds.y - padding
    && finite(point.y) <= bounds.bottom + padding;
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
  static pointAlongPolyline(points, progress) {
    return pointAlongPolyline(points, progress);
  }

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
    this.spawnedOccupants = [];
    this.hijackSequence = 0;
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

  safeFromPersistentVehicles(token, radius, { allowCurrentVehicle = false, allowPlayer = false } = {}) {
    const currentVehicleId = this.scene.vehicleSystem?.currentVehicleId || null;
    for (const vehicle of this.scene.vehicleSystem?.vehicles || []) {
      if (allowCurrentVehicle && currentVehicleId && vehicle.id === currentVehicleId) continue;
      const otherRadius = vehicleRadius(vehicle.archetype);
      if (Math.hypot(finite(vehicle.x) - token.x, finite(vehicle.y) - token.y) < radius + otherRadius + 8) {
        return false;
      }
    }
    const player = this.scene.player;
    if (!allowPlayer && !this.scene.vehicleSystem?.isDriving?.() && player
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
    const slot = assigned ? this.assignments.get(token.tokenId) : null;
    const point = assigned && slot ? slot : token;
    const camera = cameraWorldBounds(this.scene);

    if (assigned) {
      const retainedByCamera = pointInsideCamera(point, camera, DESPAWN_CAMERA_MARGIN);
      const retainedByFollow = distanceSquared(point, focus) <= this.despawnRadius * this.despawnRadius;
      if (!retainedByCamera && !retainedByFollow) return false;
      return this.pointReady(point, true);
    }

    if (distanceSquared(token, focus) > this.materializeRadius * this.materializeRadius) return false;
    if (pointInsideCamera(token, camera, SPAWN_CAMERA_MARGIN)) return false;
    if (!this.pointReady(token, false)) return false;
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
    slot.speedFactor = 1;
    slot.desiredSpeedFactor = 1;
    slot.behaviorReason = null;
    slot.behaviorGap = null;
    slot.behaviorLag = 0;
    slot.behaviorBlockerId = null;
    slot.junctionId = null;
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
      if (token && (force || !Number.isFinite(slot.speedFactor))) this.updateSlot(slot, token);
    }

    this.publish(force || changed);
    return changed;
  }

  update() {
    return this.reconcile(false);
  }

  collectInteractions() {
    if (this.scene.currentLayer !== LAYERS.STREET || this.scene.vehicleSystem?.isDriving?.()) return [];
    if (this.scene.feedingSystem?.isActive?.() || this.scene.evidenceSystem?.draggingBody) return [];
    const player = this.scene.player;
    if (!player) return [];
    const options = [];
    for (const slot of this.pool) {
      if (!slot.tokenId) continue;
      const distance = Math.hypot(slot.x - player.x, slot.y - player.y);
      if (distance > TRAFFIC_ENTER_RADIUS) continue;
      options.push({
        id: `steal_${slot.tokenId}`,
        type: "vehicleEnter",
        label: `Steal ${slot.archetype.label}`,
        detail: "ENTER · civilian traffic · occupants aboard",
        priority: 112,
        distance,
        x: slot.x,
        y: slot.y,
        target: slot,
        run: () => this.hijack(slot.tokenId)
      });
    }
    return options;
  }

  occupantCount(slot) {
    if (slot.archetypeId === "van") return 2;
    if (slot.archetypeId === "sedan") return 1 + (stableHash(slot.tokenId) % 2);
    return 1;
  }

  occupantPosition(slot, index, count) {
    const side = index % 2 === 0 ? 1 : -1;
    const row = Math.floor(index / 2);
    const lateral = slot.radius + 13 + row * 5;
    const longitudinal = (index - (count - 1) / 2) * 9;
    const perpendicular = slot.angle + Math.PI / 2;
    const candidates = [side, -side].map(direction => ({
      x: slot.x + Math.cos(perpendicular) * lateral * direction + Math.cos(slot.angle) * longitudinal,
      y: slot.y + Math.sin(perpendicular) * lateral * direction + Math.sin(slot.angle) * longitudinal
    }));
    return candidates.find(point => this.scene.canStandAt?.(point.x, point.y)) || candidates[0];
  }

  spawnOccupants(slot, vehicleId) {
    const count = this.occupantCount(slot);
    const occupants = [];
    for (let index = 0; index < count; index++) {
      const position = this.occupantPosition(slot, index, count);
      const id = `traffic-occupant-${safeId(slot.tokenId)}-${this.hijackSequence}-${index}`;
      const npc = this.scene.npcSystem?.createNpc?.({
        id,
        type: NPC_TYPES.CIVILIAN,
        x: position.x,
        y: position.y,
        layer: LAYERS.STREET,
        speed: 12,
        behavior: "loiter",
        vehicleOccupant: true,
        sourceVehicleId: vehicleId
      });
      if (!npc) continue;
      npc.transientTrafficOccupant = true;
      npc.transientSequence = this.hijackSequence;
      npc.inactive = false;
      npc.alarmed = false;
      if (npc.ai) {
        npc.ai.state = AI_STATES.INVESTIGATING;
        npc.ai.intent = "carjacked-wtf";
      }
      this.scene.npcSystem.npcs.push(npc);
      this.scene.sensoryAwarenessSystem?.startHeardOnlyReaction?.(
        npc,
        { x: slot.x, y: slot.y },
        { reaction: 2.8 }
      );
      occupants.push(npc);
      this.spawnedOccupants.push(npc);
    }
    this.pruneOccupants();
    this.scene.npcSystem?.rebuildSpatialIndex?.();
    return occupants;
  }

  pruneOccupants() {
    this.spawnedOccupants = this.spawnedOccupants.filter(npc => this.scene.npcSystem?.npcs?.includes?.(npc));
    const removable = this.spawnedOccupants.filter(npc => !npc.dead && !npc.dragged);
    while (this.spawnedOccupants.length > MAX_TRANSIENT_OCCUPANTS && removable.length) {
      const npc = removable.shift();
      const allIndex = this.scene.npcSystem.npcs.indexOf(npc);
      if (allIndex >= 0) this.scene.npcSystem.npcs.splice(allIndex, 1);
      const ownIndex = this.spawnedOccupants.indexOf(npc);
      if (ownIndex >= 0) this.spawnedOccupants.splice(ownIndex, 1);
      npc.__nbdWtfLabel?.destroy?.();
      npc.container?.destroy?.();
    }
  }

  hijack(tokenId) {
    const slot = this.assignments.get(String(tokenId));
    if (!slot || this.scene.vehicleSystem?.isDriving?.()) return false;
    const distance = Math.hypot(slot.x - finite(this.scene.player?.x), slot.y - finite(this.scene.player?.y));
    if (distance > TRAFFIC_ENTER_RADIUS + 3) return false;

    const captured = {
      tokenId: slot.tokenId,
      edgeId: slot.edgeId,
      tokenIndex: slot.tokenIndex,
      direction: slot.direction,
      x: slot.x,
      y: slot.y,
      angle: slot.angle,
      radius: slot.radius,
      archetype: slot.archetype,
      archetypeId: slot.archetypeId
    };
    this.hijackSequence++;
    this.release(slot);

    const vehicleId = `traffic-stolen-${this.hijackSequence}-${safeId(captured.tokenId)}`;
    const vehicle = this.scene.vehicleSystem.addTransientVehicle({
      id: vehicleId,
      name: `${captured.archetype.label} from traffic`,
      archetypeId: captured.archetypeId,
      x: captured.x,
      y: captured.y,
      angle: captured.angle,
      ownership: VEHICLE_OWNERSHIP.PARKED,
      ownerId: `traffic-owner-${safeId(captured.tokenId)}`,
      factionId: null,
      parked: true,
      layer: LAYERS.STREET,
      transient: true,
      trafficOriginTokenId: captured.tokenId
    });
    const entered = this.scene.vehicleSystem.enterVehicle(vehicle.id, { force: true });
    if (!entered) {
      const index = this.scene.vehicleSystem.vehicles.indexOf(vehicle);
      if (index >= 0) this.scene.vehicleSystem.vehicles.splice(index, 1);
      vehicle.container?.destroy?.();
      return false;
    }

    const occupants = this.spawnOccupants(captured, vehicle.id);
    this.scene.vehicleSystem.pruneTransientVehicles(MAX_TRANSIENT_TRAFFIC_VEHICLES);
    this.scene.lastActionText += ` ${occupants.length === 1 ? "The occupant jumps out" : `${occupants.length} occupants jump out`} in WTF mode.`;
    this.scene.events?.emit?.("traffic:vehicle-hijacked", {
      tokenId: captured.tokenId,
      vehicleId: vehicle.id,
      occupants: occupants.map(npc => npc.id)
    });
    this.publish(true);
    return true;
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
    const camera = cameraWorldBounds(this.scene);
    return {
      ready: this.ready,
      lanesId: this.lanes?.id || null,
      poolSize: this.pool.length,
      maxActiveVehicles: this.maxActiveVehicles || 0,
      materializeRadius: round(this.materializeRadius),
      despawnRadius: round(this.despawnRadius),
      spawnCameraMargin: SPAWN_CAMERA_MARGIN,
      despawnCameraMargin: DESPAWN_CAMERA_MARGIN,
      camera: camera ? {
        x: round(camera.x),
        y: round(camera.y),
        width: round(camera.width),
        height: round(camera.height)
      } : null,
      tokenCount: this.trafficTokens().length,
      candidateCount: this.lastCandidateCount,
      blockedCandidateCount: this.lastBlockedCandidateCount,
      materializedCount: this.assignments.size,
      transientVehicleCount: this.scene.vehicleSystem?.vehicles?.filter?.(vehicle => vehicle.transient).length || 0,
      transientOccupantCount: this.spawnedOccupants.length,
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
          angle: round(slot.angle, 3),
          insideCamera: pointInsideCamera(slot, camera, 0)
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
      snapshot.transientVehicleCount,
      snapshot.transientOccupantCount,
      snapshot.initializationError
    ]);
    if (!force && key === this.lastPublishedKey) return snapshot;
    this.lastPublishedKey = key;
    this.scene.statePublisher?.setMany?.({
      trafficMaterializationText: `Local traffic ${snapshot.materializedCount}/${snapshot.poolSize} · stolen ${snapshot.transientVehicleCount}`,
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
      blocks: (x, y, radius = 0) => this.blocksVehicle(x, y, radius),
      steal: tokenId => this.hijack(tokenId)
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
    for (const npc of this.spawnedOccupants) npc.__nbdWtfLabel?.destroy?.();
    this.pool = [];
    this.spawnedOccupants = [];
    this.assignments.clear();
    this.lanes = null;
    this.ready = false;
    if (typeof window !== "undefined") {
      delete window.NBD_TRAFFIC;
      window.NBD_TRAFFIC_READY = false;
    }
  }
}
