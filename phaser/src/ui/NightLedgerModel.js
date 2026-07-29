import { FACTION_CATALOG, MAJOR_FACTION_IDS } from "../factions/FactionCatalog.js";

const WANTED_LABELS = Object.freeze({
  0: "CLEAR",
  1: "SEARCH",
  2: "PURSUIT",
  3: "AIR SUPPORT"
});

const CLASSIFICATION_LABELS = Object.freeze({
  legal: "LEGAL FEED",
  tolerated: "FEEDING TOLERATED",
  poaching: "POACHING",
  protected: "PROTECTED PREY",
  unclaimed: "UNCLAIMED HUNT",
  exempt: "EXEMPT FEED"
});

const FEEDING_DEPTH_LABELS = Object.freeze({
  quick_bite: "QUICK BITE",
  full_feed: "FULL FEED",
  drain: "DRAIN"
});

const EVIDENCE_LABELS = Object.freeze({
  witness_memory: "WITNESS MEMORY",
  bite_marks: "BITE MARKS",
  drained_body: "DRAINED BODY",
  unconscious_feeding_victim: "UNCONSCIOUS VICTIM",
  blood_pattern: "BLOOD PATTERN",
  visible_power_use: "VISIBLE POWER USE",
  legacy_exposure: "LEGACY EXPOSURE"
});

function evidenceLabel(kind) {
  return EVIDENCE_LABELS[kind] || titleCase(kind || "evidence").toUpperCase();
}

function evidenceIncident(record, now) {
  if (!record) return null;
  const state = text(record.knowledgeState, "latent");
  const resolved = state === "resolved" || number(record.resolvedAt) > 0;
  return {
    id: `exposure:${record.id}`,
    timestamp: number(record.resolvedAt || record.discoveredAt || record.createdAt),
    timeLabel: incidentTimeLabel(record.resolvedAt || record.discoveredAt || record.createdAt, now),
    kind: "exposure",
    severity: resolved ? "stable" : state === "institutional" ? "danger" : state === "reported" ? "warning" : "stable",
    title: evidenceLabel(record.kind),
    detail: `${titleCase(record.districtId || "unknown")} · ${Math.round(number(record.exposureWeight))} exposure`,
    status: resolved ? "RESOLVED" : state.toUpperCase()
  };
}

function heatIncident(incident, now) {
  if (!incident) return null;
  const level = Math.max(0, Math.trunc(number(incident.levelAfter)));
  return {
    id: `heat:${incident.id}`,
    timestamp: number(incident.timestamp),
    timeLabel: incidentTimeLabel(incident.timestamp, now),
    kind: "heat",
    severity: level >= 2 ? "danger" : level >= 1 ? "warning" : "stable",
    title: incident.amount < 0 ? "HEAT COOLED" : "HEAT ADDED",
    detail: `${titleCase(incident.districtId)} · ${text(incident.reason, "Police attention changed")}`,
    status: `LEVEL ${level}`
  };
}

function plain(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, number(value, min)));
}

function text(value, fallback = "") {
  const result = String(value ?? fallback).trim();
  return result || String(fallback || "");
}

function titleCase(value) {
  return text(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function currentDiscoveryState(assessment, huntingLaw) {
  if (assessment?.currentDiscoveryState) return assessment.currentDiscoveryState;
  return plain(huntingLaw?.discoveries)[assessment?.id] ? "known" : text(assessment?.discoveryState, "undiscovered");
}

function activeRight(right, now) {
  if (!right || number(right.revokedAt) > 0) return false;
  const expiresAt = number(right.expiresAt);
  return !(expiresAt > 0 && expiresAt <= now);
}

function reputationEntry(snapshot, factionId) {
  const entry = plain(snapshot?.reputation?.factions)[factionId];
  const value = clamp(entry?.value, -100, 100);
  const tier = plain(entry?.tier);
  return {
    value,
    percent: clamp((value + 100) / 2, 0, 100),
    tierId: text(tier.id, "neutral"),
    tierLabel: text(tier.label, "Neutral")
  };
}

function wantedLabel(level) {
  const clamped = Math.max(0, Math.trunc(number(level)));
  return WANTED_LABELS[Math.min(3, clamped)] || WANTED_LABELS[3];
}

function incidentTimeLabel(timestamp, now) {
  const ageSeconds = Math.max(0, Math.floor((now - number(timestamp, now)) / 1000));
  if (ageSeconds < 15) return "NOW";
  if (ageSeconds < 60) return `${ageSeconds}s AGO`;
  const minutes = Math.floor(ageSeconds / 60);
  if (minutes < 60) return `${minutes}m AGO`;
  return `${Math.floor(minutes / 60)}h AGO`;
}

function incidentFromAssessment(assessment, huntingLaw, now) {
  if (!assessment || assessment.classification === "exempt") return null;
  const discoveryState = currentDiscoveryState(assessment, huntingLaw);
  const political = Boolean(assessment.politicalViolation);
  const severity = political && discoveryState === "known"
    ? "danger"
    : political
      ? "warning"
      : "stable";
  const authority = assessment.ownerLabel || (assessment.ownerId ? titleCase(assessment.ownerId) : "No claimant");
  const feedingDepth = FEEDING_DEPTH_LABELS[assessment.feedingDepth] || "FEEDING";
  const status = political
    ? discoveryState === "known"
      ? "DISCOVERED"
      : discoveryState === "latent"
        ? "HIDDEN"
        : "UNSEEN"
    : "RECORDED";
  return {
    id: assessment.id,
    timestamp: number(assessment.timestamp),
    timeLabel: incidentTimeLabel(assessment.timestamp, now),
    kind: "hunting",
    severity,
    title: CLASSIFICATION_LABELS[assessment.classification] || titleCase(assessment.classification),
    detail: `${feedingDepth} · ${assessment.districtName || titleCase(assessment.districtId)} · ${authority}`,
    status
  };
}

function eventIncidents(eventLog, territory, now) {
  const districts = plain(territory?.districts);
  return list(eventLog).flatMap(event => {
    const payload = plain(event.payload);
    if (event.type === "territory:owner-changed") {
      const district = districts[payload.districtId];
      const owner = payload.ownerAfter
        ? FACTION_CATALOG[payload.ownerAfter]?.name || titleCase(payload.ownerAfter)
        : titleCase(payload.statusAfter || "independent");
      return [{
        id: event.id,
        timestamp: number(event.timestamp),
        timeLabel: incidentTimeLabel(event.timestamp, now),
        kind: "territory",
        severity: "warning",
        title: "TERRITORY SHIFT",
        detail: `${district?.name || titleCase(payload.districtId)} · ${owner}`,
        status: "UPDATED"
      }];
    }
    if (event.type === "reputation:changed" && MAJOR_FACTION_IDS.includes(payload.id)) {
      const delta = number(payload.delta);
      return [{
        id: event.id,
        timestamp: number(event.timestamp),
        timeLabel: incidentTimeLabel(event.timestamp, now),
        kind: "reputation",
        severity: delta < 0 ? "warning" : "stable",
        title: delta < 0 ? "RELATION DAMAGED" : "RELATION IMPROVED",
        detail: `${FACTION_CATALOG[payload.id]?.name || titleCase(payload.id)} · ${delta > 0 ? "+" : ""}${delta}`,
        status: "RECORDED"
      }];
    }
    return [];
  });
}

function factionModel(snapshot, factionId, now) {
  const definition = FACTION_CATALOG[factionId] || {
    id: factionId,
    name: titleCase(factionId),
    shortLabel: titleCase(factionId),
    doctrine: ""
  };
  const territory = plain(snapshot?.territory);
  const districts = Object.values(plain(territory.districts));
  const huntingLaw = plain(snapshot?.huntingLaw);
  const assessments = list(huntingLaw.assessments).filter(assessment => (
    assessment.ownerId === factionId || assessment.protectedByFactionId === factionId
  ));
  const latentViolations = assessments.filter(assessment => (
    assessment.politicalViolation && currentDiscoveryState(assessment, huntingLaw) !== "known"
  ));
  const knownViolations = assessments.filter(assessment => (
    assessment.politicalViolation && currentDiscoveryState(assessment, huntingLaw) === "known"
  ));
  const rights = Object.values(plain(huntingLaw.rights))
    .filter(right => right.factionId === factionId && activeRight(right, now));
  const controlled = districts.filter(district => district.ownerId === factionId && district.status === "controlled");
  return {
    id: factionId,
    name: definition.name,
    shortLabel: definition.shortLabel,
    doctrine: definition.doctrine,
    identity: definition.identity,
    reputation: reputationEntry(snapshot, factionId),
    controlledDistrictCount: controlled.length,
    controlledDistrictNames: controlled.map(district => district.name),
    activeRightsCount: rights.length,
    activeRights: rights.map(right => ({
      id: right.id,
      districtId: right.districtId,
      districtName: plain(territory.districts)[right.districtId]?.name || titleCase(right.districtId),
      source: right.source
    })),
    latentViolationCount: latentViolations.length,
    knownViolationCount: knownViolations.length,
    protectedVictimCount: Object.values(plain(huntingLaw.protectedVictims))
      .filter(protection => protection.factionId === factionId && number(protection.revokedAt) <= 0)
      .length
  };
}

export function buildNightLedgerModel({
  campaignSnapshot = null,
  currentDistrict = null,
  policeState = null,
  now = Date.now()
} = {}) {
  const snapshot = plain(campaignSnapshot);
  const huntingLaw = plain(snapshot.huntingLaw);
  const assessments = list(huntingLaw.assessments);
  const politicalAssessments = assessments.filter(assessment => Boolean(assessment.politicalViolation));
  const knownViolations = politicalAssessments.filter(assessment => currentDiscoveryState(assessment, huntingLaw) === "known");
  const latentViolations = politicalAssessments.filter(assessment => currentDiscoveryState(assessment, huntingLaw) !== "known");
  const response = plain(policeState);
  const heatSnapshot = plain(response.heat);
  const exposureSnapshot = plain(response.exposure);
  const level = Math.max(0, Math.min(3, Math.trunc(number(response.level, number(heatSnapshot.level, 0)))));
  const heatMax = Math.max(1, number(heatSnapshot.max, 100));
  const heatValue = clamp(number(heatSnapshot.value, number(response.hottestZoneHeat, 0)), 0, heatMax);
  const rawEvidence = exposureSnapshot.records && !Array.isArray(exposureSnapshot.records)
    ? Object.values(plain(exposureSnapshot.records))
    : list(exposureSnapshot.records || response.evidenceRecords);
  const activeEvidence = rawEvidence.filter(record => text(record.knowledgeState, "latent") !== "resolved" && !(number(record.resolvedAt) > 0));
  const knownEvidence = activeEvidence.filter(record => ["reported", "institutional"].includes(text(record.knowledgeState)));
  const latentEvidence = activeEvidence.filter(record => text(record.knowledgeState, "latent") === "latent");
  const exposureMax = Math.max(1, number(exposureSnapshot.max, response.exposureMax || 125));
  const exposureValue = clamp(number(exposureSnapshot.value, number(response.exposureValue, 0)), 0, exposureMax);
  const exposureLevel = Math.max(0, Math.min(5, Math.trunc(number(exposureSnapshot.level, Math.floor(exposureValue / 25)))));

  const severity = knownViolations.length > 0 || level >= 2 || exposureLevel >= 3
    ? "danger"
    : latentViolations.length > 0 || level >= 1 || exposureValue > 0 || latentEvidence.length > 0
      ? "warning"
      : "stable";
  const alertCount = knownViolations.length
    + latentViolations.length
    + (level > 0 ? 1 : 0)
    + knownEvidence.length
    + (latentEvidence.length > 0 ? 1 : 0);

  const incidents = [
    ...(level > 0 ? [{
      id: "police-current",
      timestamp: now,
      timeLabel: "ACTIVE",
      kind: "police",
      severity: level >= 2 ? "danger" : "warning",
      title: `POLICE ${wantedLabel(level)}`,
      detail: text(heatSnapshot.lastReason, text(response.lastReason, text(response.summary, "Police pressure active"))),
      status: "ACTIVE"
    }] : []),
    ...list(heatSnapshot.incidents || response.heatIncidents).map(incident => heatIncident(incident, now)).filter(Boolean),
    ...rawEvidence.map(record => evidenceIncident(record, now)).filter(Boolean),
    ...assessments.map(assessment => incidentFromAssessment(assessment, huntingLaw, now)).filter(Boolean),
    ...eventIncidents(snapshot?.state?.eventLog, snapshot.territory, now)
  ]
    .sort((left, right) => right.timestamp - left.timestamp || String(right.id).localeCompare(String(left.id)))
    .slice(0, 10);

  const evidenceByKind = {};
  for (const record of activeEvidence) {
    evidenceByKind[record.kind] = (evidenceByKind[record.kind] || 0) + 1;
  }
  const contactEntries = Object.entries(plain(snapshot?.reputation?.contacts));
  return {
    ready: Boolean(campaignSnapshot),
    severity,
    alertCount,
    latentViolationCount: latentViolations.length,
    knownViolationCount: knownViolations.length,
    currentDistrict: currentDistrict ? {
      id: currentDistrict.id,
      name: currentDistrict.name,
      ownerId: currentDistrict.ownerId,
      ownerLabel: currentDistrict.ownerLabel,
      status: currentDistrict.status,
      relationship: currentDistrict.relationship
    } : null,
    factions: MAJOR_FACTION_IDS.map(id => factionModel(snapshot, id, now)),
    independentHouses: {
      contactCount: contactEntries.length,
      contacts: contactEntries.map(([id, entry]) => ({
        id,
        name: titleCase(id),
        value: number(entry?.value),
        tierLabel: text(entry?.tier?.label, "Neutral")
      }))
    },
    police: {
      level,
      stateLabel: wantedLabel(level),
      heatValue,
      heatMax,
      heatPercent: clamp((heatValue / heatMax) * 100, 0, 100),
      lastReason: text(heatSnapshot.lastReason, text(response.lastReason, "No active police escalation.")),
      summary: text(response.summary, "Police status unavailable"),
      footOfficers: Math.max(0, Math.trunc(number(response.footOfficers))),
      chasingOfficers: Math.max(0, Math.trunc(number(response.chasingOfficers))),
      searchingOfficers: Math.max(0, Math.trunc(number(response.searchingOfficers))),
      motorizedUnits: Math.max(0, Math.trunc(number(response.motorizedUnits))),
      desiredMotorizedUnits: Math.max(0, Math.trunc(number(response.desiredMotorizedUnits))),
      fleeingWitnesses: Math.max(0, Math.trunc(number(response.fleeingWitnesses))),
      witnessReports: Math.max(0, Math.trunc(number(response.witnessReports))),
      hottestZoneName: text(heatSnapshot.hottestZoneName, text(response.hottestZoneName, "No hot zone")),
      hottestZoneHeat: Math.max(0, Math.round(number(heatSnapshot.hottestZoneHeat, number(response.hottestZoneHeat, 0)))),
      recentIncidents: list(heatSnapshot.incidents || response.heatIncidents)
    },
    exposure: {
      level: exposureLevel,
      value: exposureValue,
      max: exposureMax,
      percent: clamp((exposureValue / exposureMax) * 100, 0, 100),
      lastReason: text(exposureSnapshot.lastReason, "No supernatural evidence is known."),
      activeCount: activeEvidence.length,
      knownCount: knownEvidence.length,
      latentCount: latentEvidence.length,
      institutionalCount: activeEvidence.filter(record => text(record.knowledgeState) === "institutional").length,
      records: activeEvidence
        .sort((left, right) => number(right.createdAt) - number(left.createdAt))
        .slice(0, 8)
        .map(record => ({
          id: record.id,
          kind: record.kind,
          label: evidenceLabel(record.kind),
          districtId: record.districtId,
          districtName: titleCase(record.districtId),
          state: text(record.knowledgeState, "latent"),
          weight: Math.round(number(record.exposureWeight)),
          sourceEvent: text(record.sourceEvent, "unknown")
        })),
      byKind: evidenceByKind,
      bodiesDiscovered: Math.max(0, Math.trunc(number(response.bodiesDiscovered))),
      bodiesHidden: Math.max(0, Math.trunc(number(response.bodiesHidden))),
      bloodEvidence: Math.max(0, Math.trunc(number(response.bloodEvidence))),
      hunterSummary: text(response.hunterSummary, "Hunters dormant")
    },
    incidents
  };
}

export { wantedLabel };
