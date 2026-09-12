import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const bootstrapUrl = new URL("../phaser/src/app-bootstrap.js", import.meta.url);

async function source() {
  return readFile(bootstrapUrl, "utf8");
}

test("hosted builds prefer their published pinned Phaser before CDN fallback", async () => {
  const bootstrap = await source();
  assert.match(bootstrap, /return \[LOCAL_PHASER_SOURCE, \.\.\.CDN_PHASER_SOURCES\]/);
  assert.match(bootstrap, /for \(const source of phaserScriptSources\(\)\)/);
  assert.match(bootstrap, /Engine download timed out/);
  assert.doesNotMatch(bootstrap, /function localPhaserAllowed/);
});

test("development still retains the pinned local Phaser source and CDN fallback", async () => {
  const bootstrap = await source();

  assert.match(bootstrap, /node_modules\/phaser\/dist\/phaser\.min\.js/);
  assert.match(bootstrap, /cdn\.jsdelivr\.net\/npm\/phaser@\$\{PHASER_VERSION\}/);
  assert.match(bootstrap, /unpkg\.com\/phaser@\$\{PHASER_VERSION\}/);
});
