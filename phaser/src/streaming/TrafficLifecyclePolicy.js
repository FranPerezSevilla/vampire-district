import { LAYERS } from "../data/district.js";
import { cameraWorldBounds, pointAlongPolyline } from "./TrafficMaterializationSystem.js";

function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function pointInsideExpandedCamera(point, bounds, margin = 0) {
  if (!point || !bounds) return false;
  const padding = Math.max(0, finite(margin));
  return point.x >= bounds.x - padding
    && point.x <= bounds.right + padding
    && point.y >= bounds.y - padding
    && point.y <= bounds.bottom + padding;
}

export const TRAFFIC_LIFECYCLE_STATES = Object.freeze({
  SPAWNING: "spawning",
  CRUISING: "cruising",
  APPROACH_JUNCTION: "approach-junction",
  CROSSING_JUNCTION: "crossing-junction",
  FOLLOWING: "following",
  AVOIDING: "avoiding",
  BLOCKED: "blocked",
  RECENTLY_VISIBLE: "recently-visible",
  LEAVING_VIEW: "leaving-view"
});

export function trafficLifecycleState({
  phase = 0,
  edgeChanged = false,
  routeActive = false,
  routeStage = null,
  routeStageProgress = 0,
  behaviorReason = "",
  visible = false,
  recentVisibleSeconds = 0
} = {}) {
  const reason = String(behaviorReason || "");
  if (reason.includes("steering-around") || reason.includes("obstacle")) return TRAFFIC_LIFECYCLE_STATES.AVOIDING;
  if (reason.includes("physical") || reason.includes("blocked")) return TRAFFIC_LIFECYCLE_STATES.BLOCKED;
  if (reason === "traffic" || reason.includes("junction-yield")) return TRAFFIC_LIFECYCLE_STATES.FOLLOWING;

  // Once a stable route token is explicitly materialized, route stage becomes the
  // lifecycle authority. Legacy edge phase remains a fallback only for current traffic.
  if (routeActive) {
    if (routeStage === "connector") return TRAFFIC_LIFECYCLE_STATES.CROSSING_JUNCTION;
    if (routeStage === "lane" && finite(routeStageProgress) >= 0.82) {
      return TRAFFIC_LIFECYCLE_STATES.APPROACH_JUNCTION;
    }
    if (visible) return TRAFFIC_LIFECYCLE_STATES.CRUISING;
    if (recentVisibleSeconds > 0) return TRAFFIC_LIFECYCLE_STATES.RECENTLY_VISIBLE;
    return TRAFFIC_LIFECYCLE_STATES.LEAVING_VIEW;
  }

  if (edgeChanged || phase <= 0.10) return TRAFFIC_LIFECYCLE_STATES.CROSSING_JUNCTION;
  if (phase >= 0.82) return TRAFFIC_LIFECYCLE_STATES.APPROACH_JUNCTION;
  if (visible) return TRAFFIC_LIFECYCLE_STATES.CRUISING;
  if (recentVisibleSeconds > 0) return TRAFFIC_LIFECYCLE_STATES.RECENTLY_VISIBLE;
  return TRAFFIC_LIFECYCLE_STATES.LEAVING_VIEW;
}

export function lifecycleProtectsFromDespawn(state) {
  return [
    TRAFFIC_LIFECYCLE_STATES.SPAWNING,
    TRAFFIC_LIFECYCLE_STATES.APPROACH_JUNCTION,
    TRAFFIC_LIFECYCLE_STATES.CROSSING_JUNCTION,
    TRAFFIC_LIFECYCLE_STATES.FOLLOWING,
    TRAFFIC_LIFECYCLE_STATES.AVOIDING,
    TRAFFIC_LIFECYCLE_STATES.BLOCKED,
    TRAFFIC_LIFECYCLE_STATES.RECENTLY_VISIBLE
  ].includes(state);
}

export function installTrafficLifecyclePolicy(materializer, {
  recentVisibilitySeconds = 2.6,
  viewportMemoryMargin = 32,
  junctionExitPhase = 0.14
} = {}) {
  if (!materializer?.trafficTokens || !materializer?.assign || !materializer?.release || !materializer?.update) {
    throw new TypeError("Traffic lifecycle policy requires TrafficMaterializationSystem.");
  }
  if (materializer.__nbdTrafficLifecyclePolicy) return materializer.__nbdTrafficLifecyclePolicy;

  const originalTrafficTokens = materializer.trafficTokens;
  const originalAssign = materializer.assign;
  const originalRelease = materializer.release;
  const originalUpdate = materializer.update;
  const originalSnapshot = materializer.snapshot;
  const states = new Map();
  let preventedLifecycleDespawns = 0;
  let edgeHandoffs = 0;
  let protectedRouteCrossingReleases = 0;

  function routedTokens() {
    const routed = materializer.macro?.routedTrafficTokens?.();
    if (!Array.isArray(routed)) return originalTrafficTokens.call(materializer);
    const lanes = materializer.lanes;
    if (!lanes) return [];
    return routed.map(agent => {
      const points = lanes.edges?.[agent.edgeId]?.[agent.direction];
      const point = pointAlongPolyline(points || [], agent.phase);
      return {
        tokenId: agent.tokenId,
        tokenIndex: agent.tokenIndex,
        edgeId: agent.edgeId,
        direction: agent.direction,
        phase: agent.phase,
        x: point.x,
        y: point.y,
        angle: point.angle,
        hop: agent.hop
      };
    });
  }

  function stateFor(slot) {
    if (!slot?.tokenId) return null;
    let state = states.get(slot.tokenId);
    if (!state) {
      state = {
        tokenId: slot.tokenId,
        lifecycle: TRAFFIC_LIFECYCLE_STATES.SPAWNING,
        recentVisibleSeconds: recentVisibilitySeconds,
        previousEdgeId: slot.edgeId,
        edgeChanged: false,
        junctionHold: 0,
        lastVisible: false,
        routeActive: Boolean(slot.routeActive),
        routeStage: slot.routeStage || null,
        routeLaneId: slot.routeLaneId || null,
        routeConnectorId: slot.routeConnectorId || null,
        routeStageProgress: finite(slot.routeStageProgress)
      };
      states.set(slot.tokenId, state);
    }
    return state;
  }

  function lifecycleAssign(slot, token) {
    const assigned = originalAssign.call(this, slot, token);
    const state = stateFor(assigned);
    if (state) {
      state.lifecycle = TRAFFIC_LIFECYCLE_STATES.SPAWNING;
      state.recentVisibleSeconds = recentVisibilitySeconds;
      state.previousEdgeId = token.edgeId;
      state.edgeChanged = false;
      state.junctionHold = 0;
      state.routeActive = Boolean(assigned.routeActive);
      state.routeStage = assigned.routeStage || null;
      state.routeLaneId = assigned.routeLaneId || null;
      state.routeConnectorId = assigned.routeConnectorId || null;
      state.routeStageProgress = finite(assigned.routeStageProgress);
    }
    return assigned;
  }

  function protectedSlot(slot) {
    const state = slot?.tokenId ? states.get(slot.tokenId) : null;
    if (!state) return false;
    return lifecycleProtectsFromDespawn(state.lifecycle);
  }

  function macroTokenExists(tokenId) {
    if (!tokenId) return false;
    const tokens = materializer.trafficTokens?.();
    return Array.isArray(tokens) && tokens.some(token => token?.tokenId === tokenId);
  }

  function lifecycleRelease(slot, options = {}) {
    const forced = Boolean(
      options?.force
      || options?.hijack
      || materializer.__nbdForceTrafficLifecycleRelease
      || materializer.scene?.currentLayer !== LAYERS.STREET
    );
    if (!forced && protectedSlot(slot) && macroTokenExists(slot?.tokenId)) {
      preventedLifecycleDespawns++;
      const state = states.get(slot.tokenId);
      if (state?.routeActive && state.routeStage === "connector") protectedRouteCrossingReleases++;
      slot.lifecycleRetentionReason = state?.lifecycle || "protected";
      return false;
    }
    if (slot) slot.lifecycleRetentionReason = null;
    if (slot?.tokenId) states.delete(slot.tokenId);
    return originalRelease.call(this, slot, options);
  }

  function updateLifecycle(dt = 0) {
    const seconds = Math.max(0, finite(dt));
    const bounds = cameraWorldBounds(materializer.scene);
    const live = new Set();
    for (const slot of materializer.pool || []) {
      if (!slot.tokenId) continue;
      live.add(slot.tokenId);
      const state = stateFor(slot);
      const visible = materializer.scene.currentLayer === LAYERS.STREET
        && pointInsideExpandedCamera(slot, bounds, viewportMemoryMargin);
      if (visible) state.recentVisibleSeconds = recentVisibilitySeconds;
      else state.recentVisibleSeconds = Math.max(0, state.recentVisibleSeconds - seconds);

      state.routeActive = Boolean(slot.routeActive);
      state.routeStage = slot.routeStage || null;
      state.routeLaneId = slot.routeLaneId || null;
      state.routeConnectorId = slot.routeConnectorId || null;
      state.routeStageProgress = finite(slot.routeStageProgress);

      if (state.routeActive) {
        // Stable route stage owns junction semantics; compatibility edge changes must
        // not manufacture a second crossing state or reset the route token.
        state.edgeChanged = false;
        state.junctionHold = 0;
      } else {
        const edgeChanged = Boolean(state.previousEdgeId && slot.edgeId && state.previousEdgeId !== slot.edgeId);
        if (edgeChanged) {
          state.edgeChanged = true;
          state.junctionHold = Math.max(state.junctionHold, 0.55);
          edgeHandoffs++;
        }
        state.junctionHold = Math.max(0, state.junctionHold - seconds);
        if (state.edgeChanged && slot.phase >= junctionExitPhase && state.junctionHold <= 0) state.edgeChanged = false;
      }

      state.lifecycle = trafficLifecycleState({
        phase: finite(slot.phase),
        edgeChanged: state.edgeChanged,
        routeActive: state.routeActive,
        routeStage: state.routeStage,
        routeStageProgress: state.routeStageProgress,
        behaviorReason: slot.behaviorReason,
        visible,
        recentVisibleSeconds: state.recentVisibleSeconds
      });
      state.previousEdgeId = slot.edgeId;
      state.lastVisible = visible;
      slot.lifecycleState = state.lifecycle;
    }
    for (const tokenId of states.keys()) {
      if (!live.has(tokenId)) states.delete(tokenId);
    }
  }

  function lifecycleUpdate(dt = 0) {
    const changed = originalUpdate.call(this, dt);
    updateLifecycle(dt);
    return changed;
  }

  function lifecycleSnapshot() {
    const snapshot = originalSnapshot.call(this);
    const lifecycle = [...states.values()].map(state => ({
      tokenId: state.tokenId,
      state: state.lifecycle,
      recentVisibleSeconds: Math.round(state.recentVisibleSeconds * 100) / 100,
      edgeChanged: state.edgeChanged,
      routeActive: state.routeActive,
      routeStage: state.routeStage,
      routeLaneId: state.routeLaneId,
      routeConnectorId: state.routeConnectorId,
      routeStageProgress: Math.round(state.routeStageProgress * 1000) / 1000
    }));
    return {
      ...snapshot,
      lifecycleCounts: Object.fromEntries(Object.values(TRAFFIC_LIFECYCLE_STATES).map(name => [
        name,
        lifecycle.filter(item => item.state === name).length
      ])),
      lifecycle,
      preventedLifecycleDespawns,
      protectedRouteCrossingReleases,
      edgeHandoffs
    };
  }

  materializer.trafficTokens = routedTokens;
  materializer.assign = lifecycleAssign;
  materializer.release = lifecycleRelease;
  materializer.update = lifecycleUpdate;
  materializer.snapshot = lifecycleSnapshot;

  const policy = {
    snapshot() {
      return lifecycleSnapshot.call(materializer);
    },
    destroy() {
      if (materializer.trafficTokens === routedTokens) materializer.trafficTokens = originalTrafficTokens;
      if (materializer.assign === lifecycleAssign) materializer.assign = originalAssign;
      if (materializer.release === lifecycleRelease) materializer.release = originalRelease;
      if (materializer.update === lifecycleUpdate) materializer.update = originalUpdate;
      if (materializer.snapshot === lifecycleSnapshot) materializer.snapshot = originalSnapshot;
      states.clear();
      if (materializer.__nbdTrafficLifecyclePolicy === policy) delete materializer.__nbdTrafficLifecyclePolicy;
    }
  };
  materializer.__nbdTrafficLifecyclePolicy = policy;
  return policy;
}
