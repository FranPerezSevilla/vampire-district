import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { CampaignSystem } from "../phaser/src/campaign/CampaignSystem.js";
import { VampireRuntime } from "../phaser/src/vampire/VampireRuntime.js";
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
    feedingSystem: { hunger: 50, isActive: () => false, relieveHunger() {} }
  };
  scene.interactionSystem = new InteractionSystem(scene);
  const runtime = new VampireRuntime(scene);
  scene.vampireRuntime = runtime;
  runtime.update(.01, scene.currentInputFrame);
  return { scene, runtime };
}

test("domain options 1-6 keep navigating after the world input frame is paused", () => {
  const { scene, runtime } = harness();
  assert.equal(runtime.openDomain("overview"), true);
  assert.equal(runtime.domain.tab, "city");

  scene.currentInputFrame = createEmptyInputFrame({ worldEnabled: false });
  scene.interactionSystem.updateInput(createEmptyInputFrame({ menuDigitPressed: 5 }));

  assert.equal(runtime.domain.tab, "errand");
  assert.equal(scene.interactionSystem.menu?.view, "vampire-domain");
  assert.equal(scene.interactionSystem.menu?.index, 4);

  scene.interactionSystem.updateInput(createEmptyInputFrame({ menuDigitPressed: 2 }));
  assert.equal(runtime.domain.tab, "contacts");
  assert.equal(scene.interactionSystem.menu?.view, "vampire-domain");
  assert.equal(scene.interactionSystem.menu?.index, 1);
  runtime.destroy();
});
