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
    segments.push({ from, dx, dy, length: segmentLength, start: length });
    length += segmentLength;
  }
  return { segments, length };
}

function nearestPointOnPolyline(points, x, y) {
  const metrics = polylineMetrics(points);
  if (!metrics.segments.length || metrics.length <= EPSILON) return null;
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
      along: segment.start + segment.length * local,
      progress: (segment.start + segment.length * local) / metrics.length,
      length: metrics.length
    };
    if (!best || candidate.distance < best.distance) best = candidate;
  }
  return best;
}

function entityHalfLength(entity) {
  return Math.max(9, finite(entity?.archetype?.width, finite(entity?.width, 28)) * 0.43);
}

function entityHalfWidth(entity) {
  return Math.max(4.5, finite(entity?.archetype?.height, finite(entity?.height, 14)) * 0.41);
}

function physicalStateFor(physicalSystem, slot) {
  return slot?.tokenId ? physicalSystem?.states?.get?.(String(slot.tokenId)) || null : null;
}

export function trafficAgentPhysicalLock(slot, physicalState = null, {
  offsetTolerance = 0.35
} = {}) {
  if (!slot) {
    return {
      locked: false,
      reason: null,
      holdSeconds: 0,
      offsetDistance: 0,
      disabled: false
    };
  }
  const holdSeconds = Math.max(
    0,
    finite(physicalState?.holdSeconds, finite(slot.physicalHoldSeconds))
  );
  const offsetX = finite(physicalState?.offsetX, finite(slot.physicalOffsetX));
  const offsetY = finite(physicalState?.offsetY, finite(slot.physicalOffsetY));
  const offsetDistance = Math.hypot(offsetX, offsetY);
  const disabled = Boolean(slot.trafficDisabled);
  const locked = disabled
    || holdSeconds > EPSILON
    || offsetDistance > Math.max(0, finite(offsetTolerance, 0.35));
  let reason = null;
  if (disabled) reason = "physical-disabled";
  else if (holdSeconds > EPSILON) reason = physicalState?.lastReason || slot.physicalReason || "physical-contact";
  else if (locked) reason = "physical-offset-recovery";
  return { locked, reason, holdSeconds, offsetDistance, disabled };
}

function routeSignature(agent) {
  if (!agent) return null;
  return {
    stage: agent.stage || null,
    laneId: agent.currentLaneId || null,
    connectorId: agent.connectorId || null,
    nextLaneId: agent.nextLaneId || null,
    routeHop: Math.max(0, Math.floor(finite(agent.routeHop))),
    stageProgress: clamp(agent.stageProgress, 0, 1)
  };
}

function sameRouteSignature(left, right) {
  if (!left || !right) return false;
  return left.stage === right.stage
    && left.laneId === right.laneId
    && left.connectorId === right.connectorId
    && left.nextLaneId === right.nextLaneId
    && left.routeHop === right.routeHop
    && Math.abs(left.stageProgress - right.stageProgress) <= EPSILON;
}

export function createTrafficAgentPhysicalAuthority(materializer, physicalSystem, {
  physicalOffsetTolerance = 0.35,
  routeLeadLookAhead = 62,
  crossingLeadStopDistance = 34,
  emergencyTravelMultiplier = 1.6,
  emergencyMargin = 7,
  lateralClearance = 3
} = {}) {
  if (!materializer?.assignments || !materializer?.pool || !materializer?.lanes) {
    throw new TypeError("Traffic agent physical authority requires TrafficMaterializationSystem.");
  }
  if (!physicalSystem?.applyStateOffset) {
    throw new TypeError("Traffic agent physical authority requires TrafficPhysicalConsequencesSystem.");
  }

  const states = new Map();
  let routePolicy = null;
  let originalUpdate = null;
  let originalStep = null;
  let originalApplyStateOffset = physicalSystem.applyStateOffset;
  let browserApi = null;
  let originalBrowserApi = null;
  let updates = 0;
  let routeLockFrames = 0;
  let residualOffsetLocks = 0;
  let physicalLeadLocks = 0;
  let preventedLogicalAdvances = 0;
  let angleLocks = 0;
  let destroyed = false;

  function topology() {
    return materializer.lanes?.localTopology || null;
  }

  function currentRoutePolicy() {
    return materializer.scene?.trafficLocalAssignmentPolicy?.multiAgentRoutePolicy
      || materializer.__nbdTrafficMultiAgentRouteRuntimePolicy
      || null;
  }

  function stateFor(tokenId) {
    const id = String(tokenId || "");
    let state = states.get(id);
    if (!state) {
      state = {
        tokenId: id,
        mode: "free",
        locked: false,
        reason: null,
        blockerId: null,
        blockerKind: null,
        physicalGap: null,
        preRouteAngle: null,
        routeBefore: null,
        routeAfter: null,
        nativeHoldSeconds: 0,
        lockFrames: 0,
        preventedAdvances: 0
      };
      states.set(id, state);
    }
    return state;
  }

  function activeSlots() {
    return (materializer.pool || []).filter(slot => (
      slot?.tokenId
      && slot.container?.active !== false
      && slot.routeActive === true
    ));
  }

  function physicalLeadFor(agent, ownSlot, agentsById, duration, routeSpeed) {
    if (agent?.stage !== "lane" || !agent.currentLaneId || !ownSlot) return null;
    const lane = topology()?.lanes?.[agent.currentLaneId];
    if (!lane?.points?.length) return null;
    const ownProjection = nearestPointOnPolyline(lane.points, ownSlot.x, ownSlot.y);
    if (!ownProjection) return null;

    const ownHalfLength = entityHalfLength(ownSlot);
    const ownHalfWidth = entityHalfWidth(ownSlot);
    const predictedTravel = Math.max(0, finite(routeSpeed, 112))
      * Math.max(0, finite(duration, 0.05));
    const emergencyDistance = predictedTravel * Math.max(1, finite(emergencyTravelMultiplier, 1.6))
      + Math.max(0, finite(emergencyMargin, 7));
    let best = null;

    for (const other of activeSlots()) {
      if (other === ownSlot || other.tokenId === ownSlot.tokenId) continue;
      const contact = orientedVehicleContact(ownSlot, other);
      const otherProjection = nearestPointOnPolyline(lane.points, other.x, other.y);
      if (!otherProjection) continue;
      const lateralLimit = ownHalfWidth
        + entityHalfWidth(other)
        + Math.max(0, finite(lateralClearance, 3));
      if (!contact && otherProjection.distance > lateralLimit) continue;

      const delta = otherProjection.along - ownProjection.along;
      if (!contact && delta <= EPSILON) continue;
      const gap = contact
        ? -Math.max(0, finite(contact.overlap))
        : delta - ownHalfLength - entityHalfLength(other);
      if (!contact && gap > Math.max(0, finite(routeLeadLookAhead, 62))) continue;

      const otherAgent = agentsById.get(String(other.tokenId)) || null;
      const sameLaneAgent = Boolean(
        otherAgent?.stage === "lane"
        && otherAgent.currentLaneId === agent.currentLaneId
      );
      const physicallyCrossing = !sameLaneAgent;
      const stopDistance = physicallyCrossing
        ? Math.max(emergencyDistance, finite(crossingLeadStopDistance, 34))
        : emergencyDistance;
      if (!contact && gap > stopDistance) continue;

      const candidate = {
        blockerId: String(other.tokenId),
        blockerKind: physicallyCrossing ? "physical-cross-route" : "physical-route-lead",
        gap,
        contact: Boolean(contact),
        sourceStage: otherAgent?.stage || other.routeStage || null,
        sourceLaneId: otherAgent?.currentLaneId || other.routeLaneId || null
      };
      if (!best || candidate.gap < best.gap
        || (Math.abs(candidate.gap - best.gap) <= EPSILON
          && candidate.blockerId.localeCompare(best.blockerId) < 0)) {
        best = candidate;
      }
    }
    return best;
  }

  function clearSyntheticHold(slot, state) {
    const physicalState = physicalStateFor(physicalSystem, slot);
    state.nativeHoldSeconds = Math.max(0, finite(physicalState?.holdSeconds));
    slot.physicalHoldSeconds = state.nativeHoldSeconds;
    delete slot.agentMotionAuthoritySyntheticHold;
  }

  function lockSlot(slot, state, reason, duration, blocker = null) {
    const syntheticHold = Math.max(0.01, finite(duration, 0.05) + 0.01);
    slot.physicalHoldSeconds = Math.max(state.nativeHoldSeconds, syntheticHold);
    slot.agentMotionAuthoritySyntheticHold = true;
    slot.agentMotionAuthorityLocked = true;
    state.locked = true;
    state.mode = reason === "physical-offset-recovery" ? "recovering-offset" : "blocked";
    state.reason = reason;
    state.blockerId = blocker?.blockerId || null;
    state.blockerKind = blocker?.blockerKind || null;
    state.physicalGap = Number.isFinite(Number(blocker?.gap)) ? finite(blocker.gap) : null;
    state.lockFrames++;
    routeLockFrames++;
  }

  function prepare(duration = 0.05) {
    if (destroyed) return snapshot();
    routePolicy = currentRoutePolicy();
    const runtime = routePolicy?.runtime?.();
    const agents = runtime?.agents?.() || [];
    const agentsById = new Map(agents.map(agent => [String(agent.tokenId), agent]));
    const routeSpeed = finite(routePolicy?.snapshot?.().speed, 112);
    const live = new Set();

    for (const slot of activeSlots()) {
      const tokenId = String(slot.tokenId);
      live.add(tokenId);
      const state = stateFor(tokenId);
      clearSyntheticHold(slot, state);
      state.preRouteAngle = finite(slot.angle, finite(slot.routeBaseAngle));
      state.routeBefore = routeSignature(agentsById.get(tokenId));
      state.routeAfter = null;
      state.locked = false;
      state.mode = "free";
      state.reason = null;
      state.blockerId = null;
      state.blockerKind = null;
      state.physicalGap = null;

      const physicalLock = trafficAgentPhysicalLock(
        slot,
        physicalStateFor(physicalSystem, slot),
        { offsetTolerance: physicalOffsetTolerance }
      );
      if (physicalLock.locked) {
        lockSlot(slot, state, physicalLock.reason || "physical-contact", duration);
        if (physicalLock.offsetDistance > physicalOffsetTolerance
          && physicalLock.holdSeconds <= EPSILON) {
          residualOffsetLocks++;
        }
        continue;
      }

      const agent = agentsById.get(tokenId);
      const lead = physicalLeadFor(agent, slot, agentsById, duration, routeSpeed);
      if (lead) {
        lockSlot(slot, state, "physical-lead-occupied", duration, lead);
        physicalLeadLocks++;
      }
    }

    for (const tokenId of states.keys()) {
      if (!live.has(tokenId)) states.delete(tokenId);
    }
    return snapshot();
  }

  function finalize() {
    const runtime = routePolicy?.runtime?.();
    const agents = runtime?.agents?.() || [];
    const agentsById = new Map(agents.map(agent => [String(agent.tokenId), agent]));
    for (const slot of activeSlots()) {
      const state = states.get(String(slot.tokenId));
      if (!state) continue;
      state.routeAfter = routeSignature(agentsById.get(String(slot.tokenId)));
      if (state.locked && state.routeBefore && state.routeAfter
        && !sameRouteSignature(state.routeBefore, state.routeAfter)) {
        state.preventedAdvances++;
        preventedLogicalAdvances++;
      }
      if (!state.locked) {
        slot.agentMotionAuthorityLocked = false;
        continue;
      }
      slot.speedFactor = 0;
      slot.desiredSpeedFactor = 0;
      slot.engineSpeed = 0;
      slot.behaviorState = "physical-authority-hold";
      slot.behaviorReason = state.reason;
      slot.behaviorGap = state.physicalGap;
      slot.behaviorBlockerId = state.blockerId;
      slot.behaviorBlockerKind = state.blockerKind;
    }
    updates++;
    publish();
    return snapshot();
  }

  function authorityUpdate(seconds = 0.05) {
    prepare(seconds);
    const result = originalUpdate.call(routePolicy, seconds);
    finalize();
    return result;
  }

  function authorityStep(seconds = 0.05) {
    prepare(seconds);
    const result = originalStep.call(routePolicy, seconds);
    finalize();
    return result;
  }

  function authorityApplyStateOffset(slot, physicalState) {
    const result = originalApplyStateOffset.call(this, slot, physicalState);
    if (!slot?.tokenId) return result;
    const authorityState = states.get(String(slot.tokenId));
    const physicalLock = trafficAgentPhysicalLock(slot, physicalState, {
      offsetTolerance: physicalOffsetTolerance
    });
    const locked = Boolean(authorityState?.locked || physicalLock.locked);
    slot.agentMotionAuthorityLocked = locked;
    if (!locked) return result;

    const angle = finite(authorityState?.preRouteAngle, finite(slot.angle));
    if (Math.abs(finite(slot.angle) - angle) > EPSILON) angleLocks++;
    slot.angle = angle;
    slot.container?.setRotation?.(angle);
    slot.visual?.label?.setRotation?.(-angle);
    return result;
  }

  function snapshot() {
    const vehicles = [...states.values()]
      .map(state => ({
        tokenId: state.tokenId,
        mode: state.mode,
        locked: state.locked,
        reason: state.reason,
        blockerId: state.blockerId,
        blockerKind: state.blockerKind,
        physicalGap: state.physicalGap,
        preRouteAngle: state.preRouteAngle,
        routeBefore: state.routeBefore ? { ...state.routeBefore } : null,
        routeAfter: state.routeAfter ? { ...state.routeAfter } : null,
        lockFrames: state.lockFrames,
        preventedAdvances: state.preventedAdvances
      }))
      .sort((left, right) => left.tokenId.localeCompare(right.tokenId));
    return {
      active: !destroyed,
      architecture: "per-agent-physical-pose-authority",
      routeProgressAuthority: "physical-clearance-gated",
      junctionAuthority: "permission-only",
      updates,
      activeVehicles: vehicles.length,
      lockedVehicles: vehicles.filter(vehicle => vehicle.locked).length,
      residualOffsetLocks,
      physicalLeadLocks,
      routeLockFrames,
      preventedLogicalAdvances,
      angleLocks,
      vehicles
    };
  }

  function publish() {
    const value = snapshot();
    materializer.scene?.statePublisher?.setMany?.({
      trafficAgentAuthorityText: `Traffic agents · ${value.lockedVehicles} physically held`,
      trafficAgentAuthorityState: value
    });
    if (typeof window !== "undefined") window.NBD_TRAFFIC_AGENT_AUTHORITY_READY = value.active;
    return value;
  }

  function installBrowserApi() {
    if (typeof window === "undefined") return;
    window.NBD_TRAFFIC_AGENT_AUTHORITY = Object.freeze({
      snapshot,
      prepare: seconds => prepare(seconds),
      finalize
    });
    window.NBD_TRAFFIC_AGENT_AUTHORITY_READY = true;

    originalBrowserApi = window.NBD_TRAFFIC_ROUTE_MULTI_AGENT || null;
    if (originalBrowserApi?.__policy === routePolicy) {
      browserApi = Object.freeze({
        ...originalBrowserApi,
        step: seconds => routePolicy.step(seconds),
        snapshot: () => ({
          ...originalBrowserApi.snapshot(),
          physicalAgentAuthority: snapshot()
        })
      });
      window.NBD_TRAFFIC_ROUTE_MULTI_AGENT = browserApi;
    }
  }

  function install() {
    routePolicy = currentRoutePolicy();
    if (!routePolicy?.update || !routePolicy?.step) {
      throw new TypeError("Traffic agent physical authority requires the multi-agent route policy.");
    }
    originalUpdate = routePolicy.update;
    originalStep = routePolicy.step;
    routePolicy.update = authorityUpdate;
    routePolicy.step = authorityStep;
    physicalSystem.applyStateOffset = authorityApplyStateOffset;
    installBrowserApi();
    publish();
    return authority;
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (routePolicy?.update === authorityUpdate) routePolicy.update = originalUpdate;
    if (routePolicy?.step === authorityStep) routePolicy.step = originalStep;
    if (physicalSystem.applyStateOffset === authorityApplyStateOffset) {
      physicalSystem.applyStateOffset = originalApplyStateOffset;
    }
    for (const slot of materializer.pool || []) {
      const physicalState = physicalStateFor(physicalSystem, slot);
      if (slot?.agentMotionAuthoritySyntheticHold) {
        slot.physicalHoldSeconds = Math.max(0, finite(physicalState?.holdSeconds));
      }
      delete slot.agentMotionAuthoritySyntheticHold;
      delete slot.agentMotionAuthorityLocked;
    }
    if (typeof window !== "undefined") {
      if (browserApi && window.NBD_TRAFFIC_ROUTE_MULTI_AGENT === browserApi && originalBrowserApi) {
        window.NBD_TRAFFIC_ROUTE_MULTI_AGENT = originalBrowserApi;
      }
      delete window.NBD_TRAFFIC_AGENT_AUTHORITY;
      window.NBD_TRAFFIC_AGENT_AUTHORITY_READY = false;
    }
    states.clear();
    if (materializer.__nbdTrafficAgentPhysicalAuthorityPolicy === authority) {
      delete materializer.__nbdTrafficAgentPhysicalAuthorityPolicy;
    }
  }

  const authority = {
    prepare,
    finalize,
    snapshot,
    destroy
  };
  return install();
}

export function installTrafficAgentPhysicalAuthorityPolicy(physicalSystem, options = {}) {
  const materializer = physicalSystem?.materializer;
  if (!materializer) {
    throw new TypeError("Traffic agent physical authority requires TrafficPhysicalConsequencesSystem.");
  }
  if (materializer.__nbdTrafficAgentPhysicalAuthorityPolicy) {
    return materializer.__nbdTrafficAgentPhysicalAuthorityPolicy;
  }
  const authority = createTrafficAgentPhysicalAuthority(materializer, physicalSystem, options);
  materializer.__nbdTrafficAgentPhysicalAuthorityPolicy = authority;
  return authority;
}
