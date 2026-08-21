import { LAYERS } from "../data/district.js";

const DEFAULTS = Object.freeze({
  avoidanceMinGap: 24,
  avoidanceMaxGap: 112,
  lateralDistance: 28,
  lateralRate: 48,
  steeringRate: 2.4,
  maxSteerAngle: 0.34,
  passSpeedFactor: 0.62,
  clearanceForward: 48,
  clearancePadding: 4,
  cooldownSeconds: 0.8,
  playerAvoidanceMaxSpeed: 24
});

function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function moveToward(current, target, amount) {
  const from = finite(current);
  const to = finite(target);
  const step = Math.max(0, finite(amount));
  if (Math.abs(to - from) <= step) return to;
  return from + Math.sign(to - from) * step;
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value || "traffic")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function vehicleRadius(archetype) {
  return Math.max(finite(archetype?.width, 28), finite(archetype?.height, 14)) * 0.43;
}

export function trafficAvoidanceSide(tokenId) {
  return stableHash(tokenId) % 2 === 0 ? -1 : 1;
}

export function parkedAvoidanceDecision(baseDecision, {
  offset = 0,
  targetOffset = DEFAULTS.lateralDistance,
  passSpeedFactor = DEFAULTS.passSpeedFactor,
  avoidanceMinGap = DEFAULTS.avoidanceMinGap
} = {}) {
  const base = baseDecision || {};
  if (!["parked-vehicle", "player-vehicle"].includes(base.reason)
    || base.gap === null || base.gap === undefined) return base;
  const target = Math.max(1, Math.abs(finite(targetOffset, DEFAULTS.lateralDistance)));
  const readiness = clamp(Math.abs(finite(offset)) / target, 0, 1);
  const gap = finite(base.gap, Infinity);
  const desiredPassSpeed = clamp(finite(passSpeedFactor, DEFAULTS.passSpeedFactor), 0.1, 1)
    * (0.35 + readiness * 0.65);
  const desiredSpeedFactor = gap <= Math.max(0, finite(avoidanceMinGap, DEFAULTS.avoidanceMinGap)) && readiness < 0.68
    ? 0
    : Math.max(finite(base.desiredSpeedFactor), desiredPassSpeed);
  return {
    ...base,
    desiredSpeedFactor,
    reason: base.reason === "player-vehicle"
      ? "steering-around-stopped-player"
      : "steering-around-parked"
  };
}

export function stepTrafficSteeringPose(pose, {
  targetOffset = 0,
  dt = 0,
  lateralRate = DEFAULTS.lateralRate,
  steeringRate = DEFAULTS.steeringRate,
  maxSteerAngle = DEFAULTS.maxSteerAngle
} = {}) {
  const state = pose || { offset: 0, steerAngle: 0 };
  const seconds = Math.max(0, finite(dt));
  const nextOffset = moveToward(
    state.offset,
    finite(targetOffset),
    Math.max(1, finite(lateralRate, DEFAULTS.lateralRate)) * seconds
  );
  const remaining = finite(targetOffset) - nextOffset;
  const direction = Math.sign(remaining);
  const scale = clamp(Math.abs(remaining) / Math.max(8, Math.abs(finite(targetOffset)) || 8), 0, 1);
  const targetSteer = direction * Math.max(0.05, finite(maxSteerAngle, DEFAULTS.maxSteerAngle)) * scale;
  const nextSteer = moveToward(
    state.steerAngle,
    targetSteer,
    Math.max(0.1, finite(steeringRate, DEFAULTS.steeringRate)) * seconds
  );
  return {
    offset: Math.abs(nextOffset) < 0.001 ? 0 : nextOffset,
    steerAngle: Math.abs(nextSteer) < 0.001 ? 0 : nextSteer
  };
}

export class TrafficSteeringPresentationSystem {
  constructor(scene, options = {}) {
    if (!scene?.trafficMaterializationSystem || !scene?.trafficLocalBehaviorSystem || !scene?.vehicleSystem) {
      throw new TypeError("TrafficSteeringPresentationSystem requires materialization, local behavior and vehicle systems.");
    }
    this.scene = scene;
    this.materializer = scene.trafficMaterializationSystem;
    this.behavior = scene.trafficLocalBehaviorSystem;
    this.vehicleSystem = scene.vehicleSystem;
    this.options = { ...options };
    this.states = new Map();
    this.avoidanceMinGap = Math.max(8, finite(options.avoidanceMinGap, DEFAULTS.avoidanceMinGap));
    this.avoidanceMaxGap = Math.max(this.avoidanceMinGap + 8, finite(options.avoidanceMaxGap, DEFAULTS.avoidanceMaxGap));
    this.lateralDistance = Math.max(12, finite(options.lateralDistance, DEFAULTS.lateralDistance));
    this.lateralRate = Math.max(8, finite(options.lateralRate, DEFAULTS.lateralRate));
    this.steeringRate = Math.max(0.4, finite(options.steeringRate, DEFAULTS.steeringRate));
    this.maxSteerAngle = clamp(options.maxSteerAngle ?? DEFAULTS.maxSteerAngle, 0.12, 0.55);
    this.passSpeedFactor = clamp(options.passSpeedFactor ?? DEFAULTS.passSpeedFactor, 0.25, 0.85);
    this.clearanceForward = Math.max(24, finite(options.clearanceForward, DEFAULTS.clearanceForward));
    this.clearancePadding = Math.max(0, finite(options.clearancePadding, DEFAULTS.clearancePadding));
    this.cooldownSeconds = Math.max(0.2, finite(options.cooldownSeconds, DEFAULTS.cooldownSeconds));
    this.playerAvoidanceMaxSpeed = Math.max(0, finite(options.playerAvoidanceMaxSpeed, DEFAULTS.playerAvoidanceMaxSpeed));
    this.totalAvoidances = 0;
    this.ready = false;
    this.destroyed = false;
    this.lastPublishedKey = "";
    this.originalDecisionFor = null;
    this.steeringDecisionFor = null;
    this.installDecisionHook();
    this.installBrowserApi();
    this.initialization = Promise.resolve(this.behavior.initialization)
      .then(() => {
        this.ready = true;
        this.update(0, { force: true });
        return this;
      });
    scene.events?.once?.(globalThis.Phaser?.Scenes?.Events?.SHUTDOWN || "shutdown", this.destroy, this);
  }

  installDecisionHook() {
    const steering = this;
    this.originalDecisionFor = this.behavior.decisionFor;
    this.steeringDecisionFor = function trafficSteeringDecision(slot, state, token, active) {
      const base = steering.originalDecisionFor.call(this, slot, state, token, active);
      return steering.decorateDecision(slot, base);
    };
    this.behavior.decisionFor = this.steeringDecisionFor;
  }

  stateFor(slot) {
    if (!slot?.tokenId) return null;
    let state = this.states.get(slot.tokenId);
    if (!state) {
      state = {
        tokenId: slot.tokenId,
        slotIndex: slot.slotIndex,
        side: trafficAvoidanceSide(slot.tokenId),
        blockerId: null,
        active: false,
        offset: 0,
        steerAngle: 0,
        cooldown: 0,
        passes: 0
      };
      this.states.set(slot.tokenId, state);
    }
    state.slotIndex = slot.slotIndex;
    return state;
  }

  activeSlots() {
    return (this.materializer.pool || []).filter(slot => slot.tokenId && slot.container?.active !== false);
  }

  candidateSafe(slot, side) {
    const angle = finite(slot?.angle);
    const normalX = -Math.sin(angle);
    const normalY = Math.cos(angle);
    const forwardX = Math.cos(angle);
    const forwardY = Math.sin(angle);
    const lateral = this.lateralDistance * side;
    const radius = Math.max(1, finite(slot?.radius, vehicleRadius(slot?.archetype)));
    const samples = [0.5, 1].map(scale => ({
      x: finite(slot.x) + forwardX * this.clearanceForward * scale + normalX * lateral * scale,
      y: finite(slot.y) + forwardY * this.clearanceForward * scale + normalY * lateral * scale
    }));

    const worldAllows = this.materializer.originalVehicleCanOccupy;
    const proxy = {
      id: `traffic:${slot.tokenId}`,
      x: finite(slot.x),
      y: finite(slot.y),
      angle,
      archetype: slot.archetype,
      radius
    };
    for (const sample of samples) {
      if (typeof worldAllows === "function"
        && !worldAllows.call(this.vehicleSystem, proxy, sample.x, sample.y, angle)) return false;
      for (const prop of this.scene.streetFurnitureSystem?.dumpsters || []) {
        if (prop?.broken) continue;
        if (Math.hypot(finite(prop?.x) - sample.x, finite(prop?.y) - sample.y)
          < radius + Math.max(4, finite(prop?.hitRadius, 14)) + this.clearancePadding) return false;
      }
      for (const other of this.activeSlots()) {
        if (other === slot) continue;
        if (Math.hypot(finite(other.x) - sample.x, finite(other.y) - sample.y)
          < radius + finite(other.radius, 14) + this.clearancePadding) return false;
      }
    }
    return true;
  }

  chooseSide(slot, state) {
    const preferred = state?.side || trafficAvoidanceSide(slot?.tokenId);
    if (this.candidateSafe(slot, preferred)) return preferred;
    if (this.candidateSafe(slot, -preferred)) return -preferred;
    return 0;
  }

  avoidableBlocker(base) {
    if (base?.reason === "parked-vehicle") return true;
    if (base?.reason !== "player-vehicle") return false;
    const playerVehicle = this.vehicleSystem.currentVehicle?.();
    return Boolean(playerVehicle
      && playerVehicle.id === base.blockerId
      && Math.abs(finite(playerVehicle.speed)) <= this.playerAvoidanceMaxSpeed);
  }

  decorateDecision(slot, base) {
    const state = this.stateFor(slot);
    if (!state) return base;
    const gap = base?.gap === null || base?.gap === undefined ? Infinity : finite(base.gap, Infinity);
    const avoidableAhead = this.avoidableBlocker(base)
      && gap >= this.avoidanceMinGap
      && gap <= this.avoidanceMaxGap;

    if (avoidableAhead && state.cooldown <= 0) {
      if (!state.active || state.blockerId !== base.blockerId) {
        const side = this.chooseSide(slot, state);
        if (side) {
          state.side = side;
          state.blockerId = base.blockerId || null;
          state.active = true;
          state.passes++;
          this.totalAvoidances++;
        }
      }
      if (state.active) {
        return parkedAvoidanceDecision(base, {
          offset: state.offset,
          targetOffset: this.lateralDistance,
          passSpeedFactor: this.passSpeedFactor,
          avoidanceMinGap: this.avoidanceMinGap
        });
      }
    } else if (state.active && !this.avoidableBlocker(base)) {
      state.active = false;
      state.blockerId = null;
      state.cooldown = this.cooldownSeconds;
    }
    return base;
  }

  applyPresentation(slot, state, dt) {
    const targetOffset = state.active ? state.side * this.lateralDistance : 0;
    const pose = stepTrafficSteeringPose(state, {
      targetOffset,
      dt,
      lateralRate: this.lateralRate,
      steeringRate: this.steeringRate,
      maxSteerAngle: this.maxSteerAngle
    });
    state.offset = pose.offset;
    state.steerAngle = pose.steerAngle;
    const angle = finite(slot.angle);
    const normalX = -Math.sin(angle);
    const normalY = Math.cos(angle);
    slot.x = finite(slot.x) + normalX * state.offset;
    slot.y = finite(slot.y) + normalY * state.offset;
    slot.steeringOffset = state.offset;
    slot.steeringAngle = state.steerAngle;
    slot.steeringReason = state.active ? "obstacle-avoidance" : (state.offset ? "lane-recovery" : "lane");
    slot.container
      ?.setPosition?.(slot.x, slot.y)
      ?.setRotation?.(angle + state.steerAngle);
    slot.visual?.label?.setRotation?.(-(angle + state.steerAngle));
    return slot;
  }

  update(dt = 0, { force = false } = {}) {
    if (this.destroyed || !this.ready || this.scene.registry?.get?.("uiPaused")) return false;
    const seconds = Math.max(0, finite(dt));
    const activeIds = new Set();
    let changed = false;
    for (const slot of this.activeSlots()) {
      const state = this.stateFor(slot);
      activeIds.add(slot.tokenId);
      state.cooldown = Math.max(0, state.cooldown - seconds);
      const beforeOffset = state.offset;
      const beforeSteer = state.steerAngle;
      this.applyPresentation(slot, state, seconds);
      changed = changed || beforeOffset !== state.offset || beforeSteer !== state.steerAngle;
    }
    for (const tokenId of this.states.keys()) {
      if (!activeIds.has(tokenId)) this.states.delete(tokenId);
    }
    this.publish(force || changed);
    return activeIds.size > 0;
  }

  snapshot() {
    const vehicles = [...this.states.values()]
      .map(state => ({
        tokenId: state.tokenId,
        slotIndex: state.slotIndex,
        active: state.active,
        side: state.side,
        blockerId: state.blockerId,
        offset: Math.round(state.offset * 10) / 10,
        steerAngle: Math.round(state.steerAngle * 1000) / 1000,
        cooldown: Math.round(state.cooldown * 100) / 100,
        passes: state.passes
      }))
      .sort((left, right) => left.slotIndex - right.slotIndex);
    return {
      ready: this.ready,
      activeAvoidances: vehicles.filter(item => item.active).length,
      recoveringVehicles: vehicles.filter(item => !item.active && Math.abs(item.offset) > 0.1).length,
      totalAvoidances: this.totalAvoidances,
      lateralDistance: this.lateralDistance,
      maxSteerAngle: this.maxSteerAngle,
      vehicles
    };
  }

  publish(force = false) {
    const snapshot = this.snapshot();
    const key = JSON.stringify([
      snapshot.ready,
      snapshot.activeAvoidances,
      snapshot.recoveringVehicles,
      snapshot.totalAvoidances,
      snapshot.vehicles.map(item => [item.tokenId, item.active, item.offset, item.steerAngle])
    ]);
    if (!force && key === this.lastPublishedKey) return snapshot;
    this.lastPublishedKey = key;
    this.scene.statePublisher?.setMany?.({
      trafficSteeringText: `Traffic steering · ${snapshot.activeAvoidances} avoiding · ${snapshot.recoveringVehicles} recovering`,
      trafficSteeringState: snapshot
    });
    if (typeof window !== "undefined") window.NBD_TRAFFIC_STEERING_READY = snapshot.ready;
    return snapshot;
  }

  installBrowserApi() {
    if (typeof window === "undefined") return;
    window.NBD_TRAFFIC_STEERING = Object.freeze({
      snapshot: () => this.snapshot(),
      step: (seconds = 0.1) => {
        let remaining = Math.max(0, finite(seconds, 0.1));
        while (remaining > 0.0001) {
          const dt = Math.min(0.05, remaining);
          this.update(dt, { force: true });
          remaining -= dt;
        }
        return this.snapshot();
      }
    });
    window.NBD_TRAFFIC_STEERING_READY = false;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.behavior.decisionFor === this.steeringDecisionFor) {
      this.behavior.decisionFor = this.originalDecisionFor;
    }
    this.states.clear();
    this.ready = false;
    if (typeof window !== "undefined") {
      delete window.NBD_TRAFFIC_STEERING;
      window.NBD_TRAFFIC_STEERING_READY = false;
    }
  }
}
