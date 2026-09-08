import { expect, test } from "@playwright/test";

async function waitForTraffic(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_CITY_STREAM_READY
    && window.NBD_MACRO_CITY_READY
    && window.NBD_TRAFFIC_READY
    && window.NBD_TRAFFIC
    && window.NBD_TRAFFIC_ROUTE_MULTI_AGENT?.snapshot?.().enabled
  ));
}

test.describe.configure({ timeout: 75_000 });

test("default compiler-route traffic materializes into a fixed local pool and dematerializes off street", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForTraffic(page);

  const local = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.switchLayer(0, { x: 1140, y: 960 }, "Local compiler-route traffic materialization test.");
    await window.NBD_CITY_STREAM.forceFocus(1140, 960);
    window.NBD_TRAFFIC.resync();

    let before = window.NBD_TRAFFIC.snapshot();
    const seed = before.materialized[0];
    if (!seed) return { before, missing: true };

    const nearbyFocus = { x: seed.x, y: seed.y + 80 };
    scene.switchLayer(0, nearbyFocus, "Focus near a materialized compiler-route traffic token.");
    await window.NBD_CITY_STREAM.forceFocus(nearbyFocus.x, nearbyFocus.y);
    window.NBD_TRAFFIC.resync();
    before = window.NBD_TRAFFIC.snapshot();
    const focused = before.materialized.find(item => item.tokenId === seed.tokenId) || before.materialized[0];
    const slotBefore = scene.trafficMaterializationSystem.pool[focused.slotIndex];
    const containerBefore = { x: slotBefore.container.x, y: slotBefore.container.y };
    const beforeById = new Map(before.materialized.map(item => [item.tokenId, item]));
    const routeClockBefore = Number(window.NBD_TRAFFIC_ROUTE_MULTI_AGENT.snapshot().clockSeconds || 0);

    await new Promise(resolve => {
      let frames = 0;
      const next = () => {
        frames++;
        if (frames >= 12) resolve();
        else requestAnimationFrame(next);
      };
      requestAnimationFrame(next);
    });
    window.NBD_TRAFFIC.resync();

    const routeClockAfter = Number(window.NBD_TRAFFIC_ROUTE_MULTI_AGENT.snapshot().clockSeconds || 0);
    const after = window.NBD_TRAFFIC.snapshot();
    const advanced = after.materialized.find(item => item.tokenId === focused.tokenId);
    const movedToken = after.materialized.find(item => {
      const prior = beforeById.get(item.tokenId);
      return prior && (item.x !== prior.x || item.y !== prior.y);
    }) || null;
    const collisionPoint = movedToken || advanced || focused;
    const persistentVehicle = scene.vehicleSystem.vehicles[0];

    return {
      missing: false,
      before,
      after,
      focused,
      advanced,
      movedToken,
      routeClockAdvanced: routeClockAfter > routeClockBefore,
      poolLength: scene.trafficMaterializationSystem.pool.length,
      sameSlot: Boolean(advanced && advanced.slotIndex === focused.slotIndex),
      moved: Boolean(movedToken),
      containerMoved: Boolean(advanced && (
        scene.trafficMaterializationSystem.pool[advanced.slotIndex].container.x !== containerBefore.x
        || scene.trafficMaterializationSystem.pool[advanced.slotIndex].container.y !== containerBefore.y
      )),
      laneAuthority: after.laneAuthority,
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
  expect(local.routeClockAdvanced).toBe(true);
  expect(local.moved).toBe(true);
  expect(local.containerMoved).toBe(true);
  expect(local.laneAuthority).toBe("compiler-route-lanes");
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
  expect(layers.street.laneAuthority).toBe("compiler-route-lanes");
  expect(layers.activeContainers).toBe(layers.street.materializedCount);
  expect(pageErrors).toEqual([]);
});
