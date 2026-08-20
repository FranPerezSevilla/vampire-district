import { sampleAudioDefinition } from "../audio/SampleAudioCatalog.js";
import { LAYERS } from "../data/district.js";
import { RawAudio } from "../systems/RawAudioSystem.js";
import { MOTORIZED_POLICE_ROLES } from "./MotorizedPolicePolicy.js";

const POLICE_SIREN_EVENT = "policeSirenLoop";
const POLICE_SIREN_AUDIBLE_RADIUS = 1080;
const POLICE_SIREN_PAN_DISTANCE = 360;
const MIN_MOBILE_PURSUIT_UNITS = 2;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function distance(a, b) {
  return Math.hypot((Number(a?.x) || 0) - (Number(b?.x) || 0), (Number(a?.y) || 0) - (Number(b?.y) || 0));
}

export function mobilePursuitUnitCount(units = []) {
  return (Array.isArray(units) ? units : []).filter(unit => (
    unit?.role === MOTORIZED_POLICE_ROLES.PURSUIT
    && !unit.disabled
    && !unit.officersDismounted
  )).length;
}

export function mayDismountPursuitUnit(units = [], unit, wantedLevel) {
  if (!unit || unit.role !== MOTORIZED_POLICE_ROLES.PURSUIT) return true;
  if (Math.max(0, Number(wantedLevel) || 0) < 2) return true;
  if (unit.disabled || unit.officersDismounted) return true;
  return mobilePursuitUnitCount(units) > MIN_MOBILE_PURSUIT_UNITS;
}

export function installMotorizedPoliceLocalPolicy(system) {
  if (!system?.safeCandidate || !system?.dismountUnit || !system?.update) {
    throw new TypeError("Motorized police local policy requires a response system.");
  }

  const originalSafeCandidate = system.safeCandidate;
  const originalDismountUnit = system.dismountUnit;
  const originalUpdate = system.update;
  const sirenLoops = new Map();

  function stopSiren(unitId) {
    const handle = sirenLoops.get(unitId);
    if (!handle) return false;
    sirenLoops.delete(unitId);
    try { handle.source.stop(); } catch {}
    try { handle.source.disconnect(); } catch {}
    try { handle.gain.disconnect(); } catch {}
    try { handle.pan?.disconnect?.(); } catch {}
    return true;
  }

  function stopAllSirens() {
    for (const unitId of [...sirenLoops.keys()]) stopSiren(unitId);
  }

  function ensureSiren(unit) {
    if (!unit?.id || unit.disabled) return null;
    const existing = sirenLoops.get(unit.id);
    if (existing) return existing;

    const definition = sampleAudioDefinition(POLICE_SIREN_EVENT);
    if (!definition?.loop) return null;
    RawAudio.ensureListeners?.();
    const ctx = RawAudio.unlock?.();
    if (!ctx || !RawAudio.master) return null;

    const buffers = RawAudio.sampleBuffers?.get?.(POLICE_SIREN_EVENT);
    if (!buffers?.length) {
      RawAudio.loadSampleEvent?.(POLICE_SIREN_EVENT);
      return null;
    }

    try {
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      const pan = ctx.createStereoPanner?.() || null;
      source.buffer = buffers[0];
      source.loop = true;
      gain.gain.value = 0;
      source.connect(gain);
      if (pan) {
        gain.connect(pan);
        pan.connect(RawAudio.master);
      } else {
        gain.connect(RawAudio.master);
      }
      const handle = { source, gain, pan };
      sirenLoops.set(unit.id, handle);
      source.onended = () => {
        if (sirenLoops.get(unit.id) === handle) sirenLoops.delete(unit.id);
      };
      source.start();
      return handle;
    } catch {
      stopSiren(unit.id);
      return null;
    }
  }

  function updateSirens() {
    const scene = system.scene;
    if (!scene || scene.registry?.get?.("uiPaused") || scene.currentLayer !== LAYERS.STREET) {
      stopAllSirens();
      return;
    }

    const definition = sampleAudioDefinition(POLICE_SIREN_EVENT);
    if (!definition?.loop) {
      stopAllSirens();
      return;
    }

    const focus = scene.renderFocus?.() || scene.player || { x: 0, y: 0 };
    const activeIds = new Set();
    for (const unit of system.units || []) {
      if (!unit || unit.disabled) continue;
      const separation = distance(unit, focus);
      if (separation >= POLICE_SIREN_AUDIBLE_RADIUS) continue;
      activeIds.add(unit.id);
      const handle = ensureSiren(unit);
      if (!handle || !RawAudio.ctx) continue;

      const proximity = clamp(1 - separation / POLICE_SIREN_AUDIBLE_RADIUS, 0, 1);
      const attenuation = Math.pow(proximity, 1.35);
      const targetGain = Math.max(0, Number(definition.volume) || 0) * attenuation;
      handle.gain.gain.setTargetAtTime(targetGain, RawAudio.ctx.currentTime, 0.08);
      if (handle.pan) {
        const targetPan = clamp(((Number(unit.x) || 0) - (Number(focus.x) || 0)) / POLICE_SIREN_PAN_DISTANCE, -0.82, 0.82);
        handle.pan.pan.setTargetAtTime(targetPan, RawAudio.ctx.currentTime, 0.09);
      }
    }

    for (const unitId of [...sirenLoops.keys()]) {
      if (!activeIds.has(unitId)) stopSiren(unitId);
    }
  }

  function macroAwareSafeCandidate(unit, point) {
    // Distant response movement is abstract. Local blockers matter only after
    // the candidate position enters the local materialization window.
    const candidate = { ...unit, x: Number(point?.x) || 0, y: Number(point?.y) || 0 };
    const focus = this.targetFocus?.() || this.scene?.renderFocus?.() || this.scene?.player || { x: 0, y: 0 };
    const candidateWillBeLocal = Boolean(this.shouldMaterialize?.(candidate, focus));
    if (!unit?.visible && !candidateWillBeLocal) return true;
    return originalSafeCandidate.call(this, unit, point);
  }

  function arrivalAwareDismount(unitId, reason = "intercept") {
    const unit = this.units?.find?.(candidate => candidate.id === unitId);
    const blockedLongEnough = Number(unit?.blockedSeconds) >= 1.15;
    if (unit?.role === MOTORIZED_POLICE_ROLES.ROADBLOCK
      && reason === "roadblock"
      && !unit.arrived
      && !blockedLongEnough) {
      return [];
    }
    // Wanted 2+ must keep two cruisers physically chasing. The extra Wanted 2 cruiser
    // may deploy officers, while Wanted 3's roadblock remains free to dismount separately.
    if (!mayDismountPursuitUnit(this.units, unit, this.wantedLevel?.())) return [];
    return originalDismountUnit.call(this, unitId, reason);
  }

  function sirenAwareUpdate(dt = 0) {
    const result = originalUpdate.call(this, dt);
    updateSirens();
    return result;
  }

  system.safeCandidate = macroAwareSafeCandidate;
  system.dismountUnit = arrivalAwareDismount;
  system.update = sirenAwareUpdate;

  return Object.freeze({
    destroy() {
      stopAllSirens();
      if (system.safeCandidate === macroAwareSafeCandidate) {
        system.safeCandidate = originalSafeCandidate;
      }
      if (system.dismountUnit === arrivalAwareDismount) {
        system.dismountUnit = originalDismountUnit;
      }
      if (system.update === sirenAwareUpdate) {
        system.update = originalUpdate;
      }
    }
  });
}
