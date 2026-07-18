export const MOVEMENT_RULES = Object.freeze({
  runMultiplier: 1.55,
  quietMultiplier: 0.72,
  runStepDistance: 22,
  quietStepDistance: 18,
  runHearingRadius: 120,
  quietHearingRadius: 42,
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
