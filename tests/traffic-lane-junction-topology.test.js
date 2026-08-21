import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTrafficLaneJunctionTopology,
  installTrafficLaneJunctionTopologyPolicy,
  trafficLaneKey
} from "../phaser/src/streaming/TrafficLaneJunctionTopology.js";

const manifest = {
  junctions: [
    { id: "j0", x: 0, y: 0, radius: 24, approachDistance: 80 },
    { id: "west", x: -120, y: 0, radius: 24, approachDistance: 80 },
    { id: "east", x: 120, y: 0, radius: 24, approachDistance: 80 },
    { id: "north", x: 0, y: -120, radius: 24, approachDistance: 80 },
    { id: "south", x: 0, y: 120, radius: 24, approachDistance: 80 }
  ],
  edges: {
    west: {
      forward: [{ x: -120, y: 8 }, { x: -8, y: 8 }],
      reverse: [{ x: -8, y: -8 }, { x: -120, y: -8 }]
    },
    east: {
      forward: [{ x: 8, y: -8 }, { x: 120, y: -8 }],
      reverse: [{ x: 120, y: 8 }, { x: 8, y: 8 }]
    },
    north: {
      forward: [{ x: -8, y: -120 }, { x: -8, y: -8 }],
      reverse: [{ x: 8, y: -8 }, { x: 8, y: -120 }]
    },
    south: {
      forward: [{ x: 8, y: 8 }, { x: 8, y: 120 }],
      reverse: [{ x: -8, y: 120 }, { x: -8, y: 8 }]
    }
  }
};

test("directed lanes attach their start and end to real junctions", () => {
  const topology = buildTrafficLaneJunctionTopology(manifest);
  const westInbound = topology.laneByKey.get(trafficLaneKey("west", "forward"));
  assert.equal(westInbound.startJunctionId, "west");
  assert.equal(westInbound.endJunctionId, "j0");
  assert.equal(topology.snapshot().directedLaneCount, 8);
  assert.equal(topology.snapshot().junctionCount, 5);
});

test("an inbound lane receives legal outgoing lane-level continuations", () => {
  const topology = buildTrafficLaneJunctionTopology(manifest);
  const options = topology.continuations("west", "forward");
  const targets = new Set(options.map(option => option.outgoingLaneKey));
  assert.ok(targets.has(trafficLaneKey("east", "forward")));
  assert.ok(targets.has(trafficLaneKey("north", "reverse")));
  assert.ok(targets.has(trafficLaneKey("south", "forward")));
  assert.ok(targets.has(trafficLaneKey("west", "reverse")));
});

test("route choice avoids an immediate U-turn while another lane exists", () => {
  const topology = buildTrafficLaneJunctionTopology(manifest);
  for (let hop = 0; hop < 12; hop++) {
    const selected = topology.chooseContinuation("west", "forward", "car-17", hop);
    assert.ok(selected);
    assert.notEqual(selected.turnType, "u-turn");
    assert.notEqual(selected.outgoingLaneKey, trafficLaneKey("west", "reverse"));
  }
});

test("junction connectors preserve exact lane endpoints and stay inside the junction envelope", () => {
  const topology = buildTrafficLaneJunctionTopology(manifest, { connectorSamples: 11 });
  const option = topology.continuations("west", "forward")
    .find(candidate => candidate.outgoingLaneKey === trafficLaneKey("south", "forward"));
  assert.ok(option);
  assert.deepEqual(option.points[0], { x: -8, y: 8 });
  assert.deepEqual(option.points.at(-1), { x: 8, y: 8 });
  assert.equal(option.withinJunctionEnvelope, true);
  assert.equal(topology.snapshot().unsafeConnectorCount, 0);
});

test("connector geometry bends through junction authority rather than drawing a direct macro shortcut", () => {
  const topology = buildTrafficLaneJunctionTopology(manifest, { connectorSamples: 9 });
  const option = topology.continuations("west", "forward")
    .find(candidate => candidate.outgoingLaneKey === trafficLaneKey("north", "reverse"));
  assert.ok(option);
  const middle = option.points[Math.floor(option.points.length / 2)];
  assert.ok(Math.hypot(middle.x, middle.y) < 8);
  assert.ok(option.points.every(point => Math.hypot(point.x, point.y) <= option.envelopeRadius + 0.001));
});

test("the runtime policy builds topology only after the lane manifest is initialized", async () => {
  const materializer = {
    lanes: manifest,
    initialization: Promise.resolve()
  };
  const policy = installTrafficLaneJunctionTopologyPolicy(materializer);
  assert.equal(policy.ready, false);
  await policy.initialization;
  assert.equal(policy.ready, true);
  assert.equal(materializer.laneJunctionTopology, policy.topology);
  assert.equal(policy.snapshot().unsafeConnectorCount, 0);
  assert.ok(policy.snapshot().connectionCount > 0);
  policy.destroy();
  assert.equal(materializer.laneJunctionTopology, undefined);
});
