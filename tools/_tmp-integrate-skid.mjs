import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const write = (path, text) => fs.writeFileSync(path, text);

const rawPath = "phaser/src/systems/RawAudioSystem.js";
let raw = read(rawPath);

if (!raw.includes("this.sampleLoopTimers = new Map();")) {
  const before = "    this.sampleLoops = new Map();\n    this.sampleLoopWanted = new Set();\n";
  if (!raw.includes(before)) throw new Error("RawAudio constructor anchor missing");
  raw = raw.replace(before, before + "    this.sampleLoopTimers = new Map();\n");
}

if (!raw.includes("pulseSampleLoop(name, options = {})")) {
  const before = `  stopSampleLoop(name) {\n    this.sampleLoopWanted.delete(name);\n    const handle = this.sampleLoops.get(name);\n    if (!handle) return false;\n    this.sampleLoops.delete(name);\n    try { handle.source.stop(); } catch {}\n    try { handle.source.disconnect(); } catch {}\n    try { handle.gain.disconnect(); } catch {}\n    return true;\n  }\n`;
  if (!raw.includes(before)) throw new Error("RawAudio stopSampleLoop anchor missing");
  const after = `  pulseSampleLoop(name, options = {}) {\n    const hold = Math.max(0.16, Number(options.hold) || 0.34);\n    const started = this.startSampleLoop(name, options);\n    const previousTimer = this.sampleLoopTimers.get(name);\n    if (previousTimer && typeof window !== "undefined") window.clearTimeout(previousTimer);\n    if (typeof window !== "undefined") {\n      const timer = window.setTimeout(() => {\n        this.sampleLoopTimers.delete(name);\n        this.stopSampleLoop(name);\n      }, hold * 1000);\n      this.sampleLoopTimers.set(name, timer);\n    }\n    // Keep immediate feedback while a newly unlocked browser is still\n    // decoding the real loop. Once loaded, subsequent pulses sustain\n    // the sample-backed loop instead of retriggering one-shots.\n    if (!started && name === "vehicleSkidLoop") this.vehicleSkid();\n    return started;\n  }\n\n  stopSampleLoop(name) {\n    this.sampleLoopWanted.delete(name);\n    const timer = this.sampleLoopTimers.get(name);\n    if (timer && typeof window !== "undefined") window.clearTimeout(timer);\n    this.sampleLoopTimers.delete(name);\n    const handle = this.sampleLoops.get(name);\n    if (!handle) return false;\n    this.sampleLoops.delete(name);\n    try { handle.source.stop(); } catch {}\n    try { handle.source.disconnect(); } catch {}\n    try { handle.gain.disconnect(); } catch {}\n    return true;\n  }\n`;
  raw = raw.replace(before, after);
}

if (!raw.includes('name === "vehicleSkidLoop" && sampleAudioDefinition(name)?.loop')) {
  const before = "    if (this.playSample(name, options)) return;\n";
  if (!raw.includes(before)) throw new Error("RawAudio playSample anchor missing");
  const after = `    if (name === "vehicleSkidLoop" && sampleAudioDefinition(name)?.loop) {\n      this.pulseSampleLoop(name, { ...options, hold: 0.34 });\n      return;\n    }\n\n    if (this.playSample(name, options)) return;\n`;
  raw = raw.replace(before, after);
}
write(rawPath, raw);

const testPath = "tests/vehicle-skid-audio.test.js";
write(testPath, `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { readFileSync } from "node:fs";\nimport { SAMPLE_AUDIO_CATALOG } from "../phaser/src/audio/SampleAudioCatalog.js";\n\nconst repoFile = path => new URL(\`../\${path}\`, import.meta.url);\n\ntest("vehicleSkidLoop is a committed PCM loop sustained by aggressive-driving pulses", () => {\n  const definition = SAMPLE_AUDIO_CATALOG.vehicleSkidLoop;\n  assert.deepEqual(definition.files, ["phaser/assets/audio/vehicles/vehicle-skid-loop-01.wav"]);\n  assert.equal(definition.loop, true);\n  assert.equal(definition.volume, 0.68);\n\n  const wav = readFileSync(repoFile(definition.files[0]));\n  assert.ok(wav.length > 50_000);\n  assert.equal(wav.subarray(0, 4).toString("ascii"), "RIFF");\n  assert.equal(wav.subarray(8, 12).toString("ascii"), "WAVE");\n\n  const rawAudio = readFileSync(repoFile("phaser/src/systems/RawAudioSystem.js"), "utf8");\n  const driving = readFileSync(repoFile("phaser/src/vehicles/VehicleDriving.js"), "utf8");\n  assert.match(rawAudio, /pulseSampleLoop\\(name, options = \\{\\}\\)/);\n  assert.match(rawAudio, /name === "vehicleSkidLoop" && sampleAudioDefinition\\(name\\)\\?\\.loop/);\n  assert.match(rawAudio, /hold: 0\\.34/);\n  assert.match(rawAudio, /sampleLoopTimers/);\n  assert.match(driving, /RawAudio\\.play\\("vehicleSkidLoop", \\{ cooldown: 0\\.16 \\}\\)/);\n  assert.match(driving, /panicCiviliansFromAggressiveDriving\\(system, vehicle, intensity\\)/);\n});\n`);

const docsPath = "docs/audio-catalog.md";
let docs = read(docsPath);
if (!docs.includes("- `vehicleSkidLoop` — **integrated candidate on PR #55")) {
  const policeLine = "- `policeSirenLoop` — **integrated candidate on PR #55, pending listening acceptance**: the supplied szpury/Freesound siren is kept at its authored loop boundaries and materialized as a PCM WAV runtime loop. Each motorized police cruiser owns an independent instance with distance attenuation and stereo pan. The loop can become audible before the cruiser is rendered locally, grows as the unit approaches, remains attached to the cruiser after officers dismount, and stops when the unit retires, is disabled, leaves audible range, the player leaves street level, or UI pause owns the scene.\n";
  const skidLine = "- `vehicleSkidLoop` — **integrated candidate on PR #55, pending listening acceptance**: the supplied MagiaZ tyre skid is trimmed into a gap-sensitive PCM WAV loop. Aggressive-driving pulses sustain one stateful loop while the drift continues and let it stop shortly after the skid ends; civilian panic remains a separate non-reporting reaction with no Heat.\n";
  if (!docs.includes(policeLine)) throw new Error("audio-catalog police anchor missing");
  docs = docs.replace(policeLine, policeLine + skidLine);
}
docs = docs.replace(
  "- `vehicleSkidLoop` — currently procedural and gameplay-wired to aggressive driving; replace with a real tyre-skid loop next",
  "- `vehicleSkidLoop` — **integrated candidate:** real gap-sensitive PCM loop sustained while aggressive drifting continues; pending listening acceptance"
);
docs = docs.replace(
  "Given the newly gameplay-wired aggressive-driving panic, source `vehicleSkidLoop` next, then `ambienceStreetNight`.",
  "With `policeSirenLoop` and `vehicleSkidLoop` now wired as listening candidates, continue sourcing with `ambienceStreetNight`."
);
write(docsPath, docs);

const failedHelper = ".github/workflows/integrate-vehicle-skid-audio.yml";
if (fs.existsSync(failedHelper)) fs.unlinkSync(failedHelper);

const workflowPath = ".github/workflows/materialize-audio-assets.yml";
let workflow = read(workflowPath);
const marker = `\n      # TEMP_SKID_INTEGRATION_BEGIN\n      - name: Integrate real vehicle skid loop\n        shell: bash\n        run: node tools/_tmp-integrate-skid.mjs\n      # TEMP_SKID_INTEGRATION_END\n`;
if (!workflow.includes(marker)) throw new Error("temporary materializer marker missing");
workflow = workflow.replace(marker, "\n");
write(workflowPath, workflow);

fs.unlinkSync("tools/_tmp-integrate-skid.mjs");
