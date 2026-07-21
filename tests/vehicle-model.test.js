import test from "node:test";
import assert from "node:assert/strict";

import {
  createVehicleState,
  interpolateVehicleState,
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
  maxSpeed: 325,
  reverseSpeed: 96,
  acceleration: 285,
  reverseAcceleration: 122,
  launchBoost: 0.62,
  brake: 292,
  handbrakeBrake: 172,
  handbrakeThrottleFactor: 0.34,
  handbrakeSteerMultiplier: 2.28,
  grip: 8.8,
  handbrakeGrip: 0.92,
  drag: 46,
  steerRate: 2.72,
  maxHealth: 70,
  cameraZoomFactor: 0.68
};

test("vehicle launch is immediate and still respects the higher top speed", () => {
  let state = createVehicleState(definition, archetype);
  for (let index = 0; index < 20; index++) {
    state = stepVehicleKinematics(state, { move: { x: 0, y: -1 } }, 0.05, archetype);
  }
  assert.ok(state.speed > 250, "the compact should feel lively within its first second");
  assert.ok(state.speed <= archetype.maxSpeed);
  assert.ok(state.x > definition.x + 100);
  assert.equal(state.y, definition.y);
  assert.ok(vehicleSpeedKph(state.speed) >= 118);
});

test("braking reaches zero before reverse acceleration", () => {
  let state = { ...createVehicleState(definition, archetype), speed: 120 };
  state = stepVehicleKinematics(state, { move: { x: 0, y: 1 } }, 0.2, archetype);
  assert.ok(state.speed >= 0, "the first reverse input brakes a moving car");
  for (let index = 0; index < 10; index++) {
    state = stepVehicleKinematics(state, { move: { x: 0, y: 1 } }, 0.1, archetype);
  }
  assert.ok(state.speed < 0);
  assert.ok(state.speed >= -archetype.reverseSpeed);
});

test("handbrake creates sustained slip and normal grip recovers it", () => {
  let state = {
    ...createVehicleState(definition, archetype),
    speed: 230,
    travelAngle: 0,
    angle: 0
  };

  for (let index = 0; index < 8; index++) {
    state = stepVehicleKinematics(state, {
      move: { x: 1, y: -1 },
      handbrakeHeld: true
    }, 0.05, archetype);
  }

  const driftAtRelease = Math.abs(state.driftAngle);
  assert.equal(state.handbrake, true);
  assert.ok(driftAtRelease > 0.22, "body heading and travel direction should visibly separate");
  assert.ok(state.y > definition.y, "the car should carry lateral momentum while its nose rotates");
  assert.ok(Math.abs(state.speed) > 100, "the handbrake should slide rather than stop the car dead");

  for (let index = 0; index < 12; index++) {
    state = stepVehicleKinematics(state, { move: { x: 0, y: -1 } }, 0.05, archetype);
  }
  assert.ok(Math.abs(state.driftAngle) < driftAtRelease, "normal tyre grip should progressively align the velocity vector");
});

test("collision slide candidates offer long and short recovery distances", () => {
  const state = { ...createVehicleState(definition, archetype), speed: 150 };
  const next = { ...state, x: 116, y: 110, speed: 150, angle: 0.2, travelAngle: 0.1 };
  const candidates = vehicleSlideCandidates(state, next);

  assert.equal(candidates.length, 12);
  assert.deepEqual([candidates[0].x, candidates[0].y], [116, 100]);
  assert.deepEqual([candidates[1].x, candidates[1].y], [100, 110]);
  assert.ok(candidates.some(candidate => candidate.x > 100 && candidate.x < 116));
  assert.ok(candidates.some(candidate => candidate.y > 100 && candidate.y < 110));
  assert.ok(candidates.every(candidate => candidate.speed > 0 && candidate.speed < next.speed));
});

test("contact interpolation advances without snapping through a collision", () => {
  const state = { ...createVehicleState(definition, archetype), speed: 100 };
  const next = { ...state, x: 140, y: 120, angle: 0.5, travelAngle: 0.2, speed: 160 };
  const halfway = interpolateVehicleState(state, next, 0.5);
  assert.equal(halfway.x, 120);
  assert.equal(halfway.y, 110);
  assert.ok(halfway.angle > 0 && halfway.angle < next.angle);
  assert.ok(halfway.speed > state.speed && halfway.speed < next.speed);
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