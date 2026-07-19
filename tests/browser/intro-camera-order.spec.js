import { expect, test } from "@playwright/test";

async function dispatchDialogueAdvance(page) {
  await page.waitForTimeout(320);
  await page.evaluate(() => {
    const target = document.querySelector("#game-root canvas") || document.querySelector(".game-frame");
    if (!target) throw new Error("Playable game surface is unavailable");
    const rect = target.getBoundingClientRect();
    target.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons: 1,
      clientX: rect.left + Math.min(112, Math.max(1, rect.width / 2)),
      clientY: rect.top + Math.min(112, Math.max(1, rect.height / 2))
    }));
  });
}

async function advanceToNextBubble(page) {
  const text = page.locator(".tutorial-dialogue__text");
  const previous = await text.textContent();
  await dispatchDialogueAdvance(page);
  await page.waitForFunction(previousText => {
    const dialogue = document.getElementById("tutorial-dialogue");
    const current = document.querySelector(".tutorial-dialogue__text")?.textContent || "";
    return Boolean(dialogue?.classList.contains("open") && current && current !== previousText);
  }, previous || "", { timeout: 8_000 });
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
  await dispatchDialogueAdvance(page);

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
