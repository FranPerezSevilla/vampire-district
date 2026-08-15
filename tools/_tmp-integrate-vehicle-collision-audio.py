from pathlib import Path
import re

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
        raise SystemExit(f"Expected fragment not found in {path}: {old[:120]!r}")
    write(path, content.replace(old, new, 1))


def replace_regex_once(path, pattern, replacement):
    content = read(path)
    updated, count = re.subn(pattern, replacement, content, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"Expected exactly one regex match in {path}, got {count}: {pattern}")
    write(path, updated)


# Pure classification shared by world collisions and vehicle-contact policy.
write("phaser/src/vehicles/VehicleCollisionAudioModel.js", '''const COLLISION_AUDIO_MIN_SPEED = 44;
const COLLISION_AUDIO_HEAVY_SPEED = 96;

export function vehicleCollisionAudioEvent(impactSpeed) {
  const impact = Math.abs(Number(impactSpeed) || 0);
  if (impact < COLLISION_AUDIO_MIN_SPEED) return null;
  return impact >= COLLISION_AUDIO_HEAVY_SPEED
    ? "vehicleCollisionHeavy"
    : "vehicleCollisionLight";
}

export const VEHICLE_COLLISION_AUDIO_THRESHOLDS = Object.freeze({
  minimumSpeed: COLLISION_AUDIO_MIN_SPEED,
  heavySpeed: COLLISION_AUDIO_HEAVY_SPEED
});
''')

# RawAudio gets dedicated metal/bodywork feedback instead of borrowing bodyDrop.
replace_once(
    "phaser/src/systems/RawAudioSystem.js",
    '      case "bodyDrop": return this.hit(85, 0.045, 0.10);\n      case "vehicleSkidLoop": return this.vehicleSkid();',
    '      case "bodyDrop": return this.hit(85, 0.045, 0.10);\n      case "vehicleCollisionLight": return this.vehicleCollision(false);\n      case "vehicleCollisionHeavy": return this.vehicleCollision(true);\n      case "vehicleSkidLoop": return this.vehicleSkid();'
)
replace_once(
    "phaser/src/systems/RawAudioSystem.js",
    '''  vehicleSkid() {
    this.noise(0.22, { volume: 0.050, filter: 1850, filterType: "bandpass", q: 1.35 });
    this.noise(0.16, { delay: 0.025, volume: 0.026, filter: 2800, filterType: "highpass", q: 0.9 });
    this.tone(1180, 0.16, { to: 720, volume: 0.014, type: "sawtooth", filter: 2400 });
  }
''',
    '''  vehicleSkid() {
    this.noise(0.22, { volume: 0.050, filter: 1850, filterType: "bandpass", q: 1.35 });
    this.noise(0.16, { delay: 0.025, volume: 0.026, filter: 2800, filterType: "highpass", q: 0.9 });
    this.tone(1180, 0.16, { to: 720, volume: 0.014, type: "sawtooth", filter: 2400 });
  }

  vehicleCollision(heavy = false) {
    const duration = heavy ? 0.28 : 0.16;
    this.noise(duration, {
      volume: heavy ? 0.095 : 0.058,
      filter: heavy ? 680 : 980,
      filterType: "bandpass",
      q: heavy ? 0.68 : 0.82
    });
    this.tone(heavy ? 72 : 108, duration * 0.88, {
      to: heavy ? 38 : 58,
      volume: heavy ? 0.075 : 0.042,
      type: "triangle",
      filter: heavy ? 420 : 620
    });
    this.noise(heavy ? 0.19 : 0.11, {
      delay: 0.025,
      volume: heavy ? 0.038 : 0.022,
      filter: heavy ? 1900 : 2300,
      filterType: "highpass",
      q: 0.9
    });
  }
'''
)

# World collision path: dedicated collision event, while vehicle-to-vehicle contact
# is delegated to VehicleCollisionSofteningPolicy because that policy knows the target.
replace_once(
    "phaser/src/vehicles/VehicleDriving.js",
    'import { collideVehicleWithPedestrians } from "./VehicleConsequences.js";\nimport { vehicleEngineTelemetry } from "./VehicleEngineModel.js";',
    'import { collideVehicleWithPedestrians } from "./VehicleConsequences.js";\nimport { vehicleCollisionAudioEvent } from "./VehicleCollisionAudioModel.js";\nimport { vehicleEngineTelemetry } from "./VehicleEngineModel.js";'
)
replace_regex_once(
    "phaser/src/vehicles/VehicleDriving.js",
    r'export function handleVehicleWorldCollision\(system, vehicle, impactSpeed\) \{.*?\n\}\n\nexport function updateVehicleDriving',
    '''export function handleVehicleWorldCollision(system, vehicle, impactSpeed) {
  const impact = Math.abs(Number(impactSpeed) || 0);
  const contact = system.vehicleCollisionContact || null;
  const direction = Math.sign(vehicle.speed || impactSpeed || 1);
  vehicle.speed = direction * Math.min(5, impact * 0.025);
  vehicle.travelAngle = rotateTowardAngle(vehicle.travelAngle ?? vehicle.angle, vehicle.angle, 0.12);
  vehicle.driftAngle = 0;
  vehicle.velocityX = Math.cos(vehicle.travelAngle) * vehicle.speed;
  vehicle.velocityY = Math.sin(vehicle.travelAngle) * vehicle.speed;

  const damage = vehicleImpactDamage(impact, { threshold: 36, scale: 0.11 });
  if (damage > 0) system.damageVehicle(vehicle.id, damage, { reason: "collision", persist: false });
  const collisionEvent = vehicleCollisionAudioEvent(impact);
  if (collisionEvent && system.crashCooldown <= 0) {
    system.crashCooldown = 0.48;
    // VehicleCollisionSofteningPolicy owns car-to-car sound and consequences
    // because it knows the concrete target. This path owns walls/streetscape.
    if (!contact) {
      RawAudio.play(collisionEvent, { cooldown: 0.28 });
      system.scene.policeSystem?.addHeat?.(
        vehicle.x,
        vehicle.y,
        Math.min(24, Math.max(4, impact * 0.12)),
        `${vehicle.name} crashes into the streetscape`,
        { source: "vehicle_crash" }
      );
    }
    system.scene.events?.emit?.("vehicle:collision", {
      vehicleId: vehicle.id,
      targetId: contact?.targetId || null,
      targetKind: contact?.targetKind || "world",
      policeTarget: Boolean(contact?.police),
      impactSpeed: impact,
      audioEvent: collisionEvent
    });
    system.scene.lastActionText = contact
      ? `${vehicle.name} vehicle contact · hull ${vehicleHealthPercent(vehicle.health, vehicle.archetype.maxHealth)}%.`
      : `${vehicle.name} collision · hull ${vehicleHealthPercent(vehicle.health, vehicle.archetype.maxHealth)}%.`;
  }
}

export function updateVehicleDriving'''
)

# Vehicle contacts know whether the other car is police. Ordinary car-to-car
# contact stays mundane; police-car contact is the exception and raises Heat.
replace_once(
    "phaser/src/vehicles/VehicleCollisionSofteningPolicy.js",
    '} from "../vehicles/VehicleModel.js";\n',
    '} from "../vehicles/VehicleModel.js";\nimport { RawAudio } from "../systems/RawAudioSystem.js";\nimport { vehicleCollisionAudioEvent } from "./VehicleCollisionAudioModel.js";\n'
)
replace_once(
    "phaser/src/vehicles/VehicleCollisionSofteningPolicy.js",
    '''function targetStillOverlaps(candidate, target, ownRadius, clearance = 0.5) {
  return Math.hypot(candidate.x - target.x, candidate.y - target.y)
    < ownRadius + target.radius + clearance;
}
''',
    '''function targetStillOverlaps(candidate, target, ownRadius, clearance = 0.5) {
  return Math.hypot(candidate.x - target.x, candidate.y - target.y)
    < ownRadius + target.radius + clearance;
}

function targetIsPolice(target) {
  const archetypeId = target?.vehicle?.archetype?.id || target?.slot?.archetype?.id || null;
  const ownership = target?.vehicle?.ownership || target?.slot?.ownership || null;
  return archetypeId === "police" || ownership === "police";
}
'''
)
replace_once(
    "phaser/src/vehicles/VehicleCollisionSofteningPolicy.js",
    '    this.totalPassThroughs = 0;\n    this.lastContact = null;',
    '    this.totalPassThroughs = 0;\n    this.policeContactHeatCooldown = 0;\n    this.lastContact = null;'
)
replace_once(
    "phaser/src/vehicles/VehicleCollisionSofteningPolicy.js",
    '''    const predicted = stepVehicleKinematics(vehicle, frame, dt, vehicle.archetype);
    const target = collisionTarget(system, vehicle, predicted, this.collisionPadding);
    const result = this.originalUpdateDriving.call(system, dt, frame);
    if (!target) return result;

    this.totalContacts++;
''',
    '''    const predicted = stepVehicleKinematics(vehicle, frame, dt, vehicle.archetype);
    const target = collisionTarget(system, vehicle, predicted, this.collisionPadding);
    this.policeContactHeatCooldown = Math.max(0, this.policeContactHeatCooldown - Math.max(0, finite(dt)));
    const previousContact = system.vehicleCollisionContact || null;
    system.vehicleCollisionContact = target ? {
      targetId: target.id,
      targetKind: target.kind,
      police: targetIsPolice(target)
    } : null;
    let result;
    try {
      result = this.originalUpdateDriving.call(system, dt, frame);
    } finally {
      system.vehicleCollisionContact = previousContact;
    }
    if (!target) return result;

    this.totalContacts++;
'''
)
replace_once(
    "phaser/src/vehicles/VehicleCollisionSofteningPolicy.js",
    '''    const impactSpeed = Math.abs(finite(predicted.speed, before.speed));
    const retention = clamp(
''',
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
'''
)

# Document the candidate status and the no-Heat ordinary car-contact rule.
replace_once(
    "docs/audio-catalog.md",
    '- `vehicleCollisionLight` — 3–4 variants\n- `vehicleCollisionHeavy` — 3 variants',
    '- `vehicleCollisionLight` — **procedural candidate on PR #55:** dedicated light bodywork/metal feedback now replaces the unrelated `bodyDrop` placeholder; real 3–4 sample variants remain a sourcing task\n- `vehicleCollisionHeavy` — **procedural candidate on PR #55:** impact-speed classification selects a heavier crash fallback; real 3 sample variants remain a sourcing task'
)
replace_once(
    "docs/audio-catalog.md",
    'Silence between events is part of the mix rather than a missing layer.\n',
    'Silence between events is part of the mix rather than a missing layer. Ordinary car-to-car contact is treated as mundane traffic and does not create Heat; colliding with a police vehicle remains an explicit exception.\n'
)

# Focused regression contract.
write("tests/vehicle-collision-audio.test.js", '''import test from "node:test";
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
  const block = driving.match(/export function handleVehicleWorldCollision[\s\S]*?\n}\n\nexport function updateVehicleDriving/);
  assert.ok(block);
  assert.match(block[0], /vehicleCollisionAudioEvent\(impact\)/);
  assert.match(block[0], /RawAudio\.play\(collisionEvent, \{ cooldown: 0\.28 \}\)/);
  assert.doesNotMatch(block[0], /bodyDrop/);
});

test("vehicle contacts are target-aware: ordinary cars stay mundane, police cars raise Heat", () => {
  const policy = source("phaser/src/vehicles/VehicleCollisionSofteningPolicy.js");
  const driving = source("phaser/src/vehicles/VehicleDriving.js");
  assert.match(policy, /function targetIsPolice\(target\)/);
  assert.match(policy, /system\.vehicleCollisionContact = target \?/);
  assert.match(policy, /RawAudio\.play\(collisionEvent, \{ cooldown: 0\.28 \}\)/);
  assert.match(policy, /targetIsPolice\(target\) && this\.policeContactHeatCooldown <= 0/);
  assert.match(policy, /source: "vehicle_police_collision"/);
  assert.match(driving, /if \(!contact\) \{[\s\S]*?source: "vehicle_crash"/);
  assert.doesNotMatch(policy, /source: "vehicle_crash"/);
});
''')

print("Integrated target-aware vehicle collision audio and consequences.")
