import { VAMPIRE_ASSETS, VAMPIRE_CONTACTS, VAMPIRE_DONORS, VAMPIRE_RULES, knownDestination } from "./VampireCatalog.js";

const record = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const num = (value, fallback = 0, max = Number.MAX_SAFE_INTEGER) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(max, Number(value))) : fallback;
const strings = values => Array.isArray(values) ? [...new Set(values.filter(value => typeof value === "string"))] : [];

export function createVampireState() { return sanitizeVampireState({}); }

export function sanitizeVampireState(candidate) {
  const source = record(candidate);
  const contacts = Object.fromEntries(VAMPIRE_CONTACTS.map(def => {
    const value = record(record(source.contacts)[def.id]);
    return [def.id, { met: Boolean(value.met), debt: num(value.debt, 0, 10000), jobs: Math.floor(num(value.jobs)), endorsed: Boolean(value.endorsed), suspended: Boolean(value.suspended), reason: String(value.reason || ""), introduced: Boolean(value.introduced || value.met || def.id === "sire") }];
  }));
  const assets = Object.fromEntries(VAMPIRE_ASSETS.map(def => {
    const value = record(record(source.assets)[def.id]);
    return [def.id, { level: Math.floor(num(value.level, 0, 2)), reserve: Math.floor(num(value.reserve, 0, 12)), cycle: num(value.cycle, 0, VAMPIRE_RULES.businessPeriod), policy: value.policy === "open" ? "open" : "discreet" }];
  }));
  const donors = Object.fromEntries(VAMPIRE_DONORS.map(def => {
    const value = record(record(source.donors)[def.id]);
    return [def.id, { readyAt: num(value.readyAt), dead: Boolean(value.dead), refused: Boolean(value.refused), depth: ["quick_bite", "full_feed", "drain"].includes(value.depth) ? value.depth : "none" }];
  }));
  const job = record(source.job);
  const jobValid = VAMPIRE_CONTACTS.some(def => def.id === job.issuer);
  const body = record(source.body);
  const markers = (Array.isArray(source.markers) ? source.markers : []).filter(value => value && /^marker:\d+$/.test(value.id) && Number.isFinite(value.x) && Number.isFinite(value.y))
    .filter((value, index, all) => all.findIndex(other => other.id === value.id) === index).slice(0, 8)
    .map(value => ({ id: value.id, x: num(value.x, 0, 1e6), y: num(value.y, 0, 1e6), label: String(value.label || "Waypoint").slice(0, 60), target: knownDestination(value.target) ? value.target : null }));
  const guide = source.guide === "delivery" || knownDestination(source.guide) || markers.some(marker => marker.id === source.guide) ? source.guide : "contact:sire";
  return {
    version: 2, started: Boolean(source.started), elapsed: num(source.elapsed), bloodBags: Math.floor(num(source.bloodBags, 0, VAMPIRE_RULES.carryCapacity)),
    contacts, assets, donors, prince: Boolean(source.prince), claimedAt: num(source.claimedAt), sequence: Math.floor(num(source.sequence)),
    job: jobValid ? { issuer: job.issuer, stage: job.stage === "collected" ? "collected" : "accepted", sequence: Math.floor(num(job.sequence)) } : null,
    processed: strings(source.processed).slice(-200), pending: strings(source.pending).slice(-100),
    guide, markers,
    notices: (Array.isArray(source.notices) ? source.notices : []).slice(-15).map(value => ({ text: String(value?.text || ""), at: num(value?.at) })),
    body: { hunger: body.hunger == null ? null : num(body.hunger, 48, 100), vitality: body.vitality == null ? null : num(body.vitality, 100, 100) },
    frenzy: { exhaustedUntil: num(source.frenzy?.exhaustedUntil), retryAt: num(source.frenzy?.retryAt) }
  };
}
