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

test("retired runtime adapters and feature patches are physically removed", async () => {
  for (const path of RETIRED_RUNTIME_FILES) {
    await assert.rejects(
      access(new URL(path, ROOT)),
      error => error?.code === "ENOENT",
      `${path} should not exist after consolidation`
    );
  }
});

test("main creates Phaser without patching scene prototypes", async () => {
  const content = await source("phaser/src/main.js");
  assert.equal(content.includes("GameScene.prototype"), false);
  assert.equal(content.includes("UIScene.prototype"), false);
  assert.equal(content.includes("new Phaser.Game(config)"), true);
});

test("GameScene delegates one update loop to GameplayRuntime", async () => {
  const content = await source("phaser/src/scenes/GameScene.js");
  assert.match(content, /this\.gameplayRuntime\s*=\s*new GameplayRuntime\(this\)/);
  assert.match(content, /update\(time, deltaMs\)\s*\{\s*this\.gameplayRuntime\?\.update/);
  assert.equal(content.includes("Phaser.Input.Keyboard.JustDown"), false);
});

test("task, objective, outskirts and sensory ownership comes from first-class systems", async () => {
  const runtime = await source("phaser/src/runtime/GameplayRuntime.js");
  assert.equal(runtime.includes("new TaskRevealSystem(scene)"), true);
  assert.equal(runtime.includes("new ObjectiveMarkerSystem(scene)"), true);
  assert.equal(runtime.includes("new OutskirtsSystem(scene)"), true);
  assert.equal(runtime.includes("new SensoryAwarenessSystem(scene)"), true);
});

test("campaign progression is owned by CampaignMissionAuthority and CampaignRunner", async () => {
  const bootstrap = await source("phaser/src/campaign/bootstrap.js");
  const mission = await source("phaser/src/systems/MissionSystem.js");
  assert.equal(bootstrap.includes("new CampaignMissionAuthority"), true);
  assert.equal(bootstrap.includes("CampaignRuntimeBridge"), false);
  assert.equal(mission.includes("this.campaign.handle"), true);
  assert.equal(mission.includes("attachCampaign(campaign)"), true);
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
  assert.match(bootstrap, /vendor\/phaser-3\.90\.0\.min\.js/);
  assert.match(bootstrap, /await import\("\.\/main\.js"\)/);
  assert.match(bootstrap, /await import\("\.\/responsive-layout\.js"\)/);
  assert.equal(bootstrap.includes("task-reveal-camera.js"), false);
  assert.match(bootstrap, /NBD_PHASER_SOURCE/);

  const packageJson = JSON.parse(await source("package.json"));
  assert.equal(packageJson.dependencies.phaser, "3.90.0");
});
