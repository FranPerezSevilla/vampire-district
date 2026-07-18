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
    const now = Number(this.scene.time?.now) || 0;

    const result = originalUpdatePolice.apply(this, args);

    // Milestone 8 assigns a short leadership window. Its formation pass runs
    // every frame, so preserve an active deadline instead of extending it
    // forever. Once it expires, a ready officer can take the next turn and the
    // newly selected leader receives a fresh window.
    if (previousId
      && this.attackLeaderId === previousId
      && previousLeader?.ai
      && previousDeadline > now) {
      previousLeader.ai.leaderUntil = previousDeadline;
    }

    return result;
  };

  PoliceSystem.prototype.__nbdPoliceAttackTurnGuard = true;
}

installPoliceAttackTurnGuard();
