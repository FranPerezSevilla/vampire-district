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

test("full control mode preserves world actions", () => {
  const frame = applyControlMode(activeFrame(), CONTROL_MODES.FULL, true);
  assert.deepEqual(frame.move, { x: 1, y: 0 });
  assert.equal(frame.traversePressed, true);
  assert.equal(frame.interactPressed, true);
  assert.equal(frame.dashPressed, true);
  assert.equal(frame.weaponStep, 1);
});

test("movement mode exposes movement and traversal only", () => {
  const frame = applyControlMode(activeFrame(), CONTROL_MODES.MOVEMENT, true);
  assert.deepEqual(frame.move, { x: 1, y: 0 });
  assert.equal(frame.sprintHeld, true);
  assert.equal(frame.traversePressed, true);
  assert.equal(frame.interactPressed, false);
  assert.equal(frame.primaryPressed, false);
  assert.equal(frame.dashPressed, false);
});

test("drain tutorial mode keeps E interaction but blocks powers", () => {
  const frame = applyControlMode(activeFrame(), CONTROL_MODES.DRAIN, true);
  assert.equal(frame.interactPressed, true);
  assert.equal(frame.traversePressed, true);
  assert.equal(frame.whisperPressed, false);
  assert.equal(frame.bloodSensePressed, false);
});

test("world lock clears world actions without clearing menu input", () => {
  const frame = applyControlMode(activeFrame(), CONTROL_MODES.FULL, false);
  assert.deepEqual(frame.move, { x: 0, y: 0 });
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
