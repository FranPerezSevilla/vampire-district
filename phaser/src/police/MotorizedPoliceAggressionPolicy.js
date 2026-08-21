import { MOTORIZED_POLICE_TACTICS } from "./MotorizedPolicePolicy.js";

function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

const TACTIC_MULTIPLIERS = Object.freeze({
  [MOTORIZED_POLICE_TACTICS.REAR_QUARTER]: Object.freeze({ speed: 1.16, turn: 1.12 }),
  [MOTORIZED_POLICE_TACTICS.INTERCEPT]: Object.freeze({ speed: 1.14, turn: 1.10 }),
  [MOTORIZED_POLICE_TACTICS.PIT_TELEGRAPH]: Object.freeze({ speed: 1.08, turn: 1.08 }),
  [MOTORIZED_POLICE_TACTICS.PIT_COMMIT]: Object.freeze({ speed: 1.20, turn: 1.04 }),
  [MOTORIZED_POLICE_TACTICS.RAM_TELEGRAPH]: Object.freeze({ speed: 1.08, turn: 1.08 }),
  [MOTORIZED_POLICE_TACTICS.RAM_COMMIT]: Object.freeze({ speed: 1.12, turn: 1.02 })
});

export function motorizedPoliceAggressionMovement(tactic, speed, turnRate = 2.2) {
  const profile = TACTIC_MULTIPLIERS[tactic] || { speed: 1, turn: 1 };
  return Object.freeze({
    speed: Math.max(0, finite(speed)) * profile.speed,
    turnRate: Math.max(0, finite(turnRate, 2.2)) * profile.turn,
    speedMultiplier: profile.speed,
    turnMultiplier: profile.turn
  });
}

export function motorizedPoliceAggressionTiming({
  localTacticsRadius,
  pitTelegraphSeconds,
  pitCooldownSeconds,
  ramTelegraphSeconds,
  ramCooldownSeconds
} = {}) {
  return Object.freeze({
    localTacticsRadius: Math.max(180, finite(localTacticsRadius, 520) * 1.15),
    pitTelegraphSeconds: clamp(finite(pitTelegraphSeconds, 0.65) * 0.84, 0.35, 2),
    pitCooldownSeconds: clamp(finite(pitCooldownSeconds, 5.5) * 0.72, 2.2, 12),
    ramTelegraphSeconds: clamp(finite(ramTelegraphSeconds, 0.85) * 0.86, 0.42, 2.5),
    ramCooldownSeconds: clamp(finite(ramCooldownSeconds, 6.5) * 0.76, 2.8, 14)
  });
}

export function installMotorizedPoliceAggressionPolicy(system) {
  if (!system?.moveTacticalUnit || !system?.updateLocalTactic) {
    throw new TypeError("Motorized police aggression policy requires MotorizedPoliceSystem.");
  }
  if (system.__nbdAggressionPolicy) return system.__nbdAggressionPolicy;

  const originalMoveTacticalUnit = system.moveTacticalUnit;
  const originalTiming = Object.freeze({
    localTacticsRadius: system.localTacticsRadius,
    pitTelegraphSeconds: system.pitTelegraphSeconds,
    pitCooldownSeconds: system.pitCooldownSeconds,
    ramTelegraphSeconds: system.ramTelegraphSeconds,
    ramCooldownSeconds: system.ramCooldownSeconds
  });
  const timing = motorizedPoliceAggressionTiming(originalTiming);
  Object.assign(system, timing);
  let boostedMoves = 0;
  let lastMove = null;

  function aggressiveMoveTacticalUnit(unit, target, dt, speed, options = {}) {
    const movement = motorizedPoliceAggressionMovement(unit?.tactic, speed, options.turnRate);
    if (movement.speedMultiplier > 1 || movement.turnMultiplier > 1) boostedMoves++;
    lastMove = {
      unitId: unit?.id || null,
      tactic: unit?.tactic || null,
      requestedSpeed: finite(speed),
      appliedSpeed: movement.speed,
      requestedTurnRate: finite(options.turnRate, 2.2),
      appliedTurnRate: movement.turnRate
    };
    return originalMoveTacticalUnit.call(this, unit, target, dt, movement.speed, {
      ...options,
      turnRate: movement.turnRate
    });
  }

  system.moveTacticalUnit = aggressiveMoveTacticalUnit;

  const policy = Object.freeze({
    snapshot() {
      return {
        timing: { ...timing },
        boostedMoves,
        lastMove: lastMove ? { ...lastMove } : null
      };
    },
    destroy() {
      if (system.moveTacticalUnit === aggressiveMoveTacticalUnit) system.moveTacticalUnit = originalMoveTacticalUnit;
      Object.assign(system, originalTiming);
      if (system.__nbdAggressionPolicy === policy) delete system.__nbdAggressionPolicy;
    }
  });
  system.__nbdAggressionPolicy = policy;
  return policy;
}
