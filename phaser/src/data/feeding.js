import { NPC_TYPES } from "./npcs.js";

export const FEEDING_DEPTHS = Object.freeze({
  NONE: "none",
  QUICK_BITE: "quick_bite",
  FULL_FEED: "full_feed",
  DRAIN: "drain"
});

export const FEEDING_DEPTH_ORDER = Object.freeze([
  FEEDING_DEPTHS.QUICK_BITE,
  FEEDING_DEPTHS.FULL_FEED,
  FEEDING_DEPTHS.DRAIN
]);

const DEPTH_RANK = Object.freeze({
  [FEEDING_DEPTHS.NONE]: 0,
  [FEEDING_DEPTHS.QUICK_BITE]: 1,
  [FEEDING_DEPTHS.FULL_FEED]: 2,
  [FEEDING_DEPTHS.DRAIN]: 3
});

const HUMAN_THRESHOLDS = Object.freeze({
  [FEEDING_DEPTHS.QUICK_BITE]: 0.65,
  [FEEDING_DEPTHS.FULL_FEED]: 1.65,
  [FEEDING_DEPTHS.DRAIN]: 3.0
});

const RAT_THRESHOLDS = Object.freeze({
  [FEEDING_DEPTHS.DRAIN]: 1.0
});

const HUMAN_TOTAL_RELIEF = Object.freeze({
  [FEEDING_DEPTHS.QUICK_BITE]: 14,
  [FEEDING_DEPTHS.FULL_FEED]: 34,
  [FEEDING_DEPTHS.DRAIN]: 58
});

const RAT_TOTAL_RELIEF = Object.freeze({
  [FEEDING_DEPTHS.DRAIN]: 12
});

export const FEEDING_RULES = Object.freeze({
  thresholds: HUMAN_THRESHOLDS,
  ratThresholds: RAT_THRESHOLDS,
  totalRelief: HUMAN_TOTAL_RELIEF,
  ratTotalRelief: RAT_TOTAL_RELIEF,
  quickBiteDisorientationSeconds: 2.2
});

export function feedingDepthRank(depth) {
  return DEPTH_RANK[String(depth || FEEDING_DEPTHS.NONE)] || 0;
}

export function feedingDepthLabel(depth) {
  if (depth === FEEDING_DEPTHS.QUICK_BITE) return "QUICK BITE";
  if (depth === FEEDING_DEPTHS.FULL_FEED) return "FULL FEED";
  if (depth === FEEDING_DEPTHS.DRAIN) return "DRAIN";
  return "FEED";
}

export function feedingThresholdsFor(type) {
  return type === NPC_TYPES.RAT ? RAT_THRESHOLDS : HUMAN_THRESHOLDS;
}

export function feedingThresholdFor(type, depth) {
  const value = Number(feedingThresholdsFor(type)[depth]);
  return Number.isFinite(value) ? value : null;
}

export function feedingDurationFor(type) {
  return feedingThresholdFor(type, FEEDING_DEPTHS.DRAIN) || HUMAN_THRESHOLDS[FEEDING_DEPTHS.DRAIN];
}

export function deepestFeedingDepthAt(time, type, { afterDepth = FEEDING_DEPTHS.NONE } = {}) {
  const elapsed = Math.max(0, Number(time) || 0);
  const minimumRank = feedingDepthRank(afterDepth);
  const thresholds = feedingThresholdsFor(type);
  let result = FEEDING_DEPTHS.NONE;
  for (const depth of FEEDING_DEPTH_ORDER) {
    const threshold = Number(thresholds[depth]);
    if (!Number.isFinite(threshold)) continue;
    if (feedingDepthRank(depth) <= minimumRank) continue;
    if (elapsed + 1e-9 >= threshold) result = depth;
  }
  return result;
}

export function nextFeedingDepth(type, currentDepth = FEEDING_DEPTHS.NONE) {
  const currentRank = feedingDepthRank(currentDepth);
  const thresholds = feedingThresholdsFor(type);
  return FEEDING_DEPTH_ORDER.find(depth => (
    feedingDepthRank(depth) > currentRank && Number.isFinite(Number(thresholds[depth]))
  )) || null;
}

export function feedingTotalRelief(type, depth) {
  const table = type === NPC_TYPES.RAT ? RAT_TOTAL_RELIEF : HUMAN_TOTAL_RELIEF;
  return Math.max(0, Number(table[depth]) || 0);
}

export function feedingIncrementalRelief(type, depth, previousDepth = FEEDING_DEPTHS.NONE) {
  return Math.max(0, feedingTotalRelief(type, depth) - feedingTotalRelief(type, previousDepth));
}

export function feedingOutcomeFor(type, depth, { alreadyDowned = false } = {}) {
  if (type === NPC_TYPES.RAT) {
    return {
      victimOutcome: "dead",
      victimAlive: false,
      victimConscious: false,
      bodyEvidence: false,
      biteEvidence: false,
      memoryState: "none",
      bloodStains: 0,
      neutralized: true,
      lethal: true,
      recoverableVictim: false
    };
  }

  if (depth === FEEDING_DEPTHS.QUICK_BITE) {
    return {
      victimOutcome: alreadyDowned ? "unconscious" : "disoriented",
      victimAlive: true,
      victimConscious: !alreadyDowned,
      bodyEvidence: false,
      biteEvidence: true,
      memoryState: alreadyDowned ? "fragmented" : "partial",
      bloodStains: 0,
      neutralized: alreadyDowned,
      lethal: false,
      recoverableVictim: alreadyDowned
    };
  }

  if (depth === FEEDING_DEPTHS.FULL_FEED) {
    return {
      victimOutcome: "unconscious",
      victimAlive: true,
      victimConscious: false,
      bodyEvidence: false,
      biteEvidence: true,
      memoryState: "fragmented",
      bloodStains: 1,
      neutralized: true,
      lethal: false,
      recoverableVictim: true
    };
  }

  return {
    victimOutcome: "dead",
    victimAlive: false,
    victimConscious: false,
    bodyEvidence: true,
    biteEvidence: true,
    memoryState: "none",
    bloodStains: 3,
    neutralized: true,
    lethal: true,
    recoverableVictim: false
  };
}
