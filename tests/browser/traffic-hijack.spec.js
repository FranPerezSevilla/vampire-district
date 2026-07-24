import { expect, test } from "@playwright/test";

async function waitForTraffic(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_CITY_STREAM_READY
    && window.NBD_TRAFFIC_READY
    && window.NBD_TRAFFIC
  ));
}

test.describe.configure({ timeout: 90_000 });

test("civilian traffic spawns off camera, can be hijacked and ejects bounded WTF occupants", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForTraffic(page);

  const result = await page.evaluate(async () => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const focus = { x: 1140, y: 960 };

    scene.switchLayer(1, focus, "Clear traffic assignments before spawn-policy test.");
    window.NBD_TRAFFIC.resync();
    scene.switchLayer(0, focus, "Off-camera traffic spawn-policy test.");
    await window.NBD_CITY_STREAM.forceFocus(focus.x, focus.y);
    window.NBD_TRAFFIC.resync();

    const spawned = window.NBD_TRAFFIC.snapshot();
    const selected = spawned.materialized[0];
    if (!selected) return { missing: true, spawned };
    const slot = scene.trafficMaterializationSystem.pool[selected.slotIndex];

    scene.player.setPosition(slot.x, slot.y);
    scene.cameras.main.centerOn(slot.x, slot.y);
    await window.NBD_CITY_STREAM.forceFocus(slot.x, slot.y);
    window.NBD_TRAFFIC.resync();
    const retainedBeforeTheft = window.NBD_TRAFFIC.snapshot().materialized.find(item => item.tokenId === selected.tokenId);
    const interaction = scene.trafficMaterializationSystem.collectInteractions()
      .find(option => option.id === `steal_${selected.tokenId}`);
    const hijacked = interaction?.run?.() || false;

    const vehicle = scene.vehicleSystem.currentVehicle();
    const occupants = scene.npcSystem.npcs.filter(npc => npc.transientTrafficOccupant && npc.sourceVehicleId === vehicle?.id);
    const afterTheft = window.NBD_TRAFFIC.snapshot();
    const occupantState = occupants.map(npc => ({
      id: npc.id,
      visible: npc.container.visible,
      wtfVisible: Boolean(npc.__nbdWtfLabel?.visible),
      reactionTimer: npc.soundReactionTimer,
      intent: npc.ai?.intent || null
    }));

    scene.vehicleSystem.exitVehicle({ force: true });
    const police = scene.vehicleSystem.vehicles.find(candidate => candidate.ownership === "police");
    scene.player.setPosition(police.x, police.y);
    const policeCanEnter = scene.vehicleSystem.canEnter(police);
    const policeForcedEntry = scene.vehicleSystem.enterVehicle(police.id, { force: true });
    const policeInteraction = scene.vehicleSystem.collectInteractions().some(option => option.target?.id === police.id);

    for (let index = 0; index < 9; index++) {
      scene.vehicleSystem.addTransientVehicle({
        id: `traffic-cap-test-${index}`,
        name: `Traffic cap test ${index}`,
        archetypeId: "compact",
        x: 3000 + index * 40,
        y: 3000,
        angle: 0,
        ownership: "parked",
        parked: true,
        layer: 0,
        transient: true
      });
    }
    scene.vehicleSystem.pruneTransientVehicles(6);
    const transientVehicles = scene.vehicleSystem.vehicles.filter(candidate => candidate.transient);

    return {
      missing: false,
      spawned,
      allSpawnedOffCamera: spawned.materialized.every(item => item.insideCamera === false),
      retainedBeforeTheft: Boolean(retainedBeforeTheft),
      hijacked,
      currentVehicle: vehicle ? {
        id: vehicle.id,
        transient: vehicle.transient,
        status: vehicle.status,
        archetypeId: vehicle.archetypeId
      } : null,
      sourceTokenStillMaterialized: afterTheft.materialized.some(item => item.tokenId === selected.tokenId),
      occupants: occupantState,
      policeCanEnter,
      policeForcedEntry,
      policeInteraction,
      transientVehicleCount: transientVehicles.length,
      transientCap: 6,
      actionText: scene.lastActionText
    };
  });

  expect(result.missing).toBe(false);
  expect(result.spawned.materializedCount).toBeGreaterThan(0);
  expect(result.spawned.materializedCount).toBeLessThanOrEqual(result.spawned.maxActiveVehicles);
  expect(result.allSpawnedOffCamera).toBe(true);
  expect(result.retainedBeforeTheft).toBe(true);
  expect(result.hijacked).toBe(true);
  expect(result.currentVehicle).toMatchObject({ transient: true, status: "stolen" });
  expect(result.sourceTokenStillMaterialized).toBe(false);
  expect(result.occupants.length).toBeGreaterThanOrEqual(1);
  expect(result.occupants.length).toBeLessThanOrEqual(2);
  expect(result.occupants.every(occupant => occupant.wtfVisible && occupant.reactionTimer > 0 && occupant.intent === "carjacked-wtf")).toBe(true);
  expect(result.policeCanEnter).toBe(false);
  expect(result.policeForcedEntry).toBe(false);
  expect(result.policeInteraction).toBe(false);
  expect(result.transientVehicleCount).toBeLessThanOrEqual(result.transientCap);
  expect(result.actionText).toContain("Police vehicles cannot be stolen");
  expect(pageErrors).toEqual([]);
});
