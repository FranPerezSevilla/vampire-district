import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/phaser/"];
const STORAGE_KEY = "vampire-district-campaign-v1";

for (const route of ROUTES) {
  test(`${route} boots one campaign foundation beside the gameplay runtime`, async ({ page }) => {
    await page.addInitScript(key => window.localStorage.removeItem(key), STORAGE_KEY);
    await page.goto(`${route}?rcTest=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(
      window.NBD_APP_READY
      && window.NBD_CAMPAIGN
      && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.campaignSystem
    ));

    const snapshot = await page.evaluate(() => window.NBD_CAMPAIGN.snapshot());
    expect(snapshot.state.version).toBe(1);
    expect(snapshot.state.player.cash).toBe(0);
    expect(snapshot.activeMission.id).toBe("silence_the_journalist");
    expect(snapshot.activeMission.currentObjective.id).toBe("reach_police_roof");
    expect(snapshot.definitions.map(item => item.id)).toEqual([
      "silence_the_journalist",
      "clean_the_scene"
    ]);
  });
}

test("journalist campaign reward persists and cannot be duplicated after reload", async ({ page }) => {
  await page.addInitScript(key => window.localStorage.removeItem(key), STORAGE_KEY);
  await page.goto("/?rcTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.campaignRuntimeBridge
  ));

  const completed = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const bridge = scene.campaignRuntimeBridge;
    bridge.syncLegacyStep(2);
    bridge.handleNeutralized({ targetId: "journalist", kind: "drained" });
    bridge.syncLegacyStep(4);
    return window.NBD_CAMPAIGN.snapshot();
  });

  expect(completed.state.player.cash).toBe(500);
  expect(completed.state.reputation.factions.blackglass_directorate).toBe(5);
  expect(completed.state.reputation.contacts.your_sire).toBe(1);
  expect(completed.state.missions.completed).toEqual(["silence_the_journalist"]);
  expect(completed.state.ledger).toHaveLength(1);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.NBD_APP_READY && window.NBD_CAMPAIGN));
  const restored = await page.evaluate(() => window.NBD_CAMPAIGN.snapshot());
  expect(restored.state.player.cash).toBe(500);
  expect(restored.state.ledger).toHaveLength(1);
  expect(restored.state.missions.records.silence_the_journalist.rewardsGranted).toBe(true);
  expect(restored.activeMission).toBeNull();
});

test("campaign export and import use plain versioned JSON", async ({ page }) => {
  await page.addInitScript(key => window.localStorage.removeItem(key), STORAGE_KEY);
  await page.goto("/phaser/?rcTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.NBD_APP_READY && window.NBD_CAMPAIGN));

  const result = await page.evaluate(() => {
    const serialized = window.NBD_CAMPAIGN.export();
    const parsed = JSON.parse(serialized);
    return {
      serialized,
      version: parsed.version,
      hasFunctions: serialized.includes("function"),
      storageMatches: window.localStorage.getItem("vampire-district-campaign-v1") === serialized
    };
  });

  expect(result.version).toBe(1);
  expect(result.hasFunctions).toBe(false);
  expect(result.storageMatches).toBe(true);
});
