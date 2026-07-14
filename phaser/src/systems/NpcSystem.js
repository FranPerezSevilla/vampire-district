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
    const shadow = this.scene.add.rectangle(0, 8, def.type === NPC_TYPES.RAT ? 7 : 10, 2, 0x000000, 0.32);
    const body = this.scene.add.rectangle(0, 2, def.type === NPC_TYPES.RAT ? 6 : 9, def.type === NPC_TYPES.RAT ? 5 : 11, palette.body, 1);
    const head = this.scene.add.rectangle(0, def.type === NPC_TYPES.RAT ? -2 : -6, def.type === NPC_TYPES.RAT ? 3 : 6, def.type === NPC_TYPES.RAT ? 3 : 6, palette.head, 1);
    container.add([shadow, body, head]);

    if (def.type === NPC_TYPES.TARGET || def.type === NPC_TYPES.POLICE || def.type === NPC_TYPES.HUNTER || def.type === NPC_TYPES.RAT) {
      const label = this.scene.add.text(8, -14, palette.label, {
        fontFamily: "monospace",
        fontSize: "8px",
        color: `#${palette.body.toString(16).padStart(6, "0")}`,
        backgroundColor: "rgba(0,0,0,.45)",
        padding: { x: 2, y: 1 }
      });
      container.add(label);
    }

    const angle = Math.random() * Math.PI * 2;
    return {
      ...def,
      x: def.x,
      y: def.y,
      vx: Math.cos(angle) * (def.speed || 0),
      vy: Math.sin(angle) * (def.speed || 0),
      wait: def.behavior === "loiter" || def.behavior === "guard" || def.behavior === "hidden" ? 999 : 0.4 + Math.random() * 1.2,
      aiTimer: 0.6 + Math.random() * 1.8,
      container
    };
  }

  update(dt) {
    for (const npc of this.npcs) {
      this.updateNpc(npc, dt);
      npc.container.setPosition(npc.x, npc.y);
      npc.container.setVisible(this.isVisible(npc));
    }
  }

  updateNpc(npc, dt) {
    if (npc.inactive || npc.behavior === "guard" || npc.behavior === "hidden") return;
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
    if (npc.inactive && npc.type !== NPC_TYPES.RAT) return false;
    return npc.layer === this.scene.currentLayer;
  }

  refreshVisibility() {
    for (const npc of this.npcs) npc.container.setVisible(this.isVisible(npc));
  }

  drawDebugMarkers(graphics) {
    for (const npc of this.npcs) {
      if (!this.isVisible(npc)) continue;
      const color = (PALETTE[npc.type] || PALETTE[NPC_TYPES.CIVILIAN]).body;
      graphics.lineStyle(1, color, 0.30).strokeCircle(npc.x, npc.y, npc.type === NPC_TYPES.RAT ? 12 : 17);
    }
  }

  nearestFeedable(x, y, layer, radius = 24) {
    let best = null;
    let bestD = Infinity;
    for (const npc of this.npcs) {
      if (npc.layer !== layer || npc.inactive) continue;
      if (![NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET, NPC_TYPES.RAT].includes(npc.type)) continue;
      const d = Phaser.Math.Distance.Between(x, y, npc.x, npc.y);
      if (d < radius && d < bestD) {
        best = npc;
        bestD = d;
      }
    }
    return best;
  }
}
