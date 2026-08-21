const EPSILON = 0.001;
const DEFAULT_SAMPLE_OFFSETS = Object.freeze([0.45, 0.8, 1.35]);
const DEFAULT_ROAD_PROBES = Object.freeze([0.7, 1.4, 2.6, 4.2]);

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

function line(x1, y1, x2, y2, extra = {}) {
  return {
    x1: rounded(x1),
    y1: rounded(y1),
    x2: rounded(x2),
    y2: rounded(y2),
    ...extra
  };
}

function sameCoordinate(left, rightValue, epsilon = EPSILON) {
  return Math.abs(finite(left) - finite(rightValue)) <= epsilon;
}

function samePoint(left, rightValue, epsilon = EPSILON) {
  return sameCoordinate(left?.x, rightValue?.x, epsilon)
    && sameCoordinate(left?.y, rightValue?.y, epsilon);
}

function pointOnSegment(point, a, b, epsilon = EPSILON) {
  const abX = finite(b.x) - finite(a.x);
  const abY = finite(b.y) - finite(a.y);
  const apX = finite(point.x) - finite(a.x);
  const apY = finite(point.y) - finite(a.y);
  const crossValue = abX * apY - abY * apX;
  if (Math.abs(crossValue) > epsilon * Math.max(1, Math.hypot(abX, abY))) return false;
  const dotValue = apX * abX + apY * abY;
  if (dotValue < -epsilon) return false;
  const lengthSquared = abX * abX + abY * abY;
  return dotValue <= lengthSquared + epsilon;
}

export function surfacePoints(surface) {
  if (surface?.geometry === "polygon" && Array.isArray(surface.points) && surface.points.length >= 3) {
    const points = surface.points.map(point => ({ x: finite(point.x), y: finite(point.y) }));
    if (points.length > 3 && samePoint(points[0], points[points.length - 1])) points.pop();
    return points;
  }
  return [
    { x: finite(surface?.x), y: finite(surface?.y) },
    { x: right(surface), y: finite(surface?.y) },
    { x: right(surface), y: bottom(surface) },
    { x: finite(surface?.x), y: bottom(surface) }
  ];
}

function pointInPolygon(point, points) {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const a = points[previous];
    const b = points[index];
    if (pointOnSegment(point, a, b)) return true;
    const crosses = (a.y > point.y) !== (b.y > point.y);
    if (!crosses) continue;
    const x = a.x + ((point.y - a.y) * (b.x - a.x)) / (b.y - a.y);
    if (x > point.x) inside = !inside;
  }
  return inside;
}

export function pointInSurface(point, surface) {
  if (!surface) return false;
  if (surface.geometry !== "polygon" || !Array.isArray(surface.points)) {
    return point.x >= finite(surface.x) - EPSILON
      && point.x <= right(surface) + EPSILON
      && point.y >= finite(surface.y) - EPSILON
      && point.y <= bottom(surface) + EPSILON;
  }
  return pointInPolygon(point, surfacePoints(surface));
}

function pointInAnySurface(point, surfaces) {
  return surfaces.some(surface => pointInSurface(point, surface));
}

function pointsBounds(points) {
  const xs = points.map(point => finite(point.x));
  const ys = points.map(point => finite(point.y));
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys)
  };
}

function boundsOverlap(left, rightValue, epsilon = EPSILON) {
  return left.x <= right(rightValue) + epsilon
    && right(left) + epsilon >= rightValue.x
    && left.y <= bottom(rightValue) + epsilon
    && bottom(left) + epsilon >= rightValue.y;
}

function buildEdges(surfaces) {
  const edges = [];
  for (let surfaceIndex = 0; surfaceIndex < surfaces.length; surfaceIndex++) {
    const surface = surfaces[surfaceIndex];
    const points = surfacePoints(surface);
    for (let index = 0; index < points.length; index++) {
      const a = points[index];
      const b = points[(index + 1) % points.length];
      if (Math.hypot(b.x - a.x, b.y - a.y) <= EPSILON) continue;
      edges.push({
        a,
        b,
        bounds: pointsBounds([a, b]),
        surfaceIndex,
        surfaceId: String(surface.id || surfaceIndex)
      });
    }
  }
  return edges;
}

function cross(left, rightValue) {
  return left.x * rightValue.y - left.y * rightValue.x;
}

function dot(left, rightValue) {
  return left.x * rightValue.x + left.y * rightValue.y;
}

function vector(from, to) {
  return { x: finite(to.x) - finite(from.x), y: finite(to.y) - finite(from.y) };
}

function addSplitParameters(parameters, edge, other) {
  if (!boundsOverlap(edge.bounds, other.bounds)) return;
  const p = edge.a;
  const q = other.a;
  const r = vector(edge.a, edge.b);
  const s = vector(other.a, other.b);
  const denominator = cross(r, s);
  const qMinusP = vector(p, q);
  const lengthSquared = dot(r, r);
  if (lengthSquared <= EPSILON) return;

  if (Math.abs(denominator) <= EPSILON) {
    if (Math.abs(cross(qMinusP, r)) > EPSILON) return;
    for (const point of [other.a, other.b]) {
      const t = dot(vector(p, point), r) / lengthSquared;
      if (t > EPSILON && t < 1 - EPSILON) parameters.push(t);
    }
    return;
  }

  const t = cross(qMinusP, s) / denominator;
  const u = cross(qMinusP, r) / denominator;
  if (t > EPSILON && t < 1 - EPSILON && u >= -EPSILON && u <= 1 + EPSILON) parameters.push(t);
}

function uniqueSorted(values) {
  const sorted = [...values].sort((left, rightValue) => left - rightValue);
  const result = [];
  for (const value of sorted) {
    if (!result.length || Math.abs(value - result[result.length - 1]) > EPSILON) result.push(value);
  }
  return result;
}

function interpolate(a, b, t) {
  return {
    x: finite(a.x) + (finite(b.x) - finite(a.x)) * t,
    y: finite(a.y) + (finite(b.y) - finite(a.y)) * t
  };
}

function boundarySide(midpoint, normal, sidewalks, sampleOffsets) {
  for (const offset of sampleOffsets) {
    const leftPoint = {
      x: midpoint.x + normal.x * offset,
      y: midpoint.y + normal.y * offset
    };
    const rightPoint = {
      x: midpoint.x - normal.x * offset,
      y: midpoint.y - normal.y * offset
    };
    const leftInside = pointInAnySurface(leftPoint, sidewalks);
    const rightInside = pointInAnySurface(rightPoint, sidewalks);
    if (leftInside === rightInside) continue;
    return {
      outsideNormal: leftInside
        ? { x: -normal.x, y: -normal.y }
        : { x: normal.x, y: normal.y }
    };
  }
  return null;
}

function roadAdjacentAt(midpoint, outsideNormal, roads, probes) {
  return probes.some(distance => pointInAnySurface({
    x: midpoint.x + outsideNormal.x * distance,
    y: midpoint.y + outsideNormal.y * distance
  }, roads));
}

function coordinateToken(value) {
  return rounded(value, 3).toFixed(3);
}

function normalizedSegmentKey(segment) {
  const first = `${coordinateToken(segment.x1)}:${coordinateToken(segment.y1)}`;
  const second = `${coordinateToken(segment.x2)}:${coordinateToken(segment.y2)}`;
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

function canonicalSegment(segment) {
  const firstBeforeSecond = segment.x1 < segment.x2 - EPSILON
    || (sameCoordinate(segment.x1, segment.x2) && segment.y1 <= segment.y2);
  return firstBeforeSecond
    ? { ...segment }
    : line(segment.x2, segment.y2, segment.x1, segment.y1, {
        roadAdjacent: segment.roadAdjacent === true
      });
}

function axisFor(segment) {
  if (sameCoordinate(segment.y1, segment.y2)) return "horizontal";
  if (sameCoordinate(segment.x1, segment.x2)) return "vertical";
  return "diagonal";
}

function mergeAxisAlignedSegments(segments) {
  const groups = new Map();
  const diagonals = [];
  for (const original of segments) {
    const segment = canonicalSegment(original);
    const axis = axisFor(segment);
    if (axis === "diagonal") {
      diagonals.push(segment);
      continue;
    }
    const fixed = axis === "horizontal" ? segment.y1 : segment.x1;
    const key = `${axis}:${coordinateToken(fixed)}:${segment.roadAdjacent === true ? 1 : 0}`;
    const group = groups.get(key) || { axis, fixed, roadAdjacent: segment.roadAdjacent === true, segments: [] };
    group.segments.push(segment);
    groups.set(key, group);
  }

  const merged = [];
  for (const group of groups.values()) {
    const intervals = group.segments.map(segment => group.axis === "horizontal"
      ? { start: segment.x1, end: segment.x2 }
      : { start: segment.y1, end: segment.y2 })
      .sort((left, rightValue) => left.start - rightValue.start || left.end - rightValue.end);
    let current = null;
    for (const interval of intervals) {
      if (!current) {
        current = { ...interval };
        continue;
      }
      if (interval.start <= current.end + EPSILON) {
        current.end = Math.max(current.end, interval.end);
        continue;
      }
      merged.push(group.axis === "horizontal"
        ? line(current.start, group.fixed, current.end, group.fixed, { roadAdjacent: group.roadAdjacent })
        : line(group.fixed, current.start, group.fixed, current.end, { roadAdjacent: group.roadAdjacent }));
      current = { ...interval };
    }
    if (current) {
      merged.push(group.axis === "horizontal"
        ? line(current.start, group.fixed, current.end, group.fixed, { roadAdjacent: group.roadAdjacent })
        : line(group.fixed, current.start, group.fixed, current.end, { roadAdjacent: group.roadAdjacent }));
    }
  }
  return [...merged, ...diagonals];
}

function buildCanonicalBoundarySegments(sidewalks, roads, options) {
  const edges = buildEdges(sidewalks);
  const unique = new Map();
  for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex++) {
    const edge = edges[edgeIndex];
    const parameters = [0, 1];
    for (let otherIndex = 0; otherIndex < edges.length; otherIndex++) {
      if (edgeIndex === otherIndex) continue;
      addSplitParameters(parameters, edge, edges[otherIndex]);
    }
    const splits = uniqueSorted(parameters);
    for (let index = 0; index < splits.length - 1; index++) {
      const startT = splits[index];
      const endT = splits[index + 1];
      if (endT - startT <= EPSILON) continue;
      const a = interpolate(edge.a, edge.b, startT);
      const b = interpolate(edge.a, edge.b, endT);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      if (length <= options.minimumSegmentLength) continue;
      const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const normal = { x: -dy / length, y: dx / length };
      const side = boundarySide(midpoint, normal, sidewalks, options.sampleOffsets);
      if (!side) continue;
      const roadAdjacent = roadAdjacentAt(midpoint, side.outsideNormal, roads, options.roadProbes);
      const segment = canonicalSegment(line(a.x, a.y, b.x, b.y, { roadAdjacent }));
      const key = normalizedSegmentKey(segment);
      const existing = unique.get(key);
      if (!existing) unique.set(key, segment);
      else if (roadAdjacent) existing.roadAdjacent = true;
    }
  }
  return mergeAxisAlignedSegments([...unique.values()]);
}

function cornerCandidate(walk, requestedRadius) {
  if (!walk || walk.role !== "corner" || !["nw", "ne", "se", "sw"].includes(walk.corner)) return null;
  const maxRadius = Math.min(finite(walk.w), finite(walk.h)) * 0.42;
  const radius = Math.max(3, Math.min(finite(requestedRadius, 7), maxRadius));
  const definitions = {
    nw: { vertexX: right(walk), vertexY: bottom(walk), horizontalSign: -1, verticalSign: -1, angles: [0, Math.PI * 0.5] },
    ne: { vertexX: finite(walk.x), vertexY: bottom(walk), horizontalSign: 1, verticalSign: -1, angles: [Math.PI * 0.5, Math.PI] },
    se: { vertexX: finite(walk.x), vertexY: finite(walk.y), horizontalSign: 1, verticalSign: 1, angles: [Math.PI, Math.PI * 1.5] },
    sw: { vertexX: right(walk), vertexY: finite(walk.y), horizontalSign: -1, verticalSign: 1, angles: [Math.PI * 1.5, Math.PI * 2] }
  };
  const definition = definitions[walk.corner];
  return {
    ...definition,
    radius,
    corner: walk.corner,
    walkId: String(walk.id || "corner"),
    centreX: definition.vertexX + definition.horizontalSign * radius,
    centreY: definition.vertexY + definition.verticalSign * radius
  };
}

function endpointMatch(segment, x, y) {
  if (sameCoordinate(segment.x1, x) && sameCoordinate(segment.y1, y)) return 1;
  if (sameCoordinate(segment.x2, x) && sameCoordinate(segment.y2, y)) return 2;
  return 0;
}

function segmentMatchesLeg(segment, candidate, axis, sign) {
  if (segment.roadAdjacent !== true || axisFor(segment) !== axis) return false;
  const endpoint = endpointMatch(segment, candidate.vertexX, candidate.vertexY);
  if (!endpoint) return false;
  const other = endpoint === 1
    ? { x: segment.x2, y: segment.y2 }
    : { x: segment.x1, y: segment.y1 };
  const delta = axis === "horizontal"
    ? other.x - candidate.vertexX
    : other.y - candidate.vertexY;
  return Math.sign(delta) === sign && Math.abs(delta) >= candidate.radius - EPSILON;
}

function trimLegAtCorner(segment, candidate, axis, sign) {
  const endpoint = endpointMatch(segment, candidate.vertexX, candidate.vertexY);
  if (!endpoint) return segment;
  const tangent = axis === "horizontal"
    ? { x: candidate.vertexX + sign * candidate.radius, y: candidate.vertexY }
    : { x: candidate.vertexX, y: candidate.vertexY + sign * candidate.radius };
  if (endpoint === 1) return line(tangent.x, tangent.y, segment.x2, segment.y2, { roadAdjacent: segment.roadAdjacent === true });
  return line(segment.x1, segment.y1, tangent.x, tangent.y, { roadAdjacent: segment.roadAdjacent === true });
}

function buildArcPoints(candidate, segments) {
  const points = [];
  for (let index = 0; index <= segments; index++) {
    const t = index / segments;
    const angle = candidate.angles[0] + (candidate.angles[1] - candidate.angles[0]) * t;
    points.push({
      x: rounded(candidate.centreX + Math.cos(angle) * candidate.radius),
      y: rounded(candidate.centreY + Math.sin(angle) * candidate.radius)
    });
  }
  return points;
}

function roundTrueCurbCorners(boundarySegments, sidewalks, options) {
  const segments = boundarySegments.map(segment => ({ ...segment }));
  const corners = [];
  const usedVertices = new Set();
  const candidates = sidewalks.map(walk => cornerCandidate(walk, options.cornerRadius)).filter(Boolean)
    .sort((left, rightValue) => left.walkId.localeCompare(rightValue.walkId));

  for (const candidate of candidates) {
    const vertexKey = `${coordinateToken(candidate.vertexX)}:${coordinateToken(candidate.vertexY)}`;
    if (usedVertices.has(vertexKey)) continue;
    const horizontalIndex = segments.findIndex(segment => segmentMatchesLeg(
      segment,
      candidate,
      "horizontal",
      candidate.horizontalSign
    ));
    const verticalIndex = segments.findIndex(segment => segmentMatchesLeg(
      segment,
      candidate,
      "vertical",
      candidate.verticalSign
    ));
    if (horizontalIndex < 0 || verticalIndex < 0 || horizontalIndex === verticalIndex) continue;

    segments[horizontalIndex] = trimLegAtCorner(
      segments[horizontalIndex],
      candidate,
      "horizontal",
      candidate.horizontalSign
    );
    segments[verticalIndex] = trimLegAtCorner(
      segments[verticalIndex],
      candidate,
      "vertical",
      candidate.verticalSign
    );
    const arc = buildArcPoints(candidate, options.cornerSegments);
    corners.push({
      id: `curb-corner:${vertexKey}`,
      corner: candidate.corner,
      vertex: { x: candidate.vertexX, y: candidate.vertexY },
      centre: { x: candidate.centreX, y: candidate.centreY },
      radius: candidate.radius,
      arc,
      cutout: [
        { x: candidate.vertexX, y: candidate.vertexY },
        ...arc
      ]
    });
    usedVertices.add(vertexKey);
  }

  return {
    segments: segments.filter(segment => Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1) > EPSILON),
    corners
  };
}

export function buildSidewalkBoundaryGeometry(sidewalks = [], roads = [], {
  sampleOffsets = DEFAULT_SAMPLE_OFFSETS,
  roadProbes = DEFAULT_ROAD_PROBES,
  minimumSegmentLength = 0.25,
  cornerRadius = 7,
  cornerSegments = 9
} = {}) {
  const options = {
    sampleOffsets: [...sampleOffsets],
    roadProbes: [...roadProbes],
    minimumSegmentLength: Math.max(0.05, finite(minimumSegmentLength, 0.25)),
    cornerRadius: Math.max(3, finite(cornerRadius, 7)),
    cornerSegments: Math.max(4, Math.round(finite(cornerSegments, 9)))
  };
  if (!sidewalks.length) {
    return {
      boundarySegments: [],
      outerBoundarySegments: [],
      curbSegments: [],
      corners: []
    };
  }
  const canonical = buildCanonicalBoundarySegments(sidewalks, roads, options);
  const roundedGeometry = roundTrueCurbCorners(canonical, sidewalks, options);
  return {
    boundarySegments: roundedGeometry.segments,
    outerBoundarySegments: roundedGeometry.segments.filter(segment => segment.roadAdjacent !== true),
    curbSegments: roundedGeometry.segments.filter(segment => segment.roadAdjacent === true),
    corners: roundedGeometry.corners
  };
}
