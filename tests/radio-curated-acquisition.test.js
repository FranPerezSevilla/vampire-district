import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadLedger, sha256File } from "../tools/radio-curator/hash-acquired-audio.js";

test("curated radio acquisition ledger covers twelve approved tracks with safe repository policy", () => {
  const ledger = loadLedger();
  assert.equal(ledger.schemaVersion, 1);
  assert.equal(ledger.tracks.length, 12);

  const ids = new Set();
  const filenames = new Set();
  const stationCounts = new Map();

  for (const track of ledger.tracks) {
    assert.ok(!ids.has(track.id), `duplicate id ${track.id}`);
    ids.add(track.id);
    assert.ok(!filenames.has(track.expectedMasterFilename), `duplicate filename ${track.expectedMasterFilename}`);
    filenames.add(track.expectedMasterFilename);
    assert.match(track.expectedMasterFilename, /\.mp3$/i);
    assert.equal(track.acquisitionStatus, "official-interactive-download-pending");
    assert.equal(track.sha256, null);
    assert.equal(track.sizeBytes, null);
    assert.equal(track.acquiredAt, null);
    assert.equal(track.sourceEvidence.checkedAt, "2026-08-24");
    assert.match(track.sourceUrl, /^https:\/\//);
    assert.match(track.licenseUrl, /^https:\/\//);

    stationCounts.set(track.stationId, (stationCounts.get(track.stationId) || 0) + 1);

    if (track.licenseClass === "Pixabay-Content-License") {
      assert.equal(track.publicRepoMasterPolicy, "do-not-commit-standalone-master");
      assert.equal(track.requiredCredit, null);
      assert.ok(track.courtesyCredit);
    } else if (track.licenseClass === "CC-BY-4.0") {
      assert.ok(track.requiredCredit);
      assert.equal(track.contentId, "not-applicable");
    } else {
      assert.fail(`unsupported license class ${track.licenseClass}`);
    }
  }

  assert.deepEqual(Object.fromEntries([...stationCounts.entries()].sort()), {
    "blood-city-beats": 3,
    "night-shift": 3,
    "pulse-94-6": 3,
    "vice-fm": 3
  });
});

test("acquisition hasher emits stable SHA-256 for an exact master file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "viceblood-radio-acquisition-"));
  const file = path.join(dir, "fixture.mp3");
  fs.writeFileSync(file, Buffer.from("abc", "utf8"));
  assert.equal(
    sha256File(file),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  );
});
