import { pointInSurface } from "./SidewalkBoundaryGeometry.js";

const EPSILON = 0.001;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function rounded(value, precision = 4) {
  const scale = 10 ** precision;
  return Math.round(finite(value) * scale) / scale;
}

function right(rect) {
  return finite(rect?.x) + finite(rect?.w);
}

function bottom(rect) {
  return finite(rect?.y) + finite(rect?.h);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value)));
}

function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function expandedRect(rect, amount) {
  return {
    x: finite(rect.x) - amount,
    y: finite(rect.y) - amount,
    w: finite(rect.w) + amount * 2,
    h: finite(rect.h) + amount * 2
  };
}

function rectsOverlap(left, rightValue) {
  return finite(left.x) < right(rightValue)
    && right(left) > finite(rightValue.x)
    && finite(left.y) < bottom(rightValue)
    && bottom(left) > finite(rightValue.y);
}

function pointsBounds(points) {
  const xs = points.map(point => finite(point.x));
  const ys = points.map(point => finite(point.y));
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    w: Math.max(...xs) - x,
    h: Math.max(...ys) - y
  };
}

function pointInAnySurface(point, surfaces) {
  return surfaces.some(surface => pointInSurface(point, surface));
}

function roadOrientation(road) {
  if (road?.orientation === "horizontal" || road?.orientation === "vertical") return road.orientation;
  return finite(road?.w) >= finite(road?.h) ? "horizontal" : "vertical";
}

function roadClass(road) {
  if (road?.roadClass) return road.roadClass;
  if (String(road?.kind || "") === "alley") return "alley";
  return Math.min(finite(road?.w), finite(road?.h)) >= 96 ? "major" : "local";
}

function axisLength(road) {
  return roadOrientation(road) === "horizontal" ? finite(road.w) : finite(road.h);
}

function crossLength(road) {
  return roadOrientation(road) === "horizontal" ? finite(road.h) : finite(road.w);
}

function polygonRect(left, top, width, height, seed) {
  const rightValue = left + width;
  const bottomValue = top + height;
  const xInsetA = 2 + (seed % 5);
  const xInsetB = 2 + ((seed >>> 4) % 6);
  const yInsetA = 1 + ((seed >>> 8) % 4);
  const yInsetB = 1 + ((seed >>> 12) % 4);
  return [
    { x: rounded(left + xInsetA), y: rounded(top) },
    { x: rounded(rightValue - xInsetB), y: rounded(top + yInsetA) },
    { x: rounded(rightValue), y: rounded(top + Math.min(height * 0.46, 5 + ((seed >>> 16) % 6))) },
    { x: rounded(rightValue - 1 - ((seed >>> 19) % 4)), y: rounded(bottomValue - yInsetB) },
    { x: rounded(rightValue - 5 - ((seed >>> 21) % 7)), y: rounded(bottomValue) },
    { x: rounded(left + 3 + ((seed >>> 24) % 8)), y: rounded(bottomValue - 1) },
    { x: rounded(left), y: rounded(bottomValue - 3 - ((seed >>> 27) % 5)) },
    { x: rounded(left + 1 + ((seed >>> 29) % 3)), y: rounded(top + 3 + ((seed >>> 14) % 5)) }
  ];
}

function buildPatchForRoad(road, patchIndex, exclusionZones) {
  const orientation = roadOrientation(road);
  const length = axisLength(road);
  const width = crossLength(road);
  if (length < 110 || width < 30) return null;

  const seed = hashString(`${road.id || "road"}:repair:${patchIndex}`);
  const clearance = Math.min(Math.max(24, width * 0.34), Math.max(24, length * 0.22));
  const availableLength = length - clearance * 2;
  if (availableLength < 44) return null;
  const patchLength = Math.min(availableLength, 44 + (seed % 82));
  const patchWidth = Math.min(Math.max(9, width * 0.18), 12 + ((seed >>> 7) % 18), width - 12);
  const axisAvailable = Math.max(1, availableLength - patchLength);
  const axisOffset = clearance + ((seed >>> 12) % Math.max(1, Math.floor(axisAvailable + 1)));
  const crossClearance = Math.max(6, width * 0.08);
  const crossAvailable = Math.max(1, width - crossClearance * 2 - patchWidth);
  const crossOffset = crossClearance + ((seed >>> 18) % Math.max(1, Math.floor(crossAvailable + 1)));

  const x = orientation === "horizontal" ? finite(road.x) + axisOffset : finite(road.x) + crossOffset;
  const y = orientation === "horizontal" ? finite(road.y) + crossOffset : finite(road.y) + axisOffset;
  const w = orientation === "horizontal" ? patchLength : patchWidth;
  const h = orientation === "horizontal" ? patchWidth : patchLength;
  const points = polygonRect(x, y, w, h, seed);
  const bounds = pointsBounds(points);
  if (exclusionZones.some(zone => rectsOverlap(bounds, zone))) return null;

  return {
    id: `road-repair:${road.id || "road"}:${patchIndex}`,
    roadId: String(road.id || ""),
    points,
    bounds,
    alpha: 0.12 + ((seed >>> 22) % 10) / 100,
    seamAlpha: 0.18 + ((seed >>> 26) % 9) / 100
  };
}

function buildCrackForRoad(road, crackIndex, exclusionZones) {
  if (road?.pieceKind !== "segment" || roadClass(road) === "alley") return null;
  const orientation = roadOrientation(road);
  const length = axisLength(road);
  const width = crossLength(road);
  if (length < 170 || width < 42) return null;
  const seed = hashString(`${road.id || "road"}:crack:${crackIndex}`);
  if (seed % 3 !== 0) return null;

  const alongLength = 24 + (seed % 42);
  const clearance = 34;
  const available = length - clearance * 2 - alongLength;
  if (available <= 0) return null;
  const alongStart = clearance + ((seed >>> 8) % Math.max(1, Math.floor(available)));
  const crossStart = 9 + ((seed >>> 14) % Math.max(1, Math.floor(width - 18)));
  const bend = ((seed >>> 19) % 9) - 4;
  const points = [];
  for (let index = 0; index < 4; index++) {
    const t = index / 3;
    const along = alongStart + alongLength * t;
    const jitter = index === 0 || index === 3 ? 0 : (((seed >>> (index * 5)) % 7) - 3);
    const across = clamp(crossStart + bend * t + jitter, 5, width - 5);
    points.push(orientation === "horizontal"
      ? { x: rounded(finite(road.x) + along), y: rounded(finite(road.y) + across) }
      : { x: rounded(finite(road.x) + across), y: rounded(finite(road.y) + along) });
  }
  const bounds = expandedRect(pointsBounds(points), 2);
  if (exclusionZones.some(zone => rectsOverlap(bounds, zone))) return null;
  return {
    id: `road-crack:${road.id || "road"}:${crackIndex}`,
    roadId: String(road.id || ""),
    points,
    alpha: 0.12 + ((seed >>> 25) % 8) / 100
  };
}

export function buildRoadRepairDetails(roads = [], crosswalks = [], {
  crosswalkClearance = 22
} = {}) {
  const exclusionZones = crosswalks.map(crossing => expandedRect(crossing, crosswalkClearance));
  const patches = [];
  const cracks = [];
  for (const road of roads) {
    if (road?.pieceKind !== "segment" || road?.geometry === "polygon") continue;
    const length = axisLength(road);
    const seed = hashString(`${road.id || "road"}:repair-count`);
    let patchCount = 0;
    if (length >= 180 && seed % 5 <= 2) patchCount = 1;
    if (length >= 520 && seed % 7 === 0) patchCount += 1;
    if (roadClass(road) === "alley") patchCount = seed % 9 === 0 ? 1 : 0;
    for (let index = 0; index < patchCount; index++) {
      const patch = buildPatchForRoad(road, index, exclusionZones);
      if (patch) patches.push(patch);
    }
    const crack = buildCrackForRoad(road, 0, exclusionZones);
    if (crack) cracks.push(crack);
  }
  return { patches, cracks };
}

function normalCandidates(segment) {
  const dx = finite(segment.x2) - finite(segment.x1);
  const dy = finite(segment.y2) - finite(segment.y1);
  const length = Math.hypot(dx, dy);
  if (length <= EPSILON) return [];
  return [
    { x: -dy / length, y: dx / length },
    { x: dy / length, y: -dx / length }
  ];
}

function roadNormalForSegment(segment, roads, probe = 2.2) {
  const midpoint = {
    x: (finite(segment.x1) + finite(segment.x2)) / 2,
    y: (finite(segment.y1) + finite(segment.y2)) / 2
  };
  for (const normal of normalCandidates(segment)) {
    const point = {
      x: midpoint.x + normal.x * probe,
      y: midpoint.y + normal.y * probe
    };
    if (pointInAnySurface(point, roads)) return {
      x: Math.abs(normal.x) <= EPSILON ? 0 : rounded(normal.x),
      y: Math.abs(normal.y) <= EPSILON ? 0 : rounded(normal.y)
    };
  }
  return null;
}

function offsetPoint(point, normal, amount) {
  return {
    x: rounded(finite(point.x) + normal.x * amount),
    y: rounded(finite(point.y) + normal.y * amount)
  };
}

function buildGutterBand(segment, normal, width) {
  const a = { x: finite(segment.x1), y: finite(segment.y1) };
  const b = { x: finite(segment.x2), y: finite(segment.y2) };
  return {
    id: `gutter:${segment.x1}:${segment.y1}:${segment.x2}:${segment.y2}`,
    points: [a, b, offsetPoint(b, normal, width), offsetPoint(a, normal, width)],
    normal,
    alpha: 0.20
  };
}

function buildGutterStains(segment, normal, seed, width) {
  const dx = finite(segment.x2) - finite(segment.x1);
  const dy = finite(segment.y2) - finite(segment.y1);
  const length = Math.hypot(dx, dy);
  if (length < 96) return [];
  const tangent = { x: dx / length, y: dy / length };
  const stainCount = Math.min(2, Math.floor(length / 260) + (seed % 5 === 0 ? 1 : 0));
  const stains = [];
  for (let index = 0; index < stainCount; index++) {
    const stainSeed = hashString(`${seed}:gutter-stain:${index}`);
    const runLength = Math.min(length - 36, 42 + (stainSeed % 84));
    if (runLength <= 18) continue;
    const available = Math.max(1, length - runLength - 28);
    const start = 14 + ((stainSeed >>> 8) % Math.max(1, Math.floor(available)));
    const depth = Math.min(width + 3, 3 + ((stainSeed >>> 15) % 5));
    const a = {
      x: finite(segment.x1) + tangent.x * start,
      y: finite(segment.y1) + tangent.y * start
    };
    const b = {
      x: a.x + tangent.x * runLength,
      y: a.y + tangent.y * runLength
    };
    stains.push({
      id: `gutter-stain:${segment.x1}:${segment.y1}:${index}`,
      points: [a, b, offsetPoint(b, normal, depth), offsetPoint(a, normal, depth)],
      alpha: 0.08 + ((stainSeed >>> 22) % 8) / 100
    });
  }
  return stains;
}

function candidateDrainRect(segment, normal, distanceAlong, length, depth, offset) {
  const dx = finite(segment.x2) - finite(segment.x1);
  const dy = finite(segment.y2) - finite(segment.y1);
  const segmentLength = Math.hypot(dx, dy);
  const tangent = { x: dx / segmentLength, y: dy / segmentLength };
  const centre = {
    x: finite(segment.x1) + tangent.x * distanceAlong + normal.x * offset,
    y: finite(segment.y1) + tangent.y * distanceAlong + normal.y * offset
  };
  const horizontal = Math.abs(tangent.x) >= Math.abs(tangent.y);
  return horizontal
    ? {
        x: rounded(centre.x - length / 2),
        y: rounded(centre.y - depth / 2),
        w: rounded(length),
        h: rounded(depth),
        orientation: "horizontal"
      }
    : {
        x: rounded(centre.x - depth / 2),
        y: rounded(centre.y - length / 2),
        w: rounded(depth),
        h: rounded(length),
        orientation: "vertical"
      };
}

function drainBars(drain, count = 4) {
  const bars = [];
  if (drain.orientation === "horizontal") {
    const step = drain.w / (count + 1);
    for (let index = 1; index <= count; index++) {
      const x = drain.x + step * index;
      bars.push({ x1: rounded(x), y1: drain.y + 1, x2: rounded(x), y2: bottom(drain) - 1 });
    }
  } else {
    const step = drain.h / (count + 1);
    for (let index = 1; index <= count; index++) {
      const y = drain.y + step * index;
      bars.push({ x1: drain.x + 1, y1: rounded(y), x2: right(drain) - 1, y2: rounded(y) });
    }
  }
  return bars;
}

function cornerExclusionZones(corners, clearance) {
  return corners.map(corner => ({
    x: finite(corner.vertex.x) - clearance,
    y: finite(corner.vertex.y) - clearance,
    w: clearance * 2,
    h: clearance * 2
  }));
}

export function buildCurbsideDetails(boundaryGeometry, roads = [], crosswalks = [], {
  gutterWidth = 5,
  drainMinimumSegmentLength = 150,
  drainSpacing = 300,
  drainCornerClearance = 34,
  crosswalkClearance = 26
} = {}) {
  const gutterBands = [];
  const gutterStains = [];
  const drains = [];
  const exclusions = [
    ...crosswalks.map(crossing => expandedRect(crossing, crosswalkClearance)),
    ...cornerExclusionZones(boundaryGeometry?.corners || [], drainCornerClearance)
  ];

  for (const segment of boundaryGeometry?.curbSegments || []) {
    const normal = roadNormalForSegment(segment, roads);
    if (!normal) continue;
    const seed = hashString(`${segment.x1}:${segment.y1}:${segment.x2}:${segment.y2}:curbside`);
    gutterBands.push(buildGutterBand(segment, normal, gutterWidth));
    gutterStains.push(...buildGutterStains(segment, normal, seed, gutterWidth));

    const dx = finite(segment.x2) - finite(segment.x1);
    const dy = finite(segment.y2) - finite(segment.y1);
    const length = Math.hypot(dx, dy);
    const axisAligned = Math.abs(dx) <= EPSILON || Math.abs(dy) <= EPSILON;
    if (!axisAligned || length < drainMinimumSegmentLength) continue;
    const initial = 42 + (seed % 64);
    let distanceAlong = initial;
    let index = 0;
    while (distanceAlong < length - 42) {
      const drainSeed = hashString(`${seed}:drain:${index}`);
      const drainLength = 13 + (drainSeed % 7);
      const drainDepth = 4 + ((drainSeed >>> 5) % 2);
      const drain = candidateDrainRect(
        segment,
        normal,
        distanceAlong,
        drainLength,
        drainDepth,
        gutterWidth + 1.5
      );
      const centre = { x: drain.x + drain.w / 2, y: drain.y + drain.h / 2 };
      if (!exclusions.some(zone => rectsOverlap(drain, zone)) && pointInAnySurface(centre, roads)) {
        drains.push({
          ...drain,
          id: `drain:${segment.x1}:${segment.y1}:${index}`,
          bars: drainBars(drain, 4),
          alpha: 0.82
        });
      }
      distanceAlong += drainSpacing - 35 + ((drainSeed >>> 9) % 90);
      index += 1;
    }
  }

  for (const corner of boundaryGeometry?.corners || []) {
    const outer = corner.arc.map(point => {
      const dx = finite(point.x) - finite(corner.centre.x);
      const dy = finite(point.y) - finite(corner.centre.y);
      const length = Math.hypot(dx, dy) || 1;
      return {
        x: rounded(finite(point.x) + dx / length * gutterWidth),
        y: rounded(finite(point.y) + dy / length * gutterWidth)
      };
    });
    gutterBands.push({
      id: `gutter-corner:${corner.id}`,
      points: [...corner.arc, ...outer.reverse()],
      alpha: 0.20
    });
  }

  return { gutterBands, gutterStains, drains };
}

export function buildStreetSurfaceDetailGeometry(roads = [], crosswalks = [], boundaryGeometry = null, options = {}) {
  const repairs = buildRoadRepairDetails(roads, crosswalks, options);
  const curbside = buildCurbsideDetails(boundaryGeometry, roads, crosswalks, options);
  return { ...repairs, ...curbside };
}
