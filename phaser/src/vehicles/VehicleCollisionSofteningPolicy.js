import {
  normalizeAngle,
  rotateTowardAngle,
  stepVehicleKinematics
} from "../vehicles/VehicleModel.js";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function vehicleRadius(archetype) {
  return Math.max(finite(archetype?.width, 28), finite(archetype?.height, 14)) * 0.43;
}

function distanceSquared(left, right) {
  const dx = finite(left?.x) - finite(right?.x);
  const dy = finite(left?.y) - finite(right?.y);
  return dx * dx + dy * dy;
}

function trafficTargets(scene) {
  return (scene.trafficMaterializationSystem?.pool || [])
    .filter(slot => slot.tokenId && slot.container?.active !== false)
    .map(slot => ({
      kind: "traffic",
      id: slot.tokenId,
      x: slot.x,
      y: slot.y,
      radius: slot.radius,
      slot
    }));
}

function authoredTargets(system, vehicle) {
  return (system.vehicles || [])
    .filter(candidate => candidate !== vehicle && !candidate.disabled)
    .map(candidate => ({
      kind: "vehicle",
      id: candidate.id,
      x: candidate.x,
      y: candidate.y,
      radius: vehicleRadius(candidate.archetype),
      vehicle: candidate
    }));
}

function collisionTarget(system, vehicle, predicted, padding) {
  const ownRadius = vehicleRadius(vehicle.archetype);
  return [...trafficTargets(system.scene), ...authoredTargets(system, vehicle)]
    .map(target => {
      const required = ownRadius + target.radius + padding;
      const distance = Math.sqrt(distanceSquared(predicted, target));
      return { ...target, required, distance, overlap: required - distance };
    })
    .filter(target => target.overlap > 0)
    .sort((left, right) => right.overlap - left.overlap || String(left.id).localeCompare(String(right.id)))[0] || null;
}

function targetStillOverlaps(candidate, target, ownRadius, clearance = 0.5) {
  return Math.hypot(candidate.x - target.x, candidate.y - target.y)
    < ownRadius + target.radius + clearance;
}

function applyVehicleState(system, vehicle, state) {
  vehicle.x = state.x;
  vehicle.y = state.y;
  vehicle.angle = state.angle;
  vehicle.travelAngle = state.travelAngle;
  vehicle.driftAngle = state.driftAngle;
  vehicle.velocityX = state.velocityX;
  vehicle.velocityY = state.velocityY;
  vehicle.speed = state.speed;
  vehicle.parked = false;
  vehicle.handbrake = false;
  vehicle.container?.setPosition?.(vehicle.x, vehicle.y).setRotation?.(vehicle.angle);
  vehicle.visual?.label?.setRotation?.(-vehicle.angle);
  system.scene.player?.setPosition?.(vehicle.x, vehicle.y);
  system.updateHud?.();
  system.publish?.();
}

export class VehicleCollisionSofteningPolicy {
  constructor(scene, options = {}) {
    if (!scene?.vehicleSystem || !scene?.trafficPhysicalConsequencesSystem) {
      throw new TypeError("VehicleCollisionSofteningPolicy requires vehicle and traffic physical systems.");
    }
    this.scene = scene;
    this.vehicleSystem = scene.vehicleSystem;
    this.physical = scene.trafficPhysicalConsequencesSystem;
    this.options = { ...options };
    this.collisionPadding = Math.max(0, finite(options.collisionPadding, 2.5));
    this.minimumRetention = clamp(options.minimumRetention ?? 0.48, 0.2, 0.85);
    this.maximumRetention = clamp(options.maximumRetention ?? 0.82, this.minimumRetention, 0.95);
    this.minimumYaw = clamp(options.minimumYaw ?? 0.025, 0, 0.2);
    this.maximumYaw = clamp(options.maximumYaw ?? 0.14, this.minimumYaw, 0.35);
    this.totalContacts = 0;
    this.totalSoftened = 0;
    this.totalPassThroughs = 0;
    this.lastContact = null;
    this.destroyed = false;
    this.originalUpdateDriving = this.vehicleSystem.updateDriving;
    this.softUpdateDriving = null;
    this.tuneTrafficPushes();
    this.installHook();
    this.installBrowserApi();
    scene.events?.once?.(globalThis.Phaser?.Scenes?.Events?.SHUTDOWN || "shutdown", this.destroy, this);
  }

  tuneTrafficPushes() {
    this.physical.maxPushStep = Math.max(this.physical.maxPushStep, 24);
    this.physical.maxOffset = Math.max(this.physical.maxOffset, 68);
    this.physical.offsetRecoveryRate = Math.min(this.physical.offsetRecoveryRate, 18);
    this.physical.pushHoldSeconds = Math.min(this.physical.pushHoldSeconds, 0.11);
    this.physical.blockedHoldSeconds = Math.min(this.physical.blockedHoldSeconds, 0.24);
    this.physical.playerSpeedRetention = Math.max(this.physical.playerSpeedRetention, 0.86);
    this.physical.collisionPadding = Math.min(this.physical.collisionPadding, 1);
  }

  installHook() {
    const policy = this;
    this.softUpdateDriving = function softCollisionDriving(dt, frame) {
      return policy.updateDriving(this, dt, frame);
    };
    this.vehicleSystem.updateDriving = this.softUpdateDriving;
  }

  preferredSide(vehicle, predicted, target, frame) {
    const nx = predicted.x - target.x;
    const ny = predicted.y - target.y;
    const length = Math.hypot(nx, ny) || 1;
    const normalX = nx / length;
    const normalY = ny / length;
    const tangentX = -normalY;
    const tangentY = normalX;
    const movementX = predicted.x - vehicle.x;
    const movementY = predicted.y - vehicle.y;
    const tangentIntent = movementX * tangentX + movementY * tangentY;
    const steering = finite(frame?.move?.x);
    const fallback = String(target.id).length % 2 === 0 ? 1 : -1;
    const side = Math.sign(Math.abs(steering) > 0.05 ? steering : tangentIntent) || fallback;
    return { normalX, normalY, tangentX, tangentY, side };
  }

  candidateStates(system, vehicle, predicted, target, frame) {
    const direction = this.preferredSide(vehicle, predicted, target, frame);
    const safeRadius = target.required + 1.25;
    const baseX = target.x + direction.normalX * safeRadius;
    const baseY = target.y + direction.normalY * safeRadius;
    const impactSpeed = Math.abs(finite(predicted.speed, vehicle.speed));
    const retention = clamp(
      this.maximumRetention - impactSpeed / 900,
      this.minimumRetention,
      this.maximumRetention
    );
    const speed = finite(predicted.speed, vehicle.speed) * retention;
    const yaw = direction.side * clamp(
      impactSpeed / 900,
      this.minimumYaw,
      this.maximumYaw
    );
    const angle = normalizeAngle(finite(predicted.angle, vehicle.angle) + yaw);
    const travelAngle = rotateTowardAngle(
      finite(predicted.travelAngle, predicted.angle),
      angle,
      0.18
    );
    const shifts = [0, 2.5, 5, 8.5, 13, 18];
    const sides = [direction.side, -direction.side];
    const candidates = [];
    for (const side of sides) {
      for (const shift of shifts) {
        const x = baseX + direction.tangentX * shift * side;
        const y = baseY + direction.tangentY * shift * side;
        candidates.push({
          x,
          y,
          angle: normalizeAngle(angle + (side - direction.side) * this.minimumYaw),
          travelAngle,
          driftAngle: finite(predicted.driftAngle) * 0.58,
          speed,
          velocityX: Math.cos(travelAngle) * speed,
          velocityY: Math.sin(travelAngle) * speed
        });
      }
    }
    return candidates.filter(candidate => {
      if (targetStillOverlaps(candidate, target, vehicleRadius(vehicle.archetype))) return false;
      return system.canOccupy(vehicle, candidate.x, candidate.y, candidate.angle);
    });
  }

  shouldSoften(before, predicted, vehicle) {
    const intendedTravel = Math.hypot(predicted.x - before.x, predicted.y - before.y);
    const actualTravel = Math.hypot(vehicle.x - before.x, vehicle.y - before.y);
    const predictedSpeed = Math.abs(finite(predicted.speed));
    const actualSpeed = Math.abs(finite(vehicle.speed));
    return intendedTravel > 0.15 && (
      actualTravel < intendedTravel * 0.42
      || actualSpeed < predictedSpeed * 0.34
    );
  }

  soften(system, vehicle, before, predicted, target, frame) {
    const candidate = this.candidateStates(system, vehicle, predicted, target, frame)[0];
    if (candidate) {
      applyVehicleState(system, vehicle, candidate);
      this.totalSoftened++;
      return { applied: true, slid: true };
    }

    const impactSpeed = Math.abs(finite(predicted.speed, before.speed));
    const retention = clamp(
      this.maximumRetention - impactSpeed / 760,
      this.minimumRetention,
      this.maximumRetention
    );
    const side = this.preferredSide(vehicle, predicted, target, frame).side;
    const angle = normalizeAngle(before.angle + side * this.minimumYaw);
    const speed = finite(predicted.speed, before.speed) * retention;
    applyVehicleState(system, vehicle, {
      x: before.x,
      y: before.y,
      angle,
      travelAngle: rotateTowardAngle(before.travelAngle, angle, 0.12),
      driftAngle: finite(before.driftAngle) * 0.45,
      speed,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed
    });
    this.totalSoftened++;
    return { applied: true, slid: false };
  }

  updateDriving(system, dt, frame) {
    const vehicle = system.currentVehicle?.();
    if (!vehicle || vehicle.disabled || this.destroyed) {
      return this.originalUpdateDriving.call(system, dt, frame);
    }

    const before = {
      x: vehicle.x,
      y: vehicle.y,
      angle: vehicle.angle,
      travelAngle: vehicle.travelAngle ?? vehicle.angle,
      driftAngle: vehicle.driftAngle || 0,
      speed: vehicle.speed
    };
    const predicted = stepVehicleKinematics(vehicle, frame, dt, vehicle.archetype);
    const target = collisionTarget(system, vehicle, predicted, this.collisionPadding);
    const result = this.originalUpdateDriving.call(system, dt, frame);
    if (!target) return result;

    this.totalContacts++;
    const rigid = this.shouldSoften(before, predicted, vehicle);
    let softened = null;
    if (rigid && !vehicle.disabled) softened = this.soften(system, vehicle, before, predicted, target, frame);
    else this.totalPassThroughs++;

    this.lastContact = {
      targetId: target.id,
      targetKind: target.kind,
      vehicleId: vehicle.id,
      impactSpeed: Math.abs(finite(predicted.speed, before.speed)),
      overlap: target.overlap,
      rigid,
      softened: Boolean(softened?.applied),
      slid: Boolean(softened?.slid)
    };
    if (softened?.applied) {
      this.scene.lastActionText = softened.slid
        ? "Car contact · the bodywork glances and slides instead of locking."
        : "Car contact · speed bleeds off progressively instead of stopping dead.";
      this.scene.events?.emit?.("vehicle:collision-softened", this.lastContact);
    }
    this.publish();
    return result;
  }

  snapshot() {
    return {
      ready: !this.destroyed,
      totalContacts: this.totalContacts,
      totalSoftened: this.totalSoftened,
      totalPassThroughs: this.totalPassThroughs,
      lastContact: this.lastContact ? { ...this.lastContact } : null,
      tuning: {
        maxPushStep: this.physical.maxPushStep,
        maxOffset: this.physical.maxOffset,
        blockedHoldSeconds: this.physical.blockedHoldSeconds,
        playerSpeedRetention: this.physical.playerSpeedRetention
      }
    };
  }

  publish() {
    const snapshot = this.snapshot();
    this.scene.statePublisher?.setMany?.({
      vehicleCollisionText: `Vehicle contacts ${snapshot.totalContacts} · softened ${snapshot.totalSoftened}`,
      vehicleCollisionState: snapshot
    });
    if (typeof window !== "undefined") window.NBD_VEHICLE_COLLISIONS_READY = snapshot.ready;
    return snapshot;
  }

  installBrowserApi() {
    if (typeof window === "undefined") return;
    window.NBD_VEHICLE_COLLISIONS = Object.freeze({
      snapshot: () => this.snapshot()
    });
    window.NBD_VEHICLE_COLLISIONS_READY = true;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.vehicleSystem.updateDriving === this.softUpdateDriving) {
      this.vehicleSystem.updateDriving = this.originalUpdateDriving;
    }
    if (typeof window !== "undefined") {
      delete window.NBD_VEHICLE_COLLISIONS;
      window.NBD_VEHICLE_COLLISIONS_READY = false;
    }
  }
}

export function installVehicleCollisionSofteningPolicy(scene, options = {}) {
  return new VehicleCollisionSofteningPolicy(scene, options);
}
