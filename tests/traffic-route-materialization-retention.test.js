import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { LAYERS } from "../phaser/src/data/district.js";
import {
  createTrafficRouteAgent
} from "../phaser/src/streaming/TrafficRouteCursor.js";
import {
  clearTrafficRouteSlotMetadata,
  installTrafficRouteMaterializationMetadataPolicy,
  trafficRouteAgentMaterializationToken
} from "../phaser/src/streaming/TrafficRouteMaterializationPolicy.js";
import {
  installTrafficLifecyclePolicy,
  TRAFFIC_LIFECYCLE_STATES,
  trafficLifecycleState
} from "../phaser/src/streaming/TrafficLifecyclePolicy.js";

const ROOT = new URL("../", import.meta.url);

function topologyFixture() {
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
        points: [{ x: 120, y: 20 }, { x: 220, y: 20 }]
      }
    },
    transitionIds: ["a-to-b"],
    transitions: {
      "a-to-b": {
        id: "a-to-b",
        incomingLaneId: "lane-a",
        outgoingLaneId: "lane-b",
        preferred: true,
        requiresConnector: true,
        turnType: "right"
      }
    },
    junctionConnectors: {
      connectorIds: ["connector-a-to-b"],
      connectors: {
        "connector-a-to-b": {
          id: "connector-a-to-b",
          transitionId: "a-to-b",
          incomingLaneId: "lane-a",
          outgoingLaneId: "lane-b",
          activationSafe: true,
          rejectionReasons: [],
          length: 32,
          points: [
            { x: 100, y: 0 },
            { x: 108, y: 1 },
            { x: 116, y: 8 },
            { x: 120, y: 20 }
          ]
        }
      },
      directHandoffTransitionIds: []
    }
  };
}

function routeAgents(topology) {
  const lane = createTrafficRouteAgent(topology, {
    tokenId: "stable-route-token",
    laneId: "lane-a",
    stageProgress: 0.9,
    trafficMetadata: {
      macroCompatibility: { edgeId: "legacy-edge", tokenIndex: 2 }
    }
  });
  const connector = {
    ...lane,
    routeHop: 1,
    stage: "connector",
    connectorId: "connector-a-to-b",
    nextLaneId: "lane-b",
    previousLaneId: "lane-a",
    stageProgress: 0.5
  };
  const outgoing = {
    ...connector,
    stage: "lane",
    currentLaneId: "lane-b",
    connectorId: null,
    nextLaneId: null,
    stageProgress: 0.2
  };
  return { lane, connector, outgoing };
}

function fakeMaterializer() {
  let liveTokens = [];
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
    radius: 16,
    behaviorReason: null,
    container: { active: true, visible: true }
  };
  const materializer = {
    scene: {
      currentLayer: LAYERS.STREET,
      cameras: {
        main: {
          worldView: { x: -500, y: -500, width: 1000, height: 1000 }
        }
      }
    },
    macro: {},
    pool: [slot],
    assignments: new Map(),
    trafficTokens() {
      return liveTokens;
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
    assign(target, token) {
      target.tokenId = token.tokenId;
      this.assignments.set(token.tokenId, target);
      this.updateSlot(target, token);
      return target;
    },
    release(target) {
      if (!target?.tokenId) return false;
      this.assignments.delete(target.tokenId);
      target.tokenId = null;
      return true;
    },
    update() {
      return false;
    },
    snapshot() {
      return {};
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

test("route materialization token samples compiler route geometry without inventing legacy phase", () => {
  const topology = topologyFixture();
  const { lane, connector, outgoing } = routeAgents(topology);

  const laneToken = trafficRouteAgentMaterializationToken(topology, lane);
  const connectorToken = trafficRouteAgentMaterializationToken(topology, connector);
  const outgoingToken = trafficRouteAgentMaterializationToken(topology, outgoing);

  assert.equal(laneToken.tokenId, "stable-route-token");
  assert.equal(laneToken.routeStage, "lane");
  assert.equal(laneToken.routeLaneId, "lane-a");
  assert.equal(laneToken.phase, null);
  assert.equal(laneToken.x, 90);
  assert.equal(laneToken.y, 0);

  assert.equal(connectorToken.tokenId, laneToken.tokenId);
  assert.equal(connectorToken.routeStage, "connector");
  assert.equal(connectorToken.routeConnectorId, "connector-a-to-b");
  assert.equal(connectorToken.routeNextLaneId, "lane-b");
  assert.equal(connectorToken.phase, null);

  assert.equal(outgoingToken.tokenId, laneToken.tokenId);
  assert.equal(outgoingToken.routeStage, "lane");
  assert.equal(outgoingToken.routeLaneId, "lane-b");
  assert.equal(outgoingToken.x, 140);
  assert.equal(outgoingToken.y, 20);
});

test("explicit route stage overrides legacy phase lifecycle semantics", () => {
  assert.equal(
    trafficLifecycleState({
      routeActive: true,
      routeStage: "connector",
      routeStageProgress: 0.5,
      phase: 0.5,
      visible: true
    }),
    TRAFFIC_LIFECYCLE_STATES.CROSSING_JUNCTION
  );
  assert.equal(
    trafficLifecycleState({
      routeActive: true,
      routeStage: "lane",
      routeStageProgress: 0.9,
      phase: 0.2,
      visible: true
    }),
    TRAFFIC_LIFECYCLE_STATES.APPROACH_JUNCTION
  );
  assert.equal(
    trafficLifecycleState({
      routeActive: true,
      routeStage: "lane",
      routeStageProgress: 0.2,
      phase: 0.02,
      visible: true
    }),
    TRAFFIC_LIFECYCLE_STATES.CRUISING,
    "legacy phase must not manufacture crossing for an explicit route lane"
  );
});

test("same materialization slot survives lane -> connector -> lane and crossing blocks normal release", () => {
  const topology = topologyFixture();
  const { lane, connector, outgoing } = routeAgents(topology);
  const laneToken = trafficRouteAgentMaterializationToken(topology, lane);
  const connectorToken = trafficRouteAgentMaterializationToken(topology, connector);
  const outgoingToken = trafficRouteAgentMaterializationToken(topology, outgoing);
  const { materializer, slot, setLiveTokens } = fakeMaterializer();

  const metadataPolicy = installTrafficRouteMaterializationMetadataPolicy(materializer);
  const lifecyclePolicy = installTrafficLifecyclePolicy(materializer);

  setLiveTokens([laneToken]);
  const assigned = materializer.assign(slot, laneToken);
  materializer.update(0.1);
  assert.equal(assigned, slot);
  assert.equal(materializer.assignments.get(laneToken.tokenId), slot);
  assert.equal(slot.routeActive, true);
  assert.equal(slot.lifecycleState, TRAFFIC_LIFECYCLE_STATES.APPROACH_JUNCTION);

  setLiveTokens([connectorToken]);
  materializer.updateSlot(slot, connectorToken);
  materializer.update(0.1);
  assert.equal(materializer.assignments.get(connectorToken.tokenId), slot);
  assert.equal(slot.routeStage, "connector");
  assert.equal(slot.lifecycleState, TRAFFIC_LIFECYCLE_STATES.CROSSING_JUNCTION);
  assert.equal(materializer.release(slot), false, "live crossing must reject normal release");
  assert.equal(materializer.assignments.get(connectorToken.tokenId), slot);
  assert.equal(slot.tokenId, connectorToken.tokenId);

  setLiveTokens([outgoingToken]);
  materializer.updateSlot(slot, outgoingToken);
  materializer.update(0.1);
  assert.equal(materializer.assignments.get(outgoingToken.tokenId), slot);
  assert.equal(slot.routeStage, "lane");
  assert.equal(slot.routeLaneId, "lane-b");
  assert.equal(slot.lifecycleState, TRAFFIC_LIFECYCLE_STATES.CRUISING);

  const snapshot = lifecyclePolicy.snapshot();
  assert.equal(snapshot.protectedRouteCrossingReleases, 1);

  assert.equal(materializer.release(slot, { force: true }), true);
  assert.equal(slot.tokenId, null);
  assert.equal(slot.routeActive, false);
  assert.equal(slot.routeStage, null);
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

test("M5 metadata substrate is active but normal visible route movement remains disabled", async () => {
  const source = await readFile(
    new URL("phaser/src/streaming/TrafficLocalAssignmentPolicy.js", ROOT),
    "utf8"
  );
  assert.equal(source.includes("installTrafficRouteMaterializationMetadataPolicy"), true);
  assert.equal(source.includes("routeMovementActive: false"), true);
  assert.equal(source.includes('laneAuthority: "authored-local-lanes"'), true);
});
