import { COMBAT_STATES } from "./combat.js";
import { NPC_TYPES } from "./npcs.js";
import { angleBetween, pointInsideCone } from "../utils/geometry.js";

export const DRAIN_KINDS = Object.freeze({
  DOWNED: "downed",
  REAR: "rear",
  RAT: "rat"
});

export const DRAIN_RULES = Object.freeze({
  // Unarmed punches can connect at 32 units. Keep drain acquisition slightly
  // beyond that so a freshly downed target is immediately feedable without a
  // confusing extra shuffle toward the body.
  range: 34,
  breakRange: 42,
  aimHalfAngle: 1.0,
  rearHalfAngle: 0.92,
  invalidFeedbackMs: 650
});

const DRAINABLE_TYPES = new Set([
  NPC_TYPES.CIVILIAN,
  NPC_TYPES.TARGET,
  NPC_TYPES.POLICE,
  NPC_TYPES.HUNTER,
  NPC_TYPES.THUG,
  NPC_TYPES.RAT
]);

export function npcAwareOfPlayer(npc) {
  if (!npc) return true;
  return Boolean(
    npc.alarmed
    || npc.chasingPlayer
    || npc.enemyAttack
    || (npc.reactionTimer || 0) > 0
    || npc.reportTarget
    || npc.hasReported
    || (npc.type === NPC_TYPES.HUNTER && npc.hunterIntent === "hunt")
  );
}

export function evaluateDrainCandidate(
  player,
  aimDirection,
  npc,
  {
    currentLayer = player?.layer,
    range = DRAIN_RULES.range,
    aimHalfAngle = DRAIN_RULES.aimHalfAngle,
    rearHalfAngle = DRAIN_RULES.rearHalfAngle,
    lineClear = () => true
  } = {}
) {
  const invalid = reason => ({ eligible: false, reason, kind: null, distance: Infinity, aimAngle: Infinity });
  if (!player || !npc || !DRAINABLE_TYPES.has(npc.type)) return invalid("invalid-target");
  if (npc.dead || npc.inactive || npc.hiddenBody || npc.intercepted || npc.missionInformant) return invalid("unavailable");
  if (currentLayer !== undefined && npc.layer !== currentLayer) return invalid("different-layer");

  const dx = npc.x - player.x;
  const dy = npc.y - player.y;
  const distance = Math.hypot(dx, dy);
  if (distance > range) return invalid("out-of-range");
  if (!lineClear(npc)) return invalid("blocked");

  const targetDirection = distance > 0.001 ? { x: dx / distance, y: dy / distance } : { x: 0, y: 0 };
  const aimAngle = distance > 0.001 ? angleBetween(aimDirection, targetDirection) : 0;
  if (distance > 0.001 && aimAngle > aimHalfAngle) {
    return { eligible: false, reason: "not-aimed", kind: null, distance, aimAngle };
  }

  if (npc.type === NPC_TYPES.RAT) {
    return { eligible: true, reason: "rat", kind: DRAIN_KINDS.RAT, distance, aimAngle };
  }

  if (npc.combat?.state === COMBAT_STATES.DOWNED) {
    return { eligible: true, reason: "downed", kind: DRAIN_KINDS.DOWNED, distance, aimAngle };
  }

  if (npcAwareOfPlayer(npc)) {
    return { eligible: false, reason: "aware", kind: null, distance, aimAngle };
  }

  const rearFacing = { x: -(npc.dirX || 0), y: -(npc.dirY || 1) };
  const behind = pointInsideCone(npc, rearFacing, player, range, rearHalfAngle);
  if (!behind) return { eligible: false, reason: "not-behind", kind: null, distance, aimAngle };

  return { eligible: true, reason: "rear", kind: DRAIN_KINDS.REAR, distance, aimAngle };
}

export function selectDrainCandidate(player, aimDirection, npcs = [], options = {}) {
  let best = null;
  let bestScore = Infinity;

  for (const npc of npcs) {
    const evaluation = evaluateDrainCandidate(player, aimDirection, npc, options);
    if (!evaluation.eligible) continue;

    const kindPriority = evaluation.kind === DRAIN_KINDS.DOWNED
      ? 0
      : evaluation.kind === DRAIN_KINDS.RAT
        ? 1
        : 2;
    const missionBonus = npc.type === NPC_TYPES.TARGET ? -0.5 : 0;
    const score = kindPriority * 10000 + evaluation.distance * 10 + evaluation.aimAngle * 24 + missionBonus;

    if (score < bestScore) {
      bestScore = score;
      best = { npc, ...evaluation, score };
    }
  }

  return best;
}
