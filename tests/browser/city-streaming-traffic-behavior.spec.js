import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 90_000 });

async function ready(page) {
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.NBD_TRAFFIC_ROUTE_MULTI_AGENT?.snapshot().driverActive
    && window.NBD_TRAFFIC_PHYSICS_READY && window.NBD_TRAFFIC_STEERING_READY
    && window.NBD_TRAFFIC_ROUTE_MULTI_AGENT.snapshot().routeBehavior.vehicles.some(vehicle => vehicle.speed > 40));
}

test("the driver brakes for the player's car and resumes the same journey when it clears", async ({ page }) => {
  await ready(page);
  const result = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const policy = scene.trafficLocalAssignmentPolicy.multiAgentRoutePolicy;
    const materializer = scene.trafficMaterializationSystem;
    const runtime = policy.runtime();
    const selected = runtime.agents().find(agent => {
      const slot = materializer.assignments.get(agent.tokenId);
      const driver = runtime.driver(agent.tokenId);
      const stage = driver.journey.stages.find(stage => stage.kind === "lane" && stage.laneId === agent.currentLaneId);
      return slot && agent.stage === "lane" && agent.pose.speed > 40 && stage.end - driver.progress > 220;
    });
    if (!selected) return { missing: true };
    const slot = materializer.assignments.get(selected.tokenId);
    const vehicle = scene.vehicleSystem.vehicles[0];
    const saved = { x: vehicle.x, y: vehicle.y, angle: vehicle.angle, speed: vehicle.speed };
    const currentVehicleId = scene.vehicleSystem.currentVehicleId;
    const fx = Math.cos(slot.angle), fy = Math.sin(slot.angle);
    Object.assign(vehicle, { x: slot.x + fx * 65, y: slot.y + fy * 65, angle: slot.angle, speed: 0 });
    scene.vehicleSystem.currentVehicleId = vehicle.id;
    let lowestSpeed = selected.pose.speed, sawBlocker = false, contacts = 0;
    const startContacts = scene.trafficPhysicalConsequencesSystem.totalTrafficContacts;
    for (let frame = 0; frame < 16; frame++) {
      policy.update(0.05); materializer.update(0.05);
      const behavior = policy.snapshot().routeBehavior.vehicles.find(driver => driver.tokenId === selected.tokenId);
      lowestSpeed = Math.min(lowestSpeed, behavior.speed);
      sawBlocker ||= behavior.blockerId === vehicle.id;
    }
    const stoppedPose = { x: slot.x, y: slot.y };
    Object.assign(vehicle, saved);
    scene.vehicleSystem.currentVehicleId = currentVehicleId;
    for (let frame = 0; frame < 35; frame++) { policy.update(0.05); materializer.update(0.05); }
    contacts = scene.trafficPhysicalConsequencesSystem.totalTrafficContacts - startContacts;
    const final = runtime.agents().find(agent => agent.tokenId === selected.tokenId);
    return { missing: false, sawBlocker, lowestSpeed, initialSpeed: selected.pose.speed, contacts,
      distanceAfterClear: Math.hypot(slot.x - stoppedPose.x, slot.y - stoppedPose.y),
      sameSlot: materializer.assignments.get(selected.tokenId) === slot,
      sameDestination: final.destinationLaneId === selected.destinationLaneId,
      architecture: policy.snapshot().routeBehavior.architecture };
  });
  expect(result.missing).toBe(false);
  expect(result.sawBlocker).toBe(true);
  expect(result.lowestSpeed).toBeLessThan(result.initialSpeed * 0.8);
  expect(result.contacts).toBe(0);
  expect(result.distanceAfterClear).toBeGreaterThan(25);
  expect(result.sameSlot).toBe(true);
  expect(result.sameDestination).toBe(true);
  expect(result.architecture).toBe("destination-vehicle-driver");
});

test("an emergency bypass is driven with steering and reverse controls through native clearance", async ({ page }) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { planDriverManeuver } = await import("/phaser/src/streaming/TrafficDriverController.js");
    const { createVehicleState, stepVehicleKinematics } = await import("/phaser/src/vehicles/VehicleModel.js");
    const { orientedVehicleContact } = await import("/phaser/src/streaming/TrafficPhysicalConsequencesSystem.js");
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const runtime = scene.trafficLocalAssignmentPolicy.multiAgentRoutePolicy.runtime();
    const { trafficVehicleArchetype } = await import("/phaser/src/data/vehicles.js");
    const archetype = trafficVehicleArchetype("test");
    const initial = createVehicleState({ id: "emergency-regression", x: 0, y: 0, angle: 0 }, archetype);
    const obstacle = { x: 32, y: 0, angle: 0, archetype };
    const safe = pose => Math.abs(pose.y) < 30 && !orientedVehicleContact({ ...pose, archetype }, obstacle);
    const maneuver = planDriverManeuver({ pose: initial, archetype, goal: { x: 125, y: 0, angle: 0 }, safe });
    if (!maneuver) return { missing: true };
    let pose = initial, reversed = false, contacts = 0, lateralTranslations = 0;
    for (const controls of maneuver.frames) {
      const next = stepVehicleKinematics(pose, controls, 0.05, archetype);
      reversed ||= next.speed < 0;
      if (!safe(next)) contacts++;
      if (Math.abs((next.x - pose.x) * Math.sin(next.travelAngle)
        - (next.y - pose.y) * Math.cos(next.travelAngle)) > 1e-7) lateralTranslations++;
      pose = next;
    }
    return { missing: false, reversed, contacts, lateralTranslations,
      goalDistance: Math.hypot(pose.x - 125, pose.y),
      liveDriverCount: runtime.snapshot().routeBehavior.activeVehicles };
  });
  expect(result.missing).toBe(false);
  expect(result.liveDriverCount).toBeGreaterThan(0);
  expect(result.reversed).toBe(true);
  expect(result.contacts).toBe(0);
  expect(result.lateralTranslations).toBe(0);
  expect(result.goalDistance).toBeLessThan(13);
});
