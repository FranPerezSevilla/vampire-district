import { RADIO_STATIONS } from "../audio/RadioCatalog.js";
import { LAYERS } from "../data/district.js";
import { RawAudio } from "./RawAudioSystem.js";

export const TRAFFIC_RADIO_DEFAULTS = Object.freeze({
  maxEmitters: 3,
  audibleRadius: 180,
  fullVolumeRadius: 36,
  maxGain: 0.10,
  falloffExponent: 1.9,
  playerRadioDuck: 0,
  drivingDuck: 0.52,
  nearFilterHz: 3400,
  farFilterHz: 850
});

const BUFFER_END_EPSILON_SECONDS = 0.04;

function finite(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value || "traffic")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function setAudioParam(param, value, now, timeConstant) {
  if (!param) return;
  if (typeof param.setTargetAtTime === "function") param.setTargetAtTime(value, now, timeConstant);
  else param.value = value;
}

export function trafficRadioStationId(tokenId, stations = RADIO_STATIONS) {
  const list = Array.isArray(stations) ? stations.filter(station => station?.id) : [];
  if (!list.length) return null;
  return list[stableHash(tokenId) % list.length].id;
}

export function trafficRadioGain(distance, {
  audibleRadius = TRAFFIC_RADIO_DEFAULTS.audibleRadius,
  fullVolumeRadius = TRAFFIC_RADIO_DEFAULTS.fullVolumeRadius,
  maxGain = TRAFFIC_RADIO_DEFAULTS.maxGain,
  falloffExponent = TRAFFIC_RADIO_DEFAULTS.falloffExponent,
  multiplier = 1
} = {}) {
  const outer = Math.max(1, finite(audibleRadius, TRAFFIC_RADIO_DEFAULTS.audibleRadius));
  const inner = clamp(fullVolumeRadius, 0, outer - 0.001);
  const d = Math.max(0, finite(distance));
  if (d >= outer) return 0;
  const presence = d <= inner ? 1 : 1 - clamp01((d - inner) / (outer - inner));
  return Math.max(0, finite(maxGain, TRAFFIC_RADIO_DEFAULTS.maxGain))
    * Math.pow(presence, Math.max(0.25, finite(falloffExponent, TRAFFIC_RADIO_DEFAULTS.falloffExponent)))
    * Math.max(0, finite(multiplier, 1));
}

export function selectTrafficRadioCandidates(slots, focus, {
  maxEmitters = TRAFFIC_RADIO_DEFAULTS.maxEmitters,
  audibleRadius = TRAFFIC_RADIO_DEFAULTS.audibleRadius,
  stations = RADIO_STATIONS
} = {}) {
  const origin = focus || { x: 0, y: 0 };
  const radius = Math.max(1, finite(audibleRadius, TRAFFIC_RADIO_DEFAULTS.audibleRadius));
  const limit = Math.max(0, Math.floor(finite(maxEmitters, TRAFFIC_RADIO_DEFAULTS.maxEmitters)));
  return (slots || [])
    .filter(slot => slot?.tokenId && slot.container?.active !== false)
    .map(slot => {
      const dx = finite(slot.x) - finite(origin.x);
      const dy = finite(slot.y) - finite(origin.y);
      return {
        slot,
        tokenId: String(slot.tokenId),
        stationId: trafficRadioStationId(slot.tokenId, stations),
        dx,
        dy,
        distance: Math.hypot(dx, dy)
      };
    })
    .filter(candidate => candidate.stationId && candidate.distance < radius)
    .sort((left, right) => left.distance - right.distance || left.tokenId.localeCompare(right.tokenId))
    .slice(0, limit);
}

export class TrafficRadioAmbienceSystem {
  constructor(scene, {
    radioSystem = scene?.radioSystem,
    trafficSystem = scene?.trafficMaterializationSystem,
    rawAudio = radioSystem?.playback?.rawAudio || RawAudio,
    maxEmitters = TRAFFIC_RADIO_DEFAULTS.maxEmitters,
    audibleRadius = TRAFFIC_RADIO_DEFAULTS.audibleRadius,
    fullVolumeRadius = TRAFFIC_RADIO_DEFAULTS.fullVolumeRadius,
    maxGain = TRAFFIC_RADIO_DEFAULTS.maxGain
  } = {}) {
    if (!scene || !radioSystem?.timeline || !radioSystem?.playback || !trafficSystem) {
      throw new TypeError("TrafficRadioAmbienceSystem requires scene radio and traffic authorities.");
    }
    this.scene = scene;
    this.radioSystem = radioSystem;
    this.trafficSystem = trafficSystem;
    this.rawAudio = rawAudio;
    this.maxEmitters = Math.max(1, Math.floor(finite(maxEmitters, TRAFFIC_RADIO_DEFAULTS.maxEmitters)));
    this.audibleRadius = Math.max(32, finite(audibleRadius, TRAFFIC_RADIO_DEFAULTS.audibleRadius));
    this.fullVolumeRadius = clamp(fullVolumeRadius, 0, this.audibleRadius - 1);
    this.maxGain = Math.max(0, finite(maxGain, TRAFFIC_RADIO_DEFAULTS.maxGain));
    this.emitters = new Map();
    this.failedUrls = new Set();
    this.sequence = 0;
    this.destroyed = false;

    this.installBrowserApi();
    scene.events?.once?.(globalThis.Phaser?.Scenes?.Events?.SHUTDOWN || "shutdown", this.destroy, this);
  }

  listenerFocus() {
    return this.scene.renderFocus?.()
      || this.trafficSystem.focus?.()
      || this.scene.player
      || { x: 0, y: 0 };
  }

  receiverMultiplier() {
    if (!this.radioSystem?.driving) return 1;
    return this.radioSystem.selectedStationId === "off"
      ? TRAFFIC_RADIO_DEFAULTS.drivingDuck
      : TRAFFIC_RADIO_DEFAULTS.playerRadioDuck;
  }

  audioContext() {
    const ctx = this.rawAudio?.ctx;
    if (!ctx || !this.rawAudio?.master) return null;
    if (ctx.state && ctx.state !== "running") return null;
    return ctx;
  }

  update() {
    if (this.destroyed) return false;
    if (this.scene.currentLayer !== LAYERS.STREET) {
      this.stopAll();
      return false;
    }

    const ctx = this.audioContext();
    if (!ctx) {
      this.stopAll();
      return false;
    }

    const focus = this.listenerFocus();
    const candidates = selectTrafficRadioCandidates(this.trafficSystem.pool, focus, {
      maxEmitters: this.maxEmitters,
      audibleRadius: this.audibleRadius
    });
    const desiredIds = new Set(candidates.map(candidate => candidate.tokenId));

    for (const [tokenId, emitter] of [...this.emitters.entries()]) {
      if (!desiredIds.has(tokenId) || emitter?.slot?.tokenId !== tokenId) this.releaseEmitter(tokenId);
    }
    for (const candidate of candidates) this.syncCandidate(candidate, ctx);
    return candidates.length > 0;
  }

  syncCandidate(candidate, ctx) {
    const position = this.radioSystem.timeline.position(candidate.stationId);
    const track = position?.track;
    if (!position || !track?.src || this.failedUrls.has(track.src)) {
      this.releaseEmitter(candidate.tokenId);
      return false;
    }

    let emitter = this.emitters.get(candidate.tokenId);
    if (emitter && (emitter.stationId !== candidate.stationId || emitter.trackId !== track.id)) {
      this.releaseEmitter(candidate.tokenId);
      emitter = null;
    }

    if (!emitter) {
      emitter = {
        tokenId: candidate.tokenId,
        stationId: candidate.stationId,
        trackId: track.id,
        slot: candidate.slot,
        source: null,
        filter: null,
        gain: null,
        panner: null,
        state: "loading",
        sequence: ++this.sequence,
        distance: candidate.distance,
        gainValue: 0,
        panValue: 0,
        filterHz: TRAFFIC_RADIO_DEFAULTS.farFilterHz,
        startOffsetSeconds: null
      };
      this.emitters.set(candidate.tokenId, emitter);
      this.loadEmitter(emitter, track, ctx);
    } else {
      emitter.slot = candidate.slot;
    }

    this.updateEmitterSpatial(emitter, candidate, ctx);
    return true;
  }

  loadEmitter(emitter, track, ctx) {
    const decoder = this.radioSystem.playback;
    if (typeof decoder?.ensureDecoded !== "function") {
      emitter.state = "unavailable";
      return false;
    }

    Promise.resolve(decoder.ensureDecoded(track.src, ctx))
      .then(buffer => {
        if (this.destroyed || this.emitters.get(emitter.tokenId) !== emitter) return;
        if (emitter.slot?.tokenId !== emitter.tokenId) {
          this.releaseEmitter(emitter.tokenId);
          return;
        }
        const liveContext = this.audioContext();
        if (!liveContext || liveContext !== ctx) {
          this.releaseEmitter(emitter.tokenId);
          return;
        }
        const position = this.radioSystem.timeline.position(emitter.stationId);
        if (!position?.track || position.track.id !== emitter.trackId) {
          this.releaseEmitter(emitter.tokenId);
          return;
        }

        const maximumOffset = Math.max(0, finite(buffer?.duration) - BUFFER_END_EPSILON_SECONDS);
        if (!(maximumOffset > 0) || position.offsetSeconds >= maximumOffset) {
          emitter.state = "ended";
          emitter.startOffsetSeconds = null;
          return;
        }
        this.startEmitter(emitter, buffer, position.offsetSeconds, ctx);
      })
      .catch(() => {
        this.failedUrls.add(track.src);
        if (this.emitters.get(emitter.tokenId) === emitter) this.releaseEmitter(emitter.tokenId);
      });
    return true;
  }

  startEmitter(emitter, buffer, offsetSeconds, ctx) {
    try {
      const source = ctx.createBufferSource();
      const filter = typeof ctx.createBiquadFilter === "function" ? ctx.createBiquadFilter() : null;
      const gain = ctx.createGain();
      const panner = typeof ctx.createStereoPanner === "function" ? ctx.createStereoPanner() : null;

      source.buffer = buffer;
      if (filter) {
        filter.type = "lowpass";
        filter.Q.value = 0.68;
        source.connect(filter);
        filter.connect(gain);
      } else {
        source.connect(gain);
      }
      if (panner) {
        gain.connect(panner);
        panner.connect(this.rawAudio.master);
      } else {
        gain.connect(this.rawAudio.master);
      }

      emitter.source = source;
      emitter.filter = filter;
      emitter.gain = gain;
      emitter.panner = panner;
      emitter.state = "playing";
      emitter.startOffsetSeconds = Math.max(0, finite(offsetSeconds));

      const focus = this.listenerFocus();
      this.updateEmitterSpatial(emitter, {
        dx: finite(emitter.slot?.x) - finite(focus.x),
        dy: finite(emitter.slot?.y) - finite(focus.y),
        distance: Math.hypot(
          finite(emitter.slot?.x) - finite(focus.x),
          finite(emitter.slot?.y) - finite(focus.y)
        )
      }, ctx);

      source.onended = () => {
        if (this.emitters.get(emitter.tokenId) !== emitter || emitter.source !== source) return;
        this.disconnectNodes(emitter, { stopSource: false });
        emitter.state = "ended";
      };
      source.start(0, emitter.startOffsetSeconds);
      return true;
    } catch {
      this.disconnectNodes(emitter);
      emitter.state = "unavailable";
      return false;
    }
  }

  updateEmitterSpatial(emitter, candidate, ctx) {
    emitter.distance = Math.max(0, finite(candidate.distance));
    const gainValue = trafficRadioGain(emitter.distance, {
      audibleRadius: this.audibleRadius,
      fullVolumeRadius: this.fullVolumeRadius,
      maxGain: this.maxGain,
      multiplier: this.receiverMultiplier()
    });
    const panValue = clamp(finite(candidate.dx) / Math.max(1, this.audibleRadius * 0.55), -0.85, 0.85);
    const closeness = 1 - clamp01(emitter.distance / this.audibleRadius);
    const filterHz = TRAFFIC_RADIO_DEFAULTS.farFilterHz
      + (TRAFFIC_RADIO_DEFAULTS.nearFilterHz - TRAFFIC_RADIO_DEFAULTS.farFilterHz) * closeness;
    const now = finite(ctx?.currentTime);

    emitter.gainValue = gainValue;
    emitter.panValue = panValue;
    emitter.filterHz = filterHz;
    setAudioParam(emitter.gain?.gain, gainValue > 0 ? Math.max(0.0001, gainValue) : 0, now, 0.065);
    setAudioParam(emitter.filter?.frequency, filterHz, now, 0.08);
    setAudioParam(emitter.panner?.pan, panValue, now, 0.07);
    return gainValue;
  }

  disconnectNodes(emitter, { stopSource = true } = {}) {
    if (!emitter) return;
    const source = emitter.source;
    if (source) source.onended = null;
    if (stopSource) {
      try { source?.stop?.(); } catch {}
    }
    try { source?.disconnect?.(); } catch {}
    try { emitter.filter?.disconnect?.(); } catch {}
    try { emitter.gain?.disconnect?.(); } catch {}
    try { emitter.panner?.disconnect?.(); } catch {}
    emitter.source = null;
    emitter.filter = null;
    emitter.gain = null;
    emitter.panner = null;
  }

  releaseEmitter(tokenId) {
    const key = String(tokenId || "");
    const emitter = this.emitters.get(key);
    if (!emitter) return false;
    this.emitters.delete(key);
    this.disconnectNodes(emitter);
    return true;
  }

  stopAll() {
    for (const tokenId of [...this.emitters.keys()]) this.releaseEmitter(tokenId);
  }

  snapshot() {
    return {
      maxEmitters: this.maxEmitters,
      audibleRadius: this.audibleRadius,
      fullVolumeRadius: this.fullVolumeRadius,
      maxGain: this.maxGain,
      audioContextState: this.rawAudio?.ctx?.state || "unavailable",
      activeCount: [...this.emitters.values()].filter(emitter => emitter.state === "playing").length,
      trackedCount: this.emitters.size,
      failedTrackCount: this.failedUrls.size,
      emitters: [...this.emitters.values()]
        .map(emitter => ({
          tokenId: emitter.tokenId,
          stationId: emitter.stationId,
          trackId: emitter.trackId,
          state: emitter.state,
          distance: Math.round(emitter.distance * 10) / 10,
          gain: Math.round(emitter.gainValue * 10000) / 10000,
          pan: Math.round(emitter.panValue * 100) / 100,
          filterHz: Math.round(emitter.filterHz),
          startOffsetSeconds: emitter.startOffsetSeconds === null
            ? null
            : Math.round(emitter.startOffsetSeconds * 10) / 10
        }))
        .sort((left, right) => left.distance - right.distance || left.tokenId.localeCompare(right.tokenId))
    };
  }

  installBrowserApi() {
    if (typeof window === "undefined") return;
    window.NBD_TRAFFIC_RADIO = Object.freeze({
      snapshot: () => this.snapshot(),
      stationFor: tokenId => trafficRadioStationId(tokenId),
      gainAt: distance => trafficRadioGain(distance)
    });
    window.NBD_TRAFFIC_RADIO_READY = true;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopAll();
    if (typeof window !== "undefined") {
      if (window.NBD_TRAFFIC_RADIO) delete window.NBD_TRAFFIC_RADIO;
      window.NBD_TRAFFIC_RADIO_READY = false;
    }
  }
}
