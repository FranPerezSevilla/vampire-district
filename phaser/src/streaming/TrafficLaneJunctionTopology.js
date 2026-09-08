function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(finite(value) * factor) / factor;
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value || "traffic")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function safeId(value) {
  return String(value || "connector").replace(/[^a-z0-9:_-]+/gi, "-");
}

function distance(a, b) {
  return Math.hypot(finite(a?.x) - finite(b?.x), finite(a?.y) - finite(b?.y));
}

function unitVector(dx, dy) {
  const length = Math.hypot(finite(dx), finite(dy));
  if (length <= 0.0001) return { x: 1, y: 0 };
  return { x: finite(dx) / length, y: finite(dy) / length };
}

function endpointTangent(points, end = false) {
  const list = Array.isArray(points) ? points : [];
  if (list.length < 2) return { x: 1, y: 0 };
  const from = end ? list[list.length - 2] : list[0];
  const to = end ? list[list.length - 1] : list[1];
  return unitVector(finite(to?.x) - finite(from?.x), finite(to?.y) - finite(from?.y));
}

function angularGap(left, right) {
  const a = unitVector(left?.x, left?.y);
  const b = unitVector(right?.x, right?.y);
  return Math.acos(clamp(a.x * b.x + a.y * b.y, -1, 1));
}

function quadraticPoint(start, control, end, t) {
  const phase = clamp(t, 0, 1);
  const inverse = 1 - phase;
  return {
    x: inverse * inverse * finite(start?.x) + 2 * inverse * phase * finite(control?.x) + phase * phase * finite(end?.x),
    y: inverse * inverse * finite(start?.y) + 2 * inverse * phase * finite(control?.y) + phase * phase * finite(end?.y)
  };
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items || []) {
    const key = String(keyFn(item) || "unknown");
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function duplicateGroups(items, keyFn) {
  const groups = new Map();
  for (const item of items || []) {
    const key = String(keyFn(item));
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .filter(([, list]) => list.length > 1)
    .sort(([left], [right]) => left.localeCompare(right));
}

export function trafficLaneKey(edgeId, direction = "forward") {
  return `${String(edgeId || "")}:${direction === "reverse" ? "reverse" : "forward"}`;
}

export function classifyTrafficTurn(incomingTangent, outgoingTangent, sameEdge = false) {
  const incoming = unitVector(incomingTangent?.x, incomingTangent?.y);
  const outgoing = unitVector(outgoingTangent?.x, outgoingTangent?.y);
  const dot = clamp(incoming.x * outgoing.x + incoming.y * outgoing.y, -1, 1);
  const cross = incoming.x * outgoing.y - incoming.y * outgoing.x;
  const angle = Math.atan2(cross, dot);
  if (sameEdge || Math.abs(angle) > Math.PI * 0.78) return { type: "u-turn", angle };
  if (Math.abs(angle) < Math.PI * 0.16) return { type: "straight", angle };
  // Screen-space Y grows downward, so the mathematical cross-product naming is inverted.
  return { type: cross > 0 ? "right" : "left", angle };
}

export function buildTrafficJunctionConnector(incoming, outgoing, junction, {
  samples = 9,
  endpointTolerance = 22,
  endpointContinuityTolerance = 0.001,
  tangentContinuityTolerance = Math.PI * 0.48
} = {}) {
  if (!incoming?.end || !outgoing?.start || !junction) return null;
  const start = { x: finite(incoming.end.x), y: finite(incoming.end.y) };
  const end = { x: finite(outgoing.start.x), y: finite(outgoing.start.y) };
  const control = { x: finite(junction.x), y: finite(junction.y) };
  const count = Math.max(3, Math.floor(finite(samples, 9)));
  const points = Array.from({ length: count }, (_, index) => quadraticPoint(
    start,
    control,
    end,
    index / (count - 1)
  ));
  const maximumRadius = points.reduce((maximum, point) => Math.max(maximum, distance(point, junction)), 0);
  const envelopeRadius = Math.max(12, finite(junction.radius, 30)) + Math.max(0, finite(endpointTolerance, 22));
  const turn = classifyTrafficTurn(incoming.endTangent, outgoing.startTangent, incoming.edgeId === outgoing.edgeId);
  const connectorStartTangent = endpointTangent(points, false);
  const connectorEndTangent = endpointTangent(points, true);
  const startEndpointGap = distance(points[0], start);
  const endEndpointGap = distance(points[points.length - 1], end);
  const startTangentGapRadians = angularGap(incoming.endTangent, connectorStartTangent);
  const endTangentGapRadians = angularGap(connectorEndTangent, outgoing.startTangent);
  const connectorLength = points.slice(1).reduce((total, point, index) => total + distance(points[index], point), 0);
  const id = `${incoming.key}->${outgoing.key}@${junction.id}`;
  return {
    id,
    connectorEdgeId: `traffic-connector:${safeId(id)}`,
    junctionId: junction.id,
    incomingLaneKey: incoming.key,
    outgoingLaneKey: outgoing.key,
    incomingEdgeId: incoming.edgeId,
    incomingDirection: incoming.direction,
    outgoingEdgeId: outgoing.edgeId,
    outgoingDirection: outgoing.direction,
    turnType: turn.type,
    turnAngle: turn.angle,
    uTurn: turn.type === "u-turn",
    points,
    connectorLength,
    maximumRadius,
    envelopeRadius,
    withinJunctionEnvelope: maximumRadius <= envelopeRadius + 0.001,
    startEndpointGap,
    endEndpointGap,
    endpointContinuityFailure: startEndpointGap > endpointContinuityTolerance
      || endEndpointGap > endpointContinuityTolerance,
    startTangentGapRadians,
    endTangentGapRadians,
    tangentContinuityFailure: startTangentGapRadians > tangentContinuityTolerance
      || endTangentGapRadians > tangentContinuityTolerance
  };
}

function junctionMatches(point, junctions, endpointTolerance) {
  return junctions
    .map(junction => {
      const gap = distance(point, junction);
      const envelopeRadius = Math.max(12, finite(junction.radius, 30)) + endpointTolerance;
      return {
        junctionId: junction.id,
        distance: gap,
        envelopeRadius,
        junction
      };
    })
    .filter(match => match.distance <= match.envelopeRadius + 0.001)
    .sort((left, right) => left.distance - right.distance || left.junctionId.localeCompare(right.junctionId));
}

function ownershipStatus(matches) {
  if (!matches.length) return "unmatched";
  if (matches.length > 1) return "ambiguous";
  return "unique";
}

function directedLanes(manifest, endpointTolerance) {
  const junctions = (manifest?.junctions || []).map(item => ({
    id: String(item.id),
    x: finite(item.x),
    y: finite(item.y),
    radius: Math.max(12, finite(item.radius, 30)),
    approachDistance: Math.max(0, finite(item.approachDistance, 88))
  }));
  const lanes = [];
  for (const [edgeId, edge] of Object.entries(manifest?.edges || {})) {
    if (edge?.junctionConnector) continue;
    for (const direction of ["forward", "reverse"]) {
      const points = edge?.[direction];
      if (!Array.isArray(points) || points.length < 2) continue;
      const start = { x: finite(points[0]?.x), y: finite(points[0]?.y) };
      const end = { x: finite(points[points.length - 1]?.x), y: finite(points[points.length - 1]?.y) };
      const startMatches = junctionMatches(start, junctions, endpointTolerance);
      const endMatches = junctionMatches(end, junctions, endpointTolerance);
      const startOwnership = ownershipStatus(startMatches);
      const endOwnership = ownershipStatus(endMatches);
      const lane = {
        key: trafficLaneKey(edgeId, direction),
        edgeId,
        direction,
        points,
        start,
        end,
        startTangent: endpointTangent(points, false),
        endTangent: endpointTangent(points, true),
        startOwnership,
        endOwnership,
        startJunctionId: startOwnership === "unique" ? startMatches[0].junctionId : null,
        endJunctionId: endOwnership === "unique" ? endMatches[0].junctionId : null,
        startJunctionMatches: startMatches.map(match => ({
          junctionId: match.junctionId,
          distance: round(match.distance),
          envelopeRadius: round(match.envelopeRadius)
        })),
        endJunctionMatches: endMatches.map(match => ({
          junctionId: match.junctionId,
          distance: round(match.distance),
          envelopeRadius: round(match.envelopeRadius)
        }))
      };
      lanes.push(lane);
    }
  }
  return { lanes, junctions };
}

function endpointAudit(lanes, status) {
  const findings = [];
  for (const lane of lanes) {
    for (const endpoint of ["start", "end"]) {
      const ownership = lane[`${endpoint}Ownership`];
      if (ownership !== status) continue;
      const point = lane[endpoint];
      findings.push({
        laneKey: lane.key,
        edgeId: lane.edgeId,
        direction: lane.direction,
        endpoint,
        x: round(point.x),
        y: round(point.y),
        ownership,
        matches: lane[`${endpoint}JunctionMatches`]
      });
    }
  }
  return findings.sort((left, right) => (
    left.laneKey.localeCompare(right.laneKey) || left.endpoint.localeCompare(right.endpoint)
  ));
}

export function buildTrafficLaneJunctionTopology(manifest, {
  endpointTolerance = 22,
  connectorSamples = 9,
  endpointContinuityTolerance = 0.001,
  tangentContinuityTolerance = Math.PI * 0.48,
  minimumConnectorLength = 0.5
} = {}) {
  if (!manifest?.edges || typeof manifest.edges !== "object") {
    throw new TypeError("Traffic lane topology requires a lane manifest with edges.");
  }
  const tolerance = Math.max(0, finite(endpointTolerance, 22));
  const { lanes, junctions } = directedLanes(manifest, tolerance);
  const laneByKey = new Map(lanes.map(lane => [lane.key, lane]));
  const junctionById = new Map(junctions.map(junction => [junction.id, junction]));
  const incomingByJunction = new Map();
  const outgoingByJunction = new Map();
  for (const lane of lanes) {
    if (lane.endOwnership === "unique" && lane.endJunctionId) {
      const list = incomingByJunction.get(lane.endJunctionId) || [];
      list.push(lane);
      incomingByJunction.set(lane.endJunctionId, list);
    }
    if (lane.startOwnership === "unique" && lane.startJunctionId) {
      const list = outgoingByJunction.get(lane.startJunctionId) || [];
      list.push(lane);
      outgoingByJunction.set(lane.startJunctionId, list);
    }
  }

  const connections = [];
  const candidateByLane = new Map();
  for (const [junctionId, incoming] of incomingByJunction.entries()) {
    const junction = junctionById.get(junctionId);
    const outgoing = outgoingByJunction.get(junctionId) || [];
    for (const from of incoming) {
      for (const to of outgoing) {
        if (from.key === to.key) continue;
        const connector = buildTrafficJunctionConnector(from, to, junction, {
          samples: connectorSamples,
          endpointTolerance: tolerance,
          endpointContinuityTolerance,
          tangentContinuityTolerance
        });
        if (!connector) continue;
        connector.sameJunctionOwnership = from.endJunctionId === junctionId && to.startJunctionId === junctionId;
        connector.lanePairKey = `${from.key}->${to.key}`;
        connections.push(connector);
        const candidates = candidateByLane.get(from.key) || [];
        candidates.push(connector);
        candidateByLane.set(from.key, candidates);
      }
    }
  }

  const duplicateConnectorIdGroups = duplicateGroups(connections, connection => connection.connectorEdgeId);
  const duplicateLanePairGroups = duplicateGroups(connections, connection => connection.lanePairKey);
  const duplicateConnectorIds = new Set(duplicateConnectorIdGroups.map(([key]) => key));
  const duplicateLanePairs = new Set(duplicateLanePairGroups.map(([key]) => key));

  for (const connection of connections) {
    const rejectionReasons = [];
    const auditWarnings = [];
    if (!connection.withinJunctionEnvelope) rejectionReasons.push("outside-junction-envelope");
    if (connection.endpointContinuityFailure) rejectionReasons.push("endpoint-continuity");
    if (!connection.sameJunctionOwnership) rejectionReasons.push("junction-ownership-mismatch");
    if (!Number.isFinite(connection.turnAngle)) rejectionReasons.push("non-finite-turn-angle");
    if (connection.connectorLength < minimumConnectorLength) rejectionReasons.push("zero-or-near-zero-length");
    if (duplicateConnectorIds.has(connection.connectorEdgeId)) rejectionReasons.push("duplicate-connector-id");
    if (duplicateLanePairs.has(connection.lanePairKey)) rejectionReasons.push("duplicate-lane-pair");
    if (connection.tangentContinuityFailure) auditWarnings.push("tangent-continuity");
    connection.rejectionReasons = rejectionReasons;
    connection.auditWarnings = auditWarnings;
    connection.activatable = rejectionReasons.length === 0;
  }

  const activatableConnections = connections.filter(connection => connection.activatable);
  const rejectedConnections = connections.filter(connection => !connection.activatable);
  const connectionByEdgeId = new Map(activatableConnections.map(connection => [connection.connectorEdgeId, connection]));
  const outgoingByLane = new Map();
  for (const connection of activatableConnections) {
    const options = outgoingByLane.get(connection.incomingLaneKey) || [];
    options.push(connection);
    outgoingByLane.set(connection.incomingLaneKey, options);
  }
  for (const options of outgoingByLane.values()) {
    options.sort((left, right) => left.outgoingLaneKey.localeCompare(right.outgoingLaneKey));
  }

  const unmatchedEndpoints = endpointAudit(lanes, "unmatched");
  const ambiguousEndpoints = endpointAudit(lanes, "ambiguous");
  const orphanLanes = lanes
    .filter(lane => (outgoingByLane.get(lane.key) || []).length === 0)
    .map(lane => {
      let reason = "no-outgoing-lane-at-junction";
      if (lane.endOwnership === "unmatched") reason = "end-unmatched";
      else if (lane.endOwnership === "ambiguous") reason = "end-ambiguous";
      else if ((candidateByLane.get(lane.key) || []).length > 0) reason = "all-connectors-rejected";
      return { laneKey: lane.key, edgeId: lane.edgeId, direction: lane.direction, reason };
    })
    .sort((left, right) => left.laneKey.localeCompare(right.laneKey));

  const tangentContinuityFailures = connections
    .filter(connection => connection.tangentContinuityFailure)
    .map(connection => ({
      connectorEdgeId: connection.connectorEdgeId,
      lanePairKey: connection.lanePairKey,
      turnType: connection.turnType,
      startGapRadians: round(connection.startTangentGapRadians),
      endGapRadians: round(connection.endTangentGapRadians)
    }))
    .sort((left, right) => left.connectorEdgeId.localeCompare(right.connectorEdgeId));
  const endpointContinuityFailures = connections
    .filter(connection => connection.endpointContinuityFailure)
    .map(connection => ({
      connectorEdgeId: connection.connectorEdgeId,
      lanePairKey: connection.lanePairKey,
      startGap: round(connection.startEndpointGap),
      endGap: round(connection.endEndpointGap)
    }))
    .sort((left, right) => left.connectorEdgeId.localeCompare(right.connectorEdgeId));

  const connectedLaneCount = lanes.length - orphanLanes.length;
  const unsafeConnectorCount = connections.filter(connection => !connection.withinJunctionEnvelope).length;
  const unsafeActivatableConnectorCount = activatableConnections.filter(connection => (
    !connection.withinJunctionEnvelope
    || connection.endpointContinuityFailure
    || !connection.sameJunctionOwnership
  )).length;
  const connectorCountsByTurnType = countBy(connections, connection => connection.turnType);
  const activatableConnectorCountsByTurnType = countBy(activatableConnections, connection => connection.turnType);
  const rejectionReasonCounts = countBy(
    rejectedConnections.flatMap(connection => connection.rejectionReasons.map(reason => ({ reason }))),
    item => item.reason
  );
  const orphanReasonCounts = countBy(orphanLanes, lane => lane.reason);

  const snapshot = () => ({
    directedLaneCount: lanes.length,
    junctionCount: junctions.length,
    connectionCount: connections.length,
    activatableConnectorCount: activatableConnections.length,
    rejectedConnectorCount: rejectedConnections.length,
    connectedLaneCount,
    orphanLaneCount: orphanLanes.length,
    unsafeConnectorCount,
    unsafeActivatableConnectorCount,
    unmatchedEndpointCount: unmatchedEndpoints.length,
    ambiguousEndpointCount: ambiguousEndpoints.length,
    duplicateConnectorIdCount: duplicateConnectorIdGroups.length,
    duplicateLanePairCount: duplicateLanePairGroups.length,
    endpointContinuityFailureCount: endpointContinuityFailures.length,
    tangentContinuityFailureCount: tangentContinuityFailures.length,
    connectorCountsByTurnType,
    activatableConnectorCountsByTurnType,
    rejectionReasonCounts,
    orphanReasonCounts
  });

  const diagnostics = () => ({
    summary: snapshot(),
    unmatchedEndpoints: unmatchedEndpoints.map(item => ({ ...item, matches: [...item.matches] })),
    ambiguousEndpoints: ambiguousEndpoints.map(item => ({ ...item, matches: [...item.matches] })),
    orphanLanes: orphanLanes.map(item => ({ ...item })),
    rejectedConnectors: rejectedConnections
      .map(connection => ({
        connectorEdgeId: connection.connectorEdgeId,
        lanePairKey: connection.lanePairKey,
        junctionId: connection.junctionId,
        turnType: connection.turnType,
        rejectionReasons: [...connection.rejectionReasons],
        auditWarnings: [...connection.auditWarnings]
      }))
      .sort((left, right) => left.connectorEdgeId.localeCompare(right.connectorEdgeId)),
    tangentContinuityFailures,
    endpointContinuityFailures,
    duplicateConnectorIds: duplicateConnectorIdGroups.map(([key, items]) => ({
      connectorEdgeId: key,
      occurrences: items.length
    })),
    duplicateLanePairs: duplicateLanePairGroups.map(([key, items]) => ({
      lanePairKey: key,
      occurrences: items.length
    }))
  });

  function continuations(edgeId, direction) {
    return [...(outgoingByLane.get(trafficLaneKey(edgeId, direction)) || [])];
  }

  function chooseContinuation(edgeId, direction, tokenId, hop = 0) {
    const options = continuations(edgeId, direction);
    if (!options.length) return null;
    const nonUTurns = options.filter(option => !option.uTurn);
    const choices = nonUTurns.length ? nonUTurns : options;
    const index = (stableHash(tokenId) + Math.max(0, Math.floor(finite(hop)))) % choices.length;
    return choices[index] || null;
  }

  return {
    directedLanes: lanes,
    junctions,
    connections,
    activatableConnections,
    rejectedConnections,
    laneByKey,
    junctionById,
    connectionByEdgeId,
    outgoingByLane,
    unmatchedEndpoints,
    ambiguousEndpoints,
    orphanLanes,
    continuations,
    chooseContinuation,
    snapshot,
    diagnostics
  };
}

export function installTrafficLaneJunctionTopologyPolicy(materializer, options = {}) {
  if (!materializer?.initialization) {
    throw new TypeError("Traffic lane junction topology policy requires TrafficMaterializationSystem.");
  }
  if (materializer.__nbdLaneJunctionTopologyPolicy) return materializer.__nbdLaneJunctionTopologyPolicy;

  let topology = null;
  let ready = false;
  let destroyed = false;
  const injectedConnectorEdgeIds = new Set();
  const emptySnapshot = {
    ready: false,
    directedLaneCount: 0,
    junctionCount: 0,
    connectionCount: 0,
    activatableConnectorCount: 0,
    rejectedConnectorCount: 0,
    connectedLaneCount: 0,
    orphanLaneCount: 0,
    unsafeConnectorCount: 0,
    unsafeActivatableConnectorCount: 0,
    unmatchedEndpointCount: 0,
    ambiguousEndpointCount: 0,
    duplicateConnectorIdCount: 0,
    duplicateLanePairCount: 0,
    endpointContinuityFailureCount: 0,
    tangentContinuityFailureCount: 0,
    injectedConnectorLaneCount: 0
  };
  const policy = {
    get ready() {
      return ready;
    },
    get topology() {
      return topology;
    },
    initialization: null,
    snapshot() {
      return topology
        ? { ready: true, ...topology.snapshot(), injectedConnectorLaneCount: injectedConnectorEdgeIds.size }
        : { ...emptySnapshot };
    },
    destroy() {
      destroyed = true;
      ready = false;
      for (const edgeId of injectedConnectorEdgeIds) {
        if (materializer.lanes?.edges?.[edgeId]?.junctionConnector) delete materializer.lanes.edges[edgeId];
      }
      injectedConnectorEdgeIds.clear();
      topology = null;
      if (materializer.laneJunctionTopology) delete materializer.laneJunctionTopology;
      if (materializer.__nbdLaneJunctionTopologyPolicy === policy) delete materializer.__nbdLaneJunctionTopologyPolicy;
    }
  };

  policy.initialization = Promise.resolve(materializer.initialization).then(() => {
    if (destroyed) return policy;
    topology = buildTrafficLaneJunctionTopology(materializer.lanes, options);
    for (const connection of topology.activatableConnections) {
      materializer.lanes.edges[connection.connectorEdgeId] = {
        forward: connection.points.map(point => ({ ...point })),
        reverse: [...connection.points].reverse().map(point => ({ ...point })),
        centerline: connection.points.map(point => ({ ...point })),
        laneOffset: 0,
        junctionConnector: true,
        activatable: true,
        junctionId: connection.junctionId,
        turnType: connection.turnType,
        incomingEdgeId: connection.incomingEdgeId,
        outgoingEdgeId: connection.outgoingEdgeId,
        incomingLaneKey: connection.incomingLaneKey,
        outgoingLaneKey: connection.outgoingLaneKey
      };
      injectedConnectorEdgeIds.add(connection.connectorEdgeId);
    }
    materializer.laneJunctionTopology = topology;
    ready = true;
    return policy;
  });
  materializer.__nbdLaneJunctionTopologyPolicy = policy;
  return policy;
}
