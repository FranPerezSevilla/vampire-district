import {
  advanceTrafficRouteAgent,
  chooseTrafficRouteTransition,
  createTrafficRouteAgent
} from "./TrafficRouteCursor.js";
import {
  trafficRouteAgentMaterializationToken
} from "./TrafficRouteMaterializationPolicy.js";

const EPSILON = 0.000001;

function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function distance(left, right) {
  return Math.hypot(
    finite(left?.x) - finite(right?.x),
    finite(left?.y) - finite(right?.y)
  );
}

function preferredTransitions(topology, turnType = null) {
  const list = (topology?.transitionIds || [])
    .map(id => topology.transitions?.[id])
    .filter(transition => transition?.preferred)
    .filter(transition => !turnType || transition.turnType === turnType)
    .sort((left, right) => left.id.localeCompare(right.id));
  return [
    ...list.filter(transition => transition.requiresConnector),
    ...list.filter(transition => !transition.requiresConnector)
  ];
}

function controlledTokenForTransition(topology, transition, {
  prefix = "controlled-route",
  routeHop = 0,
  maxAttempts = 10000
} = {}) {
  if (!transition?.incomingLaneId) return null;
  const attempts = Math.max(1, Math.floor(finite(maxAttempts, 10000)));
  for (let index = 0; index < attempts; index++) {
    const tokenId = `${prefix}:${transition.id}:${index}`;
    const chosen = chooseTrafficRouteTransition(
      topology,
      transition.incomingLaneId,
      tokenId,
      routeHop
    );
    if (chosen?.id === transition.id) return tokenId;
  }
  return null;
}

export function controlledRouteTransition(topology, {
  transitionId = null,
  turnType = null
} = {}) {
  if (transitionId) {
    const transition = topology?.transitions?.[transitionId];
    return transition?.preferred ? transition : null;
  }
  return preferredTransitions(topology, turnType)[0] || null;
}

export function installTrafficControlledRouteActivationPolicy(materializer) {
  if (!materializer?.trafficTokens || !materializer?.assign || !materializer?.release || !materializer?.updateSlot) {
    throw new TypeError("Controlled route activation requires TrafficMaterializationSystem.");
  }
  if (materializer.__nbdTrafficControlledRouteActivationPolicy) {
    return materializer.__nbdTrafficControlledRouteActivationPolicy;
  }

  const originalTrafficTokens = materializer.trafficTokens;
  const initialPoolSize = materializer.pool?.length || 0;
  let enabled = false;
  let agent = null;
  let token = null;
  let slot = null;
  let speed = 90;
  let totalStageTransitions = 0;
  let totalJunctionDecisions = 0;
  let totalSteps = 0;
  let teleportCount = 0;
  let maximumStepDistance = 0;
  let slotLost = false;
  let lastBlockedReason = null;
  let selectedTransitionId = null;
  let selectedTurnType = null;
  let behavior = null;
  let originalBehaviorApplyDecision = null;
  let routeGuardedApplyDecision = null;
  let steering = null;
  let originalSteeringApplyPresentation = null;
  let routeGuardedApplyPresentation = null;

  function topology() {
    return materializer.lanes?.localTopology || null;
  }

  function controlledTrafficTokens() {
    const normal = originalTrafficTokens.call(materializer);
    if (!enabled || !token) return normal;
    return [
      ...normal.filter(candidate => candidate?.tokenId !== token.tokenId),
      { ...token }
    ];
  }

  function ensurePresentationGuards() {
    const scene = materializer.scene;
    if (!behavior && scene?.trafficLocalBehaviorSystem?.applyDecision) {
      behavior = scene.trafficLocalBehaviorSystem;
      originalBehaviorApplyDecision = behavior.applyDecision;
      routeGuardedApplyDecision = function controlledRouteBehaviorGuard(targetSlot, ...args) {
        if (targetSlot?.routeActive) {
          targetSlot.behaviorReason = "route-controlled";
          targetSlot.behaviorGap = null;
          targetSlot.behaviorLag = 0;
          return targetSlot;
        }
        return originalBehaviorApplyDecision.call(this, targetSlot, ...args);
      };
      behavior.applyDecision = routeGuardedApplyDecision;
    }
    if (!steering && scene?.trafficSteeringPresentationSystem?.applyPresentation) {
      steering = scene.trafficSteeringPresentationSystem;
      originalSteeringApplyPresentation = steering.applyPresentation;
      routeGuardedApplyPresentation = function controlledRouteSteeringGuard(targetSlot, ...args) {
        if (targetSlot?.routeActive) {
          targetSlot.steeringOffset = 0;
          targetSlot.steeringAngle = 0;
          targetSlot.steeringReason = "route-controlled";
          return targetSlot;
        }
        return originalSteeringApplyPresentation.call(this, targetSlot, ...args);
      };
      steering.applyPresentation = routeGuardedApplyPresentation;
    }
  }

  function restorePresentationGuards() {
    if (behavior && behavior.applyDecision === routeGuardedApplyDecision) {
      behavior.applyDecision = originalBehaviorApplyDecision;
    }
    if (steering && steering.applyPresentation === routeGuardedApplyPresentation) {
      steering.applyPresentation = originalSteeringApplyPresentation;
    }
    behavior = null;
    originalBehaviorApplyDecision = null;
    routeGuardedApplyDecision = null;
    steering = null;
    originalSteeringApplyPresentation = null;
    routeGuardedApplyPresentation = null;
  }

  function chooseSlot(requestedSlotIndex = null) {
    const pool = materializer.pool || [];
    if (!pool.length) return null;
    if (requestedSlotIndex !== null && requestedSlotIndex !== undefined) {
      const requested = pool[Math.max(0, Math.floor(finite(requestedSlotIndex)))];
      if (requested) return requested;
    }
    return pool.find(candidate => !candidate.tokenId)
      || pool.find(candidate => candidate.container?.visible === false)
      || pool[0];
  }

  function applyCurrentToken() {
    if (!enabled || !agent || !slot) return false;
    token = trafficRouteAgentMaterializationToken(topology(), agent);
    if (slot.tokenId !== token.tokenId || materializer.assignments?.get?.(token.tokenId) !== slot) {
      slotLost = true;
      return false;
    }
    materializer.updateSlot(slot, token);
    slot.behaviorReason = "route-controlled";
    return true;
  }

  function start({
    transitionId = null,
    turnType = null,
    startProgress = 0.86,
    routeSpeed = 90,
    slotIndex = null
  } = {}) {
    if (enabled) stop();
    ensurePresentationGuards();
    const localTopology = topology();
    const transition = controlledRouteTransition(localTopology, { transitionId, turnType });
    if (!transition) throw new Error(`No preferred controlled route transition for ${transitionId || turnType || "request"}.`);
    const tokenId = controlledTokenForTransition(localTopology, transition);
    if (!tokenId) throw new Error(`Could not resolve deterministic controlled token for ${transition.id}.`);

    const selectedSlot = chooseSlot(slotIndex);
    if (!selectedSlot) throw new Error("Controlled route activation requires an existing materialization pool slot.");
    if (selectedSlot.tokenId) materializer.release(selectedSlot, { force: true });

    speed = Math.max(1, finite(routeSpeed, 90));
    agent = createTrafficRouteAgent(localTopology, {
      tokenId,
      laneId: transition.incomingLaneId,
      stageProgress: Math.max(0, Math.min(0.995, finite(startProgress, 0.86))),
      trafficMetadata: { controlledActivation: true }
    });
    slot = selectedSlot;
    enabled = true;
    selectedTransitionId = transition.id;
    selectedTurnType = transition.turnType;
    totalStageTransitions = 0;
    totalJunctionDecisions = 0;
    totalSteps = 0;
    teleportCount = 0;
    maximumStepDistance = 0;
    slotLost = false;
    lastBlockedReason = null;
    token = trafficRouteAgentMaterializationToken(localTopology, agent);
    materializer.assign(slot, token);
    slot.behaviorReason = "route-controlled";
    materializer.update?.(0);
    return snapshot();
  }

  function step(seconds = 0.05) {
    if (!enabled || !agent || !slot) return snapshot();
    ensurePresentationGuards();
    const duration = Math.max(0, finite(seconds, 0.05));
    if (duration <= EPSILON) return snapshot();
    const before = token || trafficRouteAgentMaterializationToken(topology(), agent);
    const result = advanceTrafficRouteAgent(agent, duration, topology(), {
      speed,
      maxStageTransitions: 16
    });
    agent = result.agent;
    totalStageTransitions += result.stageTransitions;
    totalJunctionDecisions += result.junctionDecisions;
    totalSteps++;
    lastBlockedReason = result.blockedReason;
    const after = trafficRouteAgentMaterializationToken(topology(), agent);
    const stepDistance = distance(before, after);
    maximumStepDistance = Math.max(maximumStepDistance, stepDistance);
    const allowed = speed * duration + 0.01;
    if (stepDistance > allowed) teleportCount++;
    token = after;
    applyCurrentToken();
    materializer.update?.(0);
    return snapshot();
  }

  function stop() {
    const previousTokenId = token?.tokenId || agent?.tokenId || null;
    const previousSlotIndex = slot?.slotIndex ?? null;
    enabled = false;
    if (slot?.tokenId === previousTokenId) materializer.release(slot, { force: true });
    agent = null;
    token = null;
    slot = null;
    selectedTransitionId = null;
    selectedTurnType = null;
    lastBlockedReason = null;
    materializer.reconcile?.(true);
    return {
      enabled: false,
      previousTokenId,
      previousSlotIndex,
      poolSize: materializer.pool?.length || 0,
      fixedPoolPreserved: (materializer.pool?.length || 0) === initialPoolSize
    };
  }

  function transitions() {
    return preferredTransitions(topology()).map(transition => ({
      id: transition.id,
      turnType: transition.turnType,
      incomingLaneId: transition.incomingLaneId,
      outgoingLaneId: transition.outgoingLaneId,
      requiresConnector: transition.requiresConnector
    }));
  }

  function snapshot() {
    return {
      ready: Boolean(topology()?.lanes),
      enabled,
      defaultEnabled: false,
      movementAuthority: enabled ? "controlled-compiler-route" : "authored-local-lanes",
      defaultTrafficAuthority: "authored-local-lanes",
      tokenId: token?.tokenId || null,
      slotIndex: slot?.slotIndex ?? null,
      poolSize: materializer.pool?.length || 0,
      initialPoolSize,
      fixedPoolPreserved: (materializer.pool?.length || 0) === initialPoolSize,
      transitionId: selectedTransitionId,
      turnType: selectedTurnType,
      stage: agent?.stage || null,
      currentLaneId: agent?.currentLaneId || null,
      connectorId: agent?.connectorId || null,
      nextLaneId: agent?.nextLaneId || null,
      routeHop: agent?.routeHop || 0,
      stageProgress: agent?.stageProgress || 0,
      x: token ? finite(token.x) : null,
      y: token ? finite(token.y) : null,
      angle: token ? finite(token.angle) : null,
      speed,
      totalSteps,
      totalStageTransitions,
      totalJunctionDecisions,
      teleportCount,
      maximumStepDistance,
      slotLost,
      lastBlockedReason,
      behaviorGuardInstalled: Boolean(behavior && behavior.applyDecision === routeGuardedApplyDecision),
      steeringGuardInstalled: Boolean(steering && steering.applyPresentation === routeGuardedApplyPresentation),
      assignmentStable: Boolean(enabled && token && slot && materializer.assignments?.get?.(token.tokenId) === slot)
    };
  }

  materializer.trafficTokens = controlledTrafficTokens;

  const policy = {
    active: true,
    start,
    step,
    stop,
    snapshot,
    transitions,
    destroy() {
      if (enabled) stop();
      restorePresentationGuards();
      if (materializer.trafficTokens === controlledTrafficTokens) materializer.trafficTokens = originalTrafficTokens;
      if (typeof window !== "undefined" && window.NBD_TRAFFIC_ROUTE_CONTROL?.__policy === policy) {
        delete window.NBD_TRAFFIC_ROUTE_CONTROL;
      }
      if (materializer.__nbdTrafficControlledRouteActivationPolicy === policy) {
        delete materializer.__nbdTrafficControlledRouteActivationPolicy;
      }
    }
  };

  materializer.__nbdTrafficControlledRouteActivationPolicy = policy;
  if (typeof window !== "undefined") {
    window.NBD_TRAFFIC_ROUTE_CONTROL = Object.freeze({
      __policy: policy,
      start,
      step,
      stop,
      snapshot,
      transitions
    });
  }
  return policy;
}
