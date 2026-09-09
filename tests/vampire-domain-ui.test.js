import test from "node:test";
import assert from "node:assert/strict";

// Exercise the real UI handlers natively, without launching a browser or Phaser.
globalThis.Phaser = { Scene: class {} };
const { UIScene } = await import("../phaser/src/scenes/UIScene.js");

function harness() {
  let closed = 0, rendered = 0, opened = null;
  const game = { interactionSystem: { menu: { view: "vampire-domain" }, close() { closed++; this.menu = null; } },
    vampireRuntime: { domain: { tab: "overview", render() { rendered++; } }, openDomain(tab) { opened = tab; } } };
  const ui = Object.create(UIScene.prototype);
  Object.assign(ui, { scene: { get: () => game }, registry: new Map(), introOpen: false, pauseOpen: false, resultOpen: false, ledgerOpen: false, missionOpen: false });
  return { ui, game, result: () => ({ closed, rendered, opened }) };
}

test("Escape closes the domain without opening the pause modal or leaving an invisible input lock", () => {
  const h = harness();
  let prevented = false;
  h.ui.handleDomKeyDown({ code: "Escape", target: {}, preventDefault() { prevented = true; }, stopPropagation() {} });
  assert.equal(h.result().closed, 1);
  assert.equal(h.result().rendered, 1);
  assert.equal(h.ui.pauseOpen, false);
  assert.equal(h.game.interactionSystem.menu, null);
  assert.equal(prevented, true);
});

test("the existing mission shortcut opens the active errand section and closes it on a second press", () => {
  const h = harness();
  h.ui.toggleMissionDrawer();
  assert.equal(h.result().opened, "errand");
  assert.equal(h.ui.missionOpen, false);
  h.game.vampireRuntime.domain.tab = "errand";
  h.ui.toggleMissionDrawer();
  assert.equal(h.result().closed, 1);
});

test("opening a blocking modal hides the domain even while the gameplay scene is paused", () => {
  const h = harness();
  let blocked = null, paused = null;
  h.game.vampireRuntime.domain.render = (_menu, hidden) => { blocked = hidden; };
  h.ui.scene.pause = () => { paused = true; };
  h.ui.scene.resume = () => { paused = false; };
  h.ui.pauseOpen = true; h.ui.updateUiPause();
  assert.equal(blocked, true); assert.equal(paused, true);
  h.ui.pauseOpen = false; h.ui.updateUiPause();
  assert.equal(blocked, false); assert.equal(paused, false);
});
