import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

test("the legacy movement entry no longer loads core runtime patches", async () => {
  const content = await source("phaser/src/movement-controls.js");
  const retiredImports = [
    "input/input-runtime.js",
    "input/movement-input-adapter.js",
    "movement/milestone5-runtime.js",
    "world/milestone6-runtime.js",
    "combat/combat-compatibility.js",
    "combat/police-alert-runtime.js",
    "ai/milestone8-runtime.js",
    "ai/police-turn-guard.js",
    "ai/sensory-priority-guard.js",
    "weapons/milestone7-ui.js",
    "ux/milestone9-runtime.js"
  ];
  for (const retired of retiredImports) assert.equal(content.includes(retired), false, retired);
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

test("task, objective and outskirts ownership no longer comes from feature patches", async () => {
  const content = await source("phaser/src/task-reveal-camera.js");
  assert.equal(content.includes("objective-marker.js"), false);
  assert.equal(content.includes("objective-marker-guard.js"), false);
  assert.equal(content.includes("district-outskirts.js"), false);
  assert.equal(content.includes("sensory-awareness.js"), false);

  const runtime = await source("phaser/src/runtime/GameplayRuntime.js");
  assert.equal(runtime.includes("new TaskRevealSystem(scene)"), true);
  assert.equal(runtime.includes("new ObjectiveMarkerSystem(scene)"), true);
  assert.equal(runtime.includes("new OutskirtsSystem(scene)"), true);
  assert.equal(runtime.includes("new SensoryAwarenessSystem(scene)"), true);
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
  assert.match(bootstrap, /await import\("\.\/main\.js"\)/);
  assert.match(bootstrap, /NBD_PHASER_SOURCE/);

  const packageJson = JSON.parse(await source("package.json"));
  assert.equal(packageJson.dependencies.phaser, "3.90.0");
});
