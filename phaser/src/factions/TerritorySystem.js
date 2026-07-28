import { CAMPAIGN_EVENT_TYPES } from "../campaign/constants.js";
import { factionDefinition, factionLabel, MAJOR_FACTION_IDS } from "./FactionCatalog.js";
import {
  clampInfluence,
  deriveTerritoryControl,
  relationshipFromReputation,
  TERRITORY_DISTRICT_BY_ID,
  TERRITORY_DISTRICTS
} from "./TerritoryModel.js";

function identifier(value, label) {
  const id = String(value || "").trim();
  if (!id) throw new TypeError(`${label} id is required.`);
  return id;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class TerritorySystem {
  constructor(state, { events = null, reputation = null, now = () => Date.now() } = {}) {
    if (!state?.territory?.districts) throw new TypeError("TerritorySystem requires campaign territory state.");
    this.state = state;
    this.events = events;
    this.reputation = reputation;
    this.now = now;
  }

  definition(id) {
    return TERRITORY_DISTRICT_BY_ID[identifier(id, "District")] || null;
  }

  district(id) {
    const districtId = identifier(id, "District");
    const state = this.state.territory.districts[districtId];
    if (!state) return null;
    return this.describe(state);
  }

  describe(state) {
    const definition = TERRITORY_DISTRICT_BY_ID[state.id] || { id: state.id, name: state.id };
    const owner = state.ownerId ? factionDefinition(state.ownerId) : null;
    const reputation = owner ? this.reputation?.faction?.(owner.id) || 0 : 0;
    const relationship = owner ? relationshipFromReputation(reputation) : "neutral";
    return {
      ...clone(state),
      name: definition.name,
      owner: owner ? clone(owner) : null,
      ownerLabel: owner?.name || null,
      relationship,
      reputation,
      hostile: relationship === "hostile",
      restricted: relationship === "hostile" || relationship === "restricted"
    };
  }

  setInfluence(districtId, factionId, value, metadata = {}) {
    const districtKey = identifier(districtId, "District");
    const factionKey = identifier(factionId, "Faction");
    if (!TERRITORY_DISTRICT_BY_ID[districtKey]) throw new RangeError(`Unknown district ${districtKey}.`);
    if (!MAJOR_FACTION_IDS.includes(factionKey)) throw new RangeError(`Unknown major faction ${factionKey}.`);

    const state = this.state.territory.districts[districtKey];
    const before = this.describe(state);
    const beforeValue = Number(state.influence[factionKey]) || 0;
    const afterValue = clampInfluence(value);
    if (afterValue === beforeValue) {
      return { changed: false, district: before, factionId: factionKey, before: beforeValue, after: afterValue, delta: 0 };
    }

    state.influence[factionKey] = afterValue;
    const control = deriveTerritoryControl(state.influence);
    state.influence = control.influence;
    state.ownerId = control.ownerId;
    state.status = control.status;
    state.changedAt = Math.max(0, Math.trunc(Number(this.now()) || 0));
    state.changeCount = Math.max(0, Number(state.changeCount) || 0) + 1;

    const after = this.describe(state);
    const result = {
      changed: true,
      districtId: districtKey,
      districtName: after.name,
      factionId: factionKey,
      factionName: factionLabel(factionKey),
      before: beforeValue,
      after: afterValue,
      delta: afterValue - beforeValue,
      ownerBefore: before.ownerId,
      ownerAfter: after.ownerId,
      statusBefore: before.status,
      statusAfter: after.status,
      reason: String(metadata.reason || ""),
      source: String(metadata.source || "unknown"),
      referenceId: metadata.referenceId == null ? null : String(metadata.referenceId),
      district: after
    };

    this.events?.emit?.(CAMPAIGN_EVENT_TYPES.TERRITORY_INFLUENCE_CHANGED, {
      districtId: result.districtId,
      factionId: result.factionId,
      before: result.before,
      after: result.after,
      delta: result.delta,
      ownerBefore: result.ownerBefore,
      ownerAfter: result.ownerAfter,
      statusBefore: result.statusBefore,
      statusAfter: result.statusAfter,
      reason: result.reason,
      source: result.source,
      referenceId: result.referenceId
    });

    if (result.ownerBefore !== result.ownerAfter || result.statusBefore !== result.statusAfter) {
      this.events?.emit?.(CAMPAIGN_EVENT_TYPES.TERRITORY_OWNER_CHANGED, {
        districtId: result.districtId,
        ownerBefore: result.ownerBefore,
        ownerAfter: result.ownerAfter,
        statusBefore: result.statusBefore,
        statusAfter: result.statusAfter,
        source: result.source,
        referenceId: result.referenceId
      });
    }
    return result;
  }

  modifyInfluence(districtId, factionId, delta, metadata = {}) {
    const current = this.district(districtId);
    if (!current) throw new RangeError(`Unknown district ${String(districtId || "").trim()}.`);
    const factionKey = identifier(factionId, "Faction");
    return this.setInfluence(districtId, factionKey, (current.influence[factionKey] || 0) + Number(delta || 0), metadata);
  }

  relationship(districtId) {
    const district = this.district(districtId);
    if (!district) return null;
    return {
      districtId: district.id,
      ownerId: district.ownerId,
      ownerLabel: district.ownerLabel,
      status: district.status,
      relationship: district.relationship,
      reputation: district.reputation,
      hostile: district.hostile,
      restricted: district.restricted
    };
  }

  snapshot() {
    const districts = Object.fromEntries(TERRITORY_DISTRICTS.map(definition => [definition.id, this.district(definition.id)]));
    const values = Object.values(districts);
    return {
      version: this.state.territory.version,
      factions: Object.fromEntries(MAJOR_FACTION_IDS.map(id => [id, clone(factionDefinition(id))])),
      districts,
      counts: {
        total: values.length,
        controlled: values.filter(item => item.status === "controlled").length,
        contested: values.filter(item => item.status === "contested").length,
        independent: values.filter(item => item.status === "independent").length
      }
    };
  }

  summary() {
    const snapshot = this.snapshot();
    return `${snapshot.counts.controlled} controlled · ${snapshot.counts.contested} contested · ${snapshot.counts.independent} independent`;
  }
}
