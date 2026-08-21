const EPSILON = 0.001;
const DEFAULT_SIDEWALK_WIDTH = 22;
const DEFAULT_FRONTAGE_MAX_DEPTH = 96;
const DEFAULT_FRONTAGE_AXIS_PADDING = 6;

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

function roadAxisBounds(segment) {
  return orientationFor(segment) === "horizontal"
    ? { start: finite(segment.x), end: right(segment) }
    : { start: finite(segment.y), end: bottom(segment) };
}

function frontageCandidate(segment, building, side, maxDepth, axisPadding, sidewalkWidth) {
  if (!building || finite(building.w) <= EPSILON || finite(building.h) <= EPSILON) return null;
  const orientation = orientationFor(segment);
  const horizontal = orientation === "horizontal";
  const axis = roadAxisBounds(segment);
  const buildingStart = horizontal ? finite(building.x) : finite(building.y);
  const buildingEnd = horizontal ? right(building) : bottom(building);
  const start = Math.max(axis.start, buildingStart - axisPadding);
  const end = Math.min(axis.end, buildingEnd + axisPadding);
  if (end - start <= EPSILON) return null;

  let roadEdge;
  let facade;
  if (side === "north") {
    roadEdge = finite(segment.y);
    facade = bottom(building);
  } else if (side === "south") {
    roadEdge = bottom(segment);
    facade = finite(building.y);
  } else if (side === "west") {
    roadEdge = finite(segment.x);
    facade = right(building);
  } else {
    roadEdge = right(segment);
    facade = finite(building.x);
  }

  const depth = side === "north" || side === "west"
    ? roadEdge - facade
    : facade - roadEdge;

  // The mandatory 22 px road-edge strip already owns shallow setbacks. Frontage
  // completion is only needed when a real dark parcel gap would remain behind it.
  if (depth <= sidewalkWidth + EPSILON || depth > maxDepth + EPSILON) return null;

  return {
    buildingId: String(building.id || building.sign || "building"),
    start: rounded(start),
    end: rounded(end),
    facade: rounded(facade),
    roadEdge: rounded(roadEdge),
    depth: rounded(depth)
  };
}

function mergeFrontageSlices(slices) {
  const merged = [];
  for (const slice of slices) {
    const previous = merged[merged.length - 1];
    const horizontal = slice.orientation === "horizontal";
    const contiguous = previous
      && previous.side === slice.side
      && previous.roadPieceId === slice.roadPieceId
      && Math.abs(finite(previous.facadeCoordinate) - finite(slice.facadeCoordinate)) <= EPSILON
      && (horizontal
        ? Math.abs(right(previous) - finite(slice.x)) <= EPSILON
        : Math.abs(bottom(previous) - finite(slice.y)) <= EPSILON);
    if (!contiguous) {
      merged.push({ ...slice });
      continue;
    }
    if (horizontal) previous.w = rounded(finite(previous.w) + finite(slice.w));
    else previous.h = rounded(finite(previous.h) + finite(slice.h));
  }
  return merged;
}

function frontageSlicesForSide(segment, side, buildings, sidewalkWidth, maxDepth, axisPadding, world) {
  const orientation = orientationFor(segment);
  const horizontal = orientation === "horizontal";
  const candidates = buildings
    .map(building => frontageCandidate(segment, building, side, maxDepth, axisPadding, sidewalkWidth))
    .filter(Boolean);
  if (!candidates.length) return [];

  const axis = roadAxisBounds(segment);
  const breaks = [...new Set([
    rounded(axis.start),
    rounded(axis.end),
    ...candidates.flatMap(candidate => [candidate.start, candidate.end])
  ])].sort((a, b) => a - b);

  const slices = [];
  for (let index = 0; index < breaks.length - 1; index++) {
    const start = breaks[index];
    const end = breaks[index + 1];
    if (end - start <= EPSILON) continue;
    const midpoint = (start + end) / 2;
    const covering = candidates
      .filter(candidate => midpoint >= candidate.start - EPSILON && midpoint <= candidate.end + EPSILON)
      .sort((left, rightValue) => left.depth - rightValue.depth || left.buildingId.localeCompare(rightValue.buildingId));
    const nearest = covering[0];
    if (!nearest) continue;

    const common = {
      id: `presentation-frontage:${segment.id}:${side}:${String(index + 1).padStart(2, "0")}`,
      geometry: "rect",
      graphEdgeId: segment.graphEdgeId,
      roadPieceId: segment.id,
      orientation,
      side,
      generated: true,
      presentationOnly: true,
      frontagePavement: true,
      anchorKind: "building-frontage",
      bandKind: "presentation-frontage",
      facadeCoordinate: nearest.facade,
      sourceBuildingId: nearest.buildingId
    };

    let surface;
    if (horizontal && side === "north") {
      surface = { ...common, x: start, y: nearest.facade, w: end - start, h: nearest.depth };
    } else if (horizontal && side === "south") {
      surface = { ...common, x: start, y: nearest.roadEdge, w: end - start, h: nearest.depth };
    } else if (!horizontal && side === "west") {
      surface = { ...common, x: nearest.facade, y: start, w: nearest.depth, h: end - start };
    } else {
      surface = { ...common, x: nearest.roadEdge, y: start, w: nearest.depth, h: end - start };
    }
    const clipped = clippedRect(surface, world);
    if (clipped) slices.push(clipped);
  }

  return mergeFrontageSlices(slices);
}

/**
 * Builds a complete visual pavement band beside every standard road segment.
 *
 * Road segments are already trimmed to their junction authorities by the city
 * compiler. Re-clipping these presentation strips against the aggregate `roads`
 * collection can therefore erase valid frontage. Buildings, authored sidewalks
 * and other road pieces deliberately do not participate here: the segment itself
 * is the authority for whether its two pavement bands exist.
 */
export function buildRoadEdgeSidewalkInfill({
  roadSegments = [],
  world = null,
  sidewalkWidth = DEFAULT_SIDEWALK_WIDTH,
  includeAlleys = false
} = {}) {
  const safeWidth = Math.max(4, finite(sidewalkWidth, DEFAULT_SIDEWALK_WIDTH));
  const result = [];

  for (const segment of roadSegments) {
    if (!segment || finite(segment.w) <= EPSILON || finite(segment.h) <= EPSILON) continue;
    if (!includeAlleys && isAlley(segment)) continue;
    result.push(...baseStripsForRoad(segment, safeWidth, world));
  }

  return result.sort(stableSort);
}

/**
 * Extends presentation pavement from the guaranteed kerb strip to the nearest
 * building facade when that facade is within normal urban-frontage distance.
 *
 * This is intentionally presentation-only. Navigation keeps the authored 22 px
 * sidewalk contract, while the player sees one continuous paved frontage instead
 * of a dark parcel strip between sidewalk and building.
 */
export function buildBuildingFrontagePavement({
  roadSegments = [],
  buildings = [],
  world = null,
  sidewalkWidth = DEFAULT_SIDEWALK_WIDTH,
  frontageMaxDepth = DEFAULT_FRONTAGE_MAX_DEPTH,
  frontageAxisPadding = DEFAULT_FRONTAGE_AXIS_PADDING,
  includeAlleys = false
} = {}) {
  const safeWidth = Math.max(4, finite(sidewalkWidth, DEFAULT_SIDEWALK_WIDTH));
  const safeDepth = Math.max(safeWidth, finite(frontageMaxDepth, DEFAULT_FRONTAGE_MAX_DEPTH));
  const safePadding = Math.max(0, finite(frontageAxisPadding, DEFAULT_FRONTAGE_AXIS_PADDING));
  const safeBuildings = Array.isArray(buildings) ? buildings : [];
  const result = [];

  for (const segment of roadSegments) {
    if (!segment || finite(segment.w) <= EPSILON || finite(segment.h) <= EPSILON) continue;
    if (!includeAlleys && isAlley(segment)) continue;
    const sides = orientationFor(segment) === "horizontal" ? ["north", "south"] : ["west", "east"];
    for (const side of sides) {
      result.push(...frontageSlicesForSide(
        segment,
        side,
        safeBuildings,
        safeWidth,
        safeDepth,
        safePadding,
        world
      ));
    }
  }

  return result.sort(stableSort);
}

export function buildCompletedSidewalkSurfaces(options = {}) {
  const authored = Array.isArray(options.sidewalks) ? options.sidewalks : [];
  return [
    ...authored,
    ...buildBuildingFrontagePavement(options),
    ...buildRoadEdgeSidewalkInfill(options)
  ];
}

/**
 * Audits the production invariant without consulting authored sidewalks: every
 * eligible road segment must produce exactly two complete presentation bands.
 */
export function auditRoadEdgeSidewalkCoverage(options = {}) {
  const segments = (Array.isArray(options.roadSegments) ? options.roadSegments : [])
    .filter(segment => segment && finite(segment.w) > EPSILON && finite(segment.h) > EPSILON)
    .filter(segment => options.includeAlleys === true || !isAlley(segment));
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
