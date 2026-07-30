import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 90_000 });

test("playtest mode delivers a start, objective loop, result and feedback path", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/?mode=playtest&rcTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.NBD_APP_READY && window.NBD_PLAYTEST_READY));

  await expect(page.locator("#playtest-intro")).toHaveClass(/open/);
  await expect(page.locator("#playtest-intro-title")).toHaveText("Hunt. Feed. Escape.");
  await expect(page.locator("#playtest-start")).toBeVisible();
  await page.locator("#playtest-start").click();

  await page.waitForFunction(() => window.NBD_PLAYTEST_SESSION?.snapshot?.().status === "active");
  await expect(page.locator("#playtest-objective")).toHaveClass(/open/);
  await expect(page.locator("#playtest-objective-hint")).toContainText("prey pulse");
  await expect(page.locator("#hud-hunger-value")).toContainText("72%");
  await expect(page.locator("#hud-mission-step")).toHaveText("1/3");
  await expect(page.locator("#mission-current")).toContainText("1/3 HUNT");
  await expect(page.locator("#mission-checklist")).toContainText("Find prey and feed");
  await expect(page.locator("#mission-checklist")).not.toContainText("rooftop blocker");

  await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const session = scene.playtestSessionSystem;
    const refuge = session.snapshot().refuge;

    scene.player.setPosition(refuge.x + 220, refuge.y);
    session.update(0.2);
    scene.events.emit("feeding:resolved", { depth: "drain", feedingDepth: "drain" });
    scene.feedingSystem.hunger = 20;
    session.update(0.2);
    scene.currentLayer = refuge.layer;
    scene.player.setPosition(refuge.x, refuge.y);
    session.update(0.2);
  });

  await expect(page.locator("#playtest-result")).toHaveClass(/open/);
  await expect(page.locator("#playtest-result-title")).toHaveText("NIGHT SURVIVED");
  await expect(page.locator("#playtest-result-stats")).toContainText("Victims fed upon");
  await expect(page.locator("#playtest-result-feedback")).toBeVisible();
  await expect(page.locator("#ui-modal")).not.toHaveClass(/open/);
  await expect.poll(() => page.evaluate(() => window.NBD_PLAYTEST_SESSION.snapshot().objectiveText))
    .toContain("NIGHT SURVIVED");

  await page.locator("#playtest-result-feedback").click();
  await expect(page.locator("#playtest-feedback-overlay")).toHaveClass(/open/);
  await expect(page.locator("#playtest-feedback-title")).toContainText("how the loop felt");
  await page.locator("[data-feedback-close]").first().click();
  await expect(page.locator("#playtest-feedback-overlay")).not.toHaveClass(/open/);

  expect(pageErrors).toEqual([]);
});
