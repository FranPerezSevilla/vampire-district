import test from "node:test";
import assert from "node:assert/strict";
import { trafficFlowPopulation } from "../phaser/src/streaming/TrafficPopulationPolicy.js";
import { journeyPoint } from "../phaser/src/streaming/TrafficJourneyPlanner.js";
import { createTrafficDensityRuntime } from "./helpers/traffic-density-runtime.js";

test("civilian population follows road capacity independently of police and travel speed", () => {
  const graph = { nodes: { a: { trafficDensity: 0.6 }, b: { trafficDensity: 0.6 } } };
  const edge = { a: "a", b: "b", length: 2400, travelSeconds: 20 };
  const normal = trafficFlowPopulation(graph, edge);
  assert.ok(normal.tokenCount > 4);
  assert.equal(trafficFlowPopulation(graph, { ...edge, length: 4800 }).tokenCount, normal.tokenCount * 2);
  graph.nodes.a.policePresence = 1;
  assert.deepEqual(trafficFlowPopulation(graph, { ...edge, travelSeconds: 1 }), normal);
  graph.nodes.a.trafficDensity = graph.nodes.b.trafficDensity = 0.3;
  assert.equal(trafficFlowPopulation(graph, edge).tokenCount, normal.tokenCount / 2);
  assert.deepEqual(trafficFlowPopulation(graph, { a: "a", b: "b" }), { tokenCount: 1 });
});

// Independently sample complete recurring routes, excluding their entry legs.
// This measures planned coverage, not camera occupancy or traffic congestion.
function census(system) {
  const runtime = system.route.runtime(), topology = system.materializer.lanes.localTopology;
  const agents = runtime.agents(), districts = {}, lanes = new Set();
  for (const agent of agents) {
    const journey = runtime.driver(agent.tokenId).journey;
    assert.ok(journey.circular && journey.circuitLength >= 2000);
    for (const stage of journey.stages) if (stage.end > journey.loopStartProgress && stage.start < journey.destinationProgress) lanes.add(stage.laneId);
    for (let i = 0; i < 256; i++) {
      const stage = journeyPoint(journey, journey.loopStartProgress + (i + 0.5) / 256 * journey.circuitLength).segment.stage;
      const district = topology.lanes[stage.laneId].districtId;
      districts[district] = (districts[district] || 0) + 1 / (256 * agents.length);
    }
  }
  return { lanes: lanes.size, districts, agents };
}

const viewpoints = [
  { name: "old-quarter", center: { x: 1754, y: 1515 } },
  { name: "blackwater", center: { x: 2280, y: 3280 } },
  { name: "north-harbor", center: { x: 4440, y: 900 } }
];

test("capacity circuits increase visible traffic across streamed districts without spawning on camera or gridlocking", async t => {
  let canonicalAllocation = null, canonicalPoses = null;
  for (const [index, viewpoint] of viewpoints.entries()) {
    const metrics = [], censuses = [];
    for (const historicalPopulation of [true, false]) {
      const system = await createTrafficDensityRuntime({ center: viewpoint.center, historicalPopulation });
      try {
        assert.equal(system.city.isReady(), true);
        assert.equal(system.materializer.pool.length, 32);
        const runtime = system.route.runtime();
        const journeys = runtime.agents().map(agent => [agent.tokenId, runtime.driver(agent.tokenId).journey]);
        if (index === 0) censuses.push(census(system));
        if (!historicalPopulation) {
          const allocation = runtime.snapshot().populationAllocation;
          const poses = runtime.agents().map(agent => ({ id: agent.tokenId, x: agent.pose.x, y: agent.pose.y, lane: agent.currentLaneId }));
          if (!canonicalAllocation) { canonicalAllocation = allocation; canonicalPoses = poses; }
          else { assert.deepEqual(allocation, canonicalAllocation); assert.deepEqual(poses, canonicalPoses); }
          assert.equal(allocation.districts.length, 14);
          assert.ok(allocation.districts.every(district => district.planned > 0 && district.initiallyPlaced > 0));
          assert.equal(allocation.districts.reduce((sum, district) => sum + district.initiallyPlaced, 0), allocation.population);
        }
        system.step(1200);
        const result = system.metrics();
        metrics.push(result);
        assert.equal(result.population, historicalPopulation ? 58 : 223);
        assert.equal(result.visibleSpawns, 0);
        assert.equal(result.overlaps, 0);
        assert.equal(result.contacts, 0);
        assert.ok(result.maxStop < 15, `${viewpoint.name}: stopped ${result.maxStop}s`);
        assert.ok(result.maxNearby <= 32);
        for (const [id, journey] of journeys) assert.equal(runtime.driver(id).journey, journey, "circuits remain predefined across laps and materializations");
      } finally { system.destroy(); }
    }
    const [before, after] = metrics;
    assert.ok(after.visibleAverage > before.visibleAverage * 1.4, `${viewpoint.name}: visible traffic ${before.visibleAverage} -> ${after.visibleAverage}`);
    assert.ok(after.nearbyAverage > before.nearbyAverage * 1.5);
    assert.ok(after.emptyFraction < before.emptyFraction);
    if (index === 0) {
      const [previous, current] = censuses;
      assert.ok(current.lanes >= 400 && current.lanes > previous.lanes + 30);
      const deviation = census => canonicalAllocation.districts.reduce((sum, district) =>
        sum + Math.abs((census.districts[district.id] || 0) - district.target / canonicalAllocation.population), 0);
      assert.ok(deviation(current) < deviation(previous) * 0.5, "road-capacity district balance improves, not just total population");
      for (let a = 0; a < canonicalPoses.length; a++) for (let b = a + 1; b < canonicalPoses.length; b++) {
        assert.ok(Math.hypot(canonicalPoses[a].x - canonicalPoses[b].x, canonicalPoses[a].y - canonicalPoses[b].y) >= 40,
          "initial circuit phases do not pile cars onto the same starting point");
      }
      t.diagnostic(JSON.stringify({ coverageBefore: previous.lanes, coverageAfter: current.lanes, districtDeviationBefore: deviation(previous), districtDeviationAfter: deviation(current) }));
    }
    t.diagnostic(JSON.stringify({ district: viewpoint.name, before, after }));
  }
});
