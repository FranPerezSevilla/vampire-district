import { expect, test } from "@playwright/test";

async function waitForMacroCity(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_CITY_STREAM_READY
    && window.NBD_ENTITY_STREAM_READY
    && window.NBD_MACRO_CITY_READY
    && window.NBD_MACRO_CITY
  ));
}

test.describe.configure({ timeout: 75_000 });

test("abstract traffic advances and dormant police wake onto district-local patrols", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForMacroCity(page);

  const macro = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.switchLayer(0, { x: 2080, y: 430 }, "Macro police test east focus.");
    await window.NBD_CITY_STREAM.forceFocus(2080, 430);
    window.NBD_ENTITY_STREAM.resync();
    scene.npcSystem.refreshVisibility();

    const cop = scene.npcSystem.npcs.find(item => item.id === "police_patrol_2");
    const beforeSnapshot = window.NBD_MACRO_CITY.snapshot();
    const before = {
      x: cop.x,
      y: cop.y,
      containerX: cop.container.x,
      containerY: cop.container.y,
      state: cop.streamState
    };
    window.NBD_MACRO_CITY.forceTick(4);
    const afterSnapshot = window.NBD_MACRO_CITY.snapshot();
    const after = {
      x: cop.x,
      y: cop.y,
      containerX: cop.container.x,
      containerY: cop.container.y,
      state: cop.streamState
    };

    return {
      beforeSnapshot,
      afterSnapshot,
      before,
      after,
      modelMoved: before.x !== after.x || before.y !== after.y,
      visualMoved: before.containerX !== after.containerX || before.containerY !== after.containerY,
      currentDistrict: scene.policeSystem.zoneAt(after.x, after.y).id
    };
  });

  expect(macro.before.state).toBe("dormant");
  expect(macro.after.state).toBe("dormant");
  expect(macro.modelMoved).toBe(true);
  expect(macro.visualMoved).toBe(false);
  expect(macro.currentDistrict).toBe("canal-west");
  expect(macro.afterSnapshot.abstractTrafficTokens).toBeGreaterThan(0);
  expect(macro.afterSnapshot.lastAdvancedPoliceIds).toContain("police_patrol_2");
  expect(macro.afterSnapshot.travellingPolice.some(item => item.npcId === "police_patrol_2")).toBe(true);
  expect(macro.afterSnapshot.flows[0].phases).not.toEqual(macro.beforeSnapshot.flows[0].phases);

  const wake = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const original = scene.npcSystem.npcs.find(item => item.id === "police_patrol_2");
    const destination = { x: original.x, y: original.y };
    scene.switchLayer(0, destination, "Macro police wake test.");
    await window.NBD_CITY_STREAM.forceFocus(destination.x, destination.y);
    window.NBD_ENTITY_STREAM.resync();
    scene.npcSystem.refreshVisibility();
    const resolved = scene.npcSystem.npcs.find(item => item.id === "police_patrol_2");
    const target = scene.policeSystem.targetForCop(resolved, 0);
    return {
      sameObject: original === resolved,
      state: resolved.streamState,
      active: resolved.container.active,
      district: scene.policeSystem.zoneAt(resolved.x, resolved.y).id,
      target,
      targetDistrict: scene.policeSystem.zoneAt(target.x, target.y).id
    };
  });

  expect(wake.sameObject).toBe(true);
  expect(wake.state).toBe("active");
  expect(wake.active).toBe(true);
  expect(wake.district).toBe("canal-west");
  expect(wake.target.kind).toBe("patrol");
  expect(wake.target.districtPatrol).toBe(true);
  expect(wake.targetDistrict).toBe("canal-west");
  expect(pageErrors).toEqual([]);
});
