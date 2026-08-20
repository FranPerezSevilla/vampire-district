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
  pedestrianRoutes as generatedPedestrianRoutes,
  streetNavigationPoints as generatedStreetNavigationPoints,
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

function freezePedestrianRoute(route) {
  return Object.freeze({
    ...route,
    points: Object.freeze(route.points.map(point => Object.freeze({ ...point })))
  });
}

const EXTRA_PEDESTRIAN_ROUTES = Object.freeze([
  freezePedestrianRoute({
    id: "hospital_perimeter_loop",
    name: "Hospital north perimeter loop",
    points: [
      { x: 250, y: 143 },
      { x: 830, y: 143 },
      { x: 830, y: 153 },
      { x: 250, y: 153 }
    ],
    sidewalkId: "sidewalk:road-edge:h:162:202:918:202:north",
    graphEdgeId: "road-edge:h:162:202:918:202",
    routeKind: "hospital-access",
    generated: false
  }),
  freezePedestrianRoute({
    id: "hospital_west_access_loop",
    name: "Hospital west visitor circulation",
    points: [
      { x: 270, y: 143 },
      { x: 420, y: 143 },
      { x: 420, y: 153 },
      { x: 270, y: 153 }
    ],
    sidewalkId: "sidewalk:road-edge:h:162:202:918:202:north",
    graphEdgeId: "road-edge:h:162:202:918:202",
    routeKind: "hospital-access",
    generated: false
  }),
  freezePedestrianRoute({
    id: "hospital_central_access_loop",
    name: "Hospital central visitor circulation",
    points: [
      { x: 450, y: 143 },
      { x: 610, y: 143 },
      { x: 610, y: 153 },
      { x: 450, y: 153 }
    ],
    sidewalkId: "sidewalk:road-edge:h:162:202:918:202:north",
    graphEdgeId: "road-edge:h:162:202:918:202",
    routeKind: "hospital-access",
    generated: false
  }),
  freezePedestrianRoute({
    id: "hospital_east_access_loop",
    name: "Hospital east visitor circulation",
    points: [
      { x: 650, y: 143 },
      { x: 810, y: 143 },
      { x: 810, y: 153 },
      { x: 650, y: 153 }
    ],
    sidewalkId: "sidewalk:road-edge:h:162:202:918:202:north",
    graphEdgeId: "road-edge:h:162:202:918:202",
    routeKind: "hospital-access",
    generated: false
  }),
  freezePedestrianRoute({
    id: "west_market_vertical_loop",
    name: "West Market pedestrian spine loop",
    points: [
      { x: 503, y: 1300 },
      { x: 513, y: 1300 },
      { x: 513, y: 1500 },
      { x: 503, y: 1500 }
    ],
    sidewalkId: "sidewalk:road-edge:v:554:1192:554:1920:west:fragment:01",
    graphEdgeId: "road-edge:v:554:1192:554:1920",
    routeKind: "sidewalk-patrol",
    generated: false
  }),
  freezePedestrianRoute({
    id: "west_market_north_loop",
    name: "West Market north nightlife circulation",
    points: [
      { x: 503, y: 1320 },
      { x: 513, y: 1320 },
      { x: 513, y: 1380 },
      { x: 503, y: 1380 }
    ],
    sidewalkId: "sidewalk:road-edge:v:554:1192:554:1920:west:fragment:01",
    graphEdgeId: "road-edge:v:554:1192:554:1920",
    routeKind: "nightlife-circulation",
    generated: false
  }),
  freezePedestrianRoute({
    id: "west_market_south_loop",
    name: "West Market south nightlife circulation",
    points: [
      { x: 503, y: 1420 },
      { x: 513, y: 1420 },
      { x: 513, y: 1480 },
      { x: 503, y: 1480 }
    ],
    sidewalkId: "sidewalk:road-edge:v:554:1192:554:1920:west:fragment:01",
    graphEdgeId: "road-edge:v:554:1192:554:1920",
    routeKind: "nightlife-circulation",
    generated: false
  }),
  freezePedestrianRoute({
    id: "old_quarter_service_loop",
    name: "Old Quarter service avenue loop",
    points: [
      { x: 1703, y: 1640 },
      { x: 1713, y: 1640 },
      { x: 1713, y: 1840 },
      { x: 1703, y: 1840 }
    ],
    sidewalkId: "sidewalk:road-edge:v:1754:1574:1754:1920:west",
    graphEdgeId: "road-edge:v:1754:1574:1754:1920",
    routeKind: "nightlife-circulation",
    generated: false
  }),
  freezePedestrianRoute({
    id: "old_quarter_north_service_loop",
    name: "Old Quarter north frontage loop",
    points: [
      { x: 1703, y: 1660 },
      { x: 1713, y: 1660 },
      { x: 1713, y: 1710 },
      { x: 1703, y: 1710 }
    ],
    sidewalkId: "sidewalk:road-edge:v:1754:1574:1754:1920:west",
    graphEdgeId: "road-edge:v:1754:1574:1754:1920",
    routeKind: "nightlife-circulation",
    generated: false
  }),
  freezePedestrianRoute({
    id: "old_quarter_south_service_loop",
    name: "Old Quarter south frontage loop",
    points: [
      { x: 1703, y: 1760 },
      { x: 1713, y: 1760 },
      { x: 1713, y: 1810 },
      { x: 1703, y: 1810 }
    ],
    sidewalkId: "sidewalk:road-edge:v:1754:1574:1754:1920:west",
    graphEdgeId: "road-edge:v:1754:1574:1754:1920",
    routeKind: "nightlife-circulation",
    generated: false
  }),
  freezePedestrianRoute({
    id: "university_court_loop",
    name: "University court avenue loop",
    points: [
      { x: 4231, y: 1250 },
      { x: 4241, y: 1250 },
      { x: 4241, y: 1540 },
      { x: 4231, y: 1540 }
    ],
    sidewalkId: "sidewalk:road-edge:v:4284:1156:4284:1636:west",
    graphEdgeId: "road-edge:v:4284:1156:4284:1636",
    routeKind: "sidewalk-patrol",
    generated: false
  }),
  freezePedestrianRoute({
    id: "university_north_loop",
    name: "University north frontage loop",
    points: [
      { x: 4231, y: 1280 },
      { x: 4241, y: 1280 },
      { x: 4241, y: 1350 },
      { x: 4231, y: 1350 }
    ],
    sidewalkId: "sidewalk:road-edge:v:4284:1156:4284:1636:west",
    graphEdgeId: "road-edge:v:4284:1156:4284:1636",
    routeKind: "sidewalk-patrol",
    generated: false
  }),
  freezePedestrianRoute({
    id: "university_south_loop",
    name: "University south frontage loop",
    points: [
      { x: 4231, y: 1440 },
      { x: 4241, y: 1440 },
      { x: 4241, y: 1510 },
      { x: 4231, y: 1510 }
    ],
    sidewalkId: "sidewalk:road-edge:v:4284:1156:4284:1636:west",
    graphEdgeId: "road-edge:v:4284:1156:4284:1636",
    routeKind: "sidewalk-patrol",
    generated: false
  }),
  freezePedestrianRoute({
    id: "canal_west_loop",
    name: "Canal West service lane loop",
    points: [
      { x: 703, y: 2290 },
      { x: 713, y: 2290 },
      { x: 713, y: 2490 },
      { x: 703, y: 2490 }
    ],
    sidewalkId: "sidewalk:road-edge:v:752:2212:752:2572:west",
    graphEdgeId: "road-edge:v:752:2212:752:2572",
    routeKind: "sidewalk-patrol",
    generated: false
  }),
  freezePedestrianRoute({
    id: "canal_west_north_loop",
    name: "Canal West north frontage loop",
    points: [
      { x: 703, y: 2310 },
      { x: 713, y: 2310 },
      { x: 713, y: 2370 },
      { x: 703, y: 2370 }
    ],
    sidewalkId: "sidewalk:road-edge:v:752:2212:752:2572:west",
    graphEdgeId: "road-edge:v:752:2212:752:2572",
    routeKind: "sidewalk-patrol",
    generated: false
  }),
  freezePedestrianRoute({
    id: "canal_west_south_loop",
    name: "Canal West south frontage loop",
    points: [
      { x: 703, y: 2410 },
      { x: 713, y: 2410 },
      { x: 713, y: 2470 },
      { x: 703, y: 2470 }
    ],
    sidewalkId: "sidewalk:road-edge:v:752:2212:752:2572:west",
    graphEdgeId: "road-edge:v:752:2212:752:2572",
    routeKind: "sidewalk-patrol",
    generated: false
  }),
  freezePedestrianRoute({
    id: "north_harbor_vertical_loop",
    name: "North Harbor avenue loop",
    points: [
      { x: 4423, y: 220 },
      { x: 4433, y: 220 },
      { x: 4433, y: 760 },
      { x: 4423, y: 760 }
    ],
    sidewalkId: "sidewalk:road-edge:v:4500:0:4500:960:west",
    graphEdgeId: "road-edge:v:4500:0:4500:960",
    routeKind: "sidewalk-patrol",
    generated: false
  }),
  freezePedestrianRoute({
    id: "north_harbor_north_loop",
    name: "North Harbor north frontage loop",
    points: [
      { x: 4423, y: 40 },
      { x: 4433, y: 40 },
      { x: 4433, y: 190 },
      { x: 4423, y: 190 }
    ],
    sidewalkId: "sidewalk:road-edge:v:4500:0:4500:960:west",
    graphEdgeId: "road-edge:v:4500:0:4500:960",
    routeKind: "sidewalk-patrol",
    generated: false
  }),
  freezePedestrianRoute({
    id: "north_harbor_south_loop",
    name: "North Harbor south frontage loop",
    points: [
      { x: 4423, y: 650 },
      { x: 4433, y: 650 },
      { x: 4433, y: 740 },
      { x: 4423, y: 740 }
    ],
    sidewalkId: "sidewalk:road-edge:v:4500:0:4500:960:west",
    graphEdgeId: "road-edge:v:4500:0:4500:960",
    routeKind: "church-circulation",
    generated: false
  }),
  freezePedestrianRoute({
    id: "south_harbor_freight_loop",
    name: "South Harbor freight frontage loop",
    points: [
      { x: 4140, y: 3003 },
      { x: 4420, y: 3003 },
      { x: 4420, y: 3013 },
      { x: 4140, y: 3013 }
    ],
    sidewalkId: "sidewalk:road-edge:h:4080:3052:4500:3052:north",
    graphEdgeId: "road-edge:h:4080:3052:4500:3052",
    routeKind: "sidewalk-patrol",
    generated: false
  }),
  freezePedestrianRoute({
    id: "south_harbor_west_loop",
    name: "South Harbor west frontage loop",
    points: [
      { x: 4095, y: 3003 },
      { x: 4130, y: 3003 },
      { x: 4130, y: 3013 },
      { x: 4095, y: 3013 }
    ],
    sidewalkId: "sidewalk:road-edge:h:4080:3052:4500:3052:north",
    graphEdgeId: "road-edge:h:4080:3052:4500:3052",
    routeKind: "sidewalk-patrol",
    generated: false
  }),
  freezePedestrianRoute({
    id: "south_harbor_east_loop",
    name: "South Harbor east frontage loop",
    points: [
      { x: 4320, y: 3003 },
      { x: 4400, y: 3003 },
      { x: 4400, y: 3013 },
      { x: 4320, y: 3013 }
    ],
    sidewalkId: "sidewalk:road-edge:h:4080:3052:4500:3052:north",
    graphEdgeId: "road-edge:h:4080:3052:4500:3052",
    routeKind: "sidewalk-patrol",
    generated: false
  })
]);

const pedestrianRoutes = Object.freeze([
  ...generatedPedestrianRoutes,
  ...EXTRA_PEDESTRIAN_ROUTES
]);

const streetNavigationPoints = Object.freeze([
  ...generatedStreetNavigationPoints,
  ...EXTRA_PEDESTRIAN_ROUTES.flatMap(route => route.points.map((point, index) => Object.freeze({
    id: `nav:${route.id}:${index + 1}`,
    x: point.x,
    y: point.y,
    kind: "pedestrian",
    routeId: route.id,
    sidewalkId: route.sidewalkId
  })))
]);

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