from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parents[1]
helper_path = ROOT / "tools/_tmp-smooth-siren-vehicle-acceleration.py"
text = helper_path.read_text(encoding="utf-8")

old = '''    if len(samples) < rate:
        raise SystemExit("Police siren loop is unexpectedly short.")

    crossfade_frames = min(round(rate * 0.20), len(samples) // 6)
    if crossfade_frames < 256:
        raise SystemExit("Police siren loop is too short for a safe circular crossfade.")
'''
new = '''    duration = len(samples) / rate
    if duration < 0.25:
        raise SystemExit(f"Police siren loop is too short to repair safely: {duration:.3f}s")

    # This source is intentionally a very short siren cycle. Size the circular
    # blend to the source instead of imposing a long fixed crossfade that would
    # erase too much of the authored rise/fall pattern.
    crossfade_seconds = min(0.12, max(0.055, duration * 0.16))
    crossfade_frames = min(round(rate * crossfade_seconds), len(samples) // 4)
    if crossfade_frames < 256:
        raise SystemExit(f"Police siren loop cannot sustain a safe circular crossfade: {duration:.3f}s")
'''
if old not in text:
    raise SystemExit("Expected short-loop guard not found in staged helper.")
text = text.replace(old, new, 1)
text = text.replace(
    "a ~200 ms circular equal-power crossfade",
    "a short source-sized circular equal-power crossfade",
)
text = text.replace(
    "now uses a ~200 ms circular equal-power crossfade",
    "now uses a short source-sized circular equal-power crossfade",
)
helper_path.write_text(text, encoding="utf-8")

runpy.run_path(str(helper_path), run_name="__main__")
