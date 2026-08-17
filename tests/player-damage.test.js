import test from "node:test";
import assert from "node:assert/strict";
import {
  PLAYER_DAMAGE,
  POLICE_FIREARM,
  applyPlayerDamageState,
  createPlayerDamageState,
  enemyAttackPhase,
  enemyMeleeForType,
  enemyMeleeHits,
  playerIsHitStunned,
  playerIsInvulnerable,
  recoverPlayerVitalityState
} from "../phaser/src/data/player-combat.js";
import { NPC_TYPES } from "../phaser/src/data/npcs.js";

test("enemy damage reduces Vitality without turning Hunger into health", () => {
  const state = createPlayerDamageState();
  const police = enemyMeleeForType(NPC_TYPES.POLICE);
  const result = applyPlayerDamageState(state, 48, police.vitalityDamage, 1000, {
    sourceId: "cop",
    label: police.label,
    damageKind: police.damageKind
  });

  assert.equal(result.applied, true);
  assert.equal(result.hunger, 48);
  assert.equal(result.before, 100);
  assert.equal(result.after, 88);
  assert.equal(result.damage, 12);
  assert.equal(playerIsHitStunned(state, 1000 + PLAYER_DAMAGE.hitStunMs - 1), true);
  assert.equal(playerIsInvulnerable(state, 1000 + PLAYER_DAMAGE.invulnerabilityMs - 1), true);
});

test("invulnerability prevents overlapping attacks from stacking Vitality damage", () => {
  const state = createPlayerDamageState();
  const first = applyPlayerDamageState(state, 50, 12, 2000);
  const overlapping = applyPlayerDamageState(state, 50, 20, 2200);
  const later = applyPlayerDamageState(state, 50, 20, 2000 + PLAYER_DAMAGE.invulnerabilityMs);

  assert.equal(first.after, 88);
  assert.equal(overlapping.applied, false);
  assert.equal(overlapping.after, 88);
  assert.equal(later.applied, true);
  assert.equal(later.after, 68);
});

test("100 percent Hunger does not kill by itself but makes firearm damage more dangerous", () => {
  const state = createPlayerDamageState();
  const result = applyPlayerDamageState(state, 100, POLICE_FIREARM.vitalityDamage, 0, {
    damageKind: POLICE_FIREARM.damageKind
  });

  assert.equal(state.dead, false);
  assert.equal(result.hunger, 100);
  assert.equal(result.multiplier, PLAYER_DAMAGE.starvingFirearmMultiplier);
  assert.equal(result.damage, POLICE_FIREARM.vitalityDamage * PLAYER_DAMAGE.starvingFirearmMultiplier);
  assert.equal(result.after, 73);
});

test("passive Vitality recovery waits after damage and is disabled at maximum Hunger", () => {
  const state = createPlayerDamageState({ vitality: 60 });
  state.lastDamageAt = 1000;

  const tooSoon = recoverPlayerVitalityState(state, 40, 1, 1000 + PLAYER_DAMAGE.recoveryDelayMs - 1);
  assert.equal(tooSoon.applied, false);
  assert.equal(tooSoon.after, 60);

  const starving = recoverPlayerVitalityState(state, 100, 1, 1000 + PLAYER_DAMAGE.recoveryDelayMs);
  assert.equal(starving.applied, false);
  assert.equal(starving.after, 60);

  const recovered = recoverPlayerVitalityState(state, 99, 1, 1000 + PLAYER_DAMAGE.recoveryDelayMs);
  assert.equal(recovered.applied, true);
  assert.equal(recovered.recovered, PLAYER_DAMAGE.passiveRecoveryPerSecond);
  assert.equal(recovered.after, 60 + PLAYER_DAMAGE.passiveRecoveryPerSecond);
});

test("lethal Vitality damage creates one authoritative dead state", () => {
  const state = createPlayerDamageState({ vitality: 10 });
  const lethal = applyPlayerDamageState(state, 20, 12, 0, {
    sourceId: "cop",
    label: "police baton strike"
  });
  const afterDeath = applyPlayerDamageState(state, 20, 50, 1000);

  assert.equal(lethal.applied, true);
  assert.equal(lethal.after, 0);
  assert.equal(lethal.dead, true);
  assert.equal(state.dead, true);
  assert.equal(state.deathSourceId, "cop");
  assert.equal(afterDeath.applied, false);
  assert.equal(afterDeath.after, 0);
});

test("enemy attack phases follow windup, active, recovery and completion", () => {
  const config = enemyMeleeForType(NPC_TYPES.POLICE);
  assert.equal(enemyAttackPhase(0, config), "windup");
  assert.equal(enemyAttackPhase(config.windupMs, config), "active");
  assert.equal(enemyAttackPhase(config.windupMs + config.activeMs, config), "recovery");
  assert.equal(enemyAttackPhase(config.windupMs + config.activeMs + config.recoveryMs, config), "complete");
});

test("enemy melee validates both range and captured attack direction", () => {
  const config = enemyMeleeForType(NPC_TYPES.POLICE);
  const attacker = { x: 0, y: 0 };
  const direction = { x: 1, y: 0 };

  assert.equal(enemyMeleeHits(attacker, direction, { x: 20, y: 2 }, config), true);
  assert.equal(enemyMeleeHits(attacker, direction, { x: -15, y: 0 }, config), false);
  assert.equal(enemyMeleeHits(attacker, direction, { x: 40, y: 0 }, config), false);
});

test("hunter strikes are slower and more damaging than police strikes", () => {
  const police = enemyMeleeForType(NPC_TYPES.POLICE);
  const hunter = enemyMeleeForType(NPC_TYPES.HUNTER);
  assert.ok(hunter.vitalityDamage > police.vitalityDamage);
  assert.ok(hunter.windupMs > police.windupMs);
  assert.ok(hunter.recoveryMs > police.recoveryMs);
});

test("rooftop thug retaliation is slower and less damaging than police combat", () => {
  const police = enemyMeleeForType(NPC_TYPES.POLICE);
  const thug = enemyMeleeForType(NPC_TYPES.THUG);
  assert.ok(thug);
  assert.ok(thug.windupMs > police.windupMs);
  assert.ok(thug.recoveryMs > police.recoveryMs);
  assert.ok(thug.vitalityDamage < police.vitalityDamage);
});
