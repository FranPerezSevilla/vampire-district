import { expect, test } from "@playwright/test";

async function waitForStreamingRuntime(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_CITY_STREAM_READY
    && window.NBD_CITY_STREAM
  ));
}

test.describe.configure({ timeout: 75_000 });

test("city streaming moves the 3x3 active window and keeps static queries local", async ({ page }) => {
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForStreamingRuntime(page);

  const result = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.switchLayer(0, { x: 100, y: 100 }, "Streaming test west edge.");
    window.NBD_CITY_STREAM.forceFocus(100, 100);
    const west = window.NBD_CITY_STREAM.snapshot();
    const westInspect = window.NBD_CITY_STREAM.inspectBounds({ x: 0, y: 0, w: 512, h: 512 });
    const refugeBlocked = scene.canStandAt(120, 120);
    const westStreetOpen = scene.canStandAt(472, 338);

    scene.switchLayer(0, { x: 2080, y: 430 }, "Streaming test east edge.");
    window.NBD_CITY_STREAM.forceFocus(2080, 430, 900, 0);
    const east = window.NBD_CITY_STREAM.snapshot();
    const eastInspect = window.NBD_CITY_STREAM.inspectBounds({ x: 1640, y: 0, w: 544, h: 704 });
    const foundryBlocked = scene.canStandAt(1800, 430);
    scene.player.setPosition(1754, 438);
    const foundryLight = scene.currentLight()?.id || null;

    return {
      west,
      east,
      westInspect,
      eastInspect,
      refugeBlocked,
      westStreetOpen,
      foundryBlocked,
      foundryLight,
      westStateAfterMove: window.NBD_CITY_STREAM.stateOf("0:0")
    };
  });

  expect(result.west.grid).toEqual({ columns: 5, rows: 3, total: 15 });
  expect(result.west.centerChunkId).toBe("0:0");
  expect(result.west.counts.active).toBe(4);
  expect(result.west.counts.prefetched).toBeGreaterThanOrEqual(5);
  expect(result.westInspect.buildings).toBeGreaterThan(0);
  expect(result.westInspect.buildings).toBeLessThan(result.west.loadedCategoryCounts.buildings);
  expect(result.refugeBlocked).toBe(false);
  expect(result.westStreetOpen).toBe(true);

  expect(result.east.centerChunkId).toBe("4:0");
  expect(result.east.counts.active).toBeLessThanOrEqual(6);
  expect(result.east.states.prefetched).toContain("2:0");
  expect(["dormant", "unloaded"]).toContain(result.westStateAfterMove);
  expect(result.eastInspect.buildings).toBeGreaterThanOrEqual(5);
  expect(result.foundryBlocked).toBe(false);
  expect(result.foundryLight).toBe("foundry:lamp:west-middle");
});
