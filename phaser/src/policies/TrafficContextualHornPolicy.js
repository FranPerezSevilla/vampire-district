import { sampleAudioDefinition } from "../audio/SampleAudioCatalog.js";
import { LAYERS } from "../data/district.js";
import { TrafficLocalBehaviorSystem } from "../streaming/TrafficLocalBehaviorSystem.js";
import { RawAudio } from "../systems/RawAudioSystem.js";

const TRAFFIC_HORN_DRIVER_PERCENT = 46;
const TRAFFIC_HORN_MIN_DELAY_SECONDS = 1.85;
const TRAFFIC_HORN_DELAY_SPREAD_SECONDS = 1.25;
const TRAFFIC_HORN_MIN_COOLDOWN_SECONDS = 7.2;
const TRAFFIC_HORN_COOLDOWN_SPREAD_SECONDS = 4.8;
const TRAFFIC_HORN_GLOBAL_GAP_SECONDS = 1.15;
const TRAFFIC_HORN_RETRY_SECONDS = 0.75;
const TRAFFIC_HORN_MAX_DISTANCE = 520;
const TRAFFIC_HORN_VOLUME_SCALE = 0.74;
const TRAFFIC_HORN_BLOCK_REASONS = new Set([
  "traffic",
  "traffic-separation",
  "junction-yield",
  "junction-reserved",
  "player-vehicle"
]);

function finite(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function baseReason(reason) {
  return String(reason || "").replace(/^assertive-/, "");
}

export function trafficHornDriverProfile(tokenId) {
  const key = String(tokenId || "traffic");
  const enabled = stableHash(`horn-enabled:${key}`) % 100 < TRAFFIC_HORN_DRIVER_PERCENT;
  const delayUnit = (stableHash(`horn-delay:${key}`) % 1000) / 999;
  const cooldownUnit = (stableHash(`horn-cooldown:${key}`) % 1000) / 999;
  return Object.freeze({
    enabled,
    delaySeconds: TRAFFIC_HORN_MIN_DELAY_SECONDS + delayUnit * TRAFFIC_HORN_DELAY_SPREAD_SECONDS,
    cooldownSeconds: TRAFFIC_HORN_MIN_COOLDOWN_SECONDS + cooldownUnit * TRAFFIC_HORN_COOLDOWN_SPREAD_SECONDS
  });
}

export function trafficHornEligibleReason(reason) {
  return TRAFFIC_HORN_BLOCK_REASONS.has(baseReason(reason));
}

export function trafficHornSpatialMix(source = {}, listener = {}, maxDistance = TRAFFIC_HORN_MAX_DISTANCE) {
  const safeDistance = Math.max(1, finite(maxDistance, TRAFFIC_HORN_MAX_DISTANCE));
  const dx = finite(source.x) - finite(listener.x);
  const dy = finite(source.y) - finite(listener.y);
  const distance = Math.hypot(dx, dy);
  const normalized = clamp(distance / safeDistance, 0, 1);
  const audibility = distance >= safeDistance ? 0 : (1 - normalized) ** 1.25;
  const pan = clamp(dx / (safeDistance * 0.55), -0.9, 0.9);
  return { distance, audibility, pan };
}

export function trafficHornShouldPlay(state = {}, tokenId = "", now = 0) {
  const profile = trafficHornDriverProfile(tokenId || state.tokenId);
  if (!profile.enabled || !trafficHornEligibleReason(state.reason)) return false;
  if (finite(state.speedFactor, 1) > 0.03) return false;
  if (finite(state.stoppedSeconds) < profile.delaySeconds) return false;
  if (finite(state.hornCooldownUntil) > finite(now)) return false;
  if (finite(state.hornRetryUntil) > finite(now)) return false;
  return true;
}

function ensureHornAuthority(system) {
  system.__nbdTrafficHornClock = Math.max(0, finite(system.__nbdTrafficHornClock));
  system.__nbdTrafficHornGlobalNextAt = Math.max(0, finite(system.__nbdTrafficHornGlobalNextAt));
  system.__nbdTrafficHornMetrics ||= {
    hornsPlayed: 0,
    lastHornTokenId: null,
    lastHornReason: null
  };
}

function playSpatialVehicleHorn(source, listener) {
  const definition = sampleAudioDefinition("vehicleHorn");
  if (!definition) return false;
  const mix = trafficHornSpatialMix(source, listener);
  if (mix.audibility <= 0.015) return false;

  RawAudio.ensureListeners?.();
  const ctx = RawAudio.unlock?.();
  const destination = RawAudio.sampleDestination?.("vehicleHorn") || RawAudio.master;
  if (!ctx || !destination) return false;

  const buffers = RawAudio.sampleBuffers?.get?.("vehicleHorn");
  if (!buffers?.length) {
    RawAudio.loadSampleEvent?.("vehicleHorn");
    return false;
  }

  try {
    const cursor = finite(RawAudio.sampleCursor?.vehicleHorn);
    const buffer = buffers[cursor % buffers.length];
    RawAudio.sampleCursor.vehicleHorn = (cursor + 1) % buffers.length;
    const node = ctx.createBufferSource();
    const gain = ctx.createGain();
    const panner = typeof ctx.createStereoPanner === "function" ? ctx.createStereoPanner() : null;
    node.buffer = buffer;
    gain.gain.value = Math.max(0, finite(definition.volume)) * TRAFFIC_HORN_VOLUME_SCALE * mix.audibility;
    node.connect(gain);
    if (panner) {
      panner.pan.value = mix.pan;
      gain.connect(panner);
      panner.connect(destination);
    } else {
      gain.connect(destination);
    }
    node.onended = () => {
      try { node.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
      try { panner?.disconnect?.(); } catch {}
    };
    node.start(ctx.currentTime);
    return true;
  } catch {
    return false;
  }
}

function processContextualTrafficHorns(system, seconds = 0) {
  ensureHornAuthority(system);
  system.__nbdTrafficHornClock += Math.max(0, finite(seconds));
  const now = system.__nbdTrafficHornClock;
  if (system.scene?.currentLayer !== LAYERS.STREET) return system.__nbdTrafficHornMetrics;
  if (now < system.__nbdTrafficHornGlobalNextAt) return system.__nbdTrafficHornMetrics;

  const listener = system.vehicleSystem?.currentVehicle?.() || system.scene?.player;
  if (!listener) return system.__nbdTrafficHornMetrics;

  const slots = (system.materializer?.pool || [])
    .filter(slot => slot?.tokenId && slot.container?.active !== false && slot.container?.visible !== false)
    .sort((left, right) => finite(left.slotIndex) - finite(right.slotIndex));

  for (const slot of slots) {
    const state = system.states?.get?.(slot.tokenId);
    if (!state || !trafficHornShouldPlay(state, slot.tokenId, now)) continue;
    const mix = trafficHornSpatialMix(slot, listener);
    if (mix.audibility <= 0.015) continue;

    if (!playSpatialVehicleHorn(slot, listener)) {
      state.hornRetryUntil = now + TRAFFIC_HORN_RETRY_SECONDS;
      continue;
    }

    const profile = trafficHornDriverProfile(slot.tokenId);
    state.hornCooldownUntil = now + profile.cooldownSeconds;
    state.hornRetryUntil = 0;
    state.hornCount = Math.max(0, finite(state.hornCount)) + 1;
    system.__nbdTrafficHornGlobalNextAt = now + TRAFFIC_HORN_GLOBAL_GAP_SECONDS;
    system.__nbdTrafficHornMetrics.hornsPlayed += 1;
    system.__nbdTrafficHornMetrics.lastHornTokenId = slot.tokenId;
    system.__nbdTrafficHornMetrics.lastHornReason = baseReason(state.reason);
    system.scene?.events?.emit?.("vehicle:horn", {
      vehicleId: `traffic:${slot.tokenId}`,
      trafficTokenId: slot.tokenId,
      source: "traffic",
      reason: baseReason(state.reason),
      x: finite(slot.x),
      y: finite(slot.y),
      heat: 0
    });
    break;
  }

  return system.__nbdTrafficHornMetrics;
}

function hornSnapshot(system, snapshot) {
  ensureHornAuthority(system);
  const now = system.__nbdTrafficHornClock;
  const vehicles = (Array.isArray(snapshot?.vehicles) ? snapshot.vehicles : []).map(item => {
    const state = system.states?.get?.(item.tokenId) || {};
    const profile = trafficHornDriverProfile(item.tokenId);
    return {
      ...item,
      hornEligible: profile.enabled,
      hornCount: Math.max(0, finite(state.hornCount)),
      hornCooldownRemaining: Math.max(0, finite(state.hornCooldownUntil) - now)
    };
  });
  return {
    ...snapshot,
    vehicles,
    contextualHornsPlayed: Math.max(0, finite(system.__nbdTrafficHornMetrics?.hornsPlayed)),
    hornEligibleVehicles: vehicles.filter(item => item.hornEligible).length,
    hornCooldownVehicles: vehicles.filter(item => item.hornCooldownRemaining > 0).length,
    lastContextualHornTokenId: system.__nbdTrafficHornMetrics?.lastHornTokenId || null,
    lastContextualHornReason: system.__nbdTrafficHornMetrics?.lastHornReason || null
  };
}

export function installTrafficContextualHornPolicy() {
  const behavior = TrafficLocalBehaviorSystem?.prototype;
  if (!behavior || behavior.__nbdContextualHornPolicy) return;

  const originalUpdate = behavior.update;
  const originalSnapshot = behavior.snapshot;

  behavior.update = function contextualHornUpdate(dt = 0, options = {}) {
    const result = originalUpdate.call(this, dt, options);
    if (!result || this.destroyed || !this.ready || this.scene.registry?.get?.("uiPaused")) return result;
    processContextualTrafficHorns(this, dt);
    return result;
  };

  behavior.snapshot = function contextualHornSnapshot() {
    return hornSnapshot(this, originalSnapshot.call(this));
  };

  Object.defineProperty(behavior, "__nbdContextualHornPolicy", {
    value: true,
    configurable: true
  });
}
