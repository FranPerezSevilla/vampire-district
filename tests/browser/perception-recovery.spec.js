import { expect, test } from "@playwright/test";

test("a visible incident creates a witness while heard-only NPC stays in WTF", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/?rcTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.NBD_APP_READY && window.NBD_RC_HARNESS_READY));

  const result = await page.evaluate(() => window.NBD_RC_HARNESS.perceptionSplitSequence());

  expect(result.viewer.alarmed).toBe(true);
  expect(result.viewer.reportTarget).not.toBeNull();
  expect(result.viewer.soundReactionTimer).toBe(0);
  expect(result.viewer.chasingPlayer).toBe(false);

  expect(result.listener.alarmed).toBe(false);
  expect(result.listener.reportTarget).toBeNull();
  expect(result.listener.soundReactionTimer).toBeGreaterThan(0);
  expect(result.listener.chasingPlayer).toBe(false);
  expect(result.listener.wtfVisible).toBe(true);
  expect(result.summary).toContain("saw it");
  expect(result.summary).toContain("heard it");
  expect(pageErrors).toEqual([]);
});

test("a downed police officer recovers once with two resilience", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/phaser/?rcTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.NBD_APP_READY && window.NBD_RC_HARNESS_READY));

  const result = await page.evaluate(() => window.NBD_RC_HARNESS.policeRecoverySequence());

  expect(result.scheduledDelayMs).toBeGreaterThanOrEqual(0);
  expect(result.scheduledDelayMs).toBeLessThanOrEqual(150);
  expect(result.state).toBe("staggered");
  expect(result.resilience).toBe(2);
  expect(result.maxResilience).toBe(4);
  expect(result.recoveredEventsAdded).toBe(1);
  expect(result.lastRecovery).toMatchObject({
    targetId: result.officerId,
    resilience: 2,
    maxResilience: 4
  });
  expect(pageErrors).toEqual([]);
});
