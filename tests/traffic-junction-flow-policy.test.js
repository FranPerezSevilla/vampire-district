import test from "node:test";
import assert from "node:assert/strict";

import {
  createTrafficJunctionFlowController,
  trafficJunctionApproach
} from "../phaser/src/streaming/TrafficJunctionFlowPolicy.js";
import { createTrafficJunctionReservationRegistry } from "../phaser/src/streaming/TrafficJunctionReservationRegistry.js";

function topologyFixture() {
  return {
    nodes: {
      j1: { id: "j1", x: 100, y: 0, trimDistance: 20, maximumRoadWidth: 40 }
    },
    laneIds: ["west-in", "north-in", "east-out", "south-out"],
    lanes: {
      "west-in": {
        id: "west-in",
        points: [{ x: 0, y: 0 }, { x: 80, y: 0 }]
      },
      "north-in": {
        id: "north-in",
        points: [{ x: 100, y: -100 }, { x: 100, y: -20 }]
      },
      "east-out": {
        id: "east-out",
        points: [{ x: 120, y: 0 }, { x: 220, y: 0 }]
      },
      "south-out": {
        id: "south-out",
        points: [{ x: 100, y: 20 }, { x: 100, y: 120 }]
      }
    },
    transitionIds: ["west-east", "north-south"],
    transitions: {
      "west-east": {
        id: "west-east",
        nodeId: "j1",
        incomingLaneId: "west-in",
        outgoingLaneId: "east-out",
        preferred: true,
        requiresConnector: true,
        turnType: "straight"
      },
      "north-south": {
        id: "north-south",
        nodeId: "j1",
        incomingLaneId: "north-in",
        outgoingLaneId: "south-out",
        preferred: true,
        requiresConnector: true,
        turnType: "straight"
      }
    },
    junctionConnectors: {
      connectorIds: ["west-east-connector", "north-south-connector"],
      connectors: {
        "west-east-connector": {
          id: "west-east-connector",
          transitionId: "west-east",
          nodeId: "j1",
          activationSafe: true,
          rejectionReasons: [],
          points: [{ x: 80, y: 0 }, { x: 100, y: 0 }, { x: 120, y: 0 }],
          length: 40
        },
        "north-south-connector": {
          id: "north-south-connector",
          transitionId: "north-south",
          nodeId: "j1",
          activationSafe: true,
          rejectionReasons: [],
          points: [{ x: 100, y: -20 }, { x: 100, y: 0 }, { x: 100, y: 20 }],
          length: 40
        }
      },
      directHandoffTransitionIds: []
    }
  };
}

function agent(tokenId, laneId, progress) {
  return {
    tokenId,
    stage: "lane",
    currentLaneId: laneId,
    connectorId: null,
    nextLaneId: null,
    previousLaneId: null,
    routeHop: 0,
    stageProgress: progress
  };
}

function slot(tokenId, laneId, progress, x, y) {
  return {
    tokenId,
    routeActive: true,
    routeStage: "lane",
    routeLaneId: laneId,
    routeHop: 0,
    routeStageProgress: progress,
    x,
    y,
    radius: 14,
    archetype: { width: 28, height: 14 },
    container: { active: true }
  };
}

function materializerFixture() {
  const topology = topologyFixture();
  const pool = [];
  const materializer = {
    lanes: { localTopology: topology },
    pool,
    assignments: new Map(),
    scene: {
      vehicleSystem: {
        vehicles: [],
        isDriving: () => false
      },
      player: { x: 1000, y: 1000 }
    }
  };
  return { topology, materializer, pool };
}

test("junction approach compiles a body-safe stop line before the connector", () => {
  const topology = topologyFixture();
  const current = agent("a", "west-in", 0.99);
  const approach = trafficJunctionApproach(topology, current, {
    archetype: { width: 28, height: 14 }
  });

  assert.ok(approach);
  assert.equal(approach.junctionId, "j1");
  assert.equal(approach.connectorId, "west-east-connector");
  assert.ok(approach.stopProgress < 1);
  assert.ok(Math.abs(approach.stopProgress - 0.7495) < 0.0001);
  assert.ok(Math.abs(approach.stopPoint.x - 59.96) < 0.0001);
  assert.equal(approach.stopPoint.y, 0);
  assert.ok(approach.exitClearanceDistance >= 30);
});

test("production seed normalization prevents cars from materializing on the old lane-end wait point", () => {
  const { materializer } = materializerFixture();
  const controller = createTrafficJunctionFlowController(materializer);
  const normalized = controller.normalizeAgents([agent("a", "west-in", 0.99)]);

  assert.ok(Math.abs(normalized[0].stageProgress - 0.7495) < 0.0001);
  assert.equal(controller.snapshot().normalizedSeedAgents, 1);
  controller.destroy();
});

test("admission is denied until the outgoing clearance corridor is empty", () => {
  const { materializer, pool } = materializerFixture();
  const waiting = agent("a", "west-in", 0.75);
  const blocker = agent("b", "east-out", 0.35);
  const waitingSlot = slot("a", "west-in", 0.75, 60, 0);
  const blockerSlot = slot("b", "east-out", 0.35, 155, 0);
  pool.push(waitingSlot, blockerSlot);
  materializer.assignments.set("a", waitingSlot);
  materializer.assignments.set("b", blockerSlot);

  const registry = createTrafficJunctionReservationRegistry({ staleAfterSeconds: 5 });
  const controller = createTrafficJunctionFlowController(materializer);
  controller.prepareStep({ agents: [waiting, blocker], nowSeconds: 0, reservationRegistry: registry });

  const denied = controller.movementAllowance({
    agent: waiting,
    duration: 0.05,
    speed: 100,
    nowSeconds: 0,
    reservationRegistry: registry
  });
  assert.equal(denied.allowed, false);
  assert.equal(denied.reason, "junction-yield");
  assert.equal(denied.detailReason, "junction-exit-blocked");
  assert.equal(registry.snapshot().activeReservationCount, 0);

  controller.destroy();
});

test("reservation survives connector exit until the whole car clears the outgoing corridor", () => {
  const { materializer, pool } = materializerFixture();
  const waiting = agent("a", "west-in", 0.75);
  const waitingSlot = slot("a", "west-in", 0.75, 60, 0);
  pool.push(waitingSlot);
  materializer.assignments.set("a", waitingSlot);

  const registry = createTrafficJunctionReservationRegistry({ staleAfterSeconds: 5 });
  const controller = createTrafficJunctionFlowController(materializer);
  controller.prepareStep({ agents: [waiting], nowSeconds: 0, reservationRegistry: registry });
  const admitted = controller.movementAllowance({
    agent: waiting,
    duration: 0.05,
    speed: 100,
    nowSeconds: 0,
    reservationRegistry: registry
  });
  assert.equal(admitted.allowed, true);
  assert.equal(registry.reservationFor("j1")?.tokenId, "a");

  assert.equal(controller.confirmConnectorEntry({
    tokenId: "a",
    transition: topologyFixture().transitions["west-east"],
    connector: topologyFixture().junctionConnectors.connectors["west-east-connector"],
    nowSeconds: 0.1,
    reservationRegistry: registry
  }).allowed, true);

  controller.markConnectorExit({
    tokenId: "a",
    outgoingLaneId: "east-out",
    nowSeconds: 0.2,
    reservationRegistry: registry
  });

  const barelyExited = {
    ...waiting,
    stage: "lane",
    currentLaneId: "east-out",
    previousLaneId: "west-in",
    stageProgress: 0.05
  };
  waitingSlot.routeLaneId = "east-out";
  waitingSlot.routeStageProgress = 0.05;
  waitingSlot.x = 125;
  waitingSlot.y = 0;
  controller.afterAdvance({ agent: barelyExited, nowSeconds: 0.2, reservationRegistry: registry });
  assert.equal(registry.reservationFor("j1")?.tokenId, "a");

  const clear = { ...barelyExited, stageProgress: 0.4 };
  waitingSlot.routeStageProgress = 0.4;
  waitingSlot.x = 160;
  controller.afterAdvance({ agent: clear, nowSeconds: 0.4, reservationRegistry: registry });
  assert.equal(registry.reservationFor("j1"), null);
  assert.equal(controller.snapshot().clearanceReleases, 1);

  controller.destroy();
});

test("junction queue is FIFO even when a later token is evaluated first after the obstruction clears", () => {
  const { materializer, pool } = materializerFixture();
  materializer.scene.player = { x: 100, y: 0 };
  const first = agent("z-first", "west-in", 0.75);
  const second = agent("a-second", "north-in", 0.75);
  const firstSlot = slot("z-first", "west-in", 0.75, 60, 0);
  const secondSlot = slot("a-second", "north-in", 0.75, 100, -40);
  pool.push(firstSlot, secondSlot);
  materializer.assignments.set(first.tokenId, firstSlot);
  materializer.assignments.set(second.tokenId, secondSlot);

  const registry = createTrafficJunctionReservationRegistry({ staleAfterSeconds: 5 });
  const controller = createTrafficJunctionFlowController(materializer);
  controller.prepareStep({ agents: [first, second], nowSeconds: 0, reservationRegistry: registry });
  assert.equal(controller.requestAdmission({ agent: first, nowSeconds: 0, reservationRegistry: registry }).granted, false);
  assert.equal(controller.requestAdmission({ agent: second, nowSeconds: 0.01, reservationRegistry: registry }).granted, false);

  materializer.scene.player = { x: 1000, y: 1000 };
  const laterEvaluatedFirst = controller.requestAdmission({
    agent: second,
    nowSeconds: 0.1,
    reservationRegistry: registry
  });
  assert.equal(laterEvaluatedFirst.granted, false);
  assert.equal(laterEvaluatedFirst.reason, "junction-queue");

  const firstGrant = controller.requestAdmission({ agent: first, nowSeconds: 0.11, reservationRegistry: registry });
  assert.equal(firstGrant.granted, true);
  assert.equal(registry.reservationFor("j1")?.tokenId, "z-first");
  controller.destroy();
});

test("physical collision solve cannot shove an unpermitted waiter across its stop line", () => {
  const { materializer, pool } = materializerFixture();
  const waiting = agent("a", "west-in", 0.75);
  const waitingSlot = slot("a", "west-in", 0.75, 60, 0);
  pool.push(waitingSlot);
  materializer.assignments.set("a", waitingSlot);
  const controller = createTrafficJunctionFlowController(materializer);

  assert.equal(controller.physicalPoseAllowed(waitingSlot, 58, 3), true);
  assert.equal(controller.physicalPoseAllowed(waitingSlot, 62, 0), false);

  const physical = {
    proxyWorldSafe() {
      return true;
    }
  };
  controller.installPhysicalGuard(physical);
  assert.equal(physical.proxyWorldSafe(waitingSlot, 62, 0), false);
  assert.equal(physical.proxyWorldSafe(waitingSlot, 58, 0), true);
  assert.equal(controller.snapshot().physicalGuardDenials, 1);
  controller.destroy();
});

test("bypass authority is withdrawn early enough to rejoin before the stop line", () => {
  const { materializer } = materializerFixture();
  const controller = createTrafficJunctionFlowController(materializer);
  assert.equal(controller.bypassAllowed(agent("far", "west-in", 0.1), { requiredDistance: 30 }), true);
  assert.equal(controller.bypassAllowed(agent("near", "west-in", 0.6), { requiredDistance: 30 }), false);
  controller.destroy();
});

test("seed normalization spaces multiple cars on one approach instead of stacking them on the same stop point", () => {
  const { materializer } = materializerFixture();
  const controller = createTrafficJunctionFlowController(materializer);
  const normalized = controller.normalizeAgents([
    agent("lead", "west-in", 0.99),
    agent("follower", "west-in", 0.98)
  ]).sort((left, right) => right.stageProgress - left.stageProgress);

  const separation = (normalized[0].stageProgress - normalized[1].stageProgress) * 80;
  assert.ok(normalized[0].stageProgress < 0.8);
  assert.ok(separation >= 33.9, `expected a body-safe seed gap, got ${separation}`);
  controller.destroy();
});

test("a follower cannot steal junction admission from a car ahead on the same incoming lane", () => {
  const { materializer, pool } = materializerFixture();
  const lead = agent("z-lead", "west-in", 0.75);
  const follower = agent("a-follower", "west-in", 0.3);
  const leadSlot = slot("z-lead", "west-in", 0.75, 60, 0);
  const followerSlot = slot("a-follower", "west-in", 0.3, 24, 0);
  pool.push(leadSlot, followerSlot);
  materializer.assignments.set(lead.tokenId, leadSlot);
  materializer.assignments.set(follower.tokenId, followerSlot);

  const registry = createTrafficJunctionReservationRegistry({ staleAfterSeconds: 5 });
  const controller = createTrafficJunctionFlowController(materializer);
  controller.prepareStep({ agents: [lead, follower], nowSeconds: 0, reservationRegistry: registry });

  const followerAttempt = controller.requestAdmission({
    agent: follower,
    nowSeconds: 0,
    reservationRegistry: registry
  });
  assert.equal(followerAttempt.granted, false);
  assert.equal(followerAttempt.reason, "junction-approach-queue");
  assert.equal(followerAttempt.blockerId, "z-lead");

  const leadAttempt = controller.requestAdmission({ agent: lead, nowSeconds: 0.01, reservationRegistry: registry });
  assert.equal(leadAttempt.granted, true);
  assert.equal(registry.reservationFor("j1")?.tokenId, "z-lead");
  controller.destroy();
});

test("an older waiter with a blocked exit does not freeze a different clear movement", () => {
  const { materializer, pool } = materializerFixture();
  const blocked = agent("old-west", "west-in", 0.75);
  const clear = agent("new-north", "north-in", 0.75);
  const exitBlocker = agent("east-blocker", "east-out", 0.2);
  const blockedSlot = slot("old-west", "west-in", 0.75, 60, 0);
  const clearSlot = slot("new-north", "north-in", 0.75, 100, -40);
  const exitSlot = slot("east-blocker", "east-out", 0.2, 140, 0);
  pool.push(blockedSlot, clearSlot, exitSlot);
  materializer.assignments.set(blocked.tokenId, blockedSlot);
  materializer.assignments.set(clear.tokenId, clearSlot);
  materializer.assignments.set(exitBlocker.tokenId, exitSlot);

  const registry = createTrafficJunctionReservationRegistry({ staleAfterSeconds: 5 });
  const controller = createTrafficJunctionFlowController(materializer);
  controller.prepareStep({ agents: [blocked, clear, exitBlocker], nowSeconds: 0, reservationRegistry: registry });
  const oldAttempt = controller.requestAdmission({ agent: blocked, nowSeconds: 0, reservationRegistry: registry });
  assert.equal(oldAttempt.granted, false);
  assert.equal(oldAttempt.reason, "junction-exit-blocked");

  const clearAttempt = controller.requestAdmission({ agent: clear, nowSeconds: 0.01, reservationRegistry: registry });
  assert.equal(clearAttempt.granted, true);
  assert.equal(registry.reservationFor("j1")?.tokenId, "new-north");
  controller.destroy();
});

test("a permitted car remains inside its compiler connector corridor during physical depenetration", () => {
  const { materializer, pool } = materializerFixture();
  const waiting = agent("a", "west-in", 0.75);
  const waitingSlot = slot("a", "west-in", 0.75, 60, 0);
  pool.push(waitingSlot);
  materializer.assignments.set("a", waitingSlot);
  const registry = createTrafficJunctionReservationRegistry({ staleAfterSeconds: 5 });
  const controller = createTrafficJunctionFlowController(materializer);
  controller.prepareStep({ agents: [waiting], nowSeconds: 0, reservationRegistry: registry });
  assert.equal(controller.requestAdmission({ agent: waiting, nowSeconds: 0, reservationRegistry: registry }).granted, true);
  assert.equal(controller.confirmConnectorEntry({
    tokenId: "a",
    transition: topologyFixture().transitions["west-east"],
    connector: topologyFixture().junctionConnectors.connectors["west-east-connector"],
    nowSeconds: 0.1,
    reservationRegistry: registry
  }).allowed, true);

  waitingSlot.routeStage = "connector";
  waitingSlot.routeConnectorId = "west-east-connector";
  waitingSlot.x = 100;
  waitingSlot.y = 0;
  assert.equal(controller.physicalPoseAllowed(waitingSlot, 100, 5), true);
  assert.equal(controller.physicalPoseAllowed(waitingSlot, 100, 30), false);
  assert.equal(controller.snapshot().permitCorridorDenials, 1);
  controller.destroy();
});
