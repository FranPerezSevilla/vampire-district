const EPSILON = 0.000001;

function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, finite(value)));
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value || "traffic")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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

function preferredTransitions(topology, laneId) {
  return (topology?.transitionIds || [])
    .map(id => topology.transitions?.[id])
    .filter(transition => transition?.preferred && transition.incomingLaneId === laneId)
    .sort((left, right) => left.id.localeCompare(right.id));
}

function safeConnectorForTransition(topology, transitionId) {
  const bundle = topology?.junctionConnectors;
  if (!bundle?.connectors) return null;
  return (bundle.connectorIds || [])
    .map(id => bundle.connectors[id])
    .find(connector => (
      connector?.transitionId === transitionId
      && connector.activationSafe === true
      && (!Array.isArray(connector.rejectionReasons) || connector.rejectionReasons.length === 0)
    )) || null;
}

function directHandoffIsValidated(topology, transitionId) {
  return (topology?.junctionConnectors?.directHandoffTransitionIds || []).includes(transitionId);
}

function connectorGateAllows(result) {
  if (result === undefined || result === null || result === true) return { allowed: true, reason: null };
  if (result === false) return { allowed: false, reason: "junction-yield" };
  if (typeof result === "object") {
    const denied = result.allowed === false || result.granted === false;
    return {
      allowed: !denied,
      reason: denied ? String(result.reason || "junction-yield") : null
    };
  }
  return { allowed: Boolean(result), reason: result ? null : "junction-yield" };
}

export function chooseTrafficRouteTransition(topology, laneId, tokenId, routeHop = 0) {
  const choices = preferredTransitions(topology, laneId);
  if (!choices.length) return null;
  const hop = Math.max(0, Math.floor(finite(routeHop)));
  return choices[(stableHash(tokenId) + hop) % choices.length] || null;
}

export function createTrafficRouteAgent(topology, {
  tokenId,
  laneId,
  routeHop = 0,
  stageProgress = 0,
  previousLaneId = null,
  archetypeId = null,
  trafficMetadata = null
} = {}) {
  if (!tokenId) throw new TypeError("Traffic route agent requires a stable tokenId.");
  if (!topology?.lanes?.[laneId]) throw new TypeError(`Traffic route agent requires a valid compiler lane: ${laneId}.`);
  return {
    tokenId: String(tokenId),
    routeHop: Math.max(0, Math.floor(finite(routeHop))),
    stage: "lane",
    currentLaneId: laneId,
    connectorId: null,
    nextLaneId: null,
    previousLaneId: previousLaneId || null,
    stageProgress: clamp01(stageProgress),
    archetypeId: archetypeId || null,
    trafficMetadata: trafficMetadata && typeof trafficMetadata === "object"
      ? { ...trafficMetadata }
      : null
  };
}

export function trafficRouteStageGeometry(topology, agent) {
  if (agent?.stage === "connector") {
    const connector = topology?.junctionConnectors?.connectors?.[agent.connectorId];
    if (!connector?.activationSafe) return null;
    return {
      id: connector.id,
      kind: "connector",
      points: connector.points,
      length: Math.max(0, finite(connector.length, polylineLength(connector.points)))
    };
  }
  const lane = topology?.lanes?.[agent?.currentLaneId];
  if (!lane) return null;
  return {
    id: lane.id,
    kind: "lane",
    points: lane.points,
    length: polylineLength(lane.points)
  };
}

function cloneAgent(agent) {
  return {
    ...agent,
    trafficMetadata: agent?.trafficMetadata && typeof agent.trafficMetadata === "object"
      ? { ...agent.trafficMetadata }
      : null
  };
}

function leaveLane(topology, agent, { beforeConnectorEntry = null } = {}) {
  const transition = chooseTrafficRouteTransition(
    topology,
    agent.currentLaneId,
    agent.tokenId,
    agent.routeHop
  );
  if (!transition) return { ok: false, reason: "no-preferred-transition" };
  if (!topology?.lanes?.[transition.outgoingLaneId]) {
    return { ok: false, reason: "missing-outgoing-lane" };
  }

  const previousLaneId = agent.currentLaneId;
  if (!transition.requiresConnector) {
    if (!directHandoffIsValidated(topology, transition.id)) {
      return { ok: false, reason: "missing-direct-handoff-contract" };
    }
    agent.previousLaneId = previousLaneId;
    agent.currentLaneId = transition.outgoingLaneId;
    agent.stage = "lane";
    agent.connectorId = null;
    agent.nextLaneId = null;
    agent.stageProgress = 0;
    agent.routeHop += 1;
    return { ok: true, junctionDecision: true, transitionId: transition.id };
  }

  const connector = safeConnectorForTransition(topology, transition.id);
  if (!connector) return { ok: false, reason: "missing-safe-connector" };

  if (typeof beforeConnectorEntry === "function") {
    const gate = connectorGateAllows(beforeConnectorEntry({
      tokenId: agent.tokenId,
      routeHop: agent.routeHop,
      incomingLaneId: agent.currentLaneId,
      outgoingLaneId: transition.outgoingLaneId,
      transition,
      connector
    }));
    if (!gate.allowed) {
      return {
        ok: false,
        reason: gate.reason || "junction-yield",
        yielded: true,
        transitionId: transition.id,
        connectorId: connector.id
      };
    }
  }

  agent.previousLaneId = previousLaneId;
  agent.stage = "connector";
  agent.connectorId = connector.id;
  agent.nextLaneId = transition.outgoingLaneId;
  agent.stageProgress = 0;
  agent.routeHop += 1;
  return { ok: true, junctionDecision: true, transitionId: transition.id };
}

function leaveConnector(topology, agent, { afterConnectorExit = null } = {}) {
  if (!agent.nextLaneId || !topology?.lanes?.[agent.nextLaneId]) {
    return { ok: false, reason: "missing-outgoing-lane" };
  }
  const completedConnectorId = agent.connectorId;
  const outgoingLaneId = agent.nextLaneId;
  agent.currentLaneId = outgoingLaneId;
  agent.stage = "lane";
  agent.connectorId = null;
  agent.nextLaneId = null;
  agent.stageProgress = 0;
  if (typeof afterConnectorExit === "function") {
    afterConnectorExit({
      tokenId: agent.tokenId,
      connectorId: completedConnectorId,
      outgoingLaneId,
      routeHop: agent.routeHop
    });
  }
  return { ok: true, junctionDecision: false };
}

export function advanceTrafficRouteAgent(agent, seconds, topology, {
  speed = 120,
  maxStageTransitions = 32,
  beforeConnectorEntry = null,
  afterConnectorExit = null
} = {}) {
  if (!agent?.tokenId) throw new TypeError("Traffic route advance requires a route agent.");
  if (!topology?.lanes || !topology?.transitions) {
    throw new TypeError("Traffic route advance requires compiler-owned local topology.");
  }

  const next = cloneAgent(agent);
  const stableTokenId = String(agent.tokenId);
  const unitsPerSecond = Math.max(EPSILON, finite(speed, 120));
  let remainingSeconds = Math.max(0, finite(seconds));
  let stageTransitions = 0;
  let junctionDecisions = 0;
  let blockedReason = null;
  let guard = Math.max(1, Math.floor(finite(maxStageTransitions, 32)));

  while (remainingSeconds > EPSILON && guard-- > 0) {
    const geometry = trafficRouteStageGeometry(topology, next);
    if (!geometry || geometry.length <= EPSILON) {
      blockedReason = "invalid-stage-geometry";
      break;
    }

    next.stageProgress = clamp01(next.stageProgress);
    const secondsToEnd = (1 - next.stageProgress) * geometry.length / unitsPerSecond;
    if (remainingSeconds + EPSILON < secondsToEnd) {
      next.stageProgress = clamp01(
        next.stageProgress + remainingSeconds * unitsPerSecond / geometry.length
      );
      remainingSeconds = 0;
      break;
    }

    remainingSeconds = Math.max(0, remainingSeconds - secondsToEnd);
    next.stageProgress = 1;
    const handoff = next.stage === "connector"
      ? leaveConnector(topology, next, { afterConnectorExit })
      : leaveLane(topology, next, { beforeConnectorEntry });
    if (!handoff.ok) {
      blockedReason = handoff.reason;
      break;
    }
    stageTransitions += 1;
    if (handoff.junctionDecision) junctionDecisions += 1;
  }

  if (!blockedReason && remainingSeconds > EPSILON && guard <= 0) {
    blockedReason = "stage-transition-guard";
  }
  if (next.tokenId !== stableTokenId) {
    throw new Error("Traffic route cursor changed stable token identity.");
  }

  return {
    agent: next,
    stageTransitions,
    junctionDecisions,
    remainingSeconds,
    blockedReason
  };
}
