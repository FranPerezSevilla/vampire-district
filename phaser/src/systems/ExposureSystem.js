import { districtZoneAt } from "../data/district.js";
import {
  ATTENTION_EVENT_TYPES,
  EVIDENCE_KINDS,
  KNOWLEDGE_STATES,
  MAX_EXPOSURE,
  createExposureState,
  exposureLevelFromValue,
  exposureValueFromState,
  sanitizeExposureState
} from "../data/attention.js";

function finite(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(value => String(value || "").trim())
    .filter(Boolean))];
}

function labelForKind(kind) {
  return String(kind || "evidence").replaceAll("_", " ");
}

export class ExposureSystem {
  constructor(scene, { state = null } = {}) {
    this.scene = scene;
    this.state = sanitizeExposureState(state || createExposureState());
    this.installDiagnostics();
    scene.events?.once?.(globalThis.Phaser?.Scenes?.Events?.SHUTDOWN || "shutdown", this.destroy, this);
  }

  now() {
    return Math.max(0, Math.trunc(Date.now()));
  }

  get value() {
    return exposureValueFromState(this.state);
  }

  set value(next) {
    this.forceValue(next, "Compatibility Exposure assignment.");
  }

  get lastReason() {
    return this.state.lastReason;
  }

  set lastReason(value) {
    this.state.lastReason = String(value || "Exposure changed.");
  }

  level() {
    return exposureLevelFromValue(this.value);
  }

  districtAt(x = this.scene.player?.x || 0, y = this.scene.player?.y || 0) {
    return districtZoneAt(finite(x), finite(y))
      || { id: "unknown", name: "Unknown district" };
  }

  registerEvidence(input = {}, {
    emit = true,
    persist = true
  } = {}) {
    const before = this.value;
    const metadata = {
      ...(input.metadata && typeof input.metadata === "object" ? input.metadata : {})
    };
    if (input.dedupeKey) metadata.dedupeKey = String(input.dedupeKey);
    const dedupeKey = String(metadata.dedupeKey || "").trim();
    if (dedupeKey) {
      const existing = Object.values(this.state.records).find(record => (
        record.metadata?.dedupeKey === dedupeKey
        && record.knowledgeState !== KNOWLEDGE_STATES.RESOLVED
        && !(record.resolvedAt > 0)
      ));
      if (existing) return clone(existing);
    }

    const position = input.position || input;
    const district = input.districtId
      ? { id: String(input.districtId) }
      : this.districtAt(position.x, position.y);
    const timestamp = Math.max(0, Math.trunc(finite(input.createdAt, this.now())));
    const id = String(input.id || this.nextEvidenceId());
    const knowledgeState = Object.values(KNOWLEDGE_STATES).includes(input.knowledgeState)
      ? input.knowledgeState
      : KNOWLEDGE_STATES.LATENT;
    const record = {
      id,
      kind: Object.values(EVIDENCE_KINDS).includes(input.kind)
        ? input.kind
        : EVIDENCE_KINDS.LEGACY_EXPOSURE,
      districtId: district.id || "unknown",
      layer: Math.trunc(finite(input.layer, this.scene.currentLayer || 0)),
      sourceEvent: String(input.sourceEvent || "runtime"),
      subjectId: input.subjectId == null ? null : String(input.subjectId),
      createdAt: timestamp,
      discoveredAt: knowledgeState === KNOWLEDGE_STATES.LATENT ? 0 : Math.max(timestamp, Math.trunc(finite(input.discoveredAt, timestamp))),
      resolvedAt: knowledgeState === KNOWLEDGE_STATES.RESOLVED ? Math.max(timestamp, Math.trunc(finite(input.resolvedAt, timestamp))) : 0,
      exposureWeight: Math.max(0, Math.min(MAX_EXPOSURE, finite(input.exposureWeight))),
      heatWeight: Math.max(0, Math.min(100, finite(input.heatWeight))),
      knowledgeState,
      metadata,
      relatedEvidenceIds: uniqueStrings(input.relatedEvidenceIds)
    };
    this.state.records[id] = record;
    this.state.lastReason = String(input.reason || `${labelForKind(record.kind)} recorded.`);

    if (emit) this.emit(ATTENTION_EVENT_TYPES.EVIDENCE_REGISTERED, record);
    this.emitExposureChange(before, this.value, this.state.lastReason, emit);
    if (persist) this.persist({ save: true });
    return clone(record);
  }

  registerWitnessMemory(witness, {
    reason = "Witness saw something impossible.",
    sourceEvent = "witness_observed",
    subjectId = null,
    position = null,
    exposureWeight = 12,
    relatedEvidenceIds = []
  } = {}) {
    if (!witness?.id) return null;
    const point = position || witness;
    const record = this.registerEvidence({
      kind: EVIDENCE_KINDS.WITNESS_MEMORY,
      x: point.x,
      y: point.y,
      layer: witness.layer ?? this.scene.currentLayer,
      sourceEvent,
      subjectId: subjectId || witness.id,
      exposureWeight,
      heatWeight: 0,
      knowledgeState: KNOWLEDGE_STATES.LATENT,
      reason,
      dedupeKey: `witness:${witness.id}:${sourceEvent}:${subjectId || "event"}`,
      relatedEvidenceIds,
      metadata: {
        witnessId: witness.id,
        reason
      }
    });
    witness.exposureEvidenceIds = uniqueStrings([...(witness.exposureEvidenceIds || []), record?.id]);
    return record;
  }

  registerVisiblePowerUse({
    label = "visible power use",
    x = this.scene.player?.x || 0,
    y = this.scene.player?.y || 0,
    layer = this.scene.currentLayer || 0,
    subjectId = "player",
    exposureWeight = 10,
    knowledgeState = KNOWLEDGE_STATES.LATENT,
    witnessIds = []
  } = {}) {
    return this.registerEvidence({
      kind: EVIDENCE_KINDS.VISIBLE_POWER_USE,
      x,
      y,
      layer,
      sourceEvent: "visible_power_use",
      subjectId,
      exposureWeight,
      knowledgeState,
      reason: `${label} left a supernatural account.`,
      metadata: {
        label,
        witnessIds: uniqueStrings(witnessIds).join(",")
      }
    });
  }


  linkEvidence(id, relatedEvidenceIds = []) {
    const record = this.state.records[String(id || "")];
    if (!record) return null;
    record.relatedEvidenceIds = uniqueStrings([
      ...(record.relatedEvidenceIds || []),
      ...relatedEvidenceIds
    ]);
    this.persist({ save: false });
    return clone(record);
  }

  relatedEvidence(ids = []) {
    const result = [];
    const seen = new Set();
    const visit = id => {
      const key = String(id || "").trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      const record = this.state.records[key];
      if (!record) return;
      result.push(clone(record));
      for (const related of record.relatedEvidenceIds || []) visit(related);
    };
    for (const id of uniqueStrings(ids)) visit(id);
    return result;
  }

  discoverEvidence(id, {
    knowledgeState = KNOWLEDGE_STATES.REPORTED,
    reason = "Evidence was discovered.",
    source = "discovery",
    discoveredAt = this.now(),
    persist = true
  } = {}) {
    const record = this.state.records[String(id || "")];
    if (!record || record.knowledgeState === KNOWLEDGE_STATES.RESOLVED || record.resolvedAt > 0) return null;
    const targetState = knowledgeState === KNOWLEDGE_STATES.INSTITUTIONAL
      ? KNOWLEDGE_STATES.INSTITUTIONAL
      : KNOWLEDGE_STATES.REPORTED;
    const before = this.value;
    const ranks = {
      [KNOWLEDGE_STATES.LATENT]: 0,
      [KNOWLEDGE_STATES.REPORTED]: 1,
      [KNOWLEDGE_STATES.INSTITUTIONAL]: 2
    };
    if ((ranks[targetState] || 0) >= (ranks[record.knowledgeState] || 0)) record.knowledgeState = targetState;
    record.discoveredAt = Math.max(record.createdAt, Math.trunc(finite(discoveredAt, this.now())));
    record.metadata = {
      ...(record.metadata || {}),
      discoverySource: String(source || "discovery")
    };
    this.state.lastReason = String(reason || "Evidence was discovered.");
    this.emit(ATTENTION_EVENT_TYPES.EVIDENCE_DISCOVERED, {
      ...record,
      reason: this.state.lastReason,
      source
    });
    this.emitExposureChange(before, this.value, this.state.lastReason, true);
    if (persist) this.persist({ save: true });
    return clone(record);
  }

  discoverLinked(ids = [], options = {}) {
    const results = [];
    for (const id of uniqueStrings(ids)) {
      const record = this.discoverEvidence(id, { ...options, persist: false });
      if (record) results.push(record);
    }
    if (results.length) this.persist({ save: true });
    return results;
  }

  resolveEvidence(id, {
    reason = "Evidence was removed.",
    source = "cleanup",
    resolvedAt = this.now(),
    mundaneHeat = 0,
    onlyLatent = false,
    x = this.scene.player?.x || 0,
    y = this.scene.player?.y || 0,
    persist = true
  } = {}) {
    const record = this.state.records[String(id || "")];
    if (!record || record.knowledgeState === KNOWLEDGE_STATES.RESOLVED || record.resolvedAt > 0) return null;
    if (onlyLatent && record.knowledgeState !== KNOWLEDGE_STATES.LATENT) return null;
    const before = this.value;
    record.knowledgeState = KNOWLEDGE_STATES.RESOLVED;
    record.resolvedAt = Math.max(record.createdAt, Math.trunc(finite(resolvedAt, this.now())));
    record.metadata = {
      ...(record.metadata || {}),
      resolutionSource: String(source || "cleanup"),
      resolutionReason: String(reason || "Evidence was removed.")
    };
    this.state.lastReason = String(reason || "Evidence was removed.");
    this.emit(ATTENTION_EVENT_TYPES.EVIDENCE_RESOLVED, {
      ...record,
      reason: this.state.lastReason,
      source
    });
    this.emitExposureChange(before, this.value, this.state.lastReason, true);
    if (finite(mundaneHeat) > 0) {
      const heatReason = `${reason} Police now read the scene as ordinary crime.`;
      if (this.scene.policeSystem?.addHeat) {
        this.scene.policeSystem.addHeat(x, y, finite(mundaneHeat), heatReason, { source: "crime_as_alibi" });
      } else {
        this.scene.heatSystem?.add?.(x, y, finite(mundaneHeat), heatReason, { source: "crime_as_alibi" });
      }
    }
    if (persist) this.persist({ save: true });
    return clone(record);
  }

  resolveLinked(ids = [], options = {}) {
    const results = [];
    for (const id of uniqueStrings(ids)) {
      const record = this.resolveEvidence(id, { ...options, persist: false });
      if (record) results.push(record);
    }
    if (results.length) this.persist({ save: true });
    return results;
  }

  recordsForSubject(subjectId, { activeOnly = false } = {}) {
    const id = String(subjectId || "");
    return Object.values(this.state.records)
      .filter(record => record.subjectId === id)
      .filter(record => !activeOnly || (record.knowledgeState !== KNOWLEDGE_STATES.RESOLVED && !(record.resolvedAt > 0)))
      .map(clone);
  }

  activeEvidence() {
    return Object.values(this.state.records)
      .filter(record => record.knowledgeState !== KNOWLEDGE_STATES.RESOLVED && !(record.resolvedAt > 0))
      .sort((left, right) => right.createdAt - left.createdAt || right.id.localeCompare(left.id))
      .map(clone);
  }

  knownEvidence() {
    return this.activeEvidence().filter(record => (
      record.knowledgeState === KNOWLEDGE_STATES.REPORTED
      || record.knowledgeState === KNOWLEDGE_STATES.INSTITUTIONAL
    ));
  }

  add(amount, reason = "Exposure rises.", options = {}) {
    const value = Math.max(0, finite(amount));
    if (!value) return null;
    return this.registerEvidence({
      kind: options.kind || EVIDENCE_KINDS.LEGACY_EXPOSURE,
      x: options.x ?? this.scene.player?.x,
      y: options.y ?? this.scene.player?.y,
      layer: options.layer ?? this.scene.currentLayer,
      sourceEvent: options.sourceEvent || "legacy_exposure_add",
      subjectId: options.subjectId || "player",
      exposureWeight: value,
      heatWeight: 0,
      knowledgeState: options.knowledgeState || KNOWLEDGE_STATES.INSTITUTIONAL,
      reason,
      metadata: {
        legacyAdapter: true,
        ...(options.metadata || {})
      }
    });
  }

  forceLevel(level, reason = "Exposure forced up.", options = {}) {
    const target = Math.max(0, Math.min(5, Math.trunc(finite(level)))) * 25;
    return this.forceValue(target, reason, options);
  }

  forceValue(target, reason = "Exposure changed.", options = {}) {
    const desired = Math.max(0, Math.min(MAX_EXPOSURE, finite(target)));
    const current = this.value;
    if (desired > current) return this.add(desired - current, reason, options);
    if (desired >= current) return null;

    let remaining = current - desired;
    const records = this.knownEvidence()
      .sort((left, right) => right.createdAt - left.createdAt || right.id.localeCompare(left.id));
    const resolved = [];
    for (const record of records) {
      if (remaining <= 0) break;
      const result = this.resolveEvidence(record.id, {
        reason,
        source: "compatibility_assignment",
        persist: false
      });
      if (result) {
        remaining -= result.exposureWeight;
        resolved.push(result);
      }
    }
    if (resolved.length) this.persist({ save: true });
    return resolved.at(-1) || null;
  }

  clear(reason = "Exposure evidence cleared.") {
    const before = this.value;
    const count = this.activeEvidence().length;
    this.state = createExposureState();
    this.state.lastReason = String(reason || "Exposure evidence cleared.");
    this.emitExposureChange(before, 0, this.state.lastReason, true);
    this.persist({ save: true });
    return count;
  }

  cool(_dt) {
    // Evidence does not disappear because the player entered a shadow or waited.
    return 0;
  }

  nextEvidenceId() {
    this.state.sequence = Math.max(0, Math.trunc(finite(this.state.sequence))) + 1;
    return `evidence-${String(this.state.sequence).padStart(6, "0")}`;
  }

  snapshot() {
    return clone(sanitizeExposureState(this.state));
  }

  restoreState(candidate) {
    const before = this.value;
    this.state = sanitizeExposureState(candidate, { now: this.now() });
    this.emitExposureChange(before, this.value, "Exposure restored from persistent evidence.", false);
    return this.snapshot();
  }

  persist({ save = false } = {}) {
    const campaign = this.scene.campaignSystem;
    if (!campaign?.state) return false;
    campaign.state.exposure = this.snapshot();
    campaign.touch?.();
    if (save && campaign.autoSave) campaign.save?.();
    return true;
  }

  emit(type, payload) {
    const copy = clone(payload);
    this.scene.events?.emit?.(type, copy);
    if (this.scene.campaignSystem?.events?.emit) this.scene.campaignSystem.events.emit(type, payload);
  }

  emitExposureChange(before, after, reason, emit = true) {
    if (Math.abs(after - before) < 0.001) return;
    if (emit) {
      this.emit(ATTENTION_EVENT_TYPES.EXPOSURE_CHANGED, {
        before,
        after,
        levelBefore: exposureLevelFromValue(before),
        levelAfter: exposureLevelFromValue(after),
        reason: String(reason || "Exposure changed."),
        timestamp: this.now()
      });
    }
  }

  summary() {
    const active = this.activeEvidence();
    const known = active.filter(record => record.knowledgeState !== KNOWLEDGE_STATES.LATENT);
    const latent = active.length - known.length;
    return `Exposure Lv ${this.level()} · ${Math.round(this.value)}/${MAX_EXPOSURE} · known ${known.length} · latent ${latent}`;
  }

  installDiagnostics() {
    const root = typeof window !== "undefined" ? window : globalThis;
    const api = {
      snapshot: () => this.snapshot(),
      activeEvidence: () => this.activeEvidence(),
      knownEvidence: () => this.knownEvidence(),
      register: input => this.registerEvidence(input),
      discover: (id, options = {}) => this.discoverEvidence(id, options),
      resolve: (id, options = {}) => this.resolveEvidence(id, options),
      clear: reason => this.clear(reason),
      link: (id, related = []) => this.linkEvidence(id, related),
      level: () => this.level(),
      value: () => this.value
    };
    root.NBD_EXPOSURE = api;
    this.diagnosticRoot = root;
    this.diagnosticApi = api;
  }

  destroy() {
    if (this.diagnosticRoot?.NBD_EXPOSURE === this.diagnosticApi) delete this.diagnosticRoot.NBD_EXPOSURE;
  }
}
