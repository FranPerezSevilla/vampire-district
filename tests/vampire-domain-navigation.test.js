import test from "node:test";
import assert from "node:assert/strict";
import { VampireDomainPanel } from "../phaser/src/vampire/VampireDomainPanel.js";
import { objectiveBearing } from "../phaser/src/vampire/VampireHud.js";

function panelHarness() {
  let published = 0;
  const interactionSystem = {
    menu: { view: "vampire-domain", index: 0 },
    publish() { published++; },
    close() { this.menu = null; }
  };
  const runtime = {
    service: { state: { guide: "contact:sire" } },
    frenzy: { active: false },
    scene: {
      interactionSystem,
      transitionSystem: { active: false },
      playerDamageSystem: { isDead: () => false }
    }
  };
  const panel = Object.create(VampireDomainPanel.prototype);
  Object.assign(panel, { runtime, tab: "overview", selection: "contact:sire", zoom: 1, revision: 0, confirmAbandon: false, root: null });
  return { panel, runtime, published: () => published };
}

function click(panel, action, target = "") {
  panel.click({ target: { closest: () => ({ dataset: { action, target } }) } });
}

test("domain tabs remain clickable while the gameplay world is paused", () => {
  const h = panelHarness();
  click(h.panel, "tab", "contacts");
  assert.equal(h.panel.tab, "contacts");
  assert.equal(h.runtime.scene.interactionSystem.menu.index, 1);
  assert.equal(h.published(), 1);

  click(h.panel, "map", "contact:sire");
  assert.equal(h.panel.tab, "map");
  assert.equal(h.panel.selection, "contact:sire");
  assert.equal(h.panel.zoom, 2);
  assert.equal(h.runtime.scene.interactionSystem.menu.index, 5);
});

test("objective bearing rotates a north-facing HUD arrow toward the tracked target", () => {
  assert.deepEqual(objectiveBearing({ x: 10, y: 10 }, { x: 10, y: 0 }), { distance: 10, angle: 0 });
  assert.deepEqual(objectiveBearing({ x: 10, y: 10 }, { x: 20, y: 10 }), { distance: 10, angle: 90 });
  assert.deepEqual(objectiveBearing({ x: 10, y: 10 }, { x: 10, y: 20 }), { distance: 10, angle: 180 });
  assert.equal(objectiveBearing(null, { x: 0, y: 0 }), null);
});
