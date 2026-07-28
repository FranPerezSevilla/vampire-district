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
    detail: `${assessment.districtName || titleCase(assessment.districtId)} · ${authority}`,
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
  const police = plain(policeState);
  const level = Math.max(0, Math.trunc(number(police.level)));
  const severity = knownViolations.length > 0 || level >= 2
    ? "danger"
    : latentViolations.length > 0 || level >= 1
      ? "warning"
      : "stable";
  const alertCount = knownViolations.length + latentViolations.length + (level > 0 ? 1 : 0);
  const incidents = [
    ...(level > 0 ? [{
      id: "police-current",
      timestamp: now,
      timeLabel: "ACTIVE",
      kind: "police",
      severity: level >= 2 ? "danger" : "warning",
      title: `POLICE ${wantedLabel(level)}`,
      detail: text(police.lastReason, text(police.summary, "Police pressure active")),
      status: "ACTIVE"
    }] : []),
    ...assessments.map(assessment => incidentFromAssessment(assessment, huntingLaw, now)).filter(Boolean),
    ...eventIncidents(snapshot?.state?.eventLog, snapshot.territory, now)
  ]
    .sort((left, right) => right.timestamp - left.timestamp || String(right.id).localeCompare(String(left.id)))
    .slice(0, 8);

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
      exposureValue: clamp(police.exposureValue, 0, number(police.exposureMax, 125)),
      exposureMax: Math.max(1, number(police.exposureMax, 125)),
      exposurePercent: clamp((number(police.exposureValue) / Math.max(1, number(police.exposureMax, 125))) * 100, 0, 100),
      lastReason: text(police.lastReason, "No active police escalation."),
      summary: text(police.summary, "Police status unavailable"),
      footOfficers: Math.max(0, Math.trunc(number(police.footOfficers))),
      chasingOfficers: Math.max(0, Math.trunc(number(police.chasingOfficers))),
      searchingOfficers: Math.max(0, Math.trunc(number(police.searchingOfficers))),
      motorizedUnits: Math.max(0, Math.trunc(number(police.motorizedUnits))),
      desiredMotorizedUnits: Math.max(0, Math.trunc(number(police.desiredMotorizedUnits))),
      fleeingWitnesses: Math.max(0, Math.trunc(number(police.fleeingWitnesses))),
      witnessReports: Math.max(0, Math.trunc(number(police.witnessReports))),
      veilRiskWitnesses: Math.max(0, Math.trunc(number(police.veilRiskWitnesses))),
      bodiesDiscovered: Math.max(0, Math.trunc(number(police.bodiesDiscovered))),
      bodiesHidden: Math.max(0, Math.trunc(number(police.bodiesHidden))),
      bloodEvidence: Math.max(0, Math.trunc(number(police.bloodEvidence))),
      hottestZoneName: text(police.hottestZoneName, "No hot zone"),
      hottestZoneHeat: Math.max(0, Math.round(number(police.hottestZoneHeat))),
      hunterSummary: text(police.hunterSummary, "Hunters dormant")
    },
    incidents
  };
}

export { wantedLabel };
