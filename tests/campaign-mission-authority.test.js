import test from "node:test";
import assert from "node:assert/strict";
import { CampaignMissionAuthority } from "../phaser/src/campaign/CampaignMissionAuthority.js";
import { CampaignSystem } from "../phaser/src/campaign/CampaignSystem.js";
import { CAMPAIGN_EVENT_TYPES, MISSION_STATUS } from "../phaser/src/campaign/constants.js";
import { SILENCE_THE_JOURNALIST_ID } from "../phaser/src/campaign/missions/silenceTheJournalist.js";
import { LAYERS } from "../phaser/src/data/district.js";
import { MissionSystem } from "../phaser/src/systems/MissionSystem.js";

class Emitter {
  constructor() { this.listeners = new Map(); }
  on(type, listener) {
    const set = this.listeners.get(type) || new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }
  once() {}
  off(type, listener) { this.listeners.get(type)?.delete(listener); }
  emit(type, ...args) { for (const listener of this.listeners.get(type) || []) listener(...args); }
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    values
  };
}

function container() {
  return {
    visible: true,
    alpha: 1,
    setVisible(value) { this.visible = Boolean(value); return this; },
    setAlpha(value) { this.alpha = value; return this; }
  };
}

function sceneFixture() {
  const events = new Emitter();
  const registryEvents = new Emitter();
  const published = {};
  const reportWrites = [];
  const player = { x: 150, y: 146 };
  const journalist = { id: "journalist", x: 588, y: 360, layer: LAYERS.STREET, dead: false, inactive: false, intercepted: false, container: container() };
  const thug = { id: "rooftop_thug", x: 658, y: 156, layer: LAYERS.ROOF_LOW, dead: false, container: container() };
  const informant = { id: "police_roof_informant", x: 775, y: 150, layer: LAYERS.ROOF_LOW, dead: false, inactive: false, container: container() };

  const scene = {
    currentLayer: LAYERS.ROOF_HIGH,
    player,
    events,
    registry: {
      events: registryEvents,
      set(key, value) { published[key] = value; }
    },
    statePublisher: {
      setMany(values) { Object.assign(published, values); },
      set(key, value) {
        published[key] = value;
        if (key === "missionResult") reportWrites.push(value);
      }
    },
    lastActionText: "",
    redrawLayer() {},
    switchLayer(layer, position, status) {
      this.currentLayer = layer;
      this.player.x = position.x;
      this.player.y = position.y;
      this.lastActionText = status;
    },
    npcSystem: {
      npcs: [journalist, thug, informant],
      rebuildSpatialIndex() {},
      refreshVisibility() {},
      markFed(npc) { npc.dead = true; npc.deathKind = "drained"; },
      markKilled(npc) { npc.dead = true; npc.deathKind = "killed"; },
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
    inputSystem: { resetWorldEdges() {} }
  };

  const uiScene = {
    introOpen: true,
    closeIntro() { this.introOpen = false; }
  };
  scene.tutorialDirector = {
    busy: false,
    state: "complete",
    started: true,
    finalAdviceShown: false,
    uiScene,
    setControlMode() {},
    setTip() {},
    freezeWorld() {},
    finishTutorial() { this.state = "complete"; this.busy = false; },
    async showDialogue() {}
  };
  scene.missionSystem = new MissionSystem(scene);
  return { scene, published, reportWrites, journalist, thug, informant, uiScene };
}

async function withPhaser(callback) {
  const previous = globalThis.Phaser;
  globalThis.Phaser = {
    Scenes: { Events: { SHUTDOWN: "shutdown" } },
    Math: { Distance: { Between: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay) } }
  };
  try {
    return await callback();
  } finally {
    if (previous === undefined) delete globalThis.Phaser;
    else globalThis.Phaser = previous;
  }
}

async function completeOpeningMission(scene) {
  while (scene.missionSystem.rooftopJumps < 3) scene.missionSystem.onRooftopJump();
  assert.equal(scene.missionSystem.collectPoliceRoofTip(), true);
  assert.equal(scene.campaignSystem.missions.currentObjective().id, "reach_nightclub");
  scene.switchLayer(LAYERS.STREET, { x: 642, y: 404 }, "club");
  scene.missionSystem.update();
  assert.equal(scene.missionSystem.step, 2);
  scene.missionSystem.resolveJournalistPlaceholder("Journalist drained. Return to the refuge.", "drained");
  assert.equal(scene.missionSystem.step, 3);
  scene.switchLayer(LAYERS.ROOF_HIGH, { x: 150, y: 146 }, "refuge");
  scene.missionSystem.update();
  await scene.missionSystem.returnFinalePromise;
}

test("CampaignRunner directly owns opening mission progression and rewards", async () => withPhaser(async () => {
  const fixture = sceneFixture();
  const campaign = new CampaignSystem({ storage: memoryStorage(), autoSave: false, now: () => 100 });
  fixture.scene.campaignSystem = campaign;
  const authority = new CampaignMissionAuthority(fixture.scene, campaign);

  assert.equal(campaign.missions.currentObjective().id, "reach_police_roof");
  assert.equal(fixture.scene.missionSystem.step, 0);
  await completeOpeningMission(fixture.scene);

  const record = campaign.state.missions.records[SILENCE_THE_JOURNALIST_ID];
  assert.equal(record.status, MISSION_STATUS.COMPLETED);
  assert.equal(record.objectives.neutralize_journalist.outcome, "drained");
  assert.equal(campaign.wallet.balance(), 500);
  assert.equal(fixture.scene.missionSystem.completed, true);
  assert.equal(fixture.scene.missionSystem.step, 4);
  assert.equal(fixture.reportWrites.at(-1).title, "REPORT ACCEPTED");
  assert.equal(campaign.checkpoints.snapshot().id, "journalist_report_accepted");
  authority.destroy();
}));

test("completed standalone missions replay without duplicating rewards", async () => withPhaser(async () => {
  const storage = memoryStorage();
  const first = sceneFixture();
  const firstCampaign = new CampaignSystem({ storage, autoSave: true, now: () => 200 });
  first.scene.campaignSystem = firstCampaign;
  const firstAuthority = new CampaignMissionAuthority(first.scene, firstCampaign);
  await completeOpeningMission(first.scene);
  firstCampaign.save();
  firstAuthority.destroy();

  const second = sceneFixture();
  const secondCampaign = new CampaignSystem({ storage, autoSave: false, now: () => 300 });
  second.scene.campaignSystem = secondCampaign;
  const secondAuthority = new CampaignMissionAuthority(second.scene, secondCampaign);
  assert.equal(secondCampaign.missions.currentObjective().id, "reach_police_roof");
  assert.equal(secondCampaign.missions.activeRecord().rewardsGranted, true);
  await completeOpeningMission(second.scene);
  assert.equal(secondCampaign.wallet.balance(), 500);
  assert.equal(secondCampaign.state.ledger.length, 1);
  secondAuthority.destroy();
}));

test("stable objective checkpoint restores tutorial-complete police-roof state", async () => withPhaser(async () => {
  const storage = memoryStorage();
  const campaign = new CampaignSystem({ storage, autoSave: true, now: () => 400 });
  campaign.startMission(SILENCE_THE_JOURNALIST_ID);
  campaign.handle(CAMPAIGN_EVENT_TYPES.REACHED, { targetId: "police_roof" });
  campaign.handle(CAMPAIGN_EVENT_TYPES.TALKED, { targetId: "police_roof_informant" });
  campaign.save();

  const restoredCampaign = new CampaignSystem({ storage, autoSave: false, now: () => 500 });
  const fixture = sceneFixture();
  fixture.scene.campaignSystem = restoredCampaign;
  const authority = new CampaignMissionAuthority(fixture.scene, restoredCampaign);

  assert.equal(restoredCampaign.missions.currentObjective().id, "reach_nightclub");
  assert.equal(fixture.scene.missionSystem.step, 1);
  assert.equal(fixture.scene.currentLayer, LAYERS.ROOF_LOW);
  assert.deepEqual([fixture.scene.player.x, fixture.scene.player.y], [775, 150]);
  assert.equal(fixture.thug.dead, true);
  assert.equal(fixture.thug.deathKind, "drained");
  assert.equal(fixture.informant.inactive, true);
  assert.equal(fixture.uiScene.introOpen, false);
  assert.equal(authority.restoredCheckpoint, true);
  authority.destroy();
}));
