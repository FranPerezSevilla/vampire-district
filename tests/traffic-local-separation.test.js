import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTrafficNeighborGrid,
  chooseTrafficSeparationLoser,
  queryTrafficNeighborGrid,
  trafficOverlapAmount
} from "../phaser/src/policies/TrafficPlaytestPolicy.js";

function slot(tokenId, slotIndex, x, y, radius = 14) {
  return { tokenId, slotIndex, x, y, radius };
}

test("traffic neighbor grid keeps local collision queries bounded", () => {
  const slots = [];
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      slots.push(slot(`traffic-${x}-${y}`, y * 10 + x, x * 180, y * 180));
    }
  }
  const grid = buildTrafficNeighborGrid(slots, 96);
  const nearby = queryTrafficNeighborGrid(grid, 5 * 180, 5 * 180, 48);

  assert.ok(nearby.length < 10, `expected a bounded local query, got ${nearby.length} of ${slots.length}`);
  assert.ok(nearby.some(item => item.tokenId === "traffic-5-5"));
});

test("traffic overlap uses both vehicle footprints and a small safety pad", () => {
  const left = slot("left", 0, 100, 100, 14);
  const clear = slot("clear", 1, 131, 100, 14);
  const overlapping = slot("overlap", 2, 126, 100, 14);

  assert.equal(trafficOverlapAmount(left, clear), 0);
  assert.equal(trafficOverlapAmount(left, overlapping), 4);
});

test("same-lane separation retreats the follower rather than the lead car", () => {
  const follower = slot("follower", 0, 0, 0);
  const leader = slot("leader", 1, 0, 0);
  const followerState = {
    tokenId: follower.tokenId,
    edgeId: "road-a",
    direction: "forward",
    visualTravel: 0.20,
    reason: "traffic"
  };
  const leaderState = {
    tokenId: leader.tokenId,
    edgeId: "road-a",
    direction: "forward",
    visualTravel: 0.24,
    reason: "cruise"
  };

  assert.equal(chooseTrafficSeparationLoser(follower, leader, followerState, leaderState), follower);
});

test("junction yielding remains subordinate when crossing traffic needs a hard separation correction", () => {
  const yielding = slot("yielding", 0, 0, 0);
  const committed = slot("committed", 1, 0, 0);
  const yieldingState = {
    tokenId: yielding.tokenId,
    edgeId: "road-a",
    direction: "forward",
    visualTravel: 0.4,
    reason: "junction-yield"
  };
  const committedState = {
    tokenId: committed.tokenId,
    edgeId: "road-b",
    direction: "forward",
    visualTravel: 0.4,
    reason: "cruise"
  };

  assert.equal(chooseTrafficSeparationLoser(yielding, committed, yieldingState, committedState), yielding);
});
