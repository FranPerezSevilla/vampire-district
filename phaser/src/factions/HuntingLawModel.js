import { CAMPAIGN_FACTIONS } from "../campaign/constants.js";

export const HUNTING_LAW_STATE_VERSION = 2;
export const MAX_HUNTING_ASSESSMENTS = 64;

export const HUNTING_CLASSIFICATION = Object.freeze({
  LEGAL: "legal",
  TOLERATED: "tolerated",
  POACHING: "poaching",
  PROTECTED: "protected",
  UNCLAIMED: "unclaimed",
  EXEMPT: "exempt"
});

export const HUNTING_DISCOVERY = Object.freeze({
  KNOWN: "known",
  LATENT: "latent",
  UNDISCOVERED: "undiscovered"
});

const CLASSIFICATIONS = new Set(Object.values(HUNTING_CLASSIFICATION));
const DISCOVERY_STATES = new Set(Object.values(HUNTING_DISCOVERY));

function plain(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function integer(value, fallback = 0) {
  return Math.max(0, Math.trunc(finite(value, fallback)));
}

function text(value, fallback = "") {
  const result = String(value ?? fallback).trim();
  return result || String(fallback || "");
}

function strings(values = []) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(value => text(value))
    .filter(Boolean))];
}

function classification(value) {
  const id = text(value);
  return CLASSIFICATIONS.has(id) ? id : HUNTING_CLASSIFICATION.UNCLAIMED;
}

function discoveryState(value) {
  const id = text(value);
  return DISCOVERY_STATES.has(id) ? id : HUNTING_DISCOVERY.UNDISCOVERED;
}

function countersFor(assessments, discoveries) {
  const counters = {
    total: assessments.length,
    legal: 0,
    tolerated: 0,
    poaching: 0,
    protected: 0,
    unclaimed: 0,
    exempt: 0,
    knownViolations: 0
  };
  for (const assessment of assessments) {
    if (assessment.classification in counters) counters[assessment.classification]++;
    if (assessment.politicalViolation && discoveries[assessment.id]) counters.knownViolations++;
  }
  return counters;
}

export function createHuntingLawState() {
  return {
    version: HUNTING_LAW_STATE_VERSION,
    sequences: { assessment: 0, right: 0, protection: 0 },
    rights: {},
    protectedVictims: {},
    assessments: [],
    discoveries: {},
    counters: countersFor([], {})
  };
}

export function sanitizeHuntingRight(id, candidate, { now = 0 } = {}) {
  const source = plain(candidate);
  return {
    id: text(id || source.id),
    districtId: text(source.districtId),
    factionId: text(source.factionId),
    victimIds: strings(source.victimIds),
    victimTypes: strings(source.victimTypes),
    source: text(source.source, "unknown"),
    referenceId: source.referenceId == null ? null : text(source.referenceId),
    grantedAt: integer(source.grantedAt, now),
    expiresAt: integer(source.expiresAt, 0),
    revokedAt: integer(source.revokedAt, 0)
  };
}

export function sanitizeVictimProtection(id, candidate, { now = 0 } = {}) {
  const source = plain(candidate);
  return {
    id: text(id || source.id),
    victimId: text(source.victimId || id),
    factionId: source.factionId == null ? null : text(source.factionId),
    contactId: source.contactId == null ? null : text(source.contactId),
    source: text(source.source, "unknown"),
    reason: text(source.reason),
    markedAt: integer(source.markedAt, now),
    revokedAt: integer(source.revokedAt, 0)
  };
}

export function sanitizeHuntingAssessment(candidate) {
  const source = plain(candidate);
  return {
    id: text(source.id),
    timestamp: integer(source.timestamp, 0),
    districtId: text(source.districtId),
    districtName: text(source.districtName),
    ownerId: source.ownerId == null ? null : text(source.ownerId),
    ownerLabel: source.ownerLabel == null ? null : text(source.ownerLabel),
    territoryStatus: text(source.territoryStatus, "independent"),
    territoryRelationship: text(source.territoryRelationship, "neutral"),
    victimId: text(source.victimId),
    victimType: text(source.victimType, "unknown"),
    feedingDepth: text(source.feedingDepth, "drain"),
    victimOutcome: text(source.victimOutcome, "dead"),
    victimAlive: Boolean(source.victimAlive),
    victimConscious: Boolean(source.victimConscious),
    memoryState: text(source.memoryState, "none"),
    protectionId: source.protectionId == null ? null : text(source.protectionId),
    protectedByFactionId: source.protectedByFactionId == null ? null : text(source.protectedByFactionId),
    protectedByContactId: source.protectedByContactId == null ? null : text(source.protectedByContactId),
    permissionId: source.permissionId == null ? null : text(source.permissionId),
    permissionSource: source.permissionSource == null ? null : text(source.permissionSource),
    classification: classification(source.classification),
    politicalViolation: Boolean(source.politicalViolation),
    discoveryState: discoveryState(source.discoveryState),
    evidenceSources: strings(source.evidenceSources),
    witnessCount: integer(source.witnessCount, 0),
    bodyEvidence: Boolean(source.bodyEvidence),
    biteEvidence: Boolean(source.biteEvidence),
    wantedLevel: integer(source.wantedLevel, 0),
    layer: Math.trunc(finite(source.layer, 0)),
    source: text(source.source, "feeding"),
    eligibility: text(source.eligibility, "legacy")
  };
}

export function sanitizeHuntingDiscovery(id, candidate, { now = 0 } = {}) {
  const source = plain(candidate);
  return {
    assessmentId: text(source.assessmentId || id),
    discoveredAt: integer(source.discoveredAt, now),
    sources: strings(source.sources),
    witnessId: source.witnessId == null ? null : text(source.witnessId),
    referenceId: source.referenceId == null ? null : text(source.referenceId)
  };
}

export function sanitizeHuntingLawState(candidate, { now = 0 } = {}) {
  const source = plain(candidate);
  const rights = Object.fromEntries(Object.entries(plain(source.rights))
    .map(([id, value]) => [id, sanitizeHuntingRight(id, value, { now })])
    .filter(([, value]) => value.id && value.districtId));
  const protectedVictims = Object.fromEntries(Object.entries(plain(source.protectedVictims))
    .map(([id, value]) => [id, sanitizeVictimProtection(id, value, { now })])
    .filter(([, value]) => value.id && value.victimId));
  const assessments = (Array.isArray(source.assessments) ? source.assessments : [])
    .map(sanitizeHuntingAssessment)
    .filter(item => item.id && item.victimId)
    .slice(-MAX_HUNTING_ASSESSMENTS);
  const validIds = new Set(assessments.map(item => item.id));
  const discoveries = Object.fromEntries(Object.entries(plain(source.discoveries))
    .map(([id, value]) => [id, sanitizeHuntingDiscovery(id, value, { now })])
    .filter(([id, value]) => validIds.has(id) && value.assessmentId === id));
  const sequenceSource = plain(source.sequences);
  return {
    version: HUNTING_LAW_STATE_VERSION,
    sequences: {
      assessment: integer(sequenceSource.assessment, assessments.length),
      right: integer(sequenceSource.right, Object.keys(rights).length),
      protection: integer(sequenceSource.protection, Object.keys(protectedVictims).length)
    },
    rights,
    protectedVictims,
    assessments,
    discoveries,
    counters: countersFor(assessments, discoveries)
  };
}

export function rightIsActive(right, { now = 0 } = {}) {
  if (!right || right.revokedAt > 0) return false;
  return !(right.expiresAt > 0 && right.expiresAt <= integer(now, 0));
}

export function rightMatches(right, { districtId, ownerId, victimId, victimType, now = 0 } = {}) {
  if (!rightIsActive(right, { now })) return false;
  if (right.districtId !== text(districtId)) return false;
  if (right.factionId && ownerId && right.factionId !== ownerId) return false;
  if (right.victimIds.length && !right.victimIds.includes(text(victimId))) return false;
  if (right.victimTypes.length && !right.victimTypes.includes(text(victimType))) return false;
  return true;
}

export function protectionFromVictim(victim = {}, persisted = null) {
  if (persisted && !persisted.revokedAt) return persisted;
  const source = plain(victim);
  const factionId = source.protectedByFactionId || plain(source.huntingProtection).factionId;
  const contactId = source.protectedByContactId || plain(source.huntingProtection).contactId;
  const reason = source.huntingProtectionReason || plain(source.huntingProtection).reason;
  if (!factionId && !contactId && !source.huntingProtected) return null;
  return sanitizeVictimProtection(`runtime:${text(source.id, "victim")}`, {
    victimId: source.id,
    factionId,
    contactId,
    source: "victim-metadata",
    reason
  });
}

function ownerTolerates(ownerId, relationship, facts) {
  const quiet = facts.witnessCount <= 0;
  if (ownerId === CAMPAIGN_FACTIONS.FIRST_ESTATE) {
    return relationship === "welcome" && quiet && !facts.bodyEvidence && facts.wantedLevel === 0;
  }
  if (ownerId === CAMPAIGN_FACTIONS.GUTTER_CROWN) {
    return ["tolerated", "welcome"].includes(relationship) && quiet && facts.wantedLevel <= 1;
  }
  return ["tolerated", "welcome"].includes(relationship) && quiet;
}

export function classifyHuntingFacts({
  district = null,
  victim = {},
  right = null,
  protection = null,
  witnessCount = 0,
  bodyEvidence = false,
  biteEvidence = false,
  wantedLevel = 0,
  factionObserver = false
} = {}) {
  const facts = {
    witnessCount: integer(witnessCount, 0),
    bodyEvidence: Boolean(bodyEvidence),
    biteEvidence: Boolean(biteEvidence),
    wantedLevel: integer(wantedLevel, 0),
    factionObserver: Boolean(factionObserver)
  };
  const victimType = text(victim?.type, "unknown");
  let result = HUNTING_CLASSIFICATION.UNCLAIMED;
  if (victimType === "rat") result = HUNTING_CLASSIFICATION.EXEMPT;
  else if (protection) result = HUNTING_CLASSIFICATION.PROTECTED;
  else if (!district?.ownerId || district.status !== "controlled") result = HUNTING_CLASSIFICATION.UNCLAIMED;
  else if (right) result = HUNTING_CLASSIFICATION.LEGAL;
  else if (ownerTolerates(district.ownerId, district.relationship, facts)) result = HUNTING_CLASSIFICATION.TOLERATED;
  else result = HUNTING_CLASSIFICATION.POACHING;

  const knownSources = [];
  if (facts.witnessCount > 0) knownSources.push("direct_witness");
  if (facts.factionObserver) knownSources.push("faction_observer");
  if (protection) knownSources.push("protected_marker");
  const latentSources = [];
  if (facts.bodyEvidence) latentSources.push("body_evidence");
  if (facts.biteEvidence) latentSources.push("bite_evidence");
  const discovery = knownSources.length
    ? HUNTING_DISCOVERY.KNOWN
    : latentSources.length
      ? HUNTING_DISCOVERY.LATENT
      : HUNTING_DISCOVERY.UNDISCOVERED;

  return {
    classification: result,
    politicalViolation: [HUNTING_CLASSIFICATION.POACHING, HUNTING_CLASSIFICATION.PROTECTED].includes(result),
    discoveryState: discovery,
    evidenceSources: [...knownSources, ...latentSources],
    ...facts
  };
}
