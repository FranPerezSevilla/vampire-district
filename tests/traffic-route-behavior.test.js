import test from "node:test";
import assert from "node:assert/strict";

import {
  createTrafficRouteBehaviorController,
  trafficGridlockInitiativeWinner
} from "../phaser/src/streaming/TrafficRouteBehaviorPolicy.js";

function fixture() {
  const topology = {
    lanes: {
      "lane-a": {
        id: "lane-a",
        length: 200,
        points: [{ x: 0, y: 0 }, { x: 200, y: 0 }]
      }
    }
  };
  const slot = {
    tokenId: "traffic-a",
    routeActive: true,
    routeStage: "lane",
    routeLaneId: "lane-a",
    radius: 14,
    x: 40,
    y: 0,
    angle: 0,
    speedFactor: 1,
    desiredSpeedFactor: 1
  };
  const blocker = {
    id: "player-car",
    x: 82,
    y: 0,
    angle: 0,
    archetype: { width: 28, height: 14 }
  };
  const materializer = {
    assignments: new Map([[slot.tokenId, slot]]),
    scene: {
      trafficLocalBehaviorSystem: {
        followDistance: 78,
        hardStopDistance: 34,
        playerLookAhead: 132,
        laneTolerance: 38,
        accelerationRate: 1.35,
        brakingRate: 5.8
      },
      vehicleSystem: {
        currentVehicleId: blocker.id,
        vehicles: [blocker],
        isDriving() {
          return true;
        }
      },
      player: { x: blocker.x, y: blocker.y }
    }
  };
  let agent = {
    tokenId: slot.tokenId,
    stage: "lane",
    currentLaneId: "lane-a",
    stageProgress: 0.2
  };
  const runtime = {
    agents() {
      return [{ ...agent }];
    },
    snapshot() {
      return { blocked: [] };
    }
  };
  return {
    topology,
    slot,
    blocker,
    materializer,
    runtime,
    setAgent(next) {
      agent = { ...next };
    }
  };
}

test("route behavior brakes for a driven blocker but never owns route pose", () => {
  const { topology, slot, blocker, materializer, runtime } = fixture();
  const controller = createTrafficRouteBehaviorController(materializer, {
    topology,
    baseSpeed: 100
  });
  const poseBefore = { x: slot.x, y: slot.y, angle: slot.angle };

  controller.update(runtime, 0.05);
  const state = controller.snapshot().vehicles.find(item => item.tokenId === slot.tokenId);

  assert.equal(state.reason, "player-vehicle");
  assert.equal(state.blockerId, blocker.id);
  assert.ok(state.speedFactor < 1);
  assert.equal(slot.speedFactor, state.speedFactor);
  assert.equal(slot.behaviorReason, "player-vehicle");
  assert.equal(slot.behaviorBlockerId, blocker.id);
  assert.deepEqual({ x: slot.x, y: slot.y, angle: slot.angle }, poseBefore);
  assert.equal(controller.snapshot().movementAuthority, false);
  assert.equal(controller.snapshot().lateralSteeringAuthority, false);
});

test("route behavior recovers after blocker clears and forces connector clearing speed", () => {
  const { topology, slot, blocker, materializer, runtime, setAgent } = fixture();
  const controller = createTrafficRouteBehaviorController(materializer, {
    topology,
    baseSpeed: 100
  });

  controller.update(runtime, 0.05);
  const braking = controller.speedFactor(slot.tokenId);
  blocker.x = 10;
  for (let index = 0; index < 12; index++) controller.update(runtime, 0.05);
  const recovered = controller.speedFactor(slot.tokenId);
  assert.ok(recovered > braking);

  setAgent({
    tokenId: slot.tokenId,
    stage: "connector",
    currentLaneId: "lane-a",
    connectorId: "connector-a",
    stageProgress: 0.3
  });
  controller.update(runtime, 0.05);
  assert.equal(controller.speedFactor(slot.tokenId, "connector"), 1);
  assert.equal(controller.snapshot().vehicles[0].reason, "route-connector-clear");
});

test("prolonged traffic queue gives one deterministic car initiative to push through", () => {
  const topology = {
    lanes: {
      "lane-a": {
        id: "lane-a",
        length: 240,
        points: [{ x: 0, y: 0 }, { x: 240, y: 0 }]
      }
    }
  };
  const ids = ["traffic-a", "traffic-b"];
  const winner = trafficGridlockInitiativeWinner(ids[0], ids[1]);
  const loser = ids.find(id => id !== winner);
  const rearSlot = {
    tokenId: winner,
    routeActive: true,
    radius: 14,
    x: 80,
    y: 0,
    angle: 0,
    speedFactor: 1,
    desiredSpeedFactor: 1
  };
  const leadSlot = {
    tokenId: loser,
    routeActive: true,
    radius: 14,
    x: 112,
    y: 0,
    angle: 0,
    speedFactor: 1,
    desiredSpeedFactor: 1
  };
  const parked = {
    id: "parked",
    x: 142,
    y: 0,
    archetype: { width: 28, height: 14 }
  };
  const materializer = {
    assignments: new Map([
      [rearSlot.tokenId, rearSlot],
      [leadSlot.tokenId, leadSlot]
    ]),
    scene: {
      trafficLocalBehaviorSystem: {
        followDistance: 78,
        hardStopDistance: 34,
        playerLookAhead: 132,
        laneTolerance: 38,
        accelerationRate: 1.35,
        brakingRate: 5.8,
        gridlockBreakSeconds: 0.6,
        gridlockPushSpeedFactor: 0.28
      },
      vehicleSystem: {
        currentVehicleId: null,
        vehicles: [parked],
        isDriving() {
          return false;
        }
      },
      player: null
    }
  };
  const agents = [
    { tokenId: winner, stage: "lane", currentLaneId: "lane-a", stageProgress: 80 / 240 },
    { tokenId: loser, stage: "lane", currentLaneId: "lane-a", stageProgress: 112 / 240 }
  ];
  const runtime = {
    agents() {
      return agents.map(agent => ({ ...agent }));
    },
    snapshot() {
      return { blocked: [] };
    }
  };
  const controller = createTrafficRouteBehaviorController(materializer, {
    topology,
    baseSpeed: 100
  });

  for (let index = 0; index < 28; index++) controller.update(runtime, 0.05);
  const states = new Map(controller.snapshot().vehicles.map(item => [item.tokenId, item]));

  assert.equal(states.get(winner).reason, "gridlock-push");
  assert.ok(states.get(winner).desiredSpeedFactor > 0);
  assert.equal(states.get(loser).reason, "parked-vehicle");
  assert.equal(states.get(loser).desiredSpeedFactor, 0);
  assert.equal(controller.snapshot().gridlockPushingVehicles, 1);
});
