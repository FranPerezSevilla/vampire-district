import test from "node:test";
import assert from "node:assert/strict";

import {
  CIVILIAN_VEHICLE_ARCHETYPE_IDS,
  POLICE_VEHICLE_ARCHETYPE_IDS,
  VEHICLE_ARCHETYPES,
  VEHICLE_CLASSES,
  policeVehicleArchetypeId,
  trafficVehicleArchetype
} from "../phaser/src/data/vehicles.js";

test("vehicle roster exposes fifteen civilian classes and four police classes", () => {
  assert.equal(CIVILIAN_VEHICLE_ARCHETYPE_IDS.length, 15);
  assert.equal(POLICE_VEHICLE_ARCHETYPE_IDS.length, 4);
  assert.equal(Object.keys(VEHICLE_ARCHETYPES).length, 19);
  assert.ok(CIVILIAN_VEHICLE_ARCHETYPE_IDS.includes("hearse"));
  assert.ok(CIVILIAN_VEHICLE_ARCHETYPE_IDS.includes("sports"));
  assert.ok(POLICE_VEHICLE_ARCHETYPE_IDS.includes("police_interceptor"));
  assert.ok(POLICE_VEHICLE_ARCHETYPE_IDS.includes("police_suv"));
  assert.ok(POLICE_VEHICLE_ARCHETYPE_IDS.includes("police_unmarked"));
});

test("every vehicle archetype carries complete driving and presentation data", () => {
  for (const archetype of Object.values(VEHICLE_ARCHETYPES)) {
    assert.ok(archetype.id);
    assert.ok(archetype.label);
    assert.ok(archetype.bodyStyle);
    assert.ok(archetype.width > 0);
    assert.ok(archetype.height > 0);
    assert.ok(archetype.maxSpeed > 0);
    assert.ok(archetype.acceleration > 0);
    assert.ok(archetype.steerRate > 0);
    assert.ok(archetype.maxHealth > 0);
    assert.ok(archetype.mass > 0);
    assert.ok(archetype.collisionPush > 0);
    assert.ok(Array.isArray(archetype.palettes) && archetype.palettes.length > 0);
  }
});

test("civilian traffic selector is deterministic, varied and police-free", () => {
  assert.equal(trafficVehicleArchetype("harbor-north#4").id, trafficVehicleArchetype("harbor-north#4").id);
  const selected = Array.from({ length: 5000 }, (_, index) => trafficVehicleArchetype(`traffic-token-${index}`));
  const ids = new Set(selected.map(archetype => archetype.id));
  assert.equal(ids.size, 15, "a broad deterministic sample should exercise the full civilian roster");
  assert.ok(selected.every(archetype => archetype.vehicleClass === VEHICLE_CLASSES.CIVILIAN));
});

test("vehicle characteristics create meaningful choices instead of cosmetic clones", () => {
  assert.ok(VEHICLE_ARCHETYPES.sports.maxSpeed > VEHICLE_ARCHETYPES.sedan.maxSpeed);
  assert.ok(VEHICLE_ARCHETYPES.sports.steerRate > VEHICLE_ARCHETYPES.sedan.steerRate);
  assert.ok(VEHICLE_ARCHETYPES.suv.mass > VEHICLE_ARCHETYPES.sedan.mass);
  assert.ok(VEHICLE_ARCHETYPES.suv.maxHealth > VEHICLE_ARCHETYPES.sedan.maxHealth);
  assert.ok(VEHICLE_ARCHETYPES.pickup.collisionPush > VEHICLE_ARCHETYPES.compact.collisionPush);
  assert.ok(VEHICLE_ARCHETYPES.junker.maxSpeed < VEHICLE_ARCHETYPES.compact.maxSpeed);
  assert.ok(VEHICLE_ARCHETYPES.limousine.steerRate < VEHICLE_ARCHETYPES.sedan.steerRate);
});

test("police response maps pressure to patrol, interceptor and roadblock SUV", () => {
  assert.equal(policeVehicleArchetypeId(0, 2), "police");
  assert.equal(policeVehicleArchetypeId(1, 2), "police_interceptor");
  assert.equal(policeVehicleArchetypeId(0, 3), "police");
  assert.equal(policeVehicleArchetypeId(1, 3), "police_interceptor");
  assert.equal(policeVehicleArchetypeId(2, 3), "police_suv");
  assert.ok(VEHICLE_ARCHETYPES.police_interceptor.maxSpeed > VEHICLE_ARCHETYPES.police.maxSpeed);
  assert.ok(VEHICLE_ARCHETYPES.police_suv.mass > VEHICLE_ARCHETYPES.police.mass);
});
