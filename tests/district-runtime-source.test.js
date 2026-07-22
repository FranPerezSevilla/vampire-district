import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
async function source(path) { return readFile(new URL(path, ROOT), "utf8"); }

test("expanded district composes first-class pedestrian, furniture, vehicle and streaming systems", async () => {
  const runtime = await source("phaser/src/runtime/GameplayRuntime.js");
  assert.equal(runtime.includes("new ChunkStreamSystem(scene)"), true);
  assert.equal(runtime.includes("new PedestrianSystem(scene)"), true);
  assert.equal(runtime.includes("new StreetFurnitureSystem(scene, scene.campaignSystem)"), true);
  assert.equal(runtime.includes("new VehicleSystem(scene, scene.campaignSystem)"), true);
  assert.equal(runtime.includes(".prototype"), false);
});

test("GameScene separates world size from viewport and renders active city chunks by sectors", async () => {
  const main = await source("phaser/src/main.js");
  const scene = await source("phaser/src/scenes/GameScene.js");
  assert.equal(main.includes("WORLD.viewportWidth"), true);
  assert.equal(main.includes("WORLD.viewportHeight"), true);
  assert.equal(main.includes("WORLD.width * renderScale"), false);
  assert.ok(scene.indexOf("this.drawSidewalkNetwork()") < scene.indexOf('this.chunkItems("buildings"'));
  assert.equal(scene.includes("this.drawCrosswalkNetwork()"), true);
  assert.equal(scene.includes("URBAN_RENDER_SECTOR_WIDTH"), true);
  assert.equal(scene.includes("calculateUrbanRenderBounds"), true);
  assert.equal(scene.includes("clippedRect"), true);
  assert.equal(scene.includes("LIGHT_GLOW_LIMIT"), true);
  assert.equal(scene.includes('this.cityStreamSystem.query("buildings"'), true);
  assert.equal(scene.includes('this.chunkItems("roads"'), true);
  assert.equal(scene.includes("fillRect(0, 0, WORLD.width, WORLD.height)"), false);
});

test("vehicle movement resolves furniture first and queries local buildings through city streaming", async () => {
  const driving = await source("phaser/src/vehicles/VehicleDriving.js");
  const furnitureIndex = driving.indexOf("const furniture =");
  const buildingIndex = driving.indexOf("else if (canVehicleOccupy", furnitureIndex);
  assert.ok(furnitureIndex >= 0);
  assert.ok(buildingIndex > furnitureIndex);
  assert.equal(driving.includes('cityStreamSystem?.query?.("buildings"'), true);
  assert.equal(driving.includes("const nearbyBuildings ="), true);
});

test("hidden-body container identity survives checkpoints and can be exposed by a ruptured dumpster", async () => {
  const evidence = await source("phaser/src/systems/EvidenceSystem.js");
  const checkpoint = await source("phaser/src/campaign/CampaignCheckpointSystem.js");
  const cleanup = await source("phaser/src/campaign/CleanTheSceneSystem.js");
  const furnitureFacade = await source("phaser/src/systems/StreetFurnitureSystem.js");
  const furnitureCore = await source("phaser/src/systems/StreetFurnitureSystemCore.js");
  assert.equal(evidence.includes("hiddenSpotId"), true);
  assert.equal(evidence.includes("clearReleasedBody"), true);
  assert.equal(evidence.includes("updateReleasedBodyPosition"), true);
  assert.equal(checkpoint.includes("hiddenSpotId"), true);
  assert.equal(cleanup.includes("restoreReleasedBodies"), true);
  assert.equal(cleanup.includes("wasDragging"), true);
  assert.equal(furnitureFacade.includes("StreetFurnitureSystemCore"), true);
  assert.equal(furnitureFacade.includes("exposedByStreetProp"), true);
  assert.equal(furnitureCore.includes("releaseHiddenBody"), true);
  assert.equal(furnitureCore.includes("dumpster-rupture"), true);
});

test("expanded police baseline is sparse and reinforcements use separated district approaches", async () => {
  const police = await source("phaser/src/systems/PoliceSystem.js");
  assert.equal(police.includes("0: 2"), true);
  assert.equal(police.includes("1: 3"), true);
  assert.equal(police.includes("DISTRICT_ENTRY_POINTS"), true);
});
