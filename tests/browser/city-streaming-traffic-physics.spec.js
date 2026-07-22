import { expect, test } from "@playwright/test";

async function waitForTrafficPhysics(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_CITY_STREAM_READY
    && window.NBD_TRAFFIC_READY
    && window.NBD_TRAFFIC_BEHAVIOR_READY
    && window.NBD_TRAFFIC_PHYSICS_READY
    && window.NBD_TRAFFIC
    && window.NBD_TRAFFIC_BEHAVIOR
    && window.NBD_TRAFFIC_PHYSICS
  ));
}

test.describe.configure({ timeout: 75_000 });

test("the driven car softly pushes local traffic without damage, heat or slot replacement", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForTrafficPhysics(page);

  const result = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.switchLayer(0, { x: 760, y: 338 }, "Local traffic physical contact test.");
    await window.NBD_CITY_STREAM.forceFocus(760, 338);
    window.NBD_TRAFFIC.resync();
    window.NBD_TRAFFIC_BEHAVIOR.step(0.05);
    window.NBD_TRAFFIC_PHYSICS.step(0.05);

    const trafficBefore = window.NBD_TRAFFIC.snapshot();
    const selected = trafficBefore.materialized.find(item => Math.abs(Math.sin(item.angle)) < 0.25)
      || trafficBefore.materialized[0];
    if (!selected) return { missing: true, trafficBefore };

    const slot = scene.trafficMaterializationSystem.pool[selected.slotIndex];
    const vehicle = scene.vehicleSystem.vehicles[0];
    const vehicleRadius = Math.max(vehicle.archetype.width, vehicle.archetype.height) * 0.43;
    const startDistance = vehicleRadius + slot.radius + 1.5;
    const forwardX = Math.cos(slot.angle);
    const forwardY = Math.sin(slot.angle);
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
      containerX: vehicle.container.x,
      containerY: vehicle.container.y,
      containerRotation: vehicle.container.rotation,
      playerX: scene.player.x,
      playerY: scene.player.y
    };
    const exposureBefore = scene.exposureSystem.value;
    const heatBefore = JSON.stringify(scene.policeSystem.localHeat || {});
    const assignmentBefore = { tokenId: selected.tokenId, slotIndex: selected.slotIndex };

    vehicle.x = slot.x - forwardX * startDistance;
    vehicle.y = slot.y - forwardY * startDistance;
    vehicle.angle = slot.angle;
    vehicle.travelAngle = slot.angle;
    vehicle.driftAngle = 0;
    vehicle.speed = 110;
    vehicle.velocityX = forwardX * vehicle.speed;
    vehicle.velocityY = forwardY * vehicle.speed;
    vehicle.parked = false;
    vehicle.handbrake = false;
    vehicle.container.setPosition(vehicle.x, vehicle.y).setRotation(vehicle.angle);
    vehicle.visual.label.setRotation(-vehicle.angle);
    scene.vehicleSystem.currentVehicleId = vehicle.id;
    scene.player.setPosition(vehicle.x, vehicle.y);

    scene.vehicleSystem.updateDriving(0.05, {
      move: { x: 0, y: -1 },
      handbrakeHeld: false
    });

    const physicsAfterImpact = window.NBD_TRAFFIC_PHYSICS.snapshot();
    const contactAfterImpact = physicsAfterImpact.contacts.find(item => item.tokenId === selected.tokenId);
    const assignmentAfterImpact = window.NBD_TRAFFIC.snapshot().materialized.find(item => item.tokenId === selected.tokenId);
    const healthAfterImpact = vehicle.health;
    const exposureAfterImpact = scene.exposureSystem.value;
    const heatAfterImpact = JSON.stringify(scene.policeSystem.localHeat || {});
    const speedAfterImpact = vehicle.speed;

    vehicle.x = slot.x - forwardX * 150;
    vehicle.y = slot.y - forwardY * 150;
    vehicle.speed = 0;
    vehicle.velocityX = 0;
    vehicle.velocityY = 0;
    vehicle.container.setPosition(vehicle.x, vehicle.y);
    scene.player.setPosition(vehicle.x, vehicle.y);
    const offsetBeforeRecovery = contactAfterImpact?.offsetDistance || 0;
    for (let index = 0; index < 36; index++) {
      scene.trafficLocalBehaviorSystem.update(0.05, { force: true });
      scene.trafficPhysicalConsequencesSystem.update(0.05, { force: true });
    }
    const physicsRecovered = window.NBD_TRAFFIC_PHYSICS.snapshot();
    const contactRecovered = physicsRecovered.contacts.find(item => item.tokenId === selected.tokenId);
    const assignmentRecovered = window.NBD_TRAFFIC.snapshot().materialized.find(item => item.tokenId === selected.tokenId);

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
    vehicle.container
      .setPosition(original.containerX, original.containerY)
      .setRotation(original.containerRotation);
    vehicle.visual.label.setRotation(-original.angle);
    scene.player.setPosition(original.playerX, original.playerY);

    return {
      missing: false,
      poolSize: scene.trafficMaterializationSystem.pool.length,
      assignmentBefore,
      assignmentAfterImpact,
      assignmentRecovered,
      physicsAfterImpact,
      physicsRecovered,
      contactAfterImpact,
      contactRecovered,
      offsetBeforeRecovery,
      speedAfterImpact,
      healthBefore: original.health,
      healthAfterImpact,
      exposureBefore,
      exposureAfterImpact,
      heatBefore,
      heatAfterImpact,
      actionText: scene.lastActionText
    };
  });

  expect(result.missing).toBe(false);
  expect(result.poolSize).toBe(10);
  expect(result.physicsAfterImpact.totalContacts).toBeGreaterThan(0);
  expect(result.physicsAfterImpact.totalPushes).toBeGreaterThan(0);
  expect(result.physicsAfterImpact.totalBlocks).toBe(0);
  expect(result.physicsAfterImpact.lastContact.pushed).toBe(true);
  expect(result.contactAfterImpact.offsetDistance).toBeGreaterThan(0);
  expect(result.assignmentAfterImpact.slotIndex).toBe(result.assignmentBefore.slotIndex);
  expect(result.assignmentRecovered.slotIndex).toBe(result.assignmentBefore.slotIndex);
  expect(result.healthAfterImpact).toBe(result.healthBefore);
  expect(result.exposureAfterImpact).toBe(result.exposureBefore);
  expect(result.heatAfterImpact).toBe(result.heatBefore);
  expect(Math.abs(result.speedAfterImpact)).toBeLessThan(130);
  expect(result.contactRecovered.offsetDistance).toBeLessThan(result.offsetBeforeRecovery);
  expect(result.actionText).toContain("pushed aside");
  expect(pageErrors).toEqual([]);
});
