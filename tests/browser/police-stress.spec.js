import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 60_000 });

async function waitForPoliceScenario(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_RC_HARNESS_READY
    && window.NBD_SCENARIOS?.snapshot?.().activeId === "police-escalation"
  ));
}

test("police violence escalates 1 to 2 to 3 without double-counting", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/?testScenario=police-escalation", { waitUntil: "domcontentloaded" });
  await waitForPoliceScenario(page);

  const sequence = await page.evaluate(() => window.NBD_RC_HARNESS.policeEscalationSequence());
  expect(sequence.levels).toEqual([1, 2, 3]);
  expect(sequence.duplicateLevel).toBe(3);
  expect(sequence.helicopter).toBe(true);
  expect(sequence.escalations).toHaveLength(3);
  expect(sequence.escalations.map(event => event.level)).toEqual([1, 2, 3]);
  expect(sequence.escalations.map(event => event.neutralized)).toEqual([false, true, true]);
  expect(pageErrors).toEqual([]);
});

test("level-three police response stays structurally stable while pressure cools", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/?testScenario=police-escalation", { waitUntil: "domcontentloaded" });
  await waitForPoliceScenario(page);

  const baselineNodes = await page.evaluate(() => document.querySelectorAll("*").length);
  const started = await page.evaluate(() => window.NBD_RC_HARNESS.startPoliceStress());

  expect(started.level).toBeGreaterThanOrEqual(3);
  expect(started.desiredPolice).toBe(7);
  expect(started.police).toBeGreaterThanOrEqual(started.desiredPolice);
  expect(started.helicopter).toBe(true);
  expect(started.missionFailed).toBe(false);
  expect(started.dialogueNodes).toBe(1);
  expect(started.taskRevealNodes).toBe(1);
  expect(started.weaponHudNodes).toBe(1);
  expect(started.diagnostics?.conflicts).toEqual([]);

  await page.waitForTimeout(3_000);
  const finished = await page.evaluate(() => {
    const snapshot = window.NBD_RC_HARNESS.stressSnapshot();
    window.NBD_RC_HARNESS.stopPoliceStress();
    return snapshot;
  });

  // Exposure is allowed to cool naturally during an endurance sample. The
  // structural invariant is that the runtime remains healthy while the
  // already-spawned response transitions out of its peak state.
  expect(finished.level).toBeGreaterThanOrEqual(2);
  expect(finished.police).toBeGreaterThanOrEqual(5);
  expect(finished.missionFailed).toBe(false);
  expect(finished.dialogueNodes).toBe(1);
  expect(finished.taskRevealNodes).toBe(1);
  expect(finished.weaponHudNodes).toBe(1);
  expect(finished.domNodes - baselineNodes).toBeLessThanOrEqual(24);
  expect(finished.diagnostics?.conflicts).toEqual([]);
  expect(finished.diagnostics?.samples).toBeGreaterThan(3);
  expect(finished.diagnostics?.averageFrameMs).toBeLessThan(120);
  expect(finished.diagnostics?.recentMaxFrameMs).toBeLessThan(750);
  expect(pageErrors).toEqual([]);
});
