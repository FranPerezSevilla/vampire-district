import { WORLD } from "../data/balance.js";
import { buildings } from "../data/district.js";
import { stepVehicleKinematics } from "../vehicles/VehicleModel.js";

function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(finite(value) * factor) / factor;
}

function moveToward(value, target, amount) {
  const current = finite(value);
  const goal = finite(target);
  const step = Math.max(0, finite(amount));
  if (Math.abs(goal - current) <= step) return goal;
  return current + Math.sign(goal - current) * step;
}

function vehicleRadius(archetype) {
  return Math.max(finite(archetype?.width, 28), finite(archetype?.height, 14)) * 0.43;
}

function pointInRect(x, y, rect, margin = 0) {
  const inset = Math.max(0, finite(margin));
  return x >= finite(rect?.x) - inset
    && x <= finite(rect?.x) + finite(rect?.w) + inset
    && y >= finite(rect?.y) - inset
    && y <= finite(rect?.y) + finite(rect?.h) + inset;
}

function neutralDrivingFrame(frame = {}) {
  return {
    ...frame,
    move: { x: 0, y: 0 },
    handbrakeHeld: false
  };
}

export function softTrafficImpulse(overlap, impactSpeed, {
  minimum = 2,
  maximum = 16,
  speedScale = 0.025
} = {}) {
  return clamp(
    Math.max(0, finite(overlap)) + Math.max(0, finite(impactSpeed)) * Math.max(0, finite(speedScale)),
    Math.max(0, finite(minimum, 2)),
    Math.max(Math.max(0, finite(minimum, 2)), finite(maximum, 16))
  );
}

export function decayTrafficOffset(offsetX, offsetY, amount) {
  const x = finite(offsetX);
  const y = finite(offsetY);
  const distance = Math.hypot(x, y);
  const step = Math.max(0, finite(amount));
  if (distance <= step || distance <= 0.0001) return { x: 0, y: 0 };
  const scale = (distance - step) / distance;
  return { x: x * scale, y: y * scale };
}

export class TrafficPhysicalConsequencesSystem {
  constructor(scene, options = {}) {
    if (!scene?.trafficMaterializationSystem || !scene?.trafficLocalBehaviorSystem || !scene?.vehicleSystem) {
      throw new TypeError("TrafficPhysicalConsequencesSystem requires materialization, traffic behavior and vehicle systems.");
    }
    this.scene = scene;
    this.materializer = scene.trafficMaterializationSystem;
    this.behavior = scene.trafficLocalBehaviorSystem;
    this.vehicleSystem = scene.vehicleSystem;
    this.options = { ...options };
    this.states = new Map();
    this.maxPushStep = 16;
    this.maxOffset = 44;
    this.offsetRecoveryRate = 24;
    this.pushHoldSeconds = 0.16;
    this.blockedHoldSeconds = 0.55;
    this.playerSpeedRetention = 0.78;
    this.collisionPadding = 2;
    this.totalContacts = 0;
    this.totalPushes = 0;
    this.totalBlocks = 0;
    this.lastContact = null;
    this.destroyed = false;
    this.ready = false;
    this.lastPublishedKey = "";
    this.originalUpdateDriving = null;
    this.physicalUpdateDriving = null;
    this.originalDecisionFor = null;
    this.physicalDecisionFor = null;
    this.installHooks();
    this.installBrowserApi();
    this.initialization = Promise.resolve(this.behavior.initialization)
      .then(() => {
        this.configure();
        this.ready = true;
        this.update(0, { force: true });
        return this;
      });
    scene.events?.once?.(globalThis.Phaser?.Scenes?.Events?.SHUTDOWN || "shutdown", this.destroy, this);
  }

  configure() {
    const config = this.materializer.lanes?.physics || {};
    const option = (key, fallback) => finite(this.options[key], finite(config[key], fallback));
    this.maxPushStep = Math.max(2, option("maxPushStep", 16));
    this.maxOffset = Math.max(this.maxPushStep, option("maxOffset", 44));
    this.offsetRecoveryRate = Math.max(1, option("offsetRecoveryRate", 24));
    this.pushHoldSeconds = clamp(option("pushHoldSeconds", 0.16), 0.04, 0.5);
    this.blockedHoldSeconds = clamp(option("blockedHoldSeconds", 0.55), this.pushHoldSeconds, 1.5);
    this.playerSpeedRetention = clamp(option("playerSpeedRetention", 0.78), 0.35, 0.95);
    this.collisionPadding = Math.max(0, option("collisionPadding", 2));
  }

  installHooks() {
    const consequences = this;
    this.originalUpdateDriving = this.vehicleSystem.updateDriving;
    this.physicalUpdateDriving = function trafficPhysicalUpdateDriving(dt, frame) {
      return consequences.updateDrivenVehicle(this, dt, frame);
    };
    this.vehicleSystem.updateDriving = this.physicalUpdateDriving;

    this.originalDecisionFor = this.behavior.decisionFor;
    this.physicalDecisionFor = function physicalTrafficDecision(slot, state, token, active) {
      const base = consequences.originalDecisionFor.call(this, slot, state, token, active);
      const constraint = consequences.behaviorConstraintFor(slot);
      if (!constraint) return base;
      return {
        ...base,
        desiredSpeedFactor: 0,
        reason: constraint.reason,
        gap: 0,
        blockerId: constraint.blockerId,
        junctionId: null
      };
    };
    this.behavior.decisionFor = this.physicalDecisionFor;
  }

  stateFor(slot) {
    if (!slot?.tokenId) return null;
    let state = this.states.get(slot.tokenId);
    if (!state) {
      state = {
        tokenId: slot.tokenId,
        slotIndex: slot.slotIndex,
        offsetX: 0,
        offsetY: 0,
        holdSeconds: 0,
        baseX: finite(slot.x),
        baseY: finite(slot.y),
        lastImpactSpeed: 0,
        lastVehicleId: null,
        lastReason: "none",
        pushes: 0,
        blocks: 0
      };
      this.states.set(slot.tokenId, state);
    }
    state.slotIndex = slot.slotIndex;
    return state;
  }

  behaviorConstraintFor(slot) {
    const state = slot?.tokenId ? this.states.get(slot.tokenId) : null;
    if (!state || state.holdSeconds <= 0) return null;
    return {
      reason: state.lastReason === "blocked" ? "physical-blocked" : "physical-contact",
      blockerId: state.lastVehicleId || "traffic-contact"
    };
  }

  activeSlots() {
    return (this.materializer.pool || []).filter(slot => slot.tokenId && slot.container?.active !== false);
  }

  trafficContacts(candidate, vehicle) {
    const ownRadius = vehicleRadius(vehicle?.archetype);
    return this.activeSlots()
      .map(slot => {
        const dx = finite(slot.x) - finite(candidate?.x);
        const dy = finite(slot.y) - finite(candidate?.y);
        const distance = Math.hypot(dx, dy);
        const required = ownRadius + finite(slot.radius) + this.collisionPadding;
        return {
          slot,
          distance,
          overlap: required - distance,
          dx,
          dy,
          required
        };
      })
      .filter(contact => contact.overlap > 0)
      .sort((left, right) => right.overlap - left.overlap || left.slot.slotIndex - right.slot.slotIndex);
  }

  nearbyBuildings(x, y, radius) {
    const bounds = {
      x: finite(x) - radius,
      y: finite(y) - radius,
      w: Math.max(1, radius * 2),
      h: Math.max(1, radius * 2)
    };
    return this.scene.cityStreamSystem?.query?.("buildings", bounds) || buildings;
  }

  proxyWorldSafe(slot, x, y, { movingVehicle = null } = {}) {
    const radius = Math.max(1, finite(slot?.radius, 14));
    if (x - radius < 5 || y - radius < 5 || x + radius > WORLD.width - 5 || y + radius > WORLD.height - 5) {
      return false;
    }
    for (const building of this.nearbyBuildings(x, y, radius + 2)) {
      if (pointInRect(x, y, building, radius * 0.72)) return false;
    }

    for (const vehicle of this.vehicleSystem.vehicles || []) {
      const otherX = movingVehicle?.id === vehicle.id ? movingVehicle.x : finite(vehicle.x);
      const otherY = movingVehicle?.id === vehicle.id ? movingVehicle.y : finite(vehicle.y);
      const otherRadius = movingVehicle?.id === vehicle.id
        ? finite(movingVehicle.radius, vehicleRadius(vehicle.archetype))
        : vehicleRadius(vehicle.archetype);
      if (Math.hypot(otherX - x, otherY - y) < radius + otherRadius + 1) return false;
    }

    for (const other of this.activeSlots()) {
      if (other === slot) continue;
      if (Math.hypot(finite(other.x) - x, finite(other.y) - y) < radius + finite(other.radius) + 1) return false;
    }
    return true;
  }

  applyStateOffset(slot, state) {
    const x = finite(state.baseX) + finite(state.offsetX);
    const y = finite(state.baseY) + finite(state.offsetY);
    slot.x = x;
    slot.y = y;
    slot.physicalOffsetX = state.offsetX;
    slot.physicalOffsetY = state.offsetY;
    slot.physicalHoldSeconds = state.holdSeconds;
    slot.physicalReason = state.lastReason;
    slot.container?.setPosition?.(x, y);
    return slot;
  }

  pushContact(vehicle, candidate, contact) {
    const slot = contact.slot;
    const state = this.stateFor(slot);
    const impactSpeed = Math.abs(finite(candidate?.speed, vehicle?.speed));
    let dx = contact.dx;
    let dy = contact.dy;
    let length = Math.hypot(dx, dy);
    if (length <= 0.001) {
      const angle = finite(candidate?.travelAngle, candidate?.angle);
      dx = Math.cos(angle);
      dy = Math.sin(angle);
      length = 1;
    }
    const directionX = dx / length;
    const directionY = dy / length;
    const impulse = softTrafficImpulse(contact.overlap, impactSpeed, { maximum: this.maxPushStep });
    const nextOffsetX = finite(state.offsetX) + directionX * impulse;
    const nextOffsetY = finite(state.offsetY) + directionY * impulse;
    if (Math.hypot(nextOffsetX, nextOffsetY) > this.maxOffset) return false;

    const nextX = finite(state.baseX) + nextOffsetX;
    const nextY = finite(state.baseY) + nextOffsetY;
    const movingVehicle = {
      id: vehicle.id,
      x: finite(candidate.x),
      y: finite(candidate.y),
      radius: vehicleRadius(vehicle.archetype)
    };
    if (!this.proxyWorldSafe(slot, nextX, nextY, { movingVehicle })) return false;

    state.offsetX = nextOffsetX;
    state.offsetY = nextOffsetY;
    state.holdSeconds = Math.max(state.holdSeconds, this.pushHoldSeconds);
    state.lastImpactSpeed = impactSpeed;
    state.lastVehicleId = vehicle.id;
    state.lastReason = "pushed";
    state.pushes++;
    this.totalPushes++;
    this.applyStateOffset(slot, state);
    return true;
  }

  markBlocked(vehicle, contact, impactSpeed) {
    const state = this.stateFor(contact.slot);
    state.holdSeconds = Math.max(state.holdSeconds, this.blockedHoldSeconds);
    state.lastImpactSpeed = Math.abs(finite(impactSpeed));
    state.lastVehicleId = vehicle.id;
    state.lastReason = "blocked";
    state.blocks++;
    this.totalBlocks++;
    this.applyStateOffset(contact.slot, state);
  }

  worldAllowsCandidate(vehicleSystem, vehicle, candidate) {
    const original = this.materializer.originalVehicleCanOccupy;
    return typeof original === "function"
      ? original.call(vehicleSystem, vehicle, candidate.x, candidate.y, candidate.angle)
      : true;
  }

  dampDrivenVehicle(vehicle, retention = this.playerSpeedRetention) {
    const factor = clamp(retention, 0, 1);
    vehicle.speed = finite(vehicle.speed) * factor;
    vehicle.velocityX = Math.cos(finite(vehicle.travelAngle, vehicle.angle)) * vehicle.speed;
    vehicle.velocityY = Math.sin(finite(vehicle.travelAngle, vehicle.angle)) * vehicle.speed;
    vehicle.driftAngle = finite(vehicle.driftAngle) * factor;
    return vehicle;
  }

  stopDrivenVehicle(vehicle) {
    vehicle.speed = 0;
    vehicle.velocityX = 0;
    vehicle.velocityY = 0;
    vehicle.driftAngle = 0;
    vehicle.handbrake = false;
    return vehicle;
  }

  updateDrivenVehicle(vehicleSystem, dt, frame) {
    const vehicle = vehicleSystem.currentVehicle?.();
    if (!vehicle || this.destroyed || !this.ready) {
      return this.originalUpdateDriving.call(vehicleSystem, dt, frame);
    }

    const predicted = stepVehicleKinematics(vehicle, frame, dt, vehicle.archetype);
    const contacts = this.trafficContacts(predicted, vehicle);
    if (!contacts.length || !this.worldAllowsCandidate(vehicleSystem, vehicle, predicted)) {
      return this.originalUpdateDriving.call(vehicleSystem, dt, frame);
    }

    this.totalContacts++;
    const contact = contacts[0];
    const impactSpeed = Math.abs(finite(predicted.speed, vehicle.speed));
    const pushed = this.pushContact(vehicle, predicted, contact);
    const stillBlocked = this.materializer.blocksVehicle(
      predicted.x,
      predicted.y,
      vehicleRadius(vehicle.archetype)
    );

    this.lastContact = {
      tokenId: contact.slot.tokenId,
      vehicleId: vehicle.id,
      impactSpeed,
      pushed: Boolean(pushed && !stillBlocked),
      blocked: Boolean(!pushed || stillBlocked)
    };

    if (!pushed || stillBlocked) {
      this.markBlocked(vehicle, contact, impactSpeed);
      this.stopDrivenVehicle(vehicle);
      this.scene.lastActionText = "Traffic contact · both vehicles are blocked.";
      const result = this.originalUpdateDriving.call(vehicleSystem, 0, neutralDrivingFrame(frame));
      this.publish(true);
      return result;
    }

    const result = this.originalUpdateDriving.call(vehicleSystem, dt, frame);
    this.dampDrivenVehicle(vehicle);
    this.scene.lastActionText = "Traffic contact · the ambient car is pushed aside.";
    this.publish(true);
    return result;
  }

  update(dt = 0, { force = false } = {}) {
    if (this.destroyed || !this.ready || this.scene.registry?.get?.("uiPaused")) return false;
    const seconds = Math.max(0, finite(dt));
    const activeIds = new Set();
    let changed = false;

    for (const slot of this.activeSlots()) {
      const state = this.stateFor(slot);
      activeIds.add(slot.tokenId);
      state.baseX = finite(slot.x);
      state.baseY = finite(slot.y);
      state.holdSeconds = Math.max(0, state.holdSeconds - seconds);

      if (state.holdSeconds <= 0 && Math.hypot(state.offsetX, state.offsetY) > 0.001) {
        const decayed = decayTrafficOffset(state.offsetX, state.offsetY, this.offsetRecoveryRate * seconds);
        const candidateX = state.baseX + decayed.x;
        const candidateY = state.baseY + decayed.y;
        if (this.proxyWorldSafe(slot, candidateX, candidateY)) {
          changed = changed || decayed.x !== state.offsetX || decayed.y !== state.offsetY;
          state.offsetX = decayed.x;
          state.offsetY = decayed.y;
          if (Math.hypot(state.offsetX, state.offsetY) <= 0.001) state.lastReason = "recovered";
        }
      }
      this.applyStateOffset(slot, state);
    }

    for (const tokenId of this.states.keys()) {
      if (!activeIds.has(tokenId)) this.states.delete(tokenId);
    }
    this.publish(force || changed);
    return activeIds.size > 0;
  }

  snapshot() {
    const contacts = [...this.states.values()]
      .map(state => ({
        tokenId: state.tokenId,
        slotIndex: state.slotIndex,
        offsetX: round(state.offsetX),
        offsetY: round(state.offsetY),
        offsetDistance: round(Math.hypot(state.offsetX, state.offsetY)),
        holdSeconds: round(state.holdSeconds, 3),
        lastImpactSpeed: round(state.lastImpactSpeed),
        lastVehicleId: state.lastVehicleId,
        reason: state.lastReason,
        pushes: state.pushes,
        blocks: state.blocks
      }))
      .sort((left, right) => left.slotIndex - right.slotIndex);
    return {
      ready: this.ready,
      activeContacts: contacts.filter(item => item.holdSeconds > 0 || item.offsetDistance > 0).length,
      pushedVehicles: contacts.filter(item => item.offsetDistance > 0).length,
      blockedVehicles: contacts.filter(item => item.reason === "blocked" && item.holdSeconds > 0).length,
      totalContacts: this.totalContacts,
      totalPushes: this.totalPushes,
      totalBlocks: this.totalBlocks,
      maxPushStep: round(this.maxPushStep),
      maxOffset: round(this.maxOffset),
      offsetRecoveryRate: round(this.offsetRecoveryRate),
      lastContact: this.lastContact ? { ...this.lastContact, impactSpeed: round(this.lastContact.impactSpeed) } : null,
      contacts
    };
  }

  publish(force = false) {
    const snapshot = this.snapshot();
    const key = JSON.stringify([
      snapshot.ready,
      snapshot.activeContacts,
      snapshot.totalContacts,
      snapshot.totalPushes,
      snapshot.totalBlocks,
      snapshot.lastContact
    ]);
    if (!force && key === this.lastPublishedKey) return snapshot;
    this.lastPublishedKey = key;
    this.scene.statePublisher?.setMany?.({
      trafficPhysicsText: `Traffic contact · ${snapshot.pushedVehicles} pushed · ${snapshot.blockedVehicles} blocked`,
      trafficPhysicsState: snapshot
    });
    if (typeof window !== "undefined") window.NBD_TRAFFIC_PHYSICS_READY = snapshot.ready;
    return snapshot;
  }

  installBrowserApi() {
    if (typeof window === "undefined") return;
    window.NBD_TRAFFIC_PHYSICS = Object.freeze({
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
    window.NBD_TRAFFIC_PHYSICS_READY = false;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.vehicleSystem.updateDriving === this.physicalUpdateDriving) {
      this.vehicleSystem.updateDriving = this.originalUpdateDriving;
    }
    if (this.behavior.decisionFor === this.physicalDecisionFor) {
      this.behavior.decisionFor = this.originalDecisionFor;
    }
    this.states.clear();
    this.ready = false;
    if (typeof window !== "undefined") {
      delete window.NBD_TRAFFIC_PHYSICS;
      window.NBD_TRAFFIC_PHYSICS_READY = false;
    }
  }
}
