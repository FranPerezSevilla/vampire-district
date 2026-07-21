import { LAYERS } from "./district.js";

export const VEHICLE_OWNERSHIP = Object.freeze({ PARKED: "parked", OWNED: "owned", STOLEN: "stolen", FACTION: "faction", POLICE: "police" });

export const VEHICLE_ARCHETYPES = Object.freeze({
  compact: Object.freeze({ id: "compact", label: "Compact", width: 28, height: 14, maxSpeed: 245, reverseSpeed: 78, acceleration: 158, reverseAcceleration: 94, brake: 232, handbrakeBrake: 310, handbrakeSteerMultiplier: 1.72, drag: 58, steerRate: 2.62, maxHealth: 72, trunkCapacity: 2, cameraZoomFactor: 0.72, color: 0x78c7a3, trim: 0xd7ffec }),
  sedan: Object.freeze({ id: "sedan", label: "Sedan", width: 34, height: 16, maxSpeed: 272, reverseSpeed: 84, acceleration: 146, reverseAcceleration: 90, brake: 222, handbrakeBrake: 300, handbrakeSteerMultiplier: 1.66, drag: 52, steerRate: 2.38, maxHealth: 88, trunkCapacity: 4, cameraZoomFactor: 0.68, color: 0x9a7ab8, trim: 0xefe6ff }),
  van: Object.freeze({ id: "van", label: "Van", width: 40, height: 19, maxSpeed: 218, reverseSpeed: 70, acceleration: 116, reverseAcceleration: 76, brake: 202, handbrakeBrake: 278, handbrakeSteerMultiplier: 1.52, drag: 48, steerRate: 1.92, maxHealth: 118, trunkCapacity: 7, cameraZoomFactor: 0.75, color: 0x6e5b37, trim: 0xffcf87 }),
  police: Object.freeze({ id: "police", label: "Police cruiser", width: 35, height: 17, maxSpeed: 292, reverseSpeed: 90, acceleration: 172, reverseAcceleration: 102, brake: 242, handbrakeBrake: 326, handbrakeSteerMultiplier: 1.70, drag: 54, steerRate: 2.48, maxHealth: 104, trunkCapacity: 3, cameraZoomFactor: 0.64, color: 0x294c7a, trim: 0x9dcaff })
});

export const vehicleDefinitions = Object.freeze([
  Object.freeze({ id: "refuge_compact", name: "Refuge compact", archetypeId: "compact", x: 304, y: 326, angle: 0, layer: LAYERS.STREET, ownership: VEHICLE_OWNERSHIP.OWNED, startOwned: true, ownerId: "player", factionId: null, parked: true }),
  Object.freeze({ id: "market_sedan", name: "Market sedan", archetypeId: "sedan", x: 1260, y: 338, angle: 0, layer: LAYERS.STREET, ownership: VEHICLE_OWNERSHIP.PARKED, startOwned: false, ownerId: "glasshouse_resident", factionId: null, parked: true }),
  Object.freeze({ id: "directorate_van", name: "Directorate van", archetypeId: "van", x: 1810, y: 760, angle: Math.PI, layer: LAYERS.STREET, ownership: VEHICLE_OWNERSHIP.FACTION, startOwned: false, ownerId: "directorate_cleaner", factionId: "blackglass_directorate", parked: true }),
  Object.freeze({ id: "police_cruiser", name: "Police cruiser", archetypeId: "police", x: 2240, y: 338, angle: Math.PI / 2, layer: LAYERS.STREET, ownership: VEHICLE_OWNERSHIP.POLICE, startOwned: false, ownerId: "city_police", factionId: "city_police", parked: true })
]);

export function vehicleArchetype(id) { return VEHICLE_ARCHETYPES[String(id || "")] || null; }
export function vehicleDefinition(id) { return vehicleDefinitions.find(definition => definition.id === id) || null; }
