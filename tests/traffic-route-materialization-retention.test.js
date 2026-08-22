import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { LAYERS } from "../phaser/src/data/district.js";
import {
  clearTrafficRouteSlotMetadata,
  installTrafficRouteMaterializationMetadataPolicy,
  trafficRouteAgentMaterializationToken
} from "../phaser/src/streaming/TrafficRouteMaterializationPolicy.js";
import {
  installTrafficLifecyclePolicy,
  TRAFFIC_LIFECYCLE_STATES
} from "../phaser/src/streaming/TrafficLifecyclePolicy.js";
import { createTrafficRouteAgent } from "../phaser/src/streaming/TrafficRouteCursor.js";

const ROOT = new URL("../", import.meta.url);

function topologyFixture() {
  return {
    laneIds: ["lane-in", "lane-out"],
    lanes: {
      "lane-in": {
        id: "lane-in",
        sourceRoadEdgeId: "road-in",
        districtId: "district-a",
        direction: "forward",
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }]
      },
      "lane-out": {
        id: "lane-out",
        sourceRoadEdgeId: "road-out",
        districtId: "district-b",
        direction: "forward",
        points: [{ x: 120, y: 20 }, { x: 220, y: 20 }]
      }
    },
    transitionIds: ["transition-in-out"],
    transitions: {
      "transition-in-out": {
        id: "transition-in-out",
        nodeId: "junction-a",
        incomingLaneId: "lane-in",
        outgoingLaneId: "lane-out",
        preferred: true,
        requiresConnector: true,
        turnType: "right"
      }
    },
    junctionConnectors: {
      connectorIds: ["connector-in-out"],
      connectors: {
        "connector-in-out": {
          id: "connector-in-out",
          transitionId: "transition-in-out",
          nodeId: "junction-a",
          activationSafe: true,
          rejectionReasons: [],
          length: 30,
          points: [{ x: 100, y: 0 }, { x: 110, y: 4 }, { x: 120, y: 20 }]
        }
      },
      directHandoffTransitionIds: []
    }
  };
}

function routeAgents(topology) {
  const incoming = createTrafficRouteAgent(topology, {
    tokenId: "traffic-route-test",
    laneId: "lane-in",
    stageProgress: 0.9,
    trafficMetadata: {
      macroCompatibility: { edgeId: "macro-a", tokenIndex: 0 }
    }
  });
  const connector = {
    ...incoming,
    stage: "connector",
    currentLaneId: "lane-in",
    connectorId: "connector-in-out",
    nextLaneId: "lane-out",
    previousLaneId: "lane-in",
    stageProgress: 0.5,
    routeHop: 0
  };
  const outgoing = {
    ...incoming,
    stage: "lane",
    currentLaneId: "lane-out",
    connectorId: null,
    nextLaneId: null,
    previousLaneId: "lane-in",
    stageProgress: 0.1,
    routeHop: 1
  };
  return { incoming, connector, outgoing };
}

function fakeMaterializer() {
  const slot = {
    slotIndex: 0,
    tokenId: null,
    edgeId: null,
    tokenIndex: -1,
    direction: null,
    phase: 0,
    x: 0,
    y: 0,
    angle: 0,
    radius: 12,
    container: { active: true, visible: true }
  };
  let liveTokens = [];
  const materializer = {
    scene: {
      currentLayer: LAYERS.STREET,
      cameras: { main: { worldView: { x: -300, y: -300, width: 600, height: 600 } } }
    },
    pool: [slot],
    assignments: new Map(),
    trafficTokens() {
      return liveTokens.map(token => ({ ...token }));
    },
    assign(target, token) {
      target.tokenId = token.tokenId;
      this.assignments.set(token.tokenId, target);
      return this.updateSlot(target, token);
    },
    release(target) {
      if (!target?.tokenId) return false;
      this.assignments.delete(target.tokenId);
      target.tokenId = null;
      target.edgeId = null;
      target.tokenIndex = -1;
      target.direction = null;
      return true;
    },
    updateSlot(target, token) {
      target.edgeId = token.edgeId;
      target.tokenIndex = token.tokenIndex;
      target.direction = token.direction;
      target.phase = token.phase;
      target.x = token.x;
      target.y = token.y;
      target.angle = token.angle;
      return target;
    },
    update() {
      return false;
    },
    snapshot() {
      return { materializedCount: this.assignments.size };
    }
  };
  return {
    materializer,
    slot,
    setLiveTokens(tokens) {
      liveTokens = tokens;
    }
  };
}

test("route materialization token samples compiler lane geometry and carries stable identity metadata", () => {
  const topology = topologyFixture();
  const { incoming } = routeAgents(topology);
  const token = trafficRouteAgentMaterializationToken(topology, incoming);

  assert.equal(token.tokenId, "traffic-route-test");
  assert.equal(token.edgeId, "macro-a");
  assert.equal(token.tokenIndex, 0);
  assert.equal(token.routeActive, true);
  assert.equal(token.routeStage, "lane");
  assert.equal(token.routeLaneId, "lane-in");
  assert.equal(token.routeConnectorId, null);
  assert.equal(token.routeGeometryId, "lane-in");
  assert.equal(token.x, 90);
  assert.equal(token.y, 0);
});

test("route materialization token samples connector geometry without changing token identity", () => {
  const topology = topologyFixture();
  const { connector } = routeAgents(topology);
  const token = trafficRouteAgentMaterializationToken(topology, connector);

  assert.equal(token.tokenId, "traffic-route-test");
  assert.equal(token.routeActive, true);
  assert.equal(token.routeStage, "connector");
  assert.equal(token.routeLaneId, "lane-in");
  assert.equal(token.routeConnectorId, "connector-in-out");
  assert.equal(token.routeNextLaneId, "lane-out");
  assert.equal(token.routeGeometryId, "connector-in-out");
});

test("route metadata policy keeps the same slot identity across lane connector lane updates", () => {
  const topology = topologyFixture();
  const { incoming, connector, outgoing } = routeAgents(topology);
  const tokens = [incoming, connector, outgoing].map(agent => trafficRouteAgentMaterializationToken(topology, agent));
  const { materializer, slot } = fakeMaterializer();
  const policy = installTrafficRouteMaterializationMetadataPolicy(materializer);

  materializer.assign(slot, tokens[0]);
  const originalSlot = materializer.assignments.get(tokens[0].tokenId);
  assert.equal(originalSlot, slot);
  assert.equal(slot.routeStage, "lane");
  assert.equal(slot.routeLaneId, "lane-in");

  materializer.updateSlot(slot, tokens[1]);
  assert.equal(materializer.assignments.get(tokens[1].tokenId), originalSlot);
  assert.equal(slot.routeActive, true);
  assert.equal(slot.routeStage, "connector");
  assert.equal(slot.routeConnectorId, "connector-in-out");

  materializer.updateSlot(slot, tokens[2]);
  assert.equal(materializer.assignments.get(tokens[2].tokenId), originalSlot);
  assert.equal(slot.routeStage, "lane");
  assert.equal(slot.routeLaneId, "lane-out");
  assert.equal(slot.routeHop, 1);

  policy.destroy();
});

test("route-aware lifecycle protects a connector slot from normal release until the same route token exits", () => {
  const topology = topologyFixture();
  const { connector, outgoing } = routeAgents(topology);
  const connectorToken = trafficRouteAgentMaterializationToken(topology, connector);
  const outgoingToken = trafficRouteAgentMaterializationToken(topology, outgoing);
  const { materializer, slot, setLiveTokens } = fakeMaterializer();

  const metadataPolicy = installTrafficRouteMaterializationMetadataPolicy(materializer);
  const lifecyclePolicy = installTrafficLifecyclePolicy(materializer);
  setLiveTokens([connectorToken]);
  materializer.assign(slot, connectorToken);
  materializer.update(0.1);

  assert.equal(slot.lifecycleState, TRAFFIC_LIFECYCLE_STATES.CROSSING_JUNCTION);
  assert.equal(materializer.release(slot), false);
  assert.equal(slot.tokenId, connectorToken.tokenId);

  setLiveTokens([outgoingToken]);
  materializer.updateSlot(slot, outgoingToken);
  materializer.update(0.1);
  assert.notEqual(slot.lifecycleState, TRAFFIC_LIFECYCLE_STATES.CROSSING_JUNCTION);
  assert.equal(materializer.release(slot), true);
  assert.equal(slot.routeActive, false);
  assert.equal(slot.routeLaneId, null);
  assert.equal(slot.routeConnectorId, null);
  assert.equal(materializer.assignments.has(outgoingToken.tokenId), false);

  lifecyclePolicy.destroy();
  metadataPolicy.destroy();
});

test("forced layer-switch semantics can release a protected connector slot", () => {
  const topology = topologyFixture();
  const { connector } = routeAgents(topology);
  const connectorToken = trafficRouteAgentMaterializationToken(topology, connector);
  const { materializer, slot, setLiveTokens } = fakeMaterializer();

  const metadataPolicy = installTrafficRouteMaterializationMetadataPolicy(materializer);
  const lifecyclePolicy = installTrafficLifecyclePolicy(materializer);
  setLiveTokens([connectorToken]);
  materializer.assign(slot, connectorToken);
  materializer.update(0.1);
  assert.equal(slot.lifecycleState, TRAFFIC_LIFECYCLE_STATES.CROSSING_JUNCTION);

  materializer.scene.currentLayer = LAYERS.ROOFTOP;
  assert.equal(materializer.release(slot), true);
  assert.equal(slot.routeActive, false);
  assert.equal(slot.routeConnectorId, null);

  lifecyclePolicy.destroy();
  metadataPolicy.destroy();
});

test("legacy slot updates clear stale route metadata instead of leaking it to another car", () => {
  const slot = {};
  slot.routeActive = true;
  slot.routeStage = "connector";
  slot.routeLaneId = "old-lane";
  slot.routeConnectorId = "old-connector";
  clearTrafficRouteSlotMetadata(slot);

  assert.equal(slot.routeActive, false);
  assert.equal(slot.routeStage, null);
  assert.equal(slot.routeLaneId, null);
  assert.equal(slot.routeConnectorId, null);
});

test("M5/M6 route substrate stays controlled while M8.3 owns the separate default traffic authority", async () => {
  const source = await readFile(
    new URL("phaser/src/streaming/TrafficLocalAssignmentPolicy.js", ROOT),
    "utf8"
  );
  const controlledSource = await readFile(
    new URL("phaser/src/streaming/TrafficControlledRouteActivationPolicy.js", ROOT),
    "utf8"
  );
  const multiSource = await readFile(
    new URL("phaser/src/streaming/TrafficMultiAgentRouteRuntimePolicy.js", ROOT),
    "utf8"
  );
  assert.equal(source.includes("installTrafficRouteMaterializationMetadataPolicy"), true);
  assert.equal(source.includes("routeMovementActive: Boolean(controlled.enabled) || Boolean(multiAgent.enabled)"), true);
  assert.equal(source.includes('laneAuthority: multiAgent.enabled ? "compiler-route-lanes" : "authored-local-lanes"'), true);
  assert.equal(controlledSource.includes("defaultEnabled: false"), true);
  assert.equal(controlledSource.includes('defaultTrafficAuthority: "authored-local-lanes"'), true);
  assert.equal(multiSource.includes("defaultEnabled = true"), true);
  assert.equal(multiSource.includes('defaultTrafficAuthority: defaultEnabled ? "multi-agent-compiler-route" : "authored-local-lanes"'), true);
});
