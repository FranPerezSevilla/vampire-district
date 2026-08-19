import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

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

test("street-range projectile expiry produces world impact audio", () => {
  const policy = source("phaser/src/policies/StreetImpactAudioPolicy.js");
  assert.match(policy, /remainingRange/);
  assert.match(policy, /LAYERS\.STREET/);
  assert.match(policy, /bulletHitWorld/);
  assert.match(policy, /combat:street-hit/);
});

test("production spawn is moved away from the problematic traffic handoff crossing", () => {
  const balance = source("phaser/src/data/balance.js");
  assert.match(balance, /SAFE_STREET_SPAWN_OFFSET_X = -64/);
  assert.match(balance, /startX: CITY_ANCHORS\.streetSpawn\.x \+ SAFE_STREET_SPAWN_OFFSET_X/);
});
