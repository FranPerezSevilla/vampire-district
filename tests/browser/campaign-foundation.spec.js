import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/phaser/"];
const STORAGE_KEY = "vampire-district-campaign-v1";

test.describe.configure({ timeout: 90_000 });

async function dismissFinale(page) {
  const dialogue = page.locator("#tutorial-dialogue");
  await expect(dialogue).toHaveClass(/open/);
  await page.waitForTimeout(280);
  await page.locator(".game-frame").click({ position: { x: 100, y: 100 } });
  await expect(dialogue).toHaveClass(/open/);
  await page.waitForTimeout(280);
  await page.locator(".game-frame").click({ position: { x: 100, y: 100 } });
  await expect(page.locator("#ui-modal-title")).toHaveText("REPORT ACCEPTED", { timeout: 12_000 });
}

for (const route of ROUTES) {
  test(`${route} boots one direct campaign mission authority beside gameplay`, async ({ page }) => {
    await page.addInitScript(key => window.localStorage.removeItem(key), STORAGE_KEY);
    await page.goto(`${route}?rcTest=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(
      window.NBD_APP_READY
      && window.NBD_CAMPAIGN
      && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.campaignMissionAuthority
    ));

    const snapshot = await page.evaluate(() => {
      const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
      return {
        campaign: window.NBD_CAMPAIGN.snapshot(),
        missionStep: scene.missionSystem.step,
        bridgePresent: Boolean(scene.campaignRuntimeBridge),
        authorityPresent: Boolean(scene.campaignMissionAuthority)
      };
    });
    expect(snapshot.campaign.state.version).toBe(1);
    expect(snapshot.campaign.state.player.cash).toBe(0);
    expect(snapshot.campaign.activeMission.id).toBe("silence_the_journalist");
    expect(snapshot.campaign.activeMission.currentObjective.id).toBe("reach_police_roof");
    expect(snapshot.campaign.checkpoint.id).toBe("journalist_mission_start");
    expect(snapshot.campaign.definitions.map(item => item.id)).toEqual([
      "silence_the_journalist",
      "clean_the_scene"
    ]);
    expect(snapshot.missionStep).toBe(0);
    expect(snapshot.authorityPresent).toBe(true);
    expect(snapshot.bridgePresent).toBe(false);
  });
}

test("journalist campaign reward persists and cannot be duplicated by standalone replay", async ({ page }) => {
  await page.addInitScript(key => window.localStorage.removeItem(key), STORAGE_KEY);
  await page.goto("/?rcTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.NBD_APP_READY && window.NBD_RC_HARNESS_READY && window.NBD_CAMPAIGN));

  await page.evaluate(() => window.NBD_RC_HARNESS.prepareJournalistObjective());
  await page.evaluate(() => window.NBD_RC_HARNESS.neutralizeJournalist("drained"));
  await page.evaluate(() => window.NBD_RC_HARNESS.returnToRefuge());
  await dismissFinale(page);

  const completed = await page.evaluate(() => window.NBD_CAMPAIGN.snapshot());
  expect(completed.state.player.cash).toBe(500);
  expect(completed.state.reputation.factions.blackglass_directorate).toBe(5);
  expect(completed.state.reputation.contacts.your_sire).toBe(1);
  expect(completed.state.missions.completed).toEqual(["silence_the_journalist"]);
  expect(completed.state.ledger).toHaveLength(1);
  expect(completed.checkpoint.id).toBe("journalist_report_accepted");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.NBD_APP_READY && window.NBD_CAMPAIGN));
  const restored = await page.evaluate(() => window.NBD_CAMPAIGN.snapshot());
  expect(restored.state.player.cash).toBe(500);
  expect(restored.state.ledger).toHaveLength(1);
  expect(restored.activeMission.currentObjective.id).toBe("reach_police_roof");
  expect(restored.activeMission.rewardsGranted).toBe(true);
});

test("reloading a stable campaign checkpoint restores the objective and world location", async ({ page }) => {
  await page.addInitScript(key => window.localStorage.removeItem(key), STORAGE_KEY);
  await page.goto("/phaser/?rcTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.NBD_APP_READY && window.NBD_RC_HARNESS_READY && window.NBD_CAMPAIGN));

  await page.evaluate(() => window.NBD_RC_HARNESS.prepareJournalistObjective());
  const before = await page.evaluate(() => window.NBD_CAMPAIGN.snapshot());
  expect(before.activeMission.currentObjective.id).toBe("neutralize_journalist");
  expect(before.checkpoint.id).toBe("journalist_target_reached");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_CAMPAIGN
    && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.campaignMissionAuthority?.restoredCheckpoint
  ));

  const restored = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const thug = scene.npcSystem.npcs.find(npc => npc.id === "rooftop_thug");
    const informant = scene.npcSystem.npcs.find(npc => npc.id === "police_roof_informant");
    return {
      mission: window.NBD_CAMPAIGN.snapshot().activeMission,
      checkpoint: window.NBD_CAMPAIGN.checkpoint(),
      step: scene.missionSystem.step,
      layer: scene.currentLayer,
      player: { x: scene.player.x, y: scene.player.y },
      tutorialState: scene.tutorialDirector.state,
      introOpen: window.NBD_PHASER_GAME.scene.getScene("UIScene").introOpen,
      thugDead: Boolean(thug?.dead),
      informantInactive: Boolean(informant?.inactive)
    };
  });

  expect(restored.mission.currentObjective.id).toBe("neutralize_journalist");
  expect(restored.checkpoint.id).toBe("journalist_target_reached");
  expect(restored.step).toBe(2);
  expect(restored.layer).toBe(0);
  expect(restored.player.x).toBeCloseTo(642, 1);
  expect(restored.player.y).toBeCloseTo(404, 1);
  expect(restored.tutorialState).toBe("complete");
  expect(restored.introOpen).toBe(false);
  expect(restored.thugDead).toBe(true);
  expect(restored.informantInactive).toBe(true);
});

test("campaign export and import use plain versioned JSON with checkpoint data", async ({ page }) => {
  await page.addInitScript(key => window.localStorage.removeItem(key), STORAGE_KEY);
  await page.goto("/phaser/?rcTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.NBD_APP_READY && window.NBD_CAMPAIGN));

  const result = await page.evaluate(() => {
    const serialized = window.NBD_CAMPAIGN.export();
    const parsed = JSON.parse(serialized);
    return {
      serialized,
      version: parsed.version,
      checkpointId: parsed.checkpoint?.id,
      hasFunctions: serialized.includes("function"),
      storageMatches: window.localStorage.getItem("vampire-district-campaign-v1") === serialized
    };
  });
  expect(result.version).toBe(1);
  expect(result.checkpointId).toBe("journalist_mission_start");
  expect(result.hasFunctions).toBe(false);
  expect(result.storageMatches).toBe(true);
});
