const TAU = Math.PI * 2;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

export function approach(value, target, amount) {
  const current = Number(value) || 0;
  const goal = Number(target) || 0;
  const step = Math.max(0, Number(amount) || 0);
  if (current < goal) return Math.min(goal, current + step);
  if (current > goal) return Math.max(goal, current - step);
  return goal;
}

export function normalizeAngle(angle) {
  let value = Number(angle) || 0;
  while (value > Math.PI) value -= TAU;
  while (value < -Math.PI) value += TAU;
  return value;
}

export function angleDelta(from, to) {
  return normalizeAngle((Number(to) || 0) - (Number(from) || 0));
}

export function rotateTowardAngle(current, target, maximumDelta) {
  const delta = angleDelta(current, target);
  const step = Math.max(0, Number(maximumDelta) || 0);
  if (Math.abs(delta) <= step) return normalizeAngle(target);
  return normalizeAngle((Number(current) || 0) + Math.sign(delta) * step);
}

export function createVehicleState(definition, archetype, condition = {}) {
  if (!definition?.id || !archetype?.id) {
    throw new TypeError("createVehicleState requires a vehicle definition and archetype.");
  }
  const maxHealth = Math.max(1, Number(archetype.maxHealth) || 1);
  const angle = normalizeAngle(Number.isFinite(Number(condition.angle)) ? Number(condition.angle) : definition.angle);
  const travelAngle = normalizeAngle(Number.isFinite(Number(condition.travelAngle)) ? Number(condition.travelAngle) : angle);
  return {
    id: String(definition.id),
    archetypeId: String(archetype.id),
    x: Number.isFinite(Number(condition.x)) ? Number(condition.x) : Number(definition.x) || 0,
    y: Number.isFinite(Number(condition.y)) ? Number(condition.y) : Number(definition.y) || 0,
    angle,
    travelAngle,
    driftAngle: angleDelta(travelAngle, angle),
    velocityX: 0,
    velocityY: 0,
    speed: 0,
    health: clamp(Number.isFinite(Number(condition.health)) ? Number(condition.health) : maxHealth, 0, maxHealth),
    disabled: Boolean(condition.disabled) || Number(condition.health) <= 0,
    parked: condition.parked == null ? definition.parked !== false : Boolean(condition.parked)
  };
}

export function normalizeVehicleInput(frame = {}) {
  const move = frame?.move || {};
  return {
    throttle: clamp(-(Number(move.y) || 0), -1, 1),
    steer: clamp(Number(move.x) || 0, -1, 1),
    handbrake: Boolean(frame?.handbrakeHeld)
  };
}

export function stepVehicleKinematics(state, frame, dt, archetype) {
  const seconds = clamp(dt, 0, 0.1);
  const input = normalizeVehicleInput(frame);
  const maxSpeed = Math.max(1, Number(archetype?.maxSpeed) || 1);
  const reverseSpeed = Math.max(1, Number(archetype?.reverseSpeed) || maxSpeed * 0.35);
  const acceleration = Math.max(0, Number(archetype?.acceleration) || 0);
  const reverseAcceleration = Math.max(0, Number(archetype?.reverseAcceleration) || acceleration * 0.7);
  const brake = Math.max(0, Number(archetype?.brake) || acceleration * 1.5);
  const drag = Math.max(0, Number(archetype?.drag) || acceleration * 0.35);
  const steerRate = Math.max(0, Number(archetype?.steerRate) || 0);
  const launchBoost = Math.max(0, Number(archetype?.launchBoost) || 0);
  const handbrakeBrake = Math.max(0, Number(archetype?.handbrakeBrake) || brake * 0.65);
  const handbrakeThrottleFactor = clamp(Number(archetype?.handbrakeThrottleFactor) || 0.2, 0, 1);
  const handbrakeSteer = Math.max(1, Number(archetype?.handbrakeSteerMultiplier) || 1.3);
  const handbrakeDriftKick = Math.max(0, Number(archetype?.handbrakeDriftKick) || 0.55);
  const normalGrip = Math.max(0.1, Number(archetype?.grip) || 8);
  const handbrakeGrip = Math.max(0.1, Number(archetype?.handbrakeGrip) || 1.4);

  let speed = Number(state?.speed) || 0;
  const incomingRatio = clamp(Math.abs(speed) / maxSpeed, 0, 1);
  const launchMultiplier = 1 + launchBoost * Math.pow(1 - incomingRatio, 2.1);

  if (state?.disabled) {
    speed = approach(speed, 0, brake * seconds);
  } else if (input.handbrake) {
    if (input.throttle > 0 && speed >= 0) {
      speed += acceleration * launchMultiplier * handbrakeThrottleFactor * input.throttle * seconds;
    } else if (input.throttle < 0 && speed <= 0) {
      speed -= reverseAcceleration * handbrakeThrottleFactor * Math.abs(input.throttle) * seconds;
    }
    speed = approach(speed, 0, handbrakeBrake * seconds);
  } else if (input.throttle > 0) {
    speed = speed < 0
      ? approach(speed, 0, brake * input.throttle * seconds)
      : speed + acceleration * launchMultiplier * input.throttle * seconds;
  } else if (input.throttle < 0) {
    const pressure = Math.abs(input.throttle);
    speed = speed > 0
      ? approach(speed, 0, brake * pressure * seconds)
      : speed - reverseAcceleration * pressure * seconds;
  } else {
    speed = approach(speed, 0, drag * seconds);
  }
  speed = clamp(speed, -reverseSpeed, maxSpeed);

  const speedRatio = clamp(Math.abs(speed) / maxSpeed, 0, 1);
  let angle = normalizeAngle(state?.angle);
  const steeringIntent = Math.abs(input.steer);
  const contactAuthority = Math.abs(input.throttle) * 0.16;
  const movementAuthority = Math.max(speedRatio, contactAuthority);
  if (!state?.disabled && steeringIntent > 0.01 && (Math.abs(speed) > 0.25 || Math.abs(input.throttle) > 0.05)) {
    const reverseSign = speed < 0 ? -1 : 1;
    const steeringAuthority = (0.24 + Math.sqrt(movementAuthority) * 0.76) * (input.handbrake ? handbrakeSteer : 1);
    const requestedTurnRate = input.steer * steerRate * steeringAuthority * reverseSign;
    const maximumTurnRate = input.handbrake
      ? 2.30 - speedRatio * 0.25
      : 2.55 - speedRatio * 0.45;
    angle = normalizeAngle(angle + clamp(requestedTurnRate, -maximumTurnRate, maximumTurnRate) * seconds);
  }

  let travelAngle = normalizeAngle(Number.isFinite(Number(state?.travelAngle)) ? state.travelAngle : state?.angle);
  if (Math.abs(speed) < 1) {
    travelAngle = rotateTowardAngle(travelAngle, angle, 14 * seconds);
  } else if (input.handbrake) {
    const driftRatio = clamp((speedRatio - 0.12) / 0.88, 0, 1);
    const kick = input.steer * handbrakeDriftKick * driftRatio * seconds;
    travelAngle = normalizeAngle(travelAngle - kick);
    travelAngle = rotateTowardAngle(travelAngle, angle, handbrakeGrip * (0.52 + speedRatio * 0.20) * seconds);
  } else {
    const gripScale = 1.22 - speedRatio * 0.34;
    travelAngle = rotateTowardAngle(travelAngle, angle, normalGrip * gripScale * seconds);
  }

  const driftAngle = angleDelta(travelAngle, angle);
  const velocityX = Math.cos(travelAngle) * speed;
  const velocityY = Math.sin(travelAngle) * speed;

  return {
    ...state,
    x: (Number(state?.x) || 0) + velocityX * seconds,
    y: (Number(state?.y) || 0) + velocityY * seconds,
    angle,
    travelAngle,
    driftAngle,
    velocityX,
    velocityY,
    speed,
    parked: Math.abs(speed) < 0.5,
    handbrake: input.handbrake
  };
}

export function interpolateVehicleState(state, next, progress) {
  const t = clamp(progress, 0, 1);
  const angle = normalizeAngle((Number(state?.angle) || 0) + angleDelta(state?.angle, next?.angle) * t);
  const travelAngle = normalizeAngle((Number(state?.travelAngle) || Number(state?.angle) || 0) + angleDelta(state?.travelAngle ?? state?.angle, next?.travelAngle ?? next?.angle) * t);
  const speed = (Number(state?.speed) || 0) + ((Number(next?.speed) || 0) - (Number(state?.speed) || 0)) * t;
  return {
    ...next,
    x: (Number(state?.x) || 0) + ((Number(next?.x) || 0) - (Number(state?.x) || 0)) * t,
    y: (Number(state?.y) || 0) + ((Number(next?.y) || 0) - (Number(state?.y) || 0)) * t,
    angle,
    travelAngle,
    driftAngle: angleDelta(travelAngle, angle),
    velocityX: Math.cos(travelAngle) * speed,
    velocityY: Math.sin(travelAngle) * speed,
    speed
  };
}

export function vehicleSlideCandidates(state, next, speedRetention = 0.98) {
  const deltaX = (Number(next?.x) || 0) - (Number(state?.x) || 0);
  const deltaY = (Number(next?.y) || 0) - (Number(state?.y) || 0);
  const fractions = [1, 0.9, 0.78, 0.66, 0.54, 0.42, 0.30, 0.20, 0.12];
  const candidates = [];
  for (let index = 0; index < fractions.length; index++) {
    const fraction = fractions[index];
    const retention = clamp(speedRetention - index * 0.018, 0.78, 1);
    const speed = (Number(next?.speed) || 0) * retention;
    for (const angleNudge of [0, -0.06, 0.06, -0.12, 0.12]) {
      const angle = normalizeAngle((Number(next?.angle) || 0) + angleNudge);
      candidates.push({
        ...next,
        x: (Number(state?.x) || 0) + deltaX * fraction,
        y: Number(state?.y) || 0,
        angle,
        speed
      });
      candidates.push({
        ...next,
        x: Number(state?.x) || 0,
        y: (Number(state?.y) || 0) + deltaY * fraction,
        angle,
        speed
      });
    }
  }
  return candidates;
}

export function vehicleSpeedKph(speed) {
  return Math.round(Math.abs(Number(speed) || 0) * 0.47);
}

export function vehicleHealthPercent(health, maxHealth) {
  const maximum = Math.max(1, Number(maxHealth) || 1);
  return Math.round(clamp(Number(health) || 0, 0, maximum) / maximum * 100);
}

export function vehicleImpactDamage(speed, { threshold = 34, scale = 0.12 } = {}) {
  const impact = Math.max(0, Math.abs(Number(speed) || 0) - Math.max(0, Number(threshold) || 0));
  return Math.round(impact * Math.max(0, Number(scale) || 0) * 10) / 10;
}

export function vehicleCameraZoom(baseZoom, speed, archetype) {
  const maximum = Math.max(1, Number(archetype?.maxSpeed) || 1);
  const ratio = clamp(Math.abs(Number(speed) || 0) / maximum, 0, 1);
  const minimumFactor = clamp(Number(archetype?.cameraZoomFactor) || 0.76, 0.55, 1);
  const eased = ratio * ratio * (3 - 2 * ratio);
  return Math.max(0.1, (Number(baseZoom) || 1) * (1 - (1 - minimumFactor) * eased));
}

export function vehicleExitOffsets(state, archetype, margin = 9) {
  const halfWidth = Math.max(8, Number(archetype?.width) || 20) / 2;
  const halfHeight = Math.max(6, Number(archetype?.height) || 12) / 2;
  const angle = Number(state?.angle) || 0;
  const forward = { x: Math.cos(angle), y: Math.sin(angle) };
  const side = { x: -forward.y, y: forward.x };
  const sideDistance = halfHeight + Math.max(4, Number(margin) || 0) + 7;
  const rearDistance = halfWidth + Math.max(4, Number(margin) || 0) + 7;
  return [
    { x: state.x + side.x * sideDistance, y: state.y + side.y * sideDistance },
    { x: state.x - side.x * sideDistance, y: state.y - side.y * sideDistance },
    { x: state.x - forward.x * rearDistance, y: state.y - forward.y * rearDistance },
    { x: state.x + forward.x * rearDistance, y: state.y + forward.y * rearDistance }
  ];
}

export function vehicleFootprintPoints(state, archetype, padding = 0) {
  const halfWidth = Math.max(1, Number(archetype?.width) || 20) / 2 + Math.max(0, Number(padding) || 0);
  const halfHeight = Math.max(1, Number(archetype?.height) || 12) / 2 + Math.max(0, Number(padding) || 0);
  const angle = Number(state?.angle) || 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const local = [
    [-halfWidth, -halfHeight],
    [halfWidth, -halfHeight],
    [halfWidth, halfHeight],
    [-halfWidth, halfHeight],
    [0, -halfHeight],
    [halfWidth, 0],
    [0, halfHeight],
    [-halfWidth, 0],
    [0, 0]
  ];
  return local.map(([lx, ly]) => ({
    x: (Number(state?.x) || 0) + lx * cos - ly * sin,
    y: (Number(state?.y) || 0) + lx * sin + ly * cos
  }));
}