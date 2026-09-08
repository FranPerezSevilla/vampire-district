import test from "node:test";
import assert from "node:assert/strict";
import { trafficFlowPopulation } from "../phaser/src/streaming/TrafficPopulationPolicy.js";
import { orientedVehicleContact } from "../phaser/src/streaming/TrafficPhysicalConsequencesSystem.js";
import { createTrafficDriverWorld } from "../phaser/src/streaming/TrafficDriverWorld.js";
import { readFileSync } from "node:fs";
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
  const agents = runtime.agents().filter(agent => agent.pose.archetypeId !== "bus"), districts = {}, lanes = new Set();
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
  return { lanes: lanes.size, laneIds: lanes, districts, agents };
}

const viewpoints = [
  { name: "old-quarter", center: { x: 1800, y: 1515 } },
  { name: "blackwater", center: { x: 2265, y: 3280 } },
  { name: "north-harbor", center: { x: 4420, y: 880 } }
];

test("1,000 cars cover both avenue lanes and all districts, with bounded local traffic and recovering queues", async t => {
  let canonicalPoses = null;
  for (const viewpoint of viewpoints) {
    const system = await createTrafficDensityRuntime({ center: viewpoint.center, transit: true });
    try {
      assert.equal(system.city.isReady(), true);
      assert.equal(system.materializer.pool.length, 64);
      assert.equal(createTrafficDriverWorld(system.materializer.lanes.localTopology, system.materializer).onRoad(system.scene.player), false,
        "measure ordinary circulation from the sidewalk; blocked-player manoeuvres have separate physical regressions");
      const runtime = system.route.runtime(), allocation = runtime.snapshot().populationAllocation;
      const poses = runtime.agents().filter(agent => agent.pose.archetypeId !== "bus").map(agent => ({ id: agent.tokenId, ...agent.pose,
        archetype: runtime.driver(agent.tokenId).archetype }));
      if (!canonicalPoses) {
        canonicalPoses = poses;
        const coverage = census(system);

        const topology = system.materializer.lanes.localTopology;
        const used = coverage.laneIds;
        const deadEnds = new Set(Object.values(topology.transitions).filter(t => t.preferred && t.uTurn)
          .map(t => topology.lanes[t.incomingLaneId].sourceRoadEdgeId));
        const through = Object.values(topology.lanes).filter(lane => !deadEnds.has(lane.sourceRoadEdgeId));
        assert.ok(coverage.lanes >= through.length * 0.96);
        assert.ok([...used].every(id => !deadEnds.has(topology.lanes[id].sourceRoadEdgeId)),
          "recurring civilian circuits cannot use cul-de-sacs as lane-switch shortcuts");
        for (const direction of ["forward", "reverse"]) for (const laneIndex of [0, 1]) {
          assert.ok([...used].filter(id => topology.lanes[id].direction === direction
            && topology.lanes[id].roadWidth >= 100 && topology.lanes[id].laneIndex === laneIndex).length >= 90);
        }
        const deviation = allocation.districts.reduce((sum, district) => sum
          + Math.abs((coverage.districts[district.id] || 0) - district.target / allocation.population), 0);
        assert.ok(deviation < 0.12);
        for (let a = 0; a < poses.length; a++) for (let b = a + 1; b < poses.length; b++) {
          if (Math.hypot(poses[a].x - poses[b].x, poses[a].y - poses[b].y) < 70)
            assert.equal(Boolean(orientedVehicleContact(poses[a], poses[b])), false, "initial physical bodies fit, including parallel avenue lanes");
        }
        t.diagnostic(JSON.stringify({ coverage: coverage.lanes, deviation }));
      } else assert.deepEqual(poses, canonicalPoses, "camera position does not change the city population");
      assert.equal(allocation.population, 1000);
      assert.equal(allocation.districts.length, 14);
      assert.ok(allocation.districts.every(district => district.planned > 0 && district.initiallyPlaced > 0));
      system.step(3600);
      const result = system.metrics({ recoveryGrace: 60 });
      assert.equal(result.population, 1006);
      assert.equal(runtime.snapshot().serviceVehicleCount, 6);
      assert.equal(runtime.snapshot().populationConserved, true);
      assert.equal(result.visibleSpawns, 0); assert.equal(result.overlaps, 0); assert.equal(result.contacts, 0);
      assert.ok(result.visibleAverage > (viewpoint.name === "old-quarter" ? 5 : 12));
      assert.ok(result.maxNearby <= 64);
      // At this demand legitimate queues last longer than the former 437-car
      // baseline. A full minute without recovery is a deadlock, not progress.
      assert.ok(result.maxStop < 60, `${viewpoint.name}: stopped ${result.maxStop}s`);
      assert.equal(result.unresolvedLongStops, 0, `${viewpoint.name}: an old queue never recovered`);
      t.diagnostic(JSON.stringify({ district: viewpoint.name, ...result }));
    } finally { system.destroy(); }
  }
});

test("largest-remainder allocation conserves exactly 1,000 identities across the macro graph", () => {
  const graph = JSON.parse(readFileSync(new URL("../phaser/assets/city/packs/macro-graph.json", import.meta.url)));
  const counts = graph.edgeIds.map(id => trafficFlowPopulation(graph, graph.edges[id]).tokenCount);
  assert.equal(counts.reduce((a, b) => a + b, 0), 1000);
  assert.ok(counts.every(count => count > 0));
  const before = [...counts];
  for (const edge of Object.values(graph.edges)) edge.travelSeconds = 0.01;
  assert.deepEqual(graph.edgeIds.map(id => trafficFlowPopulation(graph, graph.edges[id]).tokenCount), before);
});
