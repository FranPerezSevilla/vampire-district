import { UNARMED_ATTACK } from "./combat.js";
import { angleBetween, dot, normalizeVector } from "../utils/geometry.js";

export const WEAPON_TYPES = Object.freeze({
  MELEE: "melee",
  HITSCAN: "hitscan"
});

export const WEAPON_IDS = Object.freeze({
  UNARMED: "unarmed",
  PIPE: "iron_pipe",
  PISTOL: "pistol"
});

export const WEAPONS = Object.freeze({
  [WEAPON_IDS.UNARMED]: Object.freeze({
    ...UNARMED_ATTACK,
    id: WEAPON_IDS.UNARMED,
    name: "Unarmed",
    attackType: WEAPON_TYPES.MELEE,
    color: 0xd7c8ff,
    reticleDistance: 27,
    violenceLabel: "punched",
    witnessSeverity: 6,
    ammoCapacity: null,
    soundRadius: 72
  }),
  [WEAPON_IDS.PIPE]: Object.freeze({
    id: WEAPON_IDS.PIPE,
    name: "Iron Pipe",
    attackType: WEAPON_TYPES.MELEE,
    damage: 2,
    range: 42,
    halfAngle: 0.56,
    aimDeadZone: 10,
    windupMs: 130,
    activeMs: 125,
    recoveryMs: 360,
    staggerMs: 460,
    feedbackMs: 1050,
    color: 0x78c7a3,
    reticleDistance: 34,
    violenceLabel: "struck with an iron pipe",
    witnessSeverity: 11,
    ammoCapacity: null,
    soundRadius: 104
  }),
  [WEAPON_IDS.PISTOL]: Object.freeze({
    id: WEAPON_IDS.PISTOL,
    name: "Pistol",
    attackType: WEAPON_TYPES.HITSCAN,
    damage: 3,
    range: 260,
    hitWidth: 2.5,
    aimDeadZone: 10,
    windupMs: 65,
    activeMs: 45,
    recoveryMs: 430,
    staggerMs: 560,
    feedbackMs: 1150,
    color: 0xffb02e,
    reticleDistance: 48,
    violenceLabel: "shot",
    witnessSeverity: 18,
    ammoCapacity: 8,
    soundRadius: 280,
    visualRadius: 190,
    policeHeat: 34,
    noiseOnAttackStart: true
  })
});

export const DEFAULT_WEAPON_INVENTORY = Object.freeze([
  WEAPON_IDS.UNARMED,
  WEAPON_IDS.PIPE,
  WEAPON_IDS.PISTOL
]);

export function weaponById(id) {
  return WEAPONS[id] || WEAPONS[WEAPON_IDS.UNARMED];
}

export function cycleWeaponIndex(currentIndex, step, count) {
  const length = Math.max(0, Math.floor(Number(count) || 0));
  if (!length) return 0;
  const delta = Math.sign(Number(step) || 0);
  if (!delta) return Math.max(0, Math.min(length - 1, Math.floor(Number(currentIndex) || 0)));
  return ((Math.floor(Number(currentIndex) || 0) + delta) % length + length) % length;
}

export function weaponHasAmmo(weapon, ammoRemaining) {
  if (!weapon || weapon.ammoCapacity == null) return true;
  return Math.max(0, Number(ammoRemaining) || 0) > 0;
}

export function consumeWeaponAmmo(weapon, ammoRemaining) {
  const before = Math.max(0, Number(ammoRemaining) || 0);
  if (!weapon || weapon.ammoCapacity == null) return { fired: true, before, after: before };
  if (before <= 0) return { fired: false, before: 0, after: 0 };
  return { fired: true, before, after: before - 1 };
}

export function hitscanCandidateMetrics(origin, direction, candidate, weapon) {
  if (!origin || !candidate || !weapon || weapon.attackType !== WEAPON_TYPES.HITSCAN) {
    return { valid: false, along: Infinity, perpendicular: Infinity, aimAngle: Infinity };
  }

  const aim = normalizeVector(direction?.x || 0, direction?.y || 0, { x: 0, y: -1 });
  const dx = (Number(candidate.x) || 0) - (Number(origin.x) || 0);
  const dy = (Number(candidate.y) || 0) - (Number(origin.y) || 0);
  const along = dx * aim.x + dy * aim.y;
  const range = Math.max(0, Number(weapon.range) || 0);
  if (along < 0 || along > range) {
    return { valid: false, along, perpendicular: Infinity, aimAngle: Infinity };
  }

  const perpendicular = Math.abs(dx * aim.y - dy * aim.x);
  const allowance = Math.max(0, Number(candidate.hitRadius) || 0) + Math.max(0, Number(weapon.hitWidth) || 0);
  if (perpendicular > allowance) {
    return { valid: false, along, perpendicular, aimAngle: Infinity };
  }

  const toward = normalizeVector(dx, dy, aim);
  const aimAngle = angleBetween(aim, toward);
  return { valid: true, along, perpendicular, aimAngle, forwardDot: dot(aim, toward) };
}

export function selectHitscanTarget(origin, direction, candidates = [], weapon, { lineClear = () => true } = {}) {
  return candidates
    .map(candidate => ({ candidate, metrics: hitscanCandidateMetrics(origin, direction, candidate, weapon) }))
    .filter(item => item.metrics.valid && lineClear(item.candidate))
    .sort((a, b) => {
      const along = a.metrics.along - b.metrics.along;
      if (Math.abs(along) > 1e-9) return along;
      const perpendicular = a.metrics.perpendicular - b.metrics.perpendicular;
      if (Math.abs(perpendicular) > 1e-9) return perpendicular;
      return String(a.candidate.id || "").localeCompare(String(b.candidate.id || ""));
    })[0] || null;
}
