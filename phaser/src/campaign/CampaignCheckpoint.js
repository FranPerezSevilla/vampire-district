import { CHECKPOINT_KINDS } from "./constants.js";

export const CAMPAIGN_CHECKPOINT_VERSION = 1;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function integer(value, fallback = 0) {
  return Math.trunc(finite(value, fallback));
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function uniqueStrings(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map(item => String(item || "").trim())
    .filter(Boolean))];
}

function primitiveRecord(value) {
  const result = {};
  for (const [key, item] of Object.entries(plainObject(value))) {
    if (!key) continue;
    if (["string", "number", "boolean"].includes(typeof item) || item == null) result[key] = item;
  }
  return result;
}

function numericRecord(value) {
  const result = {};
  for (const [key, item] of Object.entries(plainObject(value))) {
    if (!key) continue;
    result[key] = Math.max(0, finite(item, 0));
  }
  return result;
}

function sanitizeNpcState(id, value) {
  const source = plainObject(value);
  const combat = plainObject(source.combat);
  return {
    id: String(id || source.id || ""),
    type: String(source.type || ""),
    x: finite(source.x, 0),
    y: finite(source.y, 0),
    layer: integer(source.layer, 0),
    dead: Boolean(source.dead),
    deathKind: source.deathKind == null ? null : String(source.deathKind),
    inactive: Boolean(source.inactive),
    hiddenBody: Boolean(source.hiddenBody),
    intercepted: Boolean(source.intercepted),
    corpseDiscovered: Boolean(source.corpseDiscovered),
    hasReported: Boolean(source.hasReported),
    combat: {
      state: String(combat.state || "active"),
      resilience: Math.max(0, finite(combat.resilience, 0)),
      maxResilience: Math.max(0, finite(combat.maxResilience, 0))
    }
  };
}

function sanitizeBloodStain(value) {
  const source = plainObject(value);
  return {
    id: Math.max(0, integer(source.id, 0)),
    x: finite(source.x, 0),
    y: finite(source.y, 0),
    layer: integer(source.layer, 0),
    kind: String(source.kind || "blood"),
    age: Math.max(0, finite(source.age, 0)),
    life: Math.max(0, finite(source.life, 0)),
    discovered: Boolean(source.discovered)
  };
}

export function sanitizeCampaignCheckpoint(candidate) {
  if (!candidate) return null;
  const source = plainObject(candidate);
  const missionId = String(source.missionId || "").trim();
  const objectiveId = source.objectiveId == null ? null : String(source.objectiveId).trim() || null;
  const id = String(source.id || "").trim();
  if (!id || !missionId) return null;

  const player = plainObject(source.player);
  const loadout = plainObject(source.loadout);
  const world = plainObject(source.world);
  const tutorial = plainObject(source.tutorial);
  const npcStates = {};
  for (const [npcId, npcState] of Object.entries(plainObject(world.npcs))) {
    const sanitized = sanitizeNpcState(npcId, npcState);
    if (sanitized.id) npcStates[sanitized.id] = sanitized;
  }

  return {
    version: CAMPAIGN_CHECKPOINT_VERSION,
    id,
    missionId,
    objectiveId,
    kind: Object.values(CHECKPOINT_KINDS).includes(source.kind)
      ? source.kind
      : CHECKPOINT_KINDS.OBJECTIVE,
    createdAt: Math.max(0, integer(source.createdAt, 0)),
    resumable: source.resumable !== false,
    player: {
      x: finite(player.x, 0),
      y: finite(player.y, 0),
      layer: integer(player.layer, 0),
      hunger: Math.max(0, Math.min(100, finite(player.hunger, 0)))
    },
    loadout: {
      selectedWeaponId: loadout.selectedWeaponId == null ? null : String(loadout.selectedWeaponId),
      inventory: uniqueStrings(loadout.inventory),
      ammo: numericRecord(loadout.ammo)
    },
    world: {
      exposure: Math.max(0, finite(world.exposure, 0)),
      brokenLights: uniqueStrings(world.brokenLights),
      npcs: npcStates,
      bloodStains: (Array.isArray(world.bloodStains) ? world.bloodStains : [])
        .map(sanitizeBloodStain)
        .filter(stain => stain.id > 0 && stain.life > 0),
      feedingStats: primitiveRecord(world.feedingStats),
      evidenceStats: primitiveRecord(world.evidenceStats)
    },
    tutorial: {
      completed: Boolean(tutorial.completed),
      state: String(tutorial.state || (tutorial.completed ? "complete" : "waiting")),
      finalAdviceShown: Boolean(tutorial.finalAdviceShown),
      informantGone: Boolean(tutorial.informantGone)
    },
    metadata: primitiveRecord(source.metadata)
  };
}

export function cloneCampaignCheckpoint(checkpoint) {
  const sanitized = sanitizeCampaignCheckpoint(checkpoint);
  return sanitized ? JSON.parse(JSON.stringify(sanitized)) : null;
}

export function checkpointSafetyReasons(state = {}) {
  const reasons = [];
  if (state.worldLocked) reasons.push("world-locked");
  if (state.transitionActive) reasons.push("transition");
  if (state.interactionOpen) reasons.push("interaction-menu");
  if (state.feedingActive) reasons.push("feeding");
  if (state.combatBusy) reasons.push("combat");
  if (state.hitStunned) reasons.push("hit-stun");
  if (Math.max(0, Number(state.wantedLevel) || 0) > 0) reasons.push("wanted");
  if (Math.max(0, Number(state.alarmedWitnesses) || 0) > 0) reasons.push("witnesses");
  if (Math.max(0, Number(state.activePursuers) || 0) > 0) reasons.push("pursuit");
  return reasons;
}

export function checkpointStateIsSafe(state = {}) {
  return checkpointSafetyReasons(state).length === 0;
}

export function checkpointCanResume(checkpoint, campaignState) {
  const value = sanitizeCampaignCheckpoint(checkpoint);
  if (!value?.resumable) return false;
  const record = campaignState?.missions?.records?.[value.missionId];
  if (!record) return false;
  if (record.status === "active") {
    return campaignState.missions.activeMissionId === value.missionId
      && (!value.objectiveId || record.objectives?.[value.objectiveId]?.status === "active");
  }
  return record.status === "completed" && value.kind === CHECKPOINT_KINDS.MISSION_COMPLETE;
}
