import { expect, test } from "@playwright/test";

async function waitForCollisionRuntime(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_CITY_STREAM_READY
    && window.NBD_TRAFFIC_READY
    && window.NBD_TRAFFIC_PHYSICS_READY
    && window.NBD_VEHICLE_COLLISIONS_READY
    && window.NBD_VEHICLE_COLLISIONS
  ));
}

test.describe.configure({ timeout: 90_000 });

test("a traffic contact bleeds speed and deflects instead of freezing the driven car", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForCollisionRuntime(page);

  const result = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.switchLayer(0, { x: 1140, y: 960 }, "Collision softening test.");
    await window.NBD_CITY_STREAM.forceFocus(1140, 960);
    window.NBD_TRAFFIC.resync();
    window.NBD_TRAFFIC_BEHAVIOR.step(0.05);

    const traffic = window.NBD_TRAFFIC.snapshot();
    const selected = traffic.materialized[0];
    if (!selected) return { missing: true, traffic };
    const slot = scene.trafficMaterializationSystem.pool[selected.slotIndex];
    const vehicle = scene.vehicleSystem.vehicle("refuge_compact");
    const ownRadius = Math.max(vehicle.archetype.width, vehicle.archetype.height) * 0.43;
    const clearance = ownRadius + slot.radius + 1;
    const forwardX = Math.cos(slot.angle);
    const forwardY = Math.sin(slot.angle);

    scene.vehicleSystem.exitVehicle({ force: true });
    vehicle.x = slot.x - forwardX * (clearance + 2.5);
    vehicle.y = slot.y - forwardY * (clearance + 2.5);
    vehicle.angle = slot.angle;
    vehicle.travelAngle = slot.angle;
    vehicle.driftAngle = 0;
    vehicle.speed = 96;
    vehicle.velocityX = forwardX * vehicle.speed;
    vehicle.velocityY = forwardY * vehicle.speed;
    vehicle.parked = false;
    vehicle.disabled = false;
    vehicle.container.setPosition(vehicle.x, vehicle.y).setRotation(vehicle.angle);
    scene.player.setPosition(vehicle.x, vehicle.y);
    scene.vehicleSystem.enterVehicle(vehicle.id, { force: true });

    // Force the old worst-case path: the ambient proxy cannot absorb any more
    // offset, so the former implementation would set the driven speed to zero.
    scene.trafficPhysicalConsequencesSystem.maxOffset = 0;
    const before = {
      x: vehicle.x,
      y: vehicle.y,
      angle: vehicle.angle,
      speed: vehicle.speed
    };
    scene.vehicleSystem.updateDriving(0.05, {
      move: { x: 0.35, y: -1 },
      handbrakeHeld: false
    });
    const collision = window.NBD_VEHICLE_COLLISIONS.snapshot();
    const physical = window.NBD_TRAFFIC_PHYSICS.snapshot();

    return {
      missing: false,
      before,
      after: {
        x: vehicle.x,
        y: vehicle.y,
        angle: vehicle.angle,
        speed: vehicle.speed
      },
      collision,
      physical,
      actionText: scene.lastActionText
    };
  });

  expect(result.missing).toBe(false);
  expect(result.physical.totalContacts).toBeGreaterThan(0);
  expect(result.collision.totalContacts).toBeGreaterThan(0);
  expect(result.collision.totalSoftened).toBeGreaterThan(0);
  expect(result.collision.lastContact.rigid).toBe(true);
  expect(result.collision.lastContact.softened).toBe(true);
  expect(Math.abs(result.after.speed)).toBeGreaterThan(8);
  expect(Math.abs(result.after.speed)).toBeLessThan(Math.abs(result.before.speed));
  expect(
    Math.hypot(result.after.x - result.before.x, result.after.y - result.before.y) > 0.1
      || Math.abs(result.after.angle - result.before.angle) > 0.01
  ).toBe(true);
  expect(result.actionText).toMatch(/glances and slides|bleeds off progressively/);
  expect(pageErrors).toEqual([]);
});
