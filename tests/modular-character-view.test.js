import test from "node:test";
import assert from "node:assert/strict";
import {
  modularCharacterFacingRotation,
  modularCharacterPose,
  modularCharacterSnappedRotation
} from "../phaser/src/rendering/ModularCharacterView.js";

const closeTo = (actual, expected, epsilon = 0.0001) => {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} should be close to ${expected}`);
};

const directionForRotation = rotation => ({
  x: Math.sin(rotation),
  y: -Math.cos(rotation)
});

test("modular character rotation keeps authored north as zero rotation", () => {
  closeTo(modularCharacterFacingRotation({ x: 0, y: -1 }), 0);
  closeTo(modularCharacterFacingRotation({ x: 1, y: 0 }), Math.PI / 2);
  closeTo(modularCharacterFacingRotation({ x: -1, y: 0 }), -Math.PI / 2);
});

test("visual facing snaps to eight directions", () => {
  closeTo(modularCharacterSnappedRotation(directionForRotation(Math.PI * 20 / 180)), 0);
  closeTo(modularCharacterSnappedRotation(directionForRotation(Math.PI * 32 / 180)), Math.PI / 4);
  closeTo(modularCharacterSnappedRotation(directionForRotation(Math.PI / 2)), Math.PI / 2);
});

test("facing hysteresis prevents jitter around an octant boundary", () => {
  const previous = 0;
  const insideHysteresis = directionForRotation(Math.PI * 29 / 180);
  const committedTurn = directionForRotation(Math.PI * 32 / 180);

  closeTo(modularCharacterSnappedRotation(insideHysteresis, previous), 0);
  closeTo(modularCharacterSnappedRotation(committedTurn, previous), Math.PI / 4);
});

test("movement and aim can resolve to independent octants", () => {
  const feet = modularCharacterSnappedRotation({ x: 0, y: -1 });
  const upper = modularCharacterSnappedRotation({ x: 1, y: 0 });
  closeTo(feet, 0);
  closeTo(upper, Math.PI / 2);
});

test("walk pose alternates hands and feet without moving the fixed core", () => {
  const pose = modularCharacterPose({ timeMs: 120, moving: true, phase: 0 });
  assert.notEqual(pose.feet.left.y, pose.feet.right.y);
  assert.notEqual(pose.hands.left.y, pose.hands.right.y);
  assert.equal(pose.weaponVisible, false);
});

test("aim pose moves both hands ahead of the shoulders and exposes the weapon hook", () => {
  const idle = modularCharacterPose({ timeMs: 0, moving: false, aiming: false });
  const aim = modularCharacterPose({ timeMs: 0, moving: false, aiming: true });

  assert.ok(aim.hands.left.y < idle.hands.left.y);
  assert.ok(aim.hands.right.y < idle.hands.right.y);
  assert.equal(aim.weaponVisible, true);
});

test("aiming can keep the walking feet animated independently from the hands", () => {
  const first = modularCharacterPose({ timeMs: 100, moving: true, aiming: true, phase: 0.3 });
  const second = modularCharacterPose({ timeMs: 220, moving: true, aiming: true, phase: 0.3 });

  assert.deepEqual(first.hands, second.hands);
  assert.notEqual(first.feet.left.y, second.feet.left.y);
  assert.notEqual(first.feet.right.y, second.feet.right.y);
});
