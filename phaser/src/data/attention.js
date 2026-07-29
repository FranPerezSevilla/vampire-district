export const MAX_DISTRICT_HEAT = 100;
export const MAX_EXPOSURE = 125;

export const HEAT_LEVEL_THRESHOLDS = Object.freeze({
  1: 18,
  2: 45,
  3: 75
});

export const KNOWLEDGE_STATES = Object.freeze({
  LATENT: "latent",
  REPORTED: "reported",
  INSTITUTIONAL: "institutional",
  RESOLVED: "resolved"
});

export const EVIDENCE_KINDS = Object.freeze({
  WITNESS_MEMORY: "witness_memory",
  BITE_MARKS: "bite_marks",
  DRAINED_BODY: "drained_body",
  UNCONSCIOUS_FEEDING_VICTIM: "unconscious_feeding_victim",
  BLOOD_PATTERN: "blood_pattern",
  VISIBLE_POWER_USE: "visible_power_use",
  LEGACY_EXPOSURE: "legacy_exposure"
});

export const ATTENTION_EVENT_TYPES = Object.freeze({
  HEAT_ADDED: "heat:added",
  HEAT_COOLED: "heat:cooled",
  HEAT_WANTED_CHANGED: "heat:wanted-changed",
  EVIDENCE_REGISTERED: "evidence:registered",
  EVIDENCE_DISCOVERED: "evidence:discovered",
  EVIDENCE_RESOLVED: "evidence:resolved",
  EXPOSURE_CHANGED: "exposure:changed"
});

const VALID_KNOWLEDGE_STATES = new Set(Object.values(KNOWLEDGE_STATES));
const VALID_EVIDENCE_KINDS = new Set(Object.values(EVIDENCE_KINDS));

function plain(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function finite(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function integer(value, fallback = 0) {
  return Math.trunc(finite(value, fallback));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function text(value, fallback = "") {
  const result = String(value ?? fallback).trim();
  return result || String(fallback || "");
}

function primitiveRecord(value) {
  const result = {};
  for (const [key, item] of Object.entries(plain(value))) {
    if (!key) continue;
    if (item == null || ["string", "number", "boolean"].includes(typeof item)) result[key] = item;
  }
  return result;
}

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(value => String(value || "").trim())
    .filter(Boolean))];
}

export function heatLevelFromValue(value) {
  const heat = clamp(value, 0, MAX_DISTRICT_HEAT);
  if (heat >= HEAT_LEVEL_THRESHOLDS[3]) return 3;
  if (heat >= HEAT_LEVEL_THRESHOLDS[2]) return 2;
  if (heat >= HEAT_LEVEL_THRESHOLDS[1]) return 1;
  return 0;
}

export function exposureLevelFromValue(value) {
  return Math.min(5, Math.floor(clamp(value, 0, MAX_EXPOSURE) / 25));
}

export function createHeatState() {
  return {
    version: 1,
    sequence: 0,
    districts: {},
    incidents: [],
    lastReason: "No active police Heat."
  };
}

function sanitizeHeatDistrict(value) {
  const source = plain(value);
  return {
    value: clamp(source.value, 0, MAX_DISTRICT_HEAT),
    lastReason: text(source.lastReason, "No active police Heat."),
    updatedAt: Math.max(0, integer(source.updatedAt, 0))
  };
}

function sanitizeHeatIncident(value) {
  const source = plain(value);
  const id = text(source.id);
  const districtId = text(source.districtId);
  if (!id || !districtId) return null;
  return {
    id,
    districtId,
    amount: clamp(source.amount, -MAX_DISTRICT_HEAT, MAX_DISTRICT_HEAT),
    valueBefore: clamp(source.valueBefore, 0, MAX_DISTRICT_HEAT),
    valueAfter: clamp(source.valueAfter, 0, MAX_DISTRICT_HEAT),
    levelBefore: Math.max(0, Math.min(3, integer(source.levelBefore, 0))),
    levelAfter: Math.max(0, Math.min(3, integer(source.levelAfter, 0))),
    reason: text(source.reason, "Police Heat changed."),
    source: text(source.source, "system"),
    timestamp: Math.max(0, integer(source.timestamp, 0))
  };
}

export function sanitizeHeatState(candidate) {
  const source = plain(candidate);
  const districts = {};
  const rawDistricts = plain(source.districts || source.localHeat || source.local);
  for (const [id, value] of Object.entries(rawDistricts)) {
    const key = text(id);
    if (!key) continue;
    const district = typeof value === "number"
      ? sanitizeHeatDistrict({ value })
      : sanitizeHeatDistrict(value);
    if (district.value > 0.001) districts[key] = district;
  }
  const incidents = (Array.isArray(source.incidents) ? source.incidents : [])
    .map(sanitizeHeatIncident)
    .filter(Boolean)
    .slice(-64);
  const sequenceFromIds = incidents.reduce((max, incident) => {
    const parsed = Number(String(incident.id).match(/(\d+)$/)?.[1]) || 0;
    return Math.max(max, parsed);
  }, 0);
  return {
    version: 1,
    sequence: Math.max(sequenceFromIds, Math.max(0, integer(source.sequence, 0))),
    districts,
    incidents,
    lastReason: text(source.lastReason, incidents.at(-1)?.reason || "No active police Heat.")
  };
}

export function heatValueForDistrict(state, districtId) {
  const district = plain(plain(state).districts)[String(districtId || "")];
  return clamp(district?.value, 0, MAX_DISTRICT_HEAT);
}

export function maximumHeatValue(state) {
  return Math.max(0, ...Object.values(plain(plain(state).districts))
    .map(district => clamp(district?.value, 0, MAX_DISTRICT_HEAT)));
}

export function createExposureState() {
  return {
    version: 1,
    sequence: 0,
    records: {},
    lastReason: "No supernatural evidence is known."
  };
}

export function sanitizeEvidenceRecord(value, { id = "", now = 0 } = {}) {
  const source = plain(value);
  const recordId = text(source.id, id);
  if (!recordId) return null;
  const requestedState = text(source.knowledgeState, KNOWLEDGE_STATES.LATENT);
  const knowledgeState = VALID_KNOWLEDGE_STATES.has(requestedState)
    ? requestedState
    : KNOWLEDGE_STATES.LATENT;
  const kind = VALID_EVIDENCE_KINDS.has(source.kind)
    ? source.kind
    : EVIDENCE_KINDS.LEGACY_EXPOSURE;
  const createdAt = Math.max(0, integer(source.createdAt, now));
  const resolvedAt = knowledgeState === KNOWLEDGE_STATES.RESOLVED
    ? Math.max(createdAt, integer(source.resolvedAt, createdAt))
    : Math.max(0, integer(source.resolvedAt, 0));
  return {
    id: recordId,
    kind,
    districtId: text(source.districtId, "unknown"),
    layer: integer(source.layer, 0),
    sourceEvent: text(source.sourceEvent, "unknown"),
    subjectId: source.subjectId == null ? null : text(source.subjectId),
    createdAt,
    discoveredAt: Math.max(0, integer(source.discoveredAt, 0)),
    resolvedAt,
    exposureWeight: clamp(source.exposureWeight, 0, MAX_EXPOSURE),
    heatWeight: clamp(source.heatWeight, 0, MAX_DISTRICT_HEAT),
    knowledgeState,
    metadata: primitiveRecord(source.metadata),
    relatedEvidenceIds: uniqueStrings(source.relatedEvidenceIds)
  };
}

export function sanitizeExposureState(candidate, { legacyValue = 0, now = 0 } = {}) {
  const source = plain(candidate);
  const records = {};
  const rawRecords = source.records;
  if (Array.isArray(rawRecords)) {
    for (const item of rawRecords) {
      const record = sanitizeEvidenceRecord(item, { now });
      if (record) records[record.id] = record;
    }
  } else {
    for (const [id, item] of Object.entries(plain(rawRecords))) {
      const record = sanitizeEvidenceRecord(item, { id, now });
      if (record) records[record.id] = record;
    }
  }

  const legacy = clamp(
    typeof candidate === "number" ? candidate : legacyValue,
    0,
    MAX_EXPOSURE
  );
  if (legacy > 0 && !Object.values(records).some(record => record.kind === EVIDENCE_KINDS.LEGACY_EXPOSURE)) {
    const legacyId = "evidence-legacy-000001";
    records[legacyId] = sanitizeEvidenceRecord({
      id: legacyId,
      kind: EVIDENCE_KINDS.LEGACY_EXPOSURE,
      districtId: "unknown",
      layer: 0,
      sourceEvent: "legacy_scalar_migration",
      createdAt: Math.max(0, integer(now, 0)),
      discoveredAt: Math.max(0, integer(now, 0)),
      exposureWeight: legacy,
      heatWeight: 0,
      knowledgeState: KNOWLEDGE_STATES.INSTITUTIONAL,
      metadata: { explanation: "Migrated from the previous scalar Exposure value." }
    }, { now });
  }

  const sequenceFromIds = Object.keys(records).reduce((max, id) => {
    const parsed = Number(String(id).match(/(\d+)$/)?.[1]) || 0;
    return Math.max(max, parsed);
  }, 0);
  return {
    version: 1,
    sequence: Math.max(sequenceFromIds, Math.max(0, integer(source.sequence, 0))),
    records,
    lastReason: text(source.lastReason, "No supernatural evidence is known.")
  };
}

export function evidenceContributes(record) {
  if (!record || record.resolvedAt > 0 || record.knowledgeState === KNOWLEDGE_STATES.RESOLVED) return false;
  return [KNOWLEDGE_STATES.REPORTED, KNOWLEDGE_STATES.INSTITUTIONAL].includes(record.knowledgeState);
}

export function exposureValueFromState(state) {
  const total = Object.values(plain(plain(state).records))
    .filter(evidenceContributes)
    .reduce((sum, record) => sum + clamp(record.exposureWeight, 0, MAX_EXPOSURE), 0);
  return clamp(total, 0, MAX_EXPOSURE);
}

export function cloneAttentionState(value) {
  return JSON.parse(JSON.stringify(value));
}
