import {
  districtEntryPoints,
  districtZones,
  districtZoneAt,
  LAYERS,
  pedestrianRoutes,
  streetNavigationPoints
} from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";
import {
  chooseFootResponsePoint,
  clampWantedLevel,
  desiredFootPolice,
  desiredPoliceTotal
} from "../police/PoliceResponsePolicy.js";
import { PoliceSystem as PoliceSystemCore } from "./PoliceSystemCore.js";

const DISTRICT_ENTRY_POINTS = districtEntryPoints;
const RETIRE_ARRIVAL_RADIUS = 34;

const MOTORIZED_OFFICER_OFFSETS = Object.freeze([
  Object.freeze({ x: -15, y: -11 }),
  Object.freeze({ x: 15, y: 11 }),
  Object.freeze({ x: -18, y: 14 }),
  Object.freeze({ x: 18, y: -14 })
]);

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

function uniqueStreetPoints(points = []) {
  const seen = new Set();
  return points.filter(point => {
    if (!point || (point.layer ?? LAYERS.STREET) !== LAYERS.STREET) return false;
    const key = `${Math.round(Number(point.x) || 0)}:${Math.round(Number(point.y) || 0)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(point => ({
    x: Number(point.x) || 0,
    y: Number(point.y) || 0,
    layer: LAYERS.STREET,
    crosswalk: Boolean(point.crosswalk)
  }));
}

function allSidewalkPatrolRoutes() {
  return pedestrianRoutes
    .map(route => {
      const points = uniqueStreetPoints(route.points || []);
      return points.length >= 2
        ? {
            id: route.id,
            points,
            surface: "pedestrian"
          }
        : null;
    })
    .filter(Boolean);
}

export function sidewalkPatrolRoutesForZone(zoneId) {
  return allSidewalkPatrolRoutes().filter(route => (
    route.points.some(point => districtZoneAt(point.x, point.y).id === zoneId)
  ));
}

export function surplusPoliceCount(current, desired) {
  return Math.max(0, Math.floor(Number(current) || 0) - Math.max(0, Math.floor(Number(desired) || 0)));
}

export class PoliceSystem extends PoliceSystemCore {
  inReacquisitionGrace() {
    const until = Number(this.scene.registry?.get?.("policeReacquisitionGraceUntil")) || 0;
    return (Number(this.scene.time?.now) || 0) < until;
  }

  wantedLevel() {
    return this.inReacquisitionGrace() ? 0 : super.wantedLevel();
  }

  resetAfterPlayerDeath(graceMs = 7000) {
    const now = Number(this.scene.time?.now) || 0;
    const until = now + Math.max(0, Number(graceMs) || 0);
    this.scene.registry?.set?.("policeReacquisitionGraceUntil", until);
    this.previousLevel = 0;
    this.attackLeaderId = null;
    this.lastKnownPlayer = null;
    this.arrestTriggered = false;
    this.helicopter.active = false;
    this.helicopter.lock = 0;

    for (const cop of this.allPolice()) {
      cop.enemyAttack = null;
      cop.chasingPlayer = false;
      cop.alarmed = false;
      cop.investigateTarget = null;
      cop.reportTarget = null;
      cop.reportSeverity = 0;
      cop.witnessReason = "";
      cop.reactionTimer = 0;
      cop.soundReactionTimer = 0;
      cop.hasReported = false;
      if (this.isTemporaryResponseCop(cop)) this.finishRetirement(cop);
    }
    this.scene.npcSystem?.rebuildSpatialIndex?.();
    return until;
  }

  allPolice() {
    return super.police();
  }

  police() {
    const stream = this.scene.entityStreamSystem;
    const all = this.allPolice();
    return stream ? all.filter(cop => stream.shouldSimulateNpc(cop)) : all;
  }

  update(dt) {
    const level = clampWantedLevel(this.wantedLevel());
    this.cancelRequiredRetirements(level);
    super.update(dt);
    this.reconcilePolicePopulation(level);
  }

  desiredCount(level = this.wantedLevel()) {
    return desiredPoliceTotal(level);
  }

  footDesiredCount(level = this.wantedLevel()) {
    const clamped = clampWantedLevel(level);
    const reserved = this.scene.motorizedPoliceSystem?.reservedOfficerCount?.(clamped) || 0;
    return desiredFootPolice(clamped, reserved);
  }

  responsePolice() {
    return this.allPolice().filter(cop => !cop.retiringFromResponse);
  }

  spawnForExposure(level = this.wantedLevel()) {
    const clamped = clampWantedLevel(level);
    if (clamped < 1) return;
    const desired = this.footDesiredCount(clamped);
    const existingPolice = this.responsePolice().length;
    this.spawnedThisTick = 0;
    while (existingPolice + this.spawnedThisTick < desired) this.spawnPolice(clamped);
    this.spawnedThisTick = 0;
  }

  responseSpawnPoint(level = this.wantedLevel()) {
    const clamped = clampWantedLevel(level);
    const player = this.scene.player;
    const zone = this.zoneAt(player.x, player.y);
    const sidewalkPoints = this.districtPatrolPoints(zone.id);
    const targetDistance = clamped === 1 ? 430 : clamped === 2 ? 520 : 610;
    const maxDistance = clamped === 1 ? 760 : clamped === 2 ? 920 : 1080;
    return chooseFootResponsePoint(
      [...sidewalkPoints, ...DISTRICT_ENTRY_POINTS],
      player,
      Math.max(0, this.spawned - 1),
      {
        minDistance: 260,
        targetDistance,
        maxDistance,
        sectorCount: 8
      }
    );
  }

  spawnPolice(level = this.wantedLevel()) {
    const clamped = clampWantedLevel(level);
    this.spawnedThisTick++;
    this.spawned++;
    const fallback = DISTRICT_ENTRY_POINTS[this.spawned % DISTRICT_ENTRY_POINTS.length];
    const point = this.responseSpawnPoint(clamped) || fallback;
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
      patrolRoute: point.patrolRoute || fallback.patrolRoute,
      patrolIndex: 0,
      patrolOffsetIndex: this.spawned % 8,
      searchIndex: this.spawned % 8
    });
    cop.active = true;
    cop.deploymentKind = "foot-response";
    cop.responseWantedLevel = clamped;
    cop.investigateTarget = clamped >= 1 ? {
      x: this.scene.player.x,
      y: this.scene.player.y,
      kind: "heat",
      zoneId: this.zoneAt(this.scene.player.x, this.scene.player.y).id
    } : null;
    this.scene.npcSystem.npcs.push(cop);
    this.scene.entityStreamSystem?.applyNpcState?.(cop, 0);
    this.scene.npcSystem.rebuildSpatialIndex?.();
    this.scene.lastActionText = clamped >= 3
      ? "Police flood the district from multiple street approaches."
      : clamped >= 2
        ? "Additional foot units close in while response cruisers converge."
        : "Nearby foot patrols converge on the reported area.";
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
    const previous = this.previousLevel;
    super.handleWantedLevelChange(level);
    if (level <= previous) return;
    if (level === 1) {
      this.scene.lastActionText = "WANTED LEVEL 1: nearby foot patrols respond immediately and converge on the last known area.";
    } else if (level === 2) {
      this.scene.lastActionText = "WANTED LEVEL 2: response cruisers actively intercept, ram and force vehicles off line while armed officers close in.";
    } else if (level >= 3) {
      this.scene.lastActionText = "WANTED LEVEL 3: three cruisers, a roadblock, massed foot units and helicopter pressure saturate the district.";
    }
  }

  isTemporaryResponseCop(cop) {
    return Boolean(cop?.deploymentKind === "foot-response" || cop?.deploymentKind === "motorized" || cop?.motorizedUnitId);
  }

  retirementPointFor(cop, index = 0) {
    const player = this.scene.player;
    const ordered = [...DISTRICT_ENTRY_POINTS].sort((a, b) => {
      const aDistance = Math.hypot(a.x - player.x, a.y - player.y);
      const bDistance = Math.hypot(b.x - player.x, b.y - player.y);
      return bDistance - aDistance;
    });
    return ordered[(index + (cop.searchIndex || 0)) % Math.max(1, ordered.length)] || DISTRICT_ENTRY_POINTS[0];
  }

  beginRetirement(cop, index = 0) {
    if (!cop || cop.retiringFromResponse) return;
    const exit = this.retirementPointFor(cop, index);
    cop.retiringFromResponse = true;
    cop.retirementTarget = { x: exit.x, y: exit.y, kind: "retire" };
    cop.chasingPlayer = false;
    cop.enemyAttack = false;
    cop.investigateTarget = null;
    cop.patrolPause = 0;
  }

  cancelRequiredRetirements(level) {
    const desired = this.desiredCount(level);
    const available = this.allPolice().filter(cop => !cop.retiringFromResponse).length;
    let needed = Math.max(0, desired - available);
    if (!needed) return;
    const retiring = this.allPolice()
      .filter(cop => cop.retiringFromResponse)
      .sort((a, b) => Phaser.Math.Distance.Between(a.x, a.y, this.scene.player.x, this.scene.player.y)
        - Phaser.Math.Distance.Between(b.x, b.y, this.scene.player.x, this.scene.player.y));
    for (const cop of retiring) {
      if (needed <= 0) break;
      cop.retiringFromResponse = false;
      cop.retirementTarget = null;
      needed--;
    }
  }

  reconcilePolicePopulation(level) {
    const desired = this.desiredCount(level);
    const active = this.allPolice();
    const alreadyRetiring = active.filter(cop => cop.retiringFromResponse).length;
    const surplus = surplusPoliceCount(active.length - alreadyRetiring, desired);
    if (!surplus) return;

    const candidates = active
      .filter(cop => !cop.retiringFromResponse && this.isTemporaryResponseCop(cop))
      .sort((a, b) => {
        const motorizedPriority = Number(Boolean(b.motorizedUnitId)) - Number(Boolean(a.motorizedUnitId));
        if (motorizedPriority) return motorizedPriority;
        return Phaser.Math.Distance.Between(b.x, b.y, this.scene.player.x, this.scene.player.y)
          - Phaser.Math.Distance.Between(a.x, a.y, this.scene.player.x, this.scene.player.y);
      });

    for (let index = 0; index < Math.min(surplus, candidates.length); index++) {
      this.beginRetirement(candidates[index], index);
    }
  }

  finishRetirement(cop) {
    cop.retiringFromResponse = false;
    cop.retirementTarget = null;
    cop.inactive = true;
    cop.active = false;
    cop.chasingPlayer = false;
    cop.vx = 0;
    cop.vy = 0;
    cop.container?.setVisible?.(false);
    this.scene.events?.emit?.("police:response-retired", { officerId: cop.id });
    this.scene.npcSystem.rebuildSpatialIndex?.();
  }

  districtPatrolRoutes(zoneId) {
    const sidewalkRoutes = sidewalkPatrolRoutesForZone(zoneId);
    if (sidewalkRoutes.length) return sidewalkRoutes;

    const nearestSidewalkRoutes = allSidewalkPatrolRoutes();
    if (nearestSidewalkRoutes.length) return nearestSidewalkRoutes;

    const fallback = uniqueStreetPoints(
      streetNavigationPoints.filter(point => districtZoneAt(point.x, point.y).id === zoneId)
    );
    return fallback.length
      ? [{ id: `road-fallback-${zoneId}`, points: fallback, surface: "road-fallback" }]
      : [];
  }

  districtPatrolPoints(zoneId) {
    return this.districtPatrolRoutes(zoneId).flatMap(route => route.points);
  }

  patrolRouteForCop(cop, zoneId) {
    const routes = this.districtPatrolRoutes(zoneId);
    if (!routes.length) return null;
    const assigned = routes.find(route => route.id === cop.districtPatrolRouteId);
    if (assigned) return assigned;

    let bestRoute = routes[0];
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (const route of routes) {
      const index = nearestPointIndex(route.points, cop.x, cop.y);
      const point = route.points[index];
      const distance = Math.hypot(point.x - cop.x, point.y - cop.y);
      if (distance < bestDistance) {
        bestRoute = route;
        bestIndex = index;
        bestDistance = distance;
      }
    }
    cop.districtPatrolRouteId = bestRoute.id;
    cop.districtPatrolIndex = bestIndex;
    return bestRoute;
  }

  targetForCop(cop, level, cfg) {
    if (cop.retiringFromResponse && cop.retirementTarget) return cop.retirementTarget;
    const target = super.targetForCop(cop, level, cfg);
    if (!target || target.kind !== "patrol") return target;
    const zone = this.zoneAt(cop.x, cop.y);
    if (!zone) return target;
    if (cop.districtPatrolZoneId !== zone.id) {
      cop.districtPatrolZoneId = zone.id;
      cop.districtPatrolRouteId = null;
      cop.districtPatrolIndex = 0;
    }
    const route = this.patrolRouteForCop(cop, zone.id);
    if (!route?.points?.length) return target;
    const point = route.points[(cop.districtPatrolIndex || 0) % route.points.length];
    return {
      x: point.x,
      y: point.y,
      kind: "patrol",
      districtPatrol: true,
      districtPatrolRouteId: route.id,
      patrolSurface: route.surface,
      zoneId: zone.id
    };
  }

  resolveTargetArrival(cop, target, level) {
    if (target?.kind === "retire") {
      const distance = Phaser.Math.Distance.Between(cop.x, cop.y, target.x, target.y);
      if (distance < RETIRE_ARRIVAL_RADIUS) this.finishRetirement(cop);
      return;
    }
    if (target?.districtPatrol) {
      const distance = Phaser.Math.Distance.Between(cop.x, cop.y, target.x, target.y);
      if (distance < 18) {
        const routes = this.districtPatrolRoutes(target.zoneId);
        const route = routes.find(candidate => candidate.id === target.districtPatrolRouteId)
          || routes[0];
        cop.districtPatrolIndex = route?.points?.length
          ? ((cop.districtPatrolIndex || 0) + 1) % route.points.length
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
      const value = this.scene.heatSystem?.valueFor?.(zone.id) ?? this.localHeat[zone.id] ?? 0;
      if (value > heat) { best = zone; heat = value; }
    }
    return best;
  }

  summary() {
    const active = this.police();
    const total = this.allPolice();
    const motorized = total.filter(cop => cop.motorizedUnitId).length;
    const retiring = total.filter(cop => cop.retiringFromResponse).length;
    const base = super.summary();
    const streamed = total.length === active.length ? base : `${base} · streamed ${active.length}/${total.length}`;
    const deployments = motorized ? `${streamed} · motorized officers ${motorized}` : streamed;
    return retiring ? `${deployments} · withdrawing ${retiring}` : deployments;
  }
}
