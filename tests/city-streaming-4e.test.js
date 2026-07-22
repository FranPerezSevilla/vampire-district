import test from "node:test";
import assert from "node:assert/strict";

import { installTrafficLocalAssignmentPolicy } from "../phaser/src/streaming/TrafficLocalAssignmentPolicy.js";
import { TrafficLocalBehaviorSystem } from "../phaser/src/streaming/TrafficLocalBehaviorSystem.js";
import { TrafficMaterializationSystem } from "../phaser/src/streaming/TrafficMaterializationSystem.js";
import {
  decayTrafficOffset,
  softTrafficImpulse,
  TrafficPhysicalConsequencesSystem
} from "../phaser/src/streaming/TrafficPhysicalConsequencesSystem.js";
import { stepVehicleKinematics } from "../phaser/src/vehicles/VehicleModel.js";

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

function graph() {
  return {
    edgeIds: ["west:east"],
    edges: {
      "west:east": { id: "west:east", a: "west", b: "east", travelSeconds: 10 }
    }
  };
}

function lanes() {
  return {
    schemaVersion: 3,
    version: 3,
    id: "physics-test",
    defaults: { maxActiveVehicles: 1, materializeRadius: 1200, despawnRadius: 1300 },
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
    physics: {
      maxPushStep: 16,
      maxOffset: 44,
      offsetRecoveryRate: 24,
      pushHoldSeconds: 0.16,
      blockedHoldSeconds: 0.55,
      playerSpeedRetention: 0.78,
      collisionPadding: 2
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

function fakeScene(phase = 0.3, focus = { x: 300, y: 100 }) {
  const macro = {
    graph: graph(),
    accumulator: 0,
    trafficFlows: new Map([
      ["west:east", { edgeId: "west:east", tokenCount: 1, phases: [phase], completedTrips: 0 }]
    ]),
    initialization: Promise.resolve()
  };
  const city = {
    focusPoint: { ...focus },
    focus() { return this.focusPoint; },
    isPointActive() { return true; },
    isPointReady() { return true; },
    query() { return []; }
  };
  const vehicleSystem = {
    vehicles: [],
    currentVehicleId: null,
    canOccupy() { return true; },
    currentVehicle() { return this.vehicles.find(vehicle => vehicle.id === this.currentVehicleId) || null; },
    isDriving() { return Boolean(this.currentVehicle()); },
    updateDriving(dt, frame) {
      const vehicle = this.currentVehicle();
      if (!vehicle) return false;
      const next = stepVehicleKinematics(vehicle, frame, dt, vehicle.archetype);
      Object.assign(vehicle, next);
      vehicle.container?.setPosition?.(vehicle.x, vehicle.y)?.setRotation?.(vehicle.angle);
      return true;
    }
  };
  return {
    currentLayer: 0,
    player: chainable({ x: -500, y: -500 }),
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
    statePublisher: { setMany() {} },
    lastActionText: ""
  };
}

function playerVehicle({ x, y, angle = 0, speed = 100 } = {}) {
  return {
    id: "player-car",
    name: "Player car",
    x,
    y,
    angle,
    travelAngle: angle,
    driftAngle: 0,
    velocityX: Math.cos(angle) * speed,
    velocityY: Math.sin(angle) * speed,
    speed,
    health: 80,
    parked: false,
    handbrake: false,
    disabled: false,
    archetype: {
      id: "sedan",
      width: 34,
      height: 16,
      maxSpeed: 330,
      reverseSpeed: 98,
      acceleration: 315,
      reverseAcceleration: 122,
      launchBoost: 0.5,
      brake: 290,
      handbrakeBrake: 172,
      handbrakeThrottleFactor: 0.18,
      handbrakeSteerMultiplier: 1.38,
      handbrakeDriftKick: 0.54,
      grip: 8.8,
      handbrakeGrip: 1.38,
      drag: 42,
      steerRate: 2.96,
      maxHealth: 88,
      trunkCapacity: 4,
      cameraZoomFactor: 0.66,
      color: 0x9a7ab8,
      trim: 0xefe6ff
    },
    container: chainable()
  };
}

async function install(scene) {
  const materializer = new TrafficMaterializationSystem(scene, {
    lanesUrl: "https://example.test/traffic-lanes.json",
    fetchImpl: async () => ({ ok: true, json: async () => lanes() })
  });
  scene.trafficMaterializationSystem = materializer;
  await materializer.initialization;
  const assignmentPolicy = installTrafficLocalAssignmentPolicy(scene);
  scene.trafficLocalAssignmentPolicy = assignmentPolicy;
  const behavior = new TrafficLocalBehaviorSystem(scene);
  scene.trafficLocalBehaviorSystem = behavior;
  await behavior.initialization;
  const originalUpdateDriving = scene.vehicleSystem.updateDriving;
  const originalDecisionFor = behavior.decisionFor;
  const physics = new TrafficPhysicalConsequencesSystem(scene);
  scene.trafficPhysicalConsequencesSystem = physics;
  await physics.initialization;
  return { materializer, assignmentPolicy, behavior, physics, originalUpdateDriving, originalDecisionFor };
}

function destroyInstalled(scene, installed) {
  installed.physics.destroy();
  assert.equal(scene.vehicleSystem.updateDriving, installed.originalUpdateDriving);
  assert.equal(installed.behavior.decisionFor, installed.originalDecisionFor);
  installed.behavior.destroy();
  installed.assignmentPolicy.destroy();
  installed.materializer.destroy();
}

test("traffic physics helpers keep impulses bounded and offsets decay without reversing", () => {
  assert.equal(softTrafficImpulse(3, 200, { maximum: 7 }), 7);
  assert.equal(softTrafficImpulse(0, 0, { minimum: 2, maximum: 16 }), 2);
  const decayed = decayTrafficOffset(3, 4, 2);
  assert.ok(Math.abs(decayed.x - 1.8) < 1e-9);
  assert.ok(Math.abs(decayed.y - 2.4) < 1e-9);
  assert.deepEqual(decayTrafficOffset(3, 4, 5), { x: 0, y: 0 });
});

test("a clear traffic contact pushes the proxy, preserves health and damps the driven car", async () => {
  const scene = fakeScene(0.3);
  const installed = await install(scene);
  const { materializer, behavior, physics } = installed;
  const slotBefore = materializer.snapshot().materialized[0];
  const vehicle = playerVehicle({ x: 266, y: 100, angle: 0, speed: 100 });
  scene.vehicleSystem.vehicles.push(vehicle);
  scene.vehicleSystem.currentVehicleId = vehicle.id;
  scene.player.setPosition(vehicle.x, vehicle.y);
  const healthBefore = vehicle.health;
  const predicted = stepVehicleKinematics(vehicle, { move: { x: 0, y: -1 } }, 0.05, vehicle.archetype);

  scene.vehicleSystem.updateDriving(0.05, { move: { x: 0, y: -1 }, handbrakeHeld: false });
  const snapshot = physics.snapshot();
  const contact = snapshot.contacts.find(item => item.tokenId === slotBefore.tokenId);
  const slotAfter = materializer.snapshot().materialized.find(item => item.tokenId === slotBefore.tokenId);

  assert.equal(snapshot.totalContacts, 1);
  assert.equal(snapshot.totalPushes, 1);
  assert.equal(snapshot.totalBlocks, 0);
  assert.equal(snapshot.lastContact.pushed, true);
  assert.ok(contact.offsetDistance > 0);
  assert.equal(slotAfter.slotIndex, slotBefore.slotIndex);
  assert.equal(vehicle.health, healthBefore);
  assert.ok(Math.abs(vehicle.speed) < Math.abs(predicted.speed));
  assert.match(scene.lastActionText, /pushed aside/i);

  behavior.update(0.05, { force: true });
  physics.update(0.05, { force: true });
  const constrained = behavior.snapshot().vehicles.find(item => item.tokenId === slotBefore.tokenId);
  assert.equal(constrained.reason, "physical-contact");

  vehicle.x = 100;
  vehicle.y = 100;
  vehicle.container.setPosition(vehicle.x, vehicle.y);
  const offsetBeforeRecovery = physics.snapshot().contacts[0].offsetDistance;
  for (let index = 0; index < 30; index++) {
    behavior.update(0.05, { force: true });
    physics.update(0.05, { force: true });
  }
  const recovered = physics.snapshot().contacts[0];
  assert.ok(recovered.offsetDistance < offsetBeforeRecovery);
  destroyInstalled(scene, installed);
});

test("an outward contact blocks both vehicles without damage or world-collision consequences", async () => {
  const scene = fakeScene(0.005, { x: 20, y: 100 });
  const installed = await install(scene);
  const { materializer, behavior, physics } = installed;
  const slotBefore = materializer.snapshot().materialized[0];
  const vehicle = playerVehicle({ x: 38, y: 100, angle: Math.PI, speed: 80 });
  scene.vehicleSystem.vehicles.push(vehicle);
  scene.vehicleSystem.currentVehicleId = vehicle.id;
  scene.player.setPosition(vehicle.x, vehicle.y);
  const before = { x: vehicle.x, y: vehicle.y, health: vehicle.health };

  scene.vehicleSystem.updateDriving(0.05, { move: { x: 0, y: -1 }, handbrakeHeld: false });
  const snapshot = physics.snapshot();
  const contact = snapshot.contacts.find(item => item.tokenId === slotBefore.tokenId);

  assert.equal(snapshot.totalContacts, 1);
  assert.equal(snapshot.totalPushes, 0);
  assert.equal(snapshot.totalBlocks, 1);
  assert.equal(snapshot.lastContact.blocked, true);
  assert.equal(contact.reason, "blocked");
  assert.equal(contact.offsetDistance, 0);
  assert.equal(vehicle.x, before.x);
  assert.equal(vehicle.y, before.y);
  assert.equal(vehicle.speed, 0);
  assert.equal(vehicle.health, before.health);
  assert.match(scene.lastActionText, /both vehicles are blocked/i);

  behavior.update(0.05, { force: true });
  physics.update(0.05, { force: true });
  const constrained = behavior.snapshot().vehicles.find(item => item.tokenId === slotBefore.tokenId);
  assert.equal(constrained.reason, "physical-blocked");
  assert.equal(materializer.snapshot().materialized[0].slotIndex, slotBefore.slotIndex);
  destroyInstalled(scene, installed);
});
