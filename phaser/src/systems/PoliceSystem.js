import { districtZones, districtZoneAt, LAYERS } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";
import { PoliceSystem as PoliceSystemCore } from "./PoliceSystemCore.js";

const DESIRED_POLICE_BY_LEVEL = Object.freeze({ 0: 2, 1: 3, 2: 5, 3: 7 });

const DISTRICT_ENTRY_POINTS = Object.freeze([
  Object.freeze({ x: 780, y: 178, patrolRoute: "northEast" }),
  Object.freeze({ x: 1088, y: 338, patrolRoute: "northEast" }),
  Object.freeze({ x: 1688, y: 760, patrolRoute: "southClub" }),
  Object.freeze({ x: 2240, y: 1192, patrolRoute: "westCross" }),
  Object.freeze({ x: 482, y: 1192, patrolRoute: "westCross" })
]);

function clampLevel(level) { return Math.max(0, Math.min(3, Math.floor(Number(level) || 0))); }

export class PoliceSystem extends PoliceSystemCore {
  desiredCount(level = this.scene.exposureSystem.level()) {
    return DESIRED_POLICE_BY_LEVEL[clampLevel(level)];
  }

  spawnForExposure(level = this.scene.exposureSystem.level()) {
    const clamped = clampLevel(level);
    if (clamped < 1) return;
    const desired = this.desiredCount(clamped);
    const activePolice = this.police().length;
    this.spawnedThisTick = 0;
    while (activePolice + this.spawnedThisTick < desired) this.spawnPolice(clamped);
    this.spawnedThisTick = 0;
  }

  spawnPolice(level = this.scene.exposureSystem.level()) {
    const clamped = clampLevel(level);
    this.spawnedThisTick++;
    this.spawned++;
    const point = DISTRICT_ENTRY_POINTS[this.spawned % DISTRICT_ENTRY_POINTS.length];
    const offset = (this.spawned % 3 - 1) * 14;
    const cop = this.scene.npcSystem.createNpc({
      id: `police_${this.spawned}`,
      type: NPC_TYPES.POLICE,
      x: point.x + offset,
      y: point.y - offset,
      layer: LAYERS.STREET,
      behavior: "guard",
      speed: 28,
      dirX: -1,
      dirY: 0,
      patrolRoute: point.patrolRoute,
      patrolIndex: 0,
      patrolOffsetIndex: this.spawned % 8,
      searchIndex: this.spawned % 8
    });
    cop.active = true;
    cop.investigateTarget = clamped >= 1 ? {
      x: this.scene.player.x,
      y: this.scene.player.y,
      kind: "heat",
      zoneId: this.zoneAt(this.scene.player.x, this.scene.player.y).id
    } : null;
    this.scene.npcSystem.npcs.push(cop);
    this.scene.npcSystem.rebuildSpatialIndex?.();
    this.scene.lastActionText = clamped >= 2
      ? "Police reinforcements enter from separated district approaches."
      : "One additional patrol joins the active search.";
  }

  zoneAt(x, y) { return districtZoneAt(x, y); }

  hottestZone() {
    let best = null;
    let heat = 0;
    for (const zone of districtZones) {
      const value = this.localHeat[zone.id] || 0;
      if (value > heat) { best = zone; heat = value; }
    }
    return best;
  }
}
