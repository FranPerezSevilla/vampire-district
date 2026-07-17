import test from "node:test";
import assert from "node:assert/strict";
import {
  angleBetween,
  clientToGamePoint,
  normalizeVector,
  pointInsideCone,
  screenToWorldPoint,
  scoreDirectionalCandidate
} from "../phaser/src/utils/geometry.js";

test("normalizeVector returns a unit vector and original length", () => {
  const result = normalizeVector(3, 4);
  assert.equal(result.length, 5);
  assert.ok(Math.abs(result.x - 0.6) < 1e-9);
  assert.ok(Math.abs(result.y - 0.8) < 1e-9);
});

test("pointInsideCone distinguishes front and rear points", () => {
  const origin = { x: 0, y: 0 };
  const facing = { x: 1, y: 0 };
  assert.equal(pointInsideCone(origin, facing, { x: 8, y: 1 }, 10, Math.PI / 4), true);
  assert.equal(pointInsideCone(origin, facing, { x: -8, y: 0 }, 10, Math.PI / 4), false);
  assert.equal(pointInsideCone(origin, facing, { x: 20, y: 0 }, 10, Math.PI / 4), false);
});

test("clientToGamePoint compensates for CSS-scaled canvases", () => {
  const game = clientToGamePoint(
    { x: 460, y: 290 },
    { left: 100, top: 50, width: 720, height: 480 },
    { width: 1440, height: 960 }
  );
  assert.deepEqual(game, { x: 720, y: 480 });
});

test("screenToWorldPoint respects camera world view and zoom", () => {
  const world = screenToWorldPoint(
    { x: 300, y: 180 },
    { worldViewX: 100, worldViewY: 50, zoom: 2 }
  );
  assert.deepEqual(world, { x: 250, y: 140 });
});

test("angle and directional scoring prefer aligned candidates", () => {
  assert.ok(Math.abs(angleBetween({ x: 1, y: 0 }, { x: 0, y: 1 }) - Math.PI / 2) < 1e-9);
  const origin = { x: 0, y: 0 };
  const aim = { x: 1, y: 0 };
  const aligned = scoreDirectionalCandidate(origin, aim, { x: 20, y: 0 });
  const sideways = scoreDirectionalCandidate(origin, aim, { x: 20, y: 20 });
  assert.ok(aligned < sideways);
});
