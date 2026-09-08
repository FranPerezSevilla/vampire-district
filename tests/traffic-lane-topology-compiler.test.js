import test from "node:test";
import assert from "node:assert/strict";

import { cityRoadGraph } from "../tools/city-compiler/city-road-graph-v1.js";
import { currentCityBlueprint } from "../tools/city-compiler/current-city.js";
import { buildDistrictStreamingFileSet } from "../tools/city-compiler/district-streaming.js";
import {
  buildCompilerTrafficLaneTopology,
  validateCompilerTrafficLaneTopology
} from "../tools/city-compiler/traffic-lane-topology.js";

function productionTopology() {
  const streaming = buildDistrictStreamingFileSet({
    blueprint: currentCityBlueprint,
    roadGraph: cityRoadGraph
  });
  return {
    streaming,
    topology: buildCompilerTrafficLaneTopology(streaming.network)
  };
}

test("compiler topology creates four lanes on major avenues and two on narrower streets", () => {
  const { streaming, topology } = productionTopology();
  const validation = validateCompilerTrafficLaneTopology(topology);

  assert.equal(validation.valid, true, validation.errors.join("\n"));
  assert.equal(topology.ownershipMode, "compiler-node-id");
  assert.equal(topology.drivingSide, "right");
  assert.equal(topology.stats.networkSegmentCount, streaming.network.segments.length);
  assert.equal(topology.stats.directedLaneCount, streaming.network.segments.reduce((sum, segment) => sum + (segment.width >= 100 ? 4 : 2), 0));
  assert.equal(topology.laneIds.length, topology.stats.directedLaneCount);

  const lanesBySegment = new Map();
  for (const lane of Object.values(topology.lanes)) {
    const list = lanesBySegment.get(lane.sourceSegmentId) || [];
    list.push(lane);
    lanesBySegment.set(lane.sourceSegmentId, list);

    const fromNode = topology.nodes[lane.fromNodeId];
    const toNode = topology.nodes[lane.toNodeId];
    assert.ok(fromNode);
    assert.ok(toNode);
    assert.equal(lane.rightHandTraffic, true);
    assert.equal(lane.points.length, 2);

    const offset = {
      x: lane.start.x - fromNode.x,
      y: lane.start.y - fromNode.y
    };
    const screenCross = lane.tangent.x * offset.y - lane.tangent.y * offset.x;
    assert.ok(screenCross > 0, `${lane.id} must stay on the right side of travel`);
  }

  for (const segment of streaming.network.segments) {
    const lanes = lanesBySegment.get(segment.id) || [];
    assert.equal(lanes.length, segment.width >= 100 ? 4 : 2, segment.id);
    if (segment.width >= 100) {
      assert.deepEqual(new Set(lanes.map(lane => lane.laneOffset)), new Set([segment.width / 8, segment.width * 3 / 8]));
      for (const direction of ["forward", "reverse"]) assert.equal(lanes.filter(lane => lane.direction === direction).length, 2);
    }
    assert.deepEqual(new Set(lanes.map(lane => lane.direction)), new Set(["forward", "reverse"]));
  }
});

test("compiler node IDs are the transition authority with no geometric ownership guess", () => {
  const { topology } = productionTopology();

  for (const transition of Object.values(topology.transitions)) {
    const incoming = topology.lanes[transition.incomingLaneId];
    const outgoing = topology.lanes[transition.outgoingLaneId];
    assert.ok(incoming);
    assert.ok(outgoing);
    assert.equal(incoming.toNodeId, transition.nodeId);
    assert.equal(outgoing.fromNodeId, transition.nodeId);
  }

  for (const lane of Object.values(topology.lanes)) {
    const node = topology.nodes[lane.toNodeId];
    assert.ok(node);
    assert.deepEqual(
      new Set(lane.outgoingLaneIds),
      new Set(node.outgoingLaneIds.filter(id => {
        const next = topology.lanes[id];
        const right = lane.tangent.x * next.tangent.y - lane.tangent.y * next.tangent.x > 0.99;
        const dx = next.start.x - lane.end.x, dy = next.start.y - lane.end.y;
        if (right && (dx * lane.tangent.x + dy * lane.tangent.y < -0.001
          || dx * next.tangent.x + dy * next.tangent.y < -0.001)) return false;
        return lane.sourceSegmentId === next.sourceSegmentId
          || lane.lanesPerDirection !== next.lanesPerDirection || lane.laneIndex === next.laneIndex;
      }))
    );
  }
});

test("chunk seams beside avenue junctions leave forward-turning room for curb lanes", () => {
  const { topology } = productionTopology();
  const lane = topology.lanes["traffic-lane-segment:stream-edge:road-edge:h:1140:960:1754:960:0:forward:lane-2"];
  assert.ok(lane.start.x > 1185, "the exit starts ahead of the northbound curb lane, despite the nearby chunk seam");
  assert.ok(lane.end.x > lane.start.x, "the short source lane remains positive and continuous");
  for (const transition of Object.values(topology.transitions)) {
    if (!transition.preferred || transition.turnType !== "right") continue;
    const from = topology.lanes[transition.incomingLaneId], to = topology.lanes[transition.outgoingLaneId];
    const dx = to.start.x - from.end.x, dy = to.start.y - from.end.y;
    assert.ok(dx * from.tangent.x + dy * from.tangent.y >= -0.001, transition.id);
    assert.ok(dx * to.tangent.x + dy * to.tangent.y >= -0.001, transition.id);
  }
});

test("preferred continuations never choose an immediate U-turn when another segment exists", () => {
  const { topology } = productionTopology();

  for (const lane of Object.values(topology.lanes)) {
    const preferred = lane.preferredOutgoingLaneIds.map(id => topology.lanes[id]);
    assert.ok(preferred.length > 0, `${lane.id} must have a continuation`);
    const node = topology.nodes[lane.toNodeId];
    const hasAlternativeSegment = lane.outgoingLaneIds
      .map(id => topology.lanes[id])
      .some(candidate => candidate.sourceSegmentId !== lane.sourceSegmentId);

    if (hasAlternativeSegment) {
      assert.ok(
        preferred.every(candidate => candidate.sourceSegmentId !== lane.sourceSegmentId),
        `${lane.id} preferred an immediate U-turn at ${node.id}`
      );
    }
  }

  assert.equal(
    topology.stats.preferredUTurnTransitionCount,
    topology.deadEndNodeIds.reduce((sum, id) => sum + topology.nodes[id].incomingLaneIds.length * topology.nodes[id].outgoingLaneIds.length, 0),
    "only compiler dead ends should require a preferred U-turn"
  );
});

test("compiler topology is deterministic and serializable", () => {
  const streaming = buildDistrictStreamingFileSet({
    blueprint: currentCityBlueprint,
    roadGraph: cityRoadGraph
  });
  const first = buildCompilerTrafficLaneTopology(streaming.network);
  const second = buildCompilerTrafficLaneTopology(streaming.network);

  assert.deepEqual(first, second);
  assert.doesNotThrow(() => JSON.stringify(first));
  assert.equal(new Set(first.laneIds).size, first.laneIds.length);
  assert.equal(new Set(first.transitionIds).size, first.transitionIds.length);
});
