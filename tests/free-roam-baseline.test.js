import assert from "node:assert/strict";
import test from "node:test";
import { createBootProfile } from "../phaser/src/boot/BootProfile.js";
import { CampaignSystem, DEFAULT_DEFINITIONS } from "../phaser/src/campaign/CampaignSystem.js";
import { npcDefinitions } from "../phaser/src/data/npcs.js";
import { npcCriticalReason } from "../phaser/src/streaming/EntityStreamPolicy.js";
import { currentCityBlueprint } from "../tools/city-compiler/current-city.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); }
  };
}

test("production campaign registers no authored missions", () => {
  const campaign = new CampaignSystem({
    storage: memoryStorage(),
    autoLoad: false,
    autoSave: false,
    now: () => 1000
  });

  assert.deepEqual(DEFAULT_DEFINITIONS, []);
  assert.deepEqual(campaign.snapshot().definitions, []);
  assert.equal(campaign.state.missions.activeMissionId, null);
  assert.equal(campaign.missions.activeRecord(), null);
  assert.match(campaign.summary(), /No active campaign mission/);
});

test("legacy registered mission records and checkpoints are pruned", () => {
  const campaign = new CampaignSystem({
    storage: memoryStorage(),
    autoLoad: false,
    autoSave: false,
    now: () => 2000
  });
  campaign.state.missions.activeMissionId = "silence_the_journalist";
  campaign.state.missions.records.silence_the_journalist = {
    id: "silence_the_journalist",
    status: "active"
  };
  campaign.state.missions.records.clean_the_scene = {
    id: "clean_the_scene",
    status: "completed"
  };
  campaign.state.missions.completed = ["clean_the_scene"];
  campaign.state.missions.failed = ["silence_the_journalist"];
  campaign.state.checkpoints.latest = {
    id: "cp-retired",
    missionId: "silence_the_journalist"
  };

  campaign.buildServices();

  assert.equal(campaign.state.missions.activeMissionId, null);
  assert.deepEqual(campaign.state.missions.records, {});
  assert.deepEqual(campaign.state.missions.completed, []);
  assert.deepEqual(campaign.state.missions.failed, []);
  assert.equal(campaign.state.checkpoints.latest, null);
});

test("normal boot is persistent street free roam without entry or tutorial", () => {
  const normal = createBootProfile("");
  assert.equal(normal.mode, "normal");
  assert.equal(normal.persistentCampaign, true);
  assert.equal(normal.showCampaignEntry, false);
  assert.equal(normal.autoStartOpeningMission, false);
  assert.equal(normal.skipTutorial, true);
  assert.equal(normal.startOnStreet, true);
  assert.equal(normal.spawn.layer, 0);
});

test("current compiler baseline no longer protects the old core or fixed mission landmarks", () => {
  assert.deepEqual(currentCityBlueprint.protectedZones, []);
  assert.deepEqual(currentCityBlueprint.landmarks, []);
  assert.equal(currentCityBlueprint.districts.every(district => district.protected === false), true);
  assert.equal(currentCityBlueprint.metadata.compilerStage, "mission-constraints-retired");
  assert.equal(currentCityBlueprint.metadata.futureLandmarkPolicy.mode, "site-first");
});

test("retired mission actors are hidden and no longer pinned in free roam", () => {
  for (const id of ["journalist", "exposed_body", "rooftop_thug"]) {
    const npc = npcDefinitions.find(candidate => candidate.id === id);
    assert.ok(npc, `${id} definition remains available for future authored content`);
    assert.equal(npc.inactive, true);
    assert.equal(npc.retiredMissionEntity, true);
    assert.equal(npcCriticalReason(npc, { missionActive: false }), null);
  }
});
