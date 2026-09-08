import test from "node:test";
import assert from "node:assert/strict";

import { cityRoadGraph } from "../tools/city-compiler/city-road-graph-v1.js";
import { currentCityBlueprint } from "../tools/city-compiler/current-city.js";
import { buildDistrictStreamingFileSet } from "../tools/city-compiler/district-streaming.js";
import { buildCompilerTrafficLaneTopology } from "../tools/city-compiler/traffic-lane-topology.js";
import {
  buildCompilerTrafficJunctionConnectors,
  validateCompilerTrafficJunctionConnectors
} from "../tools/city-compiler/traffic-junction-connectors.js";

function productionConnectors() {
  const streaming = buildDistrictStreamingFileSet({
    blueprint: currentCityBlueprint,
    roadGraph: cityRoadGraph
  });
  const topology = buildCompilerTrafficLaneTopology(streaming.network);
  const connectors = buildCompilerTrafficJunctionConnectors(topology, streaming.roadSurfaces);
  return { streaming, topology, connectors };
}

test("preferred compiler transitions receive either a safe connector or an exact direct handoff", () => {
  const { topology, connectors } = productionConnectors();
  const preferred = topology.transitionIds
    .map(id => topology.transitions[id])
    .filter(transition => transition.preferred);

  assert.equal(
    connectors.stats.connectorCount + connectors.stats.directHandoffCount,
    preferred.length
  );
  assert.equal(connectors.stats.rejectedConnectorCount, 0);
  assert.equal(connectors.stats.outsideRoadConnectorCount, 0);
  assert.equal(connectors.stats.tangentFailureCount, 0);

  const validation = validateCompilerTrafficJunctionConnectors(connectors, topology);
  assert.equal(validation.valid, true, validation.errors.join("\n"));
});

test("every connector preserves exact lane endpoints and compiler-node ownership", () => {
  const { topology, connectors } = productionConnectors();

  for (const connector of Object.values(connectors.connectors)) {
    const incoming = topology.lanes[connector.incomingLaneId];
    const outgoing = topology.lanes[connector.outgoingLaneId];
    const transition = topology.transitions[connector.transitionId];

    assert.deepEqual(connector.points[0], incoming.end, connector.id);
    assert.deepEqual(connector.points.at(-1), outgoing.start, connector.id);
    assert.equal(incoming.toNodeId, connector.nodeId, connector.id);
    assert.equal(outgoing.fromNodeId, connector.nodeId, connector.id);
    assert.equal(transition.nodeId, connector.nodeId, connector.id);
    assert.equal(connector.activationSafe, true, `${connector.id}: ${connector.rejectionReasons.join(",")}`);
  }
});

test("sampled connector headings respect incoming and outgoing lane tangents", () => {
  const { connectors } = productionConnectors();

  for (const connector of Object.values(connectors.connectors)) {
    assert.ok(
      connector.startTangentGap <= connector.tangentTolerance,
      `${connector.id} incoming tangent gap ${connector.startTangentGap}`
    );
    assert.ok(
      connector.endTangentGap <= connector.tangentTolerance,
      `${connector.id} outgoing tangent gap ${connector.endTangentGap}`
    );
  }
});

test("connector generation is deterministic", () => {
  const streaming = buildDistrictStreamingFileSet({
    blueprint: currentCityBlueprint,
    roadGraph: cityRoadGraph
  });
  const topology = buildCompilerTrafficLaneTopology(streaming.network);
  const first = buildCompilerTrafficJunctionConnectors(topology, streaming.roadSurfaces);
  const second = buildCompilerTrafficJunctionConnectors(topology, streaming.roadSurfaces);

  assert.deepEqual(first, second);
  assert.doesNotThrow(() => JSON.stringify(first));
  assert.equal(new Set(first.connectorIds).size, first.connectorIds.length);
});
