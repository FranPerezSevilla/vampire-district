import { LAYERS } from "./district.js";

export const VEHICLE_OWNERSHIP = Object.freeze({ PARKED: "parked", OWNED: "owned", STOLEN: "stolen", FACTION: "faction", POLICE: "police" });

export const VEHICLE_ARCHETYPES = Object.freeze({
  compact: Object.freeze({ id: "compact", label: "Compact", width: 28, height: 14, maxSpeed: 188, reverseSpeed: 66, acceleration: 122, reverseAcceleration: 78, brake: 214, drag: 54, steerRate: 2.55, maxHealth: 72, trunkCapacity: 2, cameraZoomFactor: 0.78, color: 0x78c7a3, trim: 0xd7ffec }),
  sedan: Object.freeze({ id: "sedan", label: "Sedan", width: 34, height: 16, maxSpeed: 210, reverseSpeed: 72, acceleration: 112, reverseAcceleration: 74, brake: 202, drag: 48, steerRate: 2.30, maxHealth: 88, trunkCapacity: 4, cameraZoomFactor: 0.74, color: 0x9a7ab8, trim: 0xefe6ff }),
  van: Object.freeze({ id: "van", label: "Van", width: 40, height: 19, maxSpeed: 168, reverseSpeed: 58, acceleration: 86, reverseAcceleration: 62, brake: 184, drag: 44, steerRate: 1.82, maxHealth: 118, trunkCapacity: 7, cameraZoomFactor: 0.80, color: 0x6e5b37, trim: 0xffcf87 }),
  police: Object.freeze({ id: "police", label: "Police cruiser", width: 35, height: 17, maxSpeed: 226, reverseSpeed: 76, acceleration: 132, reverseAcceleration: 82, brake: 224, drag: 50, steerRate: 2.42, maxHealth: 104, trunkCapacity: 3, cameraZoomFactor: 0.70, color: 0x294c7a, trim: 0x9dcaff })
});

export const vehicleDefinitions = Object.freeze([
  Object.freeze({ id: "refuge_compact", name: "Refuge compact", archetypeId: "compact", x: 304, y: 326, angle: 0, layer: LAYERS.STREET, ownership: VEHICLE_OWNERSHIP.OWNED, startOwned: true, ownerId: "player", factionId: null, parked: true }),
  Object.freeze({ id: "market_sedan", name: "Market sedan", archetypeId: "sedan", x: 1260, y: 338, angle: 0, layer: LAYERS.STREET, ownership: VEHICLE_OWNERSHIP.PARKED, startOwned: false, ownerId: "glasshouse_resident", factionId: null, parked: true }),
  Object.freeze({ id: "directorate_van", name: "Directorate van", archetypeId: "van", x: 1810, y: 760, angle: Math.PI, layer: LAYERS.STREET, ownership: VEHICLE_OWNERSHIP.FACTION, startOwned: false, ownerId: "directorate_cleaner", factionId: "blackglass_directorate", parked: true }),
  Object.freeze({ id: "police_cruiser", name: "Police cruiser", archetypeId: "police", x: 2240, y: 338, angle: Math.PI / 2, layer: LAYERS.STREET, ownership: VEHICLE_OWNERSHIP.POLICE, startOwned: false, ownerId: "city_police", factionId: "city_police", parked: true })
]);

export function vehicleArchetype(id) { return VEHICLE_ARCHETYPES[String(id || "")] || null; }
export function vehicleDefinition(id) { return vehicleDefinitions.find(definition => definition.id === id) || null; }