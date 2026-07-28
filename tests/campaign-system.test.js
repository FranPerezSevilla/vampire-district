import test from "node:test";
import assert from "node:assert/strict";
import { CampaignSystem } from "../phaser/src/campaign/CampaignSystem.js";
import { createCampaignState } from "../phaser/src/campaign/CampaignState.js";
import { CAMPAIGN_EVENT_TYPES, CAMPAIGN_STORAGE_KEY, LEGACY_CAMPAIGN_STORAGE_KEYS, MISSION_STATUS } from "../phaser/src/campaign/constants.js";
import {
  SILENCE_THE_JOURNALIST_ID,
  silenceTheJournalistMission
} from "../phaser/src/campaign/missions/silenceTheJournalist.js";

const TEST_DEFINITIONS = Object.freeze([silenceTheJournalistMission]);

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    values
  };
}

function campaignSystem(options = {}) {
  return new CampaignSystem({
    definitions: TEST_DEFINITIONS,
    ...options
  });
}

function progressToJournalist(campaign) {
  campaign.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "police_roof" });
  campaign.handle(CAMPAIGN_EVENT_TYPES.TALKED, { targetId: "police_roof_informant" });
  campaign.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "nightclub_district" });
}

test("CampaignSystem autosaves an explicitly supplied active mission and restores it", () => {
  const storage = memoryStorage();
  let now = 1_000;
  const campaign = campaignSystem({ storage, now: () => now++ });
  campaign.startMission(SILENCE_THE_JOURNALIST_ID);
  progressToJournalist(campaign);

  const saved = storage.getItem(CAMPAIGN_STORAGE_KEY);
  assert.ok(saved);
  const restored = campaignSystem({ storage, now: () => now++ });
  assert.equal(restored.state.missions.activeMissionId, SILENCE_THE_JOURNALIST_ID);
  assert.equal(restored.missions.currentObjective().id, "neutralize_journalist");
  assert.equal(restored.state.missions.records[SILENCE_THE_JOURNALIST_ID].status, MISSION_STATUS.ACTIVE);
});


test("campaign storage migrates the historical product and faction identifiers once", () => {
  const storage = memoryStorage();
  const legacyKey = LEGACY_CAMPAIGN_STORAGE_KEYS[0];
  const state = createCampaignState({ now: 10 });
  state.player.cash = 77;
  state.reputation.factions = {
    blackglass_directorate: 12,
    red_assembly: -4
  };
  state.reputation.contacts = { directorate_cleaner: 6 };
  state.world.ownedVehicles = ["directorate_van"];
  state.world.flags = {
    "vehicle.directorate_van.status": "owned"
  };
  storage.setItem(legacyKey, JSON.stringify(state));

  const system = new CampaignSystem({
    storage,
    now: () => 20,
    autoLoad: true,
    autoSave: false
  });

  assert.equal(system.state.player.cash, 77);
  assert.equal(system.state.reputation.factions.first_estate, 12);
  assert.equal(system.state.reputation.factions.gutter_crown, -4);
  assert.equal(system.state.reputation.contacts.estate_cleaner, 6);
  assert.ok(system.state.world.ownedVehicles.includes("estate_van"));
  assert.equal(system.state.world.ownedVehicles.includes("directorate_van"), false);
  assert.equal(system.state.world.flags["vehicle.estate_van.status"], "owned");
  assert.equal(system.state.reputation.factions.blackglass_directorate, undefined);
  assert.equal(system.state.reputation.factions.red_assembly, undefined);
  assert.equal(storage.getItem(legacyKey), null);
  assert.ok(storage.getItem(CAMPAIGN_STORAGE_KEY));
});

test("campaign export/import preserves money, reputation and explicit mission progress", () => {
  const source = campaignSystem({ storage: memoryStorage(), autoSave: false, now: () => 2_000 });
  source.wallet.credit(140, { source: "test" });
  source.reputation.modifyContact("unaligned_mechanic", 7, { source: "test" });
  source.startMission(SILENCE_THE_JOURNALIST_ID);
  source.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "police_roof" });

  const target = campaignSystem({ storage: memoryStorage(), autoLoad: false, autoSave: false, now: () => 3_000 });
  target.import(source.export(), { persist: false });

  assert.equal(target.wallet.balance(), 140);
  assert.equal(target.reputation.contact("unaligned_mechanic"), 7);
  assert.equal(target.missions.currentObjective().id, "speak_to_informant");
});

test("reset creates a clean campaign and clears explicit mission state", () => {
  const storage = memoryStorage();
  const campaign = campaignSystem({ storage, now: () => 4_000 });
  campaign.wallet.credit(500, { source: "test" });
  campaign.startMission(SILENCE_THE_JOURNALIST_ID);
  campaign.reset({ persist: true });

  assert.equal(campaign.wallet.balance(), 0);
  assert.equal(campaign.state.missions.activeMissionId, null);
  assert.deepEqual(campaign.state.missions.completed, []);
  assert.ok(storage.getItem(CAMPAIGN_STORAGE_KEY));
});

test("an explicit mission reward survives reload without duplication", () => {
  const storage = memoryStorage();
  const campaign = campaignSystem({ storage, now: () => 5_000 });
  campaign.startMission(SILENCE_THE_JOURNALIST_ID);
  progressToJournalist(campaign);
  campaign.handle(CAMPAIGN_EVENT_TYPES.NEUTRALIZED, { targetId: "journalist", outcome: "drained" });
  campaign.handle(CAMPAIGN_EVENT_TYPES.RETURNED, { refugeId: "rooftop_refuge" });
  assert.equal(campaign.wallet.balance(), 500);

  const restored = campaignSystem({ storage, now: () => 6_000 });
  assert.equal(restored.wallet.balance(), 500);
  assert.equal(restored.state.ledger.filter(entry => entry.referenceId === SILENCE_THE_JOURNALIST_ID).length, 1);
  assert.equal(restored.state.missions.records[SILENCE_THE_JOURNALIST_ID].rewardsGranted, true);
});
