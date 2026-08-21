const EPSILON = 0.001;
const DEFAULT_SIDEWALK_WIDTH = 22;

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
  return { ...rect, x: rounded(x), y: rounded(y), w: rounded(maxX - x), h: rounded(maxY - y) };
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

function mergeIntervals(intervals) {
  const sorted = intervals
    .map(interval => ({ start: Math.min(finite(interval.start), finite(interval.end)), end: Math.max(finite(interval.start), finite(interval.end)) }))
    .filter(interval => interval.end - interval.start > EPSILON)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  for (const interval of sorted) {
    const current = merged[merged.length - 1];
    if (!current || interval.start > current.end + EPSILON) merged.push({ ...interval });
    else current.end = Math.max(current.end, interval.end);
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
    if (cutStart > interval.start + EPSILON) result.push({ start: interval.start, end: Math.min(interval.end, cutStart) });
    if (cutEnd < interval.end - EPSILON) result.push({ start: Math.max(interval.start, cutEnd), end: interval.end });
  }
  return result;
}

function cutIntervalForSurface(strip, surface) {
  if (!surface || !positiveOverlap(strip, surface)) return null;
  const axis = stripAxisBounds(strip);
  const start = strip.orientation === "horizontal" ? Math.max(axis.start, finite(surface.x)) : Math.max(axis.start, finite(surface.y));
  const end = strip.orientation === "horizontal" ? Math.min(axis.end, right(surface)) : Math.min(axis.end, bottom(surface));
  return end - start > EPSILON ? { start, end } : null;
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

function baseStripsForRoad(segment, sidewalkWidth, world) {
  const orientation = orientationFor(segment);
  const horizontal = orientation === "horizontal";
  const common = {
    geometry: "rect", graphEdgeId: segment.graphEdgeId, roadPieceId: segment.id, orientation,
    anchorKind: "kerb-strip", bandKind: "presentation-road-edge", generated: true, presentationOnly: true,
    authoritativeRoadEdge: true
  };
  const candidates = horizontal ? [
    { ...common, id: `presentation-sidewalk:${segment.id}:north`, x: segment.x, y: finite(segment.y) - sidewalkWidth, w: segment.w, h: sidewalkWidth, side: "north", trimEdges: ["north", "south"] },
    { ...common, id: `presentation-sidewalk:${segment.id}:south`, x: segment.x, y: bottom(segment), w: segment.w, h: sidewalkWidth, side: "south", trimEdges: ["north", "south"] }
  ] : [
    { ...common, id: `presentation-sidewalk:${segment.id}:west`, x: finite(segment.x) - sidewalkWidth, y: segment.y, w: sidewalkWidth, h: segment.h, side: "west", trimEdges: ["west", "east"] },
    { ...common, id: `presentation-sidewalk:${segment.id}:east`, x: right(segment), y: segment.y, w: sidewalkWidth, h: segment.h, side: "east", trimEdges: ["west", "east"] }
  ];
  return candidates.map(candidate => clippedRect(candidate, world)).filter(Boolean);
}

function fragmentFromInterval(strip, interval, index, count) {
  const fragment = { ...strip, id: `${strip.id}:road-band:${String(index + 1).padStart(2, "0")}`, sourceStripId: strip.id, fragmentIndex: index, fragmentCount: count };
  if (strip.orientation === "horizontal") {
    fragment.x = rounded(interval.start);
    fragment.w = rounded(interval.end - interval.start);
  } else {
    fragment.y = rounded(interval.start);
    fragment.h = rounded(interval.end - interval.start);
  }
  return fragment;
}

function stableSort(a, b) {
  return finite(a.y) - finite(b.y) || finite(a.x) - finite(b.x) || String(a.id).localeCompare(String(b.id));
}

function targetIntervalsForStrip(strip, roads, owningRoadId) {
  return subtractRoadSurfaces(strip, roads.filter(road => String(road?.id || "") !== owningRoadId));
}

/**
 * Builds the authoritative visual pavement band beside every standard road.
 * Buildings and authored sidewalks never decide whether this band exists. Only
 * another road/junction can interrupt it. This deliberately permits the pavement
 * to overlap a building footprint: street presentation owns the road edge.
 */
export function buildRoadEdgeSidewalkInfill({
  roadSegments = [], roads = [], world = null, sidewalkWidth = DEFAULT_SIDEWALK_WIDTH, includeAlleys = false
} = {}) {
  const safeWidth = Math.max(4, finite(sidewalkWidth, DEFAULT_SIDEWALK_WIDTH));
  const result = [];
  for (const segment of roadSegments) {
    if (!segment || finite(segment.w) <= EPSILON || finite(segment.h) <= EPSILON) continue;
    if (!includeAlleys && isAlley(segment)) continue;
    const owningRoadId = String(segment.id || "");
    for (const strip of baseStripsForRoad(segment, safeWidth, world)) {
      const target = targetIntervalsForStrip(strip, roads, owningRoadId);
      target.forEach((interval, index) => result.push(fragmentFromInterval(strip, interval, index, target.length)));
    }
  }
  return result.sort(stableSort);
}

export function buildCompletedSidewalkSurfaces(options = {}) {
  const authored = Array.isArray(options.sidewalks) ? options.sidewalks : [];
  return [...authored, ...buildRoadEdgeSidewalkInfill(options)];
}

/** Audit the authoritative generated bands themselves. */
export function auditRoadEdgeSidewalkCoverage(options = {}) {
  const generated = buildRoadEdgeSidewalkInfill(options);
  const expected = buildRoadEdgeSidewalkInfill({ ...options, sidewalks: [] });
  const signature = surface => [surface.roadPieceId, surface.side, rounded(surface.x), rounded(surface.y), rounded(surface.w), rounded(surface.h)].join(":");
  const actualSet = new Set(generated.map(signature));
  const gaps = expected.filter(surface => !actualSet.has(signature(surface))).map(surface => ({
    roadId: String(surface.roadPieceId || ""), graphEdgeId: String(surface.graphEdgeId || ""), side: surface.side,
    start: rounded(surface.orientation === "horizontal" ? surface.x : surface.y),
    end: rounded(surface.orientation === "horizontal" ? right(surface) : bottom(surface)),
    length: rounded(surface.orientation === "horizontal" ? surface.w : surface.h),
    x: rounded(surface.x + surface.w / 2), y: rounded(surface.y + surface.h / 2)
  }));
  return { valid: gaps.length === 0, gaps };
}
