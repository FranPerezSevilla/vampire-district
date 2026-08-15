import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_AUDIO_CATALOG } from "../phaser/src/audio/SampleAudioCatalog.js";

const repoFile = path => new URL(`../${path}`, import.meta.url);

test("vehicleSkidLoop is a committed PCM loop sustained by aggressive-driving pulses", () => {
  const definition = SAMPLE_AUDIO_CATALOG.vehicleSkidLoop;
  assert.deepEqual(definition.files, ["phaser/assets/audio/vehicles/vehicle-skid-loop-01.wav"]);
  assert.equal(definition.loop, true);
  assert.equal(definition.volume, 0.68);
  const wav = readFileSync(repoFile(definition.files[0]));
  assert.ok(wav.length > 50_000);
  assert.equal(wav.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(wav.subarray(8, 12).toString("ascii"), "WAVE");
  const rawAudio = readFileSync(repoFile("phaser/src/systems/RawAudioSystem.js"), "utf8");
  const driving = readFileSync(repoFile("phaser/src/vehicles/VehicleDriving.js"), "utf8");
  assert.match(rawAudio, /pulseSampleLoop\(name, options = \{\}\)/);
  assert.match(rawAudio, /name === "vehicleSkidLoop" && sampleAudioDefinition\(name\)\?\.loop/);
  assert.match(rawAudio, /hold: 0\.34/);
  assert.match(rawAudio, /sampleLoopTimers/);
  assert.match(driving, /RawAudio\.play\("vehicleSkidLoop", \{ cooldown: 0\.16 \}\)/);
  assert.match(driving, /panicCiviliansFromAggressiveDriving\(system, vehicle, intensity\)/);
});
