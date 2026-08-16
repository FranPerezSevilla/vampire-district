from __future__ import annotations

import base64
import hashlib
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PARTS_DIR = ROOT / "scripts" / "_door_close_parts"
OGG_PATH = ROOT / "phaser" / "assets" / "audio" / "vehicles" / "vehicle-door-close-01.ogg"
MP3_PATH = OGG_PATH.with_suffix(".mp3")
EXPECTED_SHA256 = "53218607d71f989c52a21d2793100d968b6021eb30a6392da6c9a502ccf801d9"
DOOR_CLOSE_DELAY = "0.52"


def read_text(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def write_text(relative: str, content: str) -> None:
    (ROOT / relative).write_text(content, encoding="utf-8")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one {label} replacement, found {count}")
    return content.replace(old, new, 1)


def replace_exact_count(content: str, old: str, new: str, expected: int, label: str) -> str:
    count = content.count(old)
    if count != expected:
        raise RuntimeError(f"Expected {expected} {label} replacements, found {count}")
    return content.replace(old, new)


def materialize_audio() -> None:
    parts = sorted(PARTS_DIR.glob("part-*.txt"))
    if len(parts) != 9:
        raise RuntimeError(f"Expected 9 staged payload parts, found {len(parts)}")
    encoded = "".join(part.read_text(encoding="ascii") for part in parts)
    payload = base64.b64decode(encoded, validate=True)
    digest = hashlib.sha256(payload).hexdigest()
    if digest != EXPECTED_SHA256:
        raise RuntimeError(f"Door-close OGG SHA mismatch: expected {EXPECTED_SHA256}, got {digest}")
    if payload[:4] != b"OggS":
        raise RuntimeError("Door-close payload is not an OGG stream")

    OGG_PATH.parent.mkdir(parents=True, exist_ok=True)
    OGG_PATH.write_bytes(payload)
    subprocess.run(
        [
            "ffprobe", "-v", "error", "-select_streams", "a:0",
            "-show_entries", "stream=codec_name,sample_rate,channels,duration",
            "-of", "default=noprint_wrappers=1", str(OGG_PATH),
        ],
        check=True,
    )
    subprocess.run(
        [
            "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(OGG_PATH), "-map_metadata", "-1", "-ac", "1", "-ar", "44100",
            "-codec:a", "libmp3lame", "-q:a", "4", str(MP3_PATH),
        ],
        check=True,
    )
    subprocess.run(
        [
            "ffprobe", "-v", "error", "-select_streams", "a:0",
            "-show_entries", "stream=codec_name,sample_rate,channels,duration",
            "-of", "default=noprint_wrappers=1", str(MP3_PATH),
        ],
        check=True,
    )


def patch_catalog() -> None:
    path = "phaser/src/audio/SampleAudioCatalog.js"
    content = read_text(path)
    old = '''  vehicleDoorOpen: sampleEvent([\n    "phaser/assets/audio/vehicles/vehicle-door-open-01.mp3"\n  ], { volume: 0.92 }),\n'''
    new = old + '''  vehicleDoorClose: sampleEvent([\n    "phaser/assets/audio/vehicles/vehicle-door-close-01.mp3"\n  ], { volume: 0.95 }),\n'''
    write_text(path, replace_once(content, old, new, "vehicle door catalogue"))


def patch_raw_audio() -> None:
    path = "phaser/src/systems/RawAudioSystem.js"
    content = read_text(path)
    content = replace_once(
        content,
        '''      source.connect(gain);\n      gain.connect(this.sampleDestination(name));\n      source.start();\n      return true;\n''',
        '''      source.connect(gain);\n      gain.connect(this.sampleDestination(name));\n      const delay = Math.max(0, Number(options.delay) || 0);\n      source.start(this.ctx.currentTime + delay);\n      return true;\n''',
        "delayed sample playback",
    )
    content = replace_once(
        content,
        '      case "vehicleDoorOpen": return this.vehicleDoorOpen();\n',
        '      case "vehicleDoorOpen": return this.vehicleDoorOpen();\n      case "vehicleDoorClose": return this.vehicleDoorClose(options.delay);\n',
        "vehicle door close fallback route",
    )
    content = replace_once(
        content,
        '''  vehicleDoorOpen() {\n    this.noise(0.10, { volume: 0.026, filter: 1180, filterType: "bandpass", q: 1.05 });\n    this.tone(132, 0.13, { delay: 0.035, to: 66, volume: 0.026, type: "triangle", filter: 560 });\n  }\n\n''',
        '''  vehicleDoorOpen() {\n    this.noise(0.10, { volume: 0.026, filter: 1180, filterType: "bandpass", q: 1.05 });\n    this.tone(132, 0.13, { delay: 0.035, to: 66, volume: 0.026, type: "triangle", filter: 560 });\n  }\n\n  vehicleDoorClose(delay = 0) {\n    const baseDelay = Math.max(0, Number(delay) || 0);\n    this.noise(0.12, { delay: baseDelay, volume: 0.040, filter: 760, filterType: "bandpass", q: 0.82 });\n    this.tone(96, 0.17, { delay: baseDelay + 0.015, to: 44, volume: 0.045, type: "triangle", filter: 420 });\n  }\n\n''',
        "vehicle door close fallback",
    )
    write_text(path, content)


def patch_interactions() -> None:
    path = "phaser/src/vehicles/VehicleInteractions.js"
    content = read_text(path)
    content = replace_once(
        content,
        'const EXIT_CORRIDOR_STEPS = Object.freeze([0, 0.5, 1]);\n',
        f'const EXIT_CORRIDOR_STEPS = Object.freeze([0, 0.5, 1]);\nconst VEHICLE_DOOR_CLOSE_DELAY = {DOOR_CLOSE_DELAY};\n',
        "vehicle door close delay constant",
    )
    content = replace_exact_count(
        content,
        '  RawAudio.play("vehicleDoorOpen");\n',
        '  RawAudio.play("vehicleDoorOpen");\n  RawAudio.play("vehicleDoorClose", { delay: VEHICLE_DOOR_CLOSE_DELAY, cooldown: 0 });\n',
        2,
        "open/close action sequence",
    )
    write_text(path, content)


def patch_attribution() -> None:
    path = "phaser/assets/audio/ATTRIBUTION.md"
    content = read_text(path)
    open_line = next((line for line in content.splitlines() if line.startswith("| `vehicleDoorOpen` |")), None)
    if not open_line:
        raise RuntimeError("vehicleDoorOpen attribution row not found")
    close_line = "| `vehicleDoorClose` | `vehicles/vehicle-door-close-01.mp3` (+ OGG working derivative) | close car door / short door slam | titigwen | https://pixabay.com/es/sound-effects/close-car-door-456193/ | Pixabay Content License (verified 2026-08-16; Pixabay marks the source AI Generated) | User-supplied 0.73 s MP3 trimmed from approximately 0.035–0.680 s into a 0.65 s runtime cue; downmixed/resampled to mono 44.1 kHz, high-pass cleaned at 55 Hz, lifted by 1 dB, edge-faded and conservatively limited. One authentic variant is retained for the first listening pass. |"
    content = replace_once(content, open_line, open_line + "\n" + close_line, "vehicle door close attribution")
    write_text(path, content)


def patch_docs() -> None:
    path = "docs/audio-catalog.md"
    content = read_text(path)
    old_integrated = next((line for line in content.splitlines() if line.startswith("- `vehicleDoorOpen` — **integrated candidate on PR #55")), None)
    if not old_integrated:
        raise RuntimeError("Integrated vehicleDoorOpen catalogue line not found")
    new_integrated = "- `vehicleDoorOpen` / `vehicleDoorClose` — **integrated paired candidate on PR #55, pending listening acceptance**: authentic Pixabay one-shots now form a physical door sequence for successful vehicle entry and exit. The opening cue fires immediately and the close/slam follows after 0.52 s; both retain dedicated procedural fallbacks for load/decode failure."
    content = replace_once(content, old_integrated, new_integrated, "integrated vehicle door documentation")

    old_open = "- `vehicleDoorOpen` — **integrated candidate:** one authentic opening one-shot used by successful entry and exit; pending listening acceptance"
    old_close = "- `vehicleDoorClose` — source still pending; will be a separate event layered after the opening/action timing"
    new_open = "- `vehicleDoorOpen` — **integrated candidate:** authentic opening one-shot starts the entry/exit door sequence"
    new_close = "- `vehicleDoorClose` — **integrated candidate:** authentic short slam follows the opening action after 0.52 s; pending paired listening acceptance"
    content = replace_once(content, old_open, new_open, "vehicleDoorOpen sourcing status")
    content = replace_once(content, old_close, new_close, "vehicleDoorClose sourcing status")
    write_text(path, content)


def write_test() -> None:
    test_path = ROOT / "tests" / "vehicle-door-audio.test.js"
    test_path.write_text(
        '''import test from "node:test";\nimport assert from "node:assert/strict";\nimport { readFileSync } from "node:fs";\nimport { SAMPLE_AUDIO_CATALOG } from "../phaser/src/audio/SampleAudioCatalog.js";\n\nconst OPEN_FILE = "phaser/assets/audio/vehicles/vehicle-door-open-01.mp3";\nconst CLOSE_FILE = "phaser/assets/audio/vehicles/vehicle-door-close-01.mp3";\n\nfunction repoFile(path) {\n  return new URL(`../${path}`, import.meta.url);\n}\n\nfunction assertMp3(path) {\n  const data = readFileSync(repoFile(path));\n  assert.ok(data.length > 5_000, `${path} should contain a processed sample, not a placeholder`);\n  const hasId3 = data.subarray(0, 3).toString("ascii") === "ID3";\n  const hasFrameSync = data[0] === 0xff && (data[1] & 0xe0) === 0xe0;\n  assert.ok(hasId3 || hasFrameSync, `${path} should be an MP3 stream`);\n}\n\ntest("vehicle entry and exit use an authentic delayed open-close door pair", () => {\n  assert.deepEqual(SAMPLE_AUDIO_CATALOG.vehicleDoorOpen.files, [OPEN_FILE]);\n  assert.deepEqual(SAMPLE_AUDIO_CATALOG.vehicleDoorClose.files, [CLOSE_FILE]);\n  assert.equal(SAMPLE_AUDIO_CATALOG.vehicleDoorOpen.volume, 0.92);\n  assert.equal(SAMPLE_AUDIO_CATALOG.vehicleDoorClose.volume, 0.95);\n  assert.equal(SAMPLE_AUDIO_CATALOG.vehicleDoorClose.loop, false);\n  assertMp3(OPEN_FILE);\n  assertMp3(CLOSE_FILE);\n\n  const interactions = readFileSync(repoFile("phaser/src/vehicles/VehicleInteractions.js"), "utf8");\n  assert.match(interactions, /const VEHICLE_DOOR_CLOSE_DELAY = 0\\.52;/);\n  assert.equal((interactions.match(/RawAudio\\.play\\("vehicleDoorOpen"\\)/g) || []).length, 2);\n  assert.equal((interactions.match(/RawAudio\\.play\\("vehicleDoorClose", \\{ delay: VEHICLE_DOOR_CLOSE_DELAY, cooldown: 0 \\}\\)/g) || []).length, 2);\n\n  const rawAudio = readFileSync(repoFile("phaser/src/systems/RawAudioSystem.js"), "utf8");\n  assert.match(rawAudio, /const delay = Math\\.max\\(0, Number\\(options\\.delay\\) \\|\\| 0\\);\\s*source\\.start\\(this\\.ctx\\.currentTime \\+ delay\\);/);\n  assert.match(rawAudio, /case "vehicleDoorClose": return this\\.vehicleDoorClose\\(options\\.delay\\);/);\n  assert.match(rawAudio, /vehicleDoorClose\\(delay = 0\\)[\\s\\S]*?baseDelay \\+ 0\\.015/);\n});\n''',
        encoding="utf-8",
    )


def main() -> None:
    materialize_audio()
    patch_catalog()
    patch_raw_audio()
    patch_interactions()
    patch_attribution()
    patch_docs()
    write_test()
    print(f"Integrated vehicleDoorClose: {OGG_PATH.relative_to(ROOT)} -> {MP3_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
