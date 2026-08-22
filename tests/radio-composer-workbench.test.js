import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildMidiFile,
  inspectMidiBuffer,
  validateManifest,
  validateCandidateFiles
} from "../tools/radio-composer/midi-workbench.js";
import { createSmokeCandidate } from "../tools/radio-composer/smoke.js";

test("radio composer writes a named Type-1 MIDI with conductor metadata", () => {
  const midi = buildMidiFile({
    title: "Unit Fixture",
    bpm: 92,
    markers: [{ beat: 0, label: "A" }],
    tracks: [{
      name: "01 Motif",
      channel: 0,
      program: 0,
      notes: [{ start: 0, duration: 1, note: 60, velocity: 70 }]
    }]
  });
  const info = inspectMidiBuffer(midi);
  assert.equal(info.format, 1);
  assert.equal(info.ppq, 480);
  assert.equal(info.trackCount, 2);
  assert.deepEqual(info.trackNames, ["00 Conductor", "01 Motif"]);
  assert.ok(Math.abs(info.bpm - 92) < 0.01);
  assert.equal(info.noteOnCount, 1);
});

test("radio composer validator rejects malformed MIDI", () => {
  assert.throws(() => inspectMidiBuffer(Buffer.from("not midi")), /invalid MIDI header/);
});

test("manifest validation requires attribution and source metadata", () => {
  const errors = validateManifest({
    id: "broken",
    stationId: "blood-city-beats",
    workingTitle: "Broken",
    bpm: 90,
    durationSeconds: 60,
    midiTracks: ["01 Motif"],
    status: "daw-candidate",
    userReview: "approved"
  });
  assert.ok(errors.some((error) => error.includes("sourceWork")));
  assert.ok(errors.some((error) => error.includes("attribution")));
});

test("smoke fixture writes MIDI + manifest and validates them together", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "viceblood-radio-test-"));
  const result = createSmokeCandidate(dir);
  const verified = validateCandidateFiles(result.midiPath, result.manifestPath);
  assert.deepEqual(verified.midiInfo.trackNames, [
    "00 Conductor",
    "01 Synthetic Motif",
    "02 Placeholder Drums"
  ]);
  assert.equal(verified.manifest.status, "fixture");
  assert.equal(verified.manifest.attribution.creditMode, "internal-only");
});
