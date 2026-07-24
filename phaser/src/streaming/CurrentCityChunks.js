import { WORLD } from "../data/balance.js";
import {
  buildings,
  crosswalks,
  dumpsters,
  fireEscapes,
  lights,
  pedestrianRoutes,
  propExclusionZones,
  roads,
  roofAreas,
  rooftopRoutes,
  sewerAccesses,
  sewerTunnels,
  shadowZones,
  sidewalks,
  streetNavigationPoints
} from "../data/district.js";
import { vehicleDefinitions } from "../data/vehicles.js";
import { buildCityChunkManifest, DEFAULT_CITY_CHUNK_SIZE } from "./CityChunkManifest.js";
import { ChunkSpatialIndex } from "./ChunkSpatialIndex.js";

export const currentCityChunkCollections = Object.freeze({
  roads,
  sidewalks,
  crosswalks,
  propExclusionZones,
  buildings,
  roofs: Object.freeze(Object.values(roofAreas || {}).flat()),
  rooftopRoutes,
  fireEscapes,
  sewerTunnels,
  sewerAccesses,
  lights,
  dumpsters,
  shadowZones,
  pedestrianRoutes,
  navigationPoints: streetNavigationPoints,
  vehicles: vehicleDefinitions
});

export const currentCityChunkManifest = buildCityChunkManifest({
  id: "bloodnight-current-city-chunks",
  world: { width: WORLD.width, height: WORLD.height },
  chunkSize: DEFAULT_CITY_CHUNK_SIZE,
  collections: currentCityChunkCollections
});

export function createCurrentCityChunkIndex() {
  return new ChunkSpatialIndex(currentCityChunkManifest, currentCityChunkCollections);
}
