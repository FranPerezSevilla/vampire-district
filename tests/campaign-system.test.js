import test from "node:test";
import assert from "node:assert/strict";
import { CampaignSystem } from "../phaser/src/campaign/CampaignSystem.js";
import { CAMPAIGN_EVENT_TYPES, CAMPAIGN_STORAGE_KEY, MISSION_STATUS } from "../phaser/src/campaign/constants.js";
import { SILENCE_THE_JOURNALIST_ID } from "../phaser/src/campaign/missions/silenceTheJournalist.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    values
  };
}

function progressToJournalist(campaign) {
  campaign.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "police_roof" });
  campaign.handle(CAMPAIGN_EVENT_TYPES.TALKED, { targetId: "police_roof_informant" });
  campaign.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "nightclub_district" });
}

test("CampaignSystem autosaves a versioned active mission and restores it", () => {
  const storage = memoryStorage();
  let now = 1_000;
  const campaign = new CampaignSystem({ storage, now: () => now++ });
  campaign.startMission(SILENCE_THE_JOURNALIST_ID);
  progressToJournalist(campaign);

  const saved = storage.getItem(CAMPAIGN_STORAGE_KEY);
  assert.ok(saved);
  const restored = new CampaignSystem({ storage, now: () => now++ });
  assert.equal(restored.state.missions.activeMissionId, SILENCE_THE_JOURNALIST_ID);
  assert.equal(restored.missions.currentObjective().id, "neutralize_journalist");
  assert.equal(restored.state.missions.records[SILENCE_THE_JOURNALIST_ID].status, MISSION_STATUS.ACTIVE);
});

test("campaign export/import preserves money, reputation and mission progress", () => {
  const source = new CampaignSystem({ storage: memoryStorage(), autoSave: false, now: () => 2_000 });
  source.wallet.credit(140, { source: "test" });
  source.reputation.modifyContact("unaligned_mechanic", 7, { source: "test" });
  source.startMission(SILENCE_THE_JOURNALIST_ID);
  source.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "police_roof" });

  const target = new CampaignSystem({ storage: memoryStorage(), autoLoad: false, autoSave: false, now: () => 3_000 });
  target.import(source.export(), { persist: false });

  assert.equal(target.wallet.balance(), 140);
  assert.equal(target.reputation.contact("unaligned_mechanic"), 7);
  assert.equal(target.missions.currentObjective().id, "speak_to_informant");
});

test("reset creates a clean campaign and clears active mission state", () => {
  const storage = memoryStorage();
  const campaign = new CampaignSystem({ storage, now: () => 4_000 });
  campaign.wallet.credit(500, { source: "test" });
  campaign.startMission(SILENCE_THE_JOURNALIST_ID);
  campaign.reset({ persist: true });

  assert.equal(campaign.wallet.balance(), 0);
  assert.equal(campaign.state.missions.activeMissionId, null);
  assert.deepEqual(campaign.state.missions.completed, []);
  assert.ok(storage.getItem(CAMPAIGN_STORAGE_KEY));
});

test("completed opening mission reward survives reload without duplication", () => {
  const storage = memoryStorage();
  const campaign = new CampaignSystem({ storage, now: () => 5_000 });
  campaign.startMission(SILENCE_THE_JOURNALIST_ID);
  progressToJournalist(campaign);
  campaign.handle(CAMPAIGN_EVENT_TYPES.NEUTRALIZED, { targetId: "journalist", outcome: "drained" });
  campaign.handle(CAMPAIGN_EVENT_TYPES.RETURNED, { refugeId: "rooftop_refuge" });
  assert.equal(campaign.wallet.balance(), 500);

  const restored = new CampaignSystem({ storage, now: () => 6_000 });
  assert.equal(restored.wallet.balance(), 500);
  assert.equal(restored.state.ledger.filter(entry => entry.referenceId === SILENCE_THE_JOURNALIST_ID).length, 1);
  assert.equal(restored.state.missions.records[SILENCE_THE_JOURNALIST_ID].rewardsGranted, true);
});
