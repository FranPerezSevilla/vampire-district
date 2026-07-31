import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseFootResponsePoint,
  desiredFootPolice,
  desiredPoliceTotal
} from "../phaser/src/police/PoliceResponsePolicy.js";

test("wanted levels escalate from local foot response to district saturation", () => {
  assert.equal(desiredPoliceTotal(0), 2);
  assert.equal(desiredPoliceTotal(1), 4);
  assert.equal(desiredPoliceTotal(2), 8);
  assert.equal(desiredPoliceTotal(3), 12);
  assert.equal(desiredFootPolice(1, 0), 4);
  assert.equal(desiredFootPolice(2, 4), 4);
  assert.equal(desiredFootPolice(3, 6), 6);
  assert.equal(desiredFootPolice(3, 2), 10);
});

test("foot response chooses nearby separated approaches instead of a distant global entry", () => {
  const points = [
    { id: "too-close", x: 40, y: 0 },
    { id: "east", x: 420, y: 0 },
    { id: "south", x: 0, y: 450 },
    { id: "west", x: -500, y: 0 },
    { id: "far", x: 1800, y: 0 }
  ];
  const first = chooseFootResponsePoint(points, { x: 0, y: 0 }, 0, {
    minDistance: 260,
    targetDistance: 440,
    maxDistance: 800
  });
  const second = chooseFootResponsePoint(points, { x: 0, y: 0 }, 1, {
    minDistance: 260,
    targetDistance: 440,
    maxDistance: 800
  });

  assert.equal(first.id, "south");
  assert.equal(second.id, "east");
  assert.notEqual(first.id, second.id);
});
