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

function screenRightNormal(tangent) {
  return { x: -finite(tangent?.y), y: finite(tangent?.x) };
}

function lanePoint(node, tangent, normal, longitudinal, lateral) {
  return {
    x: rounded(
      finite(node?.x)
      + finite(tangent?.x) * finite(longitudinal)
      + finite(normal?.x) * finite(lateral)
    ),
    y: rounded(
      finite(node?.y)
      + finite(tangent?.y) * finite(longitudinal)
      + finite(normal?.y) * finite(lateral)
    )
  };
}

function angularTurn(incoming, outgoing) {
  const from = unitVector(incoming?.x, incoming?.y);
  const to = unitVector(outgoing?.x, outgoing?.y);
  const dot = clamp(from.x * to.x + from.y * to.y, -1, 1);
  const cross = from.x * to.y - from.y * to.x;
  return Math.atan2(cross, dot);
}

function turnType(incoming, outgoing, uTurn = false) {
  if (uTurn) return "u-turn";
  const angle = angularTurn(incoming, outgoing);
  if (Math.abs(angle) < Math.PI * 0.16) return "straight";
  if (Math.abs(angle) > Math.PI * 0.78) return "u-turn";
  // Screen-space Y grows downward, so the mathematical naming is inverted.
  return angle > 0 ? "right" : "left";
}

export function lanesPerDirection(segment) {
  return Number(segment?.width) >= 100 ? 2 : 1;
}

function laneOffset(segment, {
  minimumLaneOffset = 8,
  maximumLaneOffset = 32,
  laneWidthFactor = 0.25
} = {}) {
  return rounded(clamp(
    finite(segment?.width, 52) * Math.max(0, finite(laneWidthFactor, 0.25)),
    Math.max(0, finite(minimumLaneOffset, 8)),
    Math.max(0, finite(maximumLaneOffset, 32))
  ));
}

function nodeTopologyMetadata(node, segmentById, nodeById, options) {
  const incident = [...new Set(node?.segments || [])]
    .map(id => segmentById.get(id))
    .filter(Boolean);
  const degree = incident.length;
  const axes = new Set();
  const offsets = [];
  let maximumWidth = 0;

  for (const segment of incident) {
    const otherId = segment.from === node.id ? segment.to : segment.from;
    const other = nodeById.get(otherId);
    if (!other) continue;
    const tangent = unitVector(other.x - node.x, other.y - node.y);
    axes.add(Math.abs(tangent.x) >= Math.abs(tangent.y) ? "horizontal" : "vertical");
    offsets.push(lanesPerDirection(segment) === 2 ? segment.width / 8 : laneOffset(segment, options));
    maximumWidth = Math.max(maximumWidth, finite(segment.width, 52));
  }

  const offsetSpread = offsets.length
    ? Math.max(...offsets) - Math.min(...offsets)
    : 0;
  const corner = degree === 2 && axes.size > 1;
  const widthTransition = degree === 2 && axes.size === 1 && offsetSpread > EPSILON;
  const requiresJunctionGeometry = degree <= 1 || degree >= 3 || corner || widthTransition;
  const minimumTrim = Math.max(0, finite(options?.minimumJunctionTrim, 18));
  const maximumTrim = Math.max(minimumTrim, finite(options?.maximumJunctionTrim, 96));
  const trimWidthFactor = Math.max(0, finite(options?.junctionTrimWidthFactor, 0.5));
  const trimDistance = requiresJunctionGeometry
    ? rounded(clamp(maximumWidth * trimWidthFactor, minimumTrim, maximumTrim))
    : 0;

  let kind = "through";
  if (degree <= 1) kind = "dead-end";
  else if (degree >= 3) kind = "junction";
  else if (corner) kind = "corner";
  else if (widthTransition) kind = "width-transition";

  return {
    id: node.id,
    x: rounded(node.x),
    y: rounded(node.y),
    degree,
    kind,
    axes: [...axes].sort(),
    segmentIds: incident.map(segment => segment.id).sort(),
    maximumRoadWidth: rounded(maximumWidth),
    trimDistance,
    requiresJunctionGeometry
  };
}

export function compilerTrafficLaneId(segmentId, direction = "forward", laneIndex = 0) {
  return `traffic-lane-segment:${String(segmentId)}:${direction === "reverse" ? "reverse" : "forward"}${laneIndex ? `:lane-${laneIndex + 1}` : ""}`;
}

function buildDirectedLane(segment, direction, nodeById, nodeMetadataById, options, laneIndex = 0) {
  const reverse = direction === "reverse";
  const fromNodeId = reverse ? segment.to : segment.from;
  const toNodeId = reverse ? segment.from : segment.to;
  const fromNode = nodeById.get(fromNodeId);
  const toNode = nodeById.get(toNodeId);
  if (!fromNode || !toNode) {
    throw new Error(`Traffic lane segment ${segment.id} references missing compiler nodes.`);
  }
  const tangent = unitVector(toNode.x - fromNode.x, toNode.y - fromNode.y);
  const normal = screenRightNormal(tangent);
  const count = lanesPerDirection(segment);
  const offset = count === 2 ? rounded(segment.width * (2 * laneIndex + 1) / 8) : laneOffset(segment, options);
  const length = Math.max(EPSILON, finite(segment.length, distance(fromNode, toNode)));
  // Chunk seams can leave a short fragment beside a full-width intersection.
  // Allocate its available length to the actual junction(s), not a fixed
  // fraction per end: a 21-unit trim on a 45-unit curb lane folds a right turn
  // backwards across the opposing approach. Keep a small positive lane span.
  const requestedStart = finite(nodeMetadataById.get(fromNodeId)?.trimDistance);
  const requestedEnd = finite(nodeMetadataById.get(toNodeId)?.trimDistance);
  const trimScale = Math.min(1, Math.max(0, length - 1) / Math.max(EPSILON, requestedStart + requestedEnd));
  const startTrim = requestedStart * trimScale;
  const endTrim = requestedEnd * trimScale;
  const start = lanePoint(fromNode, tangent, normal, startTrim, offset);
  const end = lanePoint(toNode, tangent, normal, -endTrim, offset);
  return {
    id: compilerTrafficLaneId(segment.id, direction, laneIndex),
    laneIndex,
    lanesPerDirection: count,
    sourceSegmentId: segment.id,
    sourceRoadEdgeId: segment.sourceEdgeId,
    districtId: segment.districtId,
    direction,
    fromNodeId,
    toNodeId,
    roadClass: segment.roadClass,
    kind: segment.kind,
    roadWidth: rounded(segment.width),
    laneOffset: offset,
    centerlineLength: rounded(segment.length),
    startNodeTrim: rounded(startTrim),
    endNodeTrim: rounded(endTrim),
    tangent: { x: rounded(tangent.x), y: rounded(tangent.y) },
    start,
    end,
    points: [start, end],
    rightHandTraffic: true,
    outgoingLaneIds: [],
    preferredOutgoingLaneIds: []
  };
}

function transitionId(incomingLaneId, outgoingLaneId, nodeId) {
  return `traffic-transition:${incomingLaneId}->${outgoingLaneId}@${nodeId}`;
}

export function buildCompilerTrafficLaneTopology(network, options = {}) {
  if (!Array.isArray(network?.nodes) || !Array.isArray(network?.segments)) {
    throw new TypeError("Compiler traffic lane topology requires district-streaming network nodes and segments.");
  }

  const networkNodes = [...network.nodes].sort((left, right) => String(left.id).localeCompare(String(right.id)));
  const segments = [...network.segments].sort((left, right) => String(left.id).localeCompare(String(right.id)));
  const nodeById = new Map(networkNodes.map(node => [node.id, node]));
  const segmentById = new Map(segments.map(segment => [segment.id, segment]));
  const nodeMetadata = networkNodes.map(node => nodeTopologyMetadata(node, segmentById, nodeById, options));
  const nodeMetadataById = new Map(nodeMetadata.map(node => [node.id, node]));

  const lanes = [];
  for (const segment of segments) {
    for (let index = 0; index < lanesPerDirection(segment); index++) {
      lanes.push(buildDirectedLane(segment, "forward", nodeById, nodeMetadataById, options, index));
      lanes.push(buildDirectedLane(segment, "reverse", nodeById, nodeMetadataById, options, index));
    }
  }
  lanes.sort((left, right) => left.id.localeCompare(right.id));

  const incomingByNode = new Map(networkNodes.map(node => [node.id, []]));
  const outgoingByNode = new Map(networkNodes.map(node => [node.id, []]));
  for (const lane of lanes) {
    incomingByNode.get(lane.toNodeId)?.push(lane);
    outgoingByNode.get(lane.fromNodeId)?.push(lane);
  }
  for (const list of incomingByNode.values()) list.sort((left, right) => left.id.localeCompare(right.id));
  for (const list of outgoingByNode.values()) list.sort((left, right) => left.id.localeCompare(right.id));

  const transitions = [];
  for (const lane of lanes) {
    const outgoing = outgoingByNode.get(lane.toNodeId) || [];
    const candidates = outgoing.filter(candidate => {
      if (candidate.id === lane.id) return false;
      // Retain the parallel lane through a junction, including turns. Only
      // actual changes in road capacity split/merge through a connector.
      if (turnType(lane.tangent, candidate.tangent) === "right") {
        const dx = candidate.start.x - lane.end.x, dy = candidate.start.y - lane.end.y;
        // Closely overlapping junctions may still leave no forward turning
        // arc. Do not advertise a connector that doubles back on itself.
        if (dx * lane.tangent.x + dy * lane.tangent.y < -EPSILON
          || dx * candidate.tangent.x + dy * candidate.tangent.y < -EPSILON) return false;
      }
      return candidate.sourceSegmentId === lane.sourceSegmentId
        || lane.lanesPerDirection !== candidate.lanesPerDirection || lane.laneIndex === candidate.laneIndex;
    });
    const nonUTurns = candidates.filter(candidate => candidate.sourceSegmentId !== lane.sourceSegmentId);
    const preferredIds = new Set((nonUTurns.length ? nonUTurns : candidates).map(candidate => candidate.id));
    lane.outgoingLaneIds = candidates.map(candidate => candidate.id);
    lane.preferredOutgoingLaneIds = [...preferredIds].sort();

    for (const candidate of candidates) {
      const explicitUTurn = candidate.sourceSegmentId === lane.sourceSegmentId;
      const angle = angularTurn(lane.tangent, candidate.tangent);
      const type = turnType(lane.tangent, candidate.tangent, explicitUTurn);
      const endpointGap = distance(lane.end, candidate.start);
      transitions.push({
        id: transitionId(lane.id, candidate.id, lane.toNodeId),
        nodeId: lane.toNodeId,
        incomingLaneId: lane.id,
        outgoingLaneId: candidate.id,
        incomingSegmentId: lane.sourceSegmentId,
        outgoingSegmentId: candidate.sourceSegmentId,
        turnType: type,
        turnAngle: rounded(angle),
        uTurn: type === "u-turn",
        preferred: preferredIds.has(candidate.id),
        endpointGap: rounded(endpointGap),
        requiresConnector: endpointGap > EPSILON || Math.abs(angle) > EPSILON
      });
    }
  }
  transitions.sort((left, right) => left.id.localeCompare(right.id));

  const nodes = {};
  for (const metadata of nodeMetadata) {
    nodes[metadata.id] = {
      ...metadata,
      incomingLaneIds: (incomingByNode.get(metadata.id) || []).map(lane => lane.id),
      outgoingLaneIds: (outgoingByNode.get(metadata.id) || []).map(lane => lane.id)
    };
  }

  const laneRecords = Object.fromEntries(lanes.map(lane => [lane.id, lane]));
  const transitionRecords = Object.fromEntries(transitions.map(transition => [transition.id, transition]));
  const preferredTransitions = transitions.filter(transition => transition.preferred);
  const junctionNodeIds = nodeMetadata.filter(node => node.requiresJunctionGeometry).map(node => node.id).sort();
  const deadEndNodeIds = nodeMetadata.filter(node => node.kind === "dead-end").map(node => node.id).sort();

  return {
    schemaVersion: 2,
    version: 2,
    id: "viceblood-compiler-directed-traffic-lanes",
    ownershipMode: "compiler-node-id",
    drivingSide: "right",
    source: "district-streaming-network-segments",
    nodeIds: networkNodes.map(node => node.id),
    nodes,
    laneIds: lanes.map(lane => lane.id),
    lanes: laneRecords,
    transitionIds: transitions.map(transition => transition.id),
    transitions: transitionRecords,
    junctionNodeIds,
    deadEndNodeIds,
    stats: {
      networkSegmentCount: segments.length,
      directedLaneCount: lanes.length,
      nodeCount: networkNodes.length,
      junctionNodeCount: junctionNodeIds.length,
      deadEndNodeCount: deadEndNodeIds.length,
      transitionCount: transitions.length,
      preferredTransitionCount: preferredTransitions.length,
      uTurnTransitionCount: transitions.filter(transition => transition.uTurn).length,
      preferredUTurnTransitionCount: preferredTransitions.filter(transition => transition.uTurn).length,
      connectorRequiredTransitionCount: transitions.filter(transition => transition.requiresConnector).length,
      preferredConnectorRequiredTransitionCount: preferredTransitions.filter(transition => transition.requiresConnector).length
    }
  };
}

export function validateCompilerTrafficLaneTopology(topology) {
  const errors = [];
  if (!topology?.nodes || !topology?.lanes || !topology?.transitions) {
    return { valid: false, errors: ["Compiler traffic lane topology is incomplete."], metrics: {} };
  }

  for (const laneId of topology.laneIds || []) {
    const lane = topology.lanes[laneId];
    if (!lane) {
      errors.push(`Missing directed lane ${laneId}.`);
      continue;
    }
    if (!topology.nodes[lane.fromNodeId] || !topology.nodes[lane.toNodeId]) {
      errors.push(`Lane ${laneId} references a missing compiler node.`);
    }
    if (!Array.isArray(lane.points) || lane.points.length < 2) errors.push(`Lane ${laneId} has no usable geometry.`);
    if (distance(lane.start, lane.end) <= EPSILON) errors.push(`Lane ${laneId} collapsed after junction trimming.`);
    const fromNode = topology.nodes[lane.fromNodeId];
    if (fromNode) {
      const offset = { x: lane.start.x - fromNode.x, y: lane.start.y - fromNode.y };
      const screenCross = lane.tangent.x * offset.y - lane.tangent.y * offset.x;
      if (screenCross <= EPSILON) errors.push(`Lane ${laneId} is not offset to the right-hand side of travel.`);
    }
  }

  for (const transitionIdValue of topology.transitionIds || []) {
    const transition = topology.transitions[transitionIdValue];
    if (!transition) {
      errors.push(`Missing transition ${transitionIdValue}.`);
      continue;
    }
    const incoming = topology.lanes[transition.incomingLaneId];
    const outgoing = topology.lanes[transition.outgoingLaneId];
    if (!incoming || !outgoing) {
      errors.push(`Transition ${transitionIdValue} references a missing directed lane.`);
      continue;
    }
    if (incoming.toNodeId !== transition.nodeId || outgoing.fromNodeId !== transition.nodeId) {
      errors.push(`Transition ${transitionIdValue} violates compiler node ownership.`);
    }
    if (transition.preferred && transition.uTurn) {
      const alternatives = incoming.outgoingLaneIds
        .map(id => topology.lanes[id])
        .filter(candidate => candidate && candidate.sourceSegmentId !== incoming.sourceSegmentId);
      if (alternatives.length) errors.push(`Transition ${transitionIdValue} prefers a U-turn despite legal alternatives.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    metrics: {
      directedLanes: topology.stats?.directedLaneCount || 0,
      nodes: topology.stats?.nodeCount || 0,
      junctionNodes: topology.stats?.junctionNodeCount || 0,
      transitions: topology.stats?.transitionCount || 0,
      preferredTransitions: topology.stats?.preferredTransitionCount || 0,
      preferredUTurnTransitions: topology.stats?.preferredUTurnTransitionCount || 0,
      connectorRequiredTransitions: topology.stats?.connectorRequiredTransitionCount || 0,
      preferredConnectorRequiredTransitions: topology.stats?.preferredConnectorRequiredTransitionCount || 0
    }
  };
}
