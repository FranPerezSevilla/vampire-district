import { NPC_TYPES } from "../data/npcs.js";
import { ENTITY_STREAM_STATES } from "./EntityStreamPolicy.js";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function hashText(value) {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pointInBounds(x, y, bounds) {
  return Boolean(bounds
    && x >= bounds.x
    && x < bounds.x + bounds.w
    && y >= bounds.y
    && y < bounds.y + bounds.h);
}

function distanceSquared(x, y, point) {
  const dx = finite(point?.x) - finite(x);
  const dy = finite(point?.y) - finite(y);
  return dx * dx + dy * dy;
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(finite(value) * factor) / factor;
}

export const DEFAULT_MACRO_GRAPH_URL = new URL(
  "../../assets/city/packs/macro-graph.json",
  import.meta.url
).toString();

export class MacroTrafficPoliceSystem {
  constructor(scene, {
    graphUrl = DEFAULT_MACRO_GRAPH_URL,
    fetchImpl = globalThis.fetch?.bind?.(globalThis),
    intervalSeconds = 2,
    policeBudget = 4,
    maxCatchUpTicks = 2
  } = {}) {
    if (!scene?.cityStreamSystem || !scene?.entityStreamSystem || !scene?.npcSystem) {
      throw new TypeError("MacroTrafficPoliceSystem requires city, entity and NPC systems.");
    }
    if (typeof fetchImpl !== "function") throw new TypeError("MacroTrafficPoliceSystem requires fetch().");
    this.scene = scene;
    this.graphUrl = new URL(String(graphUrl), globalThis.document?.baseURI || import.meta.url).toString();
    this.fetchImpl = fetchImpl;
    this.intervalSeconds = Math.max(0.5, finite(intervalSeconds, 2));
    this.policeBudget = Math.max(1, Math.floor(finite(policeBudget, 4)));
    this.maxCatchUpTicks = Math.max(1, Math.floor(finite(maxCatchUpTicks, 2)));
    this.graph = null;
    this.trafficFlows = new Map();
    this.policeTravel = new Map();
    this.accumulator = 0;
    this.tick = 0;
    this.policeCursor = 0;
    this.completedTrafficTrips = 0;
    this.completedPoliceLegs = 0;
    this.lastAdvancedPoliceIds = [];
    this.lastSkippedPolice = 0;
    this.districtTrafficLoad = {};
    this.destroyed = false;
    this.initializationError = null;
    this.installBrowserApi();
    this.initialization = this.loadGraph().then(() => {
      this.initializeTrafficFlows();
      this.publish();
      return this;
    }).catch(error => {
      this.initializationError = error;
      this.publish();
      throw error;
    });
    scene.events?.once?.(globalThis.Phaser?.Scenes?.Events?.SHUTDOWN || "shutdown", this.destroy, this);
  }

  async loadGraph() {
    const response = await this.fetchImpl(this.graphUrl, { cache: "no-store" });
    if (!response?.ok) throw new Error(`HTTP ${response?.status || 0} while loading ${this.graphUrl}`);
    const graph = await response.json();
    if (!graph?.nodes || !graph?.edges || !Array.isArray(graph.nodeIds) || !Array.isArray(graph.edgeIds)) {
      throw new TypeError("Macro navigation graph is malformed.");
    }
    this.graph = graph;
    return graph;
  }

  initializeTrafficFlows() {
    this.trafficFlows.clear();
    for (const edgeId of this.graph.edgeIds) {
      const edge = this.graph.edges[edgeId];
      const a = this.graph.nodes[edge.a];
      const b = this.graph.nodes[edge.b];
      const density = (finite(a?.trafficDensity) + finite(b?.trafficDensity)) / 2;
      const tokenCount = Math.max(1, Math.round(density * 4));
      const phases = Array.from({ length: tokenCount }, (_, index) => (
        (hashText(`${edgeId}:${index}`) % 1000) / 1000
      ));
      this.trafficFlows.set(edgeId, {
        edgeId,
        tokenCount,
        phases,
        completedTrips: 0
      });
    }
    this.rebuildTrafficLoad();
  }

  districtAt(x, y) {
    if (!this.graph) return null;
    return this.graph.nodeIds.find(id => pointInBounds(x, y, this.graph.nodes[id].bounds)) || null;
  }

  nearestDistrict(x, y) {
    if (!this.graph) return null;
    return [...this.graph.nodeIds].sort((left, right) => (
      distanceSquared(x, y, this.graph.nodes[left].center)
      - distanceSquared(x, y, this.graph.nodes[right].center)
    ))[0] || null;
  }

  edgeBetween(a, b) {
    if (!this.graph || !a || !b) return null;
    return this.graph.edgeIds
      .map(id => this.graph.edges[id])
      .find(edge => (edge.a === a && edge.b === b) || (edge.a === b && edge.b === a)) || null;
  }

  chooseNextDistrict(currentId, npcId, hop = 0, previousId = null) {
    const neighbours = [...(this.graph?.nodes?.[currentId]?.neighbours || [])];
    if (!neighbours.length) return null;
    const candidates = neighbours.length > 1
      ? neighbours.filter(id => id !== previousId)
      : neighbours;
    const list = candidates.length ? candidates : neighbours;
    const index = (hashText(npcId) + Math.max(0, hop)) % list.length;
    return list[index];
  }

  createPoliceLeg(npc, fromId = null, previousId = null, hop = 0) {
    const currentId = fromId || this.districtAt(npc.x, npc.y) || this.nearestDistrict(npc.x, npc.y);
    const toId = this.chooseNextDistrict(currentId, npc.id, hop, previousId);
    const edge = this.edgeBetween(currentId, toId);
    if (!currentId || !toId || !edge) return null;
    const target = this.graph.nodes[toId].center;
    return {
      npcId: npc.id,
      fromId: currentId,
      toId,
      previousId,
      hop,
      fromX: finite(npc.x),
      fromY: finite(npc.y),
      toX: finite(target.x),
      toY: finite(target.y),
      progress: 0,
      travelSeconds: Math.max(1, finite(edge.travelSeconds, 6) * 1.15)
    };
  }

  eligiblePolice() {
    return (this.scene.npcSystem?.npcs || []).filter(npc => (
      npc?.type === NPC_TYPES.POLICE
      && npc.streamState === ENTITY_STREAM_STATES.DORMANT
      && !npc.dead
      && !npc.inactive
      && !npc.dragged
      && !npc.alarmed
      && !npc.chasingPlayer
      && !npc.enemyAttack
      && !npc.investigateTarget
      && !npc.intercepted
      && finite(npc.stunnedTimer) <= 0
    ));
  }

  cleanupPoliceTravel(eligible) {
    const ids = new Set(eligible.map(npc => npc.id));
    for (const id of this.policeTravel.keys()) {
      if (!ids.has(id)) this.policeTravel.delete(id);
    }
  }

  advancePolice(npc, seconds) {
    let state = this.policeTravel.get(npc.id) || this.createPoliceLeg(npc);
    if (!state) return false;
    let remaining = Math.max(0, finite(seconds));
    let moved = false;
    let guard = 4;

    while (remaining > 0.0001 && guard-- > 0) {
      const remainingProgress = Math.max(0, 1 - state.progress);
      const remainingSeconds = remainingProgress * state.travelSeconds;
      if (remaining + 0.0001 >= remainingSeconds) {
        npc.x = state.toX;
        npc.y = state.toY;
        remaining = Math.max(0, remaining - remainingSeconds);
        this.completedPoliceLegs++;
        const previousId = state.fromId;
        const currentId = state.toId;
        state = this.createPoliceLeg(npc, currentId, previousId, state.hop + 1);
        if (!state) break;
        moved = true;
      } else {
        state.progress = Math.min(1, state.progress + remaining / state.travelSeconds);
        npc.x = state.fromX + (state.toX - state.fromX) * state.progress;
        npc.y = state.fromY + (state.toY - state.fromY) * state.progress;
        remaining = 0;
        moved = true;
      }

      const dx = state ? state.toX - finite(npc.x) : 0;
      const dy = state ? state.toY - finite(npc.y) : 0;
      const length = Math.hypot(dx, dy);
      if (length > 0.001) {
        npc.dirX = dx / length;
        npc.dirY = dy / length;
        npc.vx = npc.dirX * Math.max(4, finite(npc.speed, 18));
        npc.vy = npc.dirY * Math.max(4, finite(npc.speed, 18));
      }

      if (this.scene.cityStreamSystem?.isPointActive?.(npc.x, npc.y)) break;
    }

    if (state) this.policeTravel.set(npc.id, state);
    else this.policeTravel.delete(npc.id);
    return moved;
  }

  advanceTraffic(seconds) {
    if (!this.graph) return 0;
    let completed = 0;
    for (const [edgeId, flow] of this.trafficFlows) {
      const edge = this.graph.edges[edgeId];
      const increment = Math.max(0, finite(seconds)) / Math.max(1, finite(edge.travelSeconds, 6));
      flow.phases = flow.phases.map(phase => {
        const next = finite(phase) + increment;
        const trips = Math.floor(next);
        completed += trips;
        flow.completedTrips += trips;
        return next - trips;
      });
    }
    this.completedTrafficTrips += completed;
    this.rebuildTrafficLoad();
    return completed;
  }

  rebuildTrafficLoad() {
    if (!this.graph) return {};
    const load = Object.fromEntries(this.graph.nodeIds.map(id => [id, 0]));
    for (const [edgeId, flow] of this.trafficFlows) {
      const edge = this.graph.edges[edgeId];
      for (const phase of flow.phases) {
        load[edge.a] += 1 - phase;
        load[edge.b] += phase;
      }
    }
    this.districtTrafficLoad = Object.fromEntries(
      Object.entries(load).map(([id, value]) => [id, round(value, 2)])
    );
    return this.districtTrafficLoad;
  }

  simulateTick(seconds = this.intervalSeconds) {
    if (this.destroyed || !this.graph) return false;
    this.advanceTraffic(seconds);
    const police = this.eligiblePolice();
    this.cleanupPoliceTravel(police);
    const count = Math.min(this.policeBudget, police.length);
    const advanced = [];
    for (let offset = 0; offset < count; offset++) {
      const index = police.length ? (this.policeCursor + offset) % police.length : 0;
      const npc = police[index];
      if (npc && this.advancePolice(npc, seconds)) advanced.push(npc.id);
    }
    if (police.length) this.policeCursor = (this.policeCursor + count) % police.length;
    this.tick++;
    this.lastAdvancedPoliceIds = advanced;
    this.lastSkippedPolice = Math.max(0, police.length - count);
    this.publish();
    return true;
  }

  update(dt = 0) {
    if (this.destroyed || !this.graph || this.scene.registry?.get?.("uiPaused")) return false;
    this.accumulator += Math.max(0, finite(dt));
    let ticks = 0;
    while (this.accumulator >= this.intervalSeconds && ticks < this.maxCatchUpTicks) {
      this.accumulator -= this.intervalSeconds;
      this.simulateTick(this.intervalSeconds);
      ticks++;
    }
    if (ticks >= this.maxCatchUpTicks) this.accumulator = Math.min(this.accumulator, this.intervalSeconds);
    return ticks > 0;
  }

  snapshot() {
    const eligible = this.graph ? this.eligiblePolice() : [];
    return {
      ready: Boolean(this.graph),
      graphId: this.graph?.id || null,
      tick: this.tick,
      intervalSeconds: this.intervalSeconds,
      policeBudget: this.policeBudget,
      accumulator: round(this.accumulator),
      abstractTrafficTokens: [...this.trafficFlows.values()].reduce((sum, flow) => sum + flow.tokenCount, 0),
      completedTrafficTrips: this.completedTrafficTrips,
      completedPoliceLegs: this.completedPoliceLegs,
      eligibleDormantPolice: eligible.length,
      travellingPolice: [...this.policeTravel.values()].map(state => ({
        npcId: state.npcId,
        fromId: state.fromId,
        toId: state.toId,
        progress: round(state.progress)
      })).sort((left, right) => left.npcId.localeCompare(right.npcId)),
      lastAdvancedPoliceIds: [...this.lastAdvancedPoliceIds],
      lastSkippedPolice: this.lastSkippedPolice,
      districtTrafficLoad: { ...this.districtTrafficLoad },
      flows: [...this.trafficFlows.values()].map(flow => ({
        edgeId: flow.edgeId,
        tokenCount: flow.tokenCount,
        phases: flow.phases.map(value => round(value)),
        completedTrips: flow.completedTrips
      }))
    };
  }

  publish() {
    const snapshot = this.snapshot();
    this.scene.statePublisher?.setMany?.({
      macroTrafficPoliceText: `Macro city · traffic ${snapshot.abstractTrafficTokens} · police ${snapshot.eligibleDormantPolice}`,
      macroTrafficPoliceState: snapshot
    });
    if (typeof window !== "undefined") window.NBD_MACRO_CITY_READY = snapshot.ready;
    return snapshot;
  }

  installBrowserApi() {
    if (typeof window === "undefined") return;
    window.NBD_MACRO_CITY = Object.freeze({
      snapshot: () => this.snapshot(),
      forceTick: (seconds = this.intervalSeconds) => this.simulateTick(Math.max(0, finite(seconds, this.intervalSeconds)))
    });
    window.NBD_MACRO_CITY_READY = false;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.trafficFlows.clear();
    this.policeTravel.clear();
    this.graph = null;
    if (typeof window !== "undefined") {
      delete window.NBD_MACRO_CITY;
      window.NBD_MACRO_CITY_READY = false;
    }
  }
}
