import { LAYERS } from "./district.js";

export const VEHICLE_OWNERSHIP = Object.freeze({
  PARKED: "parked",
  OWNED: "owned",
  STOLEN: "stolen",
  FACTION: "faction",
  POLICE: "police"
});

export const VEHICLE_ARCHETYPES = Object.freeze({
  compact: Object.freeze({ id: "compact", label: "Compact", width: 28, height: 14, maxSpeed: 310, reverseSpeed: 92, acceleration: 330, reverseAcceleration: 126, launchBoost: 0.55, brake: 296, handbrakeBrake: 176, handbrakeThrottleFactor: 0.20, handbrakeSteerMultiplier: 1.42, handbrakeDriftKick: 0.58, grip: 9.4, handbrakeGrip: 1.45, drag: 45, steerRate: 3.20, maxHealth: 72, trunkCapacity: 2, cameraZoomFactor: 0.69, color: 0x78c7a3, trim: 0xd7ffec }),
  sedan: Object.freeze({ id: "sedan", label: "Sedan", width: 34, height: 16, maxSpeed: 330, reverseSpeed: 98, acceleration: 315, reverseAcceleration: 122, launchBoost: 0.50, brake: 290, handbrakeBrake: 172, handbrakeThrottleFactor: 0.18, handbrakeSteerMultiplier: 1.38, handbrakeDriftKick: 0.54, grip: 8.8, handbrakeGrip: 1.38, drag: 42, steerRate: 2.96, maxHealth: 88, trunkCapacity: 4, cameraZoomFactor: 0.66, color: 0x9a7ab8, trim: 0xefe6ff }),
  van: Object.freeze({ id: "van", label: "Van", width: 40, height: 19, maxSpeed: 275, reverseSpeed: 82, acceleration: 250, reverseAcceleration: 100, launchBoost: 0.38, brake: 260, handbrakeBrake: 184, handbrakeThrottleFactor: 0.12, handbrakeSteerMultiplier: 1.26, handbrakeDriftKick: 0.34, grip: 7.8, handbrakeGrip: 1.70, drag: 40, steerRate: 2.38, maxHealth: 118, trunkCapacity: 7, cameraZoomFactor: 0.72, color: 0x6e5b37, trim: 0xffcf87 }),
  police: Object.freeze({ id: "police", label: "Police cruiser", width: 35, height: 17, maxSpeed: 365, reverseSpeed: 106, acceleration: 360, reverseAcceleration: 136, launchBoost: 0.60, brake: 318, handbrakeBrake: 180, handbrakeThrottleFactor: 0.22, handbrakeSteerMultiplier: 1.46, handbrakeDriftKick: 0.64, grip: 9.7, handbrakeGrip: 1.34, drag: 46, steerRate: 3.12, maxHealth: 104, trunkCapacity: 3, cameraZoomFactor: 0.62, color: 0x294c7a, trim: 0x9dcaff })
});

export const vehicleDefinitions = Object.freeze([{"id":"refuge_compact","name":"Refuge compact","archetypeId":"compact","x":1540,"y":1575,"angle":0,"ownership":"owned","startOwned":true,"ownerId":"player","factionId":null,"parked":true},{"id":"market_sedan","name":"Market sedan","archetypeId":"sedan","x":1140,"y":1945,"angle":0,"ownership":"parked","startOwned":false,"ownerId":"west_market_resident","factionId":null,"parked":true},{"id":"directorate_van","name":"Directorate van","archetypeId":"van","x":2940,"y":2845,"angle":3.141592653589793,"ownership":"faction","startOwned":false,"ownerId":"directorate_cleaner","factionId":"blackglass_directorate","parked":true},{"id":"police_cruiser","name":"Police cruiser","archetypeId":"police","x":2080,"y":740,"angle":1.5707963267948966,"ownership":"police","startOwned":false,"ownerId":"city_police","factionId":"city_police","parked":true},{"id":"foundry:vehicle:utility","name":"Foundry utility vehicle","archetypeId":"sedan","x":1900,"y":2212,"angle":0,"ownership":"parked","startOwned":false,"ownerId":"foundry_shift_worker","factionId":null,"parked":true,"generated":true}].map(definition => Object.freeze({
  ...definition,
  layer: LAYERS.STREET
})));

export function vehicleArchetype(id) {
  return VEHICLE_ARCHETYPES[String(id || "")] || null;
}

export function vehicleDefinition(id) {
  return vehicleDefinitions.find(definition => definition.id === id) || null;
}
