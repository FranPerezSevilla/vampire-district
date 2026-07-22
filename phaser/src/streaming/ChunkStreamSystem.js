import { chunkCoordinatesAt, chunkId, chunkIdAt, chunkIdsForBounds } from "./CityChunkManifest.js";
import { ChunkDeltaStore } from "./ChunkDeltaStore.js";
import { ChunkFileStore, DEFAULT_CITY_MANIFEST_URL } from "./ChunkFileStore.js";
import { ChunkSpatialIndex } from "./ChunkSpatialIndex.js";

export const CHUNK_STREAM_STATES = Object.freeze({ UNLOADED: "unloaded", PREFETCHED: "prefetched", ACTIVE: "active", DORMANT: "dormant" });
export const CHUNK_LOAD_STATES = Object.freeze({ UNLOADED: "unloaded", LOADING: "loading", QUEUED: "queued", RESIDENT: "resident", CACHED: "cached", ERROR: "error" });

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const desiredState = state => state === CHUNK_STREAM_STATES.ACTIVE || state === CHUNK_STREAM_STATES.PREFETCHED;

export class ChunkStreamSystem {
  constructor(scene, options = {}) {
    if (!scene) throw new TypeError("ChunkStreamSystem requires a scene.");
    this.scene = scene;
    this.manifest = null;
    this.index = options.index || null;
    this.fileStore = options.fileStore || new ChunkFileStore({
      manifestUrl: options.manifestUrl || DEFAULT_CITY_MANIFEST_URL,
      cacheLimit: options.cacheLimit ?? 12
    });
    this.activeRadius = Math.max(0, Math.floor(finite(options.activeRadius, 1)));
    this.prefetchRadius = Math.max(this.activeRadius, Math.floor(finite(options.prefetchRadius, 2)));
    this.dormantRetention = Math.max(0, Math.floor(finite(options.dormantRetention, 2)));
    this.activationBudget = Math.max(1, Math.floor(finite(options.activationBudget, 2)));
    this.tick = 0;
    this.centerChunkId = null;
    this.activeChunkIds = new Set();
    this.prefetchedChunkIds = new Set();
    this.records = new Map();
    this.activationQueue = new Map();
    this.loadPromises = new Map();
    this.transitions = [];
    this.pendingFocus = null;
    this.initialized = false;
    this.initializationError = null;
    this.destroyed = false;
    this.deltaStore = null;
    this.lastDesiredKey = "";
    this.installBrowserApi();
    this.publish();
    const source = options.manifest ? Promise.resolve(options.manifest) : this.fileStore.loadManifest();
    this.initialization = source.then(manifest => this.setupManifest(manifest)).catch(error => {
      this.initializationError = error;
      this.publish();
      throw error;
    });
    scene.events?.once?.(globalThis.Phaser?.Scenes?.Events?.SHUTDOWN || "shutdown", this.destroy, this);
  }

  setupManifest(manifest) {
    if (!manifest?.chunks || !Array.isArray(manifest.chunkIds)) throw new TypeError("Invalid city chunk manifest.");
    this.manifest = manifest;
    this.index ||= new ChunkSpatialIndex(manifest);
    this.records = new Map(manifest.chunkIds.map(id => [id, {
      id,
      state: CHUNK_STREAM_STATES.UNLOADED,
      loadState: this.index.isResident?.(id) ? CHUNK_LOAD_STATES.RESIDENT : CHUNK_LOAD_STATES.UNLOADED,
      lastTouchedTick: -1,
      error: null
    }]));
    this.deltaStore = new ChunkDeltaStore(this.scene, manifest);
    this.initialized = true;
    const focus = this.pendingFocus || { ...this.focus(), ...this.velocity() };
    this.pendingFocus = null;
    this.updateFocus(focus.x, focus.y, { velocityX: focus.velocityX, velocityY: focus.velocityY, force: true });
    return this;
  }

  focus() { return this.scene.renderFocus?.() || this.scene.player || { x: 0, y: 0 }; }
  velocity() {
    const vehicle = this.scene.vehicleSystem?.currentVehicle?.();
    return vehicle ? { velocityX: finite(vehicle.velocityX), velocityY: finite(vehicle.velocityY) } : { velocityX: 0, velocityY: 0 };
  }

  chunkIdsAround(column, row, radius) {
    if (!this.manifest) return [];
    const ids = [];
    for (let y = Math.max(0, row - radius); y <= Math.min(this.manifest.rows - 1, row + radius); y++) {
      for (let x = Math.max(0, column - radius); x <= Math.min(this.manifest.columns - 1, column + radius); x++) ids.push(chunkId(x, y));
    }
    return ids;
  }

  predictiveIds(x, y, velocityX, velocityY) {
    if (!this.manifest || Math.hypot(finite(velocityX), finite(velocityY)) < 40) return [];
    const future = chunkCoordinatesAt(finite(x) + finite(velocityX) * 1.35, finite(y) + finite(velocityY) * 1.35, this.manifest.chunkSize);
    return this.chunkIdsAround(future.column, future.row, 1);
  }

  setState(id, state) {
    const record = this.records.get(String(id));
    if (!record || record.state === state) return;
    const previous = record.state;
    if (desiredState(previous) && !desiredState(state)) this.deltaStore?.captureChunk?.(id);
    record.state = state;
    record.lastTouchedTick = this.tick;
    this.transitions.push({ tick: this.tick, id, from: previous, to: state });
    if (this.transitions.length > 48) this.transitions.shift();
    if (state === CHUNK_STREAM_STATES.UNLOADED) {
      this.index?.evictChunk?.(id);
      this.setLoadState(id, this.fileStore.has?.(id) ? CHUNK_LOAD_STATES.CACHED : CHUNK_LOAD_STATES.UNLOADED);
    }
  }

  setLoadState(id, state, error = null) {
    const record = this.records.get(String(id));
    if (!record) return;
    record.loadState = state;
    record.error = error ? String(error.message || error) : null;
  }

  updateFocus(x, y, { velocityX = 0, velocityY = 0, force = false } = {}) {
    if (!this.manifest) {
      this.pendingFocus = { x: finite(x), y: finite(y), velocityX: finite(velocityX), velocityY: finite(velocityY) };
      return false;
    }
    const coords = chunkCoordinatesAt(x, y, this.manifest.chunkSize);
    const center = chunkId(Math.min(this.manifest.columns - 1, coords.column), Math.min(this.manifest.rows - 1, coords.row));
    const active = new Set(this.chunkIdsAround(coords.column, coords.row, this.activeRadius));
    const prefetched = new Set(this.chunkIdsAround(coords.column, coords.row, this.prefetchRadius));
    for (const id of this.predictiveIds(x, y, velocityX, velocityY)) prefetched.add(id);
    for (const id of active) prefetched.delete(id);
    const key = `${center}:${sorted(active)}:${sorted(prefetched)}`;
    if (!force && key === this.lastDesiredKey) return false;
    this.tick++;
    this.centerChunkId = center;
    this.activeChunkIds = active;
    this.prefetchedChunkIds = prefetched;
    this.lastDesiredKey = key;
    for (const id of this.manifest.chunkIds) {
      const record = this.records.get(id);
      if (active.has(id)) { this.setState(id, CHUNK_STREAM_STATES.ACTIVE); record.lastTouchedTick = this.tick; }
      else if (prefetched.has(id)) { this.setState(id, CHUNK_STREAM_STATES.PREFETCHED); record.lastTouchedTick = this.tick; }
      else if (desiredState(record.state)) this.setState(id, CHUNK_STREAM_STATES.DORMANT);
      else if (record.state === CHUNK_STREAM_STATES.DORMANT && this.tick - record.lastTouchedTick >= this.dormantRetention) this.setState(id, CHUNK_STREAM_STATES.UNLOADED);
    }
    this.scheduleLoads();
    this.publish();
    return true;
  }

  desiredChunkIds() { return new Set([...this.activeChunkIds, ...this.prefetchedChunkIds]); }

  scheduleLoads() {
    const desired = this.desiredChunkIds();
    this.fileStore.cancelExcept?.(desired);
    for (const id of [...this.activeChunkIds, ...this.prefetchedChunkIds]) this.requestChunk(id);
    this.trimCache(desired);
  }

  requestChunk(id) {
    const key = String(id);
    if (this.index?.isResident?.(key)) { this.setLoadState(key, CHUNK_LOAD_STATES.RESIDENT); return Promise.resolve(this.fileStore.peek?.(key)); }
    if (this.activationQueue.has(key)) return Promise.resolve(this.activationQueue.get(key));
    if (this.loadPromises.has(key)) return this.loadPromises.get(key);
    const cached = this.fileStore.peek?.(key);
    if (cached) { this.enqueue(key, cached); return Promise.resolve(cached); }
    this.setLoadState(key, CHUNK_LOAD_STATES.LOADING);
    const promise = this.fileStore.loadChunk(key).then(payload => {
      if (desiredState(this.records.get(key)?.state)) this.enqueue(key, payload);
      else this.setLoadState(key, CHUNK_LOAD_STATES.CACHED);
      return payload;
    }).catch(error => {
      if (error?.name === "AbortError") this.setLoadState(key, this.fileStore.has?.(key) ? CHUNK_LOAD_STATES.CACHED : CHUNK_LOAD_STATES.UNLOADED);
      else this.setLoadState(key, CHUNK_LOAD_STATES.ERROR, error);
      this.publish();
      return null;
    }).finally(() => this.loadPromises.delete(key));
    this.loadPromises.set(key, promise);
    return promise;
  }

  enqueue(id, payload) {
    if (!payload) return;
    this.activationQueue.set(String(id), payload);
    this.setLoadState(id, CHUNK_LOAD_STATES.QUEUED);
  }

  trimCache(retained = this.desiredChunkIds()) {
    for (const id of this.fileStore.trim?.(retained) || []) {
      if (!retained.has(id)) { this.index?.evictChunk?.(id); this.setLoadState(id, CHUNK_LOAD_STATES.UNLOADED); }
    }
  }

  processActivationQueue() {
    const entries = [...this.activationQueue.entries()].sort(([a], [b]) => (this.activeChunkIds.has(a) ? 0 : 1) - (this.activeChunkIds.has(b) ? 0 : 1) || a.localeCompare(b));
    let activated = 0;
    for (const [id, payload] of entries) {
      if (activated >= this.activationBudget) break;
      this.activationQueue.delete(id);
      if (!desiredState(this.records.get(id)?.state)) { this.setLoadState(id, CHUNK_LOAD_STATES.CACHED); continue; }
      this.index.hydrateChunk(id, payload.collections);
      this.setLoadState(id, CHUNK_LOAD_STATES.RESIDENT);
      activated++;
    }
    if (activated) {
      this.trimCache();
      this.scene.redrawLayer?.();
      this.scene.npcSystem?.rebuildSpatialIndex?.();
      this.publish();
    }
    return activated;
  }

  update() {
    if (!this.initialized) return false;
    const focus = this.focus();
    const changed = this.updateFocus(focus.x, focus.y, this.velocity());
    return this.processActivationQueue() > 0 || changed;
  }

  stateOf(id) { return this.records.get(String(id))?.state || CHUNK_STREAM_STATES.UNLOADED; }
  loadStateOf(id) { return this.records.get(String(id))?.loadState || CHUNK_LOAD_STATES.UNLOADED; }
  isChunkActive(id) { return this.activeChunkIds.has(String(id)); }
  isChunkResident(id) { return Boolean(this.index?.isResident?.(String(id))); }
  isPointActive(x, y) { return this.manifest ? this.isChunkActive(chunkIdAt(x, y, this.manifest.chunkSize)) : false; }
  isPointReady(x, y) { return this.manifest ? this.isChunkResident(chunkIdAt(x, y, this.manifest.chunkSize)) : false; }

  availableChunkIds(includePrefetched = false) {
    const ids = includePrefetched ? [...this.activeChunkIds, ...this.prefetchedChunkIds] : [...this.activeChunkIds];
    return new Set(ids.filter(id => this.index?.isResident?.(id)));
  }

  query(category, bounds, { includePrefetched = true, margin = 0, predicate = null } = {}) {
    if (!this.manifest || !this.index) return [];
    const available = this.availableChunkIds(includePrefetched);
    const ids = chunkIdsForBounds(bounds, this.manifest.world, this.manifest.chunkSize).filter(id => available.has(id));
    return this.index.query(category, bounds, { chunkIds: ids, margin, predicate });
  }

  queryPoint(category, x, y, radius = 0, options = {}) {
    const value = Math.max(0, finite(radius));
    return this.query(category, { x: finite(x) - value, y: finite(y) - value, w: Math.max(1, value * 2), h: Math.max(1, value * 2) }, options);
  }

  inspectBounds(bounds, includePrefetched = false) {
    if (!this.index) return {};
    return Object.fromEntries(this.index.categories().map(category => [category, this.query(category, bounds, { includePrefetched }).length]));
  }

  isReady(ids = this.activeChunkIds) { return Boolean(this.initialized && [...ids].every(id => this.index?.isResident?.(id))); }

  waitUntilReady(ids = null, timeoutMs = 8000) {
    const target = new Set(ids ? [...ids].map(String) : [...this.activeChunkIds]);
    const started = Date.now();
    return new Promise((resolve, reject) => {
      const poll = () => {
        const failed = [...target].find(id => this.loadStateOf(id) === CHUNK_LOAD_STATES.ERROR);
        if (failed) reject(new Error(this.records.get(failed)?.error || `Failed loading ${failed}`));
        else if (this.isReady(target)) resolve(this.snapshot());
        else if (Date.now() - started >= timeoutMs) reject(new Error(`Timed out loading city chunks: ${[...target].join(", ")}`));
        else setTimeout(poll, 16);
      };
      poll();
    });
  }

  forceFocus(x, y, velocityX = 0, velocityY = 0) {
    const apply = async () => {
      this.updateFocus(x, y, { velocityX, velocityY, force: true });
      await Promise.all([...this.desiredChunkIds()].map(id => this.requestChunk(id)));
      while (this.activationQueue.size) this.processActivationQueue();
      return this.waitUntilReady();
    };
    return this.initialized ? apply() : this.initialization.then(apply);
  }

  snapshot() {
    if (!this.manifest) return {
      ready: false,
      manifestId: null,
      initializationError: this.initializationError ? String(this.initializationError.message || this.initializationError) : null,
      counts: Object.fromEntries(Object.values(CHUNK_STREAM_STATES).map(state => [state, 0])),
      loadCounts: Object.fromEntries(Object.values(CHUNK_LOAD_STATES).map(state => [state, 0])),
      activationQueue: [],
      source: this.fileStore.snapshot?.() || null
    };
    const states = Object.fromEntries(Object.values(CHUNK_STREAM_STATES).map(state => [state, []]));
    const loadStates = Object.fromEntries(Object.values(CHUNK_LOAD_STATES).map(state => [state, []]));
    for (const record of this.records.values()) { states[record.state].push(record.id); loadStates[record.loadState].push(record.id); }
    for (const ids of [...Object.values(states), ...Object.values(loadStates)]) ids.sort();
    const loaded = [...this.availableChunkIds(true)];
    return {
      ready: this.isReady(), manifestId: this.manifest.id, manifestVersion: this.manifest.version,
      chunkSize: this.manifest.chunkSize, grid: { columns: this.manifest.columns, rows: this.manifest.rows, total: this.manifest.chunkIds.length },
      centerChunkId: this.centerChunkId, tick: this.tick, activeRadius: this.activeRadius, prefetchRadius: this.prefetchRadius,
      activationBudget: this.activationBudget, states, loadStates,
      counts: Object.fromEntries(Object.entries(states).map(([state, ids]) => [state, ids.length])),
      loadCounts: Object.fromEntries(Object.entries(loadStates).map(([state, ids]) => [state, ids.length])),
      residentChunkIds: sorted(this.index.residentChunkIds()), activationQueue: [...this.activationQueue.keys()],
      loadedCategoryCounts: this.index.snapshot(loaded), source: this.fileStore.snapshot?.() || null,
      deltas: this.deltaStore?.snapshot?.() || null, recentTransitions: this.transitions.slice(-12)
    };
  }

  publish() {
    const snapshot = this.snapshot();
    const text = snapshot.manifestId
      ? `Chunks ${snapshot.counts.active} active · ${snapshot.loadCounts.resident} resident · ${snapshot.activationQueue.length} queued`
      : snapshot.initializationError ? "City chunks failed to initialize" : "City manifest loading";
    this.scene.statePublisher?.setMany?.({ cityStreamText: text, cityStreamState: snapshot });
    if (typeof window !== "undefined") window.NBD_CITY_STREAM_READY = Boolean(snapshot.ready);
    return snapshot;
  }

  installBrowserApi() {
    if (typeof window === "undefined") return;
    window.NBD_CITY_STREAM = Object.freeze({
      snapshot: () => this.snapshot(), stateOf: id => this.stateOf(id), loadStateOf: id => this.loadStateOf(id),
      chunkIdAt: (x, y) => this.manifest ? chunkIdAt(x, y, this.manifest.chunkSize) : null,
      inspectBounds: (bounds, includePrefetched = false) => this.inspectBounds(bounds, includePrefetched),
      forceFocus: (x, y, vx = 0, vy = 0) => this.forceFocus(x, y, vx, vy),
      waitUntilReady: () => this.initialization.then(() => this.waitUntilReady()),
      deltaSnapshot: () => this.deltaStore?.snapshot?.() || null
    });
    window.NBD_CITY_STREAM_READY = false;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const id of this.manifest?.chunkIds || []) this.deltaStore?.captureChunk?.(id);
    this.fileStore?.destroy?.();
    this.index?.clear?.();
    this.deltaStore?.destroy?.();
    this.records.clear();
    this.activationQueue.clear();
    this.loadPromises.clear();
    if (typeof window !== "undefined") { delete window.NBD_CITY_STREAM; window.NBD_CITY_STREAM_READY = false; }
  }
}
