import assert from "node:assert/strict";
import test from "node:test";

import { createOrthogonalMarkerGeometry } from "../phaser/src/rendering/buildings/BuildingPresentationMarkerGeometry.js";

function rectWithin(inner, outer) {
  return inner.x >= outer.x
    && inner.y >= outer.y
    && inner.x + inner.w <= outer.x + outer.w
    && inner.y + inner.h <= outer.y + outer.h;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w
    && a.x + a.w > b.x
    && a.y < b.y + b.h
    && a.y + a.h > b.y;
}

test("family-neutral marker geometry is centered, joined and contained without mutating authored bounds", () => {
  const bounds = { x: 140, y: 220, w: 24, h: 24 };
  const authoredBounds = { ...bounds };

  const geometry = createOrthogonalMarkerGeometry(bounds);

  assert.ok(geometry);
  assert.deepEqual(bounds, authoredBounds);
  assert.deepEqual(geometry.bounds, authoredBounds);
  assert.equal(rectWithin(geometry.stem, authoredBounds), true);
  assert.equal(rectWithin(geometry.arm, authoredBounds), true);
  assert.equal(rectsOverlap(geometry.stem, geometry.arm), true);
  assert.ok(geometry.stem.h > geometry.stem.w);
  assert.ok(geometry.arm.w > geometry.arm.h);
  assert.equal(geometry.junction.x, authoredBounds.x + authoredBounds.w / 2);
  assert.equal(geometry.junction.y, authoredBounds.y + authoredBounds.h / 2);
});

test("shared marker geometry supports deterministic family-specific proportions without semantic classification", () => {
  const bounds = { x: 80, y: 120, w: 30, h: 26 };
  const churchLike = createOrthogonalMarkerGeometry(bounds, {
    junctionRatio: 0.38,
    armSpanRatio: 0.76
  });
  const centeredInstitutional = createOrthogonalMarkerGeometry(bounds, {
    junctionRatio: 0.5,
    armSpanRatio: 0.68
  });
  const repeated = createOrthogonalMarkerGeometry(bounds, {
    junctionRatio: 0.5,
    armSpanRatio: 0.68
  });

  assert.ok(churchLike);
  assert.ok(centeredInstitutional);
  assert.ok(churchLike.junction.y < centeredInstitutional.junction.y);
  assert.equal(rectWithin(centeredInstitutional.stem, bounds), true);
  assert.equal(rectWithin(centeredInstitutional.arm, bounds), true);
  assert.deepEqual(centeredInstitutional, repeated);
});

test("marker geometry safely omits undersized authored regions", () => {
  const bounds = { x: 12, y: 18, w: 5, h: 9 };
  const authoredBounds = { ...bounds };

  assert.equal(createOrthogonalMarkerGeometry(bounds), null);
  assert.deepEqual(bounds, authoredBounds);
});
