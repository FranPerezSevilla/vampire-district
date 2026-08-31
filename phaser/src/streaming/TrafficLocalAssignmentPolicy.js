import { LAYERS } from "../data/district.js";
import { installTrafficControlledRouteActivationPolicy } from "./TrafficControlledRouteActivationPolicy.js";
import { cameraWorldBounds } from "./TrafficMaterializationSystem.js";
import { installTrafficLifecyclePolicy } from "./TrafficLifecyclePolicy.js";
import { installTrafficMultiAgentRouteRuntimePolicy } from "./TrafficMultiAgentRouteRuntimePolicy.js";
import { installTrafficRouteMaterializationMetadataPolicy } from "./TrafficRouteMaterializationPolicy.js";

const CAMERA_RETENTION_MARGIN = 420;
const VIEWPORT_GUARD_MARGIN = 140;
const TARGET_ACTIVE_TRAFFIC = 32;
const PRODUCTION_ROUTE_SPEED = 112;
const ROUTE_POSE_SPEED_MULTIPLIER = 1.7;
const ROUTE_POSE_SLACK = 2.5;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function distanceSquared(a, b) {
  const dx = finite(a?.x) - finite(b?.x);
  const dy = finite(a?.y) - finite(b?.y);
  return dx * dx + dy * dy;
}

function slotIntersectsCamera(slot, bounds, margin = 0) {
  if (!slot || !bounds) return false;
  const padding = Math.max(0, finite(margin));
  const radius = Math.max(1, finite(slot.radius, 18));
  const x = finite(slot.x);
  const y = finite(slot.y);
  return x + radius >= bounds.x - padding
    && x - radius <= bounds.right + padding
    && y + radius >= bounds.y - padding
    && y - radius <= bounds.bottom + padding;
}

export function compilerLocalTopologySnapshot(lanes) {
  const topology = lanes?.localTopology;
  const connectors = topology?.junctionConnectors;
  const ready = Boolean(
    topology?.ownershipMode === "compiler-node-id"
    && topology?.lanes
    && topology?.transitions
    && connectors?.connectors
  );
  return {
    ready,
    movementActive: false,
    ownershipMode: topology?.ownershipMode || null,
    source: topology?.source || null,
    directedLaneCount: finite(topology?.stats?.directedLaneCount),
    transitionCount: finite(topology?.stats?.transitionCount),
    junctionConnectorCount: finite(connectors?.stats?.connectorCount),
    rejectedJunctionConnectorCount: finite(connectors?.stats?.rejectedConnectorCount),
    outsideRoadJunctionConnectorCount: finite(connectors?.stats?.outsideRoadConnectorCount),
    junctionConnectorTangentFailureCount: finite(connectors?.stats?.tangentFailureCount)
  };
}

export function installTrafficLocalAssignmentPolicy(scene) {
  const materializer = scene?.trafficMaterializationSystem;
  if (!materializer?.eligible || !materializer?.release || !materializer?.assignments) {
    throw new TypeError("Traffic local assignment policy requires TrafficMaterializationSystem.");
  }
  if (materializer.__nbdLocalAssignmentPolicy) return materializer.__nbdLocalAssignmentPolicy;

  // Compiler localTopology is the normal civilian continuity authority. Legacy
  // authored-lane movement remains fail-closed/manual regression evidence only.
  const originalEligible = materializer.eligible;
  const originalRelease = materializer.release;
  const originalHijack = materializer.hijack;
  const originalSnapshot = materializer.snapshot;
  const originalUpdate = materializer.update;
  const routePresentationPoses = new Map();
  let releaseBypassDepth = 0;
  let preventedVisibleDespawns = 0;
  let lastPreventedTokenId = null;
  let routePoseContinuityAnomalies = 0;
  let routePoseContinuityCorrections = 0;
  let lastRoutePoseAnomaly = null;
  let routeMaterializationMetadataPolicy = null;
  let controlledRoutePolicy = null;
  let multiAgentRoutePolicy = null;
  let densityTuned = false;

  function visibleRetention(slot) {
    if (scene.currentLayer !== LAYERS.STREET || !slot?.tokenId) return false;
    // Route-active slots are protected by their camera geometry, not by the
    // previous frame's presentation flags. Otherwise a one-frame visibility
    // transition can disable its own retention and cause a release/reassign pop.
    const rendered = slot.container?.active !== false && slot.container?.visible !== false;
    if (!slot.routeActive && !rendered) return false;
    return slotIntersectsCamera(slot, cameraWorldBounds(scene), VIEWPORT_GUARD_MARGIN);
  }

  function localBehaviorEligible(token, assigned = false) {
    if (!assigned) return originalEligible.call(this, token, false);
    if (this.scene.currentLayer !== LAYERS.STREET) return false;
    const slot = this.assignments.get(token?.tokenId);
    const localPoint = slot?.tokenId ? slot : token;
    const focus = this.focus();
    const limit = Math.max(0, finite(this.despawnRadius));
    const camera = cameraWorldBounds(this.scene);
    const retainedByCamera = slotIntersectsCamera(localPoint, camera, CAMERA_RETENTION_MARGIN);
    const retainedByFollow = distanceSquared(localPoint, focus) <= limit * limit;
    if (!retainedByCamera && !retainedByFollow) return false;
    if (slot?.routeActive) return true;
    if (slotIntersectsCamera(localPoint, camera, VIEWPORT_GUARD_MARGIN)) return true;
    return this.pointReady(localPoint, true);
  }

  function forgetPresentationPose(slot) {
    if (!slot?.tokenId) return;
    routePresentationPoses.delete(slot.tokenId);
    delete slot.routePresentationInitialized;
  }

  function localBehaviorRelease(slot, options = {}) {
    const forced = Boolean(options?.force || releaseBypassDepth > 0);
    if (!forced && visibleRetention(slot)) {
      preventedVisibleDespawns++;
      lastPreventedTokenId = slot.tokenId;
      slot.visibilityRetentionReason = "viewport";
      if (slot.routeActive && scene.currentLayer === LAYERS.STREET) {
        slot.container?.setActive?.(true)?.setVisible?.(true);
      }
      return false;
    }
    if (slot) slot.visibilityRetentionReason = null;
    forgetPresentationPose(slot);
    return originalRelease.call(this, slot, options);
  }

  function localBehaviorHijack(tokenId) {
    releaseBypassDepth++;
    materializer.__nbdForceTrafficLifecycleRelease = true;
    try {
      return originalHijack.call(this, tokenId);
    } finally {
      releaseBypassDepth = Math.max(0, releaseBypassDepth - 1);
      delete materializer.__nbdForceTrafficLifecycleRelease;
    }
  }

  function continuitySafeToken(slot, token, seconds) {
    const dt = Math.min(0.05, Math.max(0.001, finite(seconds, 0.05)));
    const previous = routePresentationPoses.get(token.tokenId);
    if (!slot.routePresentationInitialized || !previous) {
      const initial = { x: finite(token.x), y: finite(token.y), angle: finite(token.angle) };
      routePresentationPoses.set(token.tokenId, initial);
      slot.routePresentationInitialized = true;
      return token;
    }

    const targetX = finite(token.x);
    const targetY = finite(token.y);
    const dx = targetX - previous.x;
    const dy = targetY - previous.y;
    const distance = Math.hypot(dx, dy);
    const maximumStep = PRODUCTION_ROUTE_SPEED * dt * ROUTE_POSE_SPEED_MULTIPLIER + ROUTE_POSE_SLACK;
    if (distance <= maximumStep || distance <= 0.0001) {
      routePresentationPoses.set(token.tokenId, { x: targetX, y: targetY, angle: finite(token.angle) });
      return token;
    }

    // A visible car must never appear to move faster than the route runtime can
    // physically justify. Keep compiler route state authoritative, but bound the
    // presentation catch-up and expose the anomaly so the underlying discontinuity
    // remains diagnosable instead of showing up as a "Flash" car on screen.
    const ratio = maximumStep / distance;
    const safeX = previous.x + dx * ratio;
    const safeY = previous.y + dy * ratio;
    const safeAngle = Math.atan2(dy, dx);
    routePoseContinuityAnomalies++;
    routePoseContinuityCorrections++;
    lastRoutePoseAnomaly = {
      tokenId: token.tokenId,
      requestedDistance: Math.round(distance * 100) / 100,
      allowedDistance: Math.round(maximumStep * 100) / 100,
      stage: token.routeStage || token.stage || null,
      edgeId: token.edgeId || null
    };
    routePresentationPoses.set(token.tokenId, { x: safeX, y: safeY, angle: safeAngle });
    return { ...token, x: safeX, y: safeY, angle: safeAngle };
  }

  function syncRouteActivePoses(seconds = 0.05) {
    if (!multiAgentRoutePolicy?.snapshot?.().enabled) return 0;
    const tokens = new Map((materializer.trafficTokens?.() || []).map(token => [token.tokenId, token]));
    let synced = 0;
    for (const [tokenId, slot] of materializer.assignments) {
      if (!slot?.routeActive) continue;
      const token = tokens.get(tokenId);
      if (!token?.routeActive) continue;
      materializer.updateSlot(slot, continuitySafeToken(slot, token, seconds));
      synced++;
    }
    return synced;
  }

  function localBehaviorUpdate(...args) {
    // Route state advances before materialization. Re-sample every assigned route
    // token every frame so visible pose follows route state. Physical consequence
    // offsets are layered back on later by TrafficPhysicalConsequencesSystem.
    syncRouteActivePoses(args[0]);
    return originalUpdate.apply(this, args);
  }

  function localBehaviorSnapshot() {
    const snapshot = originalSnapshot.call(this);
    const controlled = controlledRoutePolicy?.snapshot?.() || {
      ready: false,
      enabled: false,
      defaultEnabled: false,
      defaultTrafficAuthority: "authored-local-lanes"
    };
    const multiAgent = multiAgentRoutePolicy?.snapshot?.() || {
      ready: false,
      enabled: false,
      defaultEnabled: true,
      defaultTrafficAuthority: "multi-agent-compiler-route",
      macroMutationAuthority: false,
      macroCoordinateAuthority: false
    };
    const compilerTopology = compilerLocalTopologySnapshot(this.lanes);
    return {
      ...snapshot,
      cameraRetentionMargin: CAMERA_RETENTION_MARGIN,
      viewportRetentionMargin: VIEWPORT_GUARD_MARGIN,
      retainedVisibleCount: (this.pool || []).filter(visibleRetention).length,
      preventedVisibleDespawns,
      lastPreventedTokenId,
      routePoseContinuityAnomalies,
      routePoseContinuityCorrections,
      lastRoutePoseAnomaly,
      routePoseMaximumPresentationSpeed: PRODUCTION_ROUTE_SPEED * ROUTE_POSE_SPEED_MULTIPLIER,
      macroRouteContinuityActive: false,
      legacyEndpointJunctionInferenceActive: false,
      laneAuthority: multiAgent.enabled ? "compiler-route-lanes" : "authored-local-lanes",
      routeMaterializationMetadataActive: Boolean(routeMaterializationMetadataPolicy?.active),
      routeMovementActive: Boolean(controlled.enabled) || Boolean(multiAgent.enabled),
      targetActiveTraffic: TARGET_ACTIVE_TRAFFIC,
      productionRouteSpeed: PRODUCTION_ROUTE_SPEED,
      densityTuned,
      gridlockRecovery: {
        active: false,
        authority: "absorbed-by-route-behavior-fsm"
      },
      controlledRouteActivation: controlled,
      multiAgentRouteRuntime: multiAgent,
      compilerLocalTopology: {
        ...compilerTopology,
        movementActive: Boolean(multiAgent.enabled)
      }
    };
  }

  materializer.eligible = localBehaviorEligible;
  materializer.release = localBehaviorRelease;
  materializer.hijack = localBehaviorHijack;
  materializer.update = localBehaviorUpdate;
  materializer.snapshot = localBehaviorSnapshot;

  const configuredTrafficLimit = Math.max(
    TARGET_ACTIVE_TRAFFIC,
    Math.floor(finite(materializer.maxActiveVehicles, TARGET_ACTIVE_TRAFFIC))
  );
  if (materializer.maxActiveVehicles !== configuredTrafficLimit) {
    materializer.maxActiveVehicles = configuredTrafficLimit;
    densityTuned = true;
  }
  if (materializer.ready
    && typeof materializer.ensurePool === "function"
    && materializer.pool.length < configuredTrafficLimit) {
    materializer.ensurePool(configuredTrafficLimit);
    materializer.reconcile?.(true);
  }

  routeMaterializationMetadataPolicy = installTrafficRouteMaterializationMetadataPolicy(materializer);
  const lifecyclePolicy = installTrafficLifecyclePolicy(materializer);
  controlledRoutePolicy = installTrafficControlledRouteActivationPolicy(materializer);
  multiAgentRoutePolicy = installTrafficMultiAgentRouteRuntimePolicy(materializer, {
    speed: PRODUCTION_ROUTE_SPEED
  });

  const policy = {
    originalEligible,
    originalRelease,
    originalHijack,
    originalSnapshot,
    originalUpdate,
    localBehaviorEligible,
    localBehaviorRelease,
    localBehaviorHijack,
    localBehaviorUpdate,
    localBehaviorSnapshot,
    routeContinuityPolicy: null,
    routeMaterializationMetadataPolicy,
    lifecyclePolicy,
    controlledRoutePolicy,
    multiAgentRoutePolicy,
    gridlockRecoveryPolicy: null,
    laneJunctionTopologyPolicy: null,
    destroy() {
      multiAgentRoutePolicy?.destroy?.();
      controlledRoutePolicy?.destroy?.();
      lifecyclePolicy?.destroy?.();
      routeMaterializationMetadataPolicy?.destroy?.();
      routePresentationPoses.clear();
      if (materializer.eligible === localBehaviorEligible) materializer.eligible = originalEligible;
      if (materializer.release === localBehaviorRelease) materializer.release = originalRelease;
      if (materializer.hijack === localBehaviorHijack) materializer.hijack = originalHijack;
      if (materializer.update === localBehaviorUpdate) materializer.update = originalUpdate;
      if (materializer.snapshot === localBehaviorSnapshot) materializer.snapshot = originalSnapshot;
      delete materializer.__nbdForceTrafficLifecycleRelease;
      if (materializer.__nbdLocalAssignmentPolicy === policy) delete materializer.__nbdLocalAssignmentPolicy;
    }
  };
  materializer.__nbdLocalAssignmentPolicy = policy;
  return policy;
}
