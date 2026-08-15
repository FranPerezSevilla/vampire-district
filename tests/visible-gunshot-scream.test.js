import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../phaser/src/systems/WeaponSystem.js", import.meta.url), "utf8");

test("first visible gunshot triggers immediate civilian panic audio", () => {
  assert.match(
    source,
    /if \(\[NPC_TYPES\.CIVILIAN, NPC_TYPES\.TARGET\]\.includes\(npc\.type\)\) \{\s*if \(!npc\.alarmed\) RawAudio\.play\("civilianScream", \{ cooldown: 0\.75 \}\);/
  );
});
