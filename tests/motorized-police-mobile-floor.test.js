import assert from "node:assert/strict";
import test from "node:test";

import {
  mayDismountPursuitUnit,
  mobilePursuitUnitCount
} from "../phaser/src/police/MotorizedPoliceLocalPolicy.js";
import { MOTORIZED_POLICE_ROLES } from "../phaser/src/police/MotorizedPolicePolicy.js";

function pursuit(id, overrides = {}) {
  return {
    id,
    role: MOTORIZED_POLICE_ROLES.PURSUIT,
    disabled: false,
    officersDismounted: false,
    ...overrides
  };
}

test("Wanted 2 permits one reserve cruiser to deploy officers but preserves two mobile pursuers", () => {
  const units = [pursuit("one"), pursuit("two"), pursuit("three")];
  assert.equal(mobilePursuitUnitCount(units), 3);
  assert.equal(mayDismountPursuitUnit(units, units[0], 2), true);

  units[0].officersDismounted = true;
  assert.equal(mobilePursuitUnitCount(units), 2);
  assert.equal(mayDismountPursuitUnit(units, units[1], 2), false);
  assert.equal(mayDismountPursuitUnit(units, units[2], 2), false);
});

test("Wanted 3 roadblock may deploy while its two pursuit cruisers stay mobile", () => {
  const roadblock = {
    id: "block",
    role: MOTORIZED_POLICE_ROLES.ROADBLOCK,
    disabled: false,
    officersDismounted: false
  };
  const units = [pursuit("one"), pursuit("two"), roadblock];
  assert.equal(mobilePursuitUnitCount(units), 2);
  assert.equal(mayDismountPursuitUnit(units, units[0], 3), false);
  assert.equal(mayDismountPursuitUnit(units, units[1], 3), false);
  assert.equal(mayDismountPursuitUnit(units, roadblock, 3), true);
});
