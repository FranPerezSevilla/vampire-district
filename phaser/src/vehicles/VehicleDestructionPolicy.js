export const VEHICLE_DESTRUCTION = Object.freeze({
  severeImpactSpeed: 92,
  explosionRadius: 112,
  playerMaxDamage: 52,
  playerMinDamage: 10,
  npcMaxDamage: 3,
  npcMinDamage: 1,
  occupantVitalityDamage: 250
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function vehicleDestructionTransition(vehicle, damage, { destructive = false } = {}) {
  const amount = Math.max(0, finite(damage));
  const before = Math.max(0, finite(vehicle?.health));
  const exploded = Boolean(vehicle?.exploded);
  const critical = Boolean(vehicle?.criticalDamage || (vehicle?.disabled && before <= 0));
  if (!vehicle || exploded || amount <= 0) {
    return { action: "none", before, after: before, critical, exploded };
  }
  if (critical) {
    return { action: "explode", before, after: 0, critical: false, exploded: true };
  }
  const after = Math.max(0, before - amount);
  if (after > 0) {
    return { action: "damage", before, after, critical: false, exploded: false };
  }
  if (destructive) {
    return { action: "explode", before, after: 0, critical: false, exploded: true };
  }
  return { action: "critical", before, after: 0, critical: true, exploded: false };
}

export function explosionDamageAtDistance(distance, {
  radius = VEHICLE_DESTRUCTION.explosionRadius,
  maxDamage = VEHICLE_DESTRUCTION.playerMaxDamage,
  minDamage = VEHICLE_DESTRUCTION.playerMinDamage
} = {}) {
  const range = Math.max(1, finite(radius, VEHICLE_DESTRUCTION.explosionRadius));
  const d = Math.max(0, finite(distance));
  if (d >= range) return 0;
  const maximum = Math.max(0, finite(maxDamage));
  const minimum = Math.max(0, Math.min(maximum, finite(minDamage)));
  const t = 1 - d / range;
  return minimum + (maximum - minimum) * t * t;
}
