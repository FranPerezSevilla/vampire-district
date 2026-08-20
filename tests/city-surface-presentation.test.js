import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCornerArc,
  buildCornerCurbSegments,
  buildCornerCutout,
  buildCornerCutoutPolygon,
  buildCrosswalkMarkings,
  buildLocalRoadDashSegments,
  buildMajorRoadCentreSegments,
  buildOpenGroundDetails,
  buildSidewalkCurbSegments,
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

test("open ground details are deterministic, sparse and clipped to the render window", () => {
  const bounds = { x: 40, y: 70, w: 520, h: 360 };
  const first = buildOpenGroundDetails(bounds, { cellSize: 176 });
  const second = buildOpenGroundDetails(bounds, { cellSize: 176 });

  assert.deepEqual(first, second);
  assert.ok(first.panels.length > 0);
  assert.ok(first.scuffs.length > 0);
  assert.ok(first.panels.every(panel => (
    panel.x >= bounds.x
    && panel.y >= bounds.y
    && panel.x + panel.w <= bounds.x + bounds.w + 0.001
    && panel.y + panel.h <= bounds.y + bounds.h + 0.001
  )));
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

test("sidewalk curb coverage keeps both exposed strip edges without duplicate segments", () => {
  const walk = {
    x: 100,
    y: 200,
    w: 160,
    h: 22,
    geometry: "rect",
    orientation: "horizontal",
    side: "north",
    trimEdges: ["north", "south"],
    role: "kerb-strip"
  };
  const segments = buildSidewalkCurbSegments(walk);

  assert.equal(segments.length, 2);
  assert.ok(segments.some(segment => segment.y1 === walk.y && segment.y2 === walk.y));
  assert.ok(segments.some(segment => segment.y1 === walk.y + walk.h && segment.y2 === walk.y + walk.h));
});

test("junction corner arc is centred inside the sidewalk and removes the sharp road-facing vertex", () => {
  const walk = { x: 300, y: 400, w: 22, h: 22, role: "corner", corner: "nw" };
  const cutout = buildCornerCutout(walk);
  const arc = buildCornerArc(cutout, 6);
  const polygon = buildCornerCutoutPolygon(cutout, 6);
  const curbSegments = buildCornerCurbSegments(walk, cutout);

  assert.equal(cutout.vertexX, 322);
  assert.equal(cutout.vertexY, 422);
  assert.ok(cutout.x < cutout.vertexX);
  assert.ok(cutout.y < cutout.vertexY);
  assert.ok(cutout.radius >= 5 && cutout.radius <= 8);
  assert.equal(arc.length, 7);
  assert.equal(polygon.length, 8);
  assert.deepEqual(polygon[0], { x: 322, y: 422 });
  assert.ok(arc.every(point => (
    point.x >= cutout.x - 0.001
    && point.y >= cutout.y - 0.001
    && point.x <= cutout.vertexX + 0.001
    && point.y <= cutout.vertexY + 0.001
  )));
  assert.ok(Math.abs(arc[0].x - cutout.vertexX) < 0.001);
  assert.ok(Math.abs(arc[0].y - cutout.y) < 0.001);
  assert.ok(Math.abs(arc.at(-1).x - cutout.x) < 0.001);
  assert.ok(Math.abs(arc.at(-1).y - cutout.vertexY) < 0.001);
  assert.equal(curbSegments.length, 2);
  assert.equal(curbSegments[0].x2, cutout.x);
  assert.equal(curbSegments[1].y2, cutout.y);
});

test("major road paint keeps close thick double lines with independent deterministic wear", () => {
  const road = {
    id: "road-segment:test-major",
    x: 100,
    y: 200,
    w: 720,
    h: 100,
    orientation: "horizontal",
    pieceKind: "segment",
    roadClass: "major"
  };
  const fragment = { ...road };
  const paint = buildMajorRoadCentreSegments(road, fragment, { approachInset: 12 });
  const again = buildMajorRoadCentreSegments(road, fragment, { approachInset: 12 });

  assert.deepEqual(paint, again);
  assert.ok(paint.length >= 4);
  assert.ok(paint.every(segment => segment.x >= road.x + 12 - 0.001));
  assert.ok(paint.every(segment => segment.x + segment.w <= road.x + road.w - 12 + 0.001));
  assert.ok(paint.every(segment => segment.alpha >= 0.62 && segment.alpha <= 0.78));
  assert.ok(paint.every(segment => segment.h > 2));

  const upper = paint.filter(segment => segment.laneIndex === 0);
  const lower = paint.filter(segment => segment.laneIndex === 1);
  assert.ok(upper.length >= 2);
  assert.ok(lower.length >= 2);
  assert.ok(Math.abs(upper[0].y - lower[0].y) < 5);
  assert.ok(upper[0].y !== lower[0].y);

  const upperSignature = upper.map(segment => [segment.x, segment.w]);
  const lowerSignature = lower.map(segment => [segment.x, segment.w]);
  assert.notDeepEqual(upperSignature, lowerSignature);
  assert.ok(upper[0].x !== lower[0].x || upper.at(-1).x + upper.at(-1).w !== lower.at(-1).x + lower.at(-1).w);
});

test("local centre dashes vary their run and gap lengths deterministically", () => {
  const road = {
    id: "road-segment:test-local",
    x: 0,
    y: 100,
    w: 520,
    h: 64,
    orientation: "horizontal",
    pieceKind: "segment",
    roadClass: "local"
  };
  const dashes = buildLocalRoadDashSegments(road, road);
  const again = buildLocalRoadDashSegments(road, road);

  assert.deepEqual(dashes, again);
  assert.ok(dashes.length >= 6);
  assert.ok(new Set(dashes.map(dash => Math.round(dash.w))).size > 1);
  const gaps = dashes.slice(1).map((dash, index) => Math.round(dash.x - (dashes[index].x + dashes[index].w)));
  assert.ok(new Set(gaps).size > 1);
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
