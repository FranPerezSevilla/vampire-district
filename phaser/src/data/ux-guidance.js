import { COMBAT_STATES } from "./combat.js";
import { NPC_TYPES } from "./npcs.js";

export const UX_STORAGE_KEYS = Object.freeze({
  AIM_HIGH_CONTRAST: "nbd-aim-high-contrast"
});

export const WEAPON_GUIDANCE_STATES = Object.freeze({
  LOCKED: "locked",
  AWAITING_CYCLE: "awaiting-cycle",
  COMPLETE: "complete"
});

export const RECOVERY_GUIDANCE = Object.freeze({
  urgentMs: 4_000,
  policeLabel: "POLICE RISES",
  hunterLabel: "HUNTER RISES"
});

export function normalizeBooleanPreference(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value == null || value === "") return Boolean(fallback);
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on", "enabled"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "disabled"].includes(normalized)) return false;
  return Boolean(fallback);
}

export function weaponGuidanceState({ tutorialComplete = false, weaponChanges = 0 } = {}) {
  if (!tutorialComplete) return WEAPON_GUIDANCE_STATES.LOCKED;
  if (Math.max(0, Number(weaponChanges) || 0) < 1) return WEAPON_GUIDANCE_STATES.AWAITING_CYCLE;
  return WEAPON_GUIDANCE_STATES.COMPLETE;
}

export function isRecoverableNpcType(type) {
  return type === NPC_TYPES.POLICE || type === NPC_TYPES.HUNTER;
}

export function recoveryGuidanceState(npc, now = 0) {
  const recoverAt = Number(npc?.ai?.recoverAt);
  const downed = Boolean(
    npc
    && !npc.dead
    && !npc.inactive
    && !npc.hiddenBody
    && !npc.intercepted
    && npc.combat?.state === COMBAT_STATES.DOWNED
  );

  if (!downed || !isRecoverableNpcType(npc.type) || npc.drainVictim || !Number.isFinite(recoverAt)) {
    return {
      visible: false,
      remainingMs: 0,
      seconds: 0,
      urgent: false,
      label: ""
    };
  }

  const remainingMs = Math.max(0, recoverAt - Math.max(0, Number(now) || 0));
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const prefix = npc.type === NPC_TYPES.HUNTER
    ? RECOVERY_GUIDANCE.hunterLabel
    : RECOVERY_GUIDANCE.policeLabel;

  return {
    visible: true,
    remainingMs,
    seconds,
    urgent: remainingMs <= RECOVERY_GUIDANCE.urgentMs,
    label: seconds > 0 ? `${prefix} ${seconds}s` : `${prefix} NOW`
  };
}

export function aimPresentation(highContrast = false) {
  return highContrast
    ? Object.freeze({
        enabled: true,
        outerColor: 0x05060b,
        innerColor: 0xffffff,
        outerWidth: 6,
        innerWidth: 2,
        reticleRadius: 7,
        crossRadius: 10,
        alpha: 1
      })
    : Object.freeze({
        enabled: false,
        outerColor: 0x05060b,
        innerColor: 0xffffff,
        outerWidth: 0,
        innerWidth: 0,
        reticleRadius: 4,
        crossRadius: 0,
        alpha: 0
      });
}
