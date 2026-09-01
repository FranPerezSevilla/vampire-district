import {
  RADIO_STATIONS,
  RADIO_STATION_ORDER,
  radioStationById
} from "../audio/RadioCatalog.js";
import { RadioBroadcastPlayback } from "../audio/RadioBroadcastPlayback.js";
import { RadioTimeline } from "../audio/RadioTimeline.js";
import { TrafficRadioAmbienceSystem } from "./TrafficRadioAmbienceSystem.js";

const DEFAULT_STATION_ID = "vice-fm";
const TIMELINE_BOUNDARY_EPSILON_SECONDS = 0.05;

function normalizedStep(value) {
  const numeric = Number(value) || 0;
  return numeric > 0 ? 1 : numeric < 0 ? -1 : 0;
}

export class RadioSystem {
  constructor(scene, {
    vehicleSystem = scene?.vehicleSystem,
    playback = new RadioBroadcastPlayback(),
    timeline = new RadioTimeline(RADIO_STATIONS),
    defaultStationId = DEFAULT_STATION_ID
  } = {}) {
    if (!scene) throw new TypeError("RadioSystem requires GameScene.");
    this.scene = scene;
    this.vehicleSystem = vehicleSystem;
    this.playback = playback;
    this.timeline = timeline;
    this.selectedStationId = radioStationById(defaultStationId) ? defaultStationId : DEFAULT_STATION_ID;
    this.driving = Boolean(vehicleSystem?.isDriving?.());
    this.playbackStatus = "idle";
    this.destroyed = false;
    this.lastPublishedKey = "";
    this.waitingForTimelineTrackId = null;

    // Download all nine compressed masters immediately and decode the first
    // track of each station in parallel. RadioPlayback keeps the decoded cache
    // bounded, so startup responsiveness improves without retaining the entire
    // ~30-minute catalogue as PCM in memory.
    this.preloadPromise = this.playback.preloadCatalog?.(RADIO_STATIONS) || null;

    // NPC traffic listens to the exact same station clocks and decoded-buffer
    // cache as the player receiver. The ambience layer is optional in focused
    // tests that construct RadioSystem without the traffic runtime.
    this.trafficAmbience = scene.trafficMaterializationSystem
      ? new TrafficRadioAmbienceSystem(scene, {
        radioSystem: this,
        trafficSystem: scene.trafficMaterializationSystem,
        rawAudio: this.playback?.rawAudio
      })
      : null;

    this.onVehicleEntered = () => {
      if (this.destroyed) return;
      this.driving = true;
      this.startSelectedStation();
      this.publish(true);
    };
    this.onVehicleExited = () => {
      if (this.destroyed) return;
      this.driving = false;
      this.stopPlayback("on-foot");
      this.publish(true);
    };
    this.onVehicleExploded = event => {
      if (!event?.occupied || this.destroyed) return;
      this.driving = false;
      this.stopPlayback("vehicle-exploded");
      this.publish(true);
    };

    scene.events?.on?.("vehicle:entered", this.onVehicleEntered);
    scene.events?.on?.("vehicle:exited", this.onVehicleExited);
    scene.events?.on?.("vehicle:exploded", this.onVehicleExploded);
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.installBrowserApi();
    this.publish(true);
  }

  station() {
    return this.selectedStationId === "off"
      ? null
      : radioStationById(this.selectedStationId);
  }

  currentPosition(station = this.station()) {
    if (!station) return null;
    return this.timeline?.position?.(station.id) || null;
  }

  currentTrack() {
    return this.currentPosition()?.track || null;
  }

  nextTrack(station = this.station()) {
    if (!station?.tracks?.length) return null;
    return this.timeline?.nextTrack?.(station.id) || null;
  }

  cycleStation(step) {
    const direction = normalizedStep(step);
    if (!direction) return false;
    const currentIndex = Math.max(0, RADIO_STATION_ORDER.indexOf(this.selectedStationId));
    const nextIndex = (currentIndex + direction + RADIO_STATION_ORDER.length) % RADIO_STATION_ORDER.length;
    return this.selectStation(RADIO_STATION_ORDER[nextIndex]);
  }

  selectStation(stationId) {
    const id = String(stationId || "off");
    if (id !== "off" && !radioStationById(id)) return false;
    const changed = id !== this.selectedStationId;
    this.selectedStationId = id;
    this.stopPlayback(id === "off" ? "station-off" : "station-change");
    if (this.driving && id !== "off") this.startSelectedStation();
    this.scene.lastActionText = id === "off"
      ? "Car radio off."
      : `Car radio · ${radioStationById(id)?.label || id}.`;
    this.publish(true);
    return changed;
  }

  startSelectedStation() {
    if (!this.driving || this.selectedStationId === "off") return false;
    const station = this.station();
    const position = this.currentPosition(station);
    const track = position?.track;
    if (!station || !position || !track) {
      this.playbackStatus = "unavailable";
      return false;
    }

    this.waitingForTimelineTrackId = null;
    const stationId = station.id;
    const trackId = track.id;
    this.playbackStatus = "loading";
    const started = this.playback.play(track, {
      offsetSeconds: position.offsetSeconds,
      timelineObservedAtMs: position.observedAtMs,
      timelineDurationSeconds: position.durationSeconds,
      onEnded: () => this.handleTrackEnded(stationId, trackId),
      onError: () => {
        if (this.destroyed || !this.driving || this.selectedStationId !== stationId) return;
        this.playbackStatus = this.playback.snapshot?.().status || "unavailable";
        this.publish(true);
      }
    });
    if (!started) this.playbackStatus = "unavailable";
    else {
      this.playbackStatus = this.playback.snapshot?.().status || "loading";
      const upcoming = this.nextTrack(station);
      if (upcoming && upcoming.id !== track.id) this.playback.prepare?.(upcoming);
    }
    return started;
  }

  handleTrackEnded(stationId, trackId) {
    if (this.destroyed || !this.driving || this.selectedStationId !== stationId) return false;
    const station = radioStationById(stationId);
    const livePosition = this.currentPosition(station);
    this.playbackStatus = "idle";

    // Source-page durations are whole-second schedule metadata. If the encoded
    // master ends a fraction early, do not restart its tail; wait silently for
    // the broadcast boundary, then join the next live track on the next update.
    if (
      livePosition?.track?.id === trackId
      && livePosition.remainingSeconds > TIMELINE_BOUNDARY_EPSILON_SECONDS
    ) {
      this.waitingForTimelineTrackId = trackId;
      this.publish(true);
      return false;
    }

    const started = this.startSelectedStation();
    this.publish(true);
    return started;
  }

  stopPlayback(reason = "stopped") {
    this.waitingForTimelineTrackId = null;
    this.playback.stop?.();
    this.playbackStatus = reason === "station-off" || reason === "on-foot" ? "idle" : reason;
    return true;
  }

  syncToLiveTimeline(playbackState = this.playback.snapshot?.() || {}) {
    if (!this.driving || this.selectedStationId === "off") return playbackState;
    const position = this.currentPosition();
    const liveTrackId = position?.track?.id || null;
    if (!liveTrackId) return playbackState;

    if (this.waitingForTimelineTrackId) {
      if (liveTrackId !== this.waitingForTimelineTrackId) {
        this.waitingForTimelineTrackId = null;
        this.startSelectedStation();
        return this.playback.snapshot?.() || playbackState;
      }
      return playbackState;
    }

    // The station clock owns track boundaries. If source metadata and the
    // decoded MP3 differ by a fraction of a second, resync at the schedule
    // boundary instead of allowing cumulative drift across the playlist.
    if (
      playbackState?.status === "playing"
      && playbackState.trackKey
      && playbackState.trackKey !== liveTrackId
    ) {
      this.startSelectedStation();
      return this.playback.snapshot?.() || playbackState;
    }

    return playbackState;
  }

  update(_dt = 0, frame = this.scene.currentInputFrame || {}) {
    if (this.destroyed) return false;
    const driving = Boolean(this.vehicleSystem?.isDriving?.());
    if (driving !== this.driving) {
      this.driving = driving;
      if (driving) this.startSelectedStation();
      else this.stopPlayback("on-foot");
    }

    if (driving) {
      const step = normalizedStep(frame?.radioStep);
      if (step) this.cycleStation(step);
    }

    let playbackState = this.playback.snapshot?.() || {};
    playbackState = this.syncToLiveTimeline(playbackState);
    if (!driving) {
      // A private master may have failed to preload while CI/local runs without
      // staged radio assets. Once the player is on foot the radio is stopped by
      // definition, so a stale underlying `unavailable` state must not leak back
      // into the player-facing runtime state after `stopPlayback("on-foot")`.
      this.playbackStatus = "idle";
    } else if (this.waitingForTimelineTrackId) {
      this.playbackStatus = "idle";
    } else if (playbackState?.status && playbackState.status !== this.playbackStatus) {
      this.playbackStatus = playbackState.status;
    }

    this.trafficAmbience?.update?.(_dt);
    this.decorateVehicleHud();
    this.publish();
    return driving;
  }

  hudLabel() {
    if (this.selectedStationId === "off") return "RADIO OFF · WHEEL station";
    const station = this.station();
    const failure = this.playbackStatus === "blocked" || this.playbackStatus === "unavailable"
      ? ` · ${this.playbackStatus.toUpperCase()}`
      : "";
    return `RADIO ${station?.label || this.selectedStationId}${failure} · WHEEL station`;
  }

  decorateVehicleHud() {
    if (!this.driving) return false;
    const hud = this.vehicleSystem?.hud;
    if (!hud?.setText) return false;
    const current = String(hud.text || "");
    const marker = " · RADIO ";
    const markerIndex = current.indexOf(marker);
    const base = markerIndex >= 0 ? current.slice(0, markerIndex) : current;
    hud.setText(`${base} · ${this.hudLabel()}`);
    return true;
  }

  snapshot() {
    const station = this.station();
    const position = this.currentPosition(station);
    const track = position?.track || null;
    const playback = this.playback.snapshot?.() || {};
    return {
      driving: this.driving,
      selectedStationId: this.selectedStationId,
      stationLabel: station?.label || "Off",
      track: track ? {
        id: track.id,
        title: track.title,
        creator: track.creator,
        filename: track.filename,
        durationSeconds: position.durationSeconds
      } : null,
      trackIndex: position?.trackIndex ?? -1,
      trackCount: position?.trackCount ?? 0,
      trackOffsetSeconds: position ? Math.floor(position.offsetSeconds) : null,
      cycleOffsetSeconds: position ? Math.floor(position.cycleOffsetSeconds) : null,
      cycleDurationSeconds: position?.cycleSeconds ?? 0,
      playbackStatus: this.playbackStatus,
      playbackKind: playback.playbackKind || null,
      playbackContextState: playback.contextState || null,
      playbackError: playback.lastError || null,
      playbackUrl: playback.trackUrl || null,
      playbackStartOffsetSeconds: playback.startOffsetSeconds ?? null,
      preload: playback.preload || null
    };
  }

  publish(force = false) {
    const snapshot = this.snapshot();
    const key = JSON.stringify(snapshot);
    if (!force && key === this.lastPublishedKey) return snapshot;
    this.lastPublishedKey = key;
    const text = snapshot.selectedStationId === "off"
      ? "Radio off"
      : `${snapshot.stationLabel} · ${snapshot.track?.title || "master unavailable"}`;
    this.scene.statePublisher?.setMany?.({ radioState: snapshot, radioText: text });
    if (!this.scene.statePublisher) {
      this.scene.registry?.set?.("radioState", snapshot);
      this.scene.registry?.set?.("radioText", text);
    }
    return snapshot;
  }

  installBrowserApi() {
    if (typeof window === "undefined") return;
    const system = this;
    window.NBD_RADIO = Object.freeze({
      snapshot: () => system.snapshot(),
      cycle: step => system.cycleStation(step),
      select: stationId => system.selectStation(stationId)
    });
    window.NBD_RADIO_READY = true;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.trafficAmbience?.destroy?.();
    this.trafficAmbience = null;
    this.playback.destroy?.();
    this.scene.events?.off?.("vehicle:entered", this.onVehicleEntered);
    this.scene.events?.off?.("vehicle:exited", this.onVehicleExited);
    this.scene.events?.off?.("vehicle:exploded", this.onVehicleExploded);
    if (typeof window !== "undefined") {
      if (window.NBD_RADIO) delete window.NBD_RADIO;
      window.NBD_RADIO_READY = false;
    }
  }
}
