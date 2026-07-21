import test from "node:test";
import assert from "node:assert/strict";

import {
  createVehicleState,
  stepVehicleKinematics,
  vehicleCameraZoom,
  vehicleExitOffsets,
  vehicleFootprintPoints,
  vehicleImpactDamage,
  vehicleSlideCandidates,
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
  maxSpeed: 245,
  reverseSpeed: 78,
  acceleration: 158,
  reverseAcceleration: 94,
  brake: 232,
  handbrakeBrake: 310,
  handbrakeSteerMultiplier: 1.72,
  drag: 58,
  steerRate: 2.62,
  maxHealth: 70,
  cameraZoomFactor: 0.72
};

test("vehicle kinematics accelerate, steer and respect higher speed limits", () => {
  let state = createVehicleState(definition, archetype);
  for (let index = 0; index < 40; index++) {
    state = stepVehicleKinematics(state, { move: { x: 0, y: -1 } }, 0.05, archetype);
  }
  assert.ok(state.speed > 180, "the compact should now exceed the previous top speed");
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

test("Space-style handbrake decelerates and increases steering authority", () => {
  const starting = { ...createVehicleState(definition, archetype), speed: 150 };
  const normal = stepVehicleKinematics(starting, { move: { x: 1, y: 0 } }, 0.1, archetype);
  const handbrake = stepVehicleKinematics(starting, {
    move: { x: 1, y: 0 },
    handbrakeHeld: true
  }, 0.1, archetype);

  assert.equal(handbrake.handbrake, true);
  assert.ok(handbrake.speed < normal.speed);
  assert.ok(Math.abs(handbrake.angle) > Math.abs(normal.angle));
});

test("collision slide candidates preserve one movement axis and lose speed", () => {
  const state = { ...createVehicleState(definition, archetype), speed: 120 };
  const next = { ...state, x: 112, y: 108, speed: 120 };
  const candidates = vehicleSlideCandidates(state, next);

  assert.equal(candidates.length, 2);
  assert.deepEqual(
    candidates.map(candidate => [candidate.x, candidate.y]),
    [[112, 100], [100, 108]]
  );
  assert.ok(candidates.every(candidate => candidate.speed > 0 && candidate.speed < next.speed));
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
