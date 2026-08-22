import { expect, test } from "@playwright/test";

async function waitForRouteBehavior(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_CITY_STREAM_READY
    && window.NBD_MACRO_CITY_READY
    && window.NBD_TRAFFIC_READY
    && window.NBD_TRAFFIC_BEHAVIOR_READY
    && window.NBD_TRAFFIC_ROUTE_MULTI_AGENT
    && window.NBD_TRAFFIC_ROUTE_MULTI_AGENT.snapshot().enabled
    && window.NBD_TRAFFIC_ROUTE_MULTI_AGENT.snapshot().routeBehavior?.active
  ));
}

async function waitForTrafficSteering(page) {
  await waitForRouteBehavior(page);
  await page.waitForFunction(() => Boolean(
    window.NBD_TRAFFIC_STEERING_READY
    && window.NBD_TRAFFIC_STEERING
  ));
}

test.describe.configure({ timeout: 75_000 });

test("default compiler-route traffic brakes for the driven vehicle, keeps its slot and resumes when clear", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForRouteBehavior(page);

  const result = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const multi = window.NBD_TRAFFIC_ROUTE_MULTI_AGENT;
    const materializer = scene.trafficMaterializationSystem;
    const topology = materializer.lanes.localTopology;
    const runtime = multi.__policy.runtime();

    scene.switchLayer(0, { x: 1140, y: 960 }, "Route-aware traffic behavior test.");
    await window.NBD_CITY_STREAM.forceFocus(1140, 960);
    window.NBD_TRAFFIC.resync();
    multi.step(0.05);

    function candidate() {
      const behavior = multi.snapshot().routeBehavior;
      const agents = new Map(runtime.agents().map(agent => [agent.tokenId, agent]));
      return behavior.vehicles
        .filter(vehicle => vehicle.reason === "route-cruise")
        .map(vehicle => ({ vehicle, agent: agents.get(vehicle.tokenId), slot: materializer.assignments.get(vehicle.tokenId) }))
        .find(item => item.slot?.routeActive
          && item.agent?.stage === "lane"
          && item.agent.stageProgress > 0.08
          && item.agent.stageProgress < 0.78) || null;
    }

    const selected = candidate();
    if (!selected) return { missing: true, routeBehavior: multi.snapshot().routeBehavior };

    const { agent, slot } = selected;
    const lane = topology.lanes[agent.currentLaneId];
    const laneLength = Math.max(1, Number(lane.length) || 1);
    const playerVehicle = scene.vehicleSystem.vehicles[0];
    const originalVehicle = {
      currentVehicleId: scene.vehicleSystem.currentVehicleId,
      x: playerVehicle.x,
      y: playerVehicle.y,
      angle: playerVehicle.angle,
      containerX: playerVehicle.container.x,
      containerY: playerVehicle.container.y,
      containerRotation: playerVehicle.container.rotation,
      playerX: scene.player.x,
      playerY: scene.player.y
    };
    const blockerProgress = Math.min(0.94, agent.stageProgress + 72 / laneLength);
    const blockerPoint = materializer.constructor.pointAlongPolyline(lane.points, blockerProgress);
    playerVehicle.x = blockerPoint.x;
    playerVehicle.y = blockerPoint.y;
    playerVehicle.angle = blockerPoint.angle;
    playerVehicle.container.setPosition(playerVehicle.x, playerVehicle.y).setRotation(playerVehicle.angle);
    scene.vehicleSystem.currentVehicleId = playerVehicle.id;
    scene.player.setPosition(playerVehicle.x, playerVehicle.y);

    const slotIndex = slot.slotIndex;
    const slotRef = slot;
    let braking = null;
    for (let index = 0; index < 9; index++) {
      multi.step(0.05);
      braking = multi.snapshot().routeBehavior.vehicles.find(vehicle => vehicle.tokenId === agent.tokenId) || braking;
      if (braking?.blockerId === playerVehicle.id && braking.speedFactor < 0.9) break;
    }
    const assignmentDuring = materializer.assignments.get(agent.tokenId);

    const currentAgent = runtime.agents().find(item => item.tokenId === agent.tokenId);
    const clearLane = topology.lanes[currentAgent.currentLaneId];
    const clearProgress = Math.max(0.01, currentAgent.stageProgress - 0.12);
    const clearPoint = materializer.constructor.pointAlongPolyline(clearLane.points, clearProgress);
    playerVehicle.x = clearPoint.x;
    playerVehicle.y = clearPoint.y;
    playerVehicle.angle = clearPoint.angle;
    playerVehicle.container.setPosition(playerVehicle.x, playerVehicle.y).setRotation(playerVehicle.angle);
    scene.player.setPosition(playerVehicle.x, playerVehicle.y);

    let recovered = braking;
    for (let index = 0; index < 24; index++) {
      multi.step(0.05);
      recovered = multi.snapshot().routeBehavior.vehicles.find(vehicle => vehicle.tokenId === agent.tokenId) || recovered;
    }
    const assignmentAfter = materializer.assignments.get(agent.tokenId);

    scene.vehicleSystem.currentVehicleId = originalVehicle.currentVehicleId;
    playerVehicle.x = originalVehicle.x;
    playerVehicle.y = originalVehicle.y;
    playerVehicle.angle = originalVehicle.angle;
    playerVehicle.container
      .setPosition(originalVehicle.containerX, originalVehicle.containerY)
      .setRotation(originalVehicle.containerRotation);
    scene.player.setPosition(originalVehicle.playerX, originalVehicle.playerY);

    return {
      missing: false,
      tokenId: agent.tokenId,
      playerVehicleId: playerVehicle.id,
      slotIndex,
      sameSlotDuring: assignmentDuring === slotRef && assignmentDuring?.slotIndex === slotIndex,
      sameSlotAfter: assignmentAfter === slotRef && assignmentAfter?.slotIndex === slotIndex,
      braking,
      recovered,
      laneAuthority: window.NBD_TRAFFIC.snapshot().laneAuthority,
      routeBehavior: multi.snapshot().routeBehavior
    };
  });

  expect(result.missing).toBe(false);
  expect(result.laneAuthority).toBe("compiler-route-lanes");
  expect(result.sameSlotDuring).toBe(true);
  expect(result.sameSlotAfter).toBe(true);
  expect(result.braking.blockerId).toBe(result.playerVehicleId);
  expect(result.braking.reason).toBe("player-vehicle");
  expect(result.braking.speedFactor).toBeLessThan(1);
  expect(result.recovered.speedFactor).toBeGreaterThan(result.braking.speedFactor);
  expect(result.recovered.blockerId).not.toBe(result.playerVehicleId);
  expect(result.routeBehavior.movementAuthority).toBe(false);
  expect(result.routeBehavior.geometryAuthority).toBe("compiler-local-topology");
  expect(pageErrors).toEqual([]);
});

test("default compiler-route traffic brakes for a parked car without leaving compiler geometry", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForTrafficSteering(page);

  const result = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const multi = window.NBD_TRAFFIC_ROUTE_MULTI_AGENT;
    const materializer = scene.trafficMaterializationSystem;
    const topology = materializer.lanes.localTopology;
    const runtime = multi.__policy.runtime();

    scene.switchLayer(0, { x: 1140, y: 960 }, "Route-safe parked blocker test.");
    await window.NBD_CITY_STREAM.forceFocus(1140, 960);
    window.NBD_TRAFFIC.resync();
    multi.step(0.05);

    const agents = new Map(runtime.agents().map(agent => [agent.tokenId, agent]));
    const selected = multi.snapshot().routeBehavior.vehicles
      .filter(vehicle => vehicle.reason === "route-cruise")
      .map(vehicle => ({ vehicle, agent: agents.get(vehicle.tokenId), slot: materializer.assignments.get(vehicle.tokenId) }))
      .find(item => item.slot?.routeActive
        && item.agent?.stage === "lane"
        && item.agent.stageProgress > 0.08
        && item.agent.stageProgress < 0.78) || null;
    const blocker = scene.vehicleSystem.vehicle("market_sedan")
      || scene.vehicleSystem.vehicles.find(vehicle => vehicle.id !== scene.vehicleSystem.currentVehicleId);
    if (!selected || !blocker) {
      return { missing: true, noBlocker: !blocker, routeBehavior: multi.snapshot().routeBehavior };
    }

    const { agent, slot } = selected;
    const lane = topology.lanes[agent.currentLaneId];
    const laneLength = Math.max(1, Number(lane.length) || 1);
    const original = {
      x: blocker.x,
      y: blocker.y,
      angle: blocker.angle,
      parked: blocker.parked,
      containerX: blocker.container.x,
      containerY: blocker.container.y,
      containerRotation: blocker.container.rotation
    };
    const blockerProgress = Math.min(0.94, agent.stageProgress + 72 / laneLength);
    const blockerPoint = materializer.constructor.pointAlongPolyline(lane.points, blockerProgress);
    blocker.x = blockerPoint.x;
    blocker.y = blockerPoint.y;
    blocker.angle = blockerPoint.angle;
    blocker.parked = true;
    blocker.container.setPosition(blocker.x, blocker.y).setRotation(blocker.angle);

    const slotRef = slot;
    const slotIndex = slot.slotIndex;
    let braking = null;
    for (let index = 0; index < 9; index++) {
      multi.step(0.05);
      braking = multi.snapshot().routeBehavior.vehicles.find(vehicle => vehicle.tokenId === agent.tokenId) || braking;
      if (braking?.blockerId === blocker.id && braking.speedFactor < 0.9) break;
    }

    const routePoseBeforeSteering = runtime.materializationTokens().find(token => token.tokenId === agent.tokenId);
    const slotBeforeSteering = materializer.assignments.get(agent.tokenId);
    const before = { x: slotBeforeSteering.x, y: slotBeforeSteering.y };
    window.NBD_TRAFFIC_STEERING.step(0.25);
    const slotAfterSteering = materializer.assignments.get(agent.tokenId);
    const routePoseAfterSteering = runtime.materializationTokens().find(token => token.tokenId === agent.tokenId);

    blocker.x = original.x;
    blocker.y = original.y;
    blocker.angle = original.angle;
    blocker.parked = original.parked;
    blocker.container
      .setPosition(original.containerX, original.containerY)
      .setRotation(original.containerRotation);

    let recovered = braking;
    for (let index = 0; index < 24; index++) {
      multi.step(0.05);
      recovered = multi.snapshot().routeBehavior.vehicles.find(vehicle => vehicle.tokenId === agent.tokenId) || recovered;
    }

    return {
      missing: false,
      blockerId: blocker.id,
      tokenId: agent.tokenId,
      slotIndex,
      sameSlot: materializer.assignments.get(agent.tokenId) === slotRef,
      braking,
      recovered,
      poseDeltaFromSteering: Math.hypot(slotAfterSteering.x - before.x, slotAfterSteering.y - before.y),
      compilerPoseDeltaBefore: Math.hypot(slotBeforeSteering.x - routePoseBeforeSteering.x, slotBeforeSteering.y - routePoseBeforeSteering.y),
      compilerPoseDeltaAfter: Math.hypot(slotAfterSteering.x - routePoseAfterSteering.x, slotAfterSteering.y - routePoseAfterSteering.y),
      steeringOffset: slotAfterSteering.steeringOffset,
      steeringAngle: slotAfterSteering.steeringAngle,
      steeringReason: slotAfterSteering.steeringReason,
      routeBehavior: multi.snapshot().routeBehavior
    };
  });

  expect(result.missing).toBe(false);
  expect(result.sameSlot).toBe(true);
  expect(result.braking.blockerId).toBe(result.blockerId);
  expect(result.braking.reason).toBe("parked-vehicle");
  expect(result.braking.speedFactor).toBeLessThan(1);
  expect(result.recovered.speedFactor).toBeGreaterThan(result.braking.speedFactor);
  expect(result.poseDeltaFromSteering).toBeLessThanOrEqual(0.001);
  expect(result.compilerPoseDeltaBefore).toBeLessThanOrEqual(0.001);
  expect(result.compilerPoseDeltaAfter).toBeLessThanOrEqual(0.001);
  expect(result.steeringOffset).toBe(0);
  expect(result.steeringAngle).toBe(0);
  expect(result.steeringReason).toBe("route-braking-no-lateral");
  expect(result.routeBehavior.lateralSteeringAuthority).toBe(false);
  expect(pageErrors).toEqual([]);
});
