import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { COMBAT_STATES } from "../phaser/src/data/combat.js";
import { NPC_TYPES } from "../phaser/src/data/npcs.js";
import { AI_RULES, AI_STATES } from "../phaser/src/data/ai.js";

globalThis.Phaser = {
  Scenes: { Events: { SHUTDOWN: "shutdown" } }
};

const { AiStateSystem } = await import("../phaser/src/systems/AiStateSystem.js");

function containerStub() {
  return {
    setScale() { return this; },
    setAlpha() { return this; }
  };
}

function downedNpc(type, maxResilience) {
  return {
    id: `${type}-test`,
    type,
    x: 20,
    y: 30,
    layer: 0,
    dead: false,
    inactive: false,
    hiddenBody: false,
    intercepted: false,
    stunnedTimer: Number.POSITIVE_INFINITY,
    combat: {
      state: COMBAT_STATES.DOWNED,
      maxResilience,
      resilience: 0,
      staggerUntil: 0,
      feedbackUntil: 0
    },
    container: containerStub(),
    vx: 0,
    vy: 0
  };
}

function makeScene(npcs) {
  const events = new EventEmitter();
  const registry = new Map();
  let remembered = 0;
  const scene = {
    time: { now: 1_000 },
    player: { x: 100, y: 120 },
    currentLayer: 0,
    npcSystem: { npcs },
    exposureSystem: { level: () => 2 },
    policeSystem: {
      zoneAt: () => ({ id: "cross" }),
      rememberPlayerPosition: () => { remembered++; }
    },
    registry: { set: (key, value) => registry.set(key, value) },
    events,
    lastActionText: ""
  };
  return { scene, registry, remembered: () => remembered };
}

test("AiStateSystem recovers police at the scheduled time and emits one event", () => {
  const cop = downedNpc(NPC_TYPES.POLICE, 4);
  const { scene, remembered } = makeScene([cop]);
  const recovered = [];
  scene.events.on("combat:entity-recovered", payload => recovered.push(payload));
  const system = new AiStateSystem(scene);

  assert.equal(cop.ai.state, AI_STATES.IDLE);
  system.preUpdate(0, null);
  assert.equal(cop.ai.state, AI_STATES.DOWNED);
  const recoverAt = cop.ai.recoverAt;
  assert.equal(recoverAt, scene.time.now + AI_RULES.policeRecoveryMs);

  scene.time.now = recoverAt - 1;
  system.preUpdate(0, null);
  assert.equal(cop.combat.state, COMBAT_STATES.DOWNED);

  scene.time.now = recoverAt;
  system.preUpdate(0, null);
  assert.equal(cop.combat.state, COMBAT_STATES.STAGGERED);
  assert.equal(cop.combat.resilience, 2);
  assert.equal(cop.stunnedTimer, AI_RULES.recoveryStaggerMs / 1000);
  assert.equal(recovered.length, 1);
  assert.equal(recovered[0].targetId, cop.id);
  assert.equal(remembered(), 1);

  system.destroy();
});

test("a drain channel suppresses recovery until the channel is released", () => {
  const hunter = downedNpc(NPC_TYPES.HUNTER, 5);
  const { scene } = makeScene([hunter]);
  const system = new AiStateSystem(scene);
  system.preUpdate(0, null);

  scene.time.now = hunter.ai.recoverAt + 5_000;
  hunter.drainVictim = true;
  system.preUpdate(0, null);
  assert.equal(hunter.combat.state, COMBAT_STATES.DOWNED);

  hunter.drainVictim = false;
  system.preUpdate(0, null);
  assert.equal(hunter.combat.state, COMBAT_STATES.STAGGERED);
  assert.equal(hunter.combat.resilience, 3);

  system.destroy();
});

test("civilian knockdown remains permanent even after a long elapsed time", () => {
  const civilian = downedNpc(NPC_TYPES.CIVILIAN, 3);
  const { scene } = makeScene([civilian]);
  const system = new AiStateSystem(scene);
  system.preUpdate(0, null);

  assert.equal(civilian.ai.recoverAt, Number.POSITIVE_INFINITY);
  scene.time.now += 999_999;
  system.preUpdate(0, null);
  assert.equal(civilian.combat.state, COMBAT_STATES.DOWNED);
  assert.equal(civilian.ai.state, AI_STATES.DOWNED);

  system.destroy();
});
