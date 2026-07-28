import { expect, test } from "@playwright/test";

const STORAGE_KEY = "viceblood-campaign-v1";

test.describe.configure({ timeout: 90_000 });

async function waitForLedger(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_HUNTING_LAW_READY
    && window.NBD_TERRITORY_READY
    && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.campaignSystem
    && window.NBD_PHASER_GAME?.scene?.getScene?.("UIScene")?.dom?.ledgerButton
  ));
}

test("Night Ledger pauses play and connects faction relations, hidden poaching and police pursuit", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?rcTest=1", { waitUntil: "domcontentloaded" });
  await waitForLedger(page);

  const seeded = await page.evaluate(storageKey => {
    const game = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const ui = window.NBD_PHASER_GAME.scene.getScene("UIScene");
    ui.closeIntro();
    game.campaignSystem.reputation.setFaction("first_estate", 42, {
      source: "night-ledger-browser",
      reason: "seed relation"
    });
    const assessment = game.campaignSystem.huntingLaw.assessFeed({
      districtId: "civic-center",
      victim: { id: "ledger-test-victim", type: "civilian" },
      witnessCount: 0,
      bodyEvidence: true,
      biteEvidence: true,
      wantedLevel: 0,
      source: "night-ledger-browser"
    });
    game.exposureSystem.value = 50;
    game.exposureSystem.lastReason = "A witness reports a violent feeding near Civic Centre.";
    game.publishState();
    ui.ledgerRefreshAt = 0;
    return {
      assessmentId: assessment.id,
      storedVersion: JSON.parse(localStorage.getItem(storageKey)).version
    };
  }, STORAGE_KEY);

  expect(seeded.storedVersion).toBe(4);
  await expect(page.locator("#hud-ledger-button")).toHaveClass(/danger/);
  await expect(page.locator("#hud-ledger-badge")).toHaveText("2");

  await page.locator("#hud-ledger-button").click();
  await expect(page.locator("#night-ledger")).toHaveClass(/open/);
  await expect(page.locator("#hud-ledger-button")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#night-ledger-close")).toBeFocused();

  const paused = await page.evaluate(() => ({
    gamePaused: window.NBD_PHASER_GAME.scene.getScene("GameScene").sys.isPaused(),
    registryPaused: window.NBD_PHASER_GAME.scene.getScene("UIScene").registry.get("uiPaused")
  }));
  expect(paused).toEqual({ gamePaused: true, registryPaused: true });

  await expect(page.locator("#night-ledger-content")).toContainText("The First Estate");
  await expect(page.locator("#night-ledger-content")).toContainText("Favoured");
  await expect(page.locator("#night-ledger-content")).toContainText("The Gutter Crown");
  await expect(page.locator("#night-ledger-content")).toContainText("PURSUIT");
  await expect(page.locator("#night-ledger-content")).toContainText("POACHING");
  await expect(page.locator("#night-ledger-content")).toContainText("HIDDEN");
  const estateCard = page.locator('[data-ledger-faction="first_estate"]');
  const hiddenMetric = estateCard.locator('.ledger-metric.warning');
  await expect(hiddenMetric).toContainText("1");
  await expect(hiddenMetric).toContainText("Hidden");

  await page.locator("#night-ledger-close").click();
  await expect(page.locator("#night-ledger")).not.toHaveClass(/open/);
  expect(await page.evaluate(() => window.NBD_PHASER_GAME.scene.getScene("GameScene").sys.isPaused())).toBe(false);

  await page.evaluate(assessmentId => {
    const game = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const ui = window.NBD_PHASER_GAME.scene.getScene("UIScene");
    game.campaignSystem.huntingLaw.discover(assessmentId, {
      source: "recovered_body",
      witnessId: "ledger-test-witness",
      referenceId: "ledger-test-victim"
    });
    game.exposureSystem.value = 0;
    game.exposureSystem.lastReason = "Police pressure cools after the search.";
    game.publishState();
    ui.ledgerRefreshAt = 0;
  }, seeded.assessmentId);

  await page.keyboard.press("l");
  await expect(page.locator("#night-ledger")).toHaveClass(/open/);
  await expect(page.locator("#night-ledger-content")).toContainText("DISCOVERED");
  const knownMetric = estateCard.locator('.ledger-metric.danger');
  await expect(knownMetric).toContainText("1");
  await expect(knownMetric).toContainText("Known");
  await page.keyboard.press("Escape");
  await expect(page.locator("#night-ledger")).not.toHaveClass(/open/);
  expect(await page.evaluate(() => window.NBD_PHASER_GAME.scene.getScene("GameScene").sys.isPaused())).toBe(false);
  expect(pageErrors).toEqual([]);
});
