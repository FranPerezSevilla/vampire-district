import test from "node:test";
import assert from "node:assert/strict";

import { LAYERS, pedestrianRoutes } from "../phaser/src/data/district.js";
import { NPC_TYPES } from "../phaser/src/data/npcs.js";
import { PedestrianSystem } from "../phaser/src/systems/PedestrianSystem.js";
import { SpatialHash } from "../phaser/src/utils/SpatialHash.js";

class TestEvents {
  constructor() { this.listeners = new Map(); }
  on(name, listener) {
    const listeners = this.listeners.get(name) || [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
  }
  once(name, listener) {
    const wrapped = (...args) => {
      this.off(name, wrapped);
      listener(...args);
    };
    this.on(name, wrapped);
  }
  off(name, listener) {
    const listeners = this.listeners.get(name) || [];
    this.listeners.set(name, listeners.filter(candidate => candidate !== listener));
  }
}

function pedestrian(id, x, y, routeId) {
  return {
    id,
    type: NPC_TYPES.CIVILIAN,
    x,
    y,
    layer: LAYERS.STREET,
    behavior: "sidewalk",
    pedestrianRouteId: routeId,
    speed: 10,
    dirX: 1,
    dirY: 0,
    vx: 0,
    vy: 0,
    dead: false,
    inactive: false,
    hiddenBody: false,
    dragged: false,
    intercepted: false,
    alarmed: false,
    chasingPlayer: false,
    enemyAttack: null,
    whisperPassengerBoarded: false,
    stunnedTimer: 0,
    combat: { state: "active" },
    container: { setPosition() { return this; } }
  };
}

function spatialScene(npcs) {
  const spatial = new SpatialHash(32);
  const npcSystem = {
    npcs,
    canNpcStandAt: () => true,
    rebuildSpatialIndex: () => spatial.rebuild(npcs),
    queryRadius: (x, y, radius, layer, predicate) => spatial.queryRadius(x, y, radius, layer, predicate)
  };
  npcSystem.rebuildSpatialIndex();
  return {
    currentLayer: LAYERS.STREET,
    player: { x: -1000, y: -1000, layer: LAYERS.STREET },
    npcSystem,
    registry: { get: () => false },
    events: new TestEvents(),
    statePublisher: { setMany: () => {} }
  };
}

function withPhaser(run) {
  const previousPhaser = globalThis.Phaser;
  globalThis.Phaser = {
    Scenes: { Events: { POST_UPDATE: "postupdate", SHUTDOWN: "shutdown" } }
  };
  try { return run(); } finally { globalThis.Phaser = previousPhaser; }
}

test("72-pedestrian crowd broadphase avoids the former all-pairs frame scan", () => withPhaser(() => {
  const routeId = pedestrianRoutes[0].id;
  const columns = 12;
  const rows = 6;
  const spacing = 18;
  const npcs = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      npcs.push(pedestrian(
        `perf-${row}-${column}`,
        200 + column * spacing,
        200 + row * spacing,
        routeId
      ));
    }
  }

  const system = new PedestrianSystem(spatialScene(npcs));
  const result = system.resolveCrowdCollisions({ iterations: 1, includePlayer: false });
  const bruteForcePairChecks = npcs.length * (npcs.length - 1) / 2;
  const reduction = 1 - result.pairChecks / bruteForcePairChecks;

  assert.equal(result.broadphase, "spatial");
  assert.equal(result.remainingOverlaps, 0);
  assert.equal(bruteForcePairChecks, 2556);
  assert.equal(result.pairChecks, 126);
  assert.ok(reduction > 0.95);
  console.log(
    `PERF pedestrian broadphase: ${bruteForcePairChecks} brute-force pairs -> ${result.pairChecks} local candidates (${(reduction * 100).toFixed(1)}% fewer)`
  );
  system.destroy();
}));

test("spatial broadphase still resolves a real pedestrian overlap", () => withPhaser(() => {
  const route = pedestrianRoutes.find(candidate => candidate.points?.length >= 2);
  const point = route.points[0];
  const npcs = [
    pedestrian("spatial-a", point.x, point.y, route.id),
    pedestrian("spatial-b", point.x, point.y, route.id)
  ];
  const scene = spatialScene(npcs);
  const system = new PedestrianSystem(scene);
  scene.npcSystem.rebuildSpatialIndex();
  const result = system.resolveCrowdCollisions({ iterations: 2, includePlayer: false });

  assert.equal(result.broadphase, "spatial");
  assert.equal(result.remainingOverlaps, 0);
  assert.ok(Math.hypot(npcs[0].x - npcs[1].x, npcs[0].y - npcs[1].y) >= 15.75);
  system.destroy();
}));
