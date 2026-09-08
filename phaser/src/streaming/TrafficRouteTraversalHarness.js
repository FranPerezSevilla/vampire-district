import { pointAlongPolyline } from "./TrafficMaterializationSystem.js";
import {
  advanceTrafficRouteAgent,
  chooseTrafficRouteTransition,
  createTrafficRouteAgent,
  trafficRouteStageGeometry
} from "./TrafficRouteCursor.js";

const EPSILON = 0.000001;

function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, finite(value)));
}

function distance(left, right) {
  return Math.hypot(
    finite(left?.x) - finite(right?.x),
    finite(left?.y) - finite(right?.y)
  );
}

function normalizedAngle(value) {
  let angle = finite(value);
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function angleGap(left, right) {
  return Math.abs(normalizedAngle(finite(left) - finite(right)));
}

function connectorForTransition(topology, transitionId) {
  const bundle = topology?.junctionConnectors;
  return (bundle?.connectorIds || [])
    .map(id => bundle.connectors?.[id])
    .find(connector => connector?.transitionId === transitionId) || null;
}

export function sampleTrafficRouteAgentPose(topology, agent) {
  const geometry = trafficRouteStageGeometry(topology, agent);
  if (!geometry?.points?.length) return null;
  const pose = pointAlongPolyline(geometry.points, clamp01(agent?.stageProgress));
  return {
    tokenId: agent?.tokenId || null,
    stage: agent?.stage || null,
    geometryId: geometry.id,
    laneId: agent?.currentLaneId || null,
    connectorId: agent?.connectorId || null,
    stageProgress: clamp01(agent?.stageProgress),
    x: finite(pose.x),
    y: finite(pose.y),
    angle: finite(pose.angle)
  };
}

export function trafficRouteTransitionBoundaryEvidence(topology, transitionId) {
  const transition = topology?.transitions?.[transitionId];
  if (!transition) throw new TypeError(`Unknown traffic transition: ${transitionId}.`);
  const incoming = topology?.lanes?.[transition.incomingLaneId];
  const outgoing = topology?.lanes?.[transition.outgoingLaneId];
  if (!incoming || !outgoing) {
    throw new TypeError(`Traffic transition ${transitionId} references missing lane geometry.`);
  }

  const incomingEnd = pointAlongPolyline(incoming.points, 1);
  const outgoingStart = pointAlongPolyline(outgoing.points, 0);
  const connector = transition.requiresConnector
    ? connectorForTransition(topology, transition.id)
    : null;

  if (!transition.requiresConnector) {
    const directValidated = (topology?.junctionConnectors?.directHandoffTransitionIds || [])
      .includes(transition.id);
    const positionGap = distance(incomingEnd, outgoingStart);
    const headingGap = angleGap(incomingEnd.angle, outgoingStart.angle);
    return {
      transitionId: transition.id,
      turnType: transition.turnType,
      requiresConnector: false,
      activationSafe: directValidated,
      directValidated,
      connectorId: null,
      incomingEnd,
      connectorStart: null,
      connectorEnd: null,
      outgoingStart,
      incomingConnectorPositionGap: positionGap,
      connectorOutgoingPositionGap: 0,
      maximumPositionGap: positionGap,
      incomingConnectorHeadingGap: headingGap,
      connectorOutgoingHeadingGap: 0,
      maximumHeadingGap: headingGap,
      headingTolerance: EPSILON
    };
  }

  if (!connector) {
    return {
      transitionId: transition.id,
      turnType: transition.turnType,
      requiresConnector: true,
      activationSafe: false,
      directValidated: false,
      connectorId: null,
      incomingEnd,
      connectorStart: null,
      connectorEnd: null,
      outgoingStart,
      incomingConnectorPositionGap: Infinity,
      connectorOutgoingPositionGap: Infinity,
      maximumPositionGap: Infinity,
      incomingConnectorHeadingGap: Infinity,
      connectorOutgoingHeadingGap: Infinity,
      maximumHeadingGap: Infinity,
      headingTolerance: finite(connector?.tangentTolerance, 0.18)
    };
  }

  const connectorStart = pointAlongPolyline(connector.points, 0);
  const connectorEnd = pointAlongPolyline(connector.points, 1);
  const incomingConnectorPositionGap = distance(incomingEnd, connectorStart);
  const connectorOutgoingPositionGap = distance(connectorEnd, outgoingStart);
  const incomingConnectorHeadingGap = angleGap(incomingEnd.angle, connectorStart.angle);
  const connectorOutgoingHeadingGap = angleGap(connectorEnd.angle, outgoingStart.angle);

  return {
    transitionId: transition.id,
    turnType: transition.turnType,
    requiresConnector: true,
    activationSafe: connector.activationSafe === true,
    directValidated: false,
    connectorId: connector.id,
    incomingEnd,
    connectorStart,
    connectorEnd,
    outgoingStart,
    incomingConnectorPositionGap,
    connectorOutgoingPositionGap,
    maximumPositionGap: Math.max(
      incomingConnectorPositionGap,
      connectorOutgoingPositionGap
    ),
    incomingConnectorHeadingGap,
    connectorOutgoingHeadingGap,
    maximumHeadingGap: Math.max(
      incomingConnectorHeadingGap,
      connectorOutgoingHeadingGap
    ),
    headingTolerance: Math.max(EPSILON, finite(connector.tangentTolerance, 0.18))
  };
}

export function findTrafficRouteTokenForTransition(topology, transitionId, {
  prefix = "traversal-harness",
  maxAttempts = 10000,
  routeHop = 0
} = {}) {
  const transition = topology?.transitions?.[transitionId];
  if (!transition) return null;
  const attempts = Math.max(1, Math.floor(finite(maxAttempts, 10000)));
  for (let index = 0; index < attempts; index++) {
    const tokenId = `${prefix}:${transition.turnType || "turn"}:${index}`;
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

export function runTrafficRouteTraversalHarness(topology, transitionId, {
  tokenId = null,
  speed = 100,
  startProgress = 0.9,
  outgoingProgress = 0.25,
  routeHop = 0
} = {}) {
  const transition = topology?.transitions?.[transitionId];
  if (!transition?.preferred) {
    throw new TypeError(`Traversal harness requires a preferred transition: ${transitionId}.`);
  }
  const incoming = topology?.lanes?.[transition.incomingLaneId];
  const outgoing = topology?.lanes?.[transition.outgoingLaneId];
  if (!incoming || !outgoing) throw new TypeError(`Traversal transition ${transitionId} has missing lanes.`);

  const stableTokenId = tokenId || findTrafficRouteTokenForTransition(topology, transition.id, { routeHop });
  if (!stableTokenId) throw new Error(`Could not find deterministic token for ${transition.id}.`);
  const chosen = chooseTrafficRouteTransition(
    topology,
    incoming.id,
    stableTokenId,
    routeHop
  );
  if (chosen?.id !== transition.id) {
    throw new Error(`Token ${stableTokenId} does not select expected transition ${transition.id}.`);
  }

  const agent = createTrafficRouteAgent(topology, {
    tokenId: stableTokenId,
    laneId: incoming.id,
    routeHop,
    stageProgress: clamp01(startProgress)
  });
  const initialPose = sampleTrafficRouteAgentPose(topology, agent);
  const incomingGeometry = trafficRouteStageGeometry(topology, agent);
  const connector = transition.requiresConnector
    ? connectorForTransition(topology, transition.id)
    : null;
  const outgoingLength = (() => {
    const outgoingAgent = createTrafficRouteAgent(topology, {
      tokenId: `${stableTokenId}:length-probe`,
      laneId: outgoing.id
    });
    return trafficRouteStageGeometry(topology, outgoingAgent)?.length || 0;
  })();
  const unitsPerSecond = Math.max(EPSILON, finite(speed, 100));
  const distanceToIncomingEnd = (1 - clamp01(startProgress)) * finite(incomingGeometry?.length);
  const connectorDistance = transition.requiresConnector ? finite(connector?.length) : 0;
  const outgoingDistance = clamp01(outgoingProgress) * outgoingLength;
  const seconds = (distanceToIncomingEnd + connectorDistance + outgoingDistance) / unitsPerSecond;

  const result = advanceTrafficRouteAgent(agent, seconds, topology, {
    speed: unitsPerSecond,
    maxStageTransitions: 8
  });
  const finalPose = sampleTrafficRouteAgentPose(topology, result.agent);
  const boundary = trafficRouteTransitionBoundaryEvidence(topology, transition.id);

  return {
    transitionId: transition.id,
    turnType: transition.turnType,
    tokenId: stableTokenId,
    seconds,
    speed: unitsPerSecond,
    expectedOutgoingProgress: clamp01(outgoingProgress),
    initialAgent: agent,
    finalAgent: result.agent,
    initialPose,
    finalPose,
    boundary,
    stageTransitions: result.stageTransitions,
    junctionDecisions: result.junctionDecisions,
    remainingSeconds: result.remainingSeconds,
    blockedReason: result.blockedReason,
    sameStableIdentity: result.agent.tokenId === stableTokenId,
    reachedOutgoingLane: result.agent.stage === "lane"
      && result.agent.currentLaneId === outgoing.id
  };
}
