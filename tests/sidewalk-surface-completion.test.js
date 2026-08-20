import assert from "node:assert/strict";
import test from "node:test";

import { CITY_WORLD, roadSegments as productionRoadSegments, roads as productionRoads, sidewalks as productionSidewalks } from "../phaser/src/data/generated/city-topology-v2.js";

import {
  auditRoadEdgeSidewalkCoverage,
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
  const infill = buildRoadEdgeSidewalkInfill({
    roadSegments: [segment],
    roads: [segment],
    sidewalks: authored,
    world: { width: 400, height: 300 }
  });

  const north = infill.filter(surface => surface.side === "north");
  assert.deepEqual(north.map(surface => ({ x: surface.x, y: surface.y, w: surface.w, h: surface.h })), [
    { x: 60, y: 78, w: 80, h: 22 }
  ]);
  assert.equal(infill.some(surface => surface.side === "south"), false);
});

test("building footprints cannot erase road-owned sidewalk or curb coverage", () => {
  const segment = horizontalRoad();
  const building = { id: "frontage-building", x: 40, y: 70, w: 120, h: 40 };
  const authored = [northWalk("north-left", 0, 40), northWalk("north-right", 160, 40), southWalk()];
  const infill = buildRoadEdgeSidewalkInfill({
    roadSegments: [segment],
    roads: [segment],
    sidewalks: authored,
    buildings: [building],
    world: { width: 400, height: 300 },
    minimumFragmentLength: 8
  });

  assert.ok(infill.some(surface => surface.side === "north" && surface.x === 40 && surface.w === 120));
  assert.ok(infill.some(surface => overlaps(surface, building)));
  assert.ok(infill.every(surface => authored.every(walk => !overlaps(surface, walk))));

  const completed = [...authored, ...infill];
  const audit = auditRoadEdgeSidewalkCoverage({
    roadSegments: [segment],
    roads: [segment],
    sidewalks: completed,
    world: { width: 400, height: 300 }
  });
  assert.deepEqual(audit, { valid: true, gaps: [] });
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
    world: { width: 400, height: 300 }
  });
  const included = buildRoadEdgeSidewalkInfill({
    roadSegments: [alley],
    roads: [alley],
    sidewalks: [],
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
    world: { width: 400, height: 300 }
  };
  const first = buildCompletedSidewalkSurfaces(options);
  const second = buildCompletedSidewalkSurfaces(options);

  assert.deepEqual(first, second);
  assert.deepEqual(first.slice(0, authored.length), authored);
  assert.ok(first.slice(authored.length).every(surface => surface.presentationOnly === true));
});

test("coverage audit reports the exact road side and coordinates of an unfilled gap", () => {
  const segment = horizontalRoad();
  const incomplete = [northWalk("north-left", 0, 70), northWalk("north-right", 130, 70), southWalk()];
  const audit = auditRoadEdgeSidewalkCoverage({
    roadSegments: [segment],
    roads: [segment],
    sidewalks: incomplete,
    world: { width: 400, height: 300 },
    sampleSpacing: 10
  });

  assert.equal(audit.valid, false);
  assert.ok(audit.gaps.length > 0);
  assert.ok(audit.gaps.every(gap => gap.roadId === segment.id && gap.side === "north"));
  assert.ok(audit.gaps.some(gap => gap.x > 70 && gap.x < 130 && gap.y === 99));
});

test("production city satisfies the road-edge sidewalk invariant everywhere", () => {
  const completed = buildCompletedSidewalkSurfaces({
    roadSegments: productionRoadSegments,
    roads: productionRoads,
    sidewalks: productionSidewalks,
    world: CITY_WORLD,
    sidewalkWidth: 22,
    minimumFragmentLength: 8
  });
  const audit = auditRoadEdgeSidewalkCoverage({
    roadSegments: productionRoadSegments,
    roads: productionRoads,
    sidewalks: completed,
    world: CITY_WORLD,
    sidewalkWidth: 22,
    sampleSpacing: 12
  });

  assert.equal(audit.valid, true, JSON.stringify(audit.gaps.slice(0, 20)));
});
