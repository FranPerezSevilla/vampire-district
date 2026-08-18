import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const bootstrapUrl = new URL("../phaser/src/app-bootstrap.js", import.meta.url);

async function source() {
  return readFile(bootstrapUrl, "utf8");
}

test("hosted builds skip the unavailable node_modules Phaser request", async () => {
  const bootstrap = await source();

  assert.match(bootstrap, /function localPhaserAllowed\(\)/);
  assert.match(bootstrap, /protocol === "file:"/);
  assert.match(bootstrap, /hostname === "localhost"/);
  assert.match(bootstrap, /hostname === "127\.0\.0\.1"/);
  assert.match(bootstrap, /function phaserScriptSources\(\)/);
  assert.match(bootstrap, /\? \[LOCAL_PHASER_SOURCE, \.\.\.CDN_PHASER_SOURCES\]/);
  assert.match(bootstrap, /: CDN_PHASER_SOURCES/);
  assert.match(bootstrap, /for \(const source of phaserScriptSources\(\)\)/);
});

test("development still retains the pinned local Phaser source and CDN fallback", async () => {
  const bootstrap = await source();

  assert.match(bootstrap, /node_modules\/phaser\/dist\/phaser\.min\.js/);
  assert.match(bootstrap, /cdn\.jsdelivr\.net\/npm\/phaser@\$\{PHASER_VERSION\}/);
  assert.match(bootstrap, /unpkg\.com\/phaser@\$\{PHASER_VERSION\}/);
});

test("boot splash waits for the runtime logo and navigation to stabilize", async () => {
  const bootstrap = await source();

  assert.match(bootstrap, /MENU_LAYOUT_STABLE_FRAMES = 5/);
  assert.match(bootstrap, /MENU_LAYOUT_MAX_FRAMES = 120/);
  assert.match(bootstrap, /function mainMenuPresentationSnapshot\(\)/);
  assert.match(bootstrap, /getScene\?\.\("MainMenuScene"\)/);
  assert.match(bootstrap, /const logo = scene\?\.logo/);
  assert.match(bootstrap, /const firstRow = scene\?\.menuRows\?\.find/);
  assert.match(bootstrap, /logoInsideVisibleViewport/);
  assert.match(bootstrap, /mainMenuPresentationIsStable/);
  assert.match(bootstrap, /canvasStableFrames >= MENU_LAYOUT_STABLE_FRAMES/);
  assert.match(bootstrap, /menuStableFrames >= MENU_LAYOUT_STABLE_FRAMES/);
  assert.match(bootstrap, /two final paints after the canvas AND title UI are stable/);
  assert.match(bootstrap, /requestAnimationFrame\(\(\) => \{\s*requestAnimationFrame/);
});
