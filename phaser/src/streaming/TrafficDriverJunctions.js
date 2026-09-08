import { journeyPoint } from "./TrafficJourneyPlanner.js";
import { orientedVehicleContact } from "./TrafficPhysicalConsequencesSystem.js";

// A permit reserves a path, including short links and the downstream space for
// the entire car. It never advances, positions or rotates the driver.
export function createTrafficDriverJunctions(topology) {
  const permits = new Map();
  const sections = new WeakMap();
  const arrivals = new Map();
  const nodes = new Map();
  for (const lane of Object.values(topology.lanes)) {
    const first = lane.points[0], last = lane.points.at(-1);
    const angle = Math.atan2(last.y - first.y, last.x - first.x), ux = Math.cos(angle), uy = Math.sin(angle);
    for (const [id, point, trim] of [[lane.fromNodeId, first, -(lane.startNodeTrim || 0)], [lane.toNodeId, last, lane.endNodeTrim || 0]]) {
      const radius = Math.max(nodes.get(id)?.radius || 0, (lane.roadWidth || 52) / 2 + 3);
      nodes.set(id, { x: point.x + ux * trim + uy * (lane.laneOffset || 0),
        y: point.y + uy * trim - ux * (lane.laneOffset || 0), radius });
    }
  }
  let admissions = 0, denials = 0;
  function upcoming(driver) {
    if (sections.has(driver.journey)) return sections.get(driver.journey).find(section => section.exit + 8 >= driver.progress) || null;
    const stages = driver.journey.stages;
    const result = [];
    for (let index = 0; index < stages.length; index++) {
      if (stages[index].kind !== "connector") continue;
      const first = stages[index], nodeIds = new Set([first.nodeId]);
      const entryPoint = journeyPoint(driver.journey, first.start);
      const entryNode = nodes.get(first.nodeId);
      const entryTrim = entryNode ? (entryNode.x - entryPoint.x) * Math.cos(entryPoint.angle)
        + (entryNode.y - entryPoint.y) * Math.sin(entryPoint.angle) : 0;
      const entry = first.start - Math.max(0, (entryNode?.radius || 0) - entryTrim);
      let end = first.end;
      while (index + 1 < stages.length - 1) {
        const next = stages[index + 1];
        if (next.kind === "lane" && next.end - next.start > 64) break;
        index++; end = next.end;
        if (next.nodeId) nodeIds.add(next.nodeId);
      }
      const exitPoint = journeyPoint(driver.journey, end + 0.001);
      const exitNode = nodes.get([...nodeIds].at(-1));
      const exitTrim = exitNode ? (exitPoint.x - exitNode.x) * Math.cos(exitPoint.angle)
        + (exitPoint.y - exitNode.y) * Math.sin(exitPoint.angle) : 0;
      const exit = Math.min(driver.journey.length, end + Math.max(0, (exitNode?.radius || 0) - exitTrim) + driver.archetype.width * 0.5 + 10);
      result.push({ key: `${driver.tokenId}:${driver.journey.trip}:${index}`, start: first.start, entry, end, exit, nodeIds });
    }
    sections.set(driver.journey, result);
    return result.find(section => section.exit + 8 >= driver.progress) || null;
  }
  function path(driver, section) {
    const points = [];
    for (let s = Math.max(driver.progress, section.start - driver.archetype.width / 2); s < section.exit; s += 10) {
      points.push({ ...journeyPoint(driver.journey, s), archetype: { ...driver.archetype, width: driver.archetype.width + 8, height: driver.archetype.height + 12 } });
    }
    points.push({ ...journeyPoint(driver.journey, section.exit), archetype: driver.archetype });
    return points;
  }
  function overlaps(left, right) {
    return left.some(a => right.some(b => Math.hypot(a.x - b.x, a.y - b.y) < 62 && orientedVehicleContact(a, b)));
  }
  function prepare(drivers, slots, now = 0) {
    const active = new Map(drivers.map(driver => [driver.tokenId, driver]));
    for (const [id, permit] of permits) {
      const driver = active.get(id);
      if (!driver || driver.journey !== permit.journey || driver.progress > permit.exit + 8
        || (driver.wait > 2 && driver.pose.speed < 2 && driver.progress < permit.entry - driver.archetype.width * 0.43 - 2)) permits.delete(id);
    }
    const requests = drivers.map(driver => ({ driver, section: upcoming(driver) }))
      .filter(({ driver, section }) => section && section.entry - driver.progress < 110 && !permits.has(driver.tokenId))
      .map(request => {
        if (!arrivals.has(request.section.key)) arrivals.set(request.section.key, now);
        return request;
      })
      .sort((a, b) => arrivals.get(a.section.key) - arrivals.get(b.section.key)
        || (a.section.entry - a.driver.progress) - (b.section.entry - b.driver.progress)
        || a.driver.tokenId.localeCompare(b.driver.tokenId));
    const waitingKeys = new Set(requests.map(request => request.section.key));
    for (const key of arrivals.keys()) if (!waitingKeys.has(key)) arrivals.delete(key);
    for (const { driver, section } of requests) {
      const points = path(driver, section);
      const conflict = [...permits.values()].some(permit => overlaps(points, permit.points));
      // Vehicles already inside must clear the crossing. Before entry, require
      // an unoccupied downstream body, so a queue cannot fill the crossing.
      const exitBlocked = driver.progress < section.start && slots.some(slot => slot.tokenId !== driver.tokenId
        && orientedVehicleContact(points.at(-1), slot));
      if (conflict || exitBlocked) { denials++; continue; }
      permits.set(driver.tokenId, { ...section, journey: driver.journey, points }); admissions++;
    }
  }
  function stopDistance(driver) {
    const section = upcoming(driver);
    if (!section || permits.has(driver.tokenId)) return Infinity;
    return Math.max(0, section.entry - driver.progress - driver.archetype.width * 0.43 - 5);
  }
  return {
    prepare, stopDistance,
    maneuverAllowed: driver => { const section = upcoming(driver); return !section || section.start - driver.progress > 140; },
    snapshot: () => ({ active: true, authority: "driver-path-permission", activePermitCount: permits.size, admissions, admissionDenials: denials,
      permits: [...permits].map(([tokenId, permit]) => ({ tokenId, start: permit.start, exit: permit.exit })) }),
    clear() { permits.clear(); arrivals.clear(); }
  };
}
