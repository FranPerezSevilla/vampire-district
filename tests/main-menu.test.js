import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const bootScene = readFileSync(new URL("../phaser/src/scenes/BootScene.js", import.meta.url), "utf8");
const mainScene = readFileSync(new URL("../phaser/src/scenes/MainMenuScene.js", import.meta.url), "utf8");
const mainEntry = readFileSync(new URL("../phaser/src/main.js", import.meta.url), "utf8");
const appBootstrap = readFileSync(new URL("../phaser/src/app-bootstrap.js", import.meta.url), "utf8");
const campaignBootstrap = readFileSync(new URL("../phaser/src/campaign/bootstrap.js", import.meta.url), "utf8");
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

test("title-menu boot starts a fresh police-response session without erasing long-lived exposure", () => {
  assert.ok(campaignBootstrap.includes('game?.scene?.isActive?.("MainMenuScene")'));
  assert.ok(campaignBootstrap.includes('scene.heatSystem?.clear?.("Main menu starts a fresh police-response session.")'));
  assert.ok(campaignBootstrap.includes("scene.heatSystem?.restoreState?.(campaign.state.heat)"));
  assert.ok(campaignBootstrap.includes("scene.exposureSystem?.restoreState?.(campaign.state.exposure)"));
  assert.doesNotMatch(campaignBootstrap, /exposureSystem\?\.clear/);
  assert.match(campaignBootstrap, /Direct gameplay\/test harness boots intentionally keep the saved Heat contract/);
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

test("splash waits for a stable rendered canvas before revealing the title menu", () => {
  assert.match(appBootstrap, /MENU_LAYOUT_STABLE_FRAMES = 3/);
  assert.match(appBootstrap, /MENU_LAYOUT_MAX_FRAMES = 18/);
  assert.match(appBootstrap, /canvas\?\.getBoundingClientRect\?\.\(\)/);
  assert.match(appBootstrap, /canvasFrameIsStable\(previous, current\)/);
  assert.match(appBootstrap, /splash\.dataset\.dismissPending = "true"/);
  assert.match(appBootstrap, /requestAnimationFrame\(sampleUntilStable\)/);
  assert.match(appBootstrap, /Give MainMenuScene one final paint after the last stable measurement/);
  assert.match(appBootstrap, /finishViceBloodBootSplashDismissal\(splash\)/);
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

test("main menu keeps the authoritative GameScene alive but freezes player aim", () => {
  assert.match(mainScene, /this\.scene\.launch\("GameScene"\)/);
  assert.doesNotMatch(mainScene, /this\.scene\.pause\("GameScene"\)/);
  assert.match(mainScene, /gameScene\.input\.enabled = false/);
  assert.match(mainScene, /inputSystem\.setWorldEnabled\?\.\(false\)/);
  assert.match(mainScene, /inputSystem\.pointerWorldPoint = \(\) => inputSystem\.playerFallbackPoint\(\)/);
  assert.match(mainScene, /combatGraphics\.setVisible\(false\)/);
  assert.doesNotMatch(mainScene, /new\s+GameScene/);
});

test("fullscreen menu measures the real rendered canvas crop", () => {
  assert.match(mainScene, /visibleViewportBounds\(\)/);
  assert.match(mainScene, /canvas\?\.getBoundingClientRect\?\.\(\)/);
  assert.match(mainScene, /const scaleX = rect\.width \/ gameWidth/);
  assert.match(mainScene, /const top = Math\.max\(0, -rect\.top\)/);
  assert.match(mainScene, /scheduleLayout\(\)/);
  assert.match(mainScene, /requestAnimationFrame/);
  assert.match(mainScene, /const safeTop = Math\.max\(this\.cssY\(view, 34\)/);
});

test("main menu remains fullscreen through the live-scene handoff", () => {
  assert.match(mainScene, /viceblood-menu-active/);
  assert.match(mainScene, /viceblood-world-active/);
  assert.match(mainScene, /100vw/);
  assert.match(mainScene, /100vh/);
  assert.match(mainScene, /document\.body\.classList\.add\(WORLD_BODY_CLASS\)/);
  assert.match(mainScene, /body\.\$\{WORLD_BODY_CLASS\} \.game-frame/);
});

test("render quality lives inside a drawer that bleeds through the full canvas height", () => {
  assert.match(mainScene, /nbd-resolution-preset/);
  assert.match(mainScene, /RENDER QUALITY/);
  assert.match(mainScene, /VERY HIGH/);
  assert.match(mainScene, /panelBackdrop\.setPosition\(0, 0\)\.setSize\(drawerRight, height\)/);
  assert.match(mainScene, /panel can never stop short of the browser bottom/);
  assert.doesNotMatch(indexHtml, /resolution-select/);
  assert.doesNotMatch(indexHtml, /Render quality/);
});

test("NEW NIGHT hands control to the already-running GameScene without blackout or restart", () => {
  assert.match(mainScene, /Hand control to the exact live scene/);
  assert.match(mainScene, /this\.restorePreviewControl\(\)/);
  assert.match(mainScene, /this\.scene\.launch\("UIScene"\)/);
  assert.doesNotMatch(mainScene, /transitionCurtain/);
  assert.doesNotMatch(mainScene, /\.fadeIn\(/);
  assert.doesNotMatch(mainScene, /this\.scene\.stop\("GameScene"\)/);
  assert.doesNotMatch(mainScene, /this\.scene\.restart\("GameScene"\)/);
});

test("menu exposes the initial navigation surface", () => {
  for (const label of ["CONTINUE", "NEW NIGHT", "OPTIONS", "CREDITS"]) {
    assert.ok(mainScene.includes(label), `expected ${label} in main menu`);
  }
});
