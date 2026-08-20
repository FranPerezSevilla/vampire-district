import { CAMPAIGN_EVENT_TYPES } from "../campaign/constants.js";
import { LAYERS } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";
import { VEHICLE_OWNERSHIP } from "../data/vehicles.js";
import { RawAudio } from "../systems/RawAudioSystem.js";
import { planVehiclePedestrianImpactHeat } from "./VehiclePedestrianImpactPolicy.js";

const PEDESTRIAN_TYPES = new Set([
  NPC_TYPES.CIVILIAN,
  NPC_TYPES.TARGET,
  NPC_TYPES.POLICE,
  NPC_TYPES.HUNTER,
  NPC_TYPES.THUG
]);

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

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
  vehicle.status = vehicle.transient
    ? VEHICLE_OWNERSHIP.STOLEN
    : system.campaign.vehicles.markStolen(vehicle.id, {
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

  system.scene.policeSystem?.addHeat?.(
    vehicle.x,
    vehicle.y,
    policeVehicle ? 42 : factionVehicle ? 25 : 18,
    `reported theft of ${vehicle.name}`
  );
  if (!vehicle.transient) {
    system.campaign.handle(CAMPAIGN_EVENT_TYPES.VEHICLE_STOLEN, {
      vehicleId: vehicle.id,
      targetId: vehicle.id,
      factionId: vehicle.factionId,
      previousStatus
    });
  }
  system.scene.lastActionText = policeVehicle
    ? `POLICE VEHICLE STOLEN: ${vehicle.name}. Units converge on the last known position.`
    : `STOLEN: ${vehicle.name}. Witnesses may report the theft.`;
  system.scene.events?.emit?.("vehicle:stolen", {
    vehicleId: vehicle.id,
    previousStatus,
    witnesses: witnesses.length,
    transient: Boolean(vehicle.transient)
  });
}

function createVehicleImpactBlood(system, npc, vehicle, lethal) {
  const evidence = system.scene.evidenceSystem;
  if (!evidence || npc.type === NPC_TYPES.RAT) return 0;
  const count = lethal ? 8 : 3;
  const direction = Math.sign(vehicle.speed || 1);
  for (let index = 0; index < count; index++) {
    const trail = index * (lethal ? 7 : 4);
    evidence.createBloodStain(
      npc.x - Math.cos(vehicle.angle) * trail * direction,
      npc.y - Math.sin(vehicle.angle) * trail * direction,
      LAYERS.STREET,
      lethal ? "vehicle-fatal" : "vehicle-impact"
    );
  }
  return count;
}

function pedestrianImpactHeatPlan(system, vehicle, lethal) {
  const heatSystem = system.scene.heatSystem;
  const policeSystem = system.scene.policeSystem;
  const zone = heatSystem?.districtAt?.(vehicle.x, vehicle.y)
    || policeSystem?.zoneAt?.(vehicle.x, vehicle.y)
    || { id: "district" };
  const districtId = String(zone.id || "district");
  const currentHeat = heatSystem?.valueFor?.(districtId)
    ?? policeSystem?.heatValue?.(districtId)
    ?? 0;
  const sceneNow = Number(system.scene.time?.now);
  const nowMs = Number.isFinite(sceneNow) ? sceneNow : Date.now();
  const plan = planVehiclePedestrianImpactHeat(system.pedestrianImpactBurst, {
    nowMs,
    districtId,
    currentHeat: finite(currentHeat),
    lethal
  });
  system.pedestrianImpactBurst = plan.state;
  return { ...plan, districtId };
}

function reactToHeardPedestrianImpact(system, victim, impactSpeed) {
  const radius = impactSpeed >= 82 ? 150 : 112;
  const candidates = system.scene.npcSystem?.queryRadius?.(
    victim.x,
    victim.y,
    radius,
    LAYERS.STREET,
    npc => [NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET].includes(npc.type)
  ) || [];
  let heardOnly = 0;
  for (const npc of candidates) {
    if (!npc || npc === victim || npc.dead || npc.inactive || npc.hiddenBody || npc.intercepted) continue;
    if (npc.alarmed || npc.chasingPlayer || npc.enemyAttack || npc.drainVictim) continue;
    const sawImpact = Boolean(system.scene.witnessSystem?.canWitnessSee?.(npc, victim, Math.min(radius, 125)));
    if (sawImpact) continue;
    npc.soundReactionTimer = Math.max(npc.soundReactionTimer || 0, impactSpeed >= 82 ? 1.5 : 1.1);
    npc.soundSourceX = victim.x;
    npc.soundSourceY = victim.y;
    npc.vx = 0;
    npc.vy = 0;
    npc.chasingPlayer = false;
    system.scene.aiStateSystem?.resolveNpc?.(npc);
    heardOnly++;
  }
  return heardOnly;
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
    RawAudio.play("civilianScream", { cooldown: 0.75 });
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

    const bloodStains = createVehicleImpactBlood(system, npc, vehicle, lethal);
    const severity = lethal ? 20 : 10;
    system.scene.witnessSystem?.onMundaneViolence?.(
      npc,
      lethal ? "a fatal vehicle impact" : "a vehicle striking a pedestrian",
      severity
    );
    const heardOnlyCivilians = reactToHeardPedestrianImpact(system, npc, impactSpeed);

    const heatPlan = pedestrianImpactHeatPlan(system, vehicle, lethal);
    if (heatPlan.heat > 0) {
      system.scene.policeSystem?.addHeat?.(
        vehicle.x,
        vehicle.y,
        heatPlan.heat,
        lethal ? "vehicle homicide" : "vehicle-pedestrian collision",
        { source: lethal ? "vehicle_homicide" : "vehicle_pedestrian_collision" }
      );
    }

    system.damageVehicle(vehicle.id, lethal ? 5 : 2, { reason: "pedestrian-impact", persist: false });
    vehicle.speed *= lethal ? 0.58 : 0.76;
    system.scene.events?.emit?.("vehicle:pedestrian-hit", {
      vehicleId: vehicle.id,
      npcId: npc.id,
      lethal,
      speed: impactSpeed,
      bloodStains,
      heardOnlyCivilians,
      heat: heatPlan.heat,
      heatSuppressed: heatPlan.suppressedHeat,
      impactChain: heatPlan.chainCount,
      heatCeiling: heatPlan.ceiling
    });
    system.scene.lastActionText = lethal
      ? `VEHICLE HOMICIDE: ${vehicle.name} crushes ${npc.id}. Blood marks the road; police pressure builds.`
      : `${vehicle.name} strikes ${npc.id}. Blood and witnesses mark the impact.`;
  }
}