import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);

const RETIRED_RUNTIME_FILES = Object.freeze([
  "phaser/src/input/input-runtime.js",
  "phaser/src/input/movement-input-adapter.js",
  "phaser/src/input/tutorial-input-adapter.js",
  "phaser/src/movement/milestone5-runtime.js",
  "phaser/src/world/milestone6-runtime.js",
  "phaser/src/combat/combat-compatibility.js",
  "phaser/src/combat/police-alert-runtime.js",
  "phaser/src/ai/milestone8-runtime.js",
  "phaser/src/ai/police-turn-guard.js",
  "phaser/src/ai/sensory-priority-guard.js",
  "phaser/src/weapons/milestone7-ui.js",
  "phaser/src/ux/milestone9-runtime.js",
  "phaser/src/movement-controls.js",
  "phaser/src/task-reveal-camera.js",
  "phaser/src/task-reveal-timing.js",
  "phaser/src/tutorial-flow.js",
  "phaser/src/tutorial-copy.js",
  "phaser/src/tutorial-stop-after-tip.js",
  "phaser/src/dialogue-layout.js",
  "phaser/src/tutorial-encounter-order.js",
  "phaser/src/combat/combat-tutorial-copy.js",
  "phaser/src/movement/milestone5-tutorial-copy.js",
  "phaser/src/police-informant.js",
  "phaser/src/final-report-sire.js",
  "phaser/src/mission-return-finale.js",
  "phaser/src/english-copy.js",
  "phaser/src/objective-marker.js",
  "phaser/src/objective-marker-guard.js",
  "phaser/src/district-outskirts.js",
  "phaser/src/sensory-awareness.js",
  "phaser/src/campaign/CampaignRuntimeBridge.js"
]);

async function source(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

test("retired runtime adapters, patches and campaign bridge are physically removed", async () => {
  for (const path of RETIRED_RUNTIME_FILES) {
    await assert.rejects(
      access(new URL(path, ROOT)),
      error => error?.code === "ENOENT",
      `${path} should not exist after consolidation cleanup`
    );
  }
});

test("main creates Phaser without patching scene prototypes", async () => {
  const content = await source("phaser/src/main.js");
  assert.equal(content.includes("GameScene.prototype"), false);
  assert.equal(content.includes("UIScene.prototype"), false);
  assert.equal(content.includes("new Phaser.Game(config)"), true);
});

test("GameScene facade preserves one GameplayRuntime update owner", async () => {
  const facade = await source("phaser/src/scenes/GameScene.js");
  const core = await source("phaser/src/scenes/GameSceneCore.js");
  assert.match(facade, /extends GameSceneCore/);
  assert.match(core, /this\.gameplayRuntime\s*=\s*new GameplayRuntime\(this\)/);
  assert.match(core, /update\(time, deltaMs\)\s*\{\s*this\.gameplayRuntime\?\.update/);
  assert.equal(facade.includes("Phaser.Input.Keyboard.JustDown"), false);
  assert.equal(core.includes("Phaser.Input.Keyboard.JustDown"), false);
  assert.equal(facade.includes("prototype.__nbd"), false);
});

test("task, objective, outskirts, sensory and vehicle ownership comes from first-class systems", async () => {
  const facade = await source("phaser/src/runtime/GameplayRuntime.js");
  const core = await source("phaser/src/runtime/GameplayRuntimeCore.js");
  assert.match(facade, /extends GameplayRuntimeCore/);
  assert.equal(core.includes("new TaskRevealSystem(scene)"), true);
  assert.equal(core.includes("new ObjectiveMarkerSystem(scene)"), true);
  assert.equal(core.includes("new OutskirtsSystem(scene)"), true);
  assert.equal(core.includes("new SensoryAwarenessSystem(scene)"), true);
  assert.equal(facade.includes("new VehicleSystem(scene"), true);
  assert.equal(facade.includes('registerSystem("VehicleSystem")'), true);
  assert.equal(facade.includes("prototype.__nbd"), false);
});

test("campaign is preloaded before scenes and MissionSystem owns runner presentation directly", async () => {
  const bootstrap = await source("phaser/src/app-bootstrap.js");
  const preloadIndex = bootstrap.indexOf('await import("./campaign/preload.js")');
  const mainIndex = bootstrap.indexOf('await import("./main.js")');
  const campaignIndex = bootstrap.indexOf('await import("./campaign/bootstrap.js")');
  const tutorialIndex = bootstrap.indexOf('await import("./tutorial/bootstrap.js")');
  assert.ok(preloadIndex >= 0 && preloadIndex < mainIndex);
  assert.ok(campaignIndex > mainIndex && campaignIndex < tutorialIndex);

  const campaignBootstrap = await source("phaser/src/campaign/bootstrap.js");
  assert.equal(campaignBootstrap.includes("CampaignRuntimeBridge"), false);
  assert.equal(campaignBootstrap.includes("CampaignCheckpointSystem"), true);

  const mission = await source("phaser/src/systems/MissionSystem.js");
  assert.equal(mission.includes("CampaignRuntimeBridge"), false);
  assert.equal(mission.includes("this.campaign.handle"), true);
  assert.equal(mission.includes("globalThis.NBD_CAMPAIGN_SYSTEM"), true);
});

test("both playable routes use one pinned Phaser bootstrap", async () => {
  for (const path of ["index.html", "phaser/index.html"]) {
    const content = await source(path);
    assert.equal(content.includes("cdn.jsdelivr.net/npm/phaser"), false, path);
    assert.equal(content.includes("task-reveal-timing.js"), false, path);
    assert.equal(content.includes("movement-controls.js"), false, path);
    assert.equal(content.includes("tutorial-flow.js"), false, path);
    assert.equal(content.includes("app-bootstrap.js"), true, path);
  }

  const bootstrap = await source("phaser/src/app-bootstrap.js");
  assert.match(bootstrap, /node_modules\/phaser\/dist\/phaser\.min\.js/);
  assert.match(bootstrap, /new URL\([^\n]+import\.meta\.url\)\.href/);
  assert.match(bootstrap, /await import\("\.\/main\.js"\)/);
  assert.match(bootstrap, /await import\("\.\/responsive-layout\.js"\)/);
  assert.match(bootstrap, /await import\("\.\/testing\/bootstrap\.js"\)/);
  assert.equal(bootstrap.includes("task-reveal-camera.js"), false);
  assert.match(bootstrap, /NBD_PHASER_SOURCE/);

  const packageJson = JSON.parse(await source("package.json"));
  assert.equal(packageJson.dependencies.phaser, "3.90.0");
});
