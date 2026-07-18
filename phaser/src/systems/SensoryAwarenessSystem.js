import { COMBAT_STATES } from "../data/combat.js";
import { NPC_TYPES } from "../data/npcs.js";
import { RawAudio } from "./RawAudioSystem.js";

const HUMAN_TYPES = new Set([
  NPC_TYPES.CIVILIAN,
  NPC_TYPES.TARGET,
  NPC_TYPES.POLICE,
  NPC_TYPES.HUNTER,
  NPC_TYPES.THUG
]);

const SENSE_CONFIG = Object.freeze({
  [NPC_TYPES.CIVILIAN]: { vision: 105, visionHalf: 0.72, hearing: 142, hearingHalf: 2.62 },
  [NPC_TYPES.TARGET]: { vision: 112, visionHalf: 0.72, hearing: 150, hearingHalf: 2.62 },
  [NPC_TYPES.POLICE]: { vision: 132, visionHalf: 0.62, hearing: 182, hearingHalf: 2.70 },
  [NPC_TYPES.HUNTER]: { vision: 148, visionHalf: 0.58, hearing: 194, hearingHalf: 2.72 },
  [NPC_TYPES.THUG]: { vision: 98, visionHalf: 0.68, hearing: 148, hearingHalf: 2.58 }
});

const SOUND_EVENTS = Object.freeze({
  breakLight: { label: "streetlight vandalism", hearing: 176, visual: 154, severity: 10, heat: 22, reaction: 2.1 },
  roofDrop: { label: "a heavy fall from the rooftops", hearing: 192, visual: 165, severity: 11, heat: 20, reaction: 2.5 }
});

function stableFacing(npc) {
  let x = Number.isFinite(npc?.dirX) ? npc.dirX : 0;
  let y = Number.isFinite(npc?.dirY) ? npc.dirY : 0;
  const length = Math.hypot(x, y);
  if (length > 0.08) {
    x /= length;
    y /= length;
    npc.__nbdFacingX = x;
    npc.__nbdFacingY = y;
    return { x, y };
  }
  return {
    x: Number.isFinite(npc?.__nbdFacingX) ? npc.__nbdFacingX : 0,
    y: Number.isFinite(npc?.__nbdFacingY) ? npc.__nbdFacingY : 1
  };
}

function pointInsideCone(npc, x, y, range, halfAngle) {
  const dx = x - npc.x;
  const dy = y - npc.y;
  const distance = Math.hypot(dx, dy);
  if (distance > range || distance < 0.001) return false;
  const facing = stableFacing(npc);
  const dot = facing.x * (dx / distance) + facing.y * (dy / distance);
  return dot >= Math.cos(halfAngle);
}

export class SensoryAwarenessSystem {
  constructor(scene) {
    this.scene = scene;
    scene.sensoryAwarenessSystem = this;
  }

  emit(kind, source) {
    const event = SOUND_EVENTS[kind];
    if (!event || !source) return "";

    const layer = source.layer ?? this.scene.currentLayer;
    const maxRadius = Math.max(event.hearing, event.visual);
    const humans = this.scene.npcSystem?.queryRadius?.(source.x, source.y, maxRadius, layer, npc => this.validHuman(npc, layer))
      || (this.scene.npcSystem?.npcs || []).filter(npc => this.validHuman(npc, layer));
    let policeSaw = 0;
    let civiliansSaw = 0;
    let heardOnly = 0;

    for (const npc of humans) {
      const senses = SENSE_CONFIG[npc.type] || SENSE_CONFIG[NPC_TYPES.CIVILIAN];
      const saw = pointInsideCone(
        npc,
        source.x,
        source.y,
        Math.min(event.visual, senses.vision),
        senses.visionHalf
      );

      if (saw) {
        if (npc.type === NPC_TYPES.POLICE) {
          this.alertPoliceBySight(npc, source, event);
          policeSaw++;
        } else {
          this.alertNpcBySight(npc, source, event);
          civiliansSaw++;
        }
        continue;
      }

      const heard = pointInsideCone(
        npc,
        source.x,
        source.y,
        Math.min(event.hearing, senses.hearing),
        senses.hearingHalf
      );
      if (!heard) continue;
      if (this.startHeardOnlyReaction(npc, source, event)) heardOnly++;
    }

    if (heardOnly > 0) RawAudio.play("witnessWtf", { cooldown: 0.45 });
    const notices = [];
    if (policeSaw) notices.push(`${policeSaw} police officer(s) saw it`);
    if (civiliansSaw) notices.push(`${civiliansSaw} civilian witness(es) saw it`);
    if (heardOnly) notices.push(`${heardOnly} nearby NPC(s) heard it and turned toward the sound`);
    return notices.length ? notices.join(" · ") : "No one nearby noticed";
  }

  validHuman(npc, layer) {
    return Boolean(
      npc
      && HUMAN_TYPES.has(npc.type)
      && !npc.dead
      && !npc.inactive
      && !npc.intercepted
      && !npc.hiddenBody
      && !npc.missionInformant
      && npc.layer === layer
      && npc.combat?.state !== COMBAT_STATES.DOWNED
      && !npc.drainVictim
    );
  }

  alertPoliceBySight(cop, source, event) {
    cop.soundReactionTimer = 0;
    cop.__nbdWtfLabel?.setVisible?.(false);
    this.turnToward(cop, source.x, source.y);
    cop.chasingPlayer = true;
    cop.alarmed = true;

    const reason = `Police saw ${event.label}.`;
    this.scene.exposureSystem?.forceLevel(1, reason);
    this.scene.policeSystem?.addHeat(source.x, source.y, event.heat, reason);
    const zone = this.scene.policeSystem?.zoneAt?.(source.x, source.y);
    if (this.scene.policeSystem) {
      this.scene.policeSystem.lastKnownPlayer = {
        x: source.x,
        y: source.y,
        zoneId: zone?.id || "district"
      };
    }
    RawAudio.play("police", { cooldown: 0.35 });
  }

  alertNpcBySight(npc, source, event) {
    npc.soundReactionTimer = 0;
    npc.__nbdWtfLabel?.setVisible?.(false);
    this.turnToward(npc, source.x, source.y);

    if ([NPC_TYPES.CIVILIAN, NPC_TYPES.TARGET].includes(npc.type)) {
      this.scene.witnessSystem?.alarmWitness(npc, event.label, event.severity, {
        masqueradeRisk: false,
        reactionSeconds: 0.8,
        source
      });
      return;
    }

    npc.alarmed = true;
    npc.reactionTimer = Math.max(npc.reactionTimer || 0, 0.8);
    if (npc.type === NPC_TYPES.THUG) npc.thugHostile = true;
    if (npc.type === NPC_TYPES.HUNTER) npc.hunterIntent = "hunt";
  }

  startHeardOnlyReaction(npc, source, event) {
    if (npc.alarmed || npc.chasingPlayer || npc.enemyAttack) return false;
    npc.soundReactionTimer = Math.max(npc.soundReactionTimer || 0, event.reaction);
    npc.soundSourceX = source.x;
    npc.soundSourceY = source.y;
    npc.vx = 0;
    npc.vy = 0;
    npc.chasingPlayer = false;
    this.turnToward(npc, source.x, source.y);
    this.ensureWtfLabel(npc).setPosition(npc.x, npc.y - 26).setVisible(true);
    return true;
  }

  turnToward(npc, x, y) {
    const dx = x - npc.x;
    const dy = y - npc.y;
    const length = Math.hypot(dx, dy) || 1;
    npc.dirX = dx / length;
    npc.dirY = dy / length;
    npc.__nbdFacingX = npc.dirX;
    npc.__nbdFacingY = npc.dirY;
  }

  ensureWtfLabel(npc) {
    if (npc.__nbdWtfLabel) return npc.__nbdWtfLabel;
    npc.__nbdWtfLabel = this.scene.add.text(npc.x, npc.y - 28, "WTF", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "12px",
      fontStyle: "bold",
      color: "#ffd58b",
      backgroundColor: "rgba(5, 6, 11, .78)",
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5, 1).setDepth(72).setVisible(false);
    npc.__nbdWtfLabel.setResolution?.(3);
    npc.__nbdWtfLabel.setStroke?.("#05060b", 2);
    return npc.__nbdWtfLabel;
  }
}
