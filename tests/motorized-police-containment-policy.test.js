import test from "node:test";
import assert from "node:assert/strict";

import {
  containmentRole,
  desiredContainmentFleet,
  nextPolicePursuitState,
  POLICE_PURSUIT_STATES,
  pursuitTargetForState
} from "../phaser/src/police/MotorizedPoliceContainmentPolicy.js";
import { MOTORIZED_POLICE_ROLES } from "../phaser/src/police/MotorizedPolicePolicy.js";

const vehicle = (overrides = {}) => ({
  x: 100,
  y: 100,
  angle: 0,
  travelAngle: 0,
  speed: 120,
  velocityX: 120,
  velocityY: 0,
  ...overrides
});

const unit = (overrides = {}) => ({
  index: 0,
  role: MOTORIZED_POLICE_ROLES.PURSUIT,
  x: 0,
  y: 100,
  angle: 0,
  containmentStoppedSeconds: 0,
  ...overrides
});

test("Wanted 2 keeps three actual pursuit cruisers", () => {
  assert.deepEqual(desiredContainmentFleet(2), { pursuers: 3, roadblocks: 0, total: 3 });
  assert.equal(containmentRole(0, 2), MOTORIZED_POLICE_ROLES.PURSUIT);
  assert.equal(containmentRole(1, 2), MOTORIZED_POLICE_ROLES.PURSUIT);
  assert.equal(containmentRole(2, 2), MOTORIZED_POLICE_ROLES.PURSUIT);
});

test("Wanted 3 adds a roadblock on top of three pursuers", () => {
  assert.deepEqual(desiredContainmentFleet(3), { pursuers: 3, roadblocks: 1, total: 4 });
  assert.equal(containmentRole(0, 3), MOTORIZED_POLICE_ROLES.PURSUIT);
  assert.equal(containmentRole(1, 3), MOTORIZED_POLICE_ROLES.PURSUIT);
  assert.equal(containmentRole(2, 3), MOTORIZED_POLICE_ROLES.PURSUIT);
  assert.equal(containmentRole(3, 3), MOTORIZED_POLICE_ROLES.ROADBLOCK);
});

test("a cruiser that has crossed the suspect enters REENGAGE instead of continuing away", () => {
  const state = nextPolicePursuitState(
    unit({ x: 72, y: 108, angle: Math.PI }),
    vehicle()
  );
  assert.equal(state, POLICE_PURSUIT_STATES.REENGAGE);
  const target = pursuitTargetForState(state, unit({ index: 1, x: 72, y: 108 }), vehicle());
  assert.ok(target.x > 100);
});

test("a cruiser already ahead in the suspect corridor enters BLOCK", () => {
  const state = nextPolicePursuitState(
    unit({ index: 1, x: 190, y: 118, angle: Math.PI }),
    vehicle()
  );
  assert.equal(state, POLICE_PURSUIT_STATES.BLOCK);
});

test("the primary close pursuer applies PRESSURE from the rear quarter", () => {
  const state = nextPolicePursuitState(
    unit({ index: 0, x: 45, y: 108, angle: 0 }),
    vehicle()
  );
  assert.equal(state, POLICE_PURSUIT_STATES.PRESSURE);
  const target = pursuitTargetForState(state, unit({ index: 0 }), vehicle());
  assert.ok(target.x < vehicle().x);
});

test("secondary pursuers outside blocking geometry keep INTERCEPT intent", () => {
  const state = nextPolicePursuitState(
    unit({ index: 2, x: -120, y: 240, angle: 0 }),
    vehicle()
  );
  assert.equal(state, POLICE_PURSUIT_STATES.INTERCEPT);
});

test("a nearly stopped suspect only becomes CONTAINED after the hold interval", () => {
  const stoppingVehicle = vehicle({ speed: 8, velocityX: 8 });
  assert.notEqual(
    nextPolicePursuitState(unit({ containmentStoppedSeconds: 0.4 }), stoppingVehicle),
    POLICE_PURSUIT_STATES.CONTAINED
  );
  assert.equal(
    nextPolicePursuitState(unit({ containmentStoppedSeconds: 0.8 }), stoppingVehicle),
    POLICE_PURSUIT_STATES.CONTAINED
  );
});

test("roadblock units stay in their dedicated ROADBLOCK state", () => {
  assert.equal(
    nextPolicePursuitState(unit({ role: MOTORIZED_POLICE_ROLES.ROADBLOCK, index: 3 }), vehicle()),
    POLICE_PURSUIT_STATES.ROADBLOCK
  );
});
