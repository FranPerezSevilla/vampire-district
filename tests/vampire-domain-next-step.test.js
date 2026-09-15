import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { CampaignSystem } from "../phaser/src/campaign/CampaignSystem.js";
import { VampireRuntime } from "../phaser/src/vampire/VampireRuntime.js";
import { buildDomainModel } from "../phaser/src/vampire/VampireDomainModel.js";
import { InteractionSystem } from "../phaser/src/systems/InteractionSystemCore.js";
import { createEmptyInputFrame } from "../phaser/src/input/actions.js";
import { buildings, CITY_WORLD } from "../phaser/src/data/district.js";

function harness() {
  const campaign = new CampaignSystem({ autoLoad: false, autoSave: false, now: () => 1000 });
  const scene = {
    campaignSystem: campaign,
    registry: new Map(),
    events: new EventEmitter(),
    currentLayer: 0,
    player: { x: 1540, y: 1575 },
    currentInputFrame: createEmptyInputFrame({ worldEnabled: true }),
    canStandAt: (x, y) => x >= 4 && y >= 4 && x <= CITY_WORLD.width - 4 && y <= CITY_WORLD.height - 4 && !buildings.some(b => x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4),
    npcSystem: { npcs: [], createNpc: def => ({ ...def }), rebuildSpatialIndex() {} },
    playerDamageSystem: { state: { vitality: 100 }, isDead: () => false },
    feedingSystem: { hunger: 50, isActive: () => false, relieveHunger(amount) { this.hunger = Math.max(0, this.hunger - amount); } }
  };
  scene.interactionSystem = new InteractionSystem(scene);
  const runtime = new VampireRuntime(scene);
  scene.vampireRuntime = runtime;
  runtime.update(.01, scene.currentInputFrame);
  return { campaign, scene, runtime, v: campaign.vampire };
}

test("an active errand owns the overview next step until it is completed", () => {
  const h = harness();
  assert.ok(h.v.meet("sire").ok);
  assert.ok(h.v.acceptDelivery("sire").ok);

  let model = buildDomainModel(h.runtime);
  assert.equal(model.next.target, "delivery");
  assert.equal(model.next.text, "Collect the sealed supplies");
  assert.match(model.next.why, /Sire.*1\/2.*hospital/i);

  assert.ok(h.v.handoff(h.v.deliverySite()).ok);
  model = buildDomainModel(h.runtime);
  assert.equal(model.next.target, "delivery");
  assert.equal(model.next.text, "Deliver the cargo");
  assert.match(model.next.why, /Sire.*2\/2.*club/i);

  assert.ok(h.v.handoff(h.v.deliverySite()).ok);
  model = buildDomainModel(h.runtime);
  assert.notEqual(model.next.target, "delivery");
  h.runtime.destroy();
});
