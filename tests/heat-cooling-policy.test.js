import assert from "node:assert/strict";
import test from "node:test";

import { districtZones } from "../phaser/src/data/district.js";
import { HeatSystem } from "../phaser/src/systems/HeatSystem.js";

function createScene() {
  return {
    player: { x: 0, y: 0 },
    policeSystem: { police: () => [] },
    campaignSystem: null,
    events: {
      once() {},
      emit() {}
    }
  };
}

function heatAt(value) {
  const system = new HeatSystem(createScene());
  const districtId = districtZones[0].id;
  system.replaceValues({ [districtId]: value });
  system.coolingBlockedUntil = 0;
  return { system, districtId };
}

test("Wanted 1 naturally cools all the way to zero", () => {
  const { system, districtId } = heatAt(22);
  assert.equal(system.level(), 1);
  const removed = system.cool(30);
  assert.ok(removed >= 21.9);
  assert.equal(system.valueFor(districtId), 0);
  assert.equal(system.level(), 0);
});

test("residual sub-threshold Heat also clears instead of becoming invisible state", () => {
  const { system, districtId } = heatAt(12);
  assert.equal(system.level(), 0);
  system.cool(30);
  assert.equal(system.valueFor(districtId), 0);
});

test("Wanted 2 does not naturally downgrade", () => {
  const { system, districtId } = heatAt(55);
  assert.equal(system.level(), 2);
  const removed = system.cool(120);
  assert.equal(removed, 0);
  assert.equal(system.valueFor(districtId), 55);
  assert.equal(system.level(), 2);
});

test("Wanted 3 does not naturally downgrade", () => {
  const { system, districtId } = heatAt(85);
  assert.equal(system.level(), 3);
  const removed = system.cool(120);
  assert.equal(removed, 0);
  assert.equal(system.valueFor(districtId), 85);
  assert.equal(system.level(), 3);
});

test("explicitly downgrading Wanted 2 into Wanted 1 re-enables natural clearing", () => {
  const { system, districtId } = heatAt(55);
  system.reduceInDistrict(districtId, 1, "Explicit downgrade", { persist: false });
  assert.equal(system.level(), 1);
  system.cool(120);
  assert.equal(system.valueFor(districtId), 0);
  assert.equal(system.level(), 0);
});
