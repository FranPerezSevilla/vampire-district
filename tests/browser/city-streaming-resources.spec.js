import { expect, test } from "@playwright/test";

async function waitForStreamingResources(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_CITY_STREAM_READY
    && window.NBD_DISTRICT_PACKS_READY
    && window.NBD_DISTANT_SIM_READY
    && window.NBD_DISTRICT_PACKS
    && window.NBD_DISTANT_SIM
  ));
}

test.describe.configure({ timeout: 75_000 });

test("district packs follow the focus while dormant pedestrians advance only in macro state", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForStreamingResources(page);

  const west = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.switchLayer(0, { x: 100, y: 100 }, "District pack west test.");
    await window.NBD_CITY_STREAM.forceFocus(100, 100);
    window.NBD_ENTITY_STREAM.resync();
    window.NBD_DISTRICT_PACKS.forceUpdate();
    const pedestrian = scene.npcSystem.npcs.find(item => item.id === "civ_harbor_1");
    const before = {
      x: pedestrian.x,
      y: pedestrian.y,
      containerX: pedestrian.container.x,
      containerY: pedestrian.container.y,
      streamState: pedestrian.streamState
    };
    const advanced = window.NBD_DISTANT_SIM.forceTick(5);
    return {
      pack: window.NBD_DISTRICT_PACKS.snapshot(),
      macro: window.NBD_DISTANT_SIM.snapshot(),
      advanced,
      pedestrian: {
        before,
        after: {
          x: pedestrian.x,
          y: pedestrian.y,
          containerX: pedestrian.container.x,
          containerY: pedestrian.container.y,
          streamState: pedestrian.streamState
        }
      }
    };
  });

  expect(west.pack.activePackId).toBe("old-quarter");
  expect(west.pack.activeProfile.name).toBe("Old Quarter");
  expect(west.pack.states.resident).toContain("old-quarter");
  expect(west.pedestrian.before.streamState).toBe("dormant");
  expect(west.advanced).toBeGreaterThan(0);
  expect(
    west.pedestrian.after.x !== west.pedestrian.before.x
      || west.pedestrian.after.y !== west.pedestrian.before.y
  ).toBe(true);
  expect(west.pedestrian.after.containerX).toBe(west.pedestrian.before.containerX);
  expect(west.pedestrian.after.containerY).toBe(west.pedestrian.before.containerY);
  expect(west.macro.tick).toBeGreaterThan(0);
  expect(west.macro.byChunk["4:0"].dormantNpcs).toBeGreaterThan(0);

  await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.switchLayer(0, { x: 1800, y: 430 }, "District pack Foundry test.");
    await window.NBD_CITY_STREAM.forceFocus(1800, 430, 500, 0);
    window.NBD_ENTITY_STREAM.resync();
    window.NBD_DISTRICT_PACKS.forceUpdate();
  });
  await page.waitForFunction(() => {
    const snapshot = window.NBD_DISTRICT_PACKS?.snapshot?.();
    return snapshot?.activePackId === "foundry"
      && snapshot?.states?.resident?.includes?.("foundry");
  });

  const east = await page.evaluate(() => ({
    pack: window.NBD_DISTRICT_PACKS.snapshot(),
    macro: window.NBD_DISTANT_SIM.snapshot(),
    registryProfile: window.NBD_PHASER_GAME.registry.get("districtPackProfile")
  }));

  expect(east.pack.activePackId).toBe("foundry");
  expect(east.pack.activeProfile.name).toBe("Foundry Ward");
  expect(east.pack.activeProfile.audio.ambientId).toBe("foundry-night-shift");
  expect(east.registryProfile.id).toBe("foundry");
  expect(east.pack.stats.packRequests).toBeGreaterThan(0);
  expect(east.pack.activationBudget).toBe(1);
  expect(pageErrors).toEqual([]);
});
