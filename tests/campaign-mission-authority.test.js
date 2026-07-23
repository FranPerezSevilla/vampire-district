import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

const distanceBetween = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
globalThis.Phaser = {
  Math: { Distance: { Between: distanceBetween } },
  Scenes: { Events: { SHUTDOWN: "shutdown" } }
};

const { CampaignSystem } = await import("../phaser/src/campaign/CampaignSystem.js");
const { CAMPAIGN_EVENT_TYPES, MISSION_STATUS } = await import("../phaser/src/campaign/constants.js");
const { LAYERS } = await import("../phaser/src/data/district.js");
const {
  SILENCE_THE_JOURNALIST_ID,
  silenceTheJournalistMission
} = await import("../phaser/src/campaign/missions/silenceTheJournalist.js");
const { MissionSystem } = await import("../phaser/src/systems/MissionSystem.js");

function fixture({ authored = true, map = null, onRedraw = null } = {}) {
  const events = new EventEmitter();
  const scene = {
    map,
    currentLayer: LAYERS.STREET,
    player: { x: 438, y: 326 },
    events,
    registry: { set() {} },
    statePublisher: { set() {} },
    lastActionText: "",
    npcSystem: {
      npcs: [],
      summary: () => "NPC summary"
    },
    feedingSystem: { summary: () => "Hunger summary" },
    exposureSystem: { summary: () => "Exposure summary" },
    policeSystem: { summary: () => "Police summary" },
    witnessSystem: { summary: () => "Witness summary" },
    evidenceSystem: { summary: () => "Evidence summary" },
    propDamageSystem: { summary: () => "Prop summary" },
    weaponSystem: { summary: () => "Weapon summary" },
    aiStateSystem: { summary: () => "AI summary" },
    redrawLayer() { onRedraw?.(scene); }
  };
  const campaign = new CampaignSystem({
    definitions: authored ? [silenceTheJournalistMission] : [],
    autoLoad: false,
    autoSave: false,
    now: () => 100
  });
  const mission = new MissionSystem(scene, campaign);
  return { scene, campaign, mission };
}

function progressToJournalist(campaign) {
  campaign.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "police_roof" });
  campaign.handle(CAMPAIGN_EVENT_TYPES.TALKED, { targetId: "police_roof_informant" });
  campaign.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "nightclub_district" });
}

test("MissionSystem owns the scene before a synchronous explicit mission redraw", () => {
  let observedDuringRedraw = null;
  const { scene, campaign, mission } = fixture({
    map: {},
    onRedraw: current => { observedDuringRedraw = current.missionSystem; }
  });

  campaign.startMission(SILENCE_THE_JOURNALIST_ID, {
    metadata: { integration: "campaign_entry" }
  });

  assert.equal(scene.missionSystem, mission);
  assert.equal(observedDuringRedraw, mission);
});

test("production MissionSystem presents free roam when no definition is registered", () => {
  const { campaign, mission } = fixture({ authored: false });
  assert.equal(mission.campaign, campaign);
  assert.equal(mission.currentObjective(), null);
  assert.equal(mission.marker(), null);
  assert.match(mission.activeTaskText(), /No active contract/);
  assert.match(mission.objectiveText(), /explore the city freely/);
});

test("an explicitly supplied mission derives presentation from MissionRunner authority", () => {
  const { campaign, mission } = fixture();
  campaign.startMission(SILENCE_THE_JOURNALIST_ID, {
    metadata: { integration: "campaign_entry" }
  });

  assert.equal(mission.step, 0);
  assert.equal(mission.currentObjective().id, "reach_police_roof");
  assert.equal(mission.marker().label, "TIP");

  campaign.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "police_roof" });
  assert.equal(mission.currentObjective().id, "speak_to_informant");
  campaign.handle(CAMPAIGN_EVENT_TYPES.TALKED, { targetId: "police_roof_informant" });
  assert.equal(mission.currentObjective().id, "reach_nightclub");
});

test("generic neutralization advances an explicit runner once without a mirroring bridge", () => {
  const { scene, campaign, mission } = fixture();
  campaign.startMission(SILENCE_THE_JOURNALIST_ID, {
    metadata: { integration: "campaign_entry" }
  });
  progressToJournalist(campaign);

  scene.events.emit("combat:entity-neutralized", {
    targetId: "journalist",
    kind: "drained"
  });
  scene.events.emit("combat:entity-neutralized", {
    targetId: "journalist",
    kind: "drained"
  });

  assert.equal(mission.currentObjective().id, "return_to_refuge");
  assert.equal(campaign.missions.activeRecord().objectiveIndex, 4);
  assert.equal(campaign.missions.activeRecord().objectives.neutralize_journalist.outcome, "drained");
});

test("generic MissionSystem failure updates an explicit authoritative record without rewards", () => {
  const { campaign, mission } = fixture();
  campaign.startMission(SILENCE_THE_JOURNALIST_ID, {
    metadata: { integration: "campaign_entry" }
  });
  assert.equal(mission.failArrest("Police took you alive."), true);

  const record = campaign.missions.record(SILENCE_THE_JOURNALIST_ID);
  assert.equal(record.status, MISSION_STATUS.FAILED);
  assert.equal(record.failureReason, "Police took you alive.");
  assert.equal(mission.failed, true);
  assert.equal(campaign.wallet.balance(), 0);
});
