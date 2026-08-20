import {
  TrafficLocalBehaviorSystem,
  wrapPhase
} from "../streaming/TrafficLocalBehaviorSystem.js";

const JUNCTION_COMMIT_SECONDS = 1.45;
const JUNCTION_STALE_SECONDS = 2.35;
const JUNCTION_BACKOFF_SECONDS = 0.9;
const JUNCTION_PROGRESS_EPSILON = 2;

function finite(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function laneKey(edgeId, direction) {
  return `${String(edgeId || "")}:${String(direction || "forward")}`;
}

function candidateKey(junctionId, tokenId) {
  return `${String(junctionId)}:${String(tokenId)}`;
}

function baseReason(reason) {
  return String(reason || "").replace(/^assertive-/, "");
}

function backoffUntil(backoffs, junctionId, tokenId) {
  return finite(backoffs?.get?.(candidateKey(junctionId, tokenId)), 0);
}

function candidateOrder(left, right) {
  if (left.inside !== right.inside) return left.inside ? -1 : 1;
  const arrivalDelta = finite(left.arrivalAt, Infinity) - finite(right.arrivalAt, Infinity);
  if (Math.abs(arrivalDelta) > 0.0001) return arrivalDelta;
  return String(left.tokenId).localeCompare(String(right.tokenId));
}

export function chooseJunctionReservationOwner(
  candidates = [],
  reservation = null,
  now = 0,
  backoffs = new Map()
) {
  const clock = finite(now);
  const available = (Array.isArray(candidates) ? candidates : [])
    .filter(candidate => candidate && backoffUntil(backoffs, candidate.junctionId, candidate.tokenId) <= clock);
  if (!available.length) return null;

  const inside = available.filter(candidate => candidate.inside);
  if (inside.length) {
    const currentInside = reservation
      ? inside.find(candidate => candidate.tokenId === reservation.ownerId)
      : null;
    return currentInside || [...inside].sort(candidateOrder)[0] || null;
  }

  if (reservation && clock < finite(reservation.leaseUntil)) {
    const current = available.find(candidate => candidate.tokenId === reservation.ownerId);
    if (current) return current;
  }

  return [...available].sort(candidateOrder)[0] || null;
}

export function junctionReservationHasStalled(
  reservation,
  candidate,
  now,
  staleSeconds = JUNCTION_STALE_SECONDS
) {
  if (!reservation || !candidate || candidate.inside) return false;
  const clock = finite(now);
  if (clock < finite(reservation.leaseUntil)) return false;
  return clock - finite(reservation.lastProgressAt, reservation.grantedAt) >= Math.max(0.25, finite(staleSeconds, JUNCTION_STALE_SECONDS));
}

function ensureAuthority(system) {
  system.__nbdJunctionClock = Math.max(0, finite(system.__nbdJunctionClock));
  system.__nbdJunctionReservations ||= new Map();
  system.__nbdJunctionArrivals ||= new Map();
  system.__nbdJunctionBackoffs ||= new Map();
  system.__nbdJunctionCandidatesByToken ||= new Map();
  system.__nbdJunctionCandidatesByJunction ||= new Map();
  system.__nbdJunctionMetrics ||= {
    grants: 0,
    releases: 0,
    deadlockRecoveries: 0
  };
}

function collectCandidates(system, now) {
  ensureAuthority(system);
  const byJunction = new Map();
  const byToken = new Map();
  const liveArrivalKeys = new Set();

  for (const slot of system.materializer?.pool || []) {
    if (!slot?.tokenId || slot.container?.active === false) continue;
    const state = system.states?.get?.(slot.tokenId);
    if (!state) continue;
    const lane = system.laneFor?.(state);
    if (!lane) continue;

    for (const junction of system.junctions || []) {
      const projection = system.junctionProjection?.(junction, lane);
      if (!projection) continue;
      const physicalDistance = Math.hypot(finite(slot.x) - finite(junction.x), finite(slot.y) - finite(junction.y));
      const inside = physicalDistance <= finite(junction.radius, system.junctionRadius) + Math.max(8, finite(slot.radius, 14));
      const phase = wrapPhase(state.visualTravel);
      const delta = projection.progress - phase;
      const approach = inside
        ? 0
        : delta > 0.0005
          ? delta * lane.length - Math.max(8, finite(slot.radius, 14))
          : Infinity;
      if (!inside && (approach < 0 || approach > finite(junction.approachDistance, system.junctionApproachDistance))) continue;

      const arrivalKey = candidateKey(junction.id, state.tokenId);
      liveArrivalKeys.add(arrivalKey);
      if (!system.__nbdJunctionArrivals.has(arrivalKey)) {
        system.__nbdJunctionArrivals.set(arrivalKey, now);
      }
      const candidate = {
        junctionId: junction.id,
        tokenId: state.tokenId,
        laneKey: laneKey(state.edgeId, state.direction),
        arrivalAt: system.__nbdJunctionArrivals.get(arrivalKey),
        approach: Math.max(0, finite(approach)),
        inside,
        slot,
        state
      };
      if (!byJunction.has(junction.id)) byJunction.set(junction.id, []);
      byJunction.get(junction.id).push(candidate);
      if (!byToken.has(state.tokenId)) byToken.set(state.tokenId, []);
      byToken.get(state.tokenId).push(candidate);
    }
  }

  for (const key of system.__nbdJunctionArrivals.keys()) {
    if (!liveArrivalKeys.has(key)) system.__nbdJunctionArrivals.delete(key);
  }
  for (const candidates of byJunction.values()) candidates.sort(candidateOrder);
  for (const candidates of byToken.values()) {
    candidates.sort((left, right) => left.approach - right.approach || candidateOrder(left, right));
  }
  system.__nbdJunctionCandidatesByJunction = byJunction;
  system.__nbdJunctionCandidatesByToken = byToken;
  return { byJunction, byToken };
}

function releaseReservation(system, junctionId, ownerId, now, { deadlock = false } = {}) {
  const reservation = system.__nbdJunctionReservations.get(junctionId);
  if (!reservation || (ownerId && reservation.ownerId !== ownerId)) return false;
  system.__nbdJunctionReservations.delete(junctionId);
  system.__nbdJunctionMetrics.releases += 1;
  if (deadlock) {
    system.__nbdJunctionMetrics.deadlockRecoveries += 1;
    system.__nbdJunctionBackoffs.set(candidateKey(junctionId, reservation.ownerId), now + JUNCTION_BACKOFF_SECONDS);
    system.__nbdJunctionArrivals.set(candidateKey(junctionId, reservation.ownerId), now);
  }
  return true;
}

function updateReservationProgress(system, reservation, candidate, now) {
  const approach = Math.max(0, finite(candidate.approach));
  const madeProgress = approach + JUNCTION_PROGRESS_EPSILON < finite(reservation.lastApproach, Infinity)
    || (candidate.inside && !reservation.inside);
  if (!madeProgress) return false;
  reservation.lastApproach = approach;
  reservation.lastProgressAt = now;
  reservation.inside = Boolean(candidate.inside);
  reservation.leaseUntil = Math.max(finite(reservation.leaseUntil), now + JUNCTION_COMMIT_SECONDS);
  return true;
}

function grantReservation(system, candidate, now) {
  const reservation = {
    junctionId: candidate.junctionId,
    ownerId: candidate.tokenId,
    laneKey: candidate.laneKey,
    grantedAt: now,
    leaseUntil: now + JUNCTION_COMMIT_SECONDS,
    lastProgressAt: now,
    lastApproach: Math.max(0, finite(candidate.approach)),
    inside: Boolean(candidate.inside)
  };
  system.__nbdJunctionReservations.set(candidate.junctionId, reservation);
  system.__nbdJunctionMetrics.grants += 1;
  return reservation;
}

function refreshJunctionAuthority(system, seconds = 0) {
  ensureAuthority(system);
  const dt = Math.max(0, finite(seconds));
  system.__nbdJunctionClock += dt;
  const now = system.__nbdJunctionClock;

  for (const [key, until] of system.__nbdJunctionBackoffs.entries()) {
    if (finite(until) <= now) system.__nbdJunctionBackoffs.delete(key);
  }

  const { byJunction } = collectCandidates(system, now);
  for (const [junctionId, reservation] of [...system.__nbdJunctionReservations.entries()]) {
    const candidates = byJunction.get(junctionId) || [];
    const owner = candidates.find(candidate => candidate.tokenId === reservation.ownerId);
    if (!owner) {
      releaseReservation(system, junctionId, reservation.ownerId, now);
      continue;
    }
    updateReservationProgress(system, reservation, owner, now);
    if (junctionReservationHasStalled(reservation, owner, now)) {
      releaseReservation(system, junctionId, reservation.ownerId, now, { deadlock: true });
    }
  }

  for (const [junctionId, candidates] of byJunction.entries()) {
    const current = system.__nbdJunctionReservations.get(junctionId) || null;
    const owner = chooseJunctionReservationOwner(candidates, current, now, system.__nbdJunctionBackoffs);
    if (!owner) continue;
    if (!current || current.ownerId !== owner.tokenId) grantReservation(system, owner, now);
  }

  system.__nbdJunctionMetrics.activeReservations = system.__nbdJunctionReservations.size;
  return system.__nbdJunctionMetrics;
}

function reservationDecision(system, slot, state, decision) {
  const candidates = system.__nbdJunctionCandidatesByToken?.get?.(state?.tokenId) || [];
  if (!candidates.length) return decision;

  for (const candidate of candidates) {
    const reservation = system.__nbdJunctionReservations?.get?.(candidate.junctionId);
    if (!reservation) continue;
    const reason = baseReason(decision.reason);

    if (reservation.ownerId === state.tokenId) {
      if (reason === "junction-yield" && decision.junctionId === candidate.junctionId) {
        return {
          ...decision,
          desiredSpeedFactor: Math.max(1, finite(decision.desiredSpeedFactor, 1)),
          reason: "junction-priority",
          gap: null,
          blockerId: null,
          junctionId: candidate.junctionId
        };
      }
      if (["cruise", "catch-up", "junction-priority"].includes(reason)) {
        return { ...decision, reason: "junction-priority", junctionId: candidate.junctionId };
      }
      return decision;
    }

    if (candidate.inside || reservation.laneKey === candidate.laneKey) continue;
    if (reason === "junction-player") return decision;

    const gap = Math.max(0, finite(candidate.approach));
    const existingGap = decision.gap === null || decision.gap === undefined
      ? Infinity
      : finite(decision.gap, Infinity);
    if (reason !== "junction-yield" && existingGap + 0.5 < gap) return decision;

    let desiredSpeedFactor = 1;
    if (gap <= finite(system.hardStopDistance, 34)) desiredSpeedFactor = 0;
    else if (gap < finite(system.followDistance, 78)) {
      desiredSpeedFactor = clamp(
        (gap - finite(system.hardStopDistance, 34))
          / Math.max(1, finite(system.followDistance, 78) - finite(system.hardStopDistance, 34)),
        0,
        1
      );
    }
    return {
      ...decision,
      desiredSpeedFactor: Math.min(finite(decision.desiredSpeedFactor, 1), desiredSpeedFactor),
      reason: "junction-reserved",
      gap,
      blockerId: reservation.ownerId,
      junctionId: candidate.junctionId
    };
  }
  return decision;
}

function reservationSnapshot(system, snapshot) {
  const vehicles = Array.isArray(snapshot?.vehicles) ? snapshot.vehicles : [];
  const reservations = [...(system.__nbdJunctionReservations?.values?.() || [])]
    .map(item => ({
      junctionId: item.junctionId,
      ownerId: item.ownerId,
      laneKey: item.laneKey,
      leaseRemaining: Math.max(0, finite(item.leaseUntil) - finite(system.__nbdJunctionClock)),
      stalledFor: Math.max(0, finite(system.__nbdJunctionClock) - finite(item.lastProgressAt))
    }))
    .sort((left, right) => String(left.junctionId).localeCompare(String(right.junctionId)));
  return {
    ...snapshot,
    junctionReservationCount: reservations.length,
    junctionPriorityVehicles: vehicles.filter(item => baseReason(item.reason) === "junction-priority").length,
    junctionReservedVehicles: vehicles.filter(item => baseReason(item.reason) === "junction-reserved").length,
    junctionReservationGrants: Math.max(0, finite(system.__nbdJunctionMetrics?.grants)),
    junctionReservationReleases: Math.max(0, finite(system.__nbdJunctionMetrics?.releases)),
    junctionDeadlockRecoveries: Math.max(0, finite(system.__nbdJunctionMetrics?.deadlockRecoveries)),
    junctionReservations: reservations
  };
}

export function installTrafficJunctionReservationPolicy() {
  const behavior = TrafficLocalBehaviorSystem?.prototype;
  if (!behavior || behavior.__nbdJunctionReservationPolicy) return;

  const originalDecisionFor = behavior.decisionFor;
  const originalUpdate = behavior.update;
  const originalSnapshot = behavior.snapshot;

  behavior.decisionFor = function junctionReservationDecision(slot, state, token, active) {
    const decision = originalDecisionFor.call(this, slot, state, token, active);
    return reservationDecision(this, slot, state, decision);
  };

  behavior.update = function junctionReservationUpdate(dt = 0, options = {}) {
    if (!this.destroyed && this.ready && !this.scene.registry?.get?.("uiPaused")) {
      refreshJunctionAuthority(this, dt);
    }
    const result = originalUpdate.call(this, dt, options);
    if (result && this.__nbdJunctionCandidatesByToken?.size === 0) {
      refreshJunctionAuthority(this, 0);
    }
    return result;
  };

  behavior.snapshot = function junctionReservationSnapshot() {
    return reservationSnapshot(this, originalSnapshot.call(this));
  };

  Object.defineProperty(behavior, "__nbdJunctionReservationPolicy", {
    value: true,
    configurable: true
  });
}
