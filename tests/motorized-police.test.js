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
  reservedOfficerCount,
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

test("wanted levels reserve one pursuit cruiser at two and a roadblock unit at three", () => {
  assert.equal(desiredMotorizedUnits(0), 0);
  assert.equal(desiredMotorizedUnits(1), 0);
  assert.equal(desiredMotorizedUnits(2), 1);
  assert.equal(desiredMotorizedUnits(3), 2);
  assert.equal(motorizedRole(0, 3), MOTORIZED_POLICE_ROLES.PURSUIT);
  assert.equal(motorizedRole(1, 3), MOTORIZED_POLICE_ROLES.ROADBLOCK);
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

test("response origins prefer the farthest available district path", () => {
  assert.equal(chooseResponseOrigin(graph, "a", 0, ["b", "d", "c"]), "d");
  assert.equal(chooseResponseOrigin(graph, "a", 1, ["b", "d", "c"]), "c");
});

test("route advancement crosses legs and respects a partial final roadblock phase", () => {
  const legs = buildPoliceRoute(graph, lanes, ["a", "b", "c"]);
  const pursuit = advancePoliceRoute({ legs, legIndex: 0, progress: 0 }, 8, {
    speedMultiplier: 1,
    finalStopPhase: 1
  });
  assert.equal(pursuit.legIndex, 1);
  assert.ok(pursuit.progress > 0.65 && pursuit.progress < 0.68);
  assert.equal(pursuit.arrived, false);

  const roadblock = advancePoliceRoute({ legs, legIndex: 0, progress: 0 }, 20, {
    speedMultiplier: 1,
    finalStopPhase: 0.72
  });
  assert.equal(roadblock.legIndex, 1);
  assert.equal(roadblock.progress, 0.72);
  assert.equal(roadblock.arrived, true);
});

test("officer reservation ends only after each cruiser has dismounted", () => {
  assert.equal(reservedOfficerCount(2, [], 2), 2);
  assert.equal(reservedOfficerCount(3, [], 2), 4);
  assert.equal(reservedOfficerCount(3, [
    { index: 0, officersDismounted: true },
    { index: 1, officersDismounted: false }
  ], 2), 2);
  assert.equal(reservedOfficerCount(3, [
    { index: 0, officersDismounted: true },
    { index: 1, officersDismounted: true }
  ], 2), 0);
});
