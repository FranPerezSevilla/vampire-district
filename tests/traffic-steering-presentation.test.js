import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  parkedAvoidanceDecision,
  stepTrafficSteeringPose,
  trafficAvoidanceSide
} from "../phaser/src/streaming/TrafficSteeringPresentationSystem.js";

const ROOT = new URL("../", import.meta.url);

test("traffic avoidance side is stable while distributing cars across both sides", () => {
  assert.equal(trafficAvoidanceSide("edge-a#1"), trafficAvoidanceSide("edge-a#1"));
  const sides = new Set(Array.from({ length: 64 }, (_, index) => trafficAvoidanceSide(`traffic-${index}`)));
  assert.deepEqual([...sides].sort(), [-1, 1]);
});

test("parked obstacle avoidance waits for lateral clearance before committing when very close", () => {
  const base = {
    desiredSpeedFactor: 0.15,
    reason: "parked-vehicle",
    gap: 18,
    blockerId: "parked-car"
  };
  const waiting = parkedAvoidanceDecision(base, { offset: 0, targetOffset: 28 });
  assert.equal(waiting.reason, "steering-around-parked");
  assert.equal(waiting.desiredSpeedFactor, 0);

  const established = parkedAvoidanceDecision(base, { offset: 24, targetOffset: 28 });
  assert.ok(established.desiredSpeedFactor > 0.4);
  assert.equal(established.blockerId, "parked-car");
});

test("steering pose changes laterally over time instead of teleporting and counter-steers home", () => {
  let pose = { offset: 0, steerAngle: 0 };
  pose = stepTrafficSteeringPose(pose, { targetOffset: 28, dt: 0.1, lateralRate: 48 });
  assert.ok(pose.offset > 0 && pose.offset <= 4.8 + 1e-6);
  assert.ok(pose.steerAngle > 0);

  for (let index = 0; index < 12; index++) {
    pose = stepTrafficSteeringPose(pose, { targetOffset: 28, dt: 0.1, lateralRate: 48 });
  }
  assert.ok(Math.abs(pose.offset - 28) < 0.001);

  let sawCounterSteer = false;
  for (let index = 0; index < 12; index++) {
    pose = stepTrafficSteeringPose(pose, { targetOffset: 0, dt: 0.1, lateralRate: 48 });
    if (pose.steerAngle < -0.01) sawCounterSteer = true;
  }
  assert.equal(pose.offset, 0);
  assert.equal(sawCounterSteer, true);
});

test("gameplay runtime composes steering between lane behavior and physical consequences", async () => {
  const runtime = await readFile(new URL("phaser/src/runtime/GameplayRuntime.js", ROOT), "utf8");
  assert.equal(runtime.includes('TrafficSteeringPresentationSystem'), true);
  assert.equal(runtime.includes('new TrafficSteeringPresentationSystem(scene)'), true);
  assert.equal(runtime.includes('registerSystem("TrafficSteeringPresentationSystem")'), true);

  const behaviorUpdate = runtime.indexOf("scene.trafficLocalBehaviorSystem?.update?.(dt)");
  const steeringUpdate = runtime.indexOf("scene.trafficSteeringPresentationSystem?.update?.(dt)");
  const physicalUpdate = runtime.indexOf("scene.trafficPhysicalConsequencesSystem?.update?.(dt)");
  assert.ok(behaviorUpdate >= 0 && steeringUpdate > behaviorUpdate && physicalUpdate > steeringUpdate);

  const physicalDestroy = runtime.indexOf("this.scene.trafficPhysicalConsequencesSystem?.destroy?.()");
  const steeringDestroy = runtime.indexOf("this.scene.trafficSteeringPresentationSystem?.destroy?.()");
  const behaviorDestroy = runtime.indexOf("this.scene.trafficLocalBehaviorSystem?.destroy?.()");
  assert.ok(physicalDestroy >= 0 && steeringDestroy > physicalDestroy && behaviorDestroy > steeringDestroy);
});
