from pathlib import Path
import re

ROOT = Path(".")
def read(path):
    return (ROOT / path).read_text(encoding="utf-8")
def write(path, text):
    (ROOT / path).write_text(text, encoding="utf-8")
def replace_once(text, old, new, label):
    count = text.count(old)
    if count < 1:
        raise RuntimeError(f"{label}: expected at least one exact match")
    return text.replace(old, new, 1)
def regex_once(text, pattern, replacement, label):
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{label}: expected one regex match, got {count}")
    return updated

catalog_path = "phaser/src/audio/SampleAudioCatalog.js"
catalog = read(catalog_path)
catalog = replace_once(
    catalog,
    '''  vehicleDoorClose: sampleEvent([
    "phaser/assets/audio/vehicles/vehicle-door-close-01.mp3"
  ], { volume: 0.95 }),
''',
    '''  vehicleDoorClose: sampleEvent([
    "phaser/assets/audio/vehicles/vehicle-door-close-01.mp3"
  ], { volume: 0.95 }),
  vehicleEngineStart: sampleEvent([
    "phaser/assets/audio/vehicles/vehicle-engine-start-01.mp3"
  ], { volume: 0.82 }),
  vehicleEngineLoop: sampleEvent([
    "phaser/assets/audio/vehicles/vehicle-engine-loop-01.wav"
  ], { volume: 1.00, loop: true }),
''',
    "catalog engine events"
)
write(catalog_path, catalog)

raw_path = "phaser/src/systems/RawAudioSystem.js"
raw = read(raw_path)
raw = regex_once(
    raw,
    r'''const VEHICLE_ENGINE_PROFILES = Object\.freeze\(\{.*?\n\}\);''',
    '''const VEHICLE_ENGINE_PROFILES = Object.freeze({
  compact: Object.freeze({ idleHz: 48, redlineHz: 126, filterBase: 520, filterRange: 1050, volume: 0.115, wave: "sawtooth", harmonic: 0.18, samplePitch: 1.06, sampleVolume: 0.34, sampleFilterBase: 1500, sampleFilterRange: 4300 }),
  sedan: Object.freeze({ idleHz: 43, redlineHz: 112, filterBase: 470, filterRange: 930, volume: 0.112, wave: "sawtooth", harmonic: 0.17, samplePitch: 0.98, sampleVolume: 0.36, sampleFilterBase: 1400, sampleFilterRange: 3800 }),
  van: Object.freeze({ idleHz: 35, redlineHz: 88, filterBase: 390, filterRange: 760, volume: 0.125, wave: "square", harmonic: 0.14, samplePitch: 0.84, sampleVolume: 0.40, sampleFilterBase: 1050, sampleFilterRange: 3000 }),
  police: Object.freeze({ idleHz: 47, redlineHz: 128, filterBase: 540, filterRange: 1100, volume: 0.118, wave: "sawtooth", harmonic: 0.19, samplePitch: 1.08, sampleVolume: 0.36, sampleFilterBase: 1600, sampleFilterRange: 4500 })
});''',
    "engine profiles"
)
raw = replace_once(
    raw,
    "    this.vehicleEnginePaused = false;\n",
    "    this.vehicleEnginePaused = false;\n    this.vehicleEngineStartDeadlines = new Map();\n",
    "engine start deadline state"
)

engine_methods = r'''  beginVehicleEngineStart(id, { delay = 0.58, revealAfter = 2.05 } = {}) {
    const key = String(id || "");
    if (!key) return false;
    this.ensureListeners();
    const ctx = this.unlock();
    if (!ctx || !this.master) return false;

    const safeDelay = Math.max(0, Number(delay) || 0);
    const startAt = ctx.currentTime + safeDelay;
    this.vehicleEngineStartDeadlines.set(key, startAt + Math.max(0.4, Number(revealAfter) || 2.05));

    const playWhenReady = () => {
      const remaining = Math.max(0, startAt - (this.ctx?.currentTime || startAt));
      if (!this.playSample("vehicleEngineStart", { delay: remaining })) {
        this.vehicleEngineStartFallback(remaining);
      }
    };
    const ready = this.sampleBuffers.get("vehicleEngineStart");
    if (ready?.length) playWhenReady();
    else this.loadSampleEvent("vehicleEngineStart")?.then(playWhenReady);
    return true;
  }

  createVehicleEngineVoice(id, profileId, priority = 0, audibility = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return null;
    const profile = this.vehicleEngineProfile(profileId);
    if (this.vehicleEngineVoices.size >= MAX_VEHICLE_ENGINE_VOICES) {
      const ranked = [...this.vehicleEngineVoices.entries()]
        .sort((left, right) => ((left[1].priority || 0) * 2 + (left[1].audibility || 0)) - ((right[1].priority || 0) * 2 + (right[1].audibility || 0)));
      const [quietestId, quietest] = ranked[0] || [];
      const incomingScore = Math.max(0, Number(priority) || 0) * 2 + Math.max(0, Number(audibility) || 0);
      const quietestScore = (quietest?.priority || 0) * 2 + (quietest?.audibility || 0);
      if (!quietestId || quietestScore >= incomingScore) return null;
      this.stopVehicleEngine(quietestId);
    }

    const connectOutput = (filter, gain, panner) => {
      filter.connect(gain);
      if (panner) {
        gain.connect(panner);
        panner.connect(this.master);
      } else {
        gain.connect(this.master);
      }
    };

    const engineBuffers = this.sampleBuffers.get("vehicleEngineLoop");
    if (engineBuffers?.length) {
      try {
        const source = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        const panner = typeof ctx.createStereoPanner === "function" ? ctx.createStereoPanner() : null;
        source.buffer = engineBuffers[0];
        source.loop = true;
        filter.type = "lowpass";
        filter.Q.value = 0.62;
        gain.gain.value = 0.0001;
        source.connect(filter);
        connectOutput(filter, gain, panner);
        const voice = { mode: "sample", id, profileId, profile, source, filter, gain, panner, frame: this.vehicleEngineFrame, priority, audibility };
        this.vehicleEngineVoices.set(id, voice);
        source.start();
        return voice;
      } catch {
      }
    } else {
      this.loadSampleEvent("vehicleEngineLoop");
    }

    try {
      const primary = ctx.createOscillator();
      const secondary = ctx.createOscillator();
      const harmonicGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const panner = typeof ctx.createStereoPanner === "function" ? ctx.createStereoPanner() : null;
      primary.type = profile.wave;
      secondary.type = "triangle";
      harmonicGain.gain.value = profile.harmonic;
      filter.type = "lowpass";
      filter.Q.value = 0.72;
      gain.gain.value = 0.0001;
      primary.connect(filter);
      secondary.connect(harmonicGain);
      harmonicGain.connect(filter);
      connectOutput(filter, gain, panner);
      const voice = { mode: "procedural", id, profileId, profile, primary, secondary, harmonicGain, filter, gain, panner, frame: this.vehicleEngineFrame, priority, audibility };
      this.vehicleEngineVoices.set(id, voice);
      primary.start();
      secondary.start();
      return voice;
    } catch {
      return null;
    }
  }

  updateVehicleEngine(id, options = {}) {
    const key = String(id || "");
    if (!key) return false;
    const audibility = Math.max(0, Math.min(1, Number(options.audibility) || 0));
    if (this.vehicleEnginePaused || audibility <= 0.002 || options.active === false) {
      this.stopVehicleEngine(key);
      return false;
    }

    this.ensureListeners();
    const ctx = this.unlock();
    if (!ctx || !this.master) return false;
    const priority = Math.max(0, Number(options.priority) || 0);
    let voice = this.vehicleEngineVoices.get(key);
    if (voice?.mode === "procedural" && this.sampleBuffers.get("vehicleEngineLoop")?.length) {
      this.stopVehicleEngine(key, { preserveStartDeadline: true });
      voice = null;
    }
    if (!voice) voice = this.createVehicleEngineVoice(key, options.profileId, priority, audibility);
    if (!voice) return false;

    const profile = voice.profile;
    const rpm = Math.max(0.18, Math.min(1, Number(options.rpm) || 0.18));
    const load = Math.max(0.12, Math.min(1, Number(options.load) || 0.12));
    const panTarget = Math.max(-1, Math.min(1, Number(options.pan) || 0));
    const now = ctx.currentTime;
    const revealAt = this.vehicleEngineStartDeadlines.get(key) || 0;
    const revealed = !revealAt || now >= revealAt;
    if (revealAt && revealed) this.vehicleEngineStartDeadlines.delete(key);

    if (voice.mode === "sample") {
      const playbackRate = Math.max(0.72, Math.min(2.20, profile.samplePitch * (0.80 + rpm * 1.18)));
      const gainTarget = revealed
        ? Math.max(0.0001, profile.sampleVolume * audibility * (0.48 + rpm * 0.22 + load * 0.30))
        : 0.0001;
      const filterTarget = profile.sampleFilterBase + profile.sampleFilterRange * (0.22 + rpm * 0.58 + load * 0.20);
      voice.source.playbackRate.setTargetAtTime(playbackRate, now, 0.055);
      voice.filter.frequency.setTargetAtTime(Math.max(320, filterTarget), now, 0.065);
      voice.gain.gain.setTargetAtTime(gainTarget, now, revealed ? 0.075 : 0.025);
      voice.playbackRate = playbackRate;
    } else {
      const frequency = profile.idleHz + (profile.redlineHz - profile.idleHz) * rpm;
      const gainTarget = revealed
        ? Math.max(0.0001, profile.volume * audibility * (0.42 + rpm * 0.36 + load * 0.22))
        : 0.0001;
      const filterTarget = profile.filterBase + profile.filterRange * (0.30 + rpm * 0.70);
      voice.primary.frequency.setTargetAtTime(Math.max(24, frequency), now, 0.035);
      voice.secondary.frequency.setTargetAtTime(Math.max(35, frequency * 2.01), now, 0.040);
      voice.filter.frequency.setTargetAtTime(Math.max(120, filterTarget), now, 0.055);
      voice.gain.gain.setTargetAtTime(gainTarget, now, revealed ? 0.045 : 0.025);
    }

    voice.panner?.pan?.setTargetAtTime?.(panTarget, now, 0.055);
    voice.frame = this.vehicleEngineFrame;
    voice.priority = priority;
    voice.audibility = audibility;
    voice.rpm = rpm;
    voice.load = load;
    voice.pan = panTarget;
    return true;
  }

  stopVehicleEngine(id, { preserveStartDeadline = false } = {}) {
    const key = String(id || "");
    const voice = this.vehicleEngineVoices.get(key);
    if (!preserveStartDeadline) this.vehicleEngineStartDeadlines.delete(key);
    if (!voice) return false;
    this.vehicleEngineVoices.delete(key);
    const ctx = this.ctx;
    const now = ctx?.currentTime || 0;
    const when = now + 0.10;
    try { voice.gain.gain.setTargetAtTime(0.0001, now, 0.025); } catch {}
    try { voice.source?.stop(when); } catch {}
    try { voice.primary?.stop(when); } catch {}
    try { voice.secondary?.stop(when); } catch {}
    const disconnect = () => {
      try { voice.source?.disconnect(); } catch {}
      try { voice.primary?.disconnect(); } catch {}
      try { voice.secondary?.disconnect(); } catch {}
      try { voice.harmonicGain?.disconnect(); } catch {}
      try { voice.filter?.disconnect(); } catch {}
      try { voice.gain?.disconnect(); } catch {}
      try { voice.panner?.disconnect?.(); } catch {}
    };
    const owner = voice.source || voice.primary;
    if (owner) owner.onended = disconnect;
    else disconnect();
    return true;
  }

  stopAllVehicleEngines() {'''

raw = regex_once(
    raw,
    r'''  createVehicleEngineVoice\(id, profileId, priority = 0, audibility = 0\) \{.*?\n  stopAllVehicleEngines\(\) \{''',
    engine_methods,
    "engine voice implementation"
)
raw = replace_once(
    raw,
    '''      profileId: voice.profileId,
      rpm: Number(voice.rpm) || 0,
''',
    '''      profileId: voice.profileId,
      mode: voice.mode || "procedural",
      rpm: Number(voice.rpm) || 0,
''',
    "engine snapshot mode"
)
raw = replace_once(
    raw,
    '''      case "vehicleDoorClose": return this.vehicleDoorClose(options.delay);
      case "vehicleCollisionLight": return this.vehicleCollision(false);
''',
    '''      case "vehicleDoorClose": return this.vehicleDoorClose(options.delay);
      case "vehicleEngineStart": return this.vehicleEngineStartFallback(options.delay);
      case "vehicleCollisionLight": return this.vehicleCollision(false);
''',
    "engine start fallback switch"
)
raw = replace_once(
    raw,
    '''  vehicleDoorOpen() {
''',
    '''  vehicleEngineStartFallback(delay = 0) {
    const baseDelay = Math.max(0, Number(delay) || 0);
    this.tone(118, 0.08, { delay: baseDelay, to: 72, volume: 0.024, type: "triangle", filter: 700 });
    this.noise(0.92, { delay: baseDelay + 0.12, volume: 0.045, filter: 430, filterType: "bandpass", q: 0.72 });
    this.tone(58, 1.05, { delay: baseDelay + 0.16, to: 92, volume: 0.040, type: "sawtooth", filter: 520 });
  }

  vehicleDoorOpen() {
''',
    "engine start procedural fallback"
)
write(raw_path, raw)

interactions_path = "phaser/src/vehicles/VehicleInteractions.js"
interactions = read(interactions_path)
interactions = replace_once(
    interactions,
    "const VEHICLE_DOOR_CLOSE_DELAY = 0.52;\n",
    "const VEHICLE_DOOR_CLOSE_DELAY = 0.52;\nconst VEHICLE_ENGINE_START_DELAY = 0.58;\nconst VEHICLE_ENGINE_LOOP_REVEAL = 2.05;\n",
    "vehicle engine timing constants"
)
interactions = replace_once(
    interactions,
    '''  RawAudio.play("vehicleDoorOpen");
  RawAudio.play("vehicleDoorClose", { delay: VEHICLE_DOOR_CLOSE_DELAY, cooldown: 0 });
  system.updateHud();
''',
    '''  RawAudio.play("vehicleDoorOpen");
  RawAudio.play("vehicleDoorClose", { delay: VEHICLE_DOOR_CLOSE_DELAY, cooldown: 0 });
  RawAudio.beginVehicleEngineStart(`player:${vehicle.id}`, {
    delay: VEHICLE_ENGINE_START_DELAY,
    revealAfter: VEHICLE_ENGINE_LOOP_REVEAL
  });
  system.updateHud();
''',
    "player engine start routing"
)
write(interactions_path, interactions)

attr_path = "phaser/assets/audio/ATTRIBUTION.md"
attr = read(attr_path)
engine_row = "| `vehicleEngineStart` / `vehicleEngineLoop` | `vehicles/vehicle-engine-start-01.mp3`, `vehicles/vehicle-engine-loop-01.wav` (+ OGG working derivatives) | Car Engine / ignition, starter and steady idle | freesounds123 | https://pixabay.com/es/sound-effects/pel%C3%ADculas-y-efectos-especiales-car-engine-335601/ | Pixabay Content License (verified 2026-08-17) | User-supplied 10.08 s MP3 split into a 3.05 s ignition/start cue (approximately 1.20–4.25 s) and a 2.72 s steady-idle loop sourced from approximately 5.75–8.65 s. Both are downmixed/resampled to mono 44.1 kHz and high-pass cleaned; the loop uses a 180 ms circular equal-power crossfade and PCM WAV at runtime. RPM, gear, load, distance and pan remain systemic; pitch/filter/gain are driven at runtime, with the old oscillator retained only as a load/decode fallback. |\n"
if "`vehicleEngineStart` / `vehicleEngineLoop`" not in attr:
    attr = replace_once(attr, "\n\n## Rules", "\n" + engine_row + "\n## Rules", "engine attribution")
write(attr_path, attr)

docs_path = "docs/audio-catalog.md"
docs = read(docs_path)
docs = regex_once(
    docs,
    r'''- `vehicleEngine` — \*\*systemic mix accepted.*?\n(?=\n## Audio Lab)''',
    '''- `vehicleEngineStart` / `vehicleEngineLoop` — **real sample-backed candidate integrated on PR #55; systemic mix accepted, listening re-check pending**: the supplied freesounds123/Pixabay recording is split into an ignition/starter one-shot and a circular-crossfaded PCM idle loop. Player entry plays the start after the door closes and keeps the continuous engine voice muted until the recorded engine catches. Player, traffic and police still share the existing gear-aware RPM, load, distance and stereo-pan telemetry; runtime playback rate, filtering and gain shape the same real loop per archetype. The former oscillators remain only as a load/decode fallback.''',
    "integrated engine docs"
)
docs = docs.replace(
    "- `vehicleEngineStart`\n",
    "- `vehicleEngineStart` — **integrated candidate:** real ignition/starter cue plays after the player closes the door\n",
    1
)
docs = docs.replace(
    "- `vehicleEngineIdle` — seamless loop\n",
    "- `vehicleEngineLoop` — **integrated candidate:** 2.72 s circular-crossfaded PCM idle loop driven by RPM/load/spatial telemetry\n",
    1
)
docs = docs.replace(
    "- `vehicleEngineDrive` — seamless loop or layered acceleration bed\n",
    "- `vehicleEngineDrive` — represented by runtime pitch/filter/load treatment of `vehicleEngineLoop`; a separate drive layer remains optional polish\n",
    1
)
docs = regex_once(
    docs,
    r'''- `vehicleEngine` — \*\*systemic mix accepted, cadence retuned:.*?\n''',
    '''- `vehicleEngine` — **real sample-backed systemic candidate:** automatic gears still drive RPM for the player, local civilian traffic and police cruisers; a shared authentic idle recording now supplies the timbre, with per-archetype playback-rate/filter/gain treatment and procedural fallback only when the sample is unavailable.\n''',
    "vehicle backlog engine docs"
)
docs = docs.replace(
    "The procedural engine recording only needs replacement later if its timbre itself becomes a problem.",
    "The procedural engine timbre has now been replaced by a real sample-backed start/loop candidate while preserving the accepted systemic RPM, gear and spatial ownership.",
    1
)
write(docs_path, docs)

test_path = "tests/vehicle-engine-audio.test.js"
test_content = r'''import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_AUDIO_CATALOG } from "../phaser/src/audio/SampleAudioCatalog.js";
import { VEHICLE_ARCHETYPES } from "../phaser/src/data/vehicles.js";
import {
  stepPresentationTransmission,
  vehicleEngineRpmNormalized,
  vehicleEngineTelemetry
} from "../phaser/src/vehicles/VehicleEngineModel.js";

const repoFile = path => new URL(`../${path}`, import.meta.url);
const source = path => readFileSync(repoFile(path), "utf8");

function assertMp3(path) {
  const data = readFileSync(repoFile(path));
  assert.ok(data.length > 5_000, `${path} should contain a processed sample`);
  const hasId3 = data.subarray(0, 3).toString("ascii") === "ID3";
  const hasFrameSync = data[0] === 0xff && (data[1] & 0xe0) === 0xe0;
  assert.ok(hasId3 || hasFrameSync, `${path} should be an MP3 stream`);
}

function assertWav(path) {
  const data = readFileSync(repoFile(path));
  assert.ok(data.length > 20_000, `${path} should contain a processed loop`);
  assert.equal(data.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(data.subarray(8, 12).toString("ascii"), "WAVE");
}

test("presentation transmission upshifts and the engine drops RPM into the next gear", () => {
  const compact = VEHICLE_ARCHETYPES.compact;
  const shifted = stepPresentationTransmission({ gear: 1, gearShiftTimer: 0 }, 64, 0.05, compact);
  assert.equal(shifted.gear, 2);
  assert.ok(shifted.gearShiftTimer > 0);
  const before = vehicleEngineRpmNormalized({ speed: 57, maxSpeed: compact.maxSpeed, gear: 1, gearCount: 5, shifting: false });
  const after = vehicleEngineRpmNormalized({ speed: 64, maxSpeed: compact.maxSpeed, gear: 2, gearCount: 5, shifting: true });
  assert.ok(before > after, "an upshift should audibly drop engine revs");
});

test("engine telemetry is spatial and preserves an own-vehicle priority mix", () => {
  const sedan = VEHICLE_ARCHETYPES.sedan;
  const own = vehicleEngineTelemetry({ speed: 180, archetype: sedan, gear: 3, throttle: 1, ownVehicle: true });
  const near = vehicleEngineTelemetry({ speed: 180, archetype: sedan, gear: 3, throttle: 0.5, x: 150, y: 0, listener: { x: 0, y: 0 }, maxDistance: 600 });
  const far = vehicleEngineTelemetry({ speed: 180, archetype: sedan, gear: 3, throttle: 0.5, x: 520, y: 0, listener: { x: 0, y: 0 }, maxDistance: 600 });
  assert.equal(own.audibility, 1);
  assert.equal(own.pan, 0);
  assert.ok(near.audibility > far.audibility);
  assert.ok(near.pan > 0);
});

test("real start and PCM idle loop back the systemic engine voices", () => {
  const startFile = "phaser/assets/audio/vehicles/vehicle-engine-start-01.mp3";
  const loopFile = "phaser/assets/audio/vehicles/vehicle-engine-loop-01.wav";
  assert.deepEqual(SAMPLE_AUDIO_CATALOG.vehicleEngineStart.files, [startFile]);
  assert.deepEqual(SAMPLE_AUDIO_CATALOG.vehicleEngineLoop.files, [loopFile]);
  assert.equal(SAMPLE_AUDIO_CATALOG.vehicleEngineLoop.loop, true);
  assertMp3(startFile);
  assertWav(loopFile);

  const raw = source("phaser/src/systems/RawAudioSystem.js");
  assert.match(raw, /sampleBuffers\.get\("vehicleEngineLoop"\)/);
  assert.match(raw, /mode: "sample"/);
  assert.match(raw, /mode: "procedural"/);
  assert.match(raw, /source\.playbackRate\.setTargetAtTime/);
  assert.match(raw, /vehicleEngineStartDeadlines/);
  assert.match(raw, /vehicleEngineStartFallback/);
});

test("player entry sequences door close, starter and loop reveal without restarting traffic engines", () => {
  const interactions = source("phaser/src/vehicles/VehicleInteractions.js");
  assert.match(interactions, /const VEHICLE_ENGINE_START_DELAY = 0\.58;/);
  assert.match(interactions, /const VEHICLE_ENGINE_LOOP_REVEAL = 2\.05;/);
  assert.equal((interactions.match(/RawAudio\.beginVehicleEngineStart\(/g) || []).length, 1);
  assert.match(interactions, /delay: VEHICLE_ENGINE_START_DELAY/);
  assert.match(interactions, /revealAfter: VEHICLE_ENGINE_LOOP_REVEAL/);
});

test("RawAudio owns capped persistent engine voices for player traffic and police", () => {
  const raw = source("phaser/src/systems/RawAudioSystem.js");
  const driving = source("phaser/src/vehicles/VehicleDriving.js");
  const traffic = source("phaser/src/streaming/TrafficLocalBehaviorSystem.js");
  const police = source("phaser/src/police/MotorizedPoliceSystem.js");
  const runtime = source("phaser/src/runtime/GameplayRuntime.js");
  assert.match(raw, /MAX_VEHICLE_ENGINE_VOICES = 10/);
  assert.match(raw, /updateVehicleEngine\(id, options = \{\}\)/);
  assert.match(raw, /createStereoPanner/);
  assert.match(raw, /stopAllVehicleEngines\(\)/);
  assert.match(driving, /RawAudio\.updateVehicleEngine\(`player:/);
  assert.match(traffic, /RawAudio\.updateVehicleEngine\(`traffic:/);
  assert.match(traffic, /stepPresentationTransmission/);
  assert.match(police, /RawAudio\.updateVehicleEngine\(`police:/);
  assert.match(police, /engineReferenceSpeed/);
  assert.match(runtime, /beginVehicleEngineFrame/);
  assert.match(runtime, /endVehicleEngineFrame/);
});

test("the canonical audio plan has no fixed city or distant traffic ambience bed", () => {
  const catalogue = source("docs/audio-catalog.md");
  assert.match(catalogue, /no continuous `ambienceStreetNight` or `trafficAmbience` bed/);
  assert.match(catalogue, /Urban ambience must emerge from spatial systemic sources/);
  assert.match(catalogue, /vehicleEngine.*systemic mix accepted/s);
  assert.match(catalogue, /real sample-backed candidate integrated/);
});
'''
write(test_path, test_content)
print("Engine integration source edits prepared.")
