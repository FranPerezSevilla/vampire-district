import test from "node:test";
import assert from "node:assert/strict";

import { NPC_TYPES } from "../phaser/src/data/npcs.js";
import { DistrictPackSystem, DISTRICT_PACK_STATES } from "../phaser/src/streaming/DistrictPackSystem.js";
import { DistantSimulationSystem } from "../phaser/src/streaming/DistantSimulationSystem.js";
import { ENTITY_STREAM_STATES } from "../phaser/src/streaming/EntityStreamPolicy.js";

function fakePublisher() {
  return { setMany() {} };
}

function fakeRegistry() {
  const values = new Map();
  return {
    get(key) { return values.get(key); },
    set(key, value) { values.set(key, value); }
  };
}

test("district packs prioritize the active district and prefetch the road-ahead district", async () => {
  const manifest = {
    id: "pack-test",
    packIds: ["west", "east"],
    packs: {
      west: {
        id: "west",
        bounds: { x: 0, y: 0, w: 500, h: 500 },
        chunkIds: ["0:0"],
        file: "west.json",
        priority: 10
      },
      east: {
        id: "east",
        bounds: { x: 500, y: 0, w: 500, h: 500 },
        chunkIds: ["1:0"],
        file: "east.json",
        priority: 10
      }
    }
  };
  const packs = {
    west: { id: "west", name: "West", simulation: { pedestrianDensity: 1 } },
    east: { id: "east", name: "East", simulation: { pedestrianDensity: 0.5 } }
  };
  const fetchImpl = async url => {
    const value = String(url);
    if (value.endsWith("manifest.json")) return { ok: true, json: async () => manifest };
    const id = value.endsWith("east.json") ? "east" : "west";
    return { ok: true, json: async () => packs[id] };
  };
  const vehicle = { x: 120, y: 120, velocityX: 320, velocityY: 0 };
  const scene = {
    player: { x: 120, y: 120 },
    renderFocus() { return vehicle; },
    vehicleSystem: { currentVehicle() { return vehicle; } },
    cityStreamSystem: {
      manifest: { chunkSize: 512 },
      activeChunkIds: new Set(["0:0"]),
      prefetchedChunkIds: new Set(["1:0"]),
      desiredChunkIds() { return new Set(["0:0"]); },
      query(category) {
        return category === "roads"
          ? [{ id: "east-road", x: 0, y: 90, w: 1000, h: 60 }]
          : [];
      }
    },
    statePublisher: fakePublisher(),
    registry: fakeRegistry(),
    events: { once() {} }
  };

  const system = new DistrictPackSystem(scene, {
    manifestUrl: "https://example.test/packs/manifest.json",
    fetchImpl,
    activationBudget: 1,
    cacheLimit: 2
  });
  await system.initialization;
  await Promise.all([...system.inFlight.values()].map(request => request.promise));

  system.update(true);
  let snapshot = system.snapshot();
  assert.equal(snapshot.activePackId, "west");
  assert.equal(snapshot.predictivePackId, "east");
  assert.equal(snapshot.states.resident.includes("west"), true);
  assert.equal(snapshot.states.queued.includes("east"), true);
  assert.equal(snapshot.activationBudget, 1);

  system.update();
  snapshot = system.snapshot();
  assert.equal(snapshot.states.resident.includes("east"), true);
  assert.equal(snapshot.counts.resident, 2);
  assert.equal(system.record("west").state, DISTRICT_PACK_STATES.RESIDENT);
  system.destroy();
});

test("distant simulation advances dormant pedestrians without updating Phaser containers", () => {
  let containerMoves = 0;
  const pedestrian = {
    id: "macro-walker",
    type: NPC_TYPES.CIVILIAN,
    x: 300,
    y: 280,
    layer: 0,
    speed: 9,
    dead: false,
    inactive: false,
    hiddenBody: false,
    dragged: false,
    intercepted: false,
    alarmed: false,
    chasingPlayer: false,
    enemyAttack: null,
    stunnedTimer: 0,
    streamState: ENTITY_STREAM_STATES.DORMANT,
    pedestrian: {
      routeId: "core_market_loop",
      pointIndex: 1,
      wait: 0,
      completedSegments: 0
    },
    container: { setPosition() { containerMoves++; } }
  };
  const scene = {
    cityStreamSystem: { manifest: { chunkSize: 512 } },
    entityStreamSystem: {},
    pedestrianSystem: { pedestrians: [pedestrian] },
    npcSystem: { npcs: [pedestrian] },
    vehicleSystem: { vehicles: [] },
    registry: fakeRegistry(),
    statePublisher: fakePublisher(),
    events: { once() {} }
  };

  const system = new DistantSimulationSystem(scene, {
    intervalSeconds: 1,
    entityBudget: 4
  });
  const before = { x: pedestrian.x, y: pedestrian.y };
  const advanced = system.simulateTick(5);
  const snapshot = system.snapshot();

  assert.equal(advanced, 1);
  assert.ok(pedestrian.x > before.x || pedestrian.y !== before.y);
  assert.equal(containerMoves, 0);
  assert.equal(snapshot.tick, 1);
  assert.equal(snapshot.dormantPedestrians, 1);
  assert.equal(snapshot.lastAdvancedIds.includes("macro-walker"), true);
  assert.equal(snapshot.byChunk["0:0"].dormantNpcs, 1);
  system.destroy();
});
