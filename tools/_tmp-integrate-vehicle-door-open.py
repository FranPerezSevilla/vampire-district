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


# Register one authentic browser-compatible door-opening sample. Keep the event
# stable so future variants or per-archetype doors do not leak into gameplay.
replace_once(
    "phaser/src/audio/SampleAudioCatalog.js",
    '''  policeSirenLoop: sampleEvent([
    "phaser/assets/audio/police/police-siren-loop-01.wav"
  ], { volume: 0.72, loop: true }),
  vehicleSkidLoop: sampleEvent([
''',
    '''  policeSirenLoop: sampleEvent([
    "phaser/assets/audio/police/police-siren-loop-01.wav"
  ], { volume: 0.72, loop: true }),
  vehicleDoorOpen: sampleEvent([
    "phaser/assets/audio/vehicles/vehicle-door-open-01.mp3"
  ], { volume: 0.92 }),
  vehicleSkidLoop: sampleEvent([
'''
)

# Successful enter/exit interactions now emit a physical door action instead
# of the generic UI confirmation tick. Door-close will be layered separately
# when its source arrives.
interactions_path = "phaser/src/vehicles/VehicleInteractions.js"
interactions = read(interactions_path)
old_confirmation = 'RawAudio.play("confirm");'
if interactions.count(old_confirmation) != 2:
    raise SystemExit(
        f"Expected exactly two successful vehicle confirmation sounds, found {interactions.count(old_confirmation)}"
    )
write(interactions_path, interactions.replace(old_confirmation, 'RawAudio.play("vehicleDoorOpen");'))

# Retain a restrained mechanical fallback for loading/decode failure only.
replace_once(
    "phaser/src/systems/RawAudioSystem.js",
    '''      case "bodyDrop": return this.hit(85, 0.045, 0.10);
      case "vehicleCollisionLight": return this.vehicleCollision(false);
''',
    '''      case "bodyDrop": return this.hit(85, 0.045, 0.10);
      case "vehicleDoorOpen": return this.vehicleDoorOpen();
      case "vehicleCollisionLight": return this.vehicleCollision(false);
'''
)
replace_once(
    "phaser/src/systems/RawAudioSystem.js",
    '''  vehicleSkid() {
''',
    '''  vehicleDoorOpen() {
    this.noise(0.10, { volume: 0.026, filter: 1180, filterType: "bandpass", q: 1.05 });
    this.tone(132, 0.13, { delay: 0.035, to: 66, volume: 0.026, type: "triangle", filter: 560 });
  }

  vehicleSkid() {
'''
)

# Focused catalogue/runtime contract. The source is intentionally short, so
# use a lower binary-size floor than the longer existing one-shot families.
test_path = "tests/audio-sample-catalog.test.js"
replace_once(
    test_path,
    '''const POLICE_SIREN_FILES = [
  "phaser/assets/audio/police/police-siren-loop-01.wav"
];
''',
    '''const POLICE_SIREN_FILES = [
  "phaser/assets/audio/police/police-siren-loop-01.wav"
];

const VEHICLE_DOOR_OPEN_FILES = [
  "phaser/assets/audio/vehicles/vehicle-door-open-01.mp3"
];
'''
)
replace_once(
    test_path,
    '''test("policeSirenLoop is a gap-safe spatial police-car runtime loop", () => {
''',
    '''test("vehicleDoorOpen is a real one-shot used by successful enter and exit actions", () => {
  assert.deepEqual(SAMPLE_AUDIO_CATALOG.vehicleDoorOpen.files, VEHICLE_DOOR_OPEN_FILES);
  assert.equal(SAMPLE_AUDIO_CATALOG.vehicleDoorOpen.volume, 0.92);
  assert.equal(SAMPLE_AUDIO_CATALOG.vehicleDoorOpen.loop, false);

  const data = readFileSync(repoFile(VEHICLE_DOOR_OPEN_FILES[0]));
  assert.ok(data.length > 6_000, "vehicle door opening should contain the processed sample, not a placeholder");
  const hasId3 = data.subarray(0, 3).toString("ascii") === "ID3";
  const hasFrameSync = data[0] === 0xff && (data[1] & 0xe0) === 0xe0;
  assert.ok(hasId3 || hasFrameSync, "vehicle door opening should be an MP3 stream");

  const interactionsSource = readFileSync(repoFile("phaser/src/vehicles/VehicleInteractions.js"), "utf8");
  assert.equal(
    (interactionsSource.match(/RawAudio\\.play\\("vehicleDoorOpen"\\)/g) || []).length,
    2,
    "successful vehicle entry and exit should both own the opening sound"
  );
  assert.doesNotMatch(interactionsSource, /RawAudio\\.play\\("confirm"\\)/);

  const rawAudioSource = readFileSync(repoFile("phaser/src/systems/RawAudioSystem.js"), "utf8");
  assert.match(rawAudioSource, /case "vehicleDoorOpen": return this\\.vehicleDoorOpen\\(\\);/);
});

test("policeSirenLoop is a gap-safe spatial police-car runtime loop", () => {
'''
)

# Record the exact source, licence and processing decisions.
attribution_path = "phaser/assets/audio/ATTRIBUTION.md"
replace_once(
    attribution_path,
    '''| `vehicleSkidLoop` | `vehicles/vehicle-skid-loop-01.wav` (+ OGG working derivative) | Car brake / tyre skid | MagiaZ | https://pixabay.com/es/sound-effects/pel%C3%ADculas-y-efectos-especiales-car-brake-325519/ | Pixabay Content License (verified 2026-08-15; Pixabay marks the source AI Generated) | User-supplied MP3 trimmed to the stable skid section at approximately 1.45–4.10 s, shaped into a ~2.56 s loop with a 90 ms circular equal-power crossfade, downmixed/resampled and gain-normalized. No creative pitch/EQ alteration. The browser runtime uses PCM WAV for gap-sensitive looping. |
''',
    '''| `vehicleSkidLoop` | `vehicles/vehicle-skid-loop-01.wav` (+ OGG working derivative) | Car brake / tyre skid | MagiaZ | https://pixabay.com/es/sound-effects/pel%C3%ADculas-y-efectos-especiales-car-brake-325519/ | Pixabay Content License (verified 2026-08-15; Pixabay marks the source AI Generated) | User-supplied MP3 trimmed to the stable skid section at approximately 1.45–4.10 s, shaped into a ~2.56 s loop with a 90 ms circular equal-power crossfade, downmixed/resampled and gain-normalized. No creative pitch/EQ alteration. The browser runtime uses PCM WAV for gap-sensitive looping. |
| `vehicleDoorOpen` | `vehicles/vehicle-door-open-01.mp3` (+ OGG working derivative) | Open Car Door / handle, latch and opening movement | DRAGON-STUDIO | https://pixabay.com/es/sound-effects/pel%C3%ADculas-y-efectos-especiales-open-car-door-372469/ | Pixabay Content License (verified 2026-08-16) | User-supplied MP3 trimmed from approximately 0.16–0.82 s to remove excess silence while preserving the handle/latch and opening movement; downmixed/resampled to mono 44.1 kHz, high-pass cleaned, lifted by 2 dB, edge-faded and conservatively limited. One authentic variant is retained for the first listening pass. |
'''
)

catalog_path = "docs/audio-catalog.md"
replace_once(
    catalog_path,
    '''- `vehicleSkidLoop` — **integrated + listening accepted on PR #55**: the supplied MagiaZ tyre skid is trimmed into a gap-sensitive PCM WAV loop. Aggressive-driving pulses sustain one stateful loop while the drift continues and let it stop shortly after the skid ends; civilian panic remains a separate non-reporting reaction with no Heat.
''',
    '''- `vehicleDoorOpen` — **integrated candidate on PR #55, pending listening acceptance**: the supplied DRAGON-STUDIO/Pixabay recording is trimmed to its handle, latch and opening movement and exposed as one browser-compatible MP3 one-shot. Successful vehicle entry and exit now trigger this physical action instead of the generic UI confirmation tick; a dedicated close sample remains separate and pending.
- `vehicleSkidLoop` — **integrated + listening accepted on PR #55**: the supplied MagiaZ tyre skid is trimmed into a gap-sensitive PCM WAV loop. Aggressive-driving pulses sustain one stateful loop while the drift continues and let it stop shortly after the skid ends; civilian panic remains a separate non-reporting reaction with no Heat.
'''
)
replace_once(
    catalog_path,
    '''- `vehicleEnter`, `vehicleExit`
''',
    '''- `vehicleDoorOpen` — **integrated candidate:** one authentic opening one-shot used by successful entry and exit; pending listening acceptance
- `vehicleDoorClose` — source still pending; will be a separate event layered after the opening/action timing
'''
)

print("Integrated real vehicle door opening audio, attribution and regression coverage.")
