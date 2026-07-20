import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

test("vehicle runtime is composed through first-class scene and runtime owners", async () => {
  const scene = await source("phaser/src/scenes/GameScene.js");
  const runtime = await source("phaser/src/runtime/GameplayRuntime.js");
  const interaction = await source("phaser/src/systems/InteractionSystem.js");
  const noise = await source("phaser/src/systems/MovementNoiseSystem.js");

  assert.equal(scene.includes("GameSceneCore"), true);
  assert.equal(scene.includes("vehicleSystem.collectInteractions"), true);
  assert.equal(scene.includes("vehicleSystem.updateDriving"), true);
  assert.equal(scene.includes("vehicleSystem.updateCamera"), true);
  assert.equal(runtime.includes("new VehicleSystem"), true);
  assert.equal(runtime.includes("filterInputFrame"), true);
  assert.equal(runtime.includes('registerSystem("VehicleSystem")'), true);
  assert.equal(interaction.includes('"vehicleEnter", "vehicleExit"'), true);
  assert.equal(noise.includes("suppressVehicleFootsteps"), false, "footstep suppression belongs to the owner wrapper, not a prototype patch");
  assert.equal(scene.includes("prototype.__nbd"), false);
  assert.equal(runtime.includes("prototype.__nbd"), false);
});

test("campaign vehicle ownership and checkpoint safety remain explicit services", async () => {
  const campaign = await source("phaser/src/campaign/CampaignSystem.js");
  const checkpoint = await source("phaser/src/campaign/CampaignCheckpointSystem.js");
  const vehicle = await source("phaser/src/vehicles/VehicleSystem.js");
  const consequences = await source("phaser/src/vehicles/VehicleConsequences.js");
  const view = await source("phaser/src/vehicles/VehicleView.js");
  const driving = await source("phaser/src/vehicles/VehicleDriving.js");

  assert.equal(campaign.includes("CampaignVehicleSystem"), true);
  assert.equal(campaign.includes("vehicles: this.vehicles.snapshot"), true);
  assert.equal(checkpoint.includes("vehicleSystem?.isDriving"), true);
  assert.equal(checkpoint.includes("transitionActive: true"), true);
  assert.equal(consequences.includes("CAMPAIGN_EVENT_TYPES.VEHICLE_STOLEN"), true);
  assert.equal(consequences.includes("alarmWitness"), true);
  assert.equal(consequences.includes('"combat:entity-neutralized"'), true);
  assert.equal(driving.includes("other.disabled"), false, "disabled vehicles remain solid collision obstacles");
  assert.equal(vehicle.includes("TRUNK_FULL"), false, "capacity errors are owned by CampaignVehicleSystem");
  assert.equal(view.includes("window.NBD_VEHICLES"), true);
});

test("vehicle definitions cover the Milestone 12 baseline archetypes", async () => {
  const definitions = await source("phaser/src/data/vehicles.js");
  for (const archetype of ["compact", "sedan", "van", "police"]) {
    assert.equal(definitions.includes(`${archetype}: Object.freeze`), true, archetype);
  }
  assert.equal(definitions.includes("trunkCapacity"), true);
  assert.equal(definitions.includes("startOwned: true"), true);
  assert.equal(definitions.includes("VEHICLE_OWNERSHIP.POLICE"), true);
});
