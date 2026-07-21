import test from "node:test";
import assert from "node:assert/strict";
import { BOOT_MODES, createBootProfile } from "../phaser/src/boot/BootProfile.js";

test("normal boot keeps persistent campaign and tutorial flow", () => {
  const profile = createBootProfile("");
  assert.equal(profile.mode, BOOT_MODES.NORMAL);
  assert.equal(profile.persistentCampaign, true);
  assert.equal(profile.autoLoadCampaign, true);
  assert.equal(profile.autoSaveCampaign, true);
  assert.equal(profile.showCampaignEntry, true);
  assert.equal(profile.skipTutorial, false);
  assert.equal(profile.enableHarness, false);
});

test("explore boot is isolated, missionless and starts on the street", () => {
  const profile = createBootProfile("?mode=explore");
  assert.equal(profile.mode, BOOT_MODES.EXPLORE);
  assert.equal(profile.persistentCampaign, false);
  assert.equal(profile.autoStartOpeningMission, false);
  assert.equal(profile.showCampaignEntry, false);
  assert.equal(profile.skipTutorial, true);
  assert.equal(profile.startOnStreet, true);
  assert.deepEqual(profile.spawn, { x: 438, y: 326, layer: 0 });
});

test("a test scenario implies isolated RC harness mode", () => {
  const profile = createBootProfile("?testScenario=Street Damage");
  assert.equal(profile.mode, BOOT_MODES.SCENARIO);
  assert.equal(profile.scenarioId, "street-damage");
  assert.equal(profile.persistentCampaign, false);
  assert.equal(profile.enableHarness, true);
  assert.equal(profile.rcTest, true);
  assert.equal(profile.skipTutorial, true);
});
