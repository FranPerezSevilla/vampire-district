import assert from "node:assert/strict";
import test from "node:test";

import {
  CITY_WORLD,
  roadJunctions as productionRoadJunctions,
  roadSegments as productionRoadSegments,
  roadTransitions as productionRoadTransitions,
  sidewalks as productionSidewalks
} from "../phaser/src/data/generated/city-topology-v2.js";
import {
  auditRoadEdgeSidewalkCoverage,
  buildCompletedSidewalkSurfaces,
  buildJunctionSidewalkInfill,
  buildRoadEdgeSidewalkInfill
} from "../phaser/src/rendering/SidewalkSurfaceCompletion.js";

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

function junctionFixture(kind = "crossroad") {
  return {
    id: "road-junction:test",
    graphNodeId: "node:center",
    graphNodeIds: ["node:center"],
    x: 100,
    y: 100,
    w: 60,
    h: 60,
    geometry: "rect",
    pieceKind: "junction",
    junctionKind: kind,
    kind: "road"
  };
}

function junctionLegs(directions) {
  const result = [];
  if (directions.includes("west")) result.push(horizontalRoad({
    id: "road-segment:west",
    graphEdgeId: "road-edge:west",
    x: 0,
    y: 100,
    w: 100,
    h: 60,
    fromNodeId: "node:west",
    toNodeId: "node:center"
  }));
  if (directions.includes("east")) result.push(horizontalRoad({
    id: "road-segment:east",
    graphEdgeId: "road-edge:east",
    x: 160,
    y: 100,
    w: 100,
    h: 60,
    fromNodeId: "node:center",
    toNodeId: "node:east"
  }));
  if (directions.includes("north")) result.push({
    ...horizontalRoad(),
    id: "road-segment:north",
    graphEdgeId: "road-edge:north",
    x: 100,
    y: 0,
    w: 60,
    h: 100,
    orientation: "vertical",
    fromNodeId: "node:north",
    toNodeId: "node:center"
  });
  if (directions.includes("south")) result.push({
    ...horizontalRoad(),
    id: "road-segment:south",
    graphEdgeId: "road-edge:south",
    x: 100,
    y: 160,
    w: 60,
    h: 100,
    orientation: "vertical",
    fromNodeId: "node:center",
    toNodeId: "node:south"
  });
  return result;
}

function geometry(surface) {
  return [surface.x, surface.y, surface.w, surface.h];
}

test("road-edge pavement is a full authoritative band even when authored sidewalks contain a gap", () => {
  const segment = horizontalRoad();
  const authored = [northWalk("north-left", 0, 60), northWalk("north-right", 140, 60)];
  const generated = buildRoadEdgeSidewalkInfill({
    roadSegments: [segment],
    sidewalks: authored,
    world: { width: 400, height: 300 }
  });
  const north = generated.filter(surface => surface.side === "north");
  assert.deepEqual(north.map(surface => [surface.x, surface.y, surface.w, surface.h]), [[0, 78, 200, 22]]);
  assert.equal(north[0].authoritativeRoadEdge, true);
});

test("building footprints cannot erase or split the road-owned pavement band", () => {
  const segment = horizontalRoad();
  const building = { id: "overlapping-building", x: 40, y: 70, w: 120, h: 40 };
  const generated = buildRoadEdgeSidewalkInfill({
    roadSegments: [segment],
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

test("alleys and service roads receive the same road-edge sidewalk contract", () => {
  const alley = horizontalRoad({
    id: "road-segment:alley",
    graphEdgeId: "road-edge:alley",
    roadClass: "alley",
    kind: "alley"
  });
  const generated = buildRoadEdgeSidewalkInfill({
    roadSegments: [alley],
    world: { width: 400, height: 300 }
  });
  assert.equal(generated.length, 2);
  assert.deepEqual(generated.map(surface => surface.side).sort(), ["north", "south"]);
});

test("crossroads leave only four paved corners around the four carriageway openings", () => {
  const junction = junctionFixture("crossroad");
  const generated = buildJunctionSidewalkInfill({
    roadJunctions: [junction],
    roadSegments: junctionLegs(["north", "east", "south", "west"]),
    world: { width: 400, height: 400 },
    sidewalkWidth: 22
  });
  assert.deepEqual(generated.map(geometry).sort((a, b) => a[1] - b[1] || a[0] - b[0]), [
    [78, 78, 22, 22],
    [160, 78, 22, 22],
    [78, 160, 22, 22],
    [160, 160, 22, 22]
  ]);
  assert.ok(generated.every(surface => surface.authoritativeJunctionSidewalk === true));
  const northRoadOpening = { x: 100, y: 78, w: 60, h: 22 };
  assert.ok(generated.every(surface => !overlaps(surface, northRoadOpening)));
});

test("a T junction paves the closed side and keeps the open road mouth clear", () => {
  const junction = junctionFixture("t-junction");
  const generated = buildJunctionSidewalkInfill({
    roadJunctions: [junction],
    roadSegments: junctionLegs(["east", "south", "west"]),
    world: { width: 400, height: 400 },
    sidewalkWidth: 22
  });
  assert.deepEqual(generated.map(geometry).sort((a, b) => a[1] - b[1] || a[0] - b[0]), [
    [78, 78, 104, 22],
    [78, 160, 22, 22],
    [160, 160, 22, 22]
  ]);
  const southRoadOpening = { x: 100, y: 160, w: 60, h: 22 };
  assert.ok(generated.every(surface => !overlaps(surface, southRoadOpening)));
});

test("straight junction authority bridges both pavement sides without covering carriageway", () => {
  const junction = junctionFixture("straight");
  const generated = buildJunctionSidewalkInfill({
    roadJunctions: [junction],
    roadSegments: junctionLegs(["east", "west"]),
    world: { width: 400, height: 400 },
    sidewalkWidth: 22
  });
  assert.deepEqual(generated.map(geometry).sort((a, b) => a[1] - b[1]), [
    [78, 78, 104, 22],
    [78, 160, 104, 22]
  ]);
});

test("junction completion ignores a building footprint instead of deleting pavement", () => {
  const junction = junctionFixture("crossroad");
  const building = { id: "legacy-corner-building", x: 78, y: 78, w: 22, h: 22 };
  const generated = buildJunctionSidewalkInfill({
    roadJunctions: [junction],
    roadSegments: junctionLegs(["north", "east", "south", "west"]),
    buildings: [building],
    world: { width: 400, height: 400 },
    sidewalkWidth: 22
  });
  const northwest = generated.find(surface => surface.x === 78 && surface.y === 78);
  assert.ok(northwest);
  assert.ok(overlaps(northwest, building));
});

test("compound junction clusters subtract each local road mouth from the correct boundary side", () => {
  const cluster = {
    id: "road-junction-cluster:test",
    graphNodeId: "node:nw",
    graphNodeIds: ["node:nw", "node:ne", "node:sw", "node:se"],
    x: 100,
    y: 100,
    w: 200,
    h: 120,
    geometry: "rect",
    pieceKind: "junction",
    junctionKind: "complex-cluster",
    kind: "road"
  };
  const segments = [
    { ...horizontalRoad(), id: "north-leg", x: 120, y: 0, w: 60, h: 100, orientation: "vertical", fromNodeId: "outside:north", toNodeId: "node:nw" },
    { ...horizontalRoad(), id: "south-leg", x: 220, y: 220, w: 60, h: 100, orientation: "vertical", fromNodeId: "node:se", toNodeId: "outside:south" },
    { ...horizontalRoad(), id: "west-leg", x: 0, y: 120, w: 100, h: 60, orientation: "horizontal", fromNodeId: "outside:west", toNodeId: "node:nw" },
    { ...horizontalRoad(), id: "east-leg", x: 300, y: 140, w: 100, h: 60, orientation: "horizontal", fromNodeId: "node:ne", toNodeId: "outside:east" }
  ];
  const generated = buildJunctionSidewalkInfill({
    roadJunctions: [cluster],
    roadSegments: segments,
    world: { width: 500, height: 500 },
    sidewalkWidth: 22
  });

  const northOpening = { x: 120, y: 78, w: 60, h: 22 };
  const southOpening = { x: 220, y: 220, w: 60, h: 22 };
  const westOpening = { x: 78, y: 120, w: 22, h: 60 };
  const eastOpening = { x: 300, y: 140, w: 22, h: 60 };
  assert.ok(generated.length >= 4);
  for (const opening of [northOpening, southOpening, westOpening, eastOpening]) {
    assert.ok(generated.every(surface => !overlaps(surface, opening)));
  }
  assert.ok(generated.some(surface => surface.side === "north" && surface.x === 78 && surface.w === 42));
  assert.ok(generated.some(surface => surface.side === "north" && surface.x === 180 && surface.w === 142));
});

test("completion never invents pavement between the 22 px band and a distant facade", () => {
  const segment = horizontalRoad();
  const building = { id: "setback-building", x: 20, y: 10, w: 160, h: 30 };
  const completed = buildCompletedSidewalkSurfaces({
    roadSegments: [segment],
    sidewalks: [],
    buildings: [building],
    world: { width: 400, height: 300 },
    sidewalkWidth: 22
  });
  const north = completed.filter(surface => surface.side === "north");
  assert.deepEqual(north.map(surface => [surface.y, surface.h]), [[78, 22]]);
});

test("completed collection keeps authored surfaces and adds two road-owned bands per segment", () => {
  const segment = horizontalRoad();
  const authored = [northWalk("north-authored", 0, 200)];
  const completed = buildCompletedSidewalkSurfaces({
    roadSegments: [segment],
    sidewalks: authored,
    world: { width: 400, height: 300 }
  });
  assert.deepEqual(completed.slice(0, authored.length), authored);
  assert.equal(completed.filter(surface => surface.authoritativeRoadEdge).length, 2);
});

test("production city completes both segment bands and junction-owned pavement", () => {
  const completed = buildCompletedSidewalkSurfaces({
    roadSegments: productionRoadSegments,
    roadJunctions: productionRoadJunctions,
    roadTransitions: productionRoadTransitions,
    sidewalks: productionSidewalks,
    world: CITY_WORLD,
    sidewalkWidth: 22
  });
  assert.ok(completed.some(surface => surface.authoritativeRoadEdge));
  assert.ok(completed.some(surface => surface.authoritativeJunctionSidewalk));
  const audit = auditRoadEdgeSidewalkCoverage({
    roadSegments: productionRoadSegments,
    sidewalks: completed,
    world: CITY_WORLD,
    sidewalkWidth: 22
  });
  assert.equal(audit.valid, true, JSON.stringify(audit.gaps.slice(0, 20)));
});
