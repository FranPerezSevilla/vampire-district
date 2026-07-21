import test from "node:test";
import assert from "node:assert/strict";

import {
  SELECTED_CITY_CANDIDATE,
  buildings,
  crosswalks,
  dumpsters,
  fireEscapes,
  lights,
  pedestrianRoutes,
  pointOnPedestrianSurface,
  roads,
  roofAreas,
  rooftopRoutes,
  sewerAccesses,
  shadowZones,
  sidewalks,
  streetNavigationPoints
} from "../phaser/src/data/district.js";
import { vehicleDefinitions } from "../phaser/src/data/vehicles.js";
import { selectedFoundryCandidate } from "../tools/city-compiler/foundry-selection.js";
import { scoreCityBlueprint } from "../tools/city-compiler/score.js";
import { validateCityBlueprint } from "../tools/city-compiler/validate.js";

const GENERATED_PREFIX = "foundry:";

function generated(items = []) {
  return items
    .filter(item => String(item?.id || "").startsWith(GENERATED_PREFIX))
    .map(item => {
      const copy = structuredClone(item);
      delete copy.generated;
      return copy;
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function coordinates(items = []) {
  return items
    .map(item => ({ id: item.id || null, x: Number(item.x), y: Number(item.y) }))
    .sort((left, right) => String(left.id).localeCompare(String(right.id)) || left.x - right.x || left.y - right.y);
}

test("the playable district is locked to foundry-pilot-04", () => {
  assert.equal(SELECTED_CITY_CANDIDATE, "foundry-pilot-04");
  assert.equal(buildings.some(item => item.id === "northFoundry"), false);
  assert.equal(buildings.some(item => item.id === "foundryOffices"), false);
  assert.equal(buildings.some(item => item.id === "foundryStores"), false);
  assert.equal(buildings.some(item => item.id === "harborRegistry"), true);
  assert.equal(vehicleDefinitions.some(item => item.id === "foundry:vehicle:utility"), true);
});

test("static Foundry runtime data cannot drift from the selected compiler seed", () => {
  const compiled = selectedFoundryCandidate().runtime;
  const playable = {
    roads,
    sidewalks,
    crosswalks,
    buildings,
    roofAreas,
    rooftopRoutes,
    fireEscapes,
    sewerAccesses,
    lights,
    dumpsters,
    shadowZones,
    pedestrianRoutes,
    streetNavigationPoints,
    vehicles: vehicleDefinitions
  };

  for (const key of ["roads", "sidewalks", "crosswalks", "buildings", "rooftopRoutes", "fireEscapes", "sewerAccesses", "lights", "dumpsters", "shadowZones", "pedestrianRoutes", "vehicles"]) {
    assert.deepEqual(generated(playable[key]), generated(compiled[key]), `${key} drifted from foundry-pilot-04`);
  }
  assert.deepEqual(
    generated(Object.values(playable.roofAreas).flat()),
    generated(Object.values(compiled.roofAreas).flat()),
    "roof areas drifted from foundry-pilot-04"
  );
  assert.deepEqual(
    coordinates(playable.streetNavigationPoints.filter(item => String(item.id || "").startsWith("foundry:navigation:"))),
    coordinates(compiled.streetNavigationPoints.filter(item => String(item.id || "").startsWith("foundry:navigation:"))),
    "navigation points drifted from foundry-pilot-04"
  );
});

test("integrated Foundry pedestrian and traversal surfaces remain valid", () => {
  const route = pedestrianRoutes.find(item => item.id === "foundry:pedestrian-route:works-loop");
  assert.ok(route);
  assert.equal(route.points.length, 8);
  assert.ok(route.points.every(point => pointOnPedestrianSurface(point.x, point.y)));
  assert.equal(generated(Object.values(roofAreas).flat()).length, 4);
  assert.equal(generated(rooftopRoutes).length, 3);
  assert.equal(generated(fireEscapes).length, 2);
  assert.equal(generated(sewerAccesses).length, 2);
});

test("the integrated city remains hard-valid and improves the former baseline", () => {
  const candidate = selectedFoundryCandidate();
  const validation = validateCityBlueprint(candidate);
  const score = scoreCityBlueprint(candidate, validation);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors, null, 2));
  assert.ok(score.total >= 84.9);
});
