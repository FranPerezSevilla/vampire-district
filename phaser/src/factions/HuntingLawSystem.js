import { CAMPAIGN_EVENT_TYPES } from "../campaign/constants.js";
import { factionLabel } from "./FactionCatalog.js";
import {
  classifyHuntingFacts,
  HUNTING_CLASSIFICATION,
  HUNTING_DISCOVERY,
  MAX_HUNTING_ASSESSMENTS,
  protectionFromVictim,
  rightMatches,
  sanitizeHuntingAssessment,
  sanitizeHuntingDiscovery,
  sanitizeHuntingRight,
  sanitizeVictimProtection
} from "./HuntingLawModel.js";

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function identifier(value, label) {
  const id = String(value || "").trim();
  if (!id) throw new TypeError(`${label} id is required.`);
  return id;
}

function upper(value) {
  return String(value || "").trim().toUpperCase();
}

export class HuntingLawSystem {
  constructor(state, { events = null, territory = null, now = () => Date.now() } = {}) {
    if (!state?.huntingLaw) throw new TypeError("HuntingLawSystem requires campaign hunting-law state.");
    this.state = state;
    this.events = events;
    this.territory = territory;
    this.now = now;
  }

  nextId(kind) {
    const sequences = this.state.huntingLaw.sequences;
    sequences[kind] = Math.max(0, Number(sequences[kind]) || 0) + 1;
    const prefix = kind === "assessment" ? "hunt" : kind === "right" ? "right" : "protect";
    return `${prefix}-${String(sequences[kind]).padStart(6, "0")}`;
  }

  right(id) {
    const item = this.state.huntingLaw.rights[String(id || "").trim()];
    return item ? clone(item) : null;
  }

  activeRight({ districtId, ownerId, victimId, victimType } = {}) {
    const now = this.now();
    return Object.values(this.state.huntingLaw.rights)
      .filter(right => rightMatches(right, { districtId, ownerId, victimId, victimType, now }))
      .sort((left, right) => right.grantedAt - left.grantedAt || left.id.localeCompare(right.id))[0] || null;
  }

  grantRight(candidate = {}) {
    const districtId = identifier(candidate.districtId, "District");
    const district = this.territory?.district?.(districtId);
    if (!district) throw new RangeError(`Unknown district ${districtId}.`);
    const id = String(candidate.id || "").trim() || this.nextId("right");
    const right = sanitizeHuntingRight(id, {
      ...candidate,
      districtId,
      factionId: candidate.factionId || district.ownerId,
      grantedAt: candidate.grantedAt ?? this.now()
    }, { now: this.now() });
    if (!right.factionId) throw new TypeError("Hunting right requires a faction owner.");
    this.state.huntingLaw.rights[id] = right;
    this.events?.emit?.(CAMPAIGN_EVENT_TYPES.HUNTING_RIGHT_GRANTED, {
      rightId: id,
      districtId: right.districtId,
      factionId: right.factionId,
      source: right.source,
      referenceId: right.referenceId
    });
    return clone(right);
  }

  revokeRight(id, metadata = {}) {
    const key = identifier(id, "Hunting right");
    const right = this.state.huntingLaw.rights[key];
    if (!right || right.revokedAt > 0) return false;
    right.revokedAt = Math.max(0, Math.trunc(Number(this.now()) || 0));
    this.events?.emit?.(CAMPAIGN_EVENT_TYPES.HUNTING_RIGHT_REVOKED, {
      rightId: key,
      districtId: right.districtId,
      factionId: right.factionId,
      source: String(metadata.source || "unknown"),
      referenceId: metadata.referenceId == null ? null : String(metadata.referenceId)
    });
    return true;
  }

  protectVictim(candidate = {}) {
    const victimId = identifier(candidate.victimId, "Victim");
    const id = String(candidate.id || "").trim() || this.nextId("protection");
    const protection = sanitizeVictimProtection(id, {
      ...candidate,
      victimId,
      markedAt: candidate.markedAt ?? this.now()
    }, { now: this.now() });
    this.state.huntingLaw.protectedVictims[victimId] = protection;
    this.events?.emit?.(CAMPAIGN_EVENT_TYPES.HUNTING_VICTIM_PROTECTED, {
      protectionId: protection.id,
      victimId: protection.victimId,
      factionId: protection.factionId,
      contactId: protection.contactId,
      source: protection.source
    });
    return clone(protection);
  }

  unprotectVictim(victimId) {
    const key = identifier(victimId, "Victim");
    const protection = this.state.huntingLaw.protectedVictims[key];
    if (!protection || protection.revokedAt > 0) return false;
    protection.revokedAt = Math.max(0, Math.trunc(Number(this.now()) || 0));
    this.events?.emit?.(CAMPAIGN_EVENT_TYPES.HUNTING_VICTIM_UNPROTECTED, {
      protectionId: protection.id,
      victimId: protection.victimId,
      factionId: protection.factionId,
      contactId: protection.contactId
    });
    return true;
  }

  protection(victim) {
    const victimId = String(victim?.id || "").trim();
    return protectionFromVictim(victim, victimId ? this.state.huntingLaw.protectedVictims[victimId] : null);
  }

  assessFeed({
    districtId,
    victim = {},
    witnessCount = 0,
    bodyEvidence = false,
    biteEvidence = false,
    wantedLevel = 0,
    factionObserver = false,
    source = "feeding",
    eligibility = "legacy",
    layer = 0
  } = {}) {
    const districtKey = identifier(districtId, "District");
    const district = this.territory?.district?.(districtKey);
    if (!district) throw new RangeError(`Unknown district ${districtKey}.`);
    const victimId = identifier(victim.id, "Victim");
    const victimType = String(victim.type || "unknown").trim() || "unknown";
    const protection = this.protection(victim);
    const right = this.activeRight({
      districtId: districtKey,
      ownerId: district.ownerId,
      victimId,
      victimType
    });
    const decision = classifyHuntingFacts({
      district,
      victim: { ...victim, id: victimId, type: victimType },
      right,
      protection,
      witnessCount,
      bodyEvidence,
      biteEvidence,
      wantedLevel,
      factionObserver
    });
    const assessment = sanitizeHuntingAssessment({
      id: this.nextId("assessment"),
      timestamp: this.now(),
      districtId: district.id,
      districtName: district.name,
      ownerId: district.ownerId,
      ownerLabel: district.ownerLabel,
      territoryStatus: district.status,
      territoryRelationship: district.relationship,
      victimId,
      victimType,
      protectionId: protection?.id || null,
      protectedByFactionId: protection?.factionId || null,
      protectedByContactId: protection?.contactId || null,
      permissionId: right?.id || null,
      permissionSource: right?.source || null,
      ...decision,
      layer,
      source,
      eligibility
    });

    this.state.huntingLaw.assessments.push(assessment);
    if (this.state.huntingLaw.assessments.length > MAX_HUNTING_ASSESSMENTS) {
      const removed = this.state.huntingLaw.assessments.splice(0, this.state.huntingLaw.assessments.length - MAX_HUNTING_ASSESSMENTS);
      for (const item of removed) delete this.state.huntingLaw.discoveries[item.id];
    }
    this.recount();

    this.events?.emit?.(CAMPAIGN_EVENT_TYPES.HUNTING_ASSESSED, {
      assessmentId: assessment.id,
      districtId: assessment.districtId,
      ownerId: assessment.ownerId,
      victimId: assessment.victimId,
      classification: assessment.classification,
      politicalViolation: assessment.politicalViolation,
      discoveryState: assessment.discoveryState
    });

    if (assessment.discoveryState === HUNTING_DISCOVERY.KNOWN) {
      this.discover(assessment.id, {
        sources: assessment.evidenceSources.filter(sourceId => ["direct_witness", "faction_observer", "protected_marker"].includes(sourceId)),
        referenceId: assessment.victimId
      });
    }
    if (assessment.classification === HUNTING_CLASSIFICATION.PROTECTED) {
      this.events?.emit?.(CAMPAIGN_EVENT_TYPES.HUNTING_PROTECTED_VICTIM_HARMED, {
        assessmentId: assessment.id,
        districtId: assessment.districtId,
        ownerId: assessment.ownerId,
        victimId: assessment.victimId,
        protectedByFactionId: assessment.protectedByFactionId,
        protectedByContactId: assessment.protectedByContactId
      });
    }
    return this.describe(assessment);
  }

  discover(assessmentId, { sources = [], source = null, witnessId = null, referenceId = null } = {}) {
    const key = identifier(assessmentId, "Assessment");
    const assessment = this.state.huntingLaw.assessments.find(item => item.id === key);
    if (!assessment) return null;
    const sourceIds = [...new Set([...(Array.isArray(sources) ? sources : []), source]
      .map(value => String(value || "").trim())
      .filter(Boolean))];
    const existing = this.state.huntingLaw.discoveries[key];
    if (existing) {
      existing.sources = [...new Set([...existing.sources, ...sourceIds])];
      if (!existing.witnessId && witnessId) existing.witnessId = String(witnessId);
      if (!existing.referenceId && referenceId) existing.referenceId = String(referenceId);
      this.recount();
      return clone(existing);
    }
    const discovery = sanitizeHuntingDiscovery(key, {
      assessmentId: key,
      discoveredAt: this.now(),
      sources: sourceIds,
      witnessId,
      referenceId
    }, { now: this.now() });
    this.state.huntingLaw.discoveries[key] = discovery;
    this.recount();
    if (assessment.politicalViolation) {
      this.events?.emit?.(CAMPAIGN_EVENT_TYPES.HUNTING_VIOLATION_DISCOVERED, {
        assessmentId: assessment.id,
        districtId: assessment.districtId,
        ownerId: assessment.ownerId,
        victimId: assessment.victimId,
        classification: assessment.classification,
        discoverySource: discovery.sources[0] || "unknown",
        witnessId: discovery.witnessId
      });
    }
    return clone(discovery);
  }

  assessment(id) {
    const item = this.state.huntingLaw.assessments.find(candidate => candidate.id === String(id || "").trim());
    return item ? this.describe(item) : null;
  }

  lastAssessment() {
    const item = this.state.huntingLaw.assessments.at(-1);
    return item ? this.describe(item) : null;
  }

  describe(assessment) {
    const discovery = this.state.huntingLaw.discoveries[assessment.id] || null;
    return {
      ...clone(assessment),
      discovery: clone(discovery),
      currentDiscoveryState: discovery ? HUNTING_DISCOVERY.KNOWN : assessment.discoveryState,
      notice: this.notice(assessment)
    };
  }

  notice(assessment) {
    if (!assessment) return "";
    if (assessment.classification === HUNTING_CLASSIFICATION.PROTECTED) {
      const authority = assessment.protectedByFactionId
        ? factionLabel(assessment.protectedByFactionId)
        : assessment.ownerLabel || "protected authority";
      return `PROTECTED PREY · ${upper(authority)}`;
    }
    if (assessment.classification === HUNTING_CLASSIFICATION.POACHING) {
      return `POACHING · ${upper(assessment.ownerLabel || "CLAIMED")} TERRITORY`;
    }
    if (assessment.classification === HUNTING_CLASSIFICATION.TOLERATED) {
      return `FEEDING TOLERATED · ${upper(assessment.districtName)}`;
    }
    return "";
  }

  recount() {
    const counters = {
      total: this.state.huntingLaw.assessments.length,
      legal: 0,
      tolerated: 0,
      poaching: 0,
      protected: 0,
      unclaimed: 0,
      exempt: 0,
      knownViolations: 0
    };
    for (const assessment of this.state.huntingLaw.assessments) {
      if (assessment.classification in counters) counters[assessment.classification]++;
      if (assessment.politicalViolation && this.state.huntingLaw.discoveries[assessment.id]) counters.knownViolations++;
    }
    this.state.huntingLaw.counters = counters;
    return counters;
  }

  snapshot() {
    return {
      version: this.state.huntingLaw.version,
      counters: clone(this.recount()),
      rights: clone(this.state.huntingLaw.rights),
      protectedVictims: clone(this.state.huntingLaw.protectedVictims),
      assessments: this.state.huntingLaw.assessments.map(item => this.describe(item)),
      lastAssessment: this.lastAssessment()
    };
  }

  summary() {
    const counters = this.recount();
    return `Hunts ${counters.total} · poaching ${counters.poaching} · protected ${counters.protected} · known ${counters.knownViolations}`;
  }
}
