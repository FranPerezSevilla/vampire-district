import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planDriverManeuver, planDriverReverse } from "../phaser/src/streaming/TrafficDriverController.js";
import { createTrafficDriverWorld } from "../phaser/src/streaming/TrafficDriverWorld.js";
import { createTrafficDriverJunctions } from "../phaser/src/streaming/TrafficDriverJunctions.js";
import { journeyPoint } from "../phaser/src/streaming/TrafficJourneyPlanner.js";
import { createVehicleState, stepVehicleKinematics, angleDelta } from "../phaser/src/vehicles/VehicleModel.js";
import { trafficVehicleArchetype } from "../phaser/src/data/vehicles.js";
import { orientedVehicleContact } from "../phaser/src/streaming/TrafficPhysicalConsequencesSystem.js";
import { createTrafficNetworkRuntime } from "./helpers/traffic-network-runtime.js";

const topology = JSON.parse(readFileSync(new URL("../phaser/assets/city/packs/traffic-lanes.json", import.meta.url))).localTopology;
const archetype = trafficVehicleArchetype("test");

test("an incomplete escape can reverse, stop and be reassessed without moving into a blocked rear", () => {
  const pose = createVehicleState({ id: "test", x: 0, y: 0, angle: 0 }, archetype);
  const goal = { x: 125, y: 0, angle: 0 };
  const safe = candidate => candidate.x < 1 && candidate.x > -24 && Math.abs(candidate.y) < 0.1;
  assert.equal(planDriverManeuver({ pose, archetype, goal, safe }), null);
  const reverse = planDriverReverse({ pose, archetype, safe });
  assert.equal(reverse?.kind, "reverse-reassess");
  let next = pose;
  for (const frame of reverse.frames) {
    next = stepVehicleKinematics(next, frame, 0.05, archetype);
    assert.ok(safe(next));
  }
  assert.ok(next.x < -10 && next.x >= -20);
  assert.ok(Math.abs(next.speed) < 0.01);
  assert.equal(planDriverReverse({ pose, archetype, safe: candidate => Math.abs(candidate.x) < 0.01 }), null);
});

test("a contact permits only separation, with no new contact or deeper penetration", () => {
  const world = createTrafficDriverWorld(topology, { scene: {}, assignments: new Map() });
  const lane = Object.values(topology.lanes).find(lane => lane.roadWidth >= 100 && lane.points[0].y === lane.points[1].y);
  const pose = createVehicleState({ id: "test", x: (lane.points[0].x + lane.points[1].x) / 2, y: lane.points[0].y, angle: 0 }, archetype);
  const driver = { tokenId: "test", archetype, pose };
  const front = { id: "front", x: pose.x + archetype.width * 0.86 - 2, y: pose.y, angle: 0, archetype };
  assert.ok(orientedVehicleContact({ ...pose, archetype }, front));
  const away = stepVehicleKinematics(pose, { move: { x: 0, y: 1 } }, 1 / 60, archetype);
  const into = stepVehicleKinematics(pose, { move: { x: 0, y: -1 } }, 1 / 60, archetype);
  assert.equal(world.blocker(driver, away, [front], 0, pose), null);
  assert.equal(world.blocker(driver, into, [front], 0, pose), front);
  const rear = { ...front, id: "rear", x: pose.x - archetype.width * 0.86 - 0.001 };
  assert.equal(world.blocker(driver, away, [front, rear], 0, pose), rear);
});

async function crossingQueue({ straightExit = false, blockedShoulder = false } = {}) {
  const network = await createTrafficNetworkRuntime({ roadCount: 2 });
  const runtime = network.route.runtime();
  const agents = runtime.agents();
  const base = runtime.driver(agents[0].tokenId);
  const stage = base.journey.stages.find(stage => stage.kind === "connector" && stage.start > 200
    && topology.lanes[stage.laneId].roadWidth >= 100
    && topology.lanes[stage.nextLaneId].roadWidth >= 100
    && (!straightExit || Math.abs(angleDelta(journeyPoint(base.journey, stage.start - 1).angle, journeyPoint(base.journey, stage.start + 220).angle)) < 0.1)
    && Math.abs(angleDelta(journeyPoint(base.journey, stage.start - 1).angle, journeyPoint(base.journey, stage.end + 1).angle)) < 0.1);
  assert.ok(stage, "a real wide straight crossing is required");
  network.materializer.assignments.clear();
  const drivers = agents.slice(0, 3).map((agent, i) => {
    const driver = runtime.driver(agent.tokenId);
    driver.journey = structuredClone(base.journey);
    driver.progress = stage.start + 4 - i * 65;
    driver.pose = createVehicleState({ id: agent.tokenId, ...journeyPoint(driver.journey, driver.progress) }, driver.archetype);
    const slot = network.materializer.pool[i];
    Object.assign(slot, { tokenId: driver.tokenId, archetype: driver.archetype, driverActive: true, ...driver.pose });
    slot.container.active = true;
    network.materializer.assignments.set(driver.tokenId, slot);
    return driver;
  });
  for (const agent of agents.slice(3)) network.scene.events.emit("traffic:vehicle-hijacked", { tokenId: agent.tokenId });
  const lead = drivers[0];
  const ahead = (lead.archetype.width + archetype.width) * 0.43 - 1;
  const obstacle = { id: "crashed-player-car", x: lead.pose.x + Math.cos(lead.pose.angle) * ahead,
    y: lead.pose.y + Math.sin(lead.pose.angle) * ahead, angle: lead.pose.angle, archetype, speed: 0 };
  network.scene.vehicleSystem.vehicles.push(obstacle);
  if (blockedShoulder) network.scene.vehicleSystem.vehicles.push({
    id: "parked-vehicles-at-curb", angle: lead.pose.angle, speed: 0,
    x: lead.pose.x - Math.sin(lead.pose.angle) * 34 - Math.cos(lead.pose.angle) * 40,
    y: lead.pose.y + Math.cos(lead.pose.angle) * 34 - Math.sin(lead.pose.angle) * 40,
    archetype: { width: 400, height: 24 }
  });
  network.scene.player = { x: 10, y: 10 };
  network.physical.stateFor(network.materializer.assignments.get(lead.tokenId)).holdSeconds = 0.4;
  return { network, runtime, drivers, obstacle };
}

test("junction manoeuvre reservations yield to moving traffic and protect a recovery path", async () => {
  const { network, drivers } = await crossingQueue();
  try {
    const junctions = createTrafficDriverJunctions(topology);
    const [lead, follower] = drivers;
    lead.pose.speed = 15;
    junctions.prepare(drivers, [...network.materializer.assignments.values()], 0);
    assert.equal(junctions.stopDistance(lead), Infinity);
    const frames = Array.from({ length: 120 }, () => ({ move: { x: 0, y: -1 }, handbrakeHeld: false }));
    const maneuver = { frames, frameSeconds: 0.05 };
    assert.equal(junctions.reserveManeuver(follower, maneuver), false, "moving permit owner keeps priority");
    lead.pose.speed = 0; lead.wait = 5;
    assert.equal(junctions.reserveManeuver(follower, maneuver), true, "a stalled future path can yield");
    assert.equal(junctions.stopDistance(lead), 0, "the original path waits for the recovery reservation");
    assert.equal(junctions.reserveManeuver(lead, maneuver), false, "two conflicting manoeuvres cannot reserve together");
    junctions.releaseManeuver(follower);
    assert.equal(junctions.snapshot().activeManeuverCount, 0);
  } finally { network.destroy(); }
});

test("the runtime reverses and reassesses a full-width obstruction, then resumes when it clears", async () => {
  const { network, runtime, drivers, obstacle } = await crossingQueue({ straightExit: true, blockedShoulder: true });
  try {
    const lead = drivers[0];
    for (const other of drivers.slice(1)) {
      network.scene.events.emit("traffic:vehicle-hijacked", { tokenId: other.tokenId });
      network.materializer.assignments.delete(other.tokenId);
    }
    obstacle.archetype = { ...archetype, height: 300 };
    const start = { ...lead.pose };
    let partials = 0, prior = null;
    for (let i = 0; i < 220; i++) {
      runtime.step(0.05); network.physical.update(0.05);
      if (lead.maneuver?.kind === "reverse-reassess" && lead.maneuver !== prior) partials++;
      prior = lead.maneuver;
    }
    const retreat = -(lead.pose.x - start.x) * Math.cos(start.angle) - (lead.pose.y - start.y) * Math.sin(start.angle);
    assert.ok(partials >= 2, "partial recovery must reevaluate after its first reverse");
    assert.ok(retreat > 10 && retreat < 50, "retreat is useful and bounded");
    assert.ok(Math.abs(lead.pose.speed) < 0.01, "no endless reverse or approach/reverse oscillation");
    network.scene.vehicleSystem.vehicles.length = 0;
    for (let i = 0; i < 200; i++) { runtime.step(0.05); network.physical.update(0.05); }
    assert.ok((lead.pose.x - start.x) * Math.cos(start.angle) + (lead.pose.y - start.y) * Math.sin(start.angle) > 100);
  } finally { network.destroy(); }
});

test("a completed circuit repeats the same itinerary with no physical seam jump", async () => {
  const network = await createTrafficNetworkRuntime({ roadCount: 1 });
  try {
    const runtime = network.route.runtime();
    const driver = runtime.driver(runtime.agents()[0].tokenId);
    const journey = driver.journey;
    driver.progress = journey.destinationProgress - 0.01;
    driver.pose = createVehicleState({ id: driver.tokenId, ...journeyPoint(journey, driver.progress) }, driver.archetype);
    driver.pose.speed = 30;
    network.materializer.assignments.clear();
    const before = { ...driver.pose };
    runtime.step(1 / 60);
    assert.equal(driver.completedJourneys, 1);
    assert.equal(driver.journey, journey);
    assert.ok(Math.abs(driver.progress - journey.loopStartProgress) < 2);
    assert.deepEqual(driver.pose, stepVehicleKinematics(before, driver.controls, 1 / 60, driver.archetype));
  } finally { network.destroy(); }
});

for (const hz of [20, 60]) test(`a collided driver and two queued cars escape a real crossing at ${hz} Hz`, async () => {
  const { network, runtime, drivers, obstacle } = await crossingQueue({ straightExit: true, blockedShoulder: true });
  try {
    const initial = drivers.map(driver => ({ ...driver.pose, progress: driver.progress }));
    const reversed = new Set(), bypassed = new Set(), opposing = new Set(), side = new Map();
    let overlap = orientedVehicleContact({ ...drivers[0].pose, archetype: drivers[0].archetype }, obstacle)?.overlap || 0;
    assert.ok(overlap > 0);
    for (let tick = 0; tick < hz * 32; tick++) {
      const before = drivers.map(driver => ({ ...driver.pose }));
      runtime.step(1 / hz);
      network.physical.update(1 / hz);
      drivers.forEach((driver, i) => {
        if (driver.pose.speed < -0.1) reversed.add(i);
        if (driver.reason === "bypass") bypassed.add(i);
        const offset = Math.abs((driver.pose.x - initial[i].x) * Math.sin(initial[i].angle)
          - (driver.pose.y - initial[i].y) * Math.cos(initial[i].angle));
        side.set(i, Math.max(side.get(i) || 0, offset));
        const lane = topology.lanes[journeyPoint(driver.journey, initial[i].progress).segment.stage.laneId];
        const lateral = -(driver.pose.x - initial[i].x) * Math.sin(initial[i].angle) + (driver.pose.y - initial[i].y) * Math.cos(initial[i].angle);
        if (driver.progress < initial[i].progress + 200 && lateral - driver.archetype.height * 0.41 < -(lane.laneOffset || 0)) opposing.add(i);
        const moved = Math.hypot(driver.pose.x - before[i].x, driver.pose.y - before[i].y);
        if (moved > 1e-7) assert.deepEqual(driver.pose, stepVehicleKinematics(before[i], driver.controls, 1 / hz, driver.archetype));
        if (i) assert.equal(orientedVehicleContact({ ...driver.pose, archetype: driver.archetype }, obstacle), null);
      });
      const current = orientedVehicleContact({ ...drivers[0].pose, archetype: drivers[0].archetype }, obstacle)?.overlap || 0;
      assert.ok(current <= overlap + 1e-7, "existing contact may only decrease"); overlap = current;
      for (let i = 0; i < drivers.length; i++) for (let j = i + 1; j < drivers.length; j++) {
        assert.equal(orientedVehicleContact({ ...drivers[i].pose, archetype: drivers[i].archetype },
          { ...drivers[j].pose, archetype: drivers[j].archetype }), null);
      }
    }
    assert.ok(reversed.has(0), "the collided car must reverse");
    assert.equal(overlap, 0);
    drivers.forEach((driver, i) => {
      assert.ok(bypassed.has(i), `car ${i} must manoeuvre around the obstruction`);
      assert.ok(side.get(i) > 12, `car ${i} must use available road width`);
      const lane = topology.lanes[journeyPoint(driver.journey, initial[i].progress).segment.stage.laneId];
      // Four-lane avenues also offer the adjacent lane in the same direction.
      if (i && lane.lanesPerDirection === 1) assert.ok(opposing.has(i), `following car ${i} must use the free opposing half of the road`);
      assert.ok(driver.progress > initial[i].progress + 150, `car ${i} remained blocked: ${JSON.stringify({ reason: driver.reason, pose: driver.pose, progress: driver.progress - initial[i].progress, wait: driver.wait, rejected: driver.rejectedSteps })}`);
    });
  } finally { network.destroy(); }
});
