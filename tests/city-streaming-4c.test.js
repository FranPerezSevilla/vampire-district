import test from "node:test";
import assert from "node:assert/strict";

import {
  pointAlongPolyline,
  TrafficMaterializationSystem
} from "../phaser/src/streaming/TrafficMaterializationSystem.js";

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

function fakeScene() {
  const graph = {
    edgeIds: ["west:east"],
    edges: {
      "west:east": { id: "west:east", a: "west", b: "east", travelSeconds: 4 }
    }
  };
  const macro = {
    graph,
    accumulator: 0,
    trafficFlows: new Map([
      ["west:east", { edgeId: "west:east", tokenCount: 2, phases: [0.25, 0.75], completedTrips: 0 }]
    ]),
    initialization: Promise.resolve()
  };
  const city = {
    focusPoint: { x: 500, y: 100 },
    focus() { return this.focusPoint; },
    isPointActive() { return true; },
    isPointReady() { return true; }
  };
  const vehicleSystem = {
    vehicles: [],
    canOccupy() { return true; },
    isDriving() { return false; }
  };
  return {
    currentLayer: 0,
    player: { x: -500, y: -500 },
    cityStreamSystem: city,
    macroTrafficPoliceSystem: macro,
    vehicleSystem,
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

function laneManifest() {
  return {
    schemaVersion: 1,
    version: 1,
    id: "traffic-test",
    defaults: {
      maxActiveVehicles: 2,
      materializeRadius: 800,
      despawnRadius: 900
    },
    edges: {
      "west:east": {
        forward: [{ x: 0, y: 100 }, { x: 1000, y: 100 }],
        reverse: [{ x: 1000, y: 150 }, { x: 0, y: 150 }]
      }
    }
  };
}

test("pointAlongPolyline follows total path distance and reports segment angle", () => {
  const point = pointAlongPolyline([
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 300 }
  ], 0.5);

  assert.equal(point.x, 100);
  assert.equal(point.y, 100);
  assert.equal(point.angle, Math.PI / 2);
});

test("local traffic materializes from macro tokens, blocks driven cars and reuses its pool", async () => {
  const scene = fakeScene();
  const originalCanOccupy = scene.vehicleSystem.canOccupy;
  const system = new TrafficMaterializationSystem(scene, {
    lanesUrl: "https://example.test/traffic-lanes.json",
    fetchImpl: async () => ({ ok: true, json: async () => laneManifest() })
  });

  await system.initialization;
  const initial = system.snapshot();

  assert.equal(initial.ready, true);
  assert.equal(initial.poolSize, 2);
  assert.equal(initial.materializedCount, 2);
  assert.deepEqual(initial.materialized.map(item => item.direction), ["forward", "reverse"]);

  const first = initial.materialized[0];
  assert.equal(system.blocksVehicle(first.x, first.y, 1), true);
  assert.equal(scene.vehicleSystem.canOccupy({ archetype: { width: 28, height: 14 } }, first.x, first.y, first.angle), false);
  assert.equal(scene.vehicleSystem.canOccupy({ archetype: { width: 28, height: 14 } }, -1000, -1000, 0), true);

  const slot = system.pool[first.slotIndex];
  const beforeX = slot.x;
  scene.macroTrafficPoliceSystem.accumulator = 0.5;
  system.update();
  assert.notEqual(slot.x, beforeX);
  assert.equal(slot.tokenId, first.tokenId);

  scene.currentLayer = 1;
  system.update();
  const hidden = system.snapshot();
  assert.equal(hidden.materializedCount, 0);
  assert.equal(hidden.poolSize, 2);
  assert.equal(system.pool.every(item => item.container.active === false), true);

  scene.currentLayer = 0;
  system.update();
  assert.equal(system.snapshot().materializedCount, 2);
  assert.equal(system.snapshot().poolSize, 2);

  system.destroy();
  assert.equal(scene.vehicleSystem.canOccupy, originalCanOccupy);
  assert.equal(system.pool.length, 0);
});
