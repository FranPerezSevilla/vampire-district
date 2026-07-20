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

export function createVehicleState(definition, archetype, condition = {}) {
  if (!definition?.id || !archetype?.id) {
    throw new TypeError("createVehicleState requires a vehicle definition and archetype.");
  }
  const maxHealth = Math.max(1, Number(archetype.maxHealth) || 1);
  return {
    id: String(definition.id),
    archetypeId: String(archetype.id),
    x: Number.isFinite(Number(condition.x)) ? Number(condition.x) : Number(definition.x) || 0,
    y: Number.isFinite(Number(condition.y)) ? Number(condition.y) : Number(definition.y) || 0,
    angle: normalizeAngle(Number.isFinite(Number(condition.angle)) ? Number(condition.angle) : definition.angle),
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
    steer: clamp(Number(move.x) || 0, -1, 1)
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

  let speed = Number(state?.speed) || 0;
  if (state?.disabled) speed = approach(speed, 0, brake * seconds);
  else if (input.throttle > 0) {
    speed = speed < 0
      ? approach(speed, 0, brake * input.throttle * seconds)
      : speed + acceleration * input.throttle * seconds;
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
  if (!state?.disabled && Math.abs(speed) > 1 && Math.abs(input.steer) > 0.01) {
    const reverseSign = speed < 0 ? -1 : 1;
    const steeringAuthority = 0.22 + speedRatio * 0.78;
    angle = normalizeAngle(angle + input.steer * steerRate * steeringAuthority * reverseSign * seconds);
  }

  return {
    ...state,
    x: (Number(state?.x) || 0) + Math.cos(angle) * speed * seconds,
    y: (Number(state?.y) || 0) + Math.sin(angle) * speed * seconds,
    angle,
    speed,
    parked: Math.abs(speed) < 0.5
  };
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
