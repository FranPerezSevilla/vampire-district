import test from "node:test";
import assert from "node:assert/strict";

import {
  createVehicleState,
  stepVehicleKinematics,
  vehicleCameraZoom,
  vehicleExitOffsets,
  vehicleFootprintPoints,
  vehicleImpactDamage,
  vehicleSpeedKph
} from "../phaser/src/vehicles/VehicleModel.js";

const definition = {
  id: "test_compact",
  x: 100,
  y: 100,
  angle: 0,
  parked: true
};
const archetype = {
  id: "compact",
  width: 28,
  height: 14,
  maxSpeed: 180,
  reverseSpeed: 60,
  acceleration: 120,
  reverseAcceleration: 72,
  brake: 200,
  drag: 50,
  steerRate: 2.5,
  maxHealth: 70,
  cameraZoomFactor: 0.75
};

test("vehicle kinematics accelerate, steer and respect speed limits", () => {
  let state = createVehicleState(definition, archetype);
  for (let index = 0; index < 40; index++) {
    state = stepVehicleKinematics(state, { move: { x: 0, y: -1 } }, 0.05, archetype);
  }
  assert.ok(state.speed > 0);
  assert.ok(state.speed <= archetype.maxSpeed);
  assert.ok(state.x > definition.x);
  assert.equal(state.y, definition.y);

  const beforeAngle = state.angle;
  for (let index = 0; index < 10; index++) {
    state = stepVehicleKinematics(state, { move: { x: -1, y: -1 } }, 0.05, archetype);
  }
  assert.ok(state.angle < beforeAngle);
  assert.ok(state.y < definition.y);
  assert.ok(vehicleSpeedKph(state.speed) > 0);
});

test("braking reaches zero before reverse acceleration", () => {
  let state = { ...createVehicleState(definition, archetype), speed: 90 };
  state = stepVehicleKinematics(state, { move: { x: 0, y: 1 } }, 0.2, archetype);
  assert.ok(state.speed >= 0, "the first reverse input brakes a moving car");
  for (let index = 0; index < 10; index++) {
    state = stepVehicleKinematics(state, { move: { x: 0, y: 1 } }, 0.1, archetype);
  }
  assert.ok(state.speed < 0);
  assert.ok(state.speed >= -archetype.reverseSpeed);
});

test("impact, camera and exit helpers remain bounded", () => {
  assert.equal(vehicleImpactDamage(20), 0);
  assert.ok(vehicleImpactDamage(100) > 0);
  assert.equal(vehicleCameraZoom(1.35, 0, archetype), 1.35);
  assert.ok(vehicleCameraZoom(1.35, archetype.maxSpeed, archetype) < 1.35);

  const state = createVehicleState(definition, archetype);
  const exits = vehicleExitOffsets(state, archetype);
  assert.equal(exits.length, 4);
  assert.ok(exits.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));

  const footprint = vehicleFootprintPoints(state, archetype, 2);
  assert.equal(footprint.length, 9);
  assert.ok(footprint.some(point => point.x > state.x));
  assert.ok(footprint.some(point => point.x < state.x));
});
