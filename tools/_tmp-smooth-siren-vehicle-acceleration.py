from array import array
from pathlib import Path
import math
import subprocess
import sys
import wave

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
        raise SystemExit(f"Expected fragment not found in {path}: {old[:140]!r}")
    write(path, content.replace(old, new, 1))


def repair_police_siren_loop():
    wav_path = ROOT / "phaser/assets/audio/police/police-siren-loop-01.wav"
    ogg_path = wav_path.with_suffix(".ogg")
    mp3_path = wav_path.with_suffix(".mp3")

    with wave.open(str(wav_path), "rb") as source:
        channels = source.getnchannels()
        sample_width = source.getsampwidth()
        rate = source.getframerate()
        compression = source.getcomptype()
        frames = source.readframes(source.getnframes())

    if channels != 1 or sample_width != 2 or rate != 44100 or compression != "NONE":
        raise SystemExit(
            f"Unexpected siren WAV format: channels={channels}, width={sample_width}, "
            f"rate={rate}, compression={compression}"
        )

    samples = array("h")
    samples.frombytes(frames)
    if sys.byteorder != "little":
        samples.byteswap()
    if len(samples) < rate:
        raise SystemExit("Police siren loop is unexpectedly short.")

    crossfade_frames = min(round(rate * 0.20), len(samples) // 6)
    if crossfade_frames < 256:
        raise SystemExit("Police siren loop is too short for a safe circular crossfade.")

    before_delta = abs(int(samples[-1]) - int(samples[0]))
    head = samples[:crossfade_frames]
    tail = samples[-crossfade_frames:]
    seam = []
    denominator = max(1, crossfade_frames - 1)
    for index in range(crossfade_frames):
        t = index / denominator
        tail_gain = math.cos(t * math.pi / 2)
        head_gain = math.sin(t * math.pi / 2)
        mixed = int(round(int(tail[index]) * tail_gain + int(head[index]) * head_gain))
        seam.append(max(-32768, min(32767, mixed)))

    repaired = array("h", seam)
    repaired.extend(samples[crossfade_frames:-crossfade_frames])
    after_delta = abs(int(repaired[-1]) - int(repaired[0]))

    temp_path = wav_path.with_name(wav_path.stem + ".repaired.wav")
    payload = array("h", repaired)
    if sys.byteorder != "little":
        payload.byteswap()
    with wave.open(str(temp_path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(rate)
        output.setcomptype("NONE", "not compressed")
        output.writeframes(payload.tobytes())
    temp_path.replace(wav_path)

    subprocess.run([
        "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(wav_path), "-map_metadata", "-1", "-ac", "1", "-ar", "44100",
        "-codec:a", "libvorbis", "-q:a", "5", str(ogg_path)
    ], check=True)
    subprocess.run([
        "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(wav_path), "-map_metadata", "-1", "-ac", "1", "-ar", "44100",
        "-codec:a", "libmp3lame", "-q:a", "4", str(mp3_path)
    ], check=True)

    print(
        f"Police siren circular crossfade: {crossfade_frames / rate:.3f}s; "
        f"wrap sample delta {before_delta} -> {after_delta}; "
        f"frames {len(samples)} -> {len(repaired)}"
    )


repair_police_siren_loop()

# Stretch the audible gearbox cadence while preserving the launch character.
vehicles_path = "phaser/src/data/vehicles.js"
for old, new in [
    ("gearHoldDuration: 0.28, firstGearHoldDuration: 0.26", "gearHoldDuration: 0.42, firstGearHoldDuration: 0.30"),
    ("gearHoldDuration: 0.30, firstGearHoldDuration: 0.28", "gearHoldDuration: 0.44, firstGearHoldDuration: 0.32"),
    ("gearHoldDuration: 0.34, firstGearHoldDuration: 0.32", "gearHoldDuration: 0.48, firstGearHoldDuration: 0.36"),
    ("gearHoldDuration: 0.22, firstGearHoldDuration: 0.20", "gearHoldDuration: 0.34, firstGearHoldDuration: 0.26"),
]:
    replace_once(vehicles_path, old, new)

model_path = "phaser/src/vehicles/VehicleModel.js"
replace_once(
    model_path,
    '''export function vehicleGearTorqueMultiplier(gear, gearCount = 5) {
  const count = Math.max(1, Math.round(Number(gearCount) || 1));
  const selected = Math.round(clamp(Number(gear) || 1, 1, count));
  if (count <= 1) return 1;
  const progress = (selected - 1) / (count - 1);
  return 1.20 - 0.34 * progress;
}
''',
    '''export function vehicleGearTorqueMultiplier(gear, gearCount = 5) {
  const count = Math.max(1, Math.round(Number(gearCount) || 1));
  const selected = Math.round(clamp(Number(gear) || 1, 1, count));
  if (count <= 1) return 1;
  const progress = (selected - 1) / (count - 1);
  // Keep the launch punch, then let higher gears trade torque for a longer,
  // readable build toward top speed instead of sprinting through the box.
  return 1.20 - 0.62 * Math.pow(progress, 0.82);
}

export function vehicleHighSpeedAccelerationMultiplier(speed, maxSpeed) {
  const maximum = Math.max(1, Number(maxSpeed) || 1);
  const ratio = clamp(Math.abs(Number(speed) || 0) / maximum, 0, 1);
  const taperStart = 0.58;
  if (ratio <= taperStart) return 1;
  const remaining = clamp((1 - ratio) / (1 - taperStart), 0, 1);
  // Near maximum speed the car should keep gaining speed, but slowly enough
  // that 4th/5th gear have time to exist as an audible/driving state.
  return 0.02 + 0.98 * Math.pow(remaining, 1.5);
}
'''
)
replace_once(
    model_path,
    '''  const gearTorque = vehicleGearTorqueMultiplier(gear, gearCount);
  const shiftTorque = vehicleGearShiftActive(gear, gearShiftTimer, archetype) ? 0.78 : 1;
''',
    '''  const gearTorque = vehicleGearTorqueMultiplier(gear, gearCount);
  const shiftTorque = vehicleGearShiftActive(gear, gearShiftTimer, archetype) ? 0.78 : 1;
  const accelerationTaper = vehicleHighSpeedAccelerationMultiplier(speed, maxSpeed);
'''
)
replace_once(
    model_path,
    "speed += acceleration * launchMultiplier * gearTorque * shiftTorque * handbrakeThrottleFactor * input.throttle * seconds;",
    "speed += acceleration * launchMultiplier * gearTorque * shiftTorque * accelerationTaper * handbrakeThrottleFactor * input.throttle * seconds;"
)
replace_once(
    model_path,
    "speed + acceleration * launchMultiplier * gearTorque * shiftTorque * input.throttle * seconds;",
    "speed + acceleration * launchMultiplier * gearTorque * shiftTorque * accelerationTaper * input.throttle * seconds;"
)

# Update the focused vehicle regression contract.
test_path = "tests/vehicle-model.test.js"
replace_once(
    test_path,
    '''  vehicleCameraZoom,
  vehicleGearCount,
''',
    '''  vehicleCameraZoom,
  vehicleGearCount,
  vehicleHighSpeedAccelerationMultiplier,
'''
)
replace_once(test_path, "gearHoldDuration: 0.28,", "gearHoldDuration: 0.42,")
replace_once(test_path, "firstGearHoldDuration: 0.26,", "firstGearHoldDuration: 0.30,")
replace_once(
    test_path,
    'assert.ok(shifts[index] - shifts[index - 1] >= 0.40, "successive upshifts should have an audible dwell");',
    'assert.ok(shifts[index] - shifts[index - 1] >= 0.55, "successive upshifts should have a clearly audible dwell");'
)
replace_once(
    test_path,
    '''  assert.ok(state.speed <= archetype.maxSpeed);
});

test("directional vehicle camera looks ahead only during stable forward travel", () => {
''',
    '''  assert.ok(state.speed <= archetype.maxSpeed);
});

test("upper gears stretch the run to top speed without dulling the launch", () => {
  let state = createVehicleState(definition, archetype);
  let halfSecondSpeed = 0;
  let timeToNinetyNine = null;
  for (let index = 0; index < 120; index++) {
    state = stepVehicleKinematics(state, { move: { x: 0, y: -1 } }, 0.05, archetype);
    const elapsed = (index + 1) * 0.05;
    if (index === 9) halfSecondSpeed = state.speed;
    if (timeToNinetyNine == null && state.speed >= archetype.maxSpeed * 0.99) {
      timeToNinetyNine = elapsed;
    }
  }
  assert.ok(halfSecondSpeed > 190 && halfSecondSpeed < 235, "launch character should remain lively");
  assert.ok(timeToNinetyNine >= 3.0, "maximum speed should take several seconds to build");
  assert.ok(timeToNinetyNine <= 5.5, "the arcade car should still reach its performance envelope");
  assert.equal(vehicleHighSpeedAccelerationMultiplier(archetype.maxSpeed * 0.50, archetype.maxSpeed), 1);
  assert.ok(vehicleHighSpeedAccelerationMultiplier(archetype.maxSpeed * 0.95, archetype.maxSpeed) < 0.08);
});

test("directional vehicle camera looks ahead only during stable forward travel", () => {
'''
)

# Record why the siren derivative changed and current listening status.
attribution_path = "phaser/assets/audio/ATTRIBUTION.md"
replace_once(
    attribution_path,
    "User-supplied MP3 kept at its authored loop boundaries, downmixed to mono and resampled to 44.1 kHz. OGG/Vorbis is the working derivative; the browser runtime uses PCM WAV for gap-sensitive looping. No creative pitch/EQ alteration.",
    "User-supplied MP3 downmixed to mono and resampled to 44.1 kHz. After in-game listening exposed a small wrap seam, the runtime loop was rebuilt with a ~200 ms circular equal-power crossfade so the tail blends into the head before repeating. OGG/Vorbis and MP3 mirrors are regenerated from the repaired PCM WAV. No creative pitch/EQ alteration."
)

catalog_path = "docs/audio-catalog.md"
replace_once(
    catalog_path,
    "`policeSirenLoop` — **integrated candidate on PR #55, pending listening acceptance**: the supplied szpury/Freesound siren is kept at its authored loop boundaries and materialized as a PCM WAV runtime loop.",
    "`policeSirenLoop` — **re-looped candidate on PR #55, pending quick listening re-check**: the supplied szpury/Freesound siren now uses a ~200 ms circular equal-power crossfade after the authored boundary produced a subtle audible seam in-game; it remains a PCM WAV runtime loop."
)
replace_once(
    catalog_path,
    "After playtest feedback that automatic upshifts were effectively rapid-fire, each archetype now separates the short torque/RPM shift cut from a longer per-gear dwell, including a first-gear hold, without reducing the established arcade acceleration.",
    "After playtest feedback, each archetype now separates the short torque/RPM shift cut from a longer per-gear dwell, including a first-gear hold. A high-speed acceleration taper and lower upper-gear torque preserve the lively launch while making 3rd–5th gear breathe and stretching the run to maximum speed over several seconds."
)

print("Repaired police siren seam and stretched upper-gear acceleration.")
