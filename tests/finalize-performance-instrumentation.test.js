import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Core.Finalize drill-down remains measurement-only and browser-visible", () => {
  const runtime = source("phaser/src/runtime/GameplayRuntimeCore.js");
  const capture = source("tests/browser/runtime-performance-capture.spec.js");

  for (const name of [
    "Finalize.MovementNoise",
    "Finalize.UxGuidance",
    "Finalize.Camera",
    "Finalize.Markers",
    "Finalize.Diagnostics",
    "Finalize.StatePublisher",
    "Finalize.PublishState"
  ]) {
    assert.match(runtime, new RegExp(`beginSystem\\?\\.\\("${name}"\\)`));
    assert.match(runtime, new RegExp(`endSystem\\?\\.\\("${name}"`));
  }

  assert.match(runtime, /FINALIZE_PROFILE_SYSTEMS/);
  assert.match(capture, /FINALIZE_SYSTEM_PREFIX\s*=\s*"Finalize\."/);
  assert.match(capture, /finalizeSystems/);
  assert.match(capture, /finalize:\s*summarizeRanking/);
  assert.doesNotMatch(runtime, /measureSystem\([^,]+,\s*\(\)\s*=>/);
});
