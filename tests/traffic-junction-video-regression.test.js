import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createTrafficJunctionFlowController } from "../phaser/src/streaming/TrafficJunctionFlowPolicy.js";
import { createTrafficJunctionReservationRegistry } from "../phaser/src/streaming/TrafficJunctionReservationRegistry.js";
import { TrafficPhysicalConsequencesSystem } from "../phaser/src/streaming/TrafficPhysicalConsequencesSystem.js";
import {
  createTrafficRouteBehaviorController,
  TRAFFIC_ROUTE_BEHAVIOR_STATE
} from "../phaser/src/streaming/TrafficRouteBehaviorPolicy.js";

function crossingTopology() {
  return {
    nodes: {
      "junction-west": {
        id: "junction-west",
        x: 100,
        y: 0,
        trimDistance: 20,
        maximumRoadWidth: 40
      },
      "junction-north": {
        id: "junction-north",
        x: 100,
        y: 0,
        trimDistance: 20,
        maximumRoadWidth: 40
      }
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
        nodeId: "junction-west",
        incomingLaneId: "west-in",
        outgoingLaneId: "east-out",
        preferred: true,
        requiresConnector: true,
        turnType: "straight"
      },
      "north-south": {
        id: "north-south",
        nodeId: "junction-north",
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
          nodeId: "junction-west",
          activationSafe: true,
          rejectionReasons: [],
          points: [{ x: 80, y: 0 }, { x: 100, y: 0 }, { x: 120, y: 0 }],
          length: 40
        },
        "north-south-connector": {
          id: "north-south-connector",
          transitionId: "north-south",
          nodeId: "junction-north",
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

function routeAgent(tokenId, laneId, progress) {
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

function routeSlot(tokenId, laneId, progress, x, y, angle = 0) {
  return {
    slotIndex: tokenId === "west" || tokenId === "owner" ? 0 : 1,
    tokenId,
    routeActive: true,
    routeStage: "lane",
    routeLaneId: laneId,
    routeHop: 0,
    routeStageProgress: progress,
    x,
    y,
    angle,
    radius: 14,
    speedFactor: 1,
    archetype: { width: 28, height: 14, mass: 1 },
    container: {
      active: true,
      setPosition() {
        return this;
      }
    }
  };
}

function junctionMaterializer(topology) {
  const pool = [];
  return {
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
}

test("geometrically crossing movements cannot receive simultaneous permits through different compiler node ids", () => {
  const topology = crossingTopology();
  const materializer = junctionMaterializer(topology);
  const west = routeAgent("west", "west-in", 0.75);
  const north = routeAgent("north", "north-in", 0.75);
  const westSlot = routeSlot("west", "west-in", 0.75, 60, 0);
  const northSlot = routeSlot("north", "north-in", 0.75, 100, -40, Math.PI / 2);
  materializer.pool.push(westSlot, northSlot);
  materializer.assignments.set("west", westSlot);
  materializer.assignments.set("north", northSlot);

  const registry = createTrafficJunctionReservationRegistry({ staleAfterSeconds: 5 });
  const controller = createTrafficJunctionFlowController(materializer, { topology });
  controller.prepareStep({
    agents: [west, north],
    nowSeconds: 0,
    reservationRegistry: registry
  });

  const first = controller.requestAdmission({
    agent: west,
    nowSeconds: 0,
    reservationRegistry: registry
  });
  assert.equal(first.granted, true);

  const second = controller.requestAdmission({
    agent: north,
    nowSeconds: 0.01,
    reservationRegistry: registry
  });
  assert.equal(second.granted, false);
  assert.equal(second.reason, "junction-conflict-permit");
  assert.equal(second.blockerId, "west");
  assert.equal(registry.snapshot().activeReservationCount, 1);
  assert.equal(controller.snapshot().movementPermitDenials, 1);

  assert.equal(controller.confirmConnectorEntry({
    tokenId: "west",
    transition: topology.transitions["west-east"],
    connector: topology.junctionConnectors.connectors["west-east-connector"],
    nowSeconds: 0.1,
    reservationRegistry: registry
  }).allowed, true);
  controller.markConnectorExit({
    tokenId: "west",
    outgoingLaneId: "east-out",
    nowSeconds: 0.2,
    reservationRegistry: registry
  });
  westSlot.routeStage = "lane";
  westSlot.routeLaneId = "east-out";
  westSlot.routeStageProgress = 0.5;
  westSlot.x = 170;
  westSlot.y = 0;
  controller.afterAdvance({
    agent: {
      ...west,
      stage: "lane",
      currentLaneId: "east-out",
      previousLaneId: "west-in",
      stageProgress: 0.5
    },
    nowSeconds: 0.5,
    reservationRegistry: registry
  });
  assert.equal(registry.reservationFor("junction-west"), null);

  const afterClearance = controller.requestAdmission({
    agent: north,
    nowSeconds: 0.51,
    reservationRegistry: registry
  });
  assert.equal(afterClearance.granted, true);
  assert.equal(registry.reservationFor("junction-north")?.tokenId, "north");
  controller.destroy();
});

function eventBus() {
  return {
    on() {},
    off() {},
    once() {},
    emit() {}
  };
}

async function physicalFixture() {
  const pool = [];
  const materializer = {
    pool,
    assignments: new Map(),
    lanes: { physics: {} },
    originalVehicleCanOccupy() {
      return true;
    }
  };
  const behavior = {
    initialization: Promise.resolve(),
    decisionFor() {
      return {
        desiredSpeedFactor: 1,
        reason: "route-cruise",
        gap: null,
        blockerId: null
      };
    }
  };
  const vehicleSystem = {
    vehicles: [],
    updateDriving() {},
    currentVehicle() {
      return null;
    },
    isDriving() {
      return false;
    }
  };
  const scene = {
    trafficMaterializationSystem: materializer,
    trafficLocalBehaviorSystem: behavior,
    vehicleSystem,
    events: eventBus(),
    registry: { get: () => false },
    statePublisher: { setMany() {} },
    player: { x: 1000, y: 1000 }
  };
  materializer.scene = scene;
  const system = new TrafficPhysicalConsequencesSystem(scene);
  await system.initialization;
  return { system, materializer, pool };
}

test("the pre-route OBB gate holds the deterministic loser before compiler progress can rotate under a pile", async () => {
  const { system, materializer, pool } = await physicalFixture();
  const owner = routeSlot("owner", "west-in", 1, 100, 0, 0);
  owner.routeStage = "connector";
  owner.routeConnectorId = "west-east-connector";
  const waiter = routeSlot("waiter", "north-in", 0.75, 100, 0, Math.PI / 2);
  pool.push(owner, waiter);
  materializer.assignments.set(owner.tokenId, owner);
  materializer.assignments.set(waiter.tokenId, waiter);
  materializer.__nbdTrafficJunctionFlowController = {
    snapshot() {
      return {
        activePermits: [{
          tokenId: "owner",
          phase: "connector",
          junctionId: "junction-west",
          connectorId: "west-east-connector"
        }]
      };
    }
  };

  for (const slot of [owner, waiter]) {
    const state = system.stateFor(slot);
    state.holdSeconds = 0.4;
    state.lastVehicleId = slot === owner ? "waiter" : "owner";
    state.lastReason = "traffic-collision";
    system.applyStateOffset(slot, state);
  }
  assert.ok(owner.physicalHoldSeconds > 0);
  assert.ok(waiter.physicalHoldSeconds > 0);

  assert.equal(system.prepareRouteFrame(0.05), true);
  assert.ok(waiter.physicalHoldSeconds >= 0.2);
  assert.equal(waiter.physicalReason, "route-contact-yield");
  assert.equal(waiter.physicalBlockerId, "owner");
  assert.equal(Number(owner.physicalHoldSeconds || 0), 0);
  assert.equal(owner.physicalReason, "route-contact-priority");

  const snapshot = system.snapshot();
  assert.equal(snapshot.lastRoutePreflight.contacts, 1);
  assert.equal(snapshot.lastRoutePreflight.yields, 1);
  assert.equal(snapshot.lastRoutePreflight.decisions[0].loserTokenId, "waiter");
  assert.deepEqual(snapshot.lastRoutePreflight.releasedWinnerTokenIds, ["owner"]);
  assert.equal(snapshot.routePreflightHeldVehicles, 1);
  system.destroy();
});

test("route behavior stops immediately and freezes maneuver progression while the physical gate is active", () => {
  const topology = {
    lanes: {
      lane: {
        id: "lane",
        points: [{ x: 0, y: 0 }, { x: 300, y: 0 }],
        length: 300,
        roadWidth: 52,
        laneOffset: 10
      }
    }
  };
  const slot = routeSlot("held", "lane", 0.4, 120, 0);
  slot.physicalHoldSeconds = 0.24;
  slot.physicalReason = "route-contact-yield";
  slot.physicalBlockerId = "owner";
  const scene = {
    events: eventBus(),
    trafficLocalBehaviorSystem: {},
    vehicleSystem: {
      vehicles: [],
      isDriving: () => false
    },
    player: { x: 1000, y: 1000 }
  };
  const materializer = {
    scene,
    pool: [slot],
    assignments: new Map([[slot.tokenId, slot]]),
    trafficTokens() {
      return [];
    }
  };
  const controller = createTrafficRouteBehaviorController(materializer, {
    topology,
    baseSpeed: 100
  });
  const runtime = {
    agents() {
      return [{
        tokenId: "held",
        stage: "lane",
        currentLaneId: "lane",
        routeHop: 0,
        stageProgress: 0.4
      }];
    },
    snapshot() {
      return { blocked: [] };
    }
  };

  controller.update(runtime, 0.05);
  const state = controller.snapshot();
  assert.equal(controller.speedFactor("held"), 0);
  assert.equal(slot.engineSpeed, 0);
  assert.equal(slot.behaviorState, TRAFFIC_ROUTE_BEHAVIOR_STATE.PHYSICAL_HOLD);
  assert.equal(slot.behaviorReason, "physical-contact-yield");
  assert.equal(slot.behaviorBlockerId, "owner");
  assert.equal(state.physicalHoldingVehicles, 1);
  assert.equal(state.physicalHoldDecisions, 1);
  controller.clear();
});

test("gameplay evaluates actual route-body contact before advancing the multi-agent route runtime", async () => {
  const source = await readFile(
    new URL("../phaser/src/runtime/GameplayRuntime.js", import.meta.url),
    "utf-8"
  );
  const preflight = source.indexOf(
    "scene.trafficPhysicalConsequencesSystem?.prepareRouteFrame?.(dt);"
  );
  const routeAdvance = source.indexOf(
    "scene.trafficLocalAssignmentPolicy?.multiAgentRoutePolicy?.update?.(dt);"
  );
  assert.ok(preflight >= 0);
  assert.ok(routeAdvance > preflight);
});
