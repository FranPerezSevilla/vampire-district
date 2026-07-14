import { HUNGER } from "../data/balance.js";
import { NPC_TYPES } from "../data/npcs.js";

export class FeedingSystem {
  constructor(scene) {
    this.scene = scene;
    this.hunger = HUNGER.start;
    this.active = null;
    this.stats = {
      feeds: 0,
      targetFed: false,
      civilianFeeds: 0,
      ratFeeds: 0
    };
  }

  collectInteractions() {
    if (this.active) {
      return [{
        id: "cancel_feed",
        type: "feeding",
        label: "Cancel feeding",
        detail: "stop feeding",
        priority: 120,
        distance: 0,
        x: this.scene.player.x,
        y: this.scene.player.y,
        run: () => this.cancel("You pull away before finishing the feed.")
      }];
    }

    const npc = this.scene.npcSystem.nearestFeedable(this.scene.player.x, this.scene.player.y, this.scene.currentLayer, 24);
    if (!npc) return [];

    return [{
      id: `feed_${npc.id}`,
      type: "feeding",
      label: npc.type === NPC_TYPES.TARGET ? "Feed on journalist" : npc.type === NPC_TYPES.RAT ? "Feed on rat" : "Feed on civilian",
      detail: `hunger -${this.reliefFor(npc)} · hold still`,
      priority: npc.type === NPC_TYPES.TARGET ? 115 : 95,
      distance: Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, npc.x, npc.y),
      x: npc.x,
      y: npc.y,
      run: () => this.start(npc)
    }];
  }

  start(npc) {
    if (!npc || npc.dead || this.active) return;
    this.active = {
      npc,
      time: 0,
      duration: this.durationFor(npc),
      seenNotified: false,
      maxWitnesses: 0
    };
    npc.vx = 0;
    npc.vy = 0;
    this.scene.lastActionText = `Feeding started: ${this.feedLabel(npc)}. Moving will cancel it.`;
  }

  update(dt, movementIntent = false) {
    if (!this.active) return;
    if (movementIntent) {
      this.cancel("You move and break away before finishing the feed.");
      return;
    }

    this.active.time += dt;
    if (this.active.time >= this.active.duration) this.complete();
  }

  cancel(message = "Feeding cancelled.") {
    this.active = null;
    this.scene.lastActionText = message;
  }

  complete() {
    const feed = this.active;
    if (!feed) return;
    const npc = feed.npc;
    this.active = null;

    const witnessResult = this.scene.witnessSystem?.onFeedingCompleted(npc) || { witnesses: 0 };
    const relief = this.reliefFor(npc);
    this.hunger = Math.max(0, this.hunger - relief);
    this.stats.feeds++;
    if (npc.type === NPC_TYPES.TARGET) this.stats.targetFed = true;
    if (npc.type === NPC_TYPES.CIVILIAN) this.stats.civilianFeeds++;
    if (npc.type === NPC_TYPES.RAT) this.stats.ratFeeds++;

    this.scene.npcSystem.markFed(npc);
    this.scene.evidenceSystem?.onFeedCompleted(npc);

    if (npc.type === NPC_TYPES.TARGET) {
      this.scene.missionSystem.resolveJournalistPlaceholder("Journalist fed. Return to the rooftop refuge to report.");
    }

    const publicNote = witnessResult.witnesses ? ` Public witnesses: ${witnessResult.witnesses}.` : "";
    this.scene.lastActionText = `${this.feedLabel(npc)} complete. Hunger -${relief}. A body remains.${publicNote}`;
    this.scene.redrawLayer(this.scene.lastActionText);
  }

  reliefFor(npc) {
    if (!npc) return 0;
    if (npc.type === NPC_TYPES.TARGET) return HUNGER.targetRelief;
    if (npc.type === NPC_TYPES.RAT) return HUNGER.ratRelief;
    return HUNGER.civilianRelief;
  }

  durationFor(npc) {
    if (!npc) return HUNGER.civilianFeedSeconds;
    if (npc.type === NPC_TYPES.TARGET) return HUNGER.targetFeedSeconds;
    if (npc.type === NPC_TYPES.RAT) return HUNGER.ratFeedSeconds;
    return HUNGER.civilianFeedSeconds;
  }

  feedLabel(npc) {
    if (!npc) return "Feed";
    if (npc.type === NPC_TYPES.TARGET) return "Journalist feed";
    if (npc.type === NPC_TYPES.RAT) return "Rat feed";
    return "Civilian feed";
  }

  isActive() {
    return Boolean(this.active);
  }

  progress() {
    if (!this.active) return null;
    return {
      x: this.scene.player.x,
      y: this.scene.player.y,
      pct: Math.min(1, this.active.time / this.active.duration),
      label: this.feedLabel(this.active.npc)
    };
  }

  summary() {
    const active = this.active ? ` · feeding ${Math.round((this.active.time / this.active.duration) * 100)}%` : "";
    return `Hunger ${Math.round(this.hunger)}% · feeds ${this.stats.feeds}${active}`;
  }
}
