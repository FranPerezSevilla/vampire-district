import test from "node:test";
import assert from "node:assert/strict";
import {
  MOVEMENT_RULES,
  footstepHearingRadius,
  movementNoiseProfile,
  movementSpeed
} from "../phaser/src/data/movement.js";
import { NPC_TYPES } from "../phaser/src/data/npcs.js";
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

test("quiet footsteps have a much smaller base hearing radius", () => {
  const running = movementNoiseProfile(false);
  const quiet = movementNoiseProfile(true);
  assert.equal(running.mode, "run");
  assert.equal(quiet.mode, "quiet");
  assert.ok(running.hearingRadius > quiet.hearingRadius * 2);
});

test("ordinary NPCs only hear running inside the short footstep range", () => {
  const running = movementNoiseProfile(false);
  const quiet = movementNoiseProfile(true);

  assert.equal(
    footstepHearingRadius(running, NPC_TYPES.CIVILIAN),
    MOVEMENT_RULES.normalRunHearingRadius
  );
  assert.equal(
    footstepHearingRadius(running, NPC_TYPES.TARGET),
    MOVEMENT_RULES.normalRunHearingRadius
  );
  assert.equal(footstepHearingRadius(quiet, NPC_TYPES.CIVILIAN), 0);
  assert.equal(footstepHearingRadius(quiet, NPC_TYPES.TARGET), 0);
});

test("police and hunters retain enhanced hearing for run and quiet movement", () => {
  const running = movementNoiseProfile(false);
  const quiet = movementNoiseProfile(true);

  assert.ok(footstepHearingRadius(running, NPC_TYPES.POLICE) > MOVEMENT_RULES.normalRunHearingRadius);
  assert.ok(footstepHearingRadius(running, NPC_TYPES.HUNTER) > footstepHearingRadius(running, NPC_TYPES.POLICE));
  assert.ok(footstepHearingRadius(quiet, NPC_TYPES.POLICE) > 0);
  assert.ok(footstepHearingRadius(quiet, NPC_TYPES.HUNTER) > 0);
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
