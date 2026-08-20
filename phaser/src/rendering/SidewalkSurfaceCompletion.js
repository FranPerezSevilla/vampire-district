const EPSILON = 0.001;
const DEFAULT_SIDEWALK_WIDTH = 22;
const DEFAULT_MINIMUM_FRAGMENT_LENGTH = 0.25;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function rounded(value, precision = 3) {
  const scale = 10 ** precision;
  return Math.round(finite(value) * scale) / scale;
}

function right(rect) {
  return finite(rect?.x) + finite(rect?.w);
}

function bottom(rect) {
  return finite(rect?.y) + finite(rect?.h);
}

function clippedRect(rect, world) {
  if (!world) return { ...rect };
  const x = Math.max(0, finite(rect.x));
  const y = Math.max(0, finite(rect.y));
  const maxX = Math.min(finite(world.width), right(rect));
  const maxY = Math.min(finite(world.height), bottom(rect));
  if (maxX - x <= EPSILON || maxY - y <= EPSILON) return null;
  return {
    ...rect,
    x: rounded(x),
    y: rounded(y),
    w: rounded(maxX - x),
    h: rounded(maxY - y)
  };
}

function orientationFor(segment) {
  if (segment?.orientation === "horizontal" || segment?.orientation === "vertical") return segment.orientation;
  return finite(segment?.w) >= finite(segment?.h) ? "horizontal" : "vertical";
}

function isAlley(segment) {
  return String(segment?.roadClass || "") === "alley" || String(segment?.kind || "") === "alley";
}

function positiveOverlap(left, rightValue) {
  return Math.min(right(left), right(rightValue)) - Math.max(finite(left.x), finite(rightValue.x)) > EPSILON
    && Math.min(bottom(left), bottom(rightValue)) - Math.max(finite(left.y), finite(rightValue.y)) > EPSILON;
}

function sameCoordinate(left, rightValue, epsilon = EPSILON) {
  return Math.abs(finite(left) - finite(rightValue)) <= epsilon;
}

function pointOnSegment(point, a, b, epsilon = EPSILON) {
  const abX = finite(b?.x) - finite(a?.x);
  const abY = finite(b?.y) - finite(a?.y);
  const apX = finite(point?.x) - finite(a?.x);
  const apY = finite(point?.y) - finite(a?.y);
  const cross = abX * apY - abY * apX;
  if (Math.abs(cross) > epsilon * Math.max(1, Math.hypot(abX, abY))) return false;
  const dot = apX * abX + apY * abY;
  if (dot < -epsilon) return false;
  return dot <= abX * abX + abY * abY + epsilon;
}

function surfacePoints(surface) {
  if (surface?.geometry === "polygon" && Array.isArray(surface.points) && surface.points.length >= 3) {
    const points = surface.points.map(point => ({ x: finite(point.x), y: finite(point.y) }));
    if (
      points.length > 3
      && sameCoordinate(points[0].x, points[points.length - 1].x)
      && sameCoordinate(points[0].y, points[points.length - 1].y)
    ) points.pop();
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
    const crosses = (finite(a.y) > finite(point.y)) !== (finite(b.y) > finite(point.y));
    if (!crosses) continue;
    const x = finite(a.x) + ((finite(point.y) - finite(a.y)) * (finite(b.x) - finite(a.x)))
      / ((finite(b.y) - finite(a.y)) || Number.EPSILON);
    if (x > finite(point.x)) inside = !inside;
  }
  return inside;
}

function stripAxisBounds(strip) {
  return strip.orientation === "horizontal"
    ? { start: finite(strip.x), end: right(strip) }
    : { start: finite(strip.y), end: bottom(strip) };
}

function curbLineFor(strip) {
  if (strip.orientation === "horizontal") {
    return {
      axis: "x",
      fixedAxis: "y",
      fixed: strip.side === "north" ? bottom(strip) : finite(strip.y),
      start: finite(strip.x),
      end: right(strip)
    };
  }
  return {
    axis: "y",
    fixedAxis: "x",
    fixed: strip.side === "west" ? right(strip) : finite(strip.x),
    start: finite(strip.y),
    end: bottom(strip)
  };
}

function pointAtCurb(line, coordinate) {
  return line.axis === "x"
    ? { x: coordinate, y: line.fixed }
    : { x: line.fixed, y: coordinate };
}

function uniqueSorted(values) {
  const sorted = values
    .map(value => finite(value))
    .sort((left, rightValue) => left - rightValue);
  const result = [];
  for (const value of sorted) {
    if (!result.length || Math.abs(value - result[result.length - 1]) > EPSILON) result.push(value);
  }
  return result;
}

function mergeIntervals(intervals) {
  const sorted = intervals
    .map(interval => ({
      start: Math.min(finite(interval.start), finite(interval.end)),
      end: Math.max(finite(interval.start), finite(interval.end))
    }))
    .filter(interval => interval.end - interval.start > EPSILON)
    .sort((left, rightValue) => left.start - rightValue.start || left.end - rightValue.end);

  const merged = [];
  for (const interval of sorted) {
    const current = merged[merged.length - 1];
    if (!current || interval.start > current.end + EPSILON) {
      merged.push({ ...interval });
      continue;
    }
    current.end = Math.max(current.end, interval.end);
  }
  return merged;
}

function splitAroundCut(intervals, cutStart, cutEnd) {
  const result = [];
  for (const interval of intervals) {
    if (cutEnd <= interval.start + EPSILON || cutStart >= interval.end - EPSILON) {
      result.push(interval);
      continue;
    }
    if (cutStart > interval.start + EPSILON) {
      result.push({ start: interval.start, end: Math.min(interval.end, cutStart) });
    }
    if (cutEnd < interval.end - EPSILON) {
      result.push({ start: Math.max(interval.start, cutEnd), end: interval.end });
    }
  }
  return result;
}

function subtractIntervals(intervals, cuts) {
  let result = mergeIntervals(intervals);
  for (const cut of mergeIntervals(cuts)) {
    result = splitAroundCut(result, cut.start, cut.end);
    if (!result.length) break;
  }
  return mergeIntervals(result);
}

function cutIntervalForSurface(strip, surface) {
  if (!surface || !positiveOverlap(strip, surface)) return null;
  const axis = stripAxisBounds(strip);
  const cutStart = strip.orientation === "horizontal"
    ? Math.max(axis.start, finite(surface.x))
    : Math.max(axis.start, finite(surface.y));
  const cutEnd = strip.orientation === "horizontal"
    ? Math.min(axis.end, right(surface))
    : Math.min(axis.end, bottom(surface));
  return cutEnd - cutStart > EPSILON ? { start: cutStart, end: cutEnd } : null;
}

function subtractRoadSurfaces(strip, surfaces) {
  const axis = stripAxisBounds(strip);
  let intervals = [{ start: axis.start, end: axis.end }];
  for (const surface of surfaces) {
    const cut = cutIntervalForSurface(strip, surface);
    if (!cut) continue;
    intervals = splitAroundCut(intervals, cut.start, cut.end);
    if (!intervals.length) break;
  }
  return mergeIntervals(intervals);
}

function polygonIntervalsAtCurb(strip, surface) {
  const line = curbLineFor(strip);
  const points = surfacePoints(surface);
  if (points.length < 3) return [];
  const normalCoordinate = point => line.axis === "x" ? finite(point.y) : finite(point.x);
  const axisCoordinate = point => line.axis === "x" ? finite(point.x) : finite(point.y);
  const normalValues = points.map(normalCoordinate);
  if (line.fixed < Math.min(...normalValues) - EPSILON || line.fixed > Math.max(...normalValues) + EPSILON) {
    return [];
  }

  const breakpoints = [line.start, line.end];
  for (let index = 0; index < points.length; index++) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const normalA = normalCoordinate(a);
    const normalB = normalCoordinate(b);
    const axisA = axisCoordinate(a);
    const axisB = axisCoordinate(b);

    if (sameCoordinate(normalA, line.fixed) && sameCoordinate(normalB, line.fixed)) {
      if (axisA >= line.start - EPSILON && axisA <= line.end + EPSILON) breakpoints.push(axisA);
      if (axisB >= line.start - EPSILON && axisB <= line.end + EPSILON) breakpoints.push(axisB);
      continue;
    }

    const delta = normalB - normalA;
    if (Math.abs(delta) <= EPSILON) continue;
    const t = (line.fixed - normalA) / delta;
    if (t < -EPSILON || t > 1 + EPSILON) continue;
    const coordinate = axisA + (axisB - axisA) * Math.max(0, Math.min(1, t));
    if (coordinate >= line.start - EPSILON && coordinate <= line.end + EPSILON) breakpoints.push(coordinate);
  }

  const clipped = uniqueSorted(breakpoints.map(value => Math.max(line.start, Math.min(line.end, value))));
  const intervals = [];
  for (let index = 0; index < clipped.length - 1; index++) {
    const start = clipped[index];
    const end = clipped[index + 1];
    if (end - start <= EPSILON) continue;
    const midpoint = (start + end) / 2;
    if (pointInPolygon(pointAtCurb(line, midpoint), points)) intervals.push({ start, end });
  }
  return mergeIntervals(intervals);
}

function rectIntervalsAtCurb(strip, surface) {
  const line = curbLineFor(strip);
  if (line.axis === "x") {
    if (line.fixed < finite(surface.y) - EPSILON || line.fixed > bottom(surface) + EPSILON) return [];
    const start = Math.max(line.start, finite(surface.x));
    const end = Math.min(line.end, right(surface));
    return end - start > EPSILON ? [{ start, end }] : [];
  }
  if (line.fixed < finite(surface.x) - EPSILON || line.fixed > right(surface) + EPSILON) return [];
  const start = Math.max(line.start, finite(surface.y));
  const end = Math.min(line.end, bottom(surface));
  return end - start > EPSILON ? [{ start, end }] : [];
}

function surfaceIntervalsAtCurb(strip, surface) {
  if (!surface) return [];
  if (surface.geometry === "polygon" && Array.isArray(surface.points) && surface.points.length >= 3) {
    return polygonIntervalsAtCurb(strip, surface);
  }
  return rectIntervalsAtCurb(strip, surface);
}

function sidewalkCoverageIntervals(strip, sidewalks) {
  return mergeIntervals(sidewalks.flatMap(surface => surfaceIntervalsAtCurb(strip, surface)));
}

function baseStripsForRoad(segment, sidewalkWidth, world) {
  const orientation = orientationFor(segment);
  const horizontal = orientation === "horizontal";
  const common = {
    geometry: "rect",
    graphEdgeId: segment.graphEdgeId,
    roadPieceId: segment.id,
    orientation,
    anchorKind: "kerb-strip",
    bandKind: "presentation-road-edge",
    generated: true,
    presentationOnly: true
  };
  const candidates = horizontal
    ? [
        {
          ...common,
          id: `presentation-sidewalk:${segment.id}:north`,
          x: segment.x,
          y: finite(segment.y) - sidewalkWidth,
          w: segment.w,
          h: sidewalkWidth,
          side: "north",
          trimEdges: ["north", "south"]
        },
        {
          ...common,
          id: `presentation-sidewalk:${segment.id}:south`,
          x: segment.x,
          y: bottom(segment),
          w: segment.w,
          h: sidewalkWidth,
          side: "south",
          trimEdges: ["north", "south"]
        }
      ]
    : [
        {
          ...common,
          id: `presentation-sidewalk:${segment.id}:west`,
          x: finite(segment.x) - sidewalkWidth,
          y: segment.y,
          w: sidewalkWidth,
          h: segment.h,
          side: "west",
          trimEdges: ["west", "east"]
        },
        {
          ...common,
          id: `presentation-sidewalk:${segment.id}:east`,
          x: right(segment),
          y: segment.y,
          w: sidewalkWidth,
          h: segment.h,
          side: "east",
          trimEdges: ["west", "east"]
        }
      ];
  return candidates.map(candidate => clippedRect(candidate, world)).filter(Boolean);
}

function fragmentFromInterval(strip, interval, index, count) {
  const fragment = {
    ...strip,
    id: `${strip.id}:infill:${String(index + 1).padStart(2, "0")}`,
    sourceStripId: strip.id,
    fragmentIndex: index,
    fragmentCount: count
  };
  if (strip.orientation === "horizontal") {
    fragment.x = rounded(interval.start);
    fragment.w = rounded(interval.end - interval.start);
  } else {
    fragment.y = rounded(interval.start);
    fragment.h = rounded(interval.end - interval.start);
  }
  return fragment;
}

function stableSort(left, rightValue) {
  return finite(left.y) - finite(rightValue.y)
    || finite(left.x) - finite(rightValue.x)
    || String(left.id).localeCompare(String(rightValue.id));
}

function targetIntervalsForStrip(strip, roads, owningRoadId) {
  const blockers = roads.filter(road => String(road?.id || "") !== owningRoadId);
  return subtractRoadSurfaces(strip, blockers);
}

/**
 * Derives missing visual sidewalk fragments from the road right-of-way.
 *
 * Coverage is measured on the exact curb line. A surface that overlaps only the
 * parcel-side interior of the nominal strip cannot claim that it reaches the road.
 * Buildings are deliberately absent from the blockers: only another road or junction
 * may interrupt infrastructure owned by a road segment.
 */
export function buildRoadEdgeSidewalkInfill({
  roadSegments = [],
  roads = [],
  sidewalks = [],
  world = null,
  sidewalkWidth = DEFAULT_SIDEWALK_WIDTH,
  minimumFragmentLength = DEFAULT_MINIMUM_FRAGMENT_LENGTH,
  includeAlleys = false
} = {}) {
  const safeWidth = Math.max(4, finite(sidewalkWidth, DEFAULT_SIDEWALK_WIDTH));
  // Larger legacy values must not reintroduce visible holes; callers may only lower
  // the numerical tolerance used to discard sub-pixel debris.
  const safeMinimum = Math.max(
    EPSILON * 2,
    Math.min(DEFAULT_MINIMUM_FRAGMENT_LENGTH, finite(minimumFragmentLength, DEFAULT_MINIMUM_FRAGMENT_LENGTH))
  );
  const result = [];

  for (const segment of roadSegments) {
    if (!segment || finite(segment.w) <= EPSILON || finite(segment.h) <= EPSILON) continue;
    if (!includeAlleys && isAlley(segment)) continue;
    const owningRoadId = String(segment.id || "");

    for (const strip of baseStripsForRoad(segment, safeWidth, world)) {
      const target = targetIntervalsForStrip(strip, roads, owningRoadId);
      const coverage = sidewalkCoverageIntervals(strip, sidewalks);
      const missing = subtractIntervals(target, coverage)
        .filter(interval => interval.end - interval.start >= safeMinimum - EPSILON);
      missing.forEach((interval, index) => {
        result.push(fragmentFromInterval(strip, interval, index, missing.length));
      });
    }
  }

  return result.sort(stableSort);
}

export function buildCompletedSidewalkSurfaces(options = {}) {
  const authored = Array.isArray(options.sidewalks) ? options.sidewalks : [];
  return [...authored, ...buildRoadEdgeSidewalkInfill(options)];
}

/**
 * Audits every exposed road edge by interval, not by sparse point samples. Any
 * uncovered run is reported in full, including gaps shorter than the old sample
 * spacing or fragment threshold.
 */
export function auditRoadEdgeSidewalkCoverage({
  roadSegments = [],
  roads = [],
  sidewalks = [],
  world = null,
  sidewalkWidth = DEFAULT_SIDEWALK_WIDTH,
  includeAlleys = false
} = {}) {
  const safeWidth = Math.max(4, finite(sidewalkWidth, DEFAULT_SIDEWALK_WIDTH));
  const gaps = [];

  for (const segment of roadSegments) {
    if (!segment || finite(segment.w) <= EPSILON || finite(segment.h) <= EPSILON) continue;
    if (!includeAlleys && isAlley(segment)) continue;
    const owningRoadId = String(segment.id || "");

    for (const strip of baseStripsForRoad(segment, safeWidth, world)) {
      const target = targetIntervalsForStrip(strip, roads, owningRoadId);
      const coverage = sidewalkCoverageIntervals(strip, sidewalks);
      for (const interval of subtractIntervals(target, coverage)) {
        const curb = curbLineFor(strip);
        const midpoint = (interval.start + interval.end) / 2;
        const point = pointAtCurb(curb, midpoint);
        gaps.push({
          roadId: String(segment.id || ""),
          graphEdgeId: String(segment.graphEdgeId || ""),
          side: strip.side,
          start: rounded(interval.start),
          end: rounded(interval.end),
          length: rounded(interval.end - interval.start),
          x: rounded(point.x),
          y: rounded(point.y)
        });
      }
    }
  }

  return { valid: gaps.length === 0, gaps };
}
