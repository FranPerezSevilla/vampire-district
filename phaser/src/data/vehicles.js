import { LAYERS } from "./district.js";

export const VEHICLE_OWNERSHIP = Object.freeze({ PARKED: "parked", OWNED: "owned", STOLEN: "stolen", FACTION: "faction", POLICE: "police" });

export const VEHICLE_ARCHETYPES = Object.freeze({
  compact: Object.freeze({ id: "compact", label: "Compact", width: 28, height: 14, maxSpeed: 348, reverseSpeed: 104, acceleration: 430, reverseAcceleration: 158, launchBoost: 0.92, brake: 318, handbrakeBrake: 128, handbrakeThrottleFactor: 0.48, handbrakeSteerMultiplier: 2.92, handbrakeDriftKick: 2.35, grip: 9.4, handbrakeGrip: 0.28, drag: 40, steerRate: 2.82, maxHealth: 72, trunkCapacity: 2, cameraZoomFactor: 0.65, color: 0x78c7a3, trim: 0xd7ffec }),
  sedan: Object.freeze({ id: "sedan", label: "Sedan", width: 34, height: 16, maxSpeed: 376, reverseSpeed: 110, acceleration: 398, reverseAcceleration: 150, launchBoost: 0.84, brake: 306, handbrakeBrake: 124, handbrakeThrottleFactor: 0.45, handbrakeSteerMultiplier: 2.76, handbrakeDriftKick: 2.18, grip: 8.8, handbrakeGrip: 0.26, drag: 38, steerRate: 2.58, maxHealth: 88, trunkCapacity: 4, cameraZoomFactor: 0.61, color: 0x9a7ab8, trim: 0xefe6ff }),
  van: Object.freeze({ id: "van", label: "Van", width: 40, height: 19, maxSpeed: 312, reverseSpeed: 94, acceleration: 310, reverseAcceleration: 126, launchBoost: 0.68, brake: 278, handbrakeBrake: 142, handbrakeThrottleFactor: 0.36, handbrakeSteerMultiplier: 2.22, handbrakeDriftKick: 1.48, grip: 7.8, handbrakeGrip: 0.42, drag: 37, steerRate: 2.12, maxHealth: 118, trunkCapacity: 7, cameraZoomFactor: 0.68, color: 0x6e5b37, trim: 0xffcf87 }),
  police: Object.freeze({ id: "police", label: "Police cruiser", width: 35, height: 17, maxSpeed: 420, reverseSpeed: 118, acceleration: 462, reverseAcceleration: 168, launchBoost: 0.96, brake: 336, handbrakeBrake: 132, handbrakeThrottleFactor: 0.50, handbrakeSteerMultiplier: 3.02, handbrakeDriftKick: 2.42, grip: 9.7, handbrakeGrip: 0.24, drag: 41, steerRate: 2.74, maxHealth: 104, trunkCapacity: 3, cameraZoomFactor: 0.57, color: 0x294c7a, trim: 0x9dcaff })
});

export const vehicleDefinitions = Object.freeze([
  Object.freeze({ id: "refuge_compact", name: "Refuge compact", archetypeId: "compact", x: 304, y: 326, angle: 0, layer: LAYERS.STREET, ownership: VEHICLE_OWNERSHIP.OWNED, startOwned: true, ownerId: "player", factionId: null, parked: true }),
  Object.freeze({ id: "market_sedan", name: "Market sedan", archetypeId: "sedan", x: 1260, y: 338, angle: 0, layer: LAYERS.STREET, ownership: VEHICLE_OWNERSHIP.PARKED, startOwned: false, ownerId: "glasshouse_resident", factionId: null, parked: true }),
  Object.freeze({ id: "directorate_van", name: "Directorate van", archetypeId: "van", x: 1810, y: 760, angle: Math.PI, layer: LAYERS.STREET, ownership: VEHICLE_OWNERSHIP.FACTION, startOwned: false, ownerId: "directorate_cleaner", factionId: "blackglass_directorate", parked: true }),
  Object.freeze({ id: "police_cruiser", name: "Police cruiser", archetypeId: "police", x: 2240, y: 338, angle: Math.PI / 2, layer: LAYERS.STREET, ownership: VEHICLE_OWNERSHIP.POLICE, startOwned: false, ownerId: "city_police", factionId: "city_police", parked: true })
]);

export function vehicleArchetype(id) { return VEHICLE_ARCHETYPES[String(id || "")] || null; }
export function vehicleDefinition(id) { return vehicleDefinitions.find(definition => definition.id === id) || null; }