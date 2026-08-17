import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HOSPITAL_RECOVERY } from "../phaser/src/data/death-recovery.js";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("hospital recovery is deliberately partial and grants a real grace window", () => {
  assert.equal(HOSPITAL_RECOVERY.reviveVitality, 35);
  assert.ok(HOSPITAL_RECOVERY.bloodBagVitality > 0);
  assert.ok(HOSPITAL_RECOVERY.bloodBagHungerRelief > 0);
  assert.ok(HOSPITAL_RECOVERY.bloodBagHungerRelief < 100);
  assert.ok(HOSPITAL_RECOVERY.policeGraceMs >= 5000);
  assert.match(HOSPITAL_RECOVERY.lackeyLine, /morgue/i);
  assert.match(HOSPITAL_RECOVERY.lackeyLine, /blood bag/i);
  assert.match(HOSPITAL_RECOVERY.lackeyLine, /car outside/i);
});

test("black-frame recovery clears transient pursuit and revives at the hospital", () => {
  const code = source("phaser/src/combat/DeathRecoverySystem.js");
  assert.match(code, /completeHospitalRecovery\(\)/);
  assert.match(code, /heatSystem\?\.clear/);
  assert.match(code, /resetAfterPlayerDeath/);
  assert.match(code, /motorizedPoliceSystem\?\.clearUnits/);
  assert.match(code, /playerDamageSystem\?\.revive/);
  assert.match(code, /cityStreamSystem\?\.updateFocus/);
  assert.match(code, /death:hospital-recovered/);
});

test("hospital scene includes a lackey, blood bag interaction and owned replacement car", () => {
  const code = source("phaser/src/combat/DeathRecoverySystem.js");
  const scene = source("phaser/src/scenes/GameScene.js");
  assert.match(code, /HOSPITAL_RECOVERY\.lackeyId/);
  assert.match(code, /Drink blood bag/);
  assert.match(code, /relieveHunger/);
  assert.match(code, /restoreVitality/);
  assert.match(code, /addTransientVehicle/);
  assert.match(code, /VEHICLE_OWNERSHIP\.OWNED/);
  assert.match(scene, /deathRecoverySystem\?\.collectInteractions/);
});

test("all police attack authorities respect the same post-hospital grace", () => {
  const police = source("phaser/src/systems/PoliceSystem.js");
  const motorized = source("phaser/src/police/MotorizedPoliceSystem.js");
  const firearms = source("phaser/src/combat/PoliceFirearmSystem.js");
  assert.match(police, /policeReacquisitionGraceUntil/);
  assert.match(police, /wantedLevel\(\)[\s\S]*inReacquisitionGrace/);
  assert.match(motorized, /scene\.policeSystem\?\.wantedLevel/);
  assert.match(firearms, /scene\.policeSystem\?\.wantedLevel/);
});
