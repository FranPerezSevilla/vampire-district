import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  trafficHornDriverProfile,
  trafficHornEligibleReason,
  trafficHornShouldPlay,
  trafficHornSpatialMix
} from "../phaser/src/policies/TrafficContextualHornPolicy.js";

const repoFile = path => new URL(`../${path}`, import.meta.url);
const source = path => readFileSync(repoFile(path), "utf8");

test("contextual horns are tied only to real traffic or junction blockage", () => {
  for (const reason of [
    "traffic",
    "assertive-traffic",
    "traffic-separation",
    "junction-yield",
    "junction-reserved",
    "player-vehicle"
  ]) {
    assert.equal(trafficHornEligibleReason(reason), true, `${reason} should be horn-eligible`);
  }
  for (const reason of ["cruise", "catch-up", "assertive-cruise", "player-on-foot", "junction-priority", "no-lane"]) {
    assert.equal(trafficHornEligibleReason(reason), false, `${reason} should stay silent`);
  }
});

test("driver variation leaves some civilians quiet and staggers delay/cooldown", () => {
  const profiles = Array.from({ length: 120 }, (_, index) => trafficHornDriverProfile(`driver-${index}`));
  const enabled = profiles.filter(profile => profile.enabled);
  assert.ok(enabled.length > 20 && enabled.length < 100, "not every civilian driver should horn");
  assert.ok(enabled.every(profile => profile.delaySeconds >= 1.85 && profile.delaySeconds <= 3.10));
  assert.ok(enabled.every(profile => profile.cooldownSeconds >= 7.2 && profile.cooldownSeconds <= 12.0));
  assert.ok(new Set(enabled.map(profile => profile.delaySeconds.toFixed(2))).size > 4, "blocked drivers should not share one horn delay");
});

test("a contextual horn requires a sustained full stop and respects per-driver cooldown", () => {
  const tokenId = Array.from({ length: 200 }, (_, index) => `eligible-${index}`)
    .find(id => trafficHornDriverProfile(id).enabled);
  assert.ok(tokenId, "test should find a deterministic horn-enabled driver");
  const profile = trafficHornDriverProfile(tokenId);
  const state = {
    tokenId,
    reason: "junction-reserved",
    speedFactor: 0,
    stoppedSeconds: profile.delaySeconds - 0.01,
    hornCooldownUntil: 0,
    hornRetryUntil: 0
  };
  assert.equal(trafficHornShouldPlay(state, tokenId, 10), false);
  state.stoppedSeconds = profile.delaySeconds + 0.01;
  assert.equal(trafficHornShouldPlay(state, tokenId, 10), true);
  state.speedFactor = 0.12;
  assert.equal(trafficHornShouldPlay(state, tokenId, 10), false, "rolling traffic should not horn");
  state.speedFactor = 0;
  state.hornCooldownUntil = 11;
  assert.equal(trafficHornShouldPlay(state, tokenId, 10), false, "cooldown should suppress repeat horns");
});

test("traffic horn spatial mix attenuates by distance and pans with source position", () => {
  const listener = { x: 100, y: 100 };
  const center = trafficHornSpatialMix({ x: 100, y: 100 }, listener, 500);
  const right = trafficHornSpatialMix({ x: 300, y: 100 }, listener, 500);
  const left = trafficHornSpatialMix({ x: -100, y: 100 }, listener, 500);
  const distant = trafficHornSpatialMix({ x: 700, y: 100 }, listener, 500);
  assert.equal(center.audibility, 1);
  assert.equal(center.pan, 0);
  assert.ok(right.audibility < center.audibility && right.audibility > 0);
  assert.ok(right.pan > 0);
  assert.ok(left.pan < 0);
  assert.equal(distant.audibility, 0);
});

test("the playtest installs contextual horns after traffic authority without Heat or right-of-way writes", () => {
  const main = source("phaser/src/main.js");
  const policy = source("phaser/src/policies/TrafficContextualHornPolicy.js");
  assert.ok(main.indexOf("installTrafficContextualHornPolicy();") > main.indexOf("installTrafficPlaytestPolicy();"));
  assert.match(policy, /sampleAudioDefinition\("vehicleHorn"\)/);
  assert.match(policy, /createStereoPanner/);
  assert.match(policy, /TRAFFIC_HORN_GLOBAL_GAP_SECONDS/);
  assert.match(policy, /hornCooldownUntil/);
  assert.match(policy, /"vehicle:horn"/);
  assert.doesNotMatch(policy, /addHeat|setHeat|grantPriority|reservation\.ownerId\s*=/);
});
