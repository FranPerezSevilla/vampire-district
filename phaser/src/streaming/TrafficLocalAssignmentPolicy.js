import { LAYERS } from "../data/district.js";
import { cameraWorldBounds } from "./TrafficMaterializationSystem.js";
import { installTrafficLifecyclePolicy } from "./TrafficLifecyclePolicy.js";

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

  // M1 retired the provisional legacy-endpoint junction inference. The only future
  // route authority is compiler-owned `localTopology` from the generated lane pack.
  // It remains diagnostic/read-only here; authored legacy lanes still move cars.
  const originalEligible = materializer.eligible;
  const originalRelease = materializer.release;
  const originalHijack = materializer.hijack;
  const originalSnapshot = materializer.snapshot;
  let releaseBypassDepth = 0;
  let preventedVisibleDespawns = 0;
  let lastPreventedTokenId = null;

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
    return {
      ...snapshot,
      cameraRetentionMargin: CAMERA_RETENTION_MARGIN,
      viewportRetentionMargin: VIEWPORT_GUARD_MARGIN,
      retainedVisibleCount: (this.pool || []).filter(visibleRetention).length,
      preventedVisibleDespawns,
      lastPreventedTokenId,
      macroRouteContinuityActive: false,
      legacyEndpointJunctionInferenceActive: false,
      laneAuthority: "authored-local-lanes",
      compilerLocalTopology: compilerLocalTopologySnapshot(this.lanes)
    };
  }

  materializer.eligible = localBehaviorEligible;
  materializer.release = localBehaviorRelease;
  materializer.hijack = localBehaviorHijack;
  materializer.snapshot = localBehaviorSnapshot;

  // Lifecycle retention remains independent from routing. No junction topology policy
  // mutates the loaded legacy edge collection during M1/M2.
  const lifecyclePolicy = installTrafficLifecyclePolicy(materializer);

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
    lifecyclePolicy,
    laneJunctionTopologyPolicy: null,
    destroy() {
      lifecyclePolicy?.destroy?.();
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
