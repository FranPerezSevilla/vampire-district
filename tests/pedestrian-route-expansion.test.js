import test from "node:test";
import assert from "node:assert/strict";

import {
  districtZones,
  districtZoneAt,
  LAYERS,
  pedestrianRoutes,
  pointOnPedestrianSurface,
  streetNavigationPoints
} from "../phaser/src/data/district.js";
import {
  AMBIENT_PEDESTRIANS_PER_ROUTE,
  NPC_TYPES,
  npcDefinitions
} from "../phaser/src/data/npcs.js";

const EXPANDED_ROUTE_IDS = Object.freeze([
  "hospital_perimeter_loop",
  "hospital_west_access_loop",
  "hospital_central_access_loop",
  "hospital_east_access_loop",
  "west_market_vertical_loop",
  "west_market_north_loop",
  "west_market_south_loop",
  "old_quarter_service_loop",
  "old_quarter_north_service_loop",
  "old_quarter_south_service_loop",
  "university_court_loop",
  "university_north_loop",
  "university_south_loop",
  "canal_west_loop",
  "canal_west_north_loop",
  "canal_west_south_loop",
  "north_harbor_vertical_loop",
  "north_harbor_north_loop",
  "north_harbor_south_loop",
  "south_harbor_freight_loop",
  "south_harbor_west_loop",
  "south_harbor_east_loop"
]);

function activeStreetCivilians() {
  return npcDefinitions.filter(definition => (
    definition.type === NPC_TYPES.CIVILIAN
    && definition.layer === LAYERS.STREET
    && !definition.inactive
  ));
}

test("population grows through new pedestrian routes instead of increasing per-route density", () => {
  assert.equal(AMBIENT_PEDESTRIANS_PER_ROUTE, 6);
  assert.equal(pedestrianRoutes.length, 33);
  assert.ok(EXPANDED_ROUTE_IDS.every(id => pedestrianRoutes.some(route => route.id === id)));

  const civilians = activeStreetCivilians();
  const routed = civilians.filter(definition => definition.pedestrianRouteId);

  for (const route of pedestrianRoutes) {
    const occupants = routed.filter(definition => definition.pedestrianRouteId === route.id);
    assert.equal(
      occupants.length,
      Math.min(AMBIENT_PEDESTRIANS_PER_ROUTE, route.points.length),
      `${route.id} should gain no extra density beyond its route capacity`
    );
  }

  const expectedRouted = pedestrianRoutes.reduce(
    (total, route) => total + Math.min(AMBIENT_PEDESTRIANS_PER_ROUTE, route.points.length),
    0
  );
  assert.equal(routed.length, expectedRouted);
  assert.ok(routed.length >= 132, "expanded coverage should more than double routed city pedestrians");
});

test("routed civilians never share the same initial street tile", () => {
  const routed = activeStreetCivilians().filter(definition => definition.pedestrianRouteId);
  const occupiedTiles = routed.map(definition => `${Math.round(definition.x)}:${Math.round(definition.y)}`);
  assert.equal(new Set(occupiedTiles).size, occupiedTiles.length);
});

test("pedestrian routes cover every semantic district on valid pedestrian geometry", () => {
  const coveredZones = new Set();

  for (const route of pedestrianRoutes) {
    assert.ok(route.points.length >= 4, `${route.id} should remain a traversable loop`);
    for (const point of route.points) {
      assert.ok(
        pointOnPedestrianSurface(point.x, point.y),
        `${route.id} point ${point.x}:${point.y} must stay on pedestrian geometry`
      );
      coveredZones.add(districtZoneAt(point.x, point.y).id);
    }
  }

  assert.deepEqual(
    [...coveredZones].sort(),
    districtZones.map(zone => zone.id).sort(),
    "pedestrian routing should reach all semantic city districts"
  );
});

test("new route origins and destinations are represented in street navigation", () => {
  for (const routeId of EXPANDED_ROUTE_IDS) {
    const route = pedestrianRoutes.find(candidate => candidate.id === routeId);
    const navigation = streetNavigationPoints.filter(point => point.routeId === routeId);
    assert.ok(route);
    assert.equal(navigation.length, route.points.length);
    assert.deepEqual(
      navigation.map(point => [point.x, point.y]),
      route.points.map(point => [point.x, point.y])
    );
  }
});

test("key locations expose contextual ambient activity", () => {
  const activities = new Set(activeStreetCivilians().map(definition => definition.ambientActivity).filter(Boolean));
  assert.ok(activities.has("hospital-arrival"));
  assert.ok(activities.has("hospital-departure"));
  assert.ok(activities.has("police-station-arrival"));
  assert.ok(activities.has("police-station-departure"));
  assert.ok(activities.has("club-queue"));
  assert.ok(activities.has("church-prayer"));
});
