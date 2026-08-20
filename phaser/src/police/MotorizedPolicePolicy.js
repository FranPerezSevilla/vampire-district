export const MOTORIZED_POLICE_ROLES = Object.freeze({
  PURSUIT: "pursuit",
  ROADBLOCK: "roadblock"
});

export const MOTORIZED_POLICE_TACTICS = Object.freeze({
  ROUTE: "route",
  INTERCEPT: "intercept",
  RAM_TELEGRAPH: "ram-telegraph",
  RAM_COMMIT: "ram-commit",
  REAR_QUARTER: "rear-quarter",
  PIT_TELEGRAPH: "pit-telegraph",
  PIT_COMMIT: "pit-commit",
  ROADBLOCK: "roadblock"
});

export const MOTORIZED_POLICE_ROUTE_AGGRESSION = 1.2;
export const MOTORIZED_POLICE_STEERING_AGGRESSION = 1.18;

export function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function clamp01(value) {
  return Math.max(0, Math.min(1, finite(value)));
}

function targetVelocity(target = {}) {
  let x = finite(target.velocityX, finite(target.vx));
  let y = finite(target.velocityY, finite(target.vy));
  if (Math.hypot(x, y) <= 0.001 && Math.abs(finite(target.speed)) > 0.001) {
    const angle = finite(target.travelAngle, finite(target.angle));
    x = Math.cos(angle) * finite(target.speed);
    y = Math.sin(angle) * finite(target.speed);
  }
  return { x, y };
}

export function predictInterceptPoint(target = {}, {
  leadSeconds = 0.85,
  maxLead = 120
} = {}) {
  const velocity = targetVelocity(target);
  let dx = velocity.x * Math.max(0, finite(leadSeconds, 0.85));
  let dy = velocity.y * Math.max(0, finite(leadSeconds, 0.85));
  const lead = Math.hypot(dx, dy);
  const limit = Math.max(0, finite(maxLead, 120));
  if (lead > limit && lead > 0.001) {
    const scale = limit / lead;
    dx *= scale;
    dy *= scale;
  }
  return {
    x: finite(target.x) + dx,
    y: finite(target.y) + dy,
    leadDistance: Math.hypot(dx, dy)
  };
}

export function rearQuarterTarget(vehicle = {}, index = 0, {
  rearDistance = 52,
  lateralDistance = 18
} = {}) {
  const angle = finite(vehicle.travelAngle, finite(vehicle.angle));
  const side = Math.floor(finite(index)) % 2 === 0 ? -1 : 1;
  const forwardX = Math.cos(angle);
  const forwardY = Math.sin(angle);
  const sideX = -forwardY;
  const sideY = forwardX;
  return {
    x: finite(vehicle.x) - forwardX * Math.max(0, finite(rearDistance, 52))
      + sideX * side * Math.max(0, finite(lateralDistance, 18)),
    y: finite(vehicle.y) - forwardY * Math.max(0, finite(rearDistance, 52))
      + sideY * side * Math.max(0, finite(lateralDistance, 18)),
    angle,
    side
  };
}

export function rotateToward(current, target, maximumStep) {
  const tau = Math.PI * 2;
  let delta = (finite(target) - finite(current) + Math.PI) % tau;
  if (delta < 0) delta += tau;
  delta -= Math.PI;
  const step = Math.max(0, finite(maximumStep)) * MOTORIZED_POLICE_STEERING_AGGRESSION;
  return finite(current) + Math.max(-step, Math.min(step, delta));
}

export function policeTacticLabel(tactic) {
  if (tactic === MOTORIZED_POLICE_TACTICS.RAM_TELEGRAPH) return "RAM!";
  if (tactic === MOTORIZED_POLICE_TACTICS.RAM_COMMIT) return "RAM";
  if (tactic === MOTORIZED_POLICE_TACTICS.PIT_TELEGRAPH) return "PIT!";
  if (tactic === MOTORIZED_POLICE_TACTICS.PIT_COMMIT) return "PIT";
  if (tactic === MOTORIZED_POLICE_TACTICS.ROADBLOCK) return "BLOCK";
  return "";
}

export function desiredMotorizedUnits(level) {
  const wanted = Math.max(0, Math.floor(finite(level)));
  if (wanted >= 3) return 3;
  // Wanted 2 deliberately has a third pursuit cruiser in reserve. This keeps at least two
  // cars applying mobile pressure if one unit is blocked, disabled or transitions to officers.
  if (wanted >= 2) return 3;
  return 0;
}

export function motorizedRole(index, level) {
  if (Math.max(0, Math.floor(finite(level))) >= 3 && Number(index) === 2) {
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
      || (edge.b === fromId && edge.a === toId)
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
  const multiplier = Math.max(0.05, finite(speedMultiplier, 1)) * MOTORIZED_POLICE_ROUTE_AGGRESSION;
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
      left.path.length - right.path.length
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
