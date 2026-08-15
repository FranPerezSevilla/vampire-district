from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if new in text:
        return
    if old not in text:
        raise RuntimeError(f"anchor missing in {path}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))


def write(path, content):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)


write("phaser/src/vehicles/VehicleEngineModel.js", '''import { vehicleGearCount, vehicleGearForSpeed } from "./VehicleModel.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function effectiveArchetype(archetype, maxSpeed = null) {
  const override = Number(maxSpeed);
  return Number.isFinite(override) && override > 0
    ? { ...archetype, maxSpeed: override }
    : archetype;
}

export function stepPresentationTransmission(state = {}, speed = 0, dt = 0, archetype = {}, { maxSpeed = null } = {}) {
  const effective = effectiveArchetype(archetype, maxSpeed);
  const count = vehicleGearCount(effective);
  const seconds = clamp(dt, 0, 0.25);
  const shiftDuration = clamp(Number(archetype?.gearShiftDuration) || 0.11, 0.06, 0.22);
  let gear = Math.round(clamp(Number(state?.gear) || 1, 1, count));
  let gearShiftTimer = Math.max(0, (Number(state?.gearShiftTimer) || 0) - seconds);

  if (Number(speed) < -0.5) return { gear: 1, gearShiftTimer: 0, gearCount: 1 };
  const target = vehicleGearForSpeed(Math.abs(Number(speed) || 0), effective, gear);
  if (target > gear && gearShiftTimer <= 0) {
    gear = Math.min(target, gear + 1);
    gearShiftTimer = shiftDuration;
  } else if (target < gear) {
    gear = target;
    gearShiftTimer = 0;
  }
  return { gear, gearShiftTimer, gearCount: count };
}

export function vehicleEngineRpmNormalized({ speed = 0, maxSpeed = 1, gear = 1, gearCount = 5, shifting = false } = {}) {
  const velocity = Math.abs(Number(speed) || 0);
  const maximum = Math.max(1, Number(maxSpeed) || 1);
  if (velocity < 0.5) return 0.18;

  const count = Math.max(1, Math.round(Number(gearCount) || 1));
  const selected = Math.round(clamp(Number(gear) || 1, 1, count));
  const ratio = clamp(velocity / maximum, 0, 1);
  const start = count <= 1 || selected <= 1 ? 0 : ((selected - 1) / count) * 0.93;
  const end = count <= 1 || selected >= count ? 1 : (selected / count) * 0.93;
  const local = clamp((ratio - start) / Math.max(0.04, end - start), 0, 1);
  let rpm = 0.25 + local * 0.75;
  if (shifting) rpm = Math.max(0.20, rpm * 0.70);
  return clamp(rpm, 0.18, 1);
}

export function vehicleEngineTelemetry({
  speed = 0,
  archetype = {},
  gear = 1,
  gearShiftTimer = 0,
  throttle = 0,
  x = 0,
  y = 0,
  listener = null,
  ownVehicle = false,
  maxSpeed = null,
  maxDistance = 560
} = {}) {
  const reverse = Number(speed) < -0.5;
  const maximum = reverse
    ? Math.max(1, Number(archetype?.reverseSpeed) || Number(maxSpeed) || 1)
    : Math.max(1, Number(maxSpeed) || Number(archetype?.maxSpeed) || 1);
  const count = reverse ? 1 : vehicleGearCount(archetype);
  const selectedGear = reverse ? 1 : Math.round(clamp(Number(gear) || 1, 1, count));
  const rpm = vehicleEngineRpmNormalized({
    speed,
    maxSpeed: maximum,
    gear: selectedGear,
    gearCount: count,
    shifting: Number(gearShiftTimer) > 0
  });
  const load = clamp(0.12 + Math.abs(Number(throttle) || 0) * 0.88, 0.12, 1);

  const listenerX = Number(listener?.x) || 0;
  const listenerY = Number(listener?.y) || 0;
  const distance = ownVehicle ? 0 : Math.hypot((Number(x) || 0) - listenerX, (Number(y) || 0) - listenerY);
  const range = Math.max(80, Number(maxDistance) || 560);
  const distanceRatio = clamp(1 - distance / range, 0, 1);
  const audibility = ownVehicle ? 1 : Math.pow(distanceRatio, 1.35);
  const pan = ownVehicle ? 0 : clamp(((Number(x) || 0) - listenerX) / Math.max(180, range * 0.55), -1, 1);

  return {
    profileId: String(archetype?.id || "sedan"),
    gear: selectedGear,
    gearCount: count,
    rpm,
    load,
    distance,
    audibility,
    pan
  };
}
''')

# RawAudio owns all actual Web Audio engine voices.
raw = "phaser/src/systems/RawAudioSystem.js"
replace_once(raw,
'''const KEY_SET = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"]);
''',
'''const KEY_SET = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"]);
const MAX_VEHICLE_ENGINE_VOICES = 10;
const VEHICLE_ENGINE_PROFILES = Object.freeze({
  compact: Object.freeze({ idleHz: 48, redlineHz: 126, filterBase: 520, filterRange: 1050, volume: 0.115, wave: "sawtooth", harmonic: 0.18 }),
  sedan: Object.freeze({ idleHz: 43, redlineHz: 112, filterBase: 470, filterRange: 930, volume: 0.112, wave: "sawtooth", harmonic: 0.17 }),
  van: Object.freeze({ idleHz: 35, redlineHz: 88, filterBase: 390, filterRange: 760, volume: 0.125, wave: "square", harmonic: 0.14 }),
  police: Object.freeze({ idleHz: 47, redlineHz: 128, filterBase: 540, filterRange: 1100, volume: 0.118, wave: "sawtooth", harmonic: 0.19 })
});
''')
replace_once(raw,
'''    this.sampleLoopTimers = new Map();
''',
'''    this.sampleLoopTimers = new Map();
    this.vehicleEngineVoices = new Map();
    this.vehicleEngineFrame = 0;
    this.vehicleEngineFrameOpen = false;
    this.vehicleEnginePaused = false;
''')
engine_methods = '''  beginVehicleEngineFrame({ paused = false } = {}) {
    this.vehicleEngineFrame += 1;
    this.vehicleEngineFrameOpen = true;
    this.vehicleEnginePaused = Boolean(paused);
    if (this.vehicleEnginePaused) this.stopAllVehicleEngines();
    return this.vehicleEngineFrame;
  }

  endVehicleEngineFrame() {
    if (!this.vehicleEngineFrameOpen) return;
    const frame = this.vehicleEngineFrame;
    for (const [id, voice] of [...this.vehicleEngineVoices.entries()]) {
      if (voice.frame !== frame) this.stopVehicleEngine(id);
    }
    this.vehicleEngineFrameOpen = false;
  }

  vehicleEngineProfile(profileId) {
    return VEHICLE_ENGINE_PROFILES[String(profileId || "")] || VEHICLE_ENGINE_PROFILES.sedan;
  }

  createVehicleEngineVoice(id, profileId, priority = 0, audibility = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return null;
    const profile = this.vehicleEngineProfile(profileId);
    if (this.vehicleEngineVoices.size >= MAX_VEHICLE_ENGINE_VOICES) {
      const ranked = [...this.vehicleEngineVoices.entries()]
        .sort((left, right) => ((left[1].priority || 0) * 2 + (left[1].audibility || 0)) - ((right[1].priority || 0) * 2 + (right[1].audibility || 0)));
      const [quietestId, quietest] = ranked[0] || [];
      const incomingScore = Math.max(0, Number(priority) || 0) * 2 + Math.max(0, Number(audibility) || 0);
      const quietestScore = (quietest?.priority || 0) * 2 + (quietest?.audibility || 0);
      if (!quietestId || quietestScore >= incomingScore) return null;
      this.stopVehicleEngine(quietestId);
    }

    try {
      const primary = ctx.createOscillator();
      const secondary = ctx.createOscillator();
      const harmonicGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const panner = typeof ctx.createStereoPanner === "function" ? ctx.createStereoPanner() : null;
      primary.type = profile.wave;
      secondary.type = "triangle";
      harmonicGain.gain.value = profile.harmonic;
      filter.type = "lowpass";
      filter.Q.value = 0.72;
      gain.gain.value = 0.0001;
      primary.connect(filter);
      secondary.connect(harmonicGain);
      harmonicGain.connect(filter);
      filter.connect(gain);
      if (panner) {
        gain.connect(panner);
        panner.connect(this.master);
      } else {
        gain.connect(this.master);
      }
      const voice = { id, profileId, profile, primary, secondary, harmonicGain, filter, gain, panner, frame: this.vehicleEngineFrame, priority, audibility };
      this.vehicleEngineVoices.set(id, voice);
      primary.start();
      secondary.start();
      return voice;
    } catch {
      return null;
    }
  }

  updateVehicleEngine(id, options = {}) {
    const key = String(id || "");
    if (!key) return false;
    const audibility = Math.max(0, Math.min(1, Number(options.audibility) || 0));
    if (this.vehicleEnginePaused || audibility <= 0.002 || options.active === false) {
      this.stopVehicleEngine(key);
      return false;
    }

    this.ensureListeners();
    const ctx = this.unlock();
    if (!ctx || !this.master) return false;
    const priority = Math.max(0, Number(options.priority) || 0);
    let voice = this.vehicleEngineVoices.get(key);
    if (!voice) voice = this.createVehicleEngineVoice(key, options.profileId, priority, audibility);
    if (!voice) return false;

    const profile = voice.profile;
    const rpm = Math.max(0.18, Math.min(1, Number(options.rpm) || 0.18));
    const load = Math.max(0.12, Math.min(1, Number(options.load) || 0.12));
    const frequency = profile.idleHz + (profile.redlineHz - profile.idleHz) * rpm;
    const gainTarget = Math.max(0.0001, profile.volume * audibility * (0.42 + rpm * 0.36 + load * 0.22));
    const filterTarget = profile.filterBase + profile.filterRange * (0.30 + rpm * 0.70);
    const panTarget = Math.max(-1, Math.min(1, Number(options.pan) || 0));
    const now = ctx.currentTime;

    voice.primary.frequency.setTargetAtTime(Math.max(24, frequency), now, 0.035);
    voice.secondary.frequency.setTargetAtTime(Math.max(35, frequency * 2.01), now, 0.040);
    voice.filter.frequency.setTargetAtTime(Math.max(120, filterTarget), now, 0.055);
    voice.gain.gain.setTargetAtTime(gainTarget, now, 0.045);
    voice.panner?.pan?.setTargetAtTime?.(panTarget, now, 0.055);
    voice.frame = this.vehicleEngineFrame;
    voice.priority = priority;
    voice.audibility = audibility;
    voice.rpm = rpm;
    voice.load = load;
    voice.pan = panTarget;
    return true;
  }

  stopVehicleEngine(id) {
    const key = String(id || "");
    const voice = this.vehicleEngineVoices.get(key);
    if (!voice) return false;
    this.vehicleEngineVoices.delete(key);
    const ctx = this.ctx;
    const when = (ctx?.currentTime || 0) + 0.10;
    try { voice.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.025); } catch {}
    try { voice.primary.stop(when); } catch {}
    try { voice.secondary.stop(when); } catch {}
    const disconnect = () => {
      try { voice.primary.disconnect(); } catch {}
      try { voice.secondary.disconnect(); } catch {}
      try { voice.harmonicGain.disconnect(); } catch {}
      try { voice.filter.disconnect(); } catch {}
      try { voice.gain.disconnect(); } catch {}
      try { voice.panner?.disconnect?.(); } catch {}
    };
    voice.primary.onended = disconnect;
    return true;
  }

  stopAllVehicleEngines() {
    for (const id of [...this.vehicleEngineVoices.keys()]) this.stopVehicleEngine(id);
  }

  vehicleEngineSnapshot() {
    return [...this.vehicleEngineVoices.values()].map(voice => ({
      id: voice.id,
      profileId: voice.profileId,
      rpm: Number(voice.rpm) || 0,
      load: Number(voice.load) || 0,
      pan: Number(voice.pan) || 0,
      audibility: Number(voice.audibility) || 0,
      priority: Number(voice.priority) || 0
    }));
  }

'''
replace_once(raw, '  startStepLoop() {\n', engine_methods + '  startStepLoop() {\n')

# Player-driven vehicle uses its authoritative gearbox and publishes it into the engine voice.
driving = "phaser/src/vehicles/VehicleDriving.js"
replace_once(driving,
'''import { collideVehicleWithPedestrians } from "./VehicleConsequences.js";
''',
'''import { collideVehicleWithPedestrians } from "./VehicleConsequences.js";
import { vehicleEngineTelemetry } from "./VehicleEngineModel.js";
''')
player_helper = '''function updateDrivenVehicleEngine(system, vehicle, frame) {
  if (!vehicle || vehicle.disabled) {
    if (vehicle?.id) RawAudio.stopVehicleEngine(`player:${vehicle.id}`);
    return false;
  }
  const throttle = Math.max(0, -(Number(frame?.move?.y) || 0));
  const telemetry = vehicleEngineTelemetry({
    speed: vehicle.speed,
    archetype: vehicle.archetype,
    gear: vehicle.gear,
    gearShiftTimer: vehicle.gearShiftTimer,
    throttle,
    x: vehicle.x,
    y: vehicle.y,
    listener: vehicle,
    ownVehicle: true,
    maxDistance: 1
  });
  return RawAudio.updateVehicleEngine(`player:${vehicle.id}`, { ...telemetry, priority: 3 });
}

'''
replace_once(driving, 'export function aggressiveDrivingSkidIntensity(vehicle, frame = {}) {\n', player_helper + 'export function aggressiveDrivingSkidIntensity(vehicle, frame = {}) {\n')
replace_once(driving,
'''  if (vehicle.disabled) {
    vehicle.handbrake = false;
    system.updateHud();
''',
'''  if (vehicle.disabled) {
    vehicle.handbrake = false;
    RawAudio.stopVehicleEngine(`player:${vehicle.id}`);
    system.updateHud();
''')
replace_once(driving,
'''  collideVehicleWithPedestrians(system, vehicle);
  emitAggressiveDrivingNoise(system, vehicle, frame);
''',
'''  collideVehicleWithPedestrians(system, vehicle);
  updateDrivenVehicleEngine(system, vehicle, frame);
  emitAggressiveDrivingNoise(system, vehicle, frame);
''')

# Traffic proxies derive a presentation gearbox/RPM from actual local movement.
traffic = "phaser/src/streaming/TrafficLocalBehaviorSystem.js"
replace_once(traffic,
'''import { LAYERS } from "../data/district.js";
''',
'''import { LAYERS } from "../data/district.js";
import { RawAudio } from "../systems/RawAudioSystem.js";
import { stepPresentationTransmission, vehicleEngineTelemetry } from "../vehicles/VehicleEngineModel.js";
''')
replace_once(traffic,
'''        stoppedSeconds: 0,
        junctionId: null
''',
'''        stoppedSeconds: 0,
        junctionId: null,
        engineSpeed: 0,
        engineGear: 1,
        engineGearShiftTimer: 0,
        engineRpm: 0.18
''')
replace_once(traffic,
'''    const advance = Math.min(available, seconds / travelSeconds * Math.max(0, state.speedFactor));
    state.visualTravel += advance;
''',
'''    const advance = Math.min(available, seconds / travelSeconds * Math.max(0, state.speedFactor));
    const cruiseSpeed = decision.lane ? decision.lane.length / travelSeconds : 60;
    const measuredSpeed = seconds > 0.0001 && decision.lane
      ? advance * decision.lane.length / seconds
      : state.engineSpeed;
    state.engineSpeed = moveToward(state.engineSpeed, measuredSpeed, Math.max(50, cruiseSpeed * 4) * seconds);
    const engineMaxSpeed = Math.max(45, cruiseSpeed * Math.max(1.12, this.catchUpSpeed) * 1.08);
    const transmission = stepPresentationTransmission({
      gear: state.engineGear,
      gearShiftTimer: state.engineGearShiftTimer
    }, state.engineSpeed, seconds, slot.archetype, { maxSpeed: engineMaxSpeed });
    state.engineGear = transmission.gear;
    state.engineGearShiftTimer = transmission.gearShiftTimer;
    state.visualTravel += advance;
''')
traffic_audio = '''    const listener = this.vehicleSystem.currentVehicle?.() || this.scene.player || { x: slot.x, y: slot.y };
    const throttle = state.desiredSpeedFactor > state.speedFactor + 0.02
      ? 0.82
      : state.speedFactor <= 0.03 ? 0.10 : 0.38;
    const engine = vehicleEngineTelemetry({
      speed: state.engineSpeed,
      archetype: slot.archetype,
      gear: state.engineGear,
      gearShiftTimer: state.engineGearShiftTimer,
      throttle,
      x: slot.x,
      y: slot.y,
      listener,
      maxSpeed: engineMaxSpeed,
      maxDistance: 560
    });
    state.engineRpm = engine.rpm;
    slot.engineSpeed = state.engineSpeed;
    slot.gear = state.engineGear;
    slot.gearShiftTimer = state.engineGearShiftTimer;
    slot.engineRpm = state.engineRpm;
    RawAudio.updateVehicleEngine(`traffic:${state.tokenId}`, { ...engine, priority: 0 });
'''
replace_once(traffic,
'''    slot.visual?.label?.setRotation?.(-slot.angle);
    return slot;
''',
'''    slot.visual?.label?.setRotation?.(-slot.angle);
''' + traffic_audio + '''    return slot;
''')
replace_once(traffic,
'''    for (const tokenId of this.states.keys()) {
      if (!activeIds.has(tokenId)) this.states.delete(tokenId);
    }
''',
'''    for (const tokenId of this.states.keys()) {
      if (!activeIds.has(tokenId)) {
        this.states.delete(tokenId);
        RawAudio.stopVehicleEngine(`traffic:${tokenId}`);
      }
    }
''')
replace_once(traffic,
'''        stoppedSeconds: round(state.stoppedSeconds, 2)
''',
'''        stoppedSeconds: round(state.stoppedSeconds, 2),
        engineSpeed: round(state.engineSpeed, 1),
        gear: state.engineGear,
        engineRpm: round(state.engineRpm, 3)
''')
replace_once(traffic,
'''    this.destroyed = true;
    this.states.clear();
''',
'''    this.destroyed = true;
    for (const tokenId of this.states.keys()) RawAudio.stopVehicleEngine(`traffic:${tokenId}`);
    this.states.clear();
''')

# Police cruisers get the same presentation gearbox and spatial engine voice.
police = "phaser/src/police/MotorizedPoliceSystem.js"
replace_once(police,
'''import { pointAlongPolyline } from "../streaming/TrafficMaterializationSystem.js";
''',
'''import { pointAlongPolyline } from "../streaming/TrafficMaterializationSystem.js";
import { RawAudio } from "../systems/RawAudioSystem.js";
import { stepPresentationTransmission, vehicleEngineTelemetry } from "../vehicles/VehicleEngineModel.js";
''')
replace_once(police,
'''function cloneMemory(memory) {
  return memory ? { ...memory } : null;
}
''',
'''function cloneMemory(memory) {
  return memory ? { ...memory } : null;
}

function polylineLength(points) {
  const list = Array.isArray(points) ? points : [];
  let total = 0;
  for (let index = 0; index < list.length - 1; index++) {
    total += Math.hypot(finite(list[index + 1]?.x) - finite(list[index]?.x), finite(list[index + 1]?.y) - finite(list[index]?.y));
  }
  return total;
}
''')
replace_once(police,
'''      visible: false,
      deploymentReason: level >= 3 ? "wanted-three" : "wanted-two"
''',
'''      visible: false,
      engineSpeed: 0,
      engineGear: 1,
      engineGearShiftTimer: 0,
      engineRpm: 0.18,
      deploymentReason: level >= 3 ? "wanted-three" : "wanted-two"
''')
police_methods = '''  engineReferenceSpeed(unit, level) {
    const leg = unit?.legs?.[unit.legIndex];
    if (!leg) return 80;
    const base = polylineLength(leg.points) / Math.max(0.25, finite(leg.travelSeconds, 6));
    return Math.max(65, base * (2.35 + Math.max(0, finite(level)) * 0.15));
  }

  updateEngineAudio(unit, dt, level, previousPoint = null) {
    const archetype = this.slots[unit.index]?.archetype || vehicleArchetype("police");
    if (!unit || !archetype || unit.disabled) {
      if (unit?.id) RawAudio.stopVehicleEngine(`police:${unit.id}`);
      return false;
    }
    const seconds = Math.max(0, finite(dt));
    const moved = previousPoint && seconds > 0.0001
      ? Math.hypot(unit.x - previousPoint.x, unit.y - previousPoint.y) / seconds
      : 0;
    const movingSpeed = unit.officersDismounted || unit.arrived ? 0 : moved;
    const referenceSpeed = this.engineReferenceSpeed(unit, level);
    const transmission = stepPresentationTransmission({
      gear: unit.engineGear,
      gearShiftTimer: unit.engineGearShiftTimer
    }, movingSpeed, seconds, archetype, { maxSpeed: referenceSpeed });
    unit.engineSpeed = movingSpeed;
    unit.engineGear = transmission.gear;
    unit.engineGearShiftTimer = transmission.gearShiftTimer;
    const listener = this.vehicleSystem.currentVehicle?.() || this.scene.player || { x: unit.x, y: unit.y };
    const engine = vehicleEngineTelemetry({
      speed: unit.engineSpeed,
      archetype,
      gear: unit.engineGear,
      gearShiftTimer: unit.engineGearShiftTimer,
      throttle: unit.engineSpeed > 1 ? 0.78 : 0.10,
      x: unit.x,
      y: unit.y,
      listener,
      maxSpeed: referenceSpeed,
      maxDistance: 720
    });
    unit.engineRpm = engine.rpm;
    return RawAudio.updateVehicleEngine(`police:${unit.id}`, { ...engine, priority: 2 });
  }

'''
replace_once(police, '  releaseSlot(index) {\n', police_methods + '  releaseSlot(index) {\n')
replace_once(police,
'''  updateUnit(unit, dt, level, focus, targetDistrictId) {
    unit.impactCooldown = Math.max(0, finite(unit.impactCooldown) - dt);

    if (unit.officersDismounted || unit.disabled) {
''',
'''  updateUnit(unit, dt, level, focus, targetDistrictId) {
    unit.impactCooldown = Math.max(0, finite(unit.impactCooldown) - dt);
    const previousPoint = { x: unit.x, y: unit.y };

    if (unit.officersDismounted || unit.disabled) {
''')
replace_once(police,
'''      this.updateSlot(unit, focus);
      if (unit.disabled && !unit.officersDismounted) this.dismountUnit(unit.id, "disabled-cruiser");
      this.processPlayerImpact(unit);
      return;
''',
'''      this.updateSlot(unit, focus);
      this.updateEngineAudio(unit, dt, level, previousPoint);
      if (unit.disabled && !unit.officersDismounted) this.dismountUnit(unit.id, "disabled-cruiser");
      this.processPlayerImpact(unit);
      return;
''')
replace_once(police,
'''    this.updateSlot(unit, focus);
    this.processPlayerImpact(unit);

    if (!unit.visible || this.scene.currentLayer !== LAYERS.STREET) return;
''',
'''    this.updateSlot(unit, focus);
    this.updateEngineAudio(unit, dt, level, previousPoint);
    this.processPlayerImpact(unit);

    if (!unit.visible || this.scene.currentLayer !== LAYERS.STREET) return;
''')
replace_once(police,
'''        officersDismounted: unit.officersDismounted,
        officerIds: [...unit.officerIds]
''',
'''        officersDismounted: unit.officersDismounted,
        officerIds: [...unit.officerIds],
        engineSpeed: round(unit.engineSpeed, 1),
        gear: unit.engineGear,
        engineRpm: round(unit.engineRpm, 3)
''')
replace_once(police,
'''    this.destroyed = true;
    if (this.vehicleSystem && this.vehicleSystem.canOccupy === this.motorizedAwareCanOccupy) {
''',
'''    this.destroyed = true;
    for (const unit of this.units) RawAudio.stopVehicleEngine(`police:${unit.id}`);
    if (this.vehicleSystem && this.vehicleSystem.canOccupy === this.motorizedAwareCanOccupy) {
''')

# GameplayRuntime owns the per-frame voice liveness sweep.
runtime = "phaser/src/runtime/GameplayRuntime.js"
replace_once(runtime,
'''import { TrafficPhysicalConsequencesSystem } from "../streaming/TrafficPhysicalConsequencesSystem.js";
''',
'''import { TrafficPhysicalConsequencesSystem } from "../streaming/TrafficPhysicalConsequencesSystem.js";
import { RawAudio } from "../systems/RawAudioSystem.js";
''')
replace_once(runtime,
'''    const dt = Math.min(Math.max(0, Number(deltaMs) || 0) / 1000, 0.05);

    scene.cityStreamSystem?.update?.();
''',
'''    const dt = Math.min(Math.max(0, Number(deltaMs) || 0) / 1000, 0.05);
    RawAudio.beginVehicleEngineFrame({ paused: Boolean(scene.registry?.get?.("uiPaused")) });

    scene.cityStreamSystem?.update?.();
''')
replace_once(runtime,
'''    } finally {
      if (input && originalBeginFrame) input.beginFrame = originalBeginFrame;
      if (originalCollectInteractions) scene.collectInteractions = originalCollectInteractions;
    }
''',
'''    } finally {
      if (input && originalBeginFrame) input.beginFrame = originalBeginFrame;
      if (originalCollectInteractions) scene.collectInteractions = originalCollectInteractions;
      RawAudio.endVehicleEngineFrame();
    }
''')
replace_once(runtime,
'''  destroy() {
    this.scene.huntingLawRuntimeSystem?.destroy?.();
''',
'''  destroy() {
    RawAudio.stopAllVehicleEngines();
    this.scene.huntingLawRuntimeSystem?.destroy?.();
''')

# Exiting a driven car should not leave one extra audible frame.
interactions = "phaser/src/vehicles/VehicleInteractions.js"
replace_once(interactions,
'''  system.currentVehicleId = null;
  restoreStreetControl(system.scene, exitPoint);
''',
'''  system.currentVehicleId = null;
  RawAudio.stopVehicleEngine(`player:${vehicle.id}`);
  restoreStreetControl(system.scene, exitPoint);
''')

# Canonical audio direction: systemic city, no fixed ambience bed.
docs = Path("docs/audio-catalog.md")
text = docs.read_text()
text = text.replace(
'''- `vehicleSkidLoop` — **integrated candidate on PR #55, pending listening acceptance**: the supplied MagiaZ tyre skid is trimmed into a gap-sensitive PCM WAV loop. Aggressive-driving pulses sustain one stateful loop while the drift continues and let it stop shortly after the skid ends; civilian panic remains a separate non-reporting reaction with no Heat.\n''',
'''- `vehicleSkidLoop` — **integrated + listening accepted on PR #55**: the supplied MagiaZ tyre skid is trimmed into a gap-sensitive PCM WAV loop. Aggressive-driving pulses sustain one stateful loop while the drift continues and let it stop shortly after the skid ends; civilian panic remains a separate non-reporting reaction with no Heat.\n- `vehicleEngine` — **procedural systemic candidate on PR #55, pending driving-mix acceptance**: player vehicles, materialized civilian traffic and motorized police share gear-aware RPM telemetry. RawAudio owns up to ten prioritized spatial engine voices so nearby cars create the city soundscape without a fixed ambience bed. The current oscillator voice is a placeholder transport layer; a future sourced engine recording can replace the timbre without changing gearbox/RPM ownership.\n''')
text = text.replace(
'''- `vehicleSkidLoop` — **integrated candidate:** real gap-sensitive PCM loop sustained while aggressive drifting continues; pending listening acceptance\n''',
'''- `vehicleSkidLoop` — **done for the current playtest:** real gap-sensitive PCM loop sustained while aggressive drifting continues; listening accepted\n- `vehicleEngine` — **systemic candidate:** automatic gears drive RPM/pitch for the player, local civilian traffic and police cruisers; current timbre is procedural until a real engine source is supplied\n''')
text = text.replace(
'''### UI / city bed\n\n- `confirm`, `cancel`, `menu`\n- `objectiveUpdated`\n- `ambienceStreetNight` — seamless night-city bed\n- `trafficAmbience` — distant moving-traffic layer\n''',
'''### UI / systemic city soundscape\n\n- `confirm`, `cancel`, `menu`\n- `objectiveUpdated`\n\nViceblood intentionally has **no continuous `ambienceStreetNight` or `trafficAmbience` bed** in the current direction. Urban ambience must emerge from spatial systemic sources: player/NPC engines, gear changes, tyres, sirens, civilians, combat, police and future world props. Silence between events is part of the mix rather than a missing layer.\n''')
text = text.replace(
'''`step`, `weaponFire`, `bulletHitBody`, `drainStart`, `drainLoop`, `drainComplete`, `whisper`, `civilianScream`, `policeSirenLoop`, `vehicleEngineDrive`, `vehicleCollisionHeavy`, `ambienceStreetNight`.\n\n`weaponFire`, `bulletHitBody` and `civilianScream` are integrated and listening accepted. `policeSirenLoop` is integrated and awaits in-game listening acceptance. The feeding family is fully materialized and wired but still needs human listening acceptance before it is marked done. With `policeSirenLoop` and `vehicleSkidLoop` now wired as listening candidates, continue sourcing with `ambienceStreetNight`. `bulletHitWorld` remains a separate firearm-material family and must never reuse `bulletHitBody`.\n''',
'''`step`, `weaponFire`, `bulletHitBody`, `drainStart`, `drainLoop`, `drainComplete`, `whisper`, `civilianScream`, `policeSirenLoop`, `vehicleEngineDrive`, `vehicleCollisionHeavy`.\n\n`weaponFire`, `bulletHitBody`, `civilianScream` and `vehicleSkidLoop` are integrated and listening accepted. `policeSirenLoop` is integrated and awaits in-game listening acceptance. The feeding family is fully materialized and wired but still needs human listening acceptance before it is marked done. `vehicleEngine` now has systemic gear/RPM wiring for player, civilian traffic and police, but still needs a sourced engine recording if the procedural timbre is to be replaced. There is deliberately no fixed city/traffic ambience sourcing task. `bulletHitWorld` remains a separate firearm-material family and must never reuse `bulletHitBody`.\n''')
docs.write_text(text)

# Focused regression coverage.
write("tests/vehicle-engine-audio.test.js", '''import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { VEHICLE_ARCHETYPES } from "../phaser/src/data/vehicles.js";
import {
  stepPresentationTransmission,
  vehicleEngineRpmNormalized,
  vehicleEngineTelemetry
} from "../phaser/src/vehicles/VehicleEngineModel.js";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("presentation transmission upshifts and the engine drops RPM into the next gear", () => {
  const compact = VEHICLE_ARCHETYPES.compact;
  const shifted = stepPresentationTransmission({ gear: 1, gearShiftTimer: 0 }, 64, 0.05, compact);
  assert.equal(shifted.gear, 2);
  assert.ok(shifted.gearShiftTimer > 0);
  const before = vehicleEngineRpmNormalized({ speed: 57, maxSpeed: compact.maxSpeed, gear: 1, gearCount: 5, shifting: false });
  const after = vehicleEngineRpmNormalized({ speed: 64, maxSpeed: compact.maxSpeed, gear: 2, gearCount: 5, shifting: true });
  assert.ok(before > after, "an upshift should audibly drop engine revs");
});

test("engine telemetry is spatial and preserves an own-vehicle priority mix", () => {
  const sedan = VEHICLE_ARCHETYPES.sedan;
  const own = vehicleEngineTelemetry({ speed: 180, archetype: sedan, gear: 3, throttle: 1, ownVehicle: true });
  const near = vehicleEngineTelemetry({ speed: 180, archetype: sedan, gear: 3, throttle: 0.5, x: 150, y: 0, listener: { x: 0, y: 0 }, maxDistance: 600 });
  const far = vehicleEngineTelemetry({ speed: 180, archetype: sedan, gear: 3, throttle: 0.5, x: 520, y: 0, listener: { x: 0, y: 0 }, maxDistance: 600 });
  assert.equal(own.audibility, 1);
  assert.equal(own.pan, 0);
  assert.ok(near.audibility > far.audibility);
  assert.ok(near.pan > 0);
});

test("RawAudio owns capped persistent engine voices for player traffic and police", () => {
  const raw = source("phaser/src/systems/RawAudioSystem.js");
  const driving = source("phaser/src/vehicles/VehicleDriving.js");
  const traffic = source("phaser/src/streaming/TrafficLocalBehaviorSystem.js");
  const police = source("phaser/src/police/MotorizedPoliceSystem.js");
  const runtime = source("phaser/src/runtime/GameplayRuntime.js");
  assert.match(raw, /MAX_VEHICLE_ENGINE_VOICES = 10/);
  assert.match(raw, /updateVehicleEngine\(id, options = \{\}\)/);
  assert.match(raw, /createStereoPanner/);
  assert.match(raw, /stopAllVehicleEngines\(\)/);
  assert.match(driving, /RawAudio\.updateVehicleEngine\(`player:/);
  assert.match(traffic, /RawAudio\.updateVehicleEngine\(`traffic:/);
  assert.match(traffic, /stepPresentationTransmission/);
  assert.match(police, /RawAudio\.updateVehicleEngine\(`police:/);
  assert.match(police, /engineReferenceSpeed/);
  assert.match(runtime, /beginVehicleEngineFrame/);
  assert.match(runtime, /endVehicleEngineFrame/);
});

test("the canonical audio plan has no fixed city or distant traffic ambience bed", () => {
  const catalogue = source("docs/audio-catalog.md");
  assert.match(catalogue, /no continuous `ambienceStreetNight` or `trafficAmbience` bed/);
  assert.match(catalogue, /Urban ambience must emerge from spatial systemic sources/);
  assert.match(catalogue, /vehicleEngine.*procedural systemic candidate/s);
});
''')
