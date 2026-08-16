import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_AUDIO_CATALOG } from "../phaser/src/audio/SampleAudioCatalog.js";

const OPEN_FILE = "phaser/assets/audio/vehicles/vehicle-door-open-01.mp3";
const CLOSE_FILE = "phaser/assets/audio/vehicles/vehicle-door-close-01.mp3";

function repoFile(path) {
  return new URL(`../${path}`, import.meta.url);
}

function assertMp3(path) {
  const data = readFileSync(repoFile(path));
  assert.ok(data.length > 5_000, `${path} should contain a processed sample, not a placeholder`);
  const hasId3 = data.subarray(0, 3).toString("ascii") === "ID3";
  const hasFrameSync = data[0] === 0xff && (data[1] & 0xe0) === 0xe0;
  assert.ok(hasId3 || hasFrameSync, `${path} should be an MP3 stream`);
}

test("vehicle entry and exit use an authentic delayed open-close door pair", () => {
  assert.deepEqual(SAMPLE_AUDIO_CATALOG.vehicleDoorOpen.files, [OPEN_FILE]);
  assert.deepEqual(SAMPLE_AUDIO_CATALOG.vehicleDoorClose.files, [CLOSE_FILE]);
  assert.equal(SAMPLE_AUDIO_CATALOG.vehicleDoorOpen.volume, 0.92);
  assert.equal(SAMPLE_AUDIO_CATALOG.vehicleDoorClose.volume, 0.95);
  assert.equal(SAMPLE_AUDIO_CATALOG.vehicleDoorClose.loop, false);
  assertMp3(OPEN_FILE);
  assertMp3(CLOSE_FILE);

  const interactions = readFileSync(repoFile("phaser/src/vehicles/VehicleInteractions.js"), "utf8");
  assert.match(interactions, /const VEHICLE_DOOR_CLOSE_DELAY = 0\.52;/);
  assert.equal((interactions.match(/RawAudio\.play\("vehicleDoorOpen"\)/g) || []).length, 2);
  assert.equal((interactions.match(/RawAudio\.play\("vehicleDoorClose", \{ delay: VEHICLE_DOOR_CLOSE_DELAY, cooldown: 0 \}\)/g) || []).length, 2);

  const rawAudio = readFileSync(repoFile("phaser/src/systems/RawAudioSystem.js"), "utf8");
  assert.match(rawAudio, /const delay = Math\.max\(0, Number\(options\.delay\) \|\| 0\);\s*source\.start\(this\.ctx\.currentTime \+ delay\);/);
  assert.match(rawAudio, /case "vehicleDoorClose": return this\.vehicleDoorClose\(options\.delay\);/);
  assert.match(rawAudio, /vehicleDoorClose\(delay = 0\)[\s\S]*?baseDelay \+ 0\.015/);
});
