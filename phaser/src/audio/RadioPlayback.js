import { RawAudio } from "../systems/RawAudioSystem.js";

const DEFAULT_RADIO_VOLUME = 1.0;

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

export class RadioPlayback {
  constructor(rawAudio = RawAudio, { fetchFn = globalThis?.fetch } = {}) {
    this.rawAudio = rawAudio;
    this.fetchFn = fetchFn;
    this.handle = null;
    this.status = "idle";
    this.trackKey = null;
    this.trackUrl = null;
    this.lastError = null;

    this.rawAudio?.ensureListeners?.();
  }

  play(track, { volume = DEFAULT_RADIO_VOLUME, onEnded = null, onError = null } = {}) {
    const url = String(track?.src || "");
    const key = String(track?.id || url || "radio-track");
    const ctx = this.rawAudio?.unlock?.();
    const master = this.rawAudio?.master;
    if (
      !url
      || !ctx
      || !master
      || typeof this.fetchFn !== "function"
      || typeof ctx.createBufferSource !== "function"
      || typeof ctx.createGain !== "function"
      || typeof ctx.decodeAudioData !== "function"
    ) {
      this.status = "unavailable";
      this.lastError = "Radio playback authority is unavailable.";
      onError?.(new Error(this.lastError));
      return false;
    }

    this.stop();

    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const gain = ctx.createGain();
    gain.gain.value = Math.max(0, Math.min(2, Number(volume) || DEFAULT_RADIO_VOLUME));
    gain.connect(master);

    const handle = {
      controller,
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

      const response = await this.fetchFn(handle.url, handle.controller ? { signal: handle.controller.signal } : undefined);
      if (!response?.ok) throw new Error(`Radio track HTTP ${response?.status || "error"}: ${handle.url}`);
      const encoded = await response.arrayBuffer();
      if (this.handle !== handle || handle.released) return;

      const buffer = await decodeAudioData(ctx, encoded);
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
      if (error?.name === "AbortError") return;
      this.status = "unavailable";
      this.lastError = error?.message || String(error || "Radio playback failed.");
      this.releaseHandle(handle);
      onError?.(error);
    }
  }

  releaseHandle(handle, { stopSource = true } = {}) {
    if (!handle || handle.released) return;
    handle.released = true;
    try { handle.controller?.abort?.(); } catch {}
    if (handle.source) {
      handle.source.onended = null;
      if (stopSource) {
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
      contextState: this.rawAudio?.ctx?.state || null,
      lastError: this.lastError
    };
  }

  destroy() {
    this.stop();
  }
}
