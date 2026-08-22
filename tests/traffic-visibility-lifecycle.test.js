import test from "node:test";
import assert from "node:assert/strict";

import { installTrafficLocalAssignmentPolicy } from "../phaser/src/streaming/TrafficLocalAssignmentPolicy.js";
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

function lanes() {
  return {
    schemaVersion: 3,
    version: 3,
    id: "visibility-lifecycle-test",
    defaults: {
      maxActiveVehicles: 1,
      materializeRadius: 500,
      despawnRadius: 600
    },
    edges: {
      "west:east": {
        forward: [{ x: 0, y: 110 }, { x: 1000, y: 110 }],
        reverse: [{ x: 1000, y: 150 }, { x: 0, y: 150 }]
      }
    }
  };
}

function fakeScene(phase = 0.2) {
  const city = {
    ready: true,
    focusPoint: { x: 200, y: 110 },
    focus() { return this.focusPoint; },
    isPointActive() { return true; },
    isPointReady() { return this.ready; },
    query() { return []; }
  };
  const macro = {
    graph: {
      edgeIds: ["west:east"],
      edges: {
        "west:east": { id: "west:east", a: "west", b: "east", travelSeconds: 10 }
      }
    },
    accumulator: 0,
    trafficFlows: new Map([
      ["west:east", { edgeId: "west:east", tokenCount: 1, phases: [phase], completedTrips: 0 }]
    ]),
    initialization: Promise.resolve()
  };
  const vehicleSystem = {
    vehicles: [],
    currentVehicleId: null,
    canOccupy() { return true; },
    isDriving() { return false; }
  };
  return {
    currentLayer: 0,
    player: chainable({ x: 200, y: 110 }),
    cameras: {
      main: {
        worldView: { x: 100, y: 50, width: 200, height: 120 }
      }
    },
    cityStreamSystem: city,
    macroTrafficPoliceSystem: macro,
    vehicleSystem,
    registry: { get() { return false; } },
    add: {
      container(x, y) { return chainable({ x, y, children: [] }); },
      ellipse() { return chainable(); },
      rectangle() { return chainable(); },
      triangle() { return chainable(); },
      text() { return chainable(); }
    },
    events: { once() {} },
    statePublisher: { setMany() {} },
    lastActionText: ""
  };
}

function setPhase(scene, phase) {
  scene.macroTrafficPoliceSystem.trafficFlows.get("west:east").phases[0] = phase;
}

async function install(scene) {
  const materializer = new TrafficMaterializationSystem(scene, {
    lanesUrl: "https://example.test/traffic-lanes.json",
    fetchImpl: async () => ({ ok: true, json: async () => lanes() })
  });
  scene.trafficMaterializationSystem = materializer;
  await materializer.initialization;
  const policy = installTrafficLocalAssignmentPolicy(scene);
  scene.trafficLocalAssignmentPolicy = policy;
  return { materializer, policy };
}

function destroyInstalled(installed) {
  installed.policy.destroy();
  installed.materializer.destroy();
}

test("civilian traffic only materializes beyond the camera spawn guard", async () => {
  const scene = fakeScene(0.2);
  const installed = await install(scene);
  const { materializer } = installed;

  assert.equal(materializer.snapshot().materializedCount, 0);

  setPhase(scene, 0.35);
  materializer.reconcile(true);
  assert.equal(materializer.snapshot().materializedCount, 0);

  setPhase(scene, 0.37);
  materializer.reconcile(true);
  const snapshot = materializer.snapshot();
  assert.equal(snapshot.materializedCount, 1);
  assert.equal(snapshot.materialized[0].insideCamera, false);
  assert.ok(snapshot.despawnCameraMargin > snapshot.spawnCameraMargin);
  assert.ok(snapshot.cameraRetentionMargin > snapshot.spawnCameraMargin);
  assert.ok(snapshot.viewportRetentionMargin > snapshot.spawnCameraMargin);

  destroyInstalled(installed);
});

test("visible traffic cannot be released, then reuses its pooled slot after a real off-screen despawn", async () => {
  const scene = fakeScene(0.37);
  const installed = await install(scene);
  const { materializer } = installed;
  const slot = materializer.pool[0];
  const pooledContainer = slot.container;

  assert.equal(materializer.snapshot().materializedCount, 1);

  slot.x = 250;
  slot.y = 110;
  slot.container.setPosition(slot.x, slot.y);
  assert.equal(materializer.release(slot), false);
  let snapshot = materializer.snapshot();
  assert.equal(snapshot.materializedCount, 1);
  assert.equal(snapshot.preventedVisibleDespawns, 1);
  assert.equal(snapshot.lastPreventedTokenId, "west:east#0");

  scene.cityStreamSystem.ready = false;
  setPhase(scene, 0.25);
  materializer.reconcile(true);
  assert.equal(materializer.snapshot().materializedCount, 1);

  scene.cityStreamSystem.ready = true;
  setPhase(scene, 0.95);
  slot.x = 950;
  slot.y = 110;
  slot.container.setPosition(slot.x, slot.y);
  materializer.reconcile(true);
  snapshot = materializer.snapshot();
  assert.equal(snapshot.materializedCount, 0);
  assert.equal(slot.container.active, false);
  assert.equal(slot.container.visible, false);

  setPhase(scene, 0.37);
  materializer.reconcile(true);
  snapshot = materializer.snapshot();
  assert.equal(snapshot.materializedCount, 1);
  assert.equal(materializer.pool[0], slot);
  assert.equal(materializer.pool[0].container, pooledContainer);
  assert.equal(pooledContainer.destroyed, undefined);

  destroyInstalled(installed);
});
