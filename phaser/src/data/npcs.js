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

function ambientPedestrianDefinitions() {
  return pedestrianRoutes.flatMap((route, routeOrder) => {
    const points = route.points || [];
    if (!points.length) return [];
    const count = Math.min(AMBIENT_PEDESTRIANS_PER_ROUTE, points.length);
    return Array.from({ length: count }, (_, offset) => {
      const pointIndex = Math.min(
        points.length - 1,
        Math.floor(((offset + 1) * points.length) / (count + 1))
      );
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
        speed: 9 + ((routeOrder * 3 + offset * 2) % 5),
        dirX: 1,
        dirY: 0,
        ambientPopulation: true
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
    id: "civ_church",
    type: "civilian",
    x: 4000,
    y: 710,
    layer: 0,
    behavior: "loiter",
    speed: 0,
    dirX: -1,
    dirY: 0
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
