import test from "node:test";
import assert from "node:assert/strict";

import {
  trafficMassResponse,
  vehicleCollisionMass,
  vehicleCollisionPush
} from "../phaser/src/streaming/TrafficMassCollisionPolicy.js";
import { VEHICLE_ARCHETYPES } from "../phaser/src/data/vehicles.js";

test("legacy or incomplete archetypes retain neutral collision mass defaults", () => {
  assert.equal(vehicleCollisionMass({}), 1);
  assert.equal(vehicleCollisionPush({}), 1);
  const neutral = trafficMassResponse({}, {});
  assert.equal(neutral.massRatio, 1);
  assert.equal(neutral.impulseScale, 1);
  assert.equal(neutral.retentionScale, 1);
});

test("heavy vehicles push light traffic more and retain more momentum", () => {
  const heavyIntoLight = trafficMassResponse(VEHICLE_ARCHETYPES.pickup, VEHICLE_ARCHETYPES.compact);
  const lightIntoHeavy = trafficMassResponse(VEHICLE_ARCHETYPES.compact, VEHICLE_ARCHETYPES.pickup);
  assert.ok(heavyIntoLight.massRatio > 2);
  assert.ok(heavyIntoLight.impulseScale > 1.3);
  assert.ok(heavyIntoLight.retentionScale > 1);
  assert.ok(lightIntoHeavy.impulseScale < 0.8);
  assert.ok(lightIntoHeavy.retentionScale < 1);
  assert.ok(heavyIntoLight.impulseScale > lightIntoHeavy.impulseScale);
});

test("sports car remains fast but does not gain SUV-like collision authority", () => {
  const sportsIntoSedan = trafficMassResponse(VEHICLE_ARCHETYPES.sports, VEHICLE_ARCHETYPES.sedan);
  const suvIntoSedan = trafficMassResponse(VEHICLE_ARCHETYPES.suv, VEHICLE_ARCHETYPES.sedan);
  assert.ok(sportsIntoSedan.massRatio < 1);
  assert.ok(suvIntoSedan.massRatio > 1.5);
  assert.ok(suvIntoSedan.impulseScale > sportsIntoSedan.impulseScale);
  assert.ok(suvIntoSedan.retentionScale > sportsIntoSedan.retentionScale);
});

test("mass response remains bounded for extreme catalogue differences", () => {
  const heaviest = trafficMassResponse(VEHICLE_ARCHETYPES.police_suv, VEHICLE_ARCHETYPES.junker);
  const lightest = trafficMassResponse(VEHICLE_ARCHETYPES.junker, VEHICLE_ARCHETYPES.police_suv);
  assert.ok(heaviest.impulseScale <= 1.62);
  assert.ok(lightest.impulseScale >= 0.62);
  assert.ok(heaviest.retentionScale <= 1.14);
  assert.ok(lightest.retentionScale >= 0.78);
});
