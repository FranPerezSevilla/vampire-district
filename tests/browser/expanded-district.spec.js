import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/phaser/"];
const PEDESTRIANS_PER_ROUTE = 6;

test.describe.configure({ timeout: 75_000 });

async function waitForUrbanRuntime(page, scenarioId) {
  await page.waitForFunction(expected => Boolean(
    window.NBD_APP_READY
    && window.NBD_SCENARIO_READY
    && window.NBD_VEHICLES_READY
    && window.NBD_PEDESTRIANS_READY
    && window.NBD_STREET_PROPS_READY
    && window.NBD_SCENARIOS?.snapshot?.().activeId === expected
  ), scenarioId);
}

for (const route of ROUTES) {
  test(`${route} boots the five-times-area City Topology V2 district with distributed sidewalk-routed population`, async ({ page }) => {
    await page.goto(`${route}?testScenario=urban-explore`, { waitUntil: "domcontentloaded" });
    await waitForUrbanRuntime(page, "urban-explore");

    const state = await page.evaluate(() => {
      const game = window.NBD_PHASER_GAME;
      const scene = game.scene.getScene("GameScene");
      const pedestrians = window.NBD_PEDESTRIANS.snapshot();
      const bounds = scene.cameras.main._bounds;
      return {
        physics: {
          width: scene.physics.world.bounds.width,
          height: scene.physics.world.bounds.height
        },
        cameraBounds: {
          width: bounds?.width,
          height: bounds?.height
        },
        gameSize: {
          width: game.scale.gameSize.width,
          height: game.scale.gameSize.height
        },
        pedestrians,
        police: scene.policeSystem.police().length,
        retiredLightProps: scene.propDamageSystem.props.length,
        dumpsters: window.NBD_STREET_PROPS.snapshot().dumpsters.length,
        activeMissionId: scene.campaignSystem.state.missions.activeMissionId,
        tutorialState: scene.tutorialDirector.state
      };
    });

    expect(state.physics).toEqual({ width: 4800, height: 3600 });
    expect(state.cameraBounds.width).toBeGreaterThanOrEqual(4800);
    expect(state.cameraBounds.height).toBeGreaterThanOrEqual(3600);
    expect(state.gameSize.width).toBeLessThan(4800 * 2);
    expect(state.pedestrians.count).toBeGreaterThanOrEqual(30);
    // The authored population scales with route coverage; a fixed city-wide ceiling
    // becomes stale whenever the pedestrian network grows.
    expect(state.pedestrians.count).toBe(
      state.pedestrians.routes.length * PEDESTRIANS_PER_ROUTE
    );
    expect(state.pedestrians.pedestrians.every(item => item.onPedestrianSurface)).toBe(true);
    expect(state.police).toBe(2);
    expect(state.retiredLightProps).toBe(0);
    expect(state.dumpsters).toBeGreaterThanOrEqual(12);
    expect(state.activeMissionId).toBeNull();
    expect(state.tutorialState).toBe("complete");
  });
}

test("streetlight authority stays retired while streamed dumpsters remain active", async ({ page }) => {
  await page.goto("/?testScenario=street-damage", { waitUntil: "domcontentloaded" });
  await waitForUrbanRuntime(page, "street-damage");

  const result = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const streetProps = window.NBD_STREET_PROPS.snapshot();
    return {
      lightProps: scene.propDamageSystem?.props?.length || 0,
      brokenLights: scene.brokenLights?.size || 0,
      currentLight: scene.currentLight?.() || null,
      currentShadow: scene.currentShadowAt?.(scene.player.x, scene.player.y, 0) || null,
      dumpsters: streetProps.dumpsters.length
    };
  });

  expect(result.lightProps).toBe(0);
  expect(result.brokenLights).toBe(0);
  expect(result.currentLight).toBeNull();
  expect(result.currentShadow).toBeNull();
  expect(result.dumpsters).toBeGreaterThanOrEqual(12);
});

test("a dumpster corpse stays exposed, can be dragged, and can be recontained without a mission adapter", async ({ page }) => {
  await page.goto("/phaser/?testScenario=street-damage", { waitUntil: "domcontentloaded" });
  await waitForUrbanRuntime(page, "street-damage");

  const result = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const body = scene.npcSystem.npcs.find(npc => npc.id === "exposed_body");
    if (!body.dead) scene.npcSystem.markDead(body, "killed");
    body.inactive = false;
    body.hiddenBody = true;
    body.hiddenSpotId = "dumpsterClubRear";
    body.hiddenSpotName = "club rear dumpster";
    body.container.setVisible(false);
    const bodyEvidence = scene.exposureSystem.registerEvidence({
      kind: "drained_body",
      x: body.x,
      y: body.y,
      layer: body.layer,
      sourceEvent: "browser-dumpster-rupture",
      subjectId: body.id,
      exposureWeight: 26,
      knowledgeState: "latent",
      reason: "A hidden drained body remains physically present."
    });
    body.exposureEvidenceIds = [bodyEvidence.id];
    const exposureBefore = scene.exposureSystem.value;
    const broken = window.NBD_STREET_PROPS.impact(
      "refuge_compact",
      "dumpsterClubRear",
      70
    );

    const exposedAfterImpact = {
      hidden: body.hiddenBody,
      visible: body.container.visible,
      spot: body.hiddenSpotId,
      persistedProp: scene.campaignSystem.state.world.flags["body.exposed_body.exposedByStreetProp"]
    };

    scene.evidenceSystem.grabBody(body);
    scene.player.setPosition(body.x + 48, body.y + 18);
    scene.evidenceSystem.updateDraggedBody(0);
    const draggedPosition = { x: body.x, y: body.y, layer: body.layer };
    const draggingState = {
      active: scene.evidenceSystem.draggingBody === body && body.dragged,
      x: body.x,
      y: body.y,
      layer: body.layer
    };

    const replacement = scene.streetFurnitureSystem.dumpster("dumpsterChurchRear");
    scene.player.setPosition(replacement.x, replacement.y);
    scene.evidenceSystem.updateDraggedBody(0);
    scene.evidenceSystem.hideDraggedBody({
      ...replacement,
      streetPropId: replacement.id,
      cleanRadius: replacement.cleanRadius || 90
    });

    return {
      broken,
      exposedAfterImpact,
      draggedPosition,
      draggingState,
      recontained: {
        hidden: body.hiddenBody,
        spot: body.hiddenSpotId,
        releasedState: scene.streetFurnitureSystem.releasedBodyState(body.id),
        persistedProp: scene.campaignSystem.state.world.flags["body.exposed_body.exposedByStreetProp"] || null
      },
      ruptureBlood: scene.evidenceSystem.bloodStains
        .filter(stain => stain.kind === "dumpster-rupture").length,
      exposureBefore,
      exposureAfter: scene.exposureSystem.value
    };
  });

  expect(result.broken).toBe(true);
  expect(result.exposedAfterImpact).toEqual({
    hidden: false,
    visible: true,
    spot: null,
    persistedProp: "dumpsterClubRear"
  });
  expect(result.draggingState.active).toBe(true);
  expect(result.draggingState).toMatchObject(result.draggedPosition);
  expect(result.recontained.hidden).toBe(true);
  expect(result.recontained.spot).toBe("dumpsterChurchRear");
  expect(result.recontained.releasedState).toBeNull();
  expect(result.recontained.persistedProp).toBeNull();
  expect(result.ruptureBlood).toBeGreaterThanOrEqual(7);
  expect(result.exposureAfter).toBe(result.exposureBefore);
});

test("a lethal vehicle impact leaves persistent visible blood evidence", async ({ page }) => {
  await page.goto("/?testScenario=street-damage", { waitUntil: "domcontentloaded" });
  await waitForUrbanRuntime(page, "street-damage");

  const result = await page.evaluate(() => {
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const npc = scene.npcSystem.npcs.find(candidate => candidate.id === "civ_cross_1");
    const vehicle = scene.vehicleSystem.vehicle("refuge_compact");
    scene.switchLayer(LAYERS.STREET, { x: npc.x, y: npc.y }, "Urban test: impact.");
    scene.vehicleSystem.enterVehicle(vehicle.id, { force: true });
    vehicle.x = npc.x;
    vehicle.y = npc.y;
    vehicle.speed = 100;
    vehicle.angle = 0;
    vehicle.container.setPosition(vehicle.x, vehicle.y);
    scene.npcSystem.rebuildSpatialIndex();
    scene.vehicleSystem.updateDriving(0, { move: { x: 0, y: 0 } });
    return {
      dead: npc.dead,
      kind: npc.deathKind,
      blood: scene.evidenceSystem.bloodStains
        .filter(stain => stain.kind === "vehicle-fatal").length
    };
  });

  expect(result.dead).toBe(true);
  expect(result.kind).toBe("killed");
  expect(result.blood).toBeGreaterThanOrEqual(8);
});
