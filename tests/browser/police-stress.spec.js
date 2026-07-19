import { expect, test } from "@playwright/test";

test("level-three police response stays structurally stable", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/?rcTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.NBD_APP_READY && window.NBD_RC_HARNESS_READY));

  const baselineNodes = await page.evaluate(() => document.querySelectorAll("*").length);
  const started = await page.evaluate(() => window.NBD_RC_HARNESS.startPoliceStress());

  expect(started.level).toBeGreaterThanOrEqual(3);
  expect(started.police).toBeGreaterThanOrEqual(6);
  expect(started.helicopter).toBe(true);
  expect(started.missionFailed).toBe(false);
  expect(started.dialogueNodes).toBe(1);
  expect(started.taskRevealNodes).toBe(1);
  expect(started.weaponHudNodes).toBe(1);
  expect(started.diagnostics?.conflicts).toEqual([]);

  await page.waitForTimeout(6_000);
  const finished = await page.evaluate(() => {
    const snapshot = window.NBD_RC_HARNESS.stressSnapshot();
    window.NBD_RC_HARNESS.stopPoliceStress();
    return snapshot;
  });

  expect(finished.level).toBeGreaterThanOrEqual(3);
  expect(finished.police).toBeGreaterThanOrEqual(6);
  expect(finished.helicopter).toBe(true);
  expect(finished.missionFailed).toBe(false);
  expect(finished.dialogueNodes).toBe(1);
  expect(finished.taskRevealNodes).toBe(1);
  expect(finished.weaponHudNodes).toBe(1);
  expect(finished.domNodes - baselineNodes).toBeLessThanOrEqual(24);
  expect(finished.diagnostics?.conflicts).toEqual([]);
  expect(finished.diagnostics?.samples).toBeGreaterThan(30);
  expect(finished.diagnostics?.averageFrameMs).toBeLessThan(120);
  expect(finished.diagnostics?.maxFrameMs).toBeLessThan(750);
  expect(pageErrors).toEqual([]);
});
