import { expect, test } from "@playwright/test";

function baseBehaviorReason(reason) {
  return String(reason || "").replace(/^assertive-/, "");
}

async function waitForTrafficBehavior(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_CITY_STREAM_READY
    && window.NBD_MACRO_CITY_READY
    && window.NBD_TRAFFIC_READY
    && window.NBD_TRAFFIC_BEHAVIOR_READY
    && window.NBD_TRAFFIC
    && window.NBD_TRAFFIC_BEHAVIOR
  ));
}

async function waitForTrafficSteering(page) {
  await waitForTrafficBehavior(page);
  await page.waitForFunction(() => Boolean(
    window.NBD_TRAFFIC_STEERING_READY
    && window.NBD_TRAFFIC_STEERING
  ));
}

test.describe.configure({ timeout: 75_000 });

test("local traffic reacts to the driven vehicle, keeps its slot and resumes when clear", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForTrafficBehavior(page);

  const result = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.switchLayer(0, { x: 1140, y: 960 }, "Local traffic behavior test.");
    await window.NBD_CITY_STREAM.forceFocus(1140, 960);
    window.NBD_TRAFFIC.resync();
    window.NBD_TRAFFIC_BEHAVIOR.step(0.05);

    const initialBehavior = window.NBD_TRAFFIC_BEHAVIOR.snapshot();
    const selected = initialBehavior.vehicles.find(vehicle => vehicle.phase > 0.1 && vehicle.phase < 0.72)
      || initialBehavior.vehicles[0];
    if (!selected) return { missing: true, initialBehavior };

    const slot = scene.trafficMaterializationSystem.pool[selected.slotIndex];
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
    const blockerPoint = window.NBD_TRAFFIC_BEHAVIOR.point(selected.tokenId, selected.phase + 0.055);
    playerVehicle.x = blockerPoint.x;
    playerVehicle.y = blockerPoint.y;
    playerVehicle.angle = blockerPoint.angle;
    playerVehicle.container.setPosition(playerVehicle.x, playerVehicle.y).setRotation(playerVehicle.angle);
    scene.vehicleSystem.currentVehicleId = playerVehicle.id;
    scene.player.setPosition(playerVehicle.x, playerVehicle.y);

    window.NBD_TRAFFIC.resync();
    const assignmentBefore = window.NBD_TRAFFIC.snapshot().materialized.find(item => item.tokenId === selected.tokenId);
    const brakingSnapshot = window.NBD_TRAFFIC_BEHAVIOR.step(0.35);
    const braking = brakingSnapshot.vehicles.find(vehicle => vehicle.tokenId === selected.tokenId);
    const assignmentDuring = window.NBD_TRAFFIC.snapshot().materialized.find(item => item.tokenId === selected.tokenId);

    const clearPoint = window.NBD_TRAFFIC_BEHAVIOR.point(selected.tokenId, Math.max(0.01, braking.phase - 0.08));
    playerVehicle.x = clearPoint.x;
    playerVehicle.y = clearPoint.y;
    playerVehicle.angle = clearPoint.angle;
    playerVehicle.container.setPosition(playerVehicle.x, playerVehicle.y).setRotation(playerVehicle.angle);
    scene.player.setPosition(playerVehicle.x, playerVehicle.y);
    window.NBD_MACRO_CITY.forceTick(0.6);
    window.NBD_TRAFFIC.resync();
    const recoveredSnapshot = window.NBD_TRAFIC_BEHAVIOR.step(0.9);
    const recovered = recoveredSnapshot.vehicles.find(vehicle => vehicle.tokenId === selected.tokenId);
    const assignmentAfter = window.NBD_TRAFFIC.snapshot().materialized.find(item => item.tokenId === selected.tokenId);
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
      poolSize: scene.trafficMaterializationSystem.pool.length,
      selected,
      playerVehicleId: playerVehicle.id,
      braking,
      recovered,
      assignmentBefore,
      assignmentDuring,
      assignmentAfter,
      slotStillActive: slot.container.active,
      finalPlayerReactiveVehicles: recoveredSnapshot.playerReactiveVehicles
    };
  });

  expect(result.missing).toBe(false);
  expect(result.poolSize).toBe(10);
  expect(result.assignmentBefore.slotIndex).toBe(result.selected.slotIndex);
  expect(result.assignmentDuring.slotIndex).toBe(result.selected.slotIndex);
  expect(result.assignmentAfter.slotIndex).toBe(result.selected.slotIndex);

  const brakingReason = baseBehaviorReason(result.braking.reason);
  // The driven car can be detected directly, as a junction occupant, or through
  // the approved local avoidance pass. The blocker identity is the stable invariant.
  expect(["player-vehicle", "junction-player", "obstacle-avoid", "steering-around-stopped-player"])
    .toContain(brakingReason);
  expect(result.braking.blockerId).toBe(result.playerVehicleId);
  expect(result.braking.speedFactor).toBeLessThan(1);

  expect(result.recovered.speedFactor).toBeGreaterThan(result.braking.speedFactor);
  expect(["player-vehicle", "junction-player", "steering-around-stopped-player"])
    .not.toContain(baseBehaviorReason(result.recovered.reason));
  expect(result.recovered.blockerId).not.toBe(result.playerVehicleId);
  expect(result.finalPlayerReactiveVehicles).toBe(0);
  expect(result.slotStillActive).toBe(true);
  expect(pageErrors).toEqual([]);
});

test("local traffic visibly steers around a parked car and counter-steers back into lane", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForTrafficSteering(page);

  const result = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.switchLayer(0, { x: 1140, y: 960 }, "Visible traffic steering test.");
    await window.NBD_CITY_STREAM.forceFocus(1140, 960);
    window.NBD_TRAFFIC.resync();
    window.NBD_TRAFFIC_BEHAVIOR.step(0.05);

    const initial = window.NBD_TRAFFIC_BEHAVIOR.snapshot();
    const cruisingTokenIds = initial.vehicles
      .filter(vehicle => String(vehicle.reason || "").replace(/^assertive-/, "") === "cruise")
      .map(vehicle => vehicle.tokenId);
    const candidateTokenIds = [
      ...cruisingTokenIds,
      ...initial.vehicles
        .map(vehicle => vehicle.tokenId)
        .filter(tokenId => !cruisingTokenIds.includes(tokenId))
    ];
    const blocker = scene.vehicleSystem.vehicle("market_sedan")
      || scene.vehicleSystem.vehicles.find(vehicle => vehicle.id !== scene.vehicleSystem.currentVehicleId);
    if (!blocker) return { missing: true, noBlocker: true, initial };

    const original = {
      x: blocker.x,
      y: blocker.y,
      angle: blocker.angle,
      parked: blocker.parked,
      containerX: blocker.container.x,
      containerY: blocker.container.y,
      containerRotation: blocker.container.rotation
    };
    const blockerRadius = Math.max(
      Number(blocker.archetype?.width) || 28,
      Number(blocker.archetype?.height) || 14
    ) * 0.43;
    const attempts = [];
    let selectedTokenId = null;
    let behaviorDuring = null;
    let steeringDuring = null;

    for (const tokenId of candidateTokenIds) {
      const current = window.NBD_TRAFFIC_BEHAVIOR.snapshot().vehicles
        .find(vehicle => vehicle.tokenId === tokenId);
      if (!current) continue;
      const slot = scene.trafficMaterializationSystem.pool[current.slotIndex];
      const lane = scene.trafficLocalBehaviorSystem.laneFor(current);
      if (!slot || !lane?.length) continue;

      const targetGap = 58;
      const phaseOffset = (targetGap + Math.max(1, Number(slot.radius) || 14) + blockerRadius) / lane.length;
      const blockerPhase = current.phase + phaseOffset;
      if (blockerPhase >= 0.94) continue;
      const point = window.NBD_TRAFFIC_BEHAVIOR.point(tokenId, blockerPhase);
      if (!point) continue;

      blocker.x = point.x;
      blocker.y = point.y;
      blocker.angle = point.angle;
      blocker.parked = true;
      blocker.container.setPosition(blocker.x, blocker.y).setRotation(blocker.angle);

      const behavior = window.NBD_TRAFFIC_BEHAVIOR.step(0.05);
      const currentBehavior = behavior.vehicles.find(vehicle => vehicle.tokenId === tokenId) || null;
      const steering = window.NBD_TRAFFIC_STEERING.step(0.05);
      const currentSteering = steering.vehicles.find(vehicle => vehicle.tokenId === tokenId) || null;
      attempts.push({
        tokenId,
        blockerPhase,
        behaviorReason: currentBehavior?.reason || null,
        behaviorBlockerId: currentBehavior?.blockerId || null,
        behaviorGap: currentBehavior?.gap ?? null,
        steeringActive: Boolean(currentSteering?.active)
      });

      if (currentBehavior?.blockerId === blocker.id && currentSteering?.active) {
        selectedTokenId = tokenId;
        behaviorDuring = currentBehavior;
        steeringDuring = currentSteering;
        break;
      }
    }

    if (selectedTokenId) {
      for (let index = 0; index < 7; index++) {
        const behavior = window.NBD_TRAFFIC_BEHAVIOR.step(0.05);
        const currentBehavior = behavior.vehicles.find(vehicle => vehicle.tokenId === selectedTokenId) || null;
        if (currentBehavior?.blockerId === blocker.id) behaviorDuring = currentBehavior;

        const steering = window.NBD_TRAFFIC_STEERING.step(0.05);
        const currentSteering = steering.vehicles.find(vehicle => vehicle.tokenId === selectedTokenId) || null;
        if (currentSteering?.active
          && (!steeringDuring || Math.abs(currentSteering.offset) > Math.abs(steeringDuring.offset))) {
          steeringDuring = currentSteering;
        }
      }
    }

    blocker.x = original.x;
    blocker.y = original.y;
    blocker.angle = original.angle;
    blocker.parked = original.parked;
    blocker.container
      .setPosition(original.containerX, original.containerY)
      .setRotation(original.containerRotation);

    let steeringRecovered = null;
    if (selectedTokenId) {
      for (let index = 0; index < 24; index++) {
        window.NBD_TRAFFIC_BEHAVIOR.step(0.05);
        const steering = window.NBD_TRAFFIC_STEERING.step(0.05);
        steeringRecovered = steering.vehicles.find(vehicle => vehicle.tokenId === selectedTokenId) || steeringRecovered;
      }
    }

    return {
      missing: candidateTokenIds.length === 0,
      setupFound: Boolean(selectedTokenId),
      blockerId: blocker.id,
      selectedTokenId,
      behaviorDuring,
      steeringDuring,
      steeringRecovered,
      totalAvoidances: window.NBD_TRAFFIC_STEERING.snapshot().totalAvoidances,
      candidateTokenIds,
      attempts
    };
  });

  expect(result.missing).toBe(false);
  expect(result.setupFound, JSON.stringify(result.attempts)).toBe(true);
  expect(result.behaviorDuring?.blockerId).toBe(result.blockerId);
  expect(result.steeringDuring?.active).toBe(true);
  expect(Math.abs(result.steeringDuring?.offset || 0)).toBeGreaterThan(2);
  expect(Math.abs(result.steeringDuring?.steerAngle || 0)).toBeGreaterThan(0.02);
  expect(result.totalAvoidances).toBeGreaterThan(0);
  expect(result.steeringRecovered?.active).toBe(false);
  expect(Math.abs(result.steeringRecovered?.offset || 0)).toBeLessThan(0.5);
  expect(pageErrors).toEqual([]);
});
