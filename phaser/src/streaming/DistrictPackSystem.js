function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function sorted(values) {
  return [...values].sort((left, right) => String(left).localeCompare(String(right)));
}

function pointInBounds(x, y, bounds) {
  return Boolean(bounds
    && x >= bounds.x
    && x < bounds.x + bounds.w
    && y >= bounds.y
    && y < bounds.y + bounds.h);
}

function distanceToRect(x, y, rect) {
  const dx = Math.max(rect.x - x, 0, x - (rect.x + rect.w));
  const dy = Math.max(rect.y - y, 0, y - (rect.y + rect.h));
  return Math.hypot(dx, dy);
}

export const DISTRICT_PACK_STATES = Object.freeze({
  UNLOADED: "unloaded",
  LOADING: "loading",
  QUEUED: "queued",
  RESIDENT: "resident",
  ERROR: "error"
});

export const DEFAULT_DISTRICT_PACK_MANIFEST_URL = new URL(
  "../../assets/city/packs/manifest.json",
  import.meta.url
).toString();

export class DistrictPackSystem {
  constructor(scene, {
    manifestUrl = DEFAULT_DISTRICT_PACK_MANIFEST_URL,
    fetchImpl = globalThis.fetch?.bind?.(globalThis),
    cacheLimit = 6,
    activationBudget = 1,
    maxRetries = 2
  } = {}) {
    if (!scene?.cityStreamSystem) throw new TypeError("DistrictPackSystem requires ChunkStreamSystem.");
    if (typeof fetchImpl !== "function") throw new TypeError("DistrictPackSystem requires fetch().");
    this.scene = scene;
    this.city = scene.cityStreamSystem;
    this.manifestUrl = new URL(String(manifestUrl), globalThis.document?.baseURI || import.meta.url).toString();
    this.fetchImpl = fetchImpl;
    this.cacheLimit = Math.max(1, Math.floor(finite(cacheLimit, 6)));
    this.activationBudget = Math.max(1, Math.floor(finite(activationBudget, 1)));
    this.maxRetries = Math.max(0, Math.floor(finite(maxRetries, 2)));
    this.manifest = null;
    this.records = new Map();
    this.cache = new Map();
    this.inFlight = new Map();
    this.activationQueue = new Map();
    this.desiredPackIds = new Set();
    this.activePackId = null;
    this.predictivePackId = null;
    this.lastDesiredKey = "";
    this.destroyed = false;
    this.stats = {
      manifestRequests: 0,
      packRequests: 0,
      cacheHits: 0,
      retries: 0,
      cancellations: 0,
      failures: 0,
      evictions: 0,
      activations: 0
    };
    this.installBrowserApi();
    this.initialization = this.loadManifest().then(() => {
      this.update(true);
      return this;
    }).catch(error => {
      this.initializationError = error;
      this.publish();
      throw error;
    });
    scene.events?.once?.(globalThis.Phaser?.Scenes?.Events?.SHUTDOWN || "shutdown", this.destroy, this);
  }

  async requestJson(url, signal = null) {
    let lastError = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.fetchImpl(url, { signal, cache: "no-store" });
        if (!response?.ok) throw new Error(`HTTP ${response?.status || 0} while loading ${url}`);
        return await response.json();
      } catch (error) {
        if (signal?.aborted || error?.name === "AbortError") throw error;
        lastError = error;
        if (attempt >= this.maxRetries) break;
        this.stats.retries++;
      }
    }
    this.stats.failures++;
    throw lastError || new Error(`Unable to load ${url}`);
  }

  async loadManifest() {
    this.stats.manifestRequests++;
    const manifest = await this.requestJson(this.manifestUrl);
    if (!manifest?.packs || !Array.isArray(manifest.packIds)) {
      throw new TypeError("District pack manifest is malformed.");
    }
    this.manifest = manifest;
    this.records = new Map(manifest.packIds.map(id => [id, {
      id,
      state: DISTRICT_PACK_STATES.UNLOADED,
      error: null,
      transitions: 0
    }]));
    return manifest;
  }

  record(id) {
    return this.records.get(String(id)) || null;
  }

  transition(id, state, error = null) {
    const record = this.record(id);
    if (!record) return;
    if (record.state !== state) record.transitions++;
    record.state = state;
    record.error = error ? String(error.message || error) : null;
  }

  focus() {
    return this.scene.renderFocus?.() || this.scene.player || { x: 0, y: 0 };
  }

  packIdAt(x, y) {
    if (!this.manifest) return null;
    const candidates = this.manifest.packIds
      .map(id => this.manifest.packs[id])
      .filter(record => pointInBounds(x, y, record.bounds))
      .sort((left, right) => finite(right.priority) - finite(left.priority));
    return candidates[0]?.id || null;
  }

  packIdsForChunks(chunkIds) {
    if (!this.manifest) return [];
    const chunks = new Set([...chunkIds].map(String));
    return this.manifest.packIds.filter(id => (
      this.manifest.packs[id].chunkIds.some(chunkId => chunks.has(chunkId))
    ));
  }

  nearestRoad(x, y) {
    const roads = this.city.query?.("roads", { x: x - 180, y: y - 180, w: 360, h: 360 }) || [];
    return roads.sort((left, right) => distanceToRect(x, y, left) - distanceToRect(x, y, right))[0] || null;
  }

  roadAwarePredictivePackId() {
    if (!this.manifest) return null;
    const vehicle = this.scene.vehicleSystem?.currentVehicle?.();
    const velocityX = finite(vehicle?.velocityX);
    const velocityY = finite(vehicle?.velocityY);
    const speed = Math.hypot(velocityX, velocityY);
    if (speed < 40) return null;
    const focus = this.focus();
    const road = this.nearestRoad(focus.x, focus.y);
    if (!road) return this.packIdAt(focus.x + velocityX * 2.2, focus.y + velocityY * 2.2);
    const horizontal = finite(road.w) >= finite(road.h);
    const direction = Math.sign(horizontal ? velocityX : velocityY) || 1;
    const lookAhead = Math.max(640, Math.min(1280, speed * 2.4));
    const futureX = horizontal ? focus.x + direction * lookAhead : road.x + road.w / 2;
    const futureY = horizontal ? road.y + road.h / 2 : focus.y + direction * lookAhead;
    return this.packIdAt(futureX, futureY);
  }

  desiredIds() {
    if (!this.manifest || !this.city.manifest) return new Set();
    const desiredChunks = this.city.desiredChunkIds?.() || new Set([
      ...(this.city.activeChunkIds || []),
      ...(this.city.prefetchedChunkIds || [])
    ]);
    const ids = new Set(this.packIdsForChunks(desiredChunks));
    const focus = this.focus();
    this.activePackId = this.packIdAt(focus.x, focus.y);
    this.predictivePackId = this.roadAwarePredictivePackId();
    if (this.activePackId) ids.add(this.activePackId);
    if (this.predictivePackId) ids.add(this.predictivePackId);
    return ids;
  }

  packUrl(id) {
    const record = this.manifest?.packs?.[String(id)];
    if (!record?.file) throw new Error(`District pack ${id} has no file.`);
    return new URL(record.file, this.manifestUrl).toString();
  }

  touch(id, pack) {
    const key = String(id);
    this.cache.delete(key);
    this.cache.set(key, pack);
    return pack;
  }

  requestPack(id) {
    const key = String(id);
    const cached = this.cache.get(key);
    if (cached) {
      this.stats.cacheHits++;
      this.touch(key, cached);
      if (this.record(key)?.state !== DISTRICT_PACK_STATES.RESIDENT) {
        this.activationQueue.set(key, cached);
        this.transition(key, DISTRICT_PACK_STATES.QUEUED);
      }
      return Promise.resolve(cached);
    }
    const existing = this.inFlight.get(key);
    if (existing) return existing.promise;
    const controller = new AbortController();
    const request = { controller, promise: null };
    this.stats.packRequests++;
    this.transition(key, DISTRICT_PACK_STATES.LOADING);
    const promise = this.requestJson(this.packUrl(key), controller.signal)
      .then(pack => {
        if (String(pack?.id) !== key) throw new TypeError(`District pack ${key} is malformed.`);
        this.touch(key, pack);
        if (this.desiredPackIds.has(key)) {
          this.activationQueue.set(key, pack);
          this.transition(key, DISTRICT_PACK_STATES.QUEUED);
        } else {
          this.transition(key, DISTRICT_PACK_STATES.UNLOADED);
        }
        return pack;
      })
      .catch(error => {
        if (error?.name !== "AbortError") this.transition(key, DISTRICT_PACK_STATES.ERROR, error);
        return null;
      })
      .finally(() => {
        if (this.inFlight.get(key) === request) this.inFlight.delete(key);
      });
    request.promise = promise;
    this.inFlight.set(key, request);
    return promise;
  }

  cancelStaleRequests() {
    for (const [id, request] of this.inFlight) {
      if (this.desiredPackIds.has(id)) continue;
      this.stats.cancellations++;
      request.controller.abort();
      this.inFlight.delete(id);
      this.transition(id, DISTRICT_PACK_STATES.UNLOADED);
    }
  }

  processActivationQueue() {
    const entries = [...this.activationQueue.entries()].sort(([left], [right]) => {
      const leftPriority = left === this.activePackId ? 0 : left === this.predictivePackId ? 1 : 2;
      const rightPriority = right === this.activePackId ? 0 : right === this.predictivePackId ? 1 : 2;
      return leftPriority - rightPriority || left.localeCompare(right);
    });
    let activated = 0;
    for (const [id, pack] of entries) {
      if (activated >= this.activationBudget) break;
      this.activationQueue.delete(id);
      if (!this.desiredPackIds.has(id)) continue;
      this.touch(id, pack);
      this.transition(id, DISTRICT_PACK_STATES.RESIDENT);
      this.stats.activations++;
      activated++;
    }
    return activated;
  }

  trimCache() {
    while (this.cache.size > this.cacheLimit) {
      const candidate = [...this.cache.keys()].find(id => !this.desiredPackIds.has(id));
      if (!candidate) break;
      this.cache.delete(candidate);
      this.transition(candidate, DISTRICT_PACK_STATES.UNLOADED);
      this.stats.evictions++;
    }
  }

  update(force = false) {
    if (!this.manifest || this.destroyed) return false;
    const desired = this.desiredIds();
    const key = `${sorted(desired).join("|")}::${this.activePackId || ""}::${this.predictivePackId || ""}`;
    const changed = force || key !== this.lastDesiredKey;
    if (changed) {
      this.lastDesiredKey = key;
      this.desiredPackIds = desired;
      this.cancelStaleRequests();
      for (const id of desired) this.requestPack(id);
    }
    const activated = this.processActivationQueue();
    this.trimCache();
    if (changed || activated) this.publish();
    return changed || Boolean(activated);
  }

  activePack() {
    return this.activePackId ? this.cache.get(this.activePackId) || null : null;
  }

  snapshot() {
    const states = Object.fromEntries(Object.values(DISTRICT_PACK_STATES).map(state => [state, []]));
    for (const record of this.records.values()) states[record.state].push(record.id);
    for (const ids of Object.values(states)) ids.sort();
    return {
      ready: Boolean(this.activePackId && this.record(this.activePackId)?.state === DISTRICT_PACK_STATES.RESIDENT),
      manifestId: this.manifest?.id || null,
      activePackId: this.activePackId,
      predictivePackId: this.predictivePackId,
      desiredPackIds: sorted(this.desiredPackIds),
      cachedPackIds: [...this.cache.keys()],
      inFlightPackIds: [...this.inFlight.keys()],
      activationQueue: [...this.activationQueue.keys()],
      states,
      counts: Object.fromEntries(Object.entries(states).map(([state, ids]) => [state, ids.length])),
      activeProfile: this.activePack(),
      activationBudget: this.activationBudget,
      cacheLimit: this.cacheLimit,
      stats: { ...this.stats }
    };
  }

  publish() {
    const snapshot = this.snapshot();
    const label = snapshot.activeProfile?.name || snapshot.activePackId || "loading";
    this.scene.statePublisher?.setMany?.({
      districtPackText: `District pack · ${label}`,
      districtPackState: snapshot
    });
    this.scene.registry?.set?.("districtPackProfile", snapshot.activeProfile || null);
    if (typeof window !== "undefined") window.NBD_DISTRICT_PACKS_READY = snapshot.ready;
    return snapshot;
  }

  installBrowserApi() {
    if (typeof window === "undefined") return;
    window.NBD_DISTRICT_PACKS = Object.freeze({
      snapshot: () => this.snapshot(),
      active: () => this.activePack(),
      forceUpdate: async () => {
        await this.initialization;
        this.update(true);
        await Promise.all([...this.desiredPackIds].map(id => this.requestPack(id)));
        for (let index = 0; index < Math.max(2, this.desiredPackIds.size + 1); index++) {
          this.update(true);
          if (this.activePackId && this.record(this.activePackId)?.state === DISTRICT_PACK_STATES.RESIDENT) break;
        }
        return this.snapshot();
      }
    });
    window.NBD_DISTRICT_PACKS_READY = false;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const request of this.inFlight.values()) request.controller.abort();
    this.inFlight.clear();
    this.cache.clear();
    this.activationQueue.clear();
    this.records.clear();
    if (typeof window !== "undefined") {
      delete window.NBD_DISTRICT_PACKS;
      window.NBD_DISTRICT_PACKS_READY = false;
    }
  }
}
