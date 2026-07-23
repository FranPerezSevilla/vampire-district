import { LAYERS } from "./district.js";

export const NPC_TYPES = Object.freeze({
  CIVILIAN: "civilian",
  TARGET: "target",
  POLICE: "police",
  HUNTER: "hunter",
  THUG: "thug",
  RAT: "rat"
});

export const npcDefinitions = [
  { id: "civ_cross_1", type: NPC_TYPES.CIVILIAN, x: 300, y: 280, layer: LAYERS.STREET, behavior: "sidewalk", pedestrianRouteId: "core_market_loop", speed: 12 },
  { id: "civ_east_1", type: NPC_TYPES.CIVILIAN, x: 1160, y: 278, layer: LAYERS.STREET, behavior: "sidewalk", pedestrianRouteId: "east_promenade_loop", speed: 11 },
  { id: "civ_canal_1", type: NPC_TYPES.CIVILIAN, x: 1160, y: 688, layer: LAYERS.STREET, behavior: "sidewalk", pedestrianRouteId: "canal_loop", speed: 10 },
  { id: "civ_south_1", type: NPC_TYPES.CIVILIAN, x: 560, y: 1120, layer: LAYERS.STREET, behavior: "sidewalk", pedestrianRouteId: "blackwater_loop", speed: 10 },
  { id: "civ_harbor_1", type: NPC_TYPES.CIVILIAN, x: 2168, y: 398, layer: LAYERS.STREET, behavior: "sidewalk", pedestrianRouteId: "harbor_loop", speed: 9 },
  { id: "civ_church", type: NPC_TYPES.CIVILIAN, x: 782, y: 396, layer: LAYERS.STREET, behavior: "loiter", speed: 0, dirX: -1, dirY: 0 },
  // Retained as dormant test/content archetypes, not live free-roam actors.
  { id: "journalist", type: NPC_TYPES.TARGET, x: 588, y: 360, layer: LAYERS.STREET, behavior: "hidden", speed: 0, inactive: true, retiredMissionEntity: true },
  { id: "exposed_body", type: NPC_TYPES.CIVILIAN, x: 704, y: 506, layer: LAYERS.STREET, behavior: "hidden", speed: 0, inactive: true, retiredMissionEntity: true },
  { id: "rooftop_thug", type: NPC_TYPES.THUG, x: 646, y: 162, layer: LAYERS.ROOF_LOW, behavior: "hidden", speed: 0, dirX: 1, dirY: 0, inactive: true, retiredMissionEntity: true },
  { id: "police_patrol_1", type: NPC_TYPES.POLICE, x: 744, y: 236, layer: LAYERS.STREET, behavior: "police", speed: 22, dirX: -1, dirY: 0, patrolRoute: "northEast", patrolIndex: 0, patrolOffsetIndex: 0 },
  { id: "police_patrol_2", type: NPC_TYPES.POLICE, x: 348, y: 326, layer: LAYERS.STREET, behavior: "police", speed: 21, dirX: 1, dirY: 0, patrolRoute: "westCross", patrolIndex: 1, patrolOffsetIndex: 1 },
  { id: "police_anchor", type: NPC_TYPES.POLICE, x: 780, y: 178, layer: LAYERS.STREET, behavior: "guard", speed: 0, inactive: true },
  { id: "hunter_church_1", type: NPC_TYPES.HUNTER, x: 842, y: 474, layer: LAYERS.STREET, behavior: "hidden", speed: 0, inactive: true },
  { id: "rat_cross", type: NPC_TYPES.RAT, x: 472, y: 326, layer: LAYERS.SEWER, behavior: "wander", speed: 20 },
  { id: "rat_west", type: NPC_TYPES.RAT, x: 176, y: 350, layer: LAYERS.SEWER, behavior: "wander", speed: 18 },
  { id: "rat_canal", type: NPC_TYPES.RAT, x: 1088, y: 760, layer: LAYERS.SEWER, behavior: "wander", speed: 18 }
];
