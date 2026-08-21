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
    presentationOnly: true,
    authoritativeRoadEdge: true
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

function stableSort(left, rightValue) {
  return finite(left.y) - finite(rightValue.y)
    || finite(left.x) - finite(rightValue.x)
    || String(left.id).localeCompare(String(rightValue.id));
}

/**
 * Builds the visual road-edge sidewalk contract directly from compiler-trimmed
 * road segments. Every road segment, including alleys/service roads, owns one
 * sidewalk band on each side. Buildings, authored sidewalk fragments and the
 * aggregate road collection never decide whether those bands exist.
 */
export function buildRoadEdgeSidewalkInfill({
  roadSegments = [],
  world = null,
  sidewalkWidth = DEFAULT_SIDEWALK_WIDTH
} = {}) {
  const safeWidth = Math.max(4, finite(sidewalkWidth, DEFAULT_SIDEWALK_WIDTH));
  const result = [];

  for (const segment of roadSegments) {
    if (!segment || finite(segment.w) <= EPSILON || finite(segment.h) <= EPSILON) continue;
    result.push(...baseStripsForRoad(segment, safeWidth, world));
  }

  return result.sort(stableSort);
}

export function buildCompletedSidewalkSurfaces(options = {}) {
  const authored = Array.isArray(options.sidewalks) ? options.sidewalks : [];
  return [...authored, ...buildRoadEdgeSidewalkInfill(options)];
}

/** Every valid road segment must yield exactly two complete road-edge bands. */
export function auditRoadEdgeSidewalkCoverage(options = {}) {
  const segments = (Array.isArray(options.roadSegments) ? options.roadSegments : [])
    .filter(segment => segment && finite(segment.w) > EPSILON && finite(segment.h) > EPSILON);
  const generated = buildRoadEdgeSidewalkInfill(options);
  const counts = new Map();
  for (const surface of generated) {
    const key = String(surface.roadPieceId || "");
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const gaps = segments
    .filter(segment => counts.get(String(segment.id || "")) !== 2)
    .map(segment => ({
      roadId: String(segment.id || ""),
      graphEdgeId: String(segment.graphEdgeId || ""),
      expectedBands: 2,
      actualBands: counts.get(String(segment.id || "")) || 0
    }));

  return { valid: gaps.length === 0, gaps };
}
