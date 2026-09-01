import { RawAudio } from "../systems/RawAudioSystem.js";

const DEFAULT_RADIO_VOLUME = 1.0;
const DEFAULT_MAX_DECODED_BUFFERS = 4;

function defaultFetch() {
  return typeof globalThis.fetch === "function"
    ? globalThis.fetch.bind(globalThis)
    : null;
}

function decodeAudioData(context, encoded) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const succeed = buffer => {
      if (settled) return;
      settled = true;
      resolve(buffer);
    };
    const fail = error => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    try {
      const result = context.decodeAudioData(encoded, succeed, fail);
      if (result?.then) result.then(succeed, fail);
    } catch (error) {
      fail(error);
    }
  });
}

function uniqueTracks(stations = []) {
  const seen = new Set();
  const tracks = [];
  for (const station of stations || []) {
    for (const track of station?.tracks || []) {
      const url = String(track?.src || "");
      if (!url || seen.has(url)) continue;
      seen.add(url);
      tracks.push(track);
    }
  }
  return tracks;
}

export class RadioPlayback {
  constructor(rawAudio = RawAudio, {
    fetchFn = defaultFetch(),
    AudioCtor = globalThis?.Audio,
    maxDecodedBuffers = DEFAULT_MAX_DECODED_BUFFERS
  } = {}) {
    this.rawAudio = rawAudio;
    this.fetchFn = fetchFn;
    this.AudioCtor = AudioCtor;
    this.maxDecodedBuffers = Math.max(1, Number(maxDecodedBuffers) || DEFAULT_MAX_DECODED_BUFFERS);
    this.handle = null;
    this.status = "idle";
    this.trackKey = null;
    this.trackUrl = null;
    this.lastError = null;

    this.encodedCache = new Map();
    this.encodedLoads = new Map();
    this.bufferCache = new Map();
    this.bufferLoads = new Map();
    this.decodedLru = [];
    this.preloadFailures = new Set();
    this.preloadStarted = false;
    this.preloadComplete = false;
    this.preloadTotal = 0;
    this.preloadPromise = null;

    this.rawAudio?.ensureListeners?.();
  }

  preloadCatalog(stations = []) {
    const tracks = uniqueTracks(stations);
    if (!tracks.length || typeof this.fetchFn !== "function") {
      this.preloadStarted = true;
      this.preloadComplete = true;
      this.preloadTotal = tracks.length;
      return Promise.resolve(this.preloadSnapshot());
    }
    if (this.preloadPromise) return this.preloadPromise;

    this.preloadStarted = true;
    this.preloadComplete = false;
    this.preloadTotal = tracks.length;

    // Creating the shared context here is safe even if autoplay policy keeps it
    // suspended. decodeAudioData does not need audible playback, while RawAudio's
    // normal pointer/keyboard bridge resumes the same context before sound starts.
    const ctx = this.rawAudio?.unlock?.();
    const firstTracks = (stations || [])
      .map(station => station?.tracks?.[0])
      .filter(Boolean);

    const fetchJobs = tracks.map(track => this.ensureEncoded(track.src));
    const decodeJobs = ctx
      ? firstTracks.map(track => this.ensureDecoded(track.src, ctx))
      : [];

    this.preloadPromise = Promise.allSettled([...fetchJobs, ...decodeJobs])
      .then(() => {
        this.preloadComplete = true;
        return this.preloadSnapshot();
      });
    return this.preloadPromise;
  }

  preloadSnapshot() {
    return {
      started: this.preloadStarted,
      complete: this.preloadComplete,
      total: this.preloadTotal,
      fetched: this.encodedCache.size,
      decoded: this.bufferCache.size,
      failed: this.preloadFailures.size
    };
  }

  ensureEncoded(url) {
    const normalizedUrl = String(url || "");
    if (!normalizedUrl) return Promise.reject(new Error("Radio track URL is missing."));
    if (this.encodedCache.has(normalizedUrl)) return Promise.resolve(this.encodedCache.get(normalizedUrl));
    if (this.encodedLoads.has(normalizedUrl)) return this.encodedLoads.get(normalizedUrl);
    if (typeof this.fetchFn !== "function") return Promise.reject(new Error("Fetch is unavailable for radio preload."));

    const task = Promise.resolve()
      .then(() => this.fetchFn(normalizedUrl))
      .then(async response => {
        if (!response?.ok) throw new Error(`Radio track HTTP ${response?.status || "error"}: ${normalizedUrl}`);
        const encoded = await response.arrayBuffer();
        this.encodedCache.set(normalizedUrl, encoded);
        this.preloadFailures.delete(normalizedUrl);
        return encoded;
      })
      .catch(error => {
        this.preloadFailures.add(normalizedUrl);
        throw error;
      })
      .finally(() => this.encodedLoads.delete(normalizedUrl));

    this.encodedLoads.set(normalizedUrl, task);
    return task;
  }

  ensureDecoded(url, ctx = this.rawAudio?.ctx || this.rawAudio?.unlock?.()) {
    const normalizedUrl = String(url || "");
    if (!normalizedUrl || !ctx || typeof ctx.decodeAudioData !== "function") {
      return Promise.reject(new Error("Web Audio decoding is unavailable for radio playback."));
    }
    if (this.bufferCache.has(normalizedUrl)) {
      this.touchDecoded(normalizedUrl);
      return Promise.resolve(this.bufferCache.get(normalizedUrl));
    }
    if (this.bufferLoads.has(normalizedUrl)) return this.bufferLoads.get(normalizedUrl);

    const task = this.ensureEncoded(normalizedUrl)
      .then(encoded => decodeAudioData(ctx, encoded.slice(0)))
      .then(buffer => {
        this.bufferCache.set(normalizedUrl, buffer);
        this.touchDecoded(normalizedUrl);
        this.trimDecodedCache();
        return buffer;
      })
      .finally(() => this.bufferLoads.delete(normalizedUrl));

    this.bufferLoads.set(normalizedUrl, task);
    return task;
  }

  prepare(track) {
    const url = String(track?.src || "");
    const ctx = this.rawAudio?.ctx || this.rawAudio?.unlock?.();
    if (!url || !ctx) return Promise.resolve(false);
    return this.ensureDecoded(url, ctx)
      .then(() => true)
      .catch(() => false);
  }

  touchDecoded(url) {
    const index = this.decodedLru.indexOf(url);
    if (index >= 0) this.decodedLru.splice(index, 1);
    this.decodedLru.push(url);
  }

  trimDecodedCache() {
    while (this.bufferCache.size > this.maxDecodedBuffers && this.decodedLru.length) {
      let victimIndex = this.decodedLru.findIndex(url => url !== this.handle?.url);
      if (victimIndex < 0) victimIndex = 0;
      const [victim] = this.decodedLru.splice(victimIndex, 1);
      if (victim) this.bufferCache.delete(victim);
    }
  }

  play(track, { volume = DEFAULT_RADIO_VOLUME, onEnded = null, onError = null } = {}) {
    const url = String(track?.src || "");
    const key = String(track?.id || url || "radio-track");
    const ctx = this.rawAudio?.unlock?.();
    const master = this.rawAudio?.master;
    const canBufferPlayback = Boolean(
      url
      && ctx
      && master
      && typeof this.fetchFn === "function"
      && typeof ctx.createBufferSource === "function"
      && typeof ctx.createGain === "function"
      && typeof ctx.decodeAudioData === "function"
    );

    if (!canBufferPlayback) {
      return this.playMediaElementFallback(track, { volume, onEnded, onError }, ctx, master);
    }

    this.stop();

    const gain = ctx.createGain();
    gain.gain.value = Math.max(0, Math.min(2, Number(volume) || DEFAULT_RADIO_VOLUME));
    gain.connect(master);

    const handle = {
      kind: "buffer",
      source: null,
      gain,
      key,
      url,
      released: false
    };

    this.handle = handle;
    this.trackKey = key;
    this.trackUrl = url;
    this.status = "loading";
    this.lastError = null;

    this.loadAndStart(handle, ctx, { onEnded, onError });
    return true;
  }

  async loadAndStart(handle, ctx, { onEnded, onError }) {
    try {
      if (ctx.state === "suspended" && typeof ctx.resume === "function") {
        await ctx.resume();
      }
      if (this.handle !== handle || handle.released) return;
      if (ctx.state && ctx.state !== "running") {
        this.status = "blocked";
        this.lastError = `AudioContext is ${ctx.state}.`;
        onError?.(new Error(this.lastError));
        return;
      }

      const buffer = await this.ensureDecoded(handle.url, ctx);
      if (this.handle !== handle || handle.released) return;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(handle.gain);
      source.onended = () => {
        if (this.handle !== handle || handle.released) return;
        this.status = "ended";
        this.lastError = null;
        this.releaseHandle(handle, { stopSource: false });
        onEnded?.();
      };
      handle.source = source;
      source.start();
      this.status = "playing";
      this.lastError = null;
    } catch (error) {
      if (this.handle !== handle || handle.released) return;
      this.status = "unavailable";
      this.lastError = error?.message || String(error || "Radio playback failed.");
      this.releaseHandle(handle);
      onError?.(error);
    }
  }

  playMediaElementFallback(track, { volume, onEnded, onError }, ctx = this.rawAudio?.unlock?.(), master = this.rawAudio?.master) {
    const url = String(track?.src || "");
    const key = String(track?.id || url || "radio-track");
    if (!url || !ctx || !master || !this.AudioCtor || typeof ctx.createMediaElementSource !== "function") {
      this.status = "unavailable";
      this.lastError = "Radio playback authority is unavailable.";
      onError?.(new Error(this.lastError));
      return false;
    }

    this.stop();
    try {
      const element = new this.AudioCtor();
      const source = ctx.createMediaElementSource(element);
      const gain = ctx.createGain();
      element.preload = "auto";
      element.loop = false;
      element.src = url;
      gain.gain.value = Math.max(0, Math.min(2, Number(volume) || DEFAULT_RADIO_VOLUME));
      source.connect(gain);
      gain.connect(master);

      const handle = {
        kind: "media-element",
        element,
        source,
        gain,
        key,
        url,
        released: false,
        ended: null,
        errored: null
      };
      handle.ended = () => {
        if (this.handle !== handle || handle.released) return;
        this.status = "ended";
        this.lastError = null;
        this.releaseHandle(handle, { stopSource: false });
        onEnded?.();
      };
      handle.errored = () => {
        if (this.handle !== handle || handle.released) return;
        this.status = "unavailable";
        this.lastError = `Radio track failed to load: ${url}`;
        this.releaseHandle(handle);
        onError?.(new Error(this.lastError));
      };
      element.addEventListener?.("ended", handle.ended);
      element.addEventListener?.("error", handle.errored);

      this.handle = handle;
      this.trackKey = key;
      this.trackUrl = url;
      this.status = "loading";
      this.lastError = null;

      const attempt = element.play?.();
      if (attempt?.then) {
        attempt.then(() => {
          if (this.handle === handle && !handle.released) this.status = "playing";
        }).catch(error => {
          if (this.handle !== handle || handle.released) return;
          this.status = "blocked";
          this.lastError = error?.message || String(error || "Media playback was blocked.");
          onError?.(error);
        });
      } else {
        this.status = "playing";
      }
      return true;
    } catch (error) {
      this.status = "unavailable";
      this.lastError = error?.message || String(error || "Radio playback failed.");
      onError?.(error);
      return false;
    }
  }

  releaseHandle(handle, { stopSource = true } = {}) {
    if (!handle || handle.released) return;
    handle.released = true;

    if (handle.kind === "media-element") {
      handle.element?.removeEventListener?.("ended", handle.ended);
      handle.element?.removeEventListener?.("error", handle.errored);
      try { handle.element?.pause?.(); } catch {}
      try {
        handle.element?.removeAttribute?.("src");
        handle.element?.load?.();
      } catch {}
    }

    if (handle.source) {
      if (handle.kind === "buffer") handle.source.onended = null;
      if (stopSource && handle.kind === "buffer") {
        try { handle.source.stop?.(); } catch {}
      }
      try { handle.source.disconnect?.(); } catch {}
    }
    try { handle.gain?.disconnect?.(); } catch {}
    if (this.handle === handle) this.handle = null;
  }

  stop() {
    const handle = this.handle;
    if (handle) this.releaseHandle(handle);
    this.handle = null;
    this.trackKey = null;
    this.trackUrl = null;
    if (this.status !== "unavailable") this.status = "idle";
    return Boolean(handle);
  }

  snapshot() {
    return {
      status: this.status,
      trackKey: this.trackKey,
      trackUrl: this.trackUrl,
      active: Boolean(this.handle),
      playbackKind: this.handle?.kind || null,
      contextState: this.rawAudio?.ctx?.state || null,
      lastError: this.lastError,
      preload: this.preloadSnapshot()
    };
  }

  destroy() {
    this.stop();
    this.encodedCache.clear();
    this.bufferCache.clear();
    this.decodedLru.length = 0;
  }
}
