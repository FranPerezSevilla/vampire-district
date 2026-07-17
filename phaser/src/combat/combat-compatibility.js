import { COMBAT_STATES } from "../data/combat.js";
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

installDownedMarkerCompatibility();
