import { expect, test } from "@playwright/test";

test("pause menu exposes a persistent keyboard-operable high-contrast aim option", async ({ page }) => {
  await page.goto("/?rcTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.NBD_APP_READY && window.NBD_RC_HARNESS_READY));
  await page.evaluate(() => {
    window.NBD_RC_HARNESS.unlockPostTutorialWorld();
    return true;
  });

  await page.keyboard.press("h");
  await expect(page.locator("#ui-modal")).toHaveClass(/open/);
  const toggle = page.locator("[data-aim-contrast-toggle]");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toContainText("On");

  const stored = await page.evaluate(() => ({
    registry: window.NBD_PHASER_GAME.scene.getScene("UIScene").registry.get("aimHighContrast"),
    storage: window.localStorage.getItem("nbd-aim-high-contrast")
  }));
  expect(stored).toEqual({ registry: true, storage: "true" });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.NBD_APP_READY && window.NBD_PHASER_GAME?.scene?.getScene?.("UIScene")?.dom));
  expect(await page.evaluate(() => window.NBD_PHASER_GAME.scene.getScene("UIScene").registry.get("aimHighContrast"))).toBe(true);
});

test("HUD regions expose semantic state and remain separated on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 720 });
  await page.goto("/phaser/?rcTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.NBD_APP_READY && window.NBD_PHASER_GAME?.scene?.getScene?.("UIScene")?.dom));

  await expect(page.locator(".hud-vitals")).toHaveAttribute("role", "progressbar");
  await expect(page.locator(".hud-vitals")).toHaveAttribute("aria-valuemin", "0");
  await expect(page.locator(".hud-vitals")).toHaveAttribute("aria-valuemax", "100");
  await expect(page.locator("#hud-wanted")).toHaveAttribute("role", "status");
  await expect(page.locator(".weapon-hud")).toHaveAttribute("role", "status");

  const boxes = await page.evaluate(() => {
    const box = selector => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      return rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom } : null;
    };
    return {
      powers: box(".power-dock"),
      weapon: box(".weapon-hud"),
      prompt: box("#hud-prompt")
    };
  });

  expect(boxes.powers).not.toBeNull();
  expect(boxes.weapon).not.toBeNull();
  expect(boxes.prompt).not.toBeNull();
  expect(boxes.powers.right).toBeLessThan(boxes.weapon.left);
});
