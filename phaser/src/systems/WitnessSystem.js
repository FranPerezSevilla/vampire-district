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
    this.masqueradeReports = 0;
  }

  update(dt) {
    this.watchActiveDrain();
    this.updateAlarmedWitnesses(dt);
  }

  collectInteractions() {
    const witness = this.nearestAlarmedWitness(24);
    if (!witness) return [];
    return [{
      id: `intercept_${witness.id}`,
      type: "witness",
      label: witness.reactionTimer > 0 ? "Silence shocked witness" : "Intercept fleeing witness",
      detail: witness.reportTarget ? `before ${witness.reportTarget.name}` : "before report",
      priority: 125,
      distance: Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, witness.x, witness.y),
      x: witness.x,
      y: witness.y,
      run: () => this.interceptWitness(witness)
    }];
  }

  watchActiveDrain() {
    const feed = this.scene.feedingSystem?.active;
    if (!feed || feed.kind !== "drain" || !feed.npc || feed.npc.type === NPC_TYPES.RAT) return;
    if (this.scene.currentLayer !== LAYERS.STREET) return;

    const witnesses = this.witnessesSeeing(feed.npc, this.scene.currentShadow() ? 100 : 150);
    feed.maxWitnesses = Math.max(feed.maxWitnesses || 0, witnesses.length);
    if (!witnesses.length || feed.seenNotified) return;

    feed.seenNotified = true;
    for (const witness of witnesses) {
      this.alarmWitness(witness, "a vampire drain", 28, {
        masqueradeRisk: true,
        reactionSeconds: 2.4,
        source: feed.npc
      });
    }
    this.scene.lastActionText = `MASQUERADE RISK: ${witnesses.length} witness(es) saw the drain. They freeze, then run to report.`;
  }

  onDrainCompleted(victim, alreadyNotified = false) {
    if (!victim || victim.type === NPC_TYPES.RAT) return { witnesses: 0 };
    if (this.scene.currentLayer !== LAYERS.STREET) return { witnesses: 0 };
    if (alreadyNotified) return { witnesses: victim.maxWitnesses || 1 };

    const witnesses = this.witnessesSeeing(victim, this.scene.currentShadow() ? 105 : 155);
    if (!witnesses.length) return { witnesses: 0 };

    for (const witness of witnesses) {
      this.alarmWitness(witness, "a completed vampire drain", 30, {
        masqueradeRisk: true,
        reactionSeconds: 2.1,
        source: victim
      });
    }
    this.scene.lastActionText = `MASQUERADE RISK: witnesses saw the drained body. Stop them before they report.`;
    return { witnesses: witnesses.length };
  }

  onMundaneViolence(victim, label, severity = 8) {
    if (!victim || victim.type === NPC_TYPES.RAT) return 0;
    if (this.scene.currentLayer !== LAYERS.STREET) return 0;
    const witnesses = this.witnessesSeeing(victim, this.scene.currentShadow() ? 76 : 120);
    if (!witnesses.length) return 0;
    for (const witness of witnesses) {
      this.alarmWitness(witness, label, severity, {
        masqueradeRisk: false,
        reactionSeconds: 0.8,
        source: victim
      });
    }
    this.scene.exposureSystem.add(Math.ceil(severity * 0.45) + witnesses.length, `Witnesses notice ${label}.`);
    return witnesses.length;
  }

  onSuspiciousPower(_label, _severity = 0, _radius = 0, _options = {}) {
    return 0;
  }

  witnessesSeeing(subject, radius = 140, options = {}) {
    const excluded = new Set(options.exclude || []);
    return this.scene.npcSystem.npcs.filter(npc => {
      if (npc === subject || excluded.has(npc) || npc.dead || npc.inactive || npc.intercepted || npc.stunnedTimer > 0) return false;
      if (![NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET].includes(npc.type)) return false;
      if (npc.layer !== this.scene.currentLayer) return false;
      return this.canWitnessSee(npc, subject, radius) || this.canWitnessSee(npc, this.scene.player, radius);
    });
  }

  canWitnessSee(witness, subject, radius = 140) {
    if (!subject) return false;
    if (subject.layer !== undefined && subject.layer !== witness.layer) return false;
    const sx = subject.x ?? this.scene.player.x;
    const sy = subject.y ?? this.scene.player.y;
    const d = Phaser.Math.Distance.Between(witness.x, witness.y, sx, sy);
    let effectiveRadius = radius;
    if (this.scene.currentShadowAt(sx, sy, this.scene.currentLayer)) effectiveRadius *= 0.62;
    if (d > effectiveRadius) return false;
    if (d < 38) return true;

    const dx = sx - witness.x;
    const dy = sy - witness.y;
    const len = Math.hypot(dx, dy) || 1;
    const dot = (dx / len) * (witness.dirX || 0) + (dy / len) * (witness.dirY || 1);
    return dot >= 0.18;
  }

  alarmWitness(witness, reason, severity = 14, options = {}) {
    if (!witness || witness.dead || witness.intercepted || witness.stunnedTimer > 0) return;
    witness.alarmed = true;
    witness.witnessReason = reason;
    witness.reportSeverity = Math.max(witness.reportSeverity || 0, severity);
    witness.reportTarget = witness.reportTarget || this.closestReportPoint(witness);
    witness.masqueradeRisk = Boolean(witness.masqueradeRisk || options.masqueradeRisk);
    witness.reactionTimer = Math.max(witness.reactionTimer || 0, options.reactionSeconds ?? 1.4);
    witness.witnessSource = options.source || null;
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

      if (witness.reactionTimer > 0) {
        witness.reactionTimer = Math.max(0, witness.reactionTimer - dt);
        const source = witness.witnessSource || this.scene.player;
        const dx = (source.x ?? this.scene.player.x) - witness.x;
        const dy = (source.y ?? this.scene.player.y) - witness.y;
        const len = Math.hypot(dx, dy) || 1;
        witness.dirX = dx / len;
        witness.dirY = dy / len;
        witness.vx = 0;
        witness.vy = 0;
        witness.container.setPosition(witness.x, witness.y);
        continue;
      }

      const dx = target.x - witness.x;
      const dy = target.y - witness.y;
      const len = Math.hypot(dx, dy) || 1;
      const speed = witness.masqueradeRisk
        ? Math.max(34, (witness.speed || 14) * 2.45)
        : Math.max(28, (witness.speed || 14) * 2.0);
      witness.dirX = dx / len;
      witness.dirY = dy / len;
      this.scene.npcSystem.moveTowardAtSpeed(witness, target.x, target.y, dt, speed);
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

    if (witness.masqueradeRisk) {
      this.masqueradeReports++;
      this.scene.exposureSystem.forceLevel(5, `A witness reaches ${targetName} and reports a vampire drain.`);
      this.scene.missionSystem.failMasquerade(`Masquerade broken: a witness reported ${witness.witnessReason || "a vampire drain"}.`);
      return;
    }

    const severity = Math.max(12, witness.reportSeverity || 14) + (witness.reportTarget?.severityBonus || 0);
    this.scene.exposureSystem.add(Math.ceil(severity * 0.75), `A witness reaches ${targetName} and reports ${witness.witnessReason || "you"}.`);
  }

  interceptWitness(witness) {
    if (!witness || witness.dead || witness.intercepted) return;
    witness.alarmed = false;
    witness.intercepted = true;
    witness.inactive = true;
    witness.reactionTimer = 0;
    witness.vx = 0;
    witness.vy = 0;
    witness.container.setAlpha(0.38);
    this.intercepts++;
    this.scene.exposureSystem.add(witness.masqueradeRisk ? 2 : 3, witness.masqueradeRisk ? "You silence a masquerade witness before the report." : "You silence a fleeing witness, but the scuffle draws a little attention.");
    this.scene.lastActionText = witness.masqueradeRisk ? "Masquerade witness intercepted before they could report." : "Witness intercepted before they could report.";
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
    this.drawVisionCones(graphics);

    for (const witness of this.alarmedWitnesses()) {
      if (witness.layer !== this.scene.currentLayer) continue;
      const shocked = witness.reactionTimer > 0;
      const color = witness.masqueradeRisk ? 0xff3b50 : 0xffb02e;
      graphics.lineStyle(2, color, 0.95).strokeCircle(witness.x, witness.y, shocked ? 20 : 18);
      graphics.fillStyle(color, shocked ? 0.22 : 0.14).fillCircle(witness.x, witness.y, shocked ? 20 : 18);
      this.scene.addMapLabel(shocked ? "WTF" : witness.masqueradeRisk ? "! MASQ" : "! WITNESS", witness.x + 12, witness.y - 18, color);
      if (!shocked && witness.reportTarget) {
        graphics.lineStyle(1, color, 0.32);
        graphics.beginPath();
        graphics.moveTo(witness.x, witness.y);
        graphics.lineTo(witness.reportTarget.x, witness.reportTarget.y);
        graphics.strokePath();
      }
    }
  }

  drawVisionCones(graphics) {
    if (this.scene.currentLayer !== LAYERS.STREET) return;
    for (const witness of this.scene.npcSystem.npcs) {
      if (witness.dead || witness.inactive || witness.intercepted || witness.stunnedTimer > 0 || witness.layer !== this.scene.currentLayer) continue;
      if (![NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET, NPC_TYPES.POLICE].includes(witness.type)) continue;
      const isPolice = witness.type === NPC_TYPES.POLICE;
      const range = isPolice ? 132 : 105;
      const color = isPolice ? 0x4da3ff : witness.type === NPC_TYPES.TARGET ? 0xff4bd8 : 0xffe16b;
      const alpha = isPolice ? 0.10 : 0.075;
      const angle = Math.atan2(witness.dirY || 1, witness.dirX || 0);
      const half = isPolice ? 0.62 : 0.72;

      graphics.fillStyle(color, alpha);
      graphics.beginPath();
      graphics.moveTo(witness.x, witness.y);
      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        const a = angle - half + (half * 2 * i) / steps;
        graphics.lineTo(witness.x + Math.cos(a) * range, witness.y + Math.sin(a) * range);
      }
      graphics.closePath();
      graphics.fillPath();

      graphics.lineStyle(1, color, isPolice ? 0.25 : 0.18);
      graphics.beginPath();
      graphics.moveTo(witness.x, witness.y);
      graphics.lineTo(witness.x + Math.cos(angle - half) * range, witness.y + Math.sin(angle - half) * range);
      graphics.moveTo(witness.x, witness.y);
      graphics.lineTo(witness.x + Math.cos(angle + half) * range, witness.y + Math.sin(angle + half) * range);
      graphics.strokePath();
    }
  }

  summary() {
    const fleeing = this.alarmedWitnesses().length;
    const risk = this.alarmedWitnesses().filter(w => w.masqueradeRisk).length;
    return `Witnesses fleeing ${fleeing} · masquerade risk ${risk} · reports ${this.reports} · intercepted ${this.intercepts}`;
  }
}
