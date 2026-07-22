import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCityChunkManifest,
  chunkIdAt,
  chunkIdsForBounds,
  DEFAULT_CITY_CHUNK_SIZE
} from "../phaser/src/streaming/CityChunkManifest.js";
import { ChunkSpatialIndex } from "../phaser/src/streaming/ChunkSpatialIndex.js";
import { ChunkStreamSystem, CHUNK_STREAM_STATES } from "../phaser/src/streaming/ChunkStreamSystem.js";
import {
  createCurrentCityChunkIndex,
  currentCityChunkCollections,
  currentCityChunkManifest
} from "../phaser/src/streaming/CurrentCityChunks.js";

function fakeScene(x = 100, y = 100) {
  return {
    player: { x, y },
    renderFocus() { return this.player; },
    statePublisher: { setMany() {} },
    events: { once() {} }
  };
}

test("current city compiles into a deterministic five-by-three chunk grid", () => {
  assert.equal(DEFAULT_CITY_CHUNK_SIZE, 512);
  assert.equal(currentCityChunkManifest.columns, 5);
  assert.equal(currentCityChunkManifest.rows, 3);
  assert.equal(currentCityChunkManifest.chunkIds.length, 15);
  assert.equal(currentCityChunkManifest.chunks["4:2"].bounds.w, 352);
  assert.equal(currentCityChunkManifest.chunks["4:2"].bounds.h, 416);
  assert.equal(chunkIdAt(1688, 338), "3:0");
  assert.deepEqual(
    chunkIdsForBounds({ x: 500, y: 500, w: 40, h: 40 }, currentCityChunkManifest.world),
    ["0:0", "1:0", "0:1", "1:1"]
  );
});

test("manifest records long geometry in every touched chunk", () => {
  const darkness = currentCityChunkManifest.chunkIds.filter(id => (
    currentCityChunkManifest.chunks[id].itemIds.shadowZones || []
  ).includes("districtDarkness"));
  assert.equal(darkness.length, currentCityChunkManifest.chunkIds.length);

  const foundry = currentCityChunkManifest.chunkIds.filter(id => (
    currentCityChunkManifest.chunks[id].itemIds.buildings || []
  ).includes("foundry:block-02:west-works"));
  assert.deepEqual(foundry, ["3:0"]);
});

test("chunk spatial index deduplicates cross-chunk geometry", () => {
  const world = { width: 1200, height: 600 };
  const road = { id: "long-road", x: 100, y: 200, w: 1000, h: 80 };
  const building = { id: "building", x: 700, y: 100, w: 100, h: 100 };
  const collections = { roads: [road], buildings: [building] };
  const manifest = buildCityChunkManifest({ world, collections, chunkSize: 512 });
  const index = new ChunkSpatialIndex(manifest, collections);

  assert.equal(index.query("roads", { x: 0, y: 0, w: 1200, h: 600 }).length, 1);
  assert.deepEqual(index.query("buildings", { x: 650, y: 50, w: 200, h: 200 }), [building]);
  assert.equal(index.query("buildings", { x: 0, y: 0, w: 200, h: 200 }).length, 0);
});

test("stream authority maintains active, prefetched, dormant and unloaded states", () => {
  const system = new ChunkStreamSystem(fakeScene(), { dormantRetention: 1 });
  let snapshot = system.snapshot();
  assert.equal(snapshot.centerChunkId, "0:0");
  assert.equal(snapshot.counts.active, 4);
  assert.equal(snapshot.counts.prefetched, 5);
  assert.equal(snapshot.counts.unloaded, 6);

  system.updateFocus(2390, 1400, { force: true });
  snapshot = system.snapshot();
  assert.equal(snapshot.centerChunkId, "4:2");
  assert.equal(snapshot.counts.active, 4);
  assert.equal(snapshot.counts.prefetched, 5);
  assert.ok(snapshot.counts.dormant >= 2);
  assert.equal(system.stateOf("4:2"), CHUNK_STREAM_STATES.ACTIVE);
  assert.equal(system.isPointActive(2390, 1400), true);
  assert.equal(system.isPointActive(100, 100), false);

  system.updateFocus(2390, 1400, { force: true });
  assert.equal(system.stateOf("0:0"), CHUNK_STREAM_STATES.UNLOADED);
  system.destroy();
});

test("vehicle velocity adds forward chunks to the prefetch set", () => {
  const system = new ChunkStreamSystem(fakeScene());
  system.updateFocus(100, 100, { velocityX: 1000, velocityY: 0, force: true });
  const snapshot = system.snapshot();
  assert.ok(snapshot.states.prefetched.includes("3:0"));
  assert.equal(snapshot.states.active.includes("3:0"), false);
  system.destroy();
});

test("active chunk queries return local city data instead of global collections", () => {
  const scene = fakeScene(100, 100);
  const system = new ChunkStreamSystem(scene, { index: createCurrentCityChunkIndex() });
  const bounds = { x: 0, y: 0, w: 500, h: 500 };
  const localBuildings = system.query("buildings", bounds);
  assert.ok(localBuildings.length > 0);
  assert.ok(localBuildings.length < currentCityChunkCollections.buildings.length);
  assert.ok(localBuildings.some(item => item.id === "refugeTower"));
  assert.equal(localBuildings.some(item => item.id === "harborRegistry"), false);

  const inspected = system.inspectBounds(bounds);
  assert.equal(inspected.buildings, localBuildings.length);
  assert.ok(inspected.roads > 0);
  system.destroy();
});
