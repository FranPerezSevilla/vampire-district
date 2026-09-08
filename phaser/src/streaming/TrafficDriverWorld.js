import { vehicleFootprintPoints } from "../vehicles/VehicleModel.js";
import { WORLD } from "../data/balance.js";
import { orientedVehicleContact } from "./TrafficPhysicalConsequencesSystem.js";

export function createTrafficDriverWorld(topology, materializer) {
  const cells = new Map(), seen = new Set();
  const cellKey = (x, y) => `${Math.floor(x / 128)}:${Math.floor(y / 128)}`;
  for (const lane of Object.values(topology.lanes)) {
    if (seen.has(lane.sourceSegmentId || lane.id)) continue;
    seen.add(lane.sourceSegmentId || lane.id);
    const first = lane.points[0], last = lane.points.at(-1);
    const angle = Math.atan2(last.y - first.y, last.x - first.x);
    const ux = Math.cos(angle), uy = Math.sin(angle), offset = lane.laneOffset || 0;
    const startTrim = lane.startNodeTrim || 0, endTrim = lane.endNodeTrim || 0;
    const x = first.x + uy * offset - ux * startTrim;
    const y = first.y - ux * offset - uy * startTrim;
    const endX = last.x + uy * offset + ux * endTrim;
    const endY = last.y - ux * offset + uy * endTrim;
    const road = { x, y, ux, uy, length: Math.hypot(endX - x, endY - y), half: (lane.roadWidth || 52) / 2 - 1.5 };
    for (let cx = Math.floor((Math.min(x, endX) - road.half) / 128); cx <= Math.floor((Math.max(x, endX) + road.half) / 128); cx++) {
      for (let cy = Math.floor((Math.min(y, endY) - road.half) / 128); cy <= Math.floor((Math.max(y, endY) + road.half) / 128); cy++) {
        const key = `${cx}:${cy}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(road);
      }
    }
  }
  function onRoad(point) {
    if (point.x < 5 || point.y < 5 || point.x > WORLD.width - 5 || point.y > WORLD.height - 5) return false;
    return (cells.get(cellKey(point.x, point.y)) || []).some(road => {
      const dx = point.x - road.x, dy = point.y - road.y;
      const along = dx * road.ux + dy * road.uy;
      return along >= -road.half && along <= road.length + road.half
        && Math.abs(-dx * road.uy + dy * road.ux) <= road.half;
    });
  }
  function obstacles(driver, radius = 240) {
    const scene = materializer?.scene;
    const all = [...(materializer?.assignments?.values() || []), ...(scene?.vehicleSystem?.vehicles || [])];
    if (scene?.player && !scene.vehicleSystem?.isDriving?.()) {
      all.push({ ...scene.player, id: "player", archetype: { width: 16, height: 16 }, angle: 0 });
    }
    const nearby = all.filter(other => other.tokenId !== driver.tokenId && other.container?.active !== false
      && Math.hypot(other.x - driver.pose.x, other.y - driver.pose.y) < radius);
    const buildings = scene?.trafficPhysicalConsequencesSystem?.nearbyBuildings?.(driver.pose.x, driver.pose.y, radius) || [];
    for (const building of buildings) nearby.push({
      id: building.id || "building", x: building.x + (building.w || building.width) / 2,
      y: building.y + (building.h || building.height) / 2, angle: 0,
      archetype: { width: (building.w || building.width) / 0.86, height: (building.h || building.height) / 0.82 }
    });
    return nearby;
  }
  function blocker(driver, pose, objects, margin = 1.5) {
    const proxy = { ...pose, archetype: { ...driver.archetype, width: driver.archetype.width + margin * 2, height: driver.archetype.height + margin * 2 } };
    if (!vehicleFootprintPoints(pose, { width: driver.archetype.width * 0.86, height: driver.archetype.height * 0.82 }).every(onRoad)) {
      return { id: "road-edge" };
    }
    for (const other of objects) {
      const reach = (driver.archetype.width + (other.archetype?.width || 30)) * 0.6 + margin + 4;
      if (Math.abs(pose.x - other.x) > reach || Math.abs(pose.y - other.y) > reach) continue;
      if (orientedVehicleContact(proxy, other)) return other;
    }
    return null;
  }
  return { onRoad, obstacles, blocker };
}
