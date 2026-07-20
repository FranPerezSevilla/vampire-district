import test from "node:test";
import assert from "node:assert/strict";
import { AI_ROLES } from "../phaser/src/data/ai.js";
import { COMBAT_STATES } from "../phaser/src/data/combat.js";
import { NPC_TYPES } from "../phaser/src/data/npcs.js";
import { PoliceSystem } from "../phaser/src/systems/PoliceSystem.js";

function cop(id, overrides = {}) {
  return {
    id,
    type: NPC_TYPES.POLICE,
    x: 10,
    y: 0,
    dead: false,
    inactive: false,
    hiddenBody: false,
    intercepted: false,
    drainVictim: false,
    chasingPlayer: false,
    enemyAttack: null,
    enemyAttackCooldownUntil: 0,
    soundReactionTimer: 0,
    stunnedTimer: 0,
    patrolPause: 0,
    combat: { state: COMBAT_STATES.ACTIVE },
    ai: { role: AI_ROLES.PATROL, intent: "patrol", leaderUntil: 0 },
    ...overrides
  };
}

function contextFor(cops, { now = 1_000, previousLeaderId = null } = {}) {
  const context = Object.create(PoliceSystem.prototype);
  context.attackLeaderId = previousLeaderId;
  context.scene = {
    time: { now },
    player: { x: 0, y: 0 },
    combatSystem: { aimDirection: { x: 1, y: 0 } },
    currentInputFrame: { move: { x: 0, y: 0 } },
    aiStateSystem: { ensureNpc() {} }
  };
  context.police = () => cops;
  context.targetForCop = () => ({ x: 0, y: 0, kind: "player" });
  context.movePoliceAttacker = () => {};
  context.moveNpcToward = npc => {
    // Simulate navigation leaving the officer facing away; containment must
    // explicitly restore visual contact after taking its slot.
    npc.dirX = 1;
    npc.dirY = 0;
  };
  return context;
}

function withPhaserDistance(run) {
  const previous = globalThis.Phaser;
  globalThis.Phaser = {
    Math: {
      Distance: {
        Between: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay)
      }
    }
  };
  try {
    return run();
  } finally {
    if (previous === undefined) delete globalThis.Phaser;
    else globalThis.Phaser = previous;
  }
}

test("an active police attack-leader deadline is not extended every frame", () => withPhaserDistance(() => {
  const leader = cop("leader", {
    ai: { role: AI_ROLES.ATTACKER, intent: "close-to-attack", leaderUntil: 1_500 }
  });
  const context = contextFor([leader], { previousLeaderId: leader.id, now: 1_000 });

  context.updatePolice(0.016, 1);

  assert.equal(context.attackLeaderId, leader.id);
  assert.equal(leader.ai.leaderUntil, 1_500);
  assert.equal(leader.ai.role, AI_ROLES.ATTACKER);
}));

test("containment officers face the player after moving into their slot", () => withPhaserDistance(() => {
  const leader = cop("leader", {
    x: 8,
    ai: { role: AI_ROLES.ATTACKER, intent: "close-to-attack", leaderUntil: 1_500 }
  });
  const containment = cop("containment", {
    x: 20,
    dirX: 1,
    dirY: 0
  });
  const context = contextFor([leader, containment], {
    previousLeaderId: leader.id,
    now: 1_000
  });

  context.updatePolice(0.016, 1);

  assert.equal(containment.ai.role, AI_ROLES.CONTAIN);
  assert.equal(containment.ai.intent, "contain");
  assert.equal(containment.dirX, -1);
  assert.equal(containment.dirY, 0);
}));
