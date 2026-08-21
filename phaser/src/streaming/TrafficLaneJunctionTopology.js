function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value || "traffic")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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

function quadraticPoint(start, control, end, t) {
  const phase = clamp(t, 0, 1);
  const inverse = 1 - phase;
  return {
    x: inverse * inverse * finite(start?.x) + 2 * inverse * phase * finite(control?.x) + phase * phase * finite(end?.x),
    y: inverse * inverse * finite(start?.y) + 2 * inverse * phase * finite(control?.y) + phase * phase * finite(end?.y)
  };
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
  endpointTolerance = 22
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
  return {
    id: `${incoming.key}->${outgoing.key}@${junction.id}`,
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
    maximumRadius,
    envelopeRadius,
    withinJunctionEnvelope: maximumRadius <= envelopeRadius + 0.001
  };
}

function nearestJunction(point, junctions, endpointTolerance) {
  let best = null;
  for (const junction of junctions) {
    const gap = distance(point, junction);
    const envelope = Math.max(12, finite(junction.radius, 30)) + endpointTolerance;
    if (gap > envelope) continue;
    if (!best || gap < best.distance || (Math.abs(gap - best.distance) < 0.001 && junction.id.localeCompare(best.junction.id) < 0)) {
      best = { junction, distance: gap };
    }
  }
  return best?.junction || null;
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
    for (const direction of ["forward", "reverse"]) {
      const points = edge?.[direction];
      if (!Array.isArray(points) || points.length < 2) continue;
      const start = { x: finite(points[0]?.x), y: finite(points[0]?.y) };
      const end = { x: finite(points[points.length - 1]?.x), y: finite(points[points.length - 1]?.y) };
      const lane = {
        key: trafficLaneKey(edgeId, direction),
        edgeId,
        direction,
        points,
        start,
        end,
        startTangent: endpointTangent(points, false),
        endTangent: endpointTangent(points, true),
        startJunctionId: nearestJunction(start, junctions, endpointTolerance)?.id || null,
        endJunctionId: nearestJunction(end, junctions, endpointTolerance)?.id || null
      };
      lanes.push(lane);
    }
  }
  return { lanes, junctions };
}

export function buildTrafficLaneJunctionTopology(manifest, {
  endpointTolerance = 22,
  connectorSamples = 9
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
    if (lane.endJunctionId) {
      const list = incomingByJunction.get(lane.endJunctionId) || [];
      list.push(lane);
      incomingByJunction.set(lane.endJunctionId, list);
    }
    if (lane.startJunctionId) {
      const list = outgoingByJunction.get(lane.startJunctionId) || [];
      list.push(lane);
      outgoingByJunction.set(lane.startJunctionId, list);
    }
  }

  const connections = [];
  const outgoingByLane = new Map();
  for (const [junctionId, incoming] of incomingByJunction.entries()) {
    const junction = junctionById.get(junctionId);
    const outgoing = outgoingByJunction.get(junctionId) || [];
    for (const from of incoming) {
      for (const to of outgoing) {
        if (from.key === to.key) continue;
        const connector = buildTrafficJunctionConnector(from, to, junction, {
          samples: connectorSamples,
          endpointTolerance: tolerance
        });
        if (!connector) continue;
        connections.push(connector);
        const options = outgoingByLane.get(from.key) || [];
        options.push(connector);
        outgoingByLane.set(from.key, options);
      }
    }
  }

  for (const options of outgoingByLane.values()) {
    options.sort((left, right) => left.outgoingLaneKey.localeCompare(right.outgoingLaneKey));
  }

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

  const connectedLaneCount = lanes.filter(lane => (outgoingByLane.get(lane.key) || []).length > 0).length;
  const unsafeConnectorCount = connections.filter(connection => !connection.withinJunctionEnvelope).length;
  const snapshot = () => ({
    directedLaneCount: lanes.length,
    junctionCount: junctions.length,
    connectionCount: connections.length,
    connectedLaneCount,
    orphanLaneCount: lanes.length - connectedLaneCount,
    unsafeConnectorCount
  });

  return {
    directedLanes: lanes,
    junctions,
    connections,
    laneByKey,
    junctionById,
    outgoingByLane,
    continuations,
    chooseContinuation,
    snapshot
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
        ? { ready: true, ...topology.snapshot() }
        : { ready: false, directedLaneCount: 0, junctionCount: 0, connectionCount: 0, connectedLaneCount: 0, orphanLaneCount: 0, unsafeConnectorCount: 0 };
    },
    destroy() {
      destroyed = true;
      ready = false;
      topology = null;
      if (materializer.laneJunctionTopology) delete materializer.laneJunctionTopology;
      if (materializer.__nbdLaneJunctionTopologyPolicy === policy) delete materializer.__nbdLaneJunctionTopologyPolicy;
    }
  };

  policy.initialization = Promise.resolve(materializer.initialization).then(() => {
    if (destroyed) return policy;
    topology = buildTrafficLaneJunctionTopology(materializer.lanes, options);
    materializer.laneJunctionTopology = topology;
    ready = true;
    return policy;
  });
  materializer.__nbdLaneJunctionTopologyPolicy = policy;
  return policy;
}
