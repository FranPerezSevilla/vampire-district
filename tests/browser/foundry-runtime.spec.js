import { expect, test } from "@playwright/test";

async function waitForFoundryRuntime(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_VEHICLES_READY
    && window.NBD_STREET_PROPS_READY
    && window.NBD_SCENARIOS?.snapshot?.().activeId === "urban-explore"
  ));
}

test.describe.configure({ timeout: 90_000 });

test("the relocated Foundry remains playable across street, roof and sewer layers", async ({ page }) => {
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForFoundryRuntime(page);

  const result = await page.evaluate(async () => {
    const district = await import("/phaser/src/data/district.js");
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const vehicle = scene.vehicleSystem.vehicle("foundry:vehicle:utility");
    const generated = item => String(item?.id || "").startsWith("foundry:");
    const generatedRoadIds = new Set(
      district.roads.flatMap(road => road.sourceRoadIds || [])
        .filter(id => String(id).startsWith("foundry:"))
    );

    const drivable = [
      { x: 1900, y: 2212, angle: 0 },
      { x: 1680, y: 2392, angle: Math.PI / 2 },
      { x: 1900, y: 2572, angle: 0 },
      { x: 2340, y: 2392, angle: Math.PI / 2 }
    ].map(point => scene.vehicleSystem.canOccupy(vehicle, point.x, point.y, point.angle));

    scene.switchLayer(0, { x: 1360, y: 2450 }, "Foundry west fire escape.");
    const streetInteractions = scene.collectInteractions().map(item => item.id);
    scene.switchLayer(1, { x: 1386, y: 2450 }, "Foundry west roof.");
    const roofEntryInteractions = scene.collectInteractions().map(item => item.id);
    scene.switchLayer(1, { x: 1634, y: 2450 }, "Foundry west-east jump.");
    const roofJumpInteractions = scene.collectInteractions().map(item => item.id);
    const roofStandable = [
      { x: 1500, y: 2450 },
      { x: 1890, y: 2450 },
      { x: 1890, y: 2680 },
      { x: 1500, y: 2680 }
    ].map(point => scene.canStandAt(point.x, point.y));

    scene.switchLayer(0, { x: 1680, y: 2100 }, "Foundry north sewer.");
    const sewerStreetInteractions = scene.collectInteractions().map(item => item.id);
    scene.switchLayer(-1, { x: 1680, y: 2100 }, "Foundry sewer.");
    const sewerInteractions = scene.collectInteractions().map(item => item.id);

    return {
      selected: district.SELECTED_CITY_CANDIDATE,
      generatedRoads: generatedRoadIds.size,
      generatedBuildings: district.buildings.filter(generated).length,
      generatedRoofs: Object.values(district.roofAreas).flat().filter(generated).length,
      foundryStreet: district.CITY_ANCHORS.foundryStreet,
      vehicle: vehicle ? { id: vehicle.id, archetypeId: vehicle.archetypeId, x: vehicle.x, y: vehicle.y } : null,
      drivable,
      streetInteractions,
      roofEntryInteractions,
      roofJumpInteractions,
      roofStandable,
      sewerStreetInteractions,
      sewerInteractions
    };
  });

  expect(result.selected).toBe("city-topology-v2-site-first");
  expect(result.generatedRoads).toBe(1);
  expect(result.generatedBuildings).toBe(7);
  expect(result.generatedRoofs).toBe(4);
  expect(result.foundryStreet).toMatchObject({ x: 2010, y: 2212 });
  expect(result.vehicle).toMatchObject({ id: "foundry:vehicle:utility", archetypeId: "sedan", x: 1900, y: 2212 });
  expect(result.drivable.every(Boolean)).toBe(true);
  expect(result.streetInteractions).toContain("foundry:fire-escape:west_up");
  expect(result.roofEntryInteractions).toContain("foundry:fire-escape:west_down");
  expect(result.roofJumpInteractions).toContain("foundry:roof-route:west-east_a_to_b");
  expect(result.roofStandable.every(Boolean)).toBe(true);
  expect(result.sewerStreetInteractions).toContain("foundry:sewer-access:north_down");
  expect(result.sewerInteractions).toContain("foundry:sewer-access:north_up");
});
