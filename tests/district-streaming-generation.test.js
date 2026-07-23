import test from "node:test";
import assert from "node:assert/strict";

import { currentCityBlueprint } from "../tools/city-compiler/current-city.js";
import { cityRoadGraph } from "../tools/city-compiler/city-road-graph-v1.js";
import {
  buildDistrictStreamingFileSet,
  validateDistrictStreamingFileSet
} from "../tools/city-compiler/district-streaming.js";

function generated() {
  return buildDistrictStreamingFileSet({
    blueprint: currentCityBlueprint,
    roadGraph: cityRoadGraph
  });
}

test("district streaming is generated for all fourteen City Topology V2 districts", () => {
  const fileSet = generated();
  const districtIds = currentCityBlueprint.districts.map(district => district.id);

  assert.deepEqual(fileSet.manifest.packIds, districtIds);
  assert.equal(fileSet.manifest.packIds.length, 14);
  assert.deepEqual(fileSet.manifest.world, { width: 4800, height: 3600 });
  assert.equal(fileSet.manifest.chunkSize, 512);

  for (const district of currentCityBlueprint.districts) {
    const record = fileSet.manifest.packs[district.id];
    const profile = fileSet.profiles[district.id];
    assert.ok(record);
    assert.ok(profile);
    assert.deepEqual(record.bounds, district.bounds);
    assert.ok(record.chunkIds.length > 0);
    assert.equal(profile.id, district.id);
    assert.equal(profile.name, district.name);
    assert.ok(profile.simulation.trafficDensity >= 0);
    assert.ok(profile.simulation.policePresence >= 0);
  }
});

test("macro navigation and traffic lanes are derived from the authoritative road graph", () => {
  const fileSet = generated();
  const validation = validateDistrictStreamingFileSet(fileSet);

  assert.equal(validation.valid, true, validation.errors.join("\n"));
  assert.equal(validation.metrics.macroNodes, 14);
  assert.equal(validation.metrics.macroEdges, 24);
  assert.equal(validation.metrics.trafficLaneEdges, validation.metrics.macroEdges);
  assert.ok(validation.metrics.trafficJunctions >= 60);
  assert.ok(validation.metrics.networkNodes > cityRoadGraph.nodes.length);
  assert.ok(validation.metrics.networkSegments > cityRoadGraph.edges.length);

  for (const edgeId of fileSet.macroGraph.edgeIds) {
    const edge = fileSet.macroGraph.edges[edgeId];
    const lane = fileSet.trafficLanes.edges[edgeId];
    assert.ok(fileSet.macroGraph.nodes[edge.a].neighbours.includes(edge.b));
    assert.ok(fileSet.macroGraph.nodes[edge.b].neighbours.includes(edge.a));
    assert.ok(edge.sourceRoadEdgeIds.length > 0);
    assert.ok(lane.forward.length >= 2);
    assert.ok(lane.reverse.length >= 2);
    assert.ok(lane.centerline.length >= 2);
    assert.ok(lane.laneOffset >= 8 && lane.laneOffset <= 16);
  }
});

test("district streaming generation is deterministic", () => {
  const first = generated();
  const second = generated();

  assert.deepEqual(first.manifest, second.manifest);
  assert.deepEqual(first.profiles, second.profiles);
  assert.deepEqual(first.macroGraph, second.macroGraph);
  assert.deepEqual(first.trafficLanes, second.trafficLanes);
});
