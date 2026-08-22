import path from "node:path";
import { validateCandidateFiles } from "./midi-workbench.js";

const [, , midiPath, manifestPath] = process.argv;
if (!midiPath || !manifestPath) {
  console.error("Usage: node tools/radio-composer/validate-candidate.js <candidate.mid> <candidate.json>");
  process.exit(2);
}

try {
  const result = validateCandidateFiles(path.resolve(midiPath), path.resolve(manifestPath));
  console.log(`valid radio MIDI candidate: ${midiPath}`);
  console.log(`tempo: ${result.midiInfo.bpm.toFixed(3)} BPM`);
  console.log(`tracks: ${result.midiInfo.trackNames.join(", ")}`);
  console.log(`sha256: ${result.sha256}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
