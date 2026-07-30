import { PLAYER } from "../data/balance.js";
import { NPC_TYPES } from "../data/npcs.js";
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
const PREY_COLOR = 0xff4bd8;
const REFUGE_COLOR = 0x78c7a3;

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

function distanceBetween(a, b) {
  return Math.hypot((Number(a?.x) || 0) - (Number(b?.x) || 0), (Number(a?.y) || 0) - (Number(b?.y) || 0));
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
    const distanceFromRefuge = distanceBetween(player, this.refuge);
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
      this.drawGuidanceMarker();
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

  nearestPrey() {
    const player = this.scene.player;
    const layer = Number(this.scene.currentLayer) || 0;
    const candidates = this.scene.npcSystem?.npcs || [];
    let nearest = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const npc of candidates) {
      if (!npc
        || npc.type !== NPC_TYPES.CIVILIAN
        || npc.layer !== layer
        || npc.dead
        || npc.inactive
        || npc.intercepted
        || npc.hiddenBody) continue;
      const distance = distanceBetween(player, npc);
      if (distance >= nearestDistance) continue;
      nearest = npc;
      nearestDistance = distance;
    }
    return nearest;
  }

  drawGuidanceMarker() {
    const active = this.state.status === PLAYTEST_STATUS.ACTIVE;
    const returning = this.state.objectiveIndex === 2;
    const target = returning ? this.refuge : this.nearestPrey();
    this.marker.clear().setVisible(Boolean(active && target));
    if (!active || !target) return;

    const color = returning ? REFUGE_COLOR : PREY_COLOR;
    const pulse = (Math.sin((this.scene.time?.now || 0) * 0.008) + 1) * 0.5;
    if (target.layer === this.scene.currentLayer) {
      if (returning) {
        this.marker.lineStyle(3, color, 0.68 + pulse * 0.24)
          .strokeCircle(target.x, target.y, this.config.safeRadius + pulse * 8);
      } else {
        this.marker.fillStyle(0x05060b, 0.5).fillCircle(target.x, target.y, 15 + pulse * 2);
        this.marker.lineStyle(2, color, 0.78 + pulse * 0.2).strokeCircle(target.x, target.y, 20 + pulse * 4);
      }
    }
    this.drawDirectionArrow(target, color, pulse);
  }

  drawDirectionArrow(target, color, pulse) {
    const player = this.scene.player;
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 28) return;

    const ux = dx / distance;
    const uy = dy / distance;
    const px = -uy;
    const py = ux;
    const startDistance = 19;
    const endDistance = Math.min(82 + pulse * 4, Math.max(34, distance - 12));
    const endX = player.x + ux * endDistance;
    const endY = player.y + uy * endDistance;
    const headLength = 14;
    const headWidth = 8;
    const stemX = endX - ux * (headLength - 1);
    const stemY = endY - uy * (headLength - 1);
    const baseX = endX - ux * headLength;
    const baseY = endY - uy * headLength;

    this.marker.lineStyle(6, 0x05060b, 0.76)
      .beginPath()
      .moveTo(player.x + ux * startDistance, player.y + uy * startDistance)
      .lineTo(stemX, stemY)
      .strokePath();
    this.marker.lineStyle(3, color, 0.94)
      .beginPath()
      .moveTo(player.x + ux * startDistance, player.y + uy * startDistance)
      .lineTo(stemX, stemY)
      .strokePath();
    this.marker.fillStyle(0x05060b, 0.84).fillTriangle(
      endX + ux * 2,
      endY + uy * 2,
      baseX + px * (headWidth + 2),
      baseY + py * (headWidth + 2),
      baseX - px * (headWidth + 2),
      baseY - py * (headWidth + 2)
    );
    this.marker.fillStyle(color, 1).fillTriangle(
      endX,
      endY,
      baseX + px * headWidth,
      baseY + py * headWidth,
      baseX - px * headWidth,
      baseY - py * headWidth
    );
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
