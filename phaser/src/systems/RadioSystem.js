import {
  RADIO_STATION_ORDER,
  radioStationById
} from "../audio/RadioCatalog.js";
import { RadioPlayback } from "../audio/RadioPlayback.js";

const DEFAULT_STATION_ID = "vice-fm";

function normalizedStep(value) {
  const numeric = Number(value) || 0;
  return numeric > 0 ? 1 : numeric < 0 ? -1 : 0;
}

export class RadioSystem {
  constructor(scene, {
    vehicleSystem = scene?.vehicleSystem,
    playback = new RadioPlayback(),
    defaultStationId = DEFAULT_STATION_ID
  } = {}) {
    if (!scene) throw new TypeError("RadioSystem requires GameScene.");
    this.scene = scene;
    this.vehicleSystem = vehicleSystem;
    this.playback = playback;
    this.selectedStationId = radioStationById(defaultStationId) ? defaultStationId : DEFAULT_STATION_ID;
    this.trackCursors = new Map();
    this.driving = Boolean(vehicleSystem?.isDriving?.());
    this.playbackStatus = "idle";
    this.destroyed = false;
    this.lastPublishedKey = "";

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

  currentTrack() {
    const station = this.station();
    if (!station?.tracks?.length) return null;
    const cursor = this.trackCursors.get(station.id) || 0;
    return station.tracks[cursor % station.tracks.length] || station.tracks[0] || null;
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
    const track = this.currentTrack();
    if (!station || !track) {
      this.playbackStatus = "unavailable";
      return false;
    }

    const stationId = station.id;
    const trackId = track.id;
    this.playbackStatus = "loading";
    const started = this.playback.play(track, {
      onEnded: () => this.handleTrackEnded(stationId, trackId),
      onError: () => {
        if (this.destroyed || this.selectedStationId !== stationId) return;
        this.playbackStatus = "unavailable";
        this.publish(true);
      }
    });
    if (!started) this.playbackStatus = "unavailable";
    else this.playbackStatus = this.playback.snapshot?.().status || "loading";
    return started;
  }

  handleTrackEnded(stationId, trackId) {
    if (this.destroyed || !this.driving || this.selectedStationId !== stationId) return false;
    const station = radioStationById(stationId);
    if (!station?.tracks?.length) return false;
    const currentIndex = station.tracks.findIndex(track => track.id === trackId);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % station.tracks.length : 0;
    this.trackCursors.set(station.id, nextIndex);
    this.playbackStatus = "idle";
    const started = this.startSelectedStation();
    this.publish(true);
    return started;
  }

  stopPlayback(reason = "stopped") {
    this.playback.stop?.();
    this.playbackStatus = reason === "station-off" || reason === "on-foot" ? "idle" : reason;
    return true;
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

    const playbackState = this.playback.snapshot?.();
    if (playbackState?.status && playbackState.status !== this.playbackStatus) {
      this.playbackStatus = playbackState.status;
    }

    this.decorateVehicleHud();
    this.publish();
    return driving;
  }

  hudLabel() {
    if (this.selectedStationId === "off") return "RADIO OFF · WHEEL station";
    const station = this.station();
    return `RADIO ${station?.label || this.selectedStationId} · WHEEL station`;
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
    const track = this.currentTrack();
    return {
      driving: this.driving,
      selectedStationId: this.selectedStationId,
      stationLabel: station?.label || "Off",
      track: track ? {
        id: track.id,
        title: track.title,
        creator: track.creator,
        filename: track.filename
      } : null,
      trackIndex: station ? (this.trackCursors.get(station.id) || 0) : -1,
      trackCount: station?.tracks?.length || 0,
      playbackStatus: this.playbackStatus
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
