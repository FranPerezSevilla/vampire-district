import { expect, test } from "@playwright/test";

test("weapon cycling updates the persistent HUD without top or bottom popups", async ({ page }) => {
  await page.goto("/?rcTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.weaponSystem
  ));
  await page.keyboard.press("Enter");

  const result = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.registry.set("uiPaused", false);
    scene.lastActionText = "";
    scene.registry.set("lastActionText", "");
    scene.uxGuidanceSystem.transient = null;
    const before = scene.weaponSystem.state();
    const changed = scene.weaponSystem.cycle(1);
    const after = scene.weaponSystem.state();
    return {
      changed,
      beforeId: before.id,
      afterId: after.id,
      afterName: after.name,
      lastActionText: scene.lastActionText,
      transient: scene.uxGuidanceSystem.transient
    };
  });

  expect(result.changed).toBe(true);
  expect(result.afterId).not.toBe(result.beforeId);
  expect(result.lastActionText).toBe("");
  expect(result.transient).toBeNull();
  await expect(page.locator(".weapon-hud strong")).toHaveText(result.afterName);
  await expect(page.locator("#hud-toast")).not.toHaveClass(/visible/);
});
