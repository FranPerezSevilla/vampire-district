import {
  MISSION_STATUS,
  OBJECTIVE_EVENT_BY_TYPE,
  OBJECTIVE_STATUS,
  OBJECTIVE_TYPES
} from "./constants.js";

function timestamp(now) {
  return Math.max(0, Math.trunc(Number(now()) || 0));
}

function missionRecord(definition, now) {
  const objectives = {};
  definition.objectives.forEach((objective, index) => {
    objectives[objective.id] = {
      id: objective.id,
      status: index === 0 ? OBJECTIVE_STATUS.ACTIVE : OBJECTIVE_STATUS.LOCKED,
      progress: 0,
      required: objective.required,
      completedAt: 0,
      outcome: null
    };
  });
  return {
    id: definition.id,
    definitionVersion: definition.version,
    status: MISSION_STATUS.ACTIVE,
    objectiveIndex: 0,
    objectives,
    startedAt: now,
    updatedAt: now,
    completedAt: 0,
    failedAt: 0,
    failureReason: "",
    completionCount: 0,
    rewardsGranted: false,
    metadata: {}
  };
}

function targetMatches(objective, payload) {
  if (!objective.targetId) return true;
  return [payload.targetId, payload.entityId, payload.itemId, payload.refugeId, payload.vehicleId]
    .some(value => value != null && String(value) === objective.targetId);
}

export class MissionRunner {
  constructor(state, {
    definitions = [],
    events = null,
    wallet = null,
    reputation = null,
    now = () => Date.now(),
    onDirty = null
  } = {}) {
    if (!state?.missions?.records) throw new TypeError("MissionRunner requires a campaign state.");
    this.state = state;
    this.events = events;
    this.wallet = wallet;
    this.reputation = reputation;
    this.now = now;
    this.onDirty = typeof onDirty === "function" ? onDirty : null;
    this.definitions = new Map();
    for (const definition of definitions) this.register(definition);
  }

  register(definition) {
    if (!definition?.id || !Array.isArray(definition.objectives)) {
      throw new TypeError("MissionRunner.register requires a validated mission definition.");
    }
    if (this.definitions.has(definition.id)) throw new Error(`Mission ${definition.id} is already registered.`);
    this.definitions.set(definition.id, definition);
    return definition;
  }

  definition(id) {
    return this.definitions.get(String(id || "")) || null;
  }

  activeDefinition() {
    return this.definition(this.state.missions.activeMissionId);
  }

  activeRecord() {
    const id = this.state.missions.activeMissionId;
    return id ? this.state.missions.records[id] || null : null;
  }

  currentObjective() {
    const definition = this.activeDefinition();
    const record = this.activeRecord();
    if (!definition || !record || record.status !== MISSION_STATUS.ACTIVE) return null;
    return definition.objectives[record.objectiveIndex] || null;
  }

  start(id, { replay = false, metadata = {} } = {}) {
    const definition = this.definition(id);
    if (!definition) throw new Error(`Unknown mission ${id}.`);
    const active = this.activeRecord();
    if (active?.status === MISSION_STATUS.ACTIVE) throw new Error(`Mission ${active.id} is already active.`);
    const existing = this.state.missions.records[definition.id];
    const hasCompleted = existing?.status === MISSION_STATUS.COMPLETED || this.state.missions.completed.includes(definition.id);
    if (hasCompleted && !definition.replayable && !replay) throw new Error(`Mission ${definition.id} is not replayable.`);

    const now = timestamp(this.now);
    const record = missionRecord(definition, now);
    record.completionCount = Math.max(0, Number(existing?.completionCount) || 0);
    record.metadata = this.plainMetadata(metadata);
    this.state.missions.records[definition.id] = record;
    this.state.missions.activeMissionId = definition.id;
    this.removeFromList(this.state.missions.failed, definition.id);
    this.markDirty("mission:started", {
      missionId: definition.id,
      objectiveId: definition.objectives[0].id,
      objectiveType: definition.objectives[0].type
    });
    return this.snapshot(definition.id);
  }

  handle(type, payload = {}) {
    const definition = this.activeDefinition();
    const record = this.activeRecord();
    const objective = this.currentObjective();
    if (!definition || !record || !objective || record.status !== MISSION_STATUS.ACTIVE) return false;
    if (OBJECTIVE_EVENT_BY_TYPE[objective.type] !== type) return false;
    if (!targetMatches(objective, payload)) return false;
    if (!this.outcomeMatches(objective, payload)) return false;
    if (!this.wantedMatches(objective, payload)) return false;

    const objectiveState = record.objectives[objective.id];
    const increment = Math.max(1, Number(payload.amount) || 1);
    objectiveState.progress = Math.min(objectiveState.required, objectiveState.progress + increment);
    objectiveState.outcome = payload.outcome == null ? objectiveState.outcome : String(payload.outcome);
    record.updatedAt = timestamp(this.now);

    this.events?.emit?.("mission:objective-progressed", {
      missionId: definition.id,
      objectiveId: objective.id,
      progress: objectiveState.progress,
      required: objectiveState.required,
      outcome: objectiveState.outcome
    });

    if (objectiveState.progress < objectiveState.required) {
      this.markDirty(null);
      return true;
    }
    this.completeObjective(definition, record, objective, objectiveState);
    return true;
  }

  completeObjective(definition, record, objective, objectiveState) {
    const now = timestamp(this.now);
    objectiveState.status = OBJECTIVE_STATUS.COMPLETED;
    objectiveState.completedAt = now;
    objectiveState.progress = objectiveState.required;
    record.updatedAt = now;

    this.events?.emit?.("mission:objective-completed", {
      missionId: definition.id,
      objectiveId: objective.id,
      objectiveType: objective.type,
      objectiveIndex: record.objectiveIndex,
      outcome: objectiveState.outcome
    });

    const nextIndex = this.nextRequiredObjectiveIndex(definition, record.objectiveIndex + 1);
    if (nextIndex >= definition.objectives.length) {
      this.completeMission(definition, record);
      return;
    }

    record.objectiveIndex = nextIndex;
    const next = definition.objectives[nextIndex];
    record.objectives[next.id].status = OBJECTIVE_STATUS.ACTIVE;
    this.markDirty("mission:objective-activated", {
      missionId: definition.id,
      objectiveId: next.id,
      objectiveType: next.type,
      objectiveIndex: nextIndex
    });
  }

  nextRequiredObjectiveIndex(definition, startIndex) {
    // Optional objectives remain available to authored integrations, but the
    // linear campaign runner does not block progression on them.
    let index = startIndex;
    while (index < definition.objectives.length && definition.objectives[index].optional) index++;
    return index;
  }

  completeMission(definition = this.activeDefinition(), record = this.activeRecord()) {
    if (!definition || !record || record.status !== MISSION_STATUS.ACTIVE) return false;
    const now = timestamp(this.now);
    record.status = MISSION_STATUS.COMPLETED;
    record.completedAt = now;
    record.updatedAt = now;
    record.completionCount = Math.max(0, Number(record.completionCount) || 0) + 1;
    this.state.missions.activeMissionId = null;
    this.addUnique(this.state.missions.completed, definition.id);
    this.removeFromList(this.state.missions.failed, definition.id);
    this.grantRewards(definition, record);
    this.markDirty("mission:completed", {
      missionId: definition.id,
      completionCount: record.completionCount,
      cashReward: definition.rewards.cash
    });
    return true;
  }

  fail(reason = "Mission failed.", metadata = {}) {
    const definition = this.activeDefinition();
    const record = this.activeRecord();
    if (!definition || !record || record.status !== MISSION_STATUS.ACTIVE) return false;
    const now = timestamp(this.now);
    record.status = MISSION_STATUS.FAILED;
    record.failedAt = now;
    record.updatedAt = now;
    record.failureReason = String(reason || "Mission failed.");
    const objective = this.currentObjective();
    if (objective) record.objectives[objective.id].status = OBJECTIVE_STATUS.FAILED;
    this.state.missions.activeMissionId = null;
    this.addUnique(this.state.missions.failed, definition.id);
    this.markDirty("mission:failed", {
      missionId: definition.id,
      objectiveId: objective?.id || null,
      reason: record.failureReason,
      source: metadata.source || "system"
    });
    return true;
  }

  grantRewards(definition, record) {
    if (record.rewardsGranted) return false;
    if (definition.rewards.cash > 0) {
      this.wallet?.credit?.(definition.rewards.cash, {
        source: "mission",
        reason: `Completed ${definition.title}`,
        referenceId: definition.id
      });
    }
    for (const [factionId, delta] of Object.entries(definition.rewards.reputation)) {
      this.reputation?.modifyFaction?.(factionId, delta, {
        source: "mission",
        reason: `Completed ${definition.title}`,
        referenceId: definition.id
      });
    }
    for (const [contactId, delta] of Object.entries(definition.rewards.contacts)) {
      this.reputation?.modifyContact?.(contactId, delta, {
        source: "mission",
        reason: `Completed ${definition.title}`,
        referenceId: definition.id
      });
    }
    for (const [flag, value] of Object.entries(definition.rewards.flags)) this.state.world.flags[flag] = value;
    record.rewardsGranted = true;
    return true;
  }

  outcomeMatches(objective, payload) {
    if (objective.type !== OBJECTIVE_TYPES.NEUTRALIZE) return true;
    const outcome = String(payload.outcome || "");
    return objective.acceptedOutcomes.includes(outcome);
  }

  wantedMatches(objective, payload) {
    if (objective.type !== OBJECTIVE_TYPES.LOSE_WANTED_LEVEL) return true;
    return Number(payload.level) <= objective.maxWantedLevel;
  }

  snapshot(id = this.state.missions.activeMissionId) {
    const definition = this.definition(id);
    const record = id ? this.state.missions.records[id] : null;
    if (!definition || !record) return null;
    const current = record.status === MISSION_STATUS.ACTIVE
      ? definition.objectives[record.objectiveIndex] || null
      : null;
    return {
      id: definition.id,
      title: definition.title,
      factionId: definition.factionId,
      contactId: definition.contactId,
      status: record.status,
      objectiveIndex: record.objectiveIndex,
      currentObjective: current ? { ...current, acceptedOutcomes: [...current.acceptedOutcomes] } : null,
      objectives: definition.objectives.map(objective => ({
        ...objective,
        acceptedOutcomes: [...objective.acceptedOutcomes],
        state: { ...record.objectives[objective.id] }
      })),
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      failedAt: record.failedAt,
      failureReason: record.failureReason,
      completionCount: record.completionCount,
      rewardsGranted: record.rewardsGranted
    };
  }

  markDirty(eventType, payload = {}) {
    this.state.revision = Math.max(0, Number(this.state.revision) || 0) + 1;
    this.state.updatedAt = timestamp(this.now);
    if (eventType) this.events?.emit?.(eventType, payload);
    this.onDirty?.(this.state, { eventType, payload });
  }

  plainMetadata(metadata) {
    const result = {};
    for (const [key, value] of Object.entries(metadata || {})) {
      if (["string", "number", "boolean"].includes(typeof value) || value == null) result[key] = value;
    }
    return result;
  }

  addUnique(list, id) {
    if (!list.includes(id)) list.push(id);
  }

  removeFromList(list, id) {
    const index = list.indexOf(id);
    if (index >= 0) list.splice(index, 1);
  }
}
