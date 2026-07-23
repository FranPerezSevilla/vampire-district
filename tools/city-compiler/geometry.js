export function right(rect) { return Number(rect?.x || 0) + Number(rect?.w || 0); }
export function bottom(rect) { return Number(rect?.y || 0) + Number(rect?.h || 0); }
export function rectArea(rect) { return Math.max(0, Number(rect?.w || 0)) * Math.max(0, Number(rect?.h || 0)); }

export function pointInRect(point, rect, margin = 0) {
  const x = Number(point?.x || 0);
  const y = Number(point?.y || 0);
  return x >= Number(rect?.x || 0) - margin
    && x <= right(rect) + margin
    && y >= Number(rect?.y || 0) - margin
    && y <= bottom(rect) + margin;
}

export function rectOverlapArea(a, b) {
  const width = Math.max(0, Math.min(right(a), right(b)) - Math.max(Number(a?.x || 0), Number(b?.x || 0)));
  const height = Math.max(0, Math.min(bottom(a), bottom(b)) - Math.max(Number(a?.y || 0), Number(b?.y || 0)));
  return width * height;
}

export function rectGap(a, b) {
  const dx = Math.max(Number(a?.x || 0) - right(b), Number(b?.x || 0) - right(a), 0);
  const dy = Math.max(Number(a?.y || 0) - bottom(b), Number(b?.y || 0) - bottom(a), 0);
  return Math.hypot(dx, dy);
}

export function rectsTouchOrOverlap(a, b, tolerance = 0.01) {
  return rectGap(a, b) <= tolerance;
}

export function rectInsideWorld(rect, world, margin = 0) {
  return Number(rect?.x || 0) >= margin
    && Number(rect?.y || 0) >= margin
    && right(rect) <= Number(world?.width || 0) - margin
    && bottom(rect) <= Number(world?.height || 0) - margin;
}

export function pointInsideWorld(point, world, margin = 0) {
  return Number(point?.x || 0) >= margin
    && Number(point?.y || 0) >= margin
    && Number(point?.x || 0) <= Number(world?.width || 0) - margin
    && Number(point?.y || 0) <= Number(world?.height || 0) - margin;
}

export function sampleSegment(a, b, spacing = 12) {
  const ax = Number(a?.x || 0);
  const ay = Number(a?.y || 0);
  const bx = Number(b?.x || 0);
  const by = Number(b?.y || 0);
  const distance = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(distance / Math.max(1, spacing)));
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps;
    return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t };
  });
}

export function connectedComponents(items, touches) {
  const unvisited = new Set(items.map((_, index) => index));
  const components = [];
  while (unvisited.size) {
    const [start] = unvisited;
    unvisited.delete(start);
    const queue = [start];
    const component = [];
    while (queue.length) {
      const index = queue.shift();
      component.push(index);
      for (const candidate of [...unvisited]) {
        if (!touches(items[index], items[candidate])) continue;
        unvisited.delete(candidate);
        queue.push(candidate);
      }
    }
    components.push(component);
  }
  return components;
}

export function graphEdgeCount(items, touches) {
  let edges = 0;
  for (let left = 0; left < items.length; left++) {
    for (let rightIndex = left + 1; rightIndex < items.length; rightIndex++) {
      if (touches(items[left], items[rightIndex])) edges += 1;
    }
  }
  return edges;
}

export function coefficientOfVariation(values = []) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (!finite.length) return 0;
  const mean = finite.reduce((sum, value) => sum + value, 0) / finite.length;
  if (Math.abs(mean) < 1e-9) return 0;
  const variance = finite.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / finite.length;
  return Math.sqrt(variance) / Math.abs(mean);
}

export function surfacePoints(surface) {
  if (Array.isArray(surface?.points) && surface.points.length >= 3) {
    return surface.points.map(point => ({ x: Number(point.x) || 0, y: Number(point.y) || 0 }));
  }
  return [
    { x: Number(surface?.x || 0), y: Number(surface?.y || 0) },
    { x: right(surface), y: Number(surface?.y || 0) },
    { x: right(surface), y: bottom(surface) },
    { x: Number(surface?.x || 0), y: bottom(surface) }
  ];
}

export function pointInPolygon(point, polygon = []) {
  const x = Number(point?.x || 0);
  const y = Number(point?.y || 0);
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const xi = Number(polygon[current]?.x || 0);
    const yi = Number(polygon[current]?.y || 0);
    const xj = Number(polygon[previous]?.x || 0);
    const yj = Number(polygon[previous]?.y || 0);
    const crosses = ((yi > y) !== (yj > y))
      && x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function pointInSurface(point, surface, margin = 0) {
  if (!Array.isArray(surface?.points) || surface.points.length < 3) return pointInRect(point, surface, margin);
  if (margin > 0) {
    const bounds = {
      x: Number(surface.x || 0) - margin,
      y: Number(surface.y || 0) - margin,
      w: Number(surface.w || 0) + margin * 2,
      h: Number(surface.h || 0) + margin * 2
    };
    if (!pointInRect(point, bounds)) return false;
  }
  return pointInPolygon(point, surface.points);
}

export function polygonArea(points = []) {
  let area = 0;
  for (let index = 0; index < points.length; index++) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += Number(current.x || 0) * Number(next.y || 0) - Number(next.x || 0) * Number(current.y || 0);
  }
  return Math.abs(area) / 2;
}

function signedPolygonArea(points = []) {
  let area = 0;
  for (let index = 0; index < points.length; index++) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += Number(current.x || 0) * Number(next.y || 0) - Number(next.x || 0) * Number(current.y || 0);
  }
  return area / 2;
}

function insideHalfPlane(point, start, end, orientation) {
  const cross = (Number(end.x) - Number(start.x)) * (Number(point.y) - Number(start.y))
    - (Number(end.y) - Number(start.y)) * (Number(point.x) - Number(start.x));
  return orientation >= 0 ? cross >= -1e-9 : cross <= 1e-9;
}

function lineIntersection(segmentStart, segmentEnd, clipStart, clipEnd) {
  const x1 = Number(segmentStart.x);
  const y1 = Number(segmentStart.y);
  const x2 = Number(segmentEnd.x);
  const y2 = Number(segmentEnd.y);
  const x3 = Number(clipStart.x);
  const y3 = Number(clipStart.y);
  const x4 = Number(clipEnd.x);
  const y4 = Number(clipEnd.y);
  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denominator) < 1e-9) return { x: x2, y: y2 };
  const determinantA = x1 * y2 - y1 * x2;
  const determinantB = x3 * y4 - y3 * x4;
  return {
    x: (determinantA * (x3 - x4) - (x1 - x2) * determinantB) / denominator,
    y: (determinantA * (y3 - y4) - (y1 - y2) * determinantB) / denominator
  };
}

export function convexPolygonIntersection(subject = [], clip = []) {
  if (subject.length < 3 || clip.length < 3) return [];
  let output = subject.map(point => ({ x: Number(point.x), y: Number(point.y) }));
  const orientation = Math.sign(signedPolygonArea(clip)) || 1;
  for (let clipIndex = 0; clipIndex < clip.length; clipIndex++) {
    const clipStart = clip[clipIndex];
    const clipEnd = clip[(clipIndex + 1) % clip.length];
    const input = output;
    output = [];
    if (!input.length) break;
    let previous = input[input.length - 1];
    for (const current of input) {
      const currentInside = insideHalfPlane(current, clipStart, clipEnd, orientation);
      const previousInside = insideHalfPlane(previous, clipStart, clipEnd, orientation);
      if (currentInside) {
        if (!previousInside) output.push(lineIntersection(previous, current, clipStart, clipEnd));
        output.push(current);
      } else if (previousInside) {
        output.push(lineIntersection(previous, current, clipStart, clipEnd));
      }
      previous = current;
    }
  }
  return output;
}

export function surfaceOverlapArea(left, rightValue) {
  const leftBounds = {
    x: Number(left?.x || 0),
    y: Number(left?.y || 0),
    w: Number(left?.w || 0),
    h: Number(left?.h || 0)
  };
  const rightBounds = {
    x: Number(rightValue?.x || 0),
    y: Number(rightValue?.y || 0),
    w: Number(rightValue?.w || 0),
    h: Number(rightValue?.h || 0)
  };
  if (rectOverlapArea(leftBounds, rightBounds) <= 0) return 0;
  if (!Array.isArray(left?.points) && !Array.isArray(rightValue?.points)) return rectOverlapArea(leftBounds, rightBounds);
  return polygonArea(convexPolygonIntersection(surfacePoints(left), surfacePoints(rightValue)));
}
