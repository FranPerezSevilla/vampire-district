import test from "node:test";
import assert from "node:assert/strict";
import {
  POLICE_ALERT_RULES,
  exposureNeededForPoliceLevel,
  policeViolenceTargetLevel
} from "../phaser/src/data/police-alert.js";

test("attacking a police officer establishes wanted level one", () => {
  assert.equal(policeViolenceTargetLevel(0), 1);
  assert.equal(policeViolenceTargetLevel(1), 1);
  assert.equal(policeViolenceTargetLevel(2), 2);
});

test("neutralizing police escalates one level up to gameplay maximum", () => {
  assert.equal(policeViolenceTargetLevel(0, { neutralized: true }), 2);
  assert.equal(policeViolenceTargetLevel(1, { neutralized: true }), 2);
  assert.equal(policeViolenceTargetLevel(2, { neutralized: true }), 3);
  assert.equal(policeViolenceTargetLevel(3, { neutralized: true }), 3);
});

test("forced police alert includes a stability buffer above the threshold", () => {
  const neededForOne = exposureNeededForPoliceLevel(0, 1);
  assert.equal(neededForOne, POLICE_ALERT_RULES.levelSize + POLICE_ALERT_RULES.stabilityBuffer);

  const targetTwo = POLICE_ALERT_RULES.levelSize * 2 + POLICE_ALERT_RULES.stabilityBuffer;
  assert.equal(exposureNeededForPoliceLevel(31, 2), targetTwo - 31);
  assert.equal(exposureNeededForPoliceLevel(targetTwo, 2), 0);
});
