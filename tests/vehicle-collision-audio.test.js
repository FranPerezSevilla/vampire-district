import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_AUDIO_CATALOG } from "../phaser/src/audio/SampleAudioCatalog.js";

import {
  VEHICLE_COLLISION_AUDIO_THRESHOLDS,
  vehicleCollisionAudioEvent
} from "../phaser/src/vehicles/VehicleCollisionAudioModel.js";

const repoFile = path => new URL(`../${path}`, import.meta.url);
const source = path => readFileSync(repoFile(path), "utf8");

function assertMp3(path) {
  const data = readFileSync(repoFile(path));
  assert.ok(data.length > 5_000, `${path} should contain a processed sample`);
  const hasId3 = data.subarray(0, 3).toString("ascii") === "ID3";
  const hasFrameSync = data[0] === 0xff && (data[1] & 0xe0) === 0xe0;
  assert.ok(hasId3 || hasFrameSync, `${path} should be an MP3 stream`);
}

test("vehicle collision audio severity follows impact speed", () => {
  assert.equal(VEHICLE_COLLISION_AUDIO_THRESHOLDS.minimumSpeed, 44);
  assert.equal(VEHICLE_COLLISION_AUDIO_THRESHOLDS.heavySpeed, 96);
  assert.equal(vehicleCollisionAudioEvent(20), null);
  assert.equal(vehicleCollisionAudioEvent(44), "vehicleCollisionLight");
  assert.equal(vehicleCollisionAudioEvent(95.9), "vehicleCollisionLight");
  assert.equal(vehicleCollisionAudioEvent(96), "vehicleCollisionHeavy");
  assert.equal(vehicleCollisionAudioEvent(-130), "vehicleCollisionHeavy");
});

test("RawAudio has dedicated light and heavy vehicle collision fallbacks", () => {
  const raw = source("phaser/src/systems/RawAudioSystem.js");
  assert.match(raw, /case "vehicleCollisionLight": return this\.vehicleCollision\(false\);/);
  assert.match(raw, /case "vehicleCollisionHeavy": return this\.vehicleCollision\(true\);/);
  assert.match(raw, /vehicleCollision\(heavy = false\)/);
});

test("world crashes use collision audio instead of bodyDrop", () => {
  const driving = source("phaser/src/vehicles/VehicleDriving.js");
  const start = driving.indexOf("export function handleVehicleWorldCollision");
  const end = driving.indexOf("export function updateVehicleDriving", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = driving.slice(start, end);
  assert.match(block, /vehicleCollisionAudioEvent\(impact\)/);
  assert.match(block, /RawAudio\.play\(collisionEvent, \{ cooldown: 0\.28 \}\)/);
  assert.doesNotMatch(block, /bodyDrop/);
});

test("vehicle contacts are target-aware: ordinary cars stay mundane, police cars raise Heat", () => {
  const policy = source("phaser/src/vehicles/VehicleCollisionSofteningPolicy.js");
  const driving = source("phaser/src/vehicles/VehicleDriving.js");
  assert.match(policy, /function targetIsPolice\(target\)/);
  assert.match(policy, /system\.vehicleCollisionContact = target \?/);
  assert.match(policy, /const contactImpactSpeed = Math\.abs/);
  assert.match(policy, /RawAudio\.play\(collisionEvent, \{ cooldown: 0\.28 \}\)/);
  assert.match(policy, /targetIsPolice\(target\) && this\.policeContactHeatCooldown <= 0/);
  assert.match(policy, /source: "vehicle_police_collision"/);
  assert.match(driving, /if \(!contact\) \{[\s\S]*?source: "vehicle_crash"/);
  assert.doesNotMatch(policy, /source: "vehicle_crash"/);
});


test("real heavy collision family is registered with three committed variants", () => {
  const files = [
    "phaser/assets/audio/vehicles/vehicle-collision-heavy-01.mp3",
    "phaser/assets/audio/vehicles/vehicle-collision-heavy-02.mp3",
    "phaser/assets/audio/vehicles/vehicle-collision-heavy-03.mp3"
  ];
  assert.deepEqual(SAMPLE_AUDIO_CATALOG.vehicleCollisionHeavy.files, files);
  assert.equal(SAMPLE_AUDIO_CATALOG.vehicleCollisionHeavy.volume, 0.82);
  assert.equal(SAMPLE_AUDIO_CATALOG.vehicleCollisionHeavy.loop, false);
  files.forEach(assertMp3);
});
