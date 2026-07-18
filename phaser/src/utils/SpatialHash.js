function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export class SpatialHash {
  constructor(cellSize = 96) {
    this.cellSize = Math.max(8, finite(cellSize, 96));
    this.cells = new Map();
    this.entities = new Set();
  }

  clear() {
    this.cells.clear();
    this.entities.clear();
  }

  rebuild(entities = []) {
    this.clear();
    for (const entity of entities) this.insert(entity);
    return this;
  }

  insert(entity) {
    if (!entity || !Number.isFinite(Number(entity.x)) || !Number.isFinite(Number(entity.y))) return false;
    const key = this.keyFor(entity.x, entity.y, entity.layer);
    const bucket = this.cells.get(key) || new Set();
    bucket.add(entity);
    this.cells.set(key, bucket);
    this.entities.add(entity);
    return true;
  }

  keyFor(x, y, layer = 0) {
    const cx = Math.floor(finite(x) / this.cellSize);
    const cy = Math.floor(finite(y) / this.cellSize);
    return `${finite(layer)}:${cx}:${cy}`;
  }

  cellRange(minX, minY, maxX, maxY) {
    return {
      minCellX: Math.floor(finite(minX) / this.cellSize),
      minCellY: Math.floor(finite(minY) / this.cellSize),
      maxCellX: Math.floor(finite(maxX) / this.cellSize),
      maxCellY: Math.floor(finite(maxY) / this.cellSize)
    };
  }

  queryRect({ x = 0, y = 0, w = 0, h = 0, layer = 0 } = {}, predicate = null) {
    const minX = Math.min(finite(x), finite(x) + finite(w));
    const maxX = Math.max(finite(x), finite(x) + finite(w));
    const minY = Math.min(finite(y), finite(y) + finite(h));
    const maxY = Math.max(finite(y), finite(y) + finite(h));
    const range = this.cellRange(minX, minY, maxX, maxY);
    const seen = new Set();
    const result = [];

    for (let cx = range.minCellX; cx <= range.maxCellX; cx++) {
      for (let cy = range.minCellY; cy <= range.maxCellY; cy++) {
        const bucket = this.cells.get(`${finite(layer)}:${cx}:${cy}`);
        if (!bucket) continue;
        for (const entity of bucket) {
          if (seen.has(entity)) continue;
          seen.add(entity);
          const ex = finite(entity.x);
          const ey = finite(entity.y);
          if (ex < minX || ex > maxX || ey < minY || ey > maxY) continue;
          if (predicate && !predicate(entity)) continue;
          result.push(entity);
        }
      }
    }

    return result;
  }

  queryRadius(x, y, radius, layer = 0, predicate = null) {
    const cx = finite(x);
    const cy = finite(y);
    const r = Math.max(0, finite(radius));
    const rSq = r * r;
    return this.queryRect({ x: cx - r, y: cy - r, w: r * 2, h: r * 2, layer }, entity => {
      const dx = finite(entity.x) - cx;
      const dy = finite(entity.y) - cy;
      if (dx * dx + dy * dy > rSq) return false;
      return predicate ? predicate(entity) : true;
    });
  }

  size() {
    return this.entities.size;
  }
}
