import { LAYERS } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";
import { RawAudio } from "./RawAudioSystem.js";

export const ACTION_RULES = Object.freeze({
  whisper: { label: "Whisper", breaksMasquerade: false, isFelony: false },
  bloodSense: { label: "Blood Sense", breaksMasquerade: false, isFelony: false },
  dash: { label: "Shadow Dash", breaksMasquerade: false, isFelony: true, severity: 8 },

  breakLight: { label: "breaking a streetlight", breaksMasquerade: false, isFelony: true, severity: 10 },
  roofDrop: { label: "dropping from a rooftop", breaksMasquerade: false, isFelony: true, severity: 8 },

  stun: { label: "stunning someone", breaksMasquerade: false, isFelony: true, severity: 9 },
  kill: { label: "killing someone", breaksMasquerade: false, isFelony: true, severity: 16 },
  drain: { label: "draining someone", breaksMasquerade: true, isFelony: true, severity: 24 },

  bodyDrag: { label: "grabbing a body", breaksMasquerade: false, isFelony: true, severity: 13 },
  bodyCarry: { label: "carrying a body", breaksMasquerade: false, isFelony: true, severity: 12 },
  bodyDrop: { label: "dropping a body", breaksMasquerade: false, isFelony: true, severity: 11 },
  bodyHide: { label: "hiding a body", breaksMasquerade: false, isFelony: true, severity: 13 }
});

const FELONY_REPORT_CHANCE = 0.5;

export function ruleFor(kind) {
  return ACTION_RULES[kind] || { label: kind || "action", breaksMasquerade: false, isFelony: false, severity: 0 };
}

export function recordAction(scene, kind, options = {}) {
  const rule = ruleFor(kind);
  if (!scene || !rule || scene.currentLayer !== LAYERS.STREET) {
    return { rule, police: 0, witnesses: 0 };
  }

  const key = options.cooldownKey || `${kind}:${Math.round(options.x ?? scene.player.x)}:${Math.round(options.y ?? scene.player.y)}`;
  if (isOnCooldown(scene, key, options.cooldown ?? 0.6)) {
    return { rule, police: 0, witnesses: 0, skipped: true };
  }

  const subject = options.subject || {
    x: options.x ?? scene.player.x,
    y: options.y ?? scene.player.y,
    layer: LAYERS.STREET
  };

  let policeCount = 0;
  let witnessCount = 0;

  if (rule.isFelony) {
    policeCount = policeSeeing(scene, subject, options.policeRadius ?? 150).length;
    if (options.subject?.type === NPC_TYPES.POLICE && !options.subject.dead && !options.subject.inactive) policeCount += 1;

    if (policeCount > 0) {
      scene.exposureSystem?.forceLevel(1, `Police witness ${rule.label}.`);
      scene.policeSystem?.addHeat(subject.x, subject.y, Math.max(10, rule.severity), `police saw ${rule.label}`);
      RawAudio.play("police", { cooldown: 0.4 });
      scene.lastActionText = `POLICE ALERT: ${rule.label} seen. Exposure forced to level 1.`;
    }

    if (!rule.breaksMasquerade) {
      const reporters = civilianWitnessesSeeing(scene, subject, options.witnessRadius ?? 125)
        .filter(() => Math.random() < FELONY_REPORT_CHANCE);

      if (reporters.length) {
        RawAudio.play("witnessWtf", { cooldown: 0.45 });
        for (const witness of reporters) {
          scene.witnessSystem?.alarmWitness(witness, rule.label, rule.severity ?? 10, {
            masqueradeRisk: false,
            reactionSeconds: options.reactionSeconds ?? 1.0,
            source: subject
          });
        }
        scene.exposureSystem?.add(Math.max(2, Math.ceil((rule.severity ?? 8) * 0.25)), `A witness considers reporting ${rule.label}.`);
        witnessCount = reporters.length;
      }
    }
  }

  return { rule, police: policeCount, witnesses: witnessCount };
}

function policeSeeing(scene, subject, radius) {
  return scene.npcSystem.npcs.filter(npc => {
    if (npc.dead || npc.inactive || npc.intercepted || npc.stunnedTimer > 0) return false;
    if (npc.type !== NPC_TYPES.POLICE) return false;
    if (npc.layer !== LAYERS.STREET) return false;
    return scene.witnessSystem?.canWitnessSee(npc, subject, radius);
  });
}

function civilianWitnessesSeeing(scene, subject, radius) {
  return scene.npcSystem.npcs.filter(npc => {
    if (npc === subject || npc.dead || npc.inactive || npc.intercepted || npc.stunnedTimer > 0 || npc.alarmed) return false;
    if (![NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET].includes(npc.type)) return false;
    if (npc.layer !== LAYERS.STREET) return false;
    return scene.witnessSystem?.canWitnessSee(npc, subject, radius);
  });
}

function isOnCooldown(scene, key, seconds) {
  if (!seconds) return false;
  scene.actionRuleCooldowns ||= Object.create(null);
  const now = scene.time.now / 1000;
  if (scene.actionRuleCooldowns[key] && scene.actionRuleCooldowns[key] > now) return true;
  scene.actionRuleCooldowns[key] = now + seconds;
  return false;
}
