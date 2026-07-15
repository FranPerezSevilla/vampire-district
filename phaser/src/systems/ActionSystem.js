import { NPC_TYPES } from "../data/npcs.js";
import { LAYERS } from "../data/district.js";
import { RawAudio } from "./RawAudioSystem.js";

const FELONY_REPORT_CHANCE = 0.5;

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
    policeRadius: 150,
    witnessRadius: 120,
    witnessSeverity: 9
  },
  roofDrop: {
    label: "falling from a roof",
    breaksMasquerade: false,
    isFelony: true,
    heat: 18,
    policeRadius: 165,
    witnessRadius: 135,
    witnessSeverity: 9
  },
  breakLight: {
    label: "streetlight vandalism",
    breaksMasquerade: false,
    isFelony: true,
    heat: 22,
    policeRadius: 170,
    witnessRadius: 145,
    witnessSeverity: 10
  },
  stun: {
    label: "assault",
    breaksMasquerade: false,
    isFelony: true,
    heat: 12,
    policeRadius: 135,
    witnessRadius: 110,
    witnessSeverity: 8
  },
  kill: {
    label: "homicide",
    breaksMasquerade: false,
    isFelony: true,
    heat: 28,
    policeRadius: 155,
    witnessRadius: 125,
    witnessSeverity: 16
  },
  drain: {
    label: "vampire drain",
    breaksMasquerade: true,
    isFelony: true,
    heat: 36,
    policeRadius: 165,
    witnessRadius: 150,
    witnessSeverity: 24
  },
  bodyDrag: {
    label: "grabbing a body",
    breaksMasquerade: false,
    isFelony: true,
    heat: 14,
    policeRadius: 140,
    witnessRadius: 125,
    witnessSeverity: 13
  },
  bodyCarry: {
    label: "carrying a body",
    breaksMasquerade: false,
    isFelony: true,
    heat: 14,
    policeRadius: 145,
    witnessRadius: 130,
    witnessSeverity: 13
  },
  bodyDrop: {
    label: "dropping a body",
    breaksMasquerade: false,
    isFelony: true,
    heat: 10,
    policeRadius: 120,
    witnessRadius: 115,
    witnessSeverity: 11
  },
  bodyHide: {
    label: "hiding a body",
    breaksMasquerade: false,
    isFelony: true,
    heat: 8,
    policeRadius: 110,
    witnessRadius: 105,
    witnessSeverity: 12
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
  if (!rule) return { rule: null, policeWitnesses: [], felonyReporters: [] };

  if (isOnCooldown(scene, context.cooldownKey, context.cooldown)) {
    return { rule, policeWitnesses: [], felonyReporters: [], skipped: true };
  }

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

  const felonyReporters = rule.isFelony && !rule.breaksMasquerade
    ? felonyWitnesses(scene, subject, rule.witnessRadius || 120, context.exclude || [])
      .filter(() => Math.random() < FELONY_REPORT_CHANCE)
    : [];

  if (felonyReporters.length) {
    RawAudio.play("witnessWtf", { cooldown: 0.6 });
    for (const witness of felonyReporters) {
      scene.witnessSystem?.alarmWitness(witness, rule.label, rule.witnessSeverity || rule.heat || 10, {
        masqueradeRisk: false,
        reactionSeconds: context.reactionSeconds ?? 1.0,
        source: subject
      });
    }
    scene.exposureSystem?.add(Math.max(2, Math.ceil((rule.witnessSeverity || 8) * 0.25)), `A witness may report ${rule.label}.`);
    scene.lastActionText = appendWitnessNotice(scene.lastActionText, rule.label, felonyReporters.length);
  }

  return {
    rule,
    policeWitnesses,
    felonyReporters,
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

function felonyWitnesses(scene, subject, radius, exclude = []) {
  if (!scene?.npcSystem || !radius || subject.layer !== LAYERS.STREET) return [];
  const excluded = new Set(exclude.filter(Boolean));
  return scene.npcSystem.npcs.filter(npc => {
    if (excluded.has(npc)) return false;
    if (![NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET].includes(npc.type)) return false;
    if (npc.dead || npc.inactive || npc.intercepted || npc.stunnedTimer > 0 || npc.alarmed) return false;
    if (npc.layer !== subject.layer) return false;
    return scene.witnessSystem?.canWitnessSee?.(npc, subject, radius)
      || Phaser.Math.Distance.Between(npc.x, npc.y, subject.x, subject.y) <= 36;
  });
}

function isOnCooldown(scene, key, seconds = 0) {
  if (!scene || !key || !seconds) return false;
  scene.actionCooldowns ||= Object.create(null);
  const now = scene.time?.now ? scene.time.now / 1000 : 0;
  if (scene.actionCooldowns[key] && scene.actionCooldowns[key] > now) return true;
  scene.actionCooldowns[key] = now + seconds;
  return false;
}

function appendPoliceNotice(text, label, count) {
  const base = text || "";
  const suffix = `Police witness ${label}; exposure is at least level 1 (${count}).`;
  if (!base) return suffix;
  if (base.includes("Police witness")) return base;
  return `${base} ${suffix}`;
}

function appendWitnessNotice(text, label, count) {
  const base = text || "";
  const suffix = `${count} civilian witness(es) may report ${label}.`;
  if (!base) return suffix;
  if (base.includes("civilian witness")) return base;
  return `${base} ${suffix}`;
}
