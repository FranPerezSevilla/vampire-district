const EPSILON = 0.001;
const DEFAULT_OCCLUDER_PADDING = 2;
const DEFAULT_CROSSWALK_PADDING = 1.5;
const DEFAULT_MINIMUM_SEGMENT_LENGTH = 0.25;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function right(rect) {
  return finite(rect?.x) + finite(rect?.w);
}

function bottom(rect) {
  return finite(rect?.y) + finite(rect?.h);
}

function segmentLength(segment) {
  return Math.hypot(finite(segment?.x2) - finite(segment?.x1), finite(segment?.y2) - finite(segment?.y1));
}

function segmentAt(segment, start, end) {
  const x1 = finite(segment.x1);
  const y1 = finite(segment.y1);
  const dx = finite(segment.x2) - x1;
  const dy = finite(segment.y2) - y1;
  return {
    ...segment,
    x1: x1 + dx * start,
    y1: y1 + dy * start,
    x2: x1 + dx * end,
    y2: y1 + dy * end
  };
}

function intersectionRange(segment, rect, padding = 0) {
  if (!segment || !rect || segmentLength(segment) <= EPSILON) return null;
  const safePadding = Math.max(0, finite(padding));
  const minX = finite(rect.x) - safePadding;
  const maxX = right(rect) + safePadding;
  const minY = finite(rect.y) - safePadding;
  const maxY = bottom(rect) + safePadding;
  const x1 = finite(segment.x1);
  const y1 = finite(segment.y1);
  const dx = finite(segment.x2) - x1;
  const dy = finite(segment.y2) - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1];
  let enter = 0;
  let exit = 1;

  for (let index = 0; index < p.length; index++) {
    if (Math.abs(p[index]) <= EPSILON) {
      if (q[index] < -EPSILON) return null;
      continue;
    }
    const ratio = q[index] / p[index];
    if (p[index] < 0) enter = Math.max(enter, ratio);
    else exit = Math.min(exit, ratio);
    if (enter > exit + EPSILON) return null;
  }

  const start = Math.max(0, Math.min(1, enter));
  const end = Math.max(0, Math.min(1, exit));
  return end - start > EPSILON ? { start, end } : null;
}

export function clipLineSegmentToRect(segment, rect, padding = 0) {
  const range = intersectionRange(segment, rect, padding);
  return range ? segmentAt(segment, range.start, range.end) : null;
}

export function subtractLineSegmentByRect(segment, rect, padding = 0, minimumLength = DEFAULT_MINIMUM_SEGMENT_LENGTH) {
  const range = intersectionRange(segment, rect, padding);
  if (!range) return [{ ...segment }];
  const safeMinimum = Math.max(EPSILON, finite(minimumLength, DEFAULT_MINIMUM_SEGMENT_LENGTH));
  const result = [];
  if (range.start > EPSILON) {
    const before = segmentAt(segment, 0, range.start);
    if (segmentLength(before) >= safeMinimum - EPSILON) result.push(before);
  }
  if (range.end < 1 - EPSILON) {
    const after = segmentAt(segment, range.end, 1);
    if (segmentLength(after) >= safeMinimum - EPSILON) result.push(after);
  }
  return result;
}

function rawBoundarySegments(boundary) {
  const segments = [...(boundary?.curbSegments || [])].map(segment => ({ ...segment, overlaySource: "curb" }));
  for (const corner of boundary?.corners || []) {
    for (let index = 0; index < (corner.arc?.length || 0) - 1; index++) {
      segments.push({
        x1: corner.arc[index].x,
        y1: corner.arc[index].y,
        x2: corner.arc[index + 1].x,
        y2: corner.arc[index + 1].y,
        overlaySource: "corner",
        corner: corner.corner,
        walkId: corner.walkId
      });
    }
  }
  return segments.filter(segment => segmentLength(segment) > EPSILON);
}

function coordinateToken(value) {
  return finite(value).toFixed(3);
}

function segmentKey(segment) {
  const first = `${coordinateToken(segment.x1)}:${coordinateToken(segment.y1)}`;
  const second = `${coordinateToken(segment.x2)}:${coordinateToken(segment.y2)}`;
  return first <= second ? `${first}|${second}` : `${second}|${first}`;
}

function uniqueSegments(segments) {
  const unique = new Map();
  for (const segment of segments) {
    const key = segmentKey(segment);
    if (!unique.has(key)) unique.set(key, segment);
  }
  return [...unique.values()];
}

/**
 * Returns only curb portions that may have been overpainted by late-rendered
 * occluders (currently buildings), then cuts those portions around crosswalks.
 * Normal curb runs are not redrawn, avoiding a double-strength outline.
 */
export function buildCurbOverlaySegments(boundary, {
  occluders = [],
  crosswalks = [],
  occluderPadding = DEFAULT_OCCLUDER_PADDING,
  crosswalkPadding = DEFAULT_CROSSWALK_PADDING,
  minimumSegmentLength = DEFAULT_MINIMUM_SEGMENT_LENGTH
} = {}) {
  const safeMinimum = Math.max(EPSILON, finite(minimumSegmentLength, DEFAULT_MINIMUM_SEGMENT_LENGTH));
  const candidates = rawBoundarySegments(boundary);
  const occluded = [];

  for (const segment of candidates) {
    for (const occluder of occluders) {
      const clipped = clipLineSegmentToRect(segment, occluder, occluderPadding);
      if (clipped && segmentLength(clipped) >= safeMinimum - EPSILON) occluded.push(clipped);
    }
  }

  let result = uniqueSegments(occluded);
  for (const crossing of crosswalks) {
    result = result.flatMap(segment =>
      subtractLineSegmentByRect(segment, crossing, crosswalkPadding, safeMinimum)
    );
    if (!result.length) break;
  }
  return uniqueSegments(result).filter(segment => segmentLength(segment) >= safeMinimum - EPSILON);
}
