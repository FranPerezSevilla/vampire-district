import { expect, test } from "@playwright/test";

async function dismissDialogue(page) {
  await page.waitForTimeout(300);
  await page.locator(".game-frame").click({ position: { x: 104, y: 104 } });
}

test("REPORT ACCEPTED returns to armed free roam with working unarmed impacts", async ({ page }) => {
  test.setTimeout(90_000);
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/?rcTest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.NBD_APP_READY && window.NBD_RC_HARNESS_READY));

  await page.evaluate(() => window.NBD_RC_HARNESS.prepareJournalistObjective());
  await page.evaluate(() => window.NBD_RC_HARNESS.neutralizeJournalist("killed"));
  await page.evaluate(() => window.NBD_RC_HARNESS.returnToRefuge());

  await expect(page.locator("#tutorial-dialogue")).toHaveClass(/open/);
  await dismissDialogue(page);
  await expect(page.locator("#tutorial-dialogue")).toHaveClass(/open/);
  await dismissDialogue(page);

  await expect(page.locator("#ui-modal")).toHaveClass(/open/, { timeout: 12_000 });
  await expect(page.locator("#ui-modal-title")).toHaveText("REPORT ACCEPTED");
  await page.locator("#ui-modal-action").click();
  await expect(page.locator("#ui-modal")).not.toHaveClass(/open/);

  await page.waitForFunction(() => {
    const game = window.NBD_PHASER_GAME;
    return Boolean(game?.scene?.getScene?.("GameScene")?.sys?.isActive?.());
  });

  const result = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const frame = {
      ...scene.currentInputFrame,
      worldEnabled: true,
      drainHeld: true,
      primaryPressed: false,
      hasMovementIntent: false,
      move: { x: 0, y: 0 }
    };

    const inventoryBefore = [...scene.weaponSystem.inventory];
    const weaponBefore = scene.weaponSystem.currentWeapon().id;
    const canCycle = scene.weaponSystem.canCycle(frame);
    const cycled = scene.weaponSystem.cycle(1);
    const weaponAfterCycle = scene.weaponSystem.currentWeapon().id;
    scene.weaponSystem.cycle(-1);

    while (scene.weaponSystem.currentWeapon().id !== "unarmed") {
      scene.weaponSystem.cycle(1);
    }

    const target = scene.npcSystem.npcs.find(npc => npc.type === "civilian" && !npc.missionInformant);
    if (!target) throw new Error("A civilian target is required for the free-roam impact check");

    target.dead = false;
    target.inactive = false;
    target.hiddenBody = false;
    target.intercepted = false;
    target.drainVictim = false;
    target.alarmed = false;
    target.chasingPlayer = false;
    target.enemyAttack = null;
    target.stunnedTimer = 0;
    target.layer = scene.currentLayer;
    target.x = scene.player.x + 24;
    target.y = scene.player.y;
    target.container?.setPosition?.(target.x, target.y).setVisible?.(true);

    scene.combatSystem.ensureCombatStates();
    target.combat.state = "active";
    target.combat.resilience = target.combat.maxResilience;
    target.combat.staggerUntil = 0;
    scene.npcSystem.rebuildSpatialIndex();

    scene.combatSystem.attack = null;
    scene.combatSystem.aimDirection = { x: 1, y: 0 };
    const beforeImpact = target.combat.resilience;
    const attackFrame = {
      ...frame,
      drainHeld: false,
      primaryPressed: true,
      pointerInside: true,
      aimWorld: { x: target.x, y: target.y }
    };
    scene.combatSystem.updateAim(attackFrame);
    scene.combatSystem.updateAttack(0, attackFrame);
    scene.combatSystem.updateAttack(0.11, { ...attackFrame, primaryPressed: false });

    return {
      missionCompleted: scene.missionSystem.completed,
      inventoryBefore,
      inventoryAfter: [...scene.weaponSystem.inventory],
      weaponBefore,
      canCycle,
      cycled,
      weaponAfterCycle,
      currentWeapon: scene.weaponSystem.currentWeapon().id,
      canAttack: scene.combatSystem.canStartAttack(frame),
      canDrain: scene.drainSystem.canStart(frame),
      beforeImpact,
      afterImpact: target.combat.resilience,
      attackStarted: Boolean(scene.combatSystem.attack)
    };
  });

  expect(result.missionCompleted).toBe(true);
  expect(result.inventoryBefore).toEqual(["unarmed", "iron_pipe", "pistol"]);
  expect(result.inventoryAfter).toEqual(result.inventoryBefore);
  expect(result.canCycle).toBe(true);
  expect(result.cycled).toBe(true);
  expect(result.weaponAfterCycle).not.toBe(result.weaponBefore);
  expect(result.currentWeapon).toBe("unarmed");
  expect(result.canAttack).toBe(true);
  expect(result.canDrain).toBe(true);
  expect(result.attackStarted).toBe(true);
  expect(result.afterImpact).toBe(result.beforeImpact - 1);
  expect(pageErrors).toEqual([]);
});
