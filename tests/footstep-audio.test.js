import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_AUDIO_CATALOG } from "../phaser/src/audio/SampleAudioCatalog.js";

const repoFile = path => new URL(`../${path}`, import.meta.url);
const source = path => readFileSync(repoFile(path), "utf8");

function assertMp3(path) {
  const data = readFileSync(repoFile(path));
  assert.ok(data.length > 5_000, `${path} should contain a processed sample`);
  const hasId3 = data.subarray(0, 3).toString("ascii") === "ID3";
  const hasFrameSync = data[0] === 0xff && (data[1] & 0xe0) === 0xe0;
  assert.ok(hasId3 || hasFrameSync, `${path} should be an MP3 stream`);
}

test("step and sprintStep register ten authentic concrete footfalls", () => {
  const steps = Array.from({ length: 6 }, (_, index) =>
    `phaser/assets/audio/player/step-${String(index + 1).padStart(2, "0")}.mp3`
  );
  const sprintSteps = Array.from({ length: 4 }, (_, index) =>
    `phaser/assets/audio/player/sprint-step-${String(index + 1).padStart(2, "0")}.mp3`
  );
  assert.deepEqual(SAMPLE_AUDIO_CATALOG.step.files, steps);
  assert.deepEqual(SAMPLE_AUDIO_CATALOG.sprintStep.files, sprintSteps);
  assert.equal(SAMPLE_AUDIO_CATALOG.step.volume, 0.82);
  assert.equal(SAMPLE_AUDIO_CATALOG.sprintStep.volume, 0.92);
  [...steps, ...sprintSteps].forEach(assertMp3);
});

test("footsteps are driven by measured movement and suppressed while driving", () => {
  const core = source("phaser/src/systems/MovementNoiseSystemCore.js");
  const wrapper = source("phaser/src/systems/MovementNoiseSystem.js");
  assert.match(core, /Footsteps are owned by measured world displacement/);
  assert.match(core, /this\.distanceSinceStep \+= moved/);
  assert.match(core, /RawAudio\.play\(profile\.audio/);
  assert.match(wrapper, /isDriving/);
  assert.match(wrapper, /hasMovementIntent: false/);
});
