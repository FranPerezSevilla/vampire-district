import {
  TrafficMaterializationSystem,
  cameraWorldBounds,
  pointInsideCamera
} from "../streaming/TrafficMaterializationSystem.js";
import { TrafficLocalBehaviorSystem } from "../streaming/TrafficLocalBehaviorSystem.js";

const SPAWN_OFFSCREEN_MARGIN = 180;
const RETAIN_ONSCREEN_MARGIN = 120;
const ASSERTIVE_DRIVER_PERCENT = 28;
const ASSERTIVE_MIN_GAP = 22;

function finite(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function assertiveDriver(tokenId) {
  return stableHash(tokenId) % 100 < ASSERTIVE_DRIVER_PERCENT;
}

export function installTrafficPlaytestPolicy() {
  const materializer = TrafficMaterializationSystem?.prototype;
  if (materializer && !materializer.__nbdPlaytestVisibilityPolicy) {
    const originalEligible = materializer.eligible;
    materializer.eligible = function playtestTrafficEligible(token, assigned = false) {
      const camera = cameraWorldBounds(this.scene);
      if (camera) {
        if (!assigned && pointInsideCamera(token, camera, SPAWN_OFFSCREEN_MARGIN)) return false;
        if (assigned) {
          const slot = this.assignments?.get?.(token.tokenId);
          const point = slot || token;
          if (pointInsideCamera(point, camera, RETAIN_ONSCREEN_MARGIN)) {
            return this.pointReady(point, true);
          }
        }
      }
      return originalEligible.call(this, token, assigned);
    };
    Object.defineProperty(materializer, "__nbdPlaytestVisibilityPolicy", {
      value: true,
      configurable: true
    });
  }

  const behavior = TrafficLocalBehaviorSystem?.prototype;
  if (behavior && !behavior.__nbdPlaytestDriverTemperamentPolicy) {
    const originalDecisionFor = behavior.decisionFor;
    behavior.decisionFor = function playtestDriverTemperament(slot, state, token, active) {
      const decision = originalDecisionFor.call(this, slot, state, token, active);
      const temperament = assertiveDriver(token?.tokenId) ? "assertive" : "normal";
      state.driverTemperament = temperament;
      slot.driverTemperament = temperament;

      if (temperament !== "assertive") return decision;

      if (["traffic", "player-vehicle", "parked-vehicle"].includes(decision.reason)) {
        const gap = finite(decision.gap, Infinity);
        if (gap <= ASSERTIVE_MIN_GAP) return decision;
        const speedFloor = decision.reason === "traffic" ? 0.42 : 0.34;
        return {
          ...decision,
          desiredSpeedFactor: Math.max(finite(decision.desiredSpeedFactor), speedFloor),
          reason: `assertive-${decision.reason}`
        };
      }

      if (["cruise", "catch-up"].includes(decision.reason)) {
        return {
          ...decision,
          desiredSpeedFactor: Math.min(1.32, Math.max(1, finite(decision.desiredSpeedFactor)) * 1.08),
          reason: decision.reason === "catch-up" ? "assertive-catch-up" : "assertive-cruise"
        };
      }

      return decision;
    };
    Object.defineProperty(behavior, "__nbdPlaytestDriverTemperamentPolicy", {
      value: true,
      configurable: true
    });
  }
}
