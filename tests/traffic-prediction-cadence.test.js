import test from "node:test";
import assert from "node:assert/strict";
import { createTrafficNetworkRuntime } from "./helpers/traffic-network-runtime.js";
import { predictDriverClearance } from "../phaser/src/streaming/TrafficDriverPrediction.js";
import { createTrafficDriverWorld } from "../phaser/src/streaming/TrafficDriverWorld.js";
import { TrafficLocalBehaviorSystem } from "../phaser/src/streaming/TrafficLocalBehaviorSystem.js";
import { createVehicleState } from "../phaser/src/vehicles/VehicleModel.js";
import { journeyPoint } from "../phaser/src/streaming/TrafficJourneyPlanner.js";

async function fixture() {
  const system = await createTrafficNetworkRuntime({ roadCount: 2 });
  const runtime = system.route.runtime(), driver = runtime.driver(runtime.agents()[0].tokenId);
  const stage = driver.journey.stages.find(stage => stage.kind === "lane" && stage.end - stage.start > 350);
  driver.progress = stage.start + 100;
  driver.pose = createVehicleState({ id: driver.tokenId, ...journeyPoint(driver.journey, driver.progress) }, driver.archetype);
  driver.pose.speed = 70;
  const world = createTrafficDriverWorld(system.materializer.lanes.localTopology, system.materializer);
  const stats = { predictionBuilds: 0, predictionReuses: 0 };
  const bodyAt = (id, along, across = 0) => ({ id,
    x: driver.pose.x + Math.cos(driver.pose.angle) * along - Math.sin(driver.pose.angle) * across,
    y: driver.pose.y + Math.sin(driver.pose.angle) * along + Math.cos(driver.pose.angle) * across,
    angle: driver.pose.angle, archetype: driver.archetype });
  return { system, driver, world, stats, bodyAt };
}

test("cached driving geometry still sees a moving or enlarged obstacle immediately", async () => {
  const { system, driver, world, stats, bodyAt } = await fixture();
  try {
    const obstacle = bodyAt("moving-player", 48, 100), objects = [obstacle];
    assert.equal(predictDriverClearance(driver, world, objects, 0, stats).blocker, null);
    Object.assign(obstacle, bodyAt(obstacle.id, 48));
    assert.equal(predictDriverClearance(driver, world, objects, 0.016, stats).blocker, obstacle);
    assert.equal(stats.predictionBuilds, 1);
    assert.equal(stats.predictionReuses, 1);
    Object.assign(obstacle, bodyAt(obstacle.id, 48, 100));
    assert.equal(predictDriverClearance(driver, world, objects, 0.032, stats).blocker, null);
    Object.assign(obstacle, bodyAt(obstacle.id, 48, 30), { archetype: { width: 50, height: 80 } });
    assert.equal(predictDriverClearance(driver, world, objects, 0.048, stats).blocker, obstacle);
  } finally { system.destroy(); }
});

test("when a cached blocker clears, the unexamined path is checked for the next obstacle", async () => {
  const { system, driver, world, stats, bodyAt } = await fixture();
  try {
    const first = bodyAt("first", 32), second = bodyAt("second", 70), objects = [first, second];
    assert.equal(predictDriverClearance(driver, world, objects, 0, stats).blocker, first);
    Object.assign(first, bodyAt(first.id, 32, 100));
    assert.equal(predictDriverClearance(driver, world, objects, 0.016, stats).blocker, second);
    assert.equal(stats.predictionBuilds, 2);
  } finally { system.destroy(); }
});

test("prediction geometry expires after 100ms and invalidates on physical and route changes", async () => {
  const { system, driver, world, stats } = await fixture();
  try {
    let clock = 0, objects = [];
    predictDriverClearance(driver, world, objects, clock, stats);
    for (const mutate of [
      () => { clock += 0.101; },
      () => { driver.pose.x += 9; },
      () => { driver.pose.angle += 0.02; },
      () => { driver.pose.speed += 9; },
      () => { driver.adoptedImpacts++; },
      () => { driver.journey = { ...driver.journey }; },
      () => { driver.archetype = { ...driver.archetype, width: driver.archetype.width + 1 }; },
      () => { objects = [{ id: "new", x: -1000, y: -1000, angle: 0, archetype: driver.archetype }]; }
    ]) {
      const builds = stats.predictionBuilds;
      mutate();
      predictDriverClearance(driver, world, objects, clock, stats);
      assert.equal(stats.predictionBuilds, builds + 1);
    }
  } finally { system.destroy(); }
});

test("physical traffic bypasses obsolete lane planning; legacy traffic retains its planner", () => {
  let queries = 0;
  const behavior = { laneFor() { queries++; return null; } };
  const decision = TrafficLocalBehaviorSystem.prototype.decisionFor.call(behavior,
    { driverActive: true, driverReason: "blocked-player", behaviorSpeedFactor: 0, behaviorBlockerId: "player" },
    {}, { driverActive: true }, []);
  assert.equal(queries, 0);
  assert.equal(decision.reason, "blocked-player");
  assert.equal(decision.desiredSpeedFactor, 0);
  TrafficLocalBehaviorSystem.prototype.decisionFor.call(behavior, { driverActive: true }, {}, {}, []);
  assert.equal(queries, 1, "both the token and the slot must belong to the physical driver");
});
