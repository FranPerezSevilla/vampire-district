from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path.cwd()
STAGING = ROOT / ".github" / "audio-staging" / "light"
DEST = ROOT / "phaser" / "assets" / "audio" / "vehicles"

EXPECTED_SHA256 = {
    1: "9c3ad7fac0b0e6e38f092dea4632b2c859d09988881eafdc70f825402fbf61c7",
    2: "9e25001ac7561084ec15f608ca14fd61f1a8ac6a1c1e9ce930c0799cfe82a987",
    3: "e69b8a46cd590885aeff1211e9558f1d2f91efc33aa5d120e1d85d772e483f95",
    4: "74e8b4916793a1ff85acaed376f508e52fc0d80eebe53c6abb9b79a0ed6ee3e1",
}


def run(*args: str) -> None:
    subprocess.run(args, check=True)


def probe(path: Path) -> dict:
    output = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "stream=codec_name,sample_rate,channels:format=duration",
            "-of",
            "json",
            str(path),
        ],
        text=True,
    )
    return json.loads(output)


def materialize_audio() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    for index, expected_hash in EXPECTED_SHA256.items():
        staged = STAGING / f"vehicle-collision-light-{index:02d}.ogg.bin"
        ogg = DEST / f"vehicle-collision-light-{index:02d}.ogg"
        mp3 = DEST / f"vehicle-collision-light-{index:02d}.mp3"

        payload = staged.read_bytes()
        actual_hash = hashlib.sha256(payload).hexdigest()
        if actual_hash != expected_hash:
            raise RuntimeError(
                f"SHA-256 mismatch for {staged}: expected {expected_hash}, got {actual_hash}"
            )
        if payload[:4] != b"OggS":
            raise RuntimeError(f"{staged} is not an OGG stream")

        ogg.write_bytes(payload)
        run(
            "ffmpeg",
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(ogg),
            "-map_metadata",
            "-1",
            "-ac",
            "1",
            "-ar",
            "44100",
            "-codec:a",
            "libmp3lame",
            "-q:a",
            "3",
            str(mp3),
        )

        for path in (ogg, mp3):
            data = probe(path)
            stream = data["streams"][0]
            duration = float(data["format"]["duration"])
            if int(stream["sample_rate"]) != 44100:
                raise RuntimeError(f"Unexpected sample rate for {path}: {stream}")
            if int(stream["channels"]) != 1:
                raise RuntimeError(f"Unexpected channel count for {path}: {stream}")
            if not 0.45 <= duration <= 0.72:
                raise RuntimeError(f"Unexpected duration for {path}: {duration}")
            if path.stat().st_size <= 5000:
                raise RuntimeError(f"Processed asset is too small: {path}")
            print(path, stream["codec_name"], duration, path.stat().st_size)


def update_catalog() -> None:
    path = ROOT / "phaser" / "src" / "audio" / "SampleAudioCatalog.js"
    text = path.read_text()
    if "vehicleCollisionLight: sampleEvent" in text:
        return
    marker = "  vehicleCollisionHeavy: sampleEvent(["
    block = '''  vehicleCollisionLight: sampleEvent([
    "phaser/assets/audio/vehicles/vehicle-collision-light-01.mp3",
    "phaser/assets/audio/vehicles/vehicle-collision-light-02.mp3",
    "phaser/assets/audio/vehicles/vehicle-collision-light-03.mp3",
    "phaser/assets/audio/vehicles/vehicle-collision-light-04.mp3"
  ], { volume: 0.72 }),
'''
    if marker not in text:
        raise RuntimeError("Heavy collision catalogue marker not found")
    path.write_text(text.replace(marker, block + marker))


def update_attribution() -> None:
    path = ROOT / "phaser" / "assets" / "audio" / "ATTRIBUTION.md"
    text = path.read_text()
    if "`vehicleCollisionLight`" in text:
        return
    row = (
        "| `vehicleCollisionLight` | `vehicles/vehicle-collision-light-01.mp3` … "
        "`vehicles/vehicle-collision-light-04.mp3` (+ matching OGG working derivatives) | "
        "Iron Smash with Debris / light bodywork, bumper-like metal and loose-debris impacts | "
        "freesounds123 | "
        "https://pixabay.com/sound-effects/film-special-effects-iron-smash-with-debris-351841/ | "
        "Pixabay Content License (verified 2026-08-17) | "
        "User-supplied 5.07 s MP3 split into four genuinely different impact regions "
        "(approximately 0.175–0.660 s, 0.655–1.280 s, 2.015–2.675 s and "
        "2.790–3.365 s), rather than pitch-cloned variants. Each cut was downmixed/"
        "resampled to mono 44.1 kHz, high/low-pass cleaned, edge-faded and conservatively "
        "limited. Reduced low-end weight and short debris tails keep this family clearly "
        "below `vehicleCollisionHeavy`. |\n"
    )
    marker = "\n## Rules"
    if marker not in text:
        raise RuntimeError("Attribution rules marker not found")
    path.write_text(text.replace(marker, "\n" + row + marker))


def update_docs() -> None:
    path = ROOT / "docs" / "audio-catalog.md"
    text = path.read_text()
    summary = (
        "- `vehicleCollisionLight` — **real light-impact family integrated on PR #55, "
        "pending listening acceptance**: four authentic cuts from different moments of "
        "the supplied Pixabay iron/debris recording provide short bodywork and loose-metal "
        "responses without borrowing the heavy crash's low-end weight or glass tail. The "
        "procedural sound remains a loading/decoding fallback.\n"
    )
    heavy_marker = (
        "- `vehicleCollisionHeavy` — **real heavy-crash family integrated on PR #55, "
        "pending listening acceptance**:"
    )
    if summary not in text:
        if heavy_marker not in text:
            raise RuntimeError("Heavy collision summary marker not found")
        text = text.replace(heavy_marker, summary + heavy_marker)

    old = (
        "- `vehicleCollisionLight` — **procedural candidate on PR #55:** dedicated light "
        "bodywork/metal feedback now replaces the unrelated `bodyDrop` placeholder; real "
        "3–4 sample variants remain a sourcing task"
    )
    new = (
        "- `vehicleCollisionLight` — **integrated candidate:** four real short metal/"
        "bodywork variants selected from the light threshold up to, but not including, "
        "the heavy threshold; pending listening acceptance"
    )
    if old in text:
        text = text.replace(old, new)
    path.write_text(text)


def update_tests() -> None:
    path = ROOT / "tests" / "vehicle-collision-audio.test.js"
    text = path.read_text()
    if 'test("real light collision family is registered with four committed variants"' in text:
        return
    marker = '\ntest("real heavy collision family is registered with three committed variants"'
    block = '''
test("real light collision family is registered with four committed variants", () => {
  const files = [
    "phaser/assets/audio/vehicles/vehicle-collision-light-01.mp3",
    "phaser/assets/audio/vehicles/vehicle-collision-light-02.mp3",
    "phaser/assets/audio/vehicles/vehicle-collision-light-03.mp3",
    "phaser/assets/audio/vehicles/vehicle-collision-light-04.mp3"
  ];
  assert.deepEqual(SAMPLE_AUDIO_CATALOG.vehicleCollisionLight.files, files);
  assert.equal(SAMPLE_AUDIO_CATALOG.vehicleCollisionLight.volume, 0.72);
  assert.equal(SAMPLE_AUDIO_CATALOG.vehicleCollisionLight.loop, false);
  files.forEach(assertMp3);
});

'''
    if marker not in text:
        raise RuntimeError("Heavy collision test marker not found")
    path.write_text(text.replace(marker, "\n" + block + marker.lstrip("\n")))


def main() -> None:
    materialize_audio()
    update_catalog()
    update_attribution()
    update_docs()
    update_tests()


if __name__ == "__main__":
    main()
