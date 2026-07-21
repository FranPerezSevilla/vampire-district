import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 60_000 });

async function dispatchWorldInputs(page) {
  await page.evaluate(() => {
    const canvas = document.querySelector("#game-root canvas");
    const rect = canvas.getBoundingClientRect();
    const common = {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2
    };
    canvas.dispatchEvent(new PointerEvent("pointerdown", { ...common, button: 0, buttons: 1 }));
    canvas.dispatchEvent(new PointerEvent("pointerdown", { ...common, button: 2, buttons: 2 }));
    canvas.dispatchEvent(new WheelEvent("wheel", { ...common, deltaY: 120 }));
    window.dispatchEvent(new PointerEvent("pointerup", { ...common, button: 0, buttons: 0 }));
    window.dispatchEvent(new PointerEvent("pointerup", { ...common, button: 2, buttons: 0 }));
  });
}

async function inputSnapshot(page) {
  return page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    return {
      primaryPressed: Boolean(scene.inputSystem.primaryPressed),
      primaryHeld: Boolean(scene.inputSystem.primaryHeld),
      drainPressed: Boolean(scene.inputSystem.drainPressed),
      drainHeld: Boolean(scene.inputSystem.drainHeld),
      wheelStep: Number(scene.inputSystem.pendingWheelStep || 0),
      attack: Boolean(scene.combatSystem.attack),
      feeding: Boolean(scene.feedingSystem.active)
    };
  });
}

const EMPTY_WORLD_INPUT = Object.freeze({
  primaryPressed: false,
  primaryHeld: false,
  drainPressed: false,
  drainHeld: false,
  wheelStep: 0,
  attack: false,
  feeding: false
});

test("pause and task reveals discard mouse and wheel input", async ({ page }) => {
  await page.goto("/?testScenario=input-locks", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_SCENARIOS?.snapshot?.().activeId === "input-locks"
  ));

  await page.keyboard.press("h");
  await expect(page.locator("#ui-modal")).toHaveClass(/open/);
  await dispatchWorldInputs(page);
  await page.keyboard.press("h");
  await expect(page.locator("#ui-modal")).not.toHaveClass(/open/);
  expect(await inputSnapshot(page)).toEqual(EMPTY_WORLD_INPUT);

  // Use normal reveal hold timing for this one loop so injected browser events
  // cannot land after the ultra-short RC cinematic has already closed.
  await page.evaluate(() => {
    window.NBD_RC_TEST_MODE = false;
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.playTaskReveal({ step: "RC LOCK", text: "Input lock regression test." });
  });
  await page.waitForFunction(() => window.NBD_PHASER_GAME.scene.getScene("GameScene").registry.get("taskRevealActive") === true);
  await dispatchWorldInputs(page);
  await page.evaluate(() => { window.NBD_RC_TEST_MODE = true; });
  await page.waitForFunction(() => window.NBD_PHASER_GAME.scene.getScene("GameScene").registry.get("taskRevealActive") === false);

  expect(await inputSnapshot(page)).toEqual(EMPTY_WORLD_INPUT);
});
