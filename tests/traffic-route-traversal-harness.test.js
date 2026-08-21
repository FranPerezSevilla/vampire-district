import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { cityRoadGraph } from "../tools/city-compiler/city-road-graph-v1.js";
import { currentCityBlueprint } from "../tools/city-compiler/current-city.js";
import { buildDistrictStreamingFileSet } from "../tools/city-compiler/district-streaming.js";
import { attachCompilerTrafficLaneTopology } from "../tools/city-compiler/traffic-lane-topology-integration.js";
import { pointAlongPolyline } from "../phaser/src/streaming/TrafficMaterializationSystem.js";
import {
  runTrafficRouteTraversalHarness,
  sampleTrafficRouteAgentPose,
  trafficRouteTransitionBoundaryEvidence
} from "../phaser/src/streaming/TrafficRouteTraversalHarness.js";
import { createTrafficRouteAgent } from "../phaser/src/streaming/TrafficRouteCursor.js";

const ROOT = new URL("../", import.meta.url);
const POSITION_EPSILON = 0.000001;
const DIRECT_HANDOFF_EPSILON = 0.0011;

function productionTopology() {
  const base = buildDistrictStreamingFileSet({
    blueprint: currentCityBlueprint,
    roadGraph: cityRoadGraph
  });
  return attachCompilerTrafficLaneTopology(base).fileSet.trafficLanes.localTopology;
}

function preferredTransitions(topology) {
  return (topology.transitionIds || [])
    .map(id => topology.transitions[id])
    .filter(transition => transition?.preferred)
    .sort((left, right) => left.id.localeCompare(right.id));
}

function representative(topology, turnType) {
  const candidates = preferredTransitions(topology)
    .filter(transition => transition.turnType === turnType);
  return candidates.find(transition => transition.requiresConnector) || candidates[0] || null;
}

function assertBoundarySafe(evidence) {
  assert.equal(evidence.activationSafe, true, evidence.transitionId);
  if (evidence.requiresConnector) {
    assert.ok(
      evidence.incomingConnectorPositionGap <= POSITION_EPSILON,
      `${evidence.transitionId}: incoming position gap ${evidence.incomingConnectorPositionGap}`
    );
    assert.ok(
      evidence.connectorOutgoingPositionGap <= POSITION_EPSILON,
      `${evidence.transitionId}: outgoing position gap ${evidence.connectorOutgoingPositionGap}`
    );
    assert.ok(
      evidence.incomingConnectorHeadingGap <= evidence.headingTolerance + POSITION_EPSILON,
      `${evidence.transitionId}: incoming heading gap ${evidence.incomingConnectorHeadingGap}`
    );
    assert.ok(
      evidence.connectorOutgoingHeadingGap <= evidence.headingTolerance + POSITION_EPSILON,
      `${evidence.transitionId}: outgoing heading gap ${evidence.connectorOutgoingHeadingGap}`
    );
  } else {
    assert.equal(evidence.directValidated, true, evidence.transitionId);
    assert.ok(
      evidence.maximumPositionGap <= DIRECT_HANDOFF_EPSILON,
      `${evidence.transitionId}: direct position gap ${evidence.maximumPositionGap}`
    );
    assert.ok(
      evidence.maximumHeadingGap <= DIRECT_HANDOFF_EPSILON,
      `${evidence.transitionId}: direct heading gap ${evidence.maximumHeadingGap}`
    );
  }
}

for (const turnType of ["straight", "right", "left", "u-turn"]) {
  test(`production ${turnType} traversal preserves position, heading and stable identity`, () => {
    const topology = productionTopology();
    const transition = representative(topology, turnType);
    assert.ok(transition, `production topology needs a preferred ${turnType} transition`);

    const evidence = trafficRouteTransitionBoundaryEvidence(topology, transition.id);
    assertBoundarySafe(evidence);

    const topologyBefore = structuredClone(topology);
    const result = runTrafficRouteTraversalHarness(topology, transition.id, {
      speed: 100,
      startProgress: 0.92,
      outgoingProgress: 0.2
    });

    assert.equal(result.turnType, turnType);
    assert.equal(result.blockedReason, null, `${transition.id}: ${result.blockedReason}`);
    assert.equal(result.sameStableIdentity, true);
    assert.equal(result.reachedOutgoingLane, true);
    assert.equal(result.finalAgent.tokenId, result.initialAgent.tokenId);
    assert.equal(result.finalAgent.currentLaneId, transition.outgoingLaneId);
    assert.equal(result.finalAgent.stage, "lane");
    assert.ok(
      Math.abs(result.finalAgent.stageProgress - 0.2) <= 0.00001,
      `${transition.id}: outgoing progress ${result.finalAgent.stageProgress}`
    );
    assert.equal(result.junctionDecisions, 1);
    assert.equal(result.stageTransitions, transition.requiresConnector ? 2 : 1);
    assert.ok(result.remainingSeconds <= 0.000001, transition.id);
    assert.deepEqual(topology, topologyBefore, "isolated traversal must not mutate compiler topology");
  });
}

test("production direct handoff uses the same sampler without a coordinate snap", () => {
  const topology = productionTopology();
  const transition = preferredTransitions(topology)
    .find(candidate => !candidate.requiresConnector);
  assert.ok(transition, "production topology needs at least one validated direct handoff");

  const evidence = trafficRouteTransitionBoundaryEvidence(topology, transition.id);
  assert.equal(evidence.requiresConnector, false);
  assertBoundarySafe(evidence);

  const result = runTrafficRouteTraversalHarness(topology, transition.id, {
    speed: 120,
    startProgress: 0.97,
    outgoingProgress: 0.15
  });
  assert.equal(result.blockedReason, null);
  assert.equal(result.sameStableIdentity, true);
  assert.equal(result.reachedOutgoingLane, true);
  assert.ok(Math.abs(result.finalAgent.stageProgress - 0.15) <= 0.00001);
});

test("harness pose sampling is exactly TrafficMaterializationSystem pointAlongPolyline", () => {
  const topology = productionTopology();
  const laneId = topology.laneIds[0];
  const agent = createTrafficRouteAgent(topology, {
    tokenId: "sampler-contract",
    laneId,
    stageProgress: 0.4375
  });
  const harnessPose = sampleTrafficRouteAgentPose(topology, agent);
  const materializerPose = pointAlongPolyline(topology.lanes[laneId].points, 0.4375);

  assert.equal(harnessPose.x, materializerPose.x);
  assert.equal(harnessPose.y, materializerPose.y);
  assert.equal(harnessPose.angle, materializerPose.angle);
});

test("M4 traversal harness remains isolated from normal local traffic runtime", async () => {
  const source = await readFile(
    new URL("phaser/src/streaming/TrafficLocalAssignmentPolicy.js", ROOT),
    "utf8"
  );
  assert.equal(source.includes("TrafficRouteTraversalHarness"), false);
  assert.equal(source.includes('laneAuthority: "authored-local-lanes"'), true);
});
