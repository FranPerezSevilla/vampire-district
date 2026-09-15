import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { VampireRuntime } from "../phaser/src/vampire/VampireRuntime.js";
import { CampaignSystem } from "../phaser/src/campaign/CampaignSystem.js";
import { FeedingSystem } from "../phaser/src/systems/FeedingSystem.js";
import { InteractionSystem } from "../phaser/src/systems/InteractionSystemCore.js";
import { createEmptyInputFrame } from "../phaser/src/input/actions.js";
import { buildings, districtZoneAt, LAYERS } from "../phaser/src/data/district.js";
import { createVampireSites } from "../phaser/src/vampire/VampireWorldSites.js";
import { VAMPIRE_CONTACTS } from "../phaser/src/vampire/VampireCatalog.js";
import { GameplayRuntime } from "../phaser/src/runtime/GameplayRuntimeCore.js";

function walkable(x, y) { return x >= 8 && y >= 8 && x <= 4792 && y <= 3592 && !buildings.some(b => x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4); }
function display() { return { visible: true, setOrigin() { return this; }, setDepth() { return this; }, setResolution() { return this; }, setPosition(x, y) { this.x = x; this.y = y; return this; }, setVisible(value) { this.visible = value; return this; }, destroy() {} }; }
function harness() {
  const campaign = new CampaignSystem({ autoLoad: false, autoSave: false, now: () => 1000 });
  const registry = new Map();
  const scene = { campaignSystem: campaign, registry, events: new EventEmitter(), currentLayer: LAYERS.STREET,
    player: { x: 1540, y: 1575 }, currentInputFrame: createEmptyInputFrame({ worldEnabled: true }),
    canStandAt: walkable, add: { text: () => display() },
    npcSystem: { npcs: [], createNpc(def) { return { ...def, combat: { state: "active", resilience: 3, maxResilience: 3 }, container: display() }; }, rebuildSpatialIndex() {}, lineClear: () => true },
    playerDamageSystem: { state: { vitality: 100 }, isDead: () => false, isHitStunned: () => false, restoreVitality(amount) { this.state.vitality = Math.min(100, this.state.vitality + amount); } },
    heatSystem: { level: () => 0 }
  };
  scene.feedingSystem = new FeedingSystem(scene);
  scene.interactionSystem = new InteractionSystem(scene);
  const runtime = new VampireRuntime(scene);
  scene.vampireRuntime = runtime;
  runtime.update(.05, scene.currentInputFrame);
  const choose = id => {
    const option = scene.interactionSystem.menu?.options.find(value => value.id === id);
    assert.ok(option, `Missing playable choice ${id}`);
    scene.interactionSystem.runOption(option);
  };
  const go = point => Object.assign(scene.player, { x: point.x, y: point.y });
  return { scene, runtime, campaign, choose, go };
}

test("contacts and handoffs bind to walkable frontages in their actual city districts", () => {
  const sites = createVampireSites(buildings, walkable);
  for (const contact of VAMPIRE_CONTACTS) {
    const site = sites[contact.buildingId];
    assert.ok(walkable(site.x, site.y));
    assert.equal(districtZoneAt(site.x, site.y).id, contact.districtId);
    assert.ok(sites[contact.pickup]); assert.ok(sites[contact.delivery]);
  }
});

test("world interactions expose a real zero-cash delivery, payment and contact feedback", () => {
  const h = harness();
  assert.equal(h.scene.npcSystem.npcs.length, 6);
  assert.ok(h.scene.npcSystem.npcs.some(npc => npc.id === "vampire:sire"));
  h.go(h.runtime.sites.refugeTower);
  const talk = h.runtime.collectInteractions().find(option => option.id === "talk:sire");
  assert.ok(talk); talk.run();
  assert.match(h.scene.interactionSystem.snapshot().title, /Sire/);
  h.choose("work:sire");
  assert.equal(h.campaign.vampire.state.job.stage, "accepted");
  assert.equal(h.runtime.collectInteractions().some(option => option.id === "delivery:handoff"), false);
  h.go(h.runtime.sites.hospital);
  h.runtime.collectInteractions().find(option => option.id === "delivery:handoff").run();
  h.go(h.runtime.sites.club);
  h.runtime.collectInteractions().find(option => option.id === "delivery:handoff").run();
  assert.equal(h.campaign.wallet.balance(), 180);
  assert.equal(h.campaign.vampire.contact("sire").jobs, 1);
  assert.ok(h.campaign.vampire.state.notices.some(notice => /paid/.test(notice.text)));
  h.runtime.destroy();
});

test("menus and world locks do not advance production, donor recovery or hunger restoration", () => {
  const h = harness();
  const before = h.campaign.vampire.state.elapsed;
  h.runtime.openNetwork();
  assert.ok(h.scene.interactionSystem.menu.options.length <= 9);
  h.runtime.update(120, h.scene.currentInputFrame);
  assert.equal(h.campaign.vampire.state.elapsed, before);
  h.scene.interactionSystem.close();
  h.runtime.update(120, createEmptyInputFrame({ worldEnabled: false }));
  assert.equal(h.campaign.vampire.state.elapsed, before);
  h.runtime.destroy();
});

test("normal attacks and feeding change a persistent donor rather than an unrelated contact", () => {
  const h = harness();
  h.scene.events.emit("feeding:resolved", { targetId: "donor_iris", depth: "full_feed", victimAlive: true });
  assert.equal(h.campaign.vampire.state.donors.donor_iris.refused, true);
  assert.equal(h.campaign.vampire.state.donors.donor_eli.refused, false);
  const saved = h.campaign.export();
  h.campaign.import(saved, { persist: false });
  h.runtime.update(.05, h.scene.currentInputFrame);
  const iris = h.runtime.people.get("donor_iris");
  assert.equal(iris.feedingUnconscious, true);
  assert.equal(iris.combat.state, "downed");
  iris.dead = true;
  h.runtime.update(.05, h.scene.currentInputFrame);
  assert.equal(h.campaign.vampire.state.donors.donor_iris.dead, true);
  h.runtime.destroy();
});

test("campaign reset rebinds the network without duplicate people or stale progress", () => {
  const h = harness();
  h.campaign.vampire.meet("sire"); h.campaign.vampire.borrow();
  const iris = h.runtime.people.get("donor_iris");
  iris.dead = true;
  iris.combat.state = "dead";
  h.campaign.reset({ persist: false });
  h.runtime.update(.05, h.scene.currentInputFrame);
  assert.equal(h.campaign.vampire.contact("sire").debt, 0);
  assert.equal(h.campaign.vampire.state.bloodBags, 0);
  assert.equal(h.scene.npcSystem.npcs.length, 6);
  assert.equal(iris.dead, false);
  assert.equal(iris.combat.state, "active");
  h.runtime.destroy();
});

test("a reload at Hunger 100 enters frenzy and a reload preserves exhaustion", () => {
  const h = harness();
  h.scene.feedingSystem.hunger = 100;
  h.runtime.persistBody();
  const saved = h.campaign.export();
  h.campaign.import(saved, { persist: false });
  h.runtime.update(.05, h.scene.currentInputFrame);
  assert.equal(h.runtime.frenzy.active, true);
  h.runtime.frenzy.finish(true);
  h.campaign.import(h.campaign.export(), { persist: false });
  h.runtime.update(.05, h.scene.currentInputFrame);
  assert.equal(h.runtime.frenzy.exhausted(), true);
  assert.equal(h.runtime.frenzy.allowsPowers(), false);
  h.runtime.destroy();
});

test("owned refuges consume actual blood supplies and refuse active police pursuit", () => {
  const h = harness();
  h.campaign.vampire.meet("sire"); h.campaign.vampire.borrow();
  h.scene.playerDamageSystem.state.vitality = 20;
  h.scene.heatSystem.level = () => 2;
  assert.equal(h.runtime.refugeRecovery(), false);
  assert.equal(h.campaign.vampire.state.bloodBags, 2);
  h.scene.heatSystem.level = () => 0;
  assert.equal(h.runtime.refugeRecovery(), true);
  assert.equal(h.scene.playerDamageSystem.state.vitality, 65);
  assert.equal(h.campaign.vampire.state.bloodBags, 1);
  h.runtime.destroy();
});

test("the real core frame reconciles a power crossing 100 before movement and ticks the network once", () => {
  const h = harness(), s = h.scene;
  const raw = createEmptyInputFrame({ worldEnabled: true, move: { x: -1, y: 0 }, hasMovementIntent: true, dashPressed: true });
  s.inputSystem = { beginFrame: () => raw };
  Object.assign(s.playerDamageSystem, { preUpdate() {}, filterFrame: frame => frame, postUpdate() {}, blocksMovement: () => false });
  s.handleLayerDebugInput = () => {};
  s.powersSystem = { update() { s.feedingSystem.hunger = 100; } };
  s.collectInteractions = () => h.runtime.collectInteractions();
  s.npcSystem.update = () => {};
  s.witnessSystem = { update() {} };
  s.evidenceSystem = { update() {} };
  s.heatSystem.cool = () => {};
  s.exposureSystem = { cool() {} };
  s.policeSystem = { update() {} };
  s.missionSystem = { update() {} };
  let moved = null;
  s.updatePlayerMovement = (_dt, frame) => { moved = frame; };
  const prey = { id: "reachable_prey", x: s.player.x + 80, y: s.player.y, layer: 0, type: "civilian" };
  s.npcSystem.npcs.push(prey);
  s.feedingSystem.hunger = 88;
  const core = Object.create(GameplayRuntime.prototype);
  core.scene = s;
  core.diagnostics = { beginFrame() {}, beginSystem() {}, endSystem() {} };
  core.updateFinalizeSystems = () => {};
  core.finishFrame = () => {};
  const elapsed = h.campaign.vampire.state.elapsed;
  core.update(0, 50);
  assert.equal(h.campaign.vampire.state.elapsed - elapsed, .05);
  assert.equal(h.runtime.frenzy.active, true);
  assert.ok(moved.move.x > 0);
  assert.equal(moved.dashPressed, false);
  assert.equal(h.campaign.vampire.state.body.hunger, 100);
  h.runtime.destroy();
});

test("reloading a saved collapse resumes death recovery instead of granting a free revival", () => {
  const h = harness();
  h.campaign.vampire.state.body.vitality = 0;
  h.runtime.restored = false;
  let death = null;
  h.scene.events.on("player:died", payload => { death = payload; });
  const frame = h.runtime.update(.05, h.scene.currentInputFrame);
  assert.equal(frame.worldEnabled, false);
  assert.equal(h.scene.playerDamageSystem.state.dead, true);
  assert.equal(h.scene.playerDamageSystem.state.vitality, 0);
  assert.equal(death.sourceId, "saved_collapse");
  h.runtime.destroy();
});
