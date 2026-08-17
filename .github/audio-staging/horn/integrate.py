from pathlib import Path
import hashlib
import json
import shutil
import subprocess

ROOT = Path.cwd()
STAGING = ROOT / ".github/audio-staging/horn"
AUDIO_DIR = ROOT / "phaser/assets/audio/vehicles"

MASTER_NAME = "vehicle-horn-master.ogg"
MASTER_SHA256 = "478cae9e55553377b571d0043940932c2b9f95971c4a43a97c551afd3c91495d"
VARIANT_DURATIONS = (0.42, 0.58, 0.78)

def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise AssertionError(f"Missing replacement marker for {label}")
    return text.replace(old, new, 1)

AUDIO_DIR.mkdir(parents=True, exist_ok=True)
master = STAGING / MASTER_NAME
actual = hashlib.sha256(master.read_bytes()).hexdigest()
if actual != MASTER_SHA256:
    raise AssertionError(f"{MASTER_NAME} SHA mismatch: {actual} != {MASTER_SHA256}")

for index, duration in enumerate(VARIANT_DURATIONS, 1):
    ogg = AUDIO_DIR / f"vehicle-horn-{index:02d}.ogg"
    if index == 3:
        shutil.copyfile(master, ogg)
    else:
        fade_start = max(0.02, duration - 0.055)
        subprocess.run([
            "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(master),
            "-af", f"afade=t=out:st={fade_start:.3f}:d=0.055,atrim=duration={duration:.3f}",
            "-map_metadata", "-1", "-ac", "1", "-ar", "44100",
            "-codec:a", "libvorbis", "-q:a", "6", str(ogg)
        ], check=True)
    subprocess.run([
        "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(ogg), "-map_metadata", "-1", "-ac", "1", "-ar", "44100",
        "-codec:a", "libmp3lame", "-q:a", "4", str(ogg.with_suffix(".mp3"))
    ], check=True)

for index in range(1, 4):
    for suffix in ("ogg", "mp3"):
        path = AUDIO_DIR / f"vehicle-horn-{index:02d}.{suffix}"
        probe = json.loads(subprocess.check_output([
            "ffprobe", "-v", "error",
            "-show_entries", "stream=codec_name,sample_rate,channels:format=duration",
            "-of", "json", str(path)
        ], text=True))
        stream = probe["streams"][0]
        duration = float(probe["format"]["duration"])
        assert int(stream["sample_rate"]) == 44100, (path, stream)
        assert int(stream["channels"]) == 1, (path, stream)
        assert 0.39 <= duration <= 0.85, (path, duration)
        assert path.stat().st_size > 5_000, (path, path.stat().st_size)

catalog_path = ROOT / "phaser/src/audio/SampleAudioCatalog.js"
catalog = catalog_path.read_text()
horn_block = '''  vehicleHorn: sampleEvent([
    "phaser/assets/audio/vehicles/vehicle-horn-01.mp3",
    "phaser/assets/audio/vehicles/vehicle-horn-02.mp3",
    "phaser/assets/audio/vehicles/vehicle-horn-03.mp3"
  ], { volume: 0.78 }),
'''
catalog = replace_once(
    catalog,
    "  vehicleCollisionLight: sampleEvent([",
    horn_block + "  vehicleCollisionLight: sampleEvent([",
    "sample catalogue"
)
catalog_path.write_text(catalog)

actions_path = ROOT / "phaser/src/input/actions.js"
actions = actions_path.read_text()
actions = replace_once(
    actions,
    '  BLOOD_SENSE: "bloodSense",\n  GIVE_IN: "giveIn",',
    '  BLOOD_SENSE: "bloodSense",\n  HORN: "horn",\n  GIVE_IN: "giveIn",',
    "horn action"
)
actions = replace_once(
    actions,
    "    bloodSensePressed: false,\n    beastPressed: false,",
    "    bloodSensePressed: false,\n    hornPressed: false,\n    beastPressed: false,",
    "empty input horn"
)
actions = replace_once(
    actions,
    "    bloodSensePressed: allows(INPUT_ACTIONS.BLOOD_SENSE) && Boolean(frame.bloodSensePressed),\n    beastPressed: allows(INPUT_ACTIONS.GIVE_IN) && Boolean(frame.beastPressed),",
    "    bloodSensePressed: allows(INPUT_ACTIONS.BLOOD_SENSE) && Boolean(frame.bloodSensePressed),\n    hornPressed: allows(INPUT_ACTIONS.HORN) && Boolean(frame.hornPressed),\n    beastPressed: allows(INPUT_ACTIONS.GIVE_IN) && Boolean(frame.beastPressed),",
    "control-mode horn"
)
actions_path.write_text(actions)

bindings_path = ROOT / "phaser/src/input/bindings.js"
bindings = bindings_path.read_text()
bindings = replace_once(
    bindings,
    '  sense: "F",\n  beast: "B",',
    '  sense: "F",\n  horn: "H",\n  beast: "B",',
    "default horn binding"
)
bindings = replace_once(
    bindings,
    '  "sense",\n  "beast",',
    '  "sense",\n  "horn",\n  "beast",',
    "remappable horn"
)
bindings_path.write_text(bindings)

input_path = ROOT / "phaser/src/input/InputSystem.js"
input_source = input_path.read_text()
input_source = replace_once(
    input_source,
    '  sense: "sense",\n  beast: "beast",',
    '  sense: "sense",\n  horn: "horn",\n  beast: "beast",',
    "input horn key slot"
)
input_source = replace_once(
    input_source,
    "      bloodSensePressed: this.justDown(this.keys.sense),\n      beastPressed: this.justDown(this.keys.beast),",
    "      bloodSensePressed: this.justDown(this.keys.sense),\n      hornPressed: this.justDown(this.keys.horn),\n      beastPressed: this.justDown(this.keys.beast),",
    "input horn frame"
)
input_path.write_text(input_source)

driving_path = ROOT / "phaser/src/vehicles/VehicleDriving.js"
driving = driving_path.read_text()
horn_runtime = '''  if (frame?.hornPressed && !vehicle.disabled) {
    RawAudio.play("vehicleHorn", { cooldown: 0.24 });
    system.scene.events?.emit?.("vehicle:horn", {
      vehicleId: vehicle.id,
      x: vehicle.x,
      y: vehicle.y
    });
  }
'''
driving = replace_once(
    driving,
    "  const vehicle = system.currentVehicle();\n  if (!vehicle) return false;\n",
    "  const vehicle = system.currentVehicle();\n  if (!vehicle) return false;\n" + horn_runtime,
    "driving horn authority"
)
driving_path.write_text(driving)

raw_path = ROOT / "phaser/src/systems/RawAudioSystem.js"
raw = raw_path.read_text()
raw = replace_once(
    raw,
    '      case "vehicleEngineStart": return this.vehicleEngineStartFallback(options.delay);\n      case "vehicleCollisionLight": return this.vehicleCollision(false);',
    '      case "vehicleEngineStart": return this.vehicleEngineStartFallback(options.delay);\n      case "vehicleHorn": return this.vehicleHorn();\n      case "vehicleCollisionLight": return this.vehicleCollision(false);',
    "horn fallback route"
)
horn_fallback = '''  vehicleHorn() {
    this.tone(392, 0.44, { to: 384, volume: 0.040, type: "square", filter: 1500 });
    this.tone(523, 0.44, { to: 515, volume: 0.028, type: "sawtooth", filter: 1800 });
  }

'''
raw = replace_once(
    raw,
    "  vehicleSkid() {\n",
    horn_fallback + "  vehicleSkid() {\n",
    "horn fallback synthesis"
)
raw_path.write_text(raw)

attr_path = ROOT / "phaser/assets/audio/ATTRIBUTION.md"
attr = attr_path.read_text()
row = "| `vehicleHorn` | `vehicles/vehicle-horn-01.mp3` … `vehicles/vehicle-horn-03.mp3` (+ matching OGG working derivatives) | Automobile Horn 02 / normal urban car horn | Universfield | https://pixabay.com/sound-effects/film-special-effects-automobile-horn-02-352065/ | Pixabay Content License (verified 2026-08-17) | User-supplied 1.248 s stereo 48 kHz MP3 trimmed from the clean horn region into three natural press lengths of approximately 0.42 s, 0.58 s and 0.78 s. All variants retain the original pitch and vehicle identity; only duration/envelope, mono 44.1 kHz conversion, 80 Hz high-pass, 8.5 kHz low-pass, gain and conservative limiting were applied. |\n"
if "`vehicleHorn`" not in attr:
    attr = attr.replace("\n\n## Rules", "\n" + row + "\n## Rules")
attr_path.write_text(attr)

docs_path = ROOT / "docs/audio-catalog.md"
docs = docs_path.read_text()
integrated_bullet = "- `vehicleHorn` — **real sample-backed family integrated on PR #55, pending listening acceptance**: one clean Universfield/Pixabay horn becomes three natural press lengths without pitch alteration. The player can sound it with the remappable **H** action while driving; it is mundane traffic audio and creates no Heat. A restrained procedural horn remains a loading/decoding fallback.\n"
if integrated_bullet not in docs:
    docs = docs.replace("## Audio Lab", integrated_bullet + "## Audio Lab", 1)
docs = docs.replace(
    "- `vehicleHorn` — 3–4 variants",
    "- `vehicleHorn` — **integrated candidate:** 3 original-pitch press-length variants; remappable H while driving; pending listening acceptance"
)
docs_path.write_text(docs)

input_actions_test_path = ROOT / "tests/input-actions.test.js"
input_actions_test = input_actions_test_path.read_text()
input_actions_test = replace_once(
    input_actions_test,
    "    bloodSensePressed: true,\n    beastPressed: true,",
    "    bloodSensePressed: true,\n    hornPressed: true,\n    beastPressed: true,",
    "input actions active horn"
)
input_actions_test = replace_once(
    input_actions_test,
    "  assert.equal(frame.dashPressed, true);\n  assert.equal(frame.beastPressed, true);",
    "  assert.equal(frame.dashPressed, true);\n  assert.equal(frame.hornPressed, true);\n  assert.equal(frame.beastPressed, true);",
    "full horn assertion"
)
input_actions_test = replace_once(
    input_actions_test,
    "  assert.equal(frame.primaryPressed, false);\n  assert.equal(frame.dashPressed, false);",
    "  assert.equal(frame.primaryPressed, false);\n  assert.equal(frame.hornPressed, false);\n  assert.equal(frame.dashPressed, false);",
    "movement horn assertion"
)
input_actions_test = replace_once(
    input_actions_test,
    "  assert.equal(frame.interactPressed, false);\n  assert.equal(frame.weaponStep, 0);",
    "  assert.equal(frame.interactPressed, false);\n  assert.equal(frame.hornPressed, false);\n  assert.equal(frame.weaponStep, 0);",
    "locked horn assertion"
)
input_actions_test_path.write_text(input_actions_test)

input_system_test_path = ROOT / "tests/input-system.test.js"
input_system_test = input_system_test_path.read_text()
input_system_test = replace_once(
    input_system_test,
    '  "dash", "whisper", "sense", "beast", "enter",',
    '  "dash", "whisper", "sense", "horn", "beast", "enter",',
    "input test horn key"
)
input_system_test = replace_once(
    input_system_test,
    "  keys.dash._justDown = true;\n  keys.beast._justDown = true;",
    "  keys.dash._justDown = true;\n  keys.horn._justDown = true;\n  keys.beast._justDown = true;",
    "input test horn press"
)
input_system_test = replace_once(
    input_system_test,
    "  assert.equal(frame.dashPressed, true);\n  assert.equal(frame.beastPressed, true);",
    "  assert.equal(frame.dashPressed, true);\n  assert.equal(frame.hornPressed, true);\n  assert.equal(frame.beastPressed, true);",
    "input test horn first frame"
)
input_system_test = replace_once(
    input_system_test,
    "  assert.equal(next.dashPressed, false);\n  assert.equal(next.beastPressed, false);",
    "  assert.equal(next.dashPressed, false);\n  assert.equal(next.hornPressed, false);\n  assert.equal(next.beastPressed, false);",
    "input test horn edge"
)
input_system_test_path.write_text(input_system_test)

horn_test = '''import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_AUDIO_CATALOG } from "../phaser/src/audio/SampleAudioCatalog.js";

const repoFile = path => new URL(`../${path}`, import.meta.url);
const source = path => readFileSync(repoFile(path), "utf8");

function assertMp3(path) {
  const data = readFileSync(repoFile(path));
  assert.ok(data.length > 5_000, `${path} should contain a processed horn sample`);
  const hasId3 = data.subarray(0, 3).toString("ascii") === "ID3";
  const hasFrameSync = data[0] === 0xff && (data[1] & 0xe0) === 0xe0;
  assert.ok(hasId3 || hasFrameSync, `${path} should be an MP3 stream`);
}

test("vehicleHorn registers three natural press-length variants", () => {
  const files = [
    "phaser/assets/audio/vehicles/vehicle-horn-01.mp3",
    "phaser/assets/audio/vehicles/vehicle-horn-02.mp3",
    "phaser/assets/audio/vehicles/vehicle-horn-03.mp3"
  ];
  assert.deepEqual(SAMPLE_AUDIO_CATALOG.vehicleHorn.files, files);
  assert.equal(SAMPLE_AUDIO_CATALOG.vehicleHorn.volume, 0.78);
  assert.equal(SAMPLE_AUDIO_CATALOG.vehicleHorn.loop, false);
  files.forEach(assertMp3);
});

test("H is a remappable horn edge in the central input frame", () => {
  const actions = source("phaser/src/input/actions.js");
  const bindings = source("phaser/src/input/bindings.js");
  const input = source("phaser/src/input/InputSystem.js");
  assert.match(actions, /HORN: "horn"/);
  assert.match(actions, /hornPressed: false/);
  assert.match(actions, /hornPressed: allows\(INPUT_ACTIONS\.HORN\)/);
  assert.match(bindings, /horn: "H"/);
  assert.match(bindings, /"horn"/);
  assert.match(input, /horn: "horn"/);
  assert.match(input, /hornPressed: this\.justDown\(this\.keys\.horn\)/);
});

test("the player horn is owned by active vehicle driving and never creates Heat", () => {
  const driving = source("phaser/src/vehicles/VehicleDriving.js");
  const start = driving.indexOf("export function updateVehicleDriving");
  const end = driving.indexOf("export function updateVehicleCamera", start);
  const block = driving.slice(start, end);
  assert.match(block, /frame\?\.hornPressed && !vehicle\.disabled/);
  assert.match(block, /RawAudio\.play\("vehicleHorn", \{ cooldown: 0\.24 \}\)/);
  assert.match(block, /"vehicle:horn"/);
  assert.doesNotMatch(block, /addHeat/);
});

test("vehicleHorn retains a procedural loading fallback", () => {
  const raw = source("phaser/src/systems/RawAudioSystem.js");
  assert.match(raw, /case "vehicleHorn": return this\.vehicleHorn\(\);/);
  assert.match(raw, /vehicleHorn\(\) \{/);
});
'''
(ROOT / "tests/vehicle-horn-audio.test.js").write_text(horn_test)
