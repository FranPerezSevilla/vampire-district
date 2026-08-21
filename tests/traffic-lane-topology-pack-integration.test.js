import test from "node:test";
import assert from "node:assert/strict";

import { cityRoadGraph } from "../tools/city-compiler/city-road-graph-v1.js";
import { currentCityBlueprint } from "../tools/city-compiler/current-city.js";
import {
  buildDistrictStreamingFileSet,
  validateDistrictStreamingFileSet
} from "../tools/city-compiler/district-streaming.js";
import {
  attachCompilerTrafficLaneTopology,
  TRAFFIC_LANE_PACK_SCHEMA_VERSION
} from "../tools/city-compiler/traffic-lane-topology-integration.js";

function buildBase() {
  return buildDistrictStreamingFileSet({
    blueprint: currentCityBlueprint,
    roadGraph: cityRoadGraph
  });
}

test("local compiler topology is added without mutating legacy traffic lane compatibility data", () => {
  const base = buildBase();
  const legacyEdges = structuredClone(base.trafficLanes.edges);
  const legacyJunctions = structuredClone(base.trafficLanes.junctions);
  const baseSnapshot = structuredClone(base.trafficLanes);

  const { fileSet: enriched, validation } = attachCompilerTrafficLaneTopology(base);

  assert.equal(validation.valid, true, validation.errors.join("\n"));
  assert.equal(enriched.trafficLanes.schemaVersion, TRAFFIC_LANE_PACK_SCHEMA_VERSION);
  assert.equal(enriched.trafficLanes.version, TRAFFIC_LANE_PACK_SCHEMA_VERSION);
  assert.deepEqual(enriched.trafficLanes.edges, legacyEdges);
  assert.deepEqual(enriched.trafficLanes.junctions, legacyJunctions);
  assert.deepEqual(base.trafficLanes, baseSnapshot, "integration must not mutate the base compiler file set");
});

test("generated local topology is compiler-node-owned and complete for production network segments", () => {
  const base = buildBase();
  const { fileSet: enriched, validation } = attachCompilerTrafficLaneTopology(base);
  const topology = enriched.trafficLanes.localTopology;

  assert.equal(validation.valid, true, validation.errors.join("\n"));
  assert.equal(topology.ownershipMode, "compiler-node-id");
  assert.equal(topology.drivingSide, "right");
  assert.equal(topology.stats.networkSegmentCount, base.network.segments.length);
  assert.equal(topology.stats.directedLaneCount, base.network.segments.length * 2);
  assert.equal(topology.stats.preferredUTurnTransitionCount, topology.stats.deadEndNodeCount);
  assert.equal(Object.keys(topology.lanes).length, topology.laneIds.length);
  assert.equal(Object.keys(topology.transitions).length, topology.transitionIds.length);
});

test("legacy district-streaming validation remains green after additive topology integration", () => {
  const base = buildBase();
  const { fileSet: enriched } = attachCompilerTrafficLaneTopology(base);
  const validation = validateDistrictStreamingFileSet(enriched);

  assert.equal(validation.valid, true, validation.errors.join("\n"));
  assert.equal(
    validation.metrics.trafficLaneEdges,
    Object.keys(base.trafficLanes.edges).length,
    "legacy edge count must remain stable during M1 migration"
  );
});

test("pack integration is deterministic", () => {
  const first = attachCompilerTrafficLaneTopology(buildBase()).fileSet.trafficLanes;
  const second = attachCompilerTrafficLaneTopology(buildBase()).fileSet.trafficLanes;

  assert.deepEqual(first, second);
  assert.doesNotThrow(() => JSON.stringify(first));
});
