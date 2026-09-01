import { orientedVehicleContact } from "./TrafficPhysicalConsequencesSystem.js";

const EPSILON = 0.000001;

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
  for (const character of String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function polylineLength(points) {
  const list = Array.isArray(points) ? points : [];
  let total = 0;
  for (let index = 0; index < list.length - 1; index++) {
    total += Math.hypot(
      finite(list[index + 1]?.x) - finite(list[index]?.x),
      finite(list[index + 1]?.y) - finite(list[index]?.y)
    );
  }
  return total;
}

function pointAlongPolyline(points, progress) {
  const list = Array.isArray(points) ? points : [];
  if (!list.length) return null;
  if (list.length === 1) return { x: finite(list[0]?.x), y: finite(list[0]?.y), angle: 0 };

  const segments = [];
  let total = 0;
  for (let index = 0; index < list.length - 1; index++) {
    const from = list[index];
    const to = list[index + 1];
    const dx = finite(to?.x) - finite(from?.x);
    const dy = finite(to?.y) - finite(from?.y);
    const length = Math.hypot(dx, dy);
    if (length <= EPSILON) continue;
    segments.push({ from, to, dx, dy, length });
    total += length;
  }
  if (!segments.length || total <= EPSILON) return null;

  let remaining = clamp(progress, 0, 1) * total;
  for (const segment of segments) {
    if (remaining <= segment.length) {
      const local = remaining / segment.length;
      return {
        x: finite(segment.from?.x) + segment.dx * local,
        y: finite(segment.from?.y) + segment.dy * local,
        angle: Math.atan2(segment.dy, segment.dx)
      };
    }
    remaining -= segment.length;
  }
  const last = segments[segments.length - 1];
  return {
    x: finite(last.to?.x),
    y: finite(last.to?.y),
    angle: Math.atan2(last.dy, last.dx)
  };
}

function vehicleHalfWidth(entity) {
  return Math.max(4.5, finite(entity?.archetype?.height, 14) * 0.41);
}

function vehicleRadius(entity) {
  return Math.max(
    finite(entity?.radius),
    Math.max(finite(entity?.archetype?.width, 28), finite(entity?.archetype?.height, 14)) * 0.43
  );
}

function blockerEntity(materializer, blocker) {
  if (!blocker?.blockerId) return null;
  if (blocker.blockerKind === "route-traffic") {
    return materializer?.assignments?.get?.(blocker.blockerId) || null;
  }
  const vehicles = materializer?.scene?.vehicleSystem;
  return vehicles?.vehicle?.(blocker.blockerId)
    || vehicles?.vehicles?.find?.(candidate => candidate.id === blocker.blockerId)
    || null;
}

function laneFor(topology, agent) {
  if (agent?.stage !== "lane" || !agent.currentLaneId) return null;
  const lane = topology?.lanes?.[agent.currentLaneId];
  if (!lane?.points?.length) return null;
  return {
    ...lane,
    length: Math.max(1, finite(lane.length, polylineLength(lane.points)))
  };
}

export function trafficBypassRoadCapacity(lane, slot, side, {
  roadEdgeMargin = 2.5
} = {}) {
  const direction = side >= 0 ? 1 : -1;
  const roadHalfWidth = Math.max(10, finite(lane?.roadWidth, 52) * 0.5);
  const laneOffset = Math.max(0, finite(lane?.laneOffset, finite(lane?.roadWidth, 52) * 0.2));
  const usableHalfWidth = Math.max(0, roadHalfWidth - vehicleHalfWidth(slot) - Math.max(0, finite(roadEdgeMargin, 2.5)));
  const capacity = direction > 0
    ? usableHalfWidth - laneOffset
    : laneOffset + usableHalfWidth;
  return Math.max(0, capacity);
}

function poseFor(lane, agent, offset, angleDelta = 0, progressOverride = null) {
  const progress = progressOverride == null
    ? clamp(agent?.stageProgress, 0, 1)
    : clamp(progressOverride, 0, 1);
  const base = pointAlongPolyline(lane?.points, progress);
  if (!base) return null;
  const rightX = -Math.sin(base.angle);
  const rightY = Math.cos(base.angle);
  return {
    x: base.x + rightX * finite(offset),
    y: base.y + rightY * finite(offset),
    angle: base.angle + finite(angleDelta),
    baseAngle: base.angle,
    progress
  };
}

function candidateSafe(materializer, slot, pose) {
  if (!slot || !pose) return false;
  const physical = materializer?.scene?.trafficPhysicalConsequencesSystem;
  if (typeof physical?.proxyWorldSafe === "function"
    && !physical.proxyWorldSafe(slot, pose.x, pose.y)) {
    return false;
  }

  const proxy = { ...slot, x: pose.x, y: pose.y, angle: pose.angle };
  for (const other of materializer?.pool || []) {
    if (!other?.tokenId || other === slot || other.container?.active === false) continue;
    if (orientedVehicleContact(proxy, other)) return false;
  }
  for (const vehicle of materializer?.scene?.vehicleSystem?.vehicles || []) {
    if (orientedVehicleContact(proxy, vehicle)) return false;
  }
  return true;
}

export function trafficBypassPoseSafe(materializer, topology, agent, {
  offset = 0,
  angleDelta = 0,
  forwardDistance = 0
} = {}) {
  const lane = laneFor(topology, agent);
  const slot = materializer?.assignments?.get?.(agent?.tokenId);
  if (!lane || !slot) return false;

  const side = Math.sign(finite(offset));
  if (side) {
    const capacity = trafficBypassRoadCapacity(lane, slot, side);
    if (Math.abs(finite(offset)) > capacity + 0.001) return false;
  }

  const current = poseFor(lane, agent, offset, angleDelta);
  if (!candidateSafe(materializer, slot, current)) return false;
  const requestedLookAhead = Math.max(0, finite(forwardDistance));
  // The full target corridor is validated before commitment. During the lateral
  // ramp, only probe a short distance ahead so the car is allowed to create
  // clearance before testing positions that would still intersect the blocker.
  const lookAhead = Math.min(
    requestedLookAhead,
    Math.max(2, Math.abs(finite(offset)) * 0.35)
  );
  if (lookAhead <= EPSILON) return true;
  const nextProgress = clamp(finite(agent?.stageProgress) + lookAhead / lane.length, 0, 1);
  const next = poseFor(lane, agent, offset, angleDelta, nextProgress);
  return candidateSafe(materializer, slot, next);
}

export function planTrafficBypass(materializer, topology, agent, blocker, {
  minimumClearance = 3.5,
  minimumShift = 14,
  rejoinReserve = 56
} = {}) {
  const lane = laneFor(topology, agent);
  const slot = materializer?.assignments?.get?.(agent?.tokenId);
  const blockedEntity = blockerEntity(materializer, blocker);
  if (!lane || !slot || !blockedEntity) return null;

  const ownHalfWidth = vehicleHalfWidth(slot);
  const blockedHalfWidth = vehicleHalfWidth(blockedEntity);
  const requiredShift = Math.max(
    Math.max(0, finite(minimumShift, 14)),
    ownHalfWidth + blockedHalfWidth + Math.max(0, finite(minimumClearance, 3.5))
  );
  const ownRadius = vehicleRadius(slot);
  const blockerRadius = vehicleRadius(blockedEntity);
  const blockerCenterDistance = Math.max(
    ownRadius + blockerRadius,
    finite(blocker?.gap) + ownRadius + blockerRadius
  );
  const remainingDistance = (1 - clamp(agent?.stageProgress, 0, 1)) * lane.length;
  if (remainingDistance < blockerCenterDistance + Math.max(36, finite(rejoinReserve, 56))) return null;

  const preferredSide = stableHash(`${agent.tokenId}|${blocker.blockerId}`) % 2 === 0 ? -1 : 1;
  for (const side of [preferredSide, -preferredSide]) {
    const capacity = trafficBypassRoadCapacity(lane, slot, side);
    if (capacity + 0.001 < requiredShift) continue;
    const targetOffset = side * Math.min(capacity, requiredShift + 2);
    const sampleDistances = [
      0,
      Math.max(8, blockerCenterDistance - 18),
      blockerCenterDistance,
      blockerCenterDistance + 18,
      blockerCenterDistance + 38
    ];
    let clear = true;
    for (const distance of sampleDistances) {
      if (distance > remainingDistance - 8) continue;
      const progress = clamp(finite(agent.stageProgress) + distance / lane.length, 0, 1);
      const pose = poseFor(lane, agent, targetOffset, 0, progress);
      if (!candidateSafe(materializer, slot, pose)) {
        clear = false;
        break;
      }
    }
    if (!clear) continue;
    return Object.freeze({
      blockerId: blocker.blockerId,
      blockerKind: blocker.blockerKind || null,
      side,
      targetOffset,
      requiredShift,
      capacity,
      blockerCenterDistance,
      reason: side < 0 ? "bypass-left" : "bypass-right"
    });
  }
  return null;
}

export function installTrafficBypassManeuverPolicy(materializer) {
  if (!materializer?.trafficTokens || !materializer?.assignments) {
    throw new TypeError("Traffic bypass maneuver policy requires TrafficMaterializationSystem.");
  }
  if (materializer.__nbdTrafficBypassManeuverPolicy) {
    return materializer.__nbdTrafficBypassManeuverPolicy;
  }

  const originalTrafficTokens = materializer.trafficTokens;
  let transformedTokens = 0;

  function maneuverTrafficTokens(...args) {
    const tokens = originalTrafficTokens.apply(this, args) || [];
    return tokens.map(token => {
      if (token?.routeActive !== true) return token;
      const slot = materializer.assignments.get(token.tokenId);
      const offset = finite(slot?.routeManeuverOffset);
      const angleDelta = finite(slot?.routeManeuverAngleDelta);
      if (Math.abs(offset) <= 0.001 && Math.abs(angleDelta) <= 0.001) return token;
      const rightX = -Math.sin(finite(token.angle));
      const rightY = Math.cos(finite(token.angle));
      transformedTokens++;
      return {
        ...token,
        x: finite(token.x) + rightX * offset,
        y: finite(token.y) + rightY * offset,
        angle: finite(token.angle) + angleDelta,
        routeManeuverActive: true,
        routeManeuverOffset: offset,
        routeManeuverAngleDelta: angleDelta,
        routeManeuverSide: Math.sign(offset),
        routeManeuverPhase: slot?.routeManeuverPhase || null
      };
    });
  }

  materializer.trafficTokens = maneuverTrafficTokens;

  const policy = {
    active: true,
    snapshot() {
      return {
        active: true,
        geometryAuthority: "compiler-route-plus-bounded-bypass",
        freeFormSteering: false,
        transformedTokens
      };
    },
    destroy() {
      if (materializer.trafficTokens === maneuverTrafficTokens) {
        materializer.trafficTokens = originalTrafficTokens;
      }
      for (const slot of materializer.pool || []) {
        delete slot.routeManeuverOffset;
        delete slot.routeManeuverAngleDelta;
        delete slot.routeManeuverSide;
        delete slot.routeManeuverPhase;
      }
      if (materializer.__nbdTrafficBypassManeuverPolicy === policy) {
        delete materializer.__nbdTrafficBypassManeuverPolicy;
      }
    }
  };
  materializer.__nbdTrafficBypassManeuverPolicy = policy;
  return policy;
}
