import { vehicleFootprintPoints } from "../vehicles/VehicleModel.js";
import { WORLD } from "../data/balance.js";
import { orientedVehicleContact, orientedTrafficBoxContact, trafficVehicleBox } from "./TrafficPhysicalConsequencesSystem.js";

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
  function footprintOnRoad(pose, archetype) {
    const halfLength = Math.max(1, archetype.width * 0.86) / 2, halfWidth = Math.max(1, archetype.height * 0.82) / 2;
    const cos = Math.cos(pose.angle), sin = Math.sin(pose.angle);
    const xExtent = Math.abs(cos) * halfLength + Math.abs(sin) * halfWidth;
    const yExtent = Math.abs(sin) * halfLength + Math.abs(cos) * halfWidth;
    if (pose.x - xExtent < 5 || pose.x + xExtent > WORLD.width - 5 || pose.y - yExtent < 5 || pose.y + yExtent > WORLD.height - 5) return false;
    // A whole oriented body contained in one convex road rectangle also
    // contains every edge/interior footprint sample. Junction unions retain
    // the original nine-point check when no single rectangle contains it.
    for (const road of cells.get(cellKey(pose.x, pose.y)) || []) {
      const dx = pose.x - road.x, dy = pose.y - road.y;
      const along = dx * road.ux + dy * road.uy, across = -dx * road.uy + dy * road.ux;
      const forward = cos * road.ux + sin * road.uy, sideways = -sin * road.ux + cos * road.uy;
      const alongExtent = Math.abs(forward) * halfLength + Math.abs(sideways) * halfWidth;
      const acrossExtent = Math.abs(sideways) * halfLength + Math.abs(forward) * halfWidth;
      if (along - alongExtent >= -road.half && along + alongExtent <= road.length + road.half
        && Math.abs(across) + acrossExtent <= road.half) return true;
    }
    return vehicleFootprintPoints(pose, { width: archetype.width * 0.86, height: archetype.height * 0.82 }).every(onRoad);
  }
  const dynamicCells = new Map(), indexed = new Map(), boxes = new WeakMap(), buildingBodies = new WeakMap();
  let prepared = false;
  function indexObject(object, order) {
    const key = cellKey(object.x, object.y), prior = indexed.get(object);
    if (prior?.key === key) return;
    if (prior) dynamicCells.get(prior.key)?.delete(object);
    if (!dynamicCells.has(key)) dynamicCells.set(key, new Set());
    dynamicCells.get(key).add(object); indexed.set(object, { key, order: prior?.order ?? order });
  }
  function prepare() {
    dynamicCells.clear(); indexed.clear(); prepared = true;
    const scene = materializer.scene;
    let order = 0;
    for (const object of materializer.assignments.values()) indexObject(object, order++);
    for (const object of scene.vehicleSystem?.vehicles || []) indexObject(object, order++);
    if (scene.player && !scene.vehicleSystem?.isDriving?.() && !scene.transitSystem?.isRiding?.()) {
      indexObject({ id: "player", x: scene.player.x, y: scene.player.y, angle: 0, archetype: { width: 16, height: 16 } }, order++);
    }
  }
  function obstacles(driver, radius = 240) {
    if (!prepared) prepare();
    const nearby = [], x = driver.pose.x, y = driver.pose.y;
    for (let cx = Math.floor((x - radius) / 128); cx <= Math.floor((x + radius) / 128); cx++) {
      for (let cy = Math.floor((y - radius) / 128); cy <= Math.floor((y + radius) / 128); cy++) {
        for (const object of dynamicCells.get(`${cx}:${cy}`) || []) {
          if (object.tokenId !== driver.tokenId && object.container?.active !== false
            && (object.x - x) ** 2 + (object.y - y) ** 2 < radius ** 2) nearby.push(object);
        }
      }
    }
    // Preserve the former first-blocker order, including authored obstacles.
    nearby.sort((a, b) => indexed.get(a).order - indexed.get(b).order);
    const buildings = materializer.scene?.trafficPhysicalConsequencesSystem?.nearbyBuildings?.(x, y, radius) || [];
    for (const building of buildings) {
      const width = building.w || building.width, height = building.h || building.height;
      let body = buildingBodies.get(building);
      if (!body || body.sourceX !== building.x || body.sourceY !== building.y || body.width !== width || body.height !== height) {
        body = { sourceX: building.x, sourceY: building.y, width, height,
          id: building.id || "building", x: building.x + width / 2, y: building.y + height / 2,
          angle: 0, archetype: { width: width / 0.86, height: height / 0.82 } };
        buildingBodies.set(building, body);
      }
      nearby.push(body);
    }
    return nearby;
  }
  function boxFor(object) {
    let cached = boxes.get(object);
    const width = object.archetype?.width, height = object.archetype?.height;
    if (!cached || cached.x !== object.x || cached.y !== object.y || cached.angle !== object.angle || cached.width !== width || cached.height !== height) {
      cached = { x: object.x, y: object.y, angle: object.angle, width, height, box: trafficVehicleBox(object) };
      boxes.set(object, cached);
    }
    return cached.box;
  }
  function blocker(driver, pose, objects, margin = 1.5, previous = null) {
    const proxy = { x: pose.x, y: pose.y, angle: pose.angle,
      archetype: { width: driver.archetype.width + margin * 2, height: driver.archetype.height + margin * 2 } };
    let candidateBox = null;
    if (!footprintOnRoad(pose, driver.archetype)) {
      return { id: "road-edge" };
    }
    for (const other of objects) {
      const reach = (driver.archetype.width + (other.archetype?.width || 30)) * 0.6 + margin + 4;
      if (Math.abs(pose.x - other.x) > reach || Math.abs(pose.y - other.y) > reach) continue;
      candidateBox ||= trafficVehicleBox(proxy);
      if (!orientedTrafficBoxContact(candidateBox, boxFor(other))) continue;
      // An existing contact may be unwound by driving away. Never allow a new
      // contact, deeper penetration, or movement through the other body.
      const before = previous && orientedVehicleContact({ ...previous, archetype: driver.archetype }, other);
      if (before) {
        const after = orientedVehicleContact({ ...pose, archetype: driver.archetype }, other);
        const separating = (pose.x - previous.x) * before.normal.x + (pose.y - previous.y) * before.normal.y < -1e-7;
        if (separating && (!after || after.overlap < before.overlap - 1e-7)) continue;
      }
      return other;
    }
    return null;
  }
  return { onRoad, footprintOnRoad, prepare, update: object => { if (prepared) indexObject(object, indexed.size); }, obstacles, blocker };
}
