import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_AUDIO_CATALOG } from "../phaser/src/audio/SampleAudioCatalog.js";

const repoFile = path => new URL(`../${path}`, import.meta.url);
const source = path => readFileSync(repoFile(path), "utf8");

function id3PayloadEnd(data) {
  if (data.subarray(0, 3).toString("ascii") !== "ID3" || data.length < 10) return 0;
  const tagSize = ((data[6] & 0x7f) << 21)
    | ((data[7] & 0x7f) << 14)
    | ((data[8] & 0x7f) << 7)
    | (data[9] & 0x7f);
  return 10 + tagSize;
}

function firstFrameSync(data, start = 0) {
  for (let index = Math.max(0, start); index + 1 < data.length; index += 1) {
    if (data[index] === 0xff && (data[index + 1] & 0xe0) === 0xe0) return index;
  }
  return -1;
}

function assertMp3(path) {
  const data = readFileSync(repoFile(path));
  assert.ok(data.length > 1_000, `${path} should contain a processed sample rather than a placeholder`);

  const audioStart = id3PayloadEnd(data);
  const frameStart = firstFrameSync(data, audioStart);
  assert.ok(frameStart >= 0, `${path} should contain an MPEG audio frame`);

  // Short authentic cuts can legitimately encode below 5 kB. When FFmpeg/LAME
  // writes Xing/Info metadata, use its declared frame/byte counts to detect a
  // truncated transport instead of treating file size as an audio-validity proxy.
  const xingIndex = data.indexOf("Xing", frameStart, "ascii");
  const infoIndex = data.indexOf("Info", frameStart, "ascii");
  const vbrIndex = xingIndex >= 0 ? xingIndex : infoIndex;
  if (vbrIndex < 0 || vbrIndex + 8 > data.length) return;

  const flags = data.readUInt32BE(vbrIndex + 4);
  let cursor = vbrIndex + 8;
  if ((flags & 0x1) !== 0) {
    assert.ok(cursor + 4 <= data.length, `${path} should contain a complete Xing frame count`);
    const declaredFrames = data.readUInt32BE(cursor);
    assert.ok(declaredFrames >= 4, `${path} should contain several encoded MPEG frames`);
    cursor += 4;
  }
  if ((flags & 0x2) !== 0) {
    assert.ok(cursor + 4 <= data.length, `${path} should contain a complete Xing byte count`);
    const declaredBytes = data.readUInt32BE(cursor);
    const mpegBytes = data.length - audioStart;
    assert.ok(declaredBytes > 1_000, `${path} should declare a non-placeholder MPEG payload`);
    assert.ok(mpegBytes >= declaredBytes, `${path} is truncated before its declared MPEG byte count`);
    assert.ok(mpegBytes - declaredBytes <= 256, `${path} has unexpected trailing data after its MPEG payload`);
  }
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
