import { LAYERS } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";

const POLICE_STATION = Object.freeze({ x: 780, y: 178 });
const LOCAL_ZONES = Object.freeze([
  { id: "cross", name: "Central crossroad", x: 392, y: 244, w: 170, h: 170 },
  { id: "north", name: "North avenue", x: 400, y: 38, w: 150, h: 250 },
  { id: "east", name: "East avenue", x: 520, y: 292, w: 374, h: 116 },
  { id: "west", name: "West avenue", x: 64, y: 292, w: 360, h: 116 },
  { id: "club", name: "Club", x: 574, y: 350, w: 208, h: 168 },
  { id: "church", name: "Church", x: 680, y: 420, w: 210, h: 176 },
  { id: "police", name: "Police station", x: 670, y: 70, w: 220, h: 204 },
  { id: "alleys", name: "Alleys", x: 80, y: 232, w: 820, h: 330 }
]);

export class PoliceSystem {
  constructor(scene) {
    this.scene = scene;
    this.localHeat = Object.create(null);
    this.spawned = 0;
  }

  update(dt) {
    this.coolHeat(dt);
    this.spawnForExposure();
    this.updatePolice(dt);
  }

  addHeat(x, y, amount, reason = "disturbance") {
    if (!amount || amount <= 0) return;
    const zone = this.zoneAt(x, y);
    const before = this.localHeat[zone.id] || 0;
    this.localHeat[zone.id] = Math.min(100, before + amount);
    if (before < 45 && this.localHeat[zone.id] >= 45) {
      this.scene.lastActionText = `${zone.name} heats up: ${reason}.`;
    }
  }

  coolHeat(dt) {
    for (const id of Object.keys(this.localHeat)) {
      this.localHeat[id] = Math.max(0, this.localHeat[id] - dt * 1.2);
      if (this.localHeat[id] <= 0.1) delete this.localHeat[id];
    }
  }

  spawnForExposure() {
    const level = this.scene.exposureSystem.level();
    if (level < 2) return;
    const desired = Math.min(4, Math.max(1, level));
    const activePolice = this.police().length;
    while (activePolice + this.spawnedThisTick < desired) this.spawnPolice();
    this.spawnedThisTick = 0;
  }

  spawnPolice() {
    this.spawnedThisTick = (this.spawnedThisTick || 0) + 1;
    this.spawned++;
    const offset = (Math.random() - 0.5) * 34;
    const cop = this.scene.npcSystem.createNpc({
      id: `police_${this.spawned}`,
      type: NPC_TYPES.POLICE,
      x: POLICE_STATION.x + offset,
      y: POLICE_STATION.y + (Math.random() - 0.5) * 28,
      layer: LAYERS.STREET,
      behavior: "police",
      speed: 34
    });
    cop.active = true;
    cop.investigateTarget = this.hottestPoint();
    this.scene.npcSystem.npcs.push(cop);
    this.scene.lastActionText = "Police leave the station and enter the district.";
  }

  updatePolice(dt) {
    for (const cop of this.police()) {
      if (cop.dead || cop.hiddenBody) continue;
      let target = null;
      if (this.scene.currentLayer === LAYERS.STREET && this.scene.exposureSystem.level() >= 2) {
        const d = Phaser.Math.Distance.Between(cop.x, cop.y, this.scene.player.x, this.scene.player.y);
        if (d < 240 && !this.scene.currentShadow()) target = { x: this.scene.player.x, y: this.scene.player.y, kind: "player" };
      }
      if (!target) target = cop.investigateTarget || this.hottestPoint();
      if (!target) continue;
      this.moveNpcToward(cop, target.x, target.y, dt, target.kind === "player" ? 1.24 : 0.72);
      if (target.kind === "player" && Phaser.Math.Distance.Between(cop.x, cop.y, this.scene.player.x, this.scene.player.y) < 18) {
        this.scene.exposureSystem.add(4, "Police cut you off in the street.");
      }
    }
  }

  moveNpcToward(npc, x, y, dt, speedMul = 1) {
    const dx = x - npc.x;
    const dy = y - npc.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = (npc.speed || 30) * speedMul;
    npc.x += (dx / len) * speed * dt;
    npc.y += (dy / len) * speed * dt;
    npc.container.setPosition(npc.x, npc.y);
  }

  police() {
    return this.scene.npcSystem.npcs.filter(npc => npc.type === NPC_TYPES.POLICE && !npc.inactive && !npc.dead);
  }

  zoneAt(x, y) {
    return LOCAL_ZONES.find(zone => x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h)
      || { id: "district", name: "District", x: 0, y: 0, w: 960, h: 640 };
  }

  hottestPoint() {
    let best = null;
    let heat = 0;
    for (const zone of LOCAL_ZONES) {
      const value = this.localHeat[zone.id] || 0;
      if (value > heat) {
        best = zone;
        heat = value;
      }
    }
    if (!best || heat < 15) return { x: POLICE_STATION.x, y: POLICE_STATION.y, kind: "patrol" };
    return { x: best.x + best.w / 2, y: best.y + best.h / 2, kind: "heat" };
  }

  summary() {
    const cops = this.police().length;
    const hottest = Object.entries(this.localHeat).sort((a, b) => b[1] - a[1])[0];
    return `Police ${cops} · heat ${hottest ? `${hottest[0]} ${Math.round(hottest[1])}%` : "quiet"}`;
  }
}
