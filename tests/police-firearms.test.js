import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AI_STATES } from "../phaser/src/data/ai.js";
import { COMBAT_STATES } from "../phaser/src/data/combat.js";
import { NPC_TYPES } from "../phaser/src/data/npcs.js";
import { POLICE_FIREARM } from "../phaser/src/data/player-combat.js";
import {
  policeCanUseFirearm,
  policeFirearmShooterLimit,
  segmentCircleHitDistance
} from "../phaser/src/combat/PoliceFirearmSystem.js";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("armed response begins at Wanted 2 and scales to two shooters at Wanted 3", () => {
  assert.equal(policeFirearmShooterLimit(1), 0);
  assert.equal(policeFirearmShooterLimit(2), 1);
  assert.equal(policeFirearmShooterLimit(3), 2);
  assert.equal(POLICE_FIREARM.burstSize, 2);
  assert.ok(POLICE_FIREARM.reloadMs > POLICE_FIREARM.shotGapMs);
});

test("police firearm eligibility requires an active chasing officer and Wanted 2", () => {
  const cop = {
    type: NPC_TYPES.POLICE,
    ai: { state: AI_STATES.CHASING },
    combat: { state: COMBAT_STATES.ACTIVE },
    chasingPlayer: true,
    stunnedTimer: 0
  };
  assert.equal(policeCanUseFirearm(cop, 1), false);
  assert.equal(policeCanUseFirearm(cop, 2), true);
  cop.stunnedTimer = 1;
  assert.equal(policeCanUseFirearm(cop, 3), false);
});

test("swept police bullets detect a circular target without tunnelling", () => {
  assert.equal(segmentCircleHitDistance({ x: 0, y: 0 }, { x: 1, y: 0 }, 100, { x: 50, y: 0 }, 5), 45);
  assert.equal(segmentCircleHitDistance({ x: 0, y: 0 }, { x: 1, y: 0 }, 40, { x: 50, y: 0 }, 5), null);
  assert.equal(segmentCircleHitDistance({ x: 0, y: 0 }, { x: 1, y: 0 }, 100, { x: 50, y: 20 }, 5), null);
});

test("runtime firearms use shared collision, prevent friendly fire and target the occupied vehicle", () => {
  const system = source("phaser/src/combat/PoliceFirearmSystem.js");
  const runtime = source("phaser/src/runtime/GameplayRuntimeCore.js");
  assert.match(system, /resolveHitscanWorldImpact/);
  assert.match(system, /friendlyPoliceImpact/);
  assert.match(system, /currentVehicle\?\.\(\)/);
  assert.match(system, /damageVehicle\?\.\(current\.id, POLICE_FIREARM\.vehicleDamage/);
  assert.match(system, /playerDamageSystem\?\.damagePlayer/);
  assert.match(system, /RawAudio\.play\("weaponFire"/);
  assert.match(runtime, /new PoliceFirearmSystem\(scene\)/);
  assert.match(runtime, /policeFirearmSystem\?\.update\(dt, frame\)/);
});
