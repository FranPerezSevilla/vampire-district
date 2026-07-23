import { CITY_ANCHORS } from "./generated/city-topology-v2.js";
import { LAYERS } from "./district.js";

const GARAGE = CITY_ANCHORS.garage;

export const REFUGE_GARAGE = Object.freeze({
  id: "rooftop_refuge_garage",
  label: "Refuge garage",
  refugeId: "rooftop_refuge",
  layer: LAYERS.STREET,
  x: GARAGE.x,
  y: GARAGE.y,
  interactionRadius: 58,
  serviceRadius: 96,
  recoverySlots: Object.freeze([
    Object.freeze({ x: GARAGE.x, y: GARAGE.y, angle: 0 }),
    Object.freeze({ x: GARAGE.x + 38, y: GARAGE.y, angle: 0 }),
    Object.freeze({ x: GARAGE.x, y: GARAGE.y + 28, angle: 0 }),
    Object.freeze({ x: GARAGE.x + 38, y: GARAGE.y + 28, angle: 0 })
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
