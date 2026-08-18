import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const bootScene = readFileSync(new URL("../phaser/src/scenes/BootScene.js", import.meta.url), "utf8");
const mainScene = readFileSync(new URL("../phaser/src/scenes/MainMenuScene.js", import.meta.url), "utf8");
const mainEntry = readFileSync(new URL("../phaser/src/main.js", import.meta.url), "utf8");

test("normal boot routes through the ViceBlood main menu", () => {
  assert.match(bootScene, /this\.scene\.start\("MainMenuScene"\)/);
  assert.match(mainEntry, /MainMenuScene/);
  assert.match(mainEntry, /scene:\s*\[BootScene, MainMenuScene, GameScene, UIScene\]/);
});

test("RC browser tests retain direct gameplay boot", () => {
  assert.match(bootScene, /window\.NBD_RC_TEST_MODE/);
  assert.match(bootScene, /this\.scene\.start\("GameScene"\)/);
  assert.match(bootScene, /this\.scene\.launch\("UIScene"\)/);
});

test("main menu previews the authoritative GameScene instead of duplicating gameplay", () => {
  assert.match(mainScene, /this\.scene\.launch\("GameScene"\)/);
  assert.match(mainScene, /this\.scene\.pause\("GameScene"\)/);
  assert.match(mainScene, /this\.scene\.resume\("GameScene"\)/);
  assert.doesNotMatch(mainScene, /new\s+GameScene/);
});

test("menu exposes the initial navigation surface", () => {
  for (const label of ["CONTINUE", "NEW NIGHT", "OPTIONS", "CREDITS"]) {
    assert.ok(mainScene.includes(label), `expected ${label} in main menu`);
  }
});
