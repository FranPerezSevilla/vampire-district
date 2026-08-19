import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("main menu theme asset is committed and wired as a loop with fade-out", () => {
  const main = source("phaser/src/main.js");
  assert.ok(existsSync(new URL("../phaser/assets/audio/music/main-menu-theme-01.m4a", import.meta.url)));
  assert.match(main, /main-menu-theme-01\.m4a/);
  assert.match(main, /audio\.loop = true/);
  assert.match(main, /MAIN_MENU_THEME_VOLUME = 0\.28/);
  assert.match(main, /MainMenuScene\.prototype\.beginNight[\s\S]*fadeOut\(MAIN_MENU_THEME_FADE_MS\)/);
  assert.match(main, /SHUTDOWN[\s\S]*fadeOut\(120\)/);
});

test("main menu credits expose the Satie attribution", () => {
  const main = source("phaser/src/main.js");
  const attribution = source("phaser/assets/audio/ATTRIBUTION.md");
  assert.match(main, /Gnossienne No\. 1/);
  assert.match(main, /Erik Satie \(1890\)/);
  assert.match(main, /Arranged for ViceBlood/);
  assert.match(attribution, /Gnossienne No\. 1/);
  assert.match(attribution, /music\/main-menu-theme-01\.m4a/);
});
