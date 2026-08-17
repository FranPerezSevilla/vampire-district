from pathlib import Path
from textwrap import dedent

path = Path("phaser/src/systems/PedestrianSystem.js")
code = path.read_text()

if "const CROWD_BROADPHASE_PADDING = 2;" not in code:
    code = code.replace(
        "const CROWD_RESOLVE_ITERATIONS = 3;\nconst CROWD_YIELD_SECONDS = 0.12;\n",
        "const CROWD_RESOLVE_ITERATIONS = 3;\nconst CROWD_YIELD_SECONDS = 0.12;\nconst CROWD_BROADPHASE_PADDING = 2;\nconst PEDESTRIAN_PUBLISH_INTERVAL = 0.25;\n",
        1,
    )

old_state = dedent('''\
    this.lastCrowdResolution = {
      participants: 0,
      resolvedPairs: 0,
      remainingOverlaps: 0,
      minimumSeparation: null
    };
    this.bindPedestrians();''')
new_state = dedent('''\
    this.lastCrowdResolution = {
      participants: 0,
      resolvedPairs: 0,
      remainingOverlaps: 0,
      minimumSeparation: null,
      pairChecks: 0,
      metricPairChecks: 0,
      broadphase: "bruteforce"
    };
    this.publishAccumulator = 0;
    this.bindPedestrians();''')
if old_state in code:
    code = code.replace(old_state, new_state, 1)
elif "this.publishAccumulator = 0;" not in code:
    raise SystemExit("PedestrianSystem constructor anchor missing")

crowd_anchor = dedent('''\
  crowdParticipants(options = {}) {
    return this.scene.npcSystem.npcs.filter(npc => this.isCrowdParticipant(npc, options));
  }
''')
crowd_insert = dedent('''\
  crowdParticipants(options = {}) {
    return this.scene.npcSystem.npcs.filter(npc => this.isCrowdParticipant(npc, options));
  }

  nearbyCrowdParticipants(x, y, radius, options = {}) {
    const queryRadius = this.scene.npcSystem?.queryRadius;
    if (typeof queryRadius === "function") {
      return queryRadius.call(
        this.scene.npcSystem,
        x,
        y,
        Math.max(0, Number(radius) || 0),
        LAYERS.STREET,
        candidate => this.isCrowdParticipant(candidate, options)
      );
    }
    const limit = Math.max(0, Number(radius) || 0);
    return this.crowdParticipants(options)
      .filter(candidate => Math.hypot(candidate.x - x, candidate.y - y) <= limit);
  }

  crowdMetrics(participants, minimum = PEDESTRIAN_MIN_SEPARATION) {
    const required = Math.max(0, Number(minimum) || 0);
    const queryRadius = this.scene.npcSystem?.queryRadius;
    if (typeof queryRadius !== "function") {
      let overlaps = 0;
      let minimumSeparation = Infinity;
      let metricPairChecks = 0;
      for (let first = 0; first < participants.length; first++) {
        for (let second = first + 1; second < participants.length; second++) {
          metricPairChecks++;
          const current = distance(participants[first], participants[second]);
          minimumSeparation = Math.min(minimumSeparation, current);
          if (current < required - 0.25) overlaps++;
        }
      }
      return {
        overlaps,
        minimumSeparation: Number.isFinite(minimumSeparation) ? minimumSeparation : null,
        metricPairChecks,
        broadphase: "bruteforce"
      };
    }

    const order = new Map(participants.map((npc, index) => [npc, index]));
    let overlaps = 0;
    let minimumSeparation = Infinity;
    let metricPairChecks = 0;
    for (let first = 0; first < participants.length; first++) {
      const npc = participants[first];
      for (const other of this.nearbyCrowdParticipants(npc.x, npc.y, required)) {
        const second = order.get(other);
        if (second == null || second <= first) continue;
        metricPairChecks++;
        const current = distance(npc, other);
        minimumSeparation = Math.min(minimumSeparation, current);
        if (current < required - 0.25) overlaps++;
      }
    }
    return {
      overlaps,
      // Diagnostics only need to prove the configured separation floor when no close pair exists.
      minimumSeparation: Number.isFinite(minimumSeparation)
        ? minimumSeparation
        : participants.length > 1 ? required : null,
      metricPairChecks,
      broadphase: "spatial"
    };
  }
''')
if "nearbyCrowdParticipants(x, y, radius" not in code:
    if crowd_anchor not in code:
        raise SystemExit("crowdParticipants anchor missing")
    code = code.replace(crowd_anchor, crowd_insert, 1)

start = code.index("  resolveCrowdCollisions({")
end = code.index("\n  hasCrowdClearance(", start)
new_resolve = dedent('''\
  resolveCrowdCollisions({
    iterations = CROWD_RESOLVE_ITERATIONS,
    includePlayer = true,
    simulatedOnly = true
  } = {}) {
    const participants = this.crowdParticipants({ simulatedOnly });
    const useSpatialBroadphase = typeof this.scene.npcSystem?.queryRadius === "function";
    const order = useSpatialBroadphase
      ? new Map(participants.map((npc, index) => [npc, index]))
      : null;
    const maxIterations = Math.max(1, Math.floor(iterations));
    let resolvedPairs = 0;
    let pairChecks = 0;
    let changed = false;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      let changedThisPass = false;
      if (useSpatialBroadphase) {
        const radius = PEDESTRIAN_MIN_SEPARATION + CROWD_BROADPHASE_PADDING;
        for (let first = 0; first < participants.length; first++) {
          const npc = participants[first];
          for (const other of this.nearbyCrowdParticipants(
            npc.x,
            npc.y,
            radius,
            { simulatedOnly }
          )) {
            const second = order.get(other);
            if (second == null || second <= first) continue;
            pairChecks++;
            if (this.resolvePair(npc, other)) {
              resolvedPairs++;
              changedThisPass = true;
            }
          }
        }
      } else {
        for (let first = 0; first < participants.length; first++) {
          for (let second = first + 1; second < participants.length; second++) {
            pairChecks++;
            if (this.resolvePair(participants[first], participants[second])) {
              resolvedPairs++;
              changedThisPass = true;
            }
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
      if (useSpatialBroadphase && iteration + 1 < maxIterations) {
        this.scene.npcSystem.rebuildSpatialIndex?.();
      }
    }

    if (changed) this.scene.npcSystem.rebuildSpatialIndex?.();
    const metrics = this.crowdMetrics(participants);
    this.lastCrowdResolution = {
      participants: participants.length,
      resolvedPairs,
      remainingOverlaps: metrics.overlaps,
      minimumSeparation: metrics.minimumSeparation,
      pairChecks,
      metricPairChecks: metrics.metricPairChecks,
      broadphase: metrics.broadphase
    };
    return this.lastCrowdResolution;
  }
''')
code = code[:start] + new_resolve + code[end:]

old_clearance = dedent('''\
  hasCrowdClearance(npc, x, y, minimum = PEDESTRIAN_MIN_SEPARATION - 1) {
    for (const other of this.crowdParticipants()) {
      if (other === npc) continue;
      if (Math.hypot(other.x - x, other.y - y) < minimum) return false;
    }
    const player = this.scene.player;
''')
new_clearance = dedent('''\
  hasCrowdClearance(npc, x, y, minimum = PEDESTRIAN_MIN_SEPARATION - 1) {
    const radius = minimum + CROWD_BROADPHASE_PADDING;
    for (const other of this.nearbyCrowdParticipants(x, y, radius)) {
      if (other === npc) continue;
      if (Math.hypot(other.x - x, other.y - y) < minimum) return false;
    }
    const player = this.scene.player;
''')
if old_clearance in code:
    code = code.replace(old_clearance, new_clearance, 1)
elif "const radius = minimum + CROWD_BROADPHASE_PADDING;" not in code:
    raise SystemExit("hasCrowdClearance anchor missing")

old_tail = dedent('''\
    this.resolveCrowdCollisions({ iterations: 1, includePlayer: true });
    this.scene.npcSystem.rebuildSpatialIndex?.();
    this.publish();
  }
''')
new_tail = dedent('''\
    // Movement changed pedestrian positions, so refresh the shared broadphase once before crowd resolution.
    this.scene.npcSystem.rebuildSpatialIndex?.();
    this.resolveCrowdCollisions({ iterations: 1, includePlayer: true });
    this.publishAccumulator += seconds;
    if (this.publishAccumulator >= PEDESTRIAN_PUBLISH_INTERVAL) {
      this.publishAccumulator %= PEDESTRIAN_PUBLISH_INTERVAL;
      this.publish();
    }
  }
''')
if old_tail in code:
    code = code.replace(old_tail, new_tail, 1)
elif "this.publishAccumulator += seconds;" not in code:
    raise SystemExit("PedestrianSystem update tail anchor missing")

old_snapshot = dedent('''\
      crowd: {
        participants: participants.length,
        minimumSeparation: minimumPedestrianSeparation(participants),
        overlaps: this.overlapCount(participants),
        resolvedPairs: this.lastCrowdResolution.resolvedPairs
      },''')
new_snapshot = dedent('''\
      crowd: {
        participants: participants.length,
        minimumSeparation: this.lastCrowdResolution.minimumSeparation,
        overlaps: this.lastCrowdResolution.remainingOverlaps,
        resolvedPairs: this.lastCrowdResolution.resolvedPairs,
        pairChecks: this.lastCrowdResolution.pairChecks,
        metricPairChecks: this.lastCrowdResolution.metricPairChecks,
        broadphase: this.lastCrowdResolution.broadphase
      },''')
if old_snapshot in code:
    code = code.replace(old_snapshot, new_snapshot, 1)
elif "pairChecks: this.lastCrowdResolution.pairChecks" not in code:
    raise SystemExit("PedestrianSystem snapshot anchor missing")

path.write_text(code)

Path("tests/pedestrian-performance.test.js").write_text(dedent(r'''\
import test from "node:test";
import assert from "node:assert/strict";

import { LAYERS, pedestrianRoutes } from "../phaser/src/data/district.js";
import { NPC_TYPES } from "../phaser/src/data/npcs.js";
import { PedestrianSystem } from "../phaser/src/systems/PedestrianSystem.js";
import { SpatialHash } from "../phaser/src/utils/SpatialHash.js";

class TestEvents {
  constructor() { this.listeners = new Map(); }
  on(name, listener) {
    const listeners = this.listeners.get(name) || [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
  }
  once(name, listener) {
    const wrapped = (...args) => {
      this.off(name, wrapped);
      listener(...args);
    };
    this.on(name, wrapped);
  }
  off(name, listener) {
    const listeners = this.listeners.get(name) || [];
    this.listeners.set(name, listeners.filter(candidate => candidate !== listener));
  }
}

function pedestrian(id, x, y, routeId) {
  return {
    id,
    type: NPC_TYPES.CIVILIAN,
    x,
    y,
    layer: LAYERS.STREET,
    behavior: "sidewalk",
    pedestrianRouteId: routeId,
    speed: 10,
    dirX: 1,
    dirY: 0,
    vx: 0,
    vy: 0,
    dead: false,
    inactive: false,
    hiddenBody: false,
    dragged: false,
    intercepted: false,
    alarmed: false,
    chasingPlayer: false,
    enemyAttack: null,
    whisperPassengerBoarded: false,
    stunnedTimer: 0,
    combat: { state: "active" },
    container: { setPosition() { return this; } }
  };
}

function spatialScene(npcs) {
  const spatial = new SpatialHash(32);
  const npcSystem = {
    npcs,
    canNpcStandAt: () => true,
    rebuildSpatialIndex: () => spatial.rebuild(npcs),
    queryRadius: (x, y, radius, layer, predicate) => spatial.queryRadius(x, y, radius, layer, predicate)
  };
  npcSystem.rebuildSpatialIndex();
  return {
    currentLayer: LAYERS.STREET,
    player: { x: -1000, y: -1000, layer: LAYERS.STREET },
    npcSystem,
    registry: { get: () => false },
    events: new TestEvents(),
    statePublisher: { setMany: () => {} }
  };
}

function withPhaser(run) {
  const previousPhaser = globalThis.Phaser;
  globalThis.Phaser = {
    Scenes: { Events: { POST_UPDATE: "postupdate", SHUTDOWN: "shutdown" } }
  };
  try { return run(); } finally { globalThis.Phaser = previousPhaser; }
}

test("72-pedestrian crowd broadphase avoids the former all-pairs frame scan", () => withPhaser(() => {
  const routeId = pedestrianRoutes[0].id;
  const columns = 12;
  const rows = 6;
  const spacing = 18;
  const npcs = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      npcs.push(pedestrian(
        `perf-${row}-${column}`,
        200 + column * spacing,
        200 + row * spacing,
        routeId
      ));
    }
  }

  const system = new PedestrianSystem(spatialScene(npcs));
  const result = system.resolveCrowdCollisions({ iterations: 1, includePlayer: false });
  const bruteForcePairChecks = npcs.length * (npcs.length - 1) / 2;
  const reduction = 1 - result.pairChecks / bruteForcePairChecks;

  assert.equal(result.broadphase, "spatial");
  assert.equal(result.remainingOverlaps, 0);
  assert.equal(bruteForcePairChecks, 2556);
  assert.equal(result.pairChecks, 126);
  assert.ok(reduction > 0.95);
  console.log(
    `PERF pedestrian broadphase: ${bruteForcePairChecks} brute-force pairs -> ${result.pairChecks} local candidates (${(reduction * 100).toFixed(1)}% fewer)`
  );
  system.destroy();
}));

test("spatial broadphase still resolves a real pedestrian overlap", () => withPhaser(() => {
  const route = pedestrianRoutes.find(candidate => candidate.points?.length >= 2);
  const point = route.points[0];
  const npcs = [
    pedestrian("spatial-a", point.x, point.y, route.id),
    pedestrian("spatial-b", point.x, point.y, route.id)
  ];
  const scene = spatialScene(npcs);
  const system = new PedestrianSystem(scene);
  scene.npcSystem.rebuildSpatialIndex();
  const result = system.resolveCrowdCollisions({ iterations: 2, includePlayer: false });

  assert.equal(result.broadphase, "spatial");
  assert.equal(result.remainingOverlaps, 0);
  assert.ok(Math.hypot(npcs[0].x - npcs[1].x, npcs[0].y - npcs[1].y) >= 15.75);
  system.destroy();
}));
'''))

doc = Path("docs/PLAYTEST_ESCALATION_DAMAGE_RECOVERY.md")
text = doc.read_text()
section = dedent('''\

## Follow-up — performance pass 1: pedestrian crowd broadphase

**State: implemented on PR #55; pending in-game frame-time validation.**

### Measured hotspot

- The route expansion raised the routed pedestrian population to **72**. The previous crowd solver compared every active participant with every other participant during resolution, then repeated full-pair scans for overlap/minimum-separation diagnostics. At 72 participants, one all-pairs pass is **2,556 pair checks** before movement-clearance scans and the second post-update collision pass are counted.
- A deterministic 12×6 benchmark at 18-unit spacing now records **126 local candidate checks instead of 2,556**, a **95.1% reduction** in crowd-resolution pair checks for the same 72 actors.
- This identifies pedestrian crowd separation/clearance as the first confirmed CPU-scaling hotspot introduced by the larger population. Browser frame-time profiling still owns the final ranking against traffic, rendering and audio.

### Implementation

- Crowd resolution and per-step pedestrian clearance now use the existing `NpcSystem` `SpatialHash` through `queryRadius()` rather than repeatedly scanning the full NPC list.
- Pair ordering prevents duplicate A↔B checks. The old brute-force path remains as a compatibility fallback for isolated tests/scenes without a spatial query authority.
- Crowd diagnostics reuse the spatial broadphase and report `pairChecks`, `metricPairChecks` and `broadphase` so browser profiling can correlate hitches with crowd work.
- The large pedestrian diagnostic snapshot is now published at **4 Hz** rather than every render frame. Gameplay movement/collision still updates every frame; only debug/state publication is throttled, reducing transient array/object allocation pressure.

### Acceptance

- The deterministic 72-pedestrian benchmark must remain below 10% of the previous all-pairs candidate count while preserving zero-overlap behavior.
- Existing pedestrian collision and route-expansion regressions must continue passing.
- In-game profiling should show fewer crowd-related frame spikes; if hitching remains, the next performance increment must instrument per-system wall time before changing another subsystem.
''')
if "## Follow-up — performance pass 1: pedestrian crowd broadphase" not in text:
    text += section
doc.write_text(text)
