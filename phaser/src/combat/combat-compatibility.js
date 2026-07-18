import { CombatSystem } from "./CombatSystem.js";
import { COMBAT_STATES } from "../data/combat.js";
import { NPC_TYPES } from "../data/npcs.js";
import { WEAPON_TYPES } from "../data/weapons.js";
import { resolveAction } from "../systems/ActionSystem.js";
import { NpcSystem } from "../systems/NpcSystem.js";

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

  CombatSystem.prototype.notifyViolence = function notifyViolenceOnce(npc, downed, suppliedConfig = null) {
    const config = suppliedConfig || this.attack?.config || {
      id: "unarmed",
      name: "Unarmed",
      attackType: WEAPON_TYPES.MELEE,
      violenceLabel: "punched",
      witnessSeverity: 6,
      soundRadius: 72
    };

    // Gunshot sight/hearing is dispatched once at trigger pull by WeaponSystem.
    // Melee still needs ordinary-violence witnesses and police observers, but
    // civilian reporters are excluded from ActionSystem to avoid alarming the
    // same person twice through two parallel paths.
    if (config.attackType !== WEAPON_TYPES.MELEE) return;

    const civilianObservers = (this.scene.npcSystem?.npcs || [])
      .filter(candidate => [NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET].includes(candidate.type));
    resolveAction(this.scene, "stun", {
      x: npc.x,
      y: npc.y,
      layer: npc.layer,
      target: npc,
      exclude: [npc, ...civilianObservers],
      cooldownKey: `${config.id || "melee"}:${this.attack?.serial || this.attackSerial}`,
      cooldown: 0.05
    });

    this.scene.witnessSystem?.onMundaneViolence?.(
      npc,
      `${this.targetName(npc)} ${downed
        ? `knocked down with ${(config.name || "an attack").toLowerCase()}`
        : config.violenceLabel || "struck"}`,
      downed ? Math.max(9, config.witnessSeverity || 6) : config.witnessSeverity || 6
    );
    this.scene.weaponSystem?.onMeleeImpact?.(config, npc);
  };

  CombatSystem.prototype.__nbdSingleViolenceDispatchPatch = true;
}

installDownedMarkerCompatibility();
installSingleViolenceDispatch();
