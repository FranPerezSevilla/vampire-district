import { chunkCoordinatesAt, chunkId, chunkIdAt, chunkIdsForBounds } from "./CityChunkManifest.js";
import { createCurrentCityChunkIndex, currentCityChunkManifest } from "./CurrentCityChunks.js";

export const CHUNK_STREAM_STATES = Object.freeze({
  UNLOADED: "unloaded",
  PREFETCHED: "prefetched",
  ACTIVE: "active",
  DORMANT: "dormant"
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function setKey(values) {
  return sorted(values).join("|");
}

export class ChunkStreamSystem {
  constructor(scene, {
    manifest = currentCityChunkManifest,
    index = createCurrentCityChunkIndex(),
    activeRadius = 1,
    prefetchRadius = 2,
    dormantRetention = 2
  } = {}) {
    if (!scene) throw new TypeError("ChunkStreamSystem requires a scene.");
    this.scene = scene;
    this.manifest = manifest;
    this.index = index;
    this.activeRadius = Math.max(0, Math.floor(finite(activeRadius, 1)));
    this.prefetchRadius = Math.max(this.activeRadius, Math.floor(finite(prefetchRadius, 2)));
    this.dormantRetention = Math.max(0, Math.floor(finite(dormantRetention, 2)));
    this.tick = 0;
    this.centerChunkId = null;
    this.activeChunkIds = new Set();
    this.prefetchedChunkIds = new Set();
    this.transitionLog = [];
    this.lastDesiredKey = "";
    this.records = new Map(this.manifest.chunkIds.map(id => [id, {
      id,
      state: CHUNK_STREAM_STATES.UNLOADED,
      lastTouchedTick: -1,
      transitions: 0
    }]));

    const focus = this.focus();
    this.updateFocus(focus.x, focus.y, { force: true });
    this.publish();
    scene.events?.once?.(globalThis.Phaser?.Scenes?.Events?.SHUTDOWN || "shutdown", this.destroy, this);
  }

  focus() {
    return this.scene.renderFocus?.() || this.scene.player || { x: 0, y: 0 };
  }

  velocity() {
    const vehicle = this.scene.vehicleSystem?.currentVehicle?.();
    if (!vehicle) return { x: 0, y: 0 };
    return { x: finite(vehicle.velocityX), y: finite(vehicle.velocityY) };
  }

  chunkIdsAround(column, row, radius) {
    const ids = [];
    for (let y = Math.max(0, row - radius); y <= Math.min(this.manifest.rows - 1, row + radius); y++) {
      for (let x = Math.max(0, column - radius); x <= Math.min(this.manifest.columns - 1, column + radius); x++) {
        ids.push(chunkId(x, y));
      }
    }
    return ids;
  }

  predictiveIds(x, y, velocityX, velocityY) {
    const speed = Math.hypot(finite(velocityX), finite(velocityY));
    if (speed < 40) return [];
    const lookAheadSeconds = 1.35;
    const futureX = finite(x) + finite(velocityX) * lookAheadSeconds;
    const futureY = finite(y) + finite(velocityY) * lookAheadSeconds;
    const future = chunkCoordinatesAt(futureX, futureY, this.manifest.chunkSize);
    return this.chunkIdsAround(future.column, future.row, 1);
  }

  transition(id, state) {
    const record = this.records.get(id);
    if (!record || record.state === state) return false;
    const previous = record.state;
    record.state = state;
    record.lastTouchedTick = this.tick;
    record.transitions++;
    this.transitionLog.push({ tick: this.tick, id, from: previous, to: state });
    if (this.transitionLog.length > 48) this.transitionLog.shift();
    return true;
  }

  updateFocus(x, y, { velocityX = 0, velocityY = 0, force = false } = {}) {
    const coordinates = chunkCoordinatesAt(x, y, this.manifest.chunkSize);
    const center = chunkId(
      Math.min(this.manifest.columns - 1, coordinates.column),
      Math.min(this.manifest.rows - 1, coordinates.row)
    );
    const active = new Set(this.chunkIdsAround(coordinates.column, coordinates.row, this.activeRadius));
    const prefetched = new Set(this.chunkIdsAround(coordinates.column, coordinates.row, this.prefetchRadius));
    for (const id of this.predictiveIds(x, y, velocityX, velocityY)) prefetched.add(id);
    for (const id of active) prefetched.delete(id);
    const desiredKey = `${center}::${setKey(active)}::${setKey(prefetched)}`;
    if (!force && desiredKey === this.lastDesiredKey) return false;

    this.tick++;
    this.centerChunkId = center;
    this.lastDesiredKey = desiredKey;
    this.activeChunkIds = active;
    this.prefetchedChunkIds = prefetched;

    for (const id of this.manifest.chunkIds) {
      const record = this.records.get(id);
      if (active.has(id)) {
        this.transition(id, CHUNK_STREAM_STATES.ACTIVE);
        record.lastTouchedTick = this.tick;
      } else if (prefetched.has(id)) {
        this.transition(id, CHUNK_STREAM_STATES.PREFETCHED);
        record.lastTouchedTick = this.tick;
      } else if ([CHUNK_STREAM_STATES.ACTIVE, CHUNK_STREAM_STATES.PREFETCHED].includes(record.state)) {
        this.transition(id, CHUNK_STREAM_STATES.DORMANT);
      } else if (record.state === CHUNK_STREAM_STATES.DORMANT
        && this.tick - record.lastTouchedTick > this.dormantRetention) {
        this.transition(id, CHUNK_STREAM_STATES.UNLOADED);
      }
    }

    this.publish();
    return true;
  }

  update() {
    const focus = this.focus();
    const velocity = this.velocity();
    return this.updateFocus(focus.x, focus.y, { velocityX: velocity.x, velocityY: velocity.y });
  }

  stateOf(id) {
    return this.records.get(String(id))?.state || CHUNK_STREAM_STATES.UNLOADED;
  }

  isChunkActive(id) {
    return this.activeChunkIds.has(String(id));
  }

  isPointActive(x, y) {
    return this.isChunkActive(chunkIdAt(x, y, this.manifest.chunkSize));
  }

  availableChunkIds(includePrefetched = false) {
    return includePrefetched
      ? new Set([...this.activeChunkIds, ...this.prefetchedChunkIds])
      : new Set(this.activeChunkIds);
  }

  query(category, bounds, { includePrefetched = false, margin = 0, predicate = null } = {}) {
    const available = this.availableChunkIds(includePrefetched);
    const ids = chunkIdsForBounds(bounds, this.manifest.world, this.manifest.chunkSize)
      .filter(id => available.has(id));
    return this.index.query(category, bounds, { chunkIds: ids, margin, predicate });
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

  inspectBounds(bounds, includePrefetched = false) {
    return Object.fromEntries(this.index.categories().map(category => [
      category,
      this.query(category, bounds, { includePrefetched }).length
    ]));
  }

  snapshot() {
    const byState = Object.fromEntries(Object.values(CHUNK_STREAM_STATES).map(state => [state, []]));
    for (const record of this.records.values()) byState[record.state].push(record.id);
    for (const ids of Object.values(byState)) ids.sort((left, right) => left.localeCompare(right));
    const loaded = [...this.activeChunkIds, ...this.prefetchedChunkIds];
    return {
      manifestId: this.manifest.id,
      chunkSize: this.manifest.chunkSize,
      grid: { columns: this.manifest.columns, rows: this.manifest.rows, total: this.manifest.chunkIds.length },
      centerChunkId: this.centerChunkId,
      tick: this.tick,
      activeRadius: this.activeRadius,
      prefetchRadius: this.prefetchRadius,
      states: byState,
      counts: Object.fromEntries(Object.entries(byState).map(([state, ids]) => [state, ids.length])),
      loadedCategoryCounts: this.index.snapshot(loaded),
      recentTransitions: this.transitionLog.slice(-12)
    };
  }

  publish() {
    const snapshot = this.snapshot();
    this.scene.statePublisher?.setMany?.({
      cityStreamText: `Chunks ${snapshot.counts.active} active · ${snapshot.counts.prefetched} prefetched · ${snapshot.counts.dormant} dormant`,
      cityStreamState: snapshot
    });
    if (typeof window !== "undefined") {
      window.NBD_CITY_STREAM = Object.freeze({
        snapshot: () => this.snapshot(),
        stateOf: id => this.stateOf(id),
        chunkIdAt: (x, y) => chunkIdAt(x, y, this.manifest.chunkSize),
        inspectBounds: (bounds, includePrefetched = false) => this.inspectBounds(bounds, includePrefetched),
        forceFocus: (x, y, velocityX = 0, velocityY = 0) => this.updateFocus(x, y, { velocityX, velocityY, force: true })
      });
      window.NBD_CITY_STREAM_READY = true;
    }
    return snapshot;
  }

  destroy() {
    this.activeChunkIds.clear();
    this.prefetchedChunkIds.clear();
    this.records.clear();
    if (typeof window !== "undefined") {
      if (window.NBD_CITY_STREAM) delete window.NBD_CITY_STREAM;
      window.NBD_CITY_STREAM_READY = false;
    }
  }
}
