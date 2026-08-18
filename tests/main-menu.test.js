import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const bootScene = readFileSync(new URL("../phaser/src/scenes/BootScene.js", import.meta.url), "utf8");
const mainScene = readFileSync(new URL("../phaser/src/scenes/MainMenuScene.js", import.meta.url), "utf8");
const mainEntry = readFileSync(new URL("../phaser/src/main.js", import.meta.url), "utf8");
const appBootstrap = readFileSync(new URL("../phaser/src/app-bootstrap.js", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const logoSvg = readFileSync(new URL("../phaser/assets/ui/viceblood-logo.svg", import.meta.url), "utf8");

test("normal boot routes through the ViceBlood main menu", () => {
  assert.match(bootScene, /this\.scene\.start\("MainMenuScene"\)/);
  assert.match(mainEntry, /MainMenuScene/);
  assert.match(mainEntry, /scene:\s*\[BootScene, MainMenuScene, GameScene, UIScene\]/);
});

test("RC browser tests retain direct gameplay boot", () => {
  assert.match(bootScene, /window\.NBD_RC_TEST_MODE/);
  assert.match(bootScene, /this\.scene\.start\("GameScene"\)/);
  assert.match(bootScene, /this\.scene\.launch\("UIScene"\)/);
  assert.match(appBootstrap, /dismissViceBloodBootSplash\(\{ immediate: true \}\)/);
});

test("first paint is a fitted ViceBlood splash instead of the legacy shell", () => {
  assert.match(indexHtml, /body class="viceblood-booting"/);
  assert.match(indexHtml, /id="viceblood-boot-splash"/);
  assert.match(indexHtml, /phaser\/assets\/ui\/viceblood-logo\.svg/);
  assert.match(indexHtml, /body\.viceblood-booting \.shell\s*\{\s*visibility:\s*hidden/);
  assert.match(indexHtml, /object-fit:\s*contain/);
  assert.match(indexHtml, /max-height:\s*min\(46vh, 420px\)/);
  assert.match(appBootstrap, /NBD_DISMISS_BOOT_SPLASH/);
  assert.match(mainScene, /revealMenuFromSplash\(\)/);
});

test("the production wordmark has no full-rectangle turbulence noise", () => {
  assert.doesNotMatch(logoSvg, /feTurbulence/);
  assert.doesNotMatch(logoSvg, /filter="url\(#rough\)"/);
});

test("main menu keeps the authoritative GameScene alive but freezes player aim", () => {
  assert.match(mainScene, /this\.scene\.launch\("GameScene"\)/);
  assert.doesNotMatch(mainScene, /this\.scene\.pause\("GameScene"\)/);
  assert.match(mainScene, /gameScene\.input\.enabled = false/);
  assert.match(mainScene, /inputSystem\.setWorldEnabled\?\.\(false\)/);
  assert.match(mainScene, /inputSystem\.pointerWorldPoint = \(\) => inputSystem\.playerFallbackPoint\(\)/);
  assert.match(mainScene, /combatGraphics\.setVisible\(false\)/);
  assert.doesNotMatch(mainScene, /new\s+GameScene/);
});

test("main menu anchors UI to the visible fullscreen crop", () => {
  assert.match(mainScene, /phaser\/assets\/ui\/viceblood-logo\.svg/);
  assert.match(mainScene, /viceblood-menu-active/);
  assert.match(mainScene, /#game-ui/);
  assert.match(mainScene, /100vw/);
  assert.match(mainScene, /100vh/);
  assert.match(mainScene, /visibleViewportBounds\(\)/);
  assert.match(mainScene, /Anchor the brand to the actually visible top-left/);
});

test("render quality lives inside a full-height OPTIONS drawer", () => {
  assert.match(mainScene, /nbd-resolution-preset/);
  assert.match(mainScene, /RENDER QUALITY/);
  assert.match(mainScene, /VERY HIGH/);
  assert.match(mainScene, /const boxHeight = view\.height/);
  assert.match(mainScene, /full-height left drawer/);
  assert.doesNotMatch(indexHtml, /resolution-select/);
  assert.doesNotMatch(indexHtml, /Render quality/);
});

test("NEW NIGHT keeps the logo through the cinematic zoom before blackout", () => {
  assert.match(mainScene, /targets:\s*previewCamera/);
  assert.match(mainScene, /zoom:\s*targetZoom/);
  assert.match(mainScene, /Logo survives most of the zoom/);
  assert.match(mainScene, /targets:\s*this\.logo/);
  assert.match(mainScene, /transitionCurtain/);
  assert.match(mainScene, /finishNightTransition\(\)/);
});

test("menu exposes the initial navigation surface", () => {
  for (const label of ["CONTINUE", "NEW NIGHT", "OPTIONS", "CREDITS"]) {
    assert.ok(mainScene.includes(label), `expected ${label} in main menu`);
  }
});
