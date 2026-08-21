import { LAYERS } from "./district.js";

export const VEHICLE_OWNERSHIP = Object.freeze({
  PARKED: "parked",
  OWNED: "owned",
  STOLEN: "stolen",
  FACTION: "faction",
  POLICE: "police"
});

export const VEHICLE_CLASSES = Object.freeze({
  CIVILIAN: "civilian",
  POLICE: "police"
});

function freezePalette(palette = []) {
  return Object.freeze(palette.map(entry => Object.freeze({ ...entry })));
}

function defineArchetype(spec) {
  return Object.freeze({
    vehicleClass: VEHICLE_CLASSES.CIVILIAN,
    trafficWeight: 0,
    mass: 1,
    collisionPush: 1,
    occupantMin: 1,
    occupantMax: 1,
    conditionProfile: "used",
    bodyStyle: "sedan",
    ...spec,
    palettes: freezePalette(spec.palettes || [{ color: spec.color, trim: spec.trim }])
  });
}

export const VEHICLE_ARCHETYPES = Object.freeze({
  compact: defineArchetype({
    id: "compact", label: "Compact old car", bodyStyle: "compact", width: 28, height: 14,
    maxSpeed: 340, gearCount: 5, gearShiftDuration: 0.14, gearHoldDuration: 0.42, firstGearHoldDuration: 0.30,
    cameraLookAhead: 72, reverseSpeed: 92, acceleration: 330, reverseAcceleration: 126, launchBoost: 0.55,
    brake: 296, handbrakeBrake: 176, handbrakeThrottleFactor: 0.20, handbrakeSteerMultiplier: 1.42,
    handbrakeDriftKick: 0.58, grip: 9.4, handbrakeGrip: 1.45, drag: 45, steerRate: 3.20,
    maxHealth: 72, trunkCapacity: 2, cameraZoomFactor: 0.69, mass: 0.72, collisionPush: 0.76,
    trafficWeight: 14, conditionProfile: "aged", color: 0x78c7a3, trim: 0xd7ffec,
    palettes: [{ color: 0x6f9f96, trim: 0xd1e9dc }, { color: 0x786c62, trim: 0xd8c9b6 }, { color: 0x6d7887, trim: 0xcad5df }]
  }),
  hatchback: defineArchetype({
    id: "hatchback", label: "Modern hatchback", bodyStyle: "hatchback", width: 29, height: 15,
    maxSpeed: 350, gearCount: 5, gearShiftDuration: 0.13, gearHoldDuration: 0.40, firstGearHoldDuration: 0.28,
    cameraLookAhead: 74, reverseSpeed: 96, acceleration: 345, reverseAcceleration: 128, launchBoost: 0.57,
    brake: 305, handbrakeBrake: 174, handbrakeThrottleFactor: 0.21, handbrakeSteerMultiplier: 1.45,
    handbrakeDriftKick: 0.58, grip: 9.7, handbrakeGrip: 1.42, drag: 44, steerRate: 3.24,
    maxHealth: 74, trunkCapacity: 3, cameraZoomFactor: 0.68, mass: 0.80, collisionPush: 0.82,
    trafficWeight: 14, color: 0x57718f, trim: 0xcadbf0,
    palettes: [{ color: 0x57718f, trim: 0xcadbf0 }, { color: 0x4f6659, trim: 0xc8d9cc }, { color: 0x82665c, trim: 0xe2c8bc }]
  }),
  sedan: defineArchetype({
    id: "sedan", label: "Normal sedan", bodyStyle: "sedan", width: 34, height: 16,
    maxSpeed: 360, gearCount: 5, gearShiftDuration: 0.15, gearHoldDuration: 0.44, firstGearHoldDuration: 0.32,
    cameraLookAhead: 76, reverseSpeed: 98, acceleration: 315, reverseAcceleration: 122, launchBoost: 0.50,
    brake: 290, handbrakeBrake: 172, handbrakeThrottleFactor: 0.18, handbrakeSteerMultiplier: 1.38,
    handbrakeDriftKick: 0.54, grip: 8.8, handbrakeGrip: 1.38, drag: 42, steerRate: 2.96,
    maxHealth: 88, trunkCapacity: 4, cameraZoomFactor: 0.66, mass: 1.00, collisionPush: 1.00,
    trafficWeight: 18, occupantMax: 2, color: 0x9a7ab8, trim: 0xefe6ff,
    palettes: [{ color: 0x8f7e70, trim: 0xe5d6c8 }, { color: 0x707987, trim: 0xd8dee7 }, { color: 0x6f6b78, trim: 0xd9d2e1 }, { color: 0x7f775d, trim: 0xe0d8b8 }]
  }),
  executive: defineArchetype({
    id: "executive", label: "Executive sedan", bodyStyle: "executive", width: 37, height: 17,
    maxSpeed: 380, gearCount: 6, gearShiftDuration: 0.13, gearHoldDuration: 0.42, firstGearHoldDuration: 0.30,
    cameraLookAhead: 80, reverseSpeed: 102, acceleration: 330, reverseAcceleration: 124, launchBoost: 0.51,
    brake: 300, handbrakeBrake: 176, handbrakeThrottleFactor: 0.18, handbrakeSteerMultiplier: 1.36,
    handbrakeDriftKick: 0.50, grip: 9.2, handbrakeGrip: 1.42, drag: 44, steerRate: 2.82,
    maxHealth: 102, trunkCapacity: 5, cameraZoomFactor: 0.64, mass: 1.18, collisionPush: 1.12,
    trafficWeight: 7, occupantMax: 2, color: 0x343940, trim: 0xaeb8c2,
    palettes: [{ color: 0x343940, trim: 0xaeb8c2 }, { color: 0x44393a, trim: 0xc1acaa }, { color: 0x3f4650, trim: 0xb7c2d0 }]
  }),
  taxi: defineArchetype({
    id: "taxi", label: "Taxi", bodyStyle: "taxi", width: 34, height: 16,
    maxSpeed: 355, gearCount: 5, gearShiftDuration: 0.14, gearHoldDuration: 0.42, firstGearHoldDuration: 0.30,
    cameraLookAhead: 76, reverseSpeed: 96, acceleration: 325, reverseAcceleration: 122, launchBoost: 0.51,
    brake: 292, handbrakeBrake: 174, handbrakeThrottleFactor: 0.19, handbrakeSteerMultiplier: 1.40,
    handbrakeDriftKick: 0.53, grip: 9.0, handbrakeGrip: 1.40, drag: 43, steerRate: 3.02,
    maxHealth: 86, trunkCapacity: 4, cameraZoomFactor: 0.66, mass: 1.00, collisionPush: 1.00,
    trafficWeight: 10, occupantMax: 2, color: 0xc18d24, trim: 0xffdf78,
    palettes: [{ color: 0xc18d24, trim: 0xffdf78 }, { color: 0xb47f1f, trim: 0xf7d66c }]
  }),
  muscle: defineArchetype({
    id: "muscle", label: "Muscle car", bodyStyle: "muscle", width: 36, height: 18,
    maxSpeed: 410, gearCount: 5, gearShiftDuration: 0.11, gearHoldDuration: 0.36, firstGearHoldDuration: 0.25,
    cameraLookAhead: 86, reverseSpeed: 100, acceleration: 385, reverseAcceleration: 130, launchBoost: 0.68,
    brake: 304, handbrakeBrake: 170, handbrakeThrottleFactor: 0.25, handbrakeSteerMultiplier: 1.42,
    handbrakeDriftKick: 0.70, grip: 8.3, handbrakeGrip: 1.18, drag: 47, steerRate: 2.74,
    maxHealth: 112, trunkCapacity: 3, cameraZoomFactor: 0.60, mass: 1.30, collisionPush: 1.34,
    trafficWeight: 4, conditionProfile: "performance", color: 0x7c2e31, trim: 0xd58b80,
    palettes: [{ color: 0x7c2e31, trim: 0xd58b80 }, { color: 0x25282d, trim: 0xb7bec6 }, { color: 0x4c3b69, trim: 0xb9a6d1 }]
  }),
  sports: defineArchetype({
    id: "sports", label: "Sports car", bodyStyle: "sports", width: 34, height: 17,
    maxSpeed: 440, gearCount: 6, gearShiftDuration: 0.10, gearHoldDuration: 0.34, firstGearHoldDuration: 0.24,
    cameraLookAhead: 92, reverseSpeed: 108, acceleration: 395, reverseAcceleration: 134, launchBoost: 0.72,
    brake: 334, handbrakeBrake: 166, handbrakeThrottleFactor: 0.26, handbrakeSteerMultiplier: 1.48,
    handbrakeDriftKick: 0.66, grip: 10.5, handbrakeGrip: 1.20, drag: 48, steerRate: 3.42,
    maxHealth: 64, trunkCapacity: 2, cameraZoomFactor: 0.57, mass: 0.82, collisionPush: 0.84,
    trafficWeight: 2, conditionProfile: "performance", color: 0x8b3434, trim: 0xe9a6a0,
    palettes: [{ color: 0x8b3434, trim: 0xe9a6a0 }, { color: 0xb7b8bb, trim: 0xffffff }, { color: 0x35465f, trim: 0xa9c6e8 }]
  }),
  coupe: defineArchetype({
    id: "coupe", label: "Beat-up coupe", bodyStyle: "coupe", width: 32, height: 16,
    maxSpeed: 345, gearCount: 5, gearShiftDuration: 0.15, gearHoldDuration: 0.44, firstGearHoldDuration: 0.31,
    cameraLookAhead: 72, reverseSpeed: 92, acceleration: 300, reverseAcceleration: 114, launchBoost: 0.47,
    brake: 276, handbrakeBrake: 166, handbrakeThrottleFactor: 0.20, handbrakeSteerMultiplier: 1.42,
    handbrakeDriftKick: 0.61, grip: 8.0, handbrakeGrip: 1.28, drag: 42, steerRate: 2.88,
    maxHealth: 60, trunkCapacity: 3, cameraZoomFactor: 0.68, mass: 0.88, collisionPush: 0.90,
    trafficWeight: 5, conditionProfile: "worn", color: 0x557b82, trim: 0xb3cbcd,
    palettes: [{ color: 0x557b82, trim: 0xb3cbcd }, { color: 0x765b4e, trim: 0xcdb9aa }, { color: 0x62684e, trim: 0xc2c8aa }]
  }),
  suv: defineArchetype({
    id: "suv", label: "SUV", bodyStyle: "suv", width: 38, height: 20,
    maxSpeed: 365, gearCount: 5, gearShiftDuration: 0.16, gearHoldDuration: 0.45, firstGearHoldDuration: 0.32,
    cameraLookAhead: 76, reverseSpeed: 92, acceleration: 305, reverseAcceleration: 116, launchBoost: 0.48,
    brake: 286, handbrakeBrake: 192, handbrakeThrottleFactor: 0.14, handbrakeSteerMultiplier: 1.27,
    handbrakeDriftKick: 0.36, grip: 8.7, handbrakeGrip: 1.72, drag: 46, steerRate: 2.38,
    maxHealth: 132, trunkCapacity: 6, cameraZoomFactor: 0.70, mass: 1.58, collisionPush: 1.58,
    trafficWeight: 8, occupantMax: 3, color: 0x465344, trim: 0xb9c5b7,
    palettes: [{ color: 0x465344, trim: 0xb9c5b7 }, { color: 0x494e58, trim: 0xc0c6cf }, { color: 0x6a5a48, trim: 0xcdbba7 }]
  }),
  pickup: defineArchetype({
    id: "pickup", label: "Pickup truck", bodyStyle: "pickup", width: 40, height: 19,
    maxSpeed: 340, gearCount: 5, gearShiftDuration: 0.17, gearHoldDuration: 0.46, firstGearHoldDuration: 0.34,
    cameraLookAhead: 72, reverseSpeed: 88, acceleration: 285, reverseAcceleration: 110, launchBoost: 0.45,
    brake: 274, handbrakeBrake: 190, handbrakeThrottleFactor: 0.13, handbrakeSteerMultiplier: 1.24,
    handbrakeDriftKick: 0.34, grip: 8.1, handbrakeGrip: 1.76, drag: 43, steerRate: 2.26,
    maxHealth: 144, trunkCapacity: 8, cameraZoomFactor: 0.72, mass: 1.72, collisionPush: 1.74,
    trafficWeight: 6, occupantMax: 2, color: 0x4d6c7b, trim: 0xb9d2db,
    palettes: [{ color: 0x4d6c7b, trim: 0xb9d2db }, { color: 0x755f48, trim: 0xd3bea7 }, { color: 0x565c4c, trim: 0xc2c8b5 }]
  }),
  van: defineArchetype({
    id: "van", label: "Van", bodyStyle: "van", width: 40, height: 19,
    maxSpeed: 300, gearCount: 4, gearShiftDuration: 0.18, gearHoldDuration: 0.48, firstGearHoldDuration: 0.36,
    cameraLookAhead: 64, reverseSpeed: 82, acceleration: 250, reverseAcceleration: 100, launchBoost: 0.38,
    brake: 260, handbrakeBrake: 184, handbrakeThrottleFactor: 0.12, handbrakeSteerMultiplier: 1.26,
    handbrakeDriftKick: 0.34, grip: 7.8, handbrakeGrip: 1.70, drag: 40, steerRate: 2.38,
    maxHealth: 118, trunkCapacity: 7, cameraZoomFactor: 0.72, mass: 1.62, collisionPush: 1.62,
    trafficWeight: 8, occupantMax: 2, color: 0x6e5b37, trim: 0xffcf87,
    palettes: [{ color: 0x70685d, trim: 0xd7c9b5 }, { color: 0x6a7078, trim: 0xd5dbe2 }, { color: 0x4f5e61, trim: 0xc2d1d2 }]
  }),
  delivery_van: defineArchetype({
    id: "delivery_van", label: "Delivery van", bodyStyle: "delivery-van", width: 42, height: 20,
    maxSpeed: 292, gearCount: 4, gearShiftDuration: 0.19, gearHoldDuration: 0.49, firstGearHoldDuration: 0.37,
    cameraLookAhead: 62, reverseSpeed: 80, acceleration: 242, reverseAcceleration: 98, launchBoost: 0.36,
    brake: 256, handbrakeBrake: 188, handbrakeThrottleFactor: 0.11, handbrakeSteerMultiplier: 1.23,
    handbrakeDriftKick: 0.31, grip: 7.7, handbrakeGrip: 1.78, drag: 40, steerRate: 2.28,
    maxHealth: 124, trunkCapacity: 9, cameraZoomFactor: 0.74, mass: 1.68, collisionPush: 1.66,
    trafficWeight: 6, occupantMax: 2, color: 0x777267, trim: 0xd8d2c7,
    palettes: [{ color: 0x777267, trim: 0xd8d2c7 }, { color: 0x5c626b, trim: 0xcbd2dc }]
  }),
  limousine: defineArchetype({
    id: "limousine", label: "Limousine", bodyStyle: "limousine", width: 52, height: 17,
    maxSpeed: 342, gearCount: 5, gearShiftDuration: 0.17, gearHoldDuration: 0.46, firstGearHoldDuration: 0.34,
    cameraLookAhead: 76, reverseSpeed: 78, acceleration: 250, reverseAcceleration: 94, launchBoost: 0.36,
    brake: 266, handbrakeBrake: 188, handbrakeThrottleFactor: 0.10, handbrakeSteerMultiplier: 1.18,
    handbrakeDriftKick: 0.24, grip: 8.2, handbrakeGrip: 1.82, drag: 44, steerRate: 1.92,
    maxHealth: 126, trunkCapacity: 6, cameraZoomFactor: 0.75, mass: 1.64, collisionPush: 1.58,
    trafficWeight: 1, occupantMin: 2, occupantMax: 3, color: 0x24262b, trim: 0x9ba2aa,
    palettes: [{ color: 0x24262b, trim: 0x9ba2aa }, { color: 0x39333b, trim: 0xa99fae }]
  }),
  hearse: defineArchetype({
    id: "hearse", label: "Hearse", bodyStyle: "hearse", width: 43, height: 18,
    maxSpeed: 325, gearCount: 5, gearShiftDuration: 0.17, gearHoldDuration: 0.46, firstGearHoldDuration: 0.34,
    cameraLookAhead: 70, reverseSpeed: 84, acceleration: 268, reverseAcceleration: 102, launchBoost: 0.42,
    brake: 274, handbrakeBrake: 188, handbrakeThrottleFactor: 0.12, handbrakeSteerMultiplier: 1.24,
    handbrakeDriftKick: 0.31, grip: 8.4, handbrakeGrip: 1.70, drag: 43, steerRate: 2.24,
    maxHealth: 116, trunkCapacity: 7, cameraZoomFactor: 0.72, mass: 1.46, collisionPush: 1.44,
    trafficWeight: 2, occupantMax: 2, conditionProfile: "funeral", color: 0x202226, trim: 0x8e939a,
    palettes: [{ color: 0x202226, trim: 0x8e939a }, { color: 0x2c252b, trim: 0x9f929b }]
  }),
  junker: defineArchetype({
    id: "junker", label: "Junker", bodyStyle: "junker", width: 31, height: 16,
    maxSpeed: 285, gearCount: 4, gearShiftDuration: 0.21, gearHoldDuration: 0.50, firstGearHoldDuration: 0.38,
    cameraLookAhead: 60, reverseSpeed: 78, acceleration: 220, reverseAcceleration: 92, launchBoost: 0.30,
    brake: 244, handbrakeBrake: 160, handbrakeThrottleFactor: 0.16, handbrakeSteerMultiplier: 1.34,
    handbrakeDriftKick: 0.48, grip: 7.2, handbrakeGrip: 1.32, drag: 46, steerRate: 2.62,
    maxHealth: 48, trunkCapacity: 3, cameraZoomFactor: 0.70, mass: 0.92, collisionPush: 0.88,
    trafficWeight: 4, conditionProfile: "junker", color: 0x766651, trim: 0xb4a28a,
    palettes: [{ color: 0x766651, trim: 0xb4a28a }, { color: 0x65716d, trim: 0xaabbb4 }, { color: 0x75534a, trim: 0xc09688 }]
  }),
  police: defineArchetype({
    id: "police", label: "Police patrol cruiser", vehicleClass: VEHICLE_CLASSES.POLICE, policeRole: "patrol",
    bodyStyle: "police-cruiser", width: 35, height: 17, maxSpeed: 400, gearCount: 5,
    gearShiftDuration: 0.12, gearHoldDuration: 0.34, firstGearHoldDuration: 0.26, cameraLookAhead: 84,
    reverseSpeed: 106, acceleration: 360, reverseAcceleration: 136, launchBoost: 0.60, brake: 318,
    handbrakeBrake: 180, handbrakeThrottleFactor: 0.22, handbrakeSteerMultiplier: 1.46, handbrakeDriftKick: 0.64,
    grip: 9.7, handbrakeGrip: 1.34, drag: 46, steerRate: 3.12, maxHealth: 104, trunkCapacity: 3,
    cameraZoomFactor: 0.62, mass: 1.18, collisionPush: 1.18, color: 0x294c7a, trim: 0x9dcaff,
    palettes: [{ color: 0x202a36, trim: 0xd5dde7 }]
  }),
  police_interceptor: defineArchetype({
    id: "police_interceptor", label: "Police interceptor", vehicleClass: VEHICLE_CLASSES.POLICE, policeRole: "interceptor",
    bodyStyle: "police-interceptor", width: 36, height: 18, maxSpeed: 435, gearCount: 6,
    gearShiftDuration: 0.10, gearHoldDuration: 0.30, firstGearHoldDuration: 0.23, cameraLookAhead: 94,
    reverseSpeed: 110, acceleration: 390, reverseAcceleration: 142, launchBoost: 0.72, brake: 332,
    handbrakeBrake: 176, handbrakeThrottleFactor: 0.25, handbrakeSteerMultiplier: 1.50, handbrakeDriftKick: 0.68,
    grip: 10.1, handbrakeGrip: 1.26, drag: 48, steerRate: 3.28, maxHealth: 112, trunkCapacity: 3,
    cameraZoomFactor: 0.58, mass: 1.22, collisionPush: 1.24, color: 0x171d25, trim: 0xe4e9ef,
    palettes: [{ color: 0x171d25, trim: 0xe4e9ef }]
  }),
  police_suv: defineArchetype({
    id: "police_suv", label: "Police SUV", vehicleClass: VEHICLE_CLASSES.POLICE, policeRole: "roadblock",
    bodyStyle: "police-suv", width: 40, height: 21, maxSpeed: 385, gearCount: 5,
    gearShiftDuration: 0.14, gearHoldDuration: 0.38, firstGearHoldDuration: 0.28, cameraLookAhead: 82,
    reverseSpeed: 94, acceleration: 330, reverseAcceleration: 122, launchBoost: 0.54, brake: 318,
    handbrakeBrake: 206, handbrakeThrottleFactor: 0.14, handbrakeSteerMultiplier: 1.28, handbrakeDriftKick: 0.38,
    grip: 9.1, handbrakeGrip: 1.72, drag: 50, steerRate: 2.42, maxHealth: 156, trunkCapacity: 5,
    cameraZoomFactor: 0.66, mass: 1.92, collisionPush: 1.96, color: 0x1d2730, trim: 0xd2dde5,
    palettes: [{ color: 0x1d2730, trim: 0xd2dde5 }]
  }),
  police_unmarked: defineArchetype({
    id: "police_unmarked", label: "Unmarked police sedan", vehicleClass: VEHICLE_CLASSES.POLICE, policeRole: "unmarked",
    bodyStyle: "police-unmarked", width: 36, height: 17, maxSpeed: 415, gearCount: 6,
    gearShiftDuration: 0.11, gearHoldDuration: 0.33, firstGearHoldDuration: 0.25, cameraLookAhead: 88,
    reverseSpeed: 106, acceleration: 370, reverseAcceleration: 136, launchBoost: 0.64, brake: 324,
    handbrakeBrake: 176, handbrakeThrottleFactor: 0.23, handbrakeSteerMultiplier: 1.46, handbrakeDriftKick: 0.62,
    grip: 9.8, handbrakeGrip: 1.32, drag: 46, steerRate: 3.12, maxHealth: 108, trunkCapacity: 3,
    cameraZoomFactor: 0.60, mass: 1.16, collisionPush: 1.18, color: 0x22252a, trim: 0x6c737c,
    palettes: [{ color: 0x22252a, trim: 0x6c737c }, { color: 0x2f3338, trim: 0x777e86 }]
  })
});

export const CIVILIAN_VEHICLE_ARCHETYPE_IDS = Object.freeze(Object.values(VEHICLE_ARCHETYPES)
  .filter(archetype => archetype.vehicleClass === VEHICLE_CLASSES.CIVILIAN)
  .map(archetype => archetype.id));

export const POLICE_VEHICLE_ARCHETYPE_IDS = Object.freeze(Object.values(VEHICLE_ARCHETYPES)
  .filter(archetype => archetype.vehicleClass === VEHICLE_CLASSES.POLICE)
  .map(archetype => archetype.id));

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value || "vehicle")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function trafficVehicleArchetype(seed) {
  const candidates = CIVILIAN_VEHICLE_ARCHETYPE_IDS.map(id => VEHICLE_ARCHETYPES[id])
    .filter(archetype => Number(archetype.trafficWeight) > 0);
  const total = candidates.reduce((sum, archetype) => sum + Number(archetype.trafficWeight), 0);
  if (!candidates.length || total <= 0) return VEHICLE_ARCHETYPES.sedan;
  let roll = stableHash(seed) % total;
  for (const archetype of candidates) {
    const weight = Number(archetype.trafficWeight);
    if (roll < weight) return archetype;
    roll -= weight;
  }
  return candidates[candidates.length - 1];
}

export function policeVehicleArchetypeId(index, level = 2) {
  const unitIndex = Math.max(0, Math.floor(Number(index) || 0));
  const wanted = Math.max(0, Math.floor(Number(level) || 0));
  if (wanted >= 3 && unitIndex >= 2) return "police_suv";
  if (unitIndex === 1) return "police_interceptor";
  return "police";
}

export const vehicleDefinitions = Object.freeze([
  { id: "refuge_compact", name: "Refuge compact", archetypeId: "compact", x: 1540, y: 1575, angle: 0, ownership: "owned", startOwned: true, ownerId: "player", factionId: null, parked: true },
  { id: "market_sedan", name: "Market sedan", archetypeId: "sedan", x: 1140, y: 1945, angle: 0, ownership: "parked", startOwned: false, ownerId: "west_market_resident", factionId: null, parked: true },
  { id: "estate_van", name: "Estate van", archetypeId: "van", x: 2940, y: 2845, angle: Math.PI, ownership: "faction", startOwned: false, ownerId: "estate_cleaner", factionId: "first_estate", parked: true },
  { id: "police_cruiser", name: "Police cruiser", archetypeId: "police", x: 2080, y: 740, angle: Math.PI / 2, ownership: "police", startOwned: false, ownerId: "city_police", factionId: "city_police", parked: true },
  { id: "foundry:vehicle:utility", name: "Foundry utility vehicle", archetypeId: "sedan", x: 1900, y: 2212, angle: 0, ownership: "parked", startOwned: false, ownerId: "foundry_shift_worker", factionId: null, parked: true, generated: true }
].map(definition => Object.freeze({ ...definition, layer: LAYERS.STREET })));

export function vehicleArchetype(id) {
  return VEHICLE_ARCHETYPES[String(id || "")] || null;
}

export function vehicleDefinition(id) {
  return vehicleDefinitions.find(definition => definition.id === id) || null;
}
