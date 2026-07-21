import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
async function source(path) { return readFile(new URL(path, ROOT), "utf8"); }

test("expanded district composes first-class pedestrian and street-furniture systems", async () => {
  const runtime = await source("phaser/src/runtime/GameplayRuntime.js");
  assert.equal(runtime.includes("new PedestrianSystem(scene)"), true);
  assert.equal(runtime.includes("new StreetFurnitureSystem(scene, scene.campaignSystem)"), true);
  assert.equal(runtime.includes("new VehicleSystem(scene, scene.campaignSystem)"), true);
  assert.equal(runtime.includes(".prototype"), false);
});

test("GameScene separates world size from viewport and renders sidewalks before buildings", async () => {
  const main = await source("phaser/src/main.js");
  const scene = await source("phaser/src/scenes/GameScene.js");
  assert.equal(main.includes("WORLD.viewportWidth"), true);
  assert.equal(main.includes("WORLD.viewportHeight"), true);
  assert.equal(main.includes("WORLD.width * renderScale"), false);
  assert.ok(scene.indexOf("this.drawSidewalkNetwork()") < scene.indexOf("for (const item of buildings)"));
  assert.equal(scene.includes("this.drawCrosswalkNetwork()"), true);
});

test("vehicle movement resolves breakable street furniture before solid world geometry", async () => {
  const driving = await source("phaser/src/vehicles/VehicleDriving.js");
  const furnitureIndex = driving.indexOf("const furniture =");
  const buildingIndex = driving.indexOf("else if (canVehicleOccupy", furnitureIndex);
  assert.ok(furnitureIndex >= 0);
  assert.ok(buildingIndex > furnitureIndex);
});

test("hidden-body container identity survives checkpoints and can be exposed by a ruptured dumpster", async () => {
  const evidence = await source("phaser/src/systems/EvidenceSystem.js");
  const checkpoint = await source("phaser/src/campaign/CampaignCheckpointSystem.js");
  const furnitureFacade = await source("phaser/src/systems/StreetFurnitureSystem.js");
  const furnitureCore = await source("phaser/src/systems/StreetFurnitureSystemCore.js");
  assert.equal(evidence.includes("hiddenSpotId"), true);
  assert.equal(checkpoint.includes("hiddenSpotId"), true);
  assert.equal(furnitureFacade.includes("StreetFurnitureSystemCore"), true);
  assert.equal(furnitureCore.includes("releaseHiddenBody"), true);
  assert.equal(furnitureCore.includes("dumpster-rupture"), true);
});

test("expanded police baseline is sparse and reinforcements use separated district approaches", async () => {
  const police = await source("phaser/src/systems/PoliceSystem.js");
  assert.equal(police.includes("0: 2"), true);
  assert.equal(police.includes("1: 3"), true);
  assert.equal(police.includes("DISTRICT_ENTRY_POINTS"), true);
});
