import { NPC_TYPES } from "../data/npcs.js";
import { LAYERS } from "../data/district.js";

const REPORT_POINTS = Object.freeze([
  { id: "police", name: "police station", x: 780, y: 170, severityBonus: 10 },
  { id: "cross", name: "central crossroad", x: 488, y: 326, severityBonus: 6 },
  { id: "club", name: "club crowd", x: 642, y: 404, severityBonus: 4 }
]);

export class WitnessSystem {
  constructor(scene) {
    this.scene = scene;
    this.reports = 0;
    this.intercepts = 0;
  }

  update(dt) {
    this.watchActiveFeeding();
    this.updateAlarmedWitnesses(dt);
  }

  collectInteractions() {
    const witness = this.nearestAlarmedWitness(24);
    if (!witness) return [];
    return [{
      id: `intercept_${witness.id}`,
      type: "witness",
      label: "Intercept fleeing witness",
      detail: witness.reportTarget ? `before ${witness.reportTarget.name}` : "before report",
      priority: 125,
      distance: Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, witness.x, witness.y),
      x: witness.x,
      y: witness.y,
      run: () => this.interceptWitness(witness)
    }];
  }

  watchActiveFeeding() {
    const feed = this.scene.feedingSystem?.active;
    if (!feed || !feed.npc || feed.npc.type === NPC_TYPES.RAT) return;
    if (this.scene.currentLayer !== LAYERS.STREET) return;
    if (this.scene.currentShadow()) return;

    const witnesses = this.witnessesSeeing(feed.npc, 145);
    feed.maxWitnesses = Math.max(feed.maxWitnesses || 0, witnesses.length);
    if (!witnesses.length || feed.seenNotified) return;

    feed.seenNotified = true;
    for (const witness of witnesses) this.alarmWitness(witness, "public feeding", 24);
    this.scene.exposureSystem.add(14 + witnesses.length * 7, `Witnesses see you feeding in public (${witnesses.length}).`);
    this.scene.exposureSystem.forceLevel(2, "Public feeding forces police-level exposure.");
    if (witnesses.length >= 2 || this.scene.feedingSystem.hunger >= 75) {
      this.scene.exposureSystem.forceLevel(3, "Multiple witnesses make the feeding impossible to contain.");
    }
  }

  onFeedingCompleted(victim) {
    if (!victim || victim.type === NPC_TYPES.RAT) return { witnesses: 0 };
    if (this.scene.currentLayer !== LAYERS.STREET || this.scene.currentShadow()) return { witnesses: 0 };
    const witnesses = this.witnessesSeeing(victim, 155);
    if (!witnesses.length) return { witnesses: 0 };

    for (const witness of witnesses) this.alarmWitness(witness, "a freshly drained body", 24);
    this.scene.exposureSystem.add(18 + witnesses.length * 8, `The feeding ends in public view (${witnesses.length} witness(es)).`);
    this.scene.exposureSystem.forceLevel(2, "A public drain cannot stay local gossip.");
    if (witnesses.length >= 2) this.scene.exposureSystem.forceLevel(3, "Too many witnesses report the same impossible story.");
    return { witnesses: witnesses.length };
  }

  witnessesSeeing(subject, radius = 140) {
    return this.scene.npcSystem.npcs.filter(npc => {
      if (npc === subject || npc.dead || npc.inactive || npc.intercepted) return false;
      if (![NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET].includes(npc.type)) return false;
      if (npc.layer !== this.scene.currentLayer) return false;
      const dPlayer = Phaser.Math.Distance.Between(npc.x, npc.y, this.scene.player.x, this.scene.player.y);
      const dSubject = subject ? Phaser.Math.Distance.Between(npc.x, npc.y, subject.x, subject.y) : dPlayer;
      return Math.min(dPlayer, dSubject) <= radius;
    });
  }

  alarmWitness(witness, reason, severity = 14) {
    if (!witness || witness.dead || witness.intercepted) return;
    witness.alarmed = true;
    witness.witnessReason = reason;
    witness.reportSeverity = Math.max(witness.reportSeverity || 0, severity);
    witness.reportTarget = witness.reportTarget || this.closestReportPoint(witness);
    witness.vx = 0;
    witness.vy = 0;
  }

  closestReportPoint(witness) {
    return REPORT_POINTS
      .map(point => ({ point, score: Phaser.Math.Distance.Between(witness.x, witness.y, point.x, point.y) - point.severityBonus * 5 }))
      .sort((a, b) => a.score - b.score)[0].point;
  }

  updateAlarmedWitnesses(dt) {
    for (const witness of this.alarmedWitnesses()) {
      const target = witness.reportTarget || this.closestReportPoint(witness);
      witness.reportTarget = target;
      const dx = target.x - witness.x;
      const dy = target.y - witness.y;
      const len = Math.hypot(dx, dy) || 1;
      const speed = Math.max(42, (witness.speed || 14) * 3.6);
      witness.x += (dx / len) * speed * dt;
      witness.y += (dy / len) * speed * dt;
      witness.container.setPosition(witness.x, witness.y);

      if (len < 14) this.reportWitness(witness);
    }
  }

  reportWitness(witness) {
    if (!witness || witness.hasReported) return;
    witness.hasReported = true;
    witness.alarmed = false;
    this.reports++;
    const targetName = witness.reportTarget?.name || "the district";
    const severity = Math.max(12, witness.reportSeverity || 14) + (witness.reportTarget?.severityBonus || 0);
    this.scene.exposureSystem.add(Math.ceil(severity * 0.75), `A witness reaches ${targetName} and reports ${witness.witnessReason || "you"}.`);
  }

  interceptWitness(witness) {
    if (!witness || witness.dead || witness.intercepted) return;
    witness.alarmed = false;
    witness.intercepted = true;
    witness.inactive = true;
    witness.vx = 0;
    witness.vy = 0;
    witness.container.setAlpha(0.38);
    this.intercepts++;
    this.scene.exposureSystem.add(3, "You silence a fleeing witness, but the scuffle draws a little attention.");
    this.scene.lastActionText = "Witness intercepted before they could report.";
  }

  nearestAlarmedWitness(radius = 24) {
    let best = null;
    let bestD = Infinity;
    for (const witness of this.alarmedWitnesses()) {
      if (witness.layer !== this.scene.currentLayer) continue;
      const d = Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, witness.x, witness.y);
      if (d <= radius && d < bestD) {
        best = witness;
        bestD = d;
      }
    }
    return best;
  }

  alarmedWitnesses() {
    return this.scene.npcSystem.npcs.filter(npc => npc.alarmed && !npc.dead && !npc.intercepted && !npc.hasReported);
  }

  drawMarkers(graphics) {
    for (const witness of this.alarmedWitnesses()) {
      if (witness.layer !== this.scene.currentLayer) continue;
      graphics.lineStyle(2, 0xff3b50, 0.95).strokeCircle(witness.x, witness.y, 18);
      graphics.fillStyle(0xff3b50, 0.18).fillCircle(witness.x, witness.y, 18);
      this.scene.addMapLabel("! WITNESS", witness.x + 12, witness.y - 18, 0xff3b50);
      if (witness.reportTarget) {
        graphics.lineStyle(1, 0xff3b50, 0.32);
        graphics.beginPath();
        graphics.moveTo(witness.x, witness.y);
        graphics.lineTo(witness.reportTarget.x, witness.reportTarget.y);
        graphics.strokePath();
      }
    }
  }

  summary() {
    const fleeing = this.alarmedWitnesses().length;
    return `Witnesses fleeing ${fleeing} · reports ${this.reports} · intercepted ${this.intercepts}`;
  }
}
