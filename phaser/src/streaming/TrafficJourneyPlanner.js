import { safeTrafficRouteConnector } from "./TrafficRouteCursor.js";

export function trafficJourneyHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function pathLength(points) {
  return points.slice(1).reduce((sum, point, i) => sum + Math.hypot(point.x - points[i].x, point.y - points[i].y), 0);
}

// Geometry is navigation evidence only. No caller may copy these samples into
// an already spawned vehicle's pose.
export function journeyPoint(journey, distance) {
  const segments = journey.segments;
  let low = 0, high = segments.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (segments[mid].end < distance) low = mid + 1;
    else high = mid;
  }
  const segment = segments[low];
  const t = Math.max(0, Math.min(1, (distance - segment.start) / segment.length));
  return { x: segment.a.x + segment.dx * t, y: segment.a.y + segment.dy * t, angle: segment.angle, segment };
}

export function projectJourney(journey, pose, previous = 0, window = 160) {
  let best = { distance: Infinity, progress: previous };
  for (const segment of journey.segments) {
    if (segment.end < previous - 70) continue;
    if (segment.start > previous + window) break;
    const t = Math.max(0, Math.min(1, ((pose.x - segment.a.x) * segment.dx + (pose.y - segment.a.y) * segment.dy) / segment.length ** 2));
    const distance = Math.hypot(pose.x - segment.a.x - segment.dx * t, pose.y - segment.a.y - segment.dy * t);
    if (distance < best.distance) best = { distance, progress: segment.start + t * segment.length };
  }
  return best;
}

export function createTrafficJourneyPlanner(topology) {
  const direct = new Set(topology.junctionConnectors?.directHandoffTransitionIds || []);
  const edges = new Map();
  const deadEndRoads = new Set(Object.values(topology.transitions)
    .filter(transition => transition.preferred && transition.uTurn)
    .map(transition => topology.lanes[transition.incomingLaneId].sourceRoadEdgeId));
  for (const transition of Object.values(topology.transitions)) {
    // The compiler marks a U-turn preferred only where it is the sole exit at
    // a dead end. A shortest journey may use that exit without circling blocks.
    if (!transition.preferred) continue;
    const connector = safeTrafficRouteConnector(topology, transition.id);
    if (transition.requiresConnector ? !connector : !direct.has(transition.id)) continue;
    if (!edges.has(transition.incomingLaneId)) edges.set(transition.incomingLaneId, []);
    edges.get(transition.incomingLaneId).push({ transition, connector });
  }
  for (const choices of edges.values()) choices.sort((a, b) => a.transition.id.localeCompare(b.transition.id));
  const trees = new Map();
  function shortestPaths(start) {
    if (trees.has(start)) return trees.get(start);
    const distances = new Map([[start, 0]]), parents = new Map(), pending = new Set([start]);
    while (pending.size) {
      let current = null;
      for (const lane of pending) if (current === null || distances.get(lane) < distances.get(current)) current = lane;
      pending.delete(current);
      for (const edge of edges.get(current) || []) {
        const next = edge.transition.outgoingLaneId;
        const cost = distances.get(current) + pathLength(topology.lanes[next].points)
          + (edge.connector?.length || 0) + (edge.transition.turnType === "straight" ? 0 : 28) + 1;
        if (cost >= (distances.get(next) ?? Infinity)) continue;
        distances.set(next, cost); parents.set(next, { from: current, edge }); pending.add(next);
      }
    }
    const tree = { distances, parents };
    trees.set(start, tree);
    return tree;
  }
  function plan(start, tokenId, trip = 0, destination = null) {
    const { distances, parents } = shortestPaths(start);
    const reachable = [...distances].filter(([id]) => id !== start && edges.has(id)).sort((a, b) => a[0].localeCompare(b[0]));
    // Ambient through traffic should not deliberately visit a cul-de-sac merely
    // to turn around. Drivers seeded there can leave via its legal U-turn.
    const destinations = reachable.filter(([id]) => pathLength(topology.lanes[id].points) >= 120
      && !deadEndRoads.has(topology.lanes[id].sourceRoadEdgeId));
    const maximum = Math.max(0, ...reachable.map(([, distance]) => distance));
    const eligible = destinations.length ? destinations : reachable;
    const distant = eligible.filter(([, distance]) => distance >= Math.min(1200, maximum * 0.6));
    const candidates = distant.length ? distant : eligible;
    const target = destination || candidates[trafficJourneyHash(`${tokenId}:${trip}`) % candidates.length]?.[0] || start;
    if (target !== start && !parents.has(target)) throw new Error(`Unreachable traffic destination: ${target}`);
    const route = [], laneIds = [target];
    for (let cursor = target; cursor !== start;) {
      const parent = parents.get(cursor);
      route.unshift(parent.edge); laneIds.unshift(parent.from); cursor = parent.from;
    }
    const segments = [], stages = [];
    let length = 0;
    function append(points, metadata) {
      const stage = { ...metadata, start: length };
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i], dx = b.x - a.x, dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 0.00001) continue;
        segments.push({ a, b, dx, dy, length: distance, start: length, end: length + distance, angle: Math.atan2(dy, dx), stage });
        length += distance;
      }
      stage.end = length; stages.push(stage);
    }
    laneIds.forEach((id, index) => {
      append(topology.lanes[id].points, { kind: "lane", laneId: id, laneIndex: index, geometryId: id });
      const edge = route[index];
      if (edge?.connector) append(edge.connector.points, {
        kind: "connector", laneId: id, laneIndex: index, geometryId: edge.connector.id,
        connectorId: edge.connector.id, nodeId: edge.connector.nodeId, nextLaneId: edge.transition.outgoingLaneId
      });
    });
    const last = stages.at(-1);
    return { destination: target, destinationProgress: (last.start + last.end) / 2, laneIds, stages, segments, length, trip };
  }
  return { plan };
}
