import {
  CAMPAIGN_CHECKPOINT_VERSION,
  checkpointCanResume,
  checkpointSafetyReasons,
  checkpointStateIsSafe,
  sanitizeCampaignCheckpoint as sanitizeCampaignCheckpointCore
} from "./CampaignCheckpointCore.js";

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export { CAMPAIGN_CHECKPOINT_VERSION, checkpointCanResume, checkpointSafetyReasons, checkpointStateIsSafe };

export function sanitizeCampaignCheckpoint(candidate) {
  const sanitized = sanitizeCampaignCheckpointCore(candidate);
  if (!sanitized) return null;
  const sourceNpcs = plainObject(plainObject(candidate).world).npcs;
  for (const [npcId, sourceState] of Object.entries(plainObject(sourceNpcs))) {
    const target = sanitized.world.npcs[npcId];
    if (!target) continue;
    const source = plainObject(sourceState);
    target.hiddenSpotId = source.hiddenSpotId == null ? null : String(source.hiddenSpotId);
    target.hiddenSpotName = source.hiddenSpotName == null ? null : String(source.hiddenSpotName);
  }
  return sanitized;
}

export function cloneCampaignCheckpoint(checkpoint) {
  const sanitized = sanitizeCampaignCheckpoint(checkpoint);
  return sanitized ? JSON.parse(JSON.stringify(sanitized)) : null;
}