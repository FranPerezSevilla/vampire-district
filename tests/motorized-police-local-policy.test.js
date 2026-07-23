import assert from "node:assert/strict";
import test from "node:test";
import { installMotorizedPoliceLocalPolicy } from "../phaser/src/police/MotorizedPoliceLocalPolicy.js";

test("distant macro cruisers ignore local blockers until materialized", () => {
  let originalCalls = 0;
  const system = {
    units: [],
    safeCandidate() {
      originalCalls++;
      return false;
    },
    dismountUnit() { return []; }
  };
  const policy = installMotorizedPoliceLocalPolicy(system);

  assert.equal(system.safeCandidate({ visible: false }, { x: 0, y: 0 }), true);
  assert.equal(originalCalls, 0);
  assert.equal(system.safeCandidate({ visible: true }, { x: 0, y: 0 }), false);
  assert.equal(originalCalls, 1);

  policy.destroy();
  assert.equal(system.safeCandidate({ visible: false }, { x: 0, y: 0 }), false);
  assert.equal(originalCalls, 2);
});

test("roadblock officers wait until the cruiser reaches its cross-lane stop", () => {
  const calls = [];
  const roadblock = {
    id: "unit-roadblock",
    role: "roadblock",
    arrived: false
  };
  const system = {
    units: [roadblock],
    safeCandidate() { return true; },
    dismountUnit(unitId, reason) {
      calls.push({ unitId, reason });
      return ["officer-1", "officer-2"];
    }
  };
  const policy = installMotorizedPoliceLocalPolicy(system);

  assert.deepEqual(system.dismountUnit(roadblock.id, "roadblock"), []);
  assert.deepEqual(calls, []);

  roadblock.arrived = true;
  assert.deepEqual(system.dismountUnit(roadblock.id, "roadblock"), ["officer-1", "officer-2"]);
  assert.deepEqual(calls, [{ unitId: roadblock.id, reason: "roadblock" }]);

  policy.destroy();
});
