import { LAYERS, pedestrianRoutes } from "./district.js";

export const NPC_TYPES = Object.freeze({
  CIVILIAN: "civilian",
  TARGET: "target",
  POLICE: "police",
  HUNTER: "hunter",
  THUG: "thug",
  RAT: "rat"
});

const TYPE_BY_ID = Object.freeze({
  civilian: NPC_TYPES.CIVILIAN,
  target: NPC_TYPES.TARGET,
  police: NPC_TYPES.POLICE,
  hunter: NPC_TYPES.HUNTER,
  thug: NPC_TYPES.THUG,
  rat: NPC_TYPES.RAT
});

const PEDESTRIAN_ROUTE_STARTS = new Map(pedestrianRoutes.map(route => [route.id, route.points?.[0] || null]));

export const npcDefinitions = [{"id":"civ_cross_1","type":"civilian","x":1140,"y":889,"layer":0,"behavior":"sidewalk","pedestrianRouteId":"core_market_loop","speed":12},{"id":"civ_east_1","type":"civilian","x":2340,"y":889,"layer":0,"behavior":"sidewalk","pedestrianRouteId":"east_promenade_loop","speed":11},{"id":"civ_canal_1","type":"civilian","x":2340,"y":2749,"layer":0,"behavior":"sidewalk","pedestrianRouteId":"canal_loop","speed":10},{"id":"civ_south_1","type":"civilian","x":1140,"y":3269,"layer":0,"behavior":"sidewalk","pedestrianRouteId":"blackwater_loop","speed":10},{"id":"civ_harbor_1","type":"civilian","x":4500,"y":2749,"layer":0,"behavior":"sidewalk","pedestrianRouteId":"harbor_loop","speed":9},{"id":"civ_church","type":"civilian","x":4000,"y":710,"layer":0,"behavior":"loiter","speed":0,"dirX":-1,"dirY":0},{"id":"journalist","type":"target","x":1880,"y":1515,"layer":0,"behavior":"hidden","speed":0,"inactive":true,"retiredMissionEntity":true},{"id":"exposed_body","type":"civilian","x":2020,"y":1535,"layer":0,"behavior":"hidden","speed":0,"inactive":true,"retiredMissionEntity":true},{"id":"rooftop_thug","type":"thug","x":1540,"y":1375,"layer":1,"behavior":"hidden","speed":0,"dirX":1,"dirY":0,"inactive":true,"retiredMissionEntity":true},{"id":"police_patrol_1","type":"police","x":2340,"y":960,"layer":0,"behavior":"police","speed":22,"dirX":-1,"dirY":0,"patrolRoute":"northEast","patrolIndex":0,"patrolOffsetIndex":0},{"id":"police_patrol_2","type":"police","x":1140,"y":1920,"layer":0,"behavior":"police","speed":21,"dirX":1,"dirY":0,"patrolRoute":"westCross","patrolIndex":1,"patrolOffsetIndex":1},{"id":"police_anchor","type":"police","x":2080,"y":740,"layer":0,"behavior":"guard","speed":0,"inactive":true},{"id":"hunter_church_1","type":"hunter","x":4000,"y":710,"layer":0,"behavior":"hidden","speed":0,"inactive":true},{"id":"rat_cross","type":"rat","x":1140,"y":1920,"layer":-1,"behavior":"wander","speed":20},{"id":"rat_west","type":"rat","x":540,"y":1920,"layer":-1,"behavior":"wander","speed":18},{"id":"rat_canal","type":"rat","x":2340,"y":2820,"layer":-1,"behavior":"wander","speed":18}].map(definition => {
  const routeStart = definition.pedestrianRouteId
    ? PEDESTRIAN_ROUTE_STARTS.get(definition.pedestrianRouteId)
    : null;
  return {
  ...definition,
  x: routeStart?.x ?? definition.x,
  y: routeStart?.y ?? definition.y,
  type: TYPE_BY_ID[definition.type] || NPC_TYPES.CIVILIAN,
  layer: definition.layer === -1
    ? LAYERS.SEWER
    : definition.layer === 1
      ? LAYERS.ROOF_LOW
      : LAYERS.STREET
  };
});
