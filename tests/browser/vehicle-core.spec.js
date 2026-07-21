import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/phaser/"];

test.describe.configure({ timeout: 75_000 });

async function waitForVehicleRuntime(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_VEHICLES_READY
    && window.NBD_SCENARIOS?.snapshot?.().activeId === "vehicle-core"
    && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.vehicleSystem
  ));
}

async function pressGameplayKey(page, key, holdMs = 240) {
  await page.keyboard.down(key);
  await page.waitForTimeout(holdMs);
  await page.keyboard.up(key);
}

async function prepareStreetVehicle(page, vehicleId = "refuge_compact") {
  await page.evaluate(id => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const vehicle = scene.vehicleSystem.vehicle(id);
    scene.vehicleSystem.exitVehicle({ force: true });
    scene.switchLayer(0, { x: vehicle.x - 18, y: vehicle.y }, `Vehicle test: approach ${id}.`);
    scene.inputSystem.reset();
  }, vehicleId);
}

for (const route of ROUTES) {
  test(`${route} uses Enter for vehicle entry and exit`, async ({ page }) => {
    await page.goto(`${route}?testScenario=vehicle-core`, { waitUntil: "domcontentloaded" });
    await waitForVehicleRuntime(page);
    await prepareStreetVehicle(page);

    const before = await page.evaluate(() => {
      const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
      const option = scene.vehicleSystem.collectInteractions()
        .find(candidate => candidate.id === "enter_refuge_compact");
      return {
        option: option && { type: option.type, label: option.label, detail: option.detail },
        x: scene.vehicleSystem.vehicle("refuge_compact").x
      };
    });
    expect(before.option).toMatchObject({
      type: "vehicleEnter",
      label: "Enter Refuge compact"
    });
    expect(before.option.detail).toContain("ENTER");

    await page.locator("#game-root canvas").focus();
    await pressGameplayKey(page, "Enter");
    await page.waitForFunction(() => window.NBD_VEHICLES.snapshot().occupiedVehicleId === "refuge_compact");

    const entered = await page.evaluate(() => {
      const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
      return {
        playerVisible: scene.player.visible,
        occupied: scene.registry.get("vehicleOccupied"),
        hud: scene.vehicleSystem.hud.text
      };
    });
    expect(entered.playerVisible).toBe(false);
    expect(entered.occupied).toBe("refuge_compact");
    expect(entered.hud).toContain("SPACE handbrake");
    expect(entered.hud).toContain("ENTER exit");

    if (route === "/") {
      await page.keyboard.down("w");
      await page.waitForTimeout(700);
      await page.keyboard.up("w");
      await page.waitForFunction(startX => {
        const vehicle = window.NBD_VEHICLES.snapshot().vehicles.find(candidate => candidate.id === "refuge_compact");
        return vehicle.speedKph > 0 && vehicle.x > startX;
      }, before.x);
    } else {
      await page.evaluate(() => {
        const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
        for (let index = 0; index < 12; index++) {
          scene.vehicleSystem.updateDriving(0.05, { move: { x: 0, y: -1 } });
        }
      });
    }

    const moving = await page.evaluate(() => {
      const vehicle = window.NBD_VEHICLES.snapshot().vehicles.find(candidate => candidate.id === "refuge_compact");
      return { speed: vehicle.speed, speedKph: vehicle.speedKph, x: vehicle.x };
    });
    expect(moving.speedKph).toBeGreaterThan(0);
    expect(moving.x).toBeGreaterThan(before.x);

    await page.evaluate(() => {
      const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
      const vehicle = scene.vehicleSystem.currentVehicle();
      for (let index = 0; index < 100 && Math.abs(vehicle.speed) > 0.2; index++) {
        scene.vehicleSystem.updateDriving(0.05, { move: { x: 0, y: 1 } });
      }
      vehicle.speed = 0;
    });
    await pressGameplayKey(page, "Enter");
    await page.waitForFunction(() => window.NBD_VEHICLES.snapshot().occupiedVehicleId === null);
    await expect(page.locator("#game-root canvas")).toBeVisible();
  });
}

test("Space applies a handbrake with stronger deceleration and turning", async ({ page }) => {
  await page.goto("/?testScenario=vehicle-core", { waitUntil: "domcontentloaded" });
  await waitForVehicleRuntime(page);
  await prepareStreetVehicle(page);
  await page.locator("#game-root canvas").focus();
  await pressGameplayKey(page, "Enter");
  await page.waitForFunction(() => window.NBD_VEHICLES.snapshot().occupiedVehicleId === "refuge_compact");

  const before = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const vehicle = scene.vehicleSystem.currentVehicle();
    vehicle.speed = 150;
    vehicle.angle = 0;
    return { speed: vehicle.speed, angle: vehicle.angle };
  });

  await page.keyboard.down("d");
  await page.keyboard.down("Space");
  await page.waitForTimeout(320);
  const during = await page.evaluate(() => {
    const snapshot = window.NBD_VEHICLES.snapshot();
    const vehicle = snapshot.vehicles.find(candidate => candidate.id === "refuge_compact");
    return { speed: vehicle.speed, angle: vehicle.angle, handbrake: snapshot.handbrakeActive };
  });
  await page.keyboard.up("Space");
  await page.keyboard.up("d");

  expect(during.handbrake).toBe(true);
  expect(Math.abs(during.speed)).toBeLessThan(Math.abs(before.speed));
  expect(Math.abs(during.angle - before.angle)).toBeGreaterThan(0.01);
});

test("a destroyed occupied vehicle keeps the player inside until Enter", async ({ page }) => {
  await page.goto("/?testScenario=vehicle-core", { waitUntil: "domcontentloaded" });
  await waitForVehicleRuntime(page);
  await prepareStreetVehicle(page);
  await page.locator("#game-root canvas").focus();
  await pressGameplayKey(page, "Enter");
  await page.waitForFunction(() => window.NBD_VEHICLES.snapshot().occupiedVehicleId === "refuge_compact");

  const wrecked = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const vehicle = scene.vehicleSystem.currentVehicle();
    scene.vehicleSystem.damageVehicle(vehicle.id, vehicle.archetype.maxHealth + 1, { reason: "test" });
    return {
      occupied: window.NBD_VEHICLES.snapshot().occupiedVehicleId,
      disabled: vehicle.disabled,
      playerVisible: scene.player.visible,
      hud: scene.vehicleSystem.hud.text
    };
  });
  expect(wrecked.occupied).toBe("refuge_compact");
  expect(wrecked.disabled).toBe(true);
  expect(wrecked.playerVisible).toBe(false);
  expect(wrecked.hud).toContain("WRECKED");

  await pressGameplayKey(page, "Enter");
  await page.waitForFunction(() => window.NBD_VEHICLES.snapshot().occupiedVehicleId === null);
  expect(await page.evaluate(() => window.NBD_PHASER_GAME.scene.getScene("GameScene").player.visible)).toBe(true);
});

test("stealing a parked sedan persists ownership consequences and alarms witnesses", async ({ page }) => {
  await page.goto("/?testScenario=vehicle-core", { waitUntil: "domcontentloaded" });
  await waitForVehicleRuntime(page);
  await prepareStreetVehicle(page, "market_sedan");

  const result = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const beforeExposure = scene.exposureSystem.value;
    const sedan = scene.vehicleSystem.vehicle("market_sedan");
    const witness = scene.npcSystem.npcs.find(npc => npc.type === "civilian" && !npc.dead);
    if (witness) {
      witness.x = sedan.x + 34;
      witness.y = sedan.y;
      witness.layer = 0;
      witness.inactive = false;
      witness.intercepted = false;
      witness.container?.setPosition?.(witness.x, witness.y);
      scene.npcSystem.rebuildSpatialIndex();
    }
    const entered = scene.vehicleSystem.enterVehicle("market_sedan");
    return {
      entered,
      status: window.NBD_VEHICLES.snapshot().vehicles.find(vehicle => vehicle.id === "market_sedan")?.status,
      exposureBefore: beforeExposure,
      exposureAfter: scene.exposureSystem.value,
      witnessCount: scene.witnessSystem.alarmedWitnesses().length
    };
  });

  expect(result.entered).toBe(true);
  expect(result.status).toBe("stolen");
  expect(result.exposureAfter).toBeGreaterThan(result.exposureBefore);
  expect(result.witnessCount).toBeGreaterThan(0);
});

test("vehicle trunks remain bounded mobile storage and never expose the refuge stash", async ({ page }) => {
  await page.goto("/phaser/?testScenario=vehicle-core", { waitUntil: "domcontentloaded" });
  await waitForVehicleRuntime(page);

  const result = await page.evaluate(() => {
    const first = window.NBD_VEHICLES.store("refuge_compact", "camera_case");
    const second = window.NBD_VEHICLES.store("refuge_compact", "blood_bag");
    let overflowCode = null;
    try {
      window.NBD_VEHICLES.store("refuge_compact", "spare_weapon");
    } catch (error) {
      overflowCode = error.code;
    }
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    return {
      first,
      second,
      overflowCode,
      trunk: window.NBD_VEHICLES.trunk("refuge_compact"),
      refugeKeys: Object.keys(scene.campaignSystem.state.inventory.refuges.rooftop_refuge)
    };
  });

  expect(result.first.items).toEqual(["camera_case"]);
  expect(result.second.items).toEqual(["camera_case", "blood_bag"]);
  expect(result.overflowCode).toBe("TRUNK_FULL");
  expect(result.trunk).toMatchObject({ capacity: 2, used: 2, remaining: 0 });
  expect(result.trunk).not.toHaveProperty("weaponIds");
  expect(result.refugeKeys).toContain("weaponIds");
});
