import { LAYERS, pedestrianRoutes, pointOnPedestrianSurface } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";

const ARRIVAL_RADIUS = 4;
const CROSSWALK_PAUSE_MIN = 0.22;
const CROSSWALK_PAUSE_MAX = 0.62;
const CROWD_EPSILON = 0.001;
const CROWD_RESOLVE_ITERATIONS = 3;
const CROWD_YIELD_SECONDS = 0.12;

export const PEDESTRIAN_MIN_SEPARATION = 16;
export const PEDESTRIAN_PLAYER_SEPARATION = 13;

function distance(a, b) {
  return Math.hypot((Number(a?.x) || 0) - (Number(b?.x) || 0), (Number(a?.y) || 0) - (Number(b?.y) || 0));
}

function routeById(id) {
  return pedestrianRoutes.find(route => route.id === id) || null;
}

function nearestPointIndex(route, npc) {
  let best = 0;
  let bestDistance = Infinity;
  route.points.forEach((point, index) => {
    const value = distance(point, npc);
    if (value < bestDistance) {
      best = index;
      bestDistance = value;
    }
  });
  return best;
}

function hashText(value) {
  let hash = 2166136261;
  for (const char of String(value || "pedestrian")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function exactOverlapDirection(first, second) {
  const firstId = String(first?.id || "first");
  const secondId = String(second?.id || "second");
  const ordered = firstId.localeCompare(secondId) <= 0;
  const key = ordered ? `${firstId}|${secondId}` : `${secondId}|${firstId}`;
  const angle = (hashText(key) % 3600) / 3600 * Math.PI * 2;
  const direction = { x: Math.cos(angle), y: Math.sin(angle) };
  return ordered ? direction : { x: -direction.x, y: -direction.y };
}

export function pedestrianSeparationPlan(first, second, minimum = PEDESTRIAN_MIN_SEPARATION) {
  if (!first || !second) return null;
  const required = Math.max(0, Number(minimum) || 0);
  const dx = (Number(first.x) || 0) - (Number(second.x) || 0);
  const dy = (Number(first.y) || 0) - (Number(second.y) || 0);
  const current = Math.hypot(dx, dy);
  if (current >= required) return null;

  const direction = current > CROWD_EPSILON
    ? { x: dx / current, y: dy / current }
    : exactOverlapDirection(first, second);
  const overlap = required - current + 0.05;
  return {
    current,
    overlap,
    first: { x: direction.x * overlap * 0.5, y: direction.y * overlap * 0.5 },
    second: { x: -direction.x * overlap * 0.5, y: -direction.y * overlap * 0.5 }
  };
}

export function minimumPedestrianSeparation(pedestrians = []) {
  let minimum = Infinity;
  for (let first = 0; first < pedestrians.length; first++) {
    for (let second = first + 1; second < pedestrians.length; second++) {
      minimum = Math.min(minimum, distance(pedestrians[first], pedestrians[second]));
    }
  }
  return Number.isFinite(minimum) ? minimum : null;
}

export function isActiveFeedingVictim(scene, npc) {
  return Boolean(
    npc
    && (npc.drainVictim || scene?.feedingSystem?.active?.npc === npc)
  );
}

export class PedestrianSystem {
  constructor(scene) {
    if (!scene?.npcSystem) throw new TypeError("PedestrianSystem requires a scene with NpcSystem.");
    this.scene = scene;
    this.pedestrians = [];
    this.lastCrowdResolution = {
      participants: 0,
      resolvedPairs: 0,
      remainingOverlaps: 0,
      minimumSeparation: null
    };
    this.bindPedestrians();
    this.resolveCrowdCollisions({ iterations: 5, includePlayer: false });
    this.publish();
    this.postUpdateEvent = Phaser.Scenes.Events.POST_UPDATE || "postupdate";
    this.postUpdateHandler = () => {
      const result = this.resolveCrowdCollisions({ iterations: 2, includePlayer: true });
      if (result.resolvedPairs > 0 || result.remainingOverlaps > 0) this.publish();
    };
    scene.events?.on?.(this.postUpdateEvent, this.postUpdateHandler);
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  bindPedestrians() {
    for (const npc of this.scene.npcSystem.npcs) {
      if (npc.type !== NPC_TYPES.CIVILIAN || !npc.pedestrianRouteId) continue;
      const route = routeById(npc.pedestrianRouteId);
      if (!route?.points?.length) continue;
      npc.behavior = "guard";
      npc.pedestrian = {
        routeId: route.id,
        pointIndex: nearestPointIndex(route, npc),
        wait: 0,
        completedSegments: 0
      };
      this.pedestrians.push(npc);
    }
  }

  isCrowdParticipant(npc, { simulatedOnly = true } = {}) {
    if (!npc
      || npc.type === NPC_TYPES.RAT
      || npc.layer !== LAYERS.STREET
      || npc.dead
      || npc.inactive
      || npc.hiddenBody
      || npc.dragged
      || npc.whisperPassengerBoarded) {
      return false;
    }
    if (simulatedOnly && this.scene.entityStreamSystem
      && !this.scene.entityStreamSystem.shouldSimulateNpc?.(npc)) {
      return false;
    }
    return true;
  }

  crowdParticipants(options = {}) {
    return this.scene.npcSystem.npcs.filter(npc => this.isCrowdParticipant(npc, options));
  }

  isCrowdLocked(npc) {
    return Boolean(
      !npc
      || npc.dead
      || npc.dragged
      || npc.whisperPassengerBoarded
      || isActiveFeedingVictim(this.scene, npc)
    );
  }

  canOccupy(npc, x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (this.scene.npcSystem.canNpcStandAt
      && !this.scene.npcSystem.canNpcStandAt(npc, x, y)) {
      return false;
    }
    if ((npc.pedestrianRouteId || npc.pedestrian)
      && !pointOnPedestrianSurface(x, y)) {
      return false;
    }
    return true;
  }

  routeTangent(npc) {
    const state = npc?.pedestrian;
    const route = state ? routeById(state.routeId) : null;
    if (!route?.points?.length) return null;
    const targetIndex = state.pointIndex % route.points.length;
    const previousIndex = (targetIndex - 1 + route.points.length) % route.points.length;
    const target = route.points[targetIndex];
    const previous = route.points[previousIndex];
    const dx = target.x - previous.x;
    const dy = target.y - previous.y;
    const length = Math.hypot(dx, dy);
    return length > CROWD_EPSILON ? { x: dx / length, y: dy / length } : null;
  }

  displacementAttempts(npc, delta) {
    const tangent = this.routeTangent(npc);
    const magnitude = Math.hypot(delta.x, delta.y);
    const attempts = [
      { x: delta.x, y: delta.y },
      { x: delta.x, y: 0 },
      { x: 0, y: delta.y }
    ];
    if (tangent && magnitude > CROWD_EPSILON) {
      const alignment = tangent.x * delta.x + tangent.y * delta.y;
      const sign = alignment >= 0 ? 1 : -1;
      attempts.push(
        { x: tangent.x * magnitude * sign, y: tangent.y * magnitude * sign },
        { x: -tangent.x * magnitude * sign, y: -tangent.y * magnitude * sign }
      );
    }
    return attempts;
  }

  applyDisplacement(npc, delta) {
    if (this.isCrowdLocked(npc)) return false;
    for (const attempt of this.displacementAttempts(npc, delta)) {
      for (const scale of [1, 0.75, 0.5, 0.25]) {
        const x = npc.x + attempt.x * scale;
        const y = npc.y + attempt.y * scale;
        if (!this.canOccupy(npc, x, y)) continue;
        npc.x = x;
        npc.y = y;
        npc.vx = 0;
        npc.vy = 0;
        if (npc.pedestrian) npc.pedestrian.wait = Math.max(npc.pedestrian.wait || 0, CROWD_YIELD_SECONDS);
        npc.container?.setPosition?.(npc.x, npc.y);
        return true;
      }
    }
    return false;
  }

  resolvePair(first, second) {
    const plan = pedestrianSeparationPlan(first, second);
    if (!plan) return false;

    const firstLocked = this.isCrowdLocked(first);
    const secondLocked = this.isCrowdLocked(second);
    if (firstLocked && secondLocked) return false;

    let moved = false;
    if (!firstLocked && !secondLocked) {
      const movedFirst = this.applyDisplacement(first, plan.first);
      const movedSecond = this.applyDisplacement(second, plan.second);
      moved = movedFirst || movedSecond;
      if (movedFirst !== movedSecond) {
        const movable = movedFirst ? first : second;
        const delta = movedFirst ? plan.first : plan.second;
        moved = this.applyDisplacement(movable, delta) || moved;
      }
      return moved;
    }

    const movable = firstLocked ? second : first;
    const half = firstLocked ? plan.second : plan.first;
    return this.applyDisplacement(movable, { x: half.x * 2, y: half.y * 2 });
  }

  resolvePlayerCollision(npc) {
    const player = this.scene.player;
    if (!player || this.scene.currentLayer !== LAYERS.STREET || this.isCrowdLocked(npc)) return false;
    const plan = pedestrianSeparationPlan(npc, player, PEDESTRIAN_PLAYER_SEPARATION);
    if (!plan) return false;
    return this.applyDisplacement(npc, { x: plan.first.x * 2, y: plan.first.y * 2 });
  }

  overlapCount(participants, minimum = PEDESTRIAN_MIN_SEPARATION) {
    let overlaps = 0;
    for (let first = 0; first < participants.length; first++) {
      for (let second = first + 1; second < participants.length; second++) {
        if (distance(participants[first], participants[second]) < minimum - 0.25) overlaps++;
      }
    }
    return overlaps;
  }

  resolveCrowdCollisions({
    iterations = CROWD_RESOLVE_ITERATIONS,
    includePlayer = true,
    simulatedOnly = true
  } = {}) {
    const participants = this.crowdParticipants({ simulatedOnly });
    let resolvedPairs = 0;
    let changed = false;

    for (let iteration = 0; iteration < Math.max(1, Math.floor(iterations)); iteration++) {
      let changedThisPass = false;
      for (let first = 0; first < participants.length; first++) {
        for (let second = first + 1; second < participants.length; second++) {
          if (this.resolvePair(participants[first], participants[second])) {
            resolvedPairs++;
            changedThisPass = true;
          }
        }
      }
      if (includePlayer) {
        for (const npc of participants) {
          if (this.resolvePlayerCollision(npc)) changedThisPass = true;
        }
      }
      changed = changed || changedThisPass;
      if (!changedThisPass) break;
    }

    if (changed) this.scene.npcSystem.rebuildSpatialIndex?.();
    this.lastCrowdResolution = {
      participants: participants.length,
      resolvedPairs,
      remainingOverlaps: this.overlapCount(participants),
      minimumSeparation: minimumPedestrianSeparation(participants)
    };
    return this.lastCrowdResolution;
  }

  hasCrowdClearance(npc, x, y, minimum = PEDESTRIAN_MIN_SEPARATION - 1) {
    for (const other of this.crowdParticipants()) {
      if (other === npc) continue;
      if (Math.hypot(other.x - x, other.y - y) < minimum) return false;
    }
    const player = this.scene.player;
    if (player && this.scene.currentLayer === LAYERS.STREET
      && Math.hypot(player.x - x, player.y - y) < PEDESTRIAN_PLAYER_SEPARATION) {
      return false;
    }
    return true;
  }

  canMove(npc) {
    return Boolean(
      npc
      && (this.scene.entityStreamSystem?.shouldSimulateNpc?.(npc) ?? true)
      && !npc.dead
      && !npc.inactive
      && !npc.hiddenBody
      && !npc.intercepted
      && !npc.alarmed
      && !npc.chasingPlayer
      && !npc.enemyAttack
      && !npc.dragged
      && !isActiveFeedingVictim(this.scene, npc)
      && npc.stunnedTimer <= 0
      && npc.layer === LAYERS.STREET
      && !this.scene.registry?.get?.("uiPaused")
      && !this.scene.registry?.get?.("taskRevealActive")
      && !this.scene.transitionSystem?.active
    );
  }

  update(dt) {
    const seconds = Math.min(0.05, Math.max(0, Number(dt) || 0));
    if (!seconds) return;

    for (const npc of this.pedestrians) {
      if (isActiveFeedingVictim(this.scene, npc)) {
        npc.vx = 0;
        npc.vy = 0;
        npc.container?.setPosition?.(npc.x, npc.y);
        continue;
      }
      if (!this.canMove(npc)) continue;
      const state = npc.pedestrian;
      const route = routeById(state.routeId);
      if (!route) continue;

      if (state.wait > 0) {
        state.wait = Math.max(0, state.wait - seconds);
        npc.vx = 0;
        npc.vy = 0;
        continue;
      }

      const target = route.points[state.pointIndex] || route.points[0];
      const dx = target.x - npc.x;
      const dy = target.y - npc.y;
      const length = Math.hypot(dx, dy);

      if (length <= ARRIVAL_RADIUS) {
        npc.x = target.x;
        npc.y = target.y;
        state.pointIndex = (state.pointIndex + 1) % route.points.length;
        state.completedSegments++;
        if (target.crosswalk) {
          state.wait = CROSSWALK_PAUSE_MIN
            + Math.random() * (CROSSWALK_PAUSE_MAX - CROSSWALK_PAUSE_MIN);
        }
        continue;
      }

      const speed = Math.max(4, Number(npc.speed) || 9);
      const step = Math.min(length, speed * seconds);
      const nextX = npc.x + dx / length * step;
      const nextY = npc.y + dy / length * step;

      if (!pointOnPedestrianSurface(nextX, nextY)) {
        npc.x = target.x;
        npc.y = target.y;
        state.pointIndex = (state.pointIndex + 1) % route.points.length;
        state.wait = 0.25;
        continue;
      }

      if (!this.hasCrowdClearance(npc, nextX, nextY)) {
        npc.vx = 0;
        npc.vy = 0;
        state.wait = CROWD_YIELD_SECONDS + (hashText(npc.id) % 4) * 0.025;
        continue;
      }

      npc.dirX = dx / length;
      npc.dirY = dy / length;
      npc.vx = npc.dirX * speed;
      npc.vy = npc.dirY * speed;
      npc.x = nextX;
      npc.y = nextY;
      npc.container?.setPosition?.(npc.x, npc.y);
    }

    this.resolveCrowdCollisions({ iterations: 1, includePlayer: true });
    this.scene.npcSystem.rebuildSpatialIndex?.();
    this.publish();
  }

  snapshot() {
    const participants = this.crowdParticipants();
    return {
      count: this.pedestrians.filter(npc => !npc.dead && !npc.inactive).length,
      simulated: this.pedestrians.filter(npc => this.scene.entityStreamSystem?.shouldSimulateNpc?.(npc) ?? true).length,
      dormant: this.pedestrians.filter(npc => !(this.scene.entityStreamSystem?.shouldSimulateNpc?.(npc) ?? true)).length,
      total: this.pedestrians.length,
      crowd: {
        participants: participants.length,
        minimumSeparation: minimumPedestrianSeparation(participants),
        overlaps: this.overlapCount(participants),
        resolvedPairs: this.lastCrowdResolution.resolvedPairs
      },
      routes: pedestrianRoutes.map(route => ({ id: route.id, points: route.points.length })),
      pedestrians: this.pedestrians.map(npc => ({
        id: npc.id,
        routeId: npc.pedestrian?.routeId || null,
        pointIndex: npc.pedestrian?.pointIndex || 0,
        x: npc.x,
        y: npc.y,
        streamState: npc.streamState || "active",
        onPedestrianSurface: pointOnPedestrianSurface(npc.x, npc.y)
      }))
    };
  }

  publish() {
    const snapshot = this.snapshot();
    this.scene.statePublisher?.setMany?.({
      pedestrianText: `Pedestrians ${snapshot.simulated}/${snapshot.count} simulated · ${snapshot.dormant} dormant · overlaps ${snapshot.crowd.overlaps}`,
      pedestrianState: snapshot
    });
    if (typeof window !== "undefined") {
      window.NBD_PEDESTRIANS = Object.freeze({ snapshot: () => this.snapshot() });
      window.NBD_PEDESTRIANS_READY = true;
    }
    return snapshot;
  }

  destroy() {
    this.scene.events?.off?.(this.postUpdateEvent, this.postUpdateHandler);
    this.pedestrians = [];
    if (typeof window !== "undefined") {
      if (window.NBD_PEDESTRIANS) delete window.NBD_PEDESTRIANS;
      window.NBD_PEDESTRIANS_READY = false;
    }
  }
}
