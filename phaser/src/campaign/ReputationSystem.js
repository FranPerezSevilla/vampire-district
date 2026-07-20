import { REPUTATION_LIMITS, REPUTATION_TIERS } from "./constants.js";

function clamp(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError("Reputation change must be finite.");
  return Math.max(REPUTATION_LIMITS.min, Math.min(REPUTATION_LIMITS.max, number));
}

function identifier(value, label) {
  const id = String(value || "").trim();
  if (!id) throw new TypeError(`${label} id is required.`);
  return id;
}

export class ReputationSystem {
  constructor(state, { events = null } = {}) {
    if (!state?.reputation?.factions || !state?.reputation?.contacts) {
      throw new TypeError("ReputationSystem requires a campaign state.");
    }
    this.state = state;
    this.events = events;
  }

  faction(id) {
    return Number(this.state.reputation.factions[identifier(id, "Faction")]) || 0;
  }

  factionValue(id) {
    return this.faction(id);
  }

  contact(id) {
    return Number(this.state.reputation.contacts[identifier(id, "Contact")]) || 0;
  }

  contactValue(id) {
    return this.contact(id);
  }

  setFaction(id, value, metadata = {}) {
    return this.set("faction", id, value, metadata);
  }

  modifyFaction(id, delta, metadata = {}) {
    return this.setFaction(id, this.faction(id) + Number(delta || 0), metadata);
  }

  setContact(id, value, metadata = {}) {
    return this.set("contact", id, value, metadata);
  }

  modifyContact(id, delta, metadata = {}) {
    return this.setContact(id, this.contact(id) + Number(delta || 0), metadata);
  }

  set(kind, id, value, metadata) {
    const key = identifier(id, kind === "faction" ? "Faction" : "Contact");
    const collection = kind === "faction" ? this.state.reputation.factions : this.state.reputation.contacts;
    const before = Number(collection[key]) || 0;
    const after = clamp(value);
    collection[key] = after;
    const result = {
      kind,
      id: key,
      before,
      after,
      delta: after - before,
      tier: this.tier(after),
      reason: String(metadata.reason || ""),
      source: String(metadata.source || "unknown"),
      referenceId: metadata.referenceId == null ? null : String(metadata.referenceId)
    };
    if (result.delta !== 0) this.events?.emit?.("reputation:changed", result);
    return result;
  }

  tier(value) {
    const score = clamp(value);
    return REPUTATION_TIERS.find(tier => score >= tier.min && score <= tier.max)
      || REPUTATION_TIERS[3];
  }

  factionSnapshot() {
    return Object.fromEntries(Object.entries(this.state.reputation.factions)
      .map(([id, value]) => [id, { value, tier: this.tier(value) }]));
  }

  contactSnapshot() {
    return Object.fromEntries(Object.entries(this.state.reputation.contacts)
      .map(([id, value]) => [id, { value, tier: this.tier(value) }]));
  }
}
