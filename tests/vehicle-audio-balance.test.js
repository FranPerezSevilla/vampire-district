import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_AUDIO_CATALOG } from "../phaser/src/audio/SampleAudioCatalog.js";

const raw = readFileSync(new URL("../phaser/src/systems/RawAudioSystem.js", import.meta.url), "utf8");

test("second listening pass lowers skid without changing its loop ownership", () => {
  assert.equal(SAMPLE_AUDIO_CATALOG.vehicleSkidLoop.volume, 0.50);
  assert.equal(SAMPLE_AUDIO_CATALOG.vehicleSkidLoop.loop, true);
});

test("real engine profiles receive a modest gain lift across every archetype", () => {
  assert.match(raw, /samplePitch: 1\.06, sampleVolume: 0\.44/);
  assert.match(raw, /samplePitch: 0\.98, sampleVolume: 0\.46/);
  assert.match(raw, /samplePitch: 0\.84, sampleVolume: 0\.50/);
  assert.match(raw, /samplePitch: 1\.08, sampleVolume: 0\.46/);
});
