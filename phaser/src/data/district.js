import { fitBuildingToSidewalks } from "./BuildingSidewalkClearance.js";
import {
  CITY_TOPOLOGY_SEED,
  CITY_TOPOLOGY_STATS,
  CITY_TOPOLOGY_VERSION,
  ROAD_GEOMETRY_VERSION,
  CITY_WORLD,
  CITY_ANCHORS,
  landmarkSites,
  roadGraphNodes,
  roadGraphEdges,
  roadCorridors,
  roads,
  roadSegments,
  roadJunctions,
  roadTransitions,
  sidewalks,
  junctionSidewalks,
  crosswalks,
  propExclusionZones,
  buildings as generatedBuildings,
  roofAreas,
  rooftopRoutes,
  roofDrops,
  fireEscapes,
  sewerTunnels,
  sewerAccesses,
  lights,
  dumpsters,
  bodyHideSpots,
  shadowZones,
  pedestrianRoutes,
  streetNavigationPoints,
  districtZones,
  policeStation,
  policePatrolRoutes,
  districtEntryPoints,
  policeLocalZones
} from "./generated/city-topology-v2.js";

export const buildings = Object.freeze(
  generatedBuildings.map(building => fitBuildingToSidewalks(building, sidewalks))
);

export const LAYERS = Object.freeze({
  SEWER: -1,
  STREET: 0,
  ROOF_LOW: 1,
  ROOF_HIGH: 2
});

export const LAYER_NAMES = Object.freeze({
  [-1]: "Sewers",
  [0]: "Street",
  [1]: "Low rooftops",
  [2]: "High rooftop refuge"
});

export const SELECTED_CITY_CANDIDATE = CITY_TOPOLOGY_SEED;

export {
  CITY_TOPOLOGY_SEED,
  CITY_TOPOLOGY_STATS,
  CITY_TOPOLOGY_VERSION,
  ROAD_GEOMETRY_VERSION,
  CITY_WORLD,
  CITY_ANCHORS,
  landmarkSites,
  roadGraphNodes,
  roadGraphEdges,
  roadCorridors,
  roads,
  roadSegments,
  roadJunctions,
  roadTransitions,
  sidewalks,
  junctionSidewalks,
  crosswalks,
  propExclusionZones,
  roofAreas,
  rooftopRoutes,
  roofDrops,
  fireEscapes,
  sewerTunnels,
  sewerAccesses,
  lights,
  dumpsters,
  bodyHideSpots,
  shadowZones,
  pedestrianRoutes,
  streetNavigationPoints,
  districtZones,
  policeStation,
  policePatrolRoutes,
  districtEntryPoints,
  policeLocalZones
};

function pointInRect(x, y, area) {
  return x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h;
}

function pointInPolygon(x, y, points = []) {
  let inside = false;
  for (let current = 0, previous = points.length - 1; current < points.length; previous = current++) {
    const a = points[current];
    const b = points[previous];
    const crosses = ((a.y > y) !== (b.y > y))
      && x < ((b.x - a.x) * (y - a.y)) / ((b.y - a.y) || Number.EPSILON) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function pointInCitySurface(x, y, area) {
  return Array.isArray(area?.points) && area.points.length >= 3
    ? pointInPolygon(x, y, area.points)
    : pointInRect(x, y, area);
}

function pointInsideWorld(x, y) {
  const width = Number(CITY_WORLD?.width ?? CITY_WORLD?.w) || 0;
  const height = Number(CITY_WORLD?.height ?? CITY_WORLD?.h) || 0;
  const originX = Number(CITY_WORLD?.x) || 0;
  const originY = Number(CITY_WORLD?.y) || 0;
  return width > 0 && height > 0
    ? x >= originX && x <= originX + width && y >= originY && y <= originY + height
    : true;
}

export function pointOnRoadSurface(x, y) {
  return roads.some(area => pointInCitySurface(x, y, area))
    || roadSegments.some(area => pointInCitySurface(x, y, area))
    || roadJunctions.some(area => pointInCitySurface(x, y, area))
    || roadTransitions.some(area => pointInCitySurface(x, y, area));
}

export function pointInsideBuilding(x, y) {
  return buildings.some(area => pointInCitySurface(x, y, area));
}

export function pointOnPedestrianSurface(x, y) {
  if (!pointInsideWorld(x, y) || pointInsideBuilding(x, y)) return false;
  if (crosswalks.some(area => pointInCitySurface(x, y, area))) return true;
  if (sidewalks.some(area => pointInCitySurface(x, y, area))) return true;
  return !pointOnRoadSurface(x, y);
}

export function pointOnPanicEscapeSurface(x, y) {
  return pointInsideWorld(x, y) && !pointInsideBuilding(x, y);
}

export function districtZoneAt(x, y) {
  return districtZones.find(zone => pointInRect(x, y, zone)) || districtZones[0];
}
