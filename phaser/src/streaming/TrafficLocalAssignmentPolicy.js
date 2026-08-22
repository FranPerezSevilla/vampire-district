import { LAYERS } from "../data/district.js";
import { installTrafficControlledRouteActivationPolicy } from "./TrafficControlledRouteActivationPolicy.js";
import { cameraWorldBounds } from "./TrafficMaterializationSystem.js";
import { installTrafficLifecyclePolicy } from "./TrafficLifecyclePolicy.js";
import { installTrafficMultiAgentRouteRuntimePolicy } from "./TrafficMultiAgentRouteRuntimePolicy.js";
import { installTrafficRouteMaterializationMetadataPolicy } from "./TrafficRouteMaterializationPolicy.js";
import { installTrafficShadowRoutePolicy } from "./TrafficShadowRoutePolicy.js";

const CAMERA_RETENTION_MARGIN = 360;
const VIEWPORT_GUARD_MARGIN = 120;

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
  let releaseBypassDepth = 0;
  let preventedVisibleDespawns = 0;
  let lastPreventedTokenId = null;
  let shadowRoutePolicy = null;
  let routeMaterializationMetadataPolicy = null;
  let controlledRoutePolicy = null;
  let multiAgentRoutePolicy = null;

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
      controlledRouteActivation: controlled,
      multiAgentRouteRuntime: multiAgent,
      compilerLocalTopology: {
        ...compilerTopology,
        movementActive: Boolean(multiAgent.enabled)
      },
      shadowRouteContinuity: shadowRoutePolicy?.snapshot?.() || {
        ready: false,
        mode: "shadow",
        movementAuthority: false,
        macroMutationAuthority: false
      }
    };
  }

  materializer.eligible = localBehaviorEligible;
  materializer.release = localBehaviorRelease;
  materializer.hijack = localBehaviorHijack;
  materializer.snapshot = localBehaviorSnapshot;

  routeMaterializationMetadataPolicy = installTrafficRouteMaterializationMetadataPolicy(materializer);
  const lifecyclePolicy = installTrafficLifecyclePolicy(materializer);
  shadowRoutePolicy = installTrafficShadowRoutePolicy(materializer);
  // Controlled single-route activation remains available for M6/M7 regression proof.
  controlledRoutePolicy = installTrafficControlledRouteActivationPolicy(materializer);
  // M8.3 installs the production-shaped route runtime as the default civilian
  // continuity authority. The policy itself refuses activation unless the full
  // production population and accounting projection are conservative and complete.
  multiAgentRoutePolicy = installTrafficMultiAgentRouteRuntimePolicy(materializer);

  const policy = {
    originalEligible,
    originalRelease,
    originalHijack,
    originalSnapshot,
    localBehaviorEligible,
    localBehaviorRelease,
    localBehaviorHijack,
    localBehaviorSnapshot,
    routeContinuityPolicy: null,
    routeMaterializationMetadataPolicy,
    lifecyclePolicy,
    shadowRoutePolicy,
    controlledRoutePolicy,
    multiAgentRoutePolicy,
    laneJunctionTopologyPolicy: null,
    destroy() {
      multiAgentRoutePolicy?.destroy?.();
      controlledRoutePolicy?.destroy?.();
      shadowRoutePolicy?.destroy?.();
      lifecyclePolicy?.destroy?.();
      routeMaterializationMetadataPolicy?.destroy?.();
      if (materializer.eligible === localBehaviorEligible) materializer.eligible = originalEligible;
      if (materializer.release === localBehaviorRelease) materializer.release = originalRelease;
      if (materializer.hijack === localBehaviorHijack) materializer.hijack = originalHijack;
      if (materializer.snapshot === localBehaviorSnapshot) materializer.snapshot = originalSnapshot;
      delete materializer.__nbdForceTrafficLifecycleRelease;
      if (materializer.__nbdLocalAssignmentPolicy === policy) delete materializer.__nbdLocalAssignmentPolicy;
    }
  };
  materializer.__nbdLocalAssignmentPolicy = policy;
  return policy;
}
