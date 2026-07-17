import test from "node:test";
import assert from "node:assert/strict";
import {
  COMBAT_STATES,
  UNARMED_ATTACK,
  applyNpcDamage,
  createNpcCombatState,
  targetInsideMeleeArc,
  worldAimDirection
} from "../phaser/src/data/combat.js";
import { NPC_TYPES } from "../phaser/src/data/npcs.js";

test("mouse aim keeps the previous direction inside the dead zone", () => {
  const direction = worldAimDirection(
    { x: 100, y: 100 },
    { x: 103, y: 104 },
    { x: 1, y: 0 },
    10
  );
  assert.deepEqual(direction, { x: 1, y: 0 });
});

test("mouse aim normalizes a distant pointer direction", () => {
  const direction = worldAimDirection(
    { x: 10, y: 10 },
    { x: 10, y: -40 },
    { x: 1, y: 0 },
    10
  );
  assert.deepEqual(direction, { x: 0, y: -1 });
});

test("unarmed arc hits targets in front and rejects targets behind", () => {
  const origin = { x: 0, y: 0 };
  const direction = { x: 1, y: 0 };
  assert.equal(targetInsideMeleeArc(origin, direction, { x: 24, y: 4 }, UNARMED_ATTACK), true);
  assert.equal(targetInsideMeleeArc(origin, direction, { x: -18, y: 0 }, UNARMED_ATTACK), false);
  assert.equal(targetInsideMeleeArc(origin, direction, { x: 60, y: 0 }, UNARMED_ATTACK), false);
});

test("civilian is downed after three one-point hits", () => {
  const combat = createNpcCombatState(NPC_TYPES.CIVILIAN);
  assert.equal(combat.maxResilience, 3);
  applyNpcDamage(combat, 1);
  assert.equal(combat.state, COMBAT_STATES.STAGGERED);
  applyNpcDamage(combat, 1);
  applyNpcDamage(combat, 1);
  assert.equal(combat.resilience, 0);
  assert.equal(combat.state, COMBAT_STATES.DOWNED);
});

test("police requires four hits and downed state ignores further damage", () => {
  const combat = createNpcCombatState(NPC_TYPES.POLICE);
  for (let index = 0; index < 3; index++) applyNpcDamage(combat, 1);
  assert.equal(combat.resilience, 1);
  assert.notEqual(combat.state, COMBAT_STATES.DOWNED);
  applyNpcDamage(combat, 1);
  assert.equal(combat.state, COMBAT_STATES.DOWNED);
  applyNpcDamage(combat, 1);
  assert.equal(combat.resilience, 0);
});

test("hunter resilience is data-driven", () => {
  const combat = createNpcCombatState(NPC_TYPES.HUNTER);
  assert.equal(combat.maxResilience, 5);
  assert.equal(combat.resilience, 5);
});
