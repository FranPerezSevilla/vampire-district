import {
  CAMPAIGN_FACTIONS,
  CAMPAIGN_REFUGES,
  CAMPAIGN_SCHEMA_VERSION,
  LEGACY_CAMPAIGN_CONTACT_IDS,
  LEGACY_CAMPAIGN_FACTION_IDS,
  LEGACY_CAMPAIGN_VEHICLE_IDS,
  MISSION_STATUS
} from "./constants.js";
import { sanitizeCampaignCheckpoint } from "./CampaignCheckpoint.js";
import { createTerritoryState, sanitizeTerritoryState } from "../factions/TerritoryModel.js";
import { createHuntingLawState, sanitizeHuntingLawState } from "../factions/HuntingLawModel.js";

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function integer(value, fallback = 0) {
  return Math.trunc(finiteNumber(value, fallback));
}

function plainRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(value => String(value || "").trim())
    .filter(Boolean))];
}

function stringRecord(value) {
  const result = {};
  for (const [key, item] of Object.entries(plainRecord(value))) {
    if (!key) continue;
    if (["string", "number", "boolean"].includes(typeof item) || item == null) result[key] = item;
  }
  return result;
}

function numericRecord(value) {
  const result = {};
  for (const [key, item] of Object.entries(plainRecord(value))) {
    if (!key) continue;
    result[key] = finiteNumber(item, 0);
  }
  return result;
}

function remapRecordKeys(value, aliases = {}) {
  const result = { ...value };
  for (const [legacyId, canonicalId] of Object.entries(aliases)) {
    if (!(canonicalId in result) && legacyId in result) result[canonicalId] = result[legacyId];
    delete result[legacyId];
  }
  return result;
}

function remapString(value, aliases = {}) {
  const id = String(value || "").trim();
  return aliases[id] || id;
}

function remapVehicleFlagKeys(value) {
  const result = {};
  for (const [key, item] of Object.entries(stringRecord(value))) {
    let target = key;
    for (const [legacyId, canonicalId] of Object.entries(LEGACY_CAMPAIGN_VEHICLE_IDS)) {
      target = target.replace(`vehicle.${legacyId}.`, `vehicle.${canonicalId}.`);
    }
    result[target] = item;
  }
  return result;
}

function sanitizeMissionRecord(id, value, now) {
  const source = plainRecord(value);
  const objectiveStates = plainRecord(source.objectives);
  const objectives = {};
  for (const [objectiveId, objective] of Object.entries(objectiveStates)) {
    const item = plainRecord(objective);
    objectives[objectiveId] = {
      id: objectiveId,
      status: String(item.status || "locked"),
      progress: Math.max(0, finiteNumber(item.progress, 0)),
      required: Math.max(1, finiteNumber(item.required, 1)),
      completedAt: Math.max(0, integer(item.completedAt, 0)),
      outcome: item.outcome == null ? null : String(item.outcome)
    };
  }

  return {
    id,
    definitionVersion: Math.max(1, integer(source.definitionVersion, 1)),
    status: Object.values(MISSION_STATUS).includes(source.status)
      ? source.status
      : MISSION_STATUS.INACTIVE,
    objectiveIndex: Math.max(0, integer(source.objectiveIndex, 0)),
    objectives,
    startedAt: Math.max(0, integer(source.startedAt, 0)),
    updatedAt: Math.max(0, integer(source.updatedAt, now)),
    completedAt: Math.max(0, integer(source.completedAt, 0)),
    failedAt: Math.max(0, integer(source.failedAt, 0)),
    failureReason: source.failureReason == null ? "" : String(source.failureReason),
    completionCount: Math.max(0, integer(source.completionCount, 0)),
    rewardsGranted: Boolean(source.rewardsGranted),
    metadata: stringRecord(source.metadata)
  };
}

export function createCampaignState({ now = 0 } = {}) {
  const timestamp = Math.max(0, integer(now, 0));
  return {
    version: CAMPAIGN_SCHEMA_VERSION,
    revision: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    sequences: {
      transaction: 0,
      event: 0,
      save: 0,
      checkpoint: 0
    },
    player: {
      cash: 0,
      currentRefugeId: CAMPAIGN_REFUGES.ROOFTOP_REFUGE
    },
    missions: {
      activeMissionId: null,
      records: {},
      completed: [],
      failed: []
    },
    checkpoints: {
      latest: null
    },
    reputation: {
      factions: {
        [CAMPAIGN_FACTIONS.FIRST_ESTATE]: 0,
        [CAMPAIGN_FACTIONS.GUTTER_CROWN]: 0
      },
      contacts: {}
    },
    territory: createTerritoryState({ now: timestamp }),
    huntingLaw: createHuntingLawState(),
    inventory: {
      carried: {
        meleeWeaponId: null,
        sidearmWeaponId: null,
        longWeaponId: null,
        ammoByType: {}
      },
      refuges: {
        [CAMPAIGN_REFUGES.ROOFTOP_REFUGE]: {
          weaponIds: [],
          ammoByType: {},
          bloodBags: 0,
          missionItems: [],
          retainerEquipment: []
        }
      }
    },
    world: {
      ownedVehicles: [],
      unlockedRefuges: [CAMPAIGN_REFUGES.ROOFTOP_REFUGE],
      flags: {}
    },
    ledger: [],
    eventLog: []
  };
}

export function sanitizeCampaignState(candidate, { now = 0 } = {}) {
  const defaults = createCampaignState({ now });
  const source = plainRecord(candidate);
  const timestamp = Math.max(0, integer(now, defaults.updatedAt));
  const missionSource = plainRecord(source.missions);
  const missionRecords = {};
  for (const [id, record] of Object.entries(plainRecord(missionSource.records))) {
    if (!id) continue;
    missionRecords[id] = sanitizeMissionRecord(id, record, timestamp);
  }

  const refugeSource = plainRecord(plainRecord(source.inventory).refuges);
  const refuges = {};
  for (const [id, refuge] of Object.entries(refugeSource)) {
    const item = plainRecord(refuge);
    refuges[id] = {
      weaponIds: uniqueStrings(item.weaponIds),
      ammoByType: numericRecord(item.ammoByType),
      bloodBags: Math.max(0, integer(item.bloodBags, 0)),
      missionItems: uniqueStrings(item.missionItems),
      retainerEquipment: uniqueStrings(item.retainerEquipment)
    };
  }
  if (!refuges[CAMPAIGN_REFUGES.ROOFTOP_REFUGE]) {
    refuges[CAMPAIGN_REFUGES.ROOFTOP_REFUGE] = defaults.inventory.refuges[CAMPAIGN_REFUGES.ROOFTOP_REFUGE];
  }

  const ledger = (Array.isArray(source.ledger) ? source.ledger : []).map(entry => {
    const item = plainRecord(entry);
    return {
      id: String(item.id || ""),
      type: item.type === "debit" ? "debit" : "credit",
      amount: Math.max(0, finiteNumber(item.amount, 0)),
      balanceBefore: finiteNumber(item.balanceBefore, 0),
      balanceAfter: finiteNumber(item.balanceAfter, 0),
      timestamp: Math.max(0, integer(item.timestamp, 0)),
      source: String(item.source || "unknown"),
      reason: String(item.reason || ""),
      referenceId: item.referenceId == null ? null : String(item.referenceId),
      metadata: stringRecord(item.metadata)
    };
  }).filter(entry => entry.id && entry.amount > 0);

  const eventLog = (Array.isArray(source.eventLog) ? source.eventLog : []).map(entry => {
    const item = plainRecord(entry);
    return {
      id: String(item.id || ""),
      type: String(item.type || ""),
      timestamp: Math.max(0, integer(item.timestamp, 0)),
      payload: stringRecord(item.payload)
    };
  }).filter(entry => entry.id && entry.type);

  const state = {
    version: CAMPAIGN_SCHEMA_VERSION,
    revision: Math.max(0, integer(source.revision, 0)),
    createdAt: Math.max(0, integer(source.createdAt, defaults.createdAt)),
    updatedAt: Math.max(0, integer(source.updatedAt, timestamp)),
    sequences: {
      transaction: Math.max(0, integer(plainRecord(source.sequences).transaction, ledger.length)),
      event: Math.max(0, integer(plainRecord(source.sequences).event, eventLog.length)),
      save: Math.max(0, integer(plainRecord(source.sequences).save, 0)),
      checkpoint: Math.max(0, integer(plainRecord(source.sequences).checkpoint, 0))
    },
    player: {
      cash: Math.max(0, finiteNumber(plainRecord(source.player).cash, 0)),
      currentRefugeId: String(plainRecord(source.player).currentRefugeId || CAMPAIGN_REFUGES.ROOFTOP_REFUGE)
    },
    missions: {
      activeMissionId: missionSource.activeMissionId == null ? null : String(missionSource.activeMissionId),
      records: missionRecords,
      completed: uniqueStrings(missionSource.completed),
      failed: uniqueStrings(missionSource.failed)
    },
    checkpoints: {
      latest: sanitizeCampaignCheckpoint(plainRecord(source.checkpoints).latest || source.checkpoint || null)
    },
    reputation: {
      factions: {
        ...defaults.reputation.factions,
        ...remapRecordKeys(
          numericRecord(plainRecord(source.reputation).factions),
          LEGACY_CAMPAIGN_FACTION_IDS
        )
      },
      contacts: remapRecordKeys(
        numericRecord(plainRecord(source.reputation).contacts),
        LEGACY_CAMPAIGN_CONTACT_IDS
      )
    },
    territory: sanitizeTerritoryState(source.territory, { now: timestamp }),
    huntingLaw: sanitizeHuntingLawState(source.huntingLaw, { now: timestamp }),
    inventory: {
      carried: {
        meleeWeaponId: plainRecord(plainRecord(source.inventory).carried).meleeWeaponId == null
          ? null
          : String(plainRecord(plainRecord(source.inventory).carried).meleeWeaponId),
        sidearmWeaponId: plainRecord(plainRecord(source.inventory).carried).sidearmWeaponId == null
          ? null
          : String(plainRecord(plainRecord(source.inventory).carried).sidearmWeaponId),
        longWeaponId: plainRecord(plainRecord(source.inventory).carried).longWeaponId == null
          ? null
          : String(plainRecord(plainRecord(source.inventory).carried).longWeaponId),
        ammoByType: numericRecord(plainRecord(plainRecord(source.inventory).carried).ammoByType)
      },
      refuges
    },
    world: {
      ownedVehicles: uniqueStrings(
        uniqueStrings(plainRecord(source.world).ownedVehicles)
          .map(id => remapString(id, LEGACY_CAMPAIGN_VEHICLE_IDS))
      ),
      unlockedRefuges: uniqueStrings(plainRecord(source.world).unlockedRefuges),
      flags: remapVehicleFlagKeys(plainRecord(source.world).flags)
    },
    ledger,
    eventLog
  };

  if (!state.world.unlockedRefuges.includes(CAMPAIGN_REFUGES.ROOFTOP_REFUGE)) {
    state.world.unlockedRefuges.unshift(CAMPAIGN_REFUGES.ROOFTOP_REFUGE);
  }
  if (state.missions.activeMissionId && !state.missions.records[state.missions.activeMissionId]) {
    state.missions.activeMissionId = null;
  }
  return state;
}

export function migrateCampaignState(candidate, { now = 0 } = {}) {
  if (candidate == null) return createCampaignState({ now });
  const source = plainRecord(candidate);
  const version = integer(source.version, 0);
  if (version > CAMPAIGN_SCHEMA_VERSION) {
    throw new RangeError(`Campaign save version ${version} is newer than supported version ${CAMPAIGN_SCHEMA_VERSION}.`);
  }

  // Versions zero and one did not persist a world checkpoint. Version two did
  // not persist district territory. Version three did not persist hunting-law
  // rights, victim protection, assessments or discoveries. Sanitisation keeps
  // every existing campaign domain while supplying the missing collections.
  return sanitizeCampaignState(source, { now });
}

export function cloneCampaignState(state) {
  return JSON.parse(JSON.stringify(state));
}

export function serializeCampaignState(state) {
  return JSON.stringify(sanitizeCampaignState(state, { now: state?.updatedAt || 0 }));
}

export function deserializeCampaignState(serialized, options = {}) {
  if (typeof serialized !== "string" || !serialized.trim()) return createCampaignState(options);
  let parsed;
  try {
    parsed = JSON.parse(serialized);
  } catch (error) {
    throw new SyntaxError(`Campaign save is not valid JSON: ${error.message}`);
  }
  return migrateCampaignState(parsed, options);
}

export function campaignStateIsSerializable(state) {
  try {
    const serialized = JSON.stringify(state);
    return typeof serialized === "string" && !serialized.includes("undefined");
  } catch {
    return false;
  }
}
