import { PLAYER } from "../data/balance.js";
import {
  PLAYTEST_CONFIG,
  PLAYTEST_STATUS,
  advancePlaytestSession,
  createPlaytestSessionState,
  playtestObjectiveText,
  playtestResult,
  startPlaytestSession
} from "./PlaytestSessionModel.js";

const FEEDING_DEPTH_KEYS = Object.freeze({
  quick_bite: "quickBites",
  full_feed: "fullFeeds",
  drain: "drains"
});

function clampDelta(value) {
  return Math.min(0.25, Math.max(0, Number(value) || 0));
}

function frozenSnapshot(state, refuge) {
  return Object.freeze({
    ...state,
    config: Object.freeze({ ...state.config }),
    refuge: Object.freeze({ ...refuge }),
    metrics: Object.freeze({ ...state.metrics }),
    current: Object.freeze({ ...state.current }),
    objectives: Object.freeze(state.objectives.map(objective => Object.freeze({ ...objective }))),
    objectiveText: playtestObjectiveText(state)
  });
}

export class PlaytestSessionSystem {
  constructor(scene, config = {}) {
    if (!scene) throw new TypeError("PlaytestSessionSystem requires GameScene.");
    this.scene = scene;
    this.config = Object.freeze({ ...PLAYTEST_CONFIG, ...(config || {}) });
    this.refuge = Object.freeze({ x: PLAYER.startX, y: PLAYER.startY, layer: PLAYER.startLayer });
    this.state = createPlaytestSessionState(this.config);
    this.feedCounts = { feedCount: 0, quickBites: 0, fullFeeds: 0, drains: 0 };
    this.listeners = new Set();
    this.lastPublishedSignature = "";
    this.publishElapsed = 0;
    this.resultPublished = false;
    this.marker = scene.add.graphics().setDepth(84).setVisible(false);

    this.onFeedingResolved = payload => this.recordFeeding(payload);
    this.onPostUpdate = () => this.update(clampDelta((scene.game?.loop?.delta || 0) / 1000));
    scene.events?.on?.("feeding:resolved", this.onFeedingResolved);
    scene.events?.on?.(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate);
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.playtestSessionSystem = this;
    this.publish(true);
  }

  start() {
    if (this.state.status !== PLAYTEST_STATUS.READY) return false;
    const feeding = this.scene.feedingSystem;
    if (feeding) {
      const before = Number(feeding.hunger) || 0;
      feeding.hunger = this.config.startHunger;
      this.scene.events?.emit?.("hunger:changed", {
        source: "playtest-start",
        before,
        after: feeding.hunger,
        amount: feeding.hunger - before
      });
    }
    this.state = startPlaytestSession(this.state);
    this.scene.lastActionText = "PLAYTEST STARTED: hunt, feed, escape the response and return to this refuge.";
    this.publish(true);
    return true;
  }

  recordFeeding(payload = {}) {
    if (this.state.status !== PLAYTEST_STATUS.ACTIVE) return false;
    const key = FEEDING_DEPTH_KEYS[String(payload.depth || payload.feedingDepth || "")];
    this.feedCounts.feedCount += 1;
    if (key) this.feedCounts[key] += 1;
    this.publish(true);
    return true;
  }

  observation(dt) {
    const scene = this.scene;
    const player = scene.player || this.refuge;
    const distanceFromRefuge = Math.hypot(player.x - this.refuge.x, player.y - this.refuge.y);
    const currentLayer = Number(scene.currentLayer) || 0;
    const nearRefuge = currentLayer === this.refuge.layer && distanceFromRefuge <= this.config.safeRadius;
    return {
      dt,
      hunger: Number(scene.feedingSystem?.hunger) || 0,
      ...this.feedCounts,
      heatLevel: Number(scene.heatSystem?.level?.()) || 0,
      exposure: Number(scene.exposureSystem?.value ?? scene.exposureSystem?.level?.()) || 0,
      witnessReports: Number(scene.witnessSystem?.reports) || 0,
      driving: Boolean(scene.vehicleSystem?.isDriving?.()),
      layer: currentLayer,
      nearRefuge,
      distanceFromRefuge
    };
  }

  update(dt) {
    if (this.state.status === PLAYTEST_STATUS.ACTIVE) {
      const previousStatus = this.state.status;
      this.state = advancePlaytestSession(this.state, this.observation(dt));
      this.publishElapsed += dt;
      this.drawRefugeMarker();
      const transitioned = previousStatus !== this.state.status;
      if (transitioned || this.publishElapsed >= 0.1) {
        this.publishElapsed = 0;
        this.publish(transitioned);
      }
      if (transitioned) this.publishResult();
      return;
    }
    this.marker.clear().setVisible(false);
  }

  drawRefugeMarker() {
    const returning = this.state.objectiveIndex === 2 && this.state.status === PLAYTEST_STATUS.ACTIVE;
    this.marker.clear().setVisible(returning);
    if (!returning || this.scene.currentLayer !== this.refuge.layer) return;
    const pulse = (Math.sin((this.scene.time?.now || 0) * 0.008) + 1) * 0.5;
    const radius = this.config.safeRadius + pulse * 8;
    this.marker.fillStyle(0x05060b, 0.42).fillCircle(this.refuge.x, this.refuge.y, 16);
    this.marker.lineStyle(3, 0x78c7a3, 0.72 + pulse * 0.22).strokeCircle(this.refuge.x, this.refuge.y, radius);
    this.marker.lineStyle(1, 0xf1e6ff, 0.74).strokeCircle(this.refuge.x, this.refuge.y, 18 + pulse * 3);
  }

  publish(force = false) {
    const snapshot = this.snapshot();
    const signature = JSON.stringify({
      status: snapshot.status,
      objectiveIndex: snapshot.objectiveIndex,
      objectiveText: snapshot.objectiveText,
      remaining: Math.ceil(snapshot.timeRemainingSeconds),
      metrics: snapshot.metrics,
      current: snapshot.current
    });
    if (!force && signature === this.lastPublishedSignature) return;
    this.lastPublishedSignature = signature;
    this.scene.registry?.set?.("playtestSession", snapshot);
    this.scene.registry?.set?.("missionText", snapshot.objectiveText);
    this.scene.statePublisher?.setMany?.({
      playtestSession: snapshot,
      missionText: snapshot.objectiveText
    });
    for (const listener of this.listeners) listener(snapshot);
  }

  publishResult() {
    if (this.resultPublished) return;
    const result = playtestResult(this.state);
    if (!result) return;
    this.resultPublished = true;
    this.scene.registry?.set?.("playtestResult", result);
    for (const listener of this.listeners) listener(this.snapshot(), result);
  }

  subscribe(listener) {
    if (typeof listener !== "function") return () => {};
    this.listeners.add(listener);
    listener(this.snapshot(), this.result());
    return () => this.listeners.delete(listener);
  }

  snapshot() {
    return frozenSnapshot(this.state, this.refuge);
  }

  result() {
    return playtestResult(this.state);
  }

  restart() {
    const url = new URL(window.location.href);
    url.searchParams.set("mode", "playtest");
    window.location.assign(url.href);
  }

  destroy() {
    this.scene.events?.off?.("feeding:resolved", this.onFeedingResolved);
    this.scene.events?.off?.(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate);
    this.marker?.destroy?.();
    this.listeners.clear();
    if (this.scene.playtestSessionSystem === this) this.scene.playtestSessionSystem = null;
  }
}
