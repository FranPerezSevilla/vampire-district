import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as city from "../phaser/src/data/generated/city-topology-v2.js";
import { pedestrianRoutes } from "../phaser/src/data/district.js";
import { cityRoadGraph } from "../tools/city-compiler/city-road-graph-v1.js";
import { fitCityRoadClearance, fitRoadClearance } from "../tools/city-compiler/road-clearance.js";
import { pointInRect, pointInSurface, rectOverlapArea, sampleSegment } from "../tools/city-compiler/geometry.js";
import { VEHICLE_ARCHETYPES } from "../phaser/src/data/vehicles.js";

test("wider city lanes use the additional pavement with full-size bus clearance", () => {
  const topology = JSON.parse(readFileSync(new URL("../phaser/assets/city/packs/traffic-lanes.json", import.meta.url))).localTopology;
  assert.deepEqual(new Set(cityRoadGraph.edges.filter(edge => edge.roadClass === "major").map(edge => edge.width)), new Set([150]));
  assert.deepEqual(new Set(cityRoadGraph.edges.filter(edge => edge.roadClass === "local").map(edge => edge.width)), new Set([96]));
  assert.deepEqual(new Set(cityRoadGraph.edges.filter(edge => edge.roadClass === "alley").map(edge => edge.width)), new Set([88]));
  for (const lane of Object.values(topology.lanes)) {
    const count = lane.roadClass === "major" ? 2 : 1;
    assert.equal(lane.lanesPerDirection, count);
    const laneWidth = lane.roadWidth / (count * 2);
    assert.equal(lane.laneOffset, laneWidth * (lane.laneIndex + 0.5));
    assert.ok(laneWidth - VEHICLE_ARCHETYPES.bus.height >= 15.5, `${lane.id}: bus lateral clearance`);
    assert.ok(lane.laneOffset + VEHICLE_ARCHETYPES.bus.height / 2 < lane.roadWidth / 2);
  }
  assert.ok(Object.values(topology.nodes).some(node => node.trimDistance === 75), "avenue approaches grow with the wider junction");
});

test("every building and landmark survives outside the widened road reservations", () => {
  assert.equal(city.buildings.length, 93);
  for (const building of city.buildings) {
    assert.ok(building.w >= 32 && building.h >= 32, building.id);
    for (const road of city.roads) {
      const reserved = { x: road.x - 26, y: road.y - 26, w: road.w + 52, h: road.h + 52 };
      assert.ok(rectOverlapArea(building, reserved) < 0.001, `${building.id}: ${road.id}`);
    }
  }
  for (const site of city.landmarkSites) {
    const building = city.buildings.find(item => item.id === site.landmarkId);
    assert.ok(building, site.id);
    assert.ok(pointInRect({ x: building.x, y: building.y }, site));
    assert.ok(pointInRect({ x: building.x + building.w, y: building.y + building.h }, site));
    assert.ok(city.roads.every(road => rectOverlapArea(site, road) < 0.001), site.id);
  }
});

test("all authored and generated pedestrian loops follow their actual sidewalk", () => {
  for (const route of pedestrianRoutes) {
    const sidewalk = city.sidewalks.find(item => item.id === route.sidewalkId);
    assert.ok(sidewalk, route.id);
    for (let index = 0; index < route.points.length; index++) {
      assert.ok(sampleSegment(route.points[index], route.points[(index + 1) % route.points.length], 8)
        .every(point => pointInSurface(point, sidewalk)), route.id);
    }
  }
});

test("road reservation fitting is idempotent and rejects removing a building centre", () => {
  assert.deepEqual(fitCityRoadClearance(city, city.roads), {
    buildings: city.buildings, landmarkSites: city.landmarkSites, roofAreas: city.roofAreas,
    roofDrops: city.roofDrops, fireEscapes: city.fireEscapes, rooftopRoutes: city.rooftopRoutes
  });
  assert.throws(() => fitRoadClearance({ id: "house", x: 0, y: 0, w: 100, h: 100 },
    [{ id: "avenue", x: 40, y: -100, w: 20, h: 300 }]), /cannot preserve house/);
});

test("shrinking a façade retains roof insets and maps attached roof traversal endpoints", () => {
  const fixture = {
    buildings: [{ id: "house", x: 100, y: 100, w: 200, h: 200 }], landmarkSites: [],
    roofAreas: { 1: [{ id: "roof", buildingId: "house", x: 106, y: 106, w: 188, h: 188 }] },
    roofDrops: [{ roof: { x: 106, y: 200, layer: 1 }, street: { x: 90, y: 200 } }],
    fireEscapes: [{ roof: { x: 200, y: 294, layer: 1 }, street: { x: 200, y: 340 } }],
    rooftopRoutes: [{ ax: 106, ay: 200, aLayer: 1, bx: 400, by: 200, bLayer: 2 }]
  };
  const fitted = fitCityRoadClearance(fixture, [{ id: "street", x: 40, y: 0, w: 60, h: 400 }]);
  assert.deepEqual(fitted.buildings[0], { id: "house", x: 126, y: 100, w: 174, h: 200 });
  assert.equal(fitted.roofAreas[1][0].x, 132);
  assert.equal(fitted.roofAreas[1][0].w, 162);
  assert.equal(fitted.roofDrops[0].roof.x, 132);
  assert.deepEqual(fitted.roofDrops[0].street, fixture.roofDrops[0].street);
  assert.equal(fitted.rooftopRoutes[0].ax, 132);
  assert.equal(fitted.rooftopRoutes[0].bx, 400);
  assert.equal(fixture.buildings[0].x, 100, "the source is not mutated");
});
