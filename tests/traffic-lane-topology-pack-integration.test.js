import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
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

function semanticHash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function committedTrafficPack() {
  return JSON.parse(readFileSync(
    new URL("../phaser/assets/city/packs/traffic-lanes.json", import.meta.url),
    "utf8"
  ));
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

test("generated local topology contains only activation-safe compiler junction connectors", () => {
  const base = buildBase();
  const { fileSet: enriched, validation } = attachCompilerTrafficLaneTopology(base);
  const topology = enriched.trafficLanes.localTopology;
  const bundle = topology.junctionConnectors;

  assert.equal(validation.valid, true, validation.errors.join("\n"));
  assert.ok(bundle);
  assert.equal(bundle.sourceTopologyId, topology.id);
  assert.equal(bundle.stats.rejectedConnectorCount, 0);
  assert.equal(bundle.stats.outsideRoadConnectorCount, 0);
  assert.equal(bundle.stats.tangentFailureCount, 0);
  assert.equal(bundle.stats.safeConnectorCount, bundle.stats.connectorCount);
  assert.equal(topology.stats.junctionConnectorCount, bundle.stats.connectorCount);
  assert.equal(topology.stats.safeJunctionConnectorCount, bundle.stats.safeConnectorCount);
  assert.equal(topology.stats.directJunctionHandoffCount, bundle.stats.directHandoffCount);
  assert.equal(validation.metrics.rejectedJunctionConnectors, 0);
  assert.equal(validation.metrics.outsideRoadJunctionConnectors, 0);
  assert.equal(validation.metrics.junctionConnectorTangentFailures, 0);

  for (const connector of Object.values(bundle.connectors)) {
    assert.equal(connector.activationSafe, true, `${connector.id}: ${connector.rejectionReasons.join(",")}`);
    assert.equal(connector.rejectionReasons.length, 0, connector.id);
  }
});

test("committed runtime traffic pack exactly matches compiler output", () => {
  const expected = attachCompilerTrafficLaneTopology(buildBase()).fileSet.trafficLanes;
  const committed = committedTrafficPack();

  assert.equal(
    committed.schemaVersion,
    TRAFFIC_LANE_PACK_SCHEMA_VERSION,
    "Static playtest pack is stale. Run `npm run city:streaming` and commit phaser/assets/city/packs/traffic-lanes.json."
  );
  assert.equal(committed.version, TRAFFIC_LANE_PACK_SCHEMA_VERSION);
  assert.equal(committed.localTopology?.ownershipMode, "compiler-node-id");
  assert.equal(
    semanticHash(committed),
    semanticHash(expected),
    "Static playtest traffic pack differs from compiler output. Run `npm run city:streaming` and commit the generated pack before relying on browser/manual traffic validation."
  );
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
