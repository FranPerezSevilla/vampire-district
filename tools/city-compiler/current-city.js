import {
  buildings,
  crosswalks,
  districtZoneAt,
  districtZones,
  dumpsters,
  fireEscapes,
  landmarkSites,
  lights,
  pedestrianRoutes,
  roadCorridors,
  roads,
  roofAreas,
  rooftopRoutes,
  sewerAccesses,
  sewerTunnels,
  shadowZones,
  sidewalks,
  streetNavigationPoints,
  CITY_TOPOLOGY_STATS,
  CITY_TOPOLOGY_VERSION,
  CITY_WORLD
} from "../../phaser/src/data/district.js";
import { vehicleDefinitions } from "../../phaser/src/data/vehicles.js";
import { blockTemplates, districtRecipes } from "./catalog.js";
import { defineCityBlueprint } from "./model.js";

const accessByLandmark = Object.freeze({
  hospital: ["street", "roof", "sewer"],
  police: ["street", "roof"],
  cityHall: ["street", "roof"],
  cathedral: ["street", "roof", "sewer"],
  university: ["street", "roof"],
  refugeTower: ["street", "roof", "sewer"],
  club: ["street", "roof", "alley"]
});

function siteLandmark(site) {
  const buildingId = String(site.landmarkId || "");
  const point = { x: site.x + site.w / 2, y: site.y + site.h / 2 };
  return Object.freeze({
    id: buildingId,
    buildingId,
    districtId: districtZoneAt(point.x, point.y).id,
    fixed: false,
    siteFirst: true,
    movable: true,
    position: point,
    reservedSite: { x: site.x, y: site.y, w: site.w, h: site.h },
    requiredAccess: [...(accessByLandmark[buildingId] || ["street"])]
  });
}

export const currentCityBlueprint = defineCityBlueprint({
  schemaVersion: 2,
  id: "bloodnight-city-topology-v2",
  seed: "city-topology-v2-site-first",
  world: CITY_WORLD,
  protectedZones: [],
  districts: districtZones.map(zone => ({
    id: zone.id,
    name: zone.name,
    bounds: { x: zone.x, y: zone.y, w: zone.w, h: zone.h },
    recipeId: zone.recipeId,
    neighbours: [...(zone.neighbours || [])],
    protected: false
  })),
  landmarks: landmarkSites.map(siteLandmark),
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
    source: "phaser/src/data/generated/city-topology-v2.js",
    mode: "generated-site-first-city",
    generatedAtRuntime: false,
    compilerStage: "topology-v2",
    topologyVersion: CITY_TOPOLOGY_VERSION,
    topologyStats: CITY_TOPOLOGY_STATS,
    roadCorridors,
    landmarkPolicy: "Reserve large landmark sites first; route roads around sites; author missions only after topology acceptance.",
    validationExceptions: {
      allowedBuildingRoadOverlaps: [],
      policy: "City Topology V2 has no grandfathered building-road overlaps."
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
      roadCorridors: blueprint.metadata.roadCorridors.length,
      sidewalks: runtime.sidewalks.length,
      crosswalks: runtime.crosswalks.length,
      buildings: runtime.buildings.length,
      landmarkSites: blueprint.landmarks.length,
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
