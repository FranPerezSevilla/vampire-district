import { expect, test } from "@playwright/test";

async function waitForEntityStreaming(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_CITY_STREAM_READY
    && window.NBD_ENTITY_STREAM_READY
    && window.NBD_ENTITY_STREAM
  ));
}

test.describe.configure({ timeout: 90_000 });

test("ordinary and retired actors sleep across the 10 by 8 city while live police state remains pinned", async ({ page }) => {
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForEntityStreaming(page);

  const result = await page.evaluate(async () => {
    const district = await import("/phaser/src/data/district.js");
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const npc = id => scene.npcSystem.npcs.find(item => item.id === id);
    const vehicle = id => scene.vehicleSystem.vehicles.find(item => item.id === id);

    scene.switchLayer(0, district.CITY_ANCHORS.streetSpawn, "Entity stream Old Quarter.");
    await window.NBD_CITY_STREAM.forceFocus(
      district.CITY_ANCHORS.streetSpawn.x,
      district.CITY_ANCHORS.streetSpawn.y
    );
    window.NBD_ENTITY_STREAM.resync();
    scene.npcSystem.refreshVisibility();
    scene.vehicleSystem.refreshVisibility();
    const west = {
      coreCivilian: window.NBD_ENTITY_STREAM.stateOf("civ_cross_1"),
      harborCivilian: window.NBD_ENTITY_STREAM.stateOf("civ_harbor_1"),
      retiredJournalist: window.NBD_ENTITY_STREAM.stateOf("journalist"),
      refugeCar: window.NBD_ENTITY_STREAM.stateOf("refuge_compact"),
      foundryCar: window.NBD_ENTITY_STREAM.stateOf("foundry:vehicle:utility"),
      journalistVisible: npc("journalist").container.visible,
      spatialCount: scene.npcSystem.spatial.size(),
      totalNpcCount: scene.npcSystem.npcs.length
    };

    scene.switchLayer(0, district.CITY_ANCHORS.harborFar, "Entity stream harbor.");
    await window.NBD_CITY_STREAM.forceFocus(
      district.CITY_ANCHORS.harborFar.x,
      district.CITY_ANCHORS.harborFar.y,
      700,
      0
    );
    window.NBD_ENTITY_STREAM.resync();
    scene.npcSystem.refreshVisibility();
    scene.vehicleSystem.refreshVisibility();
    const east = {
      coreCivilian: window.NBD_ENTITY_STREAM.stateOf("civ_cross_1"),
      harborCivilian: window.NBD_ENTITY_STREAM.stateOf("civ_harbor_1"),
      retiredJournalist: window.NBD_ENTITY_STREAM.stateOf("journalist"),
      refugeCar: window.NBD_ENTITY_STREAM.stateOf("refuge_compact"),
      foundryCar: window.NBD_ENTITY_STREAM.stateOf("foundry:vehicle:utility"),
      harborActive: npc("civ_harbor_1").container.active,
      journalistVisible: npc("journalist").container.visible,
      refugeCarVisible: vehicle("refuge_compact").container.visible,
      spatialCount: scene.npcSystem.spatial.size(),
      totalNpcCount: scene.npcSystem.npcs.length
    };

    const cop = npc("police_patrol_2");
    const copStateBefore = window.NBD_ENTITY_STREAM.stateOf(cop.id);
    cop.investigateTarget = { x: scene.player.x, y: scene.player.y, kind: "heat", zoneId: "harbor-north" };
    window.NBD_ENTITY_STREAM.resync();
    scene.npcSystem.rebuildSpatialIndex();
    const copStateDuring = window.NBD_ENTITY_STREAM.stateOf(cop.id);
    const copIndexedWhilePinned = scene.npcSystem.spatial.entities.has(cop);
    cop.investigateTarget = null;
    window.NBD_ENTITY_STREAM.resync();

    return { west, east, copStateBefore, copStateDuring, copIndexedWhilePinned };
  });

  expect(result.west.coreCivilian).toBe("active");
  expect(result.west.harborCivilian).toBe("dormant");
  expect(result.west.retiredJournalist).toBe("active");
  expect(result.west.journalistVisible).toBe(false);
  expect(result.west.refugeCar).toBe("active");
  expect(result.west.foundryCar).toBe("dormant");
  expect(result.west.spatialCount).toBeLessThan(result.west.totalNpcCount);

  expect(result.east.coreCivilian).toBe("dormant");
  expect(result.east.harborCivilian).toBe("active");
  expect(result.east.retiredJournalist).toBe("dormant");
  expect(result.east.journalistVisible).toBe(false);
  expect(result.east.refugeCar).toBe("dormant");
  expect(result.east.foundryCar).toBe("dormant");
  expect(result.east.harborActive).toBe(true);
  expect(result.east.refugeCarVisible).toBe(false);
  expect(result.east.spatialCount).toBeLessThan(result.east.totalNpcCount);

  expect(result.copStateBefore).toBe("dormant");
  expect(result.copStateDuring).toBe("pinned");
  expect(result.copIndexedWhilePinned).toBe(true);
});
