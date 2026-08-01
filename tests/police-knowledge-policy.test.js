import test from "node:test";
import assert from "node:assert/strict";

import {
  policeKnowledgeMode,
  predictPoliceIntercept
} from "../phaser/src/police/PoliceKnowledgePolicy.js";

test("wanted one only uses last-known position", () => {
  assert.equal(policeKnowledgeMode(1, { street: true, shadow: false }), "last-known");
  assert.equal(policeKnowledgeMode(1, { street: true, shadow: true }), "last-known");
});

test("wanted two receives periodic street intelligence but shadows break exact updates", () => {
  assert.equal(policeKnowledgeMode(2, { street: true, shadow: false }), "periodic");
  assert.equal(policeKnowledgeMode(2, { street: true, shadow: true }), "last-known");
  assert.equal(policeKnowledgeMode(2, { street: false, shadow: false }), "last-known");
});

test("wanted three tracks live only while the player remains visible on the street", () => {
  assert.equal(policeKnowledgeMode(3, { street: true, shadow: false }), "live");
  assert.equal(policeKnowledgeMode(3, { street: true, shadow: true }), "last-known");
  assert.equal(policeKnowledgeMode(3, { street: false, shadow: false }), "last-known");
});

test("level two intercept intelligence predicts the player's current movement", () => {
  const prediction = predictPoliceIntercept(
    { x: 100, y: 200, speed: 80 },
    { move: { x: 1, y: 0 } },
    1.25
  );
  assert.equal(prediction.x, 200);
  assert.equal(prediction.y, 200);

  const diagonal = predictPoliceIntercept(
    { x: 0, y: 0, speed: 100 },
    { move: { x: 1, y: 1 } },
    1
  );
  assert.ok(Math.abs(diagonal.x - Math.SQRT1_2 * 100) < 0.001);
  assert.ok(Math.abs(diagonal.y - Math.SQRT1_2 * 100) < 0.001);
});
