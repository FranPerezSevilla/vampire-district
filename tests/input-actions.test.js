import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTROL_MODES,
  applyControlMode,
  createEmptyInputFrame,
  wheelStepFromDelta
} from "../phaser/src/input/actions.js";

function activeFrame() {
  return createEmptyInputFrame({
    worldEnabled: true,
    move: { x: 1, y: 0 },
    hasMovementIntent: true,
    quietHeld: true,
    sprintHeld: true,
    primaryHeld: true,
    primaryPressed: true,
    drainHeld: true,
    drainPressed: true,
    traversePressed: true,
    interactPressed: true,
    weaponStep: 1,
    dashPressed: true,
    whisperPressed: true,
    bloodSensePressed: true,
    debugLayerPressed: 3,
    menuConfirmPressed: true
  });
}

test("full control mode preserves world actions but neutralizes obsolete sprint state", () => {
  const frame = applyControlMode(activeFrame(), CONTROL_MODES.FULL, true);
  assert.deepEqual(frame.move, { x: 1, y: 0 });
  assert.equal(frame.quietHeld, true);
  assert.equal(frame.sprintHeld, false);
  assert.equal(frame.traversePressed, true);
  assert.equal(frame.interactPressed, true);
  assert.equal(frame.dashPressed, true);
  assert.equal(frame.weaponStep, 1);
});

test("movement mode exposes movement, quiet modifier and traversal only", () => {
  const frame = applyControlMode(activeFrame(), CONTROL_MODES.MOVEMENT, true);
  assert.deepEqual(frame.move, { x: 1, y: 0 });
  assert.equal(frame.quietHeld, true);
  assert.equal(frame.sprintHeld, false);
  assert.equal(frame.traversePressed, true);
  assert.equal(frame.interactPressed, false);
  assert.equal(frame.primaryPressed, false);
  assert.equal(frame.dashPressed, false);
});

test("rooftop combat tutorial mode allows punching and right-click drain but blocks powers", () => {
  const frame = applyControlMode(activeFrame(), CONTROL_MODES.DRAIN, true);
  assert.equal(frame.primaryPressed, true);
  assert.equal(frame.primaryHeld, true);
  assert.equal(frame.drainPressed, true);
  assert.equal(frame.drainHeld, true);
  assert.equal(frame.interactPressed, true);
  assert.equal(frame.traversePressed, true);
  assert.equal(frame.whisperPressed, false);
  assert.equal(frame.bloodSensePressed, false);
});

test("world lock clears movement modifiers and world actions without clearing menu input", () => {
  const frame = applyControlMode(activeFrame(), CONTROL_MODES.FULL, false);
  assert.deepEqual(frame.move, { x: 0, y: 0 });
  assert.equal(frame.quietHeld, false);
  assert.equal(frame.traversePressed, false);
  assert.equal(frame.interactPressed, false);
  assert.equal(frame.menuConfirmPressed, true);
});

test("wheel deltas become discrete weapon steps", () => {
  assert.equal(wheelStepFromDelta(120), 1);
  assert.equal(wheelStepFromDelta(-80), -1);
  assert.equal(wheelStepFromDelta(0), 0);
  assert.equal(wheelStepFromDelta(Number.NaN), 0);
});
