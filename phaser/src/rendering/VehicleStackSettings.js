// Shared by the existing debug panel and stack renderer, never vehicle physics.
export const VEHICLE_STACK_SETTINGS = Object.freeze({
  defaultMagnitude: 2,
  maxMagnitude: 3,
  radialShear: 1.15,
  extraTilt: .45
});

export function vehicleStackMagnitude(value) {
  return Number.isFinite(value)
    ? Math.max(0, Math.min(VEHICLE_STACK_SETTINGS.maxMagnitude, value))
    : VEHICLE_STACK_SETTINGS.defaultMagnitude;
}

export const MAX_VEHICLE_STACK_SHEAR = VEHICLE_STACK_SETTINGS.radialShear * VEHICLE_STACK_SETTINGS.maxMagnitude
  + VEHICLE_STACK_SETTINGS.extraTilt * (VEHICLE_STACK_SETTINGS.maxMagnitude - 1);
