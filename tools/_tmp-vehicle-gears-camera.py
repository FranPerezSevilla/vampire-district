from pathlib import Path


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def replace_once(text, old, new, label):
    if new in text:
        return text
    if old not in text:
        raise RuntimeError(f"missing anchor: {label}")
    return text.replace(old, new, 1)


# Vehicle archetypes: automatic transmissions, max five forward gears.
path = "phaser/src/data/vehicles.js"
text = read(path)
for old, new in [
    ("maxSpeed: 310, reverseSpeed: 92", "maxSpeed: 310, gearCount: 5, gearShiftDuration: 0.10, cameraLookAhead: 72, reverseSpeed: 92"),
    ("maxSpeed: 330, reverseSpeed: 98", "maxSpeed: 330, gearCount: 5, gearShiftDuration: 0.11, cameraLookAhead: 76, reverseSpeed: 98"),
    ("maxSpeed: 275, reverseSpeed: 82", "maxSpeed: 275, gearCount: 4, gearShiftDuration: 0.13, cameraLookAhead: 64, reverseSpeed: 82"),
    ("maxSpeed: 365, reverseSpeed: 106", "maxSpeed: 365, gearCount: 5, gearShiftDuration: 0.085, cameraLookAhead: 84, reverseSpeed: 106"),
]:
    text = replace_once(text, old, new, old)
write(path, text)


# Kinematic gearbox + pure camera-look-ahead helper.
path = "phaser/src/vehicles/VehicleModel.js"
text = read(path)
text = replace_once(
    text,
    "    velocityY: 0,\n    speed: 0,\n    health:",
    "    velocityY: 0,\n    speed: 0,\n    gear: 1,\n    gearShiftTimer: 0,\n    health:",
    "vehicle state gearbox fields",
)

helpers = '''export function vehicleGearCount(archetype) {
  return Math.round(clamp(Number(archetype?.gearCount) || 5, 1, 5));
}

function vehicleGearUpshiftRatio(gear, gearCount) {
  const count = Math.max(1, Math.round(Number(gearCount) || 1));
  return clamp((Math.max(1, Number(gear) || 1) / count) * 0.93, 0.14, 0.88);
}

export function vehicleGearForSpeed(speed, archetype, currentGear = 1) {
  const count = vehicleGearCount(archetype);
  const velocity = Math.max(0, Number(speed) || 0);
  if (velocity <= 0.5 || count <= 1) return 1;
  const maximum = Math.max(1, Number(archetype?.maxSpeed) || 1);
  const ratio = clamp(velocity / maximum, 0, 1);
  const hysteresis = 0.055;
  let gear = Math.round(clamp(Number(currentGear) || 1, 1, count));
  while (gear < count && ratio >= vehicleGearUpshiftRatio(gear, count)) gear++;
  while (gear > 1 && ratio < vehicleGearUpshiftRatio(gear - 1, count) - hysteresis) gear--;
  return gear;
}

export function vehicleGearTorqueMultiplier(gear, gearCount = 5) {
  const count = Math.max(1, Math.round(Number(gearCount) || 1));
  const selected = Math.round(clamp(Number(gear) || 1, 1, count));
  if (count <= 1) return 1;
  const progress = (selected - 1) / (count - 1);
  return 1.20 - 0.34 * progress;
}

'''
if "export function vehicleGearCount" not in text:
    anchor = "export function stepVehicleKinematics(state, frame, dt, archetype) {"
    if anchor not in text:
        raise RuntimeError("missing anchor: stepVehicleKinematics")
    text = text.replace(anchor, helpers + anchor, 1)

text = replace_once(
    text,
    "  const handbrakeGrip = Math.max(0.1, Number(archetype?.handbrakeGrip) || 1.4);\n\n  let speed = Number(state?.speed) || 0;\n  const incomingRatio = clamp(Math.abs(speed) / maxSpeed, 0, 1);\n  const launchMultiplier = 1 + launchBoost * Math.pow(1 - incomingRatio, 2.1);\n",
    "  const handbrakeGrip = Math.max(0.1, Number(archetype?.handbrakeGrip) || 1.4);\n  const gearCount = vehicleGearCount(archetype);\n  const gearShiftDuration = clamp(Number(archetype?.gearShiftDuration) || 0.11, 0.06, 0.22);\n\n  let speed = Number(state?.speed) || 0;\n  let gear = Math.round(clamp(Number(state?.gear) || 1, 1, gearCount));\n  let gearShiftTimer = Math.max(0, (Number(state?.gearShiftTimer) || 0) - seconds);\n  const incomingRatio = clamp(Math.abs(speed) / maxSpeed, 0, 1);\n  const launchMultiplier = 1 + launchBoost * Math.pow(1 - incomingRatio, 2.1);\n\n  if (speed >= 0) {\n    const targetGear = vehicleGearForSpeed(speed, archetype, gear);\n    if (targetGear > gear && gearShiftTimer <= 0 && input.throttle > 0.05) {\n      gear = Math.min(targetGear, gear + 1);\n      gearShiftTimer = gearShiftDuration;\n    } else if (targetGear < gear) {\n      gear = targetGear;\n      gearShiftTimer = 0;\n    }\n  } else {\n    gear = 1;\n    gearShiftTimer = 0;\n  }\n  const gearTorque = vehicleGearTorqueMultiplier(gear, gearCount);\n  const shiftTorque = gearShiftTimer > 0 ? 0.78 : 1;\n",
    "gearbox kinematic state",
)
text = replace_once(
    text,
    "speed += acceleration * launchMultiplier * handbrakeThrottleFactor * input.throttle * seconds;",
    "speed += acceleration * launchMultiplier * gearTorque * shiftTorque * handbrakeThrottleFactor * input.throttle * seconds;",
    "handbrake torque",
)
text = replace_once(
    text,
    ": speed + acceleration * launchMultiplier * input.throttle * seconds;",
    ": speed + acceleration * launchMultiplier * gearTorque * shiftTorque * input.throttle * seconds;",
    "forward torque",
)
text = replace_once(
    text,
    "    velocityY,\n    speed,\n    parked:",
    "    velocityY,\n    speed,\n    gear,\n    gearShiftTimer,\n    parked:",
    "kinematic gearbox return",
)

camera_helper = '''export function vehicleCameraLookAhead(state, frame, archetype) {
  const speed = Number(state?.speed) || 0;
  const maximum = Math.max(1, Number(archetype?.maxSpeed) || 1);
  if (speed <= 18) return { x: 0, y: 0, strength: 0 };

  const input = normalizeVehicleInput(frame);
  const speedRatio = clamp(speed / maximum, 0, 1);
  const speedProgress = clamp((speedRatio - 0.16) / 0.70, 0, 1);
  const speedWeight = speedProgress * speedProgress * (3 - 2 * speedProgress);
  const steeringSuppression = clamp((Math.abs(input.steer) - 0.08) / 0.42, 0, 1);
  const driftSuppression = clamp((Math.abs(Number(state?.driftAngle) || 0) - 0.035) / 0.22, 0, 1);
  const braking = input.throttle < -0.08;
  const unstable = braking || input.handbrake || Boolean(state?.handbrake);
  const stability = unstable ? 0 : (1 - steeringSuppression) * (1 - driftSuppression);
  const strength = clamp(speedWeight * stability, 0, 1);
  const distance = clamp(Number(archetype?.cameraLookAhead) || 72, 0, 120) * strength;
  const direction = Number.isFinite(Number(state?.travelAngle)) ? Number(state.travelAngle) : Number(state?.angle) || 0;
  return {
    x: Math.cos(direction) * distance,
    y: Math.sin(direction) * distance,
    strength
  };
}

'''
if "export function vehicleCameraLookAhead" not in text:
    anchor = "export function vehicleCameraZoom(baseZoom, speed, archetype) {"
    if anchor not in text:
        raise RuntimeError("missing anchor: vehicleCameraZoom")
    text = text.replace(anchor, camera_helper + anchor, 1)
write(path, text)


# Driving owner copies gearbox state, emits a shift hook, and owns camera look-ahead.
path = "phaser/src/vehicles/VehicleDriving.js"
text = read(path)
text = replace_once(
    text,
    "  stepVehicleKinematics,\n  vehicleCameraZoom,",
    "  stepVehicleKinematics,\n  vehicleCameraLookAhead,\n  vehicleCameraZoom,",
    "VehicleDriving camera import",
)
text = replace_once(
    text,
    "  vehicle.speed = next.speed;\n  vehicle.parked = next.parked;",
    "  vehicle.speed = next.speed;\n  vehicle.gear = Math.max(1, Math.round(Number(next.gear) || 1));\n  vehicle.gearShiftTimer = Math.max(0, Number(next.gearShiftTimer) || 0);\n  vehicle.parked = next.parked;",
    "applyKinematicState gearbox",
)
text = replace_once(
    text,
    "  const next = stepVehicleKinematics(vehicle, frame, dt, vehicle.archetype);\n  const furniture =",
    "  const previousGear = Math.max(1, Math.round(Number(vehicle.gear) || 1));\n  const next = stepVehicleKinematics(vehicle, frame, dt, vehicle.archetype);\n  const furniture =",
    "capture previous gear",
)
text = replace_once(
    text,
    "  vehicle.container.setPosition(vehicle.x, vehicle.y).setRotation(vehicle.angle);\n  vehicle.visual.label.setRotation(-vehicle.angle);",
    "  if (vehicle.gear > previousGear) {\n    system.scene.events?.emit?.(\"vehicle:gear-shift\", {\n      vehicleId: vehicle.id,\n      fromGear: previousGear,\n      toGear: vehicle.gear,\n      speed: vehicle.speed\n    });\n  }\n\n  vehicle.container.setPosition(vehicle.x, vehicle.y).setRotation(vehicle.angle);\n  vehicle.visual.label.setRotation(-vehicle.angle);",
    "gear shift event",
)
text = replace_once(
    text,
    '''export function updateVehicleCamera(system) {
  const vehicle = system.currentVehicle();
  if (!vehicle) return false;
  const renderScale = typeof window !== "undefined" ? window.NBD_RESOLUTION_PRESET?.renderScale || 1 : 1;
  const baseZoom = CAMERA.streetZoom * renderScale;
  const targetZoom = vehicleCameraZoom(baseZoom, vehicle.speed, vehicle.archetype);
  const camera = system.scene.cameras.main;
  camera.setZoom(Phaser.Math.Linear(camera.zoom, targetZoom, 0.10));
  return true;
}
''',
    '''export function updateVehicleCamera(system) {
  const vehicle = system.currentVehicle();
  if (!vehicle) return false;
  const renderScale = typeof window !== "undefined" ? window.NBD_RESOLUTION_PRESET?.renderScale || 1 : 1;
  const baseZoom = CAMERA.streetZoom * renderScale;
  const targetZoom = vehicleCameraZoom(baseZoom, vehicle.speed, vehicle.archetype);
  const camera = system.scene.cameras.main;
  camera.setZoom(Phaser.Math.Linear(camera.zoom, targetZoom, 0.10));

  const lookAhead = vehicleCameraLookAhead(vehicle, system.scene.currentInputFrame, vehicle.archetype);
  const recentering = lookAhead.strength < 0.08;
  const response = recentering ? 0.28 : 0.10;
  system.cameraLookAheadX = Phaser.Math.Linear(Number(system.cameraLookAheadX) || 0, lookAhead.x, response);
  system.cameraLookAheadY = Phaser.Math.Linear(Number(system.cameraLookAheadY) || 0, lookAhead.y, response);
  camera.setFollowOffset(-system.cameraLookAheadX, -system.cameraLookAheadY);
  return true;
}
''',
    "directional vehicle camera",
)
write(path, text)


# HUD/snapshot exposes the automatic gear.
path = "phaser/src/vehicles/VehicleView.js"
text = read(path)
text = replace_once(
    text,
    'import { vehicleHealthPercent, vehicleSpeedKph } from "./VehicleModel.js";',
    'import { vehicleGearCount, vehicleHealthPercent, vehicleSpeedKph } from "./VehicleModel.js";',
    "VehicleView gear import",
)
text = replace_once(
    text,
    "    speed: vehicle.speed,\n    speedKph: vehicleSpeedKph(vehicle.speed),\n    health:",
    "    speed: vehicle.speed,\n    speedKph: vehicleSpeedKph(vehicle.speed),\n    gear: Math.max(1, Math.round(Number(vehicle.gear) || 1)),\n    gearCount: vehicleGearCount(archetype),\n    shifting: (Number(vehicle.gearShiftTimer) || 0) > 0,\n    health:",
    "vehicle snapshot gearbox",
)
text = replace_once(
    text,
    "  const drift = driftDegrees(vehicle);\n  const driftText = drift >= 7 && Math.abs(vehicle.speed) > 24 ? ` · DRIFT ${drift}°` : \"\";",
    "  const drift = driftDegrees(vehicle);\n  const gear = Math.max(1, Math.round(Number(vehicle.gear) || 1));\n  const gearText = vehicle.speed < -0.5 ? \"R\" : `G${gear}/${vehicleGearCount(vehicle.archetype)}${(vehicle.gearShiftTimer || 0) > 0 ? \"↑\" : \"\"}`;\n  const driftText = drift >= 7 && Math.abs(vehicle.speed) > 24 ? ` · DRIFT ${drift}°` : \"\";",
    "vehicle HUD gearbox",
)
text = replace_once(
    text,
    "    `${vehicle.name.toUpperCase()} · ${vehicleSpeedKph(vehicle.speed)} km/h${driftText} · hull",
    "    `${vehicle.name.toUpperCase()} · ${gearText} · ${vehicleSpeedKph(vehicle.speed)} km/h${driftText} · hull",
    "vehicle HUD text",
)
text = replace_once(
    text,
    "  return `${vehicle.name} · ${vehicleSpeedKph(vehicle.speed)} km/h${drift >= 7 ? ` · drift ${drift}°` : \"\"} · hull",
    "  return `${vehicle.name} · G${Math.max(1, Math.round(Number(vehicle.gear) || 1))} · ${vehicleSpeedKph(vehicle.speed)} km/h${drift >= 7 ? ` · drift ${drift}°` : \"\"} · hull",
    "vehicle summary gearbox",
)
write(path, text)


# Vehicle owner initializes/reset transient gearbox/camera state.
path = "phaser/src/vehicles/VehicleSystem.js"
text = read(path)
text = replace_once(
    text,
    "    this.handbrakeActive = false;\n    this.pedestrianCooldowns = new Map();",
    "    this.handbrakeActive = false;\n    this.cameraLookAheadX = 0;\n    this.cameraLookAheadY = 0;\n    this.pedestrianCooldowns = new Map();",
    "VehicleSystem camera state",
)
text = replace_once(
    text,
    "      vehicle.speed = 0;\n      vehicle.handbrake = false;\n      vehicle.parked = true;",
    "      vehicle.speed = 0;\n      vehicle.gear = 1;\n      vehicle.gearShiftTimer = 0;\n      vehicle.handbrake = false;\n      vehicle.parked = true;",
    "disabled vehicle gearbox reset",
)
text = replace_once(
    text,
    "    vehicle.speed = 0;\n    vehicle.health = condition.health;",
    "    vehicle.speed = 0;\n    vehicle.gear = 1;\n    vehicle.gearShiftTimer = 0;\n    vehicle.health = condition.health;",
    "campaign sync gearbox reset",
)
write(path, text)


# Leaving a vehicle must also remove the driving-only camera offset.
path = "phaser/src/vehicles/VehicleInteractions.js"
text = read(path)
text = replace_once(
    text,
    "  system.scene.cameras.main.startFollow(system.scene.player, true, 0.12, 0.12);\n  system.persistVehicle(vehicle);",
    "  system.cameraLookAheadX = 0;\n  system.cameraLookAheadY = 0;\n  system.scene.cameras.main.setFollowOffset(0, 0);\n  system.scene.cameras.main.startFollow(system.scene.player, true, 0.12, 0.12);\n  system.persistVehicle(vehicle);",
    "vehicle exit camera reset",
)
text = replace_once(
    text,
    "  vehicle.speed = 0;\n  vehicle.velocityX = 0;\n  vehicle.velocityY = 0;\n  vehicle.parked = true;",
    "  vehicle.speed = 0;\n  vehicle.velocityX = 0;\n  vehicle.velocityY = 0;\n  vehicle.gear = 1;\n  vehicle.gearShiftTimer = 0;\n  vehicle.parked = true;",
    "vehicle exit gearbox reset",
)
write(path, text)


# Focused pure-model tests.
path = "tests/vehicle-model.test.js"
text = read(path)
text = replace_once(
    text,
    "  stepVehicleKinematics,\n  vehicleCameraZoom,",
    "  stepVehicleKinematics,\n  vehicleCameraLookAhead,\n  vehicleCameraZoom,\n  vehicleGearCount,",
    "vehicle-model test imports",
)
text = replace_once(
    text,
    "  maxSpeed: 310,\n  reverseSpeed: 92,",
    "  maxSpeed: 310,\n  gearCount: 5,\n  gearShiftDuration: 0.10,\n  cameraLookAhead: 72,\n  reverseSpeed: 92,",
    "vehicle-model test archetype",
)
new_tests = '''
test("automatic gearbox climbs through up to five gears with a brief torque cut", () => {
  let state = createVehicleState(definition, archetype);
  const seen = new Set([state.gear]);
  let shiftFrames = 0;
  for (let index = 0; index < 90; index++) {
    state = stepVehicleKinematics(state, { move: { x: 0, y: -1 } }, 0.05, archetype);
    seen.add(state.gear);
    if (state.gearShiftTimer > 0) shiftFrames++;
  }
  assert.equal(vehicleGearCount(archetype), 5);
  assert.deepEqual([...seen], [1, 2, 3, 4, 5]);
  assert.equal(state.gear, 5);
  assert.ok(shiftFrames >= 4);
  assert.ok(state.speed <= archetype.maxSpeed);
});

test("directional vehicle camera looks ahead only during stable forward travel", () => {
  const base = {
    ...createVehicleState(definition, archetype),
    speed: 250,
    travelAngle: 0,
    driftAngle: 0,
    handbrake: false
  };
  const stable = vehicleCameraLookAhead(base, { move: { x: 0, y: -1 } }, archetype);
  const turning = vehicleCameraLookAhead(base, { move: { x: 1, y: -1 } }, archetype);
  const braking = vehicleCameraLookAhead(base, { move: { x: 0, y: 1 } }, archetype);
  const drifting = vehicleCameraLookAhead(
    { ...base, driftAngle: 0.30, handbrake: true },
    { move: { x: 0.7, y: -1 }, handbrakeHeld: true },
    archetype
  );

  assert.ok(stable.x > 25);
  assert.ok(stable.strength > 0.4);
  assert.ok(Math.abs(turning.x) < stable.x * 0.2);
  assert.equal(braking.strength, 0);
  assert.equal(drifting.strength, 0);
});

'''
if "automatic gearbox climbs through up to five gears" not in text:
    anchor = 'test("collision slide candidates search many distances and steering nudges", () => {'
    if anchor not in text:
        raise RuntimeError("missing anchor: vehicle-model test insertion")
    text = text.replace(anchor, new_tests + anchor, 1)
write(path, text)


# Composition/source tests include camera offset cleanup and gearbox surface.
path = "tests/vehicle-runtime-source.test.js"
text = read(path)
text = replace_once(
    text,
    '  assert.equal(driving.includes("applyKinematicState(vehicle, next)"), true);\n',
    '  assert.equal(driving.includes("applyKinematicState(vehicle, next)"), true);\n  assert.equal(driving.includes("vehicleCameraLookAhead"), true);\n  assert.equal(driving.includes("setFollowOffset"), true);\n  assert.equal(view.includes("gearCount"), true);\n',
    "vehicle runtime camera/gear composition",
)
text = replace_once(
    text,
    '  assert.equal(definitions.includes("trunkCapacity"), true);\n',
    '  assert.equal(definitions.includes("trunkCapacity"), true);\n  assert.equal(definitions.includes("gearCount"), true);\n  assert.equal(definitions.includes("cameraLookAhead"), true);\n',
    "vehicle definitions gearbox fields",
)
write(path, text)


path = "tests/vehicle-gears-camera.test.js"
write(path, '''import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("driving owns automatic gear state and a future-facing shift event", () => {
  const driving = source("phaser/src/vehicles/VehicleDriving.js");
  const view = source("phaser/src/vehicles/VehicleView.js");
  assert.match(driving, /vehicle\.gearShiftTimer/);
  assert.match(driving, /"vehicle:gear-shift"/);
  assert.match(view, /gearText/);
  assert.match(view, /G\$\{gear\}/);
});

test("vehicle camera recenters on exit and look-ahead remains driving-only", () => {
  const interactions = source("phaser/src/vehicles/VehicleInteractions.js");
  const driving = source("phaser/src/vehicles/VehicleDriving.js");
  assert.match(driving, /camera\.setFollowOffset\(-system\.cameraLookAheadX, -system\.cameraLookAheadY\)/);
  assert.match(interactions, /setFollowOffset\(0, 0\)/);
  assert.match(interactions, /cameraLookAheadX = 0/);
  assert.match(interactions, /cameraLookAheadY = 0/);
});
''')
