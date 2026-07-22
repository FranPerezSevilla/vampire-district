import { chunkIdsForBounds, itemBounds } from "./CityChunkManifest.js";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function intersects(left, right, margin = 0) {
  return left.x < right.x + right.w + margin
    && left.x + left.w > right.x - margin
    && left.y < right.y + right.h + margin
    && left.y + left.h > right.y - margin;
}

export class ChunkSpatialIndex {
  constructor(manifest, collections = {}) {
    if (!manifest?.chunks) throw new TypeError("ChunkSpatialIndex requires a city chunk manifest.");
    this.manifest = manifest;
    this.collections = collections;
    this.byCategory = new Map();
    this.itemBounds = new WeakMap();
    this.rebuild();
  }

  rebuild() {
    this.byCategory.clear();
    for (const [category, items] of Object.entries(this.collections)) {
      const chunks = new Map();
      for (const id of this.manifest.chunkIds) chunks.set(id, []);
      for (const item of items || []) {
        const bounds = itemBounds(category, item);
        if (!bounds) continue;
        this.itemBounds.set(item, bounds);
        for (const id of chunkIdsForBounds(bounds, this.manifest.world, this.manifest.chunkSize)) {
          chunks.get(id)?.push(item);
        }
      }
      this.byCategory.set(category, chunks);
    }
    return this;
  }

  categories() {
    return [...this.byCategory.keys()];
  }

  count(category, chunkIds = this.manifest.chunkIds) {
    const chunks = this.byCategory.get(category);
    if (!chunks) return 0;
    const seen = new Set();
    for (const id of chunkIds) for (const item of chunks.get(id) || []) seen.add(item);
    return seen.size;
  }

  query(category, bounds, { chunkIds = null, margin = 0, predicate = null } = {}) {
    const chunks = this.byCategory.get(category);
    if (!chunks || !bounds) return [];
    const ids = chunkIds || chunkIdsForBounds(bounds, this.manifest.world, this.manifest.chunkSize);
    const seen = new Set();
    const result = [];
    for (const id of ids) {
      for (const item of chunks.get(id) || []) {
        if (seen.has(item)) continue;
        seen.add(item);
        const indexedBounds = this.itemBounds.get(item) || itemBounds(category, item);
        if (!indexedBounds || !intersects(indexedBounds, bounds, margin)) continue;
        if (predicate && !predicate(item)) continue;
        result.push(item);
      }
    }
    return result;
  }

  queryPoint(category, x, y, radius = 0, options = {}) {
    const value = Math.max(0, finite(radius));
    return this.query(category, {
      x: finite(x) - value,
      y: finite(y) - value,
      w: Math.max(1, value * 2),
      h: Math.max(1, value * 2)
    }, options);
  }

  snapshot(chunkIds = this.manifest.chunkIds) {
    return Object.fromEntries(this.categories().map(category => [category, this.count(category, chunkIds)]));
  }
}
