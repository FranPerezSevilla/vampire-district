import test from "node:test";
import assert from "node:assert/strict";

import {
  compileAxisAlignedRoadGraph,
  deriveAxisAlignedRoadGraph,
  roadGraphIntegrity
} from "../tools/city-compiler/road-graph.js";
import {
  pointInRect,
  pointInSurface,
  surfaceOverlapArea
} from "../tools/city-compiler/geometry.js";
import { cityRoadGraph } from "../tools/city-compiler/city-road-graph-v1.js";
import {
  buildings,
  crosswalks,
  dumpsters,
  junctionSidewalks,
  lights,
  propExclusionZones,
  roadGraphEdges,
  roadGraphNodes,
  roadJunctions,
  roadTransitions,
  roads,
  sidewalks,
  CITY_WORLD
} from "../phaser/src/data/district.js";

const world = Object.freeze({ width: 600, height: 400 });

function graph(nodes, edges, extra = {}) {
  return {
    version: 1,
    geometry: "axis-aligned-centreline-graph",
    nodes,
    edges,
    corridors: [],
    authoredLightAnchors: [],
    ...extra
  };
}

function assertNoRoadOverlap(items) {
  for (let left = 0; left < items.length; left++) {
    for (let right = left + 1; right < items.length; right++) {
      assert.ok(
        surfaceOverlapArea(items[left], items[right]) <= 0.01,
        `${items[left].id} overlaps ${items[right].id}`
      );
    }
  }
}

function continuationPoints(crosswalk) {
  return crosswalk.orientation === "horizontal"
    ? [
        { x: crosswalk.x - 1, y: crosswalk.y + crosswalk.h / 2 },
        { x: crosswalk.x + crosswalk.w + 1, y: crosswalk.y + crosswalk.h / 2 }
      ]
    : [
        { x: crosswalk.x + crosswalk.w / 2, y: crosswalk.y - 1 },
        { x: crosswalk.x + crosswalk.w / 2, y: crosswalk.y + crosswalk.h + 1 }
      ];
}

test("rectangle input is converted into an authoritative graph before geometry is emitted", () => {
  const source = [
    { id: "horizontal", x: 20, y: 160, w: 560, h: 80, kind: "road" },
    { id: "vertical", x: 260, y: 20, w: 80, h: 360, kind: "road" }
  ];
  const derived = deriveAxisAlignedRoadGraph(source);
  const compiled = compileAxisAlignedRoadGraph(derived, { world });

  assert.ok(derived.nodes.some(node => node.x === 300 && node.y === 200));
  assert.equal(compiled.graph.nodes.find(node => node.x === 300 && node.y === 200)?.junctionKind, "crossroad");
  assert.equal(roadGraphIntegrity(derived, compiled).valid, true);
  assertNoRoadOverlap(compiled.roads);
});

test("a right-angle corner owns one junction surface and clipped approach segments", () => {
  const source = graph(
    [
      { id: "a", x: 60, y: 80 },
      { id: "corner", x: 300, y: 80 },
      { id: "c", x: 300, y: 330 }
    ],
    [
      { id: "west", from: "a", to: "corner", width: 80, orientation: "horizontal", roadClass: "local", kind: "road", sourceRoadIds: ["west"] },
      { id: "south", from: "corner", to: "c", width: 80, orientation: "vertical", roadClass: "local", kind: "road", sourceRoadIds: ["south"] }
    ]
  );
  const compiled = compileAxisAlignedRoadGraph(source, { world });
  const authority = compiled.roadJunctions.find(piece => piece.graphNodeIds.includes("corner"));

  assert.equal(authority.junctionKind, "corner");
  assert.equal(compiled.roadJunctions.filter(piece => piece.graphNodeIds.includes("corner")).length, 1);
  assert.equal(compiled.roadSegments.length, 2);
  assert.equal(roadGraphIntegrity(source, compiled).valid, true);
  assertNoRoadOverlap(compiled.roads);
});

test("a T junction between a narrow local street and a major road has one central authority", () => {
  const source = graph(
    [
      { id: "west", x: 40, y: 200 },
      { id: "junction", x: 300, y: 200 },
      { id: "east", x: 560, y: 200 },
      { id: "north", x: 300, y: 40 }
    ],
    [
      { id: "major-west", from: "west", to: "junction", width: 120, orientation: "horizontal", roadClass: "major", kind: "road", sourceRoadIds: ["major"] },
      { id: "major-east", from: "junction", to: "east", width: 120, orientation: "horizontal", roadClass: "major", kind: "road", sourceRoadIds: ["major"] },
      { id: "local-north", from: "north", to: "junction", width: 64, orientation: "vertical", roadClass: "local", kind: "road", sourceRoadIds: ["local"] }
    ]
  );
  const compiled = compileAxisAlignedRoadGraph(source, { world });
  const authority = compiled.roadJunctions.find(piece => piece.graphNodeIds.includes("junction"));

  assert.equal(authority.junctionKind, "t-junction");
  assert.equal(authority.w, 64);
  assert.equal(authority.h, 120);
  assert.equal(compiled.crosswalks.length, 3);
  assert.equal(roadGraphIntegrity(source, compiled).valid, true);
  assertNoRoadOverlap(compiled.roads);
});

test("a collinear width change is emitted as one tapered transition polygon", () => {
  const source = graph(
    [
      { id: "west", x: 40, y: 200 },
      { id: "transition", x: 300, y: 200 },
      { id: "east", x: 560, y: 200 }
    ],
    [
      { id: "narrow", from: "west", to: "transition", width: 56, orientation: "horizontal", roadClass: "local", kind: "road", sourceRoadIds: ["narrow"] },
      { id: "wide", from: "transition", to: "east", width: 120, orientation: "horizontal", roadClass: "major", kind: "road", sourceRoadIds: ["wide"] }
    ]
  );
  const compiled = compileAxisAlignedRoadGraph(source, { world });

  assert.equal(compiled.roadTransitions.length, 1);
  assert.equal(compiled.roadTransitions[0].geometry, "polygon");
  assert.equal(compiled.roadTransitions[0].points.length, 4);
  assert.equal(roadGraphIntegrity(source, compiled).valid, true);
  assertNoRoadOverlap(compiled.roads);
});

test("crosswalks are outside the junction centre and connect two final sidewalks", () => {
  assert.ok(crosswalks.length > 0);
  for (const crossing of crosswalks) {
    assert.equal(roads.some(road => surfaceOverlapArea(crossing, road) > 0.01), true, crossing.id);
    assert.equal(
      continuationPoints(crossing).every(point => sidewalks.some(sidewalk => pointInSurface(point, sidewalk, 1.5))),
      true,
      crossing.id
    );
    assert.equal(roadJunctions.some(junction => surfaceOverlapArea(crossing, junction) > 0.01), false, crossing.id);
  }
});

test("streetlights are post-layout furniture clear of roads, crossings and buildings", () => {
  assert.ok(lights.length > 0);
  for (const light of lights) {
    const point = { x: light.x, y: light.y };
    assert.equal(light.placementPhase, "post-layout", light.id);
    assert.equal(light.anchorKind, "kerb-light", light.id);
    assert.equal(sidewalks.some(sidewalk => pointInSurface(point, sidewalk)), true, light.id);
    assert.equal(roads.some(road => pointInSurface(point, road)), false, light.id);
    assert.equal(crosswalks.some(crossing => pointInSurface(point, crossing)), false, light.id);
    assert.equal(propExclusionZones.some(zone => pointInSurface(point, zone)), false, light.id);
    assert.equal(buildings.some(building => pointInRect(point, building, 8)), false, light.id);
  }
});


test("junction-owned sidewalks close missing legs without intruding into carriageways", () => {
  const source = graph(
    [
      { id: "west", x: 40, y: 200 },
      { id: "junction", x: 300, y: 200 },
      { id: "east", x: 560, y: 200 },
      { id: "north", x: 300, y: 40 }
    ],
    [
      { id: "major-west", from: "west", to: "junction", width: 120, orientation: "horizontal", roadClass: "major", kind: "road", sourceRoadIds: ["major"] },
      { id: "major-east", from: "junction", to: "east", width: 120, orientation: "horizontal", roadClass: "major", kind: "road", sourceRoadIds: ["major"] },
      { id: "local-north", from: "north", to: "junction", width: 64, orientation: "vertical", roadClass: "local", kind: "road", sourceRoadIds: ["local"] }
    ]
  );
  const compiled = compileAxisAlignedRoadGraph(source, { world });
  const owned = compiled.junctionSidewalks.filter(item => item.graphNodeIds.includes("junction"));

  assert.ok(owned.some(item => item.role === "closure" && item.side === "south"));
  assert.ok(owned.some(item => item.role === "corner"));
  assert.equal(owned.every(sidewalk => compiled.roads.every(road => surfaceOverlapArea(sidewalk, road) <= 0.01)), true);
});

test("width transitions own two polygonal kerb surfaces", () => {
  const source = graph(
    [
      { id: "west", x: 40, y: 200 },
      { id: "transition", x: 300, y: 200 },
      { id: "east", x: 560, y: 200 }
    ],
    [
      { id: "narrow", from: "west", to: "transition", width: 56, orientation: "horizontal", roadClass: "local", kind: "road", sourceRoadIds: ["narrow"] },
      { id: "wide", from: "transition", to: "east", width: 120, orientation: "horizontal", roadClass: "major", kind: "road", sourceRoadIds: ["wide"] }
    ]
  );
  const compiled = compileAxisAlignedRoadGraph(source, { world });
  const transitionWalks = compiled.junctionSidewalks.filter(item => item.graphNodeIds.includes("transition"));

  assert.equal(transitionWalks.length, 2);
  assert.equal(transitionWalks.every(item => item.geometry === "polygon" && item.role === "transition-offset"), true);
});

test("dumpsters are snapped after layout outside junction and crosswalk exclusions", () => {
  assert.equal(dumpsters.length > 0, true);
  for (const dumpster of dumpsters) {
    const point = { x: dumpster.x, y: dumpster.y };
    assert.equal(dumpster.placementPhase, "post-layout", dumpster.id);
    assert.ok(["service-kerb", "service-yard"].includes(dumpster.anchorKind), dumpster.id);
    assert.equal(roads.some(road => pointInSurface(point, road, 6)), false, dumpster.id);
    assert.equal(crosswalks.some(crosswalk => pointInSurface(point, crosswalk, 24)), false, dumpster.id);
    assert.equal(propExclusionZones.some(zone => pointInSurface(point, zone)), false, dumpster.id);
    assert.equal(buildings.some(building => pointInRect(point, building, 18)), false, dumpster.id);
  }
});

test("the full city is reproducible from its explicit road graph with no road-piece overlap", () => {
  const compiled = compileAxisAlignedRoadGraph(cityRoadGraph, {
    world: CITY_WORLD,
    buildings,
    sidewalkWidth: 22,
    crosswalkThickness: 14,
    crosswalkInset: 8,
    lightSpacingMajor: 360,
    lightSpacingLocal: 300,
    lightSpacingAlley: 260,
    lightMinimumSpacing: 150
  });

  assert.equal(roadGraphNodes.length, cityRoadGraph.nodes.length);
  assert.equal(roadGraphEdges.length, cityRoadGraph.edges.length);
  assert.equal(compiled.stats.graphNodeCount, 114);
  assert.equal(compiled.stats.graphEdgeCount, 158);
  assert.equal(compiled.stats.roadSegmentCount, 153);
  assert.equal(compiled.stats.transitionCount, roadTransitions.length);
  assert.equal(compiled.stats.sidewalkCount, 741);
  assert.equal(compiled.stats.junctionSidewalkCount, junctionSidewalks.length);
  assert.equal(compiled.stats.crosswalkCount, 137);
  assert.equal(compiled.stats.propExclusionZoneCount, propExclusionZones.length);
  assert.equal(compiled.stats.lightCount, 105);
  assert.equal(roadGraphIntegrity(cityRoadGraph, compiled).valid, true);
  assertNoRoadOverlap(compiled.roads);
});
