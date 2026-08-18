import {
  TrafficMaterializationSystem,
  cameraWorldBounds,
  pointInsideCamera
} from "../streaming/TrafficMaterializationSystem.js";
import {
  TrafficLocalBehaviorSystem,
  wrapPhase
} from "../streaming/TrafficLocalBehaviorSystem.js";
import { installTrafficJunctionReservationPolicy } from "./TrafficJunctionReservationPolicy.js";

const SPAWN_OFFSCREEN_MARGIN = 180;
const RETAIN_ONSCREEN_MARGIN = 120;
const ASSERTIVE_DRIVER_PERCENT = 28;
const ASSERTIVE_MIN_GAP = 22;
const TRAFFIC_SEPARATION_CELL_SIZE = 96;
const TRAFFIC_SEPARATION_PADDING = 2;
const TRAFFIC_SEPARATION_PASSES = 2;

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

function baseBehaviorReason(reason) {
  return String(reason || "").replace(/^assertive-/, "");
}

function trafficRadius(slot) {
  return Math.max(8, finite(slot?.radius, 14));
}

function trafficCellKey(x, y, cellSize) {
  return `${Math.floor(finite(x) / cellSize)}:${Math.floor(finite(y) / cellSize)}`;
}

export function buildTrafficNeighborGrid(slots = [], cellSize = TRAFFIC_SEPARATION_CELL_SIZE) {
  const size = Math.max(24, finite(cellSize, TRAFFIC_SEPARATION_CELL_SIZE));
  const buckets = new Map();
  for (const slot of slots) {
    if (!slot) continue;
    const key = trafficCellKey(slot.x, slot.y, size);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(slot);
  }
  return { cellSize: size, buckets };
}

export function queryTrafficNeighborGrid(grid, x, y, radius = 48) {
  if (!grid?.buckets) return [];
  const size = Math.max(24, finite(grid.cellSize, TRAFFIC_SEPARATION_CELL_SIZE));
  const reach = Math.max(0, finite(radius, 48));
  const minX = Math.floor((finite(x) - reach) / size);
  const maxX = Math.floor((finite(x) + reach) / size);
  const minY = Math.floor((finite(y) - reach) / size);
  const maxY = Math.floor((finite(y) + reach) / size);
  const result = [];
  const seen = new Set();
  for (let cellY = minY; cellY <= maxY; cellY++) {
    for (let cellX = minX; cellX <= maxX; cellX++) {
      const bucket = grid.buckets.get(`${cellX}:${cellY}`) || [];
      for (const slot of bucket) {
        if (seen.has(slot)) continue;
        seen.add(slot);
        result.push(slot);
      }
    }
  }
  return result;
}

export function trafficOverlapAmount(left, right, padding = TRAFFIC_SEPARATION_PADDING) {
  if (!left || !right || left === right) return 0;
  const required = trafficRadius(left) + trafficRadius(right) + Math.max(0, finite(padding));
  const distance = Math.hypot(finite(left.x) - finite(right.x), finite(left.y) - finite(right.y));
  return Math.max(0, required - distance);
}

function sameTrafficLane(leftState, rightState) {
  return leftState?.edgeId === rightState?.edgeId && leftState?.direction === rightState?.direction;
}

export function chooseTrafficSeparationLoser(left, right, leftState = {}, rightState = {}) {
  if (sameTrafficLane(leftState, rightState)) {
    const leftToRight = wrapPhase(finite(rightState.visualTravel) - finite(leftState.visualTravel));
    const rightToLeft = wrapPhase(finite(leftState.visualTravel) - finite(rightState.visualTravel));
    if (Math.abs(leftToRight - rightToLeft) > 0.0001) {
      return leftToRight < rightToLeft ? left : right;
    }
  }

  const yieldingReasons = new Set(["junction-yield", "junction-reserved"]);
  const leftYielding = yieldingReasons.has(baseBehaviorReason(leftState.reason));
  const rightYielding = yieldingReasons.has(baseBehaviorReason(rightState.reason));
  if (leftYielding !== rightYielding) return leftYielding ? left : right;

  const leftId = String(leftState.tokenId || left?.tokenId || left?.slotIndex || "");
  const rightId = String(rightState.tokenId || right?.tokenId || right?.slotIndex || "");
  return leftId.localeCompare(rightId) > 0 ? left : right;
}

function retreatTrafficSlot(system, loser, winner, overlap, seconds) {
  const state = system.states?.get?.(loser?.tokenId);
  const winnerState = system.states?.get?.(winner?.tokenId);
  const lane = state ? system.laneFor?.(state) : null;
  if (!state || !lane || !Number.isFinite(lane.length) || lane.length <= 0) return false;

  const retreatDistance = Math.max(1, finite(overlap) + TRAFFIC_SEPARATION_PADDING + 1);
  const retreatPhase = Math.min(0.05, retreatDistance / lane.length);
  state.visualTravel -= retreatPhase;
  state.lag = Math.max(0, finite(state.authorityTravel) - finite(state.visualTravel));
  state.speedFactor = 0;
  state.desiredSpeedFactor = 0;
  state.reason = "traffic-separation";
  state.gap = 0;
  state.blockerId = winnerState?.tokenId || winner?.tokenId || null;
  state.junctionId = null;
  state.stoppedSeconds = Math.max(0, finite(state.stoppedSeconds)) + Math.max(0, finite(seconds));
  state.engineSpeed = 0;

  const sampled = system.sampleLane?.(lane, wrapPhase(state.visualTravel));
  if (!sampled) return false;
  loser.x = sampled.x;
  loser.y = sampled.y;
  loser.angle = sampled.angle;
  loser.phase = wrapPhase(state.visualTravel);
  loser.speedFactor = 0;
  loser.desiredSpeedFactor = 0;
  loser.behaviorReason = state.reason;
  loser.behaviorGap = 0;
  loser.behaviorLag = state.lag;
  loser.behaviorBlockerId = state.blockerId;
  loser.junctionId = null;
  loser.engineSpeed = 0;
  loser.container?.setPosition?.(loser.x, loser.y)?.setRotation?.(loser.angle);
  loser.visual?.label?.setRotation?.(-loser.angle);
  return true;
}

function resolveCivilianTrafficSeparation(system, seconds) {
  const slots = (system.materializer?.pool || [])
    .filter(slot => slot?.tokenId && slot.container?.active !== false)
    .sort((left, right) => finite(left.slotIndex) - finite(right.slotIndex));
  let neighborChecks = 0;
  let corrections = 0;

  for (let pass = 0; pass < TRAFFIC_SEPARATION_PASSES; pass++) {
    const grid = buildTrafficNeighborGrid(slots);
    let changed = false;
    for (const slot of slots) {
      const searchRadius = trafficRadius(slot) + 48;
      for (const other of queryTrafficNeighborGrid(grid, slot.x, slot.y, searchRadius)) {
        if (other === slot || finite(other.slotIndex) <= finite(slot.slotIndex)) continue;
        neighborChecks++;
        const overlap = trafficOverlapAmount(slot, other);
        if (overlap <= 0) continue;

        const slotState = system.states?.get?.(slot.tokenId) || {};
        const otherState = system.states?.get?.(other.tokenId) || {};
        const loser = chooseTrafficSeparationLoser(slot, other, slotState, otherState);
        const winner = loser === slot ? other : slot;
        if (retreatTrafficSlot(system, loser, winner, overlap, seconds)) {
          corrections++;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  system.__nbdTrafficSeparationMetrics = {
    activeVehicles: slots.length,
    neighborChecks,
    corrections
  };
  return system.__nbdTrafficSeparationMetrics;
}

export function installTrafficPlaytestPolicy() {
  installTrafficJunctionReservationPolicy();

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
    const originalSnapshot = behavior.snapshot;
    const originalUpdate = behavior.update;
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
    behavior.update = function playtestTrafficSeparationUpdate(dt = 0, options = {}) {
      const result = originalUpdate.call(this, dt, options);
      if (!result || this.destroyed || !this.ready || this.scene.registry?.get?.("uiPaused")) return result;
      const metrics = resolveCivilianTrafficSeparation(this, dt);
      if (metrics.corrections > 0) this.publish?.(true);
      return result;
    };
    behavior.snapshot = function playtestDriverTemperamentSnapshot() {
      const snapshot = originalSnapshot.call(this);
      const vehicles = Array.isArray(snapshot.vehicles) ? snapshot.vehicles : [];
      const separation = this.__nbdTrafficSeparationMetrics || {};
      return {
        ...snapshot,
        yieldingVehicles: vehicles.filter(item => baseBehaviorReason(item.reason).startsWith("junction")).length,
        followingVehicles: vehicles.filter(item => baseBehaviorReason(item.reason) === "traffic").length,
        playerReactiveVehicles: vehicles.filter(item => [
          "player-vehicle",
          "player-on-foot",
          "junction-player"
        ].includes(baseBehaviorReason(item.reason))).length,
        trafficSeparationCorrections: Math.max(0, finite(separation.corrections)),
        trafficNeighborChecks: Math.max(0, finite(separation.neighborChecks))
      };
    };
    Object.defineProperty(behavior, "__nbdPlaytestDriverTemperamentPolicy", {
      value: true,
      configurable: true
    });
  }
}
