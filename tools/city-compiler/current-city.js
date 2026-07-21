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

function findBuilding(id) {
  const building = buildings.find(candidate => candidate.id === id);
  if (!building) throw new Error(`Current city landmark building is missing: ${id}`);
  return building;
}

function landmark(id, buildingId, districtId, requiredAccess = ["street"]) {
  const target = findBuilding(buildingId);
  return Object.freeze({
    id,
    buildingId,
    districtId,
    fixed: true,
    position: { x: target.x + target.w / 2, y: target.y + target.h / 2 },
    requiredAccess
  });
}

const world = Object.freeze({
  width: Math.max(...districtZones.map(zone => zone.x + zone.w)),
  height: Math.max(...districtZones.map(zone => zone.y + zone.h))
});

export const currentCityBlueprint = defineCityBlueprint({
  schemaVersion: 1,
  id: "bloodnight-current-city",
  seed: "bloodnight-current-city-v1",
  world,
  protectedZones: ["old-quarter"],
  districts: districtZones.map(zone => ({
    id: zone.id,
    name: zone.name,
    bounds: { x: zone.x, y: zone.y, w: zone.w, h: zone.h },
    recipeId: districtRecipeIds[zone.id],
    neighbours: [...(neighbours[zone.id] || [])],
    protected: zone.id === "old-quarter"
  })),
  landmarks: [
    landmark("refuge", "refugeTower", "old-quarter", ["street", "roof", "sewer"]),
    landmark("police-station", "police", "old-quarter", ["street", "roof", "alley"]),
    landmark("nightclub", "club", "old-quarter", ["street", "roof", "alley"]),
    landmark("church", "church", "old-quarter", ["street", "roof", "sewer"]),
    landmark("harbor-registry", "harborRegistry", "harbor-north", ["street"]),
    landmark("blackwater-terminal", "blackwaterTerminal", "blackwater", ["street", "sewer"])
  ],
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
    mode: "imported-authored-city",
    generatedAtRuntime: false,
    compilerStage: "foundation"
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
