import { districtZoneAt, districtZones } from "../data/district.js";
import {
  ATTENTION_EVENT_TYPES,
  HEAT_LEVEL_THRESHOLDS,
  MAX_DISTRICT_HEAT,
  createHeatState,
  heatLevelFromValue,
  heatValueForDistrict,
  maximumHeatValue,
  sanitizeHeatState
} from "../data/attention.js";

const HEAT_COOLING_GRACE_MS = 2000;

function finite(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class HeatSystem {
  constructor(scene, { state = null } = {}) {
    this.scene = scene;
    this.state = sanitizeHeatState(state || createHeatState());
    this.persistTimer = 0;
    this.coolingBlockedUntil = 0;
    this.lastPublishedLevel = this.level();
    this.installDiagnostics();
    scene.events?.once?.(globalThis.Phaser?.Scenes?.Events?.SHUTDOWN || "shutdown", this.destroy, this);
  }

  now() {
    return Math.max(0, Math.trunc(Date.now()));
  }

  districtAt(x = this.scene.player?.x || 0, y = this.scene.player?.y || 0) {
    return districtZoneAt(finite(x), finite(y))
      || { id: "district", name: "District", x: 0, y: 0, w: 0, h: 0 };
  }

  districtState(districtId, create = false) {
    const id = String(districtId || "").trim();
    if (!id) return null;
    if (!this.state.districts[id] && create) {
      this.state.districts[id] = {
        value: 0,
        lastReason: "No active police Heat.",
        updatedAt: this.now()
      };
    }
    return this.state.districts[id] || null;
  }

  valueFor(districtId) {
    return heatValueForDistrict(this.state, districtId);
  }

  values() {
    const result = Object.create(null);
    for (const [id, district] of Object.entries(this.state.districts || {})) {
      if ((Number(district?.value) || 0) > 0.001) result[id] = Number(district.value) || 0;
    }
    return result;
  }

  replaceValues(values = {}) {
    const candidate = createHeatState();
    for (const [id, value] of Object.entries(values || {})) {
      const amount = Math.max(0, Math.min(MAX_DISTRICT_HEAT, finite(value)));
      if (!amount) continue;
      candidate.districts[id] = {
        value: amount,
        lastReason: "Restored compatibility Heat.",
        updatedAt: this.now()
      };
    }
    this.restoreState(candidate);
  }

  maximum() {
    return maximumHeatValue(this.state);
  }

  level() {
    return heatLevelFromValue(this.maximum());
  }

  hottestZone() {
    let best = null;
    let value = 0;
    for (const zone of districtZones) {
      const candidate = this.valueFor(zone.id);
      if (candidate > value) {
        best = zone;
        value = candidate;
      }
    }
    return best;
  }

  add(x, y, amount, reason = "Police Heat rises.", {
    source = "system",
    districtId = null,
    emit = true,
    persist = true
  } = {}) {
    const delta = finite(amount);
    if (!(delta > 0)) return null;
    const zone = districtId
      ? districtZones.find(item => item.id === districtId) || { id: districtId, name: districtId }
      : this.districtAt(x, y);
    const district = this.districtState(zone.id, true);
    const valueBefore = district.value;
    const levelBefore = heatLevelFromValue(valueBefore);
    district.value = Math.max(0, Math.min(MAX_DISTRICT_HEAT, valueBefore + delta));
    district.lastReason = String(reason || "Police Heat rises.");
    district.updatedAt = this.now();
    this.coolingBlockedUntil = Math.max(
      this.coolingBlockedUntil,
      district.updatedAt + HEAT_COOLING_GRACE_MS
    );
    this.state.lastReason = district.lastReason;
    const levelAfter = heatLevelFromValue(district.value);
    const incident = {
      id: this.nextIncidentId(),
      districtId: zone.id,
      amount: district.value - valueBefore,
      valueBefore,
      valueAfter: district.value,
      levelBefore,
      levelAfter,
      reason: district.lastReason,
      source: String(source || "system"),
      timestamp: district.updatedAt
    };
    this.state.incidents.push(incident);
    this.state.incidents = this.state.incidents.slice(-64);

    if (emit) {
      this.emit(ATTENTION_EVENT_TYPES.HEAT_ADDED, incident);
      if (levelAfter !== levelBefore) {
        this.emit(ATTENTION_EVENT_TYPES.HEAT_WANTED_CHANGED, {
          districtId: zone.id,
          levelBefore,
          levelAfter,
          value: district.value,
          reason: district.lastReason,
          timestamp: incident.timestamp
        });
      }
    }
    if (persist) this.persist({ save: true });
    return clone(incident);
  }

  addInDistrict(districtId, amount, reason = "Police Heat rises.", options = {}) {
    const zone = districtZones.find(item => item.id === districtId);
    const x = zone ? zone.x + zone.w / 2 : this.scene.player?.x || 0;
    const y = zone ? zone.y + zone.h / 2 : this.scene.player?.y || 0;
    return this.add(x, y, amount, reason, { ...options, districtId });
  }

  reduceInDistrict(districtId, amount, reason = "Police response is downgraded.", {
    source = "system",
    persist = true
  } = {}) {
    const id = String(districtId || "").trim();
    const delta = Math.max(0, finite(amount));
    const district = this.districtState(id, false);
    if (!district || !delta || !(district.value > 0)) return 0;
    const before = district.value;
    const levelBefore = heatLevelFromValue(before);
    district.value = Math.max(0, before - delta);
    district.lastReason = String(reason || "Police response is downgraded.");
    district.updatedAt = this.now();
    this.state.lastReason = district.lastReason;
    if (district.value <= 0.1) delete this.state.districts[id];
    const after = this.valueFor(id);
    const levelAfter = heatLevelFromValue(after);
    const removed = before - after;
    this.emit(ATTENTION_EVENT_TYPES.HEAT_COOLED, {
      districtId: id,
      amount: removed,
      valueBefore: before,
      valueAfter: after,
      levelBefore,
      levelAfter,
      reason: district.lastReason,
      source: String(source || "system"),
      timestamp: district.updatedAt
    });
    if (levelAfter !== levelBefore) {
      this.emit(ATTENTION_EVENT_TYPES.HEAT_WANTED_CHANGED, {
        districtId: id,
        levelBefore,
        levelAfter,
        value: after,
        reason: district.lastReason,
        timestamp: district.updatedAt
      });
    }
    if (persist) this.persist({ save: true });
    return removed;
  }

  forceLevel(level, reason = "Police response escalated.", options = {}) {
    const targetLevel = Math.max(0, Math.min(3, Math.trunc(finite(level))));
    const zone = options.districtId
      ? districtZones.find(item => item.id === options.districtId)
      : this.districtAt(
        Number.isFinite(options.x) ? options.x : this.scene.player?.x,
        Number.isFinite(options.y) ? options.y : this.scene.player?.y
      );
    const districtId = options.districtId || zone?.id || "district";
    const target = targetLevel <= 0 ? 0 : HEAT_LEVEL_THRESHOLDS[targetLevel];
    const before = this.valueFor(districtId);
    if (target <= before) return null;
    return this.addInDistrict(districtId, target - before, reason, {
      ...options,
      source: options.source || "forced_level"
    });
  }

  cool(dt, { multiplier = 1 } = {}) {
    const seconds = Math.max(0, finite(dt));
    if (!seconds || this.now() < this.coolingBlockedUntil) return 0;
    const beforeLevel = this.level();
    let cooled = 0;
    for (const [id, district] of Object.entries(this.state.districts)) {
      const before = Math.max(0, finite(district.value));
      if (!before) {
        delete this.state.districts[id];
        continue;
      }
      // Wanted 2/3 are sticky by design: only an explicit gameplay action may downgrade them.
      // Natural cooling is reserved for the final "lost the trail" transition from Wanted 1 to clear.
      if (heatLevelFromValue(before) !== 1) continue;
      const chasing = (this.scene.policeSystem?.police?.() || []).some(cop => cop.chasingPlayer);
      const rate = chasing ? 0.18 : 1.2;
      const after = Math.max(0, before - seconds * rate * Math.max(0, finite(multiplier, 1)));
      district.value = after;
      cooled += before - after;
      if (after <= 0.1) delete this.state.districts[id];
    }
    if (!cooled) return 0;

    this.persistTimer += seconds;
    const afterLevel = this.level();
    if (afterLevel !== beforeLevel) {
      this.emit(ATTENTION_EVENT_TYPES.HEAT_WANTED_CHANGED, {
        districtId: this.hottestZone()?.id || null,
        levelBefore: beforeLevel,
        levelAfter: afterLevel,
        value: this.maximum(),
        reason: "Police Heat cooled after losing the trail.",
        timestamp: this.now()
      });
      this.persist({ save: true });
      this.persistTimer = 0;
    } else if (this.persistTimer >= 2) {
      this.emit(ATTENTION_EVENT_TYPES.HEAT_COOLED, {
        amount: cooled,
        value: this.maximum(),
        level: afterLevel,
        timestamp: this.now()
      }, { campaign: false });
      this.persist({ save: false });
      this.persistTimer = 0;
    }
    return cooled;
  }

  clear(reason = "Police Heat cleared.") {
    const before = this.level();
    this.state = createHeatState();
    this.state.lastReason = reason;
    this.coolingBlockedUntil = 0;
    if (before > 0) {
      this.emit(ATTENTION_EVENT_TYPES.HEAT_WANTED_CHANGED, {
        districtId: null,
        levelBefore: before,
        levelAfter: 0,
        value: 0,
        reason,
        timestamp: this.now()
      });
    }
    this.persist({ save: true });
  }

  nextIncidentId() {
    this.state.sequence = Math.max(0, Math.trunc(finite(this.state.sequence))) + 1;
    return `heat-${String(this.state.sequence).padStart(6, "0")}`;
  }

  snapshot() {
    return clone(sanitizeHeatState(this.state));
  }

  restoreState(candidate) {
    const before = this.level();
    this.state = sanitizeHeatState(candidate);
    this.coolingBlockedUntil = 0;
    const after = this.level();
    this.lastPublishedLevel = after;
    if (after !== before) {
      this.scene.events?.emit?.(ATTENTION_EVENT_TYPES.HEAT_WANTED_CHANGED, {
        districtId: this.hottestZone()?.id || null,
        levelBefore: before,
        levelAfter: after,
        value: this.maximum(),
        reason: "Heat restored from persistent state.",
        timestamp: this.now()
      });
    }
    return this.snapshot();
  }

  recent(limit = 8) {
    return this.state.incidents.slice(-Math.max(0, Math.trunc(limit))).reverse().map(clone);
  }

  persist({ save = false } = {}) {
    const campaign = this.scene.campaignSystem;
    if (!campaign?.state) return false;
    campaign.state.heat = this.snapshot();
    campaign.touch?.();
    if (save && campaign.autoSave) campaign.save?.();
    return true;
  }

  emit(type, payload, { campaign = true } = {}) {
    this.scene.events?.emit?.(type, clone(payload));
    if (campaign && this.scene.campaignSystem?.events?.emit) {
      this.scene.campaignSystem.events.emit(type, payload);
    }
  }

  summary() {
    const hottest = this.hottestZone();
    const heat = hottest ? Math.round(this.valueFor(hottest.id)) : 0;
    return `Heat Lv ${this.level()} · ${hottest?.name || "no hot district"} ${heat}`;
  }

  installDiagnostics() {
    const root = typeof window !== "undefined" ? window : globalThis;
    const api = {
      snapshot: () => this.snapshot(),
      level: () => this.level(),
      hottest: () => {
        const zone = this.hottestZone();
        return zone ? { ...zone, heat: this.valueFor(zone.id) } : null;
      },
      add: options => this.add(
        options?.x ?? this.scene.player?.x,
        options?.y ?? this.scene.player?.y,
        options?.amount,
        options?.reason,
        options
      ),
      forceLevel: (level, reason, options = {}) => this.forceLevel(level, reason, options),
      clear: reason => this.clear(reason)
    };
    root.NBD_HEAT = api;
    this.diagnosticRoot = root;
    this.diagnosticApi = api;
  }

  destroy() {
    if (this.diagnosticRoot?.NBD_HEAT === this.diagnosticApi) delete this.diagnosticRoot.NBD_HEAT;
  }
}
