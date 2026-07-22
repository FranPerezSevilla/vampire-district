import { expect, test } from "@playwright/test";

async function waitForTraffic(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_CITY_STREAM_READY
    && window.NBD_MACRO_CITY_READY
    && window.NBD_TRAFFIC_READY
    && window.NBD_TRAFFIC
  ));
}

test.describe.configure({ timeout: 75_000 });

test("macro traffic materializes into a fixed local pool and dematerializes off street", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForTraffic(page);

  const local = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.switchLayer(0, { x: 760, y: 338 }, "Local traffic materialization test.");
    await window.NBD_CITY_STREAM.forceFocus(760, 338);
    window.NBD_TRAFFIC.resync();

    let before = window.NBD_TRAFFIC.snapshot();
    const seed = before.materialized[0];
    if (!seed) return { before, missing: true };

    scene.switchLayer(0, { x: seed.x, y: seed.y }, "Focus a materialized traffic token.");
    await window.NBD_CITY_STREAM.forceFocus(seed.x, seed.y);
    window.NBD_TRAFFIC.resync();
    before = window.NBD_TRAFFIC.snapshot();
    const focused = before.materialized.find(item => item.tokenId === seed.tokenId) || before.materialized[0];
    const slotBefore = scene.trafficMaterializationSystem.pool[focused.slotIndex];
    const containerBefore = { x: slotBefore.container.x, y: slotBefore.container.y };

    window.NBD_MACRO_CITY.forceTick(0.25);
    window.NBD_TRAFFIC.resync();
    const after = window.NBD_TRAFFIC.snapshot();
    const advanced = after.materialized.find(item => item.tokenId === focused.tokenId);
    const collisionPoint = advanced || focused;
    const persistentVehicle = scene.vehicleSystem.vehicles[0];

    return {
      missing: false,
      before,
      after,
      focused,
      advanced,
      poolLength: scene.trafficMaterializationSystem.pool.length,
      sameSlot: Boolean(advanced && advanced.slotIndex === focused.slotIndex),
      moved: Boolean(advanced && (advanced.x !== focused.x || advanced.y !== focused.y)),
      containerMoved: Boolean(advanced && (
        scene.trafficMaterializationSystem.pool[advanced.slotIndex].container.x !== containerBefore.x
        || scene.trafficMaterializationSystem.pool[advanced.slotIndex].container.y !== containerBefore.y
      )),
      blocksAtToken: window.NBD_TRAFFIC.blocks(collisionPoint.x, collisionPoint.y, 1),
      vehicleCanOccupyToken: scene.vehicleSystem.canOccupy(
        persistentVehicle,
        collisionPoint.x,
        collisionPoint.y,
        collisionPoint.angle
      )
    };
  });

  expect(local.missing).toBe(false);
  expect(local.before.materializedCount).toBeGreaterThan(0);
  expect(local.before.materializedCount).toBeLessThanOrEqual(local.before.maxActiveVehicles);
  expect(local.poolLength).toBe(local.before.maxActiveVehicles);
  expect(local.sameSlot).toBe(true);
  expect(local.moved).toBe(true);
  expect(local.containerMoved).toBe(true);
  expect(local.blocksAtToken).toBe(true);
  expect(local.vehicleCanOccupyToken).toBe(false);

  const layers = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const poolSize = window.NBD_TRAFFIC.snapshot().poolSize;
    const focus = scene.renderFocus?.() || scene.player;

    scene.switchLayer(1, { x: focus.x, y: focus.y }, "Traffic must not exist on rooftops.");
    window.NBD_TRAFFIC.resync();
    const roof = window.NBD_TRAFFIC.snapshot();

    scene.switchLayer(0, { x: focus.x, y: focus.y }, "Return to street traffic.");
    await window.NBD_CITY_STREAM.forceFocus(focus.x, focus.y);
    window.NBD_TRAFFIC.resync();
    const street = window.NBD_TRAFFIC.snapshot();

    return {
      poolSize,
      roof,
      street,
      activeContainers: scene.trafficMaterializationSystem.pool.filter(slot => slot.container.active).length
    };
  });

  expect(layers.roof.materializedCount).toBe(0);
  expect(layers.roof.poolSize).toBe(layers.poolSize);
  expect(layers.street.materializedCount).toBeGreaterThan(0);
  expect(layers.street.poolSize).toBe(layers.poolSize);
  expect(layers.activeContainers).toBe(layers.street.materializedCount);
  expect(pageErrors).toEqual([]);
});
