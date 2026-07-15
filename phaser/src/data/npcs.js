import { LAYERS } from "./district.js";

export const NPC_TYPES = Object.freeze({
  CIVILIAN: "civilian",
  TARGET: "target",
  POLICE: "police",
  HUNTER: "hunter",
  RAT: "rat"
});

export const npcDefinitions = [
  // Civilians: enough life to validate crowd placement without making the club impossible.
  { id: "civ_cross_1", type: NPC_TYPES.CIVILIAN, x: 430, y: 132, layer: LAYERS.STREET, behavior: "wander", speed: 12 },
  { id: "civ_cross_2", type: NPC_TYPES.CIVILIAN, x: 520, y: 170, layer: LAYERS.STREET, behavior: "wander", speed: 11 },
  { id: "civ_west_1", type: NPC_TYPES.CIVILIAN, x: 360, y: 326, layer: LAYERS.STREET, behavior: "wander", speed: 10 },
  { id: "civ_east_1", type: NPC_TYPES.CIVILIAN, x: 690, y: 326, layer: LAYERS.STREET, behavior: "wander", speed: 10 },
  { id: "civ_west_2", type: NPC_TYPES.CIVILIAN, x: 246, y: 326, layer: LAYERS.STREET, behavior: "wander", speed: 10 },
  { id: "civ_club", type: NPC_TYPES.CIVILIAN, x: 720, y: 360, layer: LAYERS.STREET, behavior: "loiter", speed: 5, dirX: -1, dirY: 0 },
  { id: "civ_church", type: NPC_TYPES.CIVILIAN, x: 866, y: 456, layer: LAYERS.STREET, behavior: "loiter", speed: 5, dirX: -1, dirY: 0 },
  { id: "civ_south_1", type: NPC_TYPES.CIVILIAN, x: 206, y: 524, layer: LAYERS.STREET, behavior: "wander", speed: 9 },
  { id: "civ_south_2", type: NPC_TYPES.CIVILIAN, x: 420, y: 526, layer: LAYERS.STREET, behavior: "wander", speed: 9 },

  // Mission target: now placed close enough to the club-side shadow for a clean route.
  { id: "journalist", type: NPC_TYPES.TARGET, x: 588, y: 360, layer: LAYERS.STREET, behavior: "loiter", speed: 5, dirX: -1, dirY: 0 },

  // Visible police patrols from the start. More police still spawn only when exposure escalates.
  { id: "police_patrol_1", type: NPC_TYPES.POLICE, x: 740, y: 248, layer: LAYERS.STREET, behavior: "police", speed: 22, dirX: -1, dirY: 0 },
  { id: "police_patrol_2", type: NPC_TYPES.POLICE, x: 506, y: 326, layer: LAYERS.STREET, behavior: "police", speed: 20, dirX: 1, dirY: 0 },
  { id: "police_anchor", type: NPC_TYPES.POLICE, x: 780, y: 178, layer: LAYERS.STREET, behavior: "guard", speed: 0, inactive: true },

  // Hunters stay hidden unless supernatural/evidence pressure escalates.
  { id: "hunter_church_1", type: NPC_TYPES.HUNTER, x: 842, y: 474, layer: LAYERS.STREET, behavior: "hidden", speed: 0, inactive: true },

  // Rats validate sewer layer NPC support.
  { id: "rat_cross", type: NPC_TYPES.RAT, x: 472, y: 326, layer: LAYERS.SEWER, behavior: "wander", speed: 20 },
  { id: "rat_west", type: NPC_TYPES.RAT, x: 176, y: 350, layer: LAYERS.SEWER, behavior: "wander", speed: 18 }
];
