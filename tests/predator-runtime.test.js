import test from "node:test";
import assert from "node:assert/strict";

import { PlayerDamageSystem } from "../phaser/src/combat/PlayerDamageSystem.js";
import { filterVehicleInputFrame } from "../phaser/src/vehicles/VehicleDriving.js";

function displayObject() {
  return {
    setDepth() { return this; },
    setOrigin() { return this; },
    setVisible() { return this; },
    setResolution() { return this; },
    setStroke() { return this; },
    setPosition() { return this; },
    setText() { return this; },
    destroy() {}
  };
}

test("Give In remains available during hit stun but is suppressed while driving", () => {
  const stunned = {
    worldEnabled: true,
    move: { x: 1, y: 0 },
    hasMovementIntent: true,
    beastPressed: true,
    dashPressed: true,
    whisperPressed: true,
    bloodSensePressed: true
  };

  const driving = filterVehicleInputFrame({ isDriving: () => true }, stunned);
  assert.equal(driving.beastPressed, false);
  assert.equal(driving.dashPressed, false);
  assert.equal(driving.whisperPressed, false);
  assert.equal(driving.bloodSensePressed, false);
});

test("100 Hunger remains Beast pressure rather than automatic death or frenzy failure", () => {
  globalThis.Phaser = {
    Scenes: { Events: { SHUTDOWN: "shutdown" } }
  };
  const events = [];
  let failureCalls = 0;
  const scene = {
    add: {
      graphics: () => displayObject(),
      text: () => displayObject()
    },
    events: {
      once() {},
      emit(type, payload) { events.push({ type, payload }); }
    },
    time: { now: 1000 },
    cameras: { main: { shake() {} } },
    feedingSystem: {
      hunger: 100,
      isActive: () => false
    },
    combatSystem: { attack: null },
    inputSystem: {
      primaryHeld: false,
      primaryPressed: false,
      drainHeld: false,
      drainPressed: false,
      pendingWheelStep: 0
    },
    missionSystem: {
      failed: false,
      failRun() { failureCalls += 1; }
    },
    npcSystem: { npcs: [] },
    currentLayer: 0,
    player: { x: 0, y: 0 }
  };

  const system = new PlayerDamageSystem(scene);
  const applied = system.damagePlayer({ id: "police-test" }, {
    id: "critical-test",
    label: "critical strike",
    damageKind: "melee",
    vitalityDamage: 20
  });

  assert.equal(applied, true);
  assert.equal(scene.feedingSystem.hunger, 100);
  assert.equal(system.state.vitality, 80);
  assert.equal(system.isDead(), false);
  assert.equal(failureCalls, 0);
  assert.match(scene.lastActionText, /Vitality -20/i);
  assert.ok(events.some(event => event.type === "player:damaged"));
  assert.ok(!events.some(event => event.type === "player:died"));

  const filtered = system.filterFrame({
    worldEnabled: true,
    move: { x: 1, y: 0 },
    hasMovementIntent: true,
    beastPressed: true,
    dashPressed: true,
    whisperPressed: true,
    bloodSensePressed: true
  });
  assert.equal(filtered.beastPressed, true);
  assert.equal(filtered.dashPressed, false);
  assert.equal(filtered.whisperPressed, false);
  assert.equal(filtered.bloodSensePressed, false);

  system.destroy();
  delete globalThis.Phaser;
});
