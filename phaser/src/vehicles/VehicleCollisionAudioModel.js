const COLLISION_AUDIO_MIN_SPEED = 44;
const COLLISION_AUDIO_HEAVY_SPEED = 96;

export function vehicleCollisionAudioEvent(impactSpeed) {
  const impact = Math.abs(Number(impactSpeed) || 0);
  if (impact < COLLISION_AUDIO_MIN_SPEED) return null;
  return impact >= COLLISION_AUDIO_HEAVY_SPEED
    ? "vehicleCollisionHeavy"
    : "vehicleCollisionLight";
}

export const VEHICLE_COLLISION_AUDIO_THRESHOLDS = Object.freeze({
  minimumSpeed: COLLISION_AUDIO_MIN_SPEED,
  heavySpeed: COLLISION_AUDIO_HEAVY_SPEED
});
