import { NPC_TYPES } from "./npcs.js";

const NORMAL_FOOTSTEP_TYPES = new Set([
  NPC_TYPES.CIVILIAN,
  NPC_TYPES.TARGET,
  NPC_TYPES.THUG
]);

const ENHANCED_HEARING_MULTIPLIER = Object.freeze({
  [NPC_TYPES.POLICE]: 1.18,
  [NPC_TYPES.HUNTER]: 1.24
});

export const MOVEMENT_RULES = Object.freeze({
  runMultiplier: 1.55,
  quietMultiplier: 0.72,
  runStepDistance: 22,
  quietStepDistance: 18,
  runHearingRadius: 120,
  quietHearingRadius: 42,
  normalRunHearingRadius: 42,
  runReactionSeconds: 0.85,
  quietReactionSeconds: 0.38
});

export function movementSpeed(baseSpeed, quietHeld = false, rules = MOVEMENT_RULES) {
  const base = Math.max(0, Number(baseSpeed) || 0);
  return base * (quietHeld ? rules.quietMultiplier : rules.runMultiplier);
}

export function movementNoiseProfile(quietHeld = false, rules = MOVEMENT_RULES) {
  return quietHeld
    ? {
        mode: "quiet",
        audio: "step",
        stepDistance: rules.quietStepDistance,
        hearingRadius: rules.quietHearingRadius,
        reactionSeconds: rules.quietReactionSeconds
      }
    : {
        mode: "run",
        audio: "sprintStep",
        stepDistance: rules.runStepDistance,
        hearingRadius: rules.runHearingRadius,
        reactionSeconds: rules.runReactionSeconds
      };
}

export function footstepHearingRadius(profile, npcType, rules = MOVEMENT_RULES) {
  if (!profile) return 0;

  // Ordinary humans only notice footsteps as a short-range WTF reaction while
  // the player is running. Quiet movement does not trigger them through sound.
  if (NORMAL_FOOTSTEP_TYPES.has(npcType)) {
    return profile.mode === "run" ? rules.normalRunHearingRadius : 0;
  }

  const multiplier = ENHANCED_HEARING_MULTIPLIER[npcType] || 1;
  return profile.hearingRadius * multiplier;
}
