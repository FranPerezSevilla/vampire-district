import { COMBAT_STATES } from "../data/combat.js";
import { movementNoiseProfile } from "../data/movement.js";
import { NPC_TYPES } from "../data/npcs.js";
import { pointInsideCone } from "../utils/geometry.js";
import { RawAudio } from "./RawAudioSystem.js";

const HUMAN_TYPES = new Set([
  NPC_TYPES.CIVILIAN,
  NPC_TYPES.TARGET,
  NPC_TYPES.POLICE,
  NPC_TYPES.HUNTER,
  NPC_TYPES.THUG
]);

const SIGHT_BY_TYPE = Object.freeze({
  [NPC_TYPES.CIVILIAN]: { range: 105, halfAngle: 0.72 },
  [NPC_TYPES.TARGET]: { range: 112, halfAngle: 0.72 },
  [NPC_TYPES.POLICE]: { range: 132, halfAngle: 0.62 },
  [NPC_TYPES.HUNTER]: { range: 148, halfAngle: 0.58 },
  [NPC_TYPES.THUG]: { range: 98, halfAngle: 0.68 }
});

const HEARING_MULTIPLIER = Object.freeze({
  [NPC_TYPES.CIVILIAN]: 1,
  [NPC_TYPES.TARGET]: 1.04,
  [NPC_TYPES.POLICE]: 1.18,
  [NPC_TYPES.HUNTER]: 1.24,
  [NPC_TYPES.THUG]: 1.06
});

export class MovementNoiseSystem {
  constructor(scene) {
    this.scene = scene;
    this.lastX = scene.player?.x || 0;
    this.lastY = scene.player?.y || 0;
    this.distanceSinceStep = 0;
    this.pulseUntil = 0;
    this.pulseMode = "run";
    this.graphics = scene.add.graphics().setDepth(41);

    // Milestone 5 makes the simulation the only owner of footsteps. The older
    // keyboard listener may still unlock WebAudio, but it no longer produces steps.
    if (RawAudio.stepTimer && typeof window !== "undefined") window.clearInterval(RawAudio.stepTimer);
    RawAudio.stepTimer = null;
    RawAudio.keysDown?.clear?.();
    RawAudio.startStepLoop = () => {};

    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  update(frame) {
    const player = this.scene.player;
    if (!player) return;

    const dx = player.x - this.lastX;
    const dy = player.y - this.lastY;
    const moved = Math.hypot(dx, dy);
    this.lastX = player.x;
    this.lastY = player.y;

    if (!frame?.worldEnabled || this.scene.transitionSystem?.active || this.scene.feedingSystem?.isActive()) {
      this.distanceSinceStep = 0;
      this.draw(frame);
      return;
    }

    if (!frame.hasMovementIntent || moved < 0.01 || moved > 80) {
      if (moved > 80) this.distanceSinceStep = 0;
      this.draw(frame);
      return;
    }

    const profile = movementNoiseProfile(frame.quietHeld);
    this.distanceSinceStep += moved;
    if (this.distanceSinceStep >= profile.stepDistance) {
      this.distanceSinceStep %= profile.stepDistance;
      this.emitFootstep(profile);
    }

    this.draw(frame);
  }

  emitFootstep(profile) {
    RawAudio.play(profile.audio, { cooldown: profile.mode === "quiet" ? 0.16 : 0.10 });
    this.pulseMode = profile.mode;
    this.pulseUntil = this.scene.time.now + 190;

    let heardOnly = 0;
    for (const npc of this.scene.npcSystem?.npcs || []) {
      if (!this.canHearNpc(npc)) continue;
      const radius = profile.hearingRadius * (HEARING_MULTIPLIER[npc.type] || 1);
      const distance = Phaser.Math.Distance.Between(npc.x, npc.y, this.scene.player.x, this.scene.player.y);
      if (distance > radius || this.canSeePlayer(npc)) continue;

      const wasReacting = (npc.soundReactionTimer || 0) > 0;
      npc.soundReactionTimer = Math.max(npc.soundReactionTimer || 0, profile.reactionSeconds);
      npc.soundSourceX = this.scene.player.x;
      npc.soundSourceY = this.scene.player.y;
      npc.vx = 0;
      npc.vy = 0;
      npc.chasingPlayer = false;
      const dx = this.scene.player.x - npc.x;
      const dy = this.scene.player.y - npc.y;
      const length = Math.hypot(dx, dy) || 1;
      npc.dirX = dx / length;
      npc.dirY = dy / length;
      this.ensureWtfLabel(npc);
      if (!wasReacting) heardOnly++;
    }

    if (heardOnly) RawAudio.play("witnessWtf", { cooldown: 0.55 });
    this.scene.events?.emit?.("movement:footstep", {
      mode: profile.mode,
      x: this.scene.player.x,
      y: this.scene.player.y,
      layer: this.scene.currentLayer,
      hearingRadius: profile.hearingRadius,
      heardOnly
    });
  }

  canHearNpc(npc) {
    return Boolean(
      npc
      && HUMAN_TYPES.has(npc.type)
      && !npc.dead
      && !npc.inactive
      && !npc.hiddenBody
      && !npc.intercepted
      && !npc.missionInformant
      && npc.layer === this.scene.currentLayer
      && npc.stunnedTimer <= 0
      && npc.combat?.state !== COMBAT_STATES.DOWNED
      && !npc.alarmed
      && !npc.chasingPlayer
      && !npc.enemyAttack
    );
  }

  canSeePlayer(npc) {
    const sight = SIGHT_BY_TYPE[npc.type] || SIGHT_BY_TYPE[NPC_TYPES.CIVILIAN];
    const shadowed = Boolean(this.scene.currentShadowAt?.(
      this.scene.player.x,
      this.scene.player.y,
      this.scene.currentLayer
    ));
    const range = sight.range * (shadowed ? 0.62 : 1);
    return pointInsideCone(
      { x: npc.x, y: npc.y },
      { x: npc.dirX || 0, y: npc.dirY || 1 },
      { x: this.scene.player.x, y: this.scene.player.y },
      range,
      sight.halfAngle
    );
  }

  ensureWtfLabel(npc) {
    if (!npc.__nbdWtfLabel) {
      npc.__nbdWtfLabel = this.scene.add.text(npc.x, npc.y - 26, "WTF", {
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: "10px",
        fontStyle: "bold",
        color: "#ffd58b",
        backgroundColor: "rgba(5, 6, 11, .78)",
        padding: { x: 4, y: 2 }
      }).setOrigin(0.5, 1).setDepth(72);
      npc.__nbdWtfLabel.setResolution?.(3);
      npc.__nbdWtfLabel.setStroke?.("#05060b", 2);
    }
    npc.__nbdWtfLabel.setPosition(npc.x, npc.y - 26).setVisible(true);
    return npc.__nbdWtfLabel;
  }

  draw(frame) {
    this.graphics.clear();
    if (!frame?.worldEnabled || this.scene.time.now >= this.pulseUntil) return;
    const remaining = Math.max(0, (this.pulseUntil - this.scene.time.now) / 190);
    const quiet = this.pulseMode === "quiet";
    const radius = quiet ? 10 + (1 - remaining) * 7 : 16 + (1 - remaining) * 18;
    const color = quiet ? 0x78c7a3 : 0xffb02e;
    this.graphics.lineStyle(1, color, remaining * (quiet ? 0.30 : 0.42))
      .strokeCircle(this.scene.player.x, this.scene.player.y, radius);
  }

  destroy() {
    this.graphics?.destroy?.();
  }
}
