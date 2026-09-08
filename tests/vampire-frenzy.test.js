import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { FrenzyController } from "../phaser/src/vampire/FrenzyController.js";
import { FeedingSystem } from "../phaser/src/systems/FeedingSystem.js";
import { createEmptyInputFrame } from "../phaser/src/input/actions.js";
import { VAMPIRE_RULES as R } from "../phaser/src/vampire/VampireCatalog.js";

const input = overrides => createEmptyInputFrame({ worldEnabled: true, move: { x: -1, y: 0 }, hasMovementIntent: true, primaryPressed: true, drainHeld: true, dashPressed: true, beastPressed: true, interactPressed: true, ...overrides });
function harness({ hunger = 100, prey = true, depth = "none" } = {}) {
  let time = 0;
  const state = { exhaustedUntil: 0, retryAt: 0 }, notices = [], outcomes = [];
  const npc = { id: "victim", x: 20, y: 0, layer: 0, type: "civilian", feedingDepth: depth, combat: { state: "active", resilience: 3, maxResilience: 3 }, container: { setVisible() {} }, exposureEvidenceIds: [] };
  const scene = { player: { x: 0, y: 0 }, currentLayer: 0, events: new EventEmitter(), time: { now: 0 }, canStandAt: () => true,
    playerDamageSystem: { isDead: () => false, isHitStunned: () => false },
    combatSystem: { attack: {}, aimDirection: { x: 0, y: 1 } },
    npcSystem: { npcs: prey ? [npc] : [], lineClear: () => true, markStunned() {}, markFed(target) { target.dead = true; target.combat.state = "drained"; } },
    witnessSystem: { onFeedingResolved: () => ({ witnesses: 1, witnessIds: [] }) },
    evidenceSystem: { onFeedingResolved(_npc, result) { outcomes.push(result); return ["actual-feeding-evidence"]; } },
    redrawLayer() {}
  };
  scene.feedingSystem = new FeedingSystem(scene);
  scene.feedingSystem.hunger = hunger;
  const controller = new FrenzyController(scene, { state: () => state, now: () => time, notify: text => notices.push(text) });
  return { scene, npc, controller, state, notices, outcomes, advance(dt, frame = input()) { time += dt; scene.time.now += dt * 1000; return controller.update(dt, frame); } };
}

test("Hunger 85 and 95 warn once; 100 overrides movement, weapons and interaction", () => {
  const h = harness({ hunger: 84 }); h.npc.x = 70;
  assert.equal(h.advance(.05).move.x, -1);
  h.scene.feedingSystem.hunger = 85; h.advance(.05); h.advance(.05);
  assert.equal(h.notices.length, 1);
  h.scene.feedingSystem.hunger = 95; h.advance(.05);
  assert.equal(h.notices.length, 2);
  h.scene.feedingSystem.hunger = 100;
  const frame = h.advance(.05);
  assert.equal(h.controller.active, true);
  assert.equal(frame.move.x, 1);
  for (const key of ["primaryPressed", "drainHeld", "dashPressed", "beastPressed", "interactPressed"]) assert.equal(frame[key], false);
});

test("frenzy uses real feeding, stops at a nonlethal full feed and leaves real evidence", () => {
  const h = harness();
  let frame = h.advance(.05);
  assert.equal(h.scene.feedingSystem.active.source, "frenzy");
  for (let i = 0; i < 100 && h.scene.feedingSystem.isActive(); i++) {
    frame = h.advance(.05, input({ drainHeld: false, hasMovementIntent: true }));
    assert.equal(frame.hasMovementIntent, false);
    h.scene.feedingSystem.update(.05, frame.hasMovementIntent);
  }
  h.advance(.05);
  assert.equal(h.controller.active, false);
  assert.equal(h.scene.feedingSystem.hunger, 66);
  assert.equal(h.npc.dead, undefined);
  assert.equal(h.npc.feedingUnconscious, true);
  assert.equal(h.npc.feedingDepth, "full_feed");
  assert.equal(h.outcomes.length, 1);
  assert.equal(h.outcomes[0].witnessCount, 1);
  assert.equal(h.outcomes[0].source, "frenzy");
});

test("a previously bitten victim may be drained because remaining blood is insufficient for restraint", () => {
  const h = harness({ depth: "quick_bite" });
  for (let i = 0; i < 90 && (i === 0 || h.controller.active); i++) {
    const frame = h.advance(.05);
    h.scene.feedingSystem.update(.05, frame.hasMovementIntent);
  }
  assert.equal(h.npc.dead, true);
  assert.equal(h.scene.feedingSystem.hunger, 56);
  assert.equal(h.outcomes[0].feedingDepth, "drain");
});

test("pause, transition and death do not start or advance a frenzy", () => {
  const h = harness();
  const paused = input({ worldEnabled: false });
  assert.equal(h.advance(20, paused), paused);
  assert.equal(h.controller.active, false);
  h.scene.transitionSystem = { active: true }; h.advance(.05);
  assert.equal(h.controller.active, false);
  h.scene.transitionSystem.active = false; h.scene.playerDamageSystem.isDead = () => true;
  h.advance(.05); assert.equal(h.controller.active, false);
  h.scene.playerDamageSystem.isDead = () => false; h.advance(.05);
  const remaining = h.controller.remaining;
  h.advance(20, paused);
  assert.equal(h.controller.remaining, remaining);
});

test("unreachable prey ends in bounded exhaustion; hunger 100 never makes powers free", () => {
  const h = harness();
  h.scene.canStandAt = () => false;
  let frame = h.advance(.05);
  assert.equal(h.scene.feedingSystem.isActive(), false);
  assert.equal(frame.hasMovementIntent, false);
  frame = h.advance(R.frenzySeconds + .1);
  assert.equal(h.controller.active, false);
  assert.equal(h.controller.exhausted(), true);
  assert.equal(h.controller.hunger(), 100);
  assert.equal(frame.dashPressed, false);
  assert.equal(h.controller.allowsPowers(), false);
  h.scene.feedingSystem.relieveHunger(35, "stored_blood");
  h.advance(R.frenzyExhaustion + .1);
  assert.equal(h.controller.allowsPowers(), true);
  assert.equal(h.controller.active, false);
});

test("frenzy brakes a vehicle and only exits after it stops with a valid exit", () => {
  const h = harness();
  const vehicle = { speed: 90 }; let exits = 0;
  h.scene.vehicleSystem = { currentVehicle: () => vehicle, exitVehicle() { exits++; return false; } };
  let frame = h.advance(.05);
  assert.equal(frame.handbrakeHeld, true);
  assert.equal(frame.move.x, 0);
  assert.equal(exits, 0);
  vehicle.speed = 0; frame = h.advance(.05);
  assert.equal(exits, 1);
  assert.equal(h.scene.feedingSystem.isActive(), false);
  h.advance(11);
  assert.equal(h.controller.active, false);
});

test("bus passengers request a stop without teleporting or overriding the bus driver", () => {
  const h = harness();
  h.scene.transitSystem = { isRiding: () => true, exitRequested: false };
  const frame = h.advance(.05);
  assert.equal(h.scene.transitSystem.exitRequested, true);
  assert.equal(frame.hasMovementIntent, false);
  assert.equal(h.scene.player.x, 0);
  assert.equal(h.scene.feedingSystem.isActive(), false);
});

test("crossing 100 after a power is reconciled immediately without ticking time twice", () => {
  const h = harness({ hunger: 99 }); h.npc.x = 90;
  const before = h.advance(.05);
  assert.equal(h.controller.active, false);
  h.scene.feedingSystem.hunger = 100;
  const after = h.controller.filterFrame(before);
  assert.equal(h.controller.active, true);
  assert.equal(after.move.x, 1);
  assert.equal(h.controller.remaining, R.frenzySeconds);
});
