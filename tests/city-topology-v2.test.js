import test from "node:test";
import assert from "node:assert/strict";

import {
  CITY_TOPOLOGY_STATS,
  CITY_TOPOLOGY_VERSION,
  CITY_WORLD,
  buildings,
  districtZones,
  landmarkSites,
  pointOnPedestrianSurface,
  roadCorridors,
  roads,
  pedestrianRoutes
} from "../phaser/src/data/district.js";
import { vehicleDefinitions } from "../phaser/src/data/vehicles.js";
import { CampaignSystem } from "../phaser/src/campaign/CampaignSystem.js";
import { buildCityChunkFileSet } from "../tools/city-compiler/chunk-files.js";
import { currentCityBlueprint } from "../tools/city-compiler/current-city.js";
import { validateCityBlueprint } from "../tools/city-compiler/validate.js";

function overlaps(a, b) {
  return a.x < b.x + b.w
    && a.x + a.w > b.x
    && a.y < b.y + b.h
    && a.y + a.h > b.y;
}

function roadsTouch(a, b) {
  return a.x <= b.x + b.w + 0.01
    && a.x + a.w + 0.01 >= b.x
    && a.y <= b.y + b.h + 0.01
    && a.y + a.h + 0.01 >= b.y;
}

function sampleSegment(a, b, step = 8) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const count = Math.max(1, Math.ceil(length / step));
  return Array.from({ length: count + 1 }, (_, index) => ({
    x: a.x + (b.x - a.x) * index / count,
    y: a.y + (b.y - a.y) * index / count
  }));
}

test("City Topology V2 is exactly five times the previous area and streams as ten by eight chunks", () => {
  assert.equal(CITY_TOPOLOGY_VERSION, 2);
  assert.deepEqual(CITY_WORLD, { width: 4800, height: 3600 });
  assert.equal(CITY_WORLD.width * CITY_WORLD.height, 2400 * 1440 * 5);
  assert.equal(CITY_TOPOLOGY_STATS.areaMultiplier, 5);

  const fileSet = buildCityChunkFileSet({
    id: "topology-v2",
    world: CITY_WORLD,
    runtime: currentCityBlueprint.runtime
  });
  assert.equal(fileSet.manifest.columns, 10);
  assert.equal(fileSet.manifest.rows, 8);
  assert.equal(fileSet.manifest.chunkIds.length, 80);
  assert.deepEqual(fileSet.manifest.chunks["9:7"].bounds, {
    x: 4608,
    y: 3584,
    w: 192,
    h: 16
  });
});

test("site-first landmarks reserve large campuses before roads and ordinary blocks", () => {
  const required = ["hospital", "police", "cityHall", "cathedral", "university"];
  for (const id of required) {
    const site = landmarkSites.find(candidate => candidate.landmarkId === id);
    const target = buildings.find(candidate => candidate.id === id);
    assert.ok(site, `${id} site missing`);
    assert.ok(target, `${id} building missing`);
    assert.equal(overlaps(site, target), true, `${id} must sit inside its reserved site`);
    assert.equal(roads.some(road => overlaps(site, road)), false, `${id} site intersects a road`);
  }

  const hospital = buildings.find(item => item.id === "hospital");
  assert.ok(hospital.w >= 400);
  assert.ok(hospital.h >= 260);
  assert.equal(buildings.some(item => item.id === "hospitalEmergency"), true);
});

test("the regenerated road graph is one connected component and exposes bend/curve-ready corridors", () => {
  const seen = new Set([roads[0].id]);
  const queue = [roads[0]];
  while (queue.length) {
    const current = queue.shift();
    for (const candidate of roads) {
      if (seen.has(candidate.id) || !roadsTouch(current, candidate)) continue;
      seen.add(candidate.id);
      queue.push(candidate);
    }
  }
  assert.equal(seen.size, roads.length);
  assert.ok(roadCorridors.some(corridor => corridor.points.length >= 4));
  assert.ok(roadCorridors.some(corridor => /rounded|spline/.test(corridor.curveHint)));
});

test("buildings, pedestrian loops and compiler validation agree with the new topology", () => {
  for (const target of buildings) {
    assert.equal(roads.some(road => overlaps(target, road)), false, `${target.id} overlaps a road`);
  }
  for (const route of pedestrianRoutes) {
    const points = [...route.points, route.points[0]];
    for (let index = 0; index < points.length - 1; index++) {
      assert.equal(
        sampleSegment(points[index], points[index + 1]).every(point => pointOnPedestrianSurface(point.x, point.y)),
        true,
        `${route.id} leaves pedestrian surfaces`
      );
    }
  }

  const validation = validateCityBlueprint(currentCityBlueprint);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors, null, 2));
  assert.deepEqual(currentCityBlueprint.protectedZones, []);
  assert.ok(currentCityBlueprint.landmarks.every(landmark => landmark.fixed === false && landmark.siteFirst === true));
  assert.equal(districtZones.length, 14);
});

test("old authored vehicle positions migrate without losing hull or ownership", () => {
  const campaign = new CampaignSystem({ autoLoad: false, autoSave: false, now: () => 1000 });
  const compact = vehicleDefinitions.find(vehicle => vehicle.id === "refuge_compact");
  campaign.state.world.ownedVehicles = [compact.id];
  campaign.state.world.flags["vehicle.refuge_compact.x"] = 304;
  campaign.state.world.flags["vehicle.refuge_compact.y"] = 326;
  campaign.state.world.flags["vehicle.refuge_compact.health"] = 44;
  campaign.state.world.flags["city.topologyVersion"] = 1;

  campaign.vehicles.ensureStartingOwnership(vehicleDefinitions);

  const condition = campaign.vehicles.condition(compact);
  assert.equal(condition.x, compact.x);
  assert.equal(condition.y, compact.y);
  assert.equal(condition.health, 44);
  assert.equal(campaign.vehicles.isOwned(compact.id), true);
  assert.equal(campaign.state.world.flags["city.topologyVersion"], 2);
});
