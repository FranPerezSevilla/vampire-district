import { NPC_TYPES } from "../data/npcs.js";
import { LAYERS } from "../data/district.js";
import { RawAudio } from "./RawAudioSystem.js";

export const ACTION_RULES = Object.freeze({
  whisper: {
    label: "Vampiric Whisper",
    breaksMasquerade: false,
    isFelony: false,
    heat: 0,
    policeRadius: 0
  },
  bloodSense: {
    label: "Blood Sense",
    breaksMasquerade: false,
    isFelony: false,
    heat: 0,
    policeRadius: 0
  },
  shadowDash: {
    label: "impossible dash",
    breaksMasquerade: false,
    isFelony: true,
    heat: 16,
    policeRadius: 150
  },
  roofDrop: {
    label: "falling from a roof",
    breaksMasquerade: false,
    isFelony: true,
    heat: 18,
    policeRadius: 165
  },
  breakLight: {
    label: "streetlight vandalism",
    breaksMasquerade: false,
    isFelony: true,
    heat: 22,
    policeRadius: 170
  },
  stun: {
    label: "assault",
    breaksMasquerade: false,
    isFelony: true,
    heat: 12,
    policeRadius: 135
  },
  kill: {
    label: "homicide",
    breaksMasquerade: false,
    isFelony: true,
    heat: 28,
    policeRadius: 155
  },
  drain: {
    label: "vampire drain",
    breaksMasquerade: true,
    isFelony: true,
    heat: 36,
    policeRadius: 165
  },
  bodyDrag: {
    label: "dragging a body",
    breaksMasquerade: false,
    isFelony: true,
    heat: 14,
    policeRadius: 140
  },
  bodyDrop: {
    label: "dropping a body",
    breaksMasquerade: false,
    isFelony: true,
    heat: 10,
    policeRadius: 120
  },
  bodyHide: {
    label: "hiding a body",
    breaksMasquerade: false,
    isFelony: true,
    heat: 8,
    policeRadius: 110
  },
  roofJump: {
    label: "rooftop jump",
    breaksMasquerade: false,
    isFelony: false,
    heat: 0,
    policeRadius: 0
  },
  fireEscape: {
    label: "using a fire escape",
    breaksMasquerade: false,
    isFelony: false,
    heat: 0,
    policeRadius: 0
  }
});

export function resolveAction(scene, actionId, context = {}) {
  const rule = ACTION_RULES[actionId];
  if (!rule) return { rule: null, policeWitnesses: [] };

  const subject = subjectFrom(scene, context);
  const policeWitnesses = rule.isFelony
    ? policeSeeing(scene, subject, rule.policeRadius, context.exclude || [])
    : [];

  if (policeWitnesses.length) {
    const reason = `Police saw ${rule.label}.`;
    scene.exposureSystem?.forceLevel(1, reason);
    scene.policeSystem?.addHeat(subject.x, subject.y, rule.heat || 10, reason);
    RawAudio.play("police", { cooldown: 0.35 });
    scene.lastActionText = appendPoliceNotice(scene.lastActionText, rule.label, policeWitnesses.length);
  }

  return {
    rule,
    policeWitnesses,
    breaksMasquerade: rule.breaksMasquerade,
    isFelony: rule.isFelony
  };
}

function subjectFrom(scene, context) {
  const target = context.target || null;
  return {
    x: context.x ?? target?.x ?? scene.player?.x ?? 0,
    y: context.y ?? target?.y ?? scene.player?.y ?? 0,
    layer: context.layer ?? target?.layer ?? scene.currentLayer
  };
}

function policeSeeing(scene, subject, radius, exclude = []) {
  if (!scene?.npcSystem || !radius) return [];
  const excluded = new Set(exclude.filter(Boolean));
  return scene.npcSystem.npcs.filter(npc => {
    if (excluded.has(npc)) return false;
    if (npc.type !== NPC_TYPES.POLICE) return false;
    if (npc.dead || npc.inactive || npc.intercepted || npc.stunnedTimer > 0) return false;
    if (npc.layer !== subject.layer || npc.layer !== LAYERS.STREET) return false;

    if (scene.witnessSystem?.canWitnessSee) {
      return scene.witnessSystem.canWitnessSee(npc, subject, radius);
    }

    return Phaser.Math.Distance.Between(npc.x, npc.y, subject.x, subject.y) <= radius;
  });
}

function appendPoliceNotice(text, label, count) {
  const base = text || "";
  const suffix = `Police witness ${label}; exposure is at least level 1 (${count}).`;
  if (!base) return suffix;
  if (base.includes("Police witness")) return base;
  return `${base} ${suffix}`;
}
