from pathlib import Path

def replace_once(path, old, new):
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one patch point, found {count}; anchor={old.splitlines()[0]!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")

junction = Path("phaser/src/streaming/TrafficJunctionFlowPolicy.js")

replace_once(
    junction,
    '''  return best;
}

function safeConnectorForTransition(topology, transition) {''',
    '''  return best;
}

function pointSegmentDistance(point, from, to) {
  const ax = finite(from?.x);
  const ay = finite(from?.y);
  const dx = finite(to?.x) - ax;
  const dy = finite(to?.y) - ay;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= EPSILON) return distance(point, from);
  const local = clamp(
    ((finite(point?.x) - ax) * dx + (finite(point?.y) - ay) * dy) / lengthSquared,
    0,
    1
  );
  return Math.hypot(
    finite(point?.x) - (ax + dx * local),
    finite(point?.y) - (ay + dy * local)
  );
}

function segmentOrientation(a, b, c) {
  return (finite(b?.x) - finite(a?.x)) * (finite(c?.y) - finite(a?.y))
    - (finite(b?.y) - finite(a?.y)) * (finite(c?.x) - finite(a?.x));
}

function pointOnSegment(point, from, to) {
  return finite(point?.x) >= Math.min(finite(from?.x), finite(to?.x)) - EPSILON
    && finite(point?.x) <= Math.max(finite(from?.x), finite(to?.x)) + EPSILON
    && finite(point?.y) >= Math.min(finite(from?.y), finite(to?.y)) - EPSILON
    && finite(point?.y) <= Math.max(finite(from?.y), finite(to?.y)) + EPSILON;
}

function segmentsIntersect(aFrom, aTo, bFrom, bTo) {
  const o1 = segmentOrientation(aFrom, aTo, bFrom);
  const o2 = segmentOrientation(aFrom, aTo, bTo);
  const o3 = segmentOrientation(bFrom, bTo, aFrom);
  const o4 = segmentOrientation(bFrom, bTo, aTo);
  if (((o1 > EPSILON && o2 < -EPSILON) || (o1 < -EPSILON && o2 > EPSILON))
    && ((o3 > EPSILON && o4 < -EPSILON) || (o3 < -EPSILON && o4 > EPSILON))) {
    return true;
  }
  if (Math.abs(o1) <= EPSILON && pointOnSegment(bFrom, aFrom, aTo)) return true;
  if (Math.abs(o2) <= EPSILON && pointOnSegment(bTo, aFrom, aTo)) return true;
  if (Math.abs(o3) <= EPSILON && pointOnSegment(aFrom, bFrom, bTo)) return true;
  if (Math.abs(o4) <= EPSILON && pointOnSegment(aTo, bFrom, bTo)) return true;
  return false;
}

function segmentDistance(aFrom, aTo, bFrom, bTo) {
  if (segmentsIntersect(aFrom, aTo, bFrom, bTo)) return 0;
  return Math.min(
    pointSegmentDistance(aFrom, bFrom, bTo),
    pointSegmentDistance(aTo, bFrom, bTo),
    pointSegmentDistance(bFrom, aFrom, aTo),
    pointSegmentDistance(bTo, aFrom, aTo)
  );
}

function polylineDistance(leftPoints, rightPoints) {
  const left = polylineMetrics(leftPoints);
  const right = polylineMetrics(rightPoints);
  if (!left.segments.length || !right.segments.length) return Number.POSITIVE_INFINITY;
  let best = Number.POSITIVE_INFINITY;
  for (const leftSegment of left.segments) {
    for (const rightSegment of right.segments) {
      best = Math.min(
        best,
        segmentDistance(
          leftSegment.from,
          leftSegment.to,
          rightSegment.from,
          rightSegment.to
        )
      );
      if (best <= EPSILON) return 0;
    }
  }
  return best;
}

function polylinePrefix(points, requestedLength) {
  const metrics = polylineMetrics(points);
  if (!metrics.points.length) return [];
  if (!metrics.segments.length) return [metrics.points[0]];
  const limit = clamp(requestedLength, 0, metrics.length);
  const prefix = [metrics.points[0]];
  for (const segment of metrics.segments) {
    const available = limit - segment.startDistance;
    if (available <= EPSILON) break;
    if (available + EPSILON >= segment.length) {
      prefix.push(segment.to);
      continue;
    }
    const local = clamp(available / segment.length, 0, 1);
    prefix.push({
      x: finite(segment.from?.x) + segment.dx * local,
      y: finite(segment.from?.y) + segment.dy * local
    });
    break;
  }
  return prefix;
}

function safeConnectorForTransition(topology, transition) {'''
)

replace_once(
    junction,
    '''  minimumSeedSpacing = 34,
  permitCorridorMargin = 8
} = {}) {''',
    '''  minimumSeedSpacing = 34,
  permitCorridorMargin = 8,
  movementConflictMargin = 3
} = {}) {'''
)

replace_once(
    junction,
    '''  let approachQueueDenials = 0;
  let occupiedDenials = 0;
  let exitBlockedDenials = 0;''',
    '''  let approachQueueDenials = 0;
  let occupiedDenials = 0;
  let movementPermitDenials = 0;
  let exitBlockedDenials = 0;'''
)

replace_once(
    junction,
    '''  function approachFor(agent) {
    return trafficJunctionApproach(topology, agent, slotFor(agent?.tokenId), {
      stopMargin,
      minimumStopDistance,
      maximumStopDistance,
      exitMargin,
      minimumExitClearance,
      conflictMargin
    });
  }

  function queueFor(junctionId) {''',
    '''  function approachFor(agent) {
    return trafficJunctionApproach(topology, agent, slotFor(agent?.tokenId), {
      stopMargin,
      minimumStopDistance,
      maximumStopDistance,
      exitMargin,
      minimumExitClearance,
      conflictMargin
    });
  }

  function appendPathPoints(target, points) {
    for (const point of points || []) {
      if (!point) continue;
      const previous = target[target.length - 1];
      if (previous && distance(previous, point) <= EPSILON) continue;
      target.push({ x: finite(point.x), y: finite(point.y) });
    }
    return target;
  }

  function movementPathFor(approach) {
    if (!approach) return [];
    const connector = topology.junctionConnectors.connectors?.[approach.connectorId];
    const outgoing = topology.lanes?.[approach.outgoingLaneId];
    const path = [];
    appendPathPoints(path, [approach.stopPoint]);
    appendPathPoints(path, connector?.points);
    appendPathPoints(
      path,
      polylinePrefix(
        outgoing?.points,
        Math.max(0, finite(approach.exitClearanceDistance) + finite(approach.halfLength))
      )
    );
    return path;
  }

  function conflictingPermit(approach, requesterTokenId) {
    const requesterPath = movementPathFor(approach);
    if (requesterPath.length < 2) return null;
    const candidates = [...permits.values()]
      .filter(permit => String(permit.tokenId) !== String(requesterTokenId))
      .sort((left, right) => String(left.tokenId).localeCompare(String(right.tokenId)));
    for (const permit of candidates) {
      const permitPath = movementPathFor(permit);
      if (permitPath.length < 2) continue;
      const clearance = Math.max(0, finite(approach.halfWidth))
        + Math.max(0, finite(permit.halfWidth))
        + Math.max(0, finite(movementConflictMargin, 3));
      const pathDistance = polylineDistance(requesterPath, permitPath);
      if (pathDistance <= clearance + EPSILON) {
        return {
          tokenId: permit.tokenId,
          junctionId: permit.junctionId,
          connectorId: permit.connectorId,
          pathDistance,
          clearance
        };
      }
    }
    return null;
  }

  function queueFor(junctionId) {'''
)

replace_once(
    junction,
    '''  function junctionOccupied(approach, requesterTokenId) {
    for (const agent of currentAgents) {''',
    '''  function safelyQueuedRouteEntity(item, requesterApproach) {
    if (item?.kind !== "route-traffic" || !item.tokenId || permits.has(String(item.tokenId))) return false;
    const routeAgent = agentFor(item.tokenId);
    if (!routeAgent || routeAgent.stage !== "lane") return false;
    const queuedApproach = approachFor(routeAgent);
    if (!queuedApproach || routeAgent.currentLaneId !== queuedApproach.incomingLaneId) return false;
    if (item.entity?.routeStage !== "lane"
      || item.entity?.routeLaneId !== queuedApproach.incomingLaneId) {
      return false;
    }
    if (clamp(routeAgent.stageProgress, 0, 1) > queuedApproach.stopProgress + EPSILON) return false;

    const forwardX = Math.cos(queuedApproach.stopPoint.angle);
    const forwardY = Math.sin(queuedApproach.stopPoint.angle);
    const physicalBeyondStop = (finite(item.entity?.x) - queuedApproach.stopPoint.x) * forwardX
      + (finite(item.entity?.y) - queuedApproach.stopPoint.y) * forwardY;
    if (physicalBeyondStop > 0.25) return false;

    const broadRadius = entityBroadRadius(item.entity);
    if (distance(item.entity, queuedApproach.node)
      <= queuedApproach.conflictRadius + broadRadius + 0.25) {
      return false;
    }

    const requesterPath = movementPathFor(requesterApproach);
    const projection = nearestPointOnPolyline(
      requesterPath,
      item.entity?.x,
      item.entity?.y
    );
    if (!projection) return false;
    const requesterClearance = Math.max(0, finite(requesterApproach?.halfWidth))
      + broadRadius
      + Math.max(0, finite(movementConflictMargin, 3));
    return projection.distance > requesterClearance + EPSILON;
  }

  function junctionOccupied(approach, requesterTokenId) {
    for (const agent of currentAgents) {'''
)

replace_once(
    junction,
    '''    for (const item of physicalEntities()) {
      if (item.tokenId === requesterTokenId) continue;
      const broadRadius = entityBroadRadius(item.entity);''',
    '''    for (const item of physicalEntities()) {
      if (item.tokenId === requesterTokenId) continue;
      if (safelyQueuedRouteEntity(item, approach)) continue;
      const broadRadius = entityBroadRadius(item.entity);'''
)

replace_once(
    junction,
    '''    const occupancy = junctionOccupied(approach, agent.tokenId);
    if (occupancy.blocked) {''',
    '''    const permitBlocker = conflictingPermit(approach, agent.tokenId);
    if (permitBlocker) {
      return {
        blocked: true,
        reason: "junction-conflict-permit",
        kind: "route-permit",
        blockerId: permitBlocker.tokenId
      };
    }

    const occupancy = junctionOccupied(approach, agent.tokenId);
    if (occupancy.blocked) {'''
)

replace_once(
    junction,
    '''      if (blocker.reason === "junction-approach-queue") approachQueueDenials++;
      else if (blocker.reason === "junction-exit-blocked") exitBlockedDenials++;
      else occupiedDenials++;''',
    '''      if (blocker.reason === "junction-approach-queue") approachQueueDenials++;
      else if (blocker.reason === "junction-exit-blocked") exitBlockedDenials++;
      else if (blocker.reason === "junction-conflict-permit") movementPermitDenials++;
      else occupiedDenials++;'''
)

replace_once(
    junction,
    '''      approachQueueDenials,
      occupiedDenials,
      exitBlockedDenials,''',
    '''      approachQueueDenials,
      occupiedDenials,
      movementPermitDenials,
      exitBlockedDenials,'''
)
