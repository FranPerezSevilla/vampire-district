import { LAYERS } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";

const CHURCH_ANCHOR = Object.freeze({ x: 742, y: 474 });

const ROUTE_BLOCK_POINTS = Object.freeze([
  { id: "church_gate", name: "church gate", x: 742, y: 474, layer: LAYERS.STREET },
  { id: "club_alley", name: "club rear alley", x: 676, y: 502, layer: LAYERS.STREET },
  { id: "cross_manhole", name: "crossroad manhole", x: 472, y: 326, layer: LAYERS.STREET },
  { id: "refuge_escape", name: "refuge fire escape", x: 176, y: 244, layer: LAYERS.STREET }
]);

export class HunterSystem {
  constructor(scene) {
    this.scene = scene;
    this.spawned = 0;
    this.revealed = false;
    this.routeBlocks = [];
    this.nextBlockAt = 0;
  }

  update(dt) {
    this.maybeReveal();
    this.updateRouteBlocks(dt);
    this.updateHunters(dt);
  }

  maybeReveal() {
    if (this.revealed) return;
    const level = this.scene.exposureSystem.level();
    const bloodTrigger = this.scene.evidenceSystem?.bloodStains?.some(stain => stain.layer === LAYERS.STREET && !stain.cleaned) || false;
    const bodyTrigger = this.scene.evidenceSystem?.bodies?.some(body => !body.hidden && body.layer === LAYERS.STREET) || false;
    if (level < 4 && !bloodTrigger && !bodyTrigger) return;

    this.revealed = true;
    this.spawnHunter();
    this.scene.lastActionText = bloodTrigger
      ? "A hunter steps out from the church quarter, following the smell of blood."
      : "Exposure is too high. A hunter notices the pattern behind the crimes.";
  }

  spawnHunter() {
    this.spawned++;
    const hunter = this.scene.npcSystem.createNpc({
      id: `hunter_${this.spawned}`,
      type: NPC_TYPES.HUNTER,
      x: CHURCH_ANCHOR.x + (Math.random() - 0.5) * 44,
      y: CHURCH_ANCHOR.y + (Math.random() - 0.5) * 34,
      layer: LAYERS.STREET,
      behavior: "hunter",
      speed: 42
    });
    hunter.active = true;
    hunter.hunterIntent = "hunt";
    this.scene.npcSystem.npcs.push(hunter);
  }

  updateRouteBlocks(dt) {
    this.nextBlockAt = Math.max(0, this.nextBlockAt - dt);
    for (const block of this.routeBlocks) block.life -= dt;
    this.routeBlocks = this.routeBlocks.filter(block => block.life > 0);

    if (!this.revealed || this.nextBlockAt > 0) return;
    if (this.scene.exposureSystem.level() < 4) return;
    this.nextBlockAt = 7.5;

    const candidates = ROUTE_BLOCK_POINTS
      .filter(point => !this.routeBlocks.some(block => block.id === point.id))
      .map(point => ({ point, score: Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, point.x, point.y) + Math.random() * 80 }))
      .sort((a, b) => a.score - b.score);

    if (!candidates.length) return;
    const point = candidates[0].point;
    this.routeBlocks.push({ ...point, life: 8.5 });
    this.scene.lastActionText = `A hunter tries to cut off ${point.name}.`;
  }

  updateHunters(dt) {
    for (const hunter of this.hunters()) {
      let target = null;
      const blood = this.nearestBlood(hunter);
      if (blood) target = { x: blood.x, y: blood.y, kind: "blood" };
      if (!target && this.scene.currentLayer === LAYERS.STREET && !this.scene.currentShadow()) {
        const d = Phaser.Math.Distance.Between(hunter.x, hunter.y, this.scene.player.x, this.scene.player.y);
        if (d < 260 || this.scene.exposureSystem.level() >= 4) target = { x: this.scene.player.x, y: this.scene.player.y, kind: "player" };
      }
      if (!target && this.routeBlocks.length) {
        const block = this.routeBlocks[0];
        target = { x: block.x, y: block.y, kind: "block" };
      }
      if (!target) target = CHURCH_ANCHOR;

      this.moveNpcToward(hunter, target.x, target.y, dt, target.kind === "player" ? 1.12 : 0.82);
      if (target.kind === "player" && Phaser.Math.Distance.Between(hunter.x, hunter.y, this.scene.player.x, this.scene.player.y) < 18) {
        this.scene.exposureSystem.add(7, "A hunter almost pins you down.");
      }
    }
  }

  nearestBlood(hunter) {
    const stains = this.scene.evidenceSystem?.bloodStains || [];
    let best = null;
    let bestD = Infinity;
    for (const stain of stains) {
      if (stain.cleaned || stain.layer !== hunter.layer) continue;
      const d = Phaser.Math.Distance.Between(hunter.x, hunter.y, stain.x, stain.y);
      if (d < 220 && d < bestD) { best = stain; bestD = d; }
    }
    return best;
  }

  moveNpcToward(npc, x, y, dt, speedMul = 1) {
    const dx = x - npc.x;
    const dy = y - npc.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = (npc.speed || 42) * speedMul;
    npc.x += (dx / len) * speed * dt;
    npc.y += (dy / len) * speed * dt;
    npc.container.setPosition(npc.x, npc.y);
  }

  hunters() {
    return this.scene.npcSystem.npcs.filter(npc => npc.type === NPC_TYPES.HUNTER && !npc.inactive && !npc.dead);
  }

  summary() {
    if (!this.revealed) return "Hunters dormant";
    const blocks = this.routeBlocks.length ? ` · blocks ${this.routeBlocks.length}` : "";
    return `Hunters ${this.hunters().length}${blocks}`;
  }
}
