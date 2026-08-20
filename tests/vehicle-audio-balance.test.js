import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_AUDIO_CATALOG } from "../phaser/src/audio/SampleAudioCatalog.js";
import { vehicleEnginePresenceGain } from "../phaser/src/systems/RawAudioSystem.js";

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

test("engine presence lift favors the player while preserving spatial traffic and police headroom", () => {
  assert.equal(vehicleEnginePresenceGain(0), 1.08);
  assert.equal(vehicleEnginePresenceGain(2), 1.10);
  assert.equal(vehicleEnginePresenceGain(3), 1.28);
  assert.ok(vehicleEnginePresenceGain(3) > vehicleEnginePresenceGain(2));
  assert.ok(vehicleEnginePresenceGain(2) > vehicleEnginePresenceGain(0));
  assert.match(raw, /profile\.sampleVolume \* audibility \* presenceGain/);
  assert.match(raw, /profile\.volume \* audibility \* presenceGain/);
  assert.match(raw, /presenceGain: Number\(voice\.presenceGain\) \|\| 1/);
  assert.equal(SAMPLE_AUDIO_CATALOG.vehicleEngineStart.volume, 0.88);
  assert.equal(SAMPLE_AUDIO_CATALOG.policeSirenLoop.volume, 0.72);
  assert.equal(SAMPLE_AUDIO_CATALOG.vehicleCollisionHeavy.volume, 0.82);
});
