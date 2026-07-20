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

test("the intro remains zoomed in while opening dialogue is active", async ({ page }) => {
  test.setTimeout(60_000);
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/?rcTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.tutorialDirector
  ));

  await page.locator("#ui-modal-action").click();
  const dialogue = page.locator("#tutorial-dialogue");
  const text = page.locator(".tutorial-dialogue__text");
  await expect(dialogue).toHaveClass(/open/, { timeout: 15_000 });
  await expect(text).toContainText("Another night");

  const firstZoom = await page.evaluate(() => (
    window.NBD_PHASER_GAME.scene.getScene("GameScene").cameras.main.zoom
  ));
  expect(firstZoom).toBeGreaterThan(3);

  // The normal layer camera must not immediately pull out underneath the bubble.
  await page.waitForTimeout(700);
  const heldZoom = await page.evaluate(() => (
    window.NBD_PHASER_GAME.scene.getScene("GameScene").cameras.main.zoom
  ));
  expect(Math.abs(heldZoom - firstZoom)).toBeLessThan(0.2);
  await expect(text).toContainText("Another night");

  const previous = await text.textContent();
  await dispatchDialogueAdvance(page);
  await page.waitForFunction(previousText => {
    const root = document.getElementById("tutorial-dialogue");
    const current = document.querySelector(".tutorial-dialogue__text")?.textContent || "";
    return Boolean(root?.classList.contains("open") && current && current !== previousText);
  }, previous || "", { timeout: 12_000 });
  await expect(text).toContainText("My sire");

  const secondZoom = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    return {
      zoom: scene.cameras.main.zoom,
      state: scene.tutorialDirector?.state,
      locked: Boolean(scene.registry.get("taskRevealActive")),
      pendingAttack: Boolean(scene.inputSystem?.primaryPressed)
    };
  });
  expect(Math.abs(secondZoom.zoom - firstZoom)).toBeLessThan(0.2);
  expect(secondZoom.state).toBe("intro");
  expect(secondZoom.locked).toBe(true);
  expect(secondZoom.pendingAttack).toBe(false);
  expect(pageErrors).toEqual([]);
});
