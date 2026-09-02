function macroSourceRoadIndex(macroGraph) {
  const index = new Map();
  for (const edgeId of macroGraph?.edgeIds || []) {
    const edge = macroGraph?.edges?.[edgeId];
    if (!edge) continue;
    for (const sourceRoadEdgeId of edge.sourceRoadEdgeIds || []) {
      if (!index.has(sourceRoadEdgeId)) index.set(sourceRoadEdgeId, []);
      index.get(sourceRoadEdgeId).push(edgeId);
    }
  }
  for (const edgeIds of index.values()) edgeIds.sort();
  return index;
}

function explicitMacroEdgeId(agent) {
  const compatibility = agent?.trafficMetadata?.macroCompatibility;
  if (!compatibility || typeof compatibility !== "object") return null;
  return compatibility.edgeId ? String(compatibility.edgeId) : null;
}

function currentLane(topology, agent) {
  return topology?.lanes?.[agent?.currentLaneId] || null;
}

function increment(record, key) {
  if (!key) return;
  record[key] = (record[key] || 0) + 1;
}

export function projectTrafficRouteAgentToMacroCompatibility(agent, topology, macroGraph, sourceIndex = null) {
  const index = sourceIndex || macroSourceRoadIndex(macroGraph);
  const tokenId = String(agent?.tokenId || "");
  const lane = currentLane(topology, agent);
  if (!lane) {
    return {
      tokenId,
      stage: agent?.stage || null,
      laneId: agent?.currentLaneId || null,
      districtId: null,
      sourceRoadEdgeId: null,
      status: "unmatched",
      macroEdgeId: null,
      candidateMacroEdgeIds: [],
      reason: "missing-current-lane"
    };
  }

  const sourceRoadEdgeId = lane.sourceRoadEdgeId ? String(lane.sourceRoadEdgeId) : null;
  const districtId = lane.districtId ? String(lane.districtId) : null;
  const candidates = sourceRoadEdgeId
    ? [...(index.get(sourceRoadEdgeId) || [])]
    : [];
  const explicitEdgeId = explicitMacroEdgeId(agent);

  if (explicitEdgeId && candidates.includes(explicitEdgeId) && macroGraph?.edges?.[explicitEdgeId]) {
    return {
      tokenId,
      stage: agent?.stage || null,
      laneId: lane.id,
      districtId,
      sourceRoadEdgeId,
      status: "projected",
      macroEdgeId: explicitEdgeId,
      candidateMacroEdgeIds: candidates,
      reason: "explicit-compatible-provenance"
    };
  }

  if (candidates.length === 1) {
    return {
      tokenId,
      stage: agent?.stage || null,
      laneId: lane.id,
      districtId,
      sourceRoadEdgeId,
      status: "projected",
      macroEdgeId: candidates[0],
      candidateMacroEdgeIds: candidates,
      reason: "unique-source-road-match"
    };
  }

  if (candidates.length > 1) {
    return {
      tokenId,
      stage: agent?.stage || null,
      laneId: lane.id,
      districtId,
      sourceRoadEdgeId,
      status: "ambiguous",
      macroEdgeId: null,
      candidateMacroEdgeIds: candidates,
      reason: explicitEdgeId ? "stale-or-incompatible-provenance" : "multiple-source-road-matches"
    };
  }

  return {
    tokenId,
    stage: agent?.stage || null,
    laneId: lane.id,
    districtId,
    sourceRoadEdgeId,
    status: "unmatched",
    macroEdgeId: null,
    candidateMacroEdgeIds: [],
    reason: sourceRoadEdgeId ? "no-source-road-match" : "missing-source-road-id"
  };
}

export function projectTrafficRouteAgentsToMacroCompatibility(agents, topology, macroGraph) {
  if (!topology?.lanes) throw new TypeError("Traffic route compatibility projection requires compiler-owned lanes.");
  if (!macroGraph?.edges || !Array.isArray(macroGraph?.edgeIds)) {
    throw new TypeError("Traffic route compatibility projection requires a macro graph.");
  }

  const list = Array.isArray(agents) ? agents : [];
  const sourceIndex = macroSourceRoadIndex(macroGraph);
  const edgeCounts = Object.fromEntries((macroGraph.edgeIds || []).map(edgeId => [edgeId, 0]));
  const districtCounts = Object.fromEntries((macroGraph.nodeIds || []).map(districtId => [districtId, 0]));
  const stageCounts = { lane: 0, connector: 0, other: 0 };
  const records = [];
  let projectedAgentCount = 0;
  let ambiguousAgentCount = 0;
  let unmatchedAgentCount = 0;
  let unknownDistrictCount = 0;

  for (const agent of list) {
    const record = projectTrafficRouteAgentToMacroCompatibility(agent, topology, macroGraph, sourceIndex);
    records.push(record);

    if (record.stage === "lane") stageCounts.lane++;
    else if (record.stage === "connector") stageCounts.connector++;
    else stageCounts.other++;

    if (record.districtId && Object.prototype.hasOwnProperty.call(districtCounts, record.districtId)) {
      increment(districtCounts, record.districtId);
    } else {
      unknownDistrictCount++;
    }

    if (record.status === "projected") {
      projectedAgentCount++;
      increment(edgeCounts, record.macroEdgeId);
    } else if (record.status === "ambiguous") {
      ambiguousAgentCount++;
    } else {
      unmatchedAgentCount++;
    }
  }

  return {
    version: 1,
    source: "stable-local-route-agents",
    authority: "output-only-compatibility",
    totalAgents: list.length,
    projectedAgentCount,
    ambiguousAgentCount,
    unmatchedAgentCount,
    unknownDistrictCount,
    edgeCounts,
    districtCounts,
    stageCounts,
    records
  };
}

export function validateTrafficRouteMacroProjection(projection, macroGraph) {
  const errors = [];
  const total = Number(projection?.totalAgents || 0);
  const categorized = Number(projection?.projectedAgentCount || 0)
    + Number(projection?.ambiguousAgentCount || 0)
    + Number(projection?.unmatchedAgentCount || 0);
  if (categorized !== total) errors.push(`Projection population mismatch: ${categorized}/${total}.`);

  const edgeTotal = Object.values(projection?.edgeCounts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  if (edgeTotal !== Number(projection?.projectedAgentCount || 0)) {
    errors.push(`Projected macro edge count mismatch: ${edgeTotal}/${projection?.projectedAgentCount || 0}.`);
  }

  const districtTotal = Object.values(projection?.districtCounts || {}).reduce((sum, value) => sum + Number(value || 0), 0)
    + Number(projection?.unknownDistrictCount || 0);
  if (districtTotal !== total) errors.push(`Projected district count mismatch: ${districtTotal}/${total}.`);

  const allowedEdges = new Set(macroGraph?.edgeIds || []);
  for (const edgeId of Object.keys(projection?.edgeCounts || {})) {
    if (!allowedEdges.has(edgeId)) errors.push(`Projection exposes unknown macro edge ${edgeId}.`);
  }

  for (const record of projection?.records || []) {
    if (record.status === "projected" && !allowedEdges.has(record.macroEdgeId)) {
      errors.push(`Projected agent ${record.tokenId} references unknown macro edge ${record.macroEdgeId}.`);
    }
    if (record.status !== "projected" && record.macroEdgeId) {
      errors.push(`Non-projected agent ${record.tokenId} must not guess macro edge ${record.macroEdgeId}.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    metrics: {
      totalAgents: total,
      projectedAgents: Number(projection?.projectedAgentCount || 0),
      ambiguousAgents: Number(projection?.ambiguousAgentCount || 0),
      unmatchedAgents: Number(projection?.unmatchedAgentCount || 0),
      unknownDistrictAgents: Number(projection?.unknownDistrictCount || 0)
    }
  };
}
