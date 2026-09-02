import test from "node:test";
import assert from "node:assert/strict";

import {
  createTrafficMultiAgentRouteRuntime,
  installTrafficMultiAgentRouteRuntimePolicy
} from "../phaser/src/streaming/TrafficMultiAgentRouteRuntimePolicy.js";
import {
  installTrafficRouteMaterializationMetadataPolicy
} from "../phaser/src/streaming/TrafficRouteMaterializationPolicy.js";

function topologyFixture() {
  return {
    laneIds: ["lane-a", "lane-b", "lane-c", "lane-d"],
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
        points: [{ x: 100, y: -100 }, { x: 100, y: 0 }]
      },
      "lane-c": {
        id: "lane-c",
        sourceRoadEdgeId: "road-c",
        districtId: "district-c",
        direction: "forward",
        points: [{ x: 120, y: 20 }, { x: 220, y: 20 }]
      },
      "lane-d": {
        id: "lane-d",
        sourceRoadEdgeId: "road-d",
        districtId: "district-d",
        direction: "forward",
        points: [{ x: 80, y: 20 }, { x: 80, y: 120 }]
      }
    },
    transitionIds: ["a-to-c", "b-to-d"],
    transitions: {
      "a-to-c": {
        id: "a-to-c",
        nodeId: "junction-1",
        incomingLaneId: "lane-a",
        outgoingLaneId: "lane-c",
        preferred: true,
        requiresConnector: true,
        turnType: "right"
      },
      "b-to-d": {
        id: "b-to-d",
        nodeId: "junction-1",
        incomingLaneId: "lane-b",
        outgoingLaneId: "lane-d",
        preferred: true,
        requiresConnector: true,
        turnType: "left"
      }
    },
    junctionConnectors: {
      connectorIds: ["connector-a", "connector-b"],
      connectors: {
        "connector-a": {
          id: "connector-a",
          transitionId: "a-to-c",
          nodeId: "junction-1",
          activationSafe: true,
          rejectionReasons: [],
          length: 20,
          points: [{ x: 100, y: 0 }, { x: 110, y: 3 }, { x: 120, y: 20 }]
        },
        "connector-b": {
          id: "connector-b",
          transitionId: "b-to-d",
          nodeId: "junction-1",
          activationSafe: true,
          rejectionReasons: [],
          length: 20,
          points: [{ x: 100, y: 0 }, { x: 90, y: 3 }, { x: 80, y: 20 }]
        }
      },
      directHandoffTransitionIds: []
    }
  };
}

function macroFixture() {
  const graph = {
    nodeIds: ["district-a", "district-b", "district-c", "district-d"],
    nodes: {
      "district-a": { id: "district-a", center: { x: 9000, y: 9000 } },
      "district-b": { id: "district-b", center: { x: 9100, y: 9100 } },
      "district-c": { id: "district-c", center: { x: 9200, y: 9200 } },
      "district-d": { id: "district-d", center: { x: 9300, y: 9300 } }
    },
    edgeIds: ["macro-a", "macro-b"],
    edges: {
      "macro-a": { id: "macro-a", a: "district-a", b: "district-c", sourceRoadEdgeIds: ["road-a"] },
      "macro-b": { id: "macro-b", a: "district-b", b: "district-d", sourceRoadEdgeIds: ["road-b"] }
    }
  };
  const trafficFlows = new Map([
    ["macro-a", { edgeId: "macro-a", tokenCount: 1, phases: [0.99], completedTrips: 0 }],
    ["macro-b", { edgeId: "macro-b", tokenCount: 1, phases: [0.99], completedTrips: 0 }]
  ]);
  return { graph, trafficFlows };
}

function flowSnapshot(flows) {
  return [...flows.entries()].map(([edgeId, flow]) => [edgeId, {
    edgeId: flow.edgeId,
    tokenCount: flow.tokenCount,
    phases: [...flow.phases],
    completedTrips: flow.completedTrips
  }]);
}

function agentById(runtime, tokenId) {
  return runtime.agents().find(agent => agent.tokenId === tokenId);
}

test("M8 multi-agent runtime conserves macro population but drives only on compiler route geometry", () => {
  const topology = topologyFixture();
  const { graph, trafficFlows } = macroFixture();
  const beforeFlows = structuredClone(flowSnapshot(trafficFlows));
  const runtime = createTrafficMultiAgentRouteRuntime({
    trafficFlows,
    macroGraph: graph,
    topology,
    speed: 100,
    reservationStaleAfterSeconds: 5
  });

  const initial = runtime.snapshot();
  assert.equal(initial.populationConserved, true);
  assert.equal(initial.totalMacroTokens, 2);
  assert.equal(initial.seededAgentCount, 2);
  assert.equal(initial.unseededAgentCount, 0);
  assert.equal(initial.districtPopulationCount, 2);
  assert.equal(initial.districtPopulationConserved, true);
  assert.equal(initial.macroMutationAuthority, false);
  assert.equal(initial.macroCoordinateAuthority, false);
  assert.deepEqual(runtime.agents().map(agent => agent.tokenId), ["macro-a#0", "macro-b#0"]);

  const initialTokens = runtime.materializationTokens();
  assert.equal(initialTokens.length, 2);
  assert.deepEqual(
    initialTokens.map(token => ({ tokenId: token.tokenId, x: token.x, y: token.y })),
    [
      { tokenId: "macro-a#0", x: 99, y: 0 },
      { tokenId: "macro-b#0", x: 100, y: -1 }
    ],
    "bootstrap phase may select compiler lane progress but macro district centres are never driving coordinates"
  );
  assert.equal(initialTokens.some(token => token.x >= 9000 || token.y >= 9000), false);

  const first = runtime.step(0.05);
  const carA = agentById(runtime, "macro-a#0");
  const carB = agentById(runtime, "macro-b#0");
  assert.equal(carA.stage, "connector");
  assert.equal(carA.connectorId, "connector-a");
  assert.equal(carB.stage, "lane");
  assert.equal(carB.stageProgress, 1, "conflicting waiter must remain exactly at incoming lane end");
  assert.equal(first.routeReservationCount, 1);
  assert.equal(first.routeReservations[0].tokenId, "macro-a#0");
  assert.equal(first.blocked.some(item => item.tokenId === "macro-b#0" && item.reason === "junction-yield"), true);
  assert.ok(first.totalYieldCount >= 1);

  runtime.step(0.1);
  assert.equal(agentById(runtime, "macro-a#0").stage, "connector");
  assert.equal(agentById(runtime, "macro-b#0").stage, "lane");

  const releasedAndTransferred = runtime.step(0.1);
  assert.equal(agentById(runtime, "macro-a#0").stage, "lane");
  assert.equal(agentById(runtime, "macro-a#0").currentLaneId, "lane-c");
  assert.equal(agentById(runtime, "macro-b#0").stage, "connector");
  assert.equal(agentById(runtime, "macro-b#0").connectorId, "connector-b");
  assert.equal(releasedAndTransferred.routeReservationCount, 1);
  assert.equal(releasedAndTransferred.routeReservations[0].tokenId, "macro-b#0");
  assert.deepEqual(flowSnapshot(trafficFlows), beforeFlows, "route runtime must not mutate bootstrap macro phases/load state");

  runtime.destroy();
  assert.equal(runtime.reservationRegistry.snapshot().activeReservationCount, 0);
});

test("M8 multi-agent route progression is deterministic for the same population and topology", () => {
  const topology = topologyFixture();
  const firstMacro = macroFixture();
  const secondMacro = macroFixture();
  const first = createTrafficMultiAgentRouteRuntime({
    trafficFlows: firstMacro.trafficFlows,
    macroGraph: firstMacro.graph,
    topology,
    speed: 100
  });
  const second = createTrafficMultiAgentRouteRuntime({
    trafficFlows: secondMacro.trafficFlows,
    macroGraph: secondMacro.graph,
    topology,
    speed: 100
  });

  for (const seconds of [0.05, 0.1, 0.1, 0.05]) {
    first.step(seconds);
    second.step(seconds);
  }

  assert.deepEqual(first.agents(), second.agents());
  assert.deepEqual(first.materializationTokens(), second.materializationTokens());
  assert.deepEqual(first.snapshot().routeReservations, second.snapshot().routeReservations);

  first.destroy();
  second.destroy();
});

function fakeMaterializer() {
  const topology = topologyFixture();
  topology.nodes = {
    "junction-1": { id: "junction-1", x: 100, y: 0, trimDistance: 20, maximumRoadWidth: 40 }
  };
  topology.lanes["lane-a"].points = [{ x: 0, y: 0 }, { x: 80, y: 0 }];
  topology.lanes["lane-b"].points = [{ x: 100, y: -100 }, { x: 100, y: -20 }];
  topology.lanes["lane-c"].points = [{ x: 120, y: 0 }, { x: 220, y: 0 }];
  topology.lanes["lane-d"].points = [{ x: 100, y: 20 }, { x: 100, y: 120 }];
  topology.transitions["a-to-c"].turnType = "straight";
  topology.transitions["b-to-d"].turnType = "straight";
  topology.junctionConnectors.connectors["connector-a"].length = 40;
  topology.junctionConnectors.connectors["connector-a"].points = [
    { x: 80, y: 0 }, { x: 100, y: 0 }, { x: 120, y: 0 }
  ];
  topology.junctionConnectors.connectors["connector-b"].length = 40;
  topology.junctionConnectors.connectors["connector-b"].points = [
    { x: 100, y: -20 }, { x: 100, y: 0 }, { x: 100, y: 20 }
  ];
  const { graph, trafficFlows } = macroFixture();
  const legacyTokens = [
    { tokenId: "macro-a#0", edgeId: "macro-a", tokenIndex: 0, direction: "forward", phase: 0.99, x: -50, y: -50, angle: 0 },
    { tokenId: "macro-b#0", edgeId: "macro-b", tokenIndex: 0, direction: "forward", phase: 0.99, x: -60, y: -60, angle: 0 }
  ];
  const pool = [0, 1].map(slotIndex => ({
    slotIndex,
    tokenId: null,
    x: 0,
    y: 0,
    angle: 0,
    container: { visible: true, active: true }
  }));
  const behaviorCalls = { base: 0 };
  const steeringCalls = { base: 0 };
  const accounting = { provider: null, installs: 0, clears: 0 };
  const behavior = {
    applyDecision(slot) {
      behaviorCalls.base++;
      slot.x += 1000;
      return slot;
    }
  };
  const steering = {
    applyPresentation(slot) {
      steeringCalls.base++;
      slot.y += 1000;
      return slot;
    }
  };
  const macro = {
    graph,
    trafficFlows,
    setCivilianRouteAccountingProvider(provider) {
      accounting.provider = provider;
      accounting.installs++;
    },
    clearCivilianRouteAccountingProvider(provider) {
      if (accounting.provider !== provider) return false;
      accounting.provider = null;
      accounting.clears++;
      return true;
    }
  };
  const materializer = {
    lanes: { localTopology: topology },
    macro,
    pool,
    assignments: new Map(),
    scene: {
      trafficLocalBehaviorSystem: behavior,
      trafficSteeringPresentationSystem: steering
    },
    trafficTokens() {
      return legacyTokens.map(token => ({ ...token }));
    },
    updateSlot(slot, token) {
      slot.edgeId = token.edgeId;
      slot.tokenIndex = token.tokenIndex;
      slot.direction = token.direction;
      slot.phase = token.phase;
      slot.x = token.x;
      slot.y = token.y;
      slot.angle = token.angle;
      return slot;
    },
    assign(slot, token) {
      slot.tokenId = token.tokenId;
      this.assignments.set(token.tokenId, slot);
      return this.updateSlot(slot, token);
    },
    release(slot) {
      if (!slot?.tokenId) return false;
      this.assignments.delete(slot.tokenId);
      slot.tokenId = null;
      return true;
    },
    reconcile() {
      const tokens = this.trafficTokens();
      const byId = new Map(tokens.map(token => [token.tokenId, token]));
      for (const slot of this.pool) {
        if (slot.tokenId && !byId.has(slot.tokenId)) this.release(slot, { force: true });
      }
      for (const token of tokens) {
        let slot = this.assignments.get(token.tokenId);
        if (!slot) {
          slot = this.pool.find(candidate => !candidate.tokenId);
          if (!slot) continue;
          this.assign(slot, token);
        } else {
          this.updateSlot(slot, token);
        }
      }
      return true;
    }
  };
  return { materializer, pool, behavior, steering, behaviorCalls, steeringCalls, accounting };
}

test("M8 manual regression mode remains opt-in, keeps a fixed pool and guards route-active pose", () => {
  const { materializer, pool, behavior, steering, behaviorCalls, steeringCalls } = fakeMaterializer();
  const metadata = installTrafficRouteMaterializationMetadataPolicy(materializer);
  const policy = installTrafficMultiAgentRouteRuntimePolicy(materializer, {
    speed: 100,
    defaultEnabled: false
  });
  const poolRef = materializer.pool;

  const before = policy.snapshot();
  assert.equal(before.enabled, false);
  assert.equal(before.defaultEnabled, false);
  assert.equal(before.defaultTrafficAuthority, "authored-local-lanes");
  assert.equal(before.macroMutationAuthority, false);
  assert.equal(before.macroCoordinateAuthority, false);
  assert.equal(materializer.trafficTokens()[0].routeActive, undefined);

  let snapshot = policy.start();
  assert.equal(snapshot.enabled, true);
  assert.equal(snapshot.populationConserved, true);
  assert.equal(snapshot.seededAgentCount, 2);
  assert.equal(snapshot.fixedPoolPreserved, true);
  assert.equal(snapshot.macroAccountingInstalled, false);
  assert.equal(materializer.pool, poolRef);
  assert.equal(materializer.pool.length, 2);
  assert.equal(materializer.assignments.size, 2);
  assert.equal(pool.every(slot => slot.routeActive === true), true);
  assert.equal(snapshot.behaviorGuardInstalled, true);
  assert.equal(snapshot.steeringGuardInstalled, true);

  const guardedSlot = pool[0];
  const beforeX = guardedSlot.x;
  const beforeY = guardedSlot.y;
  behavior.applyDecision(guardedSlot, {}, {}, {}, 0.05);
  steering.applyPresentation(guardedSlot, {}, 0.05);
  assert.equal(behaviorCalls.base, 0);
  assert.equal(steeringCalls.base, 0);
  assert.equal(guardedSlot.x, beforeX);
  assert.equal(guardedSlot.y, beforeY);

  snapshot = policy.step(0.05);
  assert.equal(snapshot.fixedPoolPreserved, true);
  assert.equal(materializer.pool.length, 2);
  assert.equal(materializer.assignments.size, 2);
  assert.equal(snapshot.routeReservationCount, 1);

  const stopped = policy.stop();
  assert.equal(stopped.enabled, false);
  assert.equal(stopped.fixedPoolPreserved, true);
  assert.equal(materializer.pool, poolRef);
  assert.equal(materializer.pool.length, 2);
  assert.equal(pool.every(slot => slot.routeActive === false), true, "legacy tokens must clear route metadata after explicit stop");
  assert.equal(materializer.trafficTokens()[0].routeActive, undefined);

  policy.destroy();
  metadata.destroy();
});

test("M8.3 default policy activates from frame update only after a complete conservative production-shaped seed", () => {
  const { materializer, pool, accounting } = fakeMaterializer();
  const metadata = installTrafficRouteMaterializationMetadataPolicy(materializer);
  const policy = installTrafficMultiAgentRouteRuntimePolicy(materializer, { speed: 100 });
  const poolRef = materializer.pool;
  const flowsBefore = structuredClone(flowSnapshot(materializer.macro.trafficFlows));

  const before = policy.snapshot();
  assert.equal(before.enabled, false);
  assert.equal(before.defaultEnabled, true);
  assert.equal(before.defaultTrafficAuthority, "multi-agent-compiler-route");
  assert.equal(before.defaultActivationReady, true);

  let snapshot = policy.update(0.05);
  materializer.reconcile(true);
  snapshot = policy.snapshot();

  assert.equal(snapshot.enabled, true);
  assert.equal(snapshot.activationBlockedReason, null);
  assert.equal(snapshot.activationAttempts, 1);
  assert.equal(snapshot.populationConserved, true);
  assert.equal(snapshot.unseededAgentCount, 0);
  assert.equal(snapshot.projectionValid, true);
  assert.equal(snapshot.districtPopulationConserved, true);
  assert.equal(snapshot.macroAccountingInstalled, true);
  assert.equal(snapshot.behaviorGuardInstalled, true);
  assert.equal(snapshot.steeringGuardInstalled, true);
  assert.equal(snapshot.fixedPoolPreserved, true);
  assert.equal(accounting.installs, 1);
  assert.equal(typeof accounting.provider, "function");
  assert.equal(accounting.provider().populationConserved, true);
  assert.equal(materializer.pool, poolRef);
  assert.equal(materializer.pool.length, 2);
  assert.equal(materializer.assignments.size, 2);
  assert.equal(pool.every(slot => slot.routeActive === true), true);
  assert.deepEqual(flowSnapshot(materializer.macro.trafficFlows), flowsBefore);

  policy.update(0.05);
  materializer.reconcile(true);
  assert.equal(policy.snapshot().ticks, 2, "normal frame updates, not debug step(), own route advancement");

  const stopped = policy.stop();
  assert.equal(stopped.enabled, false);
  assert.equal(accounting.provider, null);
  assert.equal(accounting.clears, 1);
  assert.equal(pool.every(slot => slot.routeActive === false), true);

  policy.destroy();
  metadata.destroy();
});

test("M8.3 default activation fails closed when any production token cannot seed onto compiler topology", () => {
  const { materializer, accounting } = fakeMaterializer();
  materializer.macro.graph.edges["macro-b"].sourceRoadEdgeIds = ["missing-road"];
  const metadata = installTrafficRouteMaterializationMetadataPolicy(materializer);
  const policy = installTrafficMultiAgentRouteRuntimePolicy(materializer, { speed: 100 });

  const snapshot = policy.update(0.05);
  assert.equal(snapshot.enabled, false);
  assert.equal(snapshot.defaultEnabled, true);
  assert.equal(snapshot.macroAccountingInstalled, false);
  assert.match(snapshot.activationBlockedReason, /^unseeded-production-tokens:1$/);
  assert.equal(accounting.provider, null);
  assert.equal(materializer.trafficTokens()[0].routeActive, undefined);

  policy.destroy();
  metadata.destroy();
});
