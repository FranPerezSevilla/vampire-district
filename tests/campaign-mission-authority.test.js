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
const { MissionSystem } = await import("../phaser/src/systems/MissionSystem.js");

function fixture({ map = null, onRedraw = null } = {}) {
  const events = new EventEmitter();
  const journalist = {
    id: "journalist",
    x: 588,
    y: 360,
    layer: LAYERS.STREET,
    inactive: true,
    dead: false,
    intercepted: false,
    deathKind: null,
    container: { setVisible() { return this; } }
  };
  const scene = {
    map,
    currentLayer: LAYERS.ROOF_HIGH,
    player: { x: 150, y: 146 },
    events,
    registry: { set() {} },
    statePublisher: { set() {} },
    lastActionText: "",
    npcSystem: {
      npcs: [journalist],
      refreshVisibility() {},
      rebuildSpatialIndex() {},
      summary: () => "NPC summary"
    },
    feedingSystem: {
      stats: { targetHandled: false, targetFed: false },
      summary: () => "Hunger summary"
    },
    exposureSystem: { summary: () => "Exposure summary" },
    policeSystem: { summary: () => "Police summary" },
    witnessSystem: { summary: () => "Witness summary" },
    evidenceSystem: { summary: () => "Evidence summary" },
    propDamageSystem: { summary: () => "Prop summary" },
    weaponSystem: { summary: () => "Weapon summary" },
    aiStateSystem: { summary: () => "AI summary" },
    redrawLayer() { onRedraw?.(scene); }
  };
  const campaign = new CampaignSystem({ autoLoad: false, autoSave: false, now: () => 100 });
  const mission = new MissionSystem(scene, campaign);
  return { scene, campaign, mission, journalist };
}

test("MissionSystem publishes scene ownership before synchronous mission-start redraw", () => {
  let observedDuringRedraw = null;
  const { scene, mission } = fixture({
    map: {},
    onRedraw: current => { observedDuringRedraw = current.missionSystem; }
  });

  assert.equal(scene.missionSystem, mission);
  assert.equal(observedDuringRedraw, mission);
});

test("MissionSystem derives legacy presentation from the authoritative current objective", () => {
  const { scene, campaign, mission } = fixture();
  assert.equal(mission.campaign, campaign);
  assert.equal(mission.step, 0);
  assert.equal(mission.currentObjective().id, "reach_police_roof");
  assert.equal(mission.marker().label, "TIP");

  mission.rooftopJumps = 3;
  assert.equal(mission.collectPoliceRoofTip(), true);
  assert.equal(mission.step, 1);
  assert.equal(mission.currentObjective().id, "reach_nightclub");
  assert.equal(campaign.missions.activeRecord().objectiveIndex, 2);

  scene.currentLayer = LAYERS.STREET;
  scene.player.x = 642;
  scene.player.y = 404;
  mission.update();
  assert.equal(mission.step, 2);
  assert.equal(mission.currentObjective().id, "neutralize_journalist");
  assert.equal(mission.marker().label, "TARGET");
});

test("journalist outcome advances the runner once without a mirroring bridge", () => {
  const { scene, campaign, mission, journalist } = fixture();
  mission.rooftopJumps = 3;
  mission.collectPoliceRoofTip();
  campaign.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "nightclub_district" });

  journalist.dead = true;
  journalist.deathKind = "drained";
  scene.feedingSystem.stats.targetHandled = true;
  scene.feedingSystem.stats.targetFed = true;
  scene.events.emit("combat:entity-neutralized", {
    targetId: "journalist",
    kind: "drained"
  });
  scene.events.emit("combat:entity-neutralized", {
    targetId: "journalist",
    kind: "drained"
  });

  assert.equal(mission.step, 3);
  assert.equal(mission.currentObjective().id, "return_to_refuge");
  assert.equal(campaign.missions.activeRecord().objectiveIndex, 4);
  assert.equal(campaign.missions.activeRecord().objectives.neutralize_journalist.outcome, "drained");
});

test("MissionSystem failures update the authoritative campaign record and do not grant rewards", () => {
  const { campaign, mission } = fixture();
  assert.equal(mission.failArrest("Police took you alive."), true);

  const record = campaign.missions.record("silence_the_journalist");
  assert.equal(record.status, MISSION_STATUS.FAILED);
  assert.equal(record.failureReason, "Police took you alive.");
  assert.equal(mission.failed, true);
  assert.equal(campaign.wallet.balance(), 0);
});
