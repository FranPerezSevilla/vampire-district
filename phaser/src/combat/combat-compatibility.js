import { CombatSystem } from "./CombatSystem.js";
import { COMBAT_STATES } from "../data/combat.js";
import { NPC_TYPES } from "../data/npcs.js";
import { resolveAction } from "../systems/ActionSystem.js";
import { NpcSystem } from "../systems/NpcSystem.js";
import { RawAudio } from "../systems/RawAudioSystem.js";

function installDownedMarkerCompatibility() {
  if (NpcSystem.prototype.__nbdDownedMarkerCompatibilityPatch) return;

  const originalDrawMarkers = NpcSystem.prototype.drawMarkers;
  NpcSystem.prototype.drawMarkers = function drawMarkersWithoutLegacyDownedMarkers(graphics) {
    const downed = this.npcs.filter(npc => npc.combat?.state === COMBAT_STATES.DOWNED && !npc.dead);
    for (const npc of downed) npc.dead = true;
    try {
      return originalDrawMarkers.call(this, graphics);
    } finally {
      for (const npc of downed) npc.dead = false;
    }
  };

  NpcSystem.prototype.__nbdDownedMarkerCompatibilityPatch = true;
}

function installSingleViolenceDispatch() {
  if (CombatSystem.prototype.__nbdSingleViolenceDispatchPatch) return;

  CombatSystem.prototype.notifyViolence = function notifyViolenceOnce(npc, downed) {
    resolveAction(this.scene, "stun", {
      x: npc.x,
      y: npc.y,
      layer: npc.layer,
      target: npc,
      exclude: [npc],
      cooldownKey: `unarmed:${this.attack?.serial || this.attackSerial}`,
      cooldown: 0.05
    });

    if (npc.type === NPC_TYPES.POLICE) {
      const reason = `A police officer was ${downed ? "knocked down" : "assaulted"}.`;
      this.scene.exposureSystem?.forceLevel?.(1, reason);
      this.scene.policeSystem?.addHeat?.(npc.x, npc.y, downed ? 24 : 15, reason);
      const zone = this.scene.policeSystem?.zoneAt?.(this.scene.player.x, this.scene.player.y);
      if (this.scene.policeSystem) {
        this.scene.policeSystem.lastKnownPlayer = {
          x: this.scene.player.x,
          y: this.scene.player.y,
          zoneId: zone?.id || "district"
        };
      }
      RawAudio.play("police", { cooldown: 0.3 });
    }
  };

  CombatSystem.prototype.__nbdSingleViolenceDispatchPatch = true;
}

installDownedMarkerCompatibility();
installSingleViolenceDispatch();
