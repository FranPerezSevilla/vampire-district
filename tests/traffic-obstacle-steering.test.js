import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { trafficObstacleAvoidancePlan } from "../phaser/src/streaming/TrafficLocalBehaviorSystem.js";

test("vehicle obstacles receive deterministic lateral avoidance but pedestrians do not", () => {
  const parked = trafficObstacleAvoidancePlan("parked-vehicle", "traffic-17", 14);
  const repeated = trafficObstacleAvoidancePlan("parked-vehicle", "traffic-17", 14);
  const playerVehicle = trafficObstacleAvoidancePlan("player-vehicle", "traffic-17", 14);

  assert.deepEqual(parked, repeated);
  assert.ok(parked);
  assert.ok(Math.abs(parked.lateralOffset) >= 16);
  assert.ok(Math.abs(parked.lateralOffset) <= 24);
  assert.deepEqual(playerVehicle, parked);
  assert.equal(trafficObstacleAvoidancePlan("player-on-foot", "traffic-17", 14), null);
  assert.equal(trafficObstacleAvoidancePlan("traffic", "traffic-17", 14), null);
  assert.equal(trafficObstacleAvoidancePlan("junction-yield", "traffic-17", 14), null);
});

test("local traffic renders avoidance as steering plus lateral motion, not a raw sideways snap", () => {
  const code = readFileSync(
    new URL("../phaser/src/streaming/TrafficLocalBehaviorSystem.js", import.meta.url),
    "utf8"
  );
  assert.match(code, /state\.avoidanceOffset = moveToward/);
  assert.match(code, /const steerAngle = clamp\(Math\.atan2\(lateralDelta/);
  assert.match(code, /slot\.x = sampled\.x \+ normalX \* state\.avoidanceOffset/);
  assert.match(code, /slot\.angle = sampled\.angle \+ steerAngle/);
});
