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

test("crossroads receive all four authoritative corner pads", () => {
  const junction = junctionFixture("crossroad");
  const generated = buildJunctionSidewalkInfill({
    roadJunctions: [junction],
    roadSegments: junctionLegs(["north", "east", "south", "west"]),
    world: { width: 400, height: 400 },
    sidewalkWidth: 22
  });
  const corners = generated.filter(surface => surface.role === "corner");
  assert.equal(corners.length, 4);
  assert.deepEqual(
    corners.map(surface => [surface.corner, surface.x, surface.y, surface.w, surface.h]).sort(),
    [
      ["ne", 160, 78, 22, 22],
      ["nw", 78, 78, 22, 22],
      ["se", 160, 160, 22, 22],
      ["sw", 78, 160, 22, 22]
    ]
  );
  assert.ok(corners.every(surface => surface.authoritativeJunctionSidewalk === true));
});

test("a T junction closes only its missing leg while retaining corner pavement", () => {
  const junction = junctionFixture("t-junction");
  const generated = buildJunctionSidewalkInfill({
    roadJunctions: [junction],
    roadSegments: junctionLegs(["east", "south", "west"]),
    world: { width: 400, height: 400 },
    sidewalkWidth: 22
  });
  const closures = generated.filter(surface => surface.role === "closure");
  assert.deepEqual(closures.map(surface => [surface.side, surface.x, surface.y, surface.w, surface.h]), [
    ["north", 100, 78, 60, 22]
  ]);
  assert.equal(generated.filter(surface => surface.role === "corner").length, 4);
});

test("straight junction authority bridges the two side pavements", () => {
  const junction = junctionFixture("straight");
  const generated = buildJunctionSidewalkInfill({
    roadJunctions: [junction],
    roadSegments: junctionLegs(["east", "west"]),
    world: { width: 400, height: 400 },
    sidewalkWidth: 22
  });
  assert.deepEqual(
    generated.map(surface => [surface.role, surface.side]).sort(),
    [["closure", "north"], ["closure", "south"]]
  );
});

test("junction completion ignores a building footprint instead of deleting the cap", () => {
  const junction = junctionFixture("crossroad");
  const building = { id: "legacy-corner-building", x: 78, y: 78, w: 22, h: 22 };
  const generated = buildJunctionSidewalkInfill({
    roadJunctions: [junction],
    roadSegments: junctionLegs(["north", "east", "south", "west"]),
    buildings: [building],
    world: { width: 400, height: 400 },
    sidewalkWidth: 22
  });
  const northwest = generated.find(surface => surface.corner === "nw");
  assert.ok(northwest);
  assert.ok(overlaps(northwest, building));
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
