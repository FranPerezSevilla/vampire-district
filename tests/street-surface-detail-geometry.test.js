import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCurbsideDetails,
  buildRoadRepairDetails,
  buildStreetSurfaceDetailGeometry
} from "../phaser/src/rendering/StreetSurfaceDetailGeometry.js";

function rectsOverlap(left, rightValue) {
  return left.x < rightValue.x + rightValue.w
    && left.x + left.w > rightValue.x
    && left.y < rightValue.y + rightValue.h
    && left.y + left.h > rightValue.y;
}

function pointsBounds(points) {
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys)
  };
}

test("road repairs are deterministic, irregular and kept clear of crosswalk approaches", () => {
  const road = {
    id: "road-8",
    x: 0,
    y: 0,
    w: 600,
    h: 90,
    orientation: "horizontal",
    pieceKind: "segment",
    roadClass: "major"
  };
  const crossing = { x: 230, y: 0, w: 120, h: 90, orientation: "vertical" };
  const first = buildRoadRepairDetails([road], [crossing], { crosswalkClearance: 22 });
  const second = buildRoadRepairDetails([road], [crossing], { crosswalkClearance: 22 });
  const exclusion = { x: 208, y: -22, w: 164, h: 134 };

  assert.deepEqual(first, second);
  assert.ok(first.patches.length + first.cracks.length > 0);
  assert.ok(first.patches.every(patch => patch.points.length >= 8));
  assert.ok(first.patches.every(patch => !rectsOverlap(patch.bounds, exclusion)));
  assert.ok(first.cracks.every(crack => !rectsOverlap(pointsBounds(crack.points), exclusion)));
});

test("curbside details sit on the road side and drains stay clear of crossings", () => {
  const roadSurfaces = [{ id: "road", x: 0, y: 20, w: 600, h: 80 }];
  const boundary = {
    curbSegments: [{ x1: 0, y1: 20, x2: 600, y2: 20, roadAdjacent: true }],
    corners: []
  };
  const crossing = { x: 200, y: 20, w: 60, h: 80 };
  const details = buildCurbsideDetails(boundary, roadSurfaces, [crossing], {
    drainSpacing: 160
  });
  const exclusion = { x: 174, y: -6, w: 112, h: 132 };

  assert.equal(details.gutterBands.length, 1);
  assert.deepEqual(details.gutterBands[0].normal, { x: 0, y: 1 });
  assert.ok(details.gutterBands[0].points.slice(2).every(point => point.y > 20));
  assert.ok(details.drains.length > 0);
  assert.ok(details.drains.every(drain => !rectsOverlap(drain, exclusion)));
  assert.equal(new Set(details.drains.map(drain => drain.id)).size, details.drains.length);
});

test("rounded corners receive one radial gutter band instead of a square overlap", () => {
  const boundary = {
    curbSegments: [],
    corners: [{
      id: "corner",
      vertex: { x: 20, y: 20 },
      centre: { x: 13, y: 13 },
      radius: 7,
      arc: [{ x: 20, y: 13 }, { x: 18, y: 18 }, { x: 13, y: 20 }]
    }]
  };
  const details = buildCurbsideDetails(boundary, [{ x: 20, y: 20, w: 80, h: 80 }], []);

  assert.equal(details.gutterBands.length, 1);
  assert.equal(details.gutterBands[0].points.length, 6);
  const outer = details.gutterBands[0].points.slice(3);
  assert.ok(outer.some(point => point.x > 20 || point.y > 20));
});

test("street surface detail geometry remains deterministic as a complete render plan", () => {
  const roadSurfaces = [{
    id: "road-1",
    x: 0,
    y: 20,
    w: 500,
    h: 80,
    orientation: "horizontal",
    pieceKind: "segment",
    roadClass: "major"
  }];
  const boundary = {
    curbSegments: [{ x1: 0, y1: 20, x2: 500, y2: 20, roadAdjacent: true }],
    corners: []
  };

  assert.deepEqual(
    buildStreetSurfaceDetailGeometry(roadSurfaces, [], boundary),
    buildStreetSurfaceDetailGeometry(roadSurfaces, [], boundary)
  );
});
