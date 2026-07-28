import { CAMPAIGN_FACTIONS } from "../campaign/constants.js";

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

export const FACTION_CATALOG = freeze({
  [CAMPAIGN_FACTIONS.FIRST_ESTATE]: {
    id: CAMPAIGN_FACTIONS.FIRST_ESTATE,
    name: "The First Estate",
    shortLabel: "FIRST ESTATE",
    streetName: "The Estate",
    kind: "major",
    identity: "institutional",
    doctrine: "Own the systems that make the city obey.",
    traits: ["wealth", "access", "secrecy", "controlled violence"]
  },
  [CAMPAIGN_FACTIONS.GUTTER_CROWN]: {
    id: CAMPAIGN_FACTIONS.GUTTER_CROWN,
    name: "The Gutter Crown",
    shortLabel: "GUTTER CROWN",
    streetName: "The Crown",
    kind: "major",
    identity: "territorial",
    doctrine: "Ground belongs to whoever can take it and remain.",
    traits: ["force", "reputation", "mobility", "visible control"]
  }
});

export const MAJOR_FACTION_IDS = Object.freeze(Object.keys(FACTION_CATALOG));

export function factionDefinition(id) {
  return FACTION_CATALOG[String(id || "").trim()] || null;
}

export function factionLabel(id, fallback = "Independent") {
  return factionDefinition(id)?.name || String(fallback || "Independent");
}
