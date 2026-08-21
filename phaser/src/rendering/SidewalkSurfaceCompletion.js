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

function clippedPolygonSurface(surface, world) {
  const points = (surface.points || []).map(point => ({
    x: rounded(Math.max(0, Math.min(finite(world?.width, Number.MAX_SAFE_INTEGER), finite(point.x)))),
    y: rounded(Math.max(0, Math.min(finite(world?.height, Number.MAX_SAFE_INTEGER), finite(point.y))))
  }));
  if (points.length < 3) return null;
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  if (maxX - x <= EPSILON || maxY - y <= EPSILON) return null;
  return {
    ...surface,
    x: rounded(x),
    y: rounded(y),
    w: rounded(maxX - x),
    h: rounded(maxY - y),
    geometry: "polygon",
    points
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

function junctionCommon(piece, extra = {}) {
  return {
    pieceKind: "junction-sidewalk",
    junctionPieceId: piece.id,
    graphNodeId: piece.graphNodeId,
    graphNodeIds: [...(piece.graphNodeIds || [piece.graphNodeId])],
    junctionOwned: true,
    generated: true,
    presentationOnly: true,
    authoritativeJunctionSidewalk: true,
    bandKind: "presentation-junction",
    ...extra
  };
}

function connectedToJunction(piece, segment) {
  const nodeIds = new Set((piece.graphNodeIds || [piece.graphNodeId]).filter(Boolean));
  return nodeIds.has(segment?.fromNodeId) || nodeIds.has(segment?.toNodeId);
}

/**
 * Classifies an external approach by the physical side where its compiler-trimmed
 * segment meets the junction authority. The boundary test is important for
 * compound junction clusters: comparing only against the cluster centre can put a
 * locally-correct approach on the wrong side of a large aggregate rectangle.
 */
function approachSide(piece, segment) {
  if (!connectedToJunction(piece, segment)) return null;
  if (orientationFor(segment) === "horizontal") {
    if (right(segment) <= finite(piece.x) + EPSILON) return "west";
    if (finite(segment.x) >= right(piece) - EPSILON) return "east";
    const segmentCenter = finite(segment.x) + finite(segment.w) / 2;
    const pieceCenter = finite(piece.x) + finite(piece.w) / 2;
    return segmentCenter < pieceCenter ? "west" : "east";
  }
  if (bottom(segment) <= finite(piece.y) + EPSILON) return "north";
  if (finite(segment.y) >= bottom(piece) - EPSILON) return "south";
  const segmentCenter = finite(segment.y) + finite(segment.h) / 2;
  const pieceCenter = finite(piece.y) + finite(piece.h) / 2;
  return segmentCenter < pieceCenter ? "north" : "south";
}

function approachAxisInterval(segment, side) {
  return side === "north" || side === "south"
    ? { start: finite(segment.x), end: right(segment) }
    : { start: finite(segment.y), end: bottom(segment) };
}

function subtractInterval(intervals, cutStart, cutEnd) {
  const result = [];
  for (const interval of intervals) {
    const start = Math.max(interval.start, finite(cutStart));
    const end = Math.min(interval.end, finite(cutEnd));
    if (end - start <= EPSILON) {
      result.push(interval);
      continue;
    }
    if (start - interval.start > EPSILON) result.push({ start: interval.start, end: start });
    if (interval.end - end > EPSILON) result.push({ start: end, end: interval.end });
  }
  return result;
}

function ringSideBounds(piece, side, width) {
  if (side === "north") {
    return {
      x: finite(piece.x) - width,
      y: finite(piece.y) - width,
      w: finite(piece.w) + width * 2,
      h: width,
      orientation: "horizontal"
    };
  }
  if (side === "south") {
    return {
      x: finite(piece.x) - width,
      y: bottom(piece),
      w: finite(piece.w) + width * 2,
      h: width,
      orientation: "horizontal"
    };
  }
  if (side === "west") {
    return {
      x: finite(piece.x) - width,
      y: finite(piece.y),
      w: width,
      h: finite(piece.h),
      orientation: "vertical"
    };
  }
  return {
    x: right(piece),
    y: finite(piece.y),
    w: width,
    h: finite(piece.h),
    orientation: "vertical"
  };
}

/**
 * Creates a fixed-width pavement ring immediately outside a rectangular junction
 * authority and subtracts the carriageway opening of every connected approach.
 *
 * This is deliberately geometry-driven rather than junction-kind-driven. It
 * therefore handles simple crossroads, T/corner/end nodes and compound junction
 * clusters with multiple graph nodes using the same rule: pavement exists around
 * the authority everywhere except where a road actually enters or leaves it.
 */
function rectJunctionSidewalks(piece, roadSegments, width, world) {
  const connected = (roadSegments || [])
    .map(segment => ({ segment, side: approachSide(piece, segment) }))
    .filter(item => item.side);
  if (!connected.length) return [];

  const surfaces = [];
  for (const side of ["north", "south", "west", "east"]) {
    const bounds = ringSideBounds(piece, side, width);
    const horizontal = bounds.orientation === "horizontal";
    let intervals = [{
      start: horizontal ? bounds.x : bounds.y,
      end: horizontal ? bounds.x + bounds.w : bounds.y + bounds.h
    }];

    const approaches = connected.filter(item => item.side === side);
    for (const { segment } of approaches) {
      const cut = approachAxisInterval(segment, side);
      intervals = subtractInterval(intervals, cut.start, cut.end);
      if (!intervals.length) break;
    }

    intervals.forEach((interval, index) => {
      const values = horizontal
        ? { x: interval.start, y: bounds.y, w: interval.end - interval.start, h: bounds.h }
        : { x: bounds.x, y: interval.start, w: bounds.w, h: interval.end - interval.start };
      const fragment = clippedRect({
        id: `presentation-sidewalk-junction:${piece.id}:ring:${side}:${String(index + 1).padStart(2, "0")}`,
        ...values,
        geometry: "rect",
        orientation: bounds.orientation,
        side,
        role: "junction-ring",
        sourceApproachCount: approaches.length,
        trimEdges: horizontal ? ["north", "south"] : ["west", "east"],
        anchorKind: "junction-ring",
        ...junctionCommon(piece)
      }, world);
      if (fragment) surfaces.push(fragment);
    });
  }

  return surfaces;
}

function transitionSidewalks(piece, width, world) {
  if (!Array.isArray(piece?.points) || piece.points.length !== 4) return [];
  const [first, second, third, fourth] = piece.points;
  const common = junctionCommon(piece, { role: "transition-offset", anchorKind: "transition-kerb" });
  let surfaces;
  if (piece.orientation === "horizontal") {
    const northOuterA = { x: first.x, y: first.y - width };
    const northOuterB = { x: second.x, y: second.y - width };
    const southOuterA = { x: fourth.x, y: fourth.y + width };
    const southOuterB = { x: third.x, y: third.y + width };
    surfaces = [
      {
        id: `presentation-sidewalk-transition:${piece.id}:north`,
        points: [northOuterA, northOuterB, second, first],
        side: "north",
        trimSegments: [[northOuterA, northOuterB], [first, second]],
        ...common
      },
      {
        id: `presentation-sidewalk-transition:${piece.id}:south`,
        points: [fourth, third, southOuterB, southOuterA],
        side: "south",
        trimSegments: [[fourth, third], [southOuterA, southOuterB]],
        ...common
      }
    ];
  } else {
    const westOuterA = { x: first.x - width, y: first.y };
    const westOuterB = { x: fourth.x - width, y: fourth.y };
    const eastOuterA = { x: second.x + width, y: second.y };
    const eastOuterB = { x: third.x + width, y: third.y };
    surfaces = [
      {
        id: `presentation-sidewalk-transition:${piece.id}:west`,
        points: [westOuterA, first, fourth, westOuterB],
        side: "west",
        trimSegments: [[westOuterA, westOuterB], [first, fourth]],
        ...common
      },
      {
        id: `presentation-sidewalk-transition:${piece.id}:east`,
        points: [second, eastOuterA, eastOuterB, third],
        side: "east",
        trimSegments: [[second, third], [eastOuterA, eastOuterB]],
        ...common
      }
    ];
  }
  return surfaces.map(surface => clippedPolygonSurface(surface, world)).filter(Boolean);
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

/**
 * Completes pavement around junction authority. Rectangular junctions use a
 * perimeter ring with exact road-approach openings; width transitions retain the
 * compiler's polygon offset grammar. Buildings never participate in the decision.
 */
export function buildJunctionSidewalkInfill({
  roadSegments = [],
  roadJunctions = [],
  roadTransitions = [],
  world = null,
  sidewalkWidth = DEFAULT_SIDEWALK_WIDTH
} = {}) {
  const safeWidth = Math.max(4, finite(sidewalkWidth, DEFAULT_SIDEWALK_WIDTH));
  const result = [];
  for (const piece of roadJunctions) {
    if (!piece || finite(piece.w) <= EPSILON || finite(piece.h) <= EPSILON) continue;
    result.push(...rectJunctionSidewalks(piece, roadSegments, safeWidth, world));
  }
  for (const transition of roadTransitions) {
    result.push(...transitionSidewalks(transition, safeWidth, world));
  }
  return result.sort(stableSort);
}

export function buildCompletedSidewalkSurfaces(options = {}) {
  const authored = Array.isArray(options.sidewalks) ? options.sidewalks : [];
  return [
    ...authored,
    ...buildRoadEdgeSidewalkInfill(options),
    ...buildJunctionSidewalkInfill(options)
  ];
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
