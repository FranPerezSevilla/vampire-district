import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_AUDIO_CATALOG } from "../phaser/src/audio/SampleAudioCatalog.js";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("feeding samples sit on the narrative bus with a modest level lift", () => {
  assert.equal(SAMPLE_AUDIO_CATALOG.drainStart.bus, "narrative");
  assert.equal(SAMPLE_AUDIO_CATALOG.drainLoop.bus, "narrative");
  assert.equal(SAMPLE_AUDIO_CATALOG.drainComplete.bus, "narrative");
  assert.equal(SAMPLE_AUDIO_CATALOG.drainStart.volume, 1.10);
  assert.equal(SAMPLE_AUDIO_CATALOG.drainLoop.volume, 0.96);
  assert.equal(SAMPLE_AUDIO_CATALOG.drainComplete.volume, 1.10);
});

test("feeding ducks world audio but leaves the narrative bus untouched", () => {
  const raw = source("phaser/src/systems/RawAudioSystem.js");
  const policy = source("phaser/src/playtest/FeedingAudioLoopPolicy.js");
  assert.match(raw, /const NARRATIVE_DUCK_FACTOR = 0\.54/);
  assert.match(raw, /this\.narrativeMaster = this\.ctx\.createGain\(\)/);
  assert.match(raw, /sampleDestination\(name\)/);
  assert.match(raw, /beginNarrativeDuck\(key = "default"\)/);
  assert.match(raw, /endNarrativeDuck\(key = "default"\)/);
  assert.match(policy, /RawAudio\.beginNarrativeDuck\?\.\(FEED_DUCK_KEY\)/);
  assert.match(policy, /FEED_DUCK_RELEASE_MS = 320/);
  assert.match(policy, /RawAudio\.endNarrativeDuck\?\.\(FEED_DUCK_KEY\)/);
  assert.match(policy, /RawAudio\.sampleDestination\?\.\(FEED_LOOP_EVENT\)/);
});
