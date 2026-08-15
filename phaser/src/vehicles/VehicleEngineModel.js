import { vehicleGearCount, vehicleGearForSpeed } from "./VehicleModel.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function effectiveArchetype(archetype, maxSpeed = null) {
  const override = Number(maxSpeed);
  return Number.isFinite(override) && override > 0
    ? { ...archetype, maxSpeed: override }
    : archetype;
}

export function stepPresentationTransmission(state = {}, speed = 0, dt = 0, archetype = {}, { maxSpeed = null } = {}) {
  const effective = effectiveArchetype(archetype, maxSpeed);
  const count = vehicleGearCount(effective);
  const seconds = clamp(dt, 0, 0.25);
  const shiftDuration = clamp(Number(archetype?.gearShiftDuration) || 0.11, 0.06, 0.22);
  let gear = Math.round(clamp(Number(state?.gear) || 1, 1, count));
  let gearShiftTimer = Math.max(0, (Number(state?.gearShiftTimer) || 0) - seconds);

  if (Number(speed) < -0.5) return { gear: 1, gearShiftTimer: 0, gearCount: 1 };
  const target = vehicleGearForSpeed(Math.abs(Number(speed) || 0), effective, gear);
  if (target > gear && gearShiftTimer <= 0) {
    gear = Math.min(target, gear + 1);
    gearShiftTimer = shiftDuration;
  } else if (target < gear) {
    gear = target;
    gearShiftTimer = 0;
  }
  return { gear, gearShiftTimer, gearCount: count };
}

export function vehicleEngineRpmNormalized({ speed = 0, maxSpeed = 1, gear = 1, gearCount = 5, shifting = false } = {}) {
  const velocity = Math.abs(Number(speed) || 0);
  const maximum = Math.max(1, Number(maxSpeed) || 1);
  if (velocity < 0.5) return 0.18;

  const count = Math.max(1, Math.round(Number(gearCount) || 1));
  const selected = Math.round(clamp(Number(gear) || 1, 1, count));
  const ratio = clamp(velocity / maximum, 0, 1);
  const start = count <= 1 || selected <= 1 ? 0 : ((selected - 1) / count) * 0.93;
  const end = count <= 1 || selected >= count ? 1 : (selected / count) * 0.93;
  const local = clamp((ratio - start) / Math.max(0.04, end - start), 0, 1);
  let rpm = 0.25 + local * 0.75;
  if (shifting) rpm = Math.max(0.20, rpm * 0.70);
  return clamp(rpm, 0.18, 1);
}

export function vehicleEngineTelemetry({
  speed = 0,
  archetype = {},
  gear = 1,
  gearShiftTimer = 0,
  throttle = 0,
  x = 0,
  y = 0,
  listener = null,
  ownVehicle = false,
  maxSpeed = null,
  maxDistance = 560
} = {}) {
  const reverse = Number(speed) < -0.5;
  const maximum = reverse
    ? Math.max(1, Number(archetype?.reverseSpeed) || Number(maxSpeed) || 1)
    : Math.max(1, Number(maxSpeed) || Number(archetype?.maxSpeed) || 1);
  const count = reverse ? 1 : vehicleGearCount(archetype);
  const selectedGear = reverse ? 1 : Math.round(clamp(Number(gear) || 1, 1, count));
  const rpm = vehicleEngineRpmNormalized({
    speed,
    maxSpeed: maximum,
    gear: selectedGear,
    gearCount: count,
    shifting: Number(gearShiftTimer) > 0
  });
  const load = clamp(0.12 + Math.abs(Number(throttle) || 0) * 0.88, 0.12, 1);

  const listenerX = Number(listener?.x) || 0;
  const listenerY = Number(listener?.y) || 0;
  const distance = ownVehicle ? 0 : Math.hypot((Number(x) || 0) - listenerX, (Number(y) || 0) - listenerY);
  const range = Math.max(80, Number(maxDistance) || 560);
  const distanceRatio = clamp(1 - distance / range, 0, 1);
  const audibility = ownVehicle ? 1 : Math.pow(distanceRatio, 1.35);
  const pan = ownVehicle ? 0 : clamp(((Number(x) || 0) - listenerX) / Math.max(180, range * 0.55), -1, 1);

  return {
    profileId: String(archetype?.id || "sedan"),
    gear: selectedGear,
    gearCount: count,
    rpm,
    load,
    distance,
    audibility,
    pan
  };
}
