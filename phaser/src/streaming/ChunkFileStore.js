import { bootAssets } from "../boot/BootAssets.js";
function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function defaultBaseUrl() {
  if (typeof document !== "undefined" && document.baseURI) return document.baseURI;
  return "http://localhost/";
}

function resolveUrl(value, base = defaultBaseUrl()) {
  return new URL(String(value || ""), base).toString();
}

function abortError() {
  const error = new Error("Chunk request aborted.");
  error.name = "AbortError";
  return error;
}

function sleep(ms, signal) {
  const delay = Math.max(0, finite(ms));
  if (!delay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(resolve, delay);
    signal?.addEventListener?.("abort", () => {
      clearTimeout(timer);
      reject(abortError());
    }, { once: true });
  });
}

export const DEFAULT_CITY_MANIFEST_URL = new URL("../../assets/city/current/manifest.json", import.meta.url).toString();

export class ChunkFileStore {
  constructor({
    manifestUrl = DEFAULT_CITY_MANIFEST_URL,
    fetchImpl = globalThis.fetch?.bind?.(globalThis),
    maxRetries = 2,
    retryDelayMs = 40,
    cacheLimit = 12,
    maxConcurrent = 4,
    requestTimeoutMs = 4000,
    seed = bootAssets?.city
  } = {}) {
    if (typeof fetchImpl !== "function") throw new TypeError("ChunkFileStore requires fetch().");
    this.manifestUrl = resolveUrl(manifestUrl);
    this.fetchImpl = fetchImpl;
    this.maxRetries = Math.max(0, Math.floor(finite(maxRetries, 2)));
    this.retryDelayMs = Math.max(0, finite(retryDelayMs, 40));
    this.cacheLimit = Math.max(1, Math.floor(finite(cacheLimit, 12)));
    this.requestTimeoutMs = Math.max(1, finite(requestTimeoutMs, 4000));
    this.maxConcurrent = Math.max(1, Math.floor(finite(maxConcurrent, 4)));
    this.pendingRequests = [];
    this.activeRequests = 0;
    this.destroyed = false;
    this.manifestPromise = null;
    this.seed = this.manifestUrl === DEFAULT_CITY_MANIFEST_URL ? seed : null;
    this.manifest = this.seed?.manifest || null;
    this.cache = new Map();
    this.inFlight = new Map();
    this.evicted = [];
    for (const [id, payload] of Object.entries(this.seed?.chunks || {})) {
      if (!this.manifest?.chunks?.[id] || payload.id !== id || !payload.collections) throw new Error(`Invalid initial city seed: ${id}`);
      this.cache.set(id, payload);
    }
    this.stats = {
      manifestRequests: 0,
      chunkRequests: 0,
      cacheHits: 0,
      retries: 0,
      cancellations: 0,
      failures: 0,
      evictions: 0
    };
  }

  async requestJson(url, { signal = null, attempts = this.maxRetries + 1 } = {}) {
    let lastError = null;
    for (let attempt = 0; attempt < Math.max(1, attempts); attempt++) {
      if (signal?.aborted) throw abortError();
      try {
        return await this.fetchJson(url, signal);
      } catch (error) {
        if (signal?.aborted || error?.name === "AbortError") throw error;
        lastError = error;
        if (attempt + 1 >= attempts) break;
        this.stats.retries++;
        await sleep(this.retryDelayMs * (attempt + 1), signal);
      }
    }
    this.stats.failures++;
    throw lastError || new Error(`Unable to load ${url}`);
  }

  fetchJson(url, signal) {
    return new Promise((resolve, reject) => {
      const item = { url, signal, resolve, reject, started: false };
      const cancel = () => {
        if (item.started) return;
        this.pendingRequests = this.pendingRequests.filter(value => value !== item);
        reject(abortError());
      };
      item.cleanup = () => signal?.removeEventListener?.("abort", cancel);
      if (this.destroyed || signal?.aborted) { reject(abortError()); return; }
      signal?.addEventListener?.("abort", cancel, { once: true });
      this.pendingRequests.push(item);
      this.pumpRequests();
    });
  }

  pumpRequests() {
    while (this.activeRequests < this.maxConcurrent && this.pendingRequests.length) {
      const item = this.pendingRequests.shift();
      item.cleanup();
      if (this.destroyed || item.signal?.aborted) { item.reject(abortError()); continue; }
      item.started = true;
      this.activeRequests++;
      const controller = new AbortController();
      let timer, abort;
      const interrupted = new Promise((_, reject) => {
        abort = () => { controller.abort(); reject(abortError()); };
        item.signal?.addEventListener?.("abort", abort, { once: true });
        timer = setTimeout(() => { controller.abort(); reject(new Error(`City request timed out: ${item.url}`)); }, this.requestTimeoutMs);
      });
      const request = (async () => {
        const response = await this.fetchImpl(item.url, { signal: controller.signal, cache: "default" });
        if (!response?.ok) throw new Error(`HTTP ${response?.status || 0} while loading ${item.url}`);
        return response.json();
      })();
      Promise.race([request, interrupted]).then(item.resolve, item.reject).finally(() => {
        clearTimeout(timer);
        item.signal?.removeEventListener?.("abort", abort);
        this.activeRequests--;
        this.pumpRequests();
      });
    }
  }

  loadManifest() {
    if (this.destroyed) return Promise.reject(abortError());
    if (this.manifest) return Promise.resolve(this.manifest);
    if (this.manifestPromise) return this.manifestPromise;
    this.stats.manifestRequests++;
    this.manifestController = new AbortController();
    this.manifestPromise = this.requestJson(this.manifestUrl, { signal: this.manifestController.signal }).then(manifest => {
      if (this.destroyed) throw abortError();
      if (!manifest?.chunks || !Array.isArray(manifest.chunkIds)) throw new TypeError("City chunk manifest is malformed.");
      this.manifest = manifest;
      return manifest;
    }).catch(error => { this.manifestPromise = null; throw error; });
    return this.manifestPromise;
  }

  chunkUrl(id) {
    const record = this.manifest?.chunks?.[String(id)];
    if (!record?.file) throw new Error(`Manifest has no file for chunk ${id}.`);
    const url = new URL(resolveUrl(record.file, this.manifestUrl));
    if (this.seed?.version) url.searchParams.set("v", this.seed.version);
    return url.href;
  }

  touch(id, payload) {
    const key = String(id);
    this.cache.delete(key);
    this.cache.set(key, payload);
    return payload;
  }

  has(id) {
    return this.cache.has(String(id));
  }

  peek(id) {
    return this.cache.get(String(id)) || null;
  }

  loadChunk(id) {
    if (this.destroyed) return Promise.reject(abortError());
    const key = String(id);
    const cached = this.cache.get(key);
    if (cached) {
      this.stats.cacheHits++;
      return Promise.resolve(this.touch(key, cached));
    }
    const existing = this.inFlight.get(key);
    if (existing) return existing.promise;
    if (!this.manifest) return this.loadManifest().then(() => this.loadChunk(key));

    const controller = new AbortController();
    const request = { controller, promise: null };
    this.stats.chunkRequests++;
    const promise = this.requestJson(this.chunkUrl(key), { signal: controller.signal })
      .then(payload => {
        if (String(payload?.id) !== key || !payload?.collections) {
          throw new TypeError(`Chunk payload ${key} is malformed.`);
        }
        if (this.destroyed || controller.signal.aborted) throw abortError();
        return this.touch(key, payload);
      })
      .finally(() => {
        if (this.inFlight.get(key) === request) this.inFlight.delete(key);
      });
    request.promise = promise;
    this.inFlight.set(key, request);
    return promise;
  }

  cancel(id) {
    const key = String(id);
    const request = this.inFlight.get(key);
    if (!request) return false;
    this.stats.cancellations++;
    request.controller.abort();
    this.inFlight.delete(key);
    return true;
  }

  cancelExcept(retainedIds = []) {
    const retained = new Set([...retainedIds].map(String));
    const cancelled = [];
    for (const id of this.inFlight.keys()) {
      if (retained.has(id)) continue;
      if (this.cancel(id)) cancelled.push(id);
    }
    return cancelled;
  }

  trim(retainedIds = []) {
    const retained = new Set([...retainedIds].map(String));
    const evicted = [];
    while (this.cache.size > this.cacheLimit) {
      const candidate = [...this.cache.keys()].find(id => !retained.has(id));
      if (!candidate) break;
      this.cache.delete(candidate);
      this.stats.evictions++;
      evicted.push(candidate);
      this.evicted.push(candidate);
    }
    return evicted;
  }

  takeEvictions() {
    const result = this.evicted.splice(0);
    return result;
  }

  snapshot() {
    return {
      manifestUrl: this.manifestUrl,
      cacheLimit: this.cacheLimit,
      cached: [...this.cache.keys()],
      inFlight: [...this.inFlight.keys()],
      seeded: Object.keys(this.seed?.chunks || {}).length,
      activeRequests: this.activeRequests, queuedRequests: this.pendingRequests.length,
      stats: { ...this.stats }
    };
  }

  destroy() {
    this.destroyed = true;
    this.manifestController?.abort();
    for (const id of [...this.inFlight.keys()]) this.cancel(id);
    this.cache.clear();
    this.manifest = null;
  }
}
