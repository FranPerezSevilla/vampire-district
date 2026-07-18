import { PoliceSystem } from "../systems/PoliceSystem.js";

function installPoliceAttackTurnGuard() {
  if (PoliceSystem.prototype.__nbdPoliceAttackTurnGuard) return;

  const originalUpdatePolice = PoliceSystem.prototype.updatePolice;
  PoliceSystem.prototype.updatePolice = function updatePoliceWithStableFiniteAttackTurn(...args) {
    const previousId = this.attackLeaderId || null;
    const previousLeader = previousId
      ? this.scene.npcSystem?.npcs?.find(npc => npc.id === previousId)
      : null;
    const previousDeadline = Number(previousLeader?.ai?.leaderUntil) || 0;

    const result = originalUpdatePolice.apply(this, args);

    // Milestone 8 assigns a short leadership window. Its formation pass runs
    // every frame, so preserve the original deadline instead of extending it
    // forever. Once the current attack/recovery finishes, a ready officer can
    // take the next turn deterministically.
    if (previousId && this.attackLeaderId === previousId && previousLeader?.ai && previousDeadline > 0) {
      previousLeader.ai.leaderUntil = previousDeadline;
    }

    return result;
  };

  PoliceSystem.prototype.__nbdPoliceAttackTurnGuard = true;
}

installPoliceAttackTurnGuard();
