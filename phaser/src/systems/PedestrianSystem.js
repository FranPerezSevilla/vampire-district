import { LAYERS, pedestrianRoutes, pointOnPedestrianSurface } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";

const ARRIVAL_RADIUS = 4;
const CROSSWALK_PAUSE_MIN = 0.22;
const CROSSWALK_PAUSE_MAX = 0.62;

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

export class PedestrianSystem {
  constructor(scene) {
    if (!scene?.npcSystem) throw new TypeError("PedestrianSystem requires a scene with NpcSystem.");
    this.scene = scene;
    this.pedestrians = [];
    this.bindPedestrians();
    this.publish();
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

  canMove(npc) {
    return Boolean(
      npc
      && !npc.dead
      && !npc.inactive
      && !npc.hiddenBody
      && !npc.intercepted
      && !npc.alarmed
      && !npc.chasingPlayer
      && !npc.enemyAttack
      && !npc.dragged
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

      npc.dirX = dx / length;
      npc.dirY = dy / length;
      npc.vx = npc.dirX * speed;
      npc.vy = npc.dirY * speed;
      npc.x = nextX;
      npc.y = nextY;
      npc.container?.setPosition?.(npc.x, npc.y);
    }

    this.scene.npcSystem.rebuildSpatialIndex?.();
    this.publish();
  }

  snapshot() {
    return {
      count: this.pedestrians.filter(npc => !npc.dead && !npc.inactive).length,
      total: this.pedestrians.length,
      routes: pedestrianRoutes.map(route => ({ id: route.id, points: route.points.length })),
      pedestrians: this.pedestrians.map(npc => ({
        id: npc.id,
        routeId: npc.pedestrian?.routeId || null,
        pointIndex: npc.pedestrian?.pointIndex || 0,
        x: npc.x,
        y: npc.y,
        onPedestrianSurface: pointOnPedestrianSurface(npc.x, npc.y)
      }))
    };
  }

  publish() {
    const snapshot = this.snapshot();
    this.scene.statePublisher?.setMany?.({
      pedestrianText: `Pedestrians ${snapshot.count} · sidewalk routed`,
      pedestrianState: snapshot
    });
    if (typeof window !== "undefined") {
      window.NBD_PEDESTRIANS = Object.freeze({ snapshot: () => this.snapshot() });
      window.NBD_PEDESTRIANS_READY = true;
    }
    return snapshot;
  }

  destroy() {
    this.pedestrians = [];
    if (typeof window !== "undefined") {
      if (window.NBD_PEDESTRIANS) delete window.NBD_PEDESTRIANS;
      window.NBD_PEDESTRIANS_READY = false;
    }
  }
}
