import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCornerArc,
  buildCornerCutout,
  buildCrosswalkMarkings,
  buildSidewalkJointSegments,
  buildStreetGridLines
} from "../phaser/src/policies/CitySurfacePresentationPolicy.js";

test("street grid stays globally aligned and marks larger paving seams", () => {
  const bounds = { x: 70, y: 130, w: 210, h: 150 };
  const lines = buildStreetGridLines(bounds, { spacing: 64, majorEvery: 4 });

  assert.ok(lines.length > 0);
  assert.ok(lines.every(segment => (
    Number.isFinite(segment.x1)
    && Number.isFinite(segment.y1)
    && Number.isFinite(segment.x2)
    && Number.isFinite(segment.y2)
  )));

  const vertical = lines.filter(segment => segment.x1 === segment.x2);
  const horizontal = lines.filter(segment => segment.y1 === segment.y2);
  assert.deepEqual(vertical.map(segment => segment.x1), [128, 192, 256]);
  assert.deepEqual(horizontal.map(segment => segment.y1), [192, 256]);
  assert.equal(lines.find(segment => segment.x1 === 256 && segment.x2 === 256)?.major, true);
  assert.equal(lines.find(segment => segment.y1 === 256 && segment.y2 === 256)?.major, true);
});

test("sidewalk panel joints follow the long axis and stay inside the visible fragment", () => {
  const walk = {
    x: 100,
    y: 200,
    w: 160,
    h: 22,
    geometry: "rect",
    orientation: "horizontal",
    role: "kerb-strip"
  };
  const bounds = { x: 125, y: 190, w: 90, h: 60 };
  const segments = buildSidewalkJointSegments(walk, bounds, 28);

  assert.ok(segments.length >= 2);
  assert.ok(segments.every(segment => segment.x1 === segment.x2));
  assert.ok(segments.every(segment => segment.x1 >= bounds.x && segment.x1 <= bounds.x + bounds.w));
  assert.ok(segments.every(segment => segment.y1 >= walk.y && segment.y2 <= walk.y + walk.h));
});

test("junction corner cutouts create a deterministic quarter-arc curb", () => {
  const walk = { x: 300, y: 400, w: 22, h: 22, role: "corner", corner: "nw" };
  const cutout = buildCornerCutout(walk);
  const arc = buildCornerArc(cutout, 6);

  assert.deepEqual({ x: cutout.x, y: cutout.y }, { x: 322, y: 422 });
  assert.ok(cutout.radius >= 5 && cutout.radius <= 11);
  assert.equal(arc.length, 7);
  assert.ok(arc.every(point => point.x <= cutout.x + 0.001 && point.y <= cutout.y + 0.001));
});

test("crosswalk plan renders zebra bands, tactile paving and an approach stop line", () => {
  const crossing = {
    x: 500,
    y: 600,
    w: 96,
    h: 14,
    orientation: "horizontal",
    leg: "south"
  };
  const markings = buildCrosswalkMarkings(crossing);

  assert.ok(markings.stripes.length >= 8);
  assert.ok(markings.stripes.every(stripe => stripe.y === crossing.y && stripe.h === crossing.h));
  assert.equal(markings.tactilePads.length, 2);
  assert.deepEqual(markings.stopLine, { x: 500, y: 593, w: 96, h: 2 });
  assert.ok(markings.tactilePads[0].x < crossing.x);
  assert.ok(markings.tactilePads[1].x > crossing.x + crossing.w);
});
