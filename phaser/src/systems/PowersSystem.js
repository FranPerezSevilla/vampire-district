import { HUNGER } from "../data/balance.js";
import { LAYERS, lights } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";
import { resolveAction } from "./ActionSystem.js";
import { RawAudio } from "./RawAudioSystem.js";

export class PowersSystem {
  constructor(scene) {
    this.scene = scene;
    this.cooldowns = {
      dash: 0,
      whisper: 0,
      sense: 0
    };
    this.senseTimer = 0;
    this.lastDir = { x: 0, y: 1 };
    this.graphics = scene.add.graphics().setDepth(48);
  }

  update(dt, input = this.scene.currentInputFrame) {
    this.scene.feedingSystem?.addPassiveHunger(dt);
    this.cooldowns.dash = Math.max(0, this.cooldowns.dash - dt);
    this.cooldowns.whisper = Math.max(0, this.cooldowns.whisper - dt);
    this.cooldowns.sense = Math.max(0, this.cooldowns.sense - dt);
    this.senseTimer = Math.max(0, this.senseTimer - dt);

    const frame = this.normalizeInput(input);
    if (frame.hasMovementIntent) this.lastDir = { ...frame.move };

    if (!this.scene.interactionSystem?.isOpen && !this.scene.feedingSystem?.isActive()) {
      if (frame.bloodSensePressed) this.useBloodSense();
      if (frame.whisperPressed) this.useWhisper();
      if (frame.dashPressed) this.useDash();
    }

    this.drawSenseOverlay();
    this.drawLureLines();
  }

  normalizeInput(input) {
    if (input && Object.hasOwn(input, "dashPressed")) {
      return {
        move: input.move || { x: 0, y: 0 },
        hasMovementIntent: Boolean(input.hasMovementIntent),
        dashPressed: Boolean(input.dashPressed),
        whisperPressed: Boolean(input.whisperPressed),
        bloodSensePressed: Boolean(input.bloodSensePressed)
      };
    }

    const keys = input || {};
    let x = 0;
    let y = 0;
    if (keys.left?.isDown || keys.a?.isDown) x -= 1;
    if (keys.right?.isDown || keys.d?.isDown) x += 1;
    if (keys.up?.isDown || keys.w?.isDown) y -= 1;
    if (keys.down?.isDown || keys.s?.isDown) y += 1;
    const length = Math.hypot(x, y) || 1;
    return {
      move: { x: x / length, y: y / length },
      hasMovementIntent: Boolean(x || y),
      dashPressed: this.justDown(keys.dash),
      whisperPressed: this.justDown(keys.whisper),
      bloodSensePressed: this.justDown(keys.sense)
    };
  }

  justDown(key) {
    return Boolean(key && Phaser.Input.Keyboard.JustDown(key));
  }

  addHunger(amount, label) {
    const feeding = this.scene.feedingSystem;
    if (!feeding) return;
    feeding.hunger = Math.min(100, feeding.hunger + amount);
    this.scene.lastActionText = `${label}. Hunger +${amount}.`;
  }

  useBloodSense() {
    if (this.cooldowns.sense > 0) {
      RawAudio.play("cancel");
      return;
    }
    this.cooldowns.sense = HUNGER.senseCooldown;
    this.senseTimer = HUNGER.senseSeconds;
    RawAudio.play("sense");
    this.addHunger(HUNGER.senseCost, "Blood Sense opens the district's veins");
    resolveAction(this.scene, "bloodSense", {
      x: this.scene.player.x,
      y: this.scene.player.y,
      layer: this.scene.currentLayer
    });
  }

  useWhisper() {
    if (this.cooldowns.whisper > 0) {
      RawAudio.play("cancel");
      return;
    }
    const npc = this.nearestLurable();
    if (!npc) {
      RawAudio.play("whisperFail");
      this.scene.lastActionText = "Whisper failed: no living mind close enough. Move nearer or use Blood Sense.";
      this.cooldowns.whisper = 0.35;
      return;
    }

    this.cooldowns.whisper = HUNGER.whisperCooldown;
    npc.luredTimer = HUNGER.whisperSeconds + (npc.type === NPC_TYPES.TARGET ? 1.2 : 0);
    npc.lureFlash = 1.1;
    npc.lureStopDistance = npc.type === NPC_TYPES.TARGET ? 30 : 24;
    npc.alarmed = false;
    npc.reactionTimer = 0;
    npc.vx = 0;
    npc.vy = 0;
    RawAudio.play("whisper");
    this.addHunger(HUNGER.whisperCost, npc.type === NPC_TYPES.TARGET ? "You whisper into the journalist's blood" : "You whisper into a civilian's nerves");
    resolveAction(this.scene, "whisper", {
      x: npc.x,
      y: npc.y,
      layer: npc.layer,
      target: npc,
      exclude: [npc]
    });

    this.scene.lastActionText = npc.type === NPC_TYPES.TARGET
      ? `WHISPER LOCK: the journalist follows you. Hunger +${HUNGER.whisperCost}.`
      : `WHISPER LOCK: a civilian follows you. Hunger +${HUNGER.whisperCost}.`;
  }

  useDash() {
    if (this.cooldowns.dash > 0) {
      RawAudio.play("dashFail");
      return;
    }
    this.cooldowns.dash = HUNGER.dashCooldown;
    const maxDistance = HUNGER.dashDistance;
    const step = 6;
    let moved = 0;
    let nextX = this.scene.player.x;
    let nextY = this.scene.player.y;

    for (let d = step; d <= maxDistance; d += step) {
      const x = this.scene.player.x + this.lastDir.x * d;
      const y = this.scene.player.y + this.lastDir.y * d;
      if (!this.scene.canStandAt(x, y)) break;
      nextX = x;
      nextY = y;
      moved = d;
    }

    if (moved <= 0) {
      RawAudio.play("dashFail");
      this.scene.lastActionText = "Shadow Dash fails: no space to slip through.";
      return;
    }

    this.scene.player.setPosition(nextX, nextY);
    RawAudio.play("dash");
    this.addHunger(HUNGER.dashCost, "Shadow Dash tears you across the dark");
    if (this.scene.currentLayer === LAYERS.STREET && this.scene.currentLight()) {
      this.scene.lastActionText = "Shadow Dash: smoke and impossible movement, but no masquerade breach unless you drain in public.";
    }
    resolveAction(this.scene, "shadowDash", {
      x: nextX,
      y: nextY,
      layer: this.scene.currentLayer
    });
  }

  nearestLurable(radius = 164) {
    let best = null;
    let bestScore = Infinity;
    const candidates = this.scene.npcSystem?.queryRadius?.(
      this.scene.player.x,
      this.scene.player.y,
      radius + 42,
      this.scene.currentLayer
    ) || this.scene.npcSystem?.npcs || [];

    for (const npc of candidates) {
      if (npc.dead || npc.hiddenBody || npc.inactive || npc.intercepted || npc.stunnedTimer > 0) continue;
      if (![NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET].includes(npc.type)) continue;
      if (npc.layer !== this.scene.currentLayer) continue;
      if (!this.scene.npcSystem.canNpcStandAt(npc, npc.x, npc.y)) continue;
      const d = Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, npc.x, npc.y);
      const effectiveRadius = npc.type === NPC_TYPES.TARGET ? radius + 42 : radius;
      if (d > effectiveRadius) continue;
      const score = d - (npc.type === NPC_TYPES.TARGET ? 58 : 0);
      if (score < bestScore) {
        best = npc;
        bestScore = score;
      }
    }
    return best;
  }

  drawSenseOverlay() {
    this.graphics.clear();
    if (this.senseTimer <= 0) return;

    const alpha = 0.36 + Math.sin(this.scene.time.now / 110) * 0.08;
    this.graphics.lineStyle(1, 0xa75cff, alpha).strokeCircle(this.scene.player.x, this.scene.player.y, 96);

    for (const npc of this.scene.npcSystem?.visibleInCamera?.(80) || this.scene.npcSystem.npcs) {
      if (npc.layer !== this.scene.currentLayer || npc.hiddenBody) continue;
      if (npc.dead) {
        this.mark(npc.x, npc.y, 0xff3b50, 12, npc.deathKind === "killed" ? "killed" : "drained");
      } else if (npc.type === NPC_TYPES.TARGET) {
        this.mark(npc.x, npc.y, 0xff4bd8, 15, "JOURNO");
      } else if (npc.type === NPC_TYPES.RAT) {
        this.mark(npc.x, npc.y, 0x9c8f7a, 10, "rat");
      } else if (npc.type === NPC_TYPES.HUNTER && !npc.inactive) {
        this.mark(npc.x, npc.y, 0xff9d35, 16, "hunter");
      } else if (npc.type === NPC_TYPES.POLICE && !npc.inactive) {
        this.mark(npc.x, npc.y, 0x4da3ff, 14, "police");
      }
    }

    for (const stain of this.scene.evidenceSystem?.bloodStains || []) {
      if (stain.cleaned || stain.layer !== this.scene.currentLayer) continue;
      this.mark(stain.x, stain.y, 0xb31934, 8, "blood");
    }

    for (const block of this.scene.hunterSystem?.routeBlocks || []) {
      if (block.layer !== this.scene.currentLayer) continue;
      this.mark(block.x, block.y, 0xff9d35, 20, "block");
    }

    if (this.scene.currentLayer === LAYERS.STREET) {
      for (const light of lights) {
        if (this.scene.brokenLights.has(light.id)) continue;
        this.graphics.lineStyle(1, 0xffe16b, 0.18).strokeCircle(light.x, light.y, light.radius);
      }
    }
  }

  drawLureLines() {
    for (const npc of this.scene.npcSystem?.visibleInCamera?.(40) || this.scene.npcSystem.npcs) {
      if (npc.layer !== this.scene.currentLayer || npc.dead || npc.hiddenBody || npc.luredTimer <= 0) continue;
      const pulse = 0.28 + Math.sin(this.scene.time.now / 70) * 0.10;
      this.graphics.lineStyle(2, 0xff4bd8, 0.42 + pulse);
      this.graphics.beginPath();
      this.graphics.moveTo(npc.x, npc.y);
      this.graphics.lineTo(this.scene.player.x, this.scene.player.y);
      this.graphics.strokePath();
      this.graphics.fillStyle(0xff4bd8, 0.18 + pulse * 0.35).fillCircle(npc.x, npc.y, 18 + pulse * 8);
      this.graphics.lineStyle(2, 0xffd6fa, 0.70).strokeCircle(npc.x, npc.y, 12);
    }
  }

  mark(x, y, color, radius, label) {
    this.graphics.lineStyle(2, color, 0.86).strokeCircle(x, y, radius);
    this.graphics.fillStyle(color, 0.12).fillCircle(x, y, radius);
    this.graphics.fillStyle(color, 0.80).fillRect(x - 1, y - radius - 6, 2, 5);
    if (label) this.scene.addMapLabel(label, x + radius * 0.65, y - radius, color);
  }

  summary() {
    const sense = this.senseTimer > 0 ? ` · Sense ${this.senseTimer.toFixed(1)}s` : "";
    return `Dash ${this.cooldowns.dash <= 0 ? "ready" : this.cooldowns.dash.toFixed(1)} · Whisper ${this.cooldowns.whisper <= 0 ? "ready" : this.cooldowns.whisper.toFixed(1)} · Sense ${this.cooldowns.sense <= 0 ? "ready" : this.cooldowns.sense.toFixed(1)}${sense}`;
  }
}
