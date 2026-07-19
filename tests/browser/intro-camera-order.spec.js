import { expect, test } from "@playwright/test";

async function advanceToNextBubble(page) {
  const dialogue = page.locator("#tutorial-dialogue");
  const text = page.locator(".tutorial-dialogue__text");
  const previous = await text.textContent();
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  await expect(text).not.toHaveText(previous || "", { timeout: 6_000 });
  await expect(dialogue).toHaveClass(/open/);
}

test("the intro stays zoomed in through every opening bubble and zooms out afterward", async ({ page }) => {
  test.setTimeout(45_000);
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/?rcTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.tutorialDirector
  ));

  await page.locator("#ui-modal-action").click();
  await expect(page.locator("#tutorial-dialogue")).toHaveClass(/open/, { timeout: 10_000 });

  const closeZoom = await page.evaluate(() => (
    window.NBD_PHASER_GAME.scene.getScene("GameScene").cameras.main.zoom
  ));
  expect(closeZoom).toBeGreaterThan(3);

  // Two player bubbles and four sire segments: move from bubble 1 to bubble 6.
  for (let index = 0; index < 5; index++) {
    await advanceToNextBubble(page);
    const zoom = await page.evaluate(() => (
      window.NBD_PHASER_GAME.scene.getScene("GameScene").cameras.main.zoom
    ));
    expect(Math.abs(zoom - closeZoom)).toBeLessThan(0.2);
  }

  await expect(page.locator(".tutorial-dialogue__text")).toContainText("silence the journalist");
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");

  await page.waitForFunction(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    return scene.tutorialDirector?.state === "rooftop-movement"
      && !scene.registry.get("taskRevealActive")
      && !document.getElementById("tutorial-dialogue")?.classList.contains("open");
  }, null, { timeout: 12_000 });

  const finalState = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    return {
      zoom: scene.cameras.main.zoom,
      controlMode: scene.inputSystem?.controlMode,
      pendingAttack: Boolean(scene.inputSystem?.primaryPressed)
    };
  });
  expect(finalState.zoom).toBeLessThan(closeZoom * 0.7);
  expect(finalState.controlMode).toBe("movement");
  expect(finalState.pendingAttack).toBe(false);
  expect(pageErrors).toEqual([]);
});
