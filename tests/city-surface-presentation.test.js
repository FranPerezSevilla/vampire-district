import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCrosswalkMarkings,
  buildLocalRoadDashSegments,
  buildMajorRoadCentreSegments,
  buildOpenGroundDetails,
  buildSidewalkJointSegments,
  buildStreetGridLines
} from "../phaser/src/policies/CitySurfacePresentationPolicy.js";
import { buildSidewalkBoundaryGeometry } from "../phaser/src/rendering/SidewalkBoundaryGeometry.js";

function segmentKey(segment) {
  const first = `${segment.x1}:${segment.y1}`;
  const second = `${segment.x2}:${segment.y2}`;
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

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

test("overlapping sidewalk pieces collapse into one perimeter and one continuous curb", () => {
  const sidewalkSurfaces = [
    { id: "walk-a", x: 0, y: 0, w: 80, h: 20 },
    { id: "walk-b", x: 60, y: 0, w: 80, h: 20 }
  ];
  const roadSurfaces = [{ id: "road", x: 0, y: 20, w: 140, h: 80 }];
  const geometry = buildSidewalkBoundaryGeometry(sidewalkSurfaces, roadSurfaces);
  const southCurbs = geometry.curbSegments.filter(segment => segment.y1 === 20 && segment.y2 === 20);

  assert.deepEqual(southCurbs, [{ x1: 0, y1: 20, x2: 140, y2: 20, roadAdjacent: true }]);
  assert.equal(new Set(geometry.boundarySegments.map(segmentKey)).size, geometry.boundarySegments.length);
  assert.equal(geometry.boundarySegments.some(segment => segment.x1 === 60 && segment.x2 === 60), false);
  assert.equal(geometry.boundarySegments.some(segment => segment.x1 === 80 && segment.x2 === 80), false);
});

test("only a true union corner receives one inward arc and no overlapping sharp vertex", () => {
  const sidewalkSurfaces = [
    { id: "corner-nw", x: 0, y: 0, w: 20, h: 20, role: "corner", corner: "nw" },
    { id: "north-strip", x: 0, y: -80, w: 20, h: 80 },
    { id: "west-strip", x: -80, y: 0, w: 80, h: 20 },
    { id: "duplicate-pad", x: 0, y: 0, w: 20, h: 20, role: "closure" }
  ];
  const roadSurfaces = [
    { id: "north-road", x: 20, y: -80, w: 60, h: 100 },
    { id: "west-road", x: -80, y: 20, w: 100, h: 60 },
    { id: "junction-road", x: 20, y: 20, w: 60, h: 60 }
  ];
  const geometry = buildSidewalkBoundaryGeometry(sidewalkSurfaces, roadSurfaces, {
    cornerRadius: 7,
    cornerSegments: 8
  });

  assert.equal(geometry.corners.length, 1);
  const [corner] = geometry.corners;
  assert.deepEqual(corner.vertex, { x: 20, y: 20 });
  assert.deepEqual(corner.centre, { x: 13, y: 13 });
  assert.deepEqual(corner.arc[0], { x: 20, y: 13 });
  assert.deepEqual(corner.arc.at(-1), { x: 13, y: 20 });
  assert.equal(geometry.curbSegments.some(segment => (
    (segment.x1 === 20 && segment.y1 === 20)
    || (segment.x2 === 20 && segment.y2 === 20)
  )), false);
  assert.ok(geometry.curbSegments.some(segment => segment.x2 === 13 && segment.y2 === 20));
  assert.ok(geometry.curbSegments.some(segment => segment.x2 === 20 && segment.y2 === 13));
});

test("buried corner metadata cannot create a decorative arc inside another sidewalk surface", () => {
  const sidewalkSurfaces = [
    { id: "corner", x: 0, y: 0, w: 20, h: 20, role: "corner", corner: "nw" },
    { id: "cover", x: -20, y: -20, w: 60, h: 60 }
  ];
  const roadSurfaces = [{ id: "road", x: 40, y: 0, w: 40, h: 40 }];
  const geometry = buildSidewalkBoundaryGeometry(sidewalkSurfaces, roadSurfaces);

  assert.equal(geometry.corners.length, 0);
});

test("major road paint uses two independent close-set lanes with non-mirrored wear", () => {
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
  const paint = buildMajorRoadCentreSegments(road, fragment);
  const firstLane = paint.filter(segment => segment.laneIndex === 0);
  const secondLane = paint.filter(segment => segment.laneIndex === 1);

  assert.ok(firstLane.length >= 2);
  assert.ok(secondLane.length >= 2);
  assert.ok(paint.every(segment => segment.h > 2));
  assert.ok(Math.abs(firstLane[0].y - secondLane[0].y) < 6);
  assert.notDeepEqual(
    firstLane.map(segment => [segment.x, segment.w]),
    secondLane.map(segment => [segment.x, segment.w])
  );
  assert.notEqual(firstLane.at(-1).x + firstLane.at(-1).w, secondLane.at(-1).x + secondLane.at(-1).w);
});

test("local road dashes are deterministic but do not repeat a fixed dash-gap cadence", () => {
  const road = {
    id: "road-segment:test-local",
    x: 0,
    y: 100,
    w: 480,
    h: 72,
    orientation: "horizontal",
    pieceKind: "segment",
    roadClass: "local"
  };
  const first = buildLocalRoadDashSegments(road, road);
  const second = buildLocalRoadDashSegments(road, road);

  assert.deepEqual(first, second);
  assert.ok(first.length >= 6);
  assert.ok(new Set(first.map(segment => Math.round(segment.w))).size > 1);
  const gaps = first.slice(1).map((segment, index) => Math.round(segment.x - (first[index].x + first[index].w)));
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
