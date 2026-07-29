import { COMBAT_STATES } from "./combat.js";
import { NPC_TYPES } from "./npcs.js";

export const BEAST_STATES = Object.freeze({
  CONTROLLED: "controlled",
  STRAINED: "strained",
  RAVENOUS: "ravenous",
  CRITICAL: "critical"
});

export const WHISPER_COMMANDS = Object.freeze({
  COME_HERE: "come_here",
  WALK_AWAY: "walk_away",
  STAY_CALM: "stay_calm",
  FORGET_THIS: "forget_this",
  OPEN_IT: "open_it",
  GET_IN: "get_in",
  CALL_THEM_OFF: "call_them_off"
});

export const WHISPER_COMMAND_CONFIG = Object.freeze({
  [WHISPER_COMMANDS.COME_HERE]: Object.freeze({ label: "Come here", cost: 8, difficulty: 0, duration: 7.0 }),
  [WHISPER_COMMANDS.WALK_AWAY]: Object.freeze({ label: "Walk away", cost: 7, difficulty: 0, duration: 8.0 }),
  [WHISPER_COMMANDS.STAY_CALM]: Object.freeze({ label: "Stay calm", cost: 10, difficulty: 1, duration: 6.0 }),
  [WHISPER_COMMANDS.FORGET_THIS]: Object.freeze({ label: "Forget this", cost: 16, difficulty: 2, duration: 0 }),
  [WHISPER_COMMANDS.OPEN_IT]: Object.freeze({ label: "Open it", cost: 12, difficulty: 1, duration: 0 }),
  [WHISPER_COMMANDS.GET_IN]: Object.freeze({ label: "Get in", cost: 10, difficulty: 1, duration: 10.0 }),
  [WHISPER_COMMANDS.CALL_THEM_OFF]: Object.freeze({ label: "Call them off", cost: 22, difficulty: 3, duration: 0 })
});

export const PREDATOR_POWER_RULES = Object.freeze({
  bloodSense: Object.freeze({
    seconds: 5,
    baseRange: 320,
    minimumIntensity: 0.14
  }),
  whisper: Object.freeze({
    baseRange: 178,
    failureCooldown: 1.15,
    successCooldown: 4.8,
    witnessedRadius: 122,
    resistedRadius: 150
  }),
  giveIn: Object.freeze({
    cost: 14,
    seconds: 6,
    cooldown: 18,
    movementMultiplier: 1.28,
    feedingMultiplier: 1.38,
    attackTimeMultiplier: 0.82,
    meleeDamageBonus: 1,
    witnessRadius: 180,
    witnessSeverity: 28,
    evidenceWeight: 24
  })
});

const BEAST_PROFILES = Object.freeze({
  [BEAST_STATES.CONTROLLED]: Object.freeze({
    min: 0,
    label: "CONTROLLED",
    senseRangeMultiplier: 1,
    heartbeatIntensity: 1,
    feedingMultiplier: 1,
    whisperPower: 5
  }),
  [BEAST_STATES.STRAINED]: Object.freeze({
    min: 50,
    label: "STRAINED",
    senseRangeMultiplier: 1.10,
    heartbeatIntensity: 1.12,
    feedingMultiplier: 1.05,
    whisperPower: 4.65
  }),
  [BEAST_STATES.RAVENOUS]: Object.freeze({
    min: 70,
    label: "RAVENOUS",
    senseRangeMultiplier: 1.24,
    heartbeatIntensity: 1.28,
    feedingMultiplier: 1.11,
    whisperPower: 4.05
  }),
  [BEAST_STATES.CRITICAL]: Object.freeze({
    min: 85,
    label: "CRITICAL",
    senseRangeMultiplier: 1.42,
    heartbeatIntensity: 1.48,
    feedingMultiplier: 1.18,
    whisperPower: 3.45
  })
});

const TYPE_RESISTANCE = Object.freeze({
  [NPC_TYPES.CIVILIAN]: 1,
  [NPC_TYPES.TARGET]: 2,
  [NPC_TYPES.THUG]: 3,
  [NPC_TYPES.POLICE]: 4,
  [NPC_TYPES.HUNTER]: Number.POSITIVE_INFINITY,
  [NPC_TYPES.RAT]: Number.POSITIVE_INFINITY
});

const READING_COLORS = Object.freeze({
  heartbeat: 0xe65b77,
  wounded: 0xff334f,
  unconscious: 0xff8b68,
  bitten: 0xd75cff,
  drained: 0x8b1736,
  dead: 0x69636f,
  silent: 0x9f8cff,
  rat: 0xa69a86
});

function finite(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

export function beastStateForHunger(hunger) {
  const value = clamp(hunger, 0, 100);
  if (value >= BEAST_PROFILES[BEAST_STATES.CRITICAL].min) return BEAST_STATES.CRITICAL;
  if (value >= BEAST_PROFILES[BEAST_STATES.RAVENOUS].min) return BEAST_STATES.RAVENOUS;
  if (value >= BEAST_PROFILES[BEAST_STATES.STRAINED].min) return BEAST_STATES.STRAINED;
  return BEAST_STATES.CONTROLLED;
}

export function beastProfileForHunger(hunger) {
  const state = beastStateForHunger(hunger);
  return { state, ...BEAST_PROFILES[state] };
}

export function beastModifiers(hunger, { givenIn = false } = {}) {
  const profile = beastProfileForHunger(hunger);
  const burst = givenIn ? PREDATOR_POWER_RULES.giveIn : null;
  return {
    ...profile,
    givenIn: Boolean(givenIn),
    movementMultiplier: burst?.movementMultiplier || 1,
    feedingMultiplier: profile.feedingMultiplier * (burst?.feedingMultiplier || 1),
    attackTimeMultiplier: burst?.attackTimeMultiplier || 1,
    meleeDamageBonus: burst?.meleeDamageBonus || 0,
    whisperPower: Math.max(0, profile.whisperPower - (givenIn ? 0.35 : 0))
  };
}

export function bloodSenseRangeForHunger(hunger) {
  const profile = beastProfileForHunger(hunger);
  return PREDATOR_POWER_RULES.bloodSense.baseRange * profile.senseRangeMultiplier;
}

function feedingDepth(npc) {
  return String(npc?.feedingDepth || npc?.lastFeedingDepth || "none");
}

export function bloodSenseReading(npc, {
  player = { x: 0, y: 0 },
  hunger = 0,
  protectionKnown = false
} = {}) {
  if (!npc || npc.hiddenBody || npc.inactive || npc.intercepted) return null;
  const distance = Math.hypot(finite(npc.x) - finite(player.x), finite(npc.y) - finite(player.y));
  const range = bloodSenseRangeForHunger(hunger);
  if (distance > range) return null;

  const depth = feedingDepth(npc);
  const noHeartbeat = Boolean(npc.noHeartbeat || npc.vampire || npc.supernaturalKind === "vampire");
  const downed = Boolean(npc.feedingUnconscious || npc.combat?.state === COMBAT_STATES.DOWNED);
  const wounded = Boolean(
    npc.combat
    && finite(npc.combat.maxResilience) > 0
    && finite(npc.combat.resilience, npc.combat.maxResilience) < finite(npc.combat.maxResilience)
  );

  let kind = "heartbeat";
  let label = "HEARTBEAT";
  let vulnerability = 1;

  if (npc.dead) {
    kind = npc.deathKind === "drained" || depth === "drain" ? "drained" : "dead";
    label = kind === "drained" ? "DRAINED" : "DEAD";
    vulnerability = 0;
  } else if (noHeartbeat) {
    kind = "silent";
    label = "NO HEARTBEAT";
    vulnerability = 0.4;
  } else if (npc.type === NPC_TYPES.RAT) {
    kind = "rat";
    label = "RAT";
    vulnerability = 0.65;
  } else if (downed || depth === "full_feed") {
    kind = "unconscious";
    label = "UNCONSCIOUS";
    vulnerability = 1.55;
  } else if (depth === "quick_bite") {
    kind = "bitten";
    label = "BITTEN";
    vulnerability = 1.28;
  } else if (wounded) {
    kind = "wounded";
    label = "WOUNDED";
    vulnerability = 1.36;
  }

  const profile = beastProfileForHunger(hunger);
  const distanceFactor = clamp(1 - distance / Math.max(1, range), 0, 1);
  const intensity = kind === "dead"
    ? 0.08
    : kind === "drained"
      ? 0.15
      : clamp(
        PREDATOR_POWER_RULES.bloodSense.minimumIntensity
          + distanceFactor * 0.72 * profile.heartbeatIntensity * vulnerability,
        0.08,
        1.6
      );

  return {
    id: String(npc.id || "subject"),
    kind,
    label,
    color: READING_COLORS[kind] || READING_COLORS.heartbeat,
    x: finite(npc.x),
    y: finite(npc.y),
    layer: finite(npc.layer),
    distance,
    range,
    intensity,
    vulnerability,
    protectionKnown: Boolean(protectionKnown),
    protectedLabel: protectionKnown ? "PROTECTED" : null,
    heartbeat: !npc.dead && !noHeartbeat,
    behindCover: false
  };
}

export function whisperCommandConfig(command) {
  return WHISPER_COMMAND_CONFIG[String(command || "")] || null;
}

export function whisperPowerForHunger(hunger, options = {}) {
  return beastModifiers(hunger, options).whisperPower;
}

export function whisperResistanceForTarget(target, command, {
  susceptible = false,
  contextResistance = 0
} = {}) {
  if (!target || target.dead || target.inactive || target.intercepted || target.noMind) return Number.POSITIVE_INFINITY;
  let value = finite(target.whisperResistance, TYPE_RESISTANCE[target.type] ?? 3);
  if (!Number.isFinite(value)) return Number.POSITIVE_INFINITY;
  if (target.trained || target.disciplineTrained) value += 1;
  if (target.alarmed || target.chasingPlayer || target.thugHostile || target.hunterIntent === "hunt") value += 1.5;
  if (target.hasReported) value += 3;
  if (target.combat?.state === COMBAT_STATES.DOWNED || target.stunnedTimer > 0) value -= 0.75;
  if (susceptible || target.whisperSusceptible || target.compromised) value -= 3.5;
  if (command === WHISPER_COMMANDS.FORGET_THIS) value += 0.5;
  if (command === WHISPER_COMMANDS.CALL_THEM_OFF) value += 1;
  return Math.max(0, value + finite(contextResistance));
}

export function whisperCommandAvailability(command, target, context = {}) {
  const id = String(command || "");
  const config = whisperCommandConfig(id);
  if (!config) return { available: false, reason: "Unknown command." };
  if (!target || target.dead || target.inactive || target.intercepted || target.noMind) {
    return { available: false, reason: "No reachable mind." };
  }
  if (target.type === NPC_TYPES.HUNTER || target.type === NPC_TYPES.RAT) {
    return { available: false, reason: "This mind cannot be compelled." };
  }

  if ([WHISPER_COMMANDS.COME_HERE, WHISPER_COMMANDS.WALK_AWAY].includes(id)) {
    const calm = !target.alarmed && !target.reportTarget && !target.hasReported && !target.chasingPlayer;
    return { available: calm, reason: calm ? "Movement command available." : "Calm the target before redirecting them." };
  }
  if (id === WHISPER_COMMANDS.STAY_CALM) {
    if (target.hasReported) return { available: false, reason: "The report has already left the scene." };
    const agitated = Boolean(target.alarmed || target.reportTarget || target.reactionTimer > 0 || target.soundReactionTimer > 0);
    return { available: agitated, reason: agitated ? "Panic can still be suppressed." : "Target is already calm." };
  }
  if (id === WHISPER_COMMANDS.FORGET_THIS) {
    const memories = Array.isArray(context.latentMemoryIds) ? context.latentMemoryIds : [];
    const available = [NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET].includes(target.type)
      && !target.hasReported
      && memories.length > 0;
    return { available, reason: available ? "Latent memory can be blurred." : "No latent memory remains to erase." };
  }
  if (id === WHISPER_COMMANDS.OPEN_IT) {
    const calm = !target.alarmed && !target.chasingPlayer && !target.hasReported;
    return { available: Boolean(calm && context.openTarget), reason: context.openTarget ? "A compatible access is nearby." : "Nothing compatible can be opened." };
  }
  if (id === WHISPER_COMMANDS.GET_IN) {
    const allowedType = [NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET, NPC_TYPES.THUG].includes(target.type);
    const calm = !target.alarmed && !target.chasingPlayer && !target.hasReported;
    return { available: Boolean(calm && allowedType && context.vehicle && !target.whisperPassengerVehicleId), reason: context.vehicle ? "A stopped vehicle is nearby." : "No stopped non-police vehicle is nearby." };
  }
  if (id === WHISPER_COMMANDS.CALL_THEM_OFF) {
    const available = target.type === NPC_TYPES.POLICE
      && Boolean(context.canCallOff)
      && finite(context.heatLevel) > 0;
    return { available, reason: available ? "This authority can reach the active response." : "This target cannot call off the response." };
  }
  return { available: false, reason: "Command unavailable." };
}

export function evaluateWhisperCommand(command, target, {
  hunger = 0,
  givenIn = false,
  ...context
} = {}) {
  const config = whisperCommandConfig(command);
  const availability = whisperCommandAvailability(command, target, context);
  const power = whisperPowerForHunger(hunger, { givenIn });
  const resistance = whisperResistanceForTarget(target, command, context);
  const threshold = resistance + finite(config?.difficulty);
  return {
    command,
    config,
    availability,
    power,
    resistance,
    threshold,
    succeeds: Boolean(availability.available && Number.isFinite(resistance) && power + 1e-9 >= threshold)
  };
}

export function whisperCommandLabel(command) {
  return whisperCommandConfig(command)?.label || String(command || "Whisper");
}
