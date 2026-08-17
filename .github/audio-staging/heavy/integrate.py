from pathlib import Path
import json
import subprocess

ROOT = Path.cwd()
AUDIO = ROOT / "phaser/assets/audio/vehicles"
AUDIO.mkdir(parents=True, exist_ok=True)
source = AUDIO / "vehicle-collision-heavy-01.ogg"


def run(*args: str) -> None:
    subprocess.run(args, check=True)


run(
    "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
    "-i", str(source), "-map_metadata", "-1", "-ac", "1", "-ar", "44100",
    "-codec:a", "libmp3lame", "-q:a", "3",
    str(AUDIO / "vehicle-collision-heavy-01.mp3"),
)

variants = {
    2: "asetrate=44100*0.9687,aresample=44100,highpass=f=32,lowpass=f=11500,afade=t=in:st=0:d=0.004,afade=t=out:st=1.315:d=0.13,atrim=duration=1.445",
    3: "asetrate=44100*1.022,aresample=44100,highpass=f=40,lowpass=f=13500,afade=t=in:st=0:d=0.004,afade=t=out:st=1.255:d=0.13,atrim=duration=1.385",
}
for number, audio_filter in variants.items():
    ogg = AUDIO / f"vehicle-collision-heavy-{number:02d}.ogg"
    mp3 = AUDIO / f"vehicle-collision-heavy-{number:02d}.mp3"
    run(
        "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(source), "-af", audio_filter, "-map_metadata", "-1",
        "-ac", "1", "-ar", "44100", "-codec:a", "libvorbis", "-q:a", "6", str(ogg),
    )
    run(
        "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(ogg), "-map_metadata", "-1", "-ac", "1", "-ar", "44100",
        "-codec:a", "libmp3lame", "-q:a", "3", str(mp3),
    )

for number in range(1, 4):
    for extension in ("ogg", "mp3"):
        path = AUDIO / f"vehicle-collision-heavy-{number:02d}.{extension}"
        data = json.loads(subprocess.check_output([
            "ffprobe", "-v", "error", "-show_entries",
            "stream=codec_name,sample_rate,channels:format=duration", "-of", "json", str(path)
        ], text=True))
        stream = data["streams"][0]
        duration = float(data["format"]["duration"])
        assert int(stream["sample_rate"]) == 44100, (path, stream)
        assert int(stream["channels"]) == 1, (path, stream)
        assert 1.30 <= duration <= 1.55, (path, duration)
        assert path.stat().st_size > 5000, path
        print(path, stream["codec_name"], duration, path.stat().st_size)

catalog = ROOT / "phaser/src/audio/SampleAudioCatalog.js"
text = catalog.read_text()
if "vehicleCollisionHeavy: sampleEvent" not in text:
    marker = "  vehicleSkidLoop: sampleEvent(["
    block = (
        "  vehicleCollisionHeavy: sampleEvent([\n"
        "    \"phaser/assets/audio/vehicles/vehicle-collision-heavy-01.mp3\",\n"
        "    \"phaser/assets/audio/vehicles/vehicle-collision-heavy-02.mp3\",\n"
        "    \"phaser/assets/audio/vehicles/vehicle-collision-heavy-03.mp3\"\n"
        "  ], { volume: 0.82 }),\n"
    )
    assert marker in text
    catalog.write_text(text.replace(marker, block + marker))

attribution = ROOT / "phaser/assets/audio/ATTRIBUTION.md"
text = attribution.read_text()
if "`vehicleCollisionHeavy`" not in text:
    row = "| `vehicleCollisionHeavy` | `vehicles/vehicle-collision-heavy-01.mp3` … `vehicles/vehicle-collision-heavy-03.mp3` (+ matching OGG working derivatives) | Sound Effect - Car Crash / heavy bodywork, glass and debris impact | u_mgq59j5ayf | https://pixabay.com/es/sound-effects/pel%C3%ADculas-y-efectos-especiales-sound-effect-car-crash-394903/ | Pixabay Content License (verified 2026-08-17) | User-supplied 1.62 s MP3 classified as a heavy crash because of its broad low-frequency impact and pronounced glass/metal tail. Trimmed to roughly 1.4 s, downmixed/resampled to mono 44.1 kHz, high/low-pass cleaned, edge-faded and conservatively level-managed. Variants 02–03 use subtle pitch/filter/duration changes to reduce repetition while preserving the same crash identity. |\n"
    attribution.write_text(text.replace("\n\n## Rules", "\n" + row + "\n## Rules"))

docs = ROOT / "docs/audio-catalog.md"
text = docs.read_text()
if "real heavy-crash family integrated" not in text:
    bullet = "- `vehicleCollisionHeavy` — **real heavy-crash family integrated on PR #55, pending listening acceptance**: the supplied Pixabay crash provides three restrained runtime variants with a broad bodywork hit and glass/metal tail. Impact-speed classification remains authoritative, so this family only plays from the heavy threshold upward; the procedural crash remains a loading/decoding fallback.\n"
    text = text.replace("## Audio Lab", bullet + "## Audio Lab")
text = text.replace(
    "- `vehicleCollisionHeavy` — **procedural candidate on PR #55:** impact-speed classification selects a heavier crash fallback; real 3 sample variants remain a sourcing task",
    "- `vehicleCollisionHeavy` — **integrated candidate:** three real heavy-crash variants selected only at the heavy impact-speed threshold; pending listening acceptance",
)
docs.write_text(text)

test_path = ROOT / "tests/vehicle-collision-audio.test.js"
text = test_path.read_text()
if "SAMPLE_AUDIO_CATALOG" not in text:
    text = text.replace(
        'import { readFileSync } from "node:fs";\n',
        'import { readFileSync } from "node:fs";\nimport { SAMPLE_AUDIO_CATALOG } from "../phaser/src/audio/SampleAudioCatalog.js";\n',
    )
    text = text.replace(
        'const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");',
        'const repoFile = path => new URL(`../${path}`, import.meta.url);\nconst source = path => readFileSync(repoFile(path), "utf8");\n\nfunction assertMp3(path) {\n  const data = readFileSync(repoFile(path));\n  assert.ok(data.length > 5_000, `${path} should contain a processed sample`);\n  const hasId3 = data.subarray(0, 3).toString("ascii") === "ID3";\n  const hasFrameSync = data[0] === 0xff && (data[1] & 0xe0) === 0xe0;\n  assert.ok(hasId3 || hasFrameSync, `${path} should be an MP3 stream`);\n}',
    )
if "real heavy collision family" not in text:
    text += '''

test("real heavy collision family is registered with three committed variants", () => {
  const files = [
    "phaser/assets/audio/vehicles/vehicle-collision-heavy-01.mp3",
    "phaser/assets/audio/vehicles/vehicle-collision-heavy-02.mp3",
    "phaser/assets/audio/vehicles/vehicle-collision-heavy-03.mp3"
  ];
  assert.deepEqual(SAMPLE_AUDIO_CATALOG.vehicleCollisionHeavy.files, files);
  assert.equal(SAMPLE_AUDIO_CATALOG.vehicleCollisionHeavy.volume, 0.82);
  assert.equal(SAMPLE_AUDIO_CATALOG.vehicleCollisionHeavy.loop, false);
  files.forEach(assertMp3);
});
'''
test_path.write_text(text)
