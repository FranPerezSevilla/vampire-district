import { chooseTrafficRouteTransition } from "./TrafficRouteCursor.js";

const EPSILON = 0.000001;

function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function distance(left, right) {
  return Math.hypot(finite(left?.x) - finite(right?.x), finite(left?.y) - finite(right?.y));
}

function polylineMetrics(points) {
  const list = Array.isArray(points) ? points : [];
  const segments = [];
  let length = 0;
  for (let index = 0; index < list.length - 1; index++) {
    const from = list[index];
    const to = list[index + 1];
    const dx = finite(to?.x) - finite(from?.x);
    const dy = finite(to?.y) - finite(from?.y);
    const segmentLength = Math.hypot(dx, dy);
    if (segmentLength <= EPSILON) continue;
    segments.push({ from, to, dx, dy, length: segmentLength, startDistance: length });
    length += segmentLength;
  }
  return { points: list, segments, length };
}

function pointAtDistance(points, requestedDistance) {
  const metrics = polylineMetrics(points);
  if (!metrics.segments.length) {
    const point = metrics.points[0] || { x: 0, y: 0 };
    return { x: finite(point.x), y: finite(point.y), angle: 0, distance: 0, progress: 0 };
  }
  const target = clamp(requestedDistance, 0, metrics.length);
  for (const segment of metrics.segments) {
    if (target <= segment.startDistance + segment.length + EPSILON) {
      const local = clamp((target - segment.startDistance) / segment.length, 0, 1);
      return {
        x: finite(segment.from?.x) + segment.dx * local,
        y: finite(segment.from?.y) + segment.dy * local,
        angle: Math.atan2(segment.dy, segment.dx),
        distance: target,
        progress: metrics.length > EPSILON ? target / metrics.length : 0
      };
    }
  }
  const last = metrics.segments[metrics.segments.length - 1];
  return {
    x: finite(last.to?.x),
    y: finite(last.to?.y),
    angle: Math.atan2(last.dy, last.dx),
    distance: metrics.length,
    progress: 1
  };
}

function nearestPointOnPolyline(points, x, y) {
  const metrics = polylineMetrics(points);
  if (!metrics.segments.length) return null;
  let best = null;
  for (const segment of metrics.segments) {
    const local = clamp(
      ((finite(x) - finite(segment.from?.x)) * segment.dx
        + (finite(y) - finite(segment.from?.y)) * segment.dy)
      / (segment.length * segment.length),
      0,
      1
    );
    const px = finite(segment.from?.x) + segment.dx * local;
    const py = finite(segment.from?.y) + segment.dy * local;
    const candidate = {
      x: px,
      y: py,
      distance: Math.hypot(finite(x) - px, finite(y) - py),
      along: segment.startDistance + segment.length * local,
      progress: metrics.length > EPSILON
        ? (segment.startDistance + segment.length * local) / metrics.length
        : 0,
      angle: Math.atan2(segment.dy, segment.dx),
      length: metrics.length
    };
    if (!best || candidate.distance < best.distance) best = candidate;
  }
  return best;
}

function safeConnectorForTransition(topology, transition) {
  if (!transition?.requiresConnector) return null;
  const bundle = topology?.junctionConnectors;
  return (bundle?.connectorIds || [])
    .map(id => bundle.connectors?.[id])
    .find(connector => (
      connector?.transitionId === transition.id
      && connector.activationSafe === true
      && (!Array.isArray(connector.rejectionReasons) || connector.rejectionReasons.length === 0)
    )) || null;
}

function entityHalfLength(entity) {
  return Math.max(9, finite(entity?.archetype?.width, finite(entity?.width, 28)) * 0.43);
}

function entityHalfWidth(entity) {
  return Math.max(4.5, finite(entity?.archetype?.height, finite(entity?.height, 14)) * 0.41);
}

function entityBroadRadius(entity) {
  if (Number.isFinite(Number(entity?.radius))) return Math.max(4, finite(entity.radius));
  return Math.hypot(entityHalfLength(entity), entityHalfWidth(entity));
}

function normalizedNode(topology, transition, connector) {
  const node = topology?.nodes?.[transition?.nodeId];
  if (node) return node;
  const points = connector?.points || [];
  const midpoint = points[Math.floor(points.length * 0.5)] || connector?.start || connector?.end || { x: 0, y: 0 };
  return {
    id: transition?.nodeId || connector?.nodeId || null,
    x: finite(midpoint.x),
    y: finite(midpoint.y),
    trimDistance: 18,
    maximumRoadWidth: 36
  };
}

function routeAgentFromSlot(slot) {
  if (!slot?.tokenId || slot.routeStage !== "lane" || !slot.routeLaneId) return null;
  return {
    tokenId: slot.tokenId,
    stage: "lane",
    currentLaneId: slot.routeLaneId,
    routeHop: Math.max(0, Math.floor(finite(slot.routeHop))),
    stageProgress: clamp(slot.routeStageProgress, 0, 1)
  };
}

export function trafficJunctionApproach(topology, agent, entity = null, {
  stopMargin = 8,
  minimumStopDistance = 16,
  maximumStopDistance = 36,
  exitMargin = 10,
  minimumExitClearance = 30,
  conflictMargin = 2
} = {}) {
  if (agent?.stage !== "lane" || !agent.currentLaneId) return null;
  const lane = topology?.lanes?.[agent.currentLaneId];
  if (!lane?.points?.length) return null;
  const transition = chooseTrafficRouteTransition(
    topology,
    agent.currentLaneId,
    agent.tokenId,
    agent.routeHop
  );
  if (!transition?.requiresConnector) return null;
  const connector = safeConnectorForTransition(topology, transition);
  const outgoingLane = topology?.lanes?.[transition.outgoingLaneId];
  if (!connector || !outgoingLane?.points?.length) return null;

  const laneMetrics = polylineMetrics(lane.points);
  if (laneMetrics.length <= EPSILON) return null;
  const halfLength = entityHalfLength(entity);
  const maxByLane = Math.max(8, laneMetrics.length * 0.35);
  const stopDistance = clamp(
    Math.max(minimumStopDistance, halfLength + Math.max(0, finite(stopMargin, 8))),
    8,
    Math.min(Math.max(8, finite(maximumStopDistance, 36)), maxByLane)
  );
  const stopPoint = pointAtDistance(lane.points, Math.max(0, laneMetrics.length - stopDistance));
  const node = normalizedNode(topology, transition, connector);
  const connectorRadius = (connector.points || [])
    .reduce((maximum, point) => Math.max(maximum, distance(point, node)), 0);
  const conflictRadius = Math.max(
    14,
    finite(node?.trimDistance),
    finite(node?.maximumRoadWidth) * 0.5,
    connectorRadius
  ) + Math.max(0, finite(conflictMargin, 2));
  const exitClearanceDistance = Math.max(
    finite(minimumExitClearance, 30),
    halfLength * 2 + Math.max(0, finite(exitMargin, 10))
  );

  return {
    junctionId: transition.nodeId || connector.nodeId,
    transitionId: transition.id,
    connectorId: connector.id,
    incomingLaneId: transition.incomingLaneId,
    outgoingLaneId: transition.outgoingLaneId,
    laneLength: laneMetrics.length,
    stopDistance,
    stopProgress: clamp(stopPoint.progress, 0, 1),
    stopPoint,
    node: {
      id: node?.id || transition.nodeId || connector.nodeId,
      x: finite(node?.x),
      y: finite(node?.y)
    },
    conflictRadius,
    exitClearanceDistance,
    halfLength,
    halfWidth: entityHalfWidth(entity)
  };
}

function queueSnapshot(waitersByJunction) {
  return [...waitersByJunction.entries()]
    .map(([junctionId, waiters]) => ({
      junctionId,
      waiters: [...waiters.values()]
        .map(waiter => ({ ...waiter }))
        .sort((left, right) => left.sequence - right.sequence || left.tokenId.localeCompare(right.tokenId))
    }))
    .filter(entry => entry.waiters.length)
    .sort((left, right) => left.junctionId.localeCompare(right.junctionId));
}

export function createTrafficJunctionFlowController(materializer, {
  topology = materializer?.lanes?.localTopology,
  stopMargin = 8,
  minimumStopDistance = 16,
  maximumStopDistance = 36,
  exitMargin = 10,
  minimumExitClearance = 30,
  conflictMargin = 2,
  exitLateralMargin = 3,
  clearGeometryMargin = 2,
  minimumSeedSpacing = 34,
  permitCorridorMargin = 8
} = {}) {
  if (!materializer?.assignments || !materializer?.pool) {
    throw new TypeError("Traffic junction flow controller requires TrafficMaterializationSystem.");
  }
  if (!topology?.lanes || !topology?.transitions || !topology?.junctionConnectors?.connectors) {
    throw new TypeError("Traffic junction flow controller requires compiler-owned junction topology.");
  }

  const waitersByJunction = new Map();
  const permits = new Map();
  let currentAgents = [];
  let waiterSequence = 0;
  let normalizedSeedAgents = 0;
  let admissionRequests = 0;
  let admissionGrants = 0;
  let admissionDenials = 0;
  let queueDenials = 0;
  let approachQueueDenials = 0;
  let occupiedDenials = 0;
  let exitBlockedDenials = 0;
  let clearanceReleases = 0;
  let forcedReleases = 0;
  let physicalGuardDenials = 0;
  let permitCorridorDenials = 0;
  let lastDecision = null;
  let physicalSystem = null;
  let originalProxyWorldSafe = null;
  let guardedProxyWorldSafe = null;
  let destroyed = false;

  function slotFor(tokenId) {
    return materializer.assignments.get(String(tokenId || "")) || null;
  }

  function approachFor(agent) {
    return trafficJunctionApproach(topology, agent, slotFor(agent?.tokenId), {
      stopMargin,
      minimumStopDistance,
      maximumStopDistance,
      exitMargin,
      minimumExitClearance,
      conflictMargin
    });
  }

  function queueFor(junctionId) {
    let queue = waitersByJunction.get(junctionId);
    if (!queue) {
      queue = new Map();
      waitersByJunction.set(junctionId, queue);
    }
    return queue;
  }

  function enqueue(approach, tokenId, nowSeconds) {
    const queue = queueFor(approach.junctionId);
    if (!queue.has(tokenId)) {
      queue.set(tokenId, {
        tokenId,
        transitionId: approach.transitionId,
        incomingLaneId: approach.incomingLaneId,
        outgoingLaneId: approach.outgoingLaneId,
        enqueuedAt: Math.max(0, finite(nowSeconds)),
        sequence: waiterSequence++
      });
    }
    return queue.get(tokenId);
  }

  function dequeue(junctionId, tokenId) {
    const queue = waitersByJunction.get(junctionId);
    if (!queue) return false;
    const removed = queue.delete(tokenId);
    if (!queue.size) waitersByJunction.delete(junctionId);
    return removed;
  }

  function queueHead(junctionId) {
    const queue = waitersByJunction.get(junctionId);
    if (!queue?.size) return null;
    return [...queue.values()]
      .sort((left, right) => left.sequence - right.sequence || left.tokenId.localeCompare(right.tokenId))[0] || null;
  }

  function agentFor(tokenId) {
    const id = String(tokenId || "");
    return currentAgents.find(agent => String(agent?.tokenId || "") === id) || null;
  }

  function sameApproachBlocker(agent) {
    if (agent?.stage !== "lane" || !agent.currentLaneId) return null;
    const ownProgress = clamp(agent.stageProgress, 0, 1);
    let best = null;
    for (const other of currentAgents) {
      if (!other || other.tokenId === agent.tokenId || other.stage !== "lane"
        || other.currentLaneId !== agent.currentLaneId) continue;
      const otherProgress = clamp(other.stageProgress, 0, 1);
      const ahead = otherProgress > ownProgress + EPSILON
        || (Math.abs(otherProgress - ownProgress) <= EPSILON
          && String(other.tokenId).localeCompare(String(agent.tokenId)) < 0);
      if (!ahead) continue;
      const delta = Math.max(0, otherProgress - ownProgress);
      if (!best || delta < best.delta
        || (Math.abs(delta - best.delta) <= EPSILON
          && String(other.tokenId).localeCompare(String(best.tokenId)) < 0)) {
        best = { tokenId: String(other.tokenId), delta };
      }
    }
    return best;
  }

  function physicalEntities() {
    const entities = [];
    for (const slot of materializer.pool || []) {
      if (!slot?.tokenId || slot.container?.active === false) continue;
      entities.push({ entity: slot, kind: "route-traffic", tokenId: slot.tokenId });
    }
    for (const vehicle of materializer.scene?.vehicleSystem?.vehicles || []) {
      entities.push({ entity: vehicle, kind: "persistent-vehicle", tokenId: null });
    }
    if (!materializer.scene?.vehicleSystem?.isDriving?.() && materializer.scene?.player) {
      entities.push({
        entity: {
          x: materializer.scene.player.x,
          y: materializer.scene.player.y,
          radius: 8,
          width: 16,
          height: 16
        },
        kind: "player",
        tokenId: null
      });
    }
    return entities;
  }

  function junctionOccupied(approach, requesterTokenId) {
    for (const agent of currentAgents) {
      if (agent.tokenId === requesterTokenId || agent.stage !== "connector" || !agent.connectorId) continue;
      const connector = topology.junctionConnectors.connectors[agent.connectorId];
      if (connector?.nodeId === approach.junctionId) {
        return { blocked: true, kind: "route-connector", blockerId: agent.tokenId };
      }
    }

    for (const item of physicalEntities()) {
      if (item.tokenId === requesterTokenId) continue;
      const broadRadius = entityBroadRadius(item.entity);
      if (distance(item.entity, approach.node) <= approach.conflictRadius + broadRadius) {
        return {
          blocked: true,
          kind: item.kind,
          blockerId: item.tokenId || item.entity?.id || item.kind
        };
      }
    }
    return { blocked: false, kind: null, blockerId: null };
  }

  function routeAgentBlocksExit(agent, approach, requesterTokenId) {
    if (!agent || agent.tokenId === requesterTokenId) return false;
    if (agent.stage !== "lane" || agent.currentLaneId !== approach.outgoingLaneId) return false;
    const lane = topology.lanes[approach.outgoingLaneId];
    const laneLength = polylineMetrics(lane?.points).length;
    if (laneLength <= EPSILON) return false;
    const slot = slotFor(agent.tokenId);
    const occupiedUntil = approach.exitClearanceDistance + entityHalfLength(slot) + 2;
    return clamp(agent.stageProgress, 0, 1) * laneLength <= occupiedUntil;
  }

  function physicalEntityBlocksExit(item, approach, requesterTokenId) {
    if (item.tokenId === requesterTokenId) return false;
    const lane = topology.lanes[approach.outgoingLaneId];
    const projection = nearestPointOnPolyline(lane?.points, item.entity?.x, item.entity?.y);
    if (!projection) return false;
    const longitudinalPadding = entityHalfLength(item.entity) + 2;
    if (projection.along < -longitudinalPadding
      || projection.along > approach.exitClearanceDistance + longitudinalPadding) {
      return false;
    }
    const lateralLimit = approach.halfWidth
      + entityHalfWidth(item.entity)
      + Math.max(0, finite(exitLateralMargin, 3));
    return projection.distance <= lateralLimit;
  }

  function exitCorridorBlocked(approach, requesterTokenId) {
    for (const agent of currentAgents) {
      if (routeAgentBlocksExit(agent, approach, requesterTokenId)) {
        return { blocked: true, kind: "route-exit", blockerId: agent.tokenId };
      }
    }
    for (const item of physicalEntities()) {
      if (physicalEntityBlocksExit(item, approach, requesterTokenId)) {
        return {
          blocked: true,
          kind: item.kind,
          blockerId: item.tokenId || item.entity?.id || item.kind
        };
      }
    }
    return { blocked: false, kind: null, blockerId: null };
  }

  function admissionBlockFor(agent, approach) {
    const laneBlocker = sameApproachBlocker(agent);
    if (laneBlocker) {
      return {
        blocked: true,
        reason: "junction-approach-queue",
        kind: "route-traffic",
        blockerId: laneBlocker.tokenId
      };
    }

    const occupancy = junctionOccupied(approach, agent.tokenId);
    if (occupancy.blocked) {
      return {
        blocked: true,
        reason: "junction-conflict-occupied",
        kind: occupancy.kind,
        blockerId: occupancy.blockerId
      };
    }

    const exit = exitCorridorBlocked(approach, agent.tokenId);
    if (exit.blocked) {
      return {
        blocked: true,
        reason: "junction-exit-blocked",
        kind: exit.kind,
        blockerId: exit.blockerId
      };
    }
    return { blocked: false, reason: null, kind: null, blockerId: null };
  }

  function firstAdmissibleWaiter(junctionId) {
    const queue = waitersByJunction.get(junctionId);
    if (!queue?.size) return null;
    const waiters = [...queue.values()]
      .sort((left, right) => left.sequence - right.sequence || left.tokenId.localeCompare(right.tokenId));
    for (const waiter of waiters) {
      const agent = agentFor(waiter.tokenId);
      const approach = approachFor(agent);
      if (!agent || !approach || approach.junctionId !== junctionId) continue;
      const block = admissionBlockFor(agent, approach);
      if (!block.blocked) return { waiter, agent, approach };
    }
    return null;
  }

  function recordDecision(granted, reason, approach, tokenId, blockerId = null) {
    lastDecision = {
      granted: Boolean(granted),
      reason,
      tokenId,
      junctionId: approach?.junctionId || null,
      transitionId: approach?.transitionId || null,
      blockerId: blockerId || null
    };
    return { ...lastDecision };
  }

  function requestAdmission({
    agent,
    nowSeconds = 0,
    reservationRegistry
  } = {}) {
    const approach = approachFor(agent);
    if (!approach) return { granted: true, reason: "not-a-controlled-junction", approach: null };
    const tokenId = String(agent.tokenId);
    admissionRequests++;

    const owned = reservationRegistry?.reservationFor?.(approach.junctionId);
    if (owned?.tokenId === tokenId) {
      reservationRegistry.request({
        junctionId: approach.junctionId,
        tokenId,
        connectorId: approach.connectorId,
        nowSeconds
      });
      let permit = permits.get(tokenId);
      if (!permit) {
        permit = {
          ...approach,
          tokenId,
          phase: "approach",
          acquiredAt: Math.max(0, finite(nowSeconds)),
          lastTouchedAt: Math.max(0, finite(nowSeconds))
        };
        permits.set(tokenId, permit);
      } else {
        permit.lastTouchedAt = Math.max(0, finite(nowSeconds));
      }
      dequeue(approach.junctionId, tokenId);
      return { granted: true, reason: "already-owned", approach, permit: { ...permit } };
    }

    enqueue(approach, tokenId, nowSeconds);
    if (owned && owned.tokenId !== tokenId) {
      admissionDenials++;
      occupiedDenials++;
      return {
        granted: false,
        reason: "junction-occupied",
        approach,
        ownerTokenId: owned.tokenId,
        ...recordDecision(false, "junction-occupied", approach, tokenId, owned.tokenId)
      };
    }

    const blocker = admissionBlockFor(agent, approach);
    if (blocker.blocked) {
      admissionDenials++;
      if (blocker.reason === "junction-approach-queue") approachQueueDenials++;
      else if (blocker.reason === "junction-exit-blocked") exitBlockedDenials++;
      else occupiedDenials++;
      return {
        granted: false,
        reason: blocker.reason,
        approach,
        blockerId: blocker.blockerId,
        blockerKind: blocker.kind,
        ...recordDecision(false, blocker.reason, approach, tokenId, blocker.blockerId)
      };
    }

    // Preserve arrival order among vehicles that can actually clear the box.
    // An older waiter whose own exit is blocked does not freeze unrelated legal
    // movements forever; it keeps its sequence and regains priority as soon as
    // its corridor becomes available.
    const eligible = firstAdmissibleWaiter(approach.junctionId);
    if (eligible?.waiter?.tokenId !== tokenId) {
      const head = eligible?.waiter || queueHead(approach.junctionId);
      admissionDenials++;
      queueDenials++;
      return {
        granted: false,
        reason: "junction-queue",
        approach,
        ownerTokenId: head?.tokenId || null,
        ...recordDecision(false, "junction-queue", approach, tokenId, head?.tokenId)
      };
    }

    const request = reservationRegistry?.request?.({
      junctionId: approach.junctionId,
      tokenId,
      connectorId: approach.connectorId,
      nowSeconds
    });
    if (!request?.granted) {
      admissionDenials++;
      occupiedDenials++;
      return {
        granted: false,
        reason: request?.reason || "junction-occupied",
        approach,
        ownerTokenId: request?.ownerTokenId || request?.reservation?.tokenId || null,
        ...recordDecision(
          false,
          request?.reason || "junction-occupied",
          approach,
          tokenId,
          request?.ownerTokenId || request?.reservation?.tokenId
        )
      };
    }

    const permit = {
      ...approach,
      tokenId,
      phase: "approach",
      acquiredAt: Math.max(0, finite(nowSeconds)),
      lastTouchedAt: Math.max(0, finite(nowSeconds))
    };
    permits.set(tokenId, permit);
    dequeue(approach.junctionId, tokenId);
    admissionGrants++;
    recordDecision(true, "junction-admission-granted", approach, tokenId);
    return { granted: true, reason: "junction-admission-granted", approach, permit: { ...permit } };
  }

  function movementAllowance({
    agent,
    duration = 0.05,
    speed = 0,
    nowSeconds = 0,
    reservationRegistry
  } = {}) {
    const approach = approachFor(agent);
    if (!approach) return { allowed: true, approach: null };
    const permit = permits.get(String(agent.tokenId));
    if (permit?.junctionId === approach.junctionId) {
      return { allowed: true, approach, permit: { ...permit } };
    }

    const currentProgress = clamp(agent.stageProgress, 0, 1);
    const distanceToStop = Math.max(0, (approach.stopProgress - currentProgress) * approach.laneLength);
    const travelDistance = Math.max(0, finite(speed)) * Math.max(0, finite(duration));
    const reachesStopLine = currentProgress >= approach.stopProgress - EPSILON
      || travelDistance + EPSILON >= distanceToStop;
    if (!reachesStopLine) return { allowed: true, approach };

    const admission = requestAdmission({ agent, nowSeconds, reservationRegistry });
    if (admission.granted) return { allowed: true, approach, permit: admission.permit || null };
    const allowedSeconds = speed > EPSILON
      ? Math.min(Math.max(0, finite(duration)), distanceToStop / speed)
      : 0;
    return {
      allowed: false,
      reason: "junction-yield",
      detailReason: admission.reason,
      approach,
      allowedSeconds,
      holdProgress: Math.max(currentProgress, approach.stopProgress),
      blockerId: admission.blockerId || admission.ownerTokenId || null
    };
  }

  function confirmConnectorEntry({
    tokenId,
    transition,
    connector,
    nowSeconds = 0,
    reservationRegistry
  } = {}) {
    const permit = permits.get(String(tokenId));
    const junctionId = transition?.nodeId || connector?.nodeId || permit?.junctionId || null;
    if (!junctionId || !permit || permit.junctionId !== junctionId || permit.connectorId !== connector?.id) {
      return { allowed: false, reason: "junction-admission-missing" };
    }
    const request = reservationRegistry.request({
      junctionId,
      tokenId,
      connectorId: connector.id,
      nowSeconds
    });
    if (!request.granted) return { allowed: false, reason: request.reason || "junction-occupied" };
    permit.phase = "connector";
    permit.lastTouchedAt = Math.max(0, finite(nowSeconds));
    return { allowed: true, reason: "junction-entry-confirmed" };
  }

  function markConnectorExit({
    tokenId,
    outgoingLaneId,
    nowSeconds = 0,
    reservationRegistry
  } = {}) {
    const permit = permits.get(String(tokenId));
    if (!permit) return false;
    permit.phase = "clearing-exit";
    permit.outgoingLaneId = outgoingLaneId || permit.outgoingLaneId;
    permit.lastTouchedAt = Math.max(0, finite(nowSeconds));
    reservationRegistry?.touch?.({
      junctionId: permit.junctionId,
      tokenId,
      nowSeconds
    });
    return true;
  }

  function agentClearedPermit(agent, permit) {
    if (!agent || !permit || agent.stage !== "lane" || agent.currentLaneId !== permit.outgoingLaneId) return false;
    const lane = topology.lanes[permit.outgoingLaneId];
    const laneLength = polylineMetrics(lane?.points).length;
    const progressDistance = clamp(agent.stageProgress, 0, 1) * laneLength;
    const progressClear = progressDistance + EPSILON >= permit.exitClearanceDistance;

    const slot = slotFor(agent.tokenId);
    if (!slot) return progressClear;
    if (slot.routeStage !== "lane" || slot.routeLaneId !== permit.outgoingLaneId) return false;
    const centerDistance = distance(slot, permit.node);
    const geometryClear = centerDistance > permit.conflictRadius
      + entityBroadRadius(slot)
      + Math.max(0, finite(clearGeometryMargin, 2));
    return progressClear && geometryClear;
  }

  function afterAdvance({
    agent,
    nowSeconds = 0,
    reservationRegistry
  } = {}) {
    const permit = permits.get(String(agent?.tokenId || ""));
    if (!permit) return false;
    permit.lastTouchedAt = Math.max(0, finite(nowSeconds));
    if (agent.stage === "connector") {
      permit.phase = "connector";
      reservationRegistry?.touch?.({ junctionId: permit.junctionId, tokenId: permit.tokenId, nowSeconds });
      return false;
    }
    if (agent.stage === "lane" && agent.currentLaneId === permit.outgoingLaneId) {
      permit.phase = "clearing-exit";
      if (agentClearedPermit(agent, permit)) {
        reservationRegistry?.release?.({
          junctionId: permit.junctionId,
          tokenId: permit.tokenId,
          reason: "junction-fully-cleared"
        });
        permits.delete(permit.tokenId);
        clearanceReleases++;
        return true;
      }
      reservationRegistry?.touch?.({ junctionId: permit.junctionId, tokenId: permit.tokenId, nowSeconds });
      return false;
    }
    reservationRegistry?.touch?.({ junctionId: permit.junctionId, tokenId: permit.tokenId, nowSeconds });
    return false;
  }

  function cleanupQueues(liveIds) {
    for (const [junctionId, queue] of waitersByJunction) {
      for (const tokenId of queue.keys()) {
        const agent = agentFor(tokenId);
        const approach = approachFor(agent);
        if (!liveIds.has(tokenId) || !approach || approach.junctionId !== junctionId) {
          queue.delete(tokenId);
        }
      }
      if (!queue.size) waitersByJunction.delete(junctionId);
    }
  }

  function prepareStep({ agents = [], nowSeconds = 0, reservationRegistry } = {}) {
    currentAgents = Array.isArray(agents) ? agents : [];
    const liveIds = new Set(currentAgents.map(agent => String(agent.tokenId)));
    cleanupQueues(liveIds);
    for (const [tokenId, permit] of [...permits.entries()]) {
      const agent = currentAgents.find(candidate => String(candidate.tokenId) === tokenId);
      if (!agent) {
        reservationRegistry?.releaseByToken?.(tokenId, "junction-owner-missing");
        permits.delete(tokenId);
        forcedReleases++;
        continue;
      }
      afterAdvance({ agent, nowSeconds, reservationRegistry });
      if (permits.has(tokenId)) permit.lastTouchedAt = Math.max(0, finite(nowSeconds));
    }
    reservationRegistry?.cleanup?.(nowSeconds);
    return snapshot();
  }

  function normalizeAgents(agents = []) {
    const normalized = agents.map(agent => ({ ...agent }));
    const byLane = new Map();
    for (const agent of normalized) {
      const approach = approachFor(agent);
      if (!approach) continue;
      if (!byLane.has(approach.incomingLaneId)) byLane.set(approach.incomingLaneId, []);
      byLane.get(approach.incomingLaneId).push({ agent, approach });
    }

    for (const entries of byLane.values()) {
      entries.sort((left, right) => (
        clamp(right.agent.stageProgress, 0, 1) - clamp(left.agent.stageProgress, 0, 1)
        || String(left.agent.tokenId).localeCompare(String(right.agent.tokenId))
      ));
      let precedingProgress = Number.POSITIVE_INFINITY;
      for (const entry of entries) {
        const spacingProgress = Math.max(0, finite(minimumSeedSpacing, 34))
          / Math.max(EPSILON, entry.approach.laneLength);
        const bodySafeCap = entry.approach.stopProgress;
        const queueSafeCap = Number.isFinite(precedingProgress)
          ? precedingProgress - spacingProgress
          : bodySafeCap;
        const cap = clamp(Math.min(bodySafeCap, queueSafeCap), 0, 1);
        const original = clamp(entry.agent.stageProgress, 0, 1);
        const next = Math.min(original, cap);
        if (next + EPSILON < original) normalizedSeedAgents++;
        entry.agent.stageProgress = next;
        precedingProgress = next;
      }
    }
    return normalized;
  }

  function releaseToken(tokenId, reason = "forced", reservationRegistry = null) {
    const id = String(tokenId || "");
    if (!id) return false;
    for (const junctionId of [...waitersByJunction.keys()]) dequeue(junctionId, id);
    const permit = permits.get(id);
    if (permit) {
      reservationRegistry?.release?.({ junctionId: permit.junctionId, tokenId: id, reason });
      permits.delete(id);
      forcedReleases++;
      return true;
    }
    reservationRegistry?.releaseByToken?.(id, reason);
    return false;
  }

  function bypassAllowed(agent, { requiredDistance = 0, reserveDistance = 12 } = {}) {
    const approach = approachFor(agent);
    if (!approach) return true;
    const distanceToStop = Math.max(
      0,
      (approach.stopProgress - clamp(agent.stageProgress, 0, 1)) * approach.laneLength
    );
    return distanceToStop > Math.max(0, finite(requiredDistance)) + Math.max(0, finite(reserveDistance, 12));
  }

  function hasPermit(tokenId) {
    return permits.has(String(tokenId || ""));
  }

  function physicalPoseAllowed(slot, x, y) {
    if (!slot?.routeActive) return true;
    const permit = permits.get(String(slot.tokenId || ""));
    if (permit) {
      const candidatePaths = [];
      const addPath = points => {
        if (Array.isArray(points) && points.length >= 2 && !candidatePaths.includes(points)) candidatePaths.push(points);
      };
      const slotLane = topology.lanes?.[slot.routeLaneId];
      const connector = topology.junctionConnectors?.connectors?.[permit.connectorId];
      const outgoing = topology.lanes?.[permit.outgoingLaneId];
      addPath(slot.routeStage === "connector" ? connector?.points : slotLane?.points);
      if (["connector", "clearing-exit"].includes(permit.phase)) addPath(connector?.points);
      if (permit.phase === "clearing-exit") addPath(outgoing?.points);
      if (permit.phase === "approach") addPath(topology.lanes?.[permit.incomingLaneId]?.points);

      const lateralLimit = entityHalfWidth(slot) + Math.max(2, finite(permitCorridorMargin, 8));
      const insidePermitCorridor = candidatePaths.some(points => {
        const projection = nearestPointOnPolyline(points, x, y);
        return projection && projection.distance <= lateralLimit + EPSILON;
      });
      if (!insidePermitCorridor) {
        permitCorridorDenials++;
        return false;
      }
      return true;
    }

    if (slot.routeStage !== "lane") return true;
    const agent = routeAgentFromSlot(slot);
    const approach = approachFor(agent);
    if (!approach) return true;
    const forwardX = Math.cos(approach.stopPoint.angle);
    const forwardY = Math.sin(approach.stopPoint.angle);
    const beyondStop = (finite(x) - approach.stopPoint.x) * forwardX
      + (finite(y) - approach.stopPoint.y) * forwardY;
    if (beyondStop > 0.25) return false;
    const broadRadius = entityBroadRadius({ ...slot, x, y });
    if (distance({ x, y }, approach.node) <= approach.conflictRadius + broadRadius) return false;
    return true;
  }

  function installPhysicalGuard(nextPhysicalSystem) {
    if (!nextPhysicalSystem?.proxyWorldSafe) return false;
    if (physicalSystem === nextPhysicalSystem && guardedProxyWorldSafe) return true;
    if (physicalSystem && guardedProxyWorldSafe && physicalSystem.proxyWorldSafe === guardedProxyWorldSafe) {
      physicalSystem.proxyWorldSafe = originalProxyWorldSafe;
    }
    physicalSystem = nextPhysicalSystem;
    originalProxyWorldSafe = nextPhysicalSystem.proxyWorldSafe;
    guardedProxyWorldSafe = function junctionFlowGuardedProxyWorldSafe(slot, x, y, options = {}) {
      if (!physicalPoseAllowed(slot, x, y)) {
        physicalGuardDenials++;
        return false;
      }
      return originalProxyWorldSafe.call(this, slot, x, y, options);
    };
    nextPhysicalSystem.proxyWorldSafe = guardedProxyWorldSafe;
    return true;
  }

  function snapshot() {
    return {
      active: !destroyed,
      authority: "stop-line-plus-exit-clearance",
      normalizedSeedAgents,
      admissionRequests,
      admissionGrants,
      admissionDenials,
      queueDenials,
      approachQueueDenials,
      occupiedDenials,
      exitBlockedDenials,
      clearanceReleases,
      forcedReleases,
      physicalGuardDenials,
      permitCorridorDenials,
      activePermitCount: permits.size,
      activePermits: [...permits.values()]
        .map(permit => ({ ...permit, stopPoint: { ...permit.stopPoint }, node: { ...permit.node } }))
        .sort((left, right) => left.junctionId.localeCompare(right.junctionId) || left.tokenId.localeCompare(right.tokenId)),
      queues: queueSnapshot(waitersByJunction),
      lastDecision: lastDecision ? { ...lastDecision } : null
    };
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (physicalSystem && guardedProxyWorldSafe && physicalSystem.proxyWorldSafe === guardedProxyWorldSafe) {
      physicalSystem.proxyWorldSafe = originalProxyWorldSafe;
    }
    if (materializer.__nbdTrafficJunctionFlowController === controller) {
      delete materializer.__nbdTrafficJunctionFlowController;
    }
    waitersByJunction.clear();
    permits.clear();
    currentAgents = [];
    physicalSystem = null;
    originalProxyWorldSafe = null;
    guardedProxyWorldSafe = null;
  }

  const controller = {
    approachFor,
    normalizeAgents,
    prepareStep,
    movementAllowance,
    requestAdmission,
    confirmConnectorEntry,
    markConnectorExit,
    afterAdvance,
    releaseToken,
    bypassAllowed,
    hasPermit,
    physicalPoseAllowed,
    installPhysicalGuard,
    snapshot,
    destroy
  };

  const previous = materializer.__nbdTrafficJunctionFlowController;
  if (previous && previous !== controller) previous.destroy?.();
  materializer.__nbdTrafficJunctionFlowController = controller;
  if (materializer.scene?.trafficPhysicalConsequencesSystem) {
    installPhysicalGuard(materializer.scene.trafficPhysicalConsequencesSystem);
  }
  return controller;
}
