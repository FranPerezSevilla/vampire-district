import test from "node:test";
import assert from "node:assert/strict";

import { orientedVehicleContact } from "../phaser/src/streaming/TrafficPhysicalConsequencesSystem.js";
import { installTrafficRigidBodyCollisionPolicy } from "../phaser/src/streaming/TrafficRigidBodyCollisionPolicy.js";

function slot(tokenId, x, y = 100) {
  return {
    tokenId,
    slotIndex: Number(tokenId.slice(1)) || 0,
    x,
    y,
    angle: 0,
    archetype: { width: 28, height: 14, mass: 1 },
    container: { active: true }
  };
}

function fakePhysicalSystem(slots, { worldSafe = () => true } = {}) {
  const states = new Map();
  const system = {
    maxOffset: 44,
    maxPushStep: 16,
    collisionPadding: 1,
    pushHoldSeconds: 0.16,
    blockedHoldSeconds: 0.55,
    activeSlots: () => slots,
    stateFor(current) {
      let state = states.get(current.tokenId);
      if (!state) {
        state = {
          tokenId: current.tokenId,
          baseX: current.x,
          baseY: current.y,
          offsetX: 0,
          offsetY: 0,
          holdSeconds: 0,
          lastVehicleId: null,
          lastReason: "none",
          pushes: 0
        };
        states.set(current.tokenId, state);
      }
      return state;
    },
    applyStateOffset(current, state) {
      current.x = state.baseX + state.offsetX;
      current.y = state.baseY + state.offsetY;
      current.physicalOffsetX = state.offsetX;
      current.physicalOffsetY = state.offsetY;
      return current;
    },
    proxyWorldSafe(current, x, y, options = {}) {
      return worldSafe(current, x, y, options);
    },
    resolveTrafficContacts() {
      return 0;
    }
  };
  return { system, states };
}

function overlappingPairs(slots) {
  const pairs = [];
  for (let left = 0; left < slots.length; left++) {
    for (let right = left + 1; right < slots.length; right++) {
      if (orientedVehicleContact(slots[left], slots[right])) pairs.push([slots[left].tokenId, slots[right].tokenId]);
    }
  }
  return pairs;
}

test("iterative rigid-body solve clears a three-car penetration cluster", () => {
  const slots = [slot("t1", 100), slot("t2", 114), slot("t3", 128)];
  const ignoreCounts = [];
  const { system, states } = fakePhysicalSystem(slots, {
    worldSafe: (_current, _x, _y, options) => {
      ignoreCounts.push(options.ignoreSlots?.length || 0);
      return true;
    }
  });
  const policy = installTrafficRigidBodyCollisionPolicy(system, { solverPasses: 8 });

  assert.equal(overlappingPairs(slots).length, 2);
  const resolved = system.resolveTrafficContacts();

  assert.ok(resolved >= 2);
  assert.deepEqual(overlappingPairs(slots), []);
  assert.ok(ignoreCounts.length > 0);
  assert.ok(ignoreCounts.every(count => count === slots.length));
  for (const current of slots) {
    const state = states.get(current.tokenId);
    assert.ok(state.holdSeconds > 0);
    assert.equal(state.lastReason, "traffic-collision");
    assert.ok(Math.hypot(state.offsetX, state.offsetY) <= system.maxOffset);
  }
  assert.equal(policy.snapshot().last.remainingPairs, 0);

  policy.destroy();
});

test("a statically pinned car makes the free car absorb the separation", () => {
  const left = slot("t1", 20);
  const right = slot("t2", 32);
  const slots = [left, right];
  const { system, states } = fakePhysicalSystem(slots, {
    worldSafe: (current, x) => current !== left || x >= 20
  });
  const policy = installTrafficRigidBodyCollisionPolicy(system, { solverPasses: 6 });

  assert.ok(orientedVehicleContact(left, right));
  system.resolveTrafficContacts();

  assert.equal(orientedVehicleContact(left, right), null);
  assert.equal(states.get(left.tokenId).offsetX, 0);
  assert.ok(states.get(right.tokenId).offsetX > 0);
  assert.equal(policy.snapshot().last.remainingPairs, 0);

  policy.destroy();
});
