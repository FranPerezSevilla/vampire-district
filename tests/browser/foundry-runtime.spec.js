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

test.describe.configure({ timeout: 75_000 });

test("foundry-pilot-04 is playable across street, roof and sewer layers", async ({ page }) => {
  await page.goto("/?testScenario=urban-explore", { waitUntil: "domcontentloaded" });
  await waitForFoundryRuntime(page);

  const result = await page.evaluate(async () => {
    const district = await import("/phaser/src/data/district.js");
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const vehicle = scene.vehicleSystem.vehicle("foundry:vehicle:utility");
    const generated = item => String(item?.id || "").startsWith("foundry:");

    const westLoop = [
      { x: 1688, y: 123, angle: Math.PI / 2 },
      { x: 1860, y: 198, angle: 0 },
      { x: 1948, y: 184, angle: Math.PI / 2 },
      { x: 1860, y: 123, angle: 0 }
    ];
    const eastLoop = [
      { x: 1948, y: 265, angle: Math.PI / 2 },
      { x: 2080, y: 265, angle: 0 },
      { x: 2240, y: 265, angle: Math.PI / 2 },
      { x: 2080, y: 338, angle: 0 }
    ];
    const drivable = [...westLoop, ...eastLoop].map(point => scene.vehicleSystem.canOccupy(
      vehicle,
      point.x,
      point.y,
      point.angle
    ));

    scene.switchLayer(0, { x: 1754, y: 443 }, "Foundry integration: west fire escape.");
    const streetInteractions = scene.collectInteractions().map(item => item.id);
    scene.switchLayer(1, { x: 1768, y: 443 }, "Foundry integration: west roof.");
    const roofEntryInteractions = scene.collectInteractions().map(item => item.id);
    scene.switchLayer(1, { x: 1898, y: 443 }, "Foundry integration: west-east jump.");
    const roofJumpInteractions = scene.collectInteractions().map(item => item.id);
    const roofStandable = [
      { x: 1768, y: 443 },
      { x: 2075, y: 443 },
      { x: 2075, y: 624 },
      { x: 1800, y: 624 }
    ].map(point => scene.canStandAt(point.x, point.y));

    scene.switchLayer(0, { x: 1688, y: 198 }, "Foundry integration: north sewer access.");
    const sewerStreetInteractions = scene.collectInteractions().map(item => item.id);
    scene.switchLayer(-1, { x: 1688, y: 198 }, "Foundry integration: sewer.");
    const sewerInteractions = scene.collectInteractions().map(item => item.id);

    return {
      selected: district.SELECTED_CITY_CANDIDATE,
      generatedRoads: district.roads.filter(generated).length,
      generatedBuildings: district.buildings.filter(generated).length,
      generatedRoofs: Object.values(district.roofAreas).flat().filter(generated).length,
      generatedLights: scene.propDamageSystem.props.filter(generated).length,
      generatedDumpsters: window.NBD_STREET_PROPS.snapshot().dumpsters.filter(generated).length,
      generatedPedestrianRoutes: district.pedestrianRoutes.filter(generated).length,
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

  expect(result.selected).toBe("foundry-pilot-04");
  expect(result.generatedRoads).toBe(3);
  expect(result.generatedBuildings).toBe(5);
  expect(result.generatedRoofs).toBe(4);
  expect(result.generatedLights).toBe(8);
  expect(result.generatedDumpsters).toBe(4);
  expect(result.generatedPedestrianRoutes).toBe(1);
  expect(result.vehicle).toMatchObject({ id: "foundry:vehicle:utility", archetypeId: "sedan", x: 1812, y: 338 });
  expect(result.drivable.every(Boolean)).toBe(true);
  expect(result.streetInteractions).toContain("foundry:fire-escape:west_up");
  expect(result.roofEntryInteractions).toContain("foundry:fire-escape:west_down");
  expect(result.roofJumpInteractions).toContain("foundry:roof-route:west-east_a_to_b");
  expect(result.roofStandable.every(Boolean)).toBe(true);
  expect(result.sewerStreetInteractions).toContain("foundry:sewer-access:north_down");
  expect(result.sewerInteractions).toContain("foundry:sewer-access:north_up");
});
