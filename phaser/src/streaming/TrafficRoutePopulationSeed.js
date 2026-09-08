import { createTrafficRouteAgent } from "./TrafficRouteCursor.js";

const EPSILON = 0.000001;

function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, finite(value)));
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value || "traffic-route-seed")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function laneIdsBySourceRoad(topology) {
  const index = new Map();
  for (const laneId of topology?.laneIds || []) {
    const lane = topology?.lanes?.[laneId];
    if (!lane?.sourceRoadEdgeId) continue;
    const sourceRoadEdgeId = String(lane.sourceRoadEdgeId);
    if (!index.has(sourceRoadEdgeId)) index.set(sourceRoadEdgeId, []);
    index.get(sourceRoadEdgeId).push(lane.id);
  }
  for (const laneIds of index.values()) laneIds.sort();
  return index;
}

function flowEntries(trafficFlows) {
  if (trafficFlows instanceof Map) return [...trafficFlows.entries()];
  if (Array.isArray(trafficFlows)) {
    return trafficFlows
      .filter(flow => flow?.edgeId)
      .map(flow => [flow.edgeId, flow]);
  }
  return [];
}

function selectInitialLane(topology, macroEdge, phase, tokenIndex, tokenId, sourceIndex) {
  const sourceRoadEdgeIds = (macroEdge?.sourceRoadEdgeIds || [])
    .map(String)
    .filter(sourceRoadEdgeId => (sourceIndex.get(sourceRoadEdgeId) || []).length > 0);
  if (!sourceRoadEdgeIds.length) return null;

  // Macro phase is allowed only as deterministic bootstrap provenance. Once the
  // route agent exists, local progression is compiler-lane/connector owned.
  const scaled = clamp01(phase) * sourceRoadEdgeIds.length;
  const sourceIndexValue = Math.min(sourceRoadEdgeIds.length - 1, Math.floor(scaled));
  const sourceRoadEdgeId = sourceRoadEdgeIds[sourceIndexValue];
  const localProgress = Math.min(1 - EPSILON, Math.max(0, scaled - sourceIndexValue));
  const candidates = (sourceIndex.get(sourceRoadEdgeId) || [])
    .map(id => topology?.lanes?.[id])
    .filter(Boolean);
  if (!candidates.length) return null;

  // Aggregate macro flow has no directional identity. Alternate initial direction
  // deterministically, then keep the stable route token authoritative thereafter.
  const desiredDirection = tokenIndex % 2 === 0 ? "forward" : "reverse";
  const directed = candidates.filter(lane => lane.direction === desiredDirection);
  const choices = directed.length ? directed : candidates;
  const lane = choices[stableHash(tokenId) % choices.length];
  return { lane, sourceRoadEdgeId, localProgress };
}

export function seedTrafficRouteAgentsFromMacroPopulation(trafficFlows, macroGraph, topology, {
  tokenIdFor = ({ edgeId, tokenIndex }) => `${edgeId}#${tokenIndex}`,
  provenance = "macro-route-seed"
} = {}) {
  if (!macroGraph?.edges || !Array.isArray(macroGraph?.edgeIds)) {
    throw new TypeError("Traffic route population seeding requires a macro graph.");
  }
  if (!topology?.lanes || !Array.isArray(topology?.laneIds)) {
    throw new TypeError("Traffic route population seeding requires compiler-owned local topology.");
  }
  if (typeof tokenIdFor !== "function") {
    throw new TypeError("Traffic route population seeding requires tokenIdFor to be a function.");
  }

  const sourceIndex = laneIdsBySourceRoad(topology);
  const agents = [];
  const unseeded = [];
  const seenTokenIds = new Set();
  let totalMacroTokens = 0;

  for (const [edgeIdValue, flow] of flowEntries(trafficFlows)
    .sort((left, right) => String(left[0]).localeCompare(String(right[0])))) {
    const edgeId = String(edgeIdValue);
    const macroEdge = macroGraph.edges?.[edgeId];
    if (!macroEdge) continue;
    const phases = Array.isArray(flow?.phases) ? flow.phases : [];
    const tokenCount = Math.max(0, Math.floor(finite(flow?.tokenCount, phases.length)));
    totalMacroTokens += tokenCount;

    for (let tokenIndex = 0; tokenIndex < tokenCount; tokenIndex++) {
      const tokenId = String(tokenIdFor({ edgeId, tokenIndex, flow, macroEdge }) || "").trim();
      if (!tokenId) {
        unseeded.push({ tokenId: null, edgeId, tokenIndex, reason: "missing-token-id" });
        continue;
      }
      if (seenTokenIds.has(tokenId)) {
        unseeded.push({ tokenId, edgeId, tokenIndex, reason: "duplicate-token-id" });
        continue;
      }
      seenTokenIds.add(tokenId);

      const phase = clamp01(phases[tokenIndex]);
      const selected = selectInitialLane(
        topology,
        macroEdge,
        phase,
        tokenIndex,
        tokenId,
        sourceIndex
      );
      if (!selected) {
        unseeded.push({ tokenId, edgeId, tokenIndex, reason: "no-compatible-local-lane" });
        continue;
      }

      agents.push(createTrafficRouteAgent(topology, {
        tokenId,
        laneId: selected.lane.id,
        stageProgress: selected.localProgress,
        trafficMetadata: {
          macroCompatibility: {
            edgeId,
            tokenIndex,
            initialPhase: phase,
            initialSourceRoadEdgeId: selected.sourceRoadEdgeId,
            provenance: String(provenance || "macro-route-seed")
          }
        }
      }));
    }
  }

  agents.sort((left, right) => left.tokenId.localeCompare(right.tokenId));
  unseeded.sort((left, right) => (
    String(left.edgeId).localeCompare(String(right.edgeId))
    || finite(left.tokenIndex) - finite(right.tokenIndex)
    || String(left.tokenId || "").localeCompare(String(right.tokenId || ""))
  ));

  return {
    agents,
    unseeded,
    totalMacroTokens,
    seededAgentCount: agents.length,
    populationConserved: agents.length + unseeded.length === totalMacroTokens
  };
}
