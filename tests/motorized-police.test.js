import assert from "node:assert/strict";
import test from "node:test";
import {
  advancePoliceRoute,
  buildPoliceRoute,
  chooseResponseOrigin,
  desiredMotorizedUnits,
  laneDirection,
  motorizedRole,
  MOTORIZED_POLICE_ROLES,
  MOTORIZED_POLICE_ROUTE_AGGRESSION,
  MOTORIZED_POLICE_STEERING_AGGRESSION,
  MOTORIZED_POLICE_TACTICS,
  policeTacticLabel,
  predictInterceptPoint,
  rearQuarterTarget,
  reservedOfficerCount,
  rotateToward,
  shortestDistrictPath
} from "../phaser/src/police/MotorizedPolicePolicy.js";

const graph = Object.freeze({
  nodeIds: ["a", "b", "c", "d"],
  nodes: {
    a: { neighbours: ["b"] },
    b: { neighbours: ["a", "c"] },
    c: { neighbours: ["b", "d"] },
    d: { neighbours: ["c"] }
  },
  edgeIds: ["a:b", "b:c", "c:d"],
  edges: {
    "a:b": { id: "a:b", a: "a", b: "b", travelSeconds: 4 },
    "b:c": { id: "b:c", a: "b", b: "c", travelSeconds: 6 },
    "c:d": { id: "c:d", a: "c", b: "d", travelSeconds: 5 }
  }
});

const lanes = Object.freeze({
  edges: {
    "a:b": {
      forward: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      reverse: [{ x: 100, y: 10 }, { x: 0, y: 10 }]
    },
    "b:c": {
      forward: [{ x: 100, y: 0 }, { x: 200, y: 0 }],
      reverse: [{ x: 200, y: 10 }, { x: 100, y: 10 }]
    },
    "c:d": {
      forward: [{ x: 200, y: 0 }, { x: 300, y: 0 }],
      reverse: [{ x: 300, y: 10 }, { x: 200, y: 10 }]
    }
  }
});

test("wanted two deploys three pursuit cruisers and wanted three converts the third to roadblock", () => {
  assert.equal(desiredMotorizedUnits(0), 0);
  assert.equal(desiredMotorizedUnits(1), 0);
  assert.equal(desiredMotorizedUnits(2), 3);
  assert.equal(desiredMotorizedUnits(3), 3);
  assert.equal(motorizedRole(0, 2), MOTORIZED_POLICE_ROLES.PURSUIT);
  assert.equal(motorizedRole(1, 2), MOTORIZED_POLICE_ROLES.PURSUIT);
  assert.equal(motorizedRole(2, 2), MOTORIZED_POLICE_ROLES.PURSUIT);
  assert.equal(motorizedRole(0, 3), MOTORIZED_POLICE_ROLES.PURSUIT);
  assert.equal(motorizedRole(1, 3), MOTORIZED_POLICE_ROLES.PURSUIT);
  assert.equal(motorizedRole(2, 3), MOTORIZED_POLICE_ROLES.ROADBLOCK);
});

test("shortest district routing and lane direction are deterministic", () => {
  assert.deepEqual(shortestDistrictPath(graph, "a", "d"), ["a", "b", "c", "d"]);
  assert.deepEqual(shortestDistrictPath(graph, "d", "a"), ["d", "c", "b", "a"]);
  assert.equal(laneDirection(graph.edges["a:b"], "a", "b"), "forward");
  assert.equal(laneDirection(graph.edges["a:b"], "b", "a"), "reverse");

  const route = buildPoliceRoute(graph, lanes, ["d", "c", "b"]);
  assert.equal(route.length, 2);
  assert.equal(route[0].edgeId, "c:d");
  assert.equal(route[0].direction, "reverse");
  assert.deepEqual(route[0].points, lanes.edges["c:d"].reverse);
});

test("response origins prefer the closest available external district paths", () => {
  assert.equal(chooseResponseOrigin(graph, "a", 0, ["b", "d", "c"]), "b");
  assert.equal(chooseResponseOrigin(graph, "a", 1, ["b", "d", "c"]), "c");
  assert.equal(chooseResponseOrigin(graph, "a", 2, ["b", "d", "c"]), "d");
});

test("route advancement uses the more aggressive police response multiplier", () => {
  assert.ok(MOTORIZED_POLICE_ROUTE_AGGRESSION > 1);
  assert.ok(MOTORIZED_POLICE_STEERING_AGGRESSION > 1);
  const legs = buildPoliceRoute(graph, lanes, ["a", "b", "c"]);
  const pursuit = advancePoliceRoute({ legs, legIndex: 0, progress: 0 }, 8, {
    speedMultiplier: 1,
    finalStopPhase: 1
  });
  assert.equal(pursuit.legIndex, 1);
  assert.ok(pursuit.progress > 0.92 && pursuit.progress < 0.95);
  assert.equal(pursuit.arrived, false);

  const roadblock = advancePoliceRoute({ legs, legIndex: 0, progress: 0 }, 20, {
    speedMultiplier: 1,
    finalStopPhase: 0.72
  });
  assert.equal(roadblock.legIndex, 1);
  assert.equal(roadblock.progress, 0.72);
  assert.equal(roadblock.arrived, true);
});

test("officer reservation reflects the extra wanted-two pursuit cruiser", () => {
  assert.equal(reservedOfficerCount(2, [], 2), 6);
  assert.equal(reservedOfficerCount(3, [], 2), 6);
  assert.equal(reservedOfficerCount(3, [
    { index: 0, officersDismounted: true },
    { index: 1, officersDismounted: false },
    { index: 2, officersDismounted: false }
  ], 2), 4);
  assert.equal(reservedOfficerCount(3, [
    { index: 0, officersDismounted: true },
    { index: 1, officersDismounted: true },
    { index: 2, officersDismounted: true }
  ], 2), 0);
});

test("intercept prediction leads a moving target but clamps extreme velocity", () => {
  const led = predictInterceptPoint({ x: 10, y: 20, velocityX: 40, velocityY: 0 }, {
    leadSeconds: 1,
    maxLead: 100
  });
  assert.deepEqual(led, { x: 50, y: 20, leadDistance: 40 });
  const clamped = predictInterceptPoint({ x: 0, y: 0, velocityX: 500, velocityY: 0 }, {
    leadSeconds: 1,
    maxLead: 120
  });
  assert.equal(clamped.x, 120);
  assert.equal(clamped.leadDistance, 120);
});

test("pursuit units choose opposite rear quarters and readable committed tactics", () => {
  const vehicle = { x: 100, y: 100, angle: 0 };
  const left = rearQuarterTarget(vehicle, 0);
  const right = rearQuarterTarget(vehicle, 1);
  assert.equal(left.x, 48);
  assert.equal(right.x, 48);
  assert.equal(left.y, 82);
  assert.equal(right.y, 118);
  assert.equal(left.side, -1);
  assert.equal(right.side, 1);
  assert.equal(policeTacticLabel(MOTORIZED_POLICE_TACTICS.RAM_TELEGRAPH), "RAM!");
  assert.equal(policeTacticLabel(MOTORIZED_POLICE_TACTICS.PIT_COMMIT), "PIT");
  assert.ok(rotateToward(0, Math.PI, 0.2) <= 0.2 * MOTORIZED_POLICE_STEERING_AGGRESSION + 1e-9);
});
