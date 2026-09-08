import test from "node:test";
import assert from "node:assert/strict";

import { installTrafficControlledRouteActivationPolicy } from "../phaser/src/streaming/TrafficControlledRouteActivationPolicy.js";

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
        points: [{ x: 100, y: 0 }, { x: 200, y: 0 }]
      }
    },
    transitionIds: ["a-to-b"],
    transitions: {
      "a-to-b": {
        id: "a-to-b",
        nodeId: "junction-a",
        incomingLaneId: "lane-a",
        outgoingLaneId: "lane-b",
        preferred: true,
        requiresConnector: false,
        turnType: "straight"
      }
    },
    junctionConnectors: {
      connectorIds: [],
      connectors: {},
      directHandoffTransitionIds: ["a-to-b"]
    }
  };
}

function lateConfiguredMaterializer() {
  return {
    lanes: { localTopology: topologyFixture() },
    pool: [],
    assignments: new Map(),
    scene: {},
    trafficTokens() { return []; },
    updateSlot(slot, token) {
      Object.assign(slot, {
        edgeId: token.edgeId,
        tokenIndex: token.tokenIndex,
        direction: token.direction,
        phase: token.phase,
        x: token.x,
        y: token.y,
        angle: token.angle
      });
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
    update() { return false; },
    reconcile() { return false; }
  };
}

test("controlled route captures fixed-pool baseline after async materializer configuration", () => {
  const materializer = lateConfiguredMaterializer();
  const policy = installTrafficControlledRouteActivationPolicy(materializer);

  const installed = policy.snapshot();
  assert.equal(installed.initialPoolSize, 0);
  assert.equal(installed.fixedPoolPreserved, true);

  const slot = {
    slotIndex: 0,
    tokenId: null,
    container: { visible: false, active: false }
  };
  materializer.pool.push(slot);

  const configured = policy.snapshot();
  assert.equal(configured.initialPoolSize, 1);
  assert.equal(configured.fixedPoolPreserved, true);

  const started = policy.start({ turnType: "straight", startProgress: 0.9, routeSpeed: 80 });
  assert.equal(started.initialPoolSize, 1);
  assert.equal(started.fixedPoolPreserved, true);
  assert.equal(started.slotIndex, 0);

  materializer.pool.push({ slotIndex: 1, tokenId: null, container: { visible: false, active: false } });
  assert.equal(policy.snapshot().fixedPoolPreserved, false, "pool growth during controlled activation must be detected");
  materializer.pool.pop();

  const stopped = policy.stop();
  assert.equal(stopped.poolSize, 1);
  assert.equal(stopped.fixedPoolPreserved, true);

  policy.destroy();
});
