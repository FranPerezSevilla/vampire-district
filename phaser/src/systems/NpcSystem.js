import { npcDefinitions, NPC_TYPES } from "../data/npcs.js";

const PALETTE = Object.freeze({
  [NPC_TYPES.CIVILIAN]: { body: 0xc8b58a, head: 0xd5b48b, label: "CIV" },
  [NPC_TYPES.TARGET]: { body: 0xff4bd8, head: 0xffd6fa, label: "TARGET" },
  [NPC_TYPES.POLICE]: { body: 0x4da3ff, head: 0xd9ecff, label: "POLICE" },
  [NPC_TYPES.HUNTER]: { body: 0xff9d35, head: 0xffd483, label: "HUNTER" },
  [NPC_TYPES.RAT]: { body: 0x9c8f7a, head: 0xc0b49e, label: "RAT" }
});

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
    return {
      ...def,
      x: def.x,
      y: def.y,
      vx: Math.cos(angle) * (def.speed || 0),
      vy: Math.sin(angle) * (def.speed || 0),
      dead: false,
      fed: false,
      alarmed: false,
      intercepted: false,
      hasReported: false,
      reportTarget: null,
      reportSeverity: 0,
      witnessReason: "",
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
      this.updateNpc(npc, dt);
      npc.container.setPosition(npc.x, npc.y);
      npc.container.setVisible(this.isVisible(npc));
    }
  }

  updateNpc(npc, dt) {
    if (npc.dead || npc.inactive || npc.alarmed || npc.intercepted || npc.behavior === "guard" || npc.behavior === "hidden") return;
    if (npc.behavior === "loiter") return;

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
    }

    const nx = npc.x + npc.vx * dt;
    const ny = npc.y + npc.vy * dt;
    if (this.canNpcStandAt(npc, nx, npc.y)) npc.x = nx;
    else npc.vx *= -0.45;
    if (this.canNpcStandAt(npc, npc.x, ny)) npc.y = ny;
    else npc.vy *= -0.45;
  }

  canNpcStandAt(npc, x, y) {
    const originalLayer = this.scene.currentLayer;
    this.scene.currentLayer = npc.layer;
    const canStand = this.scene.canStandAt(x, y);
    this.scene.currentLayer = originalLayer;
    return canStand;
  }

  isVisible(npc) {
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
    npc.alarmed = false;
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
    const rats = this.npcs.filter(n => n.type === NPC_TYPES.RAT && !n.dead && this.isVisible(n)).length;
    const targetVisible = this.npcs.some(n => n.type === NPC_TYPES.TARGET && !n.dead && this.isVisible(n));
    if (alarmed) return `${visible} NPC/body marker(s) · ${alarmed} witness(es) fleeing`;
    if (bodies) return `${visible} NPC/body marker(s) · ${bodies} corpse(s)`;
    if (rats) return `${visible} NPC(s) visible · ${rats} rat(s)`;
    if (targetVisible) return `${visible} NPC(s) visible · journalist present`;
    return `${visible} NPC(s) visible`;
  }
}
