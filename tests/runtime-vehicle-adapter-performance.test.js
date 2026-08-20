import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  enrichVehicleInputFrame,
  filterVehicleAwareInteractions
} from "../phaser/src/runtime/VehicleRuntimeAdapter.js";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("vehicle input enrichment mutates the existing frame instead of cloning it", () => {
  const frame = {
    menuConfirmPressed: true,
    interactPressed: false,
    traversePressed: false,
    quietHeld: true
  };
  const result = enrichVehicleInputFrame(frame, true);
  assert.equal(result, frame);
  assert.equal(frame.vehicleActionPressed, true);
  assert.equal(frame.traversePressed, true);
  assert.equal(frame.handbrakeHeld, true);
  assert.equal(frame.quietHeld, true);
});

test("vehicle-aware interaction filtering allocates only when an input edge requires filtering", () => {
  const options = [
    { id: "door", type: "vehicleEnter" },
    { id: "stairs", type: "traverse" },
    { id: "talk", type: "interact" }
  ];
  const isVehicle = option => option.type === "vehicleEnter" || option.type === "vehicleExit";

  const untouched = filterVehicleAwareInteractions(options, {}, isVehicle);
  assert.equal(untouched, options);
  assert.deepEqual(
    filterVehicleAwareInteractions(options, { vehicleActionPressed: true }, isVehicle).map(option => option.id),
    ["door"]
  );
  assert.deepEqual(
    filterVehicleAwareInteractions(options, { traversePressed: true }, isVehicle).map(option => option.id),
    ["stairs", "talk"]
  );
});

test("GameplayRuntime reuses bound vehicle adapters instead of creating frame-local wrappers", () => {
  const runtime = source("phaser/src/runtime/GameplayRuntime.js");
  assert.match(runtime, /this\.vehicleAwareInputFrame = this\.vehicleAwareInputFrame\.bind\(this\)/);
  assert.match(runtime, /this\.vehicleAwareInteractions = this\.vehicleAwareInteractions\.bind\(this\)/);
  assert.match(runtime, /input\.beginFrame = this\.vehicleAwareInputFrame/);
  assert.match(runtime, /scene\.collectInteractions = this\.vehicleAwareInteractions/);
  assert.doesNotMatch(runtime, /input\.beginFrame = function vehicleAwareInputFrame/);
  assert.doesNotMatch(runtime, /scene\.collectInteractions = function vehicleAwareInteractions/);
  assert.doesNotMatch(runtime, /const enriched = \{/);
});
