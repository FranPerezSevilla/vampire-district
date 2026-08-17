import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("motorized police has telegraphed on-foot ram and delayed officer deployment", () => {
  const code = source("phaser/src/police/MotorizedPoliceSystem.js");
  assert.match(code, /RAM_TELEGRAPH/);
  assert.match(code, /RAM_COMMIT/);
  assert.match(code, /processOnFootRam/);
  assert.match(code, /"police:player-rammed"/);
  assert.match(code, /dismountUnit\(unit\.id, "ram-complete"\)/);
  assert.match(code, /spawnSafetyRadius/);
});

test("driving pursuit pressures both rear quarters and uses a controlled PIT cooldown", () => {
  const code = source("phaser/src/police/MotorizedPoliceSystem.js");
  assert.match(code, /rearQuarterTarget\(vehicle, unit\.index/);
  assert.match(code, /PIT_TELEGRAPH/);
  assert.match(code, /PIT_COMMIT/);
  assert.match(code, /"police:pit-contact"/);
  assert.match(code, /vehicle\.speed \*= 0\.62/);
  assert.match(code, /this\.pitCooldownSeconds/);
});

test("roadblock leaves an intentional lateral escape gap and publishes tactics", () => {
  const code = source("phaser/src/police/MotorizedPoliceSystem.js");
  assert.match(code, /const lateral = 13/);
  assert.match(code, /MOTORIZED_POLICE_TACTICS\.ROADBLOCK/);
  assert.match(code, /tactic: unit\.tactic/);
  assert.match(code, /policeTacticLabel/);
});
