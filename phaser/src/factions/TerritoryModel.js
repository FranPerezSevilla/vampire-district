import { CAMPAIGN_FACTIONS } from "../campaign/constants.js";
import { MAJOR_FACTION_IDS } from "./FactionCatalog.js";

export const TERRITORY_STATE_VERSION = 1;

export const TERRITORY_STATUS = Object.freeze({
  CONTROLLED: "controlled",
  CONTESTED: "contested",
  INDEPENDENT: "independent"
});

export const TERRITORY_RELATIONSHIP = Object.freeze({
  HOSTILE: "hostile",
  RESTRICTED: "restricted",
  WATCHED: "watched",
  TOLERATED: "tolerated",
  WELCOME: "welcome"
});

export const TERRITORY_CONTROL_RULES = Object.freeze({
  minimumPresence: 20,
  controlThreshold: 60,
  controlLead: 15,
  influenceMin: 0,
  influenceMax: 100
});

const F = CAMPAIGN_FACTIONS.FIRST_ESTATE;
const G = CAMPAIGN_FACTIONS.GUTTER_CROWN;

function district(id, name, firstEstate, gutterCrown) {
  return Object.freeze({
    id,
    name,
    initialInfluence: Object.freeze({ [F]: firstEstate, [G]: gutterCrown })
  });
}

export const TERRITORY_DISTRICTS = Object.freeze([
  district("hospital-district", "Hospital Ward", 82, 8),
  district("civic-center", "Civic Centre", 88, 6),
  district("cathedral-hill", "Cathedral Hill", 72, 14),
  district("north-harbor", "North Harbor", 15, 76),
  district("west-market", "West Market", 22, 72),
  district("old-quarter", "Old Quarter", 48, 48),
  district("glasshouse", "Glasshouse", 68, 24),
  district("university-district", "University District", 64, 22),
  district("canal-west", "Canal West", 18, 74),
  district("foundry", "Foundry Ward", 24, 78),
  district("canal-east", "Canal East", 44, 50),
  district("harbor-north", "Harbor North", 62, 32),
  district("blackwater", "Blackwater Industrial", 10, 88),
  district("harbor-south", "South Harbor", 18, 80)
]);

export const TERRITORY_DISTRICT_BY_ID = Object.freeze(Object.fromEntries(
  TERRITORY_DISTRICTS.map(item => [item.id, item])
));

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function clampInfluence(value) {
  return Math.max(
    TERRITORY_CONTROL_RULES.influenceMin,
    Math.min(TERRITORY_CONTROL_RULES.influenceMax, finite(value, 0))
  );
}

export function sanitizeInfluence(value = {}) {
  return Object.fromEntries(MAJOR_FACTION_IDS.map(id => [id, clampInfluence(value?.[id])]));
}

export function deriveTerritoryControl(value = {}) {
  const influence = sanitizeInfluence(value);
  const ranked = MAJOR_FACTION_IDS
    .map(id => ({ id, value: influence[id] }))
    .sort((left, right) => right.value - left.value || left.id.localeCompare(right.id));
  const leader = ranked[0];
  const runnerUp = ranked[1] || { id: null, value: 0 };
  const lead = leader.value - runnerUp.value;

  if (leader.value < TERRITORY_CONTROL_RULES.minimumPresence) {
    return { status: TERRITORY_STATUS.INDEPENDENT, ownerId: null, leaderId: leader.id, lead, influence };
  }
  if (
    leader.value >= TERRITORY_CONTROL_RULES.controlThreshold
    && lead >= TERRITORY_CONTROL_RULES.controlLead
  ) {
    return { status: TERRITORY_STATUS.CONTROLLED, ownerId: leader.id, leaderId: leader.id, lead, influence };
  }
  return { status: TERRITORY_STATUS.CONTESTED, ownerId: null, leaderId: leader.id, lead, influence };
}

export function relationshipFromReputation(value) {
  const score = Math.max(-100, Math.min(100, finite(value, 0)));
  if (score <= -61) return TERRITORY_RELATIONSHIP.HOSTILE;
  if (score <= -31) return TERRITORY_RELATIONSHIP.RESTRICTED;
  if (score <= -11) return TERRITORY_RELATIONSHIP.WATCHED;
  if (score <= 35) return TERRITORY_RELATIONSHIP.TOLERATED;
  return TERRITORY_RELATIONSHIP.WELCOME;
}

function integer(value, fallback = 0) {
  return Math.max(0, Math.trunc(finite(value, fallback)));
}

export function createTerritoryDistrictState(definition, { now = 0 } = {}) {
  const control = deriveTerritoryControl(definition?.initialInfluence);
  return {
    id: String(definition?.id || ""),
    ownerId: control.ownerId,
    status: control.status,
    influence: control.influence,
    changedAt: integer(now),
    changeCount: 0
  };
}

export function sanitizeTerritoryDistrictState(definition, candidate, { now = 0 } = {}) {
  const source = candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate : {};
  const fallback = createTerritoryDistrictState(definition, { now });
  const control = deriveTerritoryControl({ ...fallback.influence, ...(source.influence || {}) });
  return {
    id: definition.id,
    ownerId: control.ownerId,
    status: control.status,
    influence: control.influence,
    changedAt: integer(source.changedAt, fallback.changedAt),
    changeCount: integer(source.changeCount, 0)
  };
}

export function createTerritoryState({ now = 0 } = {}) {
  return {
    version: TERRITORY_STATE_VERSION,
    districts: Object.fromEntries(TERRITORY_DISTRICTS.map(definition => [
      definition.id,
      createTerritoryDistrictState(definition, { now })
    ]))
  };
}

export function sanitizeTerritoryState(candidate, { now = 0 } = {}) {
  const source = candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate : {};
  const districts = source.districts && typeof source.districts === "object" && !Array.isArray(source.districts)
    ? source.districts
    : {};
  return {
    version: TERRITORY_STATE_VERSION,
    districts: Object.fromEntries(TERRITORY_DISTRICTS.map(definition => [
      definition.id,
      sanitizeTerritoryDistrictState(definition, districts[definition.id], { now })
    ]))
  };
}
