import test from "node:test";
import assert from "node:assert/strict";
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
    missionInformant: false,
    drainVictim: false,
    chasingPlayer: false,
    enemyAttack: null,
    soundReactionTimer: 0,
    combat: { state: COMBAT_STATES.ACTIVE },
    ...overrides
  };
}

function policeContext(npcs, overrides = {}) {
  return Object.assign(Object.create(PoliceSystem.prototype), {
    scene: {
      npcSystem: { npcs },
      player: { x: 0, y: 0 },
      currentLayer: 0
    },
    lastKnownPlayer: null,
    localHeat: Object.create(null),
    ...overrides
  });
}

test("downed, draining and informant officers do not count as active response units", () => {
  const active = cop("active");
  const downed = cop("downed", { combat: { state: COMBAT_STATES.DOWNED } });
  const draining = cop("draining", { drainVictim: true });
  const informant = cop("informant", { missionInformant: true });
  const context = policeContext([active, downed, draining, informant]);

  assert.deepEqual(context.police().map(item => item.id), ["active"]);
});

test("confirmed sight clears heard-only investigation before chase selection", () => {
  const officer = cop("visual", {
    soundReactionTimer: 1.2,
    ai: { intent: "investigate" },
    __nbdWtfLabel: { hidden: false, setVisible(value) { this.hidden = value === false; } }
  });
  const calls = [];
  const context = policeContext([officer], {
    playerVisibleToCop(_cop, sight, shadowSight) {
      calls.push({ sight, shadowSight });
      return true;
    },
    rememberPlayerPosition() {},
    searchPointForCop() { return null; },
    nextPatrolPoint() { return { x: 20, y: 20, kind: "patrol" }; }
  });

  const target = context.targetForCop(officer, 2, {
    sight: 238,
    shadowSight: 100,
    chaseSpeed: 1,
    searchSpeed: 1
  });

  assert.equal(target.kind, "player");
  assert.equal(officer.soundReactionTimer, 0);
  assert.equal(officer.chasingPlayer, true);
  assert.equal(officer.ai.intent, "visual-contact");
  assert.equal(officer.__nbdWtfLabel.hidden, true);
  assert.deepEqual(calls, [
    { sight: 238, shadowSight: 100 },
    { sight: 238, shadowSight: 100 }
  ]);
});

test("heard-only police remain paused when the player is not visually confirmed", () => {
  const officer = cop("heard", {
    soundReactionTimer: 0.8,
    ai: { intent: "investigate" }
  });
  const context = policeContext([officer], {
    playerVisibleToCop() { return false; },
    rememberPlayerPosition() { throw new Error("must not chase"); }
  });

  assert.equal(context.targetForCop(officer, 1, { sight: 190, shadowSight: 58 }), null);
  assert.equal(officer.soundReactionTimer, 0.8);
  assert.equal(officer.chasingPlayer, false);
  assert.equal(officer.ai.intent, "investigate");
});
