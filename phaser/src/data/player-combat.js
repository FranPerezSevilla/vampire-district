import { NPC_TYPES } from "./npcs.js";
import { pointInsideCone } from "../utils/geometry.js";

export const PLAYER_DAMAGE = Object.freeze({
  maxVitality: 100,
  passiveRecoveryPerSecond: 4,
  recoveryDelayMs: 3500,
  starvingFirearmMultiplier: 1.5,
  criticalVitalityThreshold: 25,
  invulnerabilityMs: 720,
  hitStunMs: 260,
  feedbackMs: 620,
  // Hunger thresholds remain part of Beast pressure, but no longer represent health.
  criticalThreshold: 85,
  frenzyThreshold: 100
});

export const POLICE_FIREARM = Object.freeze({
  id: "police_pistol",
  label: "police gunshot",
  damageKind: "firearm",
  vitalityDamage: 18,
  minRange: 54,
  range: 300,
  aimMs: 430,
  wantedThreeAimMs: 320,
  shotGapMs: 170,
  burstSize: 2,
  burstCooldownMs: 1280,
  magazineSize: 6,
  reloadMs: 2100,
  postReloadPauseMs: 260,
  blockedRetryMs: 280,
  projectileSpeed: 920,
  playerHitRadius: 9,
  friendlyRadius: 9,
  friendlyClearance: 6,
  worldClearance: 3,
  muzzleOffset: 9,
  muzzleFlashMs: 90,
  impactSeconds: 0.14,
  vehicleDamage: 5,
  playerLeadSeconds: 0.12,
  vehicleLeadSeconds: 0.22,
  color: 0xffd27a
});

export const ENEMY_MELEE_BY_TYPE = Object.freeze({
  [NPC_TYPES.POLICE]: Object.freeze({
    id: "police_baton",
    label: "police baton strike",
    damageKind: "melee",
    vitalityDamage: 12,
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
    damageKind: "melee",
    vitalityDamage: 20,
    startRange: 34,
    range: 29,
    halfAngle: 0.96,
    windupMs: 430,
    activeMs: 150,
    recoveryMs: 880,
    cooldownMs: 420,
    color: 0xff9d35
  }),
  [NPC_TYPES.THUG]: Object.freeze({
    id: "thug_hook",
    label: "rooftop thug swing",
    damageKind: "melee",
    vitalityDamage: 8,
    startRange: 28,
    range: 24,
    halfAngle: 0.88,
    windupMs: 520,
    activeMs: 150,
    recoveryMs: 900,
    cooldownMs: 650,
    color: 0xb36b42
  })
});

function clampHunger(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function clampVitality(value, maximum = PLAYER_DAMAGE.maxVitality) {
  const max = Math.max(1, Number(maximum) || PLAYER_DAMAGE.maxVitality);
  return Math.max(0, Math.min(max, Number(value) || 0));
}

export function enemyMeleeForType(type) {
  return ENEMY_MELEE_BY_TYPE[type] || null;
}

export function createPlayerDamageState({ vitality = PLAYER_DAMAGE.maxVitality } = {}) {
  const maxVitality = PLAYER_DAMAGE.maxVitality;
  return {
    vitality: clampVitality(vitality, maxVitality),
    maxVitality,
    hitStunUntil: 0,
    invulnerableUntil: 0,
    feedbackUntil: 0,
    lastDamageAt: Number.NEGATIVE_INFINITY,
    lastDamage: 0,
    lastSourceId: null,
    lastLabel: "",
    lastDamageKind: null,
    critical: false,
    dead: false,
    deathSourceId: null,
    deathLabel: ""
  };
}

export function playerIsHitStunned(state, now) {
  return Boolean(state && !state.dead && now < (state.hitStunUntil || 0));
}

export function playerIsInvulnerable(state, now) {
  return Boolean(state && !state.dead && now < (state.invulnerableUntil || 0));
}

export function vitalityDamageMultiplier(currentHunger, damageKind = "melee", {
  starvingFirearmMultiplier = PLAYER_DAMAGE.starvingFirearmMultiplier
} = {}) {
  return damageKind === "firearm" && clampHunger(currentHunger) >= 100
    ? Math.max(1, Number(starvingFirearmMultiplier) || 1)
    : 1;
}

export function applyPlayerDamageState(
  state,
  currentHunger,
  amount,
  now,
  {
    sourceId = null,
    label = "enemy attack",
    damageKind = "melee",
    invulnerabilityMs = PLAYER_DAMAGE.invulnerabilityMs,
    hitStunMs = PLAYER_DAMAGE.hitStunMs,
    feedbackMs = PLAYER_DAMAGE.feedbackMs,
    criticalVitalityThreshold = PLAYER_DAMAGE.criticalVitalityThreshold,
    starvingFirearmMultiplier = PLAYER_DAMAGE.starvingFirearmMultiplier
  } = {}
) {
  const maxVitality = Math.max(1, Number(state?.maxVitality) || PLAYER_DAMAGE.maxVitality);
  const before = clampVitality(state?.vitality ?? maxVitality, maxVitality);
  const hunger = clampHunger(currentHunger);
  if (!state || state.dead || !Number.isFinite(amount) || amount <= 0 || playerIsInvulnerable(state, now)) {
    return {
      applied: false,
      before,
      after: before,
      damage: 0,
      multiplier: 1,
      hunger,
      critical: Boolean(state?.critical),
      dead: Boolean(state?.dead)
    };
  }

  const multiplier = vitalityDamageMultiplier(hunger, damageKind, { starvingFirearmMultiplier });
  const requestedDamage = Math.max(0, Number(amount) || 0) * multiplier;
  const after = clampVitality(before - requestedDamage, maxVitality);
  const damage = before - after;

  state.vitality = after;
  state.hitStunUntil = now + hitStunMs;
  state.invulnerableUntil = now + invulnerabilityMs;
  state.feedbackUntil = now + feedbackMs;
  state.lastDamageAt = now;
  state.lastDamage = damage;
  state.lastSourceId = sourceId;
  state.lastLabel = label;
  state.lastDamageKind = damageKind;
  state.critical = after > 0 && after <= criticalVitalityThreshold;
  state.dead = after <= 0;
  if (state.dead) {
    state.deathSourceId = sourceId;
    state.deathLabel = label;
  }

  return {
    applied: true,
    before,
    after,
    damage,
    multiplier,
    hunger,
    critical: state.critical,
    dead: state.dead
  };
}

export function recoverPlayerVitalityState(
  state,
  currentHunger,
  dt,
  now,
  {
    recoveryPerSecond = PLAYER_DAMAGE.passiveRecoveryPerSecond,
    recoveryDelayMs = PLAYER_DAMAGE.recoveryDelayMs,
    criticalVitalityThreshold = PLAYER_DAMAGE.criticalVitalityThreshold
  } = {}
) {
  const maxVitality = Math.max(1, Number(state?.maxVitality) || PLAYER_DAMAGE.maxVitality);
  const before = clampVitality(state?.vitality ?? maxVitality, maxVitality);
  const hunger = clampHunger(currentHunger);
  const seconds = Math.max(0, Number(dt) || 0);
  const delayed = Number(now) < (Number(state?.lastDamageAt) || 0) + Math.max(0, Number(recoveryDelayMs) || 0);
  const blocked = !state
    || state.dead
    || hunger >= 100
    || seconds <= 0
    || before >= maxVitality
    || delayed;
  if (blocked) {
    return { applied: false, before, after: before, recovered: 0, hunger };
  }

  const recovered = Math.min(maxVitality - before, Math.max(0, Number(recoveryPerSecond) || 0) * seconds);
  const after = clampVitality(before + recovered, maxVitality);
  state.vitality = after;
  state.critical = after > 0 && after <= criticalVitalityThreshold;
  return { applied: recovered > 0, before, after, recovered, hunger };
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
