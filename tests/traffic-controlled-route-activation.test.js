import test from "node:test";
import assert from "node:assert/strict";

import { installTrafficControlledRouteActivationPolicy } from "../phaser/src/streaming/TrafficControlledRouteActivationPolicy.js";
import { installTrafficRouteMaterializationMetadataPolicy } from "../phaser/src/streaming/TrafficRouteMaterializationPolicy.js";

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
    transitionIds: ["a-to-b", "b-to-a"],
    transitions: {
      "a-to-b": {
        id: "a-to-b",
        incomingLaneId: "lane-a",
        outgoingLaneId: "lane-b",
        preferred: true,
        requiresConnector: true,
        turnType: "right"
      },
      "b-to-a": {
        id: "b-to-a",
        incomingLaneId: "lane-b",
        outgoingLaneId: "lane-a",
        preferred: true,
        requiresConnector: false,
        turnType: "straight"
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
      directHandoffTransitionIds: ["b-to-a"]
    }
  };
}

function fakeMaterializer() {
  const slot = {
    slotIndex: 0,
    tokenId: "legacy#0",
    edgeId: "legacy",
    tokenIndex: 0,
    direction: "forward",
    phase: 0.5,
    x: -20,
    y: -20,
    angle: 0,
    container: { visible: true, active: true }
  };
  let normalTokens = [{
    tokenId: "legacy#0",
    edgeId: "legacy",
    tokenIndex: 0,
    direction: "forward",
    phase: 0.5,
    x: -20,
    y: -20,
    angle: 0
  }];
  const behaviorCalls = { base: 0 };
  const steeringCalls = { base: 0 };
  const behavior = {
    applyDecision(target) {
      behaviorCalls.base++;
      target.x += 999;
      return target;
    }
  };
  const steering = {
    applyPresentation(target) {
      steeringCalls.base++;
      target.y += 999;
      return target;
    }
  };
  const materializer = {
    lanes: { localTopology: topologyFixture() },
    pool: [slot],
    assignments: new Map([[slot.tokenId, slot]]),
    scene: {
      trafficLocalBehaviorSystem: behavior,
      trafficSteeringPresentationSystem: steering
    },
    trafficTokens() {
      return normalTokens.map(token => ({ ...token }));
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
    update() { return false; },
    reconcile() { return false; }
  };
  return { materializer, slot, behavior, steering, behaviorCalls, steeringCalls, setNormalTokens(value) { normalTokens = value; } };
}

test("controlled route activation is installed disabled and preserves normal traffic tokens", () => {
  const { materializer } = fakeMaterializer();
  const metadata = installTrafficRouteMaterializationMetadataPolicy(materializer);
  const policy = installTrafficControlledRouteActivationPolicy(materializer);

  const before = policy.snapshot();
  assert.equal(before.enabled, false);
  assert.equal(before.defaultEnabled, false);
  assert.equal(before.defaultTrafficAuthority, "authored-local-lanes");
  assert.deepEqual(materializer.trafficTokens().map(token => token.tokenId), ["legacy#0"]);

  policy.destroy();
  metadata.destroy();
});

test("one fixed pool slot follows compiler route while legacy behavior and steering cannot overwrite it", () => {
  const { materializer, slot, behavior, steering, behaviorCalls, steeringCalls } = fakeMaterializer();
  const metadata = installTrafficRouteMaterializationMetadataPolicy(materializer);
  const policy = installTrafficControlledRouteActivationPolicy(materializer);
  const poolRef = materializer.pool;

  const started = policy.start({ turnType: "right", startProgress: 0.9, routeSpeed: 80 });
  assert.equal(started.enabled, true);
  assert.equal(started.slotIndex, 0);
  assert.equal(started.fixedPoolPreserved, true);
  assert.equal(materializer.pool, poolRef);
  assert.equal(materializer.pool.length, 1);
  assert.equal(slot.routeActive, true);
  assert.equal(started.assignmentStable, true);

  const routeX = slot.x;
  const routeY = slot.y;
  behavior.applyDecision(slot, {}, {}, {}, 0.1);
  steering.applyPresentation(slot, {}, 0.1);
  assert.equal(behaviorCalls.base, 0, "legacy behavior must be bypassed for routeActive slot");
  assert.equal(steeringCalls.base, 0, "legacy steering must be bypassed for routeActive slot");
  assert.equal(slot.x, routeX);
  assert.equal(slot.y, routeY);

  let snapshot = started;
  let sawConnector = false;
  for (let index = 0; index < 100 && snapshot.routeHop < 1; index++) {
    snapshot = policy.step(0.05);
    sawConnector = sawConnector || snapshot.stage === "connector";
    assert.equal(snapshot.slotIndex, 0);
    assert.equal(snapshot.assignmentStable, true);
    assert.equal(snapshot.slotLost, false);
    assert.equal(snapshot.teleportCount, 0);
  }
  assert.equal(sawConnector, true);
  assert.ok(snapshot.routeHop >= 1);
  assert.equal(snapshot.fixedPoolPreserved, true);

  const stopped = policy.stop();
  assert.equal(stopped.enabled, false);
  assert.equal(stopped.fixedPoolPreserved, true);
  assert.equal(materializer.pool, poolRef);

  policy.destroy();
  metadata.destroy();
});
