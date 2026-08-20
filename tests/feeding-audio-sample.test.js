import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_AUDIO_CATALOG } from "../phaser/src/audio/SampleAudioCatalog.js";

function repoFile(path) {
  return new URL(`../${path}`, import.meta.url);
}

test("feeding sample family maps masculine breath cues and a PCM bite loop", () => {
  assert.deepEqual(SAMPLE_AUDIO_CATALOG.drainStart.files, [
    "phaser/assets/audio/feeding/drain-start-01.mp3"
  ]);
  assert.deepEqual(SAMPLE_AUDIO_CATALOG.drainLoop.files, [
    "phaser/assets/audio/feeding/drain-loop-01.wav"
  ]);
  assert.deepEqual(SAMPLE_AUDIO_CATALOG.drainComplete.files, [
    "phaser/assets/audio/feeding/drain-complete-01.mp3"
  ]);
  assert.equal(SAMPLE_AUDIO_CATALOG.drainLoop.loop, true);

  const start = readFileSync(repoFile(SAMPLE_AUDIO_CATALOG.drainStart.files[0]));
  const loop = readFileSync(repoFile(SAMPLE_AUDIO_CATALOG.drainLoop.files[0]));
  const complete = readFileSync(repoFile(SAMPLE_AUDIO_CATALOG.drainComplete.files[0]));
  assert.ok(start.length > 8_000);
  assert.ok(complete.length > 8_000);
  assert.equal(loop.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(loop.subarray(8, 12).toString("ascii"), "WAVE");
});

test("playtest feeding loop follows authoritative feeding lifecycle", () => {
  const policy = readFileSync(repoFile("phaser/src/playtest/FeedingAudioLoopPolicy.js"), "utf8");
  assert.match(policy, /"feeding:started"/);
  assert.match(policy, /"feeding:resolved"/);
  assert.match(policy, /"feeding:cancelled"/);
  assert.match(policy, /"feeding:interrupted"/);
  assert.match(policy, /FEED_LOOP_DELAY_MS = 450/);
  assert.match(policy, /source\.loop = true/);
  assert.match(policy, /RawAudio\.loadSampleEvent\?\.\(FEED_LOOP_EVENT\)/);

  const bootstrap = readFileSync(repoFile("phaser/src/playtest/bootstrap.js"), "utf8");
  assert.match(bootstrap, /import \{ FeedingAudioLoopPolicy \} from "\.\/FeedingAudioLoopPolicy\.js"/);
  assert.match(bootstrap, /new FeedingAudioLoopPolicy\(scene\)/);
  assert.match(bootstrap, /playtestFeedingAudioPolicy\?\.destroy\?\.\(\)/);
});
