import test from "node:test";
import assert from "node:assert/strict";

import {
  containmentRole,
  desiredContainmentFleet,
  policeEncounterIntent
} from "../phaser/src/police/MotorizedPoliceContainmentPolicy.js";
import { MOTORIZED_POLICE_ROLES } from "../phaser/src/police/MotorizedPolicePolicy.js";

test("Wanted 2 keeps three actual pursuit cruisers", () => {
  assert.deepEqual(desiredContainmentFleet(2), { pursuers: 3, roadblocks: 0, total: 3 });
  assert.equal(containmentRole(0, 2), MOTORIZED_POLICE_ROLES.PURSUIT);
  assert.equal(containmentRole(1, 2), MOTORIZED_POLICE_ROLES.PURSUIT);
  assert.equal(containmentRole(2, 2), MOTORIZED_POLICE_ROLES.PURSUIT);
});

test("Wanted 3 adds a roadblock on top of three pursuers instead of consuming one", () => {
  assert.deepEqual(desiredContainmentFleet(3), { pursuers: 3, roadblocks: 1, total: 4 });
  assert.equal(containmentRole(0, 3), MOTORIZED_POLICE_ROLES.PURSUIT);
  assert.equal(containmentRole(1, 3), MOTORIZED_POLICE_ROLES.PURSUIT);
  assert.equal(containmentRole(2, 3), MOTORIZED_POLICE_ROLES.PURSUIT);
  assert.equal(containmentRole(3, 3), MOTORIZED_POLICE_ROLES.ROADBLOCK);
});

test("a cruiser met head-on gets an immediate cutoff target instead of passing through", () => {
  const vehicle = {
    x: 0,
    y: 0,
    angle: 0,
    travelAngle: 0,
    speed: 120,
    velocityX: 120,
    velocityY: 0
  };
  const unit = {
    index: 0,
    x: 120,
    y: 18,
    angle: Math.PI
  };
  const intent = policeEncounterIntent(unit, vehicle);
  assert.ok(intent);
  assert.ok(intent.target.x > vehicle.x);
  assert.ok(Math.abs(intent.target.y) > 0);
  assert.ok(["cutoff", "turnaround"].includes(intent.mode));
});

test("a cruiser that has just crossed the suspect is ordered to turn around and re-engage", () => {
  const vehicle = {
    x: 100,
    y: 100,
    angle: 0,
    travelAngle: 0,
    speed: 100,
    velocityX: 100,
    velocityY: 0
  };
  const unit = {
    index: 1,
    x: 82,
    y: 112,
    angle: Math.PI
  };
  const intent = policeEncounterIntent(unit, vehicle);
  assert.ok(intent);
  assert.equal(intent.mode, "turnaround");
  assert.ok(intent.target.x > vehicle.x);
});

test("distant cruisers do not receive local encounter overrides", () => {
  const vehicle = { x: 0, y: 0, angle: 0, travelAngle: 0, speed: 120 };
  const unit = { index: 0, x: 700, y: 0, angle: Math.PI };
  assert.equal(policeEncounterIntent(unit, vehicle), null);
});
