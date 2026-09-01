import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  validateCandidateFiles,
  sha256
} from "../tools/radio-composer/midi-workbench.js";
import {
  buildMapleLeafGfunkC,
  MAPLE_LEAF_GFUNK_C_PLAN
} from "../tools/radio-composer/proofs/m1-4-maple-leaf-gfunk-c.js";

test("M1.4 Vice FM C remains a deterministic but musically rejected historical experiment", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "viceblood-maple-c-"));
  const midiPath = path.join(dir, "maple-leaf-gfunk-c.mid");
  const first = buildMapleLeafGfunkC();
  const second = buildMapleLeafGfunkC();

  assert.equal(sha256(first), sha256(second), "M1.4 C recipe must remain deterministic as historical R&D");
  fs.writeFileSync(midiPath, first);

  const verified = validateCandidateFiles(
    midiPath,
    "phaser/assets/audio/radio-midi/vice-fm/maple-leaf-gfunk-c.json"
  );
  const durationSeconds = (verified.midiInfo.endTick / verified.midiInfo.ppq) * (60 / verified.midiInfo.bpm);

  assert.equal(verified.midiInfo.format, 1);
  assert.equal(verified.midiInfo.ppq, 480);
  assert.equal(verified.midiInfo.trackCount, 12);
  assert.ok(Math.abs(verified.midiInfo.bpm - 94) < 0.01);
  assert.ok(durationSeconds >= 128 && durationSeconds <= 136, `duration=${durationSeconds}`);

  assert.equal(verified.manifest.status, "rejected");
  assert.equal(verified.manifest.userReview, "revise");
  assert.equal(verified.manifest.reviewFeedback.verdict, "rejected-prefer-B");
  assert.equal(verified.manifest.reviewFeedback.strategicOutcome, "Autonomous catalogue composition paused; finished licensed-track curation is canonical.");
  assert.equal(verified.manifest.stationEmphasis, "hip-hop-first-funk-forward");
  assert.equal(verified.manifest.proofBatch, "M1.4-vice-fm-style-refinement");
  assert.equal(verified.manifest.songCompleteness.coreBarsBelowFourRoles, 0);
  assert.ok(verified.manifest.songCompleteness.measuredCoreMinActiveRoles >= 5);
  assert.ok(verified.manifest.songCompleteness.measuredCoreAverageActiveRoles >= 6);
  assert.ok(verified.manifest.songCompleteness.measuredPeakActiveRoles >= 8);
  assert.deepEqual(verified.manifest.attribution.thirdPartyAssets, []);
  assert.match(verified.manifest.sourceStatus, /Public Domain/i);

  assert.equal(MAPLE_LEAF_GFUNK_C_PLAN.userDirection, "more hip-hop and more funk");
  assert.deepEqual(MAPLE_LEAF_GFUNK_C_PLAN.priorityOrder, [
    "hip-hop groove",
    "funk bass/riff",
    "hook identity",
    "harmonic color"
  ]);
});
