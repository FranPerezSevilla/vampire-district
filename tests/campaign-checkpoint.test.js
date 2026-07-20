import test from "node:test";
import assert from "node:assert/strict";
import {
  checkpointCanResume,
  checkpointSafetyReasons,
  checkpointStateIsSafe,
  sanitizeCampaignCheckpoint
} from "../phaser/src/campaign/CampaignCheckpoint.js";
import { CampaignSystem } from "../phaser/src/campaign/CampaignSystem.js";
import { migrateCampaignState } from "../phaser/src/campaign/CampaignState.js";
import {
  CAMPAIGN_EVENT_TYPES,
  CAMPAIGN_SCHEMA_VERSION,
  CHECKPOINT_KINDS
} from "../phaser/src/campaign/constants.js";
import { SILENCE_THE_JOURNALIST_ID } from "../phaser/src/campaign/missions/silenceTheJournalist.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function campaignAtNightclub() {
  const campaign = new CampaignSystem({ autoLoad: false, autoSave: false, now: () => 1000 });
  campaign.startMission(SILENCE_THE_JOURNALIST_ID, {
    metadata: { rooftopJumps: 3 }
  });
  campaign.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "police_roof" });
  campaign.handle(CAMPAIGN_EVENT_TYPES.TALKED, { targetId: "police_roof_informant" });
  campaign.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "nightclub_district" });
  return campaign;
}

function checkpointFor(campaign) {
  const record = campaign.missions.record(SILENCE_THE_JOURNALIST_ID);
  return sanitizeCampaignCheckpoint({
    id: "cp-000001",
    missionId: SILENCE_THE_JOURNALIST_ID,
    objectiveId: "neutralize_journalist",
    kind: CHECKPOINT_KINDS.OBJECTIVE,
    createdAt: 1000,
    mission: record,
    player: { x: 642, y: 404, layer: 0, hunger: 41 },
    loadout: {
      selectedWeaponId: "pistol",
      inventory: ["unarmed", "pipe", "pistol"],
      ammo: { pistol: 5 }
    },
    world: {
      exposure: 0,
      brokenLights: ["lampClub"],
      npcs: {
        journalist: {
          id: "journalist",
          type: "target",
          x: 588,
          y: 360,
          layer: 0,
          dead: false,
          combat: { state: "active", resilience: 3, maxResilience: 3 }
        }
      },
      bloodStains: [],
      feedingStats: { targetHandled: false },
      evidenceStats: { bloodCreated: 0 }
    },
    tutorial: {
      completed: true,
      state: "complete",
      finalAdviceShown: true,
      informantGone: true
    },
    metadata: { policyId: "at_nightclub" }
  });
}

test("schema version two adds an empty checkpoint collection to version-one saves", () => {
  const migrated = migrateCampaignState({
    version: 1,
    revision: 4,
    player: { cash: 275 },
    missions: { activeMissionId: null, records: {}, completed: [], failed: [] }
  }, { now: 2000 });

  assert.equal(migrated.version, CAMPAIGN_SCHEMA_VERSION);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.player.cash, 275);
  assert.deepEqual(migrated.checkpoints, { latest: null });
  assert.equal(migrated.sequences.checkpoint, 0);
});

test("checkpoint sanitization keeps an atomic mission, world and loadout snapshot", () => {
  const campaign = campaignAtNightclub();
  const checkpoint = checkpointFor(campaign);

  assert.ok(checkpoint);
  assert.equal(checkpoint.mission.status, "active");
  assert.equal(checkpoint.mission.objectiveIndex, 3);
  assert.equal(checkpoint.mission.objectives.neutralize_journalist.status, "active");
  assert.equal(checkpoint.player.hunger, 41);
  assert.equal(checkpoint.loadout.selectedWeaponId, "pistol");
  assert.equal(checkpoint.loadout.ammo.pistol, 5);
  assert.deepEqual(checkpoint.world.brokenLights, ["lampClub"]);
  assert.equal(checkpoint.world.npcs.journalist.combat.resilience, 3);
  assert.equal(checkpoint.tutorial.completed, true);
});

test("checkpoint safety rejects combat, pursuit, witnesses and wanted state", () => {
  assert.equal(checkpointStateIsSafe({}), true);
  assert.deepEqual(checkpointSafetyReasons({
    worldLocked: true,
    combatBusy: true,
    wantedLevel: 2,
    alarmedWitnesses: 1,
    activePursuers: 3
  }), ["world-locked", "combat", "wanted", "witnesses", "pursuit"]);
});

test("campaign export and import preserve checkpoint mission rollback data", () => {
  const storage = memoryStorage();
  const campaign = campaignAtNightclub();
  campaign.storage.storage = storage;
  const checkpoint = checkpointFor(campaign);
  campaign.setCheckpoint(checkpoint, { emit: false });

  campaign.handle(CAMPAIGN_EVENT_TYPES.NEUTRALIZED, {
    targetId: "journalist",
    outcome: "drained"
  });
  assert.equal(campaign.missions.currentObjective().id, "return_to_refuge");
  assert.equal(campaign.checkpoint().mission.objectiveIndex, 3);

  const serialized = campaign.export();
  const restored = new CampaignSystem({
    storage,
    autoLoad: false,
    autoSave: false,
    now: () => 2000
  });
  restored.import(serialized, { persist: false });

  assert.equal(restored.state.version, 2);
  assert.equal(restored.missions.currentObjective().id, "return_to_refuge");
  assert.equal(restored.checkpoint().objectiveId, "neutralize_journalist");
  assert.equal(restored.checkpoint().mission.objectiveIndex, 3);
  assert.equal(checkpointCanResume(restored.checkpoint(), restored.state), true);
});

test("a completed checkpoint is resumable after mission rewards are granted", () => {
  const campaign = campaignAtNightclub();
  campaign.handle(CAMPAIGN_EVENT_TYPES.NEUTRALIZED, {
    targetId: "journalist",
    outcome: "killed"
  });
  campaign.handle(CAMPAIGN_EVENT_TYPES.RETURNED, {
    refugeId: "rooftop_refuge"
  });
  const record = campaign.missions.record(SILENCE_THE_JOURNALIST_ID);
  const checkpoint = sanitizeCampaignCheckpoint({
    id: "cp-000002",
    missionId: SILENCE_THE_JOURNALIST_ID,
    objectiveId: null,
    kind: CHECKPOINT_KINDS.MISSION_COMPLETE,
    mission: record,
    player: { x: 150, y: 146, layer: 2, hunger: 30 },
    loadout: { selectedWeaponId: "unarmed", inventory: ["unarmed"], ammo: {} },
    world: { exposure: 0, brokenLights: [], npcs: {}, bloodStains: [] },
    tutorial: { completed: true, state: "complete", informantGone: true }
  });
  campaign.setCheckpoint(checkpoint, { emit: false });

  assert.equal(campaign.wallet.balance(), 500);
  assert.equal(checkpointCanResume(campaign.checkpoint(), campaign.state), true);
});

test("completed campaign state rejects a stale active checkpoint to protect reward idempotency", () => {
  const campaign = campaignAtNightclub();
  const activeCheckpoint = checkpointFor(campaign);
  campaign.setCheckpoint(activeCheckpoint, { emit: false });
  campaign.handle(CAMPAIGN_EVENT_TYPES.NEUTRALIZED, {
    targetId: "journalist",
    outcome: "drained"
  });
  campaign.handle(CAMPAIGN_EVENT_TYPES.RETURNED, {
    refugeId: "rooftop_refuge"
  });

  assert.equal(campaign.wallet.balance(), 500);
  assert.equal(campaign.missions.record(SILENCE_THE_JOURNALIST_ID).status, "completed");
  assert.equal(campaign.checkpoint().mission.status, "active");
  assert.equal(checkpointCanResume(campaign.checkpoint(), campaign.state), false);
});

test("starting another mission run clears the previous mission checkpoint", () => {
  const campaign = campaignAtNightclub();
  campaign.setCheckpoint(checkpointFor(campaign), { emit: false });
  campaign.failActiveMission("Test restart.");
  campaign.startMission("clean_the_scene");

  assert.equal(campaign.state.missions.activeMissionId, "clean_the_scene");
  assert.equal(campaign.checkpoint(), null);
});

test("retrying the same failed mission preserves its last safe checkpoint for boot restoration", () => {
  const campaign = campaignAtNightclub();
  const checkpoint = checkpointFor(campaign);
  campaign.setCheckpoint(checkpoint, { emit: false });
  campaign.failActiveMission("Caught during the nightclub approach.");

  campaign.startMission(SILENCE_THE_JOURNALIST_ID, { replay: true });

  assert.equal(campaign.state.missions.activeMissionId, SILENCE_THE_JOURNALIST_ID);
  assert.equal(campaign.missions.currentObjective().id, "reach_police_roof");
  assert.equal(campaign.checkpoint().id, checkpoint.id);
  assert.equal(campaign.checkpoint().objectiveId, "neutralize_journalist");
  assert.equal(campaign.checkpoint().mission.status, "active");
  assert.equal(checkpointCanResume(campaign.checkpoint(), campaign.state), true);
});
