import test from "node:test";
import assert from "node:assert/strict";

import { installTrafficLocalAssignmentPolicy } from "../phaser/src/streaming/TrafficLocalAssignmentPolicy.js";
import {
  forwardPhaseDistance,
  nearestPointOnPolyline,
  TrafficLocalBehaviorSystem
} from "../phaser/src/streaming/TrafficLocalBehaviorSystem.js";
import { TrafficMaterializationSystem } from "../phaser/src/streaming/TrafficMaterializationSystem.js";

function chainable(extra = {}) {
  return {
    active: true,
    visible: true,
    x: 0,
    y: 0,
    rotation: 0,
    setStrokeStyle() { return this; },
    setOrigin() { return this; },
    setRotation(value) { this.rotation = value; return this; },
    setResolution() { return this; },
    setStroke() { return this; },
    setVisible(value) { this.visible = value; return this; },
    setActive(value) { this.active = value; return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    setDepth() { return this; },
    setAlpha() { return this; },
    add() { return this; },
    destroy() { this.destroyed = true; return this; },
    ...extra
  };
}

function fakeScene({ graph, flows, focus = { x: 500, y: 100 } }) {
  const macro = {
    graph,
    accumulator: 0,
    trafficFlows: new Map(Object.entries(flows)),
    initialization: Promise.resolve()
  };
  const city = {
    focusPoint: { ...focus },
    focus() { return this.focusPoint; },
    isPointActive() { return true; },
    isPointReady() { return true; }
  };
  const vehicleSystem = {
    vehicles: [],
    currentVehicleId: null,
    canOccupy() { return true; },
    currentVehicle() { return this.vehicles.find(vehicle => vehicle.id === this.currentVehicleId) || null; },
    isDriving() { return Boolean(this.currentVehicle()); }
  };
  return {
    currentLayer: 0,
    player: { x: -500, y: -500 },
    cityStreamSystem: city,
    macroTrafficPoliceSystem: macro,
    vehicleSystem,
    registry: { get() { return false; } },
    add: {
      container(x, y) { return chainable({ x, y, children: [] }); },
      rectangle() { return chainable(); },
      triangle() { return chainable(); },
      text() { return chainable(); }
    },
    events: { once() {} },
    statePublisher: { setMany() {} }
  };
}

function singleEdgeGraph() {
  return {
    edgeIds: ["west:east"],
    edges: {
      "west:east": { id: "west:east", a: "west", b: "east", travelSeconds: 10 }
    }
  };
}

function singleEdgeLanes() {
  return {
    schemaVersion: 2,
    version: 2,
    id: "behavior-test",
    defaults: { maxActiveVehicles: 3, materializeRadius: 900, despawnRadius: 1000 },
    behavior: {
      followDistance: 78,
      hardStopDistance: 34,
      playerLookAhead: 132,
      laneTolerance: 38,
      accelerationRate: 1.35,
      brakingRate: 5.8,
      catchUpSpeed: 1.24,
      junctionApproachDistance: 82,
      junctionRadius: 30
    },
    junctions: [],
    edges: {
      "west:east": {
        forward: [{ x: 0, y: 100 }, { x: 1000, y: 100 }],
        reverse: [{ x: 1000, y: 150 }, { x: 0, y: 150 }]
      }
    }
  };
}

async function install(scene, lanes) {
  const materializer = new TrafficMaterializationSystem(scene, {
    lanesUrl: "https://example.test/traffic-lanes.json",
    fetchImpl: async () => ({ ok: true, json: async () => lanes })
  });
  scene.trafficMaterializationSystem = materializer;
  await materializer.initialization;
  const assignmentPolicy = installTrafficLocalAssignmentPolicy(scene);
  scene.trafficLocalAssignmentPolicy = assignmentPolicy;
  const behavior = new TrafficLocalBehaviorSystem(scene);
  scene.trafficLocalBehaviorSystem = behavior;
  await behavior.initialization;
  return { materializer, assignmentPolicy, behavior };
}

function destroyInstalled({ materializer, assignmentPolicy, behavior }) {
  behavior.destroy();
  assignmentPolicy.destroy();
  materializer.destroy();
}

test("traffic phase and polyline helpers keep deterministic forward geometry", () => {
  assert.ok(Math.abs(forwardPhaseDistance(0.9, 0.1) - 0.2) < 1e-9);
  const projection = nearestPointOnPolyline([
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 }
  ], 90, 40);
  assert.equal(projection.x, 100);
  assert.equal(projection.y, 40);
  assert.equal(projection.progress, 0.7);
  assert.equal(projection.distance, 10);
});

test("rear local traffic brakes for a same-lane lead and accelerates when the gap clears", async () => {
  const flows = {
    "west:east": { edgeId: "west:east", tokenCount: 3, phases: [0.2, 0.5, 0.6], completedTrips: 0 }
  };
  const scene = fakeScene({ graph: singleEdgeGraph(), flows });
  const installed = await install(scene, singleEdgeLanes());
  const { materializer, behavior } = installed;

  const leadState = behavior.states.get("west:east#2");
  leadState.visualTravel = 0.25;
  leadState.authorityTravel = 0.6;
  leadState.lastAuthorityPhase = 0.6;
  behavior.update(0, { force: true });
  behavior.update(0.4, { force: true });
  const first = behavior.snapshot();
  const rear = first.vehicles.find(vehicle => vehicle.tokenId === "west:east#0");
  const lead = first.vehicles.find(vehicle => vehicle.tokenId === "west:east#2");

  assert.equal(materializer.snapshot().materializedCount, 3);
  assert.equal(rear.reason, "traffic");
  assert.ok(rear.speedFactor < 1);
  assert.equal(lead.reason, "catch-up");

  flows["west:east"].phases[0] = 0.24;
  flows["west:east"].phases[2] = 0.8;
  leadState.visualTravel = 0.75;
  leadState.authorityTravel = 0.8;
  leadState.lastAuthorityPhase = 0.8;
  materializer.reconcile(true);
  behavior.update(0.8, { force: true });
  const recovered = behavior.snapshot().vehicles.find(vehicle => vehicle.tokenId === "west:east#0");

  assert.ok(recovered.speedFactor > rear.speedFactor);
  assert.equal(materializer.snapshot().materialized.find(vehicle => vehicle.tokenId === "west:east#0").slotIndex, rear.slotIndex);
  destroyInstalled(installed);
});

test("local traffic reacts to the player vehicle without losing its pooled assignment", async () => {
  const flows = {
    "west:east": { edgeId: "west:east", tokenCount: 1, phases: [0.2], completedTrips: 0 }
  };
  const scene = fakeScene({ graph: singleEdgeGraph(), flows, focus: { x: 220, y: 100 } });
  const installed = await install(scene, singleEdgeLanes());
  const { materializer, behavior } = installed;
  const slotBefore = materializer.snapshot().materialized[0];
  const playerVehicle = {
    id: "player-car",
    x: 275,
    y: 100,
    angle: 0,
    archetype: { width: 34, height: 16 }
  };
  scene.vehicleSystem.vehicles.push(playerVehicle);
  scene.vehicleSystem.currentVehicleId = playerVehicle.id;

  behavior.update(0.25, { force: true });
  const braking = behavior.snapshot().vehicles[0];

  assert.equal(braking.reason, "player-vehicle");
  assert.ok(braking.speedFactor < 1);
  assert.equal(materializer.snapshot().materialized[0].slotIndex, slotBefore.slotIndex);

  playerVehicle.x = 50;
  flows["west:east"].phases[0] = 0.26;
  materializer.reconcile(true);
  behavior.update(0.8, { force: true });
  const recovered = behavior.snapshot().vehicles[0];

  assert.ok(recovered.speedFactor > braking.speedFactor);
  assert.equal(materializer.snapshot().materialized[0].slotIndex, slotBefore.slotIndex);
  destroyInstalled(installed);
});

test("crossing traffic yields deterministically to the closer or stable-priority approach", async () => {
  const graph = {
    edgeIds: ["horizontal", "vertical"],
    edges: {
      horizontal: { id: "horizontal", a: "west", b: "east", travelSeconds: 10 },
      vertical: { id: "vertical", a: "north", b: "south", travelSeconds: 10 }
    }
  };
  const flows = {
    horizontal: { edgeId: "horizontal", tokenCount: 1, phases: [0.43], completedTrips: 0 },
    vertical: { edgeId: "vertical", tokenCount: 1, phases: [0.43], completedTrips: 0 }
  };
  const lanes = {
    schemaVersion: 2,
    version: 2,
    id: "junction-test",
    defaults: { maxActiveVehicles: 2, materializeRadius: 900, despawnRadius: 1000 },
    behavior: singleEdgeLanes().behavior,
    junctions: [{ id: "cross", x: 500, y: 100, radius: 30, approachDistance: 100 }],
    edges: {
      horizontal: {
        forward: [{ x: 0, y: 100 }, { x: 1000, y: 100 }],
        reverse: [{ x: 1000, y: 140 }, { x: 0, y: 140 }]
      },
      vertical: {
        forward: [{ x: 500, y: -400 }, { x: 500, y: 600 }],
        reverse: [{ x: 540, y: 600 }, { x: 540, y: -400 }]
      }
    }
  };
  const scene = fakeScene({ graph, flows, focus: { x: 470, y: 70 } });
  const installed = await install(scene, lanes);
  const { materializer, behavior } = installed;

  behavior.update(0.25, { force: true });
  const snapshot = behavior.snapshot();
  const horizontal = snapshot.vehicles.find(vehicle => vehicle.tokenId === "horizontal#0");
  const vertical = snapshot.vehicles.find(vehicle => vehicle.tokenId === "vertical#0");

  assert.equal(materializer.snapshot().materializedCount, 2);
  assert.equal(horizontal.reason, "cruise");
  assert.equal(vertical.reason, "junction-yield");
  assert.equal(vertical.junctionId, "cross");
  assert.ok(vertical.speedFactor < horizontal.speedFactor);
  destroyInstalled(installed);
});
