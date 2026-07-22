import { LAYERS } from "../data/district.js";

function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(finite(value) * factor) / factor;
}

function moveToward(current, target, amount) {
  const from = finite(current);
  const to = finite(target);
  const step = Math.max(0, finite(amount));
  if (Math.abs(to - from) <= step) return to;
  return from + Math.sign(to - from) * step;
}

function vehicleRadius(archetype) {
  return Math.max(finite(archetype?.width, 28), finite(archetype?.height, 14)) * 0.43;
}

function laneKey(edgeId, direction) {
  return `${String(edgeId || "")}:${String(direction || "forward")}`;
}

export function wrapPhase(value) {
  const number = finite(value);
  return ((number % 1) + 1) % 1;
}

export function forwardPhaseDistance(from, to) {
  return wrapPhase(finite(to) - finite(from));
}

export function polylineLength(points) {
  const list = Array.isArray(points) ? points : [];
  let total = 0;
  for (let index = 0; index < list.length - 1; index++) {
    total += Math.hypot(
      finite(list[index + 1]?.x) - finite(list[index]?.x),
      finite(list[index + 1]?.y) - finite(list[index]?.y)
    );
  }
  return total;
}

export function nearestPointOnPolyline(points, x, y) {
  const list = Array.isArray(points) ? points : [];
  if (!list.length) return { x: 0, y: 0, progress: 0, distance: Infinity, angle: 0, length: 0 };
  if (list.length === 1) {
    const px = finite(list[0]?.x);
    const py = finite(list[0]?.y);
    return { x: px, y: py, progress: 0, distance: Math.hypot(finite(x) - px, finite(y) - py), angle: 0, length: 0 };
  }

  const total = polylineLength(list);
  let traversed = 0;
  let best = null;
  for (let index = 0; index < list.length - 1; index++) {
    const from = list[index];
    const to = list[index + 1];
    const ax = finite(from?.x);
    const ay = finite(from?.y);
    const dx = finite(to?.x) - ax;
    const dy = finite(to?.y) - ay;
    const length = Math.hypot(dx, dy);
    if (length <= 0.0001) continue;
    const local = clamp(((finite(x) - ax) * dx + (finite(y) - ay) * dy) / (length * length), 0, 1);
    const px = ax + dx * local;
    const py = ay + dy * local;
    const distance = Math.hypot(finite(x) - px, finite(y) - py);
    const candidate = {
      x: px,
      y: py,
      progress: total > 0 ? (traversed + length * local) / total : 0,
      distance,
      angle: Math.atan2(dy, dx),
      length: total
    };
    if (!best || candidate.distance < best.distance) best = candidate;
    traversed += length;
  }
  return best || { x: finite(list[0]?.x), y: finite(list[0]?.y), progress: 0, distance: Infinity, angle: 0, length: total };
}

export class TrafficLocalBehaviorSystem {
  constructor(scene, options = {}) {
    if (!scene?.trafficMaterializationSystem || !scene?.vehicleSystem) {
      throw new TypeError("TrafficLocalBehaviorSystem requires traffic materialization and vehicle systems.");
    }
    this.scene = scene;
    this.materializer = scene.trafficMaterializationSystem;
    this.vehicleSystem = scene.vehicleSystem;
    this.options = { ...options };
    this.states = new Map();
    this.laneCache = new Map();
    this.junctionProjectionCache = new Map();
    this.junctions = [];
    this.followDistance = 78;
    this.hardStopDistance = 34;
    this.playerLookAhead = 132;
    this.laneTolerance = 38;
    this.accelerationRate = 1.35;
    this.brakingRate = 5.8;
    this.catchUpSpeed = 1.24;
    this.junctionApproachDistance = 82;
    this.junctionRadius = 30;
    this.ready = false;
    this.destroyed = false;
    this.lastPublishedKey = "";
    this.initializationError = null;
    this.installBrowserApi();
    this.initialization = Promise.resolve(this.materializer.initialization)
      .then(() => {
        this.configure();
        this.ready = true;
        this.update(0, { force: true });
        return this;
      })
      .catch(error => {
        this.initializationError = error;
        this.publish(true);
        throw error;
      });
    scene.events?.once?.(globalThis.Phaser?.Scenes?.Events?.SHUTDOWN || "shutdown", this.destroy, this);
  }

  configure() {
    const config = this.materializer.lanes?.behavior || {};
    const option = (key, fallback) => finite(this.options[key], finite(config[key], fallback));
    this.followDistance = Math.max(24, option("followDistance", 78));
    this.hardStopDistance = clamp(option("hardStopDistance", 34), 8, this.followDistance - 4);
    this.playerLookAhead = Math.max(this.followDistance, option("playerLookAhead", 132));
    this.laneTolerance = Math.max(18, option("laneTolerance", 38));
    this.accelerationRate = Math.max(0.1, option("accelerationRate", 1.35));
    this.brakingRate = Math.max(this.accelerationRate, option("brakingRate", 5.8));
    this.catchUpSpeed = clamp(option("catchUpSpeed", 1.24), 1, 1.5);
    this.junctionApproachDistance = Math.max(this.followDistance, option("junctionApproachDistance", 82));
    this.junctionRadius = Math.max(12, option("junctionRadius", 30));
    this.junctions = (this.materializer.lanes?.junctions || []).map(item => ({
      id: String(item.id),
      x: finite(item.x),
      y: finite(item.y),
      radius: Math.max(12, finite(item.radius, this.junctionRadius)),
      approachDistance: Math.max(this.followDistance, finite(item.approachDistance, this.junctionApproachDistance))
    }));
    this.rebuildLaneCache();
  }

  rebuildLaneCache() {
    this.laneCache.clear();
    this.junctionProjectionCache.clear();
    for (const [edgeId, lanes] of Object.entries(this.materializer.lanes?.edges || {})) {
      for (const direction of ["forward", "reverse"]) {
        const points = lanes?.[direction];
        if (!Array.isArray(points) || points.length < 2) continue;
        this.laneCache.set(laneKey(edgeId, direction), {
          edgeId,
          direction,
          points,
          length: Math.max(1, polylineLength(points))
        });
      }
    }
  }

  laneFor(entity) {
    return this.laneCache.get(laneKey(entity?.edgeId, entity?.direction)) || null;
  }

  tokenMap() {
    return new Map(this.materializer.trafficTokens().map(token => [token.tokenId, token]));
  }

  stateFor(slot, token) {
    let state = this.states.get(token.tokenId);
    if (!state) {
      state = {
        tokenId: token.tokenId,
        slotIndex: slot.slotIndex,
        edgeId: token.edgeId,
        direction: token.direction,
        lastAuthorityPhase: wrapPhase(token.phase),
        authorityTravel: wrapPhase(token.phase),
        visualTravel: wrapPhase(token.phase),
        speedFactor: 1,
        desiredSpeedFactor: 1,
        reason: "cruise",
        gap: null,
        lag: 0,
        stoppedSeconds: 0,
        junctionId: null
      };
      this.states.set(token.tokenId, state);
    }
    state.slotIndex = slot.slotIndex;
    state.edgeId = token.edgeId;
    state.direction = token.direction;
    return state;
  }

  syncAuthority(state, token) {
    const phase = wrapPhase(token.phase);
    let delta = phase - state.lastAuthorityPhase;
    if (delta < -0.5) delta += 1;
    else if (delta > 0.5) delta -= 1;
    state.authorityTravel += Math.max(0, delta);
    state.lastAuthorityPhase = phase;
    state.lag = Math.max(0, state.authorityTravel - state.visualTravel);
    return state;
  }

  directLaneGap(state, lane, x, y, radius = 0) {
    const projection = nearestPointOnPolyline(lane.points, x, y);
    if (projection.distance > this.laneTolerance + Math.max(0, radius)) return null;
    const visualPhase = wrapPhase(state.visualTravel);
    const phaseDelta = projection.progress - visualPhase;
    if (phaseDelta <= 0.0005) return null;
    return {
      gap: phaseDelta * lane.length - Math.max(0, radius),
      projection
    };
  }

  nearestLead(slot, state, lane, active) {
    let best = null;
    const visualPhase = wrapPhase(state.visualTravel);
    for (const other of active) {
      if (other.slot === slot || other.state.edgeId !== state.edgeId || other.state.direction !== state.direction) continue;
      const delta = wrapPhase(other.state.visualTravel) - visualPhase;
      if (delta <= 0.0005) continue;
      const gap = delta * lane.length - slot.radius - other.slot.radius;
      if (!best || gap < best.gap) best = { gap, reason: "traffic", blockerId: other.state.tokenId, junctionId: null };
    }
    return best;
  }

  nearestPersistentBlocker(slot, state, lane) {
    let best = null;
    const currentVehicleId = this.vehicleSystem.currentVehicleId || null;
    for (const vehicle of this.vehicleSystem.vehicles || []) {
      const radius = vehicleRadius(vehicle.archetype);
      const result = this.directLaneGap(state, lane, vehicle.x, vehicle.y, radius + slot.radius);
      if (!result || result.gap > this.playerLookAhead) continue;
      const reason = vehicle.id === currentVehicleId ? "player-vehicle" : "parked-vehicle";
      if (!best || result.gap < best.gap) best = { gap: result.gap, reason, blockerId: vehicle.id, junctionId: null };
    }
    if (!this.vehicleSystem.isDriving?.() && this.scene.player) {
      const result = this.directLaneGap(state, lane, this.scene.player.x, this.scene.player.y, slot.radius + 22);
      if (result && result.gap <= this.playerLookAhead && (!best || result.gap < best.gap)) {
        best = { gap: result.gap, reason: "player-on-foot", blockerId: "player", junctionId: null };
      }
    }
    return best;
  }

  junctionProjection(junction, lane) {
    const key = `${junction.id}:${laneKey(lane.edgeId, lane.direction)}`;
    if (this.junctionProjectionCache.has(key)) return this.junctionProjectionCache.get(key);
    const projection = nearestPointOnPolyline(lane.points, junction.x, junction.y);
    const relevant = projection.distance <= junction.radius + this.laneTolerance;
    const value = relevant ? projection : null;
    this.junctionProjectionCache.set(key, value);
    return value;
  }

  junctionBlocker(slot, state, lane, active) {
    let best = null;
    const ownPhase = wrapPhase(state.visualTravel);
    for (const junction of this.junctions) {
      const ownProjection = this.junctionProjection(junction, lane);
      if (!ownProjection) continue;
      const ownDelta = ownProjection.progress - ownPhase;
      if (ownDelta <= 0.0005) continue;
      const ownApproach = ownDelta * lane.length - slot.radius;
      if (ownApproach > junction.approachDistance) continue;

      const currentVehicle = this.vehicleSystem.currentVehicle?.();
      if (currentVehicle && Math.hypot(finite(currentVehicle.x) - junction.x, finite(currentVehicle.y) - junction.y) <= junction.radius + vehicleRadius(currentVehicle.archetype)) {
        const candidate = { gap: ownApproach, reason: "junction-player", blockerId: currentVehicle.id, junctionId: junction.id };
        if (!best || candidate.gap < best.gap) best = candidate;
        continue;
      }

      for (const other of active) {
        if (other.slot === slot) continue;
        const otherLane = this.laneFor(other.state);
        if (!otherLane || laneKey(otherLane.edgeId, otherLane.direction) === laneKey(lane.edgeId, lane.direction)) continue;
        const otherProjection = this.junctionProjection(junction, otherLane);
        if (!otherProjection) continue;
        const physicalDistance = Math.hypot(other.slot.x - junction.x, other.slot.y - junction.y);
        let shouldYield = physicalDistance <= junction.radius + other.slot.radius;
        if (!shouldYield) {
          const otherPhase = wrapPhase(other.state.visualTravel);
          const otherDelta = otherProjection.progress - otherPhase;
          const otherApproach = otherDelta > 0.0005 ? otherDelta * otherLane.length - other.slot.radius : Infinity;
          if (otherApproach <= junction.approachDistance) {
            shouldYield = otherApproach + 4 < ownApproach
              || (Math.abs(otherApproach - ownApproach) <= 4 && other.state.tokenId.localeCompare(state.tokenId) < 0);
          }
        }
        if (!shouldYield) continue;
        const candidate = { gap: ownApproach, reason: "junction-yield", blockerId: other.state.tokenId, junctionId: junction.id };
        if (!best || candidate.gap < best.gap) best = candidate;
      }
    }
    return best;
  }

  decisionFor(slot, state, token, active) {
    const lane = this.laneFor(state);
    if (!lane) return { desiredSpeedFactor: 1, reason: "no-lane", gap: null, junctionId: null, lane: null };
    const blockers = [
      this.nearestLead(slot, state, lane, active),
      this.nearestPersistentBlocker(slot, state, lane),
      this.junctionBlocker(slot, state, lane, active)
    ].filter(Boolean).sort((left, right) => left.gap - right.gap || left.reason.localeCompare(right.reason));
    const blocker = blockers[0] || null;
    let desiredSpeedFactor = 1;
    if (blocker) {
      if (blocker.gap <= this.hardStopDistance) desiredSpeedFactor = 0;
      else if (blocker.gap < this.followDistance) {
        desiredSpeedFactor = clamp(
          (blocker.gap - this.hardStopDistance) / Math.max(1, this.followDistance - this.hardStopDistance),
          0,
          1
        );
      }
    } else if (state.lag > 0.008) {
      desiredSpeedFactor = Math.min(this.catchUpSpeed, 1 + state.lag * 3.2);
    }
    return {
      desiredSpeedFactor,
      reason: blocker?.reason || (desiredSpeedFactor > 1 ? "catch-up" : "cruise"),
      gap: blocker ? blocker.gap : null,
      blockerId: blocker?.blockerId || null,
      junctionId: blocker?.junctionId || null,
      lane
    };
  }

  applyDecision(slot, state, token, decision, dt) {
    const seconds = Math.max(0, finite(dt));
    const emergencyStop = decision.gap !== null && decision.gap <= 0;
    const rate = decision.desiredSpeedFactor < state.speedFactor ? this.brakingRate : this.accelerationRate;
    state.desiredSpeedFactor = decision.desiredSpeedFactor;
    state.speedFactor = emergencyStop
      ? 0
      : moveToward(state.speedFactor, decision.desiredSpeedFactor, rate * seconds);
    state.reason = decision.reason;
    state.gap = decision.gap;
    state.blockerId = decision.blockerId;
    state.junctionId = decision.junctionId;
    state.stoppedSeconds = state.speedFactor <= 0.03
      ? state.stoppedSeconds + seconds
      : 0;

    const edge = this.materializer.macro.graph?.edges?.[token.edgeId];
    const travelSeconds = Math.max(1, finite(edge?.travelSeconds, 6));
    const available = Math.max(0, state.authorityTravel - state.visualTravel);
    const advance = Math.min(available, seconds / travelSeconds * Math.max(0, state.speedFactor));
    state.visualTravel += advance;
    state.lag = Math.max(0, state.authorityTravel - state.visualTravel);

    const visualPhase = wrapPhase(state.visualTravel);
    const point = this.materializer.constructor.pointAlongPolyline
      ? this.materializer.constructor.pointAlongPolyline(decision.lane?.points || [], visualPhase)
      : null;
    const sampled = point || this.sampleLane(decision.lane, visualPhase);
    slot.authoritativePhase = wrapPhase(token.phase);
    slot.phase = visualPhase;
    slot.x = sampled.x;
    slot.y = sampled.y;
    slot.angle = sampled.angle;
    slot.speedFactor = state.speedFactor;
    slot.desiredSpeedFactor = state.desiredSpeedFactor;
    slot.behaviorReason = state.reason;
    slot.behaviorGap = state.gap;
    slot.behaviorLag = state.lag;
    slot.behaviorBlockerId = state.blockerId;
    slot.junctionId = state.junctionId;
    slot.container
      .setPosition(slot.x, slot.y)
      .setRotation(slot.angle)
      .setActive(true)
      .setVisible(this.scene.currentLayer === LAYERS.STREET);
    slot.visual?.label?.setRotation?.(-slot.angle);
    return slot;
  }

  sampleLane(lane, phase) {
    const points = lane?.points || [];
    if (!points.length) return { x: 0, y: 0, angle: 0 };
    const target = clamp(phase, 0, 1) * Math.max(1, lane.length);
    let travelled = 0;
    for (let index = 0; index < points.length - 1; index++) {
      const from = points[index];
      const to = points[index + 1];
      const dx = finite(to.x) - finite(from.x);
      const dy = finite(to.y) - finite(from.y);
      const length = Math.hypot(dx, dy);
      if (length <= 0.0001) continue;
      if (travelled + length >= target) {
        const local = (target - travelled) / length;
        return { x: finite(from.x) + dx * local, y: finite(from.y) + dy * local, angle: Math.atan2(dy, dx) };
      }
      travelled += length;
    }
    const last = points[points.length - 1];
    const previous = points[Math.max(0, points.length - 2)];
    return {
      x: finite(last.x),
      y: finite(last.y),
      angle: Math.atan2(finite(last.y) - finite(previous.y), finite(last.x) - finite(previous.x))
    };
  }

  update(dt = 0, { force = false } = {}) {
    if (this.destroyed || !this.ready || this.scene.registry?.get?.("uiPaused")) return false;
    const tokenMap = this.tokenMap();
    const active = [];
    const activeIds = new Set();
    for (const slot of this.materializer.pool || []) {
      if (!slot.tokenId) continue;
      const token = tokenMap.get(slot.tokenId);
      if (!token) continue;
      const state = this.syncAuthority(this.stateFor(slot, token), token);
      active.push({ slot, state, token });
      activeIds.add(token.tokenId);
    }
    for (const tokenId of this.states.keys()) {
      if (!activeIds.has(tokenId)) this.states.delete(tokenId);
    }

    const decisions = active.map(item => ({ ...item, decision: this.decisionFor(item.slot, item.state, item.token, active) }));
    for (const item of decisions) this.applyDecision(item.slot, item.state, item.token, item.decision, dt);
    this.publish(force);
    return active.length > 0;
  }

  pointFor(tokenId, phase = null) {
    const token = this.tokenMap().get(String(tokenId));
    if (!token) return null;
    const lane = this.laneFor(token);
    if (!lane) return null;
    return this.sampleLane(lane, phase === null ? token.phase : wrapPhase(phase));
  }

  snapshot() {
    const entries = [...this.states.values()]
      .map(state => ({
        tokenId: state.tokenId,
        slotIndex: state.slotIndex,
        edgeId: state.edgeId,
        direction: state.direction,
        phase: round(wrapPhase(state.visualTravel)),
        authoritativePhase: round(state.lastAuthorityPhase),
        lag: round(state.lag),
        speedFactor: round(state.speedFactor),
        desiredSpeedFactor: round(state.desiredSpeedFactor),
        reason: state.reason,
        gap: state.gap === null ? null : round(state.gap, 1),
        blockerId: state.blockerId || null,
        junctionId: state.junctionId || null,
        stoppedSeconds: round(state.stoppedSeconds, 2)
      }))
      .sort((left, right) => left.slotIndex - right.slotIndex);
    return {
      ready: this.ready,
      activeVehicles: entries.length,
      brakingVehicles: entries.filter(item => item.speedFactor < 0.95 && item.speedFactor > 0.03).length,
      stoppedVehicles: entries.filter(item => item.speedFactor <= 0.03).length,
      yieldingVehicles: entries.filter(item => item.reason.startsWith("junction")).length,
      followingVehicles: entries.filter(item => item.reason === "traffic").length,
      playerReactiveVehicles: entries.filter(item => item.reason === "player-vehicle" || item.reason === "player-on-foot" || item.reason === "junction-player").length,
      followDistance: round(this.followDistance),
      hardStopDistance: round(this.hardStopDistance),
      catchUpSpeed: round(this.catchUpSpeed),
      junctionCount: this.junctions.length,
      vehicles: entries,
      initializationError: this.initializationError ? String(this.initializationError.message || this.initializationError) : null
    };
  }

  publish(force = false) {
    const snapshot = this.snapshot();
    const key = JSON.stringify([
      snapshot.ready,
      snapshot.vehicles.map(item => [item.tokenId, item.reason, item.speedFactor, item.junctionId]),
      snapshot.initializationError
    ]);
    if (!force && key === this.lastPublishedKey) return snapshot;
    this.lastPublishedKey = key;
    this.scene.statePublisher?.setMany?.({
      trafficBehaviorText: `Traffic AI · ${snapshot.activeVehicles} active · ${snapshot.brakingVehicles} braking · ${snapshot.stoppedVehicles} stopped`,
      trafficBehaviorState: snapshot
    });
    if (typeof window !== "undefined") window.NBD_TRAFFIC_BEHAVIOR_READY = snapshot.ready;
    return snapshot;
  }

  installBrowserApi() {
    if (typeof window === "undefined") return;
    window.NBD_TRAFFIC_BEHAVIOR = Object.freeze({
      snapshot: () => this.snapshot(),
      step: (seconds = 0.1) => {
        let remaining = Math.max(0, finite(seconds, 0.1));
        while (remaining > 0.0001) {
          const dt = Math.min(0.05, remaining);
          this.update(dt, { force: true });
          remaining -= dt;
        }
        return this.snapshot();
      },
      point: (tokenId, phase = null) => this.pointFor(tokenId, phase)
    });
    window.NBD_TRAFFIC_BEHAVIOR_READY = false;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.states.clear();
    this.laneCache.clear();
    this.junctionProjectionCache.clear();
    this.junctions = [];
    this.ready = false;
    if (typeof window !== "undefined") {
      delete window.NBD_TRAFFIC_BEHAVIOR;
      window.NBD_TRAFFIC_BEHAVIOR_READY = false;
    }
  }
}
