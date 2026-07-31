import {
  HEAT_LEVEL_THRESHOLDS,
  MAX_DISTRICT_HEAT,
  heatLevelFromValue
} from "../data/attention.js";

export const PEDESTRIAN_IMPACT_BURST_WINDOW_MS = 4500;

const IMPACT_HEAT_STEPS = Object.freeze({
  nonlethal: Object.freeze([10, 6, 4, 2]),
  lethal: Object.freeze([18, 10, 6, 4])
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

export function vehiclePedestrianImpactBaseHeat(lethal, chainIndex = 0) {
  const steps = IMPACT_HEAT_STEPS[lethal ? "lethal" : "nonlethal"];
  const index = Math.max(0, Math.floor(finite(chainIndex)));
  return steps[Math.min(index, steps.length - 1)];
}

export function vehiclePedestrianBurstCeiling(startHeat = 0) {
  const value = clamp(startHeat, 0, MAX_DISTRICT_HEAT);
  const level = heatLevelFromValue(value);
  if (level <= 0) return HEAT_LEVEL_THRESHOLDS[2] - 1;
  if (level === 1) return HEAT_LEVEL_THRESHOLDS[3] - 1;
  return MAX_DISTRICT_HEAT;
}

export function planVehiclePedestrianImpactHeat(previousState, {
  nowMs = 0,
  districtId = "district",
  currentHeat = 0,
  lethal = false,
  windowMs = PEDESTRIAN_IMPACT_BURST_WINDOW_MS
} = {}) {
  const now = Math.max(0, finite(nowMs));
  const heat = clamp(currentHeat, 0, MAX_DISTRICT_HEAT);
  const district = String(districtId || "district");
  const window = Math.max(250, finite(windowMs, PEDESTRIAN_IMPACT_BURST_WINDOW_MS));
  const previousAt = finite(previousState?.lastImpactAtMs, -Infinity);
  const continuesBurst = Boolean(
    previousState
    && previousState.districtId === district
    && now >= previousAt
    && now - previousAt <= window
  );
  const chainCount = continuesBurst
    ? Math.max(1, Math.floor(finite(previousState.chainCount, 0)) + 1)
    : 1;
  const startHeat = continuesBurst
    ? clamp(previousState.startHeat, 0, MAX_DISTRICT_HEAT)
    : heat;
  const ceiling = continuesBurst
    ? clamp(previousState.ceiling, 0, MAX_DISTRICT_HEAT)
    : vehiclePedestrianBurstCeiling(startHeat);
  const baseHeat = vehiclePedestrianImpactBaseHeat(lethal, chainCount - 1);
  const appliedHeat = clamp(baseHeat, 0, Math.max(0, ceiling - heat));

  const state = {
    districtId: district,
    startedAtMs: continuesBurst
      ? Math.max(0, finite(previousState.startedAtMs, now))
      : now,
    lastImpactAtMs: now,
    chainCount,
    startHeat,
    ceiling,
    appliedHeat: (continuesBurst ? Math.max(0, finite(previousState.appliedHeat)) : 0) + appliedHeat
  };

  return {
    heat: appliedHeat,
    baseHeat,
    suppressedHeat: Math.max(0, baseHeat - appliedHeat),
    chainCount,
    ceiling,
    continuesBurst,
    state
  };
}
