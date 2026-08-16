from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parents[1]

# Re-apply the validated siren/vehicle changes in this runner.
runpy.run_path(str(ROOT / "tools/_tmp-finalize-siren-vehicle-acceleration.py"), run_name="__main__")

# The old test asserted the previous documentation status string. The systemic
# engine mix has already been listening-accepted; only its sample timbre and the
# retuned acceleration/cadence are now pending follow-up.
test_path = ROOT / "tests/vehicle-engine-audio.test.js"
text = test_path.read_text(encoding="utf-8")
old = 'assert.match(catalogue, /vehicleEngine.*procedural systemic candidate/s);'
new = 'assert.match(catalogue, /vehicleEngine.*systemic mix accepted/s);'
if old not in text:
    raise SystemExit("Expected legacy vehicleEngine documentation assertion not found.")
test_path.write_text(text.replace(old, new, 1), encoding="utf-8")

print("Updated final vehicle audio regression contract.")
