import test from "node:test";
import assert from "node:assert/strict";
import {
  PLAYER_DAMAGE,
  applyPlayerDamageState,
  createPlayerDamageState,
  enemyAttackPhase,
  enemyMeleeForType,
  enemyMeleeHits,
  playerIsHitStunned,
  playerIsInvulnerable
} from "../phaser/src/data/player-combat.js";
import { NPC_TYPES } from "../phaser/src/data/npcs.js";

test("police damage raises Hunger and creates hit-stun plus invulnerability", () => {
  const state = createPlayerDamageState();
  const police = enemyMeleeForType(NPC_TYPES.POLICE);
  const result = applyPlayerDamageState(state, 48, police.hungerDamage, 1000, {
    sourceId: "cop",
    label: police.label
  });

  assert.equal(result.applied, true);
  assert.equal(result.after, 60);
  assert.equal(result.gained, 12);
  assert.equal(playerIsHitStunned(state, 1000 + PLAYER_DAMAGE.hitStunMs - 1), true);
  assert.equal(playerIsInvulnerable(state, 1000 + PLAYER_DAMAGE.invulnerabilityMs - 1), true);
});

test("invulnerability prevents overlapping attacks from stacking Hunger", () => {
  const state = createPlayerDamageState();
  const first = applyPlayerDamageState(state, 50, 12, 2000);
  const overlapping = applyPlayerDamageState(state, first.after, 20, 2200);
  const later = applyPlayerDamageState(state, first.after, 20, 2000 + PLAYER_DAMAGE.invulnerabilityMs);

  assert.equal(first.after, 62);
  assert.equal(overlapping.applied, false);
  assert.equal(overlapping.after, 62);
  assert.equal(later.applied, true);
  assert.equal(later.after, 82);
});

test("critical and frenzy thresholds are derived from capped Hunger", () => {
  const criticalState = createPlayerDamageState();
  const critical = applyPlayerDamageState(criticalState, 78, 12, 0);
  assert.equal(critical.after, 90);
  assert.equal(critical.critical, true);
  assert.equal(critical.frenzy, false);

  const frenzyState = createPlayerDamageState();
  const frenzy = applyPlayerDamageState(frenzyState, 92, 20, 0);
  assert.equal(frenzy.after, 100);
  assert.equal(frenzy.gained, 8);
  assert.equal(frenzy.frenzy, true);
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
  assert.ok(hunter.hungerDamage > police.hungerDamage);
  assert.ok(hunter.windupMs > police.windupMs);
  assert.ok(hunter.recoveryMs > police.recoveryMs);
});
