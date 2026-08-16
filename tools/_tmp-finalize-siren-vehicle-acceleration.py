from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parents[1]
helper_path = ROOT / "tools/_tmp-smooth-siren-vehicle-acceleration.py"
text = helper_path.read_text(encoding="utf-8")

# Adapt the loop blend to the real 0.784 s source.
old_guard = '''    if len(samples) < rate:
        raise SystemExit("Police siren loop is unexpectedly short.")

    crossfade_frames = min(round(rate * 0.20), len(samples) // 6)
    if crossfade_frames < 256:
        raise SystemExit("Police siren loop is too short for a safe circular crossfade.")
'''
new_guard = '''    duration = len(samples) / rate
    if duration < 0.25:
        raise SystemExit(f"Police siren loop is too short to repair safely: {duration:.3f}s")

    crossfade_seconds = min(0.12, max(0.055, duration * 0.16))
    crossfade_frames = min(round(rate * crossfade_seconds), len(samples) // 4)
    if crossfade_frames < 256:
        raise SystemExit(f"Police siren loop cannot sustain a safe circular crossfade: {duration:.3f}s")
'''
if old_guard not in text:
    raise SystemExit("Expected original short-loop guard not found.")
text = text.replace(old_guard, new_guard, 1)

# Circular overlap belongs at the end: stable body -> tail/head blend -> wrap
# back into the next stable body. Putting the blend first creates a new wrap seam.
old_order = '''    repaired = array("h", seam)
    repaired.extend(samples[crossfade_frames:-crossfade_frames])
'''
new_order = '''    repaired = array("h", samples[crossfade_frames:-crossfade_frames])
    repaired.extend(seam)
'''
if old_order not in text:
    raise SystemExit("Expected original circular-crossfade ordering not found.")
text = text.replace(old_order, new_order, 1)

text = text.replace(
    "a ~200 ms circular equal-power crossfade",
    "a short source-sized circular equal-power crossfade",
)
text = text.replace(
    "now uses a ~200 ms circular equal-power crossfade",
    "now uses a short source-sized circular equal-power crossfade",
)

old_doc_key = "After playtest feedback that automatic upshifts were effectively rapid-fire, each archetype now separates the short torque/RPM shift cut from a longer per-gear dwell, including a first-gear hold, without reducing the established arcade acceleration."
current_doc_key = "after feedback that automatic upshifts were effectively rapid-fire, each archetype now separates the short torque/RPM shift cut from a longer per-gear dwell, including a first-gear hold, without reducing the established arcade acceleration."
if old_doc_key not in text:
    raise SystemExit("Expected staged documentation lookup key not found.")
text = text.replace(old_doc_key, current_doc_key, 1)

old_doc_replacement = "After playtest feedback, each archetype now separates the short torque/RPM shift cut from a longer per-gear dwell, including a first-gear hold. A high-speed acceleration taper and lower upper-gear torque preserve the lively launch while making 3rd–5th gear breathe and stretching the run to maximum speed over several seconds."
new_doc_replacement = "after feedback, each archetype now separates the short torque/RPM shift cut from a longer per-gear dwell, including a first-gear hold. A high-speed acceleration taper and lower upper-gear torque preserve the lively launch while making 3rd–5th gear breathe and stretching the run to maximum speed over several seconds."
if old_doc_replacement not in text:
    raise SystemExit("Expected staged documentation replacement not found.")
text = text.replace(old_doc_replacement, new_doc_replacement, 1)

helper_path.write_text(text, encoding="utf-8")
runpy.run_path(str(helper_path), run_name="__main__")
