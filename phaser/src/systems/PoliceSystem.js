import { districtZones, districtZoneAt, LAYERS, streetNavigationPoints } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";
import { PoliceSystem as PoliceSystemCore } from "./PoliceSystemCore.js";

const DESIRED_POLICE_BY_LEVEL = Object.freeze({ 0: 2, 1: 3, 2: 5, 3: 7 });
const OLD_QUARTER_ID = "old-quarter";

const DISTRICT_ENTRY_POINTS = Object.freeze([
  Object.freeze({ x: 780, y: 178, patrolRoute: "northEast" }),
  Object.freeze({ x: 1088, y: 338, patrolRoute: "northEast" }),
  Object.freeze({ x: 1688, y: 760, patrolRoute: "southClub" }),
  Object.freeze({ x: 2240, y: 1192, patrolRoute: "westCross" }),
  Object.freeze({ x: 482, y: 1192, patrolRoute: "westCross" })
]);

const MOTORIZED_OFFICER_OFFSETS = Object.freeze([
  Object.freeze({ x: -15, y: -11 }),
  Object.freeze({ x: 15, y: 11 }),
  Object.freeze({ x: -18, y: 14 }),
  Object.freeze({ x: 18, y: -14 })
]);

function clampLevel(level) { return Math.max(0, Math.min(3, Math.floor(Number(level) || 0))); }

function nearestPointIndex(points, x, y) {
  let bestIndex = 0;
  let bestDistance = Infinity;
  points.forEach((point, index) => {
    const distance = Math.hypot((Number(point.x) || 0) - x, (Number(point.y) || 0) - y);
    if (distance < bestDistance) {
      bestIndex = index;
      bestDistance = distance;
    }
  });
  return bestIndex;
}

export class PoliceSystem extends PoliceSystemCore {
  allPolice() {
    return super.police();
  }

  police() {
    const stream = this.scene.entityStreamSystem;
    const all = this.allPolice();
    return stream ? all.filter(cop => stream.shouldSimulateNpc(cop)) : all;
  }

  desiredCount(level = this.scene.exposureSystem.level()) {
    const clamped = clampLevel(level);
    const reserved = this.scene.motorizedPoliceSystem?.reservedOfficerCount?.(clamped) || 0;
    return Math.max(2, DESIRED_POLICE_BY_LEVEL[clamped] - reserved);
  }

  spawnForExposure(level = this.scene.exposureSystem.level()) {
    const clamped = clampLevel(level);
    if (clamped < 1) return;
    const desired = this.desiredCount(clamped);
    const existingPolice = this.allPolice().length;
    this.spawnedThisTick = 0;
    while (existingPolice + this.spawnedThisTick < desired) this.spawnPolice(clamped);
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
    this.scene.entityStreamSystem?.applyNpcState?.(cop, 0);
    this.scene.npcSystem.rebuildSpatialIndex?.();
    this.scene.lastActionText = clamped >= 2
      ? "Police reinforcements enter from separated district approaches."
      : "One additional patrol joins the active search.";
  }

  spawnMotorizedOfficers(unitId, {
    x,
    y,
    angle = 0,
    count = 2,
    reason = "intercept",
    role = "pursuit"
  } = {}) {
    const id = String(unitId || "").trim();
    if (!id) throw new TypeError("Motorized police unit id is required.");
    const existing = this.allPolice().filter(cop => cop.motorizedUnitId === id);
    if (existing.length) return existing.map(cop => cop.id);

    const amount = Math.max(1, Math.min(4, Math.floor(Number(count) || 2)));
    const cos = Math.cos(Number(angle) || 0);
    const sin = Math.sin(Number(angle) || 0);
    const target = {
      x: this.scene.player.x,
      y: this.scene.player.y,
      kind: "player",
      zoneId: this.zoneAt(this.scene.player.x, this.scene.player.y).id
    };
    const ids = [];

    for (let index = 0; index < amount; index++) {
      const offset = MOTORIZED_OFFICER_OFFSETS[index % MOTORIZED_OFFICER_OFFSETS.length];
      const rotatedX = offset.x * cos - offset.y * sin;
      const rotatedY = offset.x * sin + offset.y * cos;
      const officerId = `${id}-officer-${index + 1}`;
      const cop = this.scene.npcSystem.createNpc({
        id: officerId,
        type: NPC_TYPES.POLICE,
        x: (Number(x) || 0) + rotatedX,
        y: (Number(y) || 0) + rotatedY,
        layer: LAYERS.STREET,
        behavior: "guard",
        speed: 30,
        dirX: Math.cos(Number(angle) || 0),
        dirY: Math.sin(Number(angle) || 0),
        patrolRoute: DISTRICT_ENTRY_POINTS[index % DISTRICT_ENTRY_POINTS.length].patrolRoute,
        patrolIndex: 0,
        patrolOffsetIndex: index,
        searchIndex: index
      });
      cop.active = true;
      cop.motorizedUnitId = id;
      cop.deploymentKind = "motorized";
      cop.deploymentReason = String(reason || "intercept");
      cop.motorizedRole = String(role || "pursuit");
      cop.investigateTarget = { ...target };
      cop.chasingPlayer = true;
      this.scene.npcSystem.npcs.push(cop);
      this.scene.entityStreamSystem?.applyNpcState?.(cop, 0);
      this.scene.aiStateSystem?.ensureNpc?.(cop);
      ids.push(cop.id);
    }

    this.scene.npcSystem.rebuildSpatialIndex?.();
    this.scene.events?.emit?.("police:motorized-officers-deployed", {
      unitId: id,
      officerIds: [...ids],
      reason: String(reason || "intercept"),
      role: String(role || "pursuit")
    });
    this.scene.lastActionText = role === "roadblock"
      ? "Police abandon the roadblock and fan out on foot."
      : "Officers jump from the cruiser and continue the pursuit on foot.";
    return ids;
  }

  handleWantedLevelChange(level) {
    super.handleWantedLevelChange(level);
    if (level === 2) {
      this.scene.lastActionText = "WANTED LEVEL 2: a response cruiser enters the district while foot units close on the last known area.";
    } else if (level >= 3) {
      this.scene.lastActionText = "WANTED LEVEL 3: pursuit cruisers, a partial roadblock and helicopter pressure converge on the district.";
    }
  }

  districtPatrolPoints(zoneId) {
    return streetNavigationPoints.filter(point => districtZoneAt(point.x, point.y).id === zoneId);
  }

  targetForCop(cop, level, cfg) {
    const target = super.targetForCop(cop, level, cfg);
    if (!target || target.kind !== "patrol") return target;
    const zone = this.zoneAt(cop.x, cop.y);
    if (!zone || zone.id === OLD_QUARTER_ID) return target;
    const points = this.districtPatrolPoints(zone.id);
    if (!points.length) return target;
    if (cop.districtPatrolZoneId !== zone.id) {
      cop.districtPatrolZoneId = zone.id;
      cop.districtPatrolIndex = nearestPointIndex(points, cop.x, cop.y);
    }
    const point = points[(cop.districtPatrolIndex || 0) % points.length];
    return {
      x: point.x,
      y: point.y,
      kind: "patrol",
      districtPatrol: true,
      zoneId: zone.id
    };
  }

  resolveTargetArrival(cop, target, level) {
    if (target?.districtPatrol) {
      const distance = Phaser.Math.Distance.Between(cop.x, cop.y, target.x, target.y);
      if (distance < 18) {
        const points = this.districtPatrolPoints(target.zoneId);
        cop.districtPatrolIndex = points.length
          ? ((cop.districtPatrolIndex || 0) + 1) % points.length
          : 0;
        cop.patrolPause = 0.35 + Math.random() * 0.55;
      }
      return;
    }
    super.resolveTargetArrival(cop, target, level);
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

  summary() {
    const active = this.police();
    const total = this.allPolice();
    const motorized = total.filter(cop => cop.motorizedUnitId).length;
    const base = super.summary();
    const streamed = total.length === active.length ? base : `${base} · streamed ${active.length}/${total.length}`;
    return motorized ? `${streamed} · motorized officers ${motorized}` : streamed;
  }
}
