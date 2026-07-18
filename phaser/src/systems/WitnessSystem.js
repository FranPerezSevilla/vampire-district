import { AI_STATES } from "../data/ai.js";
import { COMBAT_STATES } from "../data/combat.js";
import { LAYERS } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";
import { RawAudio } from "./RawAudioSystem.js";

const REPORT_POINTS = Object.freeze([
  { id: "police", name: "police station", x: 780, y: 170, severityBonus: 10 },
  { id: "cross", name: "central crossroad", x: 488, y: 326, severityBonus: 6 },
  { id: "club", name: "club crowd", x: 642, y: 404, severityBonus: 4 }
]);

const SENSE_CONFIG = Object.freeze({
  [NPC_TYPES.CIVILIAN]: { vision: 105, visionHalf: 0.72, hearing: 142, hearingHalf: 2.62, visionColor: 0xffe16b, soundColor: 0xcbbf83 },
  [NPC_TYPES.TARGET]: { vision: 112, visionHalf: 0.72, hearing: 150, hearingHalf: 2.62, visionColor: 0xff4bd8, soundColor: 0xd889ca },
  [NPC_TYPES.POLICE]: { vision: 132, visionHalf: 0.62, hearing: 182, hearingHalf: 2.70, visionColor: 0x4da3ff, soundColor: 0x78bfff },
  [NPC_TYPES.HUNTER]: { vision: 148, visionHalf: 0.58, hearing: 194, hearingHalf: 2.72, visionColor: 0xff9d35, soundColor: 0xd88c52 },
  [NPC_TYPES.THUG]: { vision: 98, visionHalf: 0.68, hearing: 148, hearingHalf: 2.58, visionColor: 0xb36b42, soundColor: 0xb98a70 }
});

const HUMAN_TYPES = new Set([
  NPC_TYPES.CIVILIAN,
  NPC_TYPES.TARGET,
  NPC_TYPES.POLICE,
  NPC_TYPES.HUNTER,
  NPC_TYPES.THUG
]);

function stableFacing(npc) {
  let x = Number.isFinite(npc?.dirX) ? npc.dirX : 0;
  let y = Number.isFinite(npc?.dirY) ? npc.dirY : 0;
  const length = Math.hypot(x, y);
  if (length > 0.08) {
    x /= length;
    y /= length;
    npc.__nbdFacingX = x;
    npc.__nbdFacingY = y;
    return { x, y };
  }
  return {
    x: Number.isFinite(npc?.__nbdFacingX) ? npc.__nbdFacingX : 0,
    y: Number.isFinite(npc?.__nbdFacingY) ? npc.__nbdFacingY : 1
  };
}

function visibleHuman(npc, layer) {
  return Boolean(
    npc
    && HUMAN_TYPES.has(npc.type)
    && !npc.dead
    && !npc.inactive
    && !npc.intercepted
    && !npc.hiddenBody
    && !npc.missionInformant
    && npc.layer === layer
    && npc.combat?.state !== COMBAT_STATES.DOWNED
  );
}

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
      target: witness,
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
    RawAudio.play("witnessWtf");
    for (const witness of witnesses) {
      this.alarmWitness(witness, "a vampire drain", 28, {
        masqueradeRisk: true,
        reactionSeconds: 2.4,
        source: feed.npc
      });
    }
    this.scene.lastActionText = `VEIL RISK: ${witnesses.length} witness(es) saw the drain. They freeze, then run to report.`;
  }

  onDrainCompleted(victim, alreadyNotified = false) {
    if (!victim || victim.type === NPC_TYPES.RAT) return { witnesses: 0 };
    if (this.scene.currentLayer !== LAYERS.STREET) return { witnesses: 0 };
    if (alreadyNotified) return { witnesses: victim.maxWitnesses || 1 };

    const witnesses = this.witnessesSeeing(victim, this.scene.currentShadow() ? 105 : 155);
    if (!witnesses.length) return { witnesses: 0 };

    RawAudio.play("witnessWtf");
    for (const witness of witnesses) {
      this.alarmWitness(witness, "a completed vampire drain", 30, {
        masqueradeRisk: true,
        reactionSeconds: 2.1,
        source: victim
      });
    }
    this.scene.lastActionText = "VEIL RISK: witnesses saw the drained body. Stop them before they report.";
    return { witnesses: witnesses.length };
  }

  onMundaneViolence(victim, label, severity = 8) {
    if (!victim || victim.type === NPC_TYPES.RAT) return 0;
    if (this.scene.currentLayer !== LAYERS.STREET) return 0;
    const witnesses = this.witnessesSeeing(victim, this.scene.currentShadow() ? 76 : 120, { exclude: [victim] });
    if (!witnesses.length) return 0;
    RawAudio.play("witnessWtf");
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
    if (!subject) return [];
    const excluded = new Set(options.exclude || []);
    const layer = subject.layer ?? this.scene.currentLayer;
    const candidates = this.scene.npcSystem?.queryRadius?.(subject.x, subject.y, radius, layer)
      || this.scene.npcSystem?.npcs
      || [];
    return candidates.filter(npc => {
      if (npc === subject || excluded.has(npc) || npc.dead || npc.inactive || npc.intercepted) return false;
      if (npc.combat?.state === COMBAT_STATES.DOWNED || npc.drainVictim) return false;
      if (![NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET].includes(npc.type)) return false;
      if (npc.layer !== this.scene.currentLayer) return false;
      return this.canWitnessSee(npc, subject, radius) || this.canWitnessSee(npc, this.scene.player, radius);
    });
  }

  canWitnessSee(witness, subject, radius = 140) {
    if (!subject || !witness) return false;
    if (subject.layer !== undefined && subject.layer !== witness.layer) return false;
    const sx = subject.x ?? this.scene.player.x;
    const sy = subject.y ?? this.scene.player.y;
    const d = Phaser.Math.Distance.Between(witness.x, witness.y, sx, sy);
    let effectiveRadius = radius;
    if (this.scene.currentShadowAt(sx, sy, witness.layer)) effectiveRadius *= 0.62;
    if (d > effectiveRadius) return false;
    if (d < 38) return true;

    const dx = sx - witness.x;
    const dy = sy - witness.y;
    const len = Math.hypot(dx, dy) || 1;
    const facing = stableFacing(witness);
    const dot = (dx / len) * facing.x + (dy / len) * facing.y;
    return dot >= 0.18;
  }

  alarmWitness(witness, reason, severity = 14, options = {}) {
    if (!witness || witness.dead || witness.intercepted || witness.hasReported) return false;
    if (witness.combat?.state === COMBAT_STATES.DOWNED || witness.drainVictim) return false;
    if (![NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET].includes(witness.type)) return false;
    if (witness.stunnedTimer > 0 && !options.allowStunned) return false;

    witness.alarmed = true;
    witness.witnessReason = reason;
    witness.reportSeverity = Math.max(witness.reportSeverity || 0, severity);
    witness.reportTarget = witness.reportTarget || this.closestReportPoint(witness);
    witness.masqueradeRisk = Boolean(witness.masqueradeRisk || options.masqueradeRisk);
    witness.reactionTimer = Math.max(witness.reactionTimer || 0, options.reactionSeconds ?? 1.4);
    witness.witnessSource = options.source || null;
    witness.soundReactionTimer = 0;
    witness.__nbdWtfLabel?.setVisible?.(false);
    witness.vx = 0;
    witness.vy = 0;
    if (witness.ai) {
      witness.ai.role = "report";
      witness.ai.intent = "report";
    }
    this.scene.aiStateSystem?.resolveNpc?.(witness);
    return true;
  }

  closestReportPoint(witness) {
    return REPORT_POINTS
      .map(point => ({ point, score: Phaser.Math.Distance.Between(witness.x, witness.y, point.x, point.y) - point.severityBonus * 5 }))
      .sort((a, b) => a.score - b.score)[0].point;
  }

  updateAlarmedWitnesses(dt) {
    for (const witness of this.alarmedWitnesses()) {
      const state = witness.ai?.state;
      if ([AI_STATES.DOWNED, AI_STATES.DEAD, AI_STATES.INACTIVE].includes(state)) {
        this.scene.aiStateSystem?.cancelReportIntent?.(witness);
        continue;
      }
      if ([AI_STATES.STAGGERED, AI_STATES.DRAINING].includes(state)
        || (Number.isFinite(witness.stunnedTimer) && witness.stunnedTimer > 0)) {
        witness.vx = 0;
        witness.vy = 0;
        witness.container?.setPosition?.(witness.x, witness.y);
        continue;
      }

      const target = witness.reportTarget || this.closestReportPoint(witness);
      witness.reportTarget = target;
      if (witness.ai) {
        witness.ai.role = "report";
        witness.ai.intent = witness.reactionTimer > 0 ? "react" : "report";
      }

      if (witness.reactionTimer > 0) {
        const wasReacting = witness.reactionTimer;
        witness.reactionTimer = Math.max(0, witness.reactionTimer - dt);
        const source = witness.witnessSource || this.scene.player;
        this.facePoint(witness, source.x ?? this.scene.player.x, source.y ?? this.scene.player.y);
        witness.vx = 0;
        witness.vy = 0;
        witness.container?.setPosition?.(witness.x, witness.y);
        if (wasReacting > 0 && witness.reactionTimer <= 0) RawAudio.play("witnessRun");
        continue;
      }

      const speed = witness.masqueradeRisk
        ? Math.max(34, (witness.speed || 14) * 2.45)
        : Math.max(28, (witness.speed || 14) * 2.0);
      this.scene.npcSystem.moveTowardAtSpeed(witness, target.x, target.y, dt, speed);
      witness.container?.setPosition?.(witness.x, witness.y);

      const distance = Phaser.Math.Distance.Between(witness.x, witness.y, target.x, target.y);
      if (distance < 14) this.reportWitness(witness);
    }
  }

  reportWitness(witness) {
    if (!witness || witness.hasReported) return;
    if (witness.combat?.state === COMBAT_STATES.DOWNED || witness.drainVictim) return;
    if (Number.isFinite(witness.stunnedTimer) && witness.stunnedTimer > 0) return;

    witness.hasReported = true;
    witness.alarmed = false;
    this.reports++;
    const targetName = witness.reportTarget?.name || "the district";

    if (witness.masqueradeRisk) {
      this.masqueradeReports++;
      RawAudio.play("masqueradeFail");
      this.scene.exposureSystem.forceLevel(5, `A witness reaches ${targetName} and reports a vampire drain.`);
      this.scene.missionSystem.failMasquerade(`The veil is broken: a witness reported ${witness.witnessReason || "a vampire drain"}.`);
      return;
    }

    RawAudio.play("witnessReport");
    const severity = Math.max(12, witness.reportSeverity || 14) + (witness.reportTarget?.severityBonus || 0);
    this.scene.exposureSystem.add(Math.ceil(severity * 0.75), `A witness reaches ${targetName} and reports ${witness.witnessReason || "you"}.`);
  }

  interceptWitness(witness) {
    if (!witness || witness.dead || witness.intercepted) return;
    RawAudio.play("stun");
    witness.alarmed = false;
    witness.intercepted = true;
    witness.inactive = true;
    witness.reactionTimer = 0;
    witness.vx = 0;
    witness.vy = 0;
    witness.container.setAlpha(0.38);
    this.intercepts++;
    this.scene.exposureSystem.add(witness.masqueradeRisk ? 2 : 3, witness.masqueradeRisk ? "You silence a veil witness before the report." : "You silence a fleeing witness, but the scuffle draws a little attention.");
    this.scene.lastActionText = witness.masqueradeRisk ? "Veil witness intercepted before they could report." : "Witness intercepted before they could report.";
    this.scene.aiStateSystem?.resolveNpc?.(witness);
  }

  nearestAlarmedWitness(radius = 24) {
    let best = null;
    let bestD = Infinity;
    const candidates = this.scene.npcSystem?.queryRadius?.(
      this.scene.player.x,
      this.scene.player.y,
      radius,
      this.scene.currentLayer
    ) || this.alarmedWitnesses();
    for (const witness of candidates) {
      if (!witness.alarmed || witness.dead || witness.intercepted || witness.hasReported) continue;
      const d = Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, witness.x, witness.y);
      if (d < bestD) {
        best = witness;
        bestD = d;
      }
    }
    return best;
  }

  alarmedWitnesses() {
    return (this.scene.npcSystem?.npcs || []).filter(npc => Boolean(
      [NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET].includes(npc.type)
      && npc.alarmed
      && !npc.dead
      && !npc.inactive
      && !npc.intercepted
      && !npc.hasReported
      && !npc.drainVictim
      && npc.combat?.state !== COMBAT_STATES.DOWNED
    ));
  }

  facePoint(npc, x, y) {
    const dx = x - npc.x;
    const dy = y - npc.y;
    const length = Math.hypot(dx, dy) || 1;
    npc.dirX = dx / length;
    npc.dirY = dy / length;
  }

  drawMarkers(graphics) {
    this.drawVisionCones(graphics);
    this.drawHearingCones(graphics);

    for (const witness of this.alarmedWitnesses()) {
      if (witness.layer !== this.scene.currentLayer || !this.scene.npcSystem?.isRenderable?.(witness)) continue;
      const shocked = witness.reactionTimer > 0;
      const color = witness.masqueradeRisk ? 0xff3b50 : 0xffb02e;
      graphics.lineStyle(2, color, 0.95).strokeCircle(witness.x, witness.y, shocked ? 20 : 18);
      graphics.fillStyle(color, shocked ? 0.22 : 0.14).fillCircle(witness.x, witness.y, shocked ? 20 : 18);
      this.scene.addMapLabel(shocked ? "WTF" : witness.masqueradeRisk ? "! VEIL" : "! WITNESS", witness.x + 12, witness.y - 18, color);
      if (!shocked && witness.reportTarget) {
        graphics.lineStyle(1, color, 0.32);
        graphics.beginPath();
        graphics.moveTo(witness.x, witness.y);
        graphics.lineTo(witness.reportTarget.x, witness.reportTarget.y);
        graphics.strokePath();
      }
    }

    const time = this.scene.time.now;
    for (const npc of this.scene.npcSystem?.visibleInCamera?.(36) || []) {
      if (!visibleHuman(npc, this.scene.currentLayer) || !(npc.soundReactionTimer > 0)) continue;
      const pulse = (Math.sin(time * 0.01) + 1) * 0.5;
      graphics.lineStyle(2, 0xffb02e, 0.55 + pulse * 0.3).strokeCircle(npc.x, npc.y, 17 + pulse * 3);
      graphics.fillStyle(0xffb02e, 0.06 + pulse * 0.05).fillCircle(npc.x, npc.y, 17 + pulse * 3);
    }
  }

  drawVisionCones(graphics) {
    const drawn = new Set();
    for (const npc of this.scene.npcSystem?.visibleInCamera?.(24) || []) {
      if (!visibleHuman(npc, this.scene.currentLayer)) continue;
      const positionKey = `${npc.type}:${Math.round(npc.x / 3)}:${Math.round(npc.y / 3)}`;
      if (drawn.has(positionKey)) continue;
      drawn.add(positionKey);
      const senses = SENSE_CONFIG[npc.type] || SENSE_CONFIG[NPC_TYPES.CIVILIAN];
      this.drawFilledCone(graphics, npc, senses.vision, senses.visionHalf, senses.visionColor, npc.type === NPC_TYPES.POLICE ? 0.10 : 0.075);
    }
  }

  drawHearingCones(graphics) {
    const drawn = new Set();
    for (const npc of this.scene.npcSystem?.visibleInCamera?.(24) || []) {
      if (!visibleHuman(npc, this.scene.currentLayer)) continue;
      const positionKey = `${npc.type}:${Math.round(npc.x / 3)}:${Math.round(npc.y / 3)}`;
      if (drawn.has(positionKey)) continue;
      drawn.add(positionKey);
      const senses = SENSE_CONFIG[npc.type] || SENSE_CONFIG[NPC_TYPES.CIVILIAN];
      this.drawSoundField(graphics, npc, senses.hearing, senses.hearingHalf, senses.soundColor);
    }
  }

  drawFilledCone(graphics, npc, range, halfAngle, color, alpha) {
    const facing = stableFacing(npc);
    const angle = Math.atan2(facing.y, facing.x);
    const steps = 16;
    graphics.fillStyle(color, alpha);
    graphics.beginPath();
    graphics.moveTo(npc.x, npc.y);
    for (let index = 0; index <= steps; index++) {
      const current = angle - halfAngle + (halfAngle * 2 * index) / steps;
      graphics.lineTo(npc.x + Math.cos(current) * range, npc.y + Math.sin(current) * range);
    }
    graphics.closePath();
    graphics.fillPath();
    graphics.lineStyle(1, color, alpha * 2.5);
    graphics.beginPath();
    graphics.moveTo(npc.x, npc.y);
    graphics.lineTo(npc.x + Math.cos(angle - halfAngle) * range, npc.y + Math.sin(angle - halfAngle) * range);
    graphics.moveTo(npc.x, npc.y);
    graphics.lineTo(npc.x + Math.cos(angle + halfAngle) * range, npc.y + Math.sin(angle + halfAngle) * range);
    graphics.strokePath();
  }

  drawSoundField(graphics, npc, range, halfAngle, color) {
    const facing = stableFacing(npc);
    const angle = Math.atan2(facing.y, facing.x);
    for (const [radiusScale, alpha] of [[0.46, 0.12], [0.72, 0.095], [1, 0.075]]) {
      graphics.lineStyle(1, color, alpha);
      graphics.beginPath();
      graphics.arc(npc.x, npc.y, range * radiusScale, angle - halfAngle, angle + halfAngle, false);
      graphics.strokePath();
    }
  }

  summary() {
    const fleeing = this.alarmedWitnesses().length;
    const risk = this.alarmedWitnesses().filter(witness => witness.masqueradeRisk).length;
    return `Witnesses fleeing ${fleeing} · veil risk ${risk} · reports ${this.reports} · intercepted ${this.intercepts}`;
  }
}
