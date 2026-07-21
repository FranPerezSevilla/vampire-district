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
  test(`${route} enters, drives and exits the owned compact through contextual Space`, async ({ page }) => {
    await page.goto(`${route}?testScenario=vehicle-core`, { waitUntil: "domcontentloaded" });
    await waitForVehicleRuntime(page);
    await prepareStreetVehicle(page);

    const before = await page.evaluate(() => {
      const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
      const option = scene.vehicleSystem.collectInteractions()
        .find(candidate => candidate.id === "enter_refuge_compact");
      return {
        snapshot: window.NBD_VEHICLES.snapshot(),
        option: option && { type: option.type, label: option.label },
        owned: scene.campaignSystem.state.world.ownedVehicles.includes("refuge_compact"),
        x: scene.vehicleSystem.vehicle("refuge_compact").x
      };
    });
    expect(before.snapshot.vehicles.map(vehicle => vehicle.archetypeId)).toEqual([
      "compact",
      "sedan",
      "van",
      "police"
    ]);
    expect(before.option).toEqual({ type: "vehicleEnter", label: "Enter Refuge compact" });
    expect(before.owned).toBe(true);

    await page.locator("#game-root canvas").focus();
    await pressGameplayKey(page, "Space");
    await page.waitForFunction(() => window.NBD_VEHICLES.snapshot().occupiedVehicleId === "refuge_compact");

    const entered = await page.evaluate(() => {
      const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
      return {
        playerVisible: scene.player.visible,
        occupied: scene.registry.get("vehicleOccupied"),
        checkpointSafety: scene.campaignCheckpointSystem.safetySnapshot(),
        hudVisible: scene.vehicleSystem.hud.visible
      };
    });
    expect(entered.playerVisible).toBe(false);
    expect(entered.occupied).toBe("refuge_compact");
    expect(entered.checkpointSafety.transitionActive).toBe(true);
    expect(entered.hudVisible).toBe(true);

    await page.keyboard.down("w");
    await page.waitForTimeout(650);
    await page.keyboard.up("w");
    await page.waitForFunction(startX => {
      const vehicle = window.NBD_VEHICLES.snapshot().vehicles.find(candidate => candidate.id === "refuge_compact");
      return vehicle.speedKph > 0 && vehicle.x > startX;
    }, before.x);

    const moving = await page.evaluate(() => {
      const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
      const vehicle = scene.vehicleSystem.vehicle("refuge_compact");
      scene.vehicleSystem.updateCamera();
      return {
        speedKph: Math.round(Math.abs(vehicle.speed) * 0.47),
        x: vehicle.x,
        cameraZoom: scene.cameras.main.zoom,
        streetZoom: 1.35 * (window.NBD_RESOLUTION_PRESET?.renderScale || 1)
      };
    });
    expect(moving.speedKph).toBeGreaterThan(0);
    expect(moving.x).toBeGreaterThan(before.x);
    expect(moving.cameraZoom).toBeLessThanOrEqual(moving.streetZoom);

    await page.evaluate(() => {
      const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
      const vehicle = scene.vehicleSystem.currentVehicle();
      for (let index = 0; index < 80 && Math.abs(vehicle.speed) > 0.2; index++) {
        scene.vehicleSystem.updateDriving(0.05, { move: { x: 0, y: 1 } });
      }
      vehicle.speed = 0;
    });
    await pressGameplayKey(page, "Space");
    await page.waitForFunction(() => window.NBD_VEHICLES.snapshot().occupiedVehicleId === null);

    const exited = await page.evaluate(() => {
      const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
      return {
        playerVisible: scene.player.visible,
        layer: scene.currentLayer,
        occupied: scene.registry.get("vehicleOccupied"),
        status: scene.vehicleSystem.vehicle("refuge_compact").status
      };
    });
    expect(exited).toEqual({
      playerVisible: true,
      layer: 0,
      occupied: null,
      status: "owned"
    });
  });
}

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
      persistedStatus: scene.campaignSystem.state.world.flags["vehicle.market_sedan.status"],
      exposureBefore: beforeExposure,
      exposureAfter: scene.exposureSystem.value,
      witnessCount: scene.witnessSystem.alarmedWitnesses().length,
      eventLogged: scene.campaignSystem.state.eventLog.some(event => event.type === "vehicle:ownership-changed")
    };
  });

  expect(result.entered).toBe(true);
  expect(result.status).toBe("stolen");
  expect(result.persistedStatus).toBe("stolen");
  expect(result.exposureAfter).toBeGreaterThan(result.exposureBefore);
  expect(result.witnessCount).toBeGreaterThan(0);
  expect(result.eventLogged).toBe(true);
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
  expect(result.trunk).not.toHaveProperty("ammoByType");
  expect(result.refugeKeys).toContain("weaponIds");
});
