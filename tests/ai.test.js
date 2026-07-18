import test from "node:test";
import assert from "node:assert/strict";
import {
  AI_ROLES,
  AI_RULES,
  AI_STATES,
  createNpcAiState,
  policeContainmentTarget,
  predictPursuitPoint,
  recoveryAtForType,
  recoveryResilienceForType,
  resolveNpcAiState,
  selectPoliceAttackLeader,
  shouldRecoverDowned
} from "../phaser/src/data/ai.js";
import { COMBAT_STATES } from "../phaser/src/data/combat.js";
import { NPC_TYPES } from "../phaser/src/data/npcs.js";
import { enemyMeleeForType } from "../phaser/src/data/player-combat.js";

function npc(overrides = {}) {
  const value = {
    id: "npc",
    type: NPC_TYPES.CIVILIAN,
    x: 0,
    y: 0,
    dead: false,
    inactive: false,
    intercepted: false,
    hiddenBody: false,
    stunnedTimer: 0,
    combat: { state: COMBAT_STATES.ACTIVE, maxResilience: 3, resilience: 3 },
    ...overrides
  };
  value.ai ||= createNpcAiState(value, 0);
  return value;
}

test("downed and drain states override attack chase report and sound flags", () => {
  const downed = npc({
    type: NPC_TYPES.POLICE,
    chasingPlayer: true,
    enemyAttack: { phase: "windup" },
    alarmed: true,
    reportTarget: { x: 10, y: 10 },
    soundReactionTimer: 2,
    combat: { state: COMBAT_STATES.DOWNED, maxResilience: 4, resilience: 0 }
  });
  assert.equal(resolveNpcAiState(downed, { wantedLevel: 3 }), AI_STATES.DOWNED);

  const feeding = npc({
    drainVictim: true,
    stunnedTimer: 0.5,
    enemyAttack: { phase: "windup" }
  });
  assert.equal(resolveNpcAiState(feeding), AI_STATES.DRAINING);
});

test("attack and chase override heard-only investigation", () => {
  const attacking = npc({
    type: NPC_TYPES.POLICE,
    chasingPlayer: true,
    soundReactionTimer: 2,
    enemyAttack: { phase: "active" }
  });
  assert.equal(resolveNpcAiState(attacking, { wantedLevel: 2 }), AI_STATES.ATTACKING);

  const chasing = npc({ type: NPC_TYPES.POLICE, chasingPlayer: true, soundReactionTimer: 2 });
  assert.equal(resolveNpcAiState(chasing, { wantedLevel: 2 }), AI_STATES.CHASING);
});

test("visual witness reporting overrides WTF while sound alone remains investigation", () => {
  const fleeing = npc({
    alarmed: true,
    reportTarget: { x: 100, y: 100 },
    soundReactionTimer: 2
  });
  assert.equal(resolveNpcAiState(fleeing), AI_STATES.FLEEING);

  const heardOnly = npc({ soundReactionTimer: 2 });
  assert.equal(resolveNpcAiState(heardOnly), AI_STATES.INVESTIGATING);
});

test("only police and hunters receive scheduled downed recovery", () => {
  assert.equal(recoveryAtForType(NPC_TYPES.POLICE, 1_000), 1_000 + AI_RULES.policeRecoveryMs);
  assert.equal(recoveryAtForType(NPC_TYPES.HUNTER, 1_000), 1_000 + AI_RULES.hunterRecoveryMs);
  assert.equal(recoveryAtForType(NPC_TYPES.CIVILIAN, 1_000), Number.POSITIVE_INFINITY);
  assert.equal(recoveryAtForType(NPC_TYPES.TARGET, 1_000), Number.POSITIVE_INFINITY);
  assert.equal(recoveryAtForType(NPC_TYPES.THUG, 1_000), Number.POSITIVE_INFINITY);
  assert.equal(recoveryResilienceForType(NPC_TYPES.POLICE, 4), 2);
  assert.equal(recoveryResilienceForType(NPC_TYPES.HUNTER, 5), 3);

  const cop = npc({
    type: NPC_TYPES.POLICE,
    combat: { state: COMBAT_STATES.DOWNED, maxResilience: 4, resilience: 0 }
  });
  cop.ai.recoverAt = 2_000;
  assert.equal(shouldRecoverDowned(cop, 1_999), false);
  assert.equal(shouldRecoverDowned(cop, 2_000), true);
  cop.drainVictim = true;
  assert.equal(shouldRecoverDowned(cop, 3_000), false);
});

test("police attack leadership is stable then hands off to the nearest ready officer", () => {
  const player = { x: 0, y: 0 };
  const previous = npc({ id: "cop-b", type: NPC_TYPES.POLICE, x: 30, y: 0 });
  const nearer = npc({ id: "cop-a", type: NPC_TYPES.POLICE, x: 18, y: 0 });
  previous.ai.role = AI_ROLES.ATTACKER;
  previous.ai.leaderUntil = 2_000;

  assert.equal(
    selectPoliceAttackLeader([nearer, previous], player, { previousId: previous.id, now: 1_500 }),
    previous.id
  );
  assert.equal(
    selectPoliceAttackLeader([previous, nearer], player, { previousId: previous.id, now: 2_100 }),
    nearer.id
  );
});

test("containment slots are deterministic separated points around the player", () => {
  const player = { x: 100, y: 100 };
  const first = policeContainmentTarget(player, 0, 3, 2, { rotation: 0 });
  const second = policeContainmentTarget(player, 1, 3, 2, { rotation: 0 });
  const repeated = policeContainmentTarget(player, 0, 3, 2, { rotation: 0 });

  assert.deepEqual(first, repeated);
  assert.notDeepEqual({ x: first.x, y: first.y }, { x: second.x, y: second.y });
  assert.equal(Math.round(Math.hypot(first.x - player.x, first.y - player.y)), 49);
});

test("hunter pursuit prediction leads movement and respects world bounds", () => {
  assert.deepEqual(
    predictPursuitPoint({ x: 100, y: 100 }, { x: 1, y: 0 }, { leadDistance: 50 }),
    { x: 150, y: 100 }
  );
  assert.deepEqual(
    predictPursuitPoint(
      { x: 940, y: 630 },
      { x: 1, y: 1 },
      { leadDistance: 80, bounds: { minX: 8, minY: 8, maxX: 952, maxY: 632 } }
    ),
    { x: 952, y: 632 }
  );
});

test("the rooftop thug has a slow readable low-damage retaliation", () => {
  const thug = enemyMeleeForType(NPC_TYPES.THUG);
  const police = enemyMeleeForType(NPC_TYPES.POLICE);
  assert.ok(thug);
  assert.ok(thug.windupMs > police.windupMs);
  assert.ok(thug.recoveryMs > police.recoveryMs);
  assert.ok(thug.hungerDamage < police.hungerDamage);
});
