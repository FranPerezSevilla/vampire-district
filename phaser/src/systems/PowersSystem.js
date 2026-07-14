import { HUNGER } from "../data/balance.js";
import { LAYERS, lights } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";

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

  update(dt, keys) {
    this.cooldowns.dash = Math.max(0, this.cooldowns.dash - dt);
    this.cooldowns.whisper = Math.max(0, this.cooldowns.whisper - dt);
    this.cooldowns.sense = Math.max(0, this.cooldowns.sense - dt);
    this.senseTimer = Math.max(0, this.senseTimer - dt);

    this.rememberMoveDirection(keys);

    if (!this.scene.interactionSystem?.isOpen && !this.scene.feedingSystem?.isActive()) {
      if (Phaser.Input.Keyboard.JustDown(keys.sense)) this.useBloodSense();
      if (Phaser.Input.Keyboard.JustDown(keys.whisper)) this.useWhisper();
      if (Phaser.Input.Keyboard.JustDown(keys.dash) || Phaser.Input.Keyboard.JustDown(keys.space)) this.useDash();
    }

    this.drawSenseOverlay();
  }

  rememberMoveDirection(keys) {
    let x = 0;
    let y = 0;
    if (keys.left.isDown || keys.a.isDown) x -= 1;
    if (keys.right.isDown || keys.d.isDown) x += 1;
    if (keys.up.isDown || keys.w.isDown) y -= 1;
    if (keys.down.isDown || keys.s.isDown) y += 1;
    if (x || y) {
      const len = Math.hypot(x, y) || 1;
      this.lastDir = { x: x / len, y: y / len };
    }
  }

  addHunger(amount, label) {
    const feeding = this.scene.feedingSystem;
    if (!feeding) return;
    feeding.hunger = Math.min(100, feeding.hunger + amount);
    this.scene.lastActionText = `${label}. Hunger +${amount}.`;
  }

  useBloodSense() {
    if (this.cooldowns.sense > 0) return;
    this.cooldowns.sense = HUNGER.senseCooldown;
    this.senseTimer = HUNGER.senseSeconds;
    this.addHunger(HUNGER.senseCost, "Blood Sense opens the district's veins");
  }

  useWhisper() {
    if (this.cooldowns.whisper > 0) return;
    const npc = this.nearestLurable();
    if (!npc) {
      this.scene.lastActionText = "Whisper failed: no living mind close enough.";
      this.cooldowns.whisper = 0.4;
      return;
    }

    this.cooldowns.whisper = HUNGER.whisperCooldown;
    npc.luredTimer = HUNGER.whisperSeconds;
    npc.alarmed = false;
    npc.vx = 0;
    npc.vy = 0;
    this.addHunger(HUNGER.whisperCost, npc.type === NPC_TYPES.TARGET ? "You whisper into the journalist's blood" : "You whisper into a civilian's nerves");
  }

  useDash() {
    if (this.cooldowns.dash > 0) return;
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
      this.scene.lastActionText = "Shadow Dash fails: no space to slip through.";
      return;
    }

    this.scene.player.setPosition(nextX, nextY);
    this.addHunger(HUNGER.dashCost, "Shadow Dash tears you across the dark");
    if (this.scene.currentLayer === LAYERS.STREET && this.scene.currentLight()) {
      this.scene.exposureSystem.add(4, "A dash under a streetlight looks impossible.");
    }
  }

  nearestLurable(radius = 104) {
    let best = null;
    let bestD = Infinity;
    for (const npc of this.scene.npcSystem.npcs) {
      if (npc.dead || npc.hiddenBody || npc.inactive || npc.intercepted) continue;
      if (![NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET].includes(npc.type)) continue;
      if (npc.layer !== this.scene.currentLayer) continue;
      const d = Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, npc.x, npc.y);
      if (d <= radius && d < bestD) {
        best = npc;
        bestD = d;
      }
    }
    return best;
  }

  drawSenseOverlay() {
    this.graphics.clear();
    if (this.senseTimer <= 0) return;

    const alpha = 0.36 + Math.sin(this.scene.time.now / 110) * 0.08;
    this.graphics.lineStyle(1, 0xa75cff, alpha).strokeCircle(this.scene.player.x, this.scene.player.y, 96);

    for (const npc of this.scene.npcSystem.npcs) {
      if (npc.layer !== this.scene.currentLayer || npc.hiddenBody) continue;
      if (npc.dead) {
        this.mark(npc.x, npc.y, 0xff3b50, 12, "body");
      } else if (npc.type === NPC_TYPES.TARGET) {
        this.mark(npc.x, npc.y, 0xff4bd8, 15, "target");
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

  mark(x, y, color, radius, label) {
    this.graphics.lineStyle(2, color, 0.86).strokeCircle(x, y, radius);
    this.graphics.fillStyle(color, 0.12).fillCircle(x, y, radius);
    this.graphics.fillStyle(color, 0.80).fillRect(x - 1, y - radius - 6, 2, 5);
  }

  summary() {
    const sense = this.senseTimer > 0 ? ` · Sense ${this.senseTimer.toFixed(1)}s` : "";
    return `Dash ${this.cooldowns.dash <= 0 ? "ready" : this.cooldowns.dash.toFixed(1)} · Whisper ${this.cooldowns.whisper <= 0 ? "ready" : this.cooldowns.whisper.toFixed(1)} · Sense ${this.cooldowns.sense <= 0 ? "ready" : this.cooldowns.sense.toFixed(1)}${sense}`;
  }
}
