import { PoliceSystem } from "../systems/PoliceSystem.js";

function installPoliceSightPriorityGuard() {
  if (PoliceSystem.prototype.__nbdPoliceSightPriorityGuard) return;

  const originalTargetForCop = PoliceSystem.prototype.targetForCop;
  PoliceSystem.prototype.targetForCop = function targetForCopWithSightAboveSound(cop, level, config, ...rest) {
    if (cop?.soundReactionTimer > 0 && !cop.chasingPlayer) {
      const sight = Number(config?.sight) || 150;
      const shadowSight = Number(config?.shadowSight) || 0;
      const seesPlayer = Boolean(this.playerVisibleToCop?.(cop, sight, shadowSight));

      if (!seesPlayer) return null;

      // The older sensory bridge pauses a police officer during a heard-only
      // reaction. Confirmed sight is a higher-priority fact, so clear the sound
      // state before delegating to the normal chase/search selector.
      cop.soundReactionTimer = 0;
      cop.__nbdWtfLabel?.setVisible?.(false);
      cop.ai && (cop.ai.intent = "visual-contact");
    }

    return originalTargetForCop.call(this, cop, level, config, ...rest);
  };

  PoliceSystem.prototype.__nbdPoliceSightPriorityGuard = true;
}

installPoliceSightPriorityGuard();
