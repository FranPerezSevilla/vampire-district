import { AI_STATES } from "../data/ai.js";
import { COMBAT_STATES } from "../data/combat.js";
import { LAYERS, pedestrianRoutes, pointOnPedestrianSurface } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";
import { RawAudio } from "./RawAudioSystem.js";

const REPORTING_TYPES = new Set([NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET]);
const SHOCK_MAX_SECONDS = 0.65;
const ARRIVAL_RADIUS = 5;
const MAX_ROUTE_ENTRY_DISTANCE = 96;
const MIN_ESCAPE_GAIN = 36;
const BLOCKED_REPLAN_SECONDS = 0.45;
const BLOCKED_REMOTE_REPORT_SECONDS = 1.25;
const ROUTE_PREVIEW_POINTS = 4;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function distance(a, b) {
  return Math.hypot(finite(a?.x) - finite(b?.x), finite(a?.y) - finite(b?.y));
}

function routeIdFor(witness) {
  return witness?.pedestrian?.routeId || witness?.pedestrianRouteId || null;
}

function nearestPointIndex(points, subject) {
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < points.length; index++) {
    const candidateDistance = distance(points[index], subject);
    if (candidateDistance < bestDistance) {
      bestIndex = index;
      bestDistance = candidateDistance;
    }
  }
  return bestIndex;
}

function cyclicPath(points, startIndex, destinationIndex, direction) {
  const path = [];
  const length = points.length;
  let index = startIndex;
  for (let step = 0; step < length; step++) {
    index = (index + direction + length) % length;
    path.push({ ...points[index], routePointIndex: index });
    if (index === destinationIndex) break;
  }
  return path;
}

function pathLength(origin, points) {
  let total = 0;
  let previous = origin;
  for (const point of points) {
    total += distance(previous, point);
    previous = point;
  }
  return total;
}

function destinationIndexFor(route, witness, source, reportTarget, startIndex) {
  const sourceDistance = source ? distance(witness, source) : 0;
  const desiredDistance = sourceDistance + MIN_ESCAPE_GAIN;
  let bestIndex = -1;
  let bestScore = Infinity;

  for (let index = 0; index < route.points.length; index++) {
    if (index === startIndex && route.points.length > 1) continue;
    const point = route.points[index];
    const reportGap = reportTarget ? distance(point, reportTarget) : distance(point, witness);
    const sourceGap = source ? distance(point, source) : desiredDistance;
    const escapeShortfall = Math.max(0, desiredDistance - sourceGap);
    const score = reportGap + escapeShortfall * 7;
    if (score < bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  }

  return bestIndex >= 0 ? bestIndex : startIndex;
}

function pathScore(path, witness, source, reportTarget) {
  if (!path.length) return Infinity;
  const sourceDistance = source ? distance(witness, source) : 0;
  const firstGain = source ? distance(path[0], source) - sourceDistance : 0;
  const minimumSourceDistance = source
    ? Math.min(...path.map(point => distance(point, source)))
    : sourceDistance;
  const towardDangerPenalty = source
    ? Math.max(0, sourceDistance + 4 - minimumSourceDistance) * 9
    : 0;
  const firstStepPenalty = source ? Math.max(0, 8 - firstGain) * 12 : 0;
  const reportGap = reportTarget ? distance(path[path.length - 1], reportTarget) * 0.25 : 0;
  return pathLength(witness, path) + towardDangerPenalty + firstStepPenalty + reportGap;
}

function routeCandidates(witness, routes) {
  const preferredId = routeIdFor(witness);
  const preferred = routes.find(route => route.id === preferredId && route.points?.length >= 2);
  if (preferred) return [preferred];

  return routes
    .filter(route => route?.points?.length >= 2)
    .map(route => ({
      route,
      entryDistance: distance(route.points[nearestPointIndex(route.points, witness)], witness)
    }))
    .sort((a, b) => a.entryDistance - b.entryDistance)
    .map(entry => entry.route);
}

export function buildWitnessReportPlan(
  witness,
  source,
  reportTarget,
  routes = pedestrianRoutes
) {
  if (!witness || !Array.isArray(routes) || !routes.length) return null;

  for (const route of routeCandidates(witness, routes)) {
    const startIndex = nearestPointIndex(route.points, witness);
    const entryDistance = distance(route.points[startIndex], witness);
    if (!routeIdFor(witness) && entryDistance > MAX_ROUTE_ENTRY_DISTANCE) continue;

    const destinationIndex = destinationIndexFor(
      route,
      witness,
      source,
      reportTarget,
      startIndex
    );
    const forward = cyclicPath(route.points, startIndex, destinationIndex, 1);
    const backward = cyclicPath(route.points, startIndex, destinationIndex, -1);
    const candidates = [
      { direction: 1, waypoints: forward, score: pathScore(forward, witness, source, reportTarget) },
      { direction: -1, waypoints: backward, score: pathScore(backward, witness, source, reportTarget) }
    ].sort((a, b) => a.score - b.score || b.direction - a.direction);

    const primary = candidates[0];
    const alternate = candidates[1];
    if (!primary?.waypoints?.length) continue;
    const destination = primary.waypoints[primary.waypoints.length - 1];

    return {
      routeId: route.id,
      direction: primary.direction,
      waypoints: primary.waypoints.map(point => ({ ...point })),
      alternateWaypoints: alternate?.waypoints?.map(point => ({ ...point })) || [],
      destination: { ...destination },
      entryDistance,
      expectedEscapeGain: source
        ? distance(destination, source) - distance(witness, source)
        : 0
    };
  }

  return null;
}

export class WitnessReactionPolicy {
  constructor(scene) {
    if (!scene?.witnessSystem) {
      throw new TypeError("WitnessReactionPolicy requires a scene with WitnessSystem.");
    }
    this.scene = scene;
    this.witnessSystem = scene.witnessSystem;
    this.original = {};
    this.wrapped = {};
    this.destroyed = false;
    this.install();
  }

  install() {
    const policy = this;
    const system = this.witnessSystem;
    this.original.alarmWitness = system.alarmWitness;
    this.original.updateAlarmedWitnesses = system.updateAlarmedWitnesses;
    this.original.drawMarkers = system.drawMarkers;
    this.original.summary = system.summary;

    this.wrapped.alarmWitness = function stableAlarmWitness(witness, reason, severity, options) {
      const alarmed = policy.original.alarmWitness.call(this, witness, reason, severity, options);
      if (alarmed && policy.isReportingNpc(witness)) policy.prepare(witness);
      return alarmed;
    };
    this.wrapped.updateAlarmedWitnesses = function stableAlarmedWitnessUpdate(dt) {
      return policy.update(dt);
    };
    this.wrapped.drawMarkers = function stableWitnessMarkers(graphics) {
      return policy.drawMarkers(this, graphics);
    };
    this.wrapped.summary = function stableWitnessSummary() {
      const base = policy.original.summary.call(this);
      const snapshot = policy.snapshot();
      return `${base} · shocked ${snapshot.shocked} · reporting ${snapshot.reporting}`;
    };

    system.alarmWitness = this.wrapped.alarmWitness;
    system.updateAlarmedWitnesses = this.wrapped.updateAlarmedWitnesses;
    system.drawMarkers = this.wrapped.drawMarkers;
    system.summary = this.wrapped.summary;
  }

  isReportingNpc(witness) {
    return Boolean(
      witness
      && !witness.trafficWitness
      && REPORTING_TYPES.has(witness.type)
    );
  }

  prepare(witness) {
    if (!this.isReportingNpc(witness)) return null;
    if (witness.reportNavigation && !witness.reportNavigation.complete) {
      if (witness.reactionTimer > 0) {
        witness.reactionTimer = Math.min(witness.reactionTimer, SHOCK_MAX_SECONDS);
      }
      return witness.reportNavigation;
    }

    const source = witness.witnessSource || this.scene.player || witness;
    const reportTarget = witness.reportTarget || { x: witness.x, y: witness.y, name: "a reporting point" };
    const routePlan = buildWitnessReportPlan(witness, source, reportTarget);
    const fallback = routePlan || this.fallbackPlan(witness, source, reportTarget);
    const waypoints = fallback?.waypoints?.map(point => ({ ...point })) || [];

    witness.reportNavigation = {
      routeId: fallback?.routeId || null,
      direction: fallback?.direction || 0,
      waypoints,
      alternateWaypoints: fallback?.alternateWaypoints?.map(point => ({ ...point })) || [],
      pointIndex: 0,
      phase: witness.reactionTimer > 0 ? "shock" : "ready",
      blockedSeconds: 0,
      alternateUsed: false,
      remoteReport: false,
      complete: false
    };
    if (witness.reactionTimer > 0) {
      witness.reactionTimer = Math.min(witness.reactionTimer, SHOCK_MAX_SECONDS);
    }
    return witness.reportNavigation;
  }

  fallbackPlan(witness, source, reportTarget) {
    const candidates = [];
    const stableNode = this.scene.npcSystem?.bestVisibleNavNode?.(
      witness,
      reportTarget.x,
      reportTarget.y
    );
    if (stableNode) candidates.push({ ...stableNode });

    const awayX = finite(witness.x) - finite(source?.x, witness.x);
    const awayY = finite(witness.y) - finite(source?.y, witness.y);
    const awayLength = Math.hypot(awayX, awayY) || 1;
    const baseAngle = Math.atan2(awayY / awayLength, awayX / awayLength);
    for (const radius of [72, 56, 40]) {
      for (const offset of [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2]) {
        const point = {
          x: witness.x + Math.cos(baseAngle + offset) * radius,
          y: witness.y + Math.sin(baseAngle + offset) * radius
        };
        if (this.canStandAt(witness, point.x, point.y)) candidates.push(point);
      }
    }

    const destination = candidates
      .map(point => ({
        point,
        score: distance(point, source) * -2 + distance(point, reportTarget) * 0.15
      }))
      .sort((a, b) => a.score - b.score)[0]?.point;
    if (!destination) return null;
    return {
      routeId: null,
      direction: 0,
      waypoints: [{ ...destination }],
      alternateWaypoints: [],
      destination: { ...destination }
    };
  }

  update(dt) {
    if (this.destroyed) return;
    const seconds = Math.min(0.05, Math.max(0, finite(dt)));
    for (const witness of this.witnessSystem.alarmedWitnesses()) {
      const state = witness.ai?.state;
      if ([AI_STATES.DOWNED, AI_STATES.DEAD, AI_STATES.INACTIVE].includes(state)) {
        this.witnessSystem.cancelReportIntent?.(witness);
        witness.reportNavigation = null;
        continue;
      }
      if ([AI_STATES.STAGGERED, AI_STATES.DRAINING].includes(state)
        || (Number.isFinite(witness.stunnedTimer) && witness.stunnedTimer > 0)) {
        this.stop(witness);
        witness.container?.setPosition?.(witness.x, witness.y);
        continue;
      }

      const navigation = this.prepare(witness);
      if (witness.ai) {
        witness.ai.role = "report";
        witness.ai.intent = witness.reactionTimer > 0 ? "react" : "report";
      }

      if (witness.reactionTimer > 0) {
        const wasReacting = witness.reactionTimer;
        witness.reactionTimer = Math.max(0, witness.reactionTimer - seconds);
        const source = witness.witnessSource || this.scene.player || witness;
        this.facePoint(witness, source.x, source.y);
        this.stop(witness);
        navigation.phase = "shock";
        witness.container?.setPosition?.(witness.x, witness.y);
        if (wasReacting > 0 && witness.reactionTimer <= 0) this.startFlight(witness, navigation);
        continue;
      }

      if (navigation.phase !== "flee") this.startFlight(witness, navigation);
      const speed = witness.masqueradeRisk
        ? Math.max(42, (witness.speed || 14) * 2.75)
        : Math.max(36, (witness.speed || 14) * 2.35);
      const result = this.advance(witness, navigation, seconds, speed);
      witness.container?.setPosition?.(witness.x, witness.y);

      if (result.complete) {
        navigation.complete = true;
        this.witnessSystem.reportWitness(witness);
        continue;
      }

      if (result.moved) {
        navigation.blockedSeconds = 0;
        continue;
      }

      navigation.blockedSeconds += seconds;
      if (!navigation.alternateUsed
        && navigation.alternateWaypoints.length
        && navigation.blockedSeconds >= BLOCKED_REPLAN_SECONDS) {
        navigation.waypoints = navigation.alternateWaypoints.map(point => ({ ...point }));
        navigation.pointIndex = 0;
        navigation.alternateUsed = true;
        navigation.blockedSeconds = 0;
        continue;
      }

      if (navigation.blockedSeconds >= BLOCKED_REMOTE_REPORT_SECONDS) {
        navigation.remoteReport = true;
        navigation.complete = true;
        const authority = witness.reportTarget || {};
        witness.reportTarget = {
          ...authority,
          name: "a safe corner and calls emergency services"
        };
        this.scene.lastActionText = "A blocked witness gets clear enough to call the incident in.";
        this.witnessSystem.reportWitness(witness);
      }
    }
  }

  startFlight(witness, navigation) {
    navigation.phase = "flee";
    navigation.blockedSeconds = 0;
    if (witness.ai) witness.ai.intent = "report";
    RawAudio.play("witnessRun", { cooldown: 0.22 });
    this.scene.events?.emit?.("witness:fleeing", {
      witnessId: witness.id,
      masqueradeRisk: Boolean(witness.masqueradeRisk),
      routeId: navigation.routeId
    });
    this.scene.lastActionText = witness.masqueradeRisk
      ? "A terrified witness bolts along the pavement to report the vampire."
      : "A frightened witness bolts along the pavement to report what they saw.";
  }

  advance(witness, navigation, dt, speed) {
    while (navigation.pointIndex < navigation.waypoints.length) {
      const target = navigation.waypoints[navigation.pointIndex];
      const remaining = distance(witness, target);
      if (remaining > ARRIVAL_RADIUS) break;
      if (this.canStandAt(witness, target.x, target.y)) {
        witness.x = target.x;
        witness.y = target.y;
      }
      navigation.pointIndex++;
    }

    if (navigation.pointIndex >= navigation.waypoints.length) {
      this.stop(witness);
      return { moved: false, complete: true };
    }

    const target = navigation.waypoints[navigation.pointIndex];
    const dx = target.x - witness.x;
    const dy = target.y - witness.y;
    const length = Math.hypot(dx, dy) || 1;
    const step = Math.min(length, Math.max(0, speed * dt));
    const dirX = dx / length;
    const dirY = dy / length;
    const diagonal = { x: witness.x + dirX * step, y: witness.y + dirY * step };
    const xOnly = { x: witness.x + dirX * step, y: witness.y };
    const yOnly = { x: witness.x, y: witness.y + dirY * step };
    const next = [diagonal, xOnly, yOnly].find(point => this.canStandAt(witness, point.x, point.y));

    witness.dirX = dirX;
    witness.dirY = dirY;
    if (!next || step <= 0) {
      this.stop(witness);
      return { moved: false, complete: false };
    }

    const moveX = next.x - witness.x;
    const moveY = next.y - witness.y;
    const moveLength = Math.hypot(moveX, moveY) || 1;
    witness.dirX = moveX / moveLength;
    witness.dirY = moveY / moveLength;
    witness.vx = witness.dirX * speed;
    witness.vy = witness.dirY * speed;
    witness.x = next.x;
    witness.y = next.y;
    return { moved: true, complete: false };
  }

  canStandAt(witness, x, y) {
    if (this.scene.npcSystem?.canNpcStandAt) {
      return Boolean(this.scene.npcSystem.canNpcStandAt(witness, x, y));
    }
    if (witness.layer === LAYERS.STREET) return pointOnPedestrianSurface(x, y);
    return true;
  }

  stop(witness) {
    witness.vx = 0;
    witness.vy = 0;
  }

  facePoint(witness, x, y) {
    const dx = finite(x, witness.x) - witness.x;
    const dy = finite(y, witness.y) - witness.y;
    const length = Math.hypot(dx, dy) || 1;
    witness.dirX = dx / length;
    witness.dirY = dy / length;
  }

  currentWaypoint(witness) {
    const navigation = witness?.reportNavigation;
    return navigation?.waypoints?.[navigation.pointIndex] || null;
  }

  drawMarkers(context, graphics) {
    const witnesses = this.witnessSystem.alarmedWitnesses();
    const originalTargets = new Map();
    for (const witness of witnesses) {
      const waypoint = this.currentWaypoint(witness);
      if (!waypoint || witness.reactionTimer > 0) continue;
      originalTargets.set(witness, witness.reportTarget);
      witness.reportTarget = {
        ...(witness.reportTarget || {}),
        x: waypoint.x,
        y: waypoint.y
      };
    }

    const originalAddMapLabel = this.scene.addMapLabel;
    if (typeof originalAddMapLabel === "function") {
      this.scene.addMapLabel = function witnessReactionLabel(label, x, y, color) {
        const clearer = label === "WTF"
          ? "! SHOCKED"
          : ["! VEIL", "! WITNESS"].includes(label)
            ? "RUN → REPORT"
            : label;
        return originalAddMapLabel.call(this, clearer, x, y, color);
      };
    }

    try {
      this.original.drawMarkers.call(context, graphics);
    } finally {
      if (originalAddMapLabel) this.scene.addMapLabel = originalAddMapLabel;
      for (const [witness, target] of originalTargets) witness.reportTarget = target;
    }

    for (const witness of witnesses) {
      const navigation = witness.reportNavigation;
      if (!navigation || navigation.phase !== "flee" || witness.layer !== this.scene.currentLayer) continue;
      const points = navigation.waypoints.slice(
        navigation.pointIndex,
        navigation.pointIndex + ROUTE_PREVIEW_POINTS
      );
      if (!points.length) continue;
      const color = witness.masqueradeRisk ? 0xff3b50 : 0xffb02e;
      graphics.lineStyle?.(2, color, 0.42);
      graphics.beginPath?.();
      graphics.moveTo?.(witness.x, witness.y);
      for (const point of points) graphics.lineTo?.(point.x, point.y);
      graphics.strokePath?.();
    }
  }

  snapshot() {
    const active = this.witnessSystem.alarmedWitnesses();
    return {
      shocked: active.filter(witness => witness.reactionTimer > 0).length,
      reporting: active.filter(witness => witness.reactionTimer <= 0).length,
      routed: active.filter(witness => Boolean(witness.reportNavigation?.routeId)).length,
      remoteFallbacks: active.filter(witness => Boolean(witness.reportNavigation?.remoteReport)).length
    };
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    const system = this.witnessSystem;
    if (system.alarmWitness === this.wrapped.alarmWitness) system.alarmWitness = this.original.alarmWitness;
    if (system.updateAlarmedWitnesses === this.wrapped.updateAlarmedWitnesses) {
      system.updateAlarmedWitnesses = this.original.updateAlarmedWitnesses;
    }
    if (system.drawMarkers === this.wrapped.drawMarkers) system.drawMarkers = this.original.drawMarkers;
    if (system.summary === this.wrapped.summary) system.summary = this.original.summary;
  }
}
