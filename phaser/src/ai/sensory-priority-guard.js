import { PoliceSystem } from "../systems/PoliceSystem.js";

const SIGHT_BY_LEVEL = Object.freeze({
  0: Object.freeze({ sight: 150, shadowSight: 0 }),
  1: Object.freeze({ sight: 190, shadowSight: 58 }),
  2: Object.freeze({ sight: 238, shadowSight: 100 }),
  3: Object.freeze({ sight: 286, shadowSight: 142 })
});

function installPoliceSightPriorityGuard() {
  if (PoliceSystem.prototype.__nbdPoliceSightPriorityGuard) return;

  const originalTargetForCop = PoliceSystem.prototype.targetForCop;
  PoliceSystem.prototype.targetForCop = function targetForCopWithSightAboveSound(cop, level, config, ...rest) {
    if (cop?.soundReactionTimer > 0 && !cop.chasingPlayer) {
      const clampedLevel = Math.max(0, Math.min(3, Math.floor(Number(level) || 0)));
      const fallback = SIGHT_BY_LEVEL[clampedLevel];
      const sight = Number(config?.sight) || fallback.sight;
      const shadowSight = Number(config?.shadowSight) || fallback.shadowSight;
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
