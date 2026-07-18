import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../phaser/src/systems/FeedingSystem.js", import.meta.url), "utf8");

test("FeedingSystem no longer exposes stun or kill through E interactions", () => {
  const collectStart = source.indexOf("collectInteractions() {");
  const nextMethod = source.indexOf("\n  addPassiveHunger", collectStart);
  assert.ok(collectStart >= 0 && nextMethod > collectStart);
  const method = source.slice(collectStart, nextMethod);
  assert.match(method, /return\s*\[\s*\]/);
  assert.equal(method.includes("type: \"stun\""), false);
  assert.equal(method.includes("type: \"kill\""), false);
});
