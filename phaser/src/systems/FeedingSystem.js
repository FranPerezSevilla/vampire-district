import { HUNGER } from "../data/balance.js";
import { NPC_TYPES } from "../data/npcs.js";
import { RawAudio } from "./RawAudioSystem.js";

const ATTACK_RADIUS = 26;
const STUN_SECONDS = 5.8;

export class FeedingSystem {
  constructor(scene) {
    this.scene = scene;
    this.hunger = HUNGER.start;
    this.active = null;
    this.passiveTick = 0;
    this.stats = {
      feeds: 0,
      targetFed: false,
      kills: 0,
      stuns: 0,
      targetHandled: false,
      civilianFeeds: 0,
      ratFeeds: 0,
      policeNeutralized: 0,
      huntersNeutralized: 0
    };
  }

  collectInteractions() {
    if (this.active) {
      return [{
        id: "cancel_drain",
        type: "drain",
        label: "Cancel drain",
        detail: "stop feeding before the body drops",
        priority: 130,
        distance: 0,
        x: this.scene.player.x,
        y: this.scene.player.y,
        run: () => this.cancel("You pull away before finishing the drain.")
      }];
    }

    const npc = this.scene.npcSystem.nearestAttackable(this.scene.player.x, this.scene.player.y, this.scene.currentLayer, ATTACK_RADIUS);
    if (!npc) return [];

    const d = Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, npc.x, npc.y);
    const options = [];

    if (npc.type !== NPC_TYPES.RAT && npc.stunnedTimer <= 0) {
      options.push({
        id: `stun_${npc.id}`,
        type: "stun",
        label: `Stun ${this.targetName(npc)}`,
        detail: "non-lethal · temporary control · small noise",
        priority: 118,
        distance: d,
        x: npc.x,
        y: npc.y,
        run: () => this.stun(npc)
      });
    }

    if (npc.type !== NPC_TYPES.RAT) {
      options.push({
        id: `kill_${npc.id}`,
        type: "kill",
        label: `Kill ${this.targetName(npc)}`,
        detail: "lethal · noisy · leaves body · no hunger relief",
        priority: npc.type === NPC_TYPES.TARGET ? 122 : 106,
        distance: d,
        x: npc.x,
        y: npc.y,
        run: () => this.kill(npc)
      });
    }

    options.push({
      id: `drain_${npc.id}`,
      type: "drain",
      label: npc.type === NPC_TYPES.RAT ? "Drain rat" : `Drain ${this.targetName(npc)}`,
      detail: `hunger -${this.reliefFor(npc)} · masquerade risk if seen`,
      priority: npc.type === NPC_TYPES.TARGET ? 126 : 104,
      distance: d,
      x: npc.x,
      y: npc.y,
      run: () => this.startDrain(npc)
    });

    return options;
  }

  addPassiveHunger(dt) {
    if (!dt || this.scene.missionSystem?.failed) return;
    const before = this.hunger;
    this.hunger = Math.min(100, this.hunger + HUNGER.passivePerSecond * dt);
    this.passiveTick += dt;
    if (Math.floor(before / 25) !== Math.floor(this.hunger / 25) && this.passiveTick > 3) {
      this.passiveTick = 0;
      this.scene.lastActionText = `Hunger rises with time: ${Math.round(this.hunger)}%. Feeding becomes more tempting.`;
    }
  }

  addNoise(x, y, amount, reason) {
    if (this.scene.currentLayer !== undefined && this.scene.currentLayer !== 0) return;
    this.scene.policeSystem?.addHeat(x, y, amount, reason);
  }

  stun(npc) {
    if (!npc || npc.dead || npc.inactive) return;
    RawAudio.play("stun");
    this.scene.npcSystem.markStunned(npc, STUN_SECONDS);
    this.stats.stuns++;
    this.addNoise(npc.x, npc.y, npc.type === NPC_TYPES.POLICE ? 12 : 6, `${this.targetName(npc)} stunned; a scuffle makes noise`);
    const seen = this.scene.witnessSystem?.onMundaneViolence(npc, `${this.targetName(npc)} stunned`, 5) || 0;
    this.scene.lastActionText = `STUN: ${this.targetName(npc)} is down for ${Math.round(STUN_SECONDS)}s. Noise spreads nearby.${seen ? ` ${seen} witness(es) saw the scuffle.` : ""}`;
  }

  kill(npc) {
    if (!npc || npc.dead || npc.inactive) return;
    RawAudio.play("kill");
    const seen = this.scene.witnessSystem?.onMundaneViolence(npc, `${this.targetName(npc)} killed`, this.killSeverity(npc)) || 0;
    this.scene.npcSystem.markKilled(npc);
    this.scene.evidenceSystem?.onKillCompleted(npc);
    this.stats.kills++;
    this.trackNeutralized(npc);
    this.addNoise(npc.x, npc.y, this.killNoise(npc), `${this.targetName(npc)} killed; impact and struggle heard`);
    if (npc.type === NPC_TYPES.TARGET) {
      this.stats.targetHandled = true;
      this.scene.missionSystem.resolveJournalistPlaceholder("Journalist eliminated without draining. Return to the rooftop refuge to report.");
    }
    this.scene.lastActionText = `KILL: ${this.targetName(npc)} eliminated. Killing is noisy and leaves a body.${seen ? ` ${seen} witness(es) may report ordinary violence.` : ""}`;
    this.scene.redrawLayer(this.scene.lastActionText);
  }

  startDrain(npc) {
    if (!npc || npc.dead || this.active) return;
    RawAudio.play("drainStart");
    this.active = {
      kind: "drain",
      npc,
      time: 0,
      duration: this.durationFor(npc),
      seenNotified: false,
      maxWitnesses: 0
    };
    npc.vx = 0;
    npc.vy = 0;
    npc.luredTimer = 0;
    this.scene.lastActionText = `DRAIN started: ${this.targetName(npc)}. Moving will cancel it. If someone sees, they freeze first, then run to report.`;
  }

  update(dt, movementIntent = false) {
    if (!this.active) return;
    if (movementIntent) {
      this.cancel("You move and break away before finishing the drain.");
      return;
    }

    this.active.time += dt;
    if (this.active.time >= this.active.duration) this.completeDrain();
  }

  cancel(message = "Drain cancelled.") {
    if (this.active) RawAudio.play("drainCancel");
    this.active = null;
    this.scene.lastActionText = message;
  }

  completeDrain() {
    const feed = this.active;
    if (!feed) return;
    const npc = feed.npc;
    this.active = null;

    RawAudio.play("drainComplete");
    const witnessResult = this.scene.witnessSystem?.onDrainCompleted(npc, feed.seenNotified) || { witnesses: 0 };
    const relief = this.reliefFor(npc);
    this.hunger = Math.max(0, this.hunger - relief);
    this.stats.feeds++;
    if (npc.type === NPC_TYPES.TARGET) {
      this.stats.targetFed = true;
      this.stats.targetHandled = true;
    }
    if (npc.type === NPC_TYPES.CIVILIAN) this.stats.civilianFeeds++;
    if (npc.type === NPC_TYPES.RAT) this.stats.ratFeeds++;
    this.trackNeutralized(npc);

    this.scene.npcSystem.markFed(npc);
    this.scene.evidenceSystem?.onFeedCompleted(npc);

    if (npc.type === NPC_TYPES.TARGET) {
      this.scene.missionSystem.resolveJournalistPlaceholder("Journalist drained. Return to the rooftop refuge to report before the district reacts.");
    }

    const publicNote = witnessResult.witnesses ? ` Masquerade witness(es): ${witnessResult.witnesses}.` : "";
    this.scene.lastActionText = `DRAIN complete: ${this.targetName(npc)}. Hunger -${relief}. A body remains.${publicNote}`;
    this.scene.redrawLayer(this.scene.lastActionText);
  }

  trackNeutralized(npc) {
    if (npc.type === NPC_TYPES.POLICE) this.stats.policeNeutralized++;
    if (npc.type === NPC_TYPES.HUNTER) this.stats.huntersNeutralized++;
  }

  killSeverity(npc) {
    if (npc.type === NPC_TYPES.POLICE) return 18;
    if (npc.type === NPC_TYPES.HUNTER) return 22;
    if (npc.type === NPC_TYPES.TARGET) return 14;
    return 10;
  }

  killNoise(npc) {
    if (npc.type === NPC_TYPES.POLICE) return 22;
    if (npc.type === NPC_TYPES.HUNTER) return 26;
    if (npc.type === NPC_TYPES.TARGET) return 16;
    return 12;
  }

  reliefFor(npc) {
    if (!npc) return 0;
    if (npc.type === NPC_TYPES.TARGET) return HUNGER.targetRelief;
    if (npc.type === NPC_TYPES.RAT) return HUNGER.ratRelief;
    if (npc.type === NPC_TYPES.POLICE) return 34;
    if (npc.type === NPC_TYPES.HUNTER) return 28;
    return HUNGER.civilianRelief;
  }

  durationFor(npc) {
    if (!npc) return HUNGER.civilianFeedSeconds;
    if (npc.type === NPC_TYPES.TARGET) return HUNGER.targetFeedSeconds;
    if (npc.type === NPC_TYPES.RAT) return HUNGER.ratFeedSeconds;
    if (npc.type === NPC_TYPES.POLICE) return 2.7;
    if (npc.type === NPC_TYPES.HUNTER) return 3.0;
    return HUNGER.civilianFeedSeconds;
  }

  targetName(npc) {
    if (!npc) return "target";
    if (npc.type === NPC_TYPES.TARGET) return "journalist";
    if (npc.type === NPC_TYPES.POLICE) return "police officer";
    if (npc.type === NPC_TYPES.HUNTER) return "hunter";
    if (npc.type === NPC_TYPES.RAT) return "rat";
    return "civilian";
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
      label: `Drain ${this.targetName(this.active.npc)}`
    };
  }

  summary() {
    const active = this.active ? ` · draining ${Math.round((this.active.time / this.active.duration) * 100)}%` : "";
    return `Hunger ${Math.round(this.hunger)}% · drains ${this.stats.feeds} · kills ${this.stats.kills} · stuns ${this.stats.stuns}${active}`;
  }
}