import { LAYERS } from "./district.js";

export const VEHICLE_OWNERSHIP = Object.freeze({ PARKED: "parked", OWNED: "owned", STOLEN: "stolen", FACTION: "faction", POLICE: "police" });

export const VEHICLE_ARCHETYPES = Object.freeze({
  compact: Object.freeze({ id: "compact", label: "Compact", width: 28, height: 14, maxSpeed: 325, reverseSpeed: 96, acceleration: 285, reverseAcceleration: 122, launchBoost: 0.62, brake: 292, handbrakeBrake: 172, handbrakeThrottleFactor: 0.34, handbrakeSteerMultiplier: 2.28, grip: 8.8, handbrakeGrip: 0.92, drag: 46, steerRate: 2.72, maxHealth: 72, trunkCapacity: 2, cameraZoomFactor: 0.68, color: 0x78c7a3, trim: 0xd7ffec }),
  sedan: Object.freeze({ id: "sedan", label: "Sedan", width: 34, height: 16, maxSpeed: 352, reverseSpeed: 102, acceleration: 268, reverseAcceleration: 116, launchBoost: 0.56, brake: 284, handbrakeBrake: 166, handbrakeThrottleFactor: 0.32, handbrakeSteerMultiplier: 2.18, grip: 8.2, handbrakeGrip: 0.86, drag: 43, steerRate: 2.48, maxHealth: 88, trunkCapacity: 4, cameraZoomFactor: 0.64, color: 0x9a7ab8, trim: 0xefe6ff }),
  van: Object.freeze({ id: "van", label: "Van", width: 40, height: 19, maxSpeed: 286, reverseSpeed: 86, acceleration: 214, reverseAcceleration: 96, launchBoost: 0.48, brake: 254, handbrakeBrake: 158, handbrakeThrottleFactor: 0.26, handbrakeSteerMultiplier: 1.92, grip: 7.2, handbrakeGrip: 1.08, drag: 41, steerRate: 2.02, maxHealth: 118, trunkCapacity: 7, cameraZoomFactor: 0.71, color: 0x6e5b37, trim: 0xffcf87 }),
  police: Object.freeze({ id: "police", label: "Police cruiser", width: 35, height: 17, maxSpeed: 388, reverseSpeed: 110, acceleration: 312, reverseAcceleration: 132, launchBoost: 0.64, brake: 310, handbrakeBrake: 184, handbrakeThrottleFactor: 0.36, handbrakeSteerMultiplier: 2.32, grip: 9.0, handbrakeGrip: 0.82, drag: 47, steerRate: 2.62, maxHealth: 104, trunkCapacity: 3, cameraZoomFactor: 0.60, color: 0x294c7a, trim: 0x9dcaff })
});

export const vehicleDefinitions = Object.freeze([
  Object.freeze({ id: "refuge_compact", name: "Refuge compact", archetypeId: "compact", x: 304, y: 326, angle: 0, layer: LAYERS.STREET, ownership: VEHICLE_OWNERSHIP.OWNED, startOwned: true, ownerId: "player", factionId: null, parked: true }),
  Object.freeze({ id: "market_sedan", name: "Market sedan", archetypeId: "sedan", x: 1260, y: 338, angle: 0, layer: LAYERS.STREET, ownership: VEHICLE_OWNERSHIP.PARKED, startOwned: false, ownerId: "glasshouse_resident", factionId: null, parked: true }),
  Object.freeze({ id: "directorate_van", name: "Directorate van", archetypeId: "van", x: 1810, y: 760, angle: Math.PI, layer: LAYERS.STREET, ownership: VEHICLE_OWNERSHIP.FACTION, startOwned: false, ownerId: "directorate_cleaner", factionId: "blackglass_directorate", parked: true }),
  Object.freeze({ id: "police_cruiser", name: "Police cruiser", archetypeId: "police", x: 2240, y: 338, angle: Math.PI / 2, layer: LAYERS.STREET, ownership: VEHICLE_OWNERSHIP.POLICE, startOwned: false, ownerId: "city_police", factionId: "city_police", parked: true })
]);

export function vehicleArchetype(id) { return VEHICLE_ARCHETYPES[String(id || "")] || null; }
export function vehicleDefinition(id) { return vehicleDefinitions.find(definition => definition.id === id) || null; }