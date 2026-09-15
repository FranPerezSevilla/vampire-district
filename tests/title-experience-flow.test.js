import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const menuSource = fs.readFileSync(new URL("../phaser/src/scenes/MainMenuScene.js", import.meta.url), "utf8");
const bootstrapSource = fs.readFileSync(new URL("../phaser/src/app-bootstrap.js", import.meta.url), "utf8");
const viewportSource = fs.readFileSync(new URL("../phaser/src/responsive-layout.js", import.meta.url), "utf8");
const preloadSource = fs.readFileSync(new URL("../phaser/src/ui/TitleAssetPreloader.js", import.meta.url), "utf8");

test("title waits for asset preload before exposing the user audio gesture", () => {
  assert.match(menuSource, /this\.assetsReady = preloadTitleExperience\(\)/);
  assert.match(menuSource, /Promise\.all\(\[this\.assetsReady, this\.waitForPreviewGeometry\(gameScene\)\]\)[\s\S]*titleScreenAudioGate\.waitForStart\(\)/);
  assert.match(preloadSource, /Promise\.all\(jobs\)/);
  assert.match(preloadSource, /SAMPLE_AUDIO_IDS/);
});

test("main menu composes the player to the right and eases back to centered gameplay", () => {
  assert.match(menuSource, /MENU_CAMERA_HORIZONTAL_BIAS = 0\.22/);
  assert.match(menuSource, /camera\.getScroll\(player\.x - viewWidth \* visibleFraction \* MENU_CAMERA_HORIZONTAL_BIAS/);
  assert.match(menuSource, /updateCameraTransition\(\)/);
  assert.match(menuSource, /frame\.centeredX - this\.cameraTransitionFrom\.x/);
  assert.match(menuSource, /startFollow\?\.\(gameScene\.player, true, 0\.12, 0\.12\)/);
});

test("viewport layout no longer scales or re-parents the UI tree", () => {
  assert.doesNotMatch(bootstrapSource, /installDomainViewportPortal/);
  assert.match(viewportSource, /ResizeObserver/);
  assert.doesNotMatch(viewportSource, /ui\.style\.(width|height|transform)/);
  assert.doesNotMatch(viewportSource, /DESIGN_WIDTH|DESIGN_HEIGHT/);
});
