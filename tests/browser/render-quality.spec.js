import { expect, test } from "@playwright/test";

const CASES = [
  { route: "/", preset: "compact", width: 1440, height: 960 },
  { route: "/phaser/", preset: "ultra", width: 2880, height: 1920 }
];

test.describe.configure({ timeout: 75_000 });

test("production Canvas fallback keeps vehicle labels at logical size and restores movement after New Night", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.addInitScript(() => {
    // Exercise the supported Phaser.AUTO fallback used by the Pages playthrough.
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      if (["webgl", "webgl2", "experimental-webgl"].includes(kind)) return null;
      return originalGetContext.call(this, kind, ...args);
    };
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.NBD_TITLE_AUDIO_GATE_STATE === "waiting");
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: /New Night/ }).click();
  await page.waitForFunction(() => {
    const game = window.NBD_PHASER_GAME;
    const scene = game?.scene.getScene("GameScene");
    return window.NBD_TITLE_SCREEN_STATE?.state === "world"
      && scene?.inputSystem?.worldEnabled
      && !scene.registry.get("uiPaused")
      && game.scene.isActive("GameScene");
  });

  const labels = await page.evaluate(() => {
    const game = window.NBD_PHASER_GAME;
    const scene = game.scene.getScene("GameScene");
    return {
      canvasRenderer: game.renderer.type === Phaser.CANVAS,
      labels: scene.vehicleSystem.vehicles.map(vehicle => {
        const label = vehicle.visual.label;
        return {
          width: label.width,
          height: label.height,
          renderedWidth: label.frame.cutWidth / label.frame.source.resolution,
          renderedHeight: label.frame.cutHeight / label.frame.source.resolution
        };
      })
    };
  });
  expect(labels.canvasRenderer).toBe(true);
  expect(labels.labels.length).toBeGreaterThan(0);
  for (const label of labels.labels) {
    expect(Math.abs(label.renderedWidth - label.width)).toBeLessThan(1);
    expect(Math.abs(label.renderedHeight - label.height)).toBeLessThan(1);
  }

  const playerX = () => page.evaluate(() => window.NBD_PHASER_GAME.scene.getScene("GameScene").player.x);
  const startX = await playerX();
  await page.keyboard.down("d");
  try {
    await expect.poll(playerX).toBeGreaterThan(startX + 30);
  } finally {
    await page.keyboard.up("d");
  }
  expect(pageErrors).toEqual([]);
});

for (const entry of CASES) {
  test(`${entry.preset} render quality boots and survives resize on ${entry.route}`, async ({ page }) => {
    await page.addInitScript(preset => {
      window.localStorage.setItem("nbd-resolution-preset", preset);
    }, entry.preset);
    await page.setViewportSize({ width: 1500, height: 920 });
    await page.goto(`${entry.route}?testScenario=urban-explore`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(
      window.NBD_APP_READY
      && window.NBD_SCENARIO_READY
      && window.NBD_SCENARIOS?.snapshot?.().activeId === "urban-explore"
    ));

    const canvasLocator = page.locator("#game-root canvas");
    await expect(canvasLocator).toBeVisible({ timeout: 30_000 });
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
        aim: scene.inputSystem.pointerWorldPoint(),
        bootMode: window.NBD_BOOT_PROFILE.mode
      };
    });

    expect(initial.preset.key).toBe(entry.preset);
    expect(initial.phaserSource).toBe("local");
    expect(initial.bootMode).toBe("scenario");
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
    await expect(canvasLocator).toBeVisible();
  });
}
