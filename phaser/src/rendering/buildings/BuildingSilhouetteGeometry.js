const EPSILON = 0.001;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

export function normalizeRect(source = {}) {
  return {
    x: Number(source.x) || 0,
    y: Number(source.y) || 0,
    w: Math.max(1, Number(source.w) || 1),
    h: Math.max(1, Number(source.h) || 1)
  };
}

export function insetRect(rect, amount) {
  const safe = Math.max(0, Math.min(Number(amount) || 0, Math.min(rect.w, rect.h) / 2 - 0.5));
  return {
    x: rect.x + safe,
    y: rect.y + safe,
    w: Math.max(1, rect.w - safe * 2),
    h: Math.max(1, rect.h - safe * 2)
  };
}

export function rectsOverlap(a, b, margin = 0) {
  return a.x < b.x + b.w + margin
    && a.x + a.w > b.x - margin
    && a.y < b.y + b.h + margin
    && a.y + a.h > b.y - margin;
}

export function rectContains(outer, inner, epsilon = EPSILON) {
  return inner.x >= outer.x - epsilon
    && inner.y >= outer.y - epsilon
    && inner.x + inner.w <= outer.x + outer.w + epsilon
    && inner.y + inner.h <= outer.y + outer.h + epsilon;
}

export function boundsFromPoints(points = []) {
  if (!points.length) return null;
  const xs = points.map(point => Number(point.x) || 0);
  const ys = points.map(point => Number(point.y) || 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function pointKey(point) {
  return `${Number(point.x).toFixed(6)}:${Number(point.y).toFixed(6)}`;
}

function samePoint(a, b) {
  return Math.abs(a.x - b.x) <= EPSILON && Math.abs(a.y - b.y) <= EPSILON;
}

function isCollinear(a, b, c) {
  return (Math.abs(a.x - b.x) <= EPSILON && Math.abs(b.x - c.x) <= EPSILON)
    || (Math.abs(a.y - b.y) <= EPSILON && Math.abs(b.y - c.y) <= EPSILON);
}

function simplifyClosedOrthogonalContour(points) {
  if (points.length <= 4) return points.map(point => ({ ...point }));
  const result = points.map(point => ({ ...point }));
  let changed = true;
  while (changed && result.length > 4) {
    changed = false;
    for (let index = 0; index < result.length; index += 1) {
      const previous = result[(index - 1 + result.length) % result.length];
      const current = result[index];
      const next = result[(index + 1) % result.length];
      if (!isCollinear(previous, current, next)) continue;
      result.splice(index, 1);
      changed = true;
      break;
    }
  }
  return result;
}

function orientationForSegment(start, end) {
  if (Math.abs(start.y - end.y) <= EPSILON) {
    return end.x >= start.x ? "north" : "south";
  }
  return end.y >= start.y ? "east" : "west";
}

function edgeBounds(start, end) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    w: Math.abs(end.x - start.x),
    h: Math.abs(end.y - start.y)
  };
}

function createCellGrid(roofBounds, recipe) {
  const cellWidth = roofBounds.w / recipe.columns;
  const cellHeight = roofBounds.h / recipe.rows;
  const cells = [];
  const occupiedByKey = new Map();

  for (let row = 0; row < recipe.rows; row += 1) {
    for (let column = 0; column < recipe.columns; column += 1) {
      if (recipe.mask[row]?.[column] !== "1") continue;
      const cell = {
        row,
        column,
        bounds: {
          x: roofBounds.x + column * cellWidth,
          y: roofBounds.y + row * cellHeight,
          w: cellWidth,
          h: cellHeight
        }
      };
      cells.push(cell);
      occupiedByKey.set(`${row}:${column}`, cell);
    }
  }

  return { cells, occupiedByKey, cellWidth, cellHeight };
}

function createDirectedBoundarySegments(grid) {
  const segments = [];
  const has = (row, column) => grid.occupiedByKey.has(`${row}:${column}`);

  for (const cell of grid.cells) {
    const { row, column, bounds } = cell;
    const left = bounds.x;
    const right = bounds.x + bounds.w;
    const top = bounds.y;
    const bottom = bounds.y + bounds.h;

    if (!has(row - 1, column)) {
      segments.push({ start: { x: left, y: top }, end: { x: right, y: top } });
    }
    if (!has(row, column + 1)) {
      segments.push({ start: { x: right, y: top }, end: { x: right, y: bottom } });
    }
    if (!has(row + 1, column)) {
      segments.push({ start: { x: right, y: bottom }, end: { x: left, y: bottom } });
    }
    if (!has(row, column - 1)) {
      segments.push({ start: { x: left, y: bottom }, end: { x: left, y: top } });
    }
  }
  return segments;
}

function chainBoundarySegments(segments) {
  if (!segments.length) return [];
  const byStart = new Map(segments.map(segment => [pointKey(segment.start), segment]));
  const first = [...segments].sort((a, b) => (
    a.start.y - b.start.y
    || a.start.x - b.start.x
    || a.end.y - b.end.y
    || a.end.x - b.end.x
  ))[0];
  const points = [{ ...first.start }];
  let current = first;
  const visited = new Set();

  for (let step = 0; step < segments.length; step += 1) {
    visited.add(current);
    points.push({ ...current.end });
    if (samePoint(current.end, first.start)) break;
    const next = byStart.get(pointKey(current.end));
    if (!next || visited.has(next)) {
      throw new Error("Building roof mask produced a disconnected or ambiguous boundary.");
    }
    current = next;
  }

  if (!samePoint(points[points.length - 1], points[0])) {
    throw new Error("Building roof mask boundary did not close.");
  }
  points.pop();
  return simplifyClosedOrthogonalContour(points);
}

function createParapetEdges(contour) {
  return contour.map((start, index) => {
    const end = contour[(index + 1) % contour.length];
    return {
      orientation: orientationForSegment(start, end),
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      bounds: edgeBounds(start, end)
    };
  });
}

export function createRoofSilhouetteGeometry(footprintInput, recipe, options = {}) {
  const footprint = normalizeRect(footprintInput);
  const desiredInset = Number.isFinite(Number(options.inset))
    ? Number(options.inset)
    : clamp(Math.min(footprint.w, footprint.h) * 0.06, 6, 13);
  const roofBounds = insetRect(footprint, desiredInset);
  const grid = createCellGrid(roofBounds, recipe);
  const directedSegments = createDirectedBoundarySegments(grid);
  const contour = chainBoundarySegments(directedSegments);
  const parapetEdges = createParapetEdges(contour);

  return {
    footprint,
    roofBounds,
    columns: recipe.columns,
    rows: recipe.rows,
    cellWidth: grid.cellWidth,
    cellHeight: grid.cellHeight,
    cells: grid.cells,
    occupiedByKey: grid.occupiedByKey,
    contour,
    contourBounds: boundsFromPoints(contour),
    parapetEdges
  };
}
