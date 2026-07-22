import test from "node:test";
import assert from "node:assert/strict";

import { districtZoneAt } from "../phaser/src/data/district.js";
import { NPC_TYPES } from "../phaser/src/data/npcs.js";
import { PoliceSystem } from "../phaser/src/systems/PoliceSystem.js";
import { ENTITY_STREAM_STATES } from "../phaser/src/streaming/EntityStreamPolicy.js";
import { MacroTrafficPoliceSystem } from "../phaser/src/streaming/MacroTrafficPoliceSystem.js";

function fakeRegistry() {
  const values = new Map();
  return {
    get(key) { return values.get(key); },
    set(key, value) { values.set(key, value); }
  };
}

function fakeGraph() {
  return {
    schemaVersion: 1,
    version: 1,
    id: "macro-test",
    nodeIds: ["west", "east"],
    nodes: {
      west: {
        id: "west",
        bounds: { x: 0, y: 0, w: 500, h: 500 },
        center: { x: 250, y: 250 },
        trafficDensity: 0.5,
        policePresence: 0.5,
        neighbours: ["east"]
      },
      east: {
        id: "east",
        bounds: { x: 500, y: 0, w: 500, h: 500 },
        center: { x: 750, y: 250 },
        trafficDensity: 0.9,
        policePresence: 0.4,
        neighbours: ["west"]
      }
    },
    edgeIds: ["west:east"],
    edges: {
      "west:east": {
        id: "west:east",
        a: "west",
        b: "east",
        travelSeconds: 4
      }
    }
  };
}

test("macro traffic advances deterministic numeric flow while only eligible dormant police travel", async () => {
  let containerMoves = 0;
  const travellingCop = {
    id: "cop-travelling",
    type: NPC_TYPES.POLICE,
    x: 100,
    y: 100,
    speed: 20,
    streamState: ENTITY_STREAM_STATES.DORMANT,
    dead: false,
    inactive: false,
    dragged: false,
    alarmed: false,
    chasingPlayer: false,
    enemyAttack: null,
    investigateTarget: null,
    intercepted: false,
    stunnedTimer: 0,
    container: { setPosition() { containerMoves++; } }
  };
  const investigatingCop = {
    ...travellingCop,
    id: "cop-investigating",
    x: 120,
    investigateTarget: { x: 300, y: 300, kind: "heat" }
  };
  const activeCop = {
    ...travellingCop,
    id: "cop-active",
    x: 140,
    streamState: ENTITY_STREAM_STATES.ACTIVE
  };
  const scene = {
    cityStreamSystem: {
      isPointActive() { return false; }
    },
    entityStreamSystem: {},
    npcSystem: { npcs: [travellingCop, investigatingCop, activeCop] },
    registry: fakeRegistry(),
    statePublisher: { setMany() {} },
    events: { once() {} }
  };
  const graph = fakeGraph();
  const system = new MacroTrafficPoliceSystem(scene, {
    graphUrl: "https://example.test/macro-graph.json",
    fetchImpl: async () => ({ ok: true, json: async () => graph }),
    intervalSeconds: 2,
    policeBudget: 1
  });
  await system.initialization;

  const before = system.snapshot();
  const beforePhase = before.flows[0].phases[0];
  const beforePosition = { x: travellingCop.x, y: travellingCop.y };
  const investigatingBefore = { x: investigatingCop.x, y: investigatingCop.y };
  const activeBefore = { x: activeCop.x, y: activeCop.y };

  system.simulateTick(2);
  const after = system.snapshot();

  assert.equal(after.ready, true);
  assert.ok(after.abstractTrafficTokens > 0);
  assert.notEqual(after.flows[0].phases[0], beforePhase);
  assert.ok(after.districtTrafficLoad.west >= 0);
  assert.ok(after.districtTrafficLoad.east >= 0);
  assert.deepEqual(after.lastAdvancedPoliceIds, ["cop-travelling"]);
  assert.equal(after.eligibleDormantPolice, 1);
  assert.equal(after.travellingPolice[0].npcId, "cop-travelling");
  assert.ok(travellingCop.x !== beforePosition.x || travellingCop.y !== beforePosition.y);
  assert.deepEqual({ x: investigatingCop.x, y: investigatingCop.y }, investigatingBefore);
  assert.deepEqual({ x: activeCop.x, y: activeCop.y }, activeBefore);
  assert.equal(containerMoves, 0);
  system.destroy();
});

test("awakened police outside the Old Quarter receive district-local patrol targets", () => {
  const previousPhaser = globalThis.Phaser;
  globalThis.Phaser = {
    Math: {
      Distance: {
        Between(x1, y1, x2, y2) {
          return Math.hypot(x2 - x1, y2 - y1);
        }
      }
    }
  };

  try {
    const scene = {
      player: { x: 1800, y: 430 },
      add: { graphics() { return { setDepth() { return this; } }; } },
      exposureSystem: { level() { return 0; } },
      entityStreamSystem: null,
      npcSystem: { npcs: [] }
    };
    const system = new PoliceSystem(scene);
    const cop = {
      id: "foundry-patrol",
      type: NPC_TYPES.POLICE,
      x: 1850,
      y: 338,
      layer: 0,
      soundReactionTimer: 0,
      chasingPlayer: false,
      investigateTarget: null,
      patrolRoute: "northEast",
      patrolIndex: 0,
      patrolOffsetIndex: 0,
      searchIndex: 0,
      ai: {}
    };

    const target = system.targetForCop(cop, 0);

    assert.equal(target.kind, "patrol");
    assert.equal(target.districtPatrol, true);
    assert.equal(target.zoneId, "foundry");
    assert.equal(districtZoneAt(target.x, target.y).id, "foundry");
    assert.equal(cop.districtPatrolZoneId, "foundry");
  } finally {
    globalThis.Phaser = previousPhaser;
  }
});
