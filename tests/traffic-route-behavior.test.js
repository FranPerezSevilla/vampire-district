import test from "node:test";
import assert from "node:assert/strict";

import {
  createTrafficRouteBehaviorController,
  TRAFFIC_ROUTE_BEHAVIOR_STATE,
  trafficGridlockInitiativeWinner
} from "../phaser/src/streaming/TrafficRouteBehaviorPolicy.js";

function topologyFixture(length = 240) {
  return {
    lanes: {
      "lane-a": {
        id: "lane-a",
        length,
        points: [{ x: 0, y: 0 }, { x: length, y: 0 }]
      }
    }
  };
}

function routeSlot(tokenId, x) {
  return {
    tokenId,
    routeActive: true,
    radius: 14,
    x,
    y: 0,
    angle: 0,
    speedFactor: 1,
    desiredSpeedFactor: 1,
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

function physicalFixture(materializer) {
  const states = new Map();
  return {
    states,
    maxOffset: 44,
    totalContacts: 0,
    totalPushes: 0,
    stateFor(slot) {
      if (!states.has(slot.tokenId)) {
        states.set(slot.tokenId, {
          tokenId: slot.tokenId,
          offsetX: 0,
          offsetY: 0,
          holdSeconds: 0,
          baseX: slot.x,
          baseY: slot.y,
          pushes: 0
        });
      }
      return states.get(slot.tokenId);
    },
    proxyWorldSafe() {
      return true;
    },
    applyStateOffset(slot, state) {
      slot.x = state.baseX + state.offsetX;
      slot.y = state.baseY + state.offsetY;
      slot.container?.setPosition?.(slot.x, slot.y);
      return slot;
    }
  };
}

function behaviorTuning() {
  return {
    followDistance: 78,
    hardStopDistance: 34,
    playerLookAhead: 132,
    laneTolerance: 38,
    accelerationRate: 1.35,
    brakingRate: 5.8,
    gridlockBreakSeconds: 0.6,
    gridlockPushSpeedFactor: 0.2,
    staticRecoveryDelay: 0.8,
    staticRecoverySpeedFactor: 0.14
  };
}

test("route behavior uses an explicit blocker state and never owns route pose", () => {
  const topology = topologyFixture(200);
  const slot = routeSlot("traffic-a", 40);
  const blocker = {
    id: "player-car",
    x: 82,
    y: 0,
    angle: 0,
    archetype: { width: 28, height: 14 }
  };
  const materializer = {
    pool: [slot],
    assignments: new Map([[slot.tokenId, slot]]),
    scene: {
      trafficLocalBehaviorSystem: behaviorTuning(),
      vehicleSystem: {
        currentVehicleId: blocker.id,
        vehicles: [blocker],
        isDriving() { return true; },
        vehicle(id) { return id === blocker.id ? blocker : null; },
        canOccupy() { return true; },
        persistVehicle() {}
      },
      player: { x: blocker.x, y: blocker.y }
    }
  };
  const runtime = {
    agents() {
      return [{ tokenId: slot.tokenId, stage: "lane", currentLaneId: "lane-a", stageProgress: 0.2 }];
    },
    snapshot() { return { blocked: [] }; }
  };
  const controller = createTrafficRouteBehaviorController(materializer, { topology, baseSpeed: 112 });
  const poseBefore = { x: slot.x, y: slot.y, angle: slot.angle };

  controller.update(runtime, 0.05);
  const state = controller.snapshot().vehicles[0];

  assert.equal(state.fsmState, TRAFFIC_ROUTE_BEHAVIOR_STATE.BLOCKED_PLAYER);
  assert.equal(state.reason, "player-vehicle");
  assert.equal(state.blockerId, blocker.id);
  assert.ok(state.speedFactor < 1);
  assert.ok(state.speedFactor >= 0);
  assert.ok(slot.engineSpeed <= 112);
  assert.deepEqual({ x: slot.x, y: slot.y, angle: slot.angle }, poseBefore);
  assert.equal(controller.snapshot().architecture, "explicit-route-behavior-fsm");
  assert.equal(controller.snapshot().movementAuthority, false);
  assert.equal(controller.snapshot().lateralSteeringAuthority, false);
});

test("connector behavior stays bounded to the production route speed", () => {
  const topology = topologyFixture();
  const slot = routeSlot("traffic-a", 80);
  const materializer = {
    pool: [slot],
    assignments: new Map([[slot.tokenId, slot]]),
    scene: {
      trafficLocalBehaviorSystem: behaviorTuning(),
      vehicleSystem: { currentVehicleId: null, vehicles: [], isDriving() { return false; } },
      player: null
    }
  };
  const runtime = {
    agents() {
      return [{
        tokenId: slot.tokenId,
        stage: "connector",
        currentLaneId: "lane-a",
        connectorId: "connector-a",
        stageProgress: 0.3
      }];
    },
    snapshot() { return { blocked: [] }; }
  };
  const controller = createTrafficRouteBehaviorController(materializer, { topology, baseSpeed: 112 });

  controller.update(runtime, 0.05);
  const state = controller.snapshot().vehicles[0];

  assert.equal(state.fsmState, TRAFFIC_ROUTE_BEHAVIOR_STATE.CONNECTOR);
  assert.equal(state.reason, "route-connector-clear");
  assert.equal(controller.speedFactor(slot.tokenId, "connector"), 1);
  assert.equal(slot.engineSpeed, 112);
});

test("a prolonged traffic queue transitions to one deterministic recovery actor", () => {
  const topology = topologyFixture();
  const ids = ["traffic-a", "traffic-b"];
  const winner = trafficGridlockInitiativeWinner(ids[0], ids[1]);
  const loser = ids.find(id => id !== winner);
  const rearSlot = routeSlot(winner, 80);
  const leadSlot = routeSlot(loser, 112);
  const materializer = {
    pool: [rearSlot, leadSlot],
    assignments: new Map([
      [rearSlot.tokenId, rearSlot],
      [leadSlot.tokenId, leadSlot]
    ]),
    scene: {
      trafficLocalBehaviorSystem: behaviorTuning(),
      vehicleSystem: { currentVehicleId: null, vehicles: [], isDriving() { return false; } },
      player: null
    }
  };
  materializer.scene.trafficPhysicalConsequencesSystem = physicalFixture(materializer);
  const agents = [
    { tokenId: winner, stage: "lane", currentLaneId: "lane-a", stageProgress: 80 / 240 },
    { tokenId: loser, stage: "lane", currentLaneId: "lane-a", stageProgress: 112 / 240 }
  ];
  const runtime = {
    agents() { return agents.map(agent => ({ ...agent })); },
    snapshot() {
      return {
        blocked: [{ tokenId: loser, reason: "junction-yield" }]
      };
    }
  };
  const controller = createTrafficRouteBehaviorController(materializer, { topology, baseSpeed: 112 });

  for (let index = 0; index < 32; index++) controller.update(runtime, 0.05);
  const states = new Map(controller.snapshot().vehicles.map(item => [item.tokenId, item]));
  const targetPhysical = materializer.scene.trafficPhysicalConsequencesSystem.states.get(loser);

  assert.equal(states.get(winner).fsmState, TRAFFIC_ROUTE_BEHAVIOR_STATE.RECOVER_TRAFFIC);
  assert.equal(states.get(winner).reason, "gridlock-push");
  assert.ok(states.get(winner).desiredSpeedFactor > 0);
  assert.equal(states.get(loser).fsmState, TRAFFIC_ROUTE_BEHAVIOR_STATE.YIELD_JUNCTION);
  assert.ok(targetPhysical.offsetX > 0);
  assert.equal(targetPhysical.lastReason, "traffic-recovery");
  assert.equal(controller.snapshot().gridlockPushingVehicles, 1);
});

test("an abandoned persistent vehicle becomes a recoverable static blocker", () => {
  const topology = topologyFixture(200);
  const slot = routeSlot("traffic-a", 40);
  const parked = {
    id: "parked-car",
    x: 82,
    y: 0,
    angle: 0,
    speed: 0,
    velocityX: 0,
    velocityY: 0,
    parked: true,
    archetype: { width: 28, height: 14 },
    container: {
      setPosition(x, y) {
        this.x = x;
        this.y = y;
        return this;
      }
    }
  };
  let persists = 0;
  const vehicleSystem = {
    currentVehicleId: null,
    vehicles: [parked],
    isDriving() { return false; },
    vehicle(id) { return id === parked.id ? parked : null; },
    canOccupy() { return true; },
    persistVehicle() { persists++; }
  };
  const materializer = {
    pool: [slot],
    assignments: new Map([[slot.tokenId, slot]]),
    scene: {
      trafficLocalBehaviorSystem: behaviorTuning(),
      vehicleSystem,
      player: null
    }
  };
  const runtime = {
    agents() {
      return [{ tokenId: slot.tokenId, stage: "lane", currentLaneId: "lane-a", stageProgress: 0.2 }];
    },
    snapshot() { return { blocked: [] }; }
  };
  const controller = createTrafficRouteBehaviorController(materializer, { topology, baseSpeed: 112 });
  const originalY = parked.y;

  for (let index = 0; index < 36; index++) controller.update(runtime, 0.05);
  const state = controller.snapshot().vehicles[0];

  assert.ok([
    TRAFFIC_ROUTE_BEHAVIOR_STATE.RECOVER_STATIC,
    TRAFFIC_ROUTE_BEHAVIOR_STATE.CRUISE,
    TRAFFIC_ROUTE_BEHAVIOR_STATE.STOPPED_STATIC
  ].includes(state.fsmState));
  assert.ok(state.recoveryAttempts > 0);
  assert.notEqual(parked.y, originalY);
  assert.ok(persists > 0);
  assert.equal(vehicleSystem.currentVehicleId, null);
});
