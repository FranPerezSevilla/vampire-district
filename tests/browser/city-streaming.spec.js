import { expect, test } from "@playwright/test";

async function waitForStreamingRuntime(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_CITY_STREAM
  ));
  await page.evaluate(() => window.NBD_CITY_STREAM.waitUntilReady());
}

test.describe.configure({ timeout: 90_000 });

test("asynchronous city streaming fetches the 10 by 8 topology and keeps static queries local", async ({ page }) => {
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForStreamingRuntime(page);

  const result = await page.evaluate(async () => {
    const district = await import("/phaser/src/data/district.js");
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const hospital = district.buildings.find(item => item.id === "hospital");

    scene.switchLayer(0, district.CITY_ANCHORS.hospitalEntrance, "Streaming test hospital.");
    const west = await window.NBD_CITY_STREAM.forceFocus(
      district.CITY_ANCHORS.hospitalEntrance.x,
      district.CITY_ANCHORS.hospitalEntrance.y
    );
    const westInspect = window.NBD_CITY_STREAM.inspectBounds({ x: 0, y: 0, w: 1024, h: 1024 });
    const hospitalBlocked = scene.canStandAt(hospital.x + hospital.w / 2, hospital.y + hospital.h / 2);
    const emergencyRoadOpen = scene.canStandAt(
      district.CITY_ANCHORS.hospitalEntrance.x,
      district.CITY_ANCHORS.hospitalEntrance.y
    );

    scene.switchLayer(0, district.CITY_ANCHORS.harborFar, "Streaming test far harbor.");
    const east = await window.NBD_CITY_STREAM.forceFocus(
      district.CITY_ANCHORS.harborFar.x,
      district.CITY_ANCHORS.harborFar.y,
      900,
      0
    );
    const eastInspect = window.NBD_CITY_STREAM.inspectBounds({ x: 3600, y: 1980, w: 1200, h: 1620 });
    const harborLamp = district.lights
      .filter(light => light.x >= 4096 && light.y >= 2560)
      .sort((a, b) => Math.hypot(a.x - district.CITY_ANCHORS.harborFar.x, a.y - district.CITY_ANCHORS.harborFar.y)
        - Math.hypot(b.x - district.CITY_ANCHORS.harborFar.x, b.y - district.CITY_ANCHORS.harborFar.y))[0];
    scene.player.setPosition(harborLamp.x, harborLamp.y);
    const harborLight = scene.currentLight()?.id || null;

    return {
      west,
      east,
      westInspect,
      eastInspect,
      hospitalBlocked,
      emergencyRoadOpen,
      harborLight,
      harborLampId: harborLamp.id,
      westStateAfterMove: window.NBD_CITY_STREAM.stateOf("1:0"),
      westLoadStateAfterMove: window.NBD_CITY_STREAM.loadStateOf("1:0"),
      deltas: window.NBD_CITY_STREAM.deltaSnapshot()
    };
  });

  expect(result.west.grid).toEqual({ columns: 10, rows: 8, total: 80 });
  expect(result.west.manifestVersion).toBe(3);
  expect(result.west.centerChunkId).toBe("1:0");
  expect(result.west.counts.active).toBeGreaterThan(0);
  expect(result.west.counts.prefetched).toBeGreaterThan(0);
  expect(result.west.ready).toBe(true);
  expect(result.west.source.stats.manifestRequests).toBe(1);
  expect(result.westInspect.buildings).toBeGreaterThan(0);
  expect(result.westInspect.buildings).toBeLessThan(result.west.loadedCategoryCounts.buildings);
  expect(result.hospitalBlocked).toBe(false);
  expect(result.emergencyRoadOpen).toBe(true);

  expect(result.east.centerChunkId).toBe("8:5");
  expect(result.east.ready).toBe(true);
  expect(result.east.activationBudget).toBe(2);
  expect(result.east.counts.active).toBeLessThanOrEqual(9);
  expect(["dormant", "unloaded"]).toContain(result.westStateAfterMove);
  expect(["resident", "cached", "unloaded"]).toContain(result.westLoadStateAfterMove);
  expect(result.eastInspect.buildings).toBeGreaterThan(0);
  expect(result.harborLight).toBe(result.harborLampId);
  expect(result.deltas.count).toBeGreaterThan(0);
});
