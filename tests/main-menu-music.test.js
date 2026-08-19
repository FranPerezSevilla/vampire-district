import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("main menu theme asset is committed and owned by the title-screen flow", () => {
  const main = source("phaser/src/main.js");
  const menuScene = source("phaser/src/scenes/MainMenuScene.js");
  const gate = source("phaser/src/ui/TitleScreenAudioGate.js");

  assert.ok(existsSync(new URL("../phaser/assets/audio/music/main-menu-theme-01.m4a", import.meta.url)));
  assert.match(main, /main-menu-theme-01\.m4a/);
  assert.match(main, /audio\.loop = true/);
  assert.match(main, /MAIN_MENU_THEME_VOLUME = 0\.28/);
  assert.match(menuScene, /titleScreenAudioGate\.present\(\)/);
  assert.match(menuScene, /titleScreenAudioGate\.fadeOut\(430\)/);
  assert.match(gate, /PRESS ANY KEY TO START/);
});

test("title-screen audio gate unlocks browser autoplay on first real interaction", () => {
  const gate = source("phaser/src/ui/TitleScreenAudioGate.js");
  assert.match(gate, /window\.addEventListener\("keydown", this\.boundKeydown, true\)/);
  assert.match(gate, /gate\.addEventListener\("pointerdown", this\.boundUnlock, true\)/);
  assert.match(gate, /gate\.addEventListener\("touchstart", this\.boundUnlock/);
  assert.match(gate, /const started = await this\.theme\?\.start\?\.\(\)/);
  assert.match(gate, /NBD_TITLE_AUDIO_GATE_STATE = "playing"/);
  assert.doesNotMatch(source("phaser/src/main.js"), /installMainMenuThemePolicy/);
});

test("main menu credits expose the Satie attribution", () => {
  const gate = source("phaser/src/ui/TitleScreenAudioGate.js");
  const attribution = source("phaser/assets/audio/ATTRIBUTION.md");
  assert.match(gate, /Gnossienne No\. 1/);
  assert.match(gate, /Erik Satie \(1890\)/);
  assert.match(gate, /Arranged for ViceBlood/);
  assert.match(attribution, /Gnossienne No\. 1/);
  assert.match(attribution, /music\/main-menu-theme-01\.m4a/);
});
