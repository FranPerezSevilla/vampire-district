import test from "node:test";
import assert from "node:assert/strict";

import { createTrafficRouteBehaviorController } from "../phaser/src/streaming/TrafficRouteBehaviorPolicy.js";

function slot() {
  return {
    tokenId: "traffic-a",
    routeActive: true,
    x: 40,
    y: 0,
    angle: 0,
    radius: 14,
    speedFactor: 1,
    desiredSpeedFactor: 1,
    archetype: { width: 28, height: 14 },
    container: { active: true }
  };
}

test("a player car blocking a road too narrow for bypass still receives pressure fallback", () => {
  const traffic = slot();
  const playerCar = {
    id: "player-car",
    x: 70,
    y: 0,
    angle: 0,
    speed: 0,
    velocityX: 0,
    velocityY: 0,
    archetype: { width: 32, height: 16 },
    container: {
      setPosition(x, y) {
        this.x = x;
        this.y = y;
        return this;
      }
    }
  };
  const topology = {
    lanes: {
      "lane-a": {
        id: "lane-a",
        length: 220,
        roadWidth: 28,
        laneOffset: 8,
        points: [{ x: 0, y: 0 }, { x: 220, y: 0 }]
      }
    }
  };
  const scene = {
    currentLayer: "street",
    player: { x: 70, y: 0 },
    events: { on() {}, off() {} },
    trafficLocalBehaviorSystem: {
      followDistance: 78,
      hardStopDistance: 34,
      playerLookAhead: 132,
      laneTolerance: 38,
      accelerationRate: 1.35,
      brakingRate: 5.8,
      playerPressureDelay: 0.8,
      maxPlayerPressureAttempts: 3,
      gridlockBreakSeconds: 1.4
    },
    vehicleSystem: {
      currentVehicleId: playerCar.id,
      vehicles: [playerCar],
      isDriving() { return true; },
      vehicle(id) { return id === playerCar.id ? playerCar : null; },
      canOccupy() { return true; }
    }
  };
  const materializer = {
    scene,
    pool: [traffic],
    assignments: new Map([[traffic.tokenId, traffic]]),
    originalVehicleCanOccupy() { return true; },
    blocksVehicle() { return false; },
    trafficTokens() {
      return [{ tokenId: traffic.tokenId, routeActive: true, x: traffic.x, y: traffic.y, angle: traffic.angle }];
    }
  };
  scene.trafficPhysicalConsequencesSystem = {
    proxyWorldSafe() { return true; }
  };
  const runtime = {
    agents() {
      return [{ tokenId: traffic.tokenId, stage: "lane", currentLaneId: "lane-a", stageProgress: 40 / 220 }];
    },
    snapshot() { return { blocked: [] }; }
  };
  const controller = createTrafficRouteBehaviorController(materializer, { topology, baseSpeed: 112 });
  const originalX = playerCar.x;

  for (let index = 0; index < 40; index++) controller.update(runtime, 0.05);
  const snapshot = controller.snapshot();
  const state = snapshot.vehicles[0];

  assert.equal(state.lastBypassReason, "bypass-no-legal-corridor");
  assert.ok(state.recoveryAttempts > 0);
  assert.ok(snapshot.playerPressureActions > 0);
  assert.ok(playerCar.x > originalX);
  assert.equal(state.bypassSide, 0);
  controller.clear();
});
