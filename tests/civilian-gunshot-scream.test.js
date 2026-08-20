import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../phaser/src/systems/WeaponSystem.js", import.meta.url), "utf8");

test("heard-only civilians can scream at nearby gunfire without becoming visual witnesses", () => {
  assert.match(source, /let heardOnlyCivilians = 0;/);
  assert.match(source, /\[NPC_TYPES\.CIVILIAN, NPC_TYPES\.TARGET\]\.includes\(npc\.type\)\) heardOnlyCivilians\+\+;/);
  assert.match(source, /if \(heardOnlyCivilians\) RawAudio\.play\("civilianScream", \{ cooldown: 0\.75 \}\);/);
  assert.match(source, /else if \(heardOnly\) RawAudio\.play\("witnessWtf", \{ cooldown: 0\.4 \}\);/);
});
