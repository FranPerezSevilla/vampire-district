import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildTrafficLaneJunctionTopology } from "../phaser/src/streaming/TrafficLaneJunctionTopology.js";

const productionManifest = JSON.parse(readFileSync(
  new URL("../phaser/assets/city/packs/traffic-lanes.json", import.meta.url),
  "utf8"
));

function compactAudit(topology) {
  const diagnostics = topology.diagnostics();
  return {
    summary: diagnostics.summary,
    unmatchedEndpointExamples: diagnostics.unmatchedEndpoints.slice(0, 8),
    ambiguousEndpointExamples: diagnostics.ambiguousEndpoints.slice(0, 8),
    orphanLaneExamples: diagnostics.orphanLanes.slice(0, 8),
    rejectedConnectorExamples: diagnostics.rejectedConnectors.slice(0, 8),
    tangentContinuityExamples: diagnostics.tangentContinuityFailures.slice(0, 8)
  };
}

test("production traffic manifest exposes deterministic lane/junction safety diagnostics", () => {
  const first = buildTrafficLaneJunctionTopology(productionManifest);
  const second = buildTrafficLaneJunctionTopology(productionManifest);

  assert.deepEqual(first.diagnostics(), second.diagnostics());
  assert.ok(first.snapshot().directedLaneCount > 0);
  assert.ok(first.snapshot().junctionCount > 0);
  assert.ok(first.snapshot().connectionCount > 0);
  assert.ok(first.snapshot().activatableConnectorCount > 0);

  console.log(`TRAFFIC_LANE_PRODUCTION_AUDIT ${JSON.stringify(compactAudit(first))}`);
});

test("production activatable connectors satisfy hard M1 safety invariants", () => {
  const topology = buildTrafficLaneJunctionTopology(productionManifest);
  const summary = topology.snapshot();

  assert.equal(summary.unsafeActivatableConnectorCount, 0);
  assert.equal(summary.duplicateConnectorIdCount, 0);
  assert.equal(summary.duplicateLanePairCount, 0);
  assert.equal(summary.endpointContinuityFailureCount, 0);
  assert.equal(topology.connectionByEdgeId.size, summary.activatableConnectorCount);

  for (const connector of topology.activatableConnections) {
    assert.equal(connector.activatable, true);
    assert.equal(connector.rejectionReasons.length, 0);
    assert.equal(connector.withinJunctionEnvelope, true);
    assert.equal(connector.endpointContinuityFailure, false);
    assert.equal(connector.sameJunctionOwnership, true);
    assert.deepEqual(connector.points[0], topology.laneByKey.get(connector.incomingLaneKey).end);
    assert.deepEqual(connector.points.at(-1), topology.laneByKey.get(connector.outgoingLaneKey).start);

    const incoming = topology.laneByKey.get(connector.incomingLaneKey);
    const outgoing = topology.laneByKey.get(connector.outgoingLaneKey);
    assert.equal(incoming.endOwnership, "unique");
    assert.equal(outgoing.startOwnership, "unique");
    assert.equal(incoming.endJunctionId, connector.junctionId);
    assert.equal(outgoing.startJunctionId, connector.junctionId);
  }
});

test("production findings are explicit instead of silently discarded", () => {
  const topology = buildTrafficLaneJunctionTopology(productionManifest);
  const diagnostics = topology.diagnostics();

  assert.equal(
    diagnostics.summary.orphanLaneCount,
    diagnostics.orphanLanes.length
  );
  assert.equal(
    diagnostics.summary.unmatchedEndpointCount,
    diagnostics.unmatchedEndpoints.length
  );
  assert.equal(
    diagnostics.summary.ambiguousEndpointCount,
    diagnostics.ambiguousEndpoints.length
  );
  assert.equal(
    diagnostics.summary.rejectedConnectorCount,
    diagnostics.rejectedConnectors.length
  );
  assert.equal(
    diagnostics.summary.tangentContinuityFailureCount,
    diagnostics.tangentContinuityFailures.length
  );

  for (const rejected of diagnostics.rejectedConnectors) {
    assert.ok(rejected.rejectionReasons.length > 0);
  }
  for (const endpoint of diagnostics.ambiguousEndpoints) {
    assert.ok(endpoint.matches.length > 1);
  }
  for (const endpoint of diagnostics.unmatchedEndpoints) {
    assert.equal(endpoint.matches.length, 0);
  }
});
