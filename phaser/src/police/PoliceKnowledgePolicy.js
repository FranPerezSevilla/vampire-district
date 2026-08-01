import { LAYERS } from "../data/district.js";

export const POLICE_INTELLIGENCE_RULES = Object.freeze({
  levelTwoUpdateMs: 1800,
  levelTwoPredictionSeconds: 1.25,
  levelTwoAccuracyRadius: 34
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampLevel(level) {
  return Math.max(0, Math.min(3, Math.floor(finite(level))));
}

function normalizedMovement(frame = {}) {
  const x = finite(frame?.move?.x);
  const y = finite(frame?.move?.y);
  const length = Math.hypot(x, y);
  return length > 0.001 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
}

export function policeKnowledgeMode(level, {
  street = true,
  shadow = false
} = {}) {
  const wanted = clampLevel(level);
  if (!street) return "last-known";
  if (wanted >= 3 && !shadow) return "live";
  if (wanted >= 2 && !shadow) return "periodic";
  return "last-known";
}

export function predictPoliceIntercept(player, frame, seconds = POLICE_INTELLIGENCE_RULES.levelTwoPredictionSeconds) {
  const direction = normalizedMovement(frame);
  const speed = Math.max(0, finite(player?.body?.velocity?.length?.(), finite(player?.speed, 78)));
  const horizon = Math.max(0, finite(seconds, POLICE_INTELLIGENCE_RULES.levelTwoPredictionSeconds));
  return {
    x: finite(player?.x) + direction.x * speed * horizon,
    y: finite(player?.y) + direction.y * speed * horizon
  };
}

export class PoliceKnowledgePolicy {
  constructor(scene, options = {}) {
    if (!scene?.policeSystem) throw new TypeError("PoliceKnowledgePolicy requires PoliceSystem.");
    this.scene = scene;
    this.system = scene.policeSystem;
    this.rules = { ...POLICE_INTELLIGENCE_RULES, ...options };
    this.nextLevelTwoUpdateAt = 0;
    this.intelligence = null;
    this.originalTargetForCop = this.system.targetForCop;
    this.wrappedTargetForCop = null;
    this.destroyed = false;
    this.install();
    scene.events?.once?.(globalThis.Phaser?.Scenes?.Events?.SHUTDOWN || "shutdown", this.destroy, this);
  }

  install() {
    const policy = this;
    this.wrappedTargetForCop = function knowledgeAwareTarget(cop, level, cfg) {
      return policy.targetForCop(this, cop, level, cfg);
    };
    this.system.targetForCop = this.wrappedTargetForCop;
  }

  streetState() {
    return {
      street: this.scene.currentLayer === LAYERS.STREET,
      shadow: Boolean(this.scene.currentShadow?.())
    };
  }

  now() {
    return Math.max(0, finite(this.scene.time?.now, Date.now()));
  }

  updatePeriodicIntelligence(level) {
    const mode = policeKnowledgeMode(level, this.streetState());
    if (mode !== "periodic") return this.intelligence;
    const now = this.now();
    if (this.intelligence && now < this.nextLevelTwoUpdateAt) return this.intelligence;

    const predicted = predictPoliceIntercept(
      this.scene.player,
      this.scene.currentInputFrame,
      this.rules.levelTwoPredictionSeconds
    );
    const index = Math.floor(now / Math.max(1, this.rules.levelTwoUpdateMs));
    const angle = (index * 2.399963229728653) % (Math.PI * 2);
    const radius = Math.max(0, finite(this.rules.levelTwoAccuracyRadius));
    this.intelligence = {
      x: predicted.x + Math.cos(angle) * radius,
      y: predicted.y + Math.sin(angle) * radius,
      kind: "intercept",
      updatedAt: now,
      zoneId: this.system.zoneAt?.(predicted.x, predicted.y)?.id || "district"
    };
    this.nextLevelTwoUpdateAt = now + Math.max(250, finite(this.rules.levelTwoUpdateMs, 1800));
    this.system.lastKnownPlayer = {
      x: this.intelligence.x,
      y: this.intelligence.y,
      zoneId: this.intelligence.zoneId,
      source: "dispatch"
    };
    return this.intelligence;
  }

  targetForCop(system, cop, level, cfg) {
    const wanted = clampLevel(level);
    const mode = policeKnowledgeMode(wanted, this.streetState());

    if (mode === "live") {
      system.rememberPlayerPosition?.();
      cop.chasingPlayer = true;
      return {
        x: this.scene.player.x,
        y: this.scene.player.y,
        kind: "player",
        knowledge: "live-street"
      };
    }

    const original = this.originalTargetForCop.call(system, cop, wanted, cfg);
    if (mode !== "periodic") return original;

    const intelligence = this.updatePeriodicIntelligence(wanted);
    if (!intelligence) return original;
    if (original?.kind === "player") return original;
    return {
      x: intelligence.x,
      y: intelligence.y,
      kind: "search",
      intercept: true,
      knowledge: "periodic-dispatch",
      zoneId: intelligence.zoneId
    };
  }

  snapshot() {
    const level = clampLevel(this.system.wantedLevel?.());
    return {
      mode: policeKnowledgeMode(level, this.streetState()),
      level,
      intelligence: this.intelligence ? { ...this.intelligence } : null,
      nextUpdateAt: this.nextLevelTwoUpdateAt
    };
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.system.targetForCop === this.wrappedTargetForCop) {
      this.system.targetForCop = this.originalTargetForCop;
    }
  }
}
