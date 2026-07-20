import { OBJECTIVE_TYPES } from "./constants.js";

const VALID_TYPES = new Set(Object.values(OBJECTIVE_TYPES));

function requiredString(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new TypeError(`${label} is required.`);
  return text;
}

function plainData(value, label) {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
  const serialized = JSON.stringify(value);
  if (typeof serialized !== "string") throw new TypeError(`${label} must be serializable.`);
  return JSON.parse(serialized);
}

function normalizeObjective(objective, index) {
  if (!objective || typeof objective !== "object" || Array.isArray(objective)) {
    throw new TypeError(`Objective ${index + 1} must be an object.`);
  }
  const id = requiredString(objective.id, `Objective ${index + 1} id`);
  const type = requiredString(objective.type, `Objective ${id} type`);
  if (!VALID_TYPES.has(type)) throw new RangeError(`Objective ${id} has unsupported type ${type}.`);
  const targetId = objective.targetId == null ? null : requiredString(objective.targetId, `Objective ${id} targetId`);
  const required = Math.max(1, Math.trunc(Number(objective.required) || 1));
  const acceptedOutcomes = [...new Set((Array.isArray(objective.acceptedOutcomes) ? objective.acceptedOutcomes : [])
    .map(value => String(value || "").trim())
    .filter(Boolean))];

  if (![OBJECTIVE_TYPES.ESCAPE, OBJECTIVE_TYPES.LOSE_WANTED_LEVEL].includes(type) && !targetId) {
    throw new TypeError(`Objective ${id} requires targetId.`);
  }
  if (type === OBJECTIVE_TYPES.NEUTRALIZE && !acceptedOutcomes.length) {
    throw new TypeError(`Neutralize objective ${id} requires acceptedOutcomes.`);
  }

  return Object.freeze({
    id,
    type,
    targetId,
    label: String(objective.label || id),
    description: String(objective.description || ""),
    required,
    acceptedOutcomes: Object.freeze(acceptedOutcomes),
    maxWantedLevel: type === OBJECTIVE_TYPES.LOSE_WANTED_LEVEL
      ? Math.max(0, Math.trunc(Number(objective.maxWantedLevel) || 0))
      : null,
    optional: Boolean(objective.optional),
    metadata: Object.freeze(plainData(objective.metadata, `Objective ${id} metadata`))
  });
}

function normalizeRewards(rewards = {}) {
  const value = plainData(rewards, "Mission rewards");
  const cash = Math.max(0, Number(value.cash) || 0);
  const reputation = {};
  for (const [id, delta] of Object.entries(value.reputation || {})) {
    const amount = Number(delta);
    if (id && Number.isFinite(amount) && amount !== 0) reputation[id] = amount;
  }
  const contacts = {};
  for (const [id, delta] of Object.entries(value.contacts || {})) {
    const amount = Number(delta);
    if (id && Number.isFinite(amount) && amount !== 0) contacts[id] = amount;
  }
  return Object.freeze({
    cash,
    reputation: Object.freeze(reputation),
    contacts: Object.freeze(contacts),
    flags: Object.freeze(plainData(value.flags, "Mission reward flags")),
    items: Object.freeze(Array.isArray(value.items) ? value.items.map(String).filter(Boolean) : [])
  });
}

export function defineMission(definition) {
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    throw new TypeError("Mission definition must be an object.");
  }
  const id = requiredString(definition.id, "Mission id");
  const objectives = (Array.isArray(definition.objectives) ? definition.objectives : [])
    .map(normalizeObjective);
  if (!objectives.length) throw new TypeError(`Mission ${id} requires at least one objective.`);
  const objectiveIds = new Set();
  for (const objective of objectives) {
    if (objectiveIds.has(objective.id)) throw new Error(`Mission ${id} repeats objective id ${objective.id}.`);
    objectiveIds.add(objective.id);
  }

  return Object.freeze({
    id,
    version: Math.max(1, Math.trunc(Number(definition.version) || 1)),
    title: requiredString(definition.title, `Mission ${id} title`),
    factionId: definition.factionId == null ? null : requiredString(definition.factionId, `Mission ${id} factionId`),
    contactId: definition.contactId == null ? null : requiredString(definition.contactId, `Mission ${id} contactId`),
    description: String(definition.description || ""),
    replayable: Boolean(definition.replayable),
    objectives: Object.freeze(objectives),
    rewards: normalizeRewards(definition.rewards),
    failureRules: Object.freeze(plainData(definition.failureRules, `Mission ${id} failureRules`)),
    metadata: Object.freeze(plainData(definition.metadata, `Mission ${id} metadata`))
  });
}

export function missionDefinitionIsSerializable(definition) {
  try {
    return Boolean(JSON.stringify(definition));
  } catch {
    return false;
  }
}
