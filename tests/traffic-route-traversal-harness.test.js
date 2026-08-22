import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { buildDistrictStreamingArtifacts } from "../tools/city-compiler/district-streaming.js";
import { buildTrafficLaneTopology } from "../tools/city-compiler/traffic-lane-topology.js";
import { buildTrafficJunctionConnectors } from "../tools/city-compiler/traffic-junction-connectors.js";
import { DEFAULT_CITY_SOURCE_PATH } from "../tools/city-compiler/source.js";
import { createTrafficRouteAgent } from "../phaser/src/streaming/TrafficRouteCursor.js";
import {
  createTrafficRouteTraversalHarness,
  sampleTrafficRouteAgentPose,
  runTrafficRouteTraversal
} from "../phaser/src/streaming/TrafficRouteTraversalHarness.js";
import { pointAlongPolyline } from "../phaser/src/streaming/TrafficMaterializationSystem.js";

const ROOT = new URL("../", import.meta.url);

function fixture() {
  return {
    laneIds: ["lane-a", "lane-b"],
    lanes: {
      "lane-a": {
        id: "lane-a",
        direction: "forward",
        length: 100,
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }]
      },
      "lane-b": {
        id: "lane-b",
        direction: "forward",
        length: 100,
        points: [{ x: 120, y: 20 }, { x: 220, y: 20 }]
      }
    },
    transitionIds: ["a-to-b"],
    transitions: {
      "a-to-b": {
        id: "a-to-b",
        nodeId: "junction-1",
        incomingLaneId: "lane-a",
        outgoingLaneId: "lane-b",
        preferred: true,
        requiresConnector: true
      }
    },
    junctionConnectors: {
      connectorIds: ["connector-a-b"],
      connectors: {
        "connector-a-b": {
          id: "connector-a-b",
          transitionId: "a-to-b",
          nodeId: "junction-1",
          activationSafe: true,
          rejectionReasons: [],
          length: 20,
          points: [{ x: 100, y: 0 }, { x: 110, y: 4 }, { x: 120, y: 20 }]
        }
      },
      directHandoffTransitionIds: []
    }
  };
}

function productionTopology() {
  const source = fileURLToPath(DEFAULT_CITY_SOURCE_PATH);
  const artifacts = buildDistrictStreamingArtifacts(source);
  const topology = buildTrafficLaneTopology(artifacts);
  return {
    ...topology,
    junctionConnectors: buildTrafficJunctionConnectors(topology, artifacts)
  };
}

test("M4 traversal harness crosses lane connector lane continuously with one identity", () => {
  const topology = fixture();
  const harness = createTrafficRouteTraversalHarness({
    topology,
    tokenId: "traffic-harness-1",
    laneId: "lane-a",
    speed: 100
  });
  const initial = harness.snapshot();
  assert.equal(initial.tokenId, "traffic-harness-1");
  assert.equal(initial.stage, "lane");
  assert.equal(initial.x, 0);
  assert.equal(initial.y, 0);

  const snapshots = [initial];
  for (let index = 0; index < 30; index++) {
    snapshots.push(harness.step(0.05));
    if (snapshots.at(-1).routeHop >= 1 && snapshots.at(-1).stage === "lane") break;
  }

  assert.equal(snapshots.every(item => item.tokenId === "traffic-harness-1"), true);
  assert.equal(snapshots.some(item => item.stage === "connector"), true);
  assert.equal(snapshots.at(-1).stage, "lane");
  assert.equal(snapshots.at(-1).routeHop, 1);
  assert.equal(snapshots.at(-1).currentLaneId, "lane-b");
  assert.equal(snapshots.at(-1).blockedReason, null);
  assert.equal(snapshots.at(-1).teleportCount, 0);
  assert.ok(snapshots.at(-1).maximumStepDistance <= 5.0001);
});

test("M4 traversal run helper reports zero teleports over a bounded representative crossing", () => {
  const result = runTrafficRouteTraversal({
    topology: fixture(),
    tokenId: "traffic-harness-run",
    laneId: "lane-a",
    speed: 80,
    stepSeconds: 0.05,
    steps: 50
  });
  assert.equal(result.crossedConnector, true);
  assert.equal(result.crossedOutgoingLane, true);
  assert.equal(result.teleportCount, 0);
  assert.equal(result.stableTokenId, true);
  assert.equal(result.blockedReason, null);
});

test("production traversal harness uses activation-safe compiler geometry with zero snap", () => {
  const topology = productionTopology();
  const transition = topology.transitionIds
    .map(id => topology.transitions[id])
    .find(item => item.preferred && item.requiresConnector
      && topology.junctionConnectors?.connectors?.[
        topology.junctionConnectors.transitionToConnectorId?.[item.id]
      ]?.activationSafe);
  assert.ok(transition, "production topology must expose at least one safe preferred connector transition");

  const result = runTrafficRouteTraversal({
    topology,
    tokenId: "production-harness",
    laneId: transition.incomingLaneId,
    speed: 168,
    stepSeconds: 0.02,
    steps: 800
  });
  assert.equal(result.crossedConnector, true);
  assert.equal(result.crossedOutgoingLane, true);
  assert.equal(result.teleportCount, 0);
  assert.equal(result.stableTokenId, true);
  assert.equal(result.blockedReason, null);
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

test("M4 traversal harness remains isolated from normal M8.3 compiler-route runtime", async () => {
  const source = await readFile(
    new URL("phaser/src/streaming/TrafficLocalAssignmentPolicy.js", ROOT),
    "utf8"
  );
  assert.equal(source.includes("TrafficRouteTraversalHarness"), false);
  assert.equal(source.includes('laneAuthority: multiAgent.enabled ? "compiler-route-lanes" : "authored-local-lanes"'), true);
});
