import { expect, test } from "@playwright/test";

async function waitForTraffic(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_CITY_STREAM_READY
    && window.NBD_TRAFFIC_READY
    && window.NBD_TRAFFIC
    && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.trafficLocalAssignmentPolicy
  ));
}

test.describe.configure({ timeout: 90_000 });

test("visible traffic survives missing macro tokens and releases only after leaving the viewport", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForTraffic(page);

  const result = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const materializer = scene.trafficMaterializationSystem;
    const focus = { x: 1140, y: 960 };

    scene.switchLayer(1, focus, "Clear traffic before visibility-retention test.");
    window.NBD_TRAFFIC.resync();
    scene.switchLayer(0, focus, "Spawn traffic for visibility-retention test.");
    await window.NBD_CITY_STREAM.forceFocus(focus.x, focus.y);
    window.NBD_TRAFFIC.resync();

    const first = window.NBD_TRAFFIC.snapshot().materialized[0];
    if (!first) return { missing: true };
    const slot = materializer.pool[first.slotIndex];
    scene.player.setPosition(slot.x, slot.y);
    scene.cameras.main.centerOn(slot.x, slot.y);
    scene.cameras.main.preRender?.();
    await window.NBD_CITY_STREAM.forceFocus(slot.x, slot.y);
    window.NBD_TRAFFIC.resync();

    const originalTrafficTokens = materializer.trafficTokens;
    materializer.trafficTokens = () => [];
    window.NBD_TRAFFIC.resync();
    const whileVisible = window.NBD_TRAFFIC.snapshot();

    scene.cameras.main.centerOn(3600, 3600);
    scene.cameras.main.preRender?.();
    await window.NBD_CITY_STREAM.forceFocus(3600, 3600);
    window.NBD_TRAFFIC.resync();
    const afterLeavingViewport = window.NBD_TRAFFIC.snapshot();
    materializer.trafficTokens = originalTrafficTokens;

    return {
      missing: false,
      tokenId: first.tokenId,
      retainedWhileVisible: whileVisible.materialized.some(item => item.tokenId === first.tokenId),
      releasedOffscreen: !afterLeavingViewport.materialized.some(item => item.tokenId === first.tokenId),
      preventedVisibleDespawns: whileVisible.preventedVisibleDespawns,
      retainedVisibleCount: whileVisible.retainedVisibleCount,
      retentionMargin: whileVisible.viewportRetentionMargin
    };
  });

  expect(result.missing).toBe(false);
  expect(result.retainedWhileVisible).toBe(true);
  expect(result.releasedOffscreen).toBe(true);
  expect(result.preventedVisibleDespawns).toBeGreaterThan(0);
  expect(result.retainedVisibleCount).toBeGreaterThan(0);
  expect(result.retentionMargin).toBeGreaterThanOrEqual(100);
  expect(pageErrors).toEqual([]);
});
