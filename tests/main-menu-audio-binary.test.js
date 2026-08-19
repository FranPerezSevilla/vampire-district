import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";

const asset = path => new URL(`../phaser/assets/audio/music/${path}`, import.meta.url);
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("menu theme uses a complete browser runtime binary", () => {
  const mp3 = asset("main-menu-theme-01.mp3");
  const ogg = asset("main-menu-theme-01.ogg");
  const corruptM4a = asset("main-menu-theme-01.m4a");

  assert.equal(existsSync(mp3), true, "browser MP3 must exist");
  assert.ok(statSync(mp3).size > 100_000, "browser MP3 must not be truncated");
  assert.equal(existsSync(ogg), true, "validated OGG source must exist");
  assert.equal(statSync(ogg).size, 122_360, "validated OGG source must have the expected complete size");
  assert.equal(existsSync(corruptM4a), false, "the truncated M4A must be removed");

  const main = source("phaser/src/main.js");
  assert.match(main, /main-menu-theme-01\.mp3/);
  assert.doesNotMatch(main, /main-menu-theme-01\.m4a/);
});

test("theme warms during boot while splash remains the interaction gate", () => {
  const index = source("phaser/index.html");
  const main = source("phaser/src/main.js");
  const scene = source("phaser/src/scenes/MainMenuScene.js");
  const gate = source("phaser/src/ui/TitleScreenAudioGate.js");

  assert.match(index, /rel="preload"[^>]*main-menu-theme-01\.mp3[^>]*as="audio"/);
  assert.match(index, /id="viceblood-main-menu-theme"[^>]*main-menu-theme-01\.mp3[^>]*preload="auto"/);
  assert.match(main, /getElementById\("viceblood-main-menu-theme"\) \|\| new Audio\(MAIN_MENU_THEME_URL\)/);
  assert.match(main, /audio\.preload = "auto"/);
  assert.match(scene, /titleScreenAudioGate\.waitForStart\(\)[\s\S]*titleScreenController\.present/);
  assert.match(gate, /PRESS ANY KEY TO START/);
  assert.match(gate, /const started = await this\.theme\?\.start\?\.\(\)/);
  assert.match(gate, /if \(!started\)/);
});
