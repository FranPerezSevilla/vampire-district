const EPSILON = 0.001;
const DEFAULT_SIDEWALK_WIDTH = 22;
const DEFAULT_MINIMUM_FRAGMENT_LENGTH = 8;

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

/**
 * Completes the visual road-edge sidewalk bands from the final runtime geometry.
 *
 * Generated sidewalks are authored against compile-time building footprints. A small
 * number of buildings are subsequently fitted to those sidewalks at runtime, which
 * can expose empty road frontage that never received a sidewalk surface. This pass
 * rebuilds only the newly available road-edge fragments from the final buildings,
 * while preserving junction clearances and every already-authored sidewalk surface.
 */
export function buildRoadEdgeSidewalkInfill({
  roadSegments = [],
  roads = [],
  sidewalks = [],
  buildings = [],
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
    const blockingSurfaces = [...buildings, ...blockingRoads];

    for (const strip of baseStripsForRoad(segment, safeWidth, world)) {
      const unobstructed = subtractSurfaces(strip, blockingSurfaces);
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
