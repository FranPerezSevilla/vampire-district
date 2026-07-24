import test from "node:test";
import assert from "node:assert/strict";

import { currentCityBlueprint } from "../tools/city-compiler/current-city.js";
import { buildCityChunkFileSet } from "../tools/city-compiler/chunk-files.js";
import { ChunkDeltaStore } from "../phaser/src/streaming/ChunkDeltaStore.js";
import { ChunkFileStore } from "../phaser/src/streaming/ChunkFileStore.js";
import { ChunkSpatialIndex } from "../phaser/src/streaming/ChunkSpatialIndex.js";
import {
  ChunkStreamSystem,
  CHUNK_LOAD_STATES,
  CHUNK_STREAM_STATES
} from "../phaser/src/streaming/ChunkStreamSystem.js";

const fileSet = buildCityChunkFileSet({
  id: "bloodnight-current-city-chunks",
  world: currentCityBlueprint.world,
  runtime: currentCityBlueprint.runtime
});

function fakeScene(x = 100, y = 100) {
  return {
    player: { x, y },
    campaignSystem: { state: { world: { flags: {} } } },
    renderFocus() { return this.player; },
    statePublisher: { setMany() {} },
    events: { once() {} },
    redrawLayer() {},
    npcSystem: { npcs: [], rebuildSpatialIndex() {} },
    evidenceSystem: { bloodStains: [] },
    propDamageSystem: { props: [] },
    streetFurnitureSystem: { dumpsters: [] },
    vehicleSystem: { vehicles: [], currentVehicle() { return null; } }
  };
}

class MemoryChunkFileStore {
  constructor(set, cacheLimit = 12) {
    this.manifest = set.manifest;
    this.payloads = set.payloads;
    this.cache = new Map();
    this.inFlight = new Map();
    this.cacheLimit = cacheLimit;
    this.requests = [];
    this.stats = { manifestRequests: 0, chunkRequests: 0, cacheHits: 0, retries: 0, cancellations: 0, failures: 0, evictions: 0 };
  }

  loadManifest() { return Promise.resolve(this.manifest); }
  has(id) { return this.cache.has(String(id)); }
  peek(id) { return this.cache.get(String(id)) || null; }
  loadChunk(id) {
    const key = String(id);
    if (this.cache.has(key)) {
      this.stats.cacheHits++;
      return Promise.resolve(this.cache.get(key));
    }
    this.stats.chunkRequests++;
    this.requests.push(key);
    const payload = this.payloads[key];
    this.cache.set(key, payload);
    return Promise.resolve(payload);
  }
  cancelExcept() { return []; }
  trim(retainedIds = []) {
    const retained = new Set(retainedIds);
    const evicted = [];
    while (this.cache.size > this.cacheLimit) {
      const id = [...this.cache.keys()].find(candidate => !retained.has(candidate));
      if (!id) break;
      this.cache.delete(id);
      this.stats.evictions++;
      evicted.push(id);
    }
    return evicted;
  }
  snapshot() { return { cached: [...this.cache.keys()], inFlight: [], stats: { ...this.stats } }; }
  destroy() { this.cache.clear(); }
}

test("City Compiler emits a deterministic ten-by-eight asynchronous chunk set", () => {
  const manifest = fileSet.manifest;
  assert.equal(manifest.version, 3);
  assert.equal(manifest.columns, 10);
  assert.equal(manifest.rows, 8);
  assert.equal(manifest.chunkIds.length, 80);
  assert.equal(manifest.chunks["9:7"].bounds.w, 192);
  assert.equal(manifest.chunks["9:7"].bounds.h, 16);
  assert.equal(manifest.chunks["7:0"].file, "chunks/7-0.json");
  assert.equal(Object.keys(fileSet.payloads).length, 80);
  assert.ok(fileSet.payloads["0:0"].collections.buildings.some(item => item.id === "hospital"));
  assert.ok(fileSet.payloads["2:4"].collections.buildings.some(item => item.id === "foundry:block-02:west-works"));
  assert.ok(Object.values(fileSet.payloads).some(payload => (payload.collections.propExclusionZones || []).length > 0));
});

test("incremental chunk index deduplicates cloned cross-boundary records by stable stream id", () => {
  const manifest = fileSet.manifest;
  const index = new ChunkSpatialIndex(manifest);
  const longRoad = { id: "long", streamId: "long", x: 480, y: 200, w: 100, h: 40 };
  index.hydrateChunk("0:0", { roads: [{ ...longRoad }] });
  index.hydrateChunk("1:0", { roads: [{ ...longRoad }] });

  assert.equal(index.query("roads", { x: 450, y: 150, w: 180, h: 120 }).length, 1);
  assert.equal(index.count("roads", ["0:0", "1:0"]), 1);
  index.evictChunk("0:0");
  assert.equal(index.query("roads", { x: 450, y: 150, w: 180, h: 120 }).length, 1);
});

test("asynchronous stream activates only the configured number of payloads per frame", async () => {
  const store = new MemoryChunkFileStore(fileSet, 80);
  const system = new ChunkStreamSystem(fakeScene(), {
    manifest: fileSet.manifest,
    fileStore: store,
    activationBudget: 1
  });
  await system.initialization;
  await Promise.all([...system.desiredChunkIds()].map(id => system.requestChunk(id)));

  assert.equal(system.snapshot().residentChunkIds.length, 0);
  assert.ok(system.snapshot().activationQueue.length >= 9);
  system.processActivationQueue();
  assert.equal(system.snapshot().residentChunkIds.length, 1);
  system.processActivationQueue();
  assert.equal(system.snapshot().residentChunkIds.length, 2);
  assert.equal(system.snapshot().activationBudget, 1);
  system.destroy();
});

test("focus changes cancel stale authority, use LRU payloads and preserve state transitions", async () => {
  const store = new MemoryChunkFileStore(fileSet, 10);
  const system = new ChunkStreamSystem(fakeScene(), {
    manifest: fileSet.manifest,
    fileStore: store,
    dormantRetention: 1,
    activationBudget: 3
  });
  await system.forceFocus(100, 100);
  assert.equal(system.stateOf("0:0"), CHUNK_STREAM_STATES.ACTIVE);
  assert.equal(system.loadStateOf("0:0"), CHUNK_LOAD_STATES.RESIDENT);

  await system.forceFocus(4790, 3590, 900, 0);
  assert.equal(system.stateOf("9:7"), CHUNK_STREAM_STATES.ACTIVE);
  assert.equal(system.isPointReady(4790, 3590), true);
  system.updateFocus(4790, 3590, { force: true });
  assert.equal(system.stateOf("0:0"), CHUNK_STREAM_STATES.UNLOADED);
  assert.ok(store.stats.evictions > 0);
  system.destroy();
});

test("HTTP chunk store retries transient failures, cancels stale requests and trims LRU entries", async () => {
  const manifest = {
    id: "test",
    chunkIds: ["0:0"],
    chunks: { "0:0": { file: "chunks/0-0.json" } }
  };
  let attempts = 0;
  const fetchImpl = async url => {
    if (String(url).endsWith("manifest.json")) return { ok: true, json: async () => manifest };
    attempts++;
    if (attempts === 1) return { ok: false, status: 503, json: async () => ({}) };
    return { ok: true, json: async () => ({ id: "0:0", collections: { roads: [] } }) };
  };
  const store = new ChunkFileStore({
    manifestUrl: "https://example.test/city/manifest.json",
    fetchImpl,
    retryDelayMs: 0,
    maxRetries: 1,
    cacheLimit: 2
  });
  await store.loadManifest();
  await store.loadChunk("0:0");
  assert.equal(store.stats.retries, 1);
  assert.equal(store.has("0:0"), true);
  store.touch("1:0", { id: "1:0" });
  store.touch("2:0", { id: "2:0" });
  assert.deepEqual(store.trim(new Set(["2:0"])), ["0:0"]);

  const aborting = new ChunkFileStore({
    manifestUrl: "https://example.test/city/manifest.json",
    fetchImpl: (url, { signal } = {}) => {
      if (String(url).endsWith("manifest.json")) return Promise.resolve({ ok: true, json: async () => manifest });
      return new Promise((resolve, reject) => signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      }, { once: true }));
    }
  });
  await aborting.loadManifest();
  const pending = aborting.loadChunk("0:0");
  assert.deepEqual(aborting.cancelExcept(new Set()), ["0:0"]);
  await assert.rejects(pending, error => error.name === "AbortError");
  assert.equal(aborting.stats.cancellations, 1);
  aborting.destroy();
});

test("chunk delta serialization indexes bodies, evidence, broken props and vehicles without a second save authority", () => {
  const scene = fakeScene();
  scene.npcSystem.npcs = [{ id: "body", x: 100, y: 100, layer: 0, dead: true, hiddenBody: false }];
  scene.evidenceSystem.bloodStains = [{ id: 1, x: 120, y: 110, layer: 0, kind: "blood", age: 2, life: 70 }];
  scene.streetFurnitureSystem.dumpsters = [{ id: "dump", x: 140, y: 120, broken: true }];
  scene.vehicleSystem.vehicles = [{ id: "car", x: 160, y: 130, angle: 0.2, health: 50, parked: true }];
  const store = new ChunkDeltaStore(scene, fileSet.manifest);
  const delta = store.captureChunk("0:0");

  assert.equal(delta.bodies.length, 1);
  assert.equal(delta.evidence.length, 1);
  assert.equal(delta.streetProps.length, 1);
  assert.equal(delta.vehicles.length, 1);
  assert.deepEqual(store.snapshot().domains, { bodies: 1, evidence: 1, streetProps: 1, vehicles: 1 });
  assert.equal(scene.campaignSystem.state.world.flags["cityChunkDelta.0:0"].chunkId, "0:0");
  store.destroy();
});
