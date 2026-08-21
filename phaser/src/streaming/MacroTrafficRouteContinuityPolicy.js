function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value || "traffic")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function trafficDirectionForEdge(edge, fromId, toId) {
  if (!edge) return null;
  if (edge.a === fromId && edge.b === toId) return "forward";
  if (edge.b === fromId && edge.a === toId) return "reverse";
  return null;
}

export function chooseTrafficContinuation(graph, edge, direction, tokenId, hop = 0) {
  if (!graph || !edge) return null;
  const fromId = direction === "reverse" ? edge.b : edge.a;
  const atId = direction === "reverse" ? edge.a : edge.b;
  const neighbours = [...(graph.nodes?.[atId]?.neighbours || [])];
  if (!neighbours.length) return null;
  const forwardChoices = neighbours.filter(id => id !== fromId);
  const choices = forwardChoices.length ? forwardChoices : neighbours;
  const nextId = choices[(stableHash(tokenId) + Math.max(0, Math.floor(finite(hop)))) % choices.length];
  const nextEdge = (graph.edgeIds || [])
    .map(id => graph.edges?.[id])
    .find(candidate => candidate && (
      (candidate.a === atId && candidate.b === nextId)
      || (candidate.b === atId && candidate.a === nextId)
    ));
  const nextDirection = trafficDirectionForEdge(nextEdge, atId, nextId);
  if (!nextEdge || !nextDirection) return null;
  return {
    previousNodeId: fromId,
    fromId: atId,
    toId: nextId,
    edgeId: nextEdge.id,
    direction: nextDirection
  };
}

export function advanceTrafficAgent(agent, seconds, graph, speedMultiplier = 1.12) {
  const next = { ...agent };
  let remaining = Math.max(0, finite(seconds));
  let transitions = 0;
  let guard = 8;
  while (remaining > 0.000001 && guard-- > 0) {
    const edge = graph?.edges?.[next.edgeId];
    if (!edge) break;
    const multiplier = Math.max(0.75, Math.min(1.5, finite(speedMultiplier, 1.12)));
    const travelSeconds = Math.max(1, finite(edge.travelSeconds, 6)) / multiplier;
    const phase = Math.max(0, Math.min(1, finite(next.phase)));
    const secondsToEnd = Math.max(0, 1 - phase) * travelSeconds;
    if (remaining + 0.000001 < secondsToEnd) {
      next.phase = phase + remaining / travelSeconds;
      remaining = 0;
      break;
    }

    remaining = Math.max(0, remaining - secondsToEnd);
    const continuation = chooseTrafficContinuation(graph, edge, next.direction, next.tokenId, next.hop);
    if (!continuation) {
      next.phase = 0;
      next.direction = next.direction === "forward" ? "reverse" : "forward";
      next.hop = Math.max(0, Math.floor(finite(next.hop))) + 1;
      transitions++;
      continue;
    }
    next.edgeId = continuation.edgeId;
    next.direction = continuation.direction;
    next.phase = 0;
    next.previousNodeId = continuation.previousNodeId;
    next.fromId = continuation.fromId;
    next.toId = continuation.toId;
    next.hop = Math.max(0, Math.floor(finite(next.hop))) + 1;
    transitions++;
  }
  return { agent: next, transitions, remainingSeconds: remaining };
}

export function installMacroTrafficRouteContinuityPolicy(macro) {
  if (!macro || typeof macro.advanceTraffic !== "function" || !(macro.trafficFlows instanceof Map)) {
    return Object.freeze({
      active: false,
      snapshot: () => ({ active: false, agents: [], totalJunctionTransitions: 0 }),
      destroy() {}
    });
  }
  if (macro.__nbdTrafficRouteContinuityPolicy) return macro.__nbdTrafficRouteContinuityPolicy;

  const originalAdvanceTraffic = macro.advanceTraffic;
  const originalSnapshot = typeof macro.snapshot === "function" ? macro.snapshot : () => ({});
  let agents = null;
  let totalJunctionTransitions = 0;

  function ensureAgents() {
    if (agents) return agents;
    if (!macro.graph?.edgeIds?.length || !(macro.trafficFlows instanceof Map)) return [];
    agents = [];
    for (const edgeId of macro.graph.edgeIds) {
      const edge = macro.graph.edges?.[edgeId];
      const flow = macro.trafficFlows.get(edgeId);
      if (!edge || !flow) continue;
      flow.phases.forEach((phase, tokenIndex) => {
        const direction = tokenIndex % 2 === 0 ? "forward" : "reverse";
        agents.push({
          tokenId: `${edgeId}#${tokenIndex}`,
          tokenIndex,
          edgeId,
          direction,
          phase: finite(phase),
          hop: 0,
          previousNodeId: null,
          fromId: direction === "forward" ? edge.a : edge.b,
          toId: direction === "forward" ? edge.b : edge.a
        });
      });
    }
    return agents;
  }

  function syncFlows() {
    const grouped = new Map((macro.graph?.edgeIds || []).map(edgeId => [edgeId, []]));
    for (const agent of ensureAgents()) {
      if (!grouped.has(agent.edgeId)) grouped.set(agent.edgeId, []);
      grouped.get(agent.edgeId).push(agent.phase);
    }
    for (const edgeId of macro.graph?.edgeIds || []) {
      const phases = grouped.get(edgeId) || [];
      const previous = macro.trafficFlows.get(edgeId);
      macro.trafficFlows.set(edgeId, {
        edgeId,
        tokenCount: phases.length,
        phases,
        completedTrips: finite(previous?.completedTrips)
      });
    }
    macro.rebuildTrafficLoad?.();
  }

  function routedAdvanceTraffic(seconds) {
    if (!macro.graph) return originalAdvanceTraffic.call(this, seconds);
    const list = ensureAgents();
    if (!list.length) return originalAdvanceTraffic.call(this, seconds);
    let completed = 0;
    for (let index = 0; index < list.length; index++) {
      const result = advanceTrafficAgent(list[index], seconds, macro.graph, macro.trafficSpeedMultiplier);
      list[index] = result.agent;
      completed += result.transitions;
    }
    totalJunctionTransitions += completed;
    macro.completedTrafficTrips = finite(macro.completedTrafficTrips) + completed;
    syncFlows();
    return completed;
  }

  function routedTrafficTokens() {
    return ensureAgents().map(agent => ({ ...agent }));
  }

  function routedSnapshot() {
    const snapshot = originalSnapshot.call(this);
    return {
      ...snapshot,
      routedTraffic: true,
      routedTrafficAgents: ensureAgents().length,
      totalJunctionTransitions
    };
  }

  macro.advanceTraffic = routedAdvanceTraffic;
  macro.routedTrafficTokens = routedTrafficTokens;
  macro.snapshot = routedSnapshot;

  const policy = {
    active: true,
    snapshot() {
      return {
        active: true,
        agents: ensureAgents().map(agent => ({ ...agent })),
        totalJunctionTransitions
      };
    },
    destroy() {
      if (macro.advanceTraffic === routedAdvanceTraffic) macro.advanceTraffic = originalAdvanceTraffic;
      if (macro.snapshot === routedSnapshot) macro.snapshot = originalSnapshot;
      if (macro.routedTrafficTokens === routedTrafficTokens) delete macro.routedTrafficTokens;
      agents = null;
      if (macro.__nbdTrafficRouteContinuityPolicy === policy) delete macro.__nbdTrafficRouteContinuityPolicy;
    }
  };
  macro.__nbdTrafficRouteContinuityPolicy = policy;
  return policy;
}
