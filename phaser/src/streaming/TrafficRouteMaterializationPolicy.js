import { pointAlongPolyline } from "./TrafficMaterializationSystem.js";
import { trafficRouteStageGeometry } from "./TrafficRouteCursor.js";

function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function clearTrafficRouteSlotMetadata(slot) {
  if (!slot) return slot;
  slot.routeActive = false;
  slot.routeStage = null;
  slot.routeLaneId = null;
  slot.routeConnectorId = null;
  slot.routeNextLaneId = null;
  slot.routePreviousLaneId = null;
  slot.routeHop = 0;
  slot.routeStageProgress = 0;
  slot.routeGeometryId = null;
  slot.routeSourceRoadEdgeId = null;
  return slot;
}

export function applyTrafficRouteSlotMetadata(slot, token) {
  if (!slot) return slot;
  if (token?.routeActive !== true) return clearTrafficRouteSlotMetadata(slot);
  slot.routeActive = true;
  slot.routeStage = token.routeStage || null;
  slot.routeLaneId = token.routeLaneId || null;
  slot.routeConnectorId = token.routeConnectorId || null;
  slot.routeNextLaneId = token.routeNextLaneId || null;
  slot.routePreviousLaneId = token.routePreviousLaneId || null;
  slot.routeHop = Math.max(0, Math.floor(finite(token.routeHop)));
  slot.routeStageProgress = Math.max(0, Math.min(1, finite(token.routeStageProgress)));
  slot.routeGeometryId = token.routeGeometryId || null;
  slot.routeSourceRoadEdgeId = token.routeSourceRoadEdgeId || null;
  return slot;
}

export function trafficRouteAgentMaterializationToken(topology, agent, {
  tokenIndex = -1
} = {}) {
  if (!agent?.tokenId) throw new TypeError("Route materialization token requires a stable route agent.");
  const geometry = trafficRouteStageGeometry(topology, agent);
  if (!geometry?.points?.length) {
    throw new TypeError(`Route agent ${agent.tokenId} has no materializable compiler geometry.`);
  }
  const pose = pointAlongPolyline(geometry.points, agent.stageProgress);
  const lane = topology?.lanes?.[agent.currentLaneId] || null;
  const compatibility = agent.trafficMetadata?.macroCompatibility || null;
  return {
    tokenId: String(agent.tokenId),
    tokenIndex: Number.isFinite(Number(compatibility?.tokenIndex))
      ? Number(compatibility.tokenIndex)
      : Math.floor(finite(tokenIndex, -1)),
    edgeId: compatibility?.edgeId || null,
    direction: lane?.direction || null,
    phase: null,
    x: finite(pose.x),
    y: finite(pose.y),
    angle: finite(pose.angle),
    routeActive: true,
    routeStage: agent.stage,
    routeLaneId: agent.currentLaneId,
    routeConnectorId: agent.connectorId || null,
    routeNextLaneId: agent.nextLaneId || null,
    routePreviousLaneId: agent.previousLaneId || null,
    routeHop: Math.max(0, Math.floor(finite(agent.routeHop))),
    routeStageProgress: Math.max(0, Math.min(1, finite(agent.stageProgress))),
    routeGeometryId: geometry.id,
    routeSourceRoadEdgeId: lane?.sourceRoadEdgeId || null
  };
}

export function installTrafficRouteMaterializationMetadataPolicy(materializer) {
  if (!materializer?.updateSlot || !materializer?.release) {
    throw new TypeError("Route materialization metadata policy requires TrafficMaterializationSystem.");
  }
  if (materializer.__nbdTrafficRouteMaterializationMetadataPolicy) {
    return materializer.__nbdTrafficRouteMaterializationMetadataPolicy;
  }

  const originalUpdateSlot = materializer.updateSlot;
  const originalRelease = materializer.release;

  function routeAwareUpdateSlot(slot, token) {
    const updated = originalUpdateSlot.call(this, slot, token);
    applyTrafficRouteSlotMetadata(updated || slot, token);
    return updated;
  }

  function routeAwareRelease(slot, options = {}) {
    const released = originalRelease.call(this, slot, options);
    if (released) clearTrafficRouteSlotMetadata(slot);
    return released;
  }

  materializer.updateSlot = routeAwareUpdateSlot;
  materializer.release = routeAwareRelease;

  const policy = {
    active: true,
    destroy() {
      if (materializer.updateSlot === routeAwareUpdateSlot) materializer.updateSlot = originalUpdateSlot;
      if (materializer.release === routeAwareRelease) materializer.release = originalRelease;
      if (materializer.__nbdTrafficRouteMaterializationMetadataPolicy === policy) {
        delete materializer.__nbdTrafficRouteMaterializationMetadataPolicy;
      }
    }
  };
  materializer.__nbdTrafficRouteMaterializationMetadataPolicy = policy;
  return policy;
}
