import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/phaser/"];
const STORAGE_KEY = "vampire-district-campaign-v1";
const RESET_SENTINEL = "vampire-district-expanded-urban-reset";

test.describe.configure({ timeout: 120_000 });

async function clearCampaignOnce(page) {
  await page.addInitScript(({ storageKey, sentinel }) => {
    if (window.sessionStorage.getItem(sentinel) === "done") return;
    window.localStorage.removeItem(storageKey);
    window.sessionStorage.setItem(sentinel, "done");
  }, { storageKey: STORAGE_KEY, sentinel: RESET_SENTINEL });
}

async function waitForUrbanRuntime(page) {
  await page.waitForFunction(() => Boolean(
    window.NBD_APP_READY
    && window.NBD_RC_HARNESS_READY
    && window.NBD_VEHICLES_READY
    && window.NBD_PEDESTRIANS_READY
    && window.NBD_STREET_PROPS_READY
  ));
}

for (const route of ROUTES) {
  test(`${route} boots the five-times-larger district with sparse sidewalk-routed population`, async ({ page }) => {
    await clearCampaignOnce(page);
    await page.goto(`${route}?rcTest=1`, { waitUntil: "domcontentloaded" });
    await waitForUrbanRuntime(page);

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
        lights: scene.propDamageSystem.props.length,
        dumpsters: window.NBD_STREET_PROPS.snapshot().dumpsters.length
      };
    });

    expect(state.physics).toEqual({ width: 2400, height: 1440 });
    expect(state.cameraBounds.width).toBeGreaterThanOrEqual(2400);
    expect(state.cameraBounds.height).toBeGreaterThanOrEqual(1440);
    expect(state.gameSize.width).toBeLessThan(2400 * 2);
    expect(state.pedestrians.count).toBeLessThanOrEqual(6);
    expect(state.pedestrians.pedestrians.every(item => item.onPedestrianSurface)).toBe(true);
    expect(state.police).toBe(2);
    expect(state.lights).toBeGreaterThanOrEqual(60);
    expect(state.dumpsters).toBeGreaterThanOrEqual(12);
  });
}

test("a moving vehicle breaks a sidewalk streetlight and persists the damage", async ({ page }) => {
  await clearCampaignOnce(page);
  await page.goto("/?rcTest=1", { waitUntil: "domcontentloaded" });
  await waitForUrbanRuntime(page);

  const result = await page.evaluate(() => {
    window.NBD_RC_HARNESS.unlockPostTutorialWorld();
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const vehicle = scene.vehicleSystem.vehicle("refuge_compact");
    const light = scene.propDamageSystem.props.find(prop => prop.id === "lampCrossA");
    scene.switchLayer(0, { x: light.x - 25, y: light.y }, "Urban test: vehicle approaches sidewalk light.");
    scene.vehicleSystem.enterVehicle(vehicle.id, { force: true });
    vehicle.x = light.x - 24;
    vehicle.y = light.y;
    vehicle.angle = 0;
    vehicle.speed = 72;
    vehicle.container.setPosition(vehicle.x, vehicle.y).setRotation(0);
    const healthBefore = vehicle.health;
    for (let index = 0; index < 12 && !scene.brokenLights.has(light.id); index++) {
      scene.vehicleSystem.updateDriving(0.05, { move: { x: 0, y: 0 } });
    }
    return {
      broken: scene.brokenLights.has(light.id),
      persisted: scene.campaignSystem.state.world.flags[`streetProp.${light.id}.broken`],
      healthBefore,
      healthAfter: vehicle.health
    };
  });

  expect(result.broken).toBe(true);
  expect(result.persisted).toBe(true);
  expect(result.healthAfter).toBeLessThan(result.healthBefore);
});

test("rupturing a dumpster ejects its hidden corpse and survives mission-world synchronization", async ({ page }) => {
  await clearCampaignOnce(page);
  await page.goto("/phaser/?rcTest=1", { waitUntil: "domcontentloaded" });
  await waitForUrbanRuntime(page);

  const result = await page.evaluate(() => {
    window.NBD_RC_HARNESS.unlockPostTutorialWorld();
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const body = scene.npcSystem.npcs.find(npc => npc.id === "exposed_body");
    if (!body.dead) scene.npcSystem.markDead(body, "killed");
    body.hiddenBody = true;
    body.hiddenSpotId = "dumpsterClubRear";
    body.hiddenSpotName = "club rear dumpster";
    body.container.setVisible(false);
    const exposureBefore = scene.exposureSystem.value;
    const broken = window.NBD_STREET_PROPS.impact(
      "refuge_compact",
      "dumpsterClubRear",
      70
    );

    // The mission adapter reconstructs world state each frame. A systemic
    // dumpster rupture must remain authoritative after that synchronization.
    scene.missionSystem.cleanTheSceneSystem.syncWorld();
    const released = scene.streetFurnitureSystem.releasedBodyState(body.id);
    return {
      broken,
      bodyHidden: body.hiddenBody,
      bodyVisible: body.container.visible,
      bodySpot: body.hiddenSpotId,
      exposedAfterContainment: body.exposedAfterContainment,
      released,
      persistedProp: scene.campaignSystem.state.world.flags["body.exposed_body.exposedByStreetProp"],
      ruptureBlood: scene.evidenceSystem.bloodStains
        .filter(stain => stain.kind === "dumpster-rupture").length,
      exposureBefore,
      exposureAfter: scene.exposureSystem.value
    };
  });

  expect(result.broken).toBe(true);
  expect(result.bodyHidden).toBe(false);
  expect(result.bodyVisible).toBe(true);
  expect(result.bodySpot).toBeNull();
  expect(result.exposedAfterContainment).toBe(true);
  expect(result.released).toMatchObject({
    bodyId: "exposed_body",
    streetPropId: "dumpsterClubRear"
  });
  expect(result.persistedProp).toBe("dumpsterClubRear");
  expect(result.ruptureBlood).toBeGreaterThanOrEqual(7);
  expect(result.exposureAfter).toBeGreaterThan(result.exposureBefore);
});

test("a lethal vehicle impact leaves persistent visible blood evidence", async ({ page }) => {
  await clearCampaignOnce(page);
  await page.goto("/?rcTest=1", { waitUntil: "domcontentloaded" });
  await waitForUrbanRuntime(page);

  const result = await page.evaluate(() => {
    window.NBD_RC_HARNESS.unlockPostTutorialWorld();
    const scene = window.NBD_PHASER_GAME.scene.getScene("GameScene");
    const npc = scene.npcSystem.npcs.find(candidate => candidate.id === "civ_cross_1");
    const vehicle = scene.vehicleSystem.vehicle("refuge_compact");
    scene.switchLayer(0, { x: npc.x, y: npc.y }, "Urban test: impact.");
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
