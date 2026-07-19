import { expect, test } from "@playwright/test";

const CASES = [
  { route: "/", outcome: "killed" },
  { route: "/phaser/", outcome: "drained" }
];

test.describe.configure({ timeout: 90_000 });

for (const { route, outcome } of CASES) {
  test(`${outcome} journalist outcome requires sire dialogue before REPORT ACCEPTED on ${route}`, async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));

    await page.goto(`${route}?rcTest=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.NBD_APP_READY && window.NBD_RC_HARNESS_READY));

    const prepared = await page.evaluate(() => window.NBD_RC_HARNESS.prepareJournalistObjective());
    expect(prepared.rcTestMode).toBe(true);
    expect(prepared.missionStep).toBe(2);
    expect(prepared.completed).toBe(false);
    expect(prepared.result).toBeNull();
    expect(prepared.taskRevealActive).toBe(false);

    const neutralized = await page.evaluate(selectedOutcome => (
      window.NBD_RC_HARNESS.neutralizeJournalist(selectedOutcome)
    ), outcome);
    expect(neutralized.missionStep).toBe(3);
    expect(neutralized.completed).toBe(false);
    expect(neutralized.result).toBeNull();
    expect(neutralized.taskRevealActive).toBe(false);

    const enteredRefuge = await page.evaluate(() => window.NBD_RC_HARNESS.returnToRefuge());
    expect(enteredRefuge.missionStep).toBe(3);
    expect(enteredRefuge.completed).toBe(false);
    expect(enteredRefuge.returnFinalePending).toBe(true);
    expect(enteredRefuge.result).toBeNull();

    const dialogue = page.locator("#tutorial-dialogue");
    const dialogueText = page.locator(".tutorial-dialogue__text");
    await expect(dialogue).toHaveClass(/open/);
    await expect(dialogueText).toContainText("Well done");
    await expect(page.locator("#ui-modal")).not.toHaveClass(/open/);

    const firstSegment = await dialogueText.textContent();
    await page.waitForTimeout(280);
    await page.locator(".game-frame").click({ position: { x: 100, y: 100 } });
    await expect(dialogue).toHaveClass(/open/);
    await expect(dialogueText).not.toHaveText(firstSegment || "");
    await expect(dialogueText).toContainText("served me well");

    await page.waitForTimeout(280);
    await page.locator(".game-frame").click({ position: { x: 100, y: 100 } });

    await expect(page.locator("#ui-modal")).toHaveClass(/open/, { timeout: 12_000 });
    await expect(page.locator("#ui-modal-title")).toHaveText("REPORT ACCEPTED");
    await expect(page.locator("#ui-modal-body")).toContainText("Night report");

    const completed = await page.evaluate(() => window.NBD_RC_HARNESS.snapshot());
    expect(completed.missionStep).toBe(4);
    expect(completed.completed).toBe(true);
    expect(completed.failed).toBe(false);
    expect(completed.result?.status).toBe("complete");
    expect(completed.result?.title).toBe("REPORT ACCEPTED");
    expect(completed.returnFinalePending).toBe(false);
    expect(completed.taskRevealActive).toBe(false);
    expect(completed.inputEdges).toEqual({
      primaryPressed: false,
      drainPressed: false,
      wheelStep: 0
    });

    const eventTypes = completed.events.map(event => event.type);
    const startIndex = eventTypes.indexOf("return-finale-started");
    const completeIndex = eventTypes.indexOf("return-finale-completed");
    expect(startIndex).toBeGreaterThanOrEqual(0);
    expect(completeIndex).toBeGreaterThan(startIndex);
    expect(pageErrors).toEqual([]);
  });
}
