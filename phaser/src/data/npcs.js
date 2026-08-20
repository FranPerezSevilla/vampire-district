import { LAYERS, pedestrianRoutes } from "./district.js";

export const NPC_TYPES = Object.freeze({
  CIVILIAN: "civilian",
  TARGET: "target",
  POLICE: "police",
  HUNTER: "hunter",
  THUG: "thug",
  RAT: "rat"
});

export const AMBIENT_PEDESTRIANS_PER_ROUTE = 6;

const TYPE_BY_ID = Object.freeze({
  civilian: NPC_TYPES.CIVILIAN,
  target: NPC_TYPES.TARGET,
  police: NPC_TYPES.POLICE,
  hunter: NPC_TYPES.HUNTER,
  thug: NPC_TYPES.THUG,
  rat: NPC_TYPES.RAT
});

const PEDESTRIAN_ROUTES_BY_ID = new Map(
  pedestrianRoutes.map(route => [route.id, route])
);

function safeId(value) {
  return String(value || "route")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "route";
}

function normalizedRouteIndex(route, value = 0) {
  const count = route?.points?.length || 0;
  if (!count) return 0;
  const index = Math.trunc(Number(value) || 0);
  return ((index % count) + count) % count;
}

function routePointFor(definition) {
  const route = definition.pedestrianRouteId
    ? PEDESTRIAN_ROUTES_BY_ID.get(definition.pedestrianRouteId)
    : null;
  if (!route?.points?.length) return null;
  return route.points[normalizedRouteIndex(route, definition.pedestrianRouteStartIndex)];
}

function reservedRoutePointIndexes(route) {
  return new Set(
    BASE_NPC_DEFINITIONS
      .filter(definition => definition.pedestrianRouteId === route.id)
      .map(definition => normalizedRouteIndex(route, definition.pedestrianRouteStartIndex))
  );
}

function ambientRouteSpeed(route, routeOrder, offset) {
  const kind = String(route?.routeKind || "sidewalk-patrol");
  if (kind === "hospital-access") return 7 + ((routeOrder + offset) % 3);
  if (kind === "nightlife-circulation") return 5 + ((routeOrder + offset) % 3);
  if (kind === "church-circulation") return 4 + ((routeOrder + offset) % 2);
  return 9 + ((routeOrder * 3 + offset * 2) % 5);
}

function ambientPedestrianDefinitions() {
  return pedestrianRoutes.flatMap((route, routeOrder) => {
    const points = route.points || [];
    if (!points.length) return [];
    const reserved = reservedRoutePointIndexes(route);
    const availablePointIndexes = points
      .map((_, index) => index)
      .filter(index => !reserved.has(index));
    const count = Math.min(AMBIENT_PEDESTRIANS_PER_ROUTE, availablePointIndexes.length);
    return Array.from({ length: count }, (_, offset) => {
      const availableIndex = Math.min(
        availablePointIndexes.length - 1,
        Math.floor(((offset + 1) * availablePointIndexes.length) / (count + 1))
      );
      const pointIndex = availablePointIndexes[availableIndex];
      const point = points[pointIndex];
      return {
        id: `ambient_${safeId(route.id)}_${offset + 1}`,
        type: "civilian",
        x: point.x,
        y: point.y,
        layer: point.layer ?? LAYERS.STREET,
        behavior: "sidewalk",
        pedestrianRouteId: route.id,
        pedestrianRouteStartIndex: pointIndex,
        speed: ambientRouteSpeed(route, routeOrder, offset),
        dirX: 1,
        dirY: 0,
        ambientPopulation: true,
        ambientActivity: route.routeKind || "sidewalk-patrol"
      };
    });
  });
}

const BASE_NPC_DEFINITIONS = [
  {
    id: "civ_cross_1",
    type: "civilian",
    x: 1140,
    y: 889,
    layer: 0,
    behavior: "sidewalk",
    pedestrianRouteId: "core_market_loop",
    speed: 12
  },
  {
    id: "civ_east_1",
    type: "civilian",
    x: 2340,
    y: 889,
    layer: 0,
    behavior: "sidewalk",
    pedestrianRouteId: "east_promenade_loop",
    speed: 11
  },
  {
    id: "civ_canal_1",
    type: "civilian",
    x: 2340,
    y: 2749,
    layer: 0,
    behavior: "sidewalk",
    pedestrianRouteId: "canal_loop",
    speed: 10
  },
  {
    id: "civ_south_1",
    type: "civilian",
    x: 1140,
    y: 3269,
    layer: 0,
    behavior: "sidewalk",
    pedestrianRouteId: "blackwater_loop",
    speed: 10
  },
  {
    id: "civ_harbor_1",
    type: "civilian",
    x: 4500,
    y: 2749,
    layer: 0,
    behavior: "sidewalk",
    pedestrianRouteId: "harbor_loop",
    speed: 9
  },
  {
    id: "hospital_visitor_arrival",
    type: "civilian",
    x: 250,
    y: 143,
    layer: 0,
    behavior: "sidewalk",
    pedestrianRouteId: "hospital_perimeter_loop",
    pedestrianRouteStartIndex: 0,
    speed: 8,
    ambientActivity: "hospital-arrival"
  },
  {
    id: "hospital_visitor_departure",
    type: "civilian",
    x: 830,
    y: 153,
    layer: 0,
    behavior: "sidewalk",
    pedestrianRouteId: "hospital_perimeter_loop",
    pedestrianRouteStartIndex: 2,
    speed: 9,
    ambientActivity: "hospital-departure"
  },
  {
    id: "police_shift_arrival",
    type: "civilian",
    x: 2340,
    y: 889,
    layer: 0,
    behavior: "sidewalk",
    pedestrianRouteId: "east_promenade_loop",
    pedestrianRouteStartIndex: 1,
    speed: 10,
    ambientActivity: "police-station-arrival"
  },
  {
    id: "police_shift_departure",
    type: "civilian",
    x: 2340,
    y: 889,
    layer: 0,
    behavior: "sidewalk",
    pedestrianRouteId: "east_promenade_loop",
    pedestrianRouteStartIndex: 3,
    speed: 11,
    ambientActivity: "police-station-departure"
  },
  {
    id: "club_queue_1",
    type: "civilian",
    x: 1708,
    y: 1660,
    layer: 0,
    behavior: "loiter",
    speed: 0,
    dirX: 1,
    dirY: 0,
    ambientActivity: "club-queue"
  },
  {
    id: "club_queue_2",
    type: "civilian",
    x: 1708,
    y: 1682,
    layer: 0,
    behavior: "loiter",
    speed: 0,
    dirX: 1,
    dirY: 0,
    ambientActivity: "club-queue"
  },
  {
    id: "club_queue_3",
    type: "civilian",
    x: 1708,
    y: 1704,
    layer: 0,
    behavior: "loiter",
    speed: 0,
    dirX: 1,
    dirY: 0,
    ambientActivity: "club-queue"
  },
  {
    id: "civ_church",
    type: "civilian",
    x: 4000,
    y: 710,
    layer: 0,
    behavior: "loiter",
    speed: 0,
    dirX: -1,
    dirY: 0,
    ambientActivity: "church-prayer"
  },
  {
    id: "church_prayer_2",
    type: "civilian",
    x: 3984,
    y: 710,
    layer: 0,
    behavior: "loiter",
    speed: 0,
    dirX: 0,
    dirY: -1,
    ambientActivity: "church-prayer"
  },
  {
    id: "church_prayer_3",
    type: "civilian",
    x: 4016,
    y: 710,
    layer: 0,
    behavior: "loiter",
    speed: 0,
    dirX: 0,
    dirY: -1,
    ambientActivity: "church-prayer"
  },
  {
    id: "church_prayer_4",
    type: "civilian",
    x: 4000,
    y: 726,
    layer: 0,
    behavior: "loiter",
    speed: 0,
    dirX: 0,
    dirY: -1,
    ambientActivity: "church-prayer"
  },
  {
    id: "journalist",
    type: "target",
    x: 1880,
    y: 1515,
    layer: 0,
    behavior: "hidden",
    speed: 0,
    inactive: true,
    retiredMissionEntity: true
  },
  {
    id: "exposed_body",
    type: "civilian",
    x: 2020,
    y: 1535,
    layer: 0,
    behavior: "hidden",
    speed: 0,
    inactive: true,
    retiredMissionEntity: true
  },
  {
    id: "rooftop_thug",
    type: "thug",
    x: 1540,
    y: 1375,
    layer: 1,
    behavior: "hidden",
    speed: 0,
    dirX: 1,
    dirY: 0,
    inactive: true,
    retiredMissionEntity: true
  },
  {
    id: "police_patrol_1",
    type: "police",
    x: 2340,
    y: 960,
    layer: 0,
    behavior: "police",
    speed: 22,
    dirX: -1,
    dirY: 0,
    patrolRoute: "northEast",
    patrolIndex: 0,
    patrolOffsetIndex: 0
  },
  {
    id: "police_patrol_2",
    type: "police",
    x: 1140,
    y: 1920,
    layer: 0,
    behavior: "police",
    speed: 21,
    dirX: 1,
    dirY: 0,
    patrolRoute: "westCross",
    patrolIndex: 1,
    patrolOffsetIndex: 1
  },
  {
    id: "police_anchor",
    type: "police",
    x: 2080,
    y: 740,
    layer: 0,
    behavior: "guard",
    speed: 0,
    inactive: true
  },
  {
    id: "hunter_church_1",
    type: "hunter",
    x: 4000,
    y: 710,
    layer: 0,
    behavior: "hidden",
    speed: 0,
    inactive: true
  },
  {
    id: "rat_cross",
    type: "rat",
    x: 1140,
    y: 1920,
    layer: -1,
    behavior: "wander",
    speed: 20
  },
  {
    id: "rat_west",
    type: "rat",
    x: 540,
    y: 1920,
    layer: -1,
    behavior: "wander",
    speed: 18
  },
  {
    id: "rat_canal",
    type: "rat",
    x: 2340,
    y: 2820,
    layer: -1,
    behavior: "wander",
    speed: 18
  }
];

export const npcDefinitions = [
  ...BASE_NPC_DEFINITIONS,
  ...ambientPedestrianDefinitions()
].map(definition => {
  const routePoint = routePointFor(definition);
  return {
    ...definition,
    x: routePoint?.x ?? definition.x,
    y: routePoint?.y ?? definition.y,
    type: TYPE_BY_ID[definition.type] || NPC_TYPES.CIVILIAN,
    layer: definition.layer === -1
      ? LAYERS.SEWER
      : definition.layer === 1
        ? LAYERS.ROOF_LOW
        : routePoint?.layer ?? LAYERS.STREET
  };
});