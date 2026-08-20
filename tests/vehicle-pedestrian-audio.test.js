import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const consequences = readFileSync(
  new URL("../phaser/src/vehicles/VehicleConsequences.js", import.meta.url),
  "utf8"
);
const driving = readFileSync(
  new URL("../phaser/src/vehicles/VehicleDriving.js", import.meta.url),
  "utf8"
);

test("vehicle pedestrian impacts trigger civilian panic audio once through the shared cooldown", () => {
  assert.match(consequences, /import \{ RawAudio \} from "\.\.\/systems\/RawAudioSystem\.js";/);
  assert.match(
    consequences,
    /const lethal = impactSpeed >= 82;\s*RawAudio\.play\("civilianScream", \{ cooldown: 0\.75 \}\);/
  );
  assert.match(consequences, /witnessSystem\?\.onMundaneViolence\?\./);
});

test("nearby civilians can react to hearing an atropello without becoming visual witnesses", () => {
  assert.match(consequences, /function reactToHeardPedestrianImpact\(system, victim, impactSpeed\)/);
  assert.match(consequences, /\[NPC_TYPES\.CIVILIAN, NPC_TYPES\.TARGET\]\.includes\(npc\.type\)/);
  assert.match(consequences, /const sawImpact = Boolean\(system\.scene\.witnessSystem\?\.canWitnessSee\?\./);
  assert.match(consequences, /if \(sawImpact\) continue;/);
  assert.match(consequences, /npc\.soundReactionTimer = Math\.max/);
  assert.match(consequences, /system\.scene\.aiStateSystem\?\.resolveNpc\?\.\(npc\);/);
  assert.match(consequences, /heardOnlyCivilians = reactToHeardPedestrianImpact\(system, npc, impactSpeed\);/);
  assert.doesNotMatch(consequences, /reactToHeardPedestrianImpact[\s\S]*?alarmWitness/);
});

test("world and streetscape collisions do not reuse civilian scream audio", () => {
  const worldCollision = driving.match(/export function handleVehicleWorldCollision[\s\S]*?\n}\n\nexport function updateVehicleDriving/);
  assert.ok(worldCollision, "expected authoritative world-collision function");
  assert.doesNotMatch(worldCollision[0], /civilianScream/);
});
