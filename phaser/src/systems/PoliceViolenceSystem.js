import { policeViolenceTargetLevel } from "../data/police-alert.js";
import { NPC_TYPES } from "../data/npcs.js";

function clampLevel(level) {
  return Math.max(0, Math.min(3, Math.floor(Number(level) || 0)));
}

function isVehicleNeutralization(payload = {}) {
  return payload.weaponId === "vehicle" || Boolean(payload.vehicleId);
}

export class PoliceViolenceSystem {
  constructor(scene) {
    this.scene = scene;
    this.onCombatHit = payload => this.handleCombatHit(payload);
    this.onNeutralized = payload => this.handleNeutralized(payload);
    scene.events?.on?.("combat:hit", this.onCombatHit);
    scene.events?.on?.("combat:entity-neutralized", this.onNeutralized);
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.policeViolenceSystem = this;
  }

  handleCombatHit(payload = {}) {
    const npc = this.findNpc(payload.targetId);
    if (npc?.type !== NPC_TYPES.POLICE) return;
    this.escalate(npc, {
      neutralized: Boolean(payload.downed),
      weaponId: payload.weaponId || "attack",
      vehicleImpact: isVehicleNeutralization(payload)
    });
  }

  handleNeutralized(payload = {}) {
    const npc = this.findNpc(payload.targetId);
    if (npc?.type !== NPC_TYPES.POLICE) return;
    this.escalate(npc, {
      neutralized: true,
      weaponId: payload.weaponId || payload.kind || "lethal action",
      vehicleImpact: isVehicleNeutralization(payload)
    });
  }

  escalate(npc, {
    neutralized = false,
    weaponId = "unknown",
    vehicleImpact = false
  } = {}) {
    if (!npc || npc.type !== NPC_TYPES.POLICE) return 0;
    const heat = this.scene.heatSystem;
    const police = this.scene.policeSystem;
    if (!heat || !police) return 0;

    if (neutralized && npc.__nbdPoliceNeutralizationEscalated) {
      return clampLevel(heat.level?.());
    }

    const currentLevel = clampLevel(heat.level());
    // Vehicle impacts already receive their ordinary collision Heat in
    // VehicleConsequences. Only advance one Wanted band here so the same
    // incident cannot be counted twice and jump directly to level 3.
    const targetLevel = vehicleImpact && neutralized
      ? Math.min(3, Math.max(1, currentLevel + 1))
      : policeViolenceTargetLevel(currentLevel, { neutralized });
    const reason = vehicleImpact
      ? "A police officer was struck by a vehicle."
      : neutralized
        ? `A police officer was neutralized with ${weaponId}.`
        : `A police officer was attacked with ${weaponId}.`;
    const beforeHeat = heat.maximum();

    heat.forceLevel(targetLevel, reason, {
      x: npc.x,
      y: npc.y,
      source: vehicleImpact
        ? "police_vehicle_impact"
        : neutralized
          ? "police_neutralized"
          : "police_assault"
    });
    // The vehicle collision authority has already added impact Heat. Other
    // attacks retain the additional police-assault pressure.
    if (!vehicleImpact) {
      police.addHeat?.(npc.x, npc.y, neutralized ? 18 : 8, reason, {
        source: neutralized ? "police_neutralized" : "police_assault"
      });
    }
    police.rememberPlayerPosition?.();
    if (neutralized) npc.__nbdPoliceNeutralizationEscalated = true;

    const finalLevel = clampLevel(heat.level());
    const heatAdded = Math.max(0, heat.maximum() - beforeHeat);
    this.scene.lastActionText = vehicleImpact
      ? `POLICE HIT: alert rises to level ${finalLevel}. Nearby units respond.`
      : neutralized
        ? `POLICE DOWN: alert rises to level ${finalLevel}. More units converge on the district.`
        : `POLICE ASSAULT: alert is now level ${finalLevel}.`;
    this.scene.events?.emit?.("police:violence-escalated", {
      officerId: npc.id,
      weaponId,
      neutralized,
      vehicleImpact,
      previousLevel: currentLevel,
      targetLevel,
      level: finalLevel,
      heatAdded
    });
    return finalLevel;
  }

  findNpc(id) {
    if (!id) return null;
    return this.scene.npcSystem?.npcs?.find(npc => npc.id === id) || null;
  }

  destroy() {
    this.scene.events?.off?.("combat:hit", this.onCombatHit);
    this.scene.events?.off?.("combat:entity-neutralized", this.onNeutralized);
  }
}
