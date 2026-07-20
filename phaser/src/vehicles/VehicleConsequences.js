import { CAMPAIGN_EVENT_TYPES } from "../campaign/constants.js";
import { LAYERS } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";
import { VEHICLE_OWNERSHIP } from "../data/vehicles.js";

const PEDESTRIAN_TYPES = new Set([
  NPC_TYPES.CIVILIAN,
  NPC_TYPES.TARGET,
  NPC_TYPES.POLICE,
  NPC_TYPES.HUNTER,
  NPC_TYPES.THUG
]);

export function vehicleTheftWitnesses(system, vehicle) {
  const candidates = system.scene.npcSystem?.queryRadius?.(
    vehicle.x,
    vehicle.y,
    118,
    LAYERS.STREET
  ) || system.scene.npcSystem?.npcs || [];
  return candidates.filter(npc => Boolean(
    [NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET].includes(npc.type)
    && !npc.dead
    && !npc.inactive
    && !npc.intercepted
    && !npc.hiddenBody
    && npc.layer === LAYERS.STREET
  ));
}

export function registerVehicleTheft(system, vehicle, previousStatus) {
  vehicle.status = system.campaign.vehicles.markStolen(vehicle.id, {
    source: "vehicle_entry",
    factionId: vehicle.factionId
  });

  const policeVehicle = previousStatus === VEHICLE_OWNERSHIP.POLICE;
  const factionVehicle = previousStatus === VEHICLE_OWNERSHIP.FACTION;
  const severity = policeVehicle ? 24 : factionVehicle ? 15 : 11;
  const witnesses = vehicleTheftWitnesses(system, vehicle);
  for (const witness of witnesses) {
    system.scene.witnessSystem?.alarmWitness?.(
      witness,
      `the theft of ${vehicle.name}`,
      severity,
      { reactionSeconds: 0.75, source: vehicle }
    );
  }

  const exposure = policeVehicle ? 14 : factionVehicle ? 8 : 5;
  system.scene.exposureSystem?.add?.(
    exposure + Math.min(4, witnesses.length),
    policeVehicle
      ? "Stealing a police cruiser triggers an immediate district alert."
      : `Vehicle theft draws ${witnesses.length || "nearby"} witness attention.`
  );
  system.scene.policeSystem?.addHeat?.(
    vehicle.x,
    vehicle.y,
    policeVehicle ? 42 : factionVehicle ? 25 : 18,
    `reported theft of ${vehicle.name}`
  );
  system.campaign.handle(CAMPAIGN_EVENT_TYPES.VEHICLE_STOLEN, {
    vehicleId: vehicle.id,
    targetId: vehicle.id,
    factionId: vehicle.factionId,
    previousStatus
  });
  system.scene.lastActionText = policeVehicle
    ? `POLICE VEHICLE STOLEN: ${vehicle.name}. Units converge on the last known position.`
    : `STOLEN: ${vehicle.name}. Witnesses may report the theft.`;
  system.scene.events?.emit?.("vehicle:stolen", {
    vehicleId: vehicle.id,
    previousStatus,
    witnesses: witnesses.length
  });
}

export function collideVehicleWithPedestrians(system, vehicle) {
  const impactSpeed = Math.abs(vehicle.speed);
  if (impactSpeed < 18) return;
  const radius = Math.max(vehicle.archetype.width, vehicle.archetype.height) * 0.55 + 7;
  const candidates = system.scene.npcSystem?.queryRadius?.(
    vehicle.x,
    vehicle.y,
    radius,
    LAYERS.STREET,
    npc => PEDESTRIAN_TYPES.has(npc.type)
  ) || [];

  for (const npc of candidates) {
    if (!npc || npc.dead || npc.inactive || npc.hiddenBody || npc.intercepted) continue;
    if (system.pedestrianCooldowns.has(npc.id)) continue;
    system.pedestrianCooldowns.set(npc.id, 1.25);

    const lethal = impactSpeed >= 82;
    if (lethal) {
      system.scene.npcSystem?.markKilled?.(npc);
      system.scene.evidenceSystem?.onKillCompleted?.(npc);
      system.scene.events?.emit?.("combat:entity-neutralized", {
        targetId: npc.id,
        type: npc.type,
        kind: "killed",
        weaponId: "vehicle",
        vehicleId: vehicle.id
      });
    } else {
      system.scene.npcSystem?.markStunned?.(npc, 4.8);
      const push = Math.max(8, Math.min(22, impactSpeed * 0.14));
      npc.x += Math.cos(vehicle.angle) * push;
      npc.y += Math.sin(vehicle.angle) * push;
      npc.container?.setPosition?.(npc.x, npc.y);
    }

    const severity = lethal ? 20 : 10;
    system.scene.witnessSystem?.onMundaneViolence?.(
      npc,
      lethal ? "a fatal vehicle impact" : "a vehicle striking a pedestrian",
      severity
    );
    system.scene.exposureSystem?.add?.(
      lethal ? 15 : 8,
      lethal ? "A pedestrian is killed by the vehicle." : "A pedestrian is struck by the vehicle."
    );
    system.scene.policeSystem?.addHeat?.(vehicle.x, vehicle.y, lethal ? 32 : 18, "vehicle-pedestrian collision");
    system.damageVehicle(vehicle.id, lethal ? 5 : 2, { reason: "pedestrian-impact", persist: false });
    vehicle.speed *= lethal ? 0.58 : 0.76;
    system.scene.events?.emit?.("vehicle:pedestrian-hit", {
      vehicleId: vehicle.id,
      npcId: npc.id,
      lethal,
      speed: impactSpeed
    });
    system.scene.lastActionText = lethal
      ? `VEHICLE HOMICIDE: ${vehicle.name} kills ${npc.id}. Police pressure rises.`
      : `${vehicle.name} strikes ${npc.id}. Witnesses react.`;
  }
}
