import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/phaser/"];
const STORAGE_KEY = "vampire-district-campaign-v1";
const SESSION_KEY = "vampire-district-campaign-entry-once-v1";
const RESET_SENTINEL = "vampire-district-campaign-entry-test-reset";

test.describe.configure({ timeout: 120_000 });

async function clearCampaign(page) {
  await page.addInitScript(({ storageKey, sessionKey, sentinel }) => {
    if (window.sessionStorage.getItem(sentinel) === "done") return;
    window.localStorage.removeItem(storageKey);
    window.sessionStorage.removeItem(sessionKey);
    window.sessionStorage.setItem(sentinel, "done");
  }, {
    storageKey: STORAGE_KEY,
    sessionKey: SESSION_KEY,
    sentinel: RESET_SENTINEL
  });
}

async function waitForEntryRuntime(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_CAMPAIGN_READY
    && window.NBD_CAMPAIGN_ENTRY_READY
    && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.campaignEntrySystem
  ));
}

async function clickReloadingEntryAction(page, action) {
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    page.locator(`[data-campaign-entry-action="${action}"]`).click()
  ]);
  await waitForEntryRuntime(page);
}

async function pressEnterOnReloadingPrimary(page) {
  const primary = page.locator("[data-campaign-entry-primary]");
  await expect(primary).toBeFocused();
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    page.keyboard.press("Enter")
  ]);
  await waitForEntryRuntime(page);
}

for (const route of ROUTES) {
  test(`${route} requires New Game once, then offers Continue on the saved campaign`, async ({ page }) => {
    await clearCampaign(page);
    if (route === "/phaser/") await page.setViewportSize({ width: 390, height: 700 });
    await page.goto(`${route}?rcTest=1&campaignEntryTest=1`, { waitUntil: "domcontentloaded" });
    await waitForEntryRuntime(page);

    const entry = page.locator(".campaign-entry");
    await expect(entry).toBeVisible();
    await expect(entry).toHaveAttribute("data-campaign-entry-mode", "new-game");
    await expect(page.locator('[data-campaign-entry-action="new-game"]')).toContainText("Begin the night");
    await expect(page.locator("#ui-modal")).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator("#ui-modal")).toHaveCSS("display", "none");
    expect(await page.locator('[role="dialog"]:not([aria-hidden="true"])').count()).toBe(1);

    await page.keyboard.press("Escape");
    await expect(entry).toBeVisible();

    const before = await page.evaluate(() => window.NBD_CAMPAIGN.snapshot());
    expect(before.activeMission).toBeNull();
    expect(before.state.missions.activeMissionId).toBeNull();

    if (route === "/") await pressEnterOnReloadingPrimary(page);
    else await clickReloadingEntryAction(page, "new-game");
    await expect(page.locator(".campaign-entry")).toHaveCount(0);
    const started = await page.evaluate(() => window.NBD_CAMPAIGN.snapshot());
    expect(started.activeMission.id).toBe("silence_the_journalist");
    expect(started.activeMission.currentObjective.id).toBe("reach_police_roof");

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForEntryRuntime(page);
    await expect(page.locator(".campaign-entry")).toBeVisible();
    await expect(page.locator(".campaign-entry")).toHaveAttribute("data-campaign-entry-mode", "continue");
    const continueButton = page.locator('[data-campaign-entry-action="continue"]');
    const newGameButton = page.locator('[data-campaign-entry-action="new-game"]');
    await expect(continueButton).toContainText("Continue");
    await expect(newGameButton).toContainText("Start new game");
    await expect(continueButton).toBeFocused();
    if (route === "/phaser/") {
      await expect(continueButton).toBeInViewport();
      await expect(newGameButton).toBeInViewport();
    }
    await page.keyboard.press("Tab");
    await expect(newGameButton).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(continueButton).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator(".campaign-entry")).toBeVisible();

    await continueButton.click();
    await expect(page.locator(".campaign-entry")).toHaveCount(0);
    const continued = await page.evaluate(() => {
      const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
      const ui = window.NBD_PHASER_GAME.scene.getScene("UIScene");
      return {
        activeMissionId: window.NBD_CAMPAIGN.snapshot().state.missions.activeMissionId,
        entryOpen: scene.registry.get("campaignEntryOpen"),
        nativeModalAriaHidden: ui.dom.modal.hasAttribute("aria-hidden"),
        nativeModalInert: ui.dom.modal.inert
      };
    });
    expect(continued.activeMissionId).toBe("silence_the_journalist");
    expect(continued.entryOpen).toBe(false);
    expect(continued.nativeModalAriaHidden).toBe(false);
    expect(continued.nativeModalInert).toBe(false);
  });
}

test("a failed run waits for Retry before restoring its safe checkpoint", async ({ page }) => {
  await clearCampaign(page);
  await page.goto("/?rcTest=1&campaignEntryTest=1", { waitUntil: "domcontentloaded" });
  await waitForEntryRuntime(page);
  await clickReloadingEntryAction(page, "new-game");

  await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const campaign = scene.campaignSystem;
    campaign.handle("world:reached", { targetId: "police_roof" });
    campaign.handle("conversation:completed", { targetId: "police_roof_informant" });
    campaign.handle("world:reached", { targetId: "nightclub_district" });
    const checkpoint = scene.campaignCheckpointSystem.synthesizeFromCampaign();
    if (!checkpoint) throw new Error("An authored safe checkpoint could not be synthesized");
    campaign.setCheckpoint(checkpoint, { emit: false });
    campaign.failActiveMission("Caught before the district went quiet.");
    campaign.save();
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForEntryRuntime(page);

  await expect(page.locator(".campaign-entry")).toBeVisible();
  await expect(page.locator(".campaign-entry")).toHaveAttribute("data-campaign-entry-mode", "retry-checkpoint");
  await expect(page.locator('[data-campaign-entry-action="retry-checkpoint"]')).toContainText("Retry from checkpoint");
  const deferred = await page.evaluate(() => {
    const snapshot = window.NBD_CAMPAIGN.snapshot();
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    return {
      activeMissionId: snapshot.state.missions.activeMissionId,
      failed: snapshot.state.missions.records.silence_the_journalist.status,
      checkpointId: snapshot.checkpoint?.id,
      restored: scene.campaignCheckpointSystem.restored
    };
  });
  expect(deferred.activeMissionId).toBeNull();
  expect(deferred.failed).toBe("failed");
  expect(deferred.checkpointId).toBeTruthy();
  expect(deferred.restored).toBe(false);

  await clickReloadingEntryAction(page, "retry-checkpoint");
  await expect(page.locator(".campaign-entry")).toHaveCount(0);
  const restored = await page.evaluate(() => {
    const snapshot = window.NBD_CAMPAIGN.snapshot();
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    return {
      activeMissionId: snapshot.state.missions.activeMissionId,
      status: snapshot.state.missions.records.silence_the_journalist.status,
      objectiveId: snapshot.activeMission?.currentObjective?.id,
      checkpointId: snapshot.checkpoint?.id,
      restored: scene.campaignCheckpointSystem.restored
    };
  });
  expect(restored.activeMissionId).toBe("silence_the_journalist");
  expect(restored.status).toBe("active");
  expect(restored.objectiveId).toBe("neutralize_journalist");
  expect(restored.checkpointId).toBeTruthy();
  expect(restored.restored).toBe(true);
});