import { createTrafficJourneyPlanner, journeyPoint, pathLength } from "./TrafficJourneyPlanner.js";

// Waypoints select compiler lanes, never create driveable geometry. Terminal
// turnarounds follow legal streets before returning in the opposite direction.
export const TRANSIT_LINES = Object.freeze([
  { id: "C", name: "Circular", color: 0xe3b85d, waypoints: [
    [1000, 700, 1, 0], [4300, 1000, 0, 1], [4000, 3300, -1, 0], [850, 2800, 0, -1]
  ] },
  { id: "N", name: "Norte–Sur", color: 0x71c5ad, waypoints: [
    [2300, 650, 0, 1], [2300, 1800, 0, 1], [2300, 3250, 0, 1],
    [2300, 3250, 0, -1], [2300, 1800, 0, -1], [2300, 650, 0, -1]
  ] },
  { id: "E", name: "Este–Oeste", color: 0x8dadde, waypoints: [
    [600, 1850, 1, 0], [2300, 1850, 1, 0], [4400, 1850, 1, 0],
    [4400, 1850, -1, 0], [2300, 1850, -1, 0], [600, 1850, -1, 0]
  ] }
]);

export function buildTransitRoutes(topology) {
  const curbLane = lane => lane.roadWidth >= 100 && lane.laneIndex === lane.lanesPerDirection - 1;
  const lanes = Object.values(topology.lanes).filter(lane => curbLane(lane) && pathLength(lane.points) > 180);
  if (!lanes.length) return [];
  const planner = createTrafficJourneyPlanner(topology, { laneFilter: curbLane, allowDeadEnds: true });
  return TRANSIT_LINES.map(line => {
    const waypoints = line.waypoints.map(([x, y, dx, dy]) => lanes
      .filter(lane => lane.tangent.x * dx + lane.tangent.y * dy > 0.9)
      .sort((a, b) => Math.hypot((a.start.x + a.end.x) / 2 - x, (a.start.y + a.end.y) / 2 - y)
        - Math.hypot((b.start.x + b.end.x) / 2 - x, (b.start.y + b.end.y) / 2 - y) || a.id.localeCompare(b.id))[0]?.id);
    if (waypoints.some(id => !id)) throw new Error(`Missing compiler lane for bus line ${line.id}`);
    const journey = planner.planVia(waypoints.filter((id, i) => id !== waypoints[i - 1]));
    if (!journey?.circular || journey.circuitLength < 2000) throw new Error(`Disconnected bus line ${line.id}`);
    const stops = [];
    for (const stage of journey.stages) {
      if (stage.kind !== "lane" || stage.end - stage.start < 120) continue;
      const progress = (stage.start + stage.end) / 2;
      if (progress < journey.loopStartProgress || progress >= journey.destinationProgress) continue;
      if (stops.length && progress - stops.at(-1).progress < 500) continue;
      const lane = topology.lanes[stage.laneId], point = journeyPoint(journey, progress);
      const lateral = lane.roadWidth / 2 - lane.laneOffset + 12;
      stops.push({ id: `${line.id}:${stops.length + 1}`, name: `${lane.districtId} · ${stops.length + 1}`,
        lineId: line.id, laneId: lane.id, progress, point: { x: point.x, y: point.y, angle: point.angle },
        x: point.x + lane.tangent.x * 17 - lane.tangent.y * lateral,
        y: point.y + lane.tangent.y * 17 + lane.tangent.x * lateral });
    }
    return { ...line, journey, stops };
  });
}
