import test from "node:test";
import assert from "node:assert/strict";
import { CampaignRuntimeBridge } from "../phaser/src/campaign/CampaignRuntimeBridge.js";
import { CampaignSystem } from "../phaser/src/campaign/CampaignSystem.js";
import { MISSION_STATUS } from "../phaser/src/campaign/constants.js";
import { SILENCE_THE_JOURNALIST_ID } from "../phaser/src/campaign/missions/silenceTheJournalist.js";

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
    removeItem(key) { values.delete(key); }
  };
}

function sceneFixture() {
  const events = new Emitter();
  const registryEvents = new Emitter();
  const published = {};
  return {
    events,
    registry: { events: registryEvents, set(key, value) { published[key] = value; } },
    statePublisher: { setMany(values) { Object.assign(published, values); } },
    missionSystem: { step: 0 },
    npcSystem: { npcs: [{ id: "journalist", deathKind: null }] },
    feedingSystem: { stats: { targetFed: false, targetHandled: false } },
    published
  };
}

function withPhaser(callback) {
  const previous = globalThis.Phaser;
  globalThis.Phaser = { Scenes: { Events: { SHUTDOWN: "shutdown" } } };
  try {
    return callback();
  } finally {
    if (previous === undefined) delete globalThis.Phaser;
    else globalThis.Phaser = previous;
  }
}

test("legacy mission steps activate the equivalent data-driven objective", () => withPhaser(() => {
  const scene = sceneFixture();
  const campaign = new CampaignSystem({ storage: memoryStorage(), autoSave: false, now: () => 100 });
  const bridge = new CampaignRuntimeBridge(scene, campaign);

  bridge.syncLegacyStep(1);
  assert.equal(campaign.missions.currentObjective().id, "reach_nightclub");
  bridge.syncLegacyStep(2);
  assert.equal(campaign.missions.currentObjective().id, "neutralize_journalist");
  assert.equal(scene.published.cashText, "Cash $0");
  bridge.destroy();
}));

test("journalist neutralization and refuge return grant opening rewards once", () => withPhaser(() => {
  const storage = memoryStorage();
  const scene = sceneFixture();
  const campaign = new CampaignSystem({ storage, now: () => 200 });
  const bridge = new CampaignRuntimeBridge(scene, campaign);
  bridge.syncLegacyStep(2);
  bridge.handleNeutralized({ targetId: "journalist", kind: "drained" });
  assert.equal(campaign.missions.currentObjective().id, "return_to_refuge");
  bridge.syncLegacyStep(4);

  const record = campaign.state.missions.records[SILENCE_THE_JOURNALIST_ID];
  assert.equal(record.status, MISSION_STATUS.COMPLETED);
  assert.equal(campaign.wallet.balance(), 500);
  assert.equal(campaign.reputation.faction("blackglass_directorate"), 5);
  assert.equal(scene.published.cashText, "Cash $500");
  bridge.destroy();

  const restored = new CampaignSystem({ storage, now: () => 300 });
  const secondScene = sceneFixture();
  const secondBridge = new CampaignRuntimeBridge(secondScene, restored);
  secondBridge.syncLegacyStep(4);
  assert.equal(restored.wallet.balance(), 500);
  assert.equal(restored.state.ledger.length, 1);
  secondBridge.destroy();
}));

test("a failed vertical-slice mission fails the active campaign record without rewards", () => withPhaser(() => {
  const scene = sceneFixture();
  const campaign = new CampaignSystem({ storage: memoryStorage(), autoSave: false, now: () => 400 });
  const bridge = new CampaignRuntimeBridge(scene, campaign);
  bridge.handleMissionResult({ status: "failed", title: "DETAINED", subtitle: "Police took you alive." });

  const record = campaign.state.missions.records[SILENCE_THE_JOURNALIST_ID];
  assert.equal(record.status, MISSION_STATUS.FAILED);
  assert.equal(record.failureReason, "Police took you alive.");
  assert.equal(campaign.wallet.balance(), 0);
  bridge.destroy();
}));
