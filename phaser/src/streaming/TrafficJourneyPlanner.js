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
  const segments = journey.segments;
  let low = 0, high = segments.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (segments[mid].end < previous - 70) low = mid + 1;
    else high = mid;
  }
  for (let index = low; index < segments.length; index++) {
    const segment = segments[index];
    if (segment.start > previous + window) break;
    const t = Math.max(0, Math.min(1, ((pose.x - segment.a.x) * segment.dx + (pose.y - segment.a.y) * segment.dy) / segment.length ** 2));
    const distance = Math.hypot(pose.x - segment.a.x - segment.dx * t, pose.y - segment.a.y - segment.dy * t);
    if (distance < best.distance) best = { distance, progress: segment.start + t * segment.length };
  }
  return best;
}

export function createTrafficJourneyPlanner(topology, { laneFilter = () => true, allowDeadEnds = false } = {}) {
  const direct = new Set(topology.junctionConnectors?.directHandoffTransitionIds || []);
  const laneLengths = new Map(Object.values(topology.lanes).map(lane => [lane.id, pathLength(lane.points)]));
  const edges = new Map();
  const deadEndRoads = new Set(Object.values(topology.transitions)
    .filter(transition => transition.preferred && transition.uTurn)
    .map(transition => topology.lanes[transition.incomingLaneId].sourceRoadEdgeId));
  for (const transition of Object.values(topology.transitions)) {
    // The compiler marks a U-turn preferred only where it is the sole exit at
    // a dead end. A shortest journey may use that exit without circling blocks.
    if (!transition.preferred || !laneFilter(topology.lanes[transition.incomingLaneId])
      || !laneFilter(topology.lanes[transition.outgoingLaneId])) continue;
    const connector = safeTrafficRouteConnector(topology, transition.id);
    if (transition.requiresConnector ? !connector : !direct.has(transition.id)) continue;
    if (!edges.has(transition.incomingLaneId)) edges.set(transition.incomingLaneId, []);
    edges.get(transition.incomingLaneId).push({ transition, connector });
  }
  for (const choices of edges.values()) choices.sort((a, b) => a.transition.id.localeCompare(b.transition.id));
  const trees = new Map();
  function shortestPaths(start, forbidden = null) {
    if (!forbidden && trees.has(start)) return trees.get(start);
    const distances = new Map([[start, 0]]), parents = new Map();
    const order = new Map([[start, 0]]), pending = [];
    const before = (a, b) => a.cost < b.cost || a.cost === b.cost && a.order < b.order;
    function push(id, cost) {
      if (!order.has(id)) order.set(id, order.size);
      const item = { id, cost, order: order.get(id) };
      let index = pending.length; pending.push(item);
      while (index > 0) {
        const parent = (index - 1) >> 1;
        if (!before(item, pending[parent])) break;
        pending[index] = pending[parent]; index = parent;
      }
      pending[index] = item;
    }
    function pop() {
      const first = pending[0], last = pending.pop();
      if (pending.length) {
        let index = 0;
        while (index * 2 + 1 < pending.length) {
          let child = index * 2 + 1;
          if (child + 1 < pending.length && before(pending[child + 1], pending[child])) child++;
          if (!before(pending[child], last)) break;
          pending[index] = pending[child]; index = child;
        }
        pending[index] = last;
      }
      return first;
    }
    // Dijkstra's queue retains discovery order for equal costs, preserving the
    // deterministic paths of the former linear minimum scan.
    push(start, 0);
    while (pending.length) {
      const item = pop(), current = item.id;
      if (item.cost !== distances.get(current)) continue;
      for (const edge of edges.get(current) || []) {
        const next = edge.transition.outgoingLaneId;
        if (forbidden?.has(next)) continue;
        // A cul-de-sac is an origin to leave, not a through-traffic shortcut
        // for switching between parallel lanes or closing a return journey.
        if (!allowDeadEnds && deadEndRoads.has(topology.lanes[next].sourceRoadEdgeId)
          && topology.lanes[next].sourceRoadEdgeId !== topology.lanes[start].sourceRoadEdgeId) continue;
        const cost = item.cost + laneLengths.get(next)
          + (edge.connector?.length || 0) + (edge.transition.turnType === "straight" ? 0 : 28) + 1;
        if (cost >= (distances.get(next) ?? Infinity)) continue;
        distances.set(next, cost); parents.set(next, { from: current, edge }); push(next, cost);
      }
    }
    const tree = { distances, parents };
    if (!forbidden) trees.set(start, tree);
    return tree;
  }
  function planLeg(start, tokenId, trip = 0, destination = null, forbidden = null) {
    const { distances, parents } = shortestPaths(start, forbidden);
    let target = destination;
    // The return leg already has its destination. Do not sort/filter the entire
    // city again merely to discard those candidates during circuit allocation.
    if (!target) {
      const reachable = [...distances].filter(([id]) => id !== start && edges.has(id)).sort((a, b) => a[0].localeCompare(b[0]));
      // Ambient through traffic should not deliberately visit a cul-de-sac merely
      // to turn around. Drivers seeded there can leave via its legal U-turn.
      const destinations = reachable.filter(([id]) => laneLengths.get(id) >= 120
        && !deadEndRoads.has(topology.lanes[id].sourceRoadEdgeId));
      const maximum = Math.max(0, ...reachable.map(([, distance]) => distance));
      const eligible = destinations.length ? destinations : reachable;
      const distant = eligible.filter(([, distance]) => distance >= Math.min(1200, maximum * 0.6));
      const candidates = distant.length ? distant : eligible;
      target = candidates[trafficJourneyHash(`${tokenId}:${trip}`) % candidates.length]?.[0] || start;
    }
    if (target !== start && !parents.has(target)) return null;
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
  function plan(start, tokenId, trip = 0) {
    // Close the route via distant streets, avoiding the outbound directed lanes.
    // A dead-end seed has a one-time entry leg before joining its broad circuit.
    for (let attempt = 0; attempt < 64; attempt++) {
      const outward = planLeg(start, tokenId, trip + attempt);
      const possibleReturns = shortestPaths(outward.destination).distances;
      for (const loopLane of outward.laneIds.filter(id => laneLengths.get(id) >= 120
        && !deadEndRoads.has(topology.lanes[id].sourceRoadEdgeId) && possibleReturns.has(id) && id !== outward.destination)) {
        const forbidden = new Set(outward.laneIds.filter(id => id !== loopLane && id !== outward.destination));
        const back = planLeg(outward.destination, tokenId, trip, loopLane, forbidden);
        if (!back) continue;
        const shift = outward.length - back.stages[0].end;
        const laneShift = outward.laneIds.length - 1;
        const stageCopies = new Map(back.stages.slice(1).map(stage => [stage,
          { ...stage, start: stage.start + shift, end: stage.end + shift, laneIndex: stage.laneIndex + laneShift }]));
        const stages = [...outward.stages, ...stageCopies.values()];
        const segments = [...outward.segments, ...back.segments.filter(segment => stageCopies.has(segment.stage)).map(segment => ({
          ...segment, start: segment.start + shift, end: segment.end + shift, stage: stageCopies.get(segment.stage)
        }))];
        const loopStartStage = outward.stages.find(stage => stage.kind === "lane" && stage.laneId === loopLane);
        const loopStartProgress = (loopStartStage.start + loopStartStage.end) / 2;
        const destinationProgress = (stages.at(-1).start + stages.at(-1).end) / 2;
        const circuitLength = destinationProgress - loopStartProgress;
        if (circuitLength < 2000) continue;
        const circuitStages = stages.filter(stage => stage.end > loopStartProgress && stage.start < destinationProgress);
        const circuitRoads = new Set(circuitStages.map(stage => topology.lanes[stage.laneId].sourceRoadEdgeId));
        // Extra parallel lanes must not let a return leg close a small circuit
        // by revisiting the same avenue under a different directed-lane ID.
        if (circuitRoads.size < 7 || stages.at(-1).laneIndex - loopStartStage.laneIndex < 10) continue;
        const circuitPoints = circuitStages.filter(stage => stage.kind === "lane").flatMap(stage => topology.lanes[stage.laneId].points);
        const xs = circuitPoints.map(point => point.x), ys = circuitPoints.map(point => point.y);
        if (Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) < 1000) continue;
        return { ...outward, trip, circular: true, loopLane, loopStartProgress, circuitLength,
          circuitLaneCount: stages.at(-1).laneIndex - loopStartStage.laneIndex,
          destinationProgress, laneIds: [...outward.laneIds, ...back.laneIds.slice(1)],
          stages, segments, length: outward.length + back.length - back.stages[0].end };
      }
    }
    // In an incomplete/disconnected network, finish a finite reachable leg and
    // stop. Never invent a return edge or silently repeat a tiny block.
    const furthest = [...shortestPaths(start).distances].sort((a, b) => b[1] - a[1])[0]?.[0] || start;
    return { ...planLeg(start, tokenId, trip, furthest), circular: false, circuitLength: 0 };
  }
  function planVia(laneIds) {
    if (laneIds.length < 2) return null;
    const stops = [...laneIds, laneIds[0]];
    let result = planLeg(stops[0], "transit", 0, stops[1]);
    if (!result) return null;
    for (let i = 2; i < stops.length; i++) {
      const leg = planLeg(stops[i - 1], "transit", 0, stops[i]);
      if (!leg) return null;
      const shift = result.length - leg.stages[0].end, laneShift = result.laneIds.length - 1;
      const copies = new Map(leg.stages.slice(1).map(stage => [stage, {
        ...stage, start: stage.start + shift, end: stage.end + shift, laneIndex: stage.laneIndex + laneShift
      }]));
      result = { ...result, length: result.length + leg.length - leg.stages[0].end,
        laneIds: [...result.laneIds, ...leg.laneIds.slice(1)], stages: [...result.stages, ...copies.values()],
        segments: [...result.segments, ...leg.segments.filter(segment => copies.has(segment.stage)).map(segment => ({
          ...segment, start: segment.start + shift, end: segment.end + shift, stage: copies.get(segment.stage)
        }))] };
    }
    const loopStartProgress = (result.stages[0].start + result.stages[0].end) / 2;
    const destinationProgress = (result.stages.at(-1).start + result.stages.at(-1).end) / 2;
    return { ...result, circular: true, loopLane: laneIds[0], destination: laneIds[0],
      loopStartProgress, destinationProgress, circuitLength: destinationProgress - loopStartProgress,
      circuitLaneCount: result.laneIds.length - 1 };
  }
  return { plan, planVia };
}
