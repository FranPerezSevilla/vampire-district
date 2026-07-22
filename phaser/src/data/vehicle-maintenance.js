import { LAYERS } from "./district.js";

export const REFUGE_GARAGE = Object.freeze({
  id: "rooftop_refuge_garage",
  label: "Refuge garage",
  refugeId: "rooftop_refuge",
  layer: LAYERS.STREET,
  x: 304,
  y: 326,
  interactionRadius: 58,
  serviceRadius: 96,
  recoverySlots: Object.freeze([
    Object.freeze({ x: 304, y: 326, angle: 0 }),
    Object.freeze({ x: 304, y: 354, angle: 0 }),
    Object.freeze({ x: 340, y: 326, angle: 0 }),
    Object.freeze({ x: 340, y: 354, angle: 0 })
  ])
});

export const VEHICLE_MAINTENANCE_RULES = Object.freeze({
  minimumRepairCost: 25,
  recoveryHealthFraction: 0.35,
  repairRateByArchetype: Object.freeze({
    compact: 3,
    sedan: 4,
    van: 5,
    police: 6
  }),
  recoveryCostByArchetype: Object.freeze({
    compact: 120,
    sedan: 150,
    van: 190,
    police: 220
  })
});
