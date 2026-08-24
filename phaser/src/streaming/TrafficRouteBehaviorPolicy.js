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

export const TRAFFIC_ROUTE_BEHAVIOR_STATE = Object.freeze({
  CRUISE: "cruise",
  CONNECTOR: "connector",
  FOLLOW: "follow",
  YIELD_JUNCTION: "yield-junction",
  STOPPED_TRAFFIC: "stopped-traffic",
  RECOVER_TRAFFIC: "recover-traffic",
  STOPPED_STATIC: "stopped-static",
  RECOVER_STATIC: "recover-static",
  BLOCKED_PLAYER: "blocked-player",
  MISSING_ROUTE: "missing-route"
});

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

function blockerDecision(gap, reason, blockerId, blockerKind = null) {
  return { gap, reason, blockerId: blockerId || null, blockerKind };
}

function routeState(reason) {
  switch (reason) {
    case "route-connector-clear": return TRAFFIC_ROUTE_BEHAVIOR_STATE.CONNECTOR;
    case "junction-yield": return TRAFFIC_ROUTE_BEHAVIOR_STATE.YIELD_JUNCTION;
    case "route-missing-lane": return TRAFFIC_ROUTE_BEHAVIOR_STATE.MISSING_ROUTE;
    case "traffic": return TRAFFIC_ROUTE_BEHAVIOR_STATE.FOLLOW;
    case "gridlock-push": return TRAFFIC_ROUTE_BEHAVIOR_STATE.RECOVER_TRAFFIC;
    case "gridlock-yield":
    case "gridlock-blocked": return TRAFFIC_ROUTE_BEHAVIOR_STATE.STOPPED_TRAFFIC;
    case "parked-vehicle": return TRAFFIC_ROUTE_BEHAVIOR_STATE.STOPPED_STATIC;
    case "parked-vehicle-recovery": return TRAFFIC_ROUTE_BEHAVIOR_STATE.RECOVER_STATIC;
    case "player-vehicle":
    case "player-on-foot": return TRAFFIC_ROUTE_BEHAVIOR_STATE.BLOCKED_PLAYER;
    default: return TRAFFIC_ROUTE_BEHAVIOR_STATE.CRUISE;
  }
}

export function createTrafficRouteBehaviorController(materializer, {
  topology,
  baseSpeed = 112
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
  let staticRecoveryDecisions = 0;

  function tuning() {
    const behavior = scene.trafficLocalBehaviorSystem;
    return {
      followDistance: Math.max(24, finite(behavior?.followDistance, 78)),
      hardStopDistance: Math.max(8, finite(behavior?.hardStopDistance, 34)),
      persistentLookAhead: Math.max(78, finite(behavior?.playerLookAhead, 132)),
      laneTolerance: Math.max(18, finite(behavior?.laneTolerance, 38)),
      accelerationRate: Math.max(0.1, finite(behavior?.accelerationRate, 1.35)),
      brakingRate: Math.max(1, finite(behavior?.brakingRate, 5.8)),
      trafficRecoveryDelay: Math.max(0.8, finite(behavior?.gridlockBreakSeconds, 1.4)),
      staticRecoveryDelay: Math.max(1.2, finite(behavior?.staticRecoveryDelay, 2.0)),
      recoveryActionInterval: Math.max(0.12, finite(behavior?.recoveryActionInterval, 0.2)),
      trafficRecoverySpeedFactor: clamp(finite(behavior?.gridlockPushSpeedFactor, 0.2), 0.1, 0.35),
      staticRecoverySpeedFactor: clamp(finite(behavior?.staticRecoverySpeedFactor, 0.14), 0.08, 0.25)
    };
  }

  function stateFor(agent) {
    let state = states.get(agent.tokenId);
    if (!state) {
      state = {
        tokenId: agent.tokenId,
        fsmState: TRAFFIC_ROUTE_BEHAVIOR_STATE.CRUISE,
        previousState: null,
        stateSeconds: 0,
        speedFactor: 1,
        desiredSpeedFactor: 1,
        reason: "route-cruise",
        gap: null,
        blockerId: null,
        blockerKind: null,
        stoppedSeconds: 0,
        recoveryAttempts: 0,
        recoveryBlocked: false,
        recoveryCooldownSeconds: 0
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
      const candidate = blockerDecision(gap, "traffic", other.tokenId, "route-traffic");
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
      if (!projected || projected.gap > settings.persistentLookAhead) continue;
      const driven = vehicle.id === currentVehicleId;
      const candidate = blockerDecision(
        projected.gap,
        driven ? "player-vehicle" : "parked-vehicle",
        vehicle.id,
        driven ? "driven-vehicle" : "persistent-vehicle"
      );
      if (!best || candidate.gap < best.gap) best = candidate;
    }

    if (!vehicleSystem?.isDriving?.() && scene.player) {
      const projected = projectedBlocker(agent, lane, scene.player.x, scene.player.y, 22, settings);
      if (projected && projected.gap <= settings.persistentLookAhead) {
        const candidate = blockerDecision(projected.gap, "player-on-foot", "player", "player");
        if (!best || candidate.gap < best.gap) best = candidate;
      }
    }
    return best;
  }

  function transition(state, nextState, duration, nextBlockerId) {
    const changed = nextState !== state.fsmState || nextBlockerId !== state.blockerId;
    if (changed) {
      state.previousState = state.fsmState;
      state.fsmState = nextState;
      state.stateSeconds = 0;
      state.recoveryBlocked = false;
      state.recoveryCooldownSeconds = 0;
    } else {
      state.stateSeconds += duration;
    }
  }

  function trafficDecision(agent, state, blocker, settings) {
    const immediate = blocker.gap <= settings.hardStopDistance + 6;
    if (!immediate) {
      const factor = clamp(
        (blocker.gap - settings.hardStopDistance)
          / Math.max(1, settings.followDistance - settings.hardStopDistance),
        0,
        1
      );
      return {
        fsmState: TRAFFIC_ROUTE_BEHAVIOR_STATE.FOLLOW,
        desiredSpeedFactor: factor,
        reason: "traffic",
        ...blocker
      };
    }

    if (state.fsmState === TRAFFIC_ROUTE_BEHAVIOR_STATE.RECOVER_TRAFFIC
      && state.blockerId === blocker.blockerId
      && !state.recoveryBlocked) {
      return {
        fsmState: TRAFFIC_ROUTE_BEHAVIOR_STATE.RECOVER_TRAFFIC,
        desiredSpeedFactor: settings.trafficRecoverySpeedFactor,
        reason: "gridlock-push",
        ...blocker
      };
    }

    const blockerState = states.get(blocker.blockerId);
    const canRecover = state.stoppedSeconds >= settings.trafficRecoveryDelay
      && blockerState?.stoppedSeconds >= settings.trafficRecoveryDelay
      && trafficGridlockInitiativeWinner(agent.tokenId, blocker.blockerId) === agent.tokenId;
    if (canRecover && !state.recoveryBlocked) {
      return {
        fsmState: TRAFFIC_ROUTE_BEHAVIOR_STATE.RECOVER_TRAFFIC,
        desiredSpeedFactor: settings.trafficRecoverySpeedFactor,
        reason: "gridlock-push",
        ...blocker
      };
    }
    return {
      fsmState: TRAFFIC_ROUTE_BEHAVIOR_STATE.STOPPED_TRAFFIC,
      desiredSpeedFactor: 0,
      reason: state.recoveryBlocked ? "gridlock-blocked" : "gridlock-yield",
      ...blocker
    };
  }

  function persistentDecision(state, blocker, settings) {
    if (["player-vehicle", "player-on-foot"].includes(blocker.reason)) {
      const desired = blocker.gap <= settings.hardStopDistance
        ? 0
        : clamp(
            (blocker.gap - settings.hardStopDistance)
              / Math.max(1, settings.persistentLookAhead - settings.hardStopDistance),
            0,
            1
          );
      return {
        fsmState: TRAFFIC_ROUTE_BEHAVIOR_STATE.BLOCKED_PLAYER,
        desiredSpeedFactor: desired,
        ...blocker
      };
    }

    if (blocker.gap > settings.hardStopDistance) {
      return {
        fsmState: TRAFFIC_ROUTE_BEHAVIOR_STATE.STOPPED_STATIC,
        desiredSpeedFactor: clamp(
          (blocker.gap - settings.hardStopDistance)
            / Math.max(1, settings.persistentLookAhead - settings.hardStopDistance),
          0,
          1
        ),
        ...blocker
      };
    }

    if (state.fsmState === TRAFFIC_ROUTE_BEHAVIOR_STATE.RECOVER_STATIC
      && state.blockerId === blocker.blockerId
      && !state.recoveryBlocked) {
      return {
        fsmState: TRAFFIC_ROUTE_BEHAVIOR_STATE.RECOVER_STATIC,
        desiredSpeedFactor: settings.staticRecoverySpeedFactor,
        reason: "parked-vehicle-recovery",
        ...blocker
      };
    }

    if (state.stoppedSeconds >= settings.staticRecoveryDelay && !state.recoveryBlocked) {
      return {
        fsmState: TRAFFIC_ROUTE_BEHAVIOR_STATE.RECOVER_STATIC,
        desiredSpeedFactor: settings.staticRecoverySpeedFactor,
        reason: "parked-vehicle-recovery",
        ...blocker
      };
    }

    return {
      fsmState: TRAFFIC_ROUTE_BEHAVIOR_STATE.STOPPED_STATIC,
      desiredSpeedFactor: 0,
      ...blocker
    };
  }

  function decisionFor(agent, state, agentsById, blockedById, settings) {
    if (agent.stage === "connector") {
      return {
        fsmState: TRAFFIC_ROUTE_BEHAVIOR_STATE.CONNECTOR,
        desiredSpeedFactor: 1,
        reason: "route-connector-clear",
        gap: null,
        blockerId: null,
        blockerKind: null
      };
    }

    const routeBlock = blockedById.get(agent.tokenId);
    if (routeBlock?.reason === "junction-yield") {
      return {
        fsmState: TRAFFIC_ROUTE_BEHAVIOR_STATE.YIELD_JUNCTION,
        desiredSpeedFactor: 0,
        reason: "junction-yield",
        gap: 0,
        blockerId: null,
        blockerKind: "junction"
      };
    }

    const lane = laneGeometry(topology, agent);
    if (!lane) {
      return {
        fsmState: TRAFFIC_ROUTE_BEHAVIOR_STATE.MISSING_ROUTE,
        desiredSpeedFactor: 0,
        reason: "route-missing-lane",
        gap: 0,
        blockerId: null,
        blockerKind: "route"
      };
    }

    const blockers = [
      nearestLead(agent, lane, agentsById, settings),
      nearestPersistentBlocker(agent, lane, settings)
    ].filter(Boolean).sort((left, right) => left.gap - right.gap || left.reason.localeCompare(right.reason));
    const blocker = blockers[0] || null;
    if (!blocker) {
      return {
        fsmState: TRAFFIC_ROUTE_BEHAVIOR_STATE.CRUISE,
        desiredSpeedFactor: 1,
        reason: "route-cruise",
        gap: null,
        blockerId: null,
        blockerKind: null
      };
    }

    if (blocker.reason === "traffic") return trafficDecision(agent, state, blocker, settings);
    return persistentDecision(state, blocker, settings);
  }

  function applySlotState(agent, state) {
    const slot = materializer.assignments.get(agent.tokenId);
    if (!slot?.routeActive) return;
    slot.speedFactor = clamp(state.speedFactor, 0, 1);
    slot.desiredSpeedFactor = clamp(state.desiredSpeedFactor, 0, 1);
    slot.behaviorState = state.fsmState;
    slot.behaviorReason = state.reason;
    slot.behaviorGap = state.gap;
    slot.behaviorLag = 0;
    slot.behaviorBlockerId = state.blockerId;
    slot.behaviorBlockerKind = state.blockerKind;
    slot.engineSpeed = Math.max(0, finite(baseSpeed, 112) * slot.speedFactor);
  }

  function executeTrafficRecovery(state) {
    const physical = scene.trafficPhysicalConsequencesSystem;
    const pusher = materializer.assignments.get(state.tokenId);
    const target = materializer.assignments.get(state.blockerId);
    if (!physical?.stateFor || !physical?.applyStateOffset || !pusher || !target) return false;

    const targetState = physical.stateFor(target);
    if (!targetState) return false;
    const dx = finite(target.x) - finite(pusher.x);
    const dy = finite(target.y) - finite(pusher.y);
    const length = Math.max(1, Math.hypot(dx, dy));
    const impulse = clamp(2 + Math.max(0, finite(pusher.engineSpeed)) * 0.018, 2, 7);
    const nextOffsetX = finite(targetState.offsetX) + (dx / length) * impulse;
    const nextOffsetY = finite(targetState.offsetY) + (dy / length) * impulse;
    if (Math.hypot(nextOffsetX, nextOffsetY) > Math.max(8, finite(physical.maxOffset, 44))) return false;
    const nextX = finite(targetState.baseX, target.x) + nextOffsetX;
    const nextY = finite(targetState.baseY, target.y) + nextOffsetY;
    if (typeof physical.proxyWorldSafe === "function" && !physical.proxyWorldSafe(target, nextX, nextY)) return false;

    targetState.offsetX = nextOffsetX;
    targetState.offsetY = nextOffsetY;
    targetState.holdSeconds = Math.max(finite(targetState.holdSeconds), 0.12);
    targetState.lastVehicleId = `traffic:${pusher.tokenId}`;
    targetState.lastReason = "traffic-recovery";
    targetState.pushes = Math.max(0, Math.floor(finite(targetState.pushes))) + 1;
    physical.totalContacts = Math.max(0, Math.floor(finite(physical.totalContacts))) + 1;
    physical.totalPushes = Math.max(0, Math.floor(finite(physical.totalPushes))) + 1;
    physical.applyStateOffset(target, targetState);
    return true;
  }

  function persistentVehicleSafe(vehicle, x, y) {
    const vehicleSystem = scene.vehicleSystem;
    const radius = vehicleRadius(vehicle?.archetype);
    if (typeof vehicleSystem?.canOccupy === "function" && !vehicleSystem.canOccupy(vehicle, x, y, finite(vehicle.angle))) {
      return false;
    }
    for (const slot of materializer.pool || []) {
      if (!slot?.tokenId || slot.tokenId === vehicle?.trafficTokenId) continue;
      if (Math.hypot(finite(slot.x) - x, finite(slot.y) - y) < Math.max(1, finite(slot.radius, 14)) + radius + 1) {
        return false;
      }
    }
    return true;
  }

  function executeStaticRecovery(state) {
    const vehicleSystem = scene.vehicleSystem;
    const slot = materializer.assignments.get(state.tokenId);
    const vehicle = vehicleSystem?.vehicle?.(state.blockerId)
      || vehicleSystem?.vehicles?.find?.(candidate => candidate.id === state.blockerId);
    if (!slot || !vehicle || vehicle.id === vehicleSystem?.currentVehicleId) return false;

    const angle = finite(slot.angle);
    const side = stableHash(`${slot.tokenId}|${vehicle.id}`) % 2 === 0 ? 1 : -1;
    const step = 5;
    const offsetX = Math.cos(angle + Math.PI / 2) * step * side;
    const offsetY = Math.sin(angle + Math.PI / 2) * step * side;
    const nextX = finite(vehicle.x) + offsetX;
    const nextY = finite(vehicle.y) + offsetY;
    if (!persistentVehicleSafe(vehicle, nextX, nextY)) return false;

    vehicle.x = nextX;
    vehicle.y = nextY;
    vehicle.speed = 0;
    vehicle.velocityX = 0;
    vehicle.velocityY = 0;
    vehicle.parked = true;
    vehicle.container?.setPosition?.(nextX, nextY);
    vehicleSystem?.persistVehicle?.(vehicle);
    return true;
  }

  function executeRecovery(state, settings) {
    if (state.recoveryCooldownSeconds > EPSILON) return null;
    let success = null;
    if (state.fsmState === TRAFFIC_ROUTE_BEHAVIOR_STATE.RECOVER_TRAFFIC) {
      state.recoveryAttempts++;
      success = executeTrafficRecovery(state);
    } else if (state.fsmState === TRAFFIC_ROUTE_BEHAVIOR_STATE.RECOVER_STATIC) {
      state.recoveryAttempts++;
      success = executeStaticRecovery(state);
    }
    if (success === null) return null;
    state.recoveryBlocked = !success;
    state.recoveryCooldownSeconds = success ? settings.recoveryActionInterval : 0;
    return success;
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
      state.recoveryCooldownSeconds = Math.max(0, finite(state.recoveryCooldownSeconds) - duration);
      const decision = decisionFor(agent, state, agentsById, blockedById, settings);
      transition(state, decision.fsmState || routeState(decision.reason), duration, decision.blockerId);

      const rate = decision.desiredSpeedFactor < state.speedFactor
        ? settings.brakingRate
        : settings.accelerationRate;
      state.desiredSpeedFactor = clamp(decision.desiredSpeedFactor, 0, 1);
      state.speedFactor = clamp(
        moveToward(state.speedFactor, state.desiredSpeedFactor, rate * duration),
        0,
        1
      );
      if (state.desiredSpeedFactor < 1) state.speedFactor = Math.min(state.speedFactor, 0.95);
      state.reason = decision.reason;
      state.gap = decision.gap;
      state.blockerId = decision.blockerId;
      state.blockerKind = decision.blockerKind || null;
      state.stoppedSeconds = state.speedFactor <= 0.03
        ? state.stoppedSeconds + duration
        : state.fsmState === TRAFFIC_ROUTE_BEHAVIOR_STATE.RECOVER_TRAFFIC
          || state.fsmState === TRAFFIC_ROUTE_BEHAVIOR_STATE.RECOVER_STATIC
          ? state.stoppedSeconds
          : 0;

      if (state.speedFactor < 0.95 && state.speedFactor > 0.03) brakingDecisions++;
      if (state.speedFactor <= 0.03) stoppedDecisions++;
      if (state.fsmState === TRAFFIC_ROUTE_BEHAVIOR_STATE.BLOCKED_PLAYER) playerReactiveDecisions++;
      if (state.fsmState === TRAFFIC_ROUTE_BEHAVIOR_STATE.FOLLOW) followingDecisions++;
      if (state.fsmState === TRAFFIC_ROUTE_BEHAVIOR_STATE.RECOVER_TRAFFIC) gridlockPushDecisions++;
      if (state.fsmState === TRAFFIC_ROUTE_BEHAVIOR_STATE.STOPPED_TRAFFIC) gridlockYieldDecisions++;
      if (state.fsmState === TRAFFIC_ROUTE_BEHAVIOR_STATE.RECOVER_STATIC) staticRecoveryDecisions++;

      applySlotState(agent, state);
      executeRecovery(state, settings);
    }

    for (const tokenId of states.keys()) {
      if (!liveIds.has(tokenId)) states.delete(tokenId);
    }
    updates++;
    return snapshot();
  }

  function speedFactor(tokenId, _stage = "lane") {
    return clamp(states.get(String(tokenId))?.speedFactor ?? 1, 0, 1);
  }

  function snapshot() {
    const vehicles = [...states.values()]
      .map(state => ({ ...state }))
      .sort((left, right) => left.tokenId.localeCompare(right.tokenId));
    return {
      active: true,
      architecture: "explicit-route-behavior-fsm",
      movementAuthority: false,
      geometryAuthority: "compiler-local-topology",
      lateralSteeringAuthority: false,
      speedAuthority: "route-behavior-fsm",
      maximumSpeedFactor: 1,
      baseSpeed: Math.max(0, finite(baseSpeed, 112)),
      updates,
      activeVehicles: vehicles.length,
      brakingVehicles: vehicles.filter(item => item.speedFactor < 0.95 && item.speedFactor > 0.03).length,
      stoppedVehicles: vehicles.filter(item => item.speedFactor <= 0.03).length,
      playerReactiveVehicles: vehicles.filter(item => item.fsmState === TRAFFIC_ROUTE_BEHAVIOR_STATE.BLOCKED_PLAYER).length,
      followingVehicles: vehicles.filter(item => item.fsmState === TRAFFIC_ROUTE_BEHAVIOR_STATE.FOLLOW).length,
      gridlockPushingVehicles: vehicles.filter(item => item.fsmState === TRAFFIC_ROUTE_BEHAVIOR_STATE.RECOVER_TRAFFIC).length,
      gridlockYieldingVehicles: vehicles.filter(item => item.fsmState === TRAFFIC_ROUTE_BEHAVIOR_STATE.STOPPED_TRAFFIC).length,
      staticRecoveringVehicles: vehicles.filter(item => item.fsmState === TRAFFIC_ROUTE_BEHAVIOR_STATE.RECOVER_STATIC).length,
      brakingDecisions,
      stoppedDecisions,
      playerReactiveDecisions,
      followingDecisions,
      gridlockPushDecisions,
      gridlockYieldDecisions,
      staticRecoveryDecisions,
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
