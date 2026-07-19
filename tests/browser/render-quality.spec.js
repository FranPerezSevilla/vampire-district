import { expect, test } from "@playwright/test";

const CASES = [
  { route: "/", preset: "compact", width: 1440, height: 960 },
  { route: "/phaser/", preset: "ultra", width: 2880, height: 1920 }
];

for (const entry of CASES) {
  test(`${entry.preset} render quality boots and survives resize on ${entry.route}`, async ({ page }) => {
    await page.addInitScript(preset => {
      window.localStorage.setItem("nbd-resolution-preset", preset);
    }, entry.preset);
    await page.setViewportSize({ width: 1500, height: 920 });
    await page.goto(`${entry.route}?rcTest=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.NBD_APP_READY && window.NBD_RC_HARNESS_READY));

    const initial = await page.evaluate(() => {
      const canvas = document.querySelector("#game-root canvas");
      const rect = canvas.getBoundingClientRect();
      const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
      return {
        preset: window.NBD_RESOLUTION_PRESET,
        phaserSource: window.NBD_PHASER_SOURCE,
        gameWidth: Number(window.NBD_PHASER_GAME.config.width),
        gameHeight: Number(window.NBD_PHASER_GAME.config.height),
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        cssWidth: rect.width,
        cssHeight: rect.height,
        aim: scene.inputSystem.pointerWorldPoint()
      };
    });

    expect(initial.preset.key).toBe(entry.preset);
    expect(initial.phaserSource).toBe("local");
    expect(initial.gameWidth).toBe(entry.width);
    expect(initial.gameHeight).toBe(entry.height);
    expect(initial.canvasWidth).toBeGreaterThanOrEqual(entry.width);
    expect(initial.canvasHeight).toBeGreaterThanOrEqual(entry.height);
    expect(Number.isFinite(initial.aim.x)).toBe(true);
    expect(Number.isFinite(initial.aim.y)).toBe(true);

    await page.setViewportSize({ width: 720, height: 760 });
    await page.mouse.move(360, 360);
    await page.waitForTimeout(300);

    const resized = await page.evaluate(() => {
      const canvas = document.querySelector("#game-root canvas");
      const rect = canvas.getBoundingClientRect();
      const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
      return {
        cssWidth: rect.width,
        cssHeight: rect.height,
        aim: scene.inputSystem.pointerWorldPoint(),
        conflicts: window.NBD_RUNTIME_DIAGNOSTICS.snapshot().conflicts
      };
    });

    expect(resized.cssWidth).toBeLessThanOrEqual(692);
    expect(resized.cssHeight).toBeGreaterThan(0);
    expect(Number.isFinite(resized.aim.x)).toBe(true);
    expect(Number.isFinite(resized.aim.y)).toBe(true);
    expect(resized.conflicts).toEqual([]);
    await expect(page.locator("#game-root canvas")).toBeVisible();
  });
}
