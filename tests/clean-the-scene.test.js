import test from "node:test";
import assert from "node:assert/strict";

import { CampaignSystem } from "../phaser/src/campaign/CampaignSystem.js";
import { CAMPAIGN_EVENT_TYPES } from "../phaser/src/campaign/constants.js";
import { CLEAN_THE_SCENE_ID } from "../phaser/src/campaign/missions/cleanTheScene.js";
import { SILENCE_THE_JOURNALIST_ID } from "../phaser/src/campaign/missions/silenceTheJournalist.js";

function readyCampaign() {
  const system = new CampaignSystem({ autoLoad: false, autoSave: false, now: () => 2_000 });
  system.startMission(SILENCE_THE_JOURNALIST_ID, { metadata: { integration: "test" } });
  system.missions.completeMission();
  system.startMission(CLEAN_THE_SCENE_ID, { metadata: { integration: "refuge_mission_board" } });
  return system;
}

test("Clean the Scene advances through reusable runner events and grants its rewards once", () => {
  const system = readyCampaign();
  const objective = () => system.missions.currentObjective()?.id;

  assert.equal(objective(), "reach_service_alley");
  assert.equal(system.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "club_service_alley" }), true);
  assert.equal(objective(), "collect_compromised_evidence");
  assert.equal(system.handle(CAMPAIGN_EVENT_TYPES.COLLECTED, { itemId: "compromised_camera_roll" }), true);
  assert.equal(objective(), "remove_exposed_body");
  assert.equal(system.handle(CAMPAIGN_EVENT_TYPES.DESTROYED, { entityId: "exposed_body" }), true);
  assert.equal(objective(), "lose_police_attention");
  assert.equal(system.handle(CAMPAIGN_EVENT_TYPES.WANTED_CHANGED, { level: 0 }), true);
  assert.equal(objective(), "return_to_refuge");
  assert.equal(system.handle(CAMPAIGN_EVENT_TYPES.RETURNED, { refugeId: "rooftop_refuge" }), true);

  const record = system.missions.record(CLEAN_THE_SCENE_ID);
  assert.equal(record.status, "completed");
  assert.equal(record.rewardsGranted, true);
  assert.equal(record.completionCount, 1);
  assert.equal(system.wallet.balance(), 775);
  assert.equal(system.state.reputation.factions.blackglass_directorate, 7);
  assert.equal(system.state.reputation.contacts.directorate_cleaner, 3);
  assert.equal(system.state.world.flags.cleaner_contact_unlocked, true);
  assert.equal(system.state.ledger.length, 2);

  assert.equal(system.handle(CAMPAIGN_EVENT_TYPES.RETURNED, { refugeId: "rooftop_refuge" }), false);
  assert.equal(system.wallet.balance(), 775);
  assert.equal(system.state.ledger.length, 2);
});

test("Clean the Scene authors board placement and a completion checkpoint in data", () => {
  const system = readyCampaign();
  const definition = system.missions.definition(CLEAN_THE_SCENE_ID);

  assert.equal(definition.version, 2);
  assert.equal(definition.metadata.worldAdapter, CLEAN_THE_SCENE_ID);
  assert.equal(definition.metadata.missionBoard.order, 10);
  assert.equal(definition.metadata.placements.cameraRoll.label, "ROLL");
  assert.equal(definition.objectives[0].metadata.checkpoint.actorPreset, "clean_scene_ready");
  assert.equal(definition.metadata.completionCheckpoint.actorPreset, "clean_scene_complete");
});
