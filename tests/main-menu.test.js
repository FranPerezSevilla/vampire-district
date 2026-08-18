import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const bootScene = readFileSync(new URL("../phaser/src/scenes/BootScene.js", import.meta.url), "utf8");
const mainScene = readFileSync(new URL("../phaser/src/scenes/MainMenuScene.js", import.meta.url), "utf8");
const titleController = readFileSync(new URL("../phaser/src/ui/TitleScreenController.js", import.meta.url), "utf8");
const titleCss = readFileSync(new URL("../phaser/title-screen.css", import.meta.url), "utf8");
const mainEntry = readFileSync(new URL("../phaser/src/main.js", import.meta.url), "utf8");
const appBootstrap = readFileSync(new URL("../phaser/src/app-bootstrap.js", import.meta.url), "utf8");
const campaignBootstrap = readFileSync(new URL("../phaser/src/campaign/bootstrap.js", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const phaserIndexHtml = readFileSync(new URL("../phaser/index.html", import.meta.url), "utf8");
const logoSvg = readFileSync(new URL("../phaser/assets/ui/viceblood-logo.svg", import.meta.url), "utf8");

test("normal boot routes through the ViceBlood main menu", () => {
  assert.match(bootScene, /this\.scene\.start\("MainMenuScene"\)/);
  assert.match(mainEntry, /MainMenuScene/);
  assert.match(mainEntry, /scene:\s*\[BootScene, MainMenuScene, GameScene, UIScene\]/);
});

test("RC browser tests retain direct gameplay boot and disable the title surface", () => {
  assert.match(bootScene, /window\.NBD_RC_TEST_MODE/);
  assert.match(bootScene, /this\.scene\.start\("GameScene"\)/);
  assert.match(bootScene, /this\.scene\.launch\("UIScene"\)/);
  assert.match(appBootstrap, /titleScreenController\.disableForHarness\(\)/);
});

test("title-menu boot starts a fresh police-response session without erasing long-lived exposure", () => {
  assert.ok(campaignBootstrap.includes('game?.scene?.isActive?.("MainMenuScene")'));
  assert.ok(campaignBootstrap.includes('scene.heatSystem?.clear?.("Main menu starts a fresh police-response session.")'));
  assert.ok(campaignBootstrap.includes("scene.heatSystem?.restoreState?.(campaign.state.heat)"));
  assert.ok(campaignBootstrap.includes("scene.exposureSystem?.restoreState?.(campaign.state.exposure)"));
  assert.doesNotMatch(campaignBootstrap, /exposureSystem\?\.clear/);
});

test("first paint and runtime menu use one persistent DOM title surface", () => {
  for (const html of [indexHtml, phaserIndexHtml]) {
    assert.match(html, /body class="viceblood-title-active"/);
    assert.match(html, /id="viceblood-title-screen"/);
    assert.match(html, /data-title-menu/);
    assert.match(html, /class="viceblood-title-boot-logo"/);
    assert.match(html, /class="viceblood-title-menu-logo"/);
    assert.match(html, /data-title-action="new-night"/);
    assert.match(html, /title-screen\.css/);
  }

  assert.match(titleController, /root\.dataset\.state = "prepared"/);
  assert.match(titleController, /root\.dataset\.state = "menu"/);
  assert.match(titleController, /await nextFrame\(this\.window\)/);
  assert.match(titleController, /NBD_TITLE_SCREEN_STATE/);
  assert.match(titleController, /publishState\("menu"\)/);
  assert.match(titleController, /publishState\("failure", message\)/);
  assert.doesNotMatch(appBootstrap, /NBD_DISMISS_BOOT_SPLASH/);
  assert.doesNotMatch(appBootstrap, /canvasFrameSnapshot|getBoundingClientRect|MENU_LAYOUT_STABLE_FRAMES/);
});

test("the canonical wordmark is clean ivory/red typography with no fang or distress marks", () => {
  assert.match(logoSvg, /fill="#f0ede6">VICE<\/text>/);
  assert.match(logoSvg, /fill="#c8101d">BLOOD<\/text>/);
  assert.doesNotMatch(logoSvg, /<path\b/);
  assert.doesNotMatch(logoSvg, /<circle\b/);
  assert.doesNotMatch(logoSvg, /<rect\b/);
  assert.doesNotMatch(logoSvg, /<linearGradient\b/);
  assert.doesNotMatch(logoSvg, /stroke=/);
  assert.doesNotMatch(logoSvg, /feTurbulence/);
  assert.doesNotMatch(logoSvg, /fang|distress|scratch/i);
});

test("MainMenuScene reveals the DOM menu from the authoritative GameScene create boundary", () => {
  assert.match(mainScene, /TitleScreenController\.js/);
  assert.match(mainScene, /Phaser\.Scenes\?\.Events\?\.CREATE \|\| "create"/);
  assert.match(mainScene, /gameScene\.events\.once\(createEvent, this\.previewCreateListener\)/);
  assert.match(mainScene, /titleScreenController\.present/);
  assert.match(mainScene, /this\.scene\.isActive\("GameScene"\) && gameScene\.inputSystem/);

  const registerIndex = mainScene.indexOf("gameScene.events.once(createEvent, this.previewCreateListener)");
  const launchIndex = mainScene.indexOf('this.scene.launch("GameScene")');
  assert.ok(registerIndex >= 0 && launchIndex > registerIndex, "GameScene CREATE listener must be registered before launch");

  assert.doesNotMatch(mainScene, /Phaser\.Core\?\.Events\?\.POST_RENDER|READY_RENDER_FRAMES/);
  assert.doesNotMatch(mainScene, /PREVIEW_READY_RETRY_MS|PREVIEW_READY_MAX_ATTEMPTS|delayedCall/);
  assert.doesNotMatch(mainScene, /this\.add\.(?:image|text|rectangle|graphics|container)/);
  assert.doesNotMatch(mainScene, /visibleViewportBounds|scheduleLayout|installFullscreenShell/);
  assert.doesNotMatch(mainScene, /getBoundingClientRect/);
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

test("viewport anchoring and full-height panels belong to CSS, not canvas crop maths", () => {
  assert.match(titleCss, /\.viceblood-title-brand\s*\{/);
  assert.match(titleCss, /top:\s*max\(clamp\(24px/);
  assert.match(titleCss, /left:\s*max\(clamp\(26px/);
  assert.match(titleCss, /\.viceblood-title-drawer\s*\{[\s\S]*inset:\s*0 auto 0 0/);
  assert.match(titleCss, /body\.viceblood-title-active #game-root canvas/);
  assert.match(titleCss, /width:\s*max\(100vw, 150vh\)/);
});

test("render quality belongs to the DOM Options drawer", () => {
  assert.match(titleController, /nbd-resolution-preset/);
  assert.match(titleController, /VERY HIGH/);
  assert.match(titleController, /openOptions\(\)/);
  assert.match(titleController, /applySelectedQuality\(\)/);
  assert.doesNotMatch(indexHtml, /resolution-select/);
  assert.doesNotMatch(phaserIndexHtml, /resolution-select/);
  assert.doesNotMatch(mainEntry, /bindResolutionSelector/);
});

test("NEW NIGHT hands control to the same running world without blackout or restart", () => {
  assert.match(mainScene, /await titleScreenController\.exitToGame\(\)/);
  assert.match(mainScene, /Hand control to the exact live scene/);
  assert.match(mainScene, /this\.restorePreviewControl\(\)/);
  assert.match(mainScene, /this\.scene\.launch\("UIScene"\)/);
  assert.doesNotMatch(mainScene, /transitionCurtain|\.fadeIn\(/);
  assert.doesNotMatch(mainScene, /this\.scene\.stop\("GameScene"\)/);
  assert.doesNotMatch(mainScene, /this\.scene\.restart\("GameScene"\)/);
});

test("menu exposes the approved semantic navigation surface", () => {
  for (const action of ["continue", "new-night", "options", "credits"]) {
    assert.match(indexHtml, new RegExp(`data-title-action="${action}"`));
  }
  assert.match(indexHtml, /data-title-action="continue"[^>]*disabled/);
});
