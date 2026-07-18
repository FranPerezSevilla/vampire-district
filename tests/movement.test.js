import test from "node:test";
import assert from "node:assert/strict";
import { MOVEMENT_RULES, movementNoiseProfile, movementSpeed } from "../phaser/src/data/movement.js";
import { evaluateTraversalCandidate, selectTraversalCandidate } from "../phaser/src/data/traversal.js";

const player = { x: 0, y: 0 };
const aimRight = { x: 1, y: 0 };

test("default movement is faster than quiet Shift movement", () => {
  const running = movementSpeed(100, false);
  const quiet = movementSpeed(100, true);
  assert.equal(running, 100 * MOVEMENT_RULES.runMultiplier);
  assert.equal(quiet, 100 * MOVEMENT_RULES.quietMultiplier);
  assert.ok(running > quiet);
});

test("quiet footsteps have a much smaller hearing radius", () => {
  const running = movementNoiseProfile(false);
  const quiet = movementNoiseProfile(true);
  assert.equal(running.mode, "run");
  assert.equal(quiet.mode, "quiet");
  assert.ok(running.hearingRadius > quiet.hearingRadius * 2);
});

test("an aligned traversal point already under the player wins first", () => {
  const committed = { id: "committed", type: "roofJump", x: 10, y: 0, priority: 45 };
  const nearerButBehind = { id: "behind", type: "sewerDown", x: -6, y: 0, priority: 35 };
  const selected = selectTraversalCandidate(player, aimRight, [nearerButBehind, committed]);
  assert.equal(selected.id, "committed");
  assert.equal(evaluateTraversalCandidate(player, aimRight, committed).committed, true);
});

test("distance decides when no candidate is both close and aligned", () => {
  const near = { id: "near", type: "fireEscapeUp", x: 15, y: 10, priority: 40 };
  const far = { id: "far", type: "roofJump", x: 24, y: 0, priority: 45 };
  const selected = selectTraversalCandidate(player, aimRight, [far, near]);
  assert.equal(selected.id, "near");
});

test("aim and stable id break otherwise equivalent traversal ties", () => {
  const upper = { id: "a_upper", type: "roofJump", x: 18, y: -6, priority: 45 };
  const lower = { id: "b_lower", type: "roofJump", x: 18, y: 6, priority: 45 };
  const selected = selectTraversalCandidate(player, { x: 1, y: -0.25 }, [lower, upper]);
  assert.equal(selected.id, "a_upper");

  const first = { id: "a", type: "roofJump", x: 20, y: 0, priority: 45 };
  const second = { id: "b", type: "roofJump", x: 20, y: 0, priority: 45 };
  assert.equal(selectTraversalCandidate(player, aimRight, [second, first]).id, "a");
});
