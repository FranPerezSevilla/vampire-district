import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_AUDIO_CATALOG } from "../phaser/src/audio/SampleAudioCatalog.js";

const repoFile = path => new URL(`../${path}`, import.meta.url);
const source = path => readFileSync(repoFile(path), "utf8");

function assertMp3(path) {
  const data = readFileSync(repoFile(path));
  assert.ok(data.length > 5_000, `${path} should contain a processed horn sample`);
  const hasId3 = data.subarray(0, 3).toString("ascii") === "ID3";
  const hasFrameSync = data[0] === 0xff && (data[1] & 0xe0) === 0xe0;
  assert.ok(hasId3 || hasFrameSync, `${path} should be an MP3 stream`);
}

test("vehicleHorn registers three natural press-length variants", () => {
  const files = [
    "phaser/assets/audio/vehicles/vehicle-horn-01.mp3",
    "phaser/assets/audio/vehicles/vehicle-horn-02.mp3",
    "phaser/assets/audio/vehicles/vehicle-horn-03.mp3"
  ];
  assert.deepEqual(SAMPLE_AUDIO_CATALOG.vehicleHorn.files, files);
  assert.equal(SAMPLE_AUDIO_CATALOG.vehicleHorn.volume, 0.78);
  assert.equal(SAMPLE_AUDIO_CATALOG.vehicleHorn.loop, false);
  files.forEach(assertMp3);
});

test("H is a remappable horn edge in the central input frame", () => {
  const actions = source("phaser/src/input/actions.js");
  const bindings = source("phaser/src/input/bindings.js");
  const input = source("phaser/src/input/InputSystem.js");
  assert.match(actions, /HORN: "horn"/);
  assert.match(actions, /hornPressed: false/);
  assert.match(actions, /hornPressed: allows\(INPUT_ACTIONS\.HORN\)/);
  assert.match(bindings, /horn: "H"/);
  assert.match(bindings, /"horn"/);
  assert.match(input, /horn: "horn"/);
  assert.match(input, /hornPressed: this\.justDown\(this\.keys\.horn\)/);
});

test("shared H shortcut preserves the menu on foot and horn ownership while driving", () => {
  const ui = source("phaser/src/scenes/UIScene.js");
  assert.match(ui, /const hornOwnsH = code === "KeyH"[\s\S]*vehicleSystem\?\.isDriving\?\.\(\)/);
  assert.match(ui, /const uiOwnsH = code === "KeyH" && !hornOwnsH/);
  assert.match(ui, /event\.defaultPrevented && code !== "Escape" && !uiOwnsH/);
  assert.match(ui, /else if \(code === "KeyH"\) \{[\s\S]*if \(uiOwnsH &&/);
});

test("the player horn is owned by active vehicle driving and never creates Heat", () => {
  const driving = source("phaser/src/vehicles/VehicleDriving.js");
  const start = driving.indexOf("export function updateVehicleDriving");
  const end = driving.indexOf("export function updateVehicleCamera", start);
  const block = driving.slice(start, end);
  assert.match(block, /frame\?\.hornPressed && !vehicle\.disabled/);
  assert.match(block, /RawAudio\.play\("vehicleHorn", \{ cooldown: 0\.24 \}\)/);
  assert.match(block, /"vehicle:horn"/);
  assert.doesNotMatch(block, /addHeat/);
});

test("vehicleHorn retains a procedural loading fallback", () => {
  const raw = source("phaser/src/systems/RawAudioSystem.js");
  assert.match(raw, /case "vehicleHorn": return this\.vehicleHorn\(\);/);
  assert.match(raw, /vehicleHorn\(\) \{/);
});
