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

function vehicleRadius(archetype) {
  return Math.max(finite(archetype?.width, 28), finite(archetype?.height, 14)) * 0.43;
}

function failure(reason) {
  return Object.freeze({ success: false, reason });
}

function success(reason, details = {}) {
  return Object.freeze({ success: true, reason, ...details });
}

const staticRecoveryOrigins = new WeakMap();

export function executeTrafficRecovery(scene, materializer, {
  pusherTokenId,
  targetTokenId,
  maximumStep = 7
} = {}) {
  const physical = scene?.trafficPhysicalConsequencesSystem;
  const pusher = materializer?.assignments?.get?.(pusherTokenId);
  const target = materializer?.assignments?.get?.(targetTokenId);
  if (!physical?.stateFor || !physical?.applyStateOffset || !pusher || !target) {
    return failure("traffic-recovery-unavailable");
  }

  const targetState = physical.stateFor(target);
  if (!targetState) return failure("traffic-recovery-state-missing");

  let dx = finite(target.x) - finite(pusher.x);
  let dy = finite(target.y) - finite(pusher.y);
  let length = Math.hypot(dx, dy);
  if (length <= 0.001) {
    dx = Math.cos(finite(pusher.angle));
    dy = Math.sin(finite(pusher.angle));
    length = 1;
  }

  const impactSpeed = Math.max(0, finite(pusher.engineSpeed));
  const stepLimit = Math.min(
    Math.max(2, finite(maximumStep, 7)),
    Math.max(2, finite(physical.maxPushStep, 16))
  );
  const impulse = clamp(2 + impactSpeed * 0.018, 2, stepLimit);
  const nextOffsetX = finite(targetState.offsetX) + (dx / length) * impulse;
  const nextOffsetY = finite(targetState.offsetY) + (dy / length) * impulse;
  if (Math.hypot(nextOffsetX, nextOffsetY) > Math.max(8, finite(physical.maxOffset, 44))) {
    return failure("traffic-recovery-offset-limit");
  }

  const nextX = finite(targetState.baseX, target.x) + nextOffsetX;
  const nextY = finite(targetState.baseY, target.y) + nextOffsetY;
  if (typeof physical.proxyWorldSafe === "function" && !physical.proxyWorldSafe(target, nextX, nextY)) {
    return failure("traffic-recovery-space-blocked");
  }

  targetState.offsetX = nextOffsetX;
  targetState.offsetY = nextOffsetY;
  targetState.holdSeconds = Math.max(
    finite(targetState.holdSeconds),
    Math.max(0.08, finite(physical.pushHoldSeconds, 0.16))
  );
  targetState.lastImpactSpeed = impactSpeed;
  targetState.lastVehicleId = `traffic:${pusher.tokenId}`;
  targetState.lastReason = "traffic-recovery";
  targetState.pushes = Math.max(0, Math.floor(finite(targetState.pushes))) + 1;
  physical.totalContacts = Math.max(0, Math.floor(finite(physical.totalContacts))) + 1;
  physical.totalPushes = Math.max(0, Math.floor(finite(physical.totalPushes))) + 1;
  physical.applyStateOffset(target, targetState);

  return success("traffic-recovery-push", {
    pusherTokenId: pusher.tokenId,
    targetTokenId: target.tokenId,
    displacement: impulse
  });
}

function persistentVehicleSafe(scene, materializer, vehicle, x, y) {
  const vehicleSystem = scene?.vehicleSystem;
  const radius = vehicleRadius(vehicle?.archetype);
  if (typeof vehicleSystem?.canOccupy === "function"
    && !vehicleSystem.canOccupy(vehicle, x, y, finite(vehicle.angle))) {
    return false;
  }

  for (const slot of materializer?.pool || []) {
    if (!slot?.tokenId) continue;
    if (Math.hypot(finite(slot.x) - x, finite(slot.y) - y)
      < Math.max(1, finite(slot.radius, 14)) + radius + 1) {
      return false;
    }
  }
  return true;
}

function staticRecoveryOrigin(vehicle) {
  const currentX = finite(vehicle?.x);
  const currentY = finite(vehicle?.y);
  let origin = staticRecoveryOrigins.get(vehicle);
  if (!origin
    || Math.hypot(currentX - origin.lastX, currentY - origin.lastY) > 0.5) {
    origin = {
      x: currentX,
      y: currentY,
      lastX: currentX,
      lastY: currentY,
      side: null
    };
    staticRecoveryOrigins.set(vehicle, origin);
  }
  return origin;
}

export function executeStaticRecovery(scene, materializer, {
  requesterTokenId,
  vehicleId,
  step = 5,
  maximumTotalDisplacement = 64
} = {}) {
  const vehicleSystem = scene?.vehicleSystem;
  const requester = materializer?.assignments?.get?.(requesterTokenId);
  const vehicle = vehicleSystem?.vehicle?.(vehicleId)
    || vehicleSystem?.vehicles?.find?.(candidate => candidate.id === vehicleId);
  if (!requester || !vehicle) return failure("static-recovery-target-missing");
  if (vehicle.id === vehicleSystem?.currentVehicleId) return failure("static-recovery-target-driven");

  const linearSpeed = Math.max(
    Math.abs(finite(vehicle.speed)),
    Math.hypot(finite(vehicle.velocityX), finite(vehicle.velocityY))
  );
  if (!vehicle.parked && linearSpeed > 1) return failure("static-recovery-target-moving");

  const displacement = clamp(step, 2, 8);
  const totalLimit = clamp(maximumTotalDisplacement, 16, 96);
  const origin = staticRecoveryOrigin(vehicle);
  const routeAngle = finite(requester.angle);
  const preferredSide = stableHash(`${requester.tokenId}|${vehicle.id}`) % 2 === 0 ? 1 : -1;
  const sides = origin.side === 1 || origin.side === -1
    ? [origin.side]
    : [preferredSide, -preferredSide];

  for (const side of sides) {
    const offsetX = Math.cos(routeAngle + Math.PI / 2) * displacement * side;
    const offsetY = Math.sin(routeAngle + Math.PI / 2) * displacement * side;
    const nextX = finite(vehicle.x) + offsetX;
    const nextY = finite(vehicle.y) + offsetY;
    if (Math.hypot(nextX - origin.x, nextY - origin.y) > totalLimit) continue;
    if (!persistentVehicleSafe(scene, materializer, vehicle, nextX, nextY)) continue;

    vehicle.x = nextX;
    vehicle.y = nextY;
    vehicle.speed = 0;
    vehicle.velocityX = 0;
    vehicle.velocityY = 0;
    vehicle.parked = true;
    origin.lastX = nextX;
    origin.lastY = nextY;
    origin.side = side;
    vehicle.container?.setPosition?.(nextX, nextY);
    vehicleSystem?.persistVehicle?.(vehicle);
    return success("static-recovery-clearance", {
      requesterTokenId: requester.tokenId,
      vehicleId: vehicle.id,
      displacement,
      totalDisplacement: Math.hypot(nextX - origin.x, nextY - origin.y),
      maximumTotalDisplacement: totalLimit,
      side
    });
  }

  const atLimit = Math.hypot(finite(vehicle.x) - origin.x, finite(vehicle.y) - origin.y)
    + displacement > totalLimit;
  return failure(atLimit ? "static-recovery-offset-limit" : "static-recovery-space-blocked");
}