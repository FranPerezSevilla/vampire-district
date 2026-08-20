import test from "node:test";
import assert from "node:assert/strict";

import { VEHICLE_ARCHETYPES } from "../phaser/src/data/vehicles.js";
import {
  createVehicleState,
  stepVehicleKinematics,
  vehicleGearTorqueMultiplier,
  vehicleHighSpeedAccelerationMultiplier
} from "../phaser/src/vehicles/VehicleModel.js";
import {
  DEFAULT_CIVILIAN_TRAFFIC_SPEED_MULTIPLIER,
  effectiveTrafficTravelSeconds
} from "../phaser/src/streaming/MacroTrafficPoliceSystem.js";
import {
  advancePoliceRoute,
  MOTORIZED_POLICE_ROUTE_AGGRESSION
} from "../phaser/src/police/MotorizedPolicePolicy.js";

function accelerationMetrics(id) {
  const archetype = VEHICLE_ARCHETYPES[id];
  let state = createVehicleState({
    id: `speed-${id}`,
    x: 0,
    y: 0,
    angle: 0,
    parked: true
  }, archetype);
  let halfSecondSpeed = 0;
  let timeToNinety = null;
  let timeToNinetyNine = null;
  const shifts = [];
  let previousGear = state.gear;

  for (let index = 0; index < 160; index++) {
    state = stepVehicleKinematics(state, { move: { x: 0, y: -1 } }, 0.05, archetype);
    const elapsed = (index + 1) * 0.05;
    if (index === 9) halfSecondSpeed = state.speed;
    if (state.gear > previousGear) shifts.push(elapsed);
    previousGear = state.gear;
    if (timeToNinety == null && state.speed >= archetype.maxSpeed * 0.90) timeToNinety = elapsed;
    if (timeToNinetyNine == null && state.speed >= archetype.maxSpeed * 0.99) timeToNinetyNine = elapsed;
  }

  return { halfSecondSpeed, timeToNinety, timeToNinetyNine, shifts, speed: state.speed };
}

test("driveable archetypes recover top speed without instant acceleration", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(VEHICLE_ARCHETYPES).map(([id, archetype]) => [id, archetype.maxSpeed])),
    { compact: 340, sedan: 360, van: 300, police: 400 }
  );

  for (const id of ["compact", "sedan", "van", "police"]) {
    const archetype = VEHICLE_ARCHETYPES[id];
    const metrics = accelerationMetrics(id);
    assert.ok(metrics.halfSecondSpeed < archetype.maxSpeed * 0.75, `${id} must not snap to top speed`);
    assert.ok(metrics.timeToNinety <= 1.6, `${id} should enter the fast envelope promptly`);
    assert.ok(metrics.timeToNinetyNine >= 2.2, `${id} should preserve a readable multi-gear build`);
    assert.ok(metrics.timeToNinetyNine <= 3.6, `${id} should not crawl through upper gears`);
    assert.equal(metrics.shifts.length, archetype.gearCount - 1, `${id} should visit every forward gear`);
    assert.ok(metrics.speed <= archetype.maxSpeed);
  }
});

test("upper gears retain useful torque and a readable final taper", () => {
  assert.ok(vehicleGearTorqueMultiplier(5, 5) >= 0.69);
  assert.equal(vehicleHighSpeedAccelerationMultiplier(0.62 * 340, 340), 1);
  assert.ok(vehicleHighSpeedAccelerationMultiplier(0.90 * 340, 340) > 0.18);
  assert.ok(vehicleHighSpeedAccelerationMultiplier(0.99 * 340, 340) < 0.04);
});

test("civilian traffic gains one shared modest cruise-speed increase", () => {
  assert.equal(DEFAULT_CIVILIAN_TRAFFIC_SPEED_MULTIPLIER, 1.12);
  const boostedTravelSeconds = effectiveTrafficTravelSeconds(10);
  assert.ok(boostedTravelSeconds < 10);
  assert.ok(Math.abs((1500 / boostedTravelSeconds) - 168) < 0.001);
});

test("wanted route response remains faster than the quicker player cars", () => {
  const route = {
    legs: [{ travelSeconds: 10 }],
    legIndex: 0,
    progress: 0
  };
  const wantedTwo = advancePoliceRoute(route, 1, { speedMultiplier: 2.65 });
  const wantedThree = advancePoliceRoute(route, 1, { speedMultiplier: 2.80 });
  const edgeLength = 1500;
  const wantedTwoSpeed = wantedTwo.progress * edgeLength;
  const wantedThreeSpeed = wantedThree.progress * edgeLength;

  assert.equal(MOTORIZED_POLICE_ROUTE_AGGRESSION, 1.2);
  assert.ok(Math.abs(wantedTwoSpeed - 397.5 * MOTORIZED_POLICE_ROUTE_AGGRESSION) < 0.001);
  assert.ok(Math.abs(wantedThreeSpeed - 420 * MOTORIZED_POLICE_ROUTE_AGGRESSION) < 0.001);
  assert.ok(wantedTwoSpeed > VEHICLE_ARCHETYPES.sedan.maxSpeed);
  assert.ok(wantedThreeSpeed > VEHICLE_ARCHETYPES.police.maxSpeed);
});