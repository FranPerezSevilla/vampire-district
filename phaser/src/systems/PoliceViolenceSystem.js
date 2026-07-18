import { exposureNeededForPoliceLevel, policeViolenceTargetLevel } from "../data/police-alert.js";
import { NPC_TYPES } from "../data/npcs.js";

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
      weaponId: payload.weaponId || "attack"
    });
  }

  handleNeutralized(payload = {}) {
    const npc = this.findNpc(payload.targetId);
    if (npc?.type !== NPC_TYPES.POLICE) return;
    this.escalate(npc, {
      neutralized: true,
      weaponId: payload.weaponId || payload.kind || "lethal action"
    });
  }

  escalate(npc, { neutralized = false, weaponId = "unknown" } = {}) {
    if (!npc || npc.type !== NPC_TYPES.POLICE) return 0;
    const exposure = this.scene.exposureSystem;
    const police = this.scene.policeSystem;
    if (!exposure || !police) return 0;

    if (neutralized && npc.__nbdPoliceNeutralizationEscalated) {
      return Math.min(3, exposure.level?.() || 0);
    }

    const currentLevel = exposure.level();
    const targetLevel = policeViolenceTargetLevel(currentLevel, { neutralized });
    const reason = neutralized
      ? `A police officer was neutralized with ${weaponId}.`
      : `A police officer was attacked with ${weaponId}.`;
    const requiredExposure = exposureNeededForPoliceLevel(exposure.value, targetLevel);

    if (requiredExposure > 0) exposure.add(requiredExposure, reason);
    else exposure.lastReason = reason;

    police.addHeat?.(npc.x, npc.y, neutralized ? 42 : 18, reason);
    police.rememberPlayerPosition?.();
    if (neutralized) npc.__nbdPoliceNeutralizationEscalated = true;

    const finalLevel = Math.min(3, exposure.level());
    this.scene.lastActionText = neutralized
      ? `POLICE DOWN: alert rises to level ${finalLevel}. More units converge on the district.`
      : `POLICE ASSAULT: alert is now level ${finalLevel}.`;
    this.scene.events?.emit?.("police:violence-escalated", {
      officerId: npc.id,
      weaponId,
      neutralized,
      previousLevel: currentLevel,
      targetLevel,
      level: finalLevel,
      exposureAdded: requiredExposure
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
