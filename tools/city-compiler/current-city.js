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
  propExclusionZones,
  roadGraphNodes,
  roadGraphEdges,
  roadCorridors,
  roads,
  roadJunctions,
  roadTransitions,
  junctionSidewalks,
  roofAreas,
  rooftopRoutes,
  sewerAccesses,
  sewerTunnels,
  shadowZones,
  sidewalks,
  streetNavigationPoints,
  CITY_TOPOLOGY_SEED,
  CITY_TOPOLOGY_STATS,
  CITY_TOPOLOGY_VERSION,
  ROAD_GEOMETRY_VERSION,
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
  seed: CITY_TOPOLOGY_SEED,
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
    roadGraphNodes,
    roadGraphEdges,
    roadJunctions,
    roadTransitions,
    sidewalks,
    junctionSidewalks,
    crosswalks,
    propExclusionZones,
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
    roadGeometryVersion: ROAD_GEOMETRY_VERSION,
    topologyStats: CITY_TOPOLOGY_STATS,
    roadCorridors,
    roadGraphAuthority: "tools/city-compiler/city-road-graph-v1.js",
    roadGenerationOrder: ["landmarks-buildings", "graph", "junctions", "segments", "junction-owned-sidewalks", "crosswalks", "prop-exclusion-zones", "lights", "dumpsters", "pedestrian-routes", "navigation", "chunks"],
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
      roadGraphNodes: runtime.roadGraphNodes.length,
      roadGraphEdges: runtime.roadGraphEdges.length,
      roadJunctions: runtime.roadJunctions.length,
      roadTransitions: runtime.roadTransitions.length,
      roadCorridors: blueprint.metadata.roadCorridors.length,
      sidewalks: runtime.sidewalks.length,
      junctionSidewalks: runtime.junctionSidewalks.length,
      crosswalks: runtime.crosswalks.length,
      propExclusionZones: runtime.propExclusionZones.length,
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
