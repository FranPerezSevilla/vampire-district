import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/phaser/"];

for (const route of ROUTES) {
  test(`${route} composes one healthy gameplay runtime`, async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));

    await page.goto(`${route}?rcTest=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(
      window.NBD_APP_READY
      && window.NBD_PHASER_GAME
      && window.NBD_RUNTIME_DIAGNOSTICS
      && window.NBD_PHASER_GAME.scene?.getScene?.("GameScene")?.inputSystem
    ));

    await expect(page.locator("h1")).toHaveText("Vampire District");
    await expect(page.locator("#game-root canvas")).toBeVisible();
    await expect(page.locator(".weapon-hud")).toBeVisible();
    await expect(page.locator("#hud-hunger-value")).toContainText("%");

    const runtime = await page.evaluate(() => {
      const gameScene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
      const diagnostics = window.NBD_RUNTIME_DIAGNOSTICS.snapshot();
      return {
        phaserSource: window.NBD_PHASER_SOURCE,
        pausedOrActive: gameScene.sys.isPaused() || gameScene.sys.isActive(),
        owners: diagnostics.owners,
        conflicts: diagnostics.conflicts,
        systems: diagnostics.systems,
        hasSpatialIndex: Boolean(gameScene.npcSystem?.spatial),
        hasTaskReveal: Boolean(gameScene.taskRevealSystem),
        hasObjectiveMarker: Boolean(gameScene.objectiveMarkerSystem),
        hasOutskirts: Boolean(gameScene.outskirtsSystem),
        hasBindings: Boolean(gameScene.inputSystem?.bindingSnapshot?.().bindings),
        legacyPatches: {
          inputRuntime: Boolean(gameScene.constructor.prototype.__nbdInputRuntimePatch),
          movementRuntime: Boolean(gameScene.constructor.prototype.__nbdMovementRuntimePatch),
          milestoneEight: Boolean(gameScene.constructor.prototype.__nbdMilestone8AiPatch)
        }
      };
    });

    expect(runtime.phaserSource).toBe("local");
    expect(runtime.pausedOrActive).toBeTruthy();
    expect(runtime.conflicts).toEqual([]);
    expect(runtime.owners["GameScene.update"]).toBe("GameplayRuntime");
    expect(runtime.systems).toContain("InputSystem");
    expect(runtime.systems).toContain("AiStateSystem");
    expect(runtime.systems).toContain("TaskRevealSystem");
    expect(runtime.hasSpatialIndex).toBeTruthy();
    expect(runtime.hasTaskReveal).toBeTruthy();
    expect(runtime.hasObjectiveMarker).toBeTruthy();
    expect(runtime.hasOutskirts).toBeTruthy();
    expect(runtime.hasBindings).toBeTruthy();
    expect(runtime.legacyPatches).toEqual({
      inputRuntime: false,
      movementRuntime: false,
      milestoneEight: false
    });

    await page.setViewportSize({ width: 900, height: 700 });
    await page.waitForTimeout(250);
    const canvasBox = await page.locator("#game-root canvas").boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(canvasBox.width).toBeLessThanOrEqual(872);
    expect(canvasBox.height).toBeGreaterThan(0);

    expect(pageErrors).toEqual([]);
  });
}

test("intro resumes the world and opens the click-driven narrative", async ({ page }) => {
  await page.goto("/?rcTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.tutorialDirector
  ));

  await expect(page.locator("#ui-modal")).toHaveClass(/open/);
  await page.locator("#ui-modal-action").click();
  await expect(page.locator("#ui-modal")).not.toHaveClass(/open/);
  await expect(page.locator("#tutorial-dialogue")).toHaveClass(/open/, { timeout: 8_000 });
  await expect(page.locator(".tutorial-dialogue__advance")).toContainText("CLICK");

  await page.waitForTimeout(280);
  await page.locator(".game-frame").click({ position: { x: 120, y: 120 } });
  await page.waitForTimeout(250);

  const gameState = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    return {
      tutorialStarted: Boolean(scene.tutorialDirector?.started),
      worldLockedForDialogue: Boolean(scene.registry.get("taskRevealActive")),
      pendingAttack: Boolean(scene.inputSystem?.primaryPressed)
    };
  });
  expect(gameState.tutorialStarted).toBeTruthy();
  expect(gameState.worldLockedForDialogue).toBeTruthy();
  expect(gameState.pendingAttack).toBeFalsy();
});
