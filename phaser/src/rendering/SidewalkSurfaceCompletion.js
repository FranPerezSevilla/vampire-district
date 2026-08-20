const EPSILON = 0.001;
const DEFAULT_SIDEWALK_WIDTH = 22;
const DEFAULT_MINIMUM_FRAGMENT_LENGTH = 8;
const DEFAULT_AUDIT_SAMPLE_SPACING = 14;
const DEFAULT_CURB_SAMPLE_INSET = 1;

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

function pointInSurface(point, surface) {
  if (!surface) return false;
  if (surface.geometry === "polygon" && Array.isArray(surface.points) && surface.points.length >= 3) {
    return pointInPolygon(point, surface.points);
  }
  return finite(point.x) >= finite(surface.x) - EPSILON
    && finite(point.x) <= right(surface) + EPSILON
    && finite(point.y) >= finite(surface.y) - EPSILON
    && finite(point.y) <= bottom(surface) + EPSILON;
}

function stripAxisBounds(strip) {
  return strip.orientation === "horizontal"
    ? { start: finite(strip.x), end: right(strip) }
    : { start: finite(strip.y), end: bottom(strip) };
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

function subtractSurfaces(strip, surfaces) {
  const axis = stripAxisBounds(strip);
  let intervals = [{ start: axis.start, end: axis.end }];
  for (const surface of surfaces) {
    const cut = cutIntervalForSurface(strip, surface);
    if (!cut) continue;
    intervals = splitAroundCut(intervals, cut.start, cut.end);
    if (!intervals.length) break;
  }
  return intervals;
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

function curbSamplePoint(strip, coordinate, inset) {
  const safeInset = Math.max(0.25, Math.min(finite(inset, DEFAULT_CURB_SAMPLE_INSET), Math.min(strip.w, strip.h) / 2));
  if (strip.orientation === "horizontal") {
    return {
      x: coordinate,
      y: strip.side === "north" ? bottom(strip) - safeInset : finite(strip.y) + safeInset
    };
  }
  return {
    x: strip.side === "west" ? right(strip) - safeInset : finite(strip.x) + safeInset,
    y: coordinate
  };
}

function sampleCoordinates(interval, spacing) {
  const length = interval.end - interval.start;
  if (length <= EPSILON) return [];
  const margin = Math.min(1, length / 4);
  const start = interval.start + margin;
  const end = interval.end - margin;
  if (end <= start + EPSILON) return [(interval.start + interval.end) / 2];
  const result = [start];
  for (let value = start + spacing; value < end - EPSILON; value += spacing) result.push(value);
  if (end - result[result.length - 1] > spacing * 0.35) result.push(end);
  return result;
}

/**
 * Derives missing visual sidewalk fragments from the road right-of-way.
 *
 * Buildings are deliberately not blockers. A building may visually cover the parcel
 * side of a sidewalk when it is rendered later, but it is not allowed to delete the
 * road-facing pedestrian band or its curb. Only another road/junction surface may
 * interrupt that infrastructure. Existing authored sidewalks are subtracted solely to
 * avoid duplicate fill/joint work; the final curb still comes from the geometric union.
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
  const safeMinimum = Math.max(2, finite(minimumFragmentLength, DEFAULT_MINIMUM_FRAGMENT_LENGTH));
  const result = [];

  for (const segment of roadSegments) {
    if (!segment || finite(segment.w) <= EPSILON || finite(segment.h) <= EPSILON) continue;
    if (!includeAlleys && isAlley(segment)) continue;

    const owningRoadId = String(segment.id || "");
    const blockingRoads = roads.filter(road => String(road?.id || "") !== owningRoadId);

    for (const strip of baseStripsForRoad(segment, safeWidth, world)) {
      const unobstructed = subtractSurfaces(strip, blockingRoads);
      const uncovered = [];
      for (const interval of unobstructed) {
        const provisional = fragmentFromInterval(strip, interval, 0, 1);
        uncovered.push(...subtractSurfaces(provisional, sidewalks));
      }
      const retained = uncovered.filter(interval => interval.end - interval.start >= safeMinimum - EPSILON);
      retained.forEach((interval, index) => {
        result.push(fragmentFromInterval(strip, interval, index, retained.length));
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
 * Audits the road-facing edge of every standard road segment. The audit samples only
 * intervals that are not occupied by another road/junction and reports coordinates
 * where no pedestrian surface reaches the curb. This turns missing curbs into a city-
 * wide invariant rather than a screenshot-by-screenshot discovery process.
 */
export function auditRoadEdgeSidewalkCoverage({
  roadSegments = [],
  roads = [],
  sidewalks = [],
  world = null,
  sidewalkWidth = DEFAULT_SIDEWALK_WIDTH,
  includeAlleys = false,
  sampleSpacing = DEFAULT_AUDIT_SAMPLE_SPACING,
  curbInset = DEFAULT_CURB_SAMPLE_INSET
} = {}) {
  const safeWidth = Math.max(4, finite(sidewalkWidth, DEFAULT_SIDEWALK_WIDTH));
  const safeSpacing = Math.max(4, finite(sampleSpacing, DEFAULT_AUDIT_SAMPLE_SPACING));
  const gaps = [];

  for (const segment of roadSegments) {
    if (!segment || finite(segment.w) <= EPSILON || finite(segment.h) <= EPSILON) continue;
    if (!includeAlleys && isAlley(segment)) continue;
    const owningRoadId = String(segment.id || "");
    const blockingRoads = roads.filter(road => String(road?.id || "") !== owningRoadId);

    for (const strip of baseStripsForRoad(segment, safeWidth, world)) {
      for (const interval of subtractSurfaces(strip, blockingRoads)) {
        for (const coordinate of sampleCoordinates(interval, safeSpacing)) {
          const point = curbSamplePoint(strip, coordinate, curbInset);
          if (sidewalks.some(surface => pointInSurface(point, surface))) continue;
          gaps.push({
            roadId: String(segment.id || ""),
            graphEdgeId: String(segment.graphEdgeId || ""),
            side: strip.side,
            x: rounded(point.x),
            y: rounded(point.y)
          });
        }
      }
    }
  }

  return { valid: gaps.length === 0, gaps };
}
