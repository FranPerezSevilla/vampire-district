import { TrafficLocalBehaviorSystem } from "../streaming/TrafficLocalBehaviorSystem.js";

const PANIC_MS = 5200;
const AVOIDANCE_MS = 1450;
const AVOIDANCE_OFFSET = 18;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function stableSide(value) {
  let hash = 0;
  for (const character of String(value || "traffic")) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return hash % 2 === 0 ? 1 : -1;
}

function moveToward(current, target, amount) {
  const from = finite(current);
  const to = finite(target);
  const step = Math.max(0, finite(amount));
  if (Math.abs(to - from) <= step) return to;
  return from + Math.sign(to - from) * step;
}

export function trafficShouldAvoid(decision, stoppedSeconds = 0) {
  if (!decision) return false;
  const avoidable = new Set(["parked-vehicle", "player-vehicle", "player-on-foot", "traffic"]);
  const threshold = decision.reason === "traffic" ? 0.95 : 0.48;
  return avoidable.has(decision.reason) && finite(stoppedSeconds) >= threshold;
}

function ensureTrafficShotListener(system) {
  if (system.__viceBloodTrafficShotHandler || !system.scene?.events?.on) return;
  const handler = event => {
    const tokenId = String(event?.tokenId || "");
    if (!tokenId) return;
    const slot = (system.materializer?.pool || []).find(candidate => candidate.tokenId === tokenId);
    const token = system.tokenMap?.().get?.(tokenId);
    const state = system.states.get(tokenId) || (slot && token ? system.stateFor(slot, token) : null);
    if (!state) return;
    const now = finite(system.scene.time?.now);
    state.panicUntil = now + PANIC_MS;
    state.avoidanceUntil = Math.max(finite(state.avoidanceUntil), now + 900);
    state.avoidanceSide = stableSide(tokenId);
    state.stoppedSeconds = Math.max(finite(state.stoppedSeconds), 0.55);
    system.scene.events?.emit?.("traffic:panic-started", {
      tokenId,
      x: finite(event?.x, slot?.x),
      y: finite(event?.y, slot?.y),
      until: state.panicUntil
    });
  };
  system.__viceBloodTrafficShotHandler = handler;
  system.scene.events.on("traffic:bullet-hit", handler);
}

export function installTrafficFeedbackPolicy() {
  if (TrafficLocalBehaviorSystem.prototype.__viceBloodTrafficFeedbackPolicy) return;
  TrafficLocalBehaviorSystem.prototype.__viceBloodTrafficFeedbackPolicy = true;

  const originalStateFor = TrafficLocalBehaviorSystem.prototype.stateFor;
  const originalDecisionFor = TrafficLocalBehaviorSystem.prototype.decisionFor;
  const originalApplyDecision = TrafficLocalBehaviorSystem.prototype.applyDecision;
  const originalUpdate = TrafficLocalBehaviorSystem.prototype.update;
  const originalDestroy = TrafficLocalBehaviorSystem.prototype.destroy;

  TrafficLocalBehaviorSystem.prototype.stateFor = function viceBloodTrafficStateFor(slot, token) {
    const state = originalStateFor.call(this, slot, token);
    state.panicUntil ??= 0;
    state.avoidanceUntil ??= 0;
    state.avoidanceSide ??= stableSide(state.tokenId);
    state.avoidanceOffset ??= 0;
    return state;
  };

  TrafficLocalBehaviorSystem.prototype.decisionFor = function viceBloodTrafficDecisionFor(slot, state, token, active) {
    const decision = originalDecisionFor.call(this, slot, state, token, active);
    const now = finite(this.scene.time?.now);
    const panicking = finite(state.panicUntil) > now;
    const shouldAvoid = trafficShouldAvoid(decision, state.stoppedSeconds);
    const junctionSafety = String(decision.reason || "").startsWith("junction");

    if ((shouldAvoid || (panicking && decision.desiredSpeedFactor < 0.82)) && !junctionSafety) {
      state.avoidanceUntil = Math.max(finite(state.avoidanceUntil), now + AVOIDANCE_MS);
      return {
        ...decision,
        // A tiny positive synthetic gap prevents the normal emergency-stop branch
        // from pinning the car while it performs the local lateral pass.
        gap: Math.max(2, finite(decision.gap, 2)),
        desiredSpeedFactor: panicking ? 1.18 : 0.58,
        reason: panicking ? "panic-avoid" : "obstacle-avoid"
      };
    }

    if (panicking && !junctionSafety) {
      return {
        ...decision,
        desiredSpeedFactor: Math.max(finite(decision.desiredSpeedFactor, 1), 1.18),
        reason: "panic-shot"
      };
    }
    return decision;
  };

  TrafficLocalBehaviorSystem.prototype.applyDecision = function viceBloodTrafficApplyDecision(slot, state, token, decision, dt) {
    const result = originalApplyDecision.call(this, slot, state, token, decision, dt);
    const now = finite(this.scene.time?.now);
    const panicking = finite(state.panicUntil) > now;
    const avoiding = finite(state.avoidanceUntil) > now
      || decision.reason === "obstacle-avoid"
      || decision.reason === "panic-avoid";
    const targetOffset = avoiding
      ? AVOIDANCE_OFFSET * state.avoidanceSide
      : panicking
        ? (AVOIDANCE_OFFSET * 0.48) * state.avoidanceSide
        : 0;
    state.avoidanceOffset = moveToward(
      state.avoidanceOffset,
      targetOffset,
      Math.max(12, AVOIDANCE_OFFSET * 2.6) * Math.max(0, finite(dt))
    );

    if (Math.abs(state.avoidanceOffset) > 0.05) {
      const perpendicularX = -Math.sin(finite(slot.angle));
      const perpendicularY = Math.cos(finite(slot.angle));
      slot.x += perpendicularX * state.avoidanceOffset;
      slot.y += perpendicularY * state.avoidanceOffset;
      slot.container?.setPosition?.(slot.x, slot.y);
    }
    return result;
  };

  TrafficLocalBehaviorSystem.prototype.update = function viceBloodTrafficUpdate(...args) {
    ensureTrafficShotListener(this);
    return originalUpdate.apply(this, args);
  };

  TrafficLocalBehaviorSystem.prototype.destroy = function viceBloodTrafficDestroy(...args) {
    if (this.__viceBloodTrafficShotHandler) {
      this.scene?.events?.off?.("traffic:bullet-hit", this.__viceBloodTrafficShotHandler);
      this.__viceBloodTrafficShotHandler = null;
    }
    return originalDestroy.apply(this, args);
  };
}
