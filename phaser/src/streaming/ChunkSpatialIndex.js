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

function stableItemId(category, item, index = 0) {
  return String(item?.streamId || item?.id || `${category}:${index}`);
}

export class ChunkSpatialIndex {
  constructor(manifest, collections = null) {
    if (!manifest?.chunks) throw new TypeError("ChunkSpatialIndex requires a city chunk manifest.");
    this.manifest = manifest;
    this.byCategory = new Map();
    this.boundsByKey = new Map();
    this.resident = new Set();
    this.seedCategories();
    if (collections && Object.keys(collections).length) this.rebuild(collections);
  }

  seedCategories() {
    for (const chunk of Object.values(this.manifest.chunks || {})) {
      for (const category of Object.keys(chunk.counts || {})) this.ensureCategory(category);
    }
  }

  ensureCategory(category) {
    const key = String(category);
    if (!this.byCategory.has(key)) {
      this.byCategory.set(key, new Map(this.manifest.chunkIds.map(id => [id, new Map()])));
    }
    return this.byCategory.get(key);
  }

  rebuild(collections = {}) {
    this.clear();
    const payloads = new Map(this.manifest.chunkIds.map(id => [id, {}]));
    for (const [category, items] of Object.entries(collections)) {
      (items || []).forEach((item, index) => {
        const bounds = itemBounds(category, item);
        if (!bounds) return;
        const normalized = item?.streamId ? item : { ...item, streamId: stableItemId(category, item, index) };
        for (const id of chunkIdsForBounds(bounds, this.manifest.world, this.manifest.chunkSize)) {
          (payloads.get(id)[category] ||= []).push(normalized);
        }
      });
    }
    for (const [id, chunkCollections] of payloads) this.hydrateChunk(id, chunkCollections);
    return this;
  }

  hydrateChunk(id, collections = {}) {
    const chunkId = String(id);
    if (!this.manifest.chunks[chunkId]) throw new Error(`Unknown city chunk ${chunkId}.`);
    this.evictChunk(chunkId);
    for (const [category, items] of Object.entries(collections || {})) {
      const chunk = this.ensureCategory(category).get(chunkId);
      (items || []).forEach((item, index) => {
        const key = stableItemId(category, item, index);
        const bounds = itemBounds(category, item);
        if (!bounds) return;
        chunk.set(key, item);
        this.boundsByKey.set(`${category}:${key}`, bounds);
      });
    }
    this.resident.add(chunkId);
    return this;
  }

  evictChunk(id) {
    const chunkId = String(id);
    for (const chunks of this.byCategory.values()) chunks.get(chunkId)?.clear?.();
    return this.resident.delete(chunkId);
  }

  clear() {
    for (const id of [...this.resident]) this.evictChunk(id);
    this.boundsByKey.clear();
    return this;
  }

  isResident(id) {
    return this.resident.has(String(id));
  }

  residentChunkIds() {
    return [...this.resident];
  }

  categories() {
    return [...this.byCategory.keys()];
  }

  count(category, chunkIds = this.residentChunkIds()) {
    const chunks = this.byCategory.get(String(category));
    if (!chunks) return 0;
    const seen = new Set();
    for (const id of chunkIds) for (const key of chunks.get(String(id))?.keys?.() || []) seen.add(key);
    return seen.size;
  }

  query(category, bounds, { chunkIds = null, margin = 0, predicate = null } = {}) {
    const categoryKey = String(category);
    const chunks = this.byCategory.get(categoryKey);
    if (!chunks || !bounds) return [];
    const ids = chunkIds || chunkIdsForBounds(bounds, this.manifest.world, this.manifest.chunkSize);
    const seen = new Set();
    const result = [];
    for (const id of ids) {
      for (const [key, item] of chunks.get(String(id)) || []) {
        if (seen.has(key)) continue;
        seen.add(key);
        const indexedBounds = this.boundsByKey.get(`${categoryKey}:${key}`) || itemBounds(categoryKey, item);
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

  snapshot(chunkIds = this.residentChunkIds()) {
    return Object.fromEntries(this.categories().map(category => [category, this.count(category, chunkIds)]));
  }
}
