import test from "node:test";
import assert from "node:assert/strict";
import { SIRE_APPROVAL, isAtReturnObjective } from "../phaser/src/mission-return-finale.js";

function mission(overrides = {}) {
  const marker = overrides.markerValue ?? { label: "REPORT", x: 150, y: 146 };
  return {
    step: 3,
    completed: false,
    failed: false,
    marker: () => marker,
    isNear: candidate => candidate === marker,
    ...overrides
  };
}

test("journalist handling alone does not satisfy the mission finale", () => {
  assert.equal(isAtReturnObjective(mission({ step: 2 })), false);
  assert.equal(isAtReturnObjective(mission({ step: 3, isNear: () => false })), false);
});

test("the finale starts only at the step-3 refuge report marker", () => {
  assert.equal(isAtReturnObjective(mission()), true);
  assert.equal(isAtReturnObjective(mission({ markerValue: { label: "TARGET" } })), false);
  assert.equal(isAtReturnObjective(mission({ completed: true })), false);
  assert.equal(isAtReturnObjective(mission({ failed: true })), false);
});

test("the sire approval copy is kept as a separate pre-report dialogue", () => {
  assert.equal(
    SIRE_APPROVAL,
    "Well done. You silenced the journalist and returned as ordered. The veil holds. You have served me well tonight."
  );
});
