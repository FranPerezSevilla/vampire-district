import test from "node:test";
import assert from "node:assert/strict";

import { WORLD } from "../phaser/src/data/balance.js";
import {
  bodyHideSpots,
  crosswalks,
  dumpsters,
  lights,
  pedestrianRoutes,
  pointOnPedestrianSurface,
  roads,
  sidewalks
} from "../phaser/src/data/district.js";
import { npcDefinitions, NPC_TYPES } from "../phaser/src/data/npcs.js";
import { vehicleDefinitions } from "../phaser/src/data/vehicles.js";

test("expanded district is at least five times the original area without enlarging the viewport", () => {
  const originalArea = 960 * 640;
  assert.ok(WORLD.width * WORLD.height >= originalArea * 5);
  assert.equal(WORLD.width, 2400);
  assert.equal(WORLD.height, 1440);
  assert.equal(WORLD.viewportWidth, 960);
  assert.equal(WORLD.viewportHeight, 640);
  assert.ok(roads.length >= 15);
  assert.ok(sidewalks.length >= 40);
  assert.ok(crosswalks.length >= 20);
});

test("streetlights are authored on sidewalks or zebra crossings", () => {
  assert.ok(lights.length >= 60);
  for (const light of lights) {
    assert.equal(
      pointOnPedestrianSurface(light.x, light.y),
      true,
      `${light.id} must stand on a pedestrian surface`
    );
  }
});

test("every civilian route remains on sidewalks and crosses roads only at authored crossings", () => {
  assert.ok(pedestrianRoutes.length >= 5);
  for (const route of pedestrianRoutes) {
    assert.ok(route.points.length >= 6, route.id);
    for (const point of route.points) {
      assert.equal(
        pointOnPedestrianSurface(point.x, point.y),
        true,
        `${route.id} has an off-surface point at ${point.x},${point.y}`
      );
    }
    for (let index = 0; index < route.points.length; index++) {
      const start = route.points[index];
      const end = route.points[(index + 1) % route.points.length];
      const distance = Math.hypot(end.x - start.x, end.y - start.y);
      const samples = Math.max(1, Math.ceil(distance / 4));
      for (let sample = 0; sample <= samples; sample++) {
        const t = sample / samples;
        const x = start.x + (end.x - start.x) * t;
        const y = start.y + (end.y - start.y) * t;
        assert.equal(
          pointOnPedestrianSurface(x, y),
          true,
          `${route.id} leaves the sidewalk between points ${index} and ${(index + 1) % route.points.length}`
        );
      }
    }
  }
});

test("baseline street population is sparse across the enlarged district", () => {
  const civilians = npcDefinitions.filter(npc => npc.type === NPC_TYPES.CIVILIAN && !npc.inactive);
  const police = npcDefinitions.filter(npc => npc.type === NPC_TYPES.POLICE && !npc.inactive);
  assert.ok(civilians.length <= 6);
  assert.equal(police.length, 2);
  assert.ok(civilians.filter(npc => npc.pedestrianRouteId).length >= 5);
});

test("every dumpster is a real hiding spot and vehicles are distributed across the map", () => {
  assert.ok(dumpsters.length >= 12);
  assert.deepEqual(
    new Set(bodyHideSpots.map(spot => spot.id)),
    new Set(dumpsters.map(prop => prop.id))
  );
  const xs = vehicleDefinitions.map(vehicle => vehicle.x);
  const ys = vehicleDefinitions.map(vehicle => vehicle.y);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 1500);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 350);
});
