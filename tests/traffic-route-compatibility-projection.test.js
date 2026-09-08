import test from "node:test";
import assert from "node:assert/strict";

import { cityRoadGraph } from "../tools/city-compiler/city-road-graph-v1.js";
import { currentCityBlueprint } from "../tools/city-compiler/current-city.js";
import { buildDistrictStreamingFileSet } from "../tools/city-compiler/district-streaming.js";
import { attachCompilerTrafficLaneTopology } from "../tools/city-compiler/traffic-lane-topology-integration.js";
import {
  projectTrafficRouteAgentToMacroCompatibility,
  projectTrafficRouteAgentsToMacroCompatibility,
  validateTrafficRouteMacroProjection
} from "../phaser/src/streaming/TrafficRouteCompatibilityProjection.js";

function syntheticTopology() {
  return {
    lanes: {
      "lane-unique": {
        id: "lane-unique",
        districtId: "district-a",
        sourceRoadEdgeId: "road-unique"
      },
      "lane-shared": {
        id: "lane-shared",
        districtId: "district-a",
        sourceRoadEdgeId: "road-shared"
      },
      "lane-unmatched": {
        id: "lane-unmatched",
        districtId: "district-b",
        sourceRoadEdgeId: "road-nowhere"
      }
    }
  };
}

function syntheticMacroGraph() {
  return {
    nodeIds: ["district-a", "district-b"],
    nodes: {
      "district-a": { id: "district-a" },
      "district-b": { id: "district-b" }
    },
    edgeIds: ["macro-unique", "macro-shared-a", "macro-shared-b"],
    edges: {
      "macro-unique": { id: "macro-unique", sourceRoadEdgeIds: ["road-unique"] },
      "macro-shared-a": { id: "macro-shared-a", sourceRoadEdgeIds: ["road-shared"] },
      "macro-shared-b": { id: "macro-shared-b", sourceRoadEdgeIds: ["road-shared"] }
    }
  };
}

function agent(tokenId, laneId, trafficMetadata = null, stage = "lane") {
  return {
    tokenId,
    currentLaneId: laneId,
    stage,
    trafficMetadata
  };
}

test("unique source-road membership projects to exactly one macro edge", () => {
  const record = projectTrafficRouteAgentToMacroCompatibility(
    agent("traffic-1", "lane-unique"),
    syntheticTopology(),
    syntheticMacroGraph()
  );

  assert.equal(record.status, "projected");
  assert.equal(record.macroEdgeId, "macro-unique");
  assert.equal(record.reason, "unique-source-road-match");
  assert.deepEqual(record.candidateMacroEdgeIds, ["macro-unique"]);
});

test("ambiguous source-road membership is never guessed", () => {
  const record = projectTrafficRouteAgentToMacroCompatibility(
    agent("traffic-2", "lane-shared"),
    syntheticTopology(),
    syntheticMacroGraph()
  );

  assert.equal(record.status, "ambiguous");
  assert.equal(record.macroEdgeId, null);
  assert.deepEqual(record.candidateMacroEdgeIds, ["macro-shared-a", "macro-shared-b"]);
});

test("compatible explicit provenance may disambiguate but stale provenance may not", () => {
  const topology = syntheticTopology();
  const macroGraph = syntheticMacroGraph();
  const compatible = projectTrafficRouteAgentToMacroCompatibility(
    agent("traffic-3", "lane-shared", {
      macroCompatibility: { edgeId: "macro-shared-b" }
    }),
    topology,
    macroGraph
  );
  const stale = projectTrafficRouteAgentToMacroCompatibility(
    agent("traffic-4", "lane-shared", {
      macroCompatibility: { edgeId: "macro-unique" }
    }),
    topology,
    macroGraph
  );

  assert.equal(compatible.status, "projected");
  assert.equal(compatible.macroEdgeId, "macro-shared-b");
  assert.equal(compatible.reason, "explicit-compatible-provenance");
  assert.equal(stale.status, "ambiguous");
  assert.equal(stale.macroEdgeId, null);
  assert.equal(stale.reason, "stale-or-incompatible-provenance");
});

test("projection conserves population across projected, ambiguous and unmatched agents", () => {
  const projection = projectTrafficRouteAgentsToMacroCompatibility([
    agent("traffic-1", "lane-unique"),
    agent("traffic-2", "lane-shared", null, "connector"),
    agent("traffic-3", "lane-unmatched")
  ], syntheticTopology(), syntheticMacroGraph());

  assert.equal(projection.totalAgents, 3);
  assert.equal(projection.projectedAgentCount, 1);
  assert.equal(projection.ambiguousAgentCount, 1);
  assert.equal(projection.unmatchedAgentCount, 1);
  assert.deepEqual(projection.stageCounts, { lane: 2, connector: 1, other: 0 });
  assert.equal(projection.districtCounts["district-a"], 2);
  assert.equal(projection.districtCounts["district-b"], 1);
  assert.equal(projection.edgeCounts["macro-unique"], 1);
  assert.equal(projection.edgeCounts["macro-shared-a"], 0);
  assert.equal(projection.edgeCounts["macro-shared-b"], 0);

  const validation = validateTrafficRouteMacroProjection(projection, syntheticMacroGraph());
  assert.equal(validation.valid, true, validation.errors.join("\n"));
});

test("production compiler lanes project deterministically without inventing phase or coordinates", () => {
  const base = buildDistrictStreamingFileSet({
    blueprint: currentCityBlueprint,
    roadGraph: cityRoadGraph
  });
  const { fileSet } = attachCompilerTrafficLaneTopology(base);
  const topology = fileSet.trafficLanes.localTopology;
  const agents = topology.laneIds.map((laneId, index) => ({
    tokenId: `projection-${index}`,
    currentLaneId: laneId,
    stage: index % 5 === 0 ? "connector" : "lane",
    trafficMetadata: null
  }));

  const first = projectTrafficRouteAgentsToMacroCompatibility(agents, topology, base.macroGraph);
  const second = projectTrafficRouteAgentsToMacroCompatibility(agents, topology, base.macroGraph);
  const validation = validateTrafficRouteMacroProjection(first, base.macroGraph);

  assert.deepEqual(first, second);
  assert.equal(validation.valid, true, validation.errors.join("\n"));
  assert.equal(first.totalAgents, topology.laneIds.length);
  assert.equal(
    first.projectedAgentCount + first.ambiguousAgentCount + first.unmatchedAgentCount,
    first.totalAgents
  );
  for (const record of first.records) {
    assert.equal(Object.prototype.hasOwnProperty.call(record, "phase"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(record, "x"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(record, "y"), false);
  }
});
