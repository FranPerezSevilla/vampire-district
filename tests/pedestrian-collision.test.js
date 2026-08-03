import test from "node:test";
import assert from "node:assert/strict";

import { LAYERS, pedestrianRoutes } from "../phaser/src/data/district.js";
import { NPC_TYPES } from "../phaser/src/data/npcs.js";
import {
  PEDESTRIAN_MIN_SEPARATION,
  PedestrianSystem,
  minimumPedestrianSeparation,
  pedestrianSeparationPlan
} from "../phaser/src/systems/PedestrianSystem.js";

class TestEvents {
  constructor() {
    this.listeners = new Map();
  }

  on(name, listener) {
    const list = this.listeners.get(name) || [];
    list.push(listener);
    this.listeners.set(name, list);
  }

  once(name, listener) {
    const wrapped = (...args) => {
      this.off(name, wrapped);
      listener(...args);
    };
    this.on(name, wrapped);
  }

  off(name, listener) {
    const list = this.listeners.get(name) || [];
    this.listeners.set(name, list.filter(candidate => candidate !== listener));
  }

  emit(name, ...args) {
    for (const listener of [...(this.listeners.get(name) || [])]) listener(...args);
  }
}

function civilian(id, point, routeId) {
  return {
    id,
    type: NPC_TYPES.CIVILIAN,
    x: point.x,
    y: point.y,
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
    container: {
      setPosition() { return this; }
    }
  };
}

test("exactly overlapping pedestrians receive deterministic opposite separation", () => {
  const first = { id: "ped-a", x: 100, y: 100 };
  const second = { id: "ped-b", x: 100, y: 100 };
  const plan = pedestrianSeparationPlan(first, second);

  assert.ok(plan);
  assert.deepEqual(plan, pedestrianSeparationPlan(first, second));
  assert.ok(plan.overlap >= PEDESTRIAN_MIN_SEPARATION);

  const separated = [
    { x: first.x + plan.first.x, y: first.y + plan.first.y },
    { x: second.x + plan.second.x, y: second.y + plan.second.y }
  ];
  assert.ok(minimumPedestrianSeparation(separated) >= PEDESTRIAN_MIN_SEPARATION);
});

test("the runtime removes pedestrian spawn stacking and keeps the crowd overlap-free", () => {
  const route = pedestrianRoutes.find(candidate => candidate.points?.length >= 2);
  assert.ok(route);
  const point = route.points[0];
  const npcs = [
    civilian("stacked-a", point, route.id),
    civilian("stacked-b", point, route.id)
  ];
  let rebuilds = 0;
  const events = new TestEvents();
  const scene = {
    currentLayer: LAYERS.STREET,
    player: { id: "player", x: point.x + 200, y: point.y + 200, layer: LAYERS.STREET },
    npcSystem: {
      npcs,
      canNpcStandAt: () => true,
      rebuildSpatialIndex: () => { rebuilds++; }
    },
    registry: { get: () => false },
    events,
    statePublisher: { setMany: () => {} }
  };
  const previousPhaser = globalThis.Phaser;
  globalThis.Phaser = {
    Scenes: {
      Events: {
        POST_UPDATE: "postupdate",
        SHUTDOWN: "shutdown"
      }
    }
  };

  try {
    const system = new PedestrianSystem(scene);
    const snapshot = system.snapshot();

    assert.equal(snapshot.crowd.overlaps, 0);
    assert.ok(snapshot.crowd.minimumSeparation >= PEDESTRIAN_MIN_SEPARATION - 0.25);
    assert.ok(rebuilds > 0);

    npcs[1].x = npcs[0].x;
    npcs[1].y = npcs[0].y;
    events.emit("postupdate");
    assert.equal(system.snapshot().crowd.overlaps, 0);

    system.destroy();
  } finally {
    globalThis.Phaser = previousPhaser;
  }
});
