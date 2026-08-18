export const DEATH_SEQUENCE_PHASES = Object.freeze({
  IDLE: "idle",
  MASTER: "master",
  FADE: "fade",
  BLACK: "black"
});

export const DEATH_BEAT = Object.freeze({
  zoomHoldMs: 2000,
  masterHoldMs: 1,
  fadeMs: 900,
  fallbackDialogueMs: 1800,
  masterSpeaker: "YOUR SIRE · IN YOUR MIND",
  masterLine: "Pathetic. You are supposed to be the predator, not the prey."
});

export const HOSPITAL_RECOVERY = Object.freeze({
  lackeyId: "hospital-recovery-lackey",
  replacementVehicleId: "hospital-recovery-car",
  reviveVitality: 35,
  bloodBagVitality: 30,
  bloodBagHungerRelief: 35,
  policeGraceMs: 7000,
  interactionRadius: 34,
  lackeyLine: "You made quite a mess. We pulled you out of the morgue. Drink this blood bag. The car outside is yours.",
  playerCandidates: Object.freeze([
    Object.freeze({ x: 898, y: 446 }),
    Object.freeze({ x: 898, y: 486 }),
    Object.freeze({ x: 938, y: 430 }),
    Object.freeze({ x: 878, y: 430 })
  ]),
  vehicleCandidates: Object.freeze([
    Object.freeze({ x: 1018, y: 466, angle: 0 }),
    Object.freeze({ x: 1062, y: 466, angle: 0 }),
    Object.freeze({ x: 918, y: 520, angle: Math.PI / 2 })
  ])
});

function finite(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function createDeathSequenceState() {
  return {
    phase: DEATH_SEQUENCE_PHASES.IDLE,
    elapsedMs: 0,
    fadeComplete: false
  };
}

export function startDeathSequence(state) {
  if (!state || state.phase !== DEATH_SEQUENCE_PHASES.IDLE) return false;
  state.phase = DEATH_SEQUENCE_PHASES.MASTER;
  state.elapsedMs = 0;
  state.fadeComplete = false;
  return true;
}

export function advanceDeathSequence(state, deltaMs, timings = DEATH_BEAT) {
  if (!state || state.phase === DEATH_SEQUENCE_PHASES.IDLE || state.phase === DEATH_SEQUENCE_PHASES.BLACK) {
    return { phaseChanged: false, fadeCompleted: false };
  }

  let remaining = Math.max(0, finite(deltaMs));
  let phaseChanged = false;
  let fadeCompleted = false;

  while (remaining > 0) {
    if (state.phase === DEATH_SEQUENCE_PHASES.MASTER) {
      const duration = Math.max(1, finite(timings.masterHoldMs, DEATH_BEAT.masterHoldMs));
      const needed = Math.max(0, duration - state.elapsedMs);
      const step = Math.min(remaining, needed);
      state.elapsedMs += step;
      remaining -= step;
      if (state.elapsedMs + 0.001 < duration) break;
      state.phase = DEATH_SEQUENCE_PHASES.FADE;
      state.elapsedMs = 0;
      phaseChanged = true;
      continue;
    }

    if (state.phase === DEATH_SEQUENCE_PHASES.FADE) {
      const duration = Math.max(1, finite(timings.fadeMs, DEATH_BEAT.fadeMs));
      const needed = Math.max(0, duration - state.elapsedMs);
      const step = Math.min(remaining, needed);
      state.elapsedMs += step;
      remaining -= step;
      if (state.elapsedMs + 0.001 < duration) break;
      state.phase = DEATH_SEQUENCE_PHASES.BLACK;
      state.elapsedMs = 0;
      phaseChanged = true;
      if (!state.fadeComplete) {
        state.fadeComplete = true;
        fadeCompleted = true;
      }
      break;
    }

    break;
  }

  return { phaseChanged, fadeCompleted };
}

export function deathFadeAlpha(state, timings = DEATH_BEAT) {
  if (!state) return 0;
  if (state.phase === DEATH_SEQUENCE_PHASES.IDLE) return 0;
  if (state.phase === DEATH_SEQUENCE_PHASES.BLACK) return 1;
  if (state.phase === DEATH_SEQUENCE_PHASES.MASTER) return 0;
  const duration = Math.max(1, finite(timings.fadeMs, DEATH_BEAT.fadeMs));
  return Math.max(0, Math.min(1, state.elapsedMs / duration));
}

export function deathDialogueAlpha() {
  // Death now reuses the conventional TutorialDirector dialogue surface.
  return 0;
}
