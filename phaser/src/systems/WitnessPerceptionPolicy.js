import { NPC_TYPES } from "../data/npcs.js";

const VISION_HALF_ANGLES = Object.freeze({
  [NPC_TYPES.CIVILIAN]: 0.72,
  [NPC_TYPES.TARGET]: 0.72,
  [NPC_TYPES.POLICE]: 0.62,
  [NPC_TYPES.HUNTER]: 0.58,
  [NPC_TYPES.THUG]: 0.68
});

export const TRAFFIC_VISION_HALF_ANGLE = 1.05;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function witnessHalfAngle(witness) {
  if (witness?.trafficWitness) return TRAFFIC_VISION_HALF_ANGLE;
  return VISION_HALF_ANGLES[witness?.type] ?? VISION_HALF_ANGLES[NPC_TYPES.CIVILIAN];
}

export function stableWitnessFacing(witness) {
  let x = finite(witness?.dirX);
  let y = finite(witness?.dirY);
  const length = Math.hypot(x, y);
  if (length > 0.08) {
    x /= length;
    y /= length;
    if (witness) {
      witness.__nbdFacingX = x;
      witness.__nbdFacingY = y;
    }
    return { x, y };
  }
  return {
    x: finite(witness?.__nbdFacingX, 0),
    y: finite(witness?.__nbdFacingY, 1)
  };
}

export function pointInsideWitnessCone(witness, subject, halfAngle = witnessHalfAngle(witness)) {
  if (!witness || !subject) return false;
  if (subject.layer !== undefined && witness.layer !== undefined && subject.layer !== witness.layer) {
    return false;
  }

  const dx = finite(subject.x) - finite(witness.x);
  const dy = finite(subject.y) - finite(witness.y);
  const distance = Math.hypot(dx, dy);
  if (distance < 0.001) return true;

  const facing = stableWitnessFacing(witness);
  const dot = facing.x * (dx / distance) + facing.y * (dy / distance);
  return dot >= Math.cos(Math.max(0, finite(halfAngle, 0.72)));
}

export function witnessHasLineOfSight(scene, witness, subject) {
  if (!scene || !witness || !subject) return false;
  const lineClear = scene.npcSystem?.lineClear;
  if (typeof lineClear !== "function") return true;

  try {
    return Boolean(lineClear.call(
      scene.npcSystem,
      witness,
      finite(witness.x),
      finite(witness.y),
      finite(subject.x),
      finite(subject.y)
    ));
  } catch {
    // Older test doubles and non-physical traffic occupants may not expose all
    // collision fields. FOV remains mandatory; LOS is enforced whenever the
    // runtime navigation authority can evaluate it.
    return true;
  }
}

export function hasStrictVisualContact(scene, witness, subject, options = {}) {
  if (!pointInsideWitnessCone(
    witness,
    subject,
    options.halfAngle ?? witnessHalfAngle(witness)
  )) {
    return false;
  }
  return witnessHasLineOfSight(scene, witness, subject);
}

export class WitnessPerceptionPolicy {
  constructor(scene) {
    if (!scene?.witnessSystem) {
      throw new TypeError("WitnessPerceptionPolicy requires a scene with WitnessSystem.");
    }
    this.scene = scene;
    this.witnessSystem = scene.witnessSystem;
    this.original = {};
    this.wrapped = {};
    this.destroyed = false;
    this.install();
  }

  install() {
    const policy = this;
    const system = this.witnessSystem;
    this.original.canWitnessSee = system.canWitnessSee;
    this.original.witnessesSeeing = system.witnessesSeeing;

    this.wrapped.canWitnessSee = function strictCanWitnessSee(witness, subject, radius) {
      const legacyVisible = policy.original.canWitnessSee.call(this, witness, subject, radius);
      return Boolean(legacyVisible && hasStrictVisualContact(policy.scene, witness, subject));
    };

    this.wrapped.witnessesSeeing = function strictWitnessesSeeing(subject, radius, options) {
      const candidates = policy.original.witnessesSeeing.call(this, subject, radius, options) || [];
      return candidates.filter(witness => policy.canSeeRelevantActor(witness, subject));
    };

    system.canWitnessSee = this.wrapped.canWitnessSee;
    system.witnessesSeeing = this.wrapped.witnessesSeeing;
  }

  canSeeRelevantActor(witness, subject) {
    const halfAngle = witnessHalfAngle(witness);
    if (hasStrictVisualContact(this.scene, witness, subject, { halfAngle })) return true;

    const player = this.scene.player;
    if (!player || player === subject) return false;
    return hasStrictVisualContact(this.scene, witness, {
      id: player.id || "player",
      x: player.x,
      y: player.y,
      layer: player.layer ?? this.scene.currentLayer
    }, { halfAngle });
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    const system = this.witnessSystem;
    if (system.canWitnessSee === this.wrapped.canWitnessSee) {
      system.canWitnessSee = this.original.canWitnessSee;
    }
    if (system.witnessesSeeing === this.wrapped.witnessesSeeing) {
      system.witnessesSeeing = this.original.witnessesSeeing;
    }
  }
}
