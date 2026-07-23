import { expect, test } from "@playwright/test";

async function waitForStreamingResources(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_CITY_STREAM
    && window.NBD_DISTRICT_PACKS
    && window.NBD_DISTANT_SIM
    && window.NBD_ENTITY_STREAM
  ));
}

test.describe.configure({ timeout: 90_000 });

test("district packs follow the hospital-to-Foundry focus while dormant pedestrians advance only in macro state", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForStreamingResources(page);

  await page.evaluate(async () => {
    const district = await import("/phaser/src/data/district.js");
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.switchLayer(0, district.CITY_ANCHORS.hospitalEntrance, "District pack hospital test.");
    await window.NBD_CITY_STREAM.forceFocus(
      district.CITY_ANCHORS.hospitalEntrance.x,
      district.CITY_ANCHORS.hospitalEntrance.y
    );
    window.NBD_ENTITY_STREAM.resync();
    await window.NBD_DISTRICT_PACKS.forceUpdate();
  });

  const west = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const pedestrian = scene.npcSystem.npcs.find(item => item.id === "civ_harbor_1");
    if (!pedestrian) throw new Error("The streamed harbor pedestrian was not created.");
    const before = {
      x: pedestrian.x,
      y: pedestrian.y,
      containerX: pedestrian.container.x,
      containerY: pedestrian.container.y,
      streamState: pedestrian.streamState
    };
    const advanced = window.NBD_DISTANT_SIM.forceTick(5);
    const pedestrianChunkId = window.NBD_CITY_STREAM.chunkIdAt(pedestrian.x, pedestrian.y);
    return {
      pack: window.NBD_DISTRICT_PACKS.snapshot(),
      macro: window.NBD_DISTANT_SIM.snapshot(),
      advanced,
      pedestrianChunkId,
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

  expect(west.pack.activePackId).toBe("hospital-district");
  expect(west.pack.activeProfile.name).toBe("Hospital Ward");
  expect(west.pack.states.resident).toContain("hospital-district");
  expect(west.pedestrian.before.streamState).toBe("dormant");
  expect(west.advanced).toBeGreaterThan(0);
  expect(
    west.pedestrian.after.x !== west.pedestrian.before.x
      || west.pedestrian.after.y !== west.pedestrian.before.y
  ).toBe(true);
  expect(west.pedestrian.after.containerX).toBe(west.pedestrian.before.containerX);
  expect(west.pedestrian.after.containerY).toBe(west.pedestrian.before.containerY);
  expect(west.macro.tick).toBeGreaterThan(0);
  expect(west.pedestrianChunkId).toBeTruthy();
  expect(west.macro.byChunk[west.pedestrianChunkId]?.dormantNpcs).toBeGreaterThan(0);

  await page.evaluate(async () => {
    const district = await import("/phaser/src/data/district.js");
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    scene.switchLayer(0, district.CITY_ANCHORS.foundryStreet, "District pack Foundry test.");
    await window.NBD_CITY_STREAM.forceFocus(
      district.CITY_ANCHORS.foundryStreet.x,
      district.CITY_ANCHORS.foundryStreet.y,
      500,
      0
    );
    window.NBD_ENTITY_STREAM.resync();
    await window.NBD_DISTRICT_PACKS.forceUpdate();
  });

  const east = await page.evaluate(() => ({
    pack: window.NBD_DISTRICT_PACKS.snapshot(),
    registryProfile: window.NBD_PHASER_GAME.registry.get("districtPackProfile")
  }));

  expect(east.pack.activePackId).toBe("foundry");
  expect(east.pack.activeProfile.name).toBe("Foundry Ward");
  expect(east.pack.activeProfile.audio.ambientId).toBe("foundry-night");
  expect(east.registryProfile.id).toBe("foundry");
  expect(east.pack.stats.packRequests).toBeGreaterThan(0);
  expect(east.pack.activationBudget).toBe(1);
  expect(pageErrors).toEqual([]);
});
