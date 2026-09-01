import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const seed = JSON.parse(fs.readFileSync("docs/audio/radio-runtime-seed-set.json", "utf8"));

test("runtime radio seed locks nine acquired tracks as three stations and drops the three unacquired candidates", () => {
  assert.equal(seed.schemaVersion, 1);
  assert.equal(seed.decision, "ship-with-nine-acquired-masters");
  assert.equal(seed.tracks.length, 9);
  assert.equal(seed.droppedAfterApproval.length, 3);

  const ids = new Set(seed.tracks.map((track) => track.id));
  assert.equal(ids.size, 9);
  for (const track of seed.tracks) {
    assert.match(track.runtimeFilename, /\.mp3$/i);
  }

  assert.deepEqual(seed.stationCounts, {
    "vice-fm": 3,
    "night-shift": 3,
    "pulse-94-6": 3
  });

  const droppedIds = seed.droppedAfterApproval.map((track) => track.id).sort();
  assert.deepEqual(droppedIds, [
    "1000-handz-architexture-cobabeats",
    "1000-handz-kyoto",
    "kulakovka-trip-hop"
  ]);
});
