import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/phaser/"];

test.describe.configure({ timeout: 90_000 });

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

test("normal boot skips the retired narrative and opens persistent street free roam", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?rcTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_FREE_ROAM_READY
    && window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene")?.tutorialDirector
  ));

  await expect(page.locator("#ui-modal")).not.toHaveClass(/open/);
  await expect(page.locator("#tutorial-dialogue")).not.toHaveClass(/open/);
  await expect(page.locator(".campaign-entry")).toHaveCount(0);

  const gameState = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    return {
      tutorialStarted: Boolean(scene.tutorialDirector?.started),
      tutorialState: scene.tutorialDirector?.state,
      taskRevealActive: Boolean(scene.registry.get("taskRevealActive")),
      pendingAttack: Boolean(scene.inputSystem?.primaryPressed),
      currentLayer: scene.currentLayer,
      activeMissionId: scene.campaignSystem.state.missions.activeMissionId,
      registeredMissions: scene.campaignSystem.snapshot().definitions.length,
      missionBoard: Boolean(scene.missionBoardSystem || window.NBD_MISSION_BOARD)
    };
  });

  expect(gameState.tutorialStarted).toBeTruthy();
  expect(gameState.tutorialState).toBe("complete");
  expect(gameState.taskRevealActive).toBeFalsy();
  expect(gameState.pendingAttack).toBeFalsy();
  expect(gameState.currentLayer).toBe(0);
  expect(gameState.activeMissionId).toBeNull();
  expect(gameState.registeredMissions).toBe(0);
  expect(gameState.missionBoard).toBe(false);
  expect(pageErrors).toEqual([]);
});
