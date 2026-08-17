export const DEATH_SEQUENCE_PHASES = Object.freeze({
  IDLE: "idle",
  MASTER: "master",
  FADE: "fade",
  BLACK: "black"
});

export const DEATH_BEAT = Object.freeze({
  masterHoldMs: 1100,
  fadeMs: 900
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
  if (state.phase === DEATH_SEQUENCE_PHASES.MASTER) return 0.28;
  const duration = Math.max(1, finite(timings.fadeMs, DEATH_BEAT.fadeMs));
  const progress = Math.max(0, Math.min(1, state.elapsedMs / duration));
  return 0.28 + progress * 0.72;
}

export function deathDialogueAlpha(state, timings = DEATH_BEAT) {
  if (!state || state.phase === DEATH_SEQUENCE_PHASES.IDLE || state.phase === DEATH_SEQUENCE_PHASES.BLACK) return 0;
  if (state.phase === DEATH_SEQUENCE_PHASES.MASTER) return 1;
  const duration = Math.max(1, finite(timings.fadeMs, DEATH_BEAT.fadeMs));
  const progress = Math.max(0, Math.min(1, state.elapsedMs / duration));
  return Math.max(0, 1 - progress * 1.65);
}
