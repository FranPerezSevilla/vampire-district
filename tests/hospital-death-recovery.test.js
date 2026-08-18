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

test("hospital arrival holds control for conventional lackey dialogue, departure, then releases full input", () => {
  const code = source("phaser/src/combat/DeathRecoverySystem.js");
  assert.equal(HOSPITAL_RECOVERY.lackeySpeaker, "LACKEY");
  assert.ok(HOSPITAL_RECOVERY.lackeyDepartureMs >= 700);
  assert.match(code, /lockRecoveryControls\(\)/);
  assert.match(code, /speaker: HOSPITAL_RECOVERY\.lackeySpeaker/);
  assert.match(code, /kind: "spoken"/);
  assert.match(code, /await this\.departLackey\(\)/);
  assert.match(code, /setControlMode\?\.\("locked"\)/);
  assert.match(code, /setControlMode\?\.\("full"\)/);
  assert.match(code, /setWorldEnabled\?\.\(true\)/);
  assert.match(code, /hospitalRecoveryIntroComplete/);
  const departure = code.indexOf("await this.departLackey()");
  const release = code.indexOf("this.releaseRecoveryControls()", departure);
  assert.ok(departure >= 0 && release > departure);
});

test("police grace is refreshed when control is returned, not consumed during the lackey beat", () => {
  const code = source("phaser/src/combat/DeathRecoverySystem.js");
  const releaseStart = code.indexOf("releaseRecoveryControls()");
  const readyEvent = code.indexOf('"death:hospital-recovery-ready"');
  assert.ok(releaseStart >= 0);
  assert.ok(readyEvent > releaseStart);
  const releaseBody = code.slice(releaseStart, readyEvent);
  assert.match(releaseBody, /resetAfterPlayerDeath\?\.\(HOSPITAL_RECOVERY\.policeGraceMs\)/);
});
