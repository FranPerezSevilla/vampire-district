import {
  advanceTrafficRouteAgent
} from "./TrafficRouteCursor.js";
import {
  projectTrafficRouteAgentsToMacroCompatibility,
  validateTrafficRouteMacroProjection
} from "./TrafficRouteCompatibilityProjection.js";
import { seedTrafficRouteAgentsFromMacroPopulation } from "./TrafficRoutePopulationSeed.js";

function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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

export function initializeShadowTrafficRouteAgents(trafficFlows, macroGraph, topology) {
  return seedTrafficRouteAgentsFromMacroPopulation(
    trafficFlows,
    macroGraph,
    topology,
    {
      tokenIdFor: ({ edgeId, tokenIndex }) => `shadow-traffic:${edgeId}:${tokenIndex}`,
      provenance: "m3-shadow-seed"
    }
  );
}

export function advanceShadowTrafficRouteAgents(agents, seconds, topology, {
  speed = 168,
  maxStageTransitions = 32
} = {}) {
  const nextAgents = [];
  const blocked = [];
  let stageTransitions = 0;
  let junctionDecisions = 0;

  for (const agent of Array.isArray(agents) ? agents : []) {
    const stableTokenId = agent.tokenId;
    const result = advanceTrafficRouteAgent(agent, seconds, topology, {
      speed,
      maxStageTransitions
    });
    if (result.agent.tokenId !== stableTokenId) {
      throw new Error(`Shadow route changed stable identity ${stableTokenId}.`);
    }
    nextAgents.push(result.agent);
    stageTransitions += result.stageTransitions;
    junctionDecisions += result.junctionDecisions;
    if (result.blockedReason) {
      blocked.push({
        tokenId: stableTokenId,
        reason: result.blockedReason,
        laneId: result.agent.currentLaneId,
        stage: result.agent.stage
      });
    }
  }

  nextAgents.sort((left, right) => left.tokenId.localeCompare(right.tokenId));
  blocked.sort((left, right) => left.tokenId.localeCompare(right.tokenId));
  return {
    agents: nextAgents,
    blocked,
    stageTransitions,
    junctionDecisions
  };
}

function macroEdgeCounts(trafficFlows, macroGraph) {
  const counts = Object.fromEntries((macroGraph?.edgeIds || []).map(edgeId => [edgeId, 0]));
  for (const [edgeId, flow] of flowEntries(trafficFlows)) {
    if (!Object.prototype.hasOwnProperty.call(counts, edgeId)) continue;
    counts[edgeId] = Math.max(0, Math.floor(finite(flow?.tokenCount, flow?.phases?.length || 0)));
  }
  return counts;
}

export function buildShadowTrafficRouteSnapshot({
  agents,
  unseeded = [],
  topology,
  macroGraph,
  trafficFlows,
  ticks = 0,
  stageTransitions = 0,
  junctionDecisions = 0,
  blocked = []
} = {}) {
  const projection = projectTrafficRouteAgentsToMacroCompatibility(agents, topology, macroGraph);
  const projectionValidation = validateTrafficRouteMacroProjection(projection, macroGraph);
  const currentEdgeCounts = macroEdgeCounts(trafficFlows, macroGraph);
  let edgeAbsoluteDelta = 0;
  for (const edgeId of macroGraph?.edgeIds || []) {
    edgeAbsoluteDelta += Math.abs(
      finite(projection.edgeCounts?.[edgeId]) - finite(currentEdgeCounts[edgeId])
    );
  }
  const macroTotalTokens = Object.values(currentEdgeCounts).reduce((sum, count) => sum + count, 0);
  const shadowPopulation = (agents?.length || 0) + (unseeded?.length || 0);

  return {
    ready: Boolean(topology?.lanes && macroGraph?.edges),
    mode: "shadow",
    movementAuthority: false,
    macroMutationAuthority: false,
    routeAuthority: "compiler-local-topology",
    ticks: Math.max(0, Math.floor(finite(ticks))),
    shadowAgentCount: agents?.length || 0,
    unseededAgentCount: unseeded?.length || 0,
    macroTotalTokens,
    shadowPopulation,
    populationDelta: shadowPopulation - macroTotalTokens,
    projectedAgentCount: projection.projectedAgentCount,
    ambiguousAgentCount: projection.ambiguousAgentCount,
    unmatchedAgentCount: projection.unmatchedAgentCount,
    projectedCoverage: agents?.length
      ? projection.projectedAgentCount / agents.length
      : 1,
    edgeAbsoluteDelta,
    stageCounts: { ...projection.stageCounts },
    stageTransitions: Math.max(0, Math.floor(finite(stageTransitions))),
    junctionDecisions: Math.max(0, Math.floor(finite(junctionDecisions))),
    blockedAgentCount: blocked?.length || 0,
    projectionValid: projectionValidation.valid,
    projectionErrors: [...projectionValidation.errors],
    edgeCounts: { ...projection.edgeCounts },
    macroEdgeCounts: currentEdgeCounts,
    districtCounts: { ...projection.districtCounts }
  };
}

export function installTrafficShadowRoutePolicy(materializer, {
  speed = null
} = {}) {
  const macro = materializer?.macro;
  if (!materializer || !macro || typeof macro.simulateTick !== "function") {
    return Object.freeze({
      active: false,
      snapshot: () => ({ ready: false, mode: "shadow", movementAuthority: false }),
      destroy() {}
    });
  }
  if (macro.__nbdTrafficShadowRoutePolicy) return macro.__nbdTrafficShadowRoutePolicy;

  const originalSimulateTick = macro.simulateTick;
  let agents = null;
  let unseeded = [];
  let ticks = 0;
  let totalStageTransitions = 0;
  let totalJunctionDecisions = 0;
  let blocked = [];

  function topology() {
    return materializer.lanes?.localTopology || null;
  }

  function ensureAgents() {
    const localTopology = topology();
    if (agents || !localTopology?.lanes || !macro.graph || !(macro.trafficFlows instanceof Map)) {
      return agents || [];
    }
    const initialized = initializeShadowTrafficRouteAgents(
      macro.trafficFlows,
      macro.graph,
      localTopology
    );
    agents = initialized.agents;
    unseeded = initialized.unseeded;
    return agents;
  }

  function shadowSimulateTick(seconds = macro.intervalSeconds) {
    const result = originalSimulateTick.call(this, seconds);
    const list = ensureAgents();
    const localTopology = topology();
    if (result && list.length && localTopology?.lanes) {
      const routeSpeed = Math.max(1, finite(
        speed,
        150 * Math.max(0.75, Math.min(1.5, finite(macro.trafficSpeedMultiplier, 1.12)))
      ));
      const advanced = advanceShadowTrafficRouteAgents(list, seconds, localTopology, {
        speed: routeSpeed
      });
      agents = advanced.agents;
      blocked = advanced.blocked;
      totalStageTransitions += advanced.stageTransitions;
      totalJunctionDecisions += advanced.junctionDecisions;
      ticks++;
    }
    return result;
  }

  function snapshot() {
    const localTopology = topology();
    ensureAgents();
    if (!localTopology?.lanes || !macro.graph) {
      return {
        ready: false,
        mode: "shadow",
        movementAuthority: false,
        macroMutationAuthority: false,
        shadowAgentCount: agents?.length || 0,
        unseededAgentCount: unseeded.length
      };
    }
    return buildShadowTrafficRouteSnapshot({
      agents: agents || [],
      unseeded,
      topology: localTopology,
      macroGraph: macro.graph,
      trafficFlows: macro.trafficFlows,
      ticks,
      stageTransitions: totalStageTransitions,
      junctionDecisions: totalJunctionDecisions,
      blocked
    });
  }

  macro.simulateTick = shadowSimulateTick;

  const policy = {
    active: true,
    snapshot,
    agents() {
      return (ensureAgents() || []).map(agent => ({
        ...agent,
        trafficMetadata: agent.trafficMetadata ? structuredClone(agent.trafficMetadata) : null
      }));
    },
    destroy() {
      if (macro.simulateTick === shadowSimulateTick) macro.simulateTick = originalSimulateTick;
      agents = null;
      unseeded = [];
      blocked = [];
      if (macro.__nbdTrafficShadowRoutePolicy === policy) delete macro.__nbdTrafficShadowRoutePolicy;
    }
  };
  macro.__nbdTrafficShadowRoutePolicy = policy;
  return policy;
}
