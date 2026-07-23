import { expect, test } from "@playwright/test";

async function waitForTrafficImpacts(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_CITY_STREAM_READY
    && window.NBD_TRAFFIC_READY
    && window.NBD_TRAFFIC_BEHAVIOR_READY
    && window.NBD_TRAFFIC_PHYSICS_READY
    && window.NBD_TRAFFIC_IMPACTS_READY
    && window.NBD_TRAFFIC
    && window.NBD_TRAFFIC_IMPACTS
  ));
}

test.describe.configure({ timeout: 75_000 });

test("a hard traffic impact damages once, alerts police and keeps the pooled slot stable", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForTrafficImpacts(page);

  const result = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.switchLayer(0, { x: 1140, y: 960 }, "Graduated traffic impact test.");
    await window.NBD_CITY_STREAM.forceFocus(1140, 960);
    window.NBD_TRAFFIC.resync();
    window.NBD_TRAFFIC_BEHAVIOR.step(0.05);
    window.NBD_TRAFFIC_PHYSICS.step(0.05);
    window.NBD_TRAFFIC_IMPACTS.step(0.05);

    const trafficBefore = window.NBD_TRAFFIC.snapshot();
    const selected = trafficBefore.materialized.find(item => Math.abs(Math.sin(item.angle)) < 0.25)
      || trafficBefore.materialized[0];
    if (!selected) return { missing: true, trafficBefore };

    const slot = scene.trafficMaterializationSystem.pool[selected.slotIndex];
    const vehicle = scene.vehicleSystem.vehicles[0];
    const vehicleRadius = Math.max(vehicle.archetype.width, vehicle.archetype.height) * 0.43;
    const forwardX = Math.cos(slot.angle);
    const forwardY = Math.sin(slot.angle);
    const startDistance = vehicleRadius + slot.radius + 1.5;
    const heatTotal = () => Object.values(scene.policeSystem.localHeat || {})
      .reduce((sum, value) => sum + (Number(value) || 0), 0);
    const original = {
      currentVehicleId: scene.vehicleSystem.currentVehicleId,
      x: vehicle.x,
      y: vehicle.y,
      angle: vehicle.angle,
      travelAngle: vehicle.travelAngle,
      driftAngle: vehicle.driftAngle,
      velocityX: vehicle.velocityX,
      velocityY: vehicle.velocityY,
      speed: vehicle.speed,
      parked: vehicle.parked,
      handbrake: vehicle.handbrake,
      health: vehicle.health,
      disabled: vehicle.disabled,
      playerX: scene.player.x,
      playerY: scene.player.y
    };

    const placeForImpact = speed => {
      vehicle.x = slot.x - forwardX * startDistance;
      vehicle.y = slot.y - forwardY * startDistance;
      vehicle.angle = slot.angle;
      vehicle.travelAngle = slot.angle;
      vehicle.driftAngle = 0;
      vehicle.speed = speed;
      vehicle.velocityX = forwardX * speed;
      vehicle.velocityY = forwardY * speed;
      vehicle.parked = false;
      vehicle.handbrake = false;
      vehicle.disabled = false;
      vehicle.container.setPosition(vehicle.x, vehicle.y).setRotation(vehicle.angle);
      vehicle.visual.label.setRotation(-vehicle.angle);
      scene.vehicleSystem.currentVehicleId = vehicle.id;
      scene.player.setPosition(vehicle.x, vehicle.y);
    };

    const healthBefore = vehicle.health;
    const exposureBefore = scene.exposureSystem.value;
    const heatBefore = heatTotal();
    const assignmentBefore = { tokenId: selected.tokenId, slotIndex: selected.slotIndex };

    placeForImpact(170);
    scene.vehicleSystem.updateDriving(0.05, { move: { x: 0, y: -1 }, handbrakeHeld: false });
    const firstImpact = window.NBD_TRAFFIC_IMPACTS.snapshot();
    const healthAfterFirst = vehicle.health;
    const exposureAfterFirst = scene.exposureSystem.value;
    const heatAfterFirst = heatTotal();
    const assignmentAfterFirst = window.NBD_TRAFFIC.snapshot().materialized
      .find(item => item.tokenId === selected.tokenId);

    placeForImpact(170);
    scene.vehicleSystem.updateDriving(0.05, { move: { x: 0, y: -1 }, handbrakeHeld: false });
    const secondImpact = window.NBD_TRAFFIC_IMPACTS.snapshot();
    const healthAfterSecond = vehicle.health;
    const exposureAfterSecond = scene.exposureSystem.value;
    const heatAfterSecond = heatTotal();
    const assignmentAfterSecond = window.NBD_TRAFFIC.snapshot().materialized
      .find(item => item.tokenId === selected.tokenId);

    scene.vehicleSystem.currentVehicleId = original.currentVehicleId;
    vehicle.x = original.x;
    vehicle.y = original.y;
    vehicle.angle = original.angle;
    vehicle.travelAngle = original.travelAngle;
    vehicle.driftAngle = original.driftAngle;
    vehicle.velocityX = original.velocityX;
    vehicle.velocityY = original.velocityY;
    vehicle.speed = original.speed;
    vehicle.parked = original.parked;
    vehicle.handbrake = original.handbrake;
    vehicle.health = original.health;
    vehicle.disabled = original.disabled;
    vehicle.container.setPosition(vehicle.x, vehicle.y).setRotation(vehicle.angle);
    vehicle.visual.label.setRotation(-vehicle.angle);
    scene.player.setPosition(original.playerX, original.playerY);

    return {
      missing: false,
      poolSize: scene.trafficMaterializationSystem.pool.length,
      assignmentBefore,
      assignmentAfterFirst,
      assignmentAfterSecond,
      firstImpact,
      secondImpact,
      healthBefore,
      healthAfterFirst,
      healthAfterSecond,
      exposureBefore,
      exposureAfterFirst,
      exposureAfterSecond,
      heatBefore,
      heatAfterFirst,
      heatAfterSecond
    };
  });

  expect(result.missing).toBe(false);
  expect(result.poolSize).toBe(10);
  expect(result.firstImpact.totalHardImpacts).toBe(1);
  expect(result.firstImpact.totalSevereImpacts).toBe(0);
  expect(result.firstImpact.lastImpact.tier).toBe("hard");
  expect(result.firstImpact.lastImpact.damage).toBeGreaterThan(0);
  expect(result.firstImpact.lastImpact.suppressed).toBe(false);
  expect(result.healthAfterFirst).toBeLessThan(result.healthBefore);
  expect(result.exposureAfterFirst).toBeGreaterThan(result.exposureBefore);
  expect(result.heatAfterFirst).toBeGreaterThan(result.heatBefore);
  expect(result.assignmentAfterFirst.slotIndex).toBe(result.assignmentBefore.slotIndex);

  expect(result.secondImpact.totalHardImpacts).toBe(1);
  expect(result.secondImpact.totalSuppressedImpacts).toBeGreaterThan(0);
  expect(result.secondImpact.lastImpact.suppressed).toBe(true);
  expect(result.healthAfterSecond).toBe(result.healthAfterFirst);
  expect(result.exposureAfterSecond).toBe(result.exposureAfterFirst);
  expect(result.heatAfterSecond).toBe(result.heatAfterFirst);
  expect(result.assignmentAfterSecond.slotIndex).toBe(result.assignmentBefore.slotIndex);
  expect(pageErrors).toEqual([]);
});
