import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_AUDIO_CATALOG } from "../phaser/src/audio/SampleAudioCatalog.js";
import { VEHICLE_ARCHETYPES } from "../phaser/src/data/vehicles.js";
import {
  stepPresentationTransmission,
  vehicleEngineRpmNormalized,
  vehicleEngineTelemetry
} from "../phaser/src/vehicles/VehicleEngineModel.js";

const repoFile = path => new URL(`../${path}`, import.meta.url);
const source = path => readFileSync(repoFile(path), "utf8");

function assertMp3(path) {
  const data = readFileSync(repoFile(path));
  assert.ok(data.length > 5_000, `${path} should contain a processed sample`);
  const hasId3 = data.subarray(0, 3).toString("ascii") === "ID3";
  const hasFrameSync = data[0] === 0xff && (data[1] & 0xe0) === 0xe0;
  assert.ok(hasId3 || hasFrameSync, `${path} should be an MP3 stream`);
}

function assertWav(path) {
  const data = readFileSync(repoFile(path));
  assert.ok(data.length > 20_000, `${path} should contain a processed loop`);
  assert.equal(data.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(data.subarray(8, 12).toString("ascii"), "WAVE");
}

test("presentation transmission upshifts and the engine drops RPM into the next gear", () => {
  const compact = VEHICLE_ARCHETYPES.compact;
  const shifted = stepPresentationTransmission({ gear: 1, gearShiftTimer: 0 }, 64, 0.05, compact);
  assert.equal(shifted.gear, 2);
  assert.ok(shifted.gearShiftTimer > 0);
  const before = vehicleEngineRpmNormalized({ speed: 57, maxSpeed: compact.maxSpeed, gear: 1, gearCount: 5, shifting: false });
  const after = vehicleEngineRpmNormalized({ speed: 64, maxSpeed: compact.maxSpeed, gear: 2, gearCount: 5, shifting: true });
  assert.ok(before > after, "an upshift should audibly drop engine revs");
});

test("engine telemetry is spatial and preserves an own-vehicle priority mix", () => {
  const sedan = VEHICLE_ARCHETYPES.sedan;
  const own = vehicleEngineTelemetry({ speed: 180, archetype: sedan, gear: 3, throttle: 1, ownVehicle: true });
  const near = vehicleEngineTelemetry({ speed: 180, archetype: sedan, gear: 3, throttle: 0.5, x: 150, y: 0, listener: { x: 0, y: 0 }, maxDistance: 600 });
  const far = vehicleEngineTelemetry({ speed: 180, archetype: sedan, gear: 3, throttle: 0.5, x: 520, y: 0, listener: { x: 0, y: 0 }, maxDistance: 600 });
  assert.equal(own.audibility, 1);
  assert.equal(own.pan, 0);
  assert.ok(near.audibility > far.audibility);
  assert.ok(near.pan > 0);
});

test("real start and PCM idle loop back the systemic engine voices", () => {
  const startFile = "phaser/assets/audio/vehicles/vehicle-engine-start-01.mp3";
  const loopFile = "phaser/assets/audio/vehicles/vehicle-engine-loop-01.wav";
  assert.deepEqual(SAMPLE_AUDIO_CATALOG.vehicleEngineStart.files, [startFile]);
  assert.deepEqual(SAMPLE_AUDIO_CATALOG.vehicleEngineLoop.files, [loopFile]);
  assert.equal(SAMPLE_AUDIO_CATALOG.vehicleEngineLoop.loop, true);
  assert.equal(SAMPLE_AUDIO_CATALOG.vehicleEngineStart.volume, 0.88);
  assert.equal(SAMPLE_AUDIO_CATALOG.vehicleSkidLoop.volume, 0.60);
  assertMp3(startFile);
  assertWav(loopFile);

  const raw = source("phaser/src/systems/RawAudioSystem.js");
  assert.match(raw, /sampleBuffers\.get\("vehicleEngineLoop"\)/);
  assert.match(raw, /mode: "sample"/);
  assert.match(raw, /mode: "procedural"/);
  assert.match(raw, /source\.playbackRate\.setTargetAtTime/);
  assert.match(raw, /vehicleEngineStartDeadlines/);
  assert.match(raw, /vehicleEngineStartFallback/);
});

test("player entry sequences door close, starter and loop reveal without restarting traffic engines", () => {
  const interactions = source("phaser/src/vehicles/VehicleInteractions.js");
  assert.match(interactions, /const VEHICLE_ENGINE_START_DELAY = 0\.58;/);
  assert.match(interactions, /const VEHICLE_ENGINE_LOOP_REVEAL = 2\.05;/);
  assert.equal((interactions.match(/RawAudio\.beginVehicleEngineStart\(/g) || []).length, 1);
  assert.match(interactions, /delay: VEHICLE_ENGINE_START_DELAY/);
  assert.match(interactions, /revealAfter: VEHICLE_ENGINE_LOOP_REVEAL/);
});

test("RawAudio owns capped persistent engine voices for player traffic and police", () => {
  const raw = source("phaser/src/systems/RawAudioSystem.js");
  const driving = source("phaser/src/vehicles/VehicleDriving.js");
  const traffic = source("phaser/src/streaming/TrafficLocalBehaviorSystem.js");
  const police = source("phaser/src/police/MotorizedPoliceSystem.js");
  const runtime = source("phaser/src/runtime/GameplayRuntime.js");
  assert.match(raw, /MAX_VEHICLE_ENGINE_VOICES = 10/);
  assert.match(raw, /updateVehicleEngine\(id, options = \{\}\)/);
  assert.match(raw, /createStereoPanner/);
  assert.match(raw, /stopAllVehicleEngines\(\)/);
  assert.match(driving, /RawAudio\.updateVehicleEngine\(`player:/);
  assert.match(traffic, /RawAudio\.updateVehicleEngine\(`traffic:/);
  assert.match(traffic, /stepPresentationTransmission/);
  assert.match(police, /RawAudio\.updateVehicleEngine\(`police:/);
  assert.match(police, /engineReferenceSpeed/);
  assert.match(runtime, /beginVehicleEngineFrame/);
  assert.match(runtime, /endVehicleEngineFrame/);
});

test("the canonical audio plan has no fixed city or distant traffic ambience bed", () => {
  const catalogue = source("docs/audio-catalog.md");
  assert.match(catalogue, /no continuous `ambienceStreetNight` or `trafficAmbience` bed/);
  assert.match(catalogue, /Urban ambience must emerge from spatial systemic sources/);
  assert.match(catalogue, /vehicleEngine.*systemic mix accepted/s);
  assert.match(catalogue, /real sample-backed candidate integrated/);
});
