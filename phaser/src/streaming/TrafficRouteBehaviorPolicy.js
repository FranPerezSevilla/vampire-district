import { trafficRouteLookAhead, projectTrafficRouteAhead, trafficRouteStageGeometry } from "./TrafficRouteCursor.js";
import { executeDrivenVehiclePressure } from "./TrafficRecoveryActuator.js";
import {
  installTrafficBypassManeuverPolicy,
  planTrafficBypass,
  trafficBypassPoseSafe
} from "./TrafficBypassManeuverPolicy.js";

const EPSILON = 0.000001;
const GUNSHOT_PANIC_RADIUS = 260;
const GUNSHOT_PANIC_SECONDS = 4.2;

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
  PANIC: "panic",
  FOLLOW: "follow",
  YIELD_JUNCTION: "yield-junction",
  PHYSICAL_HOLD: "physical-hold",
  STOPPED_TRAFFIC: "stopped-traffic",
  ASSESS_BYPASS: "assess-bypass",
  BYPASS_LEFT: "bypass-left",
  BYPASS_RIGHT: "bypass-right",
  REJOIN_ROUTE: "rejoin-route",
  // Retained as historical snapshot keys. Production navigation no longer enters
  // these shove-style recovery states.
  RECOVER_TRAFFIC: "recover-traffic",
  STOPPED_STATIC: "stopped-static",
  RECOVER_STATIC: "recover-static",
  BLOCKED_PLAYER: "blocked-player",
  MISSING_ROUTE: "missing-route"
});

function vehicleRadius(archetype) {
  return Math.max(finite(archetype?.width, 28), finite(archetype?.height, 14)) * 0.43;
}

function blockerDecision(gap, reason, blockerId, blockerKind = null, details = {}) {
  return { gap, reason, blockerId: blockerId || null, blockerKind, ...details };
}

function bypassStateForSide(side) {
  return side < 0
    ? TRAFFIC_ROUTE_BEHAVIOR_STATE.BYPASS_LEFT
    : TRAFFIC_ROUTE_BEHAVIOR_STATE.BYPASS_RIGHT;
}

function bypassState(state) {
  return [
    TRAFFIC_ROUTE_BEHAVIOR_STATE.BYPASS_LEFT,
    TRAFFIC_ROUTE_BEHAVIOR_STATE.BYPASS_RIGHT
  ].includes(state?.fsmState);
}

function maneuverActive(state) {
  return Boolean(state?.bypassSide) || Math.abs(finite(state?.bypassOffset)) > 0.01;
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
  const bypassPolicy = installTrafficBypassManeuverPolicy(materializer);
  let updates = 0;
  let brakingDecisions = 0;
  let stoppedDecisions = 0;
  let playerReactiveDecisions = 0;
  let playerPressureDecisions = 0;
  let playerPressureActions = 0;
  let followingDecisions = 0;
  let physicalHoldDecisions = 0;
  let trafficRecoveryDecisions = 0;
  let trafficRecoveryActions = 0;
  let staticRecoveryDecisions = 0;
  let staticRecoveryActions = 0;
  let bypassAssessments = 0;
  let bypassCommitments = 0;
  let bypassBlockedFrames = 0;
  let bypassCompletions = 0;
  let panicDecisions = 0;
  let gunshotThreatEvents = 0;
  let disposed = false;

  function tuning() {
    const behavior = scene.trafficLocalBehaviorSystem;
    const legacyPushFactor = clamp(finite(behavior?.gridlockPushSpeedFactor, 0.25), 0.14, 0.4);
    return {
      followDistance: Math.max(150, finite(behavior?.followDistance, 150)),
      hardStopDistance: clamp(finite(behavior?.hardStopDistance, 34) * 0.78, 20, 30),
      persistentLookAhead: Math.max(100, finite(behavior?.playerLookAhead, 132)),
      laneTolerance: Math.max(18, finite(behavior?.laneTolerance, 38)),
      pedestrianLaneTolerance: clamp(finite(behavior?.pedestrianLaneTolerance, 18), 14, 24),
      accelerationRate: 0.85,
      panicAccelerationRate: Math.max(3.4, finite(behavior?.panicAccelerationRate, 3.8)),
      brakingRate: 2.4,
      trafficRecoveryDelay: clamp(finite(behavior?.gridlockBreakSeconds, 1.4) * 0.58, 0.55, 0.9),
      panicRecoveryDelay: clamp(finite(behavior?.panicRecoveryDelay, 0.3), 0.18, 0.45),
      staticRecoveryDelay: clamp(finite(behavior?.staticRecoveryDelay, 2.0) * 0.62, 0.85, 1.3),
      playerPressureDelay: clamp(finite(behavior?.playerPressureDelay, 1.15), 0.8, 1.8),
      maxPlayerPressureAttempts: Math.max(2, Math.min(8, Math.floor(finite(behavior?.maxPlayerPressureAttempts, 6)))),
      recoveryActionInterval: Math.max(0.12, finite(behavior?.recoveryActionInterval, 0.18)),
      failedRecoveryBackoff: Math.max(0.35, finite(behavior?.failedRecoveryBackoff, 0.65)),
      bypassSpeedFactor: clamp(finite(behavior?.bypassSpeedFactor, legacyPushFactor * 1.35), 0.28, 0.48),
      bypassRejoinSpeedFactor: clamp(finite(behavior?.bypassRejoinSpeedFactor, 0.52), 0.36, 0.7),
      bypassLateralRate: clamp(finite(behavior?.bypassLateralRate, 52), 28, 72),
      bypassAngleRate: clamp(finite(behavior?.bypassAngleRate, 2.8), 1.4, 4.5),
      bypassSteeringLimit: clamp(finite(behavior?.bypassSteeringLimit, 0.38), 0.2, 0.52),
      bypassForwardProbe: clamp(finite(behavior?.bypassForwardProbe, 18), 8, 28),
      bypassBlockedAbortSeconds: clamp(finite(behavior?.bypassBlockedAbortSeconds, 0.85), 0.5, 1.6)
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
        recoverySuccesses: 0,
        recoveryBlocked: false,
        recoveryCooldownSeconds: 0,
        panicSeconds: 0,
        panicSourceX: null,
        panicSourceY: null,
        lastRecoveryReason: null,
        bypassSide: 0,
        bypassTargetOffset: 0,
        bypassOffset: 0,
        bypassAngleDelta: 0,
        bypassBlockerId: null,
        bypassBlockerKind: null,
        bypassBlockedSeconds: 0,
        bypassPlanAttempts: 0,
        bypassSuccesses: 0,
        lastBypassReason: null
      };
      states.set(agent.tokenId, state);
    }
    return state;
  }

  function onWeaponFired() {
    if (disposed || scene.currentLayer == null) return;
    const sourceX = finite(scene.player?.x);
    const sourceY = finite(scene.player?.y);
    let threatened = 0;
    for (const [tokenId, slot] of materializer.assignments) {
      if (!slot?.routeActive) continue;
      if (Math.hypot(finite(slot.x) - sourceX, finite(slot.y) - sourceY) > GUNSHOT_PANIC_RADIUS) continue;
      const state = states.get(tokenId) || stateFor({ tokenId });
      const jitter = (stableHash(tokenId) % 9) * 0.08;
      state.panicSeconds = Math.max(state.panicSeconds, GUNSHOT_PANIC_SECONDS + jitter);
      state.panicSourceX = sourceX;
      state.panicSourceY = sourceY;
      threatened++;
    }
    if (threatened) gunshotThreatEvents++;
  }

  scene.events?.on?.("weapon:fired", onWeaponFired);

  function nearestLead(agent, lane, agentsById, settings) {
    let best = null;
    const ownSlot = materializer.assignments.get(agent.tokenId);
    const ownRadius = Math.max(1, finite(ownSlot?.radius, 14));
    const path = trafficRouteLookAhead(topology, agent, settings.followDistance + 50);
    for (const other of agentsById.values()) {
      if (other.tokenId === agent.tokenId) continue;
      const otherSlot = materializer.assignments.get(other.tokenId);
      if (!otherSlot) continue;
      const projection = projectTrafficRouteAhead(path, otherSlot.x, otherSlot.y);
      const lateral = finite(ownSlot?.archetype?.height, 14) * 0.41
        + finite(otherSlot.archetype?.height, 14) * 0.41 + 2;
      if (!projection || projection.along <= EPSILON || projection.distance > lateral) continue;
      // Cross traffic is admitted by junction flow. Following looks at vehicles
      // travelling with us, including leaders beyond a lane/connector seam.
      if (Math.cos(finite(otherSlot.angle) - projection.angle) < 0.5) continue;
      const gap = projection.along - ownRadius - Math.max(1, finite(otherSlot.radius, 14));
      if (gap > settings.followDistance) continue;
      const candidate = blockerDecision(gap, "traffic", other.tokenId, "route-traffic", {
        leadSpeed: Math.max(0, finite(otherSlot.engineSpeed)),
        queuedAtJunction: String(otherSlot.behaviorReason || "").includes("junction")
      });
      if (!best || candidate.gap < best.gap) best = candidate;
    }
    return best;
  }

  function projectedBlocker(agent, lane, x, y, radius, settings) {
    const projection = projectTrafficRouteAhead(trafficRouteLookAhead(topology, agent, settings.persistentLookAhead + 50), x, y);
    if (!projection) return null;
    const ownSlot = materializer.assignments.get(agent.tokenId);
    const ownRadius = Math.max(1, finite(ownSlot?.radius, 14));
    if (projection.distance > finite(ownSlot?.archetype?.height, 14) * 0.41 + Math.max(0, radius) * 0.5 + 3) return null;
    const delta = projection.along;
    if (delta <= EPSILON) return null;
    return {
      gap: delta - Math.max(0, radius) - ownRadius,
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
      const projected = projectedBlocker(agent, lane, scene.player.x, scene.player.y, 8, settings);
      if (projected
        && projected.gap <= settings.persistentLookAhead
        && projected.projection.distance <= settings.pedestrianLaneTolerance) {
        const candidate = blockerDecision(
          projected.gap,
          "player-on-foot",
          "player",
          "player",
          { lateralDistance: projected.projection.distance }
        );
        if (!best || candidate.gap < best.gap) best = candidate;
      }
    }
    return best;
  }

  function transition(state, decision, duration) {
    const nextState = decision.fsmState;
    const nextBlockerId = decision.blockerId || null;
    const blockerChanged = nextBlockerId !== state.blockerId;
    const stateChanged = nextState !== state.fsmState;
    if (stateChanged || blockerChanged) {
      state.previousState = state.fsmState;
      state.fsmState = nextState;
      state.stateSeconds = 0;
      if (blockerChanged) {
        state.recoveryBlocked = false;
        state.recoveryCooldownSeconds = 0;
        state.recoveryAttempts = 0;
        state.recoverySuccesses = 0;
        state.lastRecoveryReason = null;
      }
    } else {
      state.stateSeconds += duration;
    }
  }

  function committedBypassDecision(state, blocker, settings) {
    if (!state.bypassSide || state.bypassBlockerId !== blocker.blockerId) return null;
    return {
      ...blocker,
      fsmState: bypassStateForSide(state.bypassSide),
      desiredSpeedFactor: settings.bypassSpeedFactor,
      reason: state.panicSeconds > EPSILON ? "panic-bypass-committed" : "bypass-committed"
    };
  }

  function assessBypass(agent, state, blocker, settings, {
    delay,
    requireTrafficWinner = false,
    requireBlockedPeer = false,
    backoffOnFailure = true
  } = {}) {
    const committed = committedBypassDecision(state, blocker, settings);
    if (committed) return committed;
    if (state.recoveryCooldownSeconds > EPSILON || state.recoveryBlocked) return null;
    if (state.stoppedSeconds < Math.max(0, finite(delay))) return null;

    if (requireTrafficWinner) {
      const blockerState = states.get(blocker.blockerId);
      if (requireBlockedPeer && blockerState?.stoppedSeconds < Math.max(0, finite(delay))) return null;
      if (trafficGridlockInitiativeWinner(agent.tokenId, blocker.blockerId) !== agent.tokenId) return null;
    }

    state.bypassPlanAttempts++;
    bypassAssessments++;
    const plan = planTrafficBypass(materializer, topology, agent, blocker);
    if (!plan) {
      state.lastBypassReason = "bypass-no-legal-corridor";
      if (backoffOnFailure) {
        state.recoveryBlocked = true;
        state.recoveryCooldownSeconds = settings.failedRecoveryBackoff;
      }
      return null;
    }
    return {
      ...blocker,
      fsmState: TRAFFIC_ROUTE_BEHAVIOR_STATE.ASSESS_BYPASS,
      desiredSpeedFactor: 0,
      reason: "bypass-assess",
      bypassPlan: plan
    };
  }

  function trafficDecision(agent, state, blocker, settings) {
    const standstillGap = 9;
    const leadSpeed = Math.max(0, finite(blocker.leadSpeed));
    if (blocker.gap > standstillGap + 0.5 || leadSpeed > 2 || blocker.queuedAtJunction || agent.stage === "connector") {
      // Match the leader's speed and retain a reaction gap. The braking bound
      // anticipates a stopped queue rather than relying on collision holds.
      const comfortable = Math.max(0, leadSpeed + (blocker.gap - standstillGap - leadSpeed * 0.45) * 1.5);
      const braking = Math.sqrt(leadSpeed * leadSpeed + 2 * baseSpeed * settings.brakingRate * Math.max(0, blocker.gap - standstillGap));
      return { ...blocker, fsmState: TRAFFIC_ROUTE_BEHAVIOR_STATE.FOLLOW,
        desiredSpeedFactor: clamp(Math.min(comfortable, braking) / baseSpeed, 0, 1) };
    }

    const recoveryDelay = state.panicSeconds > EPSILON ? settings.panicRecoveryDelay : settings.trafficRecoveryDelay;
    const bypass = assessBypass(agent, state, blocker, settings, {
      delay: recoveryDelay,
      requireTrafficWinner: true,
      requireBlockedPeer: true
    });
    if (bypass) return bypass;

    return {
      ...blocker,
      fsmState: TRAFFIC_ROUTE_BEHAVIOR_STATE.STOPPED_TRAFFIC,
      desiredSpeedFactor: 0,
      reason: state.recoveryBlocked ? "gridlock-no-bypass" : "gridlock-yield"
    };
  }

  function playerDecision(agent, state, blocker, settings) {
    if (blocker.reason === "player-on-foot") {
      return {
        ...blocker,
        fsmState: TRAFFIC_ROUTE_BEHAVIOR_STATE.BLOCKED_PLAYER,
        desiredSpeedFactor: blocker.gap <= settings.hardStopDistance
          ? 0
          : clamp((blocker.gap - settings.hardStopDistance) / Math.max(1, settings.persistentLookAhead - settings.hardStopDistance), 0, 1)
      };
    }

    if (blocker.gap > settings.hardStopDistance) {
      return {
        ...blocker,
        fsmState: TRAFFIC_ROUTE_BEHAVIOR_STATE.BLOCKED_PLAYER,
        desiredSpeedFactor: clamp((blocker.gap - settings.hardStopDistance) / Math.max(1, settings.persistentLookAhead - settings.hardStopDistance), 0, 1)
      };
    }

    const bypass = assessBypass(agent, state, blocker, settings, {
      delay: Math.max(0.55, settings.playerPressureDelay * 0.65),
      // A missing road corridor is not a failed physical-pressure attempt. Keep
      // those latches independent so the driver can escalate after deciding it
      // cannot legally go around the player car.
      backoffOnFailure: false
    });
    if (bypass) return bypass;

    const mayPressure = !state.recoveryBlocked
      && state.recoveryCooldownSeconds <= EPSILON
      && state.stoppedSeconds >= settings.playerPressureDelay
      && state.recoveryAttempts < settings.maxPlayerPressureAttempts;

    return {
      ...blocker,
      fsmState: TRAFFIC_ROUTE_BEHAVIOR_STATE.BLOCKED_PLAYER,
      desiredSpeedFactor: 0,
      reason: mayPressure ? "player-pressure" : "player-vehicle"
    };
  }

  function persistentDecision(agent, state, blocker, settings) {
    if (["player-vehicle", "player-on-foot"].includes(blocker.reason)) {
      return playerDecision(agent, state, blocker, settings);
    }

    if (blocker.gap > settings.hardStopDistance) {
      return {
        fsmState: TRAFFIC_ROUTE_BEHAVIOR_STATE.STOPPED_STATIC,
        desiredSpeedFactor: clamp((blocker.gap - settings.hardStopDistance) / Math.max(1, settings.persistentLookAhead - settings.hardStopDistance), 0, 1),
        ...blocker
      };
    }

    const bypass = assessBypass(agent, state, blocker, settings, {
      delay: settings.staticRecoveryDelay
    });
    if (bypass) return bypass;

    return {
      fsmState: TRAFFIC_ROUTE_BEHAVIOR_STATE.STOPPED_STATIC,
      desiredSpeedFactor: 0,
      reason: state.recoveryBlocked ? "parked-vehicle-no-bypass" : "parked-vehicle",
      ...blocker
    };
  }

  function rejoinDecision(state, reason = "bypass-rejoin", desiredSpeedFactor = null) {
    return {
      fsmState: TRAFFIC_ROUTE_BEHAVIOR_STATE.REJOIN_ROUTE,
      desiredSpeedFactor: desiredSpeedFactor == null ? 0.52 : desiredSpeedFactor,
      reason,
      gap: null,
      blockerId: state.bypassBlockerId || null,
      blockerKind: state.bypassBlockerKind || null
    };
  }

  function decisionFor(agent, state, agentsById, blockedById, settings) {
    const routeBlock = blockedById.get(agent.tokenId);
    if (routeBlock?.reason === "junction-yield") {
      if (maneuverActive(state)) return rejoinDecision(state, "bypass-rejoin-before-junction", 0);
      return {
        fsmState: TRAFFIC_ROUTE_BEHAVIOR_STATE.YIELD_JUNCTION,
        desiredSpeedFactor: 0,
        reason: "junction-yield",
        gap: 0,
        blockerId: null,
        blockerKind: "junction"
      };
    }

    const lane = trafficRouteStageGeometry(topology, agent);
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
      if (maneuverActive(state)) return rejoinDecision(state, "bypass-rejoin", settings.bypassRejoinSpeedFactor);
      const panicking = state.panicSeconds > EPSILON;
      return {
        fsmState: panicking ? TRAFFIC_ROUTE_BEHAVIOR_STATE.PANIC : agent.stage === "connector" ? TRAFFIC_ROUTE_BEHAVIOR_STATE.CONNECTOR : TRAFFIC_ROUTE_BEHAVIOR_STATE.CRUISE,
        desiredSpeedFactor: panicking || agent.stage === "connector" ? 1 : 0.86 + (stableHash(agent.tokenId) % 15) / 100,
        reason: panicking ? "gunshot-panic" : agent.stage === "connector" ? "route-connector-clear" : "route-cruise",
        gap: null,
        blockerId: null,
        blockerKind: null
      };
    }

    return blocker.reason === "traffic"
      ? trafficDecision(agent, state, blocker, settings)
      : persistentDecision(agent, state, blocker, settings);
  }

  function acceptBypassPlan(state, decision) {
    const plan = decision?.bypassPlan;
    if (!plan) return false;
    state.bypassSide = plan.side;
    state.bypassTargetOffset = plan.targetOffset;
    state.bypassBlockerId = plan.blockerId;
    state.bypassBlockerKind = plan.blockerKind;
    state.bypassBlockedSeconds = 0;
    state.lastBypassReason = plan.reason;
    state.recoveryBlocked = false;
    state.recoveryCooldownSeconds = 0;
    bypassCommitments++;
    return true;
  }

  function clearBypassCommitment(state) {
    state.bypassSide = 0;
    state.bypassTargetOffset = 0;
    state.bypassBlockerId = null;
    state.bypassBlockerKind = null;
    state.bypassBlockedSeconds = 0;
  }

  function advanceManeuver(agent, state, settings, duration) {
    const activeBypass = bypassState(state);
    const rejoining = state.fsmState === TRAFFIC_ROUTE_BEHAVIOR_STATE.REJOIN_ROUTE;
    if (!activeBypass && !rejoining) {
      if (Math.abs(state.bypassOffset) <= 0.01) state.bypassAngleDelta = moveToward(state.bypassAngleDelta, 0, settings.bypassAngleRate * duration);
      return;
    }

    const targetOffset = rejoining ? 0 : state.bypassTargetOffset;
    const speed = Math.max(0, finite(baseSpeed, 112)) * Math.max(0, state.speedFactor);
    const forwardStep = speed * duration;
    const desiredAngleDelta = clamp(
      Math.atan2(targetOffset - state.bypassOffset, Math.max(18, speed * 0.45)),
      -settings.bypassSteeringLimit,
      settings.bypassSteeringLimit
    );
    const nextAngleDelta = moveToward(state.bypassAngleDelta, desiredAngleDelta, settings.bypassAngleRate * duration);
    // Steering produces lateral travel only while the wheels move forward.
    // This keeps the body aligned with the manoeuvre instead of sliding it
    // sideways at a fixed rate, especially during a stop or slow departure.
    const lateralStep = clamp(Math.tan(nextAngleDelta) * forwardStep,
      -settings.bypassLateralRate * duration, settings.bypassLateralRate * duration);
    const remaining = targetOffset - state.bypassOffset;
    const nextOffset = state.bypassOffset + (Math.sign(lateralStep) === Math.sign(remaining)
      ? Math.sign(remaining) * Math.min(Math.abs(remaining), Math.abs(lateralStep)) : lateralStep);
    const safe = trafficBypassPoseSafe(materializer, topology, agent, {
      offset: nextOffset,
      angleDelta: nextAngleDelta,
      forwardDistance: settings.bypassForwardProbe
    });

    if (!safe) {
      bypassBlockedFrames++;
      state.bypassBlockedSeconds += duration;
      state.desiredSpeedFactor = 0;
      state.speedFactor = 0;
      state.bypassAngleDelta = moveToward(state.bypassAngleDelta, 0, settings.bypassAngleRate * duration);
      if (activeBypass && state.bypassBlockedSeconds >= settings.bypassBlockedAbortSeconds) {
        state.previousState = state.fsmState;
        state.fsmState = TRAFFIC_ROUTE_BEHAVIOR_STATE.REJOIN_ROUTE;
        state.stateSeconds = 0;
        state.reason = "bypass-abort-blocked";
      }
      return;
    }

    state.bypassOffset = nextOffset;
    state.bypassAngleDelta = nextAngleDelta;
    state.bypassBlockedSeconds = 0;

    if (rejoining && Math.abs(state.bypassOffset) <= 0.2) {
      state.bypassOffset = 0;
      state.bypassAngleDelta = 0;
      state.bypassSuccesses++;
      bypassCompletions++;
      clearBypassCommitment(state);
    }
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
    slot.trafficThreatSeconds = state.panicSeconds;
    slot.routeManeuverOffset = finite(state.bypassOffset);
    slot.routeManeuverAngleDelta = finite(state.bypassAngleDelta);
    slot.routeManeuverSide = state.bypassSide;
    slot.routeManeuverPhase = state.fsmState;
    slot.engineSpeed = Math.max(0, finite(baseSpeed, 112) * slot.speedFactor);
  }

  function executeRecovery(state, settings) {
    if (state.recoveryCooldownSeconds > EPSILON || state.recoveryBlocked) return null;
    if (state.fsmState !== TRAFFIC_ROUTE_BEHAVIOR_STATE.BLOCKED_PLAYER
      || state.reason !== "player-pressure"
      || state.recoveryAttempts >= settings.maxPlayerPressureAttempts) {
      return null;
    }

    state.recoveryAttempts++;
    const result = executeDrivenVehiclePressure(scene, materializer, {
      requesterTokenId: state.tokenId,
      vehicleId: state.blockerId
    });
    playerPressureActions++;
    state.lastRecoveryReason = result.reason;
    if (result.success) {
      state.recoverySuccesses++;
      state.recoveryBlocked = false;
      state.recoveryCooldownSeconds = settings.recoveryActionInterval;
    } else {
      state.recoveryBlocked = true;
      state.recoveryCooldownSeconds = settings.failedRecoveryBackoff;
    }
    return result;
  }

  function update(runtime, seconds = 0.05) {
    const duration = clamp(seconds, 0, 0.05);
    const settings = tuning();
    const agents = runtime?.agents?.() || [];
    const agentsById = new Map(agents.map(agent => [agent.tokenId, agent]));
    const blockedById = new Map((runtime?.snapshot?.().blocked || []).map(item => [item.tokenId, item]));
    const liveIds = new Set();

    for (const agent of agents) {
      liveIds.add(agent.tokenId);
      const state = stateFor(agent);
      state.recoveryCooldownSeconds = Math.max(0, finite(state.recoveryCooldownSeconds) - duration);
      state.panicSeconds = Math.max(0, finite(state.panicSeconds) - duration);
      if (state.recoveryBlocked && state.recoveryCooldownSeconds <= EPSILON) state.recoveryBlocked = false;

      const slot = materializer.assignments.get(agent.tokenId);
      const physicalHoldSeconds = Math.max(0, finite(slot?.physicalHoldSeconds));
      if (physicalHoldSeconds > EPSILON) {
        const decision = {
          fsmState: TRAFFIC_ROUTE_BEHAVIOR_STATE.PHYSICAL_HOLD,
          desiredSpeedFactor: 0,
          reason: slot?.physicalReason === "route-contact-yield"
            ? "physical-contact-yield"
            : slot?.physicalReason === "blocked"
              ? "physical-blocked"
              : "physical-contact-hold",
          gap: 0,
          blockerId: slot?.physicalBlockerId || null,
          blockerKind: "physical"
        };
        transition(state, decision, duration);
        state.desiredSpeedFactor = 0;
        state.speedFactor = 0;
        state.reason = decision.reason;
        state.gap = 0;
        state.blockerId = decision.blockerId;
        state.blockerKind = decision.blockerKind;
        state.stoppedSeconds += duration;
        physicalHoldDecisions++;
        stoppedDecisions++;
        applySlotState(agent, state);
        continue;
      }

      const decision = decisionFor(agent, state, agentsById, blockedById, settings);
      transition(state, decision, duration);
      acceptBypassPlan(state, decision);

      const path = trafficRouteLookAhead(topology, agent, 120);
      let previousHeading = null;
      let cornerLimit = 1;
      for (const stage of path) {
        let along = stage.start;
        for (let i = 1; i < stage.points.length; i++) {
          const a = stage.points[i - 1], b = stage.points[i];
          const length = Math.hypot(b.x - a.x, b.y - a.y);
          const heading = Math.atan2(b.y - a.y, b.x - a.x);
          if (previousHeading !== null && along >= -length) {
            const bend = Math.abs(Math.atan2(Math.sin(heading - previousHeading), Math.cos(heading - previousHeading)));
            if (bend > 0.025) {
              const turnSpeed = Math.sqrt(100 * Math.max(6, length / bend));
              const allowable = Math.sqrt(turnSpeed * turnSpeed + 2 * baseSpeed * settings.brakingRate * Math.max(0, along - 12));
              cornerLimit = Math.min(cornerLimit, allowable / baseSpeed);
            }
          }
          previousHeading = heading;
          along += length;
        }
      }
      const flow = materializer.__nbdTrafficJunctionFlowController;
      const approach = flow?.approachFor?.(agent);
      if (approach && !flow.hasPermit(agent.tokenId)) {
        const distanceToStop = Math.max(0, (approach.stopProgress - agent.stageProgress) * approach.laneLength);
        cornerLimit = Math.min(cornerLimit, Math.max(0.08, Math.sqrt(2 * baseSpeed * settings.brakingRate * distanceToStop) / baseSpeed));
      }
      decision.desiredSpeedFactor = Math.min(decision.desiredSpeedFactor, cornerLimit);
      const rate = decision.desiredSpeedFactor < state.speedFactor
        ? settings.brakingRate
        : state.panicSeconds > EPSILON
          ? settings.panicAccelerationRate
          : settings.accelerationRate;
      state.desiredSpeedFactor = clamp(decision.desiredSpeedFactor, 0, 1);
      state.speedFactor = clamp(moveToward(state.speedFactor, state.desiredSpeedFactor, rate * duration), 0, 1);
      if (state.desiredSpeedFactor < 1) state.speedFactor = Math.min(state.speedFactor, 0.95);
      state.reason = decision.reason;
      state.gap = decision.gap;
      state.blockerId = decision.blockerId || null;
      state.blockerKind = decision.blockerKind || null;
      state.stoppedSeconds = state.speedFactor <= 0.03
        ? state.stoppedSeconds + duration
        : [
            TRAFFIC_ROUTE_BEHAVIOR_STATE.ASSESS_BYPASS,
            TRAFFIC_ROUTE_BEHAVIOR_STATE.BYPASS_LEFT,
            TRAFFIC_ROUTE_BEHAVIOR_STATE.BYPASS_RIGHT,
            TRAFFIC_ROUTE_BEHAVIOR_STATE.REJOIN_ROUTE
          ].includes(state.fsmState)
          ? state.stoppedSeconds
          : 0;

      advanceManeuver(agent, state, settings, duration);

      if (state.speedFactor < 0.95 && state.speedFactor > 0.03) brakingDecisions++;
      if (state.speedFactor <= 0.03) stoppedDecisions++;
      if (state.fsmState === TRAFFIC_ROUTE_BEHAVIOR_STATE.BLOCKED_PLAYER) playerReactiveDecisions++;
      if (state.reason === "player-pressure") playerPressureDecisions++;
      if (state.fsmState === TRAFFIC_ROUTE_BEHAVIOR_STATE.FOLLOW) followingDecisions++;
      if (state.fsmState === TRAFFIC_ROUTE_BEHAVIOR_STATE.PANIC || state.reason === "panic-bypass-committed") panicDecisions++;
      if (bypassState(state)) trafficRecoveryDecisions++;

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
    const vehicles = [...states.values()].map(state => ({ ...state })).sort((left, right) => left.tokenId.localeCompare(right.tokenId));
    const stateCounts = {};
    for (const state of Object.values(TRAFFIC_ROUTE_BEHAVIOR_STATE)) stateCounts[state] = 0;
    for (const vehicle of vehicles) stateCounts[vehicle.fsmState] = (stateCounts[vehicle.fsmState] || 0) + 1;

    const bypassingVehicles = (stateCounts[TRAFFIC_ROUTE_BEHAVIOR_STATE.BYPASS_LEFT] || 0)
      + (stateCounts[TRAFFIC_ROUTE_BEHAVIOR_STATE.BYPASS_RIGHT] || 0);
    return {
      active: true,
      architecture: "explicit-route-behavior-fsm-with-bounded-bypass",
      behaviorProfile: "aggressive-city-traffic",
      movementAuthority: false,
      geometryAuthority: "compiler-local-topology",
      lateralSteeringAuthority: "bounded-bypass-corridor-only",
      speedAuthority: "route-behavior-fsm",
      maneuverAuthority: "TrafficBypassManeuverPolicy",
      recoveryExecutionAuthority: "driver-fsm-bypass-plus-player-pressure-fallback",
      maximumSpeedFactor: 1,
      baseSpeed: Math.max(0, finite(baseSpeed, 112)),
      updates,
      activeVehicles: vehicles.length,
      stateCounts,
      brakingVehicles: vehicles.filter(item => item.speedFactor < 0.95 && item.speedFactor > 0.03).length,
      stoppedVehicles: vehicles.filter(item => item.speedFactor <= 0.03).length,
      playerReactiveVehicles: stateCounts[TRAFFIC_ROUTE_BEHAVIOR_STATE.BLOCKED_PLAYER] || 0,
      playerPressureVehicles: vehicles.filter(item => item.reason === "player-pressure").length,
      panickingVehicles: vehicles.filter(item => item.panicSeconds > EPSILON).length,
      followingVehicles: stateCounts[TRAFFIC_ROUTE_BEHAVIOR_STATE.FOLLOW] || 0,
      physicalHoldingVehicles: stateCounts[TRAFFIC_ROUTE_BEHAVIOR_STATE.PHYSICAL_HOLD] || 0,
      assessingBypassVehicles: stateCounts[TRAFFIC_ROUTE_BEHAVIOR_STATE.ASSESS_BYPASS] || 0,
      bypassingVehicles,
      rejoiningVehicles: stateCounts[TRAFFIC_ROUTE_BEHAVIOR_STATE.REJOIN_ROUTE] || 0,
      gridlockPushingVehicles: 0,
      gridlockYieldingVehicles: stateCounts[TRAFFIC_ROUTE_BEHAVIOR_STATE.STOPPED_TRAFFIC] || 0,
      staticRecoveringVehicles: 0,
      brakingDecisions,
      stoppedDecisions,
      playerReactiveDecisions,
      playerPressureDecisions,
      playerPressureActions,
      panicDecisions,
      gunshotThreatEvents,
      followingDecisions,
      physicalHoldDecisions,
      trafficRecoveryDecisions,
      trafficRecoveryActions,
      staticRecoveryDecisions,
      staticRecoveryActions,
      bypassAssessments,
      bypassCommitments,
      bypassBlockedFrames,
      bypassCompletions,
      bypassPolicy: bypassPolicy?.snapshot?.() || null,
      vehicles
    };
  }

  function clear() {
    if (!disposed) {
      scene.events?.off?.("weapon:fired", onWeaponFired);
      disposed = true;
    }
    bypassPolicy?.destroy?.();
    states.clear();
  }

  return Object.freeze({ update, speedFactor, snapshot, clear });
}
