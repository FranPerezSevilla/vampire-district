import { RawAudio } from "../systems/RawAudioSystem.js";

const DEFAULT_RADIO_VOLUME = 0.68;

export class RadioPlayback {
  constructor(rawAudio = RawAudio, { AudioCtor = globalThis?.Audio } = {}) {
    this.rawAudio = rawAudio;
    this.AudioCtor = AudioCtor;
    this.handle = null;
    this.status = "idle";
    this.trackKey = null;
    this.trackUrl = null;
    this.lastError = null;

    // Install RawAudio's existing pointer/keyboard unlock bridge as soon as the
    // radio runtime exists. Without this, strict browsers may create/resume the
    // AudioContext later from the gameplay update loop, outside a trusted user
    // gesture, leaving a perfectly valid media element connected to a suspended
    // Web Audio graph.
    this.rawAudio?.ensureListeners?.();
  }

  play(track, { volume = DEFAULT_RADIO_VOLUME, onEnded = null, onError = null } = {}) {
    const url = String(track?.src || "");
    const key = String(track?.id || url || "radio-track");
    const ctx = this.rawAudio?.unlock?.();
    const master = this.rawAudio?.master;
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
      gain.gain.value = Math.max(0, Math.min(1, Number(volume) || DEFAULT_RADIO_VOLUME));
      source.connect(gain);
      gain.connect(master);

      const handle = {
        element,
        source,
        gain,
        key,
        url,
        ended: null,
        errored: null
      };
      handle.ended = () => {
        if (this.handle !== handle) return;
        this.status = "ended";
        this.lastError = null;
        this.releaseHandle(handle, { clearSource: false });
        onEnded?.();
      };
      handle.errored = () => {
        if (this.handle !== handle) return;
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
          if (this.handle === handle) {
            this.status = "playing";
            this.lastError = null;
          }
        }).catch(error => {
          if (this.handle !== handle) return;
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
      this.stop();
      onError?.(error);
      return false;
    }
  }

  releaseHandle(handle, { clearSource = true } = {}) {
    if (!handle) return;
    handle.element?.removeEventListener?.("ended", handle.ended);
    handle.element?.removeEventListener?.("error", handle.errored);
    try { handle.element?.pause?.(); } catch {}
    if (clearSource) {
      try {
        handle.element.removeAttribute?.("src");
        handle.element.load?.();
      } catch {}
    }
    try { handle.source?.disconnect?.(); } catch {}
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
