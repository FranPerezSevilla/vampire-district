import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCompletedSidewalkSurfaces,
  buildRoadEdgeSidewalkInfill
} from "../phaser/src/rendering/SidewalkSurfaceCompletion.js";

function overlaps(left, rightValue) {
  return Math.min(left.x + left.w, rightValue.x + rightValue.w) - Math.max(left.x, rightValue.x) > 0.001
    && Math.min(left.y + left.h, rightValue.y + rightValue.h) - Math.max(left.y, rightValue.y) > 0.001;
}

function horizontalRoad(overrides = {}) {
  return {
    id: "road-segment:test",
    graphEdgeId: "road-edge:test",
    x: 0,
    y: 100,
    w: 200,
    h: 60,
    geometry: "rect",
    pieceKind: "segment",
    orientation: "horizontal",
    roadClass: "local",
    kind: "road",
    ...overrides
  };
}

function northWalk(id, x, w) {
  return {
    id,
    x,
    y: 78,
    w,
    h: 22,
    geometry: "rect",
    orientation: "horizontal",
    side: "north",
    graphEdgeId: "road-edge:test"
  };
}

function southWalk() {
  return {
    id: "south-authored",
    x: 0,
    y: 160,
    w: 200,
    h: 22,
    geometry: "rect",
    orientation: "horizontal",
    side: "south",
    graphEdgeId: "road-edge:test"
  };
}

test("runtime-fitted building frontage receives the sidewalk fragment missing from compile-time geometry", () => {
  const segment = horizontalRoad();
  const authored = [northWalk("north-left", 0, 60), northWalk("north-right", 140, 60), southWalk()];
  // The original building covered x=60..140 when sidewalks were compiled. At runtime
  // it has been fitted back to x=60..100, exposing a genuine forty-pixel frontage gap.
  const finalBuildings = [{ id: "fitted-building", x: 60, y: 70, w: 40, h: 30 }];
  const infill = buildRoadEdgeSidewalkInfill({
    roadSegments: [segment],
    roads: [segment],
    sidewalks: authored,
    buildings: finalBuildings,
    world: { width: 400, height: 300 }
  });

  const north = infill.filter(surface => surface.side === "north");
  assert.deepEqual(north.map(surface => ({ x: surface.x, y: surface.y, w: surface.w, h: surface.h })), [
    { x: 100, y: 78, w: 40, h: 22 }
  ]);
  assert.equal(infill.some(surface => surface.side === "south"), false);
});

test("completion never paints through final buildings or duplicates authored sidewalk coverage", () => {
  const segment = horizontalRoad();
  const building = { id: "frontage-building", x: 70, y: 78, w: 60, h: 22 };
  const authored = [northWalk("north-left", 0, 40), northWalk("north-right", 160, 40), southWalk()];
  const infill = buildRoadEdgeSidewalkInfill({
    roadSegments: [segment],
    roads: [segment],
    sidewalks: authored,
    buildings: [building],
    world: { width: 400, height: 300 },
    minimumFragmentLength: 8
  });

  assert.ok(infill.every(surface => !overlaps(surface, building)));
  assert.ok(infill.every(surface => authored.every(walk => !overlaps(surface, walk))));
  assert.ok(infill.some(surface => surface.side === "north" && surface.x === 40 && surface.w === 30));
  assert.ok(infill.some(surface => surface.side === "north" && surface.x === 130 && surface.w === 30));
});

test("junction road pieces preserve intersection clearance at road-segment ends", () => {
  const segment = horizontalRoad();
  const junction = {
    id: "road-junction:test",
    x: 176,
    y: 70,
    w: 60,
    h: 120,
    geometry: "rect",
    pieceKind: "junction",
    kind: "road"
  };
  const authored = [southWalk()];
  const infill = buildRoadEdgeSidewalkInfill({
    roadSegments: [segment],
    roads: [segment, junction],
    sidewalks: authored,
    buildings: [],
    world: { width: 400, height: 300 }
  });

  const north = infill.filter(surface => surface.side === "north");
  assert.deepEqual(north.map(surface => [surface.x, surface.w]), [[0, 176]]);
  assert.ok(infill.every(surface => !overlaps(surface, junction)));
});

test("alley coverage remains authored unless explicitly requested", () => {
  const alley = horizontalRoad({ id: "road-segment:alley", graphEdgeId: "road-edge:alley", roadClass: "alley", kind: "alley" });
  const defaultResult = buildRoadEdgeSidewalkInfill({
    roadSegments: [alley],
    roads: [alley],
    sidewalks: [],
    buildings: [],
    world: { width: 400, height: 300 }
  });
  const included = buildRoadEdgeSidewalkInfill({
    roadSegments: [alley],
    roads: [alley],
    sidewalks: [],
    buildings: [],
    world: { width: 400, height: 300 },
    includeAlleys: true
  });

  assert.deepEqual(defaultResult, []);
  assert.equal(included.length, 2);
});

test("completed sidewalk collection is deterministic and keeps authored surfaces first", () => {
  const segment = horizontalRoad();
  const authored = [northWalk("north-left", 0, 60), northWalk("north-right", 140, 60), southWalk()];
  const options = {
    roadSegments: [segment],
    roads: [segment],
    sidewalks: authored,
    buildings: [],
    world: { width: 400, height: 300 }
  };
  const first = buildCompletedSidewalkSurfaces(options);
  const second = buildCompletedSidewalkSurfaces(options);

  assert.deepEqual(first, second);
  assert.deepEqual(first.slice(0, authored.length), authored);
  assert.ok(first.slice(authored.length).every(surface => surface.presentationOnly === true));
});
