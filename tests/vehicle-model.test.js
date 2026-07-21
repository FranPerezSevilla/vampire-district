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
  maxSpeed: 310,
  reverseSpeed: 92,
  acceleration: 330,
  reverseAcceleration: 126,
  launchBoost: 0.55,
  brake: 296,
  handbrakeBrake: 176,
  handbrakeThrottleFactor: 0.20,
  handbrakeSteerMultiplier: 1.34,
  handbrakeDriftKick: 0.58,
  grip: 9.4,
  handbrakeGrip: 1.45,
  drag: 45,
  steerRate: 2.66,
  maxHealth: 70,
  cameraZoomFactor: 0.69
};

test("vehicle launch is lively without reaching an exaggerated speed immediately", () => {
  let state = createVehicleState(definition, archetype);
  for (let index = 0; index < 10; index++) {
    state = stepVehicleKinematics(state, { move: { x: 0, y: -1 } }, 0.05, archetype);
  }
  assert.ok(state.speed > 190, "the compact should feel responsive within its first half second");
  assert.ok(state.speed < 235, "the initial launch should remain controllable");
  assert.ok(state.speed <= archetype.maxSpeed);
  assert.ok(state.x > definition.x + 55);
  assert.equal(state.y, definition.y);
  assert.ok(vehicleSpeedKph(state.speed) >= 90);
  assert.ok(vehicleSpeedKph(state.speed) < 115);
});

test("steering alone changes heading but never adds speed", () => {
  let stationary = createVehicleState(definition, archetype);
  for (let index = 0; index < 12; index++) {
    stationary = stepVehicleKinematics(stationary, { move: { x: 1, y: 0 } }, 0.05, archetype);
  }
  assert.equal(stationary.speed, 0);
  assert.equal(stationary.x, definition.x);
  assert.equal(stationary.y, definition.y);

  let moving = { ...createVehicleState(definition, archetype), speed: 150 };
  const startingSpeed = moving.speed;
  const startingAngle = moving.angle;
  for (let index = 0; index < 8; index++) {
    moving = stepVehicleKinematics(moving, { move: { x: 1, y: 0 } }, 0.05, archetype);
  }
  assert.ok(moving.angle > startingAngle);
  assert.ok(moving.speed < startingSpeed, "coasting drag may reduce speed, but steering must never accelerate");
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

test("handbrake creates a controlled slide and normal grip recovers it", () => {
  let state = {
    ...createVehicleState(definition, archetype),
    speed: 260,
    travelAngle: 0,
    angle: 0
  };

  for (let index = 0; index < 7; index++) {
    state = stepVehicleKinematics(state, {
      move: { x: 1, y: -1 },
      handbrakeHeld: true
    }, 0.05, archetype);
  }

  const driftAtRelease = Math.abs(state.driftAngle);
  assert.equal(state.handbrake, true);
  assert.ok(driftAtRelease > 0.24, "the rear should step out visibly");
  assert.ok(driftAtRelease < 0.48, "the handbrake should not make the car spin wildly");
  assert.ok(Math.abs(state.y - definition.y) > 5);
  assert.ok(Math.abs(state.speed) > 180, "the slide should preserve useful momentum");

  for (let index = 0; index < 12; index++) {
    state = stepVehicleKinematics(state, { move: { x: 0, y: -1 } }, 0.05, archetype);
  }
  assert.ok(Math.abs(state.driftAngle) < driftAtRelease, "normal tyre grip should progressively align the velocity vector");
});

test("collision slide candidates search many distances and steering nudges", () => {
  const state = { ...createVehicleState(definition, archetype), speed: 180 };
  const next = { ...state, x: 116, y: 110, speed: 180, angle: 0.2, travelAngle: 0.1 };
  const candidates = vehicleSlideCandidates(state, next);

  assert.equal(candidates.length, 90);
  assert.ok(candidates.some(candidate => candidate.x === 116 && candidate.y === 100));
  assert.ok(candidates.some(candidate => candidate.x === 100 && candidate.y === 110));
  assert.ok(candidates.some(candidate => candidate.x > 100 && candidate.x < 116));
  assert.ok(candidates.some(candidate => candidate.y > 100 && candidate.y < 110));
  assert.ok(candidates.some(candidate => candidate.angle < next.angle));
  assert.ok(candidates.some(candidate => candidate.angle > next.angle));
  assert.ok(candidates.every(candidate => candidate.speed > 0 && candidate.speed <= next.speed));
  assert.ok(Math.min(...candidates.map(candidate => candidate.speed)) >= next.speed * 0.78);
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