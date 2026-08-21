import assert from "node:assert/strict";
import test from "node:test";

import { CITY_WORLD, roadSegments as productionRoadSegments, roads as productionRoads, sidewalks as productionSidewalks } from "../phaser/src/data/generated/city-topology-v2.js";
import { auditRoadEdgeSidewalkCoverage, buildCompletedSidewalkSurfaces, buildRoadEdgeSidewalkInfill } from "../phaser/src/rendering/SidewalkSurfaceCompletion.js";

function overlaps(a, b) {
  return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.001
    && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.001;
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

test("road-edge pavement is a full authoritative band even when authored sidewalks already exist", () => {
  const segment = horizontalRoad();
  const authored = [northWalk("north-left", 0, 60), northWalk("north-right", 140, 60)];
  const generated = buildRoadEdgeSidewalkInfill({
    roadSegments: [segment],
    roads: [segment],
    sidewalks: authored,
    world: { width: 400, height: 300 }
  });
  const north = generated.filter(surface => surface.side === "north");
  assert.deepEqual(north.map(surface => [surface.x, surface.y, surface.w, surface.h]), [[0, 78, 200, 22]]);
  assert.equal(north[0].authoritativeRoadEdge, true);
});

test("building footprints cannot erase or split the authoritative pavement band", () => {
  const segment = horizontalRoad();
  const building = { id: "frontage-building", x: 40, y: 70, w: 120, h: 40 };
  const generated = buildRoadEdgeSidewalkInfill({
    roadSegments: [segment],
    roads: [segment],
    buildings: [building],
    world: { width: 400, height: 300 }
  });
  const north = generated.filter(surface => surface.side === "north");
  assert.deepEqual(north.map(surface => [surface.x, surface.w]), [[0, 200]]);
  assert.ok(overlaps(north[0], building));
});

test("aggregate road geometry cannot erase a compiler-trimmed segment pavement band", () => {
  const segment = horizontalRoad();
  const overlappingRoadAuthority = {
    id: "road-junction:test",
    x: 40,
    y: 70,
    w: 120,
    h: 120,
    geometry: "rect",
    pieceKind: "junction",
    kind: "road"
  };
  const generated = buildRoadEdgeSidewalkInfill({
    roadSegments: [segment],
    roads: [segment, overlappingRoadAuthority],
    world: { width: 400, height: 300 }
  });
  assert.deepEqual(
    generated.filter(surface => surface.side === "north").map(surface => [surface.x, surface.w]),
    [[0, 200]]
  );
});

test("alley pavement remains opt-in", () => {
  const alley = horizontalRoad({
    id: "road-segment:alley",
    graphEdgeId: "road-edge:alley",
    roadClass: "alley",
    kind: "alley"
  });
  assert.deepEqual(buildRoadEdgeSidewalkInfill({
    roadSegments: [alley],
    roads: [alley],
    world: { width: 400, height: 300 }
  }), []);
  assert.equal(buildRoadEdgeSidewalkInfill({
    roadSegments: [alley],
    roads: [alley],
    world: { width: 400, height: 300 },
    includeAlleys: true
  }).length, 2);
});

test("completed collection keeps authored surfaces and adds two road-owned bands per segment", () => {
  const segment = horizontalRoad();
  const authored = [northWalk("north-authored", 0, 200)];
  const completed = buildCompletedSidewalkSurfaces({
    roadSegments: [segment],
    roads: [segment],
    sidewalks: authored,
    world: { width: 400, height: 300 }
  });
  assert.deepEqual(completed.slice(0, authored.length), authored);
  assert.equal(completed.filter(surface => surface.authoritativeRoadEdge).length, 2);
});

test("production city generates exactly two authoritative pavement bands per standard road segment", () => {
  const completed = buildCompletedSidewalkSurfaces({
    roadSegments: productionRoadSegments,
    roads: productionRoads,
    sidewalks: productionSidewalks,
    world: CITY_WORLD,
    sidewalkWidth: 22
  });
  assert.ok(completed.some(surface => surface.authoritativeRoadEdge));
  const audit = auditRoadEdgeSidewalkCoverage({
    roadSegments: productionRoadSegments,
    roads: productionRoads,
    sidewalks: completed,
    world: CITY_WORLD,
    sidewalkWidth: 22
  });
  assert.equal(audit.valid, true, JSON.stringify(audit.gaps.slice(0, 20)));
});
