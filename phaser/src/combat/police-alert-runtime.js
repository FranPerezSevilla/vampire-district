import { CombatSystem } from "./CombatSystem.js";
import { policeViolenceTargetLevel, exposureNeededForPoliceLevel } from "../data/police-alert.js";
import { NPC_TYPES } from "../data/npcs.js";
import { GameScene } from "../scenes/GameScene.js";
import { FeedingSystem } from "../systems/FeedingSystem.js";

function escalatePoliceViolence(scene, npc, { neutralized = false, weaponId = "unknown" } = {}) {
  if (!scene || !npc || npc.type !== NPC_TYPES.POLICE) return 0;
  if (neutralized && npc.__nbdPoliceNeutralizationEscalated) return scene.exposureSystem?.level?.() || 0;

  const exposure = scene.exposureSystem;
  const police = scene.policeSystem;
  if (!exposure || !police) return 0;

  const currentLevel = exposure.level();
  const targetLevel = policeViolenceTargetLevel(currentLevel, { neutralized });
  const reason = neutralized
    ? `A police officer was neutralized with ${weaponId}.`
    : `A police officer was attacked with ${weaponId}.`;
  const requiredExposure = exposureNeededForPoliceLevel(exposure.value, targetLevel);

  if (requiredExposure > 0) exposure.add(requiredExposure, reason);
  else exposure.lastReason = reason;

  police.addHeat?.(
    npc.x,
    npc.y,
    neutralized ? 42 : 18,
    reason
  );
  police.rememberPlayerPosition?.();

  if (neutralized) npc.__nbdPoliceNeutralizationEscalated = true;

  const finalLevel = exposure.level();
  scene.lastActionText = neutralized
    ? `POLICE DOWN: alert rises to level ${finalLevel}. More units converge on the district.`
    : `POLICE ASSAULT: alert is now level ${finalLevel}.`;
  scene.events?.emit?.("police:violence-escalated", {
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

function installCombatPoliceEscalation() {
  if (GameScene.prototype.__nbdPoliceViolenceRuntimePatch) return;

  const originalCreate = GameScene.prototype.create;
  GameScene.prototype.create = function createWithPoliceViolenceEscalation(...args) {
    const result = originalCreate.apply(this, args);
    this.events.on("combat:hit", payload => {
      const npc = this.npcSystem?.npcs?.find(candidate => candidate.id === payload?.targetId);
      if (npc?.type !== NPC_TYPES.POLICE) return;
      escalatePoliceViolence(this, npc, {
        neutralized: Boolean(payload?.downed),
        weaponId: payload?.weaponId || "attack"
      });
    });
    return result;
  };

  GameScene.prototype.__nbdPoliceViolenceRuntimePatch = true;
}

function installLegacyNeutralizationEscalation() {
  if (FeedingSystem.prototype.__nbdPoliceViolenceRuntimePatch) return;

  const originalTrackNeutralized = FeedingSystem.prototype.trackNeutralized;
  FeedingSystem.prototype.trackNeutralized = function trackNeutralizedWithPoliceAlert(npc, ...args) {
    const result = originalTrackNeutralized.call(this, npc, ...args);
    if (npc?.type === NPC_TYPES.POLICE) {
      escalatePoliceViolence(this.scene, npc, {
        neutralized: true,
        weaponId: npc.deathKind === "drained" ? "drain" : "lethal action"
      });
    }
    return result;
  };

  FeedingSystem.prototype.__nbdPoliceViolenceRuntimePatch = true;
}

installCombatPoliceEscalation();
installLegacyNeutralizationEscalation();

export { escalatePoliceViolence };
