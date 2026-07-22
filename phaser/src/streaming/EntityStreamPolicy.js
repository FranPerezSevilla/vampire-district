import { COMBAT_STATES } from "../data/combat.js";
import { NPC_TYPES } from "../data/npcs.js";

export const ENTITY_STREAM_STATES = Object.freeze({
  ACTIVE: "active",
  PINNED: "pinned",
  DORMANT: "dormant"
});

export function npcCriticalReason(npc, context = {}) {
  if (!npc) return null;
  if (npc.missionInformant) return "mission-informant";
  if (npc.type === NPC_TYPES.TARGET && !npc.dead && !npc.inactive) return "mission-target";
  if (npc.dragged) return "dragged-body";
  if (npc.drainVictim) return "drain-victim";
  if (npc.enemyAttack) return "combat-attack";
  if (npc.chasingPlayer) return "chasing-player";
  if (npc.alarmed) return "alarmed";
  if ((Number(npc.luredTimer) || 0) > 0) return "whisper-lure";
  if ((Number(npc.soundReactionTimer) || 0) > 0) return "sound-reaction";
  if (npc.investigateTarget) return "investigation";
  if (npc.thugHostile) return "hostile-thug";
  if (npc.intercepted) return "mission-intercept";
  if (npc.combat?.state === COMBAT_STATES.STAGGERED) return "combat-staggered";
  if (npc.type === NPC_TYPES.HUNTER && (npc.hunterIntent || context.hunterRevealed || Number(context.exposureLevel) >= 4)) return "hunter-alert";
  return null;
}

export function npcStreamDecision(npc, context = {}) {
  const reason = npcCriticalReason(npc, context);
  if (reason) return { state: ENTITY_STREAM_STATES.PINNED, reason };
  if (context.active) return { state: ENTITY_STREAM_STATES.ACTIVE, reason: "active-chunk" };
  return { state: ENTITY_STREAM_STATES.DORMANT, reason: context.prefetched ? "prefetched-chunk" : "unloaded-chunk" };
}

export function vehicleStreamDecision(vehicle, context = {}) {
  if (context.currentVehicleId && vehicle?.id === context.currentVehicleId) {
    return { state: ENTITY_STREAM_STATES.PINNED, reason: "occupied-vehicle" };
  }
  if (Math.abs(Number(vehicle?.speed) || 0) > 0.5) {
    return { state: ENTITY_STREAM_STATES.PINNED, reason: "moving-vehicle" };
  }
  if (context.active) return { state: ENTITY_STREAM_STATES.ACTIVE, reason: "active-chunk" };
  return { state: ENTITY_STREAM_STATES.DORMANT, reason: context.prefetched ? "prefetched-chunk" : "unloaded-chunk" };
}