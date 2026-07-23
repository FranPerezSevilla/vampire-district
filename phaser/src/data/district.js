import {
  CITY_TOPOLOGY_SEED,
  CITY_TOPOLOGY_STATS,
  CITY_TOPOLOGY_VERSION,
  CITY_WORLD,
  CITY_ANCHORS,
  landmarkSites,
  roadCorridors,
  roads,
  sidewalks,
  crosswalks,
  buildings,
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
  CITY_TOPOLOGY_STATS,
  CITY_TOPOLOGY_VERSION,
  CITY_WORLD,
  CITY_ANCHORS,
  landmarkSites,
  roadCorridors,
  roads,
  sidewalks,
  crosswalks,
  buildings,
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

export function pointOnPedestrianSurface(x, y) {
  return sidewalks.some(area => pointInRect(x, y, area))
    || crosswalks.some(area => pointInRect(x, y, area));
}

export function districtZoneAt(x, y) {
  return districtZones.find(zone => pointInRect(x, y, zone)) || districtZones[0];
}
