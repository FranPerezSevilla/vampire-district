import { LAYERS } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";
import { PoliceSystem } from "../systems/PoliceSystem.js";

const VEHICLE_PROPERTY_SOURCES = new Set([
  "traffic_collision",
  "severe_traffic_collision",
  "vehicle_property_collision",
  "property_damage"
]);

const VEHICLE_PROPERTY_REASONS = new Set([
  "dumpster destroyed by vehicle",
  "corpse exposed by vehicle impact"
]);

function isVehiclePropertyIncident(reason, options = {}) {
  return VEHICLE_PROPERTY_SOURCES.has(String(options?.source || ""))
    || VEHICLE_PROPERTY_REASONS.has(String(reason || ""));
}

export function policeWitnessesVehicleIncident(scene, x, y, radius = 220) {
  if (!scene) return [];
  const incident = { x, y, layer: LAYERS.STREET };
  const candidates = scene.npcSystem?.queryRadius?.(
    x,
    y,
    radius,
    LAYERS.STREET,
    npc => npc?.type === NPC_TYPES.POLICE
  ) || scene.npcSystem?.npcs || [];

  return candidates.filter(officer => {
    if (!officer
      || officer.type !== NPC_TYPES.POLICE
      || officer.dead
      || officer.inactive
      || officer.hiddenBody
      || officer.layer !== LAYERS.STREET) {
      return false;
    }

    if (scene.witnessSystem?.canWitnessSee) {
      return Boolean(scene.witnessSystem.canWitnessSee(officer, incident, radius));
    }

    const distance = Math.hypot((officer.x || 0) - x, (officer.y || 0) - y);
    if (distance > radius) return false;
    return scene.npcSystem?.lineClear
      ? Boolean(scene.npcSystem.lineClear(officer, officer.x, officer.y, x, y))
      : true;
  });
}

export function installVehicleIncidentPoliceWitnessPolicy() {
  const prototype = PoliceSystem?.prototype;
  if (!prototype || prototype.__nbdVehicleIncidentPoliceWitnessPolicy) return false;
  const originalAddHeat = prototype.addHeat;
  if (typeof originalAddHeat !== "function") return false;

  prototype.addHeat = function policeWitnessedVehicleIncidentHeat(x, y, amount, reason, options = {}) {
    if (isVehiclePropertyIncident(reason, options)) {
      const witnesses = policeWitnessesVehicleIncident(this.scene, x, y);
      if (!witnesses.length) {
        this.scene?.events?.emit?.("police:vehicle-incident-unwitnessed", {
          x,
          y,
          amount,
          reason,
          source: options?.source || null
        });
        return 0;
      }
      options = {
        ...options,
        witnessedByPoliceIds: witnesses.map(officer => officer.id)
      };
    }
    return originalAddHeat.call(this, x, y, amount, reason, options);
  };

  Object.defineProperty(prototype, "__nbdVehicleIncidentPoliceWitnessPolicy", {
    value: true,
    configurable: true
  });
  return true;
}

installVehicleIncidentPoliceWitnessPolicy();
