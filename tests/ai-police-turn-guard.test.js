import test from "node:test";
import assert from "node:assert/strict";
import { AI_ROLES } from "../phaser/src/data/ai.js";
import { COMBAT_STATES } from "../phaser/src/data/combat.js";

const { PoliceSystem } = await import("../phaser/src/systems/PoliceSystem.js");

PoliceSystem.prototype.police = function basePoliceList() {
  return this._allPolice;
};
PoliceSystem.prototype.updatePolice = function simulatedMilestoneEightFormation() {
  const leader = this._allPolice.find(cop => cop.id === this.attackLeaderId);
  if (leader?.ai) leader.ai.leaderUntil = 9_999;
};

await import("../phaser/src/ai/police-turn-guard.js");

function cop(id, overrides = {}) {
  return {
    id,
    x: 10,
    y: 0,
    dead: false,
    inactive: false,
    drainVictim: false,
    chasingPlayer: false,
    enemyAttack: null,
    combat: { state: COMBAT_STATES.ACTIVE },
    ai: { role: AI_ROLES.PATROL, leaderUntil: 0 },
    ...overrides
  };
}

function policeContext(properties) {
  return Object.assign(Object.create(PoliceSystem.prototype), properties);
}

test("downed and drain victims do not count as active police response units", () => {
  const active = cop("active");
  const downed = cop("downed", { combat: { state: COMBAT_STATES.DOWNED } });
  const draining = cop("draining", { drainVictim: true });
  const context = policeContext({ _allPolice: [active, downed, draining] });

  assert.deepEqual(
    context.police().map(item => item.id),
    ["active"]
  );
});

test("an active attack-leader deadline is not extended every frame", () => {
  const leader = cop("leader", { ai: { role: AI_ROLES.ATTACKER, leaderUntil: 1_500 } });
  const context = policeContext({
    attackLeaderId: leader.id,
    _allPolice: [leader],
    scene: {
      time: { now: 1_000 },
      player: { x: 0, y: 0 },
      npcSystem: { npcs: [leader] }
    }
  });

  context.updatePolice(0.016, 1);

  assert.equal(leader.ai.leaderUntil, 1_500);
});

test("containment officers face the player after moving into their slot", () => {
  const containment = cop("containment", {
    x: 12,
    y: 0,
    chasingPlayer: true,
    dirX: 1,
    dirY: 0,
    ai: { role: AI_ROLES.CONTAIN, leaderUntil: 0 }
  });
  const context = policeContext({
    attackLeaderId: null,
    _allPolice: [containment],
    scene: {
      time: { now: 1_000 },
      player: { x: 0, y: 0 },
      npcSystem: { npcs: [containment] }
    }
  });

  context.updatePolice(0.016, 1);

  assert.equal(containment.dirX, -1);
  assert.equal(containment.dirY, 0);
});
