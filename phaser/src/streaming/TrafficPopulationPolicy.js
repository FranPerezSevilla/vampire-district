import { journeyPoint, pathLength, trafficJourneyHash } from "./TrafficJourneyPlanner.js";

export const TRAFFIC_POPULATION_POLICY = "road-capacity-circuits-v1";
// World units per car at full district density, across both road directions.
const CAPACITY_SPACING = 120;

export function trafficFlowPopulation(graph, edge) {
  const density = ((graph.nodes[edge.a]?.trafficDensity || 0) + (graph.nodes[edge.b]?.trafficDensity || 0)) / 2;
  if (!(edge.length > 0)) return { tokenCount: Math.max(1, Math.round(density * 4)) };
  return { tokenCount: Math.max(1, Math.round(edge.length * 2 * density / CAPACITY_SPACING)), populationPolicy: TRAFFIC_POPULATION_POLICY };
}

// Bootstrap allocation only. This policy never changes a spawned car's route
// or pose; the driver remains the sole movement authority after initialization.
export function createTrafficCircuitAllocation({ topology, graph, planner, population }) {
  const roadWeights = new Map(), districtWeights = new Map();
  for (const lane of Object.values(topology.lanes)) {
    const weight = pathLength(lane.points) * Math.max(0.25, graph.nodes[lane.districtId]?.trafficDensity || 0.6);
    roadWeights.set(lane.sourceRoadEdgeId, (roadWeights.get(lane.sourceRoadEdgeId) || 0) + weight);
    districtWeights.set(lane.districtId, (districtWeights.get(lane.districtId) || 0) + weight);
  }
  const totalWeight = [...districtWeights.values()].reduce((sum, value) => sum + value, 0);
  for (const weights of [roadWeights, districtWeights]) for (const [id, value] of weights) weights.set(id, value / totalWeight);
  const roadLoad = new Map(), districtLoad = new Map(), initialDistricts = new Map(), initialPoses = [];
  const coveredLanes = new Set();
  const districtLanes = new Map();
  const deadEnds = new Set(Object.values(topology.transitions).filter(transition => transition.preferred && transition.uTurn)
    .map(transition => topology.lanes[transition.incomingLaneId].sourceRoadEdgeId));
  for (const lane of Object.values(topology.lanes)) {
    if (pathLength(lane.points) < 120 || deadEnds.has(lane.sourceRoadEdgeId)) continue;
    if (!districtLanes.has(lane.districtId)) districtLanes.set(lane.districtId, []);
    districtLanes.get(lane.districtId).push(lane.id);
  }
  function profile(journey) {
    const roads = new Map(), districts = new Map(), lanes = new Set();
    for (const segment of journey.segments) {
      const distance = Math.max(0, Math.min(segment.end, journey.destinationProgress) - Math.max(segment.start, journey.loopStartProgress));
      if (!distance) continue;
      const lane = topology.lanes[segment.stage.laneId], fraction = distance / journey.circuitLength;
      roads.set(lane.sourceRoadEdgeId, (roads.get(lane.sourceRoadEdgeId) || 0) + fraction);
      districts.set(lane.districtId, (districts.get(lane.districtId) || 0) + fraction);
      lanes.add(lane.id);
    }
    return { roads, districts, lanes };
  }
  function cost(contribution, load, weights) {
    // Incremental squared occupancy error against road capacity. Comparing
    // fractions of a complete circuit avoids rewarding long routes merely
    // because they mention more streets; district demand also limits bias
    // toward the densest part of the local lane graph.
    let result = 0;
    for (const [id, value] of contribution) result += (2 * (load.get(id) || 0) * value + value * value) / Math.max(0.00001, weights.get(id) || 0);
    return result;
  }
  function choose(base, tokenId) {
    if (!base.circular) return base;
    let best = null;
    const underserved = [...districtWeights].filter(([id]) => districtLanes.has(id))
      .sort((a, b) => (districtLoad.get(a[0]) || 0) / a[1] - (districtLoad.get(b[0]) || 0) / b[1]);
    for (let variant = 0; variant < 8; variant++) {
      const district = underserved[variant - 4]?.[0];
      const targets = district && districtLanes.get(district);
      const target = targets?.[trafficJourneyHash(`${tokenId}:${district}`) % targets.length];
      // Initial provenance does not pin every car to its macro connection.
      // Four alternatives can start in underserved districts before any car
      // appears; there is no runtime relocation or itinerary reassignment.
      const journey = variant === 0 ? base : planner.plan(target || base.laneIds[0], tokenId, variant);
      if (!journey.circular) continue;
      const demand = profile(journey);
      const score = cost(demand.roads, roadLoad, roadWeights) + 4 * cost(demand.districts, districtLoad, districtWeights);
      if (!best || score < best.score) best = { journey, demand, score };
    }
    for (const [load, contribution] of [[roadLoad, best.demand.roads], [districtLoad, best.demand.districts]]) {
      for (const [id, value] of contribution) load.set(id, (load.get(id) || 0) + value);
    }
    for (const id of best.demand.lanes) coveredLanes.add(id);
    return best.journey;
  }
  function initialProgress(journey, tokenId, archetype, fallback) {
    if (!journey.circular) return fallback;
    const phase = trafficJourneyHash(`${tokenId}:circuit-phase`) / 4294967296;
    let best = null;
    for (let index = 0; index < 64; index++) {
      const progress = journey.loopStartProgress + ((phase + index / 64) % 1) * journey.circuitLength;
      const point = journeyPoint(journey, progress), stage = point.segment.stage;
      const margin = archetype.width * 0.5 + 35;
      if (stage.kind !== "lane" || progress - stage.start < margin || stage.end - progress < margin) continue;
      const lane = topology.lanes[stage.laneId];
      let crowd = 0, clear = true;
      for (const other of initialPoses) {
        const distance = Math.hypot(point.x - other.x, point.y - other.y);
        if (distance < (archetype.width + other.width) * 0.5 + 12) { clear = false; break; }
        crowd += Math.max(0, 150 - distance) / 25;
      }
      if (!clear) continue;
      const score = crowd + (initialDistricts.get(lane.districtId) || 0) / Math.max(1, population * districtWeights.get(lane.districtId));
      if (!best || score < best.score) best = { progress, point, district: lane.districtId, score };
    }
    if (!best) return fallback;
    initialDistricts.set(best.district, (initialDistricts.get(best.district) || 0) + 1);
    initialPoses.push({ x: best.point.x, y: best.point.y, width: archetype.width });
    return best.progress;
  }
  function snapshot() {
    return { policy: TRAFFIC_POPULATION_POLICY, population, coveredLaneCount: coveredLanes.size, coveredRoadCount: roadLoad.size,
      estimate: "circuit-length-weighted; not measured live occupancy",
      districts: [...districtWeights].map(([id, fraction]) => ({ id, target: population * fraction, planned: districtLoad.get(id) || 0,
        initiallyPlaced: initialDistricts.get(id) || 0 })) };
  }
  return { choose, initialProgress, snapshot };
}
