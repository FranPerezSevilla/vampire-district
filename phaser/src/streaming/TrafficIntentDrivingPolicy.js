import { angleDelta, normalizeAngle, stepVehicleKinematics } from "../vehicles/VehicleModel.js";

function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function vehicleState(slot, previous = null) {
  const base = previous || {};
  const angle = normalizeAngle(finite(base.angle, slot?.angle));
  const travelAngle = normalizeAngle(finite(base.travelAngle, angle));
  return {
    ...base,
    x: finite(base.x, slot?.x),
    y: finite(base.y, slot?.y),
    angle,
    travelAngle,
    driftAngle: angleDelta(travelAngle, angle),
    velocityX: finite(base.velocityX),
    velocityY: finite(base.velocityY),
    speed: finite(base.speed, Math.max(0, finite(slot?.engineSpeed))),
    gear: Math.max(1, Math.round(finite(base.gear, slot?.gear || 1))),
    gearShiftTimer: Math.max(0, finite(base.gearShiftTimer, slot?.gearShiftTimer)),
    parked: Math.abs(finite(base.speed, slot?.engineSpeed)) < 0.5,
    disabled: false
  };
}

export function trafficDrivingIntent(actual, target, targetSpeed, archetype) {
  const dx = finite(target?.x) - finite(actual?.x);
  const dy = finite(target?.y) - finite(actual?.y);
  const separation = Math.hypot(dx, dy);
  const desiredAngle = separation > 1
    ? Math.atan2(dy, dx)
    : finite(target?.angle, actual?.angle);
  const delta = angleDelta(actual?.angle, desiredAngle);
  const steer = clamp(delta / 0.72, -1, 1);
  const speed = Math.abs(finite(actual?.speed));
  const desiredSpeed = Math.max(0, finite(targetSpeed));
  const brakingMargin = Math.max(3, desiredSpeed * 0.08);
  let throttle = 0;
  if (speed < desiredSpeed - brakingMargin) throttle = 1;
  else if (speed > desiredSpeed + brakingMargin) throttle = -1;
  if (Math.abs(delta) > 1.0) throttle = Math.min(throttle, 0.25);
  if (Math.abs(delta) > 1.45) throttle = Math.min(throttle, -0.25);
  return {
    move: { x: steer, y: -throttle },
    handbrakeHeld: false,
    desiredAngle,
    targetSpeed: desiredSpeed,
    separation,
    archetypeId: archetype?.id || null
  };
}

export function installTrafficIntentDrivingPolicy(steering) {
  if (!steering?.applyPresentation || !steering?.behavior) {
    throw new TypeError("Traffic intent driving policy requires TrafficSteeringPresentationSystem.");
  }
  if (steering.__nbdIntentDrivingPolicy) return steering.__nbdIntentDrivingPolicy;

  const originalApplyPresentation = steering.applyPresentation;
  const dynamics = new Map();
  let drivenFrames = 0;

  function intentDrivenPresentation(slot, steeringState, dt) {
    if (!slot?.tokenId) return originalApplyPresentation.call(this, slot, steeringState, dt);
    const behaviorState = steering.behavior.states?.get?.(slot.tokenId);
    const lane = behaviorState ? steering.behavior.laneFor?.(behaviorState) : null;
    const seconds = Math.max(0, finite(dt));
    const archetype = slot.archetype || {};
    let actual = vehicleState(slot, dynamics.get(slot.tokenId));

    const lanePhase = finite(behaviorState?.visualTravel, finite(slot.phase));
    const laneLength = Math.max(1, finite(lane?.length, 240));
    const lookAhead = clamp(26 + Math.abs(actual.speed) * 0.22, 26, 72);
    const targetPhase = lanePhase + lookAhead / laneLength;
    const sampled = lane
      ? steering.behavior.sampleLane?.(lane, targetPhase)
      : { x: slot.x, y: slot.y, angle: slot.angle };
    const laneAngle = finite(sampled?.angle, slot.angle);
    const offset = steeringState?.active
      ? finite(steeringState.side, 1) * steering.lateralDistance
      : 0;
    const target = {
      x: finite(sampled?.x, slot.x) - Math.sin(laneAngle) * offset,
      y: finite(sampled?.y, slot.y) + Math.cos(laneAngle) * offset,
      angle: laneAngle
    };

    const cruise = Math.max(18, finite(slot.engineSpeed, finite(archetype.maxSpeed, 120) * 0.46));
    const speedFactor = clamp(slot.desiredSpeedFactor ?? slot.speedFactor ?? 1, 0, 1.25);
    const targetSpeed = cruise * speedFactor;
    const intent = trafficDrivingIntent(actual, target, targetSpeed, archetype);
    let next = stepVehicleKinematics(actual, intent, seconds, archetype);

    if (!steering.candidateSafe?.(slot, steeringState?.side || 1)
      && steeringState?.active
      && Math.hypot(next.x - actual.x, next.y - actual.y) > 0.01) {
      const brakeIntent = { move: { x: intent.move.x * 0.45, y: 1 }, handbrakeHeld: false };
      next = stepVehicleKinematics(actual, brakeIntent, seconds, archetype);
    }

    dynamics.set(slot.tokenId, next);
    slot.x = next.x;
    slot.y = next.y;
    slot.angle = next.angle;
    slot.travelAngle = next.travelAngle;
    slot.speed = next.speed;
    slot.gear = next.gear;
    slot.gearShiftTimer = next.gearShiftTimer;
    slot.steeringOffset = Math.hypot(next.x - finite(sampled?.x), next.y - finite(sampled?.y));
    slot.steeringAngle = angleDelta(laneAngle, next.angle);
    slot.steeringReason = steeringState?.active ? "intent-obstacle-avoidance" : "intent-lane-follow";
    slot.container?.setPosition?.(next.x, next.y)?.setRotation?.(next.angle);
    slot.visual?.label?.setRotation?.(-next.angle);
    steeringState.offset = offset;
    steeringState.steerAngle = slot.steeringAngle;
    drivenFrames++;
    return slot;
  }

  steering.applyPresentation = intentDrivenPresentation;

  const policy = {
    snapshot() {
      return {
        activeVehicles: dynamics.size,
        drivenFrames,
        model: "player-vehicle-kinematics"
      };
    },
    destroy() {
      if (steering.applyPresentation === intentDrivenPresentation) steering.applyPresentation = originalApplyPresentation;
      dynamics.clear();
      if (steering.__nbdIntentDrivingPolicy === policy) delete steering.__nbdIntentDrivingPolicy;
    }
  };
  steering.__nbdIntentDrivingPolicy = policy;
  return policy;
}
