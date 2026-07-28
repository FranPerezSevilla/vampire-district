import test from "node:test";
import assert from "node:assert/strict";

import {
  SOUND_CATALOG,
  SOUND_IDS,
  resolvedSounds,
  soundDefinition,
  unresolvedSounds
} from "../phaser/src/audio/SoundCatalog.js";

test("sound catalogue exposes unique stable IDs", () => {
  assert.ok(SOUND_IDS.length >= 90, "catalogue should cover the planned audio pass");
  assert.equal(new Set(SOUND_IDS).size, SOUND_IDS.length);
  for (const id of SOUND_IDS) assert.equal(SOUND_CATALOG[id].id, id);
});

test("every sound definition contains integration metadata", () => {
  const validPriorities = new Set(["normal", "high", "critical"]);
  for (const entry of Object.values(SOUND_CATALOG)) {
    assert.ok(entry.category, `${entry.id} needs a category`);
    assert.ok(entry.trigger, `${entry.id} needs an invocation trigger`);
    assert.equal(typeof entry.loop, "boolean");
    assert.equal(typeof entry.spatial, "boolean");
    assert.ok(validPriorities.has(entry.priority), `${entry.id} has invalid priority`);
    assert.ok(entry.volume >= 0 && entry.volume <= 1, `${entry.id} volume must be normalized`);
  }
});

test("current procedural RawAudio events remain represented", () => {
  const existing = [
    "step", "sprintStep", "dash", "dashFail", "whisper", "whisperFail", "sense",
    "stun", "kill", "drainStart", "drainComplete", "drainCancel", "bodyDrag",
    "bodyDrop", "bodyHide", "breakLight", "routeRoof", "routeClimb", "routeSewer",
    "witnessWtf", "witnessRun", "witnessReport", "masqueradeFail", "police", "hunter",
    "missionComplete", "menu", "confirm", "cancel"
  ];

  for (const id of existing) {
    const entry = soundDefinition(id);
    assert.ok(entry, `missing existing RawAudio event ${id}`);
    assert.equal(entry.fallback, id, `${id} should retain its procedural fallback`);
  }
});

test("resolution helpers divide filled and pending assets", () => {
  assert.equal(resolvedSounds().length + unresolvedSounds().length, SOUND_IDS.length);
  assert.equal(unresolvedSounds().length, SOUND_IDS.length);
});
