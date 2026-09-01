import { orientedVehicleContact } from "./TrafficPhysicalConsequencesSystem.js";

function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function collisionMass(slot) {
  return Math.max(0.25, finite(slot?.archetype?.mass, 1));
}

function pairKey(left, right) {
  return [String(left?.tokenId || ""), String(right?.tokenId || "")].sort().join("|");
}

function candidate(system, slot, state, dx, dy, activeSlots) {
  const offsetX = finite(state?.offsetX) + finite(dx);
  const offsetY = finite(state?.offsetY) + finite(dy);
  const maxOffset = Math.max(1, finite(system?.maxOffset, 44));
  if (Math.hypot(offsetX, offsetY) > maxOffset) return null;
  const x = finite(state?.baseX) + offsetX;
  const y = finite(state?.baseY) + offsetY;
  // Other ambient cars are not static obstacles here: they belong to the same
  // positional solve. Buildings, world bounds and real VehicleSystem vehicles
  // remain authoritative through proxyWorldSafe.
  if (!system.proxyWorldSafe(slot, x, y, { ignoreSlots: activeSlots })) return null;
  return { offsetX, offsetY, x, y };
}

function applyCandidate(system, slot, state, next, other, holdSeconds) {
  state.offsetX = next.offsetX;
  state.offsetY = next.offsetY;
  state.holdSeconds = Math.max(finite(state.holdSeconds), holdSeconds);
  state.lastVehicleId = other?.tokenId || "traffic-contact";
  state.lastReason = "traffic-collision";
  state.pushes = Math.max(0, finite(state.pushes)) + 1;
  system.applyStateOffset(slot, state);
}

function latchContact(system, left, right, holdSeconds) {
  const leftState = system.stateFor(left);
  const rightState = system.stateFor(right);
  if (leftState) {
    leftState.holdSeconds = Math.max(finite(leftState.holdSeconds), holdSeconds);
    leftState.lastVehicleId = right?.tokenId || "traffic-contact";
    leftState.lastReason = "traffic-collision";
  }
  if (rightState) {
    rightState.holdSeconds = Math.max(finite(rightState.holdSeconds), holdSeconds);
    rightState.lastVehicleId = left?.tokenId || "traffic-contact";
    rightState.lastReason = "traffic-collision";
  }
}

function separatePair(system, left, right, contact, activeSlots) {
  const leftState = system.stateFor(left);
  const rightState = system.stateFor(right);
  if (!leftState || !rightState) return false;

  const padding = Math.max(0.5, finite(system.collisionPadding, 1));
  const maxStep = Math.max(2, finite(system.maxPushStep, 16));
  const separation = Math.min(maxStep, Math.max(0.8, finite(contact?.overlap) + padding));
  const leftMass = collisionMass(left);
  const rightMass = collisionMass(right);
  const totalMass = leftMass + rightMass;
  const leftShare = rightMass / totalMass;
  const rightShare = leftMass / totalMass;
  const nx = finite(contact?.normal?.x, 1);
  const ny = finite(contact?.normal?.y, 0);
  const holdSeconds = Math.max(0.12, finite(system.pushHoldSeconds, 0.16));

  const leftNext = candidate(system, left, leftState, -nx * separation * leftShare, -ny * separation * leftShare, activeSlots);
  const rightNext = candidate(system, right, rightState, nx * separation * rightShare, ny * separation * rightShare, activeSlots);

  if (leftNext && rightNext) {
    applyCandidate(system, left, leftState, leftNext, right, holdSeconds);
    applyCandidate(system, right, rightState, rightNext, left, holdSeconds);
    return true;
  }

  // A kerb, building or real vehicle may pin one member of the pair. In that
  // case let the free body absorb the full minimum translation instead of
  // abandoning the whole contact solve.
  if (leftNext) {
    const fullLeft = candidate(system, left, leftState, -nx * separation, -ny * separation, activeSlots);
    if (fullLeft) {
      applyCandidate(system, left, leftState, fullLeft, right, holdSeconds);
      latchContact(system, left, right, holdSeconds);
      return true;
    }
  }
  if (rightNext) {
    const fullRight = candidate(system, right, rightState, nx * separation, ny * separation, activeSlots);
    if (fullRight) {
      applyCandidate(system, right, rightState, fullRight, left, holdSeconds);
      latchContact(system, left, right, holdSeconds);
      return true;
    }
  }

  latchContact(system, left, right, Math.max(holdSeconds, finite(system.blockedHoldSeconds, 0.55)));
  return false;
}

function currentContacts(slots) {
  const contacts = [];
  for (let leftIndex = 0; leftIndex < slots.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < slots.length; rightIndex++) {
      const left = slots[leftIndex];
      const right = slots[rightIndex];
      const contact = orientedVehicleContact(left, right);
      if (contact) contacts.push({ left, right, contact });
    }
  }
  contacts.sort((a, b) => b.contact.overlap - a.contact.overlap
    || String(a.left.tokenId).localeCompare(String(b.left.tokenId))
    || String(a.right.tokenId).localeCompare(String(b.right.tokenId)));
  return contacts;
}

export function installTrafficRigidBodyCollisionPolicy(physicalSystem, { solverPasses = 6 } = {}) {
  if (!physicalSystem?.resolveTrafficContacts || !physicalSystem?.activeSlots || !physicalSystem?.stateFor
    || !physicalSystem?.applyStateOffset || !physicalSystem?.proxyWorldSafe) {
    throw new TypeError("Traffic rigid-body collision policy requires TrafficPhysicalConsequencesSystem.");
  }
  if (physicalSystem.__nbdRigidBodyCollisionPolicy) return physicalSystem.__nbdRigidBodyCollisionPolicy;

  const originalResolveTrafficContacts = physicalSystem.resolveTrafficContacts;
  const passes = Math.max(2, Math.min(10, Math.floor(finite(solverPasses, 6))));
  let framesWithContacts = 0;
  let depenetratedPairs = 0;
  let unresolvedPairs = 0;
  let last = null;

  function rigidBodyResolveTrafficContacts() {
    // Preserve existing collision damage/cooldown semantics first. The robust
    // pass below is positional only and exists to guarantee non-penetration.
    const legacyResolved = Math.max(0, finite(originalResolveTrafficContacts.call(this)));
    const slots = this.activeSlots();
    const initial = currentContacts(slots);
    if (!initial.length) {
      last = { initialPairs: 0, remainingPairs: 0, passes: 0, maxOverlap: 0 };
      return legacyResolved;
    }

    framesWithContacts++;
    for (const pair of initial) {
      latchContact(this, pair.left, pair.right, Math.max(0.12, finite(this.pushHoldSeconds, 0.16)));
    }

    const movedKeys = new Set();
    let usedPasses = 0;
    for (let pass = 0; pass < passes; pass++) {
      const contacts = currentContacts(slots);
      if (!contacts.length) break;
      usedPasses = pass + 1;
      let moved = false;
      for (const pair of contacts) {
        if (separatePair(this, pair.left, pair.right, pair.contact, slots)) {
          moved = true;
          movedKeys.add(pairKey(pair.left, pair.right));
        }
      }
      if (!moved) break;
    }

    const remaining = currentContacts(slots);
    for (const pair of remaining) {
      latchContact(this, pair.left, pair.right, Math.max(0.2, finite(this.blockedHoldSeconds, 0.55)));
    }
    depenetratedPairs += movedKeys.size;
    unresolvedPairs += remaining.length;
    last = {
      initialPairs: initial.length,
      remainingPairs: remaining.length,
      passes: usedPasses,
      maxOverlap: remaining.reduce((max, pair) => Math.max(max, finite(pair.contact.overlap)), 0)
    };
    return legacyResolved + movedKeys.size;
  }

  physicalSystem.resolveTrafficContacts = rigidBodyResolveTrafficContacts;

  const policy = Object.freeze({
    snapshot() {
      return {
        solver: "iterative-oriented-box-depenetration",
        solverPasses: passes,
        framesWithContacts,
        depenetratedPairs,
        unresolvedPairs,
        last: last ? { ...last } : null
      };
    },
    destroy() {
      if (physicalSystem.resolveTrafficContacts === rigidBodyResolveTrafficContacts) {
        physicalSystem.resolveTrafficContacts = originalResolveTrafficContacts;
      }
      if (physicalSystem.__nbdRigidBodyCollisionPolicy === policy) {
        delete physicalSystem.__nbdRigidBodyCollisionPolicy;
      }
    }
  });
  physicalSystem.__nbdRigidBodyCollisionPolicy = policy;
  return policy;
}
