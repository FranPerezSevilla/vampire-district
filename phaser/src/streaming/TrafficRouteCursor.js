const EPSILON = 0.000001;
const topologyIndexes = new WeakMap();
const geometryLengths = new WeakMap();
const JOURNEY_MEMORY = 16;

function topologyIndex(topology) {
  let index = topologyIndexes.get(topology);
  const bundle = topology?.junctionConnectors;
  if (index && index.transitionIds === topology.transitionIds && index?.connectorIds === bundle?.connectorIds) return index;
  index = { transitionIds: topology.transitionIds, connectorIds: bundle?.connectorIds, byLane: new Map(), byTransition: new Map() };
  for (const id of topology.transitionIds || []) {
    const transition = topology.transitions?.[id];
    if (!transition?.preferred) continue;
    if (!index.byLane.has(transition.incomingLaneId)) index.byLane.set(transition.incomingLaneId, []);
    index.byLane.get(transition.incomingLaneId).push(transition);
  }
  for (const choices of index.byLane.values()) choices.sort((a, b) => a.id.localeCompare(b.id));
  for (const id of bundle?.connectorIds || []) {
    const connector = bundle.connectors?.[id];
    if (connector?.activationSafe && !connector.rejectionReasons?.length) index.byTransition.set(connector.transitionId, connector);
  }
  topologyIndexes.set(topology, index);
  return index;
}

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
  if (geometryLengths.has(list)) return geometryLengths.get(list);
  let total = 0;
  for (let index = 0; index < list.length - 1; index++) {
    total += Math.hypot(
      finite(list[index + 1]?.x) - finite(list[index]?.x),
      finite(list[index + 1]?.y) - finite(list[index]?.y)
    );
  }
  geometryLengths.set(list, total);
  return total;
}

function preferredTransitions(topology, laneId) {
  return topologyIndex(topology).byLane.get(laneId) || [];
}

export function safeTrafficRouteConnector(topology, transitionId) {
  const connector = topologyIndex(topology).byTransition.get(transitionId);
  return connector?.activationSafe && !connector.rejectionReasons?.length ? connector : null;
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

export function chooseTrafficRouteTransition(topology, laneId, tokenId, routeHop = 0, recentLaneIds = []) {
  let choices = preferredTransitions(topology, laneId);
  if (!choices.length) return null;
  const safe = choices.filter(choice => choice.requiresConnector
    ? safeTrafficRouteConnector(topology, choice.id)
    : directHandoffIsValidated(topology, choice.id));
  // Keep a missing-geometry continuation explicit when there is no legal exit.
  if (safe.length) choices = safe;
  const recent = Array.isArray(recentLaneIds) ? recentLaneIds : [];
  const oldestVisit = Math.min(...choices.map(choice => recent.lastIndexOf(choice.outgoingLaneId)));
  choices = choices.filter(choice => recent.lastIndexOf(choice.outgoingLaneId) === oldestVisit);
  const hop = Math.max(0, Math.floor(finite(routeHop)));
  const weights = choices.map(choice => choice.turnType === "straight" ? 3 : 1);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let draw = stableHash(`${tokenId}|${laneId}|${hop}`) / 0x100000000 * total;
  for (let i = 0; i < choices.length; i++) {
    draw -= weights[i];
    if (draw < 0) return choices[i];
  }
  return choices[choices.length - 1];
}

export function createTrafficRouteAgent(topology, {
  tokenId,
  laneId,
  routeHop = 0,
  stageProgress = 0,
  previousLaneId = null,
  recentLaneIds = [],
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
    recentLaneIds: [...recentLaneIds].slice(-JOURNEY_MEMORY),
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
    recentLaneIds: [...(agent.recentLaneIds || [])],
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
    agent.routeHop,
    agent.recentLaneIds
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
    agent.recentLaneIds = [...(agent.recentLaneIds || []), previousLaneId].slice(-JOURNEY_MEMORY);
    agent.currentLaneId = transition.outgoingLaneId;
    agent.stage = "lane";
    agent.connectorId = null;
    agent.nextLaneId = null;
    agent.stageProgress = 0;
    agent.routeHop += 1;
    return { ok: true, junctionDecision: true, transitionId: transition.id };
  }

  const connector = safeTrafficRouteConnector(topology, transition.id);
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
  agent.recentLaneIds = [...(agent.recentLaneIds || []), previousLaneId].slice(-JOURNEY_MEMORY);
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

// Read-only preview of the same cursor decisions used by advancement. Compiler
// segment boundaries are not traffic boundaries: drivers see the entire queue.
export function trafficRouteLookAhead(topology, agent, distance = 180) {
  if (!agent) return [];
  const cursor = cloneAgent(agent);
  const stages = [];
  let start = 0;
  for (let i = 0; i < 12; i++) {
    const geometry = trafficRouteStageGeometry(topology, cursor);
    if (!geometry || geometry.length <= EPSILON) break;
    if (i === 0) start = -clamp01(cursor.stageProgress) * geometry.length;
    stages.push({ ...geometry, start, laneId: cursor.currentLaneId });
    start += geometry.length;
    if (start >= distance) break;
    const result = cursor.stage === "connector"
      ? leaveConnector(topology, cursor)
      : leaveLane(topology, cursor);
    if (!result.ok) break;
  }
  return stages;
}

export function projectTrafficRouteAhead(stages, x, y) {
  let best = null;
  for (const stage of stages) {
    let start = stage.start;
    for (let i = 1; i < stage.points.length; i++) {
      const a = stage.points[i - 1], b = stage.points[i];
      const dx = b.x - a.x, dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      if (length <= EPSILON) continue;
      const t = clamp01(((x - a.x) * dx + (y - a.y) * dy) / (length * length));
      const candidate = {
        along: start + length * t,
        distance: Math.hypot(x - a.x - dx * t, y - a.y - dy * t),
        angle: Math.atan2(dy, dx),
        geometryId: stage.id
      };
      if (!best || candidate.distance < best.distance) best = candidate;
      start += length;
    }
  }
  return best;
}
