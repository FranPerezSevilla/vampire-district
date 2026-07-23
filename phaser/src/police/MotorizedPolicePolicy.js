export const MOTORIZED_POLICE_ROLES = Object.freeze({
  PURSUIT: "pursuit",
  ROADBLOCK: "roadblock"
});

export function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function clamp01(value) {
  return Math.max(0, Math.min(1, finite(value)));
}

export function desiredMotorizedUnits(level) {
  const wanted = Math.max(0, Math.floor(finite(level)));
  if (wanted >= 3) return 2;
  if (wanted >= 2) return 1;
  return 0;
}

export function motorizedRole(index, level) {
  if (desiredMotorizedUnits(level) >= 2 && Number(index) === 1) {
    return MOTORIZED_POLICE_ROLES.ROADBLOCK;
  }
  return MOTORIZED_POLICE_ROLES.PURSUIT;
}

export function shortestDistrictPath(graph, fromId, toId) {
  if (!graph?.nodes?.[fromId] || !graph?.nodes?.[toId]) return [];
  if (fromId === toId) return [fromId];

  const queue = [[fromId]];
  const visited = new Set([fromId]);
  while (queue.length) {
    const path = queue.shift();
    const current = path[path.length - 1];
    for (const neighbour of graph.nodes[current]?.neighbours || []) {
      if (visited.has(neighbour)) continue;
      const next = [...path, neighbour];
      if (neighbour === toId) return next;
      visited.add(neighbour);
      queue.push(next);
    }
  }
  return [];
}

export function edgeBetween(graph, fromId, toId) {
  if (!graph || !fromId || !toId) return null;
  return (graph.edgeIds || [])
    .map(id => graph.edges?.[id])
    .find(edge => edge && (
      (edge.a === fromId && edge.b === toId)
      || (edge.a === toId && edge.b === fromId)
    )) || null;
}

export function laneDirection(edge, fromId, toId) {
  if (!edge) return null;
  if (edge.a === fromId && edge.b === toId) return "forward";
  if (edge.b === fromId && edge.a === toId) return "reverse";
  return null;
}

export function buildPoliceRoute(graph, lanes, districtPath) {
  const path = Array.isArray(districtPath) ? districtPath : [];
  const legs = [];
  for (let index = 0; index < path.length - 1; index++) {
    const fromId = path[index];
    const toId = path[index + 1];
    const edge = edgeBetween(graph, fromId, toId);
    const direction = laneDirection(edge, fromId, toId);
    const points = edge && direction ? lanes?.edges?.[edge.id]?.[direction] : null;
    if (!edge || !direction || !Array.isArray(points) || points.length < 2) return [];
    legs.push({
      edgeId: edge.id,
      fromId,
      toId,
      direction,
      points,
      travelSeconds: Math.max(0.25, finite(edge.travelSeconds, 6))
    });
  }
  return legs;
}

export function advancePoliceRoute(state, seconds, {
  speedMultiplier = 1,
  finalStopPhase = 1
} = {}) {
  const legs = Array.isArray(state?.legs) ? state.legs : [];
  if (!legs.length) {
    return {
      legIndex: 0,
      progress: 0,
      arrived: true,
      completedLegs: 0,
      remainingSeconds: Math.max(0, finite(seconds))
    };
  }

  let legIndex = Math.max(0, Math.min(legs.length - 1, Math.floor(finite(state?.legIndex))));
  let progress = clamp01(state?.progress);
  let remaining = Math.max(0, finite(seconds));
  let completedLegs = 0;
  const multiplier = Math.max(0.05, finite(speedMultiplier, 1));
  let arrived = false;
  let guard = legs.length + 4;

  while (remaining > 0.000001 && guard-- > 0) {
    const leg = legs[legIndex];
    const isFinal = legIndex === legs.length - 1;
    const limit = isFinal ? clamp01(finalStopPhase) : 1;
    if (progress >= limit - 0.000001) {
      if (isFinal) {
        progress = limit;
        arrived = true;
        break;
      }
      legIndex++;
      progress = 0;
      completedLegs++;
      continue;
    }

    const travelSeconds = Math.max(0.25, finite(leg.travelSeconds, 6)) / multiplier;
    const secondsToLimit = (limit - progress) * travelSeconds;
    if (remaining + 0.000001 >= secondsToLimit) {
      progress = limit;
      remaining = Math.max(0, remaining - secondsToLimit);
      if (isFinal) {
        arrived = true;
        break;
      }
      legIndex++;
      progress = 0;
      completedLegs++;
    } else {
      progress += remaining / travelSeconds;
      remaining = 0;
    }
  }

  if (legIndex === legs.length - 1 && progress >= clamp01(finalStopPhase) - 0.000001) {
    arrived = true;
  }

  return {
    legIndex,
    progress: clamp01(progress),
    arrived,
    completedLegs,
    remainingSeconds: remaining
  };
}

export function chooseResponseOrigin(graph, targetId, index = 0, preferred = []) {
  const candidates = (preferred.length ? preferred : graph?.nodeIds || [])
    .filter(id => graph?.nodes?.[id] && id !== targetId)
    .map(id => ({ id, path: shortestDistrictPath(graph, id, targetId) }))
    .filter(candidate => candidate.path.length >= 2)
    .sort((left, right) => (
      right.path.length - left.path.length
      || left.id.localeCompare(right.id)
    ));
  if (!candidates.length) return targetId;
  return candidates[Math.max(0, Math.floor(finite(index))) % candidates.length].id;
}

export function reservedOfficerCount(level, units = [], officersPerUnit = 2) {
  const desired = desiredMotorizedUnits(level);
  let reserved = 0;
  for (let index = 0; index < desired; index++) {
    const unit = units.find(candidate => Number(candidate?.index) === index);
    if (!unit?.officersDismounted) reserved += Math.max(1, Math.floor(finite(officersPerUnit, 2)));
  }
  return reserved;
}
