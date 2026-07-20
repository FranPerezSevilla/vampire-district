import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/phaser/"];
const STORAGE_KEY = "vampire-district-campaign-v1";
const ENTRY_SESSION_KEY = "vampire-district-campaign-entry-once-v1";
const RESET_SENTINEL = "vampire-district-mission-board-test-reset";

test.describe.configure({ timeout: 120_000 });

async function clearCampaignOnce(page) {
  await page.addInitScript(({ storageKey, entryKey, sentinel }) => {
    if (window.sessionStorage.getItem(sentinel) === "done") return;
    window.localStorage.removeItem(storageKey);
    window.sessionStorage.removeItem(entryKey);
    window.sessionStorage.setItem(sentinel, "done");
  }, { storageKey: STORAGE_KEY, entryKey: ENTRY_SESSION_KEY, sentinel: RESET_SENTINEL });
}

async function waitForBoardRuntime(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_CAMPAIGN_READY
    && window.NBD_MISSION_BOARD_READY
    && window.NBD_RC_HARNESS_READY
    && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.missionBoardSystem
  ));
}

async function completeOpeningContract(page) {
  await page.evaluate(() => {
    window.NBD_RC_HARNESS.unlockPostTutorialWorld();
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.campaignSystem.missions.completeMission();
    scene.campaignCheckpointSystem.saveCompletionNow("silence_the_journalist");
    scene.campaignSystem.save();
  });
  await page.waitForFunction(() => window.NBD_MISSION_BOARD.snapshot().available === true);
}

for (const route of ROUTES) {
  test(`${route} exposes an accessible refuge board after the opening contract`, async ({ page }) => {
    await clearCampaignOnce(page);
    await page.goto(`${route}?rcTest=1`, { waitUntil: "domcontentloaded" });
    await waitForBoardRuntime(page);
    await completeOpeningContract(page);

    expect(await page.evaluate(() => window.NBD_MISSION_BOARD.open())).toBe(true);
    const board = page.locator(".mission-board");
    await expect(board).toBeVisible();
    await expect(board).toHaveAttribute("role", "dialog");
    await expect(page.locator('[data-mission-card="clean_the_scene"] h3')).toHaveText("Clean the Scene");
    await expect(page.locator('[data-mission-id="clean_the_scene"]')).toContainText("Accept contract");
    await expect(page.locator(".mission-board__meta")).toContainText("$275");

    const accept = page.locator('[data-mission-id="clean_the_scene"]');
    const close = page.locator('[data-mission-board-action="close"]');
    await expect(accept).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(accept).toBeFocused();

    await page.setViewportSize({ width: 620, height: 720 });
    await expect(accept).toBeVisible();
    await expect(close).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(board).toHaveCount(0);
  });
}

test("Clean the Scene runs in the world, pays once and returns to the board", async ({ page }) => {
  await clearCampaignOnce(page);
  await page.goto("/?rcTest=1", { waitUntil: "domcontentloaded" });
  await waitForBoardRuntime(page);
  await completeOpeningContract(page);
  await page.evaluate(() => window.NBD_MISSION_BOARD.open());

  await page.locator('[data-mission-id="clean_the_scene"]').click();
  await expect(page.locator(".mission-board")).toHaveCount(0);
  await page.waitForFunction(() => (
    window.NBD_CAMPAIGN.snapshot().state.missions.activeMissionId === "clean_the_scene"
    && window.NBD_CAMPAIGN.snapshot().activeMission?.currentObjective?.id === "reach_service_alley"
  ));
  await page.waitForFunction(() => window.NBD_CAMPAIGN.checkpoint()?.missionId === "clean_the_scene");

  const afterStart = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const body = scene.npcSystem.npcs.find(npc => npc.id === "exposed_body");
    return {
      objective: scene.missionSystem.currentObjective()?.id,
      body: { dead: body?.dead, inactive: body?.inactive, hidden: body?.hiddenBody },
      cameraVisible: scene.missionSystem.cleanTheSceneSystem.cameraRoll?.visible
    };
  });
  expect(afterStart.objective).toBe("reach_service_alley");
  expect(afterStart.body).toEqual({ dead: true, inactive: false, hidden: false });
  expect(afterStart.cameraVisible).toBe(false);

  const streetCameraVisible = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.switchLayer(0, { x: 650, y: 510 }, "Board test: reached the service alley.");
    scene.missionSystem.update();
    const point = scene.missionSystem.cleanTheSceneSystem.placements().cameraRoll;
    scene.player.setPosition(point.x, point.y);
    scene.missionSystem.update();
    const visible = scene.missionSystem.cleanTheSceneSystem.cameraRoll?.visible;
    const collect = scene.missionSystem.collectInteractions()
      .find(option => option.id === "collect_compromised_camera_roll");
    if (!collect) throw new Error("Camera-roll interaction is unavailable at its authored placement");
    collect.run();
    return visible;
  });
  expect(streetCameraVisible).toBe(true);
  await page.waitForFunction(() => window.NBD_CAMPAIGN.snapshot().activeMission?.currentObjective?.id === "remove_exposed_body");

  await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const body = scene.npcSystem.npcs.find(npc => npc.id === "exposed_body");
    scene.switchLayer(0, { x: body.x, y: body.y }, "Board test: reached exposed body.");
    scene.evidenceSystem.grabBody(body);
    scene.switchLayer(0, { x: 676, y: 502 }, "Board test: reached club dumpster.");
    scene.evidenceSystem.updateDraggedBody(0);
    scene.evidenceSystem.hideDraggedBody({
      id: "dumpsterClubRear",
      name: "club rear dumpster",
      cleanRadius: 90
    });
  });
  await page.waitForFunction(() => window.NBD_CAMPAIGN.snapshot().activeMission?.currentObjective?.id === "lose_police_attention");

  await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.exposureSystem.value = 0;
    for (const npc of scene.npcSystem.npcs) {
      npc.alarmed = false;
      npc.hasReported = false;
    }
    scene.missionSystem.update();
  });
  await page.waitForFunction(() => window.NBD_CAMPAIGN.snapshot().activeMission?.currentObjective?.id === "return_to_refuge");

  await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.switchLayer(2, { x: 150, y: 146 }, "Board test: returned to refuge.");
    scene.missionSystem.update();
  });
  await page.waitForFunction(() => window.NBD_PHASER_GAME.scene.getScene("GameScene").registry.get("missionResult")?.missionId === "clean_the_scene");
  await expect(page.locator("#ui-modal-title")).toHaveText("SCENE CONTAINED");

  const completed = await page.evaluate(() => window.NBD_CAMPAIGN.snapshot());
  expect(completed.state.player.cash).toBe(775);
  expect(completed.state.ledger).toHaveLength(2);
  expect(completed.state.reputation.factions.blackglass_directorate).toBe(7);
  expect(completed.state.reputation.contacts.directorate_cleaner).toBe(3);
  expect(completed.state.missions.records.clean_the_scene.completionCount).toBe(1);
  expect(completed.state.missions.records.clean_the_scene.rewardsGranted).toBe(true);
  expect(completed.checkpoint.kind).toBe("mission-complete");
  expect(completed.checkpoint.missionId).toBe("clean_the_scene");

  await page.keyboard.press("Enter");
  await expect(page.locator(".mission-board")).toBeVisible();
  await expect(page.locator('[data-mission-id="clean_the_scene"]')).toContainText("Run contract again");
  await page.keyboard.press("Escape");

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForBoardRuntime(page);
  const restored = await page.evaluate(() => window.NBD_CAMPAIGN.snapshot());
  expect(restored.state.player.cash).toBe(775);
  expect(restored.state.ledger).toHaveLength(2);
  expect(restored.state.missions.records.clean_the_scene.rewardsGranted).toBe(true);
  expect(restored.state.missions.records.clean_the_scene.completionCount).toBe(1);
  expect(restored.checkpoint.missionId).toBe("clean_the_scene");
});