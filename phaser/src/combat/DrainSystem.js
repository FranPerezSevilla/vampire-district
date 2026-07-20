import { COMBAT_STATES } from "../data/combat.js";
import { DRAIN_KINDS, DRAIN_RULES, selectDrainCandidate } from "../data/drain.js";
import { NPC_TYPES } from "../data/npcs.js";
import { RawAudio } from "../systems/RawAudioSystem.js";

const HEARING_BY_TYPE = Object.freeze({
  [NPC_TYPES.CIVILIAN]: 118,
  [NPC_TYPES.TARGET]: 124,
  [NPC_TYPES.POLICE]: 148,
  [NPC_TYPES.HUNTER]: 158,
  [NPC_TYPES.THUG]: 126
});
const MAX_DRAIN_HEARING = Math.max(...Object.values(HEARING_BY_TYPE));

export class DrainSystem {
  constructor(scene) {
    this.scene = scene;
    this.candidate = null;
    this.invalidUntil = 0;
    this.invalidReason = "";
    this.graphics = scene.add.graphics().setDepth(72);
    this.label = scene.add.text(0, 0, "", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "12px",
      fontStyle: "bold",
      color: "#ffd8df",
      backgroundColor: "rgba(24, 5, 13, .86)",
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5, 1).setDepth(74).setVisible(false);
    this.label.setResolution?.(3);
    this.label.setStroke?.("#05060b", 2);
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  update(_dt, frame) {
    this.candidate = this.findCandidate();
    const active = this.scene.feedingSystem?.active;

    if (active?.source === "rightMouse") {
      this.updateActiveDrain(frame, active);
      this.draw(frame);
      return;
    }

    // RMB is a held action. If the player presses it during the final attack
    // recovery frame, keep it armed and begin as soon as combat releases the
    // input instead of forcing an unexplained release-and-click retry.
    if (frame?.drainHeld && this.canStart(frame)) {
      if (this.candidate) this.startDrain(this.candidate);
      else if (frame.drainPressed) this.rejectDrain();
    }

    this.draw(frame);
  }

  canStart(frame) {
    return Boolean(
      frame?.worldEnabled
      && frame?.drainHeld
      && !this.scene.transitionSystem?.active
      && !this.scene.interactionSystem?.isOpen
      && !this.scene.feedingSystem?.isActive()
      && !this.scene.combatSystem?.isBusy()
      && !this.scene.playerDamageSystem?.isHitStunned()
      && !this.scene.missionSystem?.failed
    );
  }

  findCandidate() {
    const player = this.scene.player;
    if (!player || !this.scene.npcSystem) return null;

    const director = this.scene.tutorialDirector;
    const acquisitionRadius = DRAIN_RULES.range + DRAIN_RULES.acquisitionPadding;
    const candidates = this.scene.npcSystem.queryRadius?.(
      player.x,
      player.y,
      acquisitionRadius,
      this.scene.currentLayer
    ) || this.scene.npcSystem.npcs;
    const eligibleCandidates = candidates.filter(npc => {
      if (director?.state === "drain-thug" && npc.id === "rooftop_thug") {
        return npc.combat?.state === COMBAT_STATES.DOWNED;
      }
      return true;
    });

    return selectDrainCandidate(
      { x: player.x, y: player.y, layer: this.scene.currentLayer },
      this.scene.combatSystem?.aimDirection || { x: 0, y: -1 },
      eligibleCandidates,
      {
        currentLayer: this.scene.currentLayer,
        lineClear: npc => this.lineClear(npc)
      }
    );
  }

  lineClear(npc) {
    const player = this.scene.player;
    if (!npc || !player) return false;
    if (!this.scene.npcSystem?.lineClear) return true;
    return this.scene.npcSystem.lineClear(npc, npc.x, npc.y, player.x, player.y);
  }

  startDrain(candidate) {
    const npc = candidate?.npc;
    if (!npc) return;

    this.scene.feedingSystem.startDrain(npc, {
      source: "rightMouse",
      eligibility: candidate.kind
    });

    const heard = this.emitDrainHearing(npc);
    if (heard > 0) {
      this.scene.lastActionText = `${this.scene.lastActionText} ${heard} nearby NPC(s) hear the struggle and turn toward it.`;
    }
    this.scene.events?.emit?.("feeding:right-click-started", {
      targetId: npc.id,
      eligibility: candidate.kind
    });
  }

  updateActiveDrain(frame, active) {
    if (!frame?.worldEnabled) {
      this.scene.feedingSystem.cancel("The drain stops when the world is interrupted.");
      return;
    }
    if (!frame.drainHeld) {
      this.scene.feedingSystem.cancel("You release the victim before the drain is complete.");
      return;
    }
    if (frame.hasMovementIntent) {
      this.scene.feedingSystem.cancel("You move and break away before finishing the drain.");
      return;
    }
    if (!this.activeTargetStillValid(active)) {
      this.scene.feedingSystem.cancel("The victim is no longer in a valid draining position.");
    }
  }

  activeTargetStillValid(active) {
    const npc = active?.npc;
    const player = this.scene.player;
    if (!npc || !player || npc.dead || npc.inactive || npc.hiddenBody || npc.intercepted) return false;
    if (npc.layer !== this.scene.currentLayer) return false;
    const distance = Phaser.Math.Distance.Between(player.x, player.y, npc.x, npc.y);
    if (distance > DRAIN_RULES.breakRange) return false;
    return this.lineClear(npc);
  }

  rejectDrain() {
    this.invalidUntil = this.scene.time.now + DRAIN_RULES.invalidFeedbackMs;
    this.invalidReason = "NO VALID DRAIN";
    RawAudio.play("cancel", { cooldown: 0.12 });
  }

  emitDrainHearing(victim) {
    const source = { x: victim.x, y: victim.y, layer: victim.layer };
    const candidates = this.scene.npcSystem?.queryRadius?.(
      source.x,
      source.y,
      MAX_DRAIN_HEARING,
      source.layer
    ) || this.scene.npcSystem?.npcs || [];
    let heard = 0;

    for (const npc of candidates) {
      if (npc === victim || npc.dead || npc.inactive || npc.intercepted || npc.hiddenBody || npc.missionInformant) continue;
      if (npc.layer !== source.layer || npc.stunnedTimer > 0 || npc.alarmed || npc.chasingPlayer || npc.drainVictim) continue;
      if (npc.combat?.state === COMBAT_STATES.DOWNED || npc.enemyAttack) continue;
      const radius = HEARING_BY_TYPE[npc.type];
      if (!radius) continue;
      const distance = Phaser.Math.Distance.Between(npc.x, npc.y, source.x, source.y);
      if (distance > radius) continue;

      const saw = this.scene.witnessSystem?.canWitnessSee?.(npc, victim, Math.min(radius, 145))
        || this.scene.witnessSystem?.canWitnessSee?.(npc, this.scene.player, Math.min(radius, 145));
      if (saw) continue;

      npc.soundReactionTimer = Math.max(npc.soundReactionTimer || 0, 1.6);
      npc.soundSourceX = source.x;
      npc.soundSourceY = source.y;
      npc.vx = 0;
      npc.vy = 0;
      const dx = source.x - npc.x;
      const dy = source.y - npc.y;
      const length = Math.hypot(dx, dy) || 1;
      npc.dirX = dx / length;
      npc.dirY = dy / length;
      this.ensureWtfLabel(npc);
      heard++;
    }

    if (heard) RawAudio.play("witnessWtf", { cooldown: 0.45 });
    return heard;
  }

  ensureWtfLabel(npc) {
    if (npc.__nbdWtfLabel) return npc.__nbdWtfLabel;
    npc.__nbdWtfLabel = this.scene.add.text(npc.x, npc.y - 26, "WTF", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "12px",
      fontStyle: "bold",
      color: "#ffd58b",
      backgroundColor: "rgba(5, 6, 11, .78)",
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5, 1).setDepth(72).setVisible(true);
    npc.__nbdWtfLabel.setResolution?.(3);
    npc.__nbdWtfLabel.setStroke?.("#05060b", 2);
    return npc.__nbdWtfLabel;
  }

  isBusy() {
    return this.scene.feedingSystem?.active?.source === "rightMouse";
  }

  draw(frame) {
    this.graphics.clear();
    this.label.setVisible(false);
    if (!frame?.worldEnabled) return;

    const active = this.scene.feedingSystem?.active;
    if (active?.source === "rightMouse" && active.npc) {
      const npc = active.npc;
      this.graphics.lineStyle(2, 0xff3b50, 0.72);
      this.graphics.beginPath();
      this.graphics.moveTo(this.scene.player.x, this.scene.player.y);
      this.graphics.lineTo(npc.x, npc.y);
      this.graphics.strokePath();
      this.graphics.lineStyle(2, 0xff3b50, 0.9).strokeCircle(npc.x, npc.y, 17);
      this.label.setText("HOLD RMB").setPosition(npc.x, npc.y - 22).setVisible(true);
      return;
    }

    if (this.candidate && frame.pointerInside) {
      const npc = this.candidate.npc;
      const downed = this.candidate.kind === DRAIN_KINDS.DOWNED;
      const color = downed ? 0xffb02e : 0xff3b50;
      this.graphics.lineStyle(2, color, 0.82).strokeCircle(npc.x, npc.y, downed ? 18 : 15);
      this.graphics.fillStyle(color, 0.08).fillCircle(npc.x, npc.y, downed ? 18 : 15);
      this.label.setText("RMB · DRAIN").setPosition(npc.x, npc.y - 21).setVisible(true);
      return;
    }

    if (this.scene.time.now < this.invalidUntil) {
      this.label
        .setText(this.invalidReason)
        .setPosition(this.scene.player.x, this.scene.player.y - 24)
        .setVisible(true);
    }
  }

  destroy() {
    this.graphics?.destroy?.();
    this.label?.destroy?.();
  }
}
