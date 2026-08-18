import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const bootScene = readFileSync(new URL("../phaser/src/scenes/BootScene.js", import.meta.url), "utf8");
const mainScene = readFileSync(new URL("../phaser/src/scenes/MainMenuScene.js", import.meta.url), "utf8");
const mainEntry = readFileSync(new URL("../phaser/src/main.js", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");

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

test("main menu keeps the authoritative GameScene alive as its background", () => {
  assert.match(mainScene, /this\.scene\.launch\("GameScene"\)/);
  assert.doesNotMatch(mainScene, /this\.scene\.pause\("GameScene"\)/);
  assert.match(mainScene, /gameScene\.input\.enabled = false/);
  assert.doesNotMatch(mainScene, /new\s+GameScene/);
});

test("main menu uses the production logo path and fullscreen presentation", () => {
  assert.match(mainScene, /phaser\/assets\/ui\/viceblood-logo\.svg/);
  assert.match(mainScene, /viceblood-menu-active/);
  assert.match(mainScene, /#game-ui/);
  assert.match(mainScene, /100vw/);
  assert.match(mainScene, /100vh/);
});

test("render quality lives inside OPTIONS instead of the page header", () => {
  assert.match(mainScene, /nbd-resolution-preset/);
  assert.match(mainScene, /RENDER QUALITY/);
  assert.match(mainScene, /VERY HIGH/);
  assert.doesNotMatch(indexHtml, /resolution-select/);
  assert.doesNotMatch(indexHtml, /Render quality/);
});

test("menu exposes the initial navigation surface", () => {
  for (const label of ["CONTINUE", "NEW NIGHT", "OPTIONS", "CREDITS"]) {
    assert.ok(mainScene.includes(label), `expected ${label} in main menu`);
  }
});
