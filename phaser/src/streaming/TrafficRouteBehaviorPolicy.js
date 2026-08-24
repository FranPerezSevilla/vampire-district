const EPSILON = 0.000001;

function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function moveToward(current, target, amount) {
  const from = finite(current);
  const to = finite(target);
  const step = Math.max(0, finite(amount));
  if (Math.abs(to - from) <= step) return to;
  return from + Math.sign(to - from) * step;
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function trafficGridlockInitiativeWinner(leftTokenId, rightTokenId) {
  const ids = [String(leftTokenId || ""), String(rightTokenId || "")].sort();
  if (!ids[0]) return ids[1] || null;
  if (!ids[1]) return ids[0];
  return stableHash(`${ids[0]}|${ids[1]}`) % 2 === 0 ? ids[0] : ids[1];
}

function polylineLength(points) {
  const list = Array.isArray(points) ? points : [];
  let total = 0;
  for (let index = 0; index < list.length - 1; index++) {
    total += Math.hypot(
      finite(list[index + 1]?.x) - finite(list[index]?.x),
      finite(list[index + 1]?.y) - finite(list[index]?.y)
    );
  }
  return total;
}

function nearestPointOnPolyline(points, x, y) {
  const list = Array.isArray(points) ? points : [];
  if (!list.length) return null;
  const total = polylineLength(list);
  if (list.length === 1 || total <= EPSILON) {
    return {
      progress: 0,
      distance: Math.hypot(finite(x) - finite(list[0]?.x), finite(y) - finite(list[0]?.y))
    };
  }

  let traversed = 0;
  let best = null;
  for (let index = 0; index < list.length - 1; index++) {
    const from = list[index];
    const to = list[index + 1];
    const ax = finite(from?.x);
    const ay = finite(from?.y);
    const dx = finite(to?.x) - ax;
    const dy = finite(to?.y) - ay;
    const length = Math.hypot(dx, dy);
    if (length <= EPSILON) continue;
    const local = clamp(((finite(x) - ax) * dx + (finite(y) - ay) * dy) / (length * length), 0, 1);
    const px = ax + dx * local;
    const py = ay + dy * local;
    const candidate = {
      progress: (traversed + length * local) / total,
      distance: Math.hypot(finite(x) - px, finite(y) - py)
    };
    if (!best || candidate.distance < best.distance) best = candidate;
    traversed += length;
  }
  return best;
}

function vehicleRadius(archetype) {
  return Math.max(finite(archetype?.width, 28), finite(archetype?.height, 14)) * 0.43;
}

function laneGeometry(topology, agent) {
  if (agent?.stage !== "lane" || !agent.currentLaneId) return null;
  const lane = topology?.lanes?.[agent.currentLaneId];
  if (!lane?.points?.length) return null;
  return {
    ...lane,
    length: Math.max(1, finite(lane.length, polylineLength(lane.points)))
  };
}

function blockerDecision(gap, reason, blockerId) {
  return {
    gap,
    reason,
    blockerId: blockerId || null
  };
}

export function createTrafficRouteBehaviorController(materializer, {
  topology,
  baseSpeed = 168
} = {}) {
  if (!materializer?.scene || !materializer?.assignments) {
    throw new TypeError("Route behavior controller requires TrafficMaterializationSystem.");
  }
  if (!topology?.lanes) {
    throw new TypeError("Route behavior controller requires compiler-owned local topology.");
  }

  const scene = materializer.scene;
  const states = new Map();
  let updates = 0;
  let brakingDecisions = 0;
  let stoppedDecisions = 0;
  let playerReactiveDecisions = 0;
  let followingDecisions = 0;
  let gridlockPushDecisions = 0;
  let gridlockYieldDecisions = 0;

  function tuning() {
    const behavior = scene.trafficLocalBehaviorSystem;
    return {
      followDistance: Math.max(24, finite(behavior?.followDistance, 78)),
      hardStopDistance: Math.max(8, finite(behavior?.hardStopDistance, 34)),
      playerLookAhead: Math.max(78, finite(behavior?.playerLookAhead, 132)),
      laneTolerance: Math.max(18, finite(behavior?.laneTolerance, 38)),
      accelerationRate: Math.max(0.1, finite(behavior?.accelerationRate, 1.35)),
      brakingRate: Math.max(1, finite(behavior?.brakingRate, 5.8)),
      gridlockBreakSeconds: Math.max(0.6, finite(behavior?.gridlockBreakSeconds, 1.2)),
      gridlockPushSpeedFactor: clamp(finite(behavior?.gridlockPushSpeedFactor, 0.28), 0.12, 0.55)
    };
  }

  function stateFor(agent) {
    let state = states.get(agent.tokenId);
    if (!state) {
      state = {
        tokenId: agent.tokenId,
        speedFactor: 1,
        desiredSpeedFactor: 1,
        reason: "route-cruise",
        gap: null,
        blockerId: null,
        stoppedSeconds: 0
      };
      states.set(agent.tokenId, state);
    }
    return state;
  }

  function nearestLead(agent, lane, agentsById, settings) {
    let best = null;
    const ownProgress = clamp(agent.stageProgress, 0, 1);
    const ownSlot = materializer.assignments.get(agent.tokenId);
    const ownRadius = Math.max(1, finite(ownSlot?.radius, 14));
    for (const other of agentsById.values()) {
      if (other.tokenId === agent.tokenId
        || other.stage !== "lane"
        || other.currentLaneId !== agent.currentLaneId) continue;
      const delta = clamp(other.stageProgress, 0, 1) - ownProgress;
      if (delta <= EPSILON) continue;
      const otherSlot = materializer.assignments.get(other.tokenId);
      const otherRadius = Math.max(1, finite(otherSlot?.radius, 14));
      const gap = delta * lane.length - ownRadius - otherRadius;
      if (gap > settings.followDistance) continue;
      const candidate = blockerDecision(gap, "traffic", other.tokenId);
      if (!best || candidate.gap < best.gap) best = candidate;
    }
    return best;
  }

  function projectedBlocker(agent, lane, x, y, radius, settings) {
    const projection = nearestPointOnPolyline(lane.points, x, y);
    if (!projection) return null;
    const ownSlot = materializer.assignments.get(agent.tokenId);
    const ownRadius = Math.max(1, finite(ownSlot?.radius, 14));
    if (projection.distance > settings.laneTolerance + Math.max(0, radius) + ownRadius) return null;
    const delta = projection.progress - clamp(agent.stageProgress, 0, 1);
    if (delta <= EPSILON) return null;
    return {
      gap: delta * lane.length - Math.max(0, radius) - ownRadius,
      projection
    };
  }

  function nearestPersistentBlocker(agent, lane, settings) {
    let best = null;
    const vehicleSystem = scene.vehicleSystem;
    const currentVehicleId = vehicleSystem?.currentVehicleId || null;
    for (const vehicle of vehicleSystem?.vehicles || []) {
      const radius = vehicleRadius(vehicle.archetype);
      const projected = projectedBlocker(agent, lane, vehicle.x, vehicle.y, radius, settings);
      if (!projected || projected.gap > settings.playerLookAhead) continue;
      const reason = vehicle.id === currentVehicleId ? "player-vehicle" : "parked-vehicle";
      const candidate = blockerDecision(projected.gap, reason, vehicle.id);
      if (!best || candidate.gap < best.gap) best = candidate;
    }

    if (!vehicleSystem?.isDriving?.() && scene.player) {
      const projected = projectedBlocker(agent, lane, scene.player.x, scene.player.y, 22, settings);
      if (projected && projected.gap <= settings.playerLookAhead) {
        const candidate = blockerDecision(projected.gap, "player-on-foot", "player");
        if (!best || candidate.gap < best.gap) best = candidate;
      }
    }
    return best;
  }

  function decisionFor(agent, state, agentsById, blockedById, settings) {
    if (agent.stage === "connector") {
      return {
        desiredSpeedFactor: 1,
        reason: "route-connector-clear",
        gap: null,
        blockerId: null
      };
    }

    const routeBlock = blockedById.get(agent.tokenId);
    if (routeBlock?.reason === "junction-yield") {
      return {
        desiredSpeedFactor: 0,
        reason: "junction-yield",
        gap: 0,
        blockerId: null
      };
    }

    const lane = laneGeometry(topology, agent);
    if (!lane) {
      return {
        desiredSpeedFactor: 0,
        reason: "route-missing-lane",
        gap: 0,
        blockerId: null
      };
    }

    const blockers = [
      nearestLead(agent, lane, agentsById, settings),
      nearestPersistentBlocker(agent, lane, settings)
    ].filter(Boolean).sort((left, right) => left.gap - right.gap || left.reason.localeCompare(right.reason));
    const blocker = blockers[0] || null;
    if (!blocker) {
      return {
        desiredSpeedFactor: 1,
        reason: "route-cruise",
        gap: null,
        blockerId: null
      };
    }

    if (blocker.reason === "traffic" && blocker.gap <= settings.hardStopDistance + 6) {
      const blockerState = states.get(blocker.blockerId);
      const ownSlot = materializer.assignments.get(agent.tokenId);
      if (state.stoppedSeconds >= settings.gridlockBreakSeconds
        && blockerState?.stoppedSeconds >= settings.gridlockBreakSeconds) {
        const winner = trafficGridlockInitiativeWinner(agent.tokenId, blocker.blockerId);
        if (winner === agent.tokenId && !ownSlot?.gridlockPushBlocked) {
          return {
            desiredSpeedFactor: settings.gridlockPushSpeedFactor,
            reason: "gridlock-push",
            gap: blocker.gap,
            blockerId: blocker.blockerId
          };
        }
        return {
          desiredSpeedFactor: 0,
          reason: ownSlot?.gridlockPushBlocked ? "gridlock-blocked" : "gridlock-yield",
          gap: blocker.gap,
          blockerId: blocker.blockerId
        };
      }
    }

    const persistent = ["player-vehicle", "player-on-foot", "parked-vehicle"].includes(blocker.reason);
    const responseDistance = persistent ? settings.playerLookAhead : settings.followDistance;
    let desiredSpeedFactor = 1;
    if (blocker.gap <= settings.hardStopDistance) desiredSpeedFactor = 0;
    else if (blocker.gap < responseDistance) {
      desiredSpeedFactor = clamp(
        (blocker.gap - settings.hardStopDistance)
          / Math.max(1, responseDistance - settings.hardStopDistance),
        0,
        1
      );
    }
    return {
      desiredSpeedFactor,
      reason: blocker.reason,
      gap: blocker.gap,
      blockerId: blocker.blockerId
    };
  }

  function applySlotState(agent, state) {
    const slot = materializer.assignments.get(agent.tokenId);
    if (!slot?.routeActive) return;
    slot.speedFactor = state.speedFactor;
    slot.desiredSpeedFactor = state.desiredSpeedFactor;
    slot.behaviorReason = state.reason;
    slot.behaviorGap = state.gap;
    slot.behaviorLag = 0;
    slot.behaviorBlockerId = state.blockerId;
    slot.engineSpeed = Math.max(0, finite(baseSpeed, 168) * state.speedFactor);
  }

  function update(runtime, seconds = 0.05) {
    const duration = Math.max(0, finite(seconds, 0.05));
    const settings = tuning();
    const agents = runtime?.agents?.() || [];
    const agentsById = new Map(agents.map(agent => [agent.tokenId, agent]));
    const blockedById = new Map((runtime?.snapshot?.().blocked || []).map(item => [item.tokenId, item]));
    const liveIds = new Set();

    for (const agent of agents) {
      liveIds.add(agent.tokenId);
      const state = stateFor(agent);
      const decision = decisionFor(agent, state, agentsById, blockedById, settings);
      const rate = decision.desiredSpeedFactor < state.speedFactor
        ? settings.brakingRate
        : settings.accelerationRate;
      state.desiredSpeedFactor = decision.desiredSpeedFactor;
      state.speedFactor = moveToward(state.speedFactor, decision.desiredSpeedFactor, rate * duration);
      if (decision.desiredSpeedFactor < 1) state.speedFactor = Math.min(state.speedFactor, 0.95);
      if (agent.stage === "connector") state.speedFactor = Math.max(state.speedFactor, 1);
      state.reason = decision.reason;
      state.gap = decision.gap;
      state.blockerId = decision.blockerId;
      state.stoppedSeconds = state.speedFactor <= 0.03
        ? state.stoppedSeconds + duration
        : 0;
      if (state.speedFactor < 0.95 && state.speedFactor > 0.03) brakingDecisions++;
      if (state.speedFactor <= 0.03) stoppedDecisions++;
      if (["player-vehicle", "player-on-foot"].includes(state.reason)) playerReactiveDecisions++;
      if (state.reason === "traffic") followingDecisions++;
      if (state.reason === "gridlock-push") gridlockPushDecisions++;
      if (["gridlock-yield", "gridlock-blocked"].includes(state.reason)) gridlockYieldDecisions++;
      applySlotState(agent, state);
    }

    for (const tokenId of states.keys()) {
      if (!liveIds.has(tokenId)) states.delete(tokenId);
    }
    updates++;
    return snapshot();
  }

  function speedFactor(tokenId, stage = "lane") {
    if (stage === "connector") return 1;
    return clamp(states.get(String(tokenId))?.speedFactor ?? 1, 0, 1.5);
  }

  function snapshot() {
    const vehicles = [...states.values()]
      .map(state => ({ ...state }))
      .sort((left, right) => left.tokenId.localeCompare(right.tokenId));
    return {
      active: true,
      movementAuthority: false,
      geometryAuthority: "compiler-local-topology",
      lateralSteeringAuthority: false,
      updates,
      activeVehicles: vehicles.length,
      brakingVehicles: vehicles.filter(item => item.speedFactor < 0.95 && item.speedFactor > 0.03).length,
      stoppedVehicles: vehicles.filter(item => item.speedFactor <= 0.03).length,
      playerReactiveVehicles: vehicles.filter(item => ["player-vehicle", "player-on-foot"].includes(item.reason)).length,
      followingVehicles: vehicles.filter(item => item.reason === "traffic").length,
      gridlockPushingVehicles: vehicles.filter(item => item.reason === "gridlock-push").length,
      gridlockYieldingVehicles: vehicles.filter(item => ["gridlock-yield", "gridlock-blocked"].includes(item.reason)).length,
      brakingDecisions,
      stoppedDecisions,
      playerReactiveDecisions,
      followingDecisions,
      gridlockPushDecisions,
      gridlockYieldDecisions,
      vehicles
    };
  }

  function clear() {
    states.clear();
  }

  return Object.freeze({
    update,
    speedFactor,
    snapshot,
    clear
  });
}
