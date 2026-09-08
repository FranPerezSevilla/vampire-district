import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createTrafficNetworkRuntime } from "./helpers/traffic-network-runtime.js";
import { createTrafficDensityRuntime } from "./helpers/traffic-density-runtime.js";
import { createIncrementalTrafficProjection, projectTrafficRouteAgentsToMacroCompatibility } from "../phaser/src/streaming/TrafficRouteCompatibilityProjection.js";
import { orientedVehicleContact, orientedTrafficBoxContact, trafficVehicleBox } from "../phaser/src/streaming/TrafficPhysicalConsequencesSystem.js";
import { createTrafficDriverWorld } from "../phaser/src/streaming/TrafficDriverWorld.js";
import { journeyPoint } from "../phaser/src/streaming/TrafficJourneyPlanner.js";
import { createVehicleState, stepVehicleKinematics, vehicleFootprintPoints } from "../phaser/src/vehicles/VehicleModel.js";

test("cached contact geometry matches fresh boxes after movement, rotation and body changes", () => {
  const left = { x: 0, y: 0, angle: 0, archetype: { width: 32, height: 17 } };
  const right = { x: 0, y: 0, angle: 0, archetype: { width: 60, height: 22 } };
  for (let i = 0; i < 500; i++) {
    Object.assign(right, { x: i % 83 - 41, y: i % 57 - 28, angle: i * 0.07 });
    left.angle = i * -0.013; left.archetype.width = 25 + i % 30;
    const expected = orientedTrafficBoxContact(trafficVehicleBox(left), trafficVehicleBox(right));
    assert.deepEqual(orientedVehicleContact(left, right), expected);
    assert.deepEqual(orientedVehicleContact(left, right), expected);
    const exposed = orientedVehicleContact(left, right);
    if (exposed) { exposed.left.x = 99999; exposed.right.forward.x = 99999; }
    assert.deepEqual(orientedVehicleContact(left, right), expected, "returned contacts cannot corrupt cached geometry");
  }
});

test("incremental accounting matches independent projection through movement and hijack; diagnostics are detached", async () => {
  const system = await createTrafficNetworkRuntime({ roadCount: 3 });
  try {
    const runtime = system.route.runtime(), topology = system.materializer.lanes.localTopology, graph = system.materializer.macro.graph;
    const independent = createIncrementalTrafficProjection(topology, graph);
    for (let i = 0; i < 600; i++) {
      runtime.step(0.05);
      if (i % 17) continue;
      const agents = runtime.agents(), expected = projectTrafficRouteAgentsToMacroCompatibility(agents, topology, graph);
      for (const agent of agents) independent.update(agent);
      const actual = runtime.accountingSnapshot();
      for (const key of ["edgeCounts", "districtCounts", "projectedAgentCount", "ambiguousAgentCount", "unmatchedAgentCount"]) {
        assert.deepEqual(actual[key], expected[key]);
        assert.deepEqual(independent.snapshot().state[key], expected[key]);
      }
      assert.equal(actual.projectionValid, true);
    }
    const before = runtime.accountingSnapshot(), agent = runtime.agents()[0];
    const originalMetadata = structuredClone(agent.trafficMetadata);
    agent.trafficMetadata.macroCompatibility.edgeId = "corrupted-read";
    before.districtCounts.corrupted = 100;
    assert.deepEqual(runtime.agents()[0].trafficMetadata, originalMetadata);
    assert.equal(runtime.accountingSnapshot().districtCounts.corrupted, undefined);
    system.scene.events.emit("traffic:vehicle-hijacked", { tokenId: agent.tokenId });
    assert.equal(runtime.tokenCount(), before.materializationTokenCount - 1);
    assert.equal(runtime.tokenFor(agent.tokenId), null);
    assert.equal(runtime.accountingSnapshot().populationConserved, true);
    assert.deepEqual(runtime.accountingSnapshot().districtCounts,
      projectTrafficRouteAgentsToMacroCompatibility(runtime.agents(), topology, graph).districtCounts);
  } finally { system.destroy(); }
});

test("a new obstacle invalidates clear-road prediction immediately while motion stays under shared kinematics", async () => {
  const system = await createTrafficNetworkRuntime({ roadCount: 2 });
  try {
    const runtime = system.route.runtime(), agents = runtime.agents();
    const driver = runtime.driver(agents[0].tokenId);
    for (const agent of agents.slice(1)) {
      system.scene.events.emit("traffic:vehicle-hijacked", { tokenId: agent.tokenId });
      system.materializer.assignments.delete(agent.tokenId);
    }
    const stage = driver.journey.stages.find(stage => stage.kind === "lane" && stage.end - stage.start > 350);
    assert.ok(stage);
    driver.progress = stage.start + 100;
    driver.pose = createVehicleState({ id: driver.tokenId, ...journeyPoint(driver.journey, driver.progress) }, driver.archetype);
    driver.pose.speed = 45;
    const slot = system.materializer.pool[0];
    Object.assign(slot, { ...driver.pose, tokenId: driver.tokenId, archetype: driver.archetype, driverActive: true });
    system.materializer.assignments.set(driver.tokenId, slot);
    system.scene.player = { x: -1000, y: -1000 };
    for (let i = 0; i < 3; i++) runtime.step(1 / 60);
    const before = runtime.snapshot().performance;
    assert.ok(before.predictionReuses > 0);
    const pose = { ...driver.pose };
    const obstacle = { id: "new-obstacle", x: pose.x + Math.cos(pose.angle) * 48,
      y: pose.y + Math.sin(pose.angle) * 48, angle: pose.angle, archetype: driver.archetype };
    system.scene.vehicleSystem.vehicles.push(obstacle);
    runtime.step(1 / 60);
    assert.ok(runtime.snapshot().performance.predictionBuilds > before.predictionBuilds);
    assert.equal(driver.blockerId, obstacle.id);
    assert.deepEqual(driver.pose, stepVehicleKinematics(pose, driver.controls, 1 / 60, driver.archetype));
    assert.equal(orientedVehicleContact({ ...driver.pose, archetype: driver.archetype }, obstacle), null);
  } finally { system.destroy(); }
});

test("dynamic obstacle candidates retain exact membership and order as bodies cross spatial cells", async () => {
  const system = await createTrafficNetworkRuntime({ roadCount: 1 });
  try {
    const driver = system.route.runtime().driver(system.route.runtime().agents()[0].tokenId);
    const world = createTrafficDriverWorld(system.materializer.lanes.localTopology, system.materializer);
    system.scene.trafficPhysicalConsequencesSystem.nearbyBuildings = () => [];
    system.scene.player = null;
    const car = { id: "moving", x: driver.pose.x + 300, y: driver.pose.y, archetype: driver.archetype };
    system.scene.vehicleSystem.vehicles.push(car);
    world.prepare();
    for (let i = 0; i < 100; i++) {
      car.x -= 5; world.update(car);
      const expected = [...system.materializer.assignments.values(), ...system.scene.vehicleSystem.vehicles]
        .filter(other => other.tokenId !== driver.tokenId && other.container?.active !== false && Math.hypot(other.x - driver.pose.x, other.y - driver.pose.y) < 240);
      assert.deepEqual(world.obstacles(driver), expected);
    }
  } finally { system.destroy(); }
});

test("convex road clearance agrees with the full footprint at curbs, corners and rotated bus bodies", async () => {
  const system = await createTrafficNetworkRuntime({ roadCount: 1 });
  try {
    const topology = system.materializer.lanes.localTopology;
    const world = createTrafficDriverWorld(topology, system.materializer), archetype = { width: 60, height: 22 };
    for (const lane of Object.values(topology.lanes).filter((_, i) => i % 9 === 0)) {
      const first = lane.points[0], last = lane.points.at(-1);
      for (const t of [0, 0.5, 1]) for (const offset of [-70, -30, 0, 30, 70]) for (const angle of [0, 0.4, Math.PI / 2, 2.7]) {
        const pose = { x: first.x + (last.x - first.x) * t + offset, y: first.y + (last.y - first.y) * t - offset, angle };
        const expected = vehicleFootprintPoints(pose, { width: 60 * 0.86, height: 22 * 0.82 }).every(world.onRoad);
        assert.equal(world.footprintOnRoad(pose, archetype), expected);
      }
    }
  } finally { system.destroy(); }
});

test("distant scheduling preserves identities, physical promotion, camera guards and continuously simulated buses", async t => {
  const center = { x: 2265, y: 3280 };
  const system = await createTrafficDensityRuntime({ center, transit: true });
  try {
    const runtime = system.route.runtime();
    t.diagnostic(JSON.stringify({ initialHash: createHash("sha256").update(JSON.stringify(runtime.agents())).digest("hex") }));
    const identities = runtime.agents().map(agent => agent.tokenId);
    const routes = new Map(identities.map(id => [id, runtime.driver(id).journey]));
    system.step(40);
    assert.ok(runtime.snapshot().performance.distantDrivers > 300);
    const distant = identities.map(id => runtime.driver(id)).find(driver => driver.simulationTier === "distant" && !driver.transitLineId);
    assert.ok(distant);
    const starts = runtime.snapshot().performance;
    system.step(120, 1 / 60);
    const after = runtime.snapshot().performance;
    assert.ok(after.distantSteps - starts.distantSteps < 3000, "distant cars advance at coarse cadence, not once per render frame");
    for (const id of identities.filter(id => id.startsWith("bus:"))) {
      assert.equal(runtime.driver(id).simulationTier, "physical");
      assert.equal(runtime.driver(id).journey, routes.get(id));
    }
    // Move the streaming focus/camera near a dormant driver. No manual token
    // assignment or pose rewrite: normal promotion and appearance guards apply.
    const view = system.scene.cameras.main.worldView;
    center.x = distant.pose.x; center.y = distant.pose.y;
    system.scene.player.x = center.x; system.scene.player.y = center.y + 100;
    view.x = center.x - view.width / 2; view.y = center.y - view.height / 2;
    system.city.update();
    await Promise.all(system.city.loadPromises.values());
    while (system.city.activationQueue.size) system.city.update();
    system.step(1, 1 / 60);
    assert.equal(distant.simulationTier, "physical");
    assert.equal(system.materializer.assignments.has(distant.tokenId), false, "promotion inside the camera cannot create a visible car");
    const before = new Map([...system.materializer.assignments].map(([id, slot]) => [id, { slot, pose: { ...runtime.driver(id).pose }, rejected: runtime.driver(id).rejectedSteps }]));
    system.step(1, 1 / 60);
    for (const [id, previous] of before) {
      const driver = runtime.driver(id), slot = system.materializer.assignments.get(id);
      if (!slot) continue;
      assert.equal(slot, previous.slot);
      assert.equal(driver.simulationTier, "physical");
      if (driver.rejectedSteps === previous.rejected) assert.deepEqual(driver.pose,
        stepVehicleKinematics(previous.pose, driver.controls, 1 / 60, driver.archetype));
    }
    assert.deepEqual(runtime.agents().map(agent => agent.tokenId), identities);
    for (const id of identities) assert.equal(runtime.driver(id).journey, routes.get(id));
    assert.equal(system.metrics().visibleSpawns, 0);
    assert.equal(system.metrics().overlaps, 0);
    assert.equal(runtime.tokenCount(), 606);
  } finally { system.destroy(); }
});
