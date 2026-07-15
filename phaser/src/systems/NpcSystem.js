import { npcDefinitions, NPC_TYPES } from "../data/npcs.js";
import { LAYERS } from "../data/district.js";

const PALETTE = Object.freeze({
  [NPC_TYPES.CIVILIAN]: { body: 0xc8b58a, head: 0xd5b48b, label: "CIV" },
  [NPC_TYPES.TARGET]: { body: 0xff4bd8, head: 0xffd6fa, label: "JOURNO" },
  [NPC_TYPES.POLICE]: { body: 0x4da3ff, head: 0xd9ecff, label: "POLICE" },
  [NPC_TYPES.HUNTER]: { body: 0xff9d35, head: 0xffd483, label: "HUNTER" },
  [NPC_TYPES.RAT]: { body: 0x9c8f7a, head: 0xc0b49e, label: "RAT" }
});

const NAV_POINTS = Object.freeze([
  { id: "police_gate", x: 780, y: 178 },
  { id: "police_avenue", x: 740, y: 248 },
  { id: "north_cross", x: 472, y: 244 },
  { id: "cross", x: 488, y: 326 },
  { id: "east_avenue", x: 604, y: 326 },
  { id: "club_front", x: 720, y: 326 },
  { id: "club_side", x: 588, y: 360 },
  { id: "club_rear", x: 676, y: 502 },
  { id: "church_front", x: 842, y: 404 },
  { id: "church_rear", x: 842, y: 500 },
  { id: "west_avenue", x: 360, y: 326 },
  { id: "warehouse_alley", x: 176, y: 404 },
  { id: "west_manhole", x: 176, y: 350 },
  { id: "south_service", x: 380, y: 528 },
  { id: "old_block", x: 596, y: 540 },
  { id: "refuge_escape", x: 176, y: 244 }
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
      fed: false,
      hiddenBody: false,
      dragged: false,
      corpseDiscovered: false,
      alarmed: false,
      intercepted: false,
      hasReported: false,
      reportTarget: null,
      reportSeverity: 0,
      witnessReason: "",
      luredTimer: 0,
      lureFlash: 0,
      lureStopDistance: 18,
      navPoint: null,
      navTargetKey: "",
      navRepathTimer: 0,
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
      npc.navRepathTimer = Math.max(0, (npc.navRepathTimer || 0) - dt);
      this.updateNpc(npc, dt);
      npc.container.setPosition(npc.x, npc.y);
      npc.container.setVisible(this.isVisible(npc));
    }
  }

  updateNpc(npc, dt) {
    if (npc.dead || npc.inactive || npc.intercepted || npc.behavior === "guard" || npc.behavior === "hidden") return;

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
    if (this.canNpcStandAt(npc, nx, ny)) {
      npc.x = nx;
      npc.y = ny;
    } else {
      npc.vx *= -0.35;
      npc.vy *= -0.35;
    }
    this.setFacingFromVelocity(npc);
  }

  followPlayerUnderWhisper(npc, dt) {
    const d = Phaser.Math.Distance.Between(npc.x, npc.y, this.scene.player.x, this.scene.player.y);
    const stopDistance = npc.lureStopDistance || 18;
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
    this.moveTowardAtSpeed(npc, this.scene.player.x, this.scene.player.y, dt, followSpeed, { smart: true });
  }

  setFacingFromVelocity(npc) {
    const len = Math.hypot(npc.vx || 0, npc.vy || 0);
    if (len > 0.5) {
      npc.dirX = npc.vx / len;
      npc.dirY = npc.vy / len;
    }
  }

  moveToward(npc, x, y, dt, speedMul = 1, options = {}) {
    const speed = (npc.speed || 10) * speedMul;
    this.moveTowardAtSpeed(npc, x, y, dt, speed, options);
  }

  moveTowardAtSpeed(npc, x, y, dt, speed, options = {}) {
    if (options.smart && npc.layer === LAYERS.STREET) {
      this.smartMoveTowardAtSpeed(npc, x, y, dt, speed);
      return;
    }
    this.directMoveTowardAtSpeed(npc, x, y, dt, speed);
  }

  directMoveTowardAtSpeed(npc, x, y, dt, speed) {
    const dx = x - npc.x;
    const dy = y - npc.y;
    const len = Math.hypot(dx, dy) || 1;
    npc.dirX = dx / len;
    npc.dirY = dy / len;
    npc.vx = (dx / len) * speed;
    npc.vy = (dy / len) * speed;

    const nx = npc.x + npc.vx * dt;
    const ny = npc.y + npc.vy * dt;
    if (this.canNpcStandAt(npc, nx, ny)) {
      npc.x = nx;
      npc.y = ny;
    } else {
      npc.vx = 0;
      npc.vy = 0;
    }
  }

  smartMoveTowardAtSpeed(npc, x, y, dt, speed) {
    const targetKey = `${Math.round(x / 16)}:${Math.round(y / 16)}`;
    const closeToTarget = Phaser.Math.Distance.Between(npc.x, npc.y, x, y) < 18;
    if (closeToTarget) {
      npc.navPoint = null;
      this.directMoveTowardAtSpeed(npc, x, y, dt, speed);
      return;
    }

    if (this.hasClearPath(npc, npc.x, npc.y, x, y)) {
      npc.navPoint = null;
      this.directMoveTowardAtSpeed(npc, x, y, dt, speed);
      return;
    }

    const needsRoute = !npc.navPoint || npc.navTargetKey !== targetKey || npc.navRepathTimer <= 0 || Phaser.Math.Distance.Between(npc.x, npc.y, npc.navPoint.x, npc.navPoint.y) < 14;
    if (needsRoute) {
      npc.navPoint = this.chooseNavPoint(npc, x, y);
      npc.navTargetKey = targetKey;
      npc.navRepathTimer = 0.55;
    }

    if (npc.navPoint) {
      this.directMoveTowardAtSpeed(npc, npc.navPoint.x, npc.navPoint.y, dt, speed);
      if (Phaser.Math.Distance.Between(npc.x, npc.y, npc.navPoint.x, npc.navPoint.y) < 14) {
        npc.navPoint = null;
        npc.navRepathTimer = 0;
      }
    } else {
      npc.vx = 0;
      npc.vy = 0;
    }
  }

  chooseNavPoint(npc, tx, ty) {
    let best = null;
    let bestScore = Infinity;
    for (const point of NAV_POINTS) {
      if (!this.canNpcStandAt(npc, point.x, point.y)) continue;
      const fromClear = this.hasClearPath(npc, npc.x, npc.y, point.x, point.y);
      const toClear = this.hasClearPath(npc, point.x, point.y, tx, ty);
      if (!fromClear && !toClear) continue;
      const score =
        Phaser.Math.Distance.Between(npc.x, npc.y, point.x, point.y) +
        Phaser.Math.Distance.Between(point.x, point.y, tx, ty) +
        (fromClear ? 0 : 120) +
        (toClear ? 0 : 60) +
        Math.random() * 12;
      if (score < bestScore) {
        best = point;
        bestScore = score;
      }
    }
    return best;
  }

  hasClearPath(npc, ax, ay, bx, by) {
    const dist = Phaser.Math.Distance.Between(ax, ay, bx, by);
    const steps = Math.max(1, Math.ceil(dist / 14));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
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

  nearestFeedable(x, y, layer, radius = 24) {
    let best = null;
    let bestD = Infinity;
    for (const npc of this.npcs) {
      if (npc.layer !== layer || npc.inactive || npc.dead || npc.intercepted) continue;
      if (![NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET, NPC_TYPES.RAT].includes(npc.type)) continue;
      const d = Phaser.Math.Distance.Between(x, y, npc.x, npc.y);
      if (d < radius && d < bestD) {
        best = npc;
        bestD = d;
      }
    }
    return best;
  }

  markFed(npc) {
    if (!npc || npc.dead) return;
    npc.dead = true;
    npc.fed = true;
    npc.hiddenBody = false;
    npc.dragged = false;
    npc.alarmed = false;
    npc.luredTimer = 0;
    npc.vx = 0;
    npc.vy = 0;
    npc.container.removeAll(true);

    const corpseColor = npc.type === NPC_TYPES.RAT ? 0x4d4239 : 0x4b0e1a;
    const labelText = npc.type === NPC_TYPES.RAT ? "RAT" : npc.type === NPC_TYPES.TARGET ? "JOURNO BODY" : "BODY";
    const body = this.scene.add.rectangle(0, 2, npc.type === NPC_TYPES.RAT ? 8 : 14, npc.type === NPC_TYPES.RAT ? 4 : 7, corpseColor, 1);
    const head = this.scene.add.rectangle(npc.type === NPC_TYPES.RAT ? 4 : 6, 1, npc.type === NPC_TYPES.RAT ? 3 : 4, npc.type === NPC_TYPES.RAT ? 3 : 4, 0x12060a, 1);
    const label = this.scene.add.text(8, -12, labelText, {
      fontFamily: "monospace",
      fontSize: "8px",
      color: npc.type === NPC_TYPES.TARGET ? "#ff4bd8" : "#ff3b50",
      backgroundColor: "rgba(0,0,0,.45)",
      padding: { x: 2, y: 1 }
    });
    npc.container.add([body, head, label]);
  }

  visibleBodies(layer = this.scene.currentLayer) {
    return this.npcs.filter(n => n.dead && !n.hiddenBody && n.layer === layer);
  }

  summary() {
    const visible = this.npcs.filter(n => this.isVisible(n)).length;
    const bodies = this.npcs.filter(n => n.dead && this.isVisible(n)).length;
    const alarmed = this.npcs.filter(n => n.alarmed && this.isVisible(n)).length;
    const lured = this.npcs.filter(n => n.luredTimer > 0 && this.isVisible(n)).length;
    const police = this.npcs.filter(n => n.type === NPC_TYPES.POLICE && !n.dead && this.isVisible(n)).length;
    const rats = this.npcs.filter(n => n.type === NPC_TYPES.RAT && !n.dead && this.isVisible(n)).length;
    const targetVisible = this.npcs.some(n => n.type === NPC_TYPES.TARGET && !n.dead && this.isVisible(n));
    if (alarmed) return `${visible} NPC/body marker(s) · ${alarmed} witness(es) fleeing`;
    if (lured) return `${visible} NPC/body marker(s) · ${lured} lured`;
    if (bodies) return `${visible} NPC/body marker(s) · ${bodies} corpse(s)`;
    if (police) return `${visible} NPC(s) visible · ${police} police patrol(s)`;
    if (rats) return `${visible} NPC(s) visible · ${rats} rat(s)`;
    if (targetVisible) return `${visible} NPC(s) visible · journalist present`;
    return `${visible} NPC(s) visible`;
  }
}
