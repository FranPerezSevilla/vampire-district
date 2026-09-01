import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildMidiFile,
  inspectMidiBuffer,
  sha256,
  validateCandidateFiles,
  validateManifest
} from "./midi-workbench.js";

export function createSmokeCandidate(outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "viceblood-radio-midi-"))) {
  fs.mkdirSync(outputDir, { recursive: true });
  const midi = buildMidiFile({
    title: "Radio Composer Smoke Fixture",
    bpm: 96,
    markers: [
      { beat: 0, label: "INTRO" },
      { beat: 4, label: "LOOP" }
    ],
    tracks: [
      {
        name: "01 Synthetic Motif",
        channel: 0,
        program: 0,
        notes: [
          { start: 0, duration: 1, note: 60, velocity: 72 },
          { start: 1, duration: 1, note: 63, velocity: 68 },
          { start: 2, duration: 2, note: 67, velocity: 76 }
        ]
      },
      {
        name: "02 Placeholder Drums",
        channel: 9,
        notes: [
          { start: 0, duration: 0.08, note: 36, velocity: 82 },
          { start: 1, duration: 0.08, note: 38, velocity: 76 },
          { start: 2, duration: 0.08, note: 36, velocity: 78 },
          { start: 3, duration: 0.08, note: 38, velocity: 80 }
        ]
      }
    ]
  });
  const info = inspectMidiBuffer(midi);
  const manifest = {
    schemaVersion: 1,
    id: "radio-composer-smoke-fixture",
    stationId: "tooling-smoke",
    workingTitle: "Radio Composer Smoke Fixture",
    sourceWork: "Synthetic tooling fixture",
    sourceComposer: "ViceBlood tooling",
    sourceEditionOrCatalogue: "not-applicable",
    sourceUrl: "internal://tools/radio-composer/smoke",
    sourceStatus: "synthetic-fixture",
    sourceReuseTerms: "internal synthetic test material",
    sourceCheckedAt: "2026-08-22",
    arrangementLane: "tooling-smoke",
    bpm: 96,
    durationSeconds: Number(((info.endTick / info.ppq) * 60 / info.bpm).toFixed(3)),
    midiTracks: info.trackNames.slice(1),
    status: "fixture",
    userReview: "not-requested",
    attribution: {
      creditMode: "internal-only",
      playerCredit: "Synthetic internal tooling fixture — not for release",
      internalSourceCredit: "Generated entirely by tools/radio-composer/smoke.js",
      licenseOrStatus: "internal synthetic test material",
      thirdPartyAssets: []
    },
    sha256: sha256(midi)
  };
  const errors = validateManifest(manifest);
  if (errors.length) throw new Error(errors.join("\n"));

  const midiPath = path.join(outputDir, "radio-composer-smoke.mid");
  const manifestPath = path.join(outputDir, "radio-composer-smoke.json");
  fs.writeFileSync(midiPath, midi);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const validation = validateCandidateFiles(midiPath, manifestPath);
  return { outputDir, midiPath, manifestPath, validation };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const result = createSmokeCandidate(process.argv[2]);
  console.log(`radio-composer smoke ok: ${result.midiPath}`);
  console.log(`tracks: ${result.validation.midiInfo.trackNames.join(", ")}`);
  console.log(`sha256: ${result.validation.sha256}`);
}
