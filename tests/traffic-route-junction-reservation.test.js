import test from "node:test";
import assert from "node:assert/strict";

import {
  advanceTrafficRouteAgent,
  createTrafficRouteAgent
} from "../phaser/src/streaming/TrafficRouteCursor.js";
import {
  createTrafficJunctionReservationRegistry
} from "../phaser/src/streaming/TrafficJunctionReservationRegistry.js";

function topologyFixture() {
  return {
    laneIds: ["lane-a", "lane-b", "lane-c", "lane-d"],
    lanes: {
      "lane-a": { id: "lane-a", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
      "lane-b": { id: "lane-b", points: [{ x: 100, y: -100 }, { x: 100, y: 0 }] },
      "lane-c": { id: "lane-c", points: [{ x: 120, y: 20 }, { x: 220, y: 20 }] },
      "lane-d": { id: "lane-d", points: [{ x: 80, y: 20 }, { x: 80, y: 120 }] }
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

function reservationHooks(registry, clock) {
  return {
    beforeConnectorEntry({ tokenId, transition, connector }) {
      return registry.request({
        junctionId: transition.nodeId || connector.nodeId,
        tokenId,
        connectorId: connector.id,
        nowSeconds: clock.now
      });
    },
    afterConnectorExit({ tokenId }) {
      registry.releaseByToken(tokenId, "connector-exit");
    }
  };
}

test("compiler-route junction registry grants, refreshes and denies conflicts deterministically", () => {
  const registry = createTrafficJunctionReservationRegistry({ staleAfterSeconds: 3 });
  const first = registry.request({ junctionId: "junction-1", tokenId: "car-a", connectorId: "connector-a", nowSeconds: 0 });
  assert.equal(first.granted, true);
  assert.equal(first.refreshed, false);

  const refresh = registry.request({ junctionId: "junction-1", tokenId: "car-a", connectorId: "connector-a", nowSeconds: 0.5 });
  assert.equal(refresh.granted, true);
  assert.equal(refresh.refreshed, true);

  const denied = registry.request({ junctionId: "junction-1", tokenId: "car-b", connectorId: "connector-b", nowSeconds: 0.5 });
  assert.equal(denied.granted, false);
  assert.equal(denied.reason, "junction-occupied");
  assert.equal(denied.ownerTokenId, "car-a");
  assert.equal(registry.snapshot().activeReservationCount, 1);
});

test("stale compiler-route reservation expires and cannot deadlock a junction forever", () => {
  const registry = createTrafficJunctionReservationRegistry({ staleAfterSeconds: 3 });
  registry.request({ junctionId: "junction-1", tokenId: "car-a", nowSeconds: 0 });
  assert.equal(registry.request({ junctionId: "junction-1", tokenId: "car-b", nowSeconds: 2.99 }).granted, false);

  const recovered = registry.request({ junctionId: "junction-1", tokenId: "car-b", nowSeconds: 3.01 });
  assert.equal(recovered.granted, true);
  assert.equal(recovered.reservation.tokenId, "car-b");
  assert.equal(registry.snapshot().staleReleases, 1);
});

test("conflicting route agents yield before connector entry and proceed after release", () => {
  const topology = topologyFixture();
  const registry = createTrafficJunctionReservationRegistry({ staleAfterSeconds: 5 });
  const clock = { now: 0 };
  const hooks = reservationHooks(registry, clock);
  let carA = createTrafficRouteAgent(topology, { tokenId: "car-a", laneId: "lane-a", stageProgress: 0.99 });
  let carB = createTrafficRouteAgent(topology, { tokenId: "car-b", laneId: "lane-b", stageProgress: 0.99 });

  clock.now = 0.2;
  const aEnter = advanceTrafficRouteAgent(carA, 0.2, topology, { speed: 100, ...hooks });
  carA = aEnter.agent;
  assert.equal(carA.stage, "connector");
  assert.equal(carA.connectorId, "connector-a");
  assert.equal(aEnter.blockedReason, null);
  assert.equal(registry.reservationFor("junction-1")?.tokenId, "car-a");

  const bWait = advanceTrafficRouteAgent(carB, 0.2, topology, { speed: 100, ...hooks });
  carB = bWait.agent;
  assert.equal(carB.stage, "lane", "waiting car must remain outside the junction");
  assert.equal(carB.stageProgress, 1);
  assert.equal(carB.connectorId, null);
  assert.equal(bWait.blockedReason, "junction-occupied");
  assert.equal(registry.reservationFor("junction-1")?.tokenId, "car-a");

  clock.now = 0.4;
  const aExit = advanceTrafficRouteAgent(carA, 0.2, topology, { speed: 100, ...hooks });
  carA = aExit.agent;
  assert.equal(carA.stage, "lane");
  assert.equal(carA.currentLaneId, "lane-c");
  assert.equal(registry.reservationFor("junction-1"), null, "connector exit must release ownership");

  const bEnter = advanceTrafficRouteAgent(carB, 0.05, topology, { speed: 100, ...hooks });
  carB = bEnter.agent;
  assert.equal(carB.stage, "connector");
  assert.equal(carB.connectorId, "connector-b");
  assert.equal(bEnter.blockedReason, null);
  assert.equal(registry.reservationFor("junction-1")?.tokenId, "car-b");
});

test("a route token already inside its connector keeps moving without re-requesting entry", () => {
  const topology = topologyFixture();
  const registry = createTrafficJunctionReservationRegistry({ staleAfterSeconds: 5 });
  const clock = { now: 0 };
  let entryRequests = 0;
  const hooks = {
    beforeConnectorEntry(payload) {
      entryRequests++;
      return registry.request({
        junctionId: payload.transition.nodeId,
        tokenId: payload.tokenId,
        connectorId: payload.connector.id,
        nowSeconds: clock.now
      });
    },
    afterConnectorExit({ tokenId }) {
      registry.releaseByToken(tokenId, "connector-exit");
    }
  };
  let agent = createTrafficRouteAgent(topology, { tokenId: "car-a", laneId: "lane-a", stageProgress: 0.99 });

  agent = advanceTrafficRouteAgent(agent, 0.05, topology, { speed: 100, ...hooks }).agent;
  assert.equal(agent.stage, "connector");
  assert.equal(entryRequests, 1);

  clock.now = 0.05;
  const mid = advanceTrafficRouteAgent(agent, 0.05, topology, { speed: 100, ...hooks });
  assert.equal(mid.agent.stage, "connector");
  assert.ok(mid.agent.stageProgress > agent.stageProgress);
  assert.equal(entryRequests, 1, "inside connector must not voluntarily stop/re-request");
});

test("forced route-token cleanup releases all compiler-route reservations", () => {
  const registry = createTrafficJunctionReservationRegistry();
  registry.request({ junctionId: "junction-1", tokenId: "car-a", nowSeconds: 0 });
  registry.request({ junctionId: "junction-2", tokenId: "car-a", nowSeconds: 0 });
  assert.equal(registry.ownedBy("car-a").length, 2);
  const removed = registry.releaseByToken("car-a", "forced-stop");
  assert.equal(removed.length, 2);
  assert.equal(registry.snapshot().activeReservationCount, 0);
});
