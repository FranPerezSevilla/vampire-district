import test from "node:test";
import assert from "node:assert/strict";
import { buildControlReference } from "../phaser/src/ui/ControlReference.js";

test("main-menu control reference covers active on-foot, combat, power, driving and menu inputs", () => {
  const text = buildControlReference();

  for (const expected of [
    "ON FOOT",
    "Move",
    "Quiet movement",
    "Interact / dialogue / evidence",
    "Traverse available routes",
    "COMBAT & FEEDING",
    "Mouse  Aim",
    "Left mouse  Use equipped weapon",
    "Hold right mouse  Feed / Drain",
    "Mouse wheel  Change weapon",
    "POWERS",
    "Dash",
    "Whisper",
    "Blood Sense",
    "Give In",
    "DRIVING",
    "Accelerate / brake",
    "Steer",
    "Handbrake",
    "Enter / exit vehicle",
    "Horn",
    "MENUS",
    "Pause / back",
    "M  Mission",
    "L  Night Ledger"
  ]) assert.match(text, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("control reference derives remappable labels from the active binding authority", () => {
  const text = buildControlReference({
    w: "Z",
    a: "X",
    s: "C",
    d: "V",
    quiet: "ALT",
    interact: "G",
    dash: "J",
    whisper: "K",
    sense: "N",
    horn: "U",
    beast: "P",
    confirm: "T",
    cancel: "Y",
    traverse: "O"
  });

  assert.match(text, /Z\/X\/C\/V/);
  assert.match(text, /Alt  Quiet movement/);
  assert.match(text, /G  Interact/);
  assert.match(text, /J  Dash · K  Whisper/);
  assert.match(text, /N  Blood Sense · P  Give In/);
  assert.match(text, /O  Handbrake · T  Enter \/ exit vehicle/);
  assert.match(text, /U  Horn/);
  assert.match(text, /Y  Pause \/ back/);
});
