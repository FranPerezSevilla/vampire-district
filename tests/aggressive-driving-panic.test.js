import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { AI_STATES, resolveNpcAiState } from "../phaser/src/data/ai.js";
import { AMBIENT_PEDESTRIANS_PER_ROUTE, NPC_TYPES } from "../phaser/src/data/npcs.js";
import {
  aggressiveDrivingSkidIntensity,
  panicCiviliansFromAggressiveDriving
} from "../phaser/src/vehicles/VehicleDriving.js";

function repoFile(path) {
  return new URL(`../${path}`, import.meta.url);
}

test("ambient pedestrian density uses six evenly distributed civilians per route", () => {
  assert.equal(AMBIENT_PEDESTRIANS_PER_ROUTE, 6);
});

test("ordinary cornering stays quiet while a fast handbrake drift crosses the panic threshold", () => {
  const ordinary = aggressiveDrivingSkidIntensity(
    { speed: 70, driftAngle: 0.02, handbrake: false },
    { move: { x: 0.7 }, handbrakeHeld: false }
  );
  const aggressive = aggressiveDrivingSkidIntensity(
    { speed: 58, driftAngle: 0.12, handbrake: true },
    { move: { x: 0.8 }, handbrakeHeld: true }
  );
  const tooSlow = aggressiveDrivingSkidIntensity(
    { speed: 20, driftAngle: 0.4, handbrake: true },
    { move: { x: 1 }, handbrakeHeld: true }
  );

  assert.ok(ordinary < 0.28);
  assert.ok(aggressive >= 0.28);
  assert.equal(tooSlow, 0);
});

test("aggressive driving panics civilians but never turns police into witnesses or Heat", () => {
  const civilian = {
    id: "civ-1",
    type: NPC_TYPES.CIVILIAN,
    x: 30,
    y: 0,
    layer: 0,
    alarmed: false,
    stunnedTimer: 0,
    vx: 3,
    vy: 2
  };
  const target = {
    id: "target-1",
    type: NPC_TYPES.TARGET,
    x: 45,
    y: 0,
    layer: 0,
    alarmed: false,
    stunnedTimer: 0,
    vx: 0,
    vy: 0
  };
  const police = {
    id: "cop-1",
    type: NPC_TYPES.POLICE,
    x: 20,
    y: 0,
    layer: 0,
    alarmed: false,
    stunnedTimer: 0
  };
  const candidates = [civilian, target, police];
  let heatCalls = 0;
  let reportCalls = 0;
  const system = {
    scene: {
      currentLayer: 0,
      npcSystem: {
        queryRadius(_x, _y, _radius, _layer, predicate) {
          return candidates.filter(predicate);
        }
      },
      aiStateSystem: { resolveNpc() {} },
      policeSystem: { addHeat() { heatCalls++; } },
      witnessSystem: { alarmWitness() { reportCalls++; } },
      events: { emit() {} }
    }
  };

  const panicked = panicCiviliansFromAggressiveDriving(system, { id: "car", x: 0, y: 0 }, 0.8);

  assert.equal(panicked, 2);
  assert.ok(civilian.panicTimer > 0);
  assert.ok(target.panicTimer > 0);
  assert.equal(civilian.alarmed, false);
  assert.equal(target.alarmed, false);
  assert.equal(police.panicTimer, undefined);
  assert.equal(heatCalls, 0);
  assert.equal(reportCalls, 0);
});

test("non-reporting civilian panic resolves as fleeing while police remain normal", () => {
  const civilian = {
    type: NPC_TYPES.CIVILIAN,
    panicTimer: 1.5,
    alarmed: false,
    stunnedTimer: 0
  };
  const police = {
    type: NPC_TYPES.POLICE,
    panicTimer: 1.5,
    alarmed: false,
    stunnedTimer: 0
  };

  assert.equal(resolveNpcAiState(civilian), AI_STATES.FLEEING);
  assert.equal(resolveNpcAiState(police), AI_STATES.PATROLLING);
});

test("runtime gives skid noise and panic flight dedicated paths without reporting", () => {
  const drivingSource = readFileSync(repoFile("phaser/src/vehicles/VehicleDriving.js"), "utf8");
  const npcSource = readFileSync(repoFile("phaser/src/systems/NpcSystem.js"), "utf8");
  const rawAudioSource = readFileSync(repoFile("phaser/src/systems/RawAudioSystem.js"), "utf8");

  assert.match(drivingSource, /RawAudio\.play\("vehicleSkidLoop", \{ cooldown: 0\.16 \}\)/);
  assert.match(drivingSource, /panicCiviliansFromAggressiveDriving\(system, vehicle, intensity\)/);
  assert.doesNotMatch(panicCiviliansFromAggressiveDriving.toString(), /addHeat|alarmWitness|policeSystem/);
  assert.match(npcSource, /npc\.ai\?\.state === AI_STATES\.FLEEING[\s\S]*?npc\.ai\.intent = "panic-flee"[\s\S]*?moveTowardAtSpeed/);
  assert.match(rawAudioSource, /case "vehicleSkidLoop": return this\.vehicleSkid\(\);/);
  assert.match(rawAudioSource, /vehicleSkid\(\)[\s\S]*?filter: 1850[\s\S]*?filterType: "bandpass"/);
});
