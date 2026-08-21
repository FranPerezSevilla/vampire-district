import test from "node:test";
import assert from "node:assert/strict";

import { cityRoadGraph } from "../tools/city-compiler/city-road-graph-v1.js";
import { currentCityBlueprint } from "../tools/city-compiler/current-city.js";
import { buildDistrictStreamingFileSet } from "../tools/city-compiler/district-streaming.js";
import { attachCompilerTrafficLaneTopology } from "../tools/city-compiler/traffic-lane-topology-integration.js";
import {
  advanceShadowTrafficRouteAgents,
  buildShadowTrafficRouteSnapshot,
  initializeShadowTrafficRouteAgents,
  installTrafficShadowRoutePolicy
} from "../phaser/src/streaming/TrafficShadowRoutePolicy.js";

function productionData() {
  const base = buildDistrictStreamingFileSet({
    blueprint: currentCityBlueprint,
    roadGraph: cityRoadGraph
  });
  const { fileSet } = attachCompilerTrafficLaneTopology(base);
  return {
    macroGraph: base.macroGraph,
    topology: fileSet.trafficLanes.localTopology
  };
}

function productionFlows(macroGraph, tokensPerEdge = 2) {
  return new Map((macroGraph.edgeIds || []).map((edgeId, edgeIndex) => [edgeId, {
    edgeId,
    tokenCount: tokensPerEdge,
    phases: Array.from({ length: tokensPerEdge }, (_, tokenIndex) => (
      ((edgeIndex * tokensPerEdge + tokenIndex + 1) % 17) / 17
    )),
    completedTrips: 0
  }]));
}

function flowSnapshot(flows) {
  return [...flows.entries()].map(([edgeId, flow]) => [edgeId, {
    edgeId: flow.edgeId,
    tokenCount: flow.tokenCount,
    phases: [...flow.phases],
    completedTrips: flow.completedTrips
  }]);
}

function syntheticTopology() {
  return {
    laneIds: ["lane-a", "lane-b"],
    lanes: {
      "lane-a": {
        id: "lane-a",
        sourceRoadEdgeId: "road-a",
        districtId: "district-a",
        direction: "forward",
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }]
      },
      "lane-b": {
        id: "lane-b",
        sourceRoadEdgeId: "road-b",
        districtId: "district-b",
        direction: "forward",
        points: [{ x: 100, y: 0 }, { x: 200, y: 0 }]
      }
    },
    transitionIds: ["a-to-b", "b-to-a"],
    transitions: {
      "a-to-b": {
        id: "a-to-b",
        incomingLaneId: "lane-a",
        outgoingLaneId: "lane-b",
        preferred: true,
        requiresConnector: false
      },
      "b-to-a": {
        id: "b-to-a",
        incomingLaneId: "lane-b",
        outgoingLaneId: "lane-a",
        preferred: true,
        requiresConnector: false
      }
    },
    junctionConnectors: {
      connectors: {},
      connectorIds: [],
      directHandoffTransitionIds: ["a-to-b", "b-to-a"]
    }
  };
}

function syntheticMacro() {
  const graph = {
    nodeIds: ["district-a", "district-b"],
    nodes: {
      "district-a": { id: "district-a" },
      "district-b": { id: "district-b" }
    },
    edgeIds: ["macro-a"],
    edges: {
      "macro-a": {
        id: "macro-a",
        sourceRoadEdgeIds: ["road-a", "road-b"]
      }
    }
  };
  const trafficFlows = new Map([["macro-a", {
    edgeId: "macro-a",
    tokenCount: 2,
    phases: [0.1, 0.7],
    completedTrips: 0
  }]]);
  const macro = {
    graph,
    trafficFlows,
    intervalSeconds: 2,
    trafficSpeedMultiplier: 1.12,
    simulateTick(seconds = 2) {
      for (const flow of this.trafficFlows.values()) {
        flow.phases = flow.phases.map(phase => {
          const next = phase + seconds * 0.05;
          const trips = Math.floor(next);
          flow.completedTrips += trips;
          return next - trips;
        });
      }
      return true;
    }
  };
  return macro;
}

test("production macro population seeds deterministic stable shadow route identities", () => {
  const { macroGraph, topology } = productionData();
  const flows = productionFlows(macroGraph);
  const before = structuredClone(flowSnapshot(flows));
  const first = initializeShadowTrafficRouteAgents(flows, macroGraph, topology);
  const second = initializeShadowTrafficRouteAgents(flows, macroGraph, topology);

  assert.deepEqual(first, second);
  assert.equal(first.populationConserved, true);
  assert.equal(first.unseeded.length, 0, JSON.stringify(first.unseeded.slice(0, 5)));
  assert.equal(first.seededAgentCount, first.totalMacroTokens);
  assert.equal(new Set(first.agents.map(agent => agent.tokenId)).size, first.agents.length);
  assert.deepEqual(flowSnapshot(flows), before, "seeding must not mutate macro flows");

  for (const agent of first.agents) {
    const provenance = agent.trafficMetadata?.macroCompatibility;
    assert.ok(provenance?.edgeId, agent.tokenId);
    assert.equal(macroGraph.edgeIds.includes(provenance.edgeId), true, agent.tokenId);
    assert.ok(topology.lanes[agent.currentLaneId], agent.tokenId);
  }
});

test("shadow advancement is deterministic, preserves identity and produces valid conservative projection", () => {
  const { macroGraph, topology } = productionData();
  const flows = productionFlows(macroGraph, 1);
  const initialized = initializeShadowTrafficRouteAgents(flows, macroGraph, topology);
  const ids = initialized.agents.map(agent => agent.tokenId);
  const topologyBefore = structuredClone(topology);
  const flowsBefore = structuredClone(flowSnapshot(flows));

  const first = advanceShadowTrafficRouteAgents(initialized.agents, 12, topology);
  const second = advanceShadowTrafficRouteAgents(initialized.agents, 12, topology);
  assert.deepEqual(first, second);
  assert.deepEqual(first.agents.map(agent => agent.tokenId), ids);
  assert.ok(first.stageTransitions > 0);

  const snapshot = buildShadowTrafficRouteSnapshot({
    agents: first.agents,
    unseeded: initialized.unseeded,
    topology,
    macroGraph,
    trafficFlows: flows,
    ticks: 1,
    stageTransitions: first.stageTransitions,
    junctionDecisions: first.junctionDecisions,
    blocked: first.blocked
  });
  assert.equal(snapshot.mode, "shadow");
  assert.equal(snapshot.movementAuthority, false);
  assert.equal(snapshot.macroMutationAuthority, false);
  assert.equal(snapshot.projectionValid, true, snapshot.projectionErrors.join("\n"));
  assert.equal(snapshot.populationDelta, 0);
  assert.equal(
    snapshot.projectedAgentCount + snapshot.ambiguousAgentCount + snapshot.unmatchedAgentCount,
    snapshot.shadowAgentCount
  );
  assert.deepEqual(topology, topologyBefore, "shadow advance must not mutate local topology");
  assert.deepEqual(flowSnapshot(flows), flowsBefore, "shadow advance must not mutate macro flows");
});

test("installed shadow policy advances after the real macro tick without changing macro flow semantics", () => {
  const topology = syntheticTopology();
  const control = syntheticMacro();
  const shadowMacro = syntheticMacro();
  const originalShadowTick = shadowMacro.simulateTick;
  const materializer = {
    macro: shadowMacro,
    lanes: { localTopology: topology }
  };
  const policy = installTrafficShadowRoutePolicy(materializer, { speed: 100 });

  const controlResult = control.simulateTick(2);
  const shadowResult = shadowMacro.simulateTick(2);

  assert.equal(policy.active, true);
  assert.equal(shadowResult, controlResult);
  assert.deepEqual(
    flowSnapshot(shadowMacro.trafficFlows),
    flowSnapshot(control.trafficFlows),
    "shadow wrapper must leave real macro traffic evolution unchanged"
  );

  const snapshot = policy.snapshot();
  assert.equal(snapshot.ready, true);
  assert.equal(snapshot.mode, "shadow");
  assert.equal(snapshot.ticks, 1);
  assert.equal(snapshot.shadowAgentCount, 2);
  assert.equal(snapshot.unseededAgentCount, 0);
  assert.equal(snapshot.populationDelta, 0);
  assert.equal(snapshot.movementAuthority, false);
  assert.equal(snapshot.macroMutationAuthority, false);
  assert.equal(snapshot.projectionValid, true, snapshot.projectionErrors.join("\n"));

  policy.destroy();
  assert.equal(shadowMacro.simulateTick, originalShadowTick);
  assert.equal(shadowMacro.__nbdTrafficShadowRoutePolicy, undefined);
});
