import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  VEHICLE_DESTRUCTION,
  explosionDamageAtDistance,
  vehicleDestructionTransition
} from "../phaser/src/vehicles/VehicleDestructionPolicy.js";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("zero hull becomes critical instead of exploding on ordinary damage", () => {
  const result = vehicleDestructionTransition({ health: 6, disabled: false }, 6);
  assert.equal(result.action, "critical");
  assert.equal(result.after, 0);
  assert.equal(result.critical, true);
  assert.equal(result.exploded, false);
});

test("a follow-up hit on a critical vehicle triggers the explosion", () => {
  const result = vehicleDestructionTransition({ health: 0, disabled: true, criticalDamage: true }, 1);
  assert.equal(result.action, "explode");
  assert.equal(result.exploded, true);
});

test("a severe final impact may explode immediately when it destroys the remaining hull", () => {
  const result = vehicleDestructionTransition({ health: 4, disabled: false }, 5, { destructive: true });
  assert.equal(result.action, "explode");
  assert.equal(result.after, 0);
});

test("explosion damage falls off with distance and ends at the blast radius", () => {
  const near = explosionDamageAtDistance(0);
  const middle = explosionDamageAtDistance(VEHICLE_DESTRUCTION.explosionRadius / 2);
  const edge = explosionDamageAtDistance(VEHICLE_DESTRUCTION.explosionRadius);
  assert.ok(near > middle);
  assert.ok(middle > 0);
  assert.equal(edge, 0);
});

test("runtime routes critical vehicles, occupant death and radial damage through one explosion authority", () => {
  const system = source("phaser/src/vehicles/VehicleSystem.js");
  const driving = source("phaser/src/vehicles/VehicleDriving.js");
  assert.match(system, /vehicleDestructionTransition/);
  assert.match(system, /RawAudioSystem\.js/);
  assert.match(system, /markVehicleCritical/);
  assert.match(system, /explodeVehicle/);
  assert.match(system, /playerDamageSystem\.damagePlayer/);
  assert.match(system, /explosionNpcDamage/);
  assert.match(system, /"vehicle:exploded"/);
  assert.match(driving, /destructive: impact >= VEHICLE_DESTRUCTION\.severeImpactSpeed/);
});
