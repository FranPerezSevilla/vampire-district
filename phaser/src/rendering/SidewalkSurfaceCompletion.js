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

function opposite(direction) {
  return ({ north: "south", south: "north", east: "west", west: "east" })[direction] || null;
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

function junctionSidewalkRect(piece, width, role, side, world) {
  const values = side === "north"
    ? { x: piece.x, y: finite(piece.y) - width, w: piece.w, h: width }
    : side === "south"
      ? { x: piece.x, y: bottom(piece), w: piece.w, h: width }
      : side === "west"
        ? { x: finite(piece.x) - width, y: piece.y, w: width, h: piece.h }
        : { x: right(piece), y: piece.y, w: width, h: piece.h };
  return clippedRect({
    id: `presentation-sidewalk-junction:${piece.id}:${role}:${side}`,
    ...values,
    geometry: "rect",
    side,
    role,
    trimEdges: side === "north" || side === "south" ? ["north", "south"] : ["west", "east"],
    anchorKind: role === "closure" ? "junction-closure" : "junction-side",
    ...junctionCommon(piece)
  }, world);
}

function junctionCornerPad(piece, width, quadrant, world) {
  const x = quadrant.x < 0 ? finite(piece.x) - width : right(piece);
  const y = quadrant.y < 0 ? finite(piece.y) - width : bottom(piece);
  const trimEdges = quadrant.id === "nw"
    ? ["north", "west"]
    : quadrant.id === "ne"
      ? ["north", "east"]
      : quadrant.id === "se"
        ? ["south", "east"]
        : ["south", "west"];
  return clippedRect({
    id: `presentation-sidewalk-junction:${piece.id}:corner:${quadrant.id}`,
    x,
    y,
    w: width,
    h: width,
    geometry: "rect",
    corner: quadrant.id,
    role: "corner",
    trimEdges,
    anchorKind: "junction-corner",
    ...junctionCommon(piece)
  }, world);
}

function segmentDirectionFromPiece(piece, segment) {
  const nodeIds = new Set(piece.graphNodeIds || [piece.graphNodeId]);
  if (!nodeIds.has(segment?.fromNodeId) && !nodeIds.has(segment?.toNodeId)) return null;
  const pieceCenterX = finite(piece.x) + finite(piece.w) / 2;
  const pieceCenterY = finite(piece.y) + finite(piece.h) / 2;
  const segmentCenterX = finite(segment.x) + finite(segment.w) / 2;
  const segmentCenterY = finite(segment.y) + finite(segment.h) / 2;
  if (orientationFor(segment) === "horizontal") return segmentCenterX < pieceCenterX ? "west" : "east";
  return segmentCenterY < pieceCenterY ? "north" : "south";
}

function junctionDirections(piece, roadSegments) {
  return new Set((roadSegments || []).map(segment => segmentDirectionFromPiece(piece, segment)).filter(Boolean));
}

function rectJunctionSidewalks(piece, roadSegments, width, world) {
  const directions = junctionDirections(piece, roadSegments);
  if (!directions.size) return [];
  const quadrants = [
    { id: "nw", x: -1, y: -1 },
    { id: "ne", x: 1, y: -1 },
    { id: "se", x: 1, y: 1 },
    { id: "sw", x: -1, y: 1 }
  ];
  const surfaces = [];
  const kind = String(piece.junctionKind || "");
  const hasHorizontal = directions.has("east") || directions.has("west");
  const hasVertical = directions.has("north") || directions.has("south");
  const straight = kind === "straight";

  // This mirrors the compiler's junction grammar, but buildings are intentionally
  // absent from the decision. Junction-owned pavement is part of the street edge.
  if (!straight) {
    for (const quadrant of quadrants) {
      const pad = junctionCornerPad(piece, width, quadrant, world);
      if (pad) surfaces.push(pad);
    }
  }

  const closureSides = new Set();
  if (straight) {
    if (hasHorizontal) closureSides.add("north").add("south");
    if (hasVertical) closureSides.add("west").add("east");
  } else {
    if (hasHorizontal) {
      if (!directions.has("north")) closureSides.add("north");
      if (!directions.has("south")) closureSides.add("south");
    }
    if (hasVertical) {
      if (!directions.has("west")) closureSides.add("west");
      if (!directions.has("east")) closureSides.add("east");
    }
    if (kind === "end" && directions.size === 1) closureSides.add(opposite([...directions][0]));
  }

  for (const side of closureSides) {
    const closure = junctionSidewalkRect(piece, width, "closure", side, world);
    if (closure) surfaces.push(closure);
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
 * Completes the compiler-owned sidewalk grammar inside junction authority.
 * Corner pads, closed sides and width transitions are derived only from road
 * geometry. A building footprint is never allowed to delete these visual caps.
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
