import { RadioPlayback } from "./RadioPlayback.js";

const BUFFER_END_EPSILON_SECONDS = 0.01;

function nonNegativeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function positiveNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

export class RadioBroadcastPlayback extends RadioPlayback {
  constructor(rawAudio, options = {}) {
    const { nowMs = () => Date.now(), ...playbackOptions } = options || {};
    super(rawAudio, playbackOptions);
    this.nowMs = typeof nowMs === "function" ? nowMs : () => Date.now();
  }

  play(track, {
    offsetSeconds = 0,
    timelineObservedAtMs = null,
    timelineDurationSeconds = null,
    ...options
  } = {}) {
    const broadcastStart = {
      offsetSeconds: nonNegativeNumber(offsetSeconds),
      observedAtMs: Number.isFinite(Number(timelineObservedAtMs))
        ? Number(timelineObservedAtMs)
        : this.nowMs(),
      durationSeconds: positiveNumber(timelineDurationSeconds)
    };

    const started = super.play(track, options);
    const handle = this.handle;
    if (!started || !handle) return started;

    handle.broadcastStart = broadcastStart;
    if (handle.kind === "media-element") this.seekMediaElement(handle);
    return started;
  }

  effectiveOffsetSeconds(handle) {
    const start = handle?.broadcastStart;
    if (!start) return 0;
    const elapsedSeconds = Math.max(0, (this.nowMs() - start.observedAtMs) / 1000);
    return start.offsetSeconds + elapsedSeconds;
  }

  seekMediaElement(handle) {
    if (!handle?.element || handle.released) return false;
    const offsetSeconds = this.effectiveOffsetSeconds(handle);
    const durationSeconds = handle.broadcastStart?.durationSeconds;
    if (durationSeconds && offsetSeconds >= durationSeconds) {
      queueMicrotask(() => {
        if (this.handle === handle && !handle.released) handle.ended?.();
      });
      return false;
    }
    try {
      handle.element.currentTime = offsetSeconds;
      handle.startOffsetSeconds = offsetSeconds;
      return true;
    } catch {
      return false;
    }
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

      const requestedOffset = this.effectiveOffsetSeconds(handle);
      const timelineDuration = handle.broadcastStart?.durationSeconds;
      if (timelineDuration && requestedOffset >= timelineDuration) {
        this.status = "ended";
        this.lastError = null;
        this.releaseHandle(handle, { stopSource: false });
        onEnded?.();
        return;
      }

      const maximumOffset = Math.max(0, Number(buffer?.duration || 0) - BUFFER_END_EPSILON_SECONDS);
      const offsetSeconds = Math.max(0, Math.min(requestedOffset, maximumOffset));
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
      handle.startOffsetSeconds = offsetSeconds;
      source.start(0, offsetSeconds);
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

  snapshot() {
    return {
      ...super.snapshot(),
      startOffsetSeconds: this.handle?.startOffsetSeconds ?? null
    };
  }
}
