import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("driving owns automatic gear state and a future-facing shift event", () => {
  const driving = source("phaser/src/vehicles/VehicleDriving.js");
  const view = source("phaser/src/vehicles/VehicleView.js");
  assert.match(driving, /vehicle\.gearShiftTimer/);
  assert.match(driving, /"vehicle:gear-shift"/);
  assert.match(view, /gearText/);
  assert.match(view, /G\$\{gear\}/);
});

test("vehicle camera recenters on exit and look-ahead remains driving-only", () => {
  const interactions = source("phaser/src/vehicles/VehicleInteractions.js");
  const driving = source("phaser/src/vehicles/VehicleDriving.js");
  assert.match(driving, /camera\.setFollowOffset\(-system\.cameraLookAheadX, -system\.cameraLookAheadY\)/);
  assert.match(interactions, /setFollowOffset\(0, 0\)/);
  assert.match(interactions, /cameraLookAheadX = 0/);
  assert.match(interactions, /cameraLookAheadY = 0/);
});
