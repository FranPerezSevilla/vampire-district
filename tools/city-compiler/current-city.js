import {
  buildings,
  crosswalks,
  districtZones,
  dumpsters,
  fireEscapes,
  lights,
  pedestrianRoutes,
  roads,
  roofAreas,
  rooftopRoutes,
  sewerAccesses,
  sewerTunnels,
  shadowZones,
  sidewalks,
  streetNavigationPoints
} from "../../phaser/src/data/district.js";
import { vehicleDefinitions } from "../../phaser/src/data/vehicles.js";
import { blockTemplates, districtRecipes } from "./catalog.js";
import { defineCityBlueprint } from "./model.js";

const districtRecipeIds = Object.freeze({
  "old-quarter": "old-quarter",
  glasshouse: "nightlife-commercial",
  foundry: "industrial-maze",
  "harbor-north": "harbor-logistics",
  "canal-west": "canal-mixed",
  "canal-east": "canal-mixed",
  blackwater: "blackwater-industrial",
  "harbor-south": "harbor-logistics"
});

const neighbours = Object.freeze({
  "old-quarter": ["glasshouse", "canal-west"],
  glasshouse: ["old-quarter", "foundry", "canal-east"],
  foundry: ["glasshouse", "harbor-north", "canal-east"],
  "harbor-north": ["foundry", "harbor-south"],
  "canal-west": ["old-quarter", "canal-east", "blackwater"],
  "canal-east": ["glasshouse", "foundry", "canal-west", "harbor-south", "blackwater"],
  blackwater: ["canal-west", "canal-east", "harbor-south"],
  "harbor-south": ["harbor-north", "canal-east", "blackwater"]
});

// These are observations about the imported control map, not permissions for
// future generation. The topology pass must remove them rather than preserving
// the original geometry around them.
const legacyBuildingRoadOverlaps = Object.freeze([
  "club:eastWestAvenue",
  "church:southServiceAlley",
  "warehouse:southServiceAlley",
  "warehouse:warehouseAlley",
  "shops:northSouthAvenue",
  "shops:southServiceAlley",
  "oldBlock:southServiceAlley",
  "canalMarketWest:eastBackLane",
  "glassSouth:eastBackLane",
  "blackwaterExchange:eastBackLane"
]);

const world = Object.freeze({
  width: Math.max(...districtZones.map(zone => zone.x + zone.w)),
  height: Math.max(...districtZones.map(zone => zone.y + zone.h))
});

export const currentCityBlueprint = defineCityBlueprint({
  schemaVersion: 2,
  id: "bloodnight-current-city",
  seed: "bloodnight-current-city-v2-unconstrained",
  world,
  // No district is protected because of retired mission coordinates. Future
  // landmarks will reserve flexible urban sites before roads are generated.
  protectedZones: [],
  districts: districtZones.map(zone => ({
    id: zone.id,
    name: zone.name,
    bounds: { x: zone.x, y: zone.y, w: zone.w, h: zone.h },
    recipeId: districtRecipeIds[zone.id],
    neighbours: [...(neighbours[zone.id] || [])],
    protected: false
  })),
  // The current buildings still render as the imported comparison baseline,
  // but none of them is a fixed compiler landmark. Police stations, hospitals,
  // churches and other landmarks will be reintroduced later as flexible sites.
  landmarks: [],
  recipes: districtRecipes,
  blockTemplates,
  runtime: {
    roads,
    sidewalks,
    crosswalks,
    buildings,
    roofAreas,
    rooftopRoutes,
    fireEscapes,
    sewerTunnels,
    sewerAccesses,
    lights,
    dumpsters,
    shadowZones,
    pedestrianRoutes,
    streetNavigationPoints,
    vehicles: vehicleDefinitions
  },
  metadata: {
    source: "phaser/src/data/district.js",
    mode: "imported-authored-city-unconstrained",
    generatedAtRuntime: false,
    compilerStage: "mission-constraints-retired",
    retiredNarrativeConstraints: [
      "silence_the_journalist",
      "clean_the_scene",
      "old-quarter-protection",
      "fixed-refuge-police-club-church-landmarks"
    ],
    futureLandmarkPolicy: {
      mode: "site-first",
      summary: "Landmarks reserve flexible polygonal sites; roads and pedestrian space adapt around them."
    },
    validationExceptions: {
      allowedBuildingRoadOverlaps: legacyBuildingRoadOverlaps,
      policy: "Imported overlap warnings describe current debt only. Generated candidates fail on every overlap."
    }
  }
});

export function currentCityManifest(blueprint = currentCityBlueprint) {
  const runtime = blueprint.runtime;
  const roofCount = Object.values(runtime.roofAreas || {}).reduce((sum, areas) => sum + areas.length, 0);
  return {
    schemaVersion: blueprint.schemaVersion,
    id: blueprint.id,
    seed: blueprint.seed,
    world: blueprint.world,
    protectedZones: blueprint.protectedZones,
    districts: blueprint.districts,
    landmarks: blueprint.landmarks,
    recipes: blueprint.recipes.map(recipe => ({ id: recipe.id, label: recipe.label, tags: recipe.tags })),
    blockTemplates: blueprint.blockTemplates.map(template => ({ id: template.id, family: template.family })),
    counts: {
      districts: blueprint.districts.length,
      roads: runtime.roads.length,
      sidewalks: runtime.sidewalks.length,
      crosswalks: runtime.crosswalks.length,
      buildings: runtime.buildings.length,
      roofs: roofCount,
      rooftopRoutes: runtime.rooftopRoutes.length,
      sewerTunnels: runtime.sewerTunnels.length,
      sewerAccesses: runtime.sewerAccesses.length,
      lights: runtime.lights.length,
      dumpsters: runtime.dumpsters.length,
      pedestrianRoutes: runtime.pedestrianRoutes.length,
      vehicles: runtime.vehicles.length
    },
    metadata: blueprint.metadata
  };
}
