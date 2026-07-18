import { NPC_TYPES } from "./npcs.js";
import { pointInsideCone } from "../utils/geometry.js";

export const PLAYER_DAMAGE = Object.freeze({
  invulnerabilityMs: 720,
  hitStunMs: 260,
  feedbackMs: 620,
  criticalThreshold: 85,
  frenzyThreshold: 100
});

export const ENEMY_MELEE_BY_TYPE = Object.freeze({
  [NPC_TYPES.POLICE]: Object.freeze({
    id: "police_baton",
    label: "police baton strike",
    hungerDamage: 12,
    startRange: 29,
    range: 25,
    halfAngle: 0.90,
    windupMs: 300,
    activeMs: 120,
    recoveryMs: 620,
    cooldownMs: 260,
    color: 0x4da3ff
  }),
  [NPC_TYPES.HUNTER]: Object.freeze({
    id: "hunter_heavy_strike",
    label: "hunter heavy strike",
    hungerDamage: 20,
    startRange: 34,
    range: 29,
    halfAngle: 0.96,
    windupMs: 430,
    activeMs: 150,
    recoveryMs: 880,
    cooldownMs: 420,
    color: 0xff9d35
  })
});

export function enemyMeleeForType(type) {
  return ENEMY_MELEE_BY_TYPE[type] || null;
}

export function createPlayerDamageState() {
  return {
    hitStunUntil: 0,
    invulnerableUntil: 0,
    feedbackUntil: 0,
    lastDamage: 0,
    lastSourceId: null,
    lastLabel: "",
    critical: false
  };
}

export function playerIsHitStunned(state, now) {
  return Boolean(state && now < (state.hitStunUntil || 0));
}

export function playerIsInvulnerable(state, now) {
  return Boolean(state && now < (state.invulnerableUntil || 0));
}

export function applyPlayerDamageState(
  state,
  currentHunger,
  amount,
  now,
  {
    sourceId = null,
    label = "enemy attack",
    invulnerabilityMs = PLAYER_DAMAGE.invulnerabilityMs,
    hitStunMs = PLAYER_DAMAGE.hitStunMs,
    feedbackMs = PLAYER_DAMAGE.feedbackMs,
    criticalThreshold = PLAYER_DAMAGE.criticalThreshold,
    frenzyThreshold = PLAYER_DAMAGE.frenzyThreshold
  } = {}
) {
  if (!state || !Number.isFinite(amount) || amount <= 0 || playerIsInvulnerable(state, now)) {
    return {
      applied: false,
      before: Math.max(0, Math.min(100, Number(currentHunger) || 0)),
      after: Math.max(0, Math.min(100, Number(currentHunger) || 0)),
      gained: 0,
      critical: Boolean(state?.critical),
      frenzy: false
    };
  }

  const before = Math.max(0, Math.min(100, Number(currentHunger) || 0));
  const after = Math.max(0, Math.min(100, before + amount));
  const gained = after - before;

  state.hitStunUntil = now + hitStunMs;
  state.invulnerableUntil = now + invulnerabilityMs;
  state.feedbackUntil = now + feedbackMs;
  state.lastDamage = gained;
  state.lastSourceId = sourceId;
  state.lastLabel = label;
  state.critical = after >= criticalThreshold;

  return {
    applied: true,
    before,
    after,
    gained,
    critical: state.critical,
    frenzy: after >= frenzyThreshold
  };
}

export function enemyAttackPhase(elapsedMs, config) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  if (!config) return "complete";
  if (elapsed < config.windupMs) return "windup";
  if (elapsed < config.windupMs + config.activeMs) return "active";
  if (elapsed < config.windupMs + config.activeMs + config.recoveryMs) return "recovery";
  return "complete";
}

export function enemyMeleeHits(attacker, direction, player, config) {
  if (!attacker || !player || !config) return false;
  return pointInsideCone(attacker, direction, player, config.range, config.halfAngle);
}
