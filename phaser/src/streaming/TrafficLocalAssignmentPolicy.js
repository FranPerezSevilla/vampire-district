import { LAYERS } from "../data/district.js";
import { installTrafficControlledRouteActivationPolicy } from "./TrafficControlledRouteActivationPolicy.js";
import { installTrafficGridlockRecoveryPolicy } from "./TrafficGridlockRecoveryPolicy.js";
import { cameraWorldBounds } from "./TrafficMaterializationSystem.js";
import { installTrafficLifecyclePolicy } from "./TrafficLifecyclePolicy.js";
import { installTrafficMultiAgentRouteRuntimePolicy } from "./TrafficMultiAgentRouteRuntimePolicy.js";
import { installTrafficRouteMaterializationMetadataPolicy } from "./TrafficRouteMaterializationPolicy.js";

const CAMERA_RETENTION_MARGIN = 360;
const VIEWPORT_GUARD_MARGIN = 120;
const TARGET_ACTIVE_TRAFFIC = 16;

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

  // M8.3 promotes compiler localTopology to normal civilian continuity authority.
  // The legacy authored lane feed remains only as a fail-closed/manual regression
  // fallback; macro district geometry never becomes local movement authority.
  const originalEligible = materializer.eligible;
  const originalRelease = materializer.release;
  const originalHijack = materializer.hijack;
  const originalSnapshot = materializer.snapshot;
  const originalUpdate = materializer.update;
  let releaseBypassDepth = 0;
  let preventedVisibleDespawns = 0;
  let lastPreventedTokenId = null;
  let routeMaterializationMetadataPolicy = null;
  let controlledRoutePolicy = null;
  let multiAgentRoutePolicy = null;
  let gridlockRecoveryPolicy = null;
  let densityTuned = false;

  function visibleRetention(slot) {
    if (scene.currentLayer !== LAYERS.STREET || !slot?.tokenId) return false;
    if (slot.container?.active === false || slot.container?.visible === false) return false;
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
    // Compiler-route tokens retain their materialized slot through connector/lane
    // stage changes and chunk-boundary crossings. Streaming readiness may lag by a
    // frame, but lifecycle ownership must not make a visible car disappear.
    if (slot?.routeActive) return true;
    if (slotIntersectsCamera(localPoint, camera, VIEWPORT_GUARD_MARGIN)) return true;
    return this.pointReady(localPoint, true);
  }

  function localBehaviorRelease(slot, options = {}) {
    const forced = Boolean(options?.force || releaseBypassDepth > 0);
    if (!forced && visibleRetention(slot)) {
      preventedVisibleDespawns++;
      lastPreventedTokenId = slot.tokenId;
      slot.visibilityRetentionReason = "viewport";
      return false;
    }
    if (slot) slot.visibilityRetentionReason = null;
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

  function syncRouteActivePoses() {
    if (!multiAgentRoutePolicy?.snapshot?.().enabled) return 0;
    const tokens = new Map((materializer.trafficTokens?.() || []).map(token => [token.tokenId, token]));
    let synced = 0;
    for (const [tokenId, slot] of materializer.assignments) {
      if (!slot?.routeActive) continue;
      const token = tokens.get(tokenId);
      if (!token?.routeActive) continue;
      materializer.updateSlot(slot, token);
      synced++;
    }
    return synced;
  }

  function ensureGridlockRecoveryPolicy() {
    if (!gridlockRecoveryPolicy && scene.trafficPhysicalConsequencesSystem) {
      gridlockRecoveryPolicy = installTrafficGridlockRecoveryPolicy(scene);
    }
    return gridlockRecoveryPolicy;
  }

  function localBehaviorUpdate(...args) {
    ensureGridlockRecoveryPolicy();
    // The route runtime advances before materialization. Re-sample every assigned
    // route token every frame so visible pose follows route state instead of
    // freezing after speedFactor becomes finite. Physical offsets are layered back
    // on later by TrafficPhysicalConsequencesSystem.
    syncRouteActivePoses();
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
      macroRouteContinuityActive: false,
      legacyEndpointJunctionInferenceActive: false,
      laneAuthority: multiAgent.enabled ? "compiler-route-lanes" : "authored-local-lanes",
      routeMaterializationMetadataActive: Boolean(routeMaterializationMetadataPolicy?.active),
      routeMovementActive: Boolean(controlled.enabled) || Boolean(multiAgent.enabled),
      targetActiveTraffic: TARGET_ACTIVE_TRAFFIC,
      densityTuned,
      gridlockRecovery: gridlockRecoveryPolicy?.snapshot?.() || { active: false, totalTrafficPushes: 0 },
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

  routeMaterializationMetadataPolicy = installTrafficRouteMaterializationMetadataPolicy(materializer);
  const lifecyclePolicy = installTrafficLifecyclePolicy(materializer);
  // Controlled single-route activation remains available for M6/M7 regression proof.
  controlledRoutePolicy = installTrafficControlledRouteActivationPolicy(materializer);
  // M8.3 installs the production-shaped route runtime as the default civilian
  // continuity authority. The policy itself refuses activation unless the full
  // production population and accounting projection are conservative and complete.
  multiAgentRoutePolicy = installTrafficMultiAgentRouteRuntimePolicy(materializer);

  // The previous pool cap of ten made the city read sparsely even when macro
  // population existed nearby. Keep population identity fixed but allow more of it
  // to materialize around the player; no dynamic pool growth occurs during route
  // crossings after this one-time configured baseline increase.
  Promise.resolve(materializer.initialization).then(() => {
    if (materializer.destroyed || typeof materializer.ensurePool !== "function") return;
    const target = Math.max(
      TARGET_ACTIVE_TRAFFIC,
      Math.floor(finite(materializer.lanes?.defaults?.maxActiveVehicles, TARGET_ACTIVE_TRAFFIC))
    );
    if (materializer.maxActiveVehicles < target) {
      materializer.maxActiveVehicles = target;
      materializer.ensurePool(target);
      densityTuned = true;
      materializer.reconcile?.(true);
    }
  }).catch(() => {});

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
    get gridlockRecoveryPolicy() {
      return gridlockRecoveryPolicy;
    },
    laneJunctionTopologyPolicy: null,
    destroy() {
      gridlockRecoveryPolicy?.destroy?.();
      gridlockRecoveryPolicy = null;
      multiAgentRoutePolicy?.destroy?.();
      controlledRoutePolicy?.destroy?.();
      lifecyclePolicy?.destroy?.();
      routeMaterializationMetadataPolicy?.destroy?.();
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
