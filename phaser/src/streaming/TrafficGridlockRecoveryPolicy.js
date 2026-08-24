function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function vehicleRadius(archetype) {
  return Math.max(finite(archetype?.width, 28), finite(archetype?.height, 14)) * 0.43;
}

function activeRouteSlots(materializer) {
  return (materializer?.pool || [])
    .filter(slot => slot?.tokenId && slot.routeActive && slot.container?.active !== false)
    .sort((left, right) => left.tokenId.localeCompare(right.tokenId));
}

function routeBehaviorMap(routePolicy) {
  const snapshot = routePolicy?.routeBehavior?.()?.snapshot?.();
  return new Map((snapshot?.vehicles || []).map(item => [item.tokenId, item]));
}

function collisionOverlap(left, right, padding = 2) {
  const dx = finite(right?.x) - finite(left?.x);
  const dy = finite(right?.y) - finite(left?.y);
  const distance = Math.hypot(dx, dy);
  const required = Math.max(1, finite(left?.radius, 14))
    + Math.max(1, finite(right?.radius, 14))
    + Math.max(0, finite(padding));
  return {
    dx,
    dy,
    distance,
    overlap: required - distance
  };
}

function choosePusher(left, right, behavior) {
  const leftBehavior = behavior.get(left.tokenId);
  const rightBehavior = behavior.get(right.tokenId);
  const leftGridlock = leftBehavior?.reason === "gridlock-push";
  const rightGridlock = rightBehavior?.reason === "gridlock-push";
  if (leftGridlock !== rightGridlock) return leftGridlock ? [left, right] : [right, left];

  const leftSpeed = Math.max(0, finite(left?.engineSpeed));
  const rightSpeed = Math.max(0, finite(right?.engineSpeed));
  if (leftSpeed >= rightSpeed + 10) return [left, right];
  if (rightSpeed >= leftSpeed + 10) return [right, left];
  return null;
}

export function installTrafficGridlockRecoveryPolicy(scene, {
  minimumImpactSpeed = 24,
  pushCooldownSeconds = 0.12,
  maximumTrafficPushStep = 12
} = {}) {
  const physical = scene?.trafficPhysicalConsequencesSystem;
  const materializer = scene?.trafficMaterializationSystem;
  const routePolicy = scene?.trafficLocalAssignmentPolicy?.multiAgentRoutePolicy;
  const vehicleSystem = scene?.vehicleSystem;
  if (!physical?.update || !physical?.stateFor || !physical?.applyStateOffset
    || !materializer?.pool || !vehicleSystem) {
    return Object.freeze({
      active: false,
      snapshot: () => ({ active: false, totalTrafficPushes: 0 }),
      destroy() {}
    });
  }
  if (physical.__nbdTrafficGridlockRecoveryPolicy) {
    return physical.__nbdTrafficGridlockRecoveryPolicy;
  }

  const originalUpdate = physical.update;
  let clockSeconds = 0;
  let totalTrafficContacts = 0;
  let totalTrafficPushes = 0;
  let totalFailedPushes = 0;
  let lastTrafficContact = null;

  function canOccupyTarget(target, pusher, x, y) {
    const radius = Math.max(1, finite(target?.radius, 14));
    const originalCanOccupy = materializer.originalVehicleCanOccupy;
    if (typeof originalCanOccupy === "function") {
      const proxy = {
        id: `traffic:${target.tokenId}`,
        x,
        y,
        angle: finite(target.angle),
        archetype: target.archetype
      };
      if (!originalCanOccupy.call(vehicleSystem, proxy, x, y, proxy.angle)) return false;
    }

    for (const vehicle of vehicleSystem.vehicles || []) {
      const otherRadius = vehicleRadius(vehicle.archetype);
      if (Math.hypot(finite(vehicle.x) - x, finite(vehicle.y) - y) < radius + otherRadius + 1) {
        return false;
      }
    }

    for (const other of activeRouteSlots(materializer)) {
      if (other === target || other === pusher) continue;
      if (Math.hypot(finite(other.x) - x, finite(other.y) - y) < radius + finite(other.radius, 14) + 1) {
        return false;
      }
    }
    return true;
  }

  function pushTrafficSlot(pusher, target, contact) {
    const state = physical.stateFor(target);
    if (!state) return false;
    const lastPushAt = finite(state.lastTrafficPushAt, -1000);
    if (clockSeconds - lastPushAt < Math.max(0.04, finite(pushCooldownSeconds, 0.12))) return true;

    let dx = contact.dx;
    let dy = contact.dy;
    let length = Math.hypot(dx, dy);
    if (length <= 0.001) {
      dx = Math.cos(finite(pusher.angle));
      dy = Math.sin(finite(pusher.angle));
      length = 1;
    }
    const directionX = dx / length;
    const directionY = dy / length;
    const impactSpeed = Math.max(
      Math.max(0, finite(minimumImpactSpeed, 24)),
      Math.max(0, finite(pusher.engineSpeed)),
      Math.max(0, finite(pusher.speedFactor, 1)) * 36
    );
    const impulse = clamp(
      Math.max(0, finite(contact.overlap)) + impactSpeed * 0.025,
      2,
      Math.min(Math.max(2, finite(maximumTrafficPushStep, 12)), Math.max(2, finite(physical.maxPushStep, 16)))
    );
    const nextOffsetX = finite(state.offsetX) + directionX * impulse;
    const nextOffsetY = finite(state.offsetY) + directionY * impulse;
    if (Math.hypot(nextOffsetX, nextOffsetY) > Math.max(8, finite(physical.maxOffset, 44))) return false;

    const nextX = finite(state.baseX, target.x) + nextOffsetX;
    const nextY = finite(state.baseY, target.y) + nextOffsetY;
    if (!canOccupyTarget(target, pusher, nextX, nextY)) return false;

    state.offsetX = nextOffsetX;
    state.offsetY = nextOffsetY;
    state.holdSeconds = Math.max(finite(state.holdSeconds), Math.max(0.08, finite(physical.pushHoldSeconds, 0.16)));
    state.lastImpactSpeed = impactSpeed;
    state.lastVehicleId = `traffic:${pusher.tokenId}`;
    state.lastReason = "traffic-pushed";
    state.lastTrafficPushAt = clockSeconds;
    state.pushes = Math.max(0, Math.floor(finite(state.pushes))) + 1;
    physical.totalContacts = Math.max(0, Math.floor(finite(physical.totalContacts))) + 1;
    physical.totalPushes = Math.max(0, Math.floor(finite(physical.totalPushes))) + 1;
    physical.applyStateOffset(target, state);
    return true;
  }

  function resolveTrafficContacts() {
    const slots = activeRouteSlots(materializer);
    const behavior = routeBehaviorMap(routePolicy);
    for (let leftIndex = 0; leftIndex < slots.length; leftIndex++) {
      for (let rightIndex = leftIndex + 1; rightIndex < slots.length; rightIndex++) {
        const left = slots[leftIndex];
        const right = slots[rightIndex];
        const contact = collisionOverlap(left, right, physical.collisionPadding);
        if (contact.overlap <= 0) continue;
        const pair = choosePusher(left, right, behavior);
        if (!pair) continue;
        const [pusher, target] = pair;
        const oriented = pusher === left
          ? contact
          : { ...contact, dx: -contact.dx, dy: -contact.dy };
        totalTrafficContacts++;
        const pushed = pushTrafficSlot(pusher, target, oriented);
        pusher.gridlockPushBlocked = !pushed;
        if (pushed) totalTrafficPushes++;
        else totalFailedPushes++;
        lastTrafficContact = {
          pusherTokenId: pusher.tokenId,
          targetTokenId: target.tokenId,
          overlap: Math.round(oriented.overlap * 100) / 100,
          pushed
        };
      }
    }
  }

  function gridlockAwareUpdate(dt = 0, options = {}) {
    const seconds = Math.max(0, finite(dt));
    clockSeconds += seconds;
    const result = originalUpdate.call(this, dt, options);
    for (const slot of activeRouteSlots(materializer)) slot.gridlockPushBlocked = false;
    resolveTrafficContacts();
    return result;
  }

  physical.update = gridlockAwareUpdate;

  const policy = Object.freeze({
    active: true,
    snapshot() {
      return {
        active: true,
        clockSeconds: Math.round(clockSeconds * 1000) / 1000,
        totalTrafficContacts,
        totalTrafficPushes,
        totalFailedPushes,
        lastTrafficContact: lastTrafficContact ? { ...lastTrafficContact } : null
      };
    },
    destroy() {
      if (physical.update === gridlockAwareUpdate) physical.update = originalUpdate;
      for (const slot of materializer.pool || []) delete slot.gridlockPushBlocked;
      if (physical.__nbdTrafficGridlockRecoveryPolicy === policy) {
        delete physical.__nbdTrafficGridlockRecoveryPolicy;
      }
    }
  });
  physical.__nbdTrafficGridlockRecoveryPolicy = policy;
  return policy;
}
