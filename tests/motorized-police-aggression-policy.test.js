import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  installMotorizedPoliceAggressionPolicy,
  motorizedPoliceAggressionMovement,
  motorizedPoliceAggressionTiming
} from "../phaser/src/police/MotorizedPoliceAggressionPolicy.js";
import { MOTORIZED_POLICE_TACTICS } from "../phaser/src/police/MotorizedPolicePolicy.js";

const ROOT = new URL("../", import.meta.url);

test("Wanted pursuit tactics close faster without removing readable steering", () => {
  const rear = motorizedPoliceAggressionMovement(MOTORIZED_POLICE_TACTICS.REAR_QUARTER, 138, 2.35);
  const pit = motorizedPoliceAggressionMovement(MOTORIZED_POLICE_TACTICS.PIT_COMMIT, 190, 0.82);
  assert.ok(rear.speed > 155);
  assert.ok(rear.turnRate > 2.5);
  assert.ok(pit.speed >= 228);
  assert.ok(pit.turnRate > 0.82 && pit.turnRate < 1);
});

test("aggression shortens PIT and ram recovery while keeping telegraphs readable", () => {
  const timing = motorizedPoliceAggressionTiming({
    localTacticsRadius: 520,
    pitTelegraphSeconds: 0.65,
    pitCooldownSeconds: 5.5,
    ramTelegraphSeconds: 0.85,
    ramCooldownSeconds: 6.5
  });
  assert.ok(timing.localTacticsRadius > 520);
  assert.ok(timing.pitTelegraphSeconds >= 0.35 && timing.pitTelegraphSeconds < 0.65);
  assert.ok(timing.pitCooldownSeconds < 4.1);
  assert.ok(timing.ramTelegraphSeconds >= 0.42 && timing.ramTelegraphSeconds < 0.85);
  assert.ok(timing.ramCooldownSeconds < 5.1);
});

test("policy boosts tactical movement and restores the original authority on destroy", () => {
  const calls = [];
  const originalMove = function originalMove(unit, target, dt, speed, options) {
    calls.push({ unit, target, dt, speed, options });
    return true;
  };
  const system = {
    moveTacticalUnit: originalMove,
    updateLocalTactic() {},
    localTacticsRadius: 520,
    pitTelegraphSeconds: 0.65,
    pitCooldownSeconds: 5.5,
    ramTelegraphSeconds: 0.85,
    ramCooldownSeconds: 6.5
  };
  const policy = installMotorizedPoliceAggressionPolicy(system);
  assert.notEqual(system.moveTacticalUnit, originalMove);
  assert.ok(system.localTacticsRadius > 520);

  system.moveTacticalUnit(
    { id: "unit-1", tactic: MOTORIZED_POLICE_TACTICS.PIT_COMMIT },
    { x: 10, y: 10 },
    0.05,
    190,
    { turnRate: 0.82, committedAngle: 0.4 }
  );
  assert.equal(calls.length, 1);
  assert.ok(calls[0].speed >= 228);
  assert.equal(calls[0].options.committedAngle, 0.4);
  assert.ok(policy.snapshot().boostedMoves >= 1);

  policy.destroy();
  assert.equal(system.moveTacticalUnit, originalMove);
  assert.equal(system.localTacticsRadius, 520);
  assert.equal(system.pitCooldownSeconds, 5.5);
  assert.equal(system.ramCooldownSeconds, 6.5);
});

test("gameplay runtime installs aggression after local police policy and destroys it first", async () => {
  const runtime = await readFile(new URL("phaser/src/runtime/GameplayRuntime.js", ROOT), "utf8");
  const localInstall = runtime.indexOf("installMotorizedPoliceLocalPolicy(scene.motorizedPoliceSystem)");
  const aggressionInstall = runtime.indexOf("installMotorizedPoliceAggressionPolicy(scene.motorizedPoliceSystem)");
  assert.ok(localInstall >= 0 && aggressionInstall > localInstall);

  const aggressionDestroy = runtime.indexOf("this.scene.motorizedPoliceAggressionPolicy?.destroy?.()");
  const localDestroy = runtime.indexOf("this.scene.motorizedPoliceLocalPolicy?.destroy?.()");
  const systemDestroy = runtime.indexOf("this.scene.motorizedPoliceSystem?.destroy?.()");
  assert.ok(aggressionDestroy >= 0 && localDestroy > aggressionDestroy && systemDestroy > localDestroy);
});
