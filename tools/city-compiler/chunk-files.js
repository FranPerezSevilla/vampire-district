import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildCityChunkManifest,
  chunkIdsForBounds,
  DEFAULT_CITY_CHUNK_SIZE,
  itemBounds
} from "../../phaser/src/streaming/CityChunkManifest.js";

function normalizedCollections(runtime = {}) {
  return {
    roads: runtime.roads || [],
    sidewalks: runtime.sidewalks || [],
    crosswalks: runtime.crosswalks || [],
    buildings: runtime.buildings || [],
    roofs: Object.values(runtime.roofAreas || {}).flat(),
    rooftopRoutes: runtime.rooftopRoutes || [],
    fireEscapes: runtime.fireEscapes || [],
    sewerTunnels: runtime.sewerTunnels || [],
    sewerAccesses: runtime.sewerAccesses || [],
    lights: runtime.lights || [],
    dumpsters: runtime.dumpsters || [],
    shadowZones: runtime.shadowZones || [],
    pedestrianRoutes: runtime.pedestrianRoutes || [],
    navigationPoints: runtime.streetNavigationPoints || [],
    vehicles: runtime.vehicles || []
  };
}

function stableItemId(category, item, index) {
  return String(item?.id || `${category}:${index}`);
}

export function buildCityChunkFileSet({
  id = "bloodnight-current-city-chunks",
  world,
  runtime,
  collections = normalizedCollections(runtime),
  chunkSize = DEFAULT_CITY_CHUNK_SIZE
} = {}) {
  const sourceManifest = buildCityChunkManifest({ id, world, collections, chunkSize });
  const payloads = Object.fromEntries(sourceManifest.chunkIds.map(chunkId => [chunkId, {
    schemaVersion: 1,
    id: chunkId,
    collections: {}
  }]));

  for (const [category, items] of Object.entries(collections)) {
    (items || []).forEach((item, index) => {
      const streamId = stableItemId(category, item, index);
      const normalized = item?.id ? item : { ...item, streamId };
      const bounds = itemBounds(category, item);
      for (const chunkId of chunkIdsForBounds(bounds, sourceManifest.world, sourceManifest.chunkSize)) {
        (payloads[chunkId].collections[category] ||= []).push(normalized);
      }
    });
  }

  const chunks = Object.fromEntries(sourceManifest.chunkIds.map(chunkId => {
    const source = sourceManifest.chunks[chunkId];
    return [chunkId, {
      id: source.id,
      column: source.column,
      row: source.row,
      bounds: source.bounds,
      neighbours: source.neighbours,
      file: `chunks/${source.column}-${source.row}.json`
    }];
  }));

  return {
    manifest: {
      schemaVersion: 1,
      version: 3,
      id,
      chunkSize: sourceManifest.chunkSize,
      columns: sourceManifest.columns,
      rows: sourceManifest.rows,
      world: sourceManifest.world,
      chunkIds: sourceManifest.chunkIds,
      chunks
    },
    payloads,
    collections
  };
}

export async function writeCityChunkFileSet(fileSet, outputDir) {
  const target = path.resolve(outputDir);
  await mkdir(path.join(target, "chunks"), { recursive: true });
  const writes = [
    writeFile(path.join(target, "manifest.json"), `${JSON.stringify(fileSet.manifest, null, 2)}\n`, "utf8")
  ];
  for (const [id, payload] of Object.entries(fileSet.payloads)) {
    const chunk = fileSet.manifest.chunks[id];
    writes.push(writeFile(path.join(target, chunk.file), `${JSON.stringify(payload, null, 2)}\n`, "utf8"));
  }
  await Promise.all(writes);
  return target;
}

export { normalizedCollections as currentCityChunkCollections };
