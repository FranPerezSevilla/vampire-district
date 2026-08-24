import test from "node:test";
import assert from "node:assert/strict";

import { installTrafficGridlockRecoveryPolicy } from "../phaser/src/streaming/TrafficGridlockRecoveryPolicy.js";

function slot(tokenId, x, behaviorReason, engineSpeed) {
  return {
    tokenId,
    routeActive: true,
    radius: 14,
    x,
    y: 0,
    angle: 0,
    engineSpeed,
    speedFactor: engineSpeed > 0 ? 0.3 : 0,
    behaviorReason,
    archetype: { width: 28, height: 14 },
    container: {
      active: true,
      setPosition(nextX, nextY) {
        this.x = nextX;
        this.y = nextY;
        return this;
      }
    }
  };
}

test("gridlock recovery lets the initiative car physically shove another traffic car", () => {
  const pusher = slot("traffic-a", 100, "gridlock-push", 34);
  const target = slot("traffic-b", 122, "gridlock-yield", 0);
  const states = new Map();
  const materializer = {
    pool: [pusher, target],
    assignments: new Map([
      [pusher.tokenId, pusher],
      [target.tokenId, target]
    ]),
    originalVehicleCanOccupy() {
      return true;
    }
  };
  const physical = {
    maxPushStep: 16,
    maxOffset: 44,
    pushHoldSeconds: 0.16,
    collisionPadding: 2,
    totalContacts: 0,
    totalPushes: 0,
    update() {
      for (const current of materializer.pool) {
        const state = this.stateFor(current);
        state.baseX = current.x - state.offsetX;
        state.baseY = current.y - state.offsetY;
      }
      return true;
    },
    stateFor(current) {
      if (!states.has(current.tokenId)) {
        states.set(current.tokenId, {
          tokenId: current.tokenId,
          offsetX: 0,
          offsetY: 0,
          holdSeconds: 0,
          baseX: current.x,
          baseY: current.y,
          pushes: 0
        });
      }
      return states.get(current.tokenId);
    },
    applyStateOffset(current, state) {
      current.x = state.baseX + state.offsetX;
      current.y = state.baseY + state.offsetY;
      current.container.setPosition(current.x, current.y);
      return current;
    }
  };
  const scene = {
    trafficMaterializationSystem: materializer,
    trafficPhysicalConsequencesSystem: physical,
    trafficLocalAssignmentPolicy: {
      multiAgentRoutePolicy: {
        routeBehavior() {
          return {
            snapshot() {
              return {
                vehicles: [
                  { tokenId: pusher.tokenId, reason: "gridlock-push" },
                  { tokenId: target.tokenId, reason: "gridlock-yield" }
                ]
              };
            }
          };
        }
      }
    },
    vehicleSystem: {
      vehicles: []
    }
  };

  const policy = installTrafficGridlockRecoveryPolicy(scene);
  physical.update(0.05);

  const targetState = states.get(target.tokenId);
  assert.equal(policy.snapshot().totalTrafficPushes, 1);
  assert.ok(targetState.offsetX > 0);
  assert.equal(targetState.lastReason, "traffic-pushed");
  assert.equal(targetState.lastVehicleId, `traffic:${pusher.tokenId}`);
  assert.equal(pusher.gridlockPushBlocked, false);
  assert.ok(target.x > 122);

  policy.destroy();
});

test("failed physical shove feeds back and stops the initiative car next frame", () => {
  const pusher = slot("traffic-a", 100, "gridlock-push", 34);
  const target = slot("traffic-b", 122, "gridlock-yield", 0);
  const materializer = {
    pool: [pusher, target],
    assignments: new Map([
      [pusher.tokenId, pusher],
      [target.tokenId, target]
    ]),
    originalVehicleCanOccupy() {
      return false;
    }
  };
  const states = new Map();
  const physical = {
    maxPushStep: 16,
    maxOffset: 44,
    pushHoldSeconds: 0.16,
    collisionPadding: 2,
    totalContacts: 0,
    totalPushes: 0,
    update() {
      return true;
    },
    stateFor(current) {
      if (!states.has(current.tokenId)) {
        states.set(current.tokenId, {
          offsetX: 0,
          offsetY: 0,
          holdSeconds: 0,
          baseX: current.x,
          baseY: current.y,
          pushes: 0
        });
      }
      return states.get(current.tokenId);
    },
    applyStateOffset() {}
  };
  const scene = {
    trafficMaterializationSystem: materializer,
    trafficPhysicalConsequencesSystem: physical,
    trafficLocalAssignmentPolicy: {
      multiAgentRoutePolicy: {
        routeBehavior() {
          return {
            snapshot() {
              return { vehicles: [{ tokenId: pusher.tokenId, reason: "gridlock-push" }] };
            }
          };
        }
      }
    },
    vehicleSystem: { vehicles: [] }
  };

  const policy = installTrafficGridlockRecoveryPolicy(scene);
  physical.update(0.05);

  assert.equal(policy.snapshot().totalFailedPushes, 1);
  assert.equal(pusher.gridlockPushBlocked, true);
  assert.equal(target.x, 122);

  policy.destroy();
});
