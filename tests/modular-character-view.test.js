import test from "node:test";
import assert from "node:assert/strict";
import {
  modularCharacterFacingRotation,
  modularCharacterPose
} from "../phaser/src/rendering/ModularCharacterView.js";

const closeTo = (actual, expected, epsilon = 0.0001) => {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} should be close to ${expected}`);
};

test("modular character facing remains continuous instead of snapping to octants", () => {
  closeTo(modularCharacterFacingRotation({ x: 0, y: -1 }), 0);
  closeTo(modularCharacterFacingRotation({ x: 1, y: 0 }), Math.PI / 2);
  closeTo(modularCharacterFacingRotation({ x: -1, y: 0 }), -Math.PI / 2);

  const thirtyDegrees = Math.PI / 6;
  const direction = { x: Math.sin(thirtyDegrees), y: -Math.cos(thirtyDegrees) };
  closeTo(modularCharacterFacingRotation(direction), thirtyDegrees);
});

test("walking feet remain centered beneath the torso and alternate around one origin", () => {
  const first = modularCharacterPose({ timeMs: 80, moving: true, phase: 0 });
  const second = modularCharacterPose({ timeMs: 190, moving: true, phase: 0 });

  assert.ok(Math.abs(first.feet.left.x) < 3);
  assert.ok(Math.abs(first.feet.right.x) < 3);
  assert.notEqual(first.feet.left.y, first.feet.right.y);
  assert.notEqual(first.feet.left.y, second.feet.left.y);
  closeTo(first.feet.left.x, -first.feet.right.x);
});

test("unarmed attacks thrust one hand forward and alternate hands by attack serial", () => {
  const leftPunch = modularCharacterPose({
    timeMs: 0,
    weaponId: "unarmed",
    attacking: true,
    attackProgress: 0.5,
    attackSerial: 2
  });
  const rightPunch = modularCharacterPose({
    timeMs: 0,
    weaponId: "unarmed",
    attacking: true,
    attackProgress: 0.5,
    attackSerial: 3
  });

  assert.ok(leftPunch.hands.left.y < leftPunch.hands.right.y);
  assert.ok(rightPunch.hands.right.y < rightPunch.hands.left.y);
  assert.equal(leftPunch.attackKind, "punch");
});

test("iron pipe remains visible and sweeps through the attack", () => {
  const windup = modularCharacterPose({
    weaponId: "iron_pipe",
    attacking: true,
    attackProgress: 0.1
  });
  const followThrough = modularCharacterPose({
    weaponId: "iron_pipe",
    attacking: true,
    attackProgress: 0.8
  });

  assert.equal(windup.pipeVisible, true);
  assert.equal(windup.pistolVisible, false);
  assert.notEqual(windup.hands.right.rotation, followThrough.hands.right.rotation);
});

test("pistol keeps both hands forward and adds recoil during a shot", () => {
  const idle = modularCharacterPose({ weaponId: "pistol", attacking: false });
  const firing = modularCharacterPose({
    weaponId: "pistol",
    attacking: true,
    attackProgress: 0.5
  });

  assert.equal(idle.pistolVisible, true);
  assert.ok(idle.hands.left.y < 0);
  assert.ok(idle.hands.right.y < 0);
  assert.notEqual(idle.hands.right.y, firing.hands.right.y);
});

test("feet keep animating independently while a weapon attack owns the hands", () => {
  const first = modularCharacterPose({
    timeMs: 100,
    moving: true,
    weaponId: "pistol",
    attacking: true,
    attackProgress: 0.4,
    phase: 0.3
  });
  const second = modularCharacterPose({
    timeMs: 220,
    moving: true,
    weaponId: "pistol",
    attacking: true,
    attackProgress: 0.4,
    phase: 0.3
  });

  assert.deepEqual(first.hands, second.hands);
  assert.notEqual(first.feet.left.y, second.feet.left.y);
  assert.notEqual(first.feet.right.y, second.feet.right.y);
});
