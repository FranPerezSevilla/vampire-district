import test from "node:test";
import assert from "node:assert/strict";

import {
  advanceTrafficRouteAgent,
  chooseTrafficRouteTransition,
  createTrafficRouteAgent,
  trafficRouteStageGeometry
} from "../phaser/src/streaming/TrafficRouteCursor.js";

function fixture({ includeConnector = true, includeDirectHandoff = false } = {}) {
  const laneA = {
    id: "lane:a",
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }]
  };
  const laneB = {
    id: "lane:b",
    points: [{ x: 120, y: 0 }, { x: 220, y: 0 }]
  };
  const laneC = {
    id: "lane:c",
    points: [{ x: 120, y: 20 }, { x: 220, y: 20 }]
  };
  const transitionAB = {
    id: "transition:a-b",
    incomingLaneId: laneA.id,
    outgoingLaneId: laneB.id,
    preferred: true,
    requiresConnector: !includeDirectHandoff
  };
  const transitionAC = {
    id: "transition:a-c",
    incomingLaneId: laneA.id,
    outgoingLaneId: laneC.id,
    preferred: true,
    requiresConnector: true
  };
  const connectorAB = {
    id: "connector:a-b",
    transitionId: transitionAB.id,
    activationSafe: true,
    rejectionReasons: [],
    length: 20,
    points: [{ x: 100, y: 0 }, { x: 110, y: 0 }, { x: 120, y: 0 }]
  };
  return {
    id: "fixture-topology",
    lanes: {
      [laneA.id]: laneA,
      [laneB.id]: laneB,
      [laneC.id]: laneC
    },
    transitionIds: [transitionAB.id],
    transitions: {
      [transitionAB.id]: transitionAB,
      [transitionAC.id]: transitionAC
    },
    junctionConnectors: {
      connectorIds: includeConnector && !includeDirectHandoff ? [connectorAB.id] : [],
      connectors: includeConnector && !includeDirectHandoff ? { [connectorAB.id]: connectorAB } : {},
      directHandoffTransitionIds: includeDirectHandoff ? [transitionAB.id] : []
    }
  };
}

test("one advance consumes leftover time across lane -> connector -> outgoing lane", () => {
  const topology = fixture();
  const input = createTrafficRouteAgent(topology, {
    tokenId: "car-17",
    laneId: "lane:a",
    archetypeId: "sedan",
    trafficMetadata: { district: "west-market" }
  });

  const result = advanceTrafficRouteAgent(input, 1.5, topology, { speed: 100 });

  assert.equal(result.blockedReason, null);
  assert.equal(result.remainingSeconds, 0);
  assert.equal(result.stageTransitions, 2);
  assert.equal(result.junctionDecisions, 1);
  assert.equal(result.agent.tokenId, "car-17");
  assert.equal(result.agent.stage, "lane");
  assert.equal(result.agent.currentLaneId, "lane:b");
  assert.equal(result.agent.previousLaneId, "lane:a");
  assert.equal(result.agent.connectorId, null);
  assert.equal(result.agent.nextLaneId, null);
  assert.equal(result.agent.routeHop, 1);
  assert.ok(Math.abs(result.agent.stageProgress - 0.3) < 1e-9);
  assert.equal(result.agent.archetypeId, "sedan");
  assert.deepEqual(result.agent.trafficMetadata, { district: "west-market" });
});

test("route choice is deterministic for stable token and hop", () => {
  const topology = fixture();
  topology.transitionIds = ["transition:a-b", "transition:a-c"];
  const first = chooseTrafficRouteTransition(topology, "lane:a", "car-42", 3);
  const second = chooseTrafficRouteTransition(topology, "lane:a", "car-42", 3);
  const nextHop = chooseTrafficRouteTransition(topology, "lane:a", "car-42", 4);

  assert.ok(first);
  assert.equal(first.id, second.id);
  assert.ok(["transition:a-b", "transition:a-c"].includes(first.id));
  assert.ok(["transition:a-b", "transition:a-c"].includes(nextHop.id));
});

test("missing safe connector stops at the lane end instead of inventing a route", () => {
  const topology = fixture({ includeConnector: false });
  const input = createTrafficRouteAgent(topology, {
    tokenId: "car-no-connector",
    laneId: "lane:a"
  });

  const result = advanceTrafficRouteAgent(input, 2, topology, { speed: 100 });

  assert.equal(result.blockedReason, "missing-safe-connector");
  assert.equal(result.agent.tokenId, input.tokenId);
  assert.equal(result.agent.stage, "lane");
  assert.equal(result.agent.currentLaneId, "lane:a");
  assert.equal(result.agent.stageProgress, 1);
  assert.equal(result.agent.routeHop, 0);
  assert.ok(Math.abs(result.remainingSeconds - 1) < 1e-9);
  assert.equal(result.stageTransitions, 0);
});

test("no preferred continuation produces an explicit safe halt", () => {
  const topology = fixture();
  topology.transitionIds = [];
  const input = createTrafficRouteAgent(topology, {
    tokenId: "car-dead-end",
    laneId: "lane:a"
  });

  const result = advanceTrafficRouteAgent(input, 1.25, topology, { speed: 100 });

  assert.equal(result.blockedReason, "no-preferred-transition");
  assert.equal(result.agent.currentLaneId, "lane:a");
  assert.equal(result.agent.stageProgress, 1);
  assert.ok(Math.abs(result.remainingSeconds - 0.25) < 1e-9);
});

test("validated direct handoff can cross into the outgoing lane without a connector", () => {
  const topology = fixture({ includeConnector: false, includeDirectHandoff: true });
  const input = createTrafficRouteAgent(topology, {
    tokenId: "car-direct",
    laneId: "lane:a"
  });

  const result = advanceTrafficRouteAgent(input, 1.25, topology, { speed: 100 });

  assert.equal(result.blockedReason, null);
  assert.equal(result.agent.tokenId, input.tokenId);
  assert.equal(result.agent.currentLaneId, "lane:b");
  assert.equal(result.agent.stage, "lane");
  assert.equal(result.agent.routeHop, 1);
  assert.equal(result.stageTransitions, 1);
  assert.equal(result.junctionDecisions, 1);
  assert.ok(Math.abs(result.agent.stageProgress - 0.25) < 1e-9);
});

test("route advance is immutable for both input agent and topology", () => {
  const topology = fixture();
  const agent = createTrafficRouteAgent(topology, {
    tokenId: "car-immutable",
    laneId: "lane:a",
    trafficMetadata: { laneClass: "local" }
  });
  const agentBefore = structuredClone(agent);
  const topologyBefore = structuredClone(topology);

  const result = advanceTrafficRouteAgent(agent, 1.1, topology, { speed: 100 });

  assert.deepEqual(agent, agentBefore);
  assert.deepEqual(topology, topologyBefore);
  assert.notEqual(result.agent, agent);
  assert.notEqual(result.agent.trafficMetadata, agent.trafficMetadata);
});

test("stage geometry exposes only the current compiler lane or activation-safe connector", () => {
  const topology = fixture();
  const laneAgent = createTrafficRouteAgent(topology, {
    tokenId: "car-geometry",
    laneId: "lane:a"
  });
  const laneGeometry = trafficRouteStageGeometry(topology, laneAgent);
  assert.equal(laneGeometry.kind, "lane");
  assert.equal(laneGeometry.length, 100);

  const connectorAgent = {
    ...laneAgent,
    stage: "connector",
    connectorId: "connector:a-b",
    nextLaneId: "lane:b",
    stageProgress: 0
  };
  const connectorGeometry = trafficRouteStageGeometry(topology, connectorAgent);
  assert.equal(connectorGeometry.kind, "connector");
  assert.equal(connectorGeometry.length, 20);

  topology.junctionConnectors.connectors["connector:a-b"].activationSafe = false;
  assert.equal(trafficRouteStageGeometry(topology, connectorAgent), null);
});
