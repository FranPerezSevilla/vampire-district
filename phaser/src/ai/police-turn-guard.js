import { AI_ROLES } from "../data/ai.js";
import { COMBAT_STATES } from "../data/combat.js";
import { PoliceSystem } from "../systems/PoliceSystem.js";

function facePlayer(cop, player) {
  const dx = player.x - cop.x;
  const dy = player.y - cop.y;
  const length = Math.hypot(dx, dy) || 1;
  cop.dirX = dx / length;
  cop.dirY = dy / length;
}

function installPoliceAttackTurnGuard() {
  if (PoliceSystem.prototype.__nbdPoliceAttackTurnGuard) return;

  const originalPolice = PoliceSystem.prototype.police;
  PoliceSystem.prototype.police = function activePoliceOnly() {
    return originalPolice.call(this).filter(cop => Boolean(
      cop.combat?.state !== COMBAT_STATES.DOWNED
      && !cop.drainVictim
    ));
  };

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

    // Containment movement targets a slot beside the player. Face the player
    // after moving so the next visual query does not drop contact simply because
    // the officer was circling into formation.
    for (const cop of this.police()) {
      if (cop.ai?.role !== AI_ROLES.CONTAIN || !cop.chasingPlayer || cop.enemyAttack) continue;
      facePlayer(cop, this.scene.player);
    }

    return result;
  };

  PoliceSystem.prototype.__nbdPoliceAttackTurnGuard = true;
}

installPoliceAttackTurnGuard();
