import { PLAYER } from "../data/balance.js";
import { LAYERS } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";

const CHURCH_ANCHOR = Object.freeze({ x: 842, y: 474 });

const ROUTE_BLOCK_POINTS = Object.freeze([
  { id: "church_gate", name: "church gate", x: 842, y: 474, layer: LAYERS.STREET },
  { id: "club_alley", name: "club rear alley", x: 676, y: 502, layer: LAYERS.STREET },
  { id: "cross_manhole", name: "crossroad manhole", x: 472, y: 326, layer: LAYERS.STREET },
  { id: "refuge_escape", name: "refuge fire escape", x: 176, y: 244, layer: LAYERS.STREET }
]);

const HUNTER_CHASE_SPEED = PLAYER.baseSpeed * 0.86;
const HUNTER_TRACK_SPEED = PLAYER.baseSpeed * 0.48;
const HUNTER_BLOCK_SPEED = PLAYER.baseSpeed * 0.54;
const HUNTER_PATROL_SPEED = PLAYER.baseSpeed * 0.30;

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
    if (level < 4) return;

    this.revealed = true;
    this.spawnHunter();
    this.scene.lastActionText = this.scene.missionSystem?.failed
      ? "The Masquerade is broken. A hunter enters the district."
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
    this.nextBlockAt = 8.5;

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
      if (hunter.stunnedTimer > 0) continue;
      let target = null;
      const blood = this.nearestBlood(hunter);
      if (blood) target = { x: blood.x, y: blood.y, kind: "blood" };
      if (!target && this.scene.currentLayer === LAYERS.STREET && !this.scene.currentShadow()) {
        const d = Phaser.Math.Distance.Between(hunter.x, hunter.y, this.scene.player.x, this.scene.player.y);
        if (d < 240 || this.scene.exposureSystem.level() >= 4) target = { x: this.scene.player.x, y: this.scene.player.y, kind: "player" };
      }
      if (!target && this.routeBlocks.length) {
        const block = this.routeBlocks[0];
        target = { x: block.x, y: block.y, kind: "block" };
      }
      if (!target) target = { ...CHURCH_ANCHOR, kind: "anchor" };

      const speed = target.kind === "player"
        ? HUNTER_CHASE_SPEED
        : target.kind === "blood"
          ? HUNTER_TRACK_SPEED
          : target.kind === "block"
            ? HUNTER_BLOCK_SPEED
            : HUNTER_PATROL_SPEED;
      this.moveNpcToward(hunter, target.x, target.y, dt, speed);
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
      if (d < 180 && d < bestD) { best = stain; bestD = d; }
    }
    return best;
  }

  moveNpcToward(npc, x, y, dt, speed) {
    this.scene.npcSystem.moveTowardAtSpeed(npc, x, y, dt, speed);
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
