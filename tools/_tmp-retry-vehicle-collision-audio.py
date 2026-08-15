from pathlib import Path
import subprocess

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


# Re-run the original integration, then repair the generated test and make
# target-aware contact consequences apply to every detected vehicle contact.
subprocess.run(
    ["python3", str(ROOT / "tools/_tmp-integrate-vehicle-collision-audio.py")],
    cwd=ROOT,
    check=True,
)

policy_path = "phaser/src/vehicles/VehicleCollisionSofteningPolicy.js"

# The first pass placed target audio/Heat inside soften(), which misses contacts
# that the base driving code already resolves smoothly. Keep soften() physics-only.
replace_once(
    policy_path,
    '''    const impactSpeed = Math.abs(finite(predicted.speed, before.speed));
    const collisionEvent = vehicleCollisionAudioEvent(impactSpeed);
    if (collisionEvent) RawAudio.play(collisionEvent, { cooldown: 0.28 });
    if (collisionEvent && targetIsPolice(target) && this.policeContactHeatCooldown <= 0) {
      this.policeContactHeatCooldown = 0.9;
      this.scene.policeSystem?.addHeat?.(
        vehicle.x,
        vehicle.y,
        Math.min(28, Math.max(8, impactSpeed * 0.15)),
        `${vehicle.name} collides with a police vehicle`,
        { source: "vehicle_police_collision" }
      );
    }
    const retention = clamp(
''',
    '''    const impactSpeed = Math.abs(finite(predicted.speed, before.speed));
    const retention = clamp(
'''
)

replace_once(
    policy_path,
    '''    if (!target) return result;

    this.totalContacts++;
    const rigid = this.shouldSoften(before, predicted, vehicle);
''',
    '''    if (!target) return result;

    this.totalContacts++;
    const contactImpactSpeed = Math.abs(finite(predicted.speed, before.speed));
    const collisionEvent = vehicleCollisionAudioEvent(contactImpactSpeed);
    if (collisionEvent) RawAudio.play(collisionEvent, { cooldown: 0.28 });
    if (collisionEvent && targetIsPolice(target) && this.policeContactHeatCooldown <= 0) {
      this.policeContactHeatCooldown = 0.9;
      this.scene.policeSystem?.addHeat?.(
        vehicle.x,
        vehicle.y,
        Math.min(28, Math.max(8, contactImpactSpeed * 0.15)),
        `${vehicle.name} collides with a police vehicle`,
        { source: "vehicle_police_collision" }
      );
    }
    const rigid = this.shouldSoften(before, predicted, vehicle);
'''
)

# Avoid Python escape processing entirely in this generated JS test.
write("tests/vehicle-collision-audio.test.js", r'''import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  VEHICLE_COLLISION_AUDIO_THRESHOLDS,
  vehicleCollisionAudioEvent
} from "../phaser/src/vehicles/VehicleCollisionAudioModel.js";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("vehicle collision audio severity follows impact speed", () => {
  assert.equal(VEHICLE_COLLISION_AUDIO_THRESHOLDS.minimumSpeed, 44);
  assert.equal(VEHICLE_COLLISION_AUDIO_THRESHOLDS.heavySpeed, 96);
  assert.equal(vehicleCollisionAudioEvent(20), null);
  assert.equal(vehicleCollisionAudioEvent(44), "vehicleCollisionLight");
  assert.equal(vehicleCollisionAudioEvent(95.9), "vehicleCollisionLight");
  assert.equal(vehicleCollisionAudioEvent(96), "vehicleCollisionHeavy");
  assert.equal(vehicleCollisionAudioEvent(-130), "vehicleCollisionHeavy");
});

test("RawAudio has dedicated light and heavy vehicle collision fallbacks", () => {
  const raw = source("phaser/src/systems/RawAudioSystem.js");
  assert.match(raw, /case "vehicleCollisionLight": return this\.vehicleCollision\(false\);/);
  assert.match(raw, /case "vehicleCollisionHeavy": return this\.vehicleCollision\(true\);/);
  assert.match(raw, /vehicleCollision\(heavy = false\)/);
});

test("world crashes use collision audio instead of bodyDrop", () => {
  const driving = source("phaser/src/vehicles/VehicleDriving.js");
  const start = driving.indexOf("export function handleVehicleWorldCollision");
  const end = driving.indexOf("export function updateVehicleDriving", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = driving.slice(start, end);
  assert.match(block, /vehicleCollisionAudioEvent\(impact\)/);
  assert.match(block, /RawAudio\.play\(collisionEvent, \{ cooldown: 0\.28 \}\)/);
  assert.doesNotMatch(block, /bodyDrop/);
});

test("vehicle contacts are target-aware: ordinary cars stay mundane, police cars raise Heat", () => {
  const policy = source("phaser/src/vehicles/VehicleCollisionSofteningPolicy.js");
  const driving = source("phaser/src/vehicles/VehicleDriving.js");
  assert.match(policy, /function targetIsPolice\(target\)/);
  assert.match(policy, /system\.vehicleCollisionContact = target \?/);
  assert.match(policy, /const contactImpactSpeed = Math\.abs/);
  assert.match(policy, /RawAudio\.play\(collisionEvent, \{ cooldown: 0\.28 \}\)/);
  assert.match(policy, /targetIsPolice\(target\) && this\.policeContactHeatCooldown <= 0/);
  assert.match(policy, /source: "vehicle_police_collision"/);
  assert.match(driving, /if \(!contact\) \{[\s\S]*?source: "vehicle_crash"/);
  assert.doesNotMatch(policy, /source: "vehicle_crash"/);
});
''')

print("Repaired collision test generation and generalized vehicle-contact audio.")
