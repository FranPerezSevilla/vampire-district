import { LAYERS } from "../data/district.js";
import { npcDefinitions, NPC_TYPES } from "../data/npcs.js";

const PALETTE = Object.freeze({
  [NPC_TYPES.CIVILIAN]: { body: 0xc8b58a, head: 0xd5b48b, label: "CIV" },
  [NPC_TYPES.TARGET]: { body: 0xff4bd8, head: 0xffd6fa, label: "JOURNO" },
  [NPC_TYPES.POLICE]: { body: 0x4da3ff, head: 0xd9ecff, label: "POLICE" },
  [NPC_TYPES.HUNTER]: { body: 0xff9d35, head: 0xffd483, label: "HUNTER" },
  [NPC_TYPES.RAT]: { body: 0x9c8f7a, head: 0xc0b49e, label: "RAT" }
});

const STREET_NAV_POINTS = Object.freeze([
  { x: 488, y: 326 },
  { x: 472, y: 244 },
  { x: 472, y: 520 },
  { x: 250, y: 326 },
  { x: 360, y: 326 },
  { x: 604, y: 326 },
  { x: 740, y: 326 },
  { x: 740, y: 248 },
  { x: 780, y: 178 },
  { x: 176, y: 244 },
  { x: 176, y: 392 },
  { x: 380, y: 528 },
  { x: 676, y: 502 },
  { x: 842, y: 500 },
  { x: 866, y: 456 }
]);

export class NpcSystem {
  constructor(scene) {
    this.scene = scene;
    this.npcs = npcDefinitions.map(def => this.createNpc(def));
  }

  createNpc(def) {
    const palette = PALETTE[def.type] || PALETTE[NPC_TYPES.CIVILIAN];
    const container = this.scene.add.container(def.x, def.y).setDepth(42);
    this.paintLivingNpc(container, def.type, palette);

    const angle = Math.random() * Math.PI * 2;
    const dirLen = Math.hypot(def.dirX || 0, def.dirY || 0) || 1;
    return {
      ...def,
      x: def.x,
      y: def.y,
      vx: Math.cos(angle) * (def.speed || 0),
      vy: Math.sin(angle) * (def.speed || 0),
      dirX: def.dirX != null ? def.dirX / dirLen : Math.cos(angle),
      dirY: def.dirY != null ? def.dirY / dirLen : Math.sin(angle),
      dead: false,
      deathKind: null,
      fed: false,
      killed: false,
      stunnedTimer: 0,
      hiddenBody: false,
      dragged: false,
      corpseDiscovered: false,
      alarmed: false,
      intercepted: false,
      hasReported: false,
      reportTarget: null,
      reportSeverity: 0,
      witnessReason: "",
      masqueradeRisk: false,
      reactionTimer: 0,
      luredTimer: 0,
      lureFlash: 0,
      lureStopDistance: 24,
      wait: def.behavior === "loiter" || def.behavior === "guard" || def.behavior === "hidden" ? 999 : 0.4 + Math.random() * 1.2,
      aiTimer: 0.6 + Math.random() * 1.8,
      container
    };
  }

  paintLivingNpc(container, type, palette) {
    const shadow = this.scene.add.rectangle(0, 8, type === NPC_TYPES.RAT ? 7 : 10, 2, 0x000000, 0.32);
    const body = this.scene.add.rectangle(0, 2, type === NPC_TYPES.RAT ? 6 : 9, type === NPC_TYPES.RAT ? 5 : 11, palette.body, 1);
    const head = this.scene.add.rectangle(0, type === NPC_TYPES.RAT ? -2 : -6, type === NPC_TYPES.RAT ? 3 : 6, type === NPC_TYPES.RAT ? 3 : 6, palette.head, 1);
    container.add([shadow, body, head]);

    if (type === NPC_TYPES.TARGET || type === NPC_TYPES.POLICE || type === NPC_TYPES.HUNTER || type === NPC_TYPES.RAT) {
      const label = this.scene.add.text(8, -14, palette.label, {
        fontFamily: "monospace",
        fontSize: "8px",
        color: `#${palette.body.toString(16).padStart(6, "0")}`,
        backgroundColor: "rgba(0,0,0,.45)",
        padding: { x: 2, y: 1 }
      });
      container.add(label);
    }
  }

  update(dt) {
    for (const npc of this.npcs) {
      if (npc.lureFlash > 0) npc.lureFlash = Math.max(0, npc.lureFlash - dt);
      if (npc.stunnedTimer > 0) npc.stunnedTimer = Math.max(0, npc.stunnedTimer - dt);
      this.updateNpc(npc, dt);
      npc.container.setPosition(npc.x, npc.y);
      npc.container.setVisible(this.isVisible(npc));
    }
  }

  updateNpc(npc, dt) {
    if (npc.dead || npc.inactive || npc.intercepted || npc.behavior === "guard" || npc.behavior === "hidden") return;

    if (npc.stunnedTimer > 0) {
      npc.vx = 0;
      npc.vy = 0;
      return;
    }

    if (npc.luredTimer > 0 && !npc.alarmed) {
      npc.luredTimer = Math.max(0, npc.luredTimer - dt);
      this.followPlayerUnderWhisper(npc, dt);
      return;
    }

    if (npc.alarmed) return;

    if (npc.behavior === "loiter") {
      npc.aiTimer -= dt;
      if (npc.aiTimer <= 0) {
        npc.aiTimer = 1.4 + Math.random() * 2.8;
        if (Math.random() < 0.35) {
          const dirs = [
            { x: 1, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: -1 }
          ];
          const dir = dirs[Math.floor(Math.random() * dirs.length)];
          npc.dirX = dir.x;
          npc.dirY = dir.y;
        }
      }
      return;
    }

    npc.aiTimer -= dt;
    if (npc.aiTimer <= 0) {
      npc.aiTimer = 0.8 + Math.random() * 2.2;
      if (Math.random() < 0.42) {
        npc.vx = 0;
        npc.vy = 0;
        return;
      }
      const angle = Math.random() * Math.PI * 2;
      const speed = npc.speed || 10;
      npc.vx = Math.cos(angle) * speed;
      npc.vy = Math.sin(angle) * speed;
      this.setFacingFromVelocity(npc);
    }

    const nx = npc.x + npc.vx * dt;
    const ny = npc.y + npc.vy * dt;
    if (this.canNpcStandAt(npc, nx, npc.y)) npc.x = nx;
    else npc.vx *= -0.45;
    if (this.canNpcStandAt(npc, npc.x, ny)) npc.y = ny;
    else npc.vy *= -0.45;
    this.setFacingFromVelocity(npc);
  }

  followPlayerUnderWhisper(npc, dt) {
    const d = Phaser.Math.Distance.Between(npc.x, npc.y, this.scene.player.x, this.scene.player.y);
    const stopDistance = npc.lureStopDistance || (npc.type === NPC_TYPES.TARGET ? 30 : 24);
    const dx = this.scene.player.x - npc.x;
    const dy = this.scene.player.y - npc.y;
    const len = Math.hypot(dx, dy) || 1;
    npc.dirX = dx / len;
    npc.dirY = dy / len;

    if (d <= stopDistance) {
      npc.vx = 0;
      npc.vy = 0;
      return;
    }

    const followSpeed = npc.type === NPC_TYPES.TARGET ? 38 : 32;
    this.moveTowardAtSpeed(npc, this.scene.player.x, this.scene.player.y, dt, followSpeed);
  }

  setFacingFromVelocity(npc) {
    const len = Math.hypot(npc.vx || 0, npc.vy || 0);
    if (len > 0.5) {
      npc.dirX = npc.vx / len;
      npc.dirY = npc.vy / len;
    }
  }

  moveToward(npc, x, y, dt, speedMul = 1) {
    const speed = (npc.speed || 10) * speedMul;
    this.moveTowardAtSpeed(npc, x, y, dt, speed);
  }

  moveTowardAtSpeed(npc, x, y, dt, speed) {
    if (!npc || npc.dead || npc.stunnedTimer > 0) return;
    const target = this.navigationTarget(npc, x, y);
    const dx = target.x - npc.x;
    const dy = target.y - npc.y;
    const len = Math.hypot(dx, dy) || 1;
    npc.dirX = dx / len;
    npc.dirY = dy / len;
    npc.vx = (dx / len) * speed;
    npc.vy = (dy / len) * speed;

    const nx = npc.x + npc.vx * dt;
    const ny = npc.y + npc.vy * dt;
    let moved = false;
    if (this.canNpcStandAt(npc, nx, npc.y)) {
      npc.x = nx;
      moved = true;
    }
    if (this.canNpcStandAt(npc, npc.x, ny)) {
      npc.y = ny;
      moved = true;
    }

    if (!moved) {
      const fallback = this.bestVisibleNavNode(npc, x, y);
      if (fallback && fallback !== target) {
        const fdx = fallback.x - npc.x;
        const fdy = fallback.y - npc.y;
        const flen = Math.hypot(fdx, fdy) || 1;
        npc.dirX = fdx / flen;
        npc.dirY = fdy / flen;
        const fx = npc.x + npc.dirX * speed * dt;
        const fy = npc.y + npc.dirY * speed * dt;
        if (this.canNpcStandAt(npc, fx, npc.y)) npc.x = fx;
        if (this.canNpcStandAt(npc, npc.x, fy)) npc.y = fy;
      } else {
        npc.vx = 0;
        npc.vy = 0;
      }
    }
  }

  navigationTarget(npc, x, y) {
    if (npc.layer !== LAYERS.STREET) return { x, y };
    if (this.lineClear(npc, npc.x, npc.y, x, y)) return { x, y };
    return this.bestVisibleNavNode(npc, x, y) || { x, y };
  }

  bestVisibleNavNode(npc, targetX, targetY) {
    let best = null;
    let bestScore = Infinity;
    for (const node of STREET_NAV_POINTS) {
      if (!this.canNpcStandAt(npc, node.x, node.y)) continue;
      if (!this.lineClear(npc, npc.x, npc.y, node.x, node.y)) continue;
      const nodeSeesTarget = this.lineClear(npc, node.x, node.y, targetX, targetY);
      const score = Phaser.Math.Distance.Between(npc.x, npc.y, node.x, node.y)
        + Phaser.Math.Distance.Between(node.x, node.y, targetX, targetY)
        + (nodeSeesTarget ? 0 : 140);
      if (score < bestScore) {
        best = node;
        bestScore = score;
      }
    }
    return best;
  }

  lineClear(npc, ax, ay, bx, by) {
    const dist = Phaser.Math.Distance.Between(ax, ay, bx, by);
    const steps = Math.max(1, Math.ceil(dist / 12));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = Phaser.Math.Linear(ax, bx, t);
      const y = Phaser.Math.Linear(ay, by, t);
      if (!this.canNpcStandAt(npc, x, y)) return false;
    }
    return true;
  }

  canNpcStandAt(npc, x, y) {
    const originalLayer = this.scene.currentLayer;
    this.scene.currentLayer = npc.layer;
    const canStand = this.scene.canStandAt(x, y);
    this.scene.currentLayer = originalLayer;
    return canStand;
  }

  isVisible(npc) {
    if (npc.hiddenBody) return false;
    if (npc.inactive && npc.type !== NPC_TYPES.RAT && !npc.intercepted) return false;
    return npc.layer === this.scene.currentLayer;
  }

  refreshVisibility() {
    for (const npc of this.npcs) npc.container.setVisible(this.isVisible(npc));
  }

  attackableTypes() {
    return [NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET, NPC_TYPES.POLICE, NPC_TYPES.HUNTER, NPC_TYPES.RAT];
  }

  nearestAttackable(x, y, layer, radius = 26) {
    let best = null;
    let bestD = Infinity;
    for (const npc of this.npcs) {
      if (npc.layer !== layer || npc.inactive || npc.dead || npc.intercepted) continue;
      if (!this.attackableTypes().includes(npc.type)) continue;
      const d = Phaser.Math.Distance.Between(x, y, npc.x, npc.y);
      if (d <= radius && d < bestD) {
        best = npc;
        bestD = d;
      }
    }
    return best;
  }

  nearestFeedable(x, y, layer, radius = 24) {
    return this.nearestAttackable(x, y, layer, radius);
  }

  markStunned(npc, seconds = 5.5) {
    if (!npc || npc.dead) return;
    npc.stunnedTimer = Math.max(npc.stunnedTimer || 0, seconds);
    npc.alarmed = false;
    npc.reactionTimer = 0;
    npc.vx = 0;
    npc.vy = 0;
    npc.luredTimer = 0;
  }

  markFed(npc) {
    this.markDead(npc, "drained");
  }

  markKilled(npc) {
    this.markDead(npc, "killed");
  }

  markDead(npc, deathKind = "killed") {
    if (!npc || npc.dead) return;
    npc.dead = true;
    npc.deathKind = deathKind;
    npc.fed = deathKind === "drained";
    npc.killed = deathKind === "killed";
    npc.hiddenBody = false;
    npc.dragged = false;
    npc.alarmed = false;
    npc.reactionTimer = 0;
    npc.masqueradeRisk = false;
    npc.luredTimer = 0;
    npc.stunnedTimer = 0;
    npc.vx = 0;
    npc.vy = 0;
    npc.container.removeAll(true);

    const corpseColor = deathKind === "drained" ? 0x4b0e1a : 0x332d38;
    const labelText = this.bodyLabel(npc, deathKind);
    const body = this.scene.add.rectangle(0, 2, npc.type === NPC_TYPES.RAT ? 8 : 14, npc.type === NPC_TYPES.RAT ? 4 : 7, corpseColor, 1);
    const head = this.scene.add.rectangle(npc.type === NPC_TYPES.RAT ? 4 : 6, 1, npc.type === NPC_TYPES.RAT ? 3 : 4, npc.type === NPC_TYPES.RAT ? 3 : 4, 0x12060a, 1);
    const label = this.scene.add.text(8, -12, labelText, {
      fontFamily: "monospace",
      fontSize: "8px",
      color: deathKind === "drained" ? "#ff3b50" : "#d7c8ff",
      backgroundColor: "rgba(0,0,0,.45)",
      padding: { x: 2, y: 1 }
    });
    npc.container.add([body, head, label]);
  }

  bodyLabel(npc, deathKind) {
    const prefix = deathKind === "drained" ? "DRAINED" : "KILLED";
    if (npc.type === NPC_TYPES.TARGET) return `${prefix} JOURNO`;
    if (npc.type === NPC_TYPES.POLICE) return `${prefix} COP`;
    if (npc.type === NPC_TYPES.HUNTER) return `${prefix} HUNTER`;
    if (npc.type === NPC_TYPES.RAT) return "RAT";
    return `${prefix} BODY`;
  }

  visibleBodies(layer = this.scene.currentLayer) {
    return this.npcs.filter(n => n.dead && !n.hiddenBody && n.layer === layer);
  }

  drawMarkers(graphics) {
    for (const npc of this.npcs) {
      if (!this.isVisible(npc) || npc.dead) continue;
      if (npc.stunnedTimer > 0) {
        graphics.lineStyle(2, 0xfff2a8, 0.9).strokeCircle(npc.x, npc.y, 16);
        graphics.fillStyle(0xfff2a8, 0.13).fillCircle(npc.x, npc.y, 16);
        this.scene.addMapLabel("STUNNED", npc.x + 12, npc.y - 18, 0xfff2a8);
      }
      if (npc.luredTimer > 0) {
        this.scene.addMapLabel("LURED", npc.x + 12, npc.y - 28, 0xff4bd8);
      }
    }
  }

  summary() {
    const visible = this.npcs.filter(n => this.isVisible(n)).length;
    const bodies = this.npcs.filter(n => n.dead && this.isVisible(n)).length;
    const stunned = this.npcs.filter(n => n.stunnedTimer > 0 && this.isVisible(n)).length;
    const alarmed = this.npcs.filter(n => n.alarmed && this.isVisible(n)).length;
    const lured = this.npcs.filter(n => n.luredTimer > 0 && this.isVisible(n)).length;
    const police = this.npcs.filter(n => n.type === NPC_TYPES.POLICE && !n.dead && this.isVisible(n)).length;
    const rats = this.npcs.filter(n => n.type === NPC_TYPES.RAT && !n.dead && this.isVisible(n)).length;
    const targetVisible = this.npcs.some(n => n.type === NPC_TYPES.TARGET && !n.dead && this.isVisible(n));
    if (alarmed) return `${visible} NPC/body marker(s) · ${alarmed} witness(es) fleeing`;
    if (stunned) return `${visible} NPC/body marker(s) · ${stunned} stunned`;
    if (lured) return `${visible} NPC/body marker(s) · ${lured} lured`;
    if (bodies) return `${visible} NPC/body marker(s) · ${bodies} corpse(s)`;
    if (police) return `${visible} NPC(s) visible · ${police} police patrol(s)`;
    if (rats) return `${visible} NPC(s) visible · ${rats} rat(s)`;
    if (targetVisible) return `${visible} NPC(s) visible · journalist present`;
    return `${visible} NPC(s) visible`;
  }
}
