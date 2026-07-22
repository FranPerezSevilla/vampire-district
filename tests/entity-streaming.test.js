import test from "node:test";
import assert from "node:assert/strict";

import { NPC_TYPES } from "../phaser/src/data/npcs.js";
import {
  ENTITY_STREAM_STATES,
  npcStreamDecision,
  vehicleStreamDecision
} from "../phaser/src/streaming/EntityStreamPolicy.js";
import { EntityStreamSystem } from "../phaser/src/streaming/EntityStreamSystem.js";

function display() {
  return {
    active: true,
    visible: true,
    setActive(value) { this.active = Boolean(value); return this; },
    setVisible(value) { this.visible = Boolean(value); return this; }
  };
}

function fakeScene() {
  const cityState = {
    active: new Set(["0:0"]),
    prefetched: new Set(["1:0"])
  };
  const npcLocal = { id: "local", type: NPC_TYPES.CIVILIAN, x: 100, y: 100, layer: 0, container: display(), stunnedTimer: 0 };
  const npcFar = { id: "far", type: NPC_TYPES.CIVILIAN, x: 1200, y: 100, layer: 0, container: display(), stunnedTimer: 2 };
  const journalist = { id: "journalist", type: NPC_TYPES.TARGET, x: 1200, y: 100, layer: 0, container: display(), stunnedTimer: 0 };
  const investigatingCop = { id: "cop", type: NPC_TYPES.POLICE, x: 1200, y: 100, layer: 0, container: display(), investigateTarget: { x: 100, y: 100 }, stunnedTimer: 0 };
  const localVehicle = { id: "local-car", x: 120, y: 120, layer: 0, speed: 0, container: display() };
  const farVehicle = { id: "far-car", x: 1200, y: 120, layer: 0, speed: 0, container: display() };
  const scene = {
    currentLayer: 0,
    cityStreamSystem: {
      manifest: { chunkSize: 512 },
      prefetchedChunkIds: cityState.prefetched,
      isChunkActive(id) { return cityState.active.has(id); },
      stateOf(id) {
        if (cityState.active.has(id)) return "active";
        if (cityState.prefetched.has(id)) return "prefetched";
        return "unloaded";
      }
    },
    exposureSystem: { level: () => 0 },
    npcSystem: { npcs: [npcLocal, npcFar, journalist, investigatingCop] },
    vehicleSystem: { vehicles: [localVehicle, farVehicle], currentVehicleId: null },
    statePublisher: { setMany() {} },
    events: { once() {} }
  };
  return { scene, cityState, npcLocal, npcFar, journalist, investigatingCop, localVehicle, farVehicle };
}

test("pure streaming policy sleeps ordinary remote entities and pins critical ones", () => {
  assert.deepEqual(npcStreamDecision({ type: NPC_TYPES.CIVILIAN }, { active: false, prefetched: true }), {
    state: ENTITY_STREAM_STATES.DORMANT,
    reason: "prefetched-chunk"
  });
  assert.equal(npcStreamDecision({ type: NPC_TYPES.TARGET }, { active: false }).state, ENTITY_STREAM_STATES.PINNED);
  assert.equal(npcStreamDecision({ type: NPC_TYPES.CIVILIAN, dragged: true }, { active: false }).reason, "dragged-body");
  assert.equal(npcStreamDecision({ type: NPC_TYPES.POLICE, investigateTarget: { x: 1, y: 1 } }, { active: false }).reason, "investigation");
  assert.equal(npcStreamDecision({ type: NPC_TYPES.HUNTER }, { active: false, exposureLevel: 4 }).reason, "hunter-alert");
  assert.equal(vehicleStreamDecision({ id: "car", speed: 0 }, { active: false }).state, ENTITY_STREAM_STATES.DORMANT);
  assert.equal(vehicleStreamDecision({ id: "car", speed: 0 }, { active: false, currentVehicleId: "car" }).reason, "occupied-vehicle");
});

test("entity stream authority sleeps remote civilians and parked vehicles while preserving critical actors", () => {
  const fixture = fakeScene();
  const system = new EntityStreamSystem(fixture.scene);
  const snapshot = system.snapshot();

  assert.equal(system.stateOf("local"), ENTITY_STREAM_STATES.ACTIVE);
  assert.equal(system.stateOf("far"), ENTITY_STREAM_STATES.DORMANT);
  assert.equal(system.stateOf("journalist"), ENTITY_STREAM_STATES.PINNED);
  assert.equal(system.stateOf("cop"), ENTITY_STREAM_STATES.PINNED);
  assert.equal(system.stateOf("local-car"), ENTITY_STREAM_STATES.ACTIVE);
  assert.equal(system.stateOf("far-car"), ENTITY_STREAM_STATES.DORMANT);
  assert.equal(fixture.npcFar.container.active, false);
  assert.equal(fixture.npcFar.container.visible, false);
  assert.equal(fixture.farVehicle.container.active, false);
  assert.ok(snapshot.dormantNpcCount >= 1);
  assert.ok(snapshot.pinned.some(item => item.id === "journalist" && item.reason === "mission-target"));

  system.update(0.5);
  assert.equal(fixture.npcFar.stunnedTimer, 1.5, "passive timers should advance while the NPC is abstracted");
  system.destroy();
});

test("remote entities wake when their chunk becomes active without recreation", () => {
  const fixture = fakeScene();
  const system = new EntityStreamSystem(fixture.scene);
  const originalContainer = fixture.npcFar.container;

  fixture.cityState.active = new Set(["2:0"]);
  fixture.cityState.prefetched = new Set(["1:0"]);
  fixture.scene.cityStreamSystem.prefetchedChunkIds = fixture.cityState.prefetched;
  system.update(0, { force: true });

  assert.equal(system.stateOf("far"), ENTITY_STREAM_STATES.ACTIVE);
  assert.equal(system.stateOf("local"), ENTITY_STREAM_STATES.DORMANT);
  assert.equal(fixture.npcFar.container, originalContainer, "waking should reuse the existing display object");
  assert.equal(fixture.npcFar.container.active, true);
  assert.equal(system.snapshot().recentTransitions.some(item => item.id === "far" && item.to === "active"), true);
  system.destroy();
});