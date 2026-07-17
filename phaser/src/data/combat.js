import { NPC_TYPES } from "./npcs.js";
import { normalizeVector, pointInsideCone } from "../utils/geometry.js";

export const COMBAT_STATES = Object.freeze({
  ACTIVE: "active",
  STAGGERED: "staggered",
  DOWNED: "downed",
  DEAD: "dead",
  DRAINED: "drained"
});

export const UNARMED_ATTACK = Object.freeze({
  id: "unarmed",
  damage: 1,
  range: 32,
  halfAngle: 0.62,
  aimDeadZone: 10,
  windupMs: 90,
  activeMs: 110,
  recoveryMs: 240,
  staggerMs: 320,
  feedbackMs: 950,
  soundRadius: 72
});

export const RESILIENCE_BY_TYPE = Object.freeze({
  [NPC_TYPES.CIVILIAN]: 3,
  [NPC_TYPES.TARGET]: 3,
  [NPC_TYPES.POLICE]: 4,
  [NPC_TYPES.THUG]: 4,
  [NPC_TYPES.HUNTER]: 5
});

export function maxResilienceForType(type) {
  return RESILIENCE_BY_TYPE[type] || 0;
}

export function createNpcCombatState(type) {
  const maxResilience = maxResilienceForType(type);
  if (!maxResilience) return null;
  return {
    maxResilience,
    resilience: maxResilience,
    state: COMBAT_STATES.ACTIVE,
    staggerUntil: 0,
    feedbackUntil: 0,
    lastHitBy: null
  };
}

export function worldAimDirection(player, aimWorld, previous = { x: 0, y: -1 }, deadZone = UNARMED_ATTACK.aimDeadZone) {
  const dx = (aimWorld?.x ?? 0) - (player?.x ?? 0);
  const dy = (aimWorld?.y ?? 0) - (player?.y ?? 0);
  const distance = Math.hypot(dx, dy);
  if (distance < deadZone) {
    const fallback = normalizeVector(previous?.x ?? 0, previous?.y ?? -1, { x: 0, y: -1 });
    return { x: fallback.x, y: fallback.y };
  }
  const direction = normalizeVector(dx, dy, previous);
  return { x: direction.x, y: direction.y };
}

export function targetInsideMeleeArc(origin, direction, target, attack = UNARMED_ATTACK) {
  return pointInsideCone(origin, direction, target, attack.range, attack.halfAngle);
}

export function applyNpcDamage(combat, amount = 1) {
  if (!combat || amount <= 0) return combat;
  if ([COMBAT_STATES.DOWNED, COMBAT_STATES.DEAD, COMBAT_STATES.DRAINED].includes(combat.state)) return combat;

  combat.resilience = Math.max(0, combat.resilience - amount);
  combat.state = combat.resilience <= 0 ? COMBAT_STATES.DOWNED : COMBAT_STATES.STAGGERED;
  return combat;
}
