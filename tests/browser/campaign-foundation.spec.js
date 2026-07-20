import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/phaser/"];
const STORAGE_KEY = "vampire-district-campaign-v1";
const RESET_SENTINEL = "vampire-district-foundation-test-reset";

async function clearCampaignOnce(page) {
  await page.addInitScript(({ storageKey, sentinel }) => {
    if (window.sessionStorage.getItem(sentinel) === "done") return;
    window.localStorage.removeItem(storageKey);
    window.sessionStorage.setItem(sentinel, "done");
  }, { storageKey: STORAGE_KEY, sentinel: RESET_SENTINEL });
}

for (const route of ROUTES) {
  test(`${route} boots one authoritative campaign and checkpoint runtime`, async ({ page }) => {
    await clearCampaignOnce(page);
    await page.goto(`${route}?rcTest=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(
      window.NBD_APP_READY
      && window.NBD_CAMPAIGN_READY
      && window.NBD_CAMPAIGN
      && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.campaignCheckpointSystem
    ));

    const snapshot = await page.evaluate(() => {
      const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
      return {
        campaign: window.NBD_CAMPAIGN.snapshot(),
        hasBridge: Boolean(scene.campaignRuntimeBridge),
        directAuthority: scene.missionSystem.campaign === scene.campaignSystem,
        checkpointSystem: Boolean(scene.campaignCheckpointSystem)
      };
    });
    expect(snapshot.campaign.state.version).toBe(2);
    expect(snapshot.campaign.state.player.cash).toBe(0);
    expect(snapshot.campaign.activeMission.id).toBe("silence_the_journalist");
    expect(snapshot.campaign.activeMission.currentObjective.id).toBe("reach_police_roof");
    expect(snapshot.campaign.checkpoint).toBeNull();
    expect(snapshot.campaign.definitions.map(item => item.id)).toEqual([
      "silence_the_journalist",
      "clean_the_scene"
    ]);
    expect(snapshot.hasBridge).toBe(false);
    expect(snapshot.directAuthority).toBe(true);
    expect(snapshot.checkpointSystem).toBe(true);
  });
}

test("direct opening-mission rewards and completion checkpoint cannot duplicate after reload", async ({ page }) => {
  await clearCampaignOnce(page);
  await page.goto("/?rcTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_CAMPAIGN_READY
    && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.campaignCheckpointSystem
  ));

  const completed = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const campaign = scene.campaignSystem;
    campaign.handle("world:reached", { targetId: "police_roof" });
    campaign.handle("conversation:completed", { targetId: "police_roof_informant" });
    campaign.handle("world:reached", { targetId: "nightclub_district" });
    campaign.handle("entity:neutralized", { targetId: "journalist", outcome: "drained" });
    campaign.handle("refuge:returned", { refugeId: "rooftop_refuge" });
    scene.campaignCheckpointSystem.saveCompletionNow("silence_the_journalist");
    return window.NBD_CAMPAIGN.snapshot();
  });

  expect(completed.state.player.cash).toBe(500);
  expect(completed.state.reputation.factions.blackglass_directorate).toBe(5);
  expect(completed.state.reputation.contacts.your_sire).toBe(1);
  expect(completed.state.missions.completed).toEqual(["silence_the_journalist"]);
  expect(completed.state.ledger).toHaveLength(1);
  expect(completed.checkpoint.kind).toBe("mission-complete");
  expect(completed.checkpoint.mission.status).toBe("completed");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.NBD_APP_READY && window.NBD_CAMPAIGN_READY));
  const restored = await page.evaluate(() => ({
    campaign: window.NBD_CAMPAIGN.snapshot(),
    introOpen: window.NBD_PHASER_GAME.scene.getScene("UIScene").introOpen,
    directorState: window.NBD_PHASER_GAME.scene.getScene("GameScene").tutorialDirector?.state
  }));
  expect(restored.campaign.state.player.cash).toBe(500);
  expect(restored.campaign.state.ledger).toHaveLength(1);
  expect(restored.campaign.state.missions.records.silence_the_journalist.rewardsGranted).toBe(true);
  expect(restored.campaign.activeMission).toBeNull();
  expect(restored.campaign.checkpoint.kind).toBe("mission-complete");
  expect(restored.introOpen).toBe(false);
  expect(restored.directorState).toBe("complete");
});

test("campaign save and export use identical plain versioned checkpoint JSON", async ({ page }) => {
  await clearCampaignOnce(page);
  await page.goto("/phaser/?rcTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.NBD_APP_READY && window.NBD_CAMPAIGN_READY));

  const result = await page.evaluate(() => {
    window.NBD_CAMPAIGN.save();
    const serialized = window.NBD_CAMPAIGN.export();
    const parsed = JSON.parse(serialized);
    return {
      serialized,
      version: parsed.version,
      hasFunctions: serialized.includes("function"),
      hasCheckpointCollection: Object.hasOwn(parsed, "checkpoints"),
      storageMatches: window.localStorage.getItem("vampire-district-campaign-v1") === serialized
    };
  });

  expect(result.version).toBe(2);
  expect(result.hasFunctions).toBe(false);
  expect(result.hasCheckpointCollection).toBe(true);
  expect(result.storageMatches).toBe(true);
});
