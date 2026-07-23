import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { pointInSurface, sampleSegment } from "./geometry.js";
import {
  chunkIdsForBounds,
  DEFAULT_CITY_CHUNK_SIZE
} from "../../phaser/src/streaming/CityChunkManifest.js";

const EPSILON = 0.001;
const ROAD_CLASS_PRIORITY = Object.freeze({ alley: 1, local: 2, major: 3 });
const ROAD_CLASS_COST = Object.freeze({ alley: 1.35, local: 1, major: 0.78 });

const DISTRICT_PROFILES = Object.freeze({
  "hospital-district": {
    visual: { paletteFamily: "clinical-amber", fog: 0.2, lightWarmth: 0.7, signage: "hospital-wayfinding", wetStreetReflection: 0.42 },
    audio: { ambientId: "hospital-night", gain: 0.58, layers: ["ventilation-hum", "distant-sirens", "ambulance-bay"] },
    simulation: { pedestrianDensity: 0.82, trafficDensity: 0.64, policePresence: 0.76, nightlife: 0.12 },
    identityTags: ["hospital", "civic", "emergency", "campus"]
  },
  "civic-center": {
    visual: { paletteFamily: "civic-gold", fog: 0.16, lightWarmth: 0.68, signage: "civic-formal", wetStreetReflection: 0.46 },
    audio: { ambientId: "civic-centre-night", gain: 0.56, layers: ["office-hum", "distant-sirens", "medium-traffic"] },
    simulation: { pedestrianDensity: 0.9, trafficDensity: 0.7, policePresence: 0.92, nightlife: 0.34 },
    identityTags: ["civic", "police", "city-hall", "formal"]
  },
  "cathedral-hill": {
    visual: { paletteFamily: "gothic-violet", fog: 0.27, lightWarmth: 0.58, signage: "religious-heritage", wetStreetReflection: 0.36 },
    audio: { ambientId: "cathedral-hill-night", gain: 0.52, layers: ["distant-bells", "hill-wind", "sparse-traffic"] },
    simulation: { pedestrianDensity: 0.7, trafficDensity: 0.44, policePresence: 0.58, nightlife: 0.28 },
    identityTags: ["cathedral", "heritage", "rooftops", "quiet"]
  },
  "north-harbor": {
    visual: { paletteFamily: "cold-teal", fog: 0.36, lightWarmth: 0.24, signage: "port-authority", wetStreetReflection: 0.58 },
    audio: { ambientId: "north-harbor-approach", gain: 0.64, layers: ["ship-horns", "chain-rattle", "coastal-wind"] },
    simulation: { pedestrianDensity: 0.46, trafficDensity: 0.74, policePresence: 0.64, nightlife: 0.2 },
    identityTags: ["harbor", "registry", "checkpoint", "windy"]
  },
  "west-market": {
    visual: { paletteFamily: "market-amber", fog: 0.18, lightWarmth: 0.64, signage: "market-handpainted", wetStreetReflection: 0.56 },
    audio: { ambientId: "west-market-closing", gain: 0.58, layers: ["market-shutters", "distant-radio", "local-traffic"] },
    simulation: { pedestrianDensity: 1.02, trafficDensity: 0.5, policePresence: 0.4, nightlife: 0.58 },
    identityTags: ["market", "mixed-use", "alleys", "crowded"]
  },
  "old-quarter": {
    visual: { paletteFamily: "gothic-violet", fog: 0.22, lightWarmth: 0.62, signage: "heritage-neon", wetStreetReflection: 0.34 },
    audio: { ambientId: "old-quarter-night", gain: 0.55, layers: ["distant-bells", "roof-wind", "low-traffic"] },
    simulation: { pedestrianDensity: 0.9, trafficDensity: 0.42, policePresence: 0.68, nightlife: 0.72 },
    identityTags: ["heritage", "nightlife", "rooftops", "alleys"]
  },
  glasshouse: {
    visual: { paletteFamily: "neon-plum", fog: 0.12, lightWarmth: 0.38, signage: "commercial-neon", wetStreetReflection: 0.72 },
    audio: { ambientId: "glasshouse-after-hours", gain: 0.62, layers: ["club-bass", "electric-hum", "dense-traffic"] },
    simulation: { pedestrianDensity: 1.18, trafficDensity: 0.82, policePresence: 0.52, nightlife: 1 },
    identityTags: ["nightlife", "commercial", "neon", "crowded"]
  },
  "university-district": {
    visual: { paletteFamily: "academic-blue", fog: 0.2, lightWarmth: 0.5, signage: "campus-wayfinding", wetStreetReflection: 0.5 },
    audio: { ambientId: "university-after-hours", gain: 0.5, layers: ["courtyard-wind", "distant-students", "light-traffic"] },
    simulation: { pedestrianDensity: 0.88, trafficDensity: 0.48, policePresence: 0.42, nightlife: 0.46 },
    identityTags: ["university", "campus", "courtyards", "rooftops"]
  },
  "canal-west": {
    visual: { paletteFamily: "moss-blue", fog: 0.26, lightWarmth: 0.48, signage: "residential-faded", wetStreetReflection: 0.64 },
    audio: { ambientId: "canal-west-residential", gain: 0.48, layers: ["water-flow", "distant-radio", "sparse-traffic"] },
    simulation: { pedestrianDensity: 0.78, trafficDensity: 0.38, policePresence: 0.28, nightlife: 0.32 },
    identityTags: ["canal", "residential", "quiet", "dark-routes"]
  },
  foundry: {
    visual: { paletteFamily: "iron-amber", fog: 0.3, lightWarmth: 0.76, signage: "industrial-stencil", wetStreetReflection: 0.24 },
    audio: { ambientId: "foundry-night", gain: 0.68, layers: ["machinery-rumble", "steam-release", "freight-metal"] },
    simulation: { pedestrianDensity: 0.58, trafficDensity: 0.66, policePresence: 0.34, nightlife: 0.16 },
    identityTags: ["industrial", "maze", "rooftops", "service-lanes"]
  },
  "canal-east": {
    visual: { paletteFamily: "canal-magenta", fog: 0.2, lightWarmth: 0.44, signage: "mixed-market", wetStreetReflection: 0.7 },
    audio: { ambientId: "canal-east-market", gain: 0.56, layers: ["water-flow", "market-shutters", "medium-traffic"] },
    simulation: { pedestrianDensity: 0.96, trafficDensity: 0.62, policePresence: 0.4, nightlife: 0.56 },
    identityTags: ["canal", "mixed-use", "market", "crossroads"]
  },
  "harbor-north": {
    visual: { paletteFamily: "cold-teal", fog: 0.38, lightWarmth: 0.22, signage: "port-warehouse", wetStreetReflection: 0.56 },
    audio: { ambientId: "harbor-north-logistics", gain: 0.66, layers: ["ship-horns", "forklifts", "coastal-wind"] },
    simulation: { pedestrianDensity: 0.4, trafficDensity: 0.76, policePresence: 0.48, nightlife: 0.12 },
    identityTags: ["harbor", "warehouses", "freight", "windy"]
  },
  blackwater: {
    visual: { paletteFamily: "oil-blue", fog: 0.34, lightWarmth: 0.3, signage: "freight-terminal", wetStreetReflection: 0.4 },
    audio: { ambientId: "blackwater-terminal", gain: 0.72, layers: ["generator-drone", "freight-brakes", "low-river"] },
    simulation: { pedestrianDensity: 0.34, trafficDensity: 0.78, policePresence: 0.46, nightlife: 0.08 },
    identityTags: ["industrial", "terminal", "freight", "isolated"]
  },
  "harbor-south": {
    visual: { paletteFamily: "deep-cyan", fog: 0.42, lightWarmth: 0.18, signage: "warehouse-numbers", wetStreetReflection: 0.52 },
    audio: { ambientId: "south-harbor-logistics", gain: 0.7, layers: ["container-cranes", "ship-horns", "heavy-trucks"] },
    simulation: { pedestrianDensity: 0.3, trafficDensity: 0.86, policePresence: 0.38, nightlife: 0.06 },
    identityTags: ["harbor", "logistics", "warehouses", "remote"]
  }
});

const TRAFFIC_DEFAULTS = Object.freeze({ maxActiveVehicles: 10, materializeRadius: 620, despawnRadius: 760 });
const TRAFFIC_BEHAVIOR = Object.freeze({
  followDistance: 78,
  hardStopDistance: 34,
  playerLookAhead: 132,
  laneTolerance: 38,
  accelerationRate: 1.35,
  brakingRate: 5.8,
  catchUpSpeed: 1.24,
  junctionApproachDistance: 82,
  junctionRadius: 30
});
const TRAFFIC_PHYSICS = Object.freeze({
  maxPushStep: 16,
  maxOffset: 44,
  offsetRecoveryRate: 24,
  pushHoldSeconds: 0.16,
  blockedHoldSeconds: 0.55,
  playerSpeedRetention: 0.78,
  collisionPadding: 2
});
const TRAFFIC_IMPACTS = Object.freeze({
  hardThreshold: 125,
  severeThreshold: 210,
  damageThreshold: 105,
  damageScale: 0.018,
  hardMinimumDamage: 4,
  severeMinimumDamage: 16,
  severeDamageMultiplier: 1.35,
  hardExposure: 2,
  severeExposure: 5,
  maximumExposure: 7,
  hardHeatMinimum: 7,
  severeHeatMinimum: 15,
  maximumHeat: 24,
  impactCooldownSeconds: 0.9,
  hardHoldSeconds: 0.42,
  severeStallSeconds: 2.2,
  hardSpeedRetention: 0.68,
  severeSpeedRetention: 0.35
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function rounded(value, precision = 3) {
  const scale = 10 ** precision;
  return Math.round(finite(value) * scale) / scale;
}

function pointKey(point) {
  return `${rounded(point.x)}:${rounded(point.y)}`;
}

function distance(a, b) {
  return Math.hypot(finite(a?.x) - finite(b?.x), finite(a?.y) - finite(b?.y));
}

function boundsOf(district) {
  return district.bounds || district;
}

function districtCenter(district) {
  const bounds = boundsOf(district);
  return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
}

function pointInDistrict(point, district, world) {
  const bounds = boundsOf(district);
  const right = bounds.x + bounds.w;
  const bottom = bounds.y + bounds.h;
  const withinRight = point.x < right - EPSILON || (Math.abs(point.x - right) <= EPSILON && Math.abs(right - world.width) <= EPSILON);
  const withinBottom = point.y < bottom - EPSILON || (Math.abs(point.y - bottom) <= EPSILON && Math.abs(bottom - world.height) <= EPSILON);
  return point.x >= bounds.x - EPSILON && point.y >= bounds.y - EPSILON && withinRight && withinBottom;
}

function districtAt(point, districts, world) {
  return districts.find(district => pointInDistrict(point, district, world)) || null;
}

function districtsShareBoundary(leftDistrict, rightDistrict) {
  const left = boundsOf(leftDistrict);
  const right = boundsOf(rightDistrict);
  const vertical = (
    Math.abs(left.x + left.w - right.x) <= EPSILON
    || Math.abs(right.x + right.w - left.x) <= EPSILON
  ) && Math.min(left.y + left.h, right.y + right.h) - Math.max(left.y, right.y) > EPSILON;
  const horizontal = (
    Math.abs(left.y + left.h - right.y) <= EPSILON
    || Math.abs(right.y + right.h - left.y) <= EPSILON
  ) && Math.min(left.x + left.w, right.x + right.w) - Math.max(left.x, right.x) > EPSILON;
  return vertical || horizontal;
}

function coordinateBoundaries(districts, axis) {
  const keys = axis === "x" ? ["x", "w"] : ["y", "h"];
  return [...new Set(districts.flatMap(district => {
    const bounds = boundsOf(district);
    return [bounds[keys[0]], bounds[keys[0]] + bounds[keys[1]]];
  }).map(value => rounded(value)))].sort((left, right) => left - right);
}

function buildDistrictRoadNetwork(roadGraph, districts, world) {
  const sourceNodes = new Map((roadGraph.nodes || []).map(node => [node.id, node]));
  const xBoundaries = coordinateBoundaries(districts, "x");
  const yBoundaries = coordinateBoundaries(districts, "y");
  const nodes = new Map();
  const segments = [];

  function networkNode(point) {
    const key = pointKey(point);
    if (!nodes.has(key)) nodes.set(key, { id: `stream-node:${key}`, x: rounded(point.x), y: rounded(point.y), segments: [] });
    return nodes.get(key);
  }

  for (const edge of roadGraph.edges || []) {
    const from = sourceNodes.get(edge.from);
    const to = sourceNodes.get(edge.to);
    if (!from || !to) throw new Error(`Road edge ${edge.id} references a missing node.`);
    const horizontal = Math.abs(from.y - to.y) <= EPSILON;
    const vertical = Math.abs(from.x - to.x) <= EPSILON;
    if (!horizontal && !vertical) throw new Error(`District streaming currently requires axis-aligned road edge ${edge.id}.`);
    const values = horizontal ? xBoundaries : yBoundaries;
    const startValue = horizontal ? from.x : from.y;
    const endValue = horizontal ? to.x : to.y;
    const min = Math.min(startValue, endValue);
    const max = Math.max(startValue, endValue);
    const denominator = endValue - startValue;
    const splits = [0, 1];
    for (const value of values) {
      if (value <= min + EPSILON || value >= max - EPSILON) continue;
      splits.push((value - startValue) / denominator);
    }
    splits.sort((left, right) => left - right);

    for (let index = 0; index < splits.length - 1; index++) {
      const startT = splits[index];
      const endT = splits[index + 1];
      const fromPoint = { x: from.x + (to.x - from.x) * startT, y: from.y + (to.y - from.y) * startT };
      const toPoint = { x: from.x + (to.x - from.x) * endT, y: from.y + (to.y - from.y) * endT };
      const midpoint = { x: (fromPoint.x + toPoint.x) / 2, y: (fromPoint.y + toPoint.y) / 2 };
      const district = districtAt(midpoint, districts, world);
      if (!district) throw new Error(`Road edge ${edge.id} leaves every district near ${midpoint.x},${midpoint.y}.`);
      const fromNode = networkNode(fromPoint);
      const toNode = networkNode(toPoint);
      const segment = {
        id: `stream-edge:${edge.id}:${index}`,
        sourceEdgeId: edge.id,
        from: fromNode.id,
        to: toNode.id,
        districtId: district.id,
        width: finite(edge.width, 52),
        roadClass: String(edge.roadClass || "local"),
        kind: String(edge.kind || "road"),
        length: distance(fromNode, toNode)
      };
      segments.push(segment);
      fromNode.segments.push(segment.id);
      toNode.segments.push(segment.id);
    }
  }

  const nodeById = new Map([...nodes.values()].map(node => [node.id, node]));
  const segmentById = new Map(segments.map(segment => [segment.id, segment]));
  const adjacency = new Map([...nodeById.keys()].map(id => [id, []]));
  for (const segment of segments) {
    adjacency.get(segment.from).push({ to: segment.to, segment });
    adjacency.get(segment.to).push({ to: segment.from, segment });
  }
  return { nodes: [...nodeById.values()], nodeById, segments, segmentById, adjacency };
}

function profileFor(district) {
  const profile = DISTRICT_PROFILES[district.id];
  if (!profile) throw new Error(`District ${district.id} has no streaming profile.`);
  return {
    version: 2,
    id: district.id,
    name: district.name,
    bounds: { ...boundsOf(district) },
    visual: { ...profile.visual },
    audio: { ...profile.audio, layers: [...profile.audio.layers] },
    simulation: { ...profile.simulation },
    identityTags: [...profile.identityTags],
    assets: { textures: [], audio: [] }
  };
}

function nodeRoadStrength(node, network, districtId) {
  const segments = node.segments
    .map(id => network.segmentById.get(id))
    .filter(segment => segment?.districtId === districtId);
  return segments.reduce((best, segment) => Math.max(best, (ROAD_CLASS_PRIORITY[segment.roadClass] || 0) * 100 + segment.width), 0);
}

function chooseDistrictAnchor(district, network, world) {
  const center = districtCenter(district);
  const candidates = network.nodes.filter(node => node.segments.some(id => network.segmentById.get(id)?.districtId === district.id));
  if (!candidates.length) throw new Error(`District ${district.id} has no road graph node.`);
  return [...candidates].sort((left, right) => {
    const leftBoundary = pointInDistrict(left, district, world) ? 0 : 300;
    const rightBoundary = pointInDistrict(right, district, world) ? 0 : 300;
    const leftScore = distance(left, center) + leftBoundary - nodeRoadStrength(left, network, district.id) * 0.85;
    const rightScore = distance(right, center) + rightBoundary - nodeRoadStrength(right, network, district.id) * 0.85;
    return leftScore - rightScore || left.id.localeCompare(right.id);
  })[0];
}

function macroPairKey(left, right) {
  return left < right ? `${left}:${right}` : `${right}:${left}`;
}

function buildPortalCandidates(districts, network) {
  const districtById = new Map(districts.map(district => [district.id, district]));
  const candidates = new Map();
  for (const node of network.nodes) {
    const districtIds = [...new Set(node.segments.map(id => network.segmentById.get(id)?.districtId).filter(Boolean))];
    for (let leftIndex = 0; leftIndex < districtIds.length; leftIndex++) {
      for (let rightIndex = leftIndex + 1; rightIndex < districtIds.length; rightIndex++) {
        const leftId = districtIds[leftIndex];
        const rightId = districtIds[rightIndex];
        const leftDistrict = districtById.get(leftId);
        const rightDistrict = districtById.get(rightId);
        if (!leftDistrict || !rightDistrict || !districtsShareBoundary(leftDistrict, rightDistrict)) continue;
        const incident = node.segments.map(id => network.segmentById.get(id)).filter(segment => segment && (segment.districtId === leftId || segment.districtId === rightId));
        const width = Math.max(...incident.map(segment => segment.width));
        const priority = Math.max(...incident.map(segment => ROAD_CLASS_PRIORITY[segment.roadClass] || 0));
        const key = macroPairKey(leftId, rightId);
        if (!candidates.has(key)) candidates.set(key, []);
        candidates.get(key).push({ nodeId: node.id, x: node.x, y: node.y, width, priority, sourceEdgeIds: [...new Set(incident.map(segment => segment.sourceEdgeId))] });
      }
    }
  }
  return candidates;
}

function shortestDistrictPath(network, fromId, toId, districtId) {
  if (fromId === toId) return [fromId];
  const distances = new Map([[fromId, 0]]);
  const previous = new Map();
  const pending = new Set([fromId]);
  while (pending.size) {
    const current = [...pending].sort((left, right) => finite(distances.get(left), Infinity) - finite(distances.get(right), Infinity) || left.localeCompare(right))[0];
    pending.delete(current);
    if (current === toId) break;
    for (const entry of network.adjacency.get(current) || []) {
      if (entry.segment.districtId !== districtId) continue;
      const factor = ROAD_CLASS_COST[entry.segment.roadClass] || 1;
      const candidate = finite(distances.get(current), Infinity) + entry.segment.length * factor;
      if (candidate + EPSILON >= finite(distances.get(entry.to), Infinity)) continue;
      distances.set(entry.to, candidate);
      previous.set(entry.to, current);
      pending.add(entry.to);
    }
  }
  if (!distances.has(toId)) return null;
  const pathIds = [toId];
  let cursor = toId;
  while (cursor !== fromId) {
    cursor = previous.get(cursor);
    if (!cursor) return null;
    pathIds.push(cursor);
  }
  return pathIds.reverse();
}

function compressPolyline(points) {
  const output = [];
  for (const point of points) {
    const normalized = { x: rounded(point.x), y: rounded(point.y) };
    const previous = output[output.length - 1];
    if (previous && Math.abs(previous.x - normalized.x) <= EPSILON && Math.abs(previous.y - normalized.y) <= EPSILON) continue;
    output.push(normalized);
    while (output.length >= 3) {
      const a = output[output.length - 3];
      const b = output[output.length - 2];
      const c = output[output.length - 1];
      const collinear = Math.abs((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) <= EPSILON;
      if (!collinear) break;
      output.splice(output.length - 2, 1);
    }
  }
  return output;
}

function pathSegments(pathIds, network) {
  const segments = [];
  for (let index = 0; index < pathIds.length - 1; index++) {
    const from = pathIds[index];
    const to = pathIds[index + 1];
    const entry = (network.adjacency.get(from) || []).find(candidate => candidate.to === to);
    if (!entry) throw new Error(`Road path ${from} -> ${to} is not connected.`);
    segments.push(entry.segment);
  }
  return segments;
}

function offsetPolyline(points, offset) {
  if (points.length < 2) return points.map(point => ({ ...point }));
  const normals = [];
  for (let index = 0; index < points.length - 1; index++) {
    const from = points[index];
    const to = points[index + 1];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    normals.push({ x: -dy / length, y: dx / length });
  }
  return points.map((point, index) => {
    const before = normals[Math.max(0, index - 1)];
    const after = normals[Math.min(normals.length - 1, index)];
    let nx = before.x + after.x;
    let ny = before.y + after.y;
    const length = Math.hypot(nx, ny);
    if (length <= EPSILON) {
      nx = after.x;
      ny = after.y;
    } else {
      nx /= length;
      ny /= length;
    }
    const dot = Math.max(0.72, Math.abs(nx * after.x + ny * after.y));
    const miter = Math.min(offset * 1.4, offset / dot);
    return { x: rounded(point.x + nx * miter), y: rounded(point.y + ny * miter) };
  });
}

function laneOffsetFor(segments) {
  const minimumWidth = Math.min(...segments.map(segment => segment.width));
  return rounded(Math.max(8, Math.min(16, minimumWidth * 0.2)));
}

function polylineLength(points) {
  let total = 0;
  for (let index = 0; index < points.length - 1; index++) total += distance(points[index], points[index + 1]);
  return total;
}

function choosePortal(pair, candidates, anchors, districts) {
  const [leftId, rightId] = pair.split(":");
  const leftCenter = anchors.get(leftId);
  const rightCenter = anchors.get(rightId);
  return [...candidates].sort((left, right) => {
    const leftScore = distance(left, leftCenter) + distance(left, rightCenter) - left.priority * 220 - left.width * 2;
    const rightScore = distance(right, leftCenter) + distance(right, rightCenter) - right.priority * 220 - right.width * 2;
    return leftScore - rightScore || left.nodeId.localeCompare(right.nodeId);
  })[0];
}

function buildMacroAndLanes(districts, network, profiles) {
  const world = {
    width: Math.max(...districts.map(district => boundsOf(district).x + boundsOf(district).w)),
    height: Math.max(...districts.map(district => boundsOf(district).y + boundsOf(district).h))
  };
  const anchors = new Map(districts.map(district => [district.id, chooseDistrictAnchor(district, network, world)]));
  const portalCandidates = buildPortalCandidates(districts, network);
  const nodeIds = districts.map(district => district.id);
  const nodes = {};
  for (const district of districts) {
    const profile = profiles[district.id];
    const anchor = anchors.get(district.id);
    nodes[district.id] = {
      id: district.id,
      bounds: { ...boundsOf(district) },
      center: { x: anchor.x, y: anchor.y },
      trafficDensity: profile.simulation.trafficDensity,
      policePresence: profile.simulation.policePresence,
      neighbours: []
    };
  }

  const edges = {};
  const lanes = {};
  for (const pair of [...portalCandidates.keys()].sort()) {
    const [a, b] = pair.split(":");
    const portal = choosePortal(pair, portalCandidates.get(pair), anchors, districts);
    const pathA = shortestDistrictPath(network, anchors.get(a).id, portal.nodeId, a);
    const pathB = shortestDistrictPath(network, anchors.get(b).id, portal.nodeId, b);
    if (!pathA || !pathB) throw new Error(`Unable to connect macro districts ${pair} through ${portal.nodeId}.`);
    const fullPath = [...pathA, ...pathB.reverse().slice(1)];
    const centerline = compressPolyline(fullPath.map(id => network.nodeById.get(id)));
    const segments = pathSegments(fullPath, network);
    const length = polylineLength(centerline);
    const offset = laneOffsetFor(segments);
    const forward = offsetPolyline(centerline, offset);
    const reverse = offsetPolyline([...centerline].reverse(), offset);
    edges[pair] = {
      id: pair,
      a,
      b,
      travelSeconds: Math.max(3, rounded(length / 150, 2)),
      length: rounded(length),
      portal: { x: portal.x, y: portal.y },
      sourceRoadEdgeIds: [...new Set(segments.map(segment => segment.sourceEdgeId))]
    };
    lanes[pair] = { forward, reverse, centerline, laneOffset: offset };
    nodes[a].neighbours.push(b);
    nodes[b].neighbours.push(a);
  }
  for (const node of Object.values(nodes)) node.neighbours.sort();

  const junctions = network.nodes
    .filter(node => node.segments.length >= 3)
    .map(node => {
      const widths = node.segments.map(id => network.segmentById.get(id)?.width || 52);
      return {
        id: `traffic-junction:${pointKey(node)}`,
        x: node.x,
        y: node.y,
        radius: rounded(Math.max(24, Math.min(54, Math.max(...widths) * 0.34))),
        approachDistance: 88
      };
    });

  return {
    macroGraph: {
      schemaVersion: 2,
      version: 2,
      id: "bloodnight-macro-navigation-v2",
      nodeIds,
      nodes,
      edgeIds: Object.keys(edges),
      edges
    },
    trafficLanes: {
      schemaVersion: 5,
      version: 5,
      id: "bloodnight-graph-derived-traffic-lanes",
      defaults: { ...TRAFFIC_DEFAULTS },
      behavior: { ...TRAFFIC_BEHAVIOR },
      physics: { ...TRAFFIC_PHYSICS },
      impacts: { ...TRAFFIC_IMPACTS },
      junctions,
      edges: lanes
    },
    anchors,
    portalCandidates
  };
}

export function buildDistrictStreamingFileSet({
  blueprint,
  roadGraph,
  chunkSize = DEFAULT_CITY_CHUNK_SIZE
} = {}) {
  if (!blueprint?.world || !Array.isArray(blueprint?.districts)) throw new TypeError("District streaming requires a city blueprint.");
  if (!Array.isArray(roadGraph?.nodes) || !Array.isArray(roadGraph?.edges)) throw new TypeError("District streaming requires an authoritative road graph.");
  const districts = blueprint.districts.map(district => ({ ...district, bounds: { ...boundsOf(district) } }));
  const profiles = Object.fromEntries(districts.map(district => [district.id, profileFor(district)]));
  const network = buildDistrictRoadNetwork(roadGraph, districts, blueprint.world);
  const { macroGraph, trafficLanes } = buildMacroAndLanes(districts, network, profiles);
  const packIds = districts.map(district => district.id);
  const packs = Object.fromEntries(districts.map(district => [district.id, {
    id: district.id,
    bounds: { ...district.bounds },
    chunkIds: chunkIdsForBounds(district.bounds, blueprint.world, chunkSize),
    priority: Math.round(10 + profiles[district.id].simulation.policePresence * 10 + profiles[district.id].simulation.trafficDensity * 5),
    file: `${district.id}.json`
  }]));
  return {
    manifest: {
      schemaVersion: 2,
      version: 2,
      id: "bloodnight-district-packs-v2",
      chunkSize,
      world: { ...blueprint.world },
      packIds,
      packs
    },
    profiles,
    macroGraph,
    trafficLanes,
    network,
    roadSurfaces: blueprint.runtime?.roads || [],
    world: { ...blueprint.world }
  };
}

export function validateDistrictStreamingFileSet(fileSet) {
  const errors = [];
  const manifest = fileSet?.manifest;
  const macro = fileSet?.macroGraph;
  const lanes = fileSet?.trafficLanes;
  if (!manifest || !macro || !lanes) return { valid: false, errors: ["District streaming file set is incomplete."] };
  if (manifest.packIds.length !== macro.nodeIds.length) errors.push("District pack and macro node counts differ.");
  for (const id of manifest.packIds) {
    if (!manifest.packs[id]) errors.push(`Missing pack manifest record ${id}.`);
    if (!fileSet.profiles[id]) errors.push(`Missing district profile ${id}.`);
    if (!macro.nodes[id]) errors.push(`Missing macro node ${id}.`);
  }
  for (const edgeId of macro.edgeIds) {
    const edge = macro.edges[edgeId];
    const lane = lanes.edges[edgeId];
    if (!edge || !macro.nodes[edge.a] || !macro.nodes[edge.b]) errors.push(`Malformed macro edge ${edgeId}.`);
    if (!lane || lane.forward?.length < 2 || lane.reverse?.length < 2) {
      errors.push(`Missing traffic lane ${edgeId}.`);
      continue;
    }
    for (const direction of ["forward", "reverse"]) {
      const points = lane[direction];
      for (let index = 0; index < points.length - 1; index++) {
        const outside = sampleSegment(points[index], points[index + 1], 8)
          .find(point => !(fileSet.roadSurfaces || []).some(surface => pointInSurface(point, surface, 1.5)));
        if (outside) {
          errors.push(`Traffic lane ${edgeId} ${direction} leaves the generated road surface at ${rounded(outside.x)},${rounded(outside.y)}.`);
          break;
        }
      }
    }
  }
  const visited = new Set();
  const queue = [macro.nodeIds[0]];
  while (queue.length) {
    const id = queue.shift();
    if (!id || visited.has(id)) continue;
    visited.add(id);
    queue.push(...(macro.nodes[id]?.neighbours || []));
  }
  if (visited.size !== macro.nodeIds.length) errors.push(`Macro graph is disconnected: reached ${visited.size}/${macro.nodeIds.length} districts.`);
  return {
    valid: errors.length === 0,
    errors,
    metrics: {
      districtPacks: manifest.packIds.length,
      macroNodes: macro.nodeIds.length,
      macroEdges: macro.edgeIds.length,
      trafficLaneEdges: Object.keys(lanes.edges).length,
      trafficJunctions: lanes.junctions.length,
      networkNodes: fileSet.network.nodes.length,
      networkSegments: fileSet.network.segments.length
    }
  };
}

export async function writeDistrictStreamingFileSet(fileSet, outputDir) {
  const target = path.resolve(outputDir);
  await mkdir(target, { recursive: true });
  const expected = new Set([
    "manifest.json",
    "macro-graph.json",
    "traffic-lanes.json",
    ...fileSet.manifest.packIds.map(id => `${id}.json`)
  ]);
  const writes = [
    writeFile(path.join(target, "manifest.json"), `${JSON.stringify(fileSet.manifest, null, 2)}\n`, "utf8"),
    writeFile(path.join(target, "macro-graph.json"), `${JSON.stringify(fileSet.macroGraph, null, 2)}\n`, "utf8"),
    writeFile(path.join(target, "traffic-lanes.json"), `${JSON.stringify(fileSet.trafficLanes, null, 2)}\n`, "utf8")
  ];
  for (const id of fileSet.manifest.packIds) {
    writes.push(writeFile(path.join(target, `${id}.json`), `${JSON.stringify(fileSet.profiles[id], null, 2)}\n`, "utf8"));
  }
  await Promise.all(writes);
  const oldFiles = ["hospital-district.json", "civic-center.json", "cathedral-hill.json", "north-harbor.json", "west-market.json", "old-quarter.json", "glasshouse.json", "university-district.json", "canal-west.json", "foundry.json", "canal-east.json", "harbor-north.json", "blackwater.json", "harbor-south.json"];
  for (const file of oldFiles) {
    if (!expected.has(file)) await rm(path.join(target, file), { force: true });
  }
  return target;
}
