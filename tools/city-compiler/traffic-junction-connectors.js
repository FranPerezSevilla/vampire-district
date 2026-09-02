import { pointInSurface } from "./geometry.js";

const EPSILON = 0.001;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function rounded(value, precision = 6) {
  const scale = 10 ** precision;
  return Math.round(finite(value) * scale) / scale;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, finite(value, minimum)));
}

function distance(left, right) {
  return Math.hypot(finite(left?.x) - finite(right?.x), finite(left?.y) - finite(right?.y));
}

function unitVector(dx, dy) {
  const length = Math.hypot(finite(dx), finite(dy));
  if (length <= EPSILON) return { x: 1, y: 0 };
  return { x: finite(dx) / length, y: finite(dy) / length };
}

function angleGap(left, right) {
  const a = unitVector(left?.x, left?.y);
  const b = unitVector(right?.x, right?.y);
  const dot = clamp(a.x * b.x + a.y * b.y, -1, 1);
  return Math.acos(dot);
}

function cubicPoint(start, control1, control2, end, phase) {
  const t = clamp(phase, 0, 1);
  const inverse = 1 - t;
  const aa = inverse * inverse;
  const bb = t * t;
  return {
    x: rounded(
      aa * inverse * start.x
      + 3 * aa * t * control1.x
      + 3 * inverse * bb * control2.x
      + bb * t * end.x
    ),
    y: rounded(
      aa * inverse * start.y
      + 3 * aa * t * control1.y
      + 3 * inverse * bb * control2.y
      + bb * t * end.y
    )
  };
}

function polylineLength(points) {
  let total = 0;
  for (let index = 0; index < points.length - 1; index++) total += distance(points[index], points[index + 1]);
  return total;
}

function connectorId(transitionId) {
  return `traffic-connector:${String(transitionId)}`;
}

function connectorHandleDistance(incoming, outgoing, node, chord, options) {
  const minimum = Math.max(1, finite(options?.minimumHandle, 5));
  const maximum = Math.max(minimum, finite(options?.maximumHandle, 80));
  const factor = Math.max(0.05, Math.min(0.8, finite(options?.handleFactor, 0.42)));
  const nodeBudget = Math.max(
    minimum,
    finite(node?.trimDistance),
    finite(incoming?.endNodeTrim),
    finite(outgoing?.startNodeTrim)
  );
  return rounded(clamp(chord * factor, minimum, Math.min(maximum, nodeBudget)));
}

function pointOnAnyRoad(point, roadSurfaces, margin) {
  return (roadSurfaces || []).some(surface => pointInSurface(point, surface, margin));
}

export function buildCompilerTrafficJunctionConnectors(topology, roadSurfaces, options = {}) {
  if (!topology?.lanes || !topology?.transitions || !topology?.nodes) {
    throw new TypeError("Compiler traffic connectors require compiler-owned lane topology.");
  }
  if (!Array.isArray(roadSurfaces)) {
    throw new TypeError("Compiler traffic connectors require compiler-owned road surfaces.");
  }

  const samples = Math.max(7, Math.floor(finite(options.samples, 21)));
  const tangentTolerance = Math.max(0.01, finite(options.tangentTolerance, 0.18));
  const roadSurfaceMargin = Math.max(0, finite(options.roadSurfaceMargin, 1.5));
  const connectors = [];
  const directHandoffs = [];

  for (const transitionIdValue of topology.transitionIds || []) {
    const transition = topology.transitions[transitionIdValue];
    if (!transition?.preferred) continue;
    if (!transition.requiresConnector) {
      directHandoffs.push(transition.id);
      continue;
    }

    const incoming = topology.lanes[transition.incomingLaneId];
    const outgoing = topology.lanes[transition.outgoingLaneId];
    const node = topology.nodes[transition.nodeId];
    if (!incoming || !outgoing || !node) continue;

    const start = { x: finite(incoming.end.x), y: finite(incoming.end.y) };
    const end = { x: finite(outgoing.start.x), y: finite(outgoing.start.y) };
    const chord = distance(start, end);
    const handle = connectorHandleDistance(incoming, outgoing, node, chord, options);
    const control1 = {
      x: rounded(start.x + incoming.tangent.x * handle),
      y: rounded(start.y + incoming.tangent.y * handle)
    };
    const control2 = {
      x: rounded(end.x - outgoing.tangent.x * handle),
      y: rounded(end.y - outgoing.tangent.y * handle)
    };
    const points = Array.from({ length: samples }, (_, index) => cubicPoint(
      start,
      control1,
      control2,
      end,
      index / (samples - 1)
    ));
    // Reassert exact endpoints after rounded sampling.
    points[0] = { ...start };
    points[points.length - 1] = { ...end };

    const firstTangent = unitVector(points[1].x - points[0].x, points[1].y - points[0].y);
    const lastTangent = unitVector(
      points[points.length - 1].x - points[points.length - 2].x,
      points[points.length - 1].y - points[points.length - 2].y
    );
    const startTangentGap = angleGap(incoming.tangent, firstTangent);
    const endTangentGap = angleGap(outgoing.tangent, lastTangent);
    const outsideRoadSamples = points
      .map((point, index) => ({ point, index }))
      .filter(({ point }) => !pointOnAnyRoad(point, roadSurfaces, roadSurfaceMargin));
    const length = polylineLength(points);
    const rejectionReasons = [];
    if (distance(points[0], incoming.end) > EPSILON) rejectionReasons.push("incoming-endpoint-gap");
    if (distance(points.at(-1), outgoing.start) > EPSILON) rejectionReasons.push("outgoing-endpoint-gap");
    if (startTangentGap > tangentTolerance) rejectionReasons.push("incoming-tangent-gap");
    if (endTangentGap > tangentTolerance) rejectionReasons.push("outgoing-tangent-gap");
    if (outsideRoadSamples.length) rejectionReasons.push("outside-road-authority");
    if (length <= EPSILON) rejectionReasons.push("zero-length");

    connectors.push({
      id: connectorId(transition.id),
      transitionId: transition.id,
      nodeId: transition.nodeId,
      incomingLaneId: incoming.id,
      outgoingLaneId: outgoing.id,
      turnType: transition.turnType,
      uTurn: transition.uTurn,
      preferred: true,
      start,
      end,
      control1,
      control2,
      handleDistance: handle,
      points,
      length: rounded(length),
      startTangentGap: rounded(startTangentGap),
      endTangentGap: rounded(endTangentGap),
      tangentTolerance: rounded(tangentTolerance),
      outsideRoadSampleCount: outsideRoadSamples.length,
      outsideRoadSampleIndices: outsideRoadSamples.map(entry => entry.index),
      roadSurfaceMargin: rounded(roadSurfaceMargin),
      activationSafe: rejectionReasons.length === 0,
      rejectionReasons
    });
  }

  connectors.sort((left, right) => left.id.localeCompare(right.id));
  directHandoffs.sort();
  const connectorRecords = Object.fromEntries(connectors.map(connector => [connector.id, connector]));
  const rejected = connectors.filter(connector => !connector.activationSafe);
  const safe = connectors.filter(connector => connector.activationSafe);

  return {
    schemaVersion: 1,
    version: 1,
    id: "viceblood-compiler-traffic-junction-connectors",
    sourceTopologyId: topology.id,
    connectorIds: connectors.map(connector => connector.id),
    connectors: connectorRecords,
    directHandoffTransitionIds: directHandoffs,
    rejectedConnectorIds: rejected.map(connector => connector.id),
    stats: {
      preferredTransitionCount: (topology.transitionIds || [])
        .map(id => topology.transitions[id])
        .filter(transition => transition?.preferred).length,
      connectorCount: connectors.length,
      safeConnectorCount: safe.length,
      rejectedConnectorCount: rejected.length,
      directHandoffCount: directHandoffs.length,
      outsideRoadConnectorCount: connectors.filter(connector => connector.outsideRoadSampleCount > 0).length,
      tangentFailureCount: connectors.filter(connector => (
        connector.startTangentGap > tangentTolerance || connector.endTangentGap > tangentTolerance
      )).length,
      leftCount: connectors.filter(connector => connector.turnType === "left").length,
      rightCount: connectors.filter(connector => connector.turnType === "right").length,
      straightCount: connectors.filter(connector => connector.turnType === "straight").length,
      uTurnCount: connectors.filter(connector => connector.turnType === "u-turn").length
    }
  };
}

export function validateCompilerTrafficJunctionConnectors(bundle, topology) {
  const errors = [];
  if (!bundle?.connectors || !topology?.lanes || !topology?.transitions) {
    return { valid: false, errors: ["Compiler traffic connector bundle is incomplete."], metrics: {} };
  }

  const seenTransitions = new Set();
  for (const connectorIdValue of bundle.connectorIds || []) {
    const connector = bundle.connectors[connectorIdValue];
    if (!connector) {
      errors.push(`Missing connector ${connectorIdValue}.`);
      continue;
    }
    if (seenTransitions.has(connector.transitionId)) errors.push(`Duplicate connector transition ${connector.transitionId}.`);
    seenTransitions.add(connector.transitionId);
    const transition = topology.transitions[connector.transitionId];
    const incoming = topology.lanes[connector.incomingLaneId];
    const outgoing = topology.lanes[connector.outgoingLaneId];
    if (!transition || !incoming || !outgoing) {
      errors.push(`Connector ${connector.id} references missing compiler topology.`);
      continue;
    }
    if (transition.nodeId !== connector.nodeId || incoming.toNodeId !== connector.nodeId || outgoing.fromNodeId !== connector.nodeId) {
      errors.push(`Connector ${connector.id} violates compiler node ownership.`);
    }
    if (!connector.activationSafe) {
      errors.push(`Connector ${connector.id} rejected: ${connector.rejectionReasons.join(",")}.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    metrics: {
      connectors: bundle.stats?.connectorCount || 0,
      safeConnectors: bundle.stats?.safeConnectorCount || 0,
      rejectedConnectors: bundle.stats?.rejectedConnectorCount || 0,
      directHandoffs: bundle.stats?.directHandoffCount || 0,
      outsideRoadConnectors: bundle.stats?.outsideRoadConnectorCount || 0,
      tangentFailures: bundle.stats?.tangentFailureCount || 0
    }
  };
}
