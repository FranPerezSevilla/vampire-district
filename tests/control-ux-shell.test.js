import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const titleControllerUrl = new URL("../phaser/src/ui/TitleScreenController.js", import.meta.url);
const uiUrl = new URL("../phaser/src/scenes/UIScene.js", import.meta.url);
const guidanceUrl = new URL("../phaser/src/systems/UxGuidanceSystem.js", import.meta.url);

test("weapon wheel remains a control without an intrusive contextual wheel tutorial", async () => {
  const guidance = await readFile(guidanceUrl, "utf8");
  assert.doesNotMatch(guidance, /Change weapon\. Scroll once/i);
  assert.doesNotMatch(guidance, /weapon:changed/);
  assert.doesNotMatch(guidance, /AWAITING_CYCLE/);
});

test("DOM main menu owns a dedicated controls panel backed by the canonical control reference", async () => {
  const controller = await readFile(titleControllerUrl, "utf8");
  assert.match(controller, /buildControlReference/);
  assert.match(controller, /loadInputBindings/);
  assert.match(controller, /dataset\.titleAction = "controls"/);
  assert.match(controller, /else if \(action === "controls"\) this\.openControls\(\)/);
  assert.match(controller, /this\.drawerTitle\.textContent = "CONTROLS"/);
  assert.match(controller, /this\.drawerBody\.textContent = buildControlReference\(bindings\)/);
});

test("Escape owns pause and H is no longer an alternate help-menu shortcut", async () => {
  const ui = await readFile(uiUrl, "utf8");
  assert.match(ui, /else if \(code === "Escape"\)/);
  assert.match(ui, /handled = this\.togglePause\(\)/);
  assert.doesNotMatch(ui, /uiOwnsH/);
  assert.doesNotMatch(ui, /Close · H \/ Esc/);
  assert.match(ui, /Close · Esc/);
});
