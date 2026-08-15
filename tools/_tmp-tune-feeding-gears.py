from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write(path, content):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(path, old, new):
    content = read(path)
    if old not in content:
        raise SystemExit(f"Expected fragment not found in {path}: {old[:160]!r}")
    write(path, content.replace(old, new, 1))


# ---------------------------------------------------------------------------
# Feeding: small level lift + narrative bus + world ducking.
# ---------------------------------------------------------------------------
replace_once(
    "phaser/src/audio/SampleAudioCatalog.js",
    '''const sampleEvent = (files, options = {}) => Object.freeze({
  files: Object.freeze([...files]),
  volume: options.volume ?? 1,
  loop: Boolean(options.loop)
});''',
    '''const sampleEvent = (files, options = {}) => Object.freeze({
  files: Object.freeze([...files]),
  volume: options.volume ?? 1,
  loop: Boolean(options.loop),
  bus: options.bus || "world"
});'''
)
replace_once(
    "phaser/src/audio/SampleAudioCatalog.js",
    '''  drainStart: sampleEvent([
    "phaser/assets/audio/feeding/drain-start-01.mp3"
  ], { volume: 1.0 }),
  drainLoop: sampleEvent([
    "phaser/assets/audio/feeding/drain-loop-01.wav"
  ], { volume: 0.9, loop: true }),
  drainComplete: sampleEvent([
    "phaser/assets/audio/feeding/drain-complete-01.mp3"
  ], { volume: 1.0 }),''',
    '''  drainStart: sampleEvent([
    "phaser/assets/audio/feeding/drain-start-01.mp3"
  ], { volume: 1.10, bus: "narrative" }),
  drainLoop: sampleEvent([
    "phaser/assets/audio/feeding/drain-loop-01.wav"
  ], { volume: 0.96, loop: true, bus: "narrative" }),
  drainComplete: sampleEvent([
    "phaser/assets/audio/feeding/drain-complete-01.mp3"
  ], { volume: 1.10, bus: "narrative" }),'''
)

replace_once(
    "phaser/src/systems/RawAudioSystem.js",
    '''const KEY_SET = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"]);
const MAX_VEHICLE_ENGINE_VOICES = 10;''',
    '''const KEY_SET = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"]);
const RAW_AUDIO_MASTER_GAIN = 0.20;
const NARRATIVE_DUCK_FACTOR = 0.54;
const MAX_VEHICLE_ENGINE_VOICES = 10;'''
)
replace_once(
    "phaser/src/systems/RawAudioSystem.js",
    '''    this.ctx = null;
    this.master = null;
    this.cooldowns = Object.create(null);''',
    '''    this.ctx = null;
    this.master = null;
    this.narrativeMaster = null;
    this.narrativeDuckKeys = new Set();
    this.cooldowns = Object.create(null);'''
)
replace_once(
    "phaser/src/systems/RawAudioSystem.js",
    '''      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.20;
      this.master.connect(this.ctx.destination);
      this.preloadRegisteredSamples();''',
    '''      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = RAW_AUDIO_MASTER_GAIN;
      this.master.connect(this.ctx.destination);
      this.narrativeMaster = this.ctx.createGain();
      this.narrativeMaster.gain.value = RAW_AUDIO_MASTER_GAIN;
      this.narrativeMaster.connect(this.ctx.destination);
      this.preloadRegisteredSamples();'''
)
replace_once(
    "phaser/src/systems/RawAudioSystem.js",
    '''  preloadRegisteredSamples() {
    if (!this.ctx || typeof fetch !== "function") return;
    for (const id of SAMPLE_AUDIO_IDS) this.loadSampleEvent(id);
  }
''',
    '''  sampleDestination(name) {
    const definition = sampleAudioDefinition(name);
    return definition?.bus === "narrative"
      ? (this.narrativeMaster || this.master)
      : this.master;
  }

  updateNarrativeDuck(timeConstant = 0.04) {
    if (!this.ctx || !this.master) return false;
    const target = RAW_AUDIO_MASTER_GAIN * (this.narrativeDuckKeys.size ? NARRATIVE_DUCK_FACTOR : 1);
    const now = this.ctx.currentTime;
    try {
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(target, now, Math.max(0.015, Number(timeConstant) || 0.04));
    } catch {
      this.master.gain.value = target;
    }
    return true;
  }

  beginNarrativeDuck(key = "default") {
    this.ensureListeners();
    this.unlock();
    this.narrativeDuckKeys.add(String(key || "default"));
    return this.updateNarrativeDuck(0.035);
  }

  endNarrativeDuck(key = "default") {
    this.narrativeDuckKeys.delete(String(key || "default"));
    return this.updateNarrativeDuck(0.12);
  }

  preloadRegisteredSamples() {
    if (!this.ctx || typeof fetch !== "function") return;
    for (const id of SAMPLE_AUDIO_IDS) this.loadSampleEvent(id);
  }
'''
)
replace_once(
    "phaser/src/systems/RawAudioSystem.js",
    '''      source.connect(gain);
      gain.connect(this.master);
      source.start();''',
    '''      source.connect(gain);
      gain.connect(this.sampleDestination(name));
      source.start();'''
)
replace_once(
    "phaser/src/systems/RawAudioSystem.js",
    '''      source.connect(gain);
      gain.connect(this.master);
      const handle = { source, gain };''',
    '''      source.connect(gain);
      gain.connect(this.sampleDestination(name));
      const handle = { source, gain };'''
)

replace_once(
    "phaser/src/playtest/FeedingAudioLoopPolicy.js",
    '''const FEED_LOOP_EVENT = "drainLoop";
const FEED_LOOP_DELAY_MS = 450;''',
    '''const FEED_LOOP_EVENT = "drainLoop";
const FEED_LOOP_DELAY_MS = 450;
const FEED_DUCK_KEY = "feeding";
const FEED_DUCK_RELEASE_MS = 320;'''
)
replace_once(
    "phaser/src/playtest/FeedingAudioLoopPolicy.js",
    '''    this.timer = null;
    this.generation = 0;''',
    '''    this.timer = null;
    this.duckReleaseTimer = null;
    this.generation = 0;'''
)
replace_once(
    "phaser/src/playtest/FeedingAudioLoopPolicy.js",
    '''  onFeedingStarted() {
    this.stopLoop();
    const generation = ++this.generation;''',
    '''  onFeedingStarted() {
    this.stopLoop();
    if (this.duckReleaseTimer != null) {
      window.clearTimeout(this.duckReleaseTimer);
      this.duckReleaseTimer = null;
    }
    RawAudio.beginNarrativeDuck?.(FEED_DUCK_KEY);
    const generation = ++this.generation;'''
)
replace_once(
    "phaser/src/playtest/FeedingAudioLoopPolicy.js",
    '''  onFeedingStopped() {
    this.generation += 1;
    this.stopLoop();
  }''',
    '''  onFeedingStopped() {
    this.generation += 1;
    this.stopLoop();
    if (this.duckReleaseTimer != null) window.clearTimeout(this.duckReleaseTimer);
    this.duckReleaseTimer = window.setTimeout(() => {
      this.duckReleaseTimer = null;
      RawAudio.endNarrativeDuck?.(FEED_DUCK_KEY);
    }, FEED_DUCK_RELEASE_MS);
  }'''
)
replace_once(
    "phaser/src/playtest/FeedingAudioLoopPolicy.js",
    '''      source.connect(gain);
      gain.connect(RawAudio.master);''',
    '''      source.connect(gain);
      gain.connect(RawAudio.sampleDestination?.(FEED_LOOP_EVENT) || RawAudio.master);'''
)
replace_once(
    "phaser/src/playtest/FeedingAudioLoopPolicy.js",
    '''  destroy() {
    this.generation += 1;
    this.stopLoop();''',
    '''  destroy() {
    this.generation += 1;
    this.stopLoop();
    if (this.duckReleaseTimer != null) {
      window.clearTimeout(this.duckReleaseTimer);
      this.duckReleaseTimer = null;
    }
    RawAudio.endNarrativeDuck?.(FEED_DUCK_KEY);'''
)

# ---------------------------------------------------------------------------
# Vehicles: keep the fast arcade acceleration, but stop rapid-fire upshifts.
# The existing gearShiftTimer becomes "active shift + post-shift dwell".
# ---------------------------------------------------------------------------
replace_once(
    "phaser/src/data/vehicles.js",
    'maxSpeed: 310, gearCount: 5, gearShiftDuration: 0.10, cameraLookAhead: 72,',
    'maxSpeed: 310, gearCount: 5, gearShiftDuration: 0.14, gearHoldDuration: 0.28, firstGearHoldDuration: 0.26, cameraLookAhead: 72,'
)
replace_once(
    "phaser/src/data/vehicles.js",
    'maxSpeed: 330, gearCount: 5, gearShiftDuration: 0.11, cameraLookAhead: 76,',
    'maxSpeed: 330, gearCount: 5, gearShiftDuration: 0.15, gearHoldDuration: 0.30, firstGearHoldDuration: 0.28, cameraLookAhead: 76,'
)
replace_once(
    "phaser/src/data/vehicles.js",
    'maxSpeed: 275, gearCount: 4, gearShiftDuration: 0.13, cameraLookAhead: 64,',
    'maxSpeed: 275, gearCount: 4, gearShiftDuration: 0.18, gearHoldDuration: 0.34, firstGearHoldDuration: 0.32, cameraLookAhead: 64,'
)
replace_once(
    "phaser/src/data/vehicles.js",
    'maxSpeed: 365, gearCount: 5, gearShiftDuration: 0.085, cameraLookAhead: 84,',
    'maxSpeed: 365, gearCount: 5, gearShiftDuration: 0.12, gearHoldDuration: 0.22, firstGearHoldDuration: 0.20, cameraLookAhead: 84,'
)

replace_once(
    "phaser/src/vehicles/VehicleModel.js",
    '''export function vehicleGearCount(archetype) {
  return Math.round(clamp(Number(archetype?.gearCount) || 5, 1, 5));
}
''',
    '''export function vehicleGearCount(archetype) {
  return Math.round(clamp(Number(archetype?.gearCount) || 5, 1, 5));
}

export function vehicleGearShiftTiming(archetype = {}) {
  return {
    shiftDuration: clamp(Number(archetype?.gearShiftDuration) || 0.14, 0.06, 0.28),
    holdDuration: clamp(Number(archetype?.gearHoldDuration) || 0.28, 0.10, 0.50),
    firstGearHoldDuration: clamp(Number(archetype?.firstGearHoldDuration) || 0.26, 0.12, 0.50)
  };
}

export function vehicleGearShiftActive(gear, gearShiftTimer, archetype = {}) {
  const timing = vehicleGearShiftTiming(archetype);
  return Math.max(1, Math.round(Number(gear) || 1)) > 1
    && Math.max(0, Number(gearShiftTimer) || 0) > timing.holdDuration;
}
'''
)
replace_once(
    "phaser/src/vehicles/VehicleModel.js",
    '''  const gearCount = vehicleGearCount(archetype);
  const gearShiftDuration = clamp(Number(archetype?.gearShiftDuration) || 0.11, 0.06, 0.22);

  let speed = Number(state?.speed) || 0;
  let gear = Math.round(clamp(Number(state?.gear) || 1, 1, gearCount));
  let gearShiftTimer = Math.max(0, (Number(state?.gearShiftTimer) || 0) - seconds);
  const incomingRatio = clamp(Math.abs(speed) / maxSpeed, 0, 1);
  const launchMultiplier = 1 + launchBoost * Math.pow(1 - incomingRatio, 2.1);

  if (speed >= 0) {''',
    '''  const gearCount = vehicleGearCount(archetype);
  const gearTiming = vehicleGearShiftTiming(archetype);

  let speed = Number(state?.speed) || 0;
  let gear = Math.round(clamp(Number(state?.gear) || 1, 1, gearCount));
  let gearShiftTimer = Math.max(0, (Number(state?.gearShiftTimer) || 0) - seconds);
  const incomingRatio = clamp(Math.abs(speed) / maxSpeed, 0, 1);
  const launchMultiplier = 1 + launchBoost * Math.pow(1 - incomingRatio, 2.1);

  // First gear gets a short dwell without a torque cut. This prevents the
  // gearbox from immediately stepping through 1→2 as soon as launch torque
  // pushes the car over the first speed threshold.
  if (gear === 1 && Math.abs(speed) < 0.5 && state?.parked && input.throttle > 0.05 && gearShiftTimer <= 0) {
    gearShiftTimer = gearTiming.firstGearHoldDuration;
  }

  if (speed >= 0) {'''
)
replace_once(
    "phaser/src/vehicles/VehicleModel.js",
    '''    if (targetGear > gear && gearShiftTimer <= 0 && input.throttle > 0.05) {
      gear = Math.min(targetGear, gear + 1);
      gearShiftTimer = gearShiftDuration;''',
    '''    if (targetGear > gear && gearShiftTimer <= 0 && input.throttle > 0.05) {
      gear = Math.min(targetGear, gear + 1);
      gearShiftTimer = gearTiming.shiftDuration + gearTiming.holdDuration;'''
)
replace_once(
    "phaser/src/vehicles/VehicleModel.js",
    '''  const gearTorque = vehicleGearTorqueMultiplier(gear, gearCount);
  const shiftTorque = gearShiftTimer > 0 ? 0.78 : 1;''',
    '''  const gearTorque = vehicleGearTorqueMultiplier(gear, gearCount);
  const shiftTorque = vehicleGearShiftActive(gear, gearShiftTimer, archetype) ? 0.78 : 1;'''
)

replace_once(
    "phaser/src/vehicles/VehicleEngineModel.js",
    'import { vehicleGearCount, vehicleGearForSpeed } from "./VehicleModel.js";',
    'import { vehicleGearCount, vehicleGearForSpeed, vehicleGearShiftActive, vehicleGearShiftTiming } from "./VehicleModel.js";'
)
replace_once(
    "phaser/src/vehicles/VehicleEngineModel.js",
    '''  const count = vehicleGearCount(effective);
  const seconds = clamp(dt, 0, 0.25);
  const shiftDuration = clamp(Number(archetype?.gearShiftDuration) || 0.11, 0.06, 0.22);
  let gear = Math.round(clamp(Number(state?.gear) || 1, 1, count));''',
    '''  const count = vehicleGearCount(effective);
  const seconds = clamp(dt, 0, 0.25);
  const timing = vehicleGearShiftTiming(archetype);
  let gear = Math.round(clamp(Number(state?.gear) || 1, 1, count));'''
)
replace_once(
    "phaser/src/vehicles/VehicleEngineModel.js",
    '''  if (target > gear && gearShiftTimer <= 0) {
    gear = Math.min(target, gear + 1);
    gearShiftTimer = shiftDuration;''',
    '''  if (target > gear && gearShiftTimer <= 0) {
    gear = Math.min(target, gear + 1);
    gearShiftTimer = timing.shiftDuration + timing.holdDuration;'''
)
replace_once(
    "phaser/src/vehicles/VehicleEngineModel.js",
    '''    shifting: Number(gearShiftTimer) > 0
  });''',
    '''    shifting: vehicleGearShiftActive(selectedGear, gearShiftTimer, archetype)
  });'''
)

# ---------------------------------------------------------------------------
# Tests + durable notes.
# ---------------------------------------------------------------------------
replace_once(
    "tests/vehicle-model.test.js",
    '''  gearCount: 5,
  gearShiftDuration: 0.10,
  cameraLookAhead: 72,''',
    '''  gearCount: 5,
  gearShiftDuration: 0.14,
  gearHoldDuration: 0.28,
  firstGearHoldDuration: 0.26,
  cameraLookAhead: 72,'''
)
replace_once(
    "tests/vehicle-model.test.js",
    '''test("automatic gearbox climbs through up to five gears with a brief torque cut", () => {
  let state = createVehicleState(definition, archetype);
  const seen = new Set([state.gear]);
  let shiftFrames = 0;
  for (let index = 0; index < 90; index++) {
    state = stepVehicleKinematics(state, { move: { x: 0, y: -1 } }, 0.05, archetype);
    seen.add(state.gear);
    if (state.gearShiftTimer > 0) shiftFrames++;
  }
  assert.equal(vehicleGearCount(archetype), 5);
  assert.deepEqual([...seen], [1, 2, 3, 4, 5]);
  assert.equal(state.gear, 5);
  assert.ok(shiftFrames >= 4);
  assert.ok(state.speed <= archetype.maxSpeed);
});''',
    '''test("automatic gearbox climbs through five gears without rapid-fire upshifts", () => {
  let state = createVehicleState(definition, archetype);
  const seen = new Set([state.gear]);
  const shifts = [];
  let previousGear = state.gear;
  for (let index = 0; index < 90; index++) {
    state = stepVehicleKinematics(state, { move: { x: 0, y: -1 } }, 0.05, archetype);
    seen.add(state.gear);
    if (state.gear > previousGear) shifts.push((index + 1) * 0.05);
    previousGear = state.gear;
  }
  assert.equal(vehicleGearCount(archetype), 5);
  assert.deepEqual([...seen], [1, 2, 3, 4, 5]);
  assert.equal(state.gear, 5);
  assert.equal(shifts.length, 4);
  assert.ok(shifts[0] >= 0.25, "first gear should breathe before the first upshift");
  for (let index = 1; index < shifts.length; index++) {
    assert.ok(shifts[index] - shifts[index - 1] >= 0.40, "successive upshifts should have an audible dwell");
  }
  assert.ok(state.speed <= archetype.maxSpeed);
});'''
)

write("tests/feeding-narrative-mix.test.js", '''import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_AUDIO_CATALOG } from "../phaser/src/audio/SampleAudioCatalog.js";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("feeding samples sit on the narrative bus with a modest level lift", () => {
  assert.equal(SAMPLE_AUDIO_CATALOG.drainStart.bus, "narrative");
  assert.equal(SAMPLE_AUDIO_CATALOG.drainLoop.bus, "narrative");
  assert.equal(SAMPLE_AUDIO_CATALOG.drainComplete.bus, "narrative");
  assert.equal(SAMPLE_AUDIO_CATALOG.drainStart.volume, 1.10);
  assert.equal(SAMPLE_AUDIO_CATALOG.drainLoop.volume, 0.96);
  assert.equal(SAMPLE_AUDIO_CATALOG.drainComplete.volume, 1.10);
});

test("feeding ducks world audio but leaves the narrative bus untouched", () => {
  const raw = source("phaser/src/systems/RawAudioSystem.js");
  const policy = source("phaser/src/playtest/FeedingAudioLoopPolicy.js");
  assert.match(raw, /const NARRATIVE_DUCK_FACTOR = 0\.54/);
  assert.match(raw, /this\.narrativeMaster = this\.ctx\.createGain\(\)/);
  assert.match(raw, /sampleDestination\(name\)/);
  assert.match(raw, /beginNarrativeDuck\(key = "default"\)/);
  assert.match(raw, /endNarrativeDuck\(key = "default"\)/);
  assert.match(policy, /RawAudio\.beginNarrativeDuck\?\.\(FEED_DUCK_KEY\)/);
  assert.match(policy, /FEED_DUCK_RELEASE_MS = 320/);
  assert.match(policy, /RawAudio\.endNarrativeDuck\?\.\(FEED_DUCK_KEY\)/);
  assert.match(policy, /RawAudio\.sampleDestination\?\.\(FEED_LOOP_EVENT\)/);
});
''')

replace_once(
    "docs/audio-catalog.md",
    '- `drainStart` / `drainLoop` / `drainComplete` — **wired candidate on PR #55, pending listening acceptance**: one coherent KatjaSavia/Pixabay performance is split into a masculine-shifted start breath, an original-pitch bite loop and a masculine-shifted release. Runtime files are committed, the bite uses a stateful PCM WAV loop, and gameplay starts/stops it with the feeding lifecycle rather than retriggering it every frame.',
    '- `drainStart` / `drainLoop` / `drainComplete` — **sound character listening accepted; narrative mix tuning on PR #55**: the KatjaSavia/Pixabay performance keeps its masculine-shifted start/release and original-pitch bite loop. The family now sits on a dedicated narrative bus with a modest level lift while ordinary world audio ducks to ~54% during feeding and returns smoothly just after the feeding exit cue.'
)
replace_once(
    "docs/audio-catalog.md",
    '`vehicleEngine` now has systemic gear/RPM wiring for player, civilian traffic and police, but still needs a sourced engine recording if the procedural timbre is to be replaced.',
    '`vehicleEngine` now has systemic gear/RPM wiring for player, civilian traffic and police. After playtest feedback that automatic upshifts were effectively rapid-fire, each archetype now separates the short torque/RPM shift cut from a longer per-gear dwell, including a first-gear hold, without reducing the established arcade acceleration. It still needs a sourced engine recording only if the procedural timbre itself is to be replaced.'
)

print("Applied feeding narrative mix and slower gearbox cadence tuning.")
