import { COLORS } from "../data/balance.js";
import { NPC_TYPES } from "../data/npcs.js";
import { resolveAction } from "./ActionSystem.js";
import { RawAudio } from "./RawAudioSystem.js";

const POLICE_JUMP_START = Object.freeze({ x: 650, y: 166 });
const POLICE_JUMP_END = Object.freeze({ x: 696, y: 154 });

export class TransitionSystem {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.graphics = scene.add.graphics().setDepth(44);
  }

  begin(message) {
    if (this.active) return false;
    this.active = true;
    this.scene.nearestInteraction = null;
    this.scene.nearestMovement = null;
    this.scene.lastActionText = message;
    this.graphics.clear();
    return true;
  }

  roofJump({ from, to, toLayer, status }) {
    if (this.policeRoofJumpBlocked(from, to)) {
      RawAudio.play("cancel");
      const thug = this.rooftopThug();
      if (thug) this.graphics.lineStyle(2, 0xff3b50, 0.85).strokeCircle(thug.x, thug.y, 22);
      this.scene.lastActionText = "The rooftop thug blocks the jump to the police station. Neutralize him to open the route.";
      return;
    }

    if (!this.begin("Rooftop jump: committing to the gap.")) return;
    RawAudio.play("routeRoof");
    this.drawArc(from, to, COLORS.accent);
    this.animateParabola({
      from,
      to,
      duration: 760,
      height: 40,
      peakScale: 1.34,
      landingColor: COLORS.accent,
      onComplete: () => {
        this.scene.missionSystem?.onRooftopJump?.();
        this.complete(toLayer, to, status);
      }
    });
  }

  roofDrop({ from, to, toLayer, status }) {
    if (!this.begin("Roof drop: falling to street level.")) return;
    RawAudio.play("routeRoof");
    this.drawDropLine(from, to);
    this.animateParabola({
      from,
      to,
      duration: 680,
      height: 62,
      peakScale: 1.42,
      landingColor: 0xffb02e,
      landingLabel: "DROP",
      onComplete: () => {
        resolveAction(this.scene, "roofDrop", {
          x: to.x,
          y: to.y,
          layer: toLayer
        });
        const reaction = this.scene.sensoryAwarenessSystem?.emit?.("roofDrop", {
          x: to.x,
          y: to.y,
          layer: toLayer
        });
        this.complete(toLayer, to, reaction ? `${status} ${reaction}` : status);
      },
      falling: true
    });
  }

  fireEscape({ from, to, toLayer, status, direction = "up" }) {
    const goingUp = direction === "up";
    if (!this.begin(goingUp ? "Climbing fire escape." : "Descending fire escape.")) return;
    RawAudio.play("routeClimb");
    this.drawLadder(from, to);
    this.animateClimb({
      from,
      to,
      duration: goingUp ? 820 : 700,
      toLayer,
      status,
      goingUp
    });
  }

  policeRoofJumpBlocked(from, to) {
    const isForwardPoliceJump = Phaser.Math.Distance.Between(from.x, from.y, POLICE_JUMP_START.x, POLICE_JUMP_START.y) < 16
      && Phaser.Math.Distance.Between(to.x, to.y, POLICE_JUMP_END.x, POLICE_JUMP_END.y) < 16;
    if (!isForwardPoliceJump) return false;
    const thug = this.rooftopThug();
    return Boolean(thug && !thug.dead && !thug.hiddenBody && thug.stunnedTimer <= 0);
  }

  rooftopThug() {
    return this.scene.npcSystem?.npcs?.find(npc => npc.id === "rooftop_thug" && npc.type === NPC_TYPES.THUG) || null;
  }

  drawArc(from, to, color) {
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2 - 24;
    this.graphics.lineStyle(2, color, 0.65);
    this.graphics.beginPath();
    this.graphics.moveTo(from.x, from.y);
    const steps = 18;
    for (let index = 1; index <= steps; index++) {
      const t = index / steps;
      const inv = 1 - t;
      const x = inv * inv * from.x + 2 * inv * t * midX + t * t * to.x;
      const y = inv * inv * from.y + 2 * inv * t * midY + t * t * to.y;
      this.graphics.lineTo(x, y);
    }
    this.graphics.strokePath();
  }

  drawDropLine(from, to) {
    this.graphics.lineStyle(2, 0xffb02e, 0.72);
    this.graphics.beginPath();
    this.graphics.moveTo(from.x, from.y);
    this.graphics.lineTo(to.x, to.y);
    this.graphics.strokePath();
    this.graphics.fillStyle(0xffb02e, 0.18).fillCircle(to.x, to.y, 20);
  }

  drawLadder(from, to) {
    this.graphics.lineStyle(2, 0x78c7a3, 0.80);
    this.graphics.beginPath();
    this.graphics.moveTo(from.x, from.y);
    this.graphics.lineTo(to.x, to.y);
    this.graphics.strokePath();

    const steps = 7;
    for (let index = 1; index < steps; index++) {
      const t = index / steps;
      const x = Phaser.Math.Linear(from.x, to.x, t);
      const y = Phaser.Math.Linear(from.y, to.y, t);
      this.graphics.lineStyle(1, 0xd7c8ff, 0.42);
      this.graphics.beginPath();
      this.graphics.moveTo(x - 5, y);
      this.graphics.lineTo(x + 5, y);
      this.graphics.strokePath();
    }
  }

  animateParabola({ from, to, duration, height, peakScale, landingColor, landingLabel, onComplete, falling = false }) {
    this.scene.player.setPosition(from.x, from.y);
    const shadow = this.scene.add.ellipse(from.x, from.y + 10, 18, 6, 0x000000, 0.30).setDepth(43);
    const startY = from.y;
    const endY = to.y;

    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: falling ? "Quad.easeIn" : "Sine.easeInOut",
      onUpdate: tween => {
        const p = tween.getValue();
        const x = Phaser.Math.Linear(from.x, to.x, p);
        const groundY = Phaser.Math.Linear(startY, endY, p);
        const lift = Math.sin(p * Math.PI) * height;
        const visualY = groundY - lift * (falling ? 0.18 : 0.42);
        const scale = 1 + (peakScale - 1) * Math.sin(p * Math.PI);
        this.scene.player.setPosition(x, visualY);
        this.scene.player.setScale(scale);
        shadow.setPosition(x, groundY + 10);
        shadow.setScale(1 + p * 0.35, Math.max(0.45, 1 - Math.sin(p * Math.PI) * 0.35));
        shadow.setAlpha(0.18 + p * 0.18);
      },
      onComplete: () => {
        this.scene.player.setPosition(to.x, to.y);
        this.scene.player.setScale(1);
        shadow.destroy();
        RawAudio.play("bodyDrop", { cooldown: 0.02 });
        this.impact(to.x, to.y, landingColor, landingLabel);
        this.scene.time.delayedCall(120, onComplete);
      }
    });
  }

  animateClimb({ from, to, duration, toLayer, status, goingUp }) {
    this.scene.player.setPosition(from.x, from.y);
    const marker = this.scene.add.rectangle(from.x, from.y, 16, 16, 0x78c7a3, 0.15).setDepth(43);

    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: "Sine.easeInOut",
      onUpdate: tween => {
        const p = tween.getValue();
        const bob = Math.sin(p * Math.PI * 8) * 2;
        const x = Phaser.Math.Linear(from.x, to.x, p);
        const y = Phaser.Math.Linear(from.y, to.y, p) + bob;
        this.scene.player.setPosition(x, y);
        this.scene.player.setScale(goingUp ? 1 + p * 0.08 : 1.08 - p * 0.08);
        marker.setPosition(x, y + 8).setAlpha(0.20 + Math.sin(p * Math.PI) * 0.20);
      },
      onComplete: () => {
        this.scene.player.setScale(1);
        marker.destroy();
        this.complete(toLayer, to, status);
      }
    });
  }

  impact(x, y, color, label) {
    const dust = this.scene.add.graphics().setDepth(46);
    dust.lineStyle(2, color, 0.75).strokeCircle(x, y, 14);
    dust.fillStyle(color, 0.10).fillCircle(x, y, 20);
    if (label) this.scene.addMapLabel(label, x + 12, y - 16, color);
    this.scene.tweens.add({
      targets: dust,
      alpha: 0,
      duration: 360,
      ease: "Quad.easeOut",
      onComplete: () => dust.destroy()
    });
  }

  complete(layer, position, status) {
    this.graphics.clear();
    this.active = false;
    this.scene.switchLayer(layer, position, status);
  }
}
