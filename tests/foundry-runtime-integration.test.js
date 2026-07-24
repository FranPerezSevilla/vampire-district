import test from "node:test";
import assert from "node:assert/strict";

import {
  SELECTED_CITY_CANDIDATE,
  buildings,
  fireEscapes,
  pedestrianRoutes,
  pointOnPedestrianSurface,
  roads,
  roofAreas,
  rooftopRoutes,
  sewerAccesses
} from "../phaser/src/data/district.js";
import { vehicleDefinitions } from "../phaser/src/data/vehicles.js";
import { currentCityBlueprint } from "../tools/city-compiler/current-city.js";
import { scoreCityBlueprint } from "../tools/city-compiler/score.js";
import { validateCityBlueprint } from "../tools/city-compiler/validate.js";

const GENERATED_PREFIX = "foundry:";
const generated = items => items.filter(item => String(item?.id || "").startsWith(GENERATED_PREFIX));

test("Foundry identity is retained inside City Topology V2 instead of owning the whole city seed", () => {
  assert.equal(SELECTED_CITY_CANDIDATE, "city-topology-v2-site-first");
  const foundryRoadSources = new Set(roads.flatMap(item => item.sourceRoadIds || []).filter(id => id.startsWith(GENERATED_PREFIX)));
  assert.deepEqual(foundryRoadSources, new Set([
    "foundry:road:north-yard"
  ]));
  assert.equal(foundryRoadSources.has("foundry:road:north-drop"), false);
  assert.equal(foundryRoadSources.has("foundry:road:east-link"), false);
  assert.equal(buildings.filter(item => item.id.startsWith("foundry:block-")).length, 5);
  assert.equal(generated(Object.values(roofAreas).flat()).length, 4);
  assert.equal(generated(rooftopRoutes).length, 3);
  assert.equal(generated(fireEscapes).length, 2);
  assert.equal(generated(sewerAccesses).length, 2);
  assert.equal(vehicleDefinitions.some(item => item.id === "foundry:vehicle:utility"), true);
});

test("the relocated Foundry pedestrian and rooftop loops remain playable", () => {
  const route = pedestrianRoutes.find(item => item.id === "foundry:pedestrian-route:works-loop");
  assert.ok(route);
  assert.equal(route.points.length, 4);
  assert.equal(route.points.every(point => pointOnPedestrianSurface(point.x, point.y)), true);

  const west = Object.values(roofAreas).flat().find(item => item.id === "foundry:block-02:west-works:roof");
  const east = Object.values(roofAreas).flat().find(item => item.id === "foundry:block-03:east-loading:roof");
  assert.ok(west);
  assert.ok(east);
  assert.ok(east.x > west.x + west.w);
});

test("the full regenerated city remains hard-valid after integrating Foundry", () => {
  const validation = validateCityBlueprint(currentCityBlueprint);
  const score = scoreCityBlueprint(currentCityBlueprint, validation);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors, null, 2));
  assert.ok(score.total > 0);
  assert.equal(currentCityBlueprint.world.width, 4800);
  assert.equal(currentCityBlueprint.world.height, 3600);
});
