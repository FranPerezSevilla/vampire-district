import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("main menu theme asset is committed and owned by the title-screen flow", () => {
  const main = source("phaser/src/main.js");
  const menuScene = source("phaser/src/scenes/MainMenuScene.js");
  const gate = source("phaser/src/ui/TitleScreenAudioGate.js");
  const preloader = source("phaser/src/ui/TitleAssetPreloader.js");

  assert.ok(existsSync(new URL("../phaser/assets/audio/music/main-menu-theme-01.mp3", import.meta.url)));
  assert.match(main, /main-menu-theme-01\.mp3/);
  assert.match(main, /audio\.loop = true/);
  assert.match(main, /MAIN_MENU_THEME_VOLUME = 0\.28/);
  assert.match(menuScene, /preloadTitleExperience\(\)/);
  assert.match(menuScene, /waiting-for-title-assets/);
  assert.match(menuScene, /Promise\.resolve\(this\.assetsReady\)[\s\S]*awaiting-user-gesture[\s\S]*titleScreenAudioGate\.waitForStart\(\)[\s\S]*titleScreenController\.present/);
  assert.match(preloader, /Promise\.all\(jobs\)/);
  assert.match(menuScene, /titleScreenAudioGate\.fadeOut\(MENU_TO_GAME_MS\)/);
  assert.match(gate, /PRESS ANY KEY TO START/);
});

test("splash remains the autoplay gate while audio readiness cannot block menu presentation", () => {
  const gate = source("phaser/src/ui/TitleScreenAudioGate.js");
  assert.match(gate, /root\.dataset\.state = "boot"/);
  assert.match(gate, /bootMessage\.textContent = START_COPY/);
  assert.match(gate, /window\.addEventListener\("keydown", this\.boundKeydown, true\)/);
  assert.match(gate, /root\.addEventListener\("pointerdown", this\.boundPointer, true\)/);
  assert.match(gate, /root\.addEventListener\("touchstart", this\.boundTouch/);
  assert.match(gate, /const startAttempt = this\.theme\?\.start\?\.\(\)/);
  assert.match(gate, /Promise\.resolve\(startAttempt\)/);
  assert.match(gate, /NBD_TITLE_AUDIO_GATE_STATE = started \? "playing" : "blocked"/);
  assert.match(gate, /resolve\?\.\(true\)/);
  assert.doesNotMatch(gate, /await this\.theme\?\.start/);
  assert.doesNotMatch(source("phaser/src/main.js"), /installMainMenuThemePolicy/);
});

test("main menu credits expose the Satie attribution", () => {
  const gate = source("phaser/src/ui/TitleScreenAudioGate.js");
  const attribution = source("phaser/assets/audio/ATTRIBUTION.md");
  assert.match(gate, /Gnossienne No\. 1/);
  assert.match(gate, /Erik Satie \(1890\)/);
  assert.match(gate, /Arranged for ViceBlood/);
  assert.match(attribution, /Gnossienne No\. 1/);
  assert.match(attribution, /music\/main-menu-theme-01\.mp3/);
});
