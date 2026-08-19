import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const repoFile = path => new URL(`../${path}`, import.meta.url);
const source = path => readFileSync(repoFile(path), "utf8");

test("Blood Sense exclusively owns NPC and player perception overlays", () => {
  const policy = source("phaser/src/policies/BloodSensePresentationPolicy.js");
  const main = source("phaser/src/main.js");
  assert.match(policy, /senseTimer/);
  assert.match(policy, /drawVisionCones/);
  assert.match(policy, /drawHearingCones/);
  assert.match(policy, /MovementNoiseSystem\.prototype\.draw/);
  assert.match(policy, /graphics\?\.clear/);
  assert.match(main, /installBloodSensePresentationPolicy\(\)/);
});

test("active on-screen police pursuit no longer depends on the facing cone", () => {
  const policy = source("phaser/src/policies/PoliceScreenPursuitPolicy.js");
  assert.match(policy, /cop\?\.chasingPlayer/);
  assert.match(policy, /copIsOnScreen/);
  assert.match(policy, /playerVisibleToCop/);
  assert.match(policy, /return true/);
});

test("civilian traffic can avoid sustained blockers and panics after a bullet hit", () => {
  const policy = source("phaser/src/policies/TrafficFeedbackPolicy.js");
  assert.match(policy, /traffic:bullet-hit/);
  assert.match(policy, /traffic:panic-started/);
  assert.match(policy, /panic-shot/);
  assert.match(policy, /panic-avoid/);
  assert.match(policy, /obstacle-avoid/);
  assert.match(policy, /AVOIDANCE_OFFSET/);
});

test("damaged vehicles keep progressive smoke fire and a charred exploded state", () => {
  const policy = source("phaser/src/policies/VehicleDamagePresentationPolicy.js");
  assert.match(policy, /return "smoking"/);
  assert.match(policy, /return "burning"/);
  assert.match(policy, /return "exploded"/);
  assert.match(policy, /charWreck/);
  assert.match(policy, /fireOuter/);
  assert.match(policy, /smokeA/);
  assert.match(policy, /VehicleSystem\.prototype\.explodeVehicle/);
});

test("car impacts against walls stay audible even when collision recovery slides along the wall", () => {
  const policy = source("phaser/src/policies/VehicleWallCollisionAudioPolicy.js");
  const main = source("phaser/src/main.js");
  assert.match(policy, /VehicleSystem\.prototype/);
  assert.match(policy, /stepVehicleKinematics/);
  assert.match(policy, /vehicleFootprintPoints/);
  assert.match(policy, /vehicleWouldHitWall/);
  assert.match(policy, /vehicleCollisionAudioEvent\(impact\) \|\| "vehicleCollisionLight"/);
  assert.match(policy, /RawAudio\.play\(audioEvent, \{ cooldown: 0\.28 \}\)/);
  assert.match(policy, /originalFeedback/);
  assert.match(main, /installVehicleWallCollisionAudioPolicy\(\)/);
  assert.equal(existsSync(repoFile("phaser/src/policies/StreetImpactAudioPolicy.js")), false);
  assert.doesNotMatch(main, /installStreetImpactAudioPolicy/);
});

test("production spawn is moved away from the problematic traffic handoff crossing", () => {
  const balance = source("phaser/src/data/balance.js");
  assert.match(balance, /SAFE_STREET_SPAWN_OFFSET_X = -64/);
  assert.match(balance, /startX: CITY_ANCHORS\.streetSpawn\.x \+ SAFE_STREET_SPAWN_OFFSET_X/);
});
