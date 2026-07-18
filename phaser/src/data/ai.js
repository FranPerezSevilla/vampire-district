import { COMBAT_STATES } from "./combat.js";
import { NPC_TYPES } from "./npcs.js";

export const AI_STATES = Object.freeze({
  INACTIVE: "inactive",
  DEAD: "dead",
  DOWNED: "downed",
  DRAINING: "being-drained",
  STAGGERED: "staggered",
  ATTACKING: "attacking",
  CHASING: "chasing",
  FLEEING: "fleeing",
  LURED: "lured",
  INVESTIGATING: "investigating",
  SEARCHING: "searching",
  PATROLLING: "patrolling",
  IDLE: "idle"
});

export const AI_ROLES = Object.freeze({
  NONE: "none",
  ATTACKER: "attacker",
  CONTAIN: "contain",
  SEARCH: "search",
  PATROL: "patrol",
  REPORT: "report",
  INVESTIGATE: "investigate",
  HUNT: "hunt",
  TRACK: "track",
  BLOCK: "block",
  GUARD: "guard"
});

export const AI_STATE_PRIORITY = Object.freeze({
  [AI_STATES.INACTIVE]: 120,
  [AI_STATES.DEAD]: 115,
  [AI_STATES.DOWNED]: 110,
  [AI_STATES.DRAINING]: 100,
  [AI_STATES.STAGGERED]: 90,
  [AI_STATES.ATTACKING]: 80,
  [AI_STATES.CHASING]: 70,
  [AI_STATES.FLEEING]: 60,
  [AI_STATES.LURED]: 50,
  [AI_STATES.INVESTIGATING]: 40,
  [AI_STATES.SEARCHING]: 30,
  [AI_STATES.PATROLLING]: 20,
  [AI_STATES.IDLE]: 10
});

export const AI_RULES = Object.freeze({
  policeRecoveryMs: 18_000,
  hunterRecoveryMs: 24_000,
  recoveryStaggerMs: 1_100,
  policeLeaderHoldMs: 1_450,
  policeLeaderMaxDistance: 108,
  policeContainRadius: Object.freeze({ 1: 43, 2: 49, 3: 55 }),
  hunterMemoryMs: 6_200,
  hunterLeadDistance: 54,
  thugChaseSpeed: 30,
  thugStopDistance: 23
});

export function createNpcAiState(npcOrType, now = 0) {
  const npc = typeof npcOrType === "object" && npcOrType ? npcOrType : { type: npcOrType };
  const inactive = Boolean(npc.inactive || npc.intercepted || npc.hiddenBody);
  return {
    state: inactive ? AI_STATES.INACTIVE : AI_STATES.IDLE,
    previousState: null,
    changedAt: Math.max(0, Number(now) || 0),
    role: AI_ROLES.NONE,
    intent: "idle",
    downedAt: 0,
    recoverAt: 0,
    leaderUntil: 0,
    lastKnownX: Number(npc.x) || 0,
    lastKnownY: Number(npc.y) || 0
  };
}

export function statePriority(state) {
  return AI_STATE_PRIORITY[state] || 0;
}

export function isNpcDowned(npc) {
  return Boolean(npc?.combat?.state === COMBAT_STATES.DOWNED && !npc.dead);
}

export function recoveryDelayForType(type, rules = AI_RULES) {
  if (type === NPC_TYPES.POLICE) return rules.policeRecoveryMs;
  if (type === NPC_TYPES.HUNTER) return rules.hunterRecoveryMs;
  return Number.POSITIVE_INFINITY;
}

export function recoveryAtForType(type, downedAt, rules = AI_RULES) {
  const delay = recoveryDelayForType(type, rules);
  if (!Number.isFinite(delay)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Number(downedAt) || 0) + delay;
}

export function recoveryResilienceForType(type, maxResilience) {
  const max = Math.max(0, Math.floor(Number(maxResilience) || 0));
  if (type === NPC_TYPES.POLICE) return Math.min(max, 2);
  if (type === NPC_TYPES.HUNTER) return Math.min(max, 3);
  return 0;
}

export function shouldRecoverDowned(npc, now) {
  return Boolean(
    isNpcDowned(npc)
    && !npc.drainVictim
    && Number.isFinite(npc.ai?.recoverAt)
    && (Number(now) || 0) >= npc.ai.recoverAt
  );
}

export function resolveNpcAiState(npc, { now = 0, wantedLevel = 0 } = {}) {
  if (!npc) return AI_STATES.INACTIVE;
  if (npc.dead) return AI_STATES.DEAD;
  if (npc.inactive || npc.intercepted || npc.hiddenBody) return AI_STATES.INACTIVE;
  if (isNpcDowned(npc)) return AI_STATES.DOWNED;
  if (npc.drainVictim) return AI_STATES.DRAINING;

  const finiteStun = Number.isFinite(npc.stunnedTimer) && (npc.stunnedTimer || 0) > 0;
  if (npc.combat?.state === COMBAT_STATES.STAGGERED || finiteStun) return AI_STATES.STAGGERED;
  if (npc.enemyAttack) return AI_STATES.ATTACKING;

  if (npc.type === NPC_TYPES.POLICE && npc.chasingPlayer) return AI_STATES.CHASING;
  if (npc.type === NPC_TYPES.HUNTER
    && npc.hunterIntent === "hunt"
    && (npc.hunterMemoryUntil == null || npc.hunterMemoryUntil > now)) {
    return AI_STATES.CHASING;
  }
  if (npc.type === NPC_TYPES.THUG && npc.thugHostile) return AI_STATES.CHASING;

  if ([NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET].includes(npc.type)
    && npc.alarmed
    && npc.reportTarget
    && !npc.hasReported) {
    return AI_STATES.FLEEING;
  }

  if ((npc.luredTimer || 0) > 0 && !npc.alarmed) return AI_STATES.LURED;
  if ((npc.soundReactionTimer || 0) > 0 && !npc.alarmed && !npc.chasingPlayer) {
    return AI_STATES.INVESTIGATING;
  }

  if (npc.type === NPC_TYPES.POLICE
    && (wantedLevel >= 1 || npc.investigateTarget || npc.ai?.intent === "search")) {
    return AI_STATES.SEARCHING;
  }
  if (npc.type === NPC_TYPES.HUNTER
    && ["track", "block"].includes(npc.hunterIntent)) {
    return AI_STATES.SEARCHING;
  }

  if ([NPC_TYPES.POLICE, NPC_TYPES.HUNTER].includes(npc.type)) return AI_STATES.PATROLLING;
  return AI_STATES.IDLE;
}

function eligiblePolice(cop) {
  return Boolean(
    cop
    && cop.type === NPC_TYPES.POLICE
    && !cop.dead
    && !cop.inactive
    && !cop.hiddenBody
    && !cop.intercepted
    && !isNpcDowned(cop)
    && !(Number.isFinite(cop.stunnedTimer) && cop.stunnedTimer > 0)
    && !cop.drainVictim
  );
}

export function selectPoliceAttackLeader(
  cops,
  player,
  { previousId = null, now = 0, rules = AI_RULES } = {}
) {
  const eligible = (cops || []).filter(eligiblePolice);
  if (!eligible.length || !player) return null;

  const previous = eligible.find(cop => cop.id === previousId);
  if (previous) {
    const distance = Math.hypot(previous.x - player.x, previous.y - player.y);
    const holdActive = previous.enemyAttack || (previous.ai?.leaderUntil || 0) > now;
    if (distance <= rules.policeLeaderMaxDistance && holdActive) return previous.id;
  }

  return [...eligible]
    .sort((a, b) => {
      const score = cop => {
        const distance = Math.hypot(cop.x - player.x, cop.y - player.y);
        const cooldownPenalty = (cop.enemyAttackCooldownUntil || 0) > now ? 34 : 0;
        const reactingPenalty = (cop.soundReactionTimer || 0) > 0 ? 80 : 0;
        const previousBonus = cop.id === previousId ? -12 : 0;
        const attackingBonus = cop.enemyAttack ? -60 : 0;
        return distance + cooldownPenalty + reactingPenalty + previousBonus + attackingBonus;
      };
      const delta = score(a) - score(b);
      if (Math.abs(delta) > 1e-9) return delta;
      return String(a.id || "").localeCompare(String(b.id || ""));
    })[0]?.id || null;
}

export function policeContainmentTarget(
  player,
  slotIndex,
  slotCount,
  level = 1,
  { rotation = 0, rules = AI_RULES } = {}
) {
  const count = Math.max(1, Math.floor(Number(slotCount) || 1));
  const index = ((Math.floor(Number(slotIndex) || 0) % count) + count) % count;
  const clampedLevel = Math.max(1, Math.min(3, Math.floor(Number(level) || 1)));
  const radius = rules.policeContainRadius[clampedLevel] || rules.policeContainRadius[1];
  const angle = Number(rotation || 0) + (Math.PI * 2 * index) / count;
  return {
    x: (Number(player?.x) || 0) + Math.cos(angle) * radius,
    y: (Number(player?.y) || 0) + Math.sin(angle) * radius,
    angle,
    radius
  };
}

export function predictPursuitPoint(
  player,
  move,
  { leadDistance = AI_RULES.hunterLeadDistance, bounds = null } = {}
) {
  const length = Math.hypot(Number(move?.x) || 0, Number(move?.y) || 0);
  const nx = length > 1e-8 ? (Number(move.x) || 0) / length : 0;
  const ny = length > 1e-8 ? (Number(move.y) || 0) / length : 0;
  let x = (Number(player?.x) || 0) + nx * Math.max(0, Number(leadDistance) || 0);
  let y = (Number(player?.y) || 0) + ny * Math.max(0, Number(leadDistance) || 0);

  if (bounds) {
    const minX = Number(bounds.minX ?? 0);
    const minY = Number(bounds.minY ?? 0);
    const maxX = Number(bounds.maxX ?? bounds.width ?? x);
    const maxY = Number(bounds.maxY ?? bounds.height ?? y);
    x = Math.max(minX, Math.min(maxX, x));
    y = Math.max(minY, Math.min(maxY, y));
  }

  return { x, y };
}
