import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createTrafficJourneyPlanner, journeyPoint } from "../phaser/src/streaming/TrafficJourneyPlanner.js";
import { planDriverManeuver, driverControls } from "../phaser/src/streaming/TrafficDriverController.js";
import { createTrafficDriverWorld } from "../phaser/src/streaming/TrafficDriverWorld.js";
import { createVehicleState, stepVehicleKinematics, angleDelta } from "../phaser/src/vehicles/VehicleModel.js";
import { trafficVehicleArchetype } from "../phaser/src/data/vehicles.js";
import { orientedVehicleContact } from "../phaser/src/streaming/TrafficPhysicalConsequencesSystem.js";
import { createTrafficNetworkRuntime } from "./helpers/traffic-network-runtime.js";

const topology = JSON.parse(readFileSync(new URL("../phaser/assets/city/packs/traffic-lanes.json", import.meta.url))).localTopology;
const archetype = trafficVehicleArchetype("test");

test("drivers preplan deterministic distant journeys without repeated lanes and finish mid-block", () => {
  const planner = createTrafficJourneyPlanner(topology);
  for (const laneId of topology.laneIds.filter((_, index) => index % 17 === 0)) {
    const journey = planner.plan(laneId, `driver:${laneId}`);
    assert.deepEqual(planner.plan(laneId, `driver:${laneId}`).laneIds, journey.laneIds);
    assert.equal(new Set(journey.laneIds).size, journey.laneIds.length);
    assert.ok(journey.laneIds.length > 1);
    assert.ok(journey.destinationProgress > 800);
    const last = journey.stages.at(-1);
    assert.ok(journey.destinationProgress - last.start >= 60);
    assert.ok(last.end - journey.destinationProgress >= 60);
    assert.equal(journeyPoint(journey, journey.destinationProgress).segment.stage.laneId, journey.destination);
  }
});

for (const [distance, needsReverse] of [[48, false], [32, true]]) {
  test(`a blocked driver steers around a car${needsReverse ? " after reversing for room" : " using the available road width"}`, () => {
    const initial = createVehicleState({ id: "test", x: 0, y: 0, angle: 0 }, archetype);
    const obstacle = { x: distance, y: 0, angle: 0, archetype };
    const safe = pose => Math.abs(pose.y) < 30 && !orientedVehicleContact({ ...pose, archetype }, obstacle);
    const maneuver = planDriverManeuver({ pose: initial, archetype, goal: { x: 125, y: 0, angle: 0 }, safe });
    assert.ok(maneuver, "there is a physically reachable bypass");
    let pose = initial, reversed = false, maxOffset = 0;
    for (const frame of maneuver.frames) {
      const next = stepVehicleKinematics(pose, frame, 0.05, archetype);
      assert.ok(safe(next));
      assert.ok(Math.abs(angleDelta(pose.angle, next.angle)) <= 2.55 * 0.05 + 1e-6);
      assert.ok(Math.abs((next.x - pose.x) * Math.sin(next.travelAngle) - (next.y - pose.y) * Math.cos(next.travelAngle)) < 1e-8);
      reversed ||= next.speed < -0.1;
      maxOffset = Math.max(maxOffset, Math.abs(next.y));
      pose = next;
    }
    assert.equal(reversed, needsReverse);
    assert.ok(maxOffset > 12);
    assert.ok(Math.hypot(pose.x - 125, pose.y) < 13);
    assert.ok(Math.abs(pose.angle) < 0.4);
  });
}

test("a sealed corridor produces no invented lateral escape", () => {
  const pose = createVehicleState({ id: "boxed", x: 0, y: 0, angle: 0 }, archetype);
  const before = structuredClone(pose);
  const maneuver = planDriverManeuver({ pose, archetype, goal: { x: 125, y: 0, angle: 0 },
    safe: candidate => Math.abs(candidate.x) < 0.01 && Math.abs(candidate.y) < 0.01 });
  assert.equal(maneuver, null);
  assert.deepEqual(pose, before);
  for (let i = 0; i < 60; i++) {
    const frame = driverControls(pose, { x: 10, y: 20 }, 0, archetype);
    const next = stepVehicleKinematics(pose, frame, 1 / 60, archetype);
    assert.equal(next.x, pose.x); assert.equal(next.y, pose.y); assert.equal(next.angle, pose.angle);
  }
});

test("normal production driver poses come from player kinematics, including 60 Hz updates", async () => {
  const network = await createTrafficNetworkRuntime({ roadCount: 4 });
  try {
    assert.equal(network.route.snapshot().movementAuthority, "shared-vehicle-kinematics");
    assert.equal(network.materializer.__nbdTrafficAgentPhysicalAuthorityPolicy, undefined,
      "the old route-offset authority must not wrap the driver");
    for (let i = 0; i < 180; i++) {
      const before = new Map(network.route.runtime().agents().map(agent => [agent.tokenId, agent]));
      network.route.step(1 / 60);
      for (const agent of network.route.runtime().agents()) {
        const prior = before.get(agent.tokenId);
        assert.equal(agent.rejectedSteps, 0);
        const expected = stepVehicleKinematics(prior.pose, agent.controls, 1 / 60, trafficVehicleArchetype(agent.tokenId));
        assert.deepEqual(agent.pose, expected);
        const slot = network.materializer.assignments.get(agent.tokenId);
        if (slot) { assert.equal(slot.x, expected.x); assert.equal(slot.y, expected.y); assert.equal(slot.angle, expected.angle); }
      }
    }
  } finally { network.destroy(); }
});

test("road clearance checks the whole rotated vehicle, not just its centre", () => {
  const world = createTrafficDriverWorld(topology, { scene: {}, assignments: new Map() });
  const lane = Object.values(topology.lanes).find(lane => lane.roadWidth === 120 && lane.points[0].y === lane.points[1].y);
  const middle = { x: (lane.points[0].x + lane.points[1].x) / 2, y: lane.points[0].y, angle: 0 };
  const driver = { tokenId: "body", archetype, pose: middle };
  assert.equal(world.blocker(driver, middle, []), null);
  const edge = { ...middle, y: middle.y + 39, angle: Math.PI / 2 };
  assert.equal(world.onRoad(edge), true);
  assert.equal(world.blocker(driver, edge, []).id, "road-edge");
});

for (const frameRate of [20, 60]) test(`the production driver executes an emergency manoeuvre at ${frameRate} Hz and retains its destination`, async () => {
  const network = await createTrafficNetworkRuntime({ roadCount: 4 });
  try {
    network.step(200);
    const runtime = network.route.runtime();
    const selected = runtime.agents().find(agent => {
      const driver = runtime.driver(agent.tokenId);
      const slot = network.materializer.assignments.get(agent.tokenId);
      const stage = driver.journey.stages.find(stage => stage.kind === "lane" && stage.laneId === agent.currentLaneId);
      return slot && agent.stage === "lane" && agent.pose.speed > 50 && stage.end - driver.progress > 200
        && topology.lanes[agent.currentLaneId].roadWidth >= 100
        && [...network.materializer.assignments.values()].every(other => other === slot || Math.hypot(other.x - slot.x, other.y - slot.y) > 130);
    });
    assert.ok(selected);
    const slot = network.materializer.assignments.get(selected.tokenId);
    const forward = { x: Math.cos(slot.angle), y: Math.sin(slot.angle) };
    const obstacle = { id: "parked-obstacle", x: slot.x + forward.x * 45, y: slot.y + forward.y * 45,
      angle: slot.angle, speed: 0, archetype: trafficVehicleArchetype("test") };
    network.scene.vehicleSystem.vehicles.push(obstacle);
    let maneuver = false, maximumSidewaysMotion = 0;
    for (let i = 0; i < frameRate * 13; i++) {
      const before = runtime.agents().find(agent => agent.tokenId === selected.tokenId);
      network.route.step(1 / frameRate);
      network.physical.update(1 / frameRate);
      const after = runtime.agents().find(agent => agent.tokenId === selected.tokenId);
      maneuver ||= ["bypass", "reverse-maneuver"].includes(after.reason);
      maximumSidewaysMotion = Math.max(maximumSidewaysMotion, Math.abs((after.pose.x - before.pose.x) * Math.sin(after.pose.travelAngle)
        - (after.pose.y - before.pose.y) * Math.cos(after.pose.travelAngle)));
      assert.equal(orientedVehicleContact(slot, obstacle), null);
    }
    const final = runtime.agents().find(agent => agent.tokenId === selected.tokenId);
    assert.equal(maneuver, true);
    assert.ok(final.journeyProgress > selected.journeyProgress + 130);
    assert.equal(final.destinationLaneId, selected.destinationLaneId);
    assert.equal(network.materializer.assignments.get(selected.tokenId), slot);
    assert.ok(maximumSidewaysMotion < 1e-7);
    network.scene.events.emit("traffic:vehicle-hijacked", { tokenId: selected.tokenId });
    assert.equal(runtime.materializationTokens().some(token => token.tokenId === selected.tokenId), false);
    assert.equal(runtime.snapshot().hijackedAgentCount, 1);
  } finally { network.destroy(); }
});
