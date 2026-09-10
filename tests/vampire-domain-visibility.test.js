import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../phaser/src/vampire/VampireRuntime.js", import.meta.url), "utf8");

test("the vampire domain is not hidden just because its interaction menu pauses world input", () => {
  assert.match(source, /const blockingUi = Boolean\(this\.scene\.registry\?\.get\?\.\("uiPaused"\)\);/);
  assert.match(source, /this\.domain\.render\(this\.scene\.interactionSystem\?\.menu, blockingUi\);/);
  assert.doesNotMatch(source, /this\.domain\.render\([^\n]*!frame\?\.worldEnabled/);
});
