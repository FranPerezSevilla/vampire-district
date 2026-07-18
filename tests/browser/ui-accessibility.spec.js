import { expect, test } from "@playwright/test";

test("pause menu exposes a persistent keyboard-operable high-contrast aim option", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.NBD_PHASER_GAME?.scene?.getScene?.("UIScene")?.dom));

  await page.locator("#ui-modal-action").click();
  await page.waitForFunction(() => Boolean(window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.tutorialDirector?.started));

  // Complete the opening dialogue chain quickly; the test only needs full UI control.
  for (let index = 0; index < 8; index++) {
    const open = await page.locator("#tutorial-dialogue.open").count();
    if (!open) {
      await page.waitForTimeout(200);
      continue;
    }
    await page.locator(".game-frame").click({ position: { x: 80, y: 80 } });
    await page.waitForTimeout(180);
  }

  await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const director = scene.tutorialDirector;
    director?.freezeWorld?.(false);
    if (director) {
      director.state = "complete";
      director.busy = false;
      director.setControlMode?.("full");
      director.setTip?.("", "");
    }
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
  await page.waitForFunction(() => Boolean(window.NBD_PHASER_GAME?.scene?.getScene?.("UIScene")?.dom));
  expect(await page.evaluate(() => window.NBD_PHASER_GAME.scene.getScene("UIScene").registry.get("aimHighContrast"))).toBe(true);
});

test("HUD regions expose semantic state and remain separated on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 720 });
  await page.goto("/phaser/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.NBD_PHASER_GAME?.scene?.getScene?.("UIScene")?.dom));

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
