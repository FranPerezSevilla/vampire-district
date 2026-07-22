import { expect, test } from "@playwright/test";

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

test.describe.configure({ timeout: 75_000 });

test("local traffic brakes for the driven vehicle, keeps its slot and resumes when clear", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForTrafficBehavior(page);

  const result = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.switchLayer(0, { x: 760, y: 338 }, "Local traffic behavior test.");
    await window.NBD_CITY_STREAM.forceFocus(760, 338);
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
    const recoveredSnapshot = window.NBD_TRAFFIC_BEHAVIOR.step(0.9);
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
      braking,
      recovered,
      assignmentBefore,
      assignmentDuring,
      assignmentAfter,
      slotStillActive: slot.container.active,
      playerReactiveVehicles: brakingSnapshot.playerReactiveVehicles,
      finalPlayerReactiveVehicles: recoveredSnapshot.playerReactiveVehicles
    };
  });

  expect(result.missing).toBe(false);
  expect(result.poolSize).toBe(10);
  expect(result.assignmentBefore.slotIndex).toBe(result.selected.slotIndex);
  expect(result.assignmentDuring.slotIndex).toBe(result.selected.slotIndex);
  expect(result.assignmentAfter.slotIndex).toBe(result.selected.slotIndex);
  expect(result.braking.reason).toBe("player-vehicle");
  expect(result.braking.speedFactor).toBeLessThan(1);
  expect(result.playerReactiveVehicles).toBeGreaterThan(0);
  expect(result.recovered.speedFactor).toBeGreaterThan(result.braking.speedFactor);
  expect(["cruise", "catch-up", "traffic", "junction-yield"].includes(result.recovered.reason)).toBe(true);
  expect(result.finalPlayerReactiveVehicles).toBe(0);
  expect(result.slotStillActive).toBe(true);
  expect(pageErrors).toEqual([]);
});
