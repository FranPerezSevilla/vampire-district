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
