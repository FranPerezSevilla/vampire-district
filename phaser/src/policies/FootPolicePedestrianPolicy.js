import {
  districtZoneAt,
  LAYERS,
  pedestrianRoutes,
  pointOnPedestrianSurface
} from "../data/district.js";
import { PoliceSystem } from "../systems/PoliceSystem.js";

function finite(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function routePoints(route) {
  const seen = new Set();
  return (route?.points || [])
    .filter(point => (point?.layer ?? LAYERS.STREET) === LAYERS.STREET)
    .filter(point => pointOnPedestrianSurface(finite(point.x), finite(point.y)))
    .filter(point => {
      const key = `${Math.round(finite(point.x))}:${Math.round(finite(point.y))}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(point => ({
      x: finite(point.x),
      y: finite(point.y),
      layer: LAYERS.STREET,
      crosswalk: Boolean(point.crosswalk),
      patrolRoute: route.id
    }));
}

function allPedestrianPoliceRoutes() {
  return pedestrianRoutes
    .map(route => {
      const points = routePoints(route);
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

export function pedestrianPoliceRoutesForZone(zoneId) {
  const routes = allPedestrianPoliceRoutes();
  const local = routes.filter(route => (
    route.points.some(point => districtZoneAt(point.x, point.y).id === zoneId)
  ));
  return local.length ? local : routes;
}

export function nearestPedestrianPolicePoint(x, y, zoneId = null) {
  const routes = zoneId == null
    ? allPedestrianPoliceRoutes()
    : pedestrianPoliceRoutesForZone(zoneId);
  let best = null;
  let bestDistance = Infinity;
  for (const route of routes) {
    for (const point of route.points) {
      const distance = Math.hypot(point.x - finite(x), point.y - finite(y));
      if (distance >= bestDistance) continue;
      bestDistance = distance;
      best = {
        ...point,
        patrolRoute: route.id,
        patrolSurface: "pedestrian"
      };
    }
  }
  return best;
}

function nearestPointOnRoute(route, x, y) {
  let best = null;
  let bestDistance = Infinity;
  for (const point of route?.points || []) {
    const distance = Math.hypot(point.x - finite(x), point.y - finite(y));
    if (distance >= bestDistance) continue;
    bestDistance = distance;
    best = point;
  }
  return best;
}

function projectNonCombatTarget(system, cop, target) {
  const zone = system.zoneAt(cop.x, cop.y);
  if (!zone) return target;
  if (cop.districtPatrolZoneId !== zone.id) {
    cop.districtPatrolZoneId = zone.id;
    cop.districtPatrolRouteId = null;
    cop.districtPatrolIndex = 0;
  }
  const route = system.patrolRouteForCop(cop, zone.id);
  const point = nearestPointOnRoute(route, target.x, target.y)
    || nearestPedestrianPolicePoint(target.x, target.y, zone.id);
  if (!point) return target;
  return {
    ...target,
    x: point.x,
    y: point.y,
    pedestrianProjected: true,
    pedestrianRouteId: route?.id || point.patrolRoute || null,
    patrolSurface: "pedestrian"
  };
}

function snapFootResponseToPedestrian(system, cop) {
  if (!cop || cop.deploymentKind !== "foot-response") return cop;
  if (pointOnPedestrianSurface(cop.x, cop.y)) return cop;
  const zone = system.zoneAt(cop.x, cop.y);
  const point = nearestPedestrianPolicePoint(cop.x, cop.y, zone?.id);
  if (!point) return cop;
  cop.x = point.x;
  cop.y = point.y;
  cop.container?.setPosition?.(point.x, point.y);
  cop.districtPatrolZoneId = zone?.id || districtZoneAt(point.x, point.y).id;
  cop.districtPatrolRouteId = point.patrolRoute || null;
  cop.districtPatrolIndex = 0;
  return cop;
}

export function installFootPolicePedestrianPolicy() {
  const police = PoliceSystem?.prototype;
  if (!police || police.__nbdFootPolicePedestrianPolicy) return;

  const originalDistrictPatrolRoutes = police.districtPatrolRoutes;
  const originalResponseSpawnPoint = police.responseSpawnPoint;
  const originalSpawnPolice = police.spawnPolice;
  const originalTargetForCop = police.targetForCop;
  const originalResolveTargetArrival = police.resolveTargetArrival;

  police.districtPatrolRoutes = function pedestrianDistrictPatrolRoutes(zoneId) {
    const routes = pedestrianPoliceRoutesForZone(zoneId);
    if (routes.length) return routes;
    return originalDistrictPatrolRoutes.call(this, zoneId)
      .filter(route => route?.surface === "pedestrian")
      .map(route => ({
        ...route,
        points: (route.points || []).filter(point => pointOnPedestrianSurface(point.x, point.y))
      }))
      .filter(route => route.points.length >= 2);
  };

  police.responseSpawnPoint = function pedestrianResponseSpawnPoint(level = this.wantedLevel()) {
    const point = originalResponseSpawnPoint.call(this, level);
    if (point && pointOnPedestrianSurface(point.x, point.y)) return point;
    const player = this.scene.player;
    const zone = this.zoneAt(player.x, player.y);
    return nearestPedestrianPolicePoint(point?.x ?? player.x, point?.y ?? player.y, zone?.id) || point;
  };

  police.spawnPolice = function pedestrianFootResponseSpawn(level = this.wantedLevel()) {
    const result = originalSpawnPolice.call(this, level);
    const expectedId = `police_${this.spawned}`;
    const cop = this.allPolice().find(candidate => candidate.id === expectedId);
    snapFootResponseToPedestrian(this, cop);
    return result;
  };

  police.targetForCop = function pedestrianPoliceTarget(cop, level, cfg) {
    const wasChasingPlayer = Boolean(cop?.chasingPlayer);
    const target = originalTargetForCop.call(this, cop, level, cfg);
    if (!target) return target;

    if (target.kind === "player") {
      cop.pedestrianRecoveryActive = false;
      return target;
    }
    if (target.kind === "retire") return target;

    if (wasChasingPlayer && !pointOnPedestrianSurface(cop.x, cop.y)) {
      cop.pedestrianRecoveryActive = true;
    } else if (target.kind === "patrol" && !pointOnPedestrianSurface(cop.x, cop.y)) {
      cop.pedestrianRecoveryActive = true;
    }

    if (cop.pedestrianRecoveryActive) {
      if (pointOnPedestrianSurface(cop.x, cop.y)) {
        cop.pedestrianRecoveryActive = false;
      } else {
        const zone = this.zoneAt(cop.x, cop.y);
        const point = nearestPedestrianPolicePoint(cop.x, cop.y, zone?.id);
        if (point) {
          return {
            x: point.x,
            y: point.y,
            kind: "pedestrian-return",
            pedestrianReturn: true,
            pedestrianRouteId: point.patrolRoute || null,
            patrolSurface: "pedestrian",
            resumeKind: target.kind,
            zoneId: zone?.id || null
          };
        }
      }
    }

    if (target.kind === "search" || target.kind === "heat") {
      return projectNonCombatTarget(this, cop, target);
    }

    if (target.kind === "patrol" && !pointOnPedestrianSurface(target.x, target.y)) {
      const zone = this.zoneAt(cop.x, cop.y);
      const point = nearestPedestrianPolicePoint(target.x, target.y, zone?.id);
      return point
        ? {
            ...target,
            x: point.x,
            y: point.y,
            patrolSurface: "pedestrian"
          }
        : target;
    }

    return target;
  };

  police.resolveTargetArrival = function pedestrianPoliceArrival(cop, target, level) {
    if (target?.kind === "pedestrian-return") {
      const distance = Math.hypot(finite(cop.x) - finite(target.x), finite(cop.y) - finite(target.y));
      if (distance < 18) {
        cop.pedestrianRecoveryActive = false;
        cop.districtPatrolZoneId = target.zoneId || this.zoneAt(cop.x, cop.y)?.id || null;
        cop.districtPatrolRouteId = target.pedestrianRouteId || null;
        cop.districtPatrolIndex = 0;
        cop.patrolPause = 0;
      }
      return;
    }
    return originalResolveTargetArrival.call(this, cop, target, level);
  };

  police.__nbdFootPolicePedestrianPolicy = true;
}
