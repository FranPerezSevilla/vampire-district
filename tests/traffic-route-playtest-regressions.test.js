import test from "node:test";
import assert from "node:assert/strict";

import {
  createTrafficRouteBehaviorController,
  TRAFFIC_ROUTE_BEHAVIOR_STATE
} from "../phaser/src/streaming/TrafficRouteBehaviorPolicy.js";

function eventsFixture() {
  const handlers = new Map();
  return {
    on(name, handler) {
      const list = handlers.get(name) || [];
      list.push(handler);
      handlers.set(name, list);
    },
    off(name, handler) {
      handlers.set(name, (handlers.get(name) || []).filter(item => item !== handler));
    },
    emit(name, payload) {
      for (const handler of handlers.get(name) || []) handler(payload);
    }
  };
}

function topologyFixture() {
  return {
    lanes: {
      "lane-a": {
        id: "lane-a",
        length: 300,
        points: [{ x: 0, y: 0 }, { x: 300, y: 0 }]
      }
    }
  };
}

function routeSlot(tokenId, x = 40, y = 0) {
  return {
    tokenId,
    routeActive: true,
    radius: 14,
    x,
    y,
    angle: 0,
    speedFactor: 1,
    desiredSpeedFactor: 1,
    container: { active: true }
  };
}

function runtimeFor(tokenId, progress = 40 / 300) {
  return {
    agents() {
      return [{ tokenId, stage: "lane", currentLaneId: "lane-a", stageProgress: progress }];
    },
    snapshot() { return { blocked: [] }; }
  };
}

function behaviorTuning() {
  return {
    followDistance: 78,
    hardStopDistance: 34,
    playerLookAhead: 132,
    laneTolerance: 38,
    pedestrianLaneTolerance: 18,
    accelerationRate: 1.35,
    brakingRate: 5.8,
    gridlockBreakSeconds: 1.4,
    gridlockPushSpeedFactor: 0.25,
    staticRecoveryDelay: 2,
    staticRecoverySpeedFactor: 0.18
  };
}

function sceneFixture(slot, player) {
  return {
    player,
    currentLayer: "street",
    events: eventsFixture(),
    trafficLocalBehaviorSystem: behaviorTuning(),
    vehicleSystem: {
      currentVehicleId: null,
      vehicles: [],
      isDriving() { return false; }
    }
  };
}

test("player standing on the sidewalk does not stop a route-active civilian car", () => {
  const topology = topologyFixture();
  const slot = routeSlot("traffic-a");
  const scene = sceneFixture(slot, { x: 90, y: 36 });
  const materializer = {
    scene,
    pool: [slot],
    assignments: new Map([[slot.tokenId, slot]])
  };
  const controller = createTrafficRouteBehaviorController(materializer, { topology, baseSpeed: 112 });

  controller.update(runtimeFor(slot.tokenId), 0.05);
  const state = controller.snapshot().vehicles[0];

  assert.equal(state.fsmState, TRAFFIC_ROUTE_BEHAVIOR_STATE.CRUISE);
  assert.equal(state.reason, "route-cruise");
  assert.equal(state.blockerId, null);
  assert.equal(controller.speedFactor(slot.tokenId), 1);
  controller.clear();
});

test("player actually occupying the lane still causes a safe stop reaction", () => {
  const topology = topologyFixture();
  const slot = routeSlot("traffic-a");
  const scene = sceneFixture(slot, { x: 90, y: 6 });
  const materializer = {
    scene,
    pool: [slot],
    assignments: new Map([[slot.tokenId, slot]])
  };
  const controller = createTrafficRouteBehaviorController(materializer, { topology, baseSpeed: 112 });

  for (let index = 0; index < 8; index++) controller.update(runtimeFor(slot.tokenId), 0.05);
  const state = controller.snapshot().vehicles[0];

  assert.equal(state.fsmState, TRAFFIC_ROUTE_BEHAVIOR_STATE.BLOCKED_PLAYER);
  assert.equal(state.reason, "player-on-foot");
  assert.equal(state.blockerId, "player");
  assert.ok(state.speedFactor < 1);
  controller.clear();
});

test("a nearby gunshot puts civilian traffic into panic without exceeding route speed authority", () => {
  const topology = topologyFixture();
  const slot = routeSlot("traffic-a", 80, 0);
  const scene = sceneFixture(slot, { x: 76, y: 12 });
  const materializer = {
    scene,
    pool: [slot],
    assignments: new Map([[slot.tokenId, slot]])
  };
  const controller = createTrafficRouteBehaviorController(materializer, { topology, baseSpeed: 112 });
  const runtime = runtimeFor(slot.tokenId, 80 / 300);

  controller.update(runtime, 0.05);
  scene.events.emit("weapon:fired", { weaponId: "pistol" });
  controller.update(runtime, 0.05);
  const state = controller.snapshot().vehicles[0];

  assert.equal(state.fsmState, TRAFFIC_ROUTE_BEHAVIOR_STATE.PANIC);
  assert.equal(state.reason, "gunshot-panic");
  assert.ok(state.panicSeconds > 0);
  assert.ok(controller.snapshot().panickingVehicles >= 1);
  assert.ok(controller.speedFactor(slot.tokenId) <= 1);
  assert.ok(slot.engineSpeed <= 112);
  controller.clear();
});
