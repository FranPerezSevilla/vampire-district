import { COLORS } from "./data/balance.js";
import { LAYERS } from "./data/district.js";
import { NPC_TYPES } from "./data/npcs.js";
import { GameScene } from "./scenes/GameScene.js";
import { NpcSystem } from "./systems/NpcSystem.js";
import { PoliceSystem } from "./systems/PoliceSystem.js";
import { RawAudio } from "./systems/RawAudioSystem.js";
import { TransitionSystem } from "./systems/TransitionSystem.js";
import { WitnessSystem } from "./systems/WitnessSystem.js";

const HUMAN_TYPES = new Set([
  NPC_TYPES.CIVILIAN,
  NPC_TYPES.TARGET,
  NPC_TYPES.POLICE,
  NPC_TYPES.HUNTER,
  NPC_TYPES.THUG
]);

const SENSE_CONFIG = Object.freeze({
  [NPC_TYPES.CIVILIAN]: { vision: 105, visionHalf: 0.72, hearing: 142, hearingHalf: 2.62, visionColor: 0xffe16b, soundColor: 0xcbbf83 },
  [NPC_TYPES.TARGET]: { vision: 112, visionHalf: 0.72, hearing: 150, hearingHalf: 2.62, visionColor: 0xff4bd8, soundColor: 0xd889ca },
  [NPC_TYPES.POLICE]: { vision: 132, visionHalf: 0.62, hearing: 182, hearingHalf: 2.70, visionColor: 0x4da3ff, soundColor: 0x78bfff },
  [NPC_TYPES.HUNTER]: { vision: 148, visionHalf: 0.58, hearing: 194, hearingHalf: 2.72, visionColor: 0xff9d35, soundColor: 0xd88c52 },
  [NPC_TYPES.THUG]: { vision: 98, visionHalf: 0.68, hearing: 148, hearingHalf: 2.58, visionColor: 0xb36b42, soundColor: 0xb98a70 }
});

const SOUND_EVENTS = Object.freeze({
  breakLight: { label: "streetlight vandalism", hearing: 176, visual: 154, severity: 10, heat: 22, reaction: 2.1 },
  roofDrop: { label: "a heavy fall from the rooftops", hearing: 192, visual: 165, severity: 11, heat: 20, reaction: 2.5 }
});

function configFor(npc) {
  return SENSE_CONFIG[npc?.type] || SENSE_CONFIG[NPC_TYPES.CIVILIAN];
}

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

function turnToward(npc, x, y) {
  const dx = x - npc.x;
  const dy = y - npc.y;
  const length = Math.hypot(dx, dy) || 1;
  npc.dirX = dx / length;
  npc.dirY = dy / length;
  npc.__nbdFacingX = npc.dirX;
  npc.__nbdFacingY = npc.dirY;
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

function visibleNpc(npc, layer) {
  return Boolean(npc
    && HUMAN_TYPES.has(npc.type)
    && !npc.dead
    && !npc.inactive
    && !npc.intercepted
    && !npc.hiddenBody
    && npc.stunnedTimer <= 0
    && npc.layer === layer
    && !npc.missionInformant);
}

function drawFilledCone(graphics, npc, range, halfAngle, color, alpha) {
  const facing = stableFacing(npc);
  const angle = Math.atan2(facing.y, facing.x);
  const steps = 16;

  graphics.fillStyle(color, alpha);
  graphics.beginPath();
  graphics.moveTo(npc.x, npc.y);
  for (let index = 0; index <= steps; index++) {
    const current = angle - halfAngle + (halfAngle * 2 * index) / steps;
    graphics.lineTo(npc.x + Math.cos(current) * range, npc.y + Math.sin(current) * range);
  }
  graphics.closePath();
  graphics.fillPath();

  graphics.lineStyle(1, color, alpha * 2.5);
  graphics.beginPath();
  graphics.moveTo(npc.x, npc.y);
  graphics.lineTo(npc.x + Math.cos(angle - halfAngle) * range, npc.y + Math.sin(angle - halfAngle) * range);
  graphics.moveTo(npc.x, npc.y);
  graphics.lineTo(npc.x + Math.cos(angle + halfAngle) * range, npc.y + Math.sin(angle + halfAngle) * range);
  graphics.strokePath();
}

function drawSoundField(graphics, npc, range, halfAngle, color) {
  const facing = stableFacing(npc);
  const angle = Math.atan2(facing.y, facing.x);

  // Hearing is deliberately rendered as separated wave bands rather than a
  // second solid cone, so it cannot be mistaken for rear-facing vision.
  for (const [radiusScale, alpha] of [[0.46, 0.12], [0.72, 0.095], [1, 0.075]]) {
    graphics.lineStyle(1, color, alpha);
    graphics.beginPath();
    graphics.arc(npc.x, npc.y, range * radiusScale, angle - halfAngle, angle + halfAngle, false);
    graphics.strokePath();
  }

  graphics.lineStyle(1, color, 0.075);
  graphics.beginPath();
  graphics.moveTo(npc.x, npc.y);
  graphics.lineTo(npc.x + Math.cos(angle - halfAngle) * range, npc.y + Math.sin(angle - halfAngle) * range);
  graphics.moveTo(npc.x, npc.y);
  graphics.lineTo(npc.x + Math.cos(angle + halfAngle) * range, npc.y + Math.sin(angle + halfAngle) * range);
  graphics.strokePath();
}

function ensureWtfLabel(scene, npc) {
  if (!npc.__nbdWtfLabel) {
    npc.__nbdWtfLabel = scene.add.text(npc.x, npc.y - 28, "WTF", {
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "10px",
      fontStyle: "bold",
      color: "#ffd58b",
      backgroundColor: "rgba(5, 6, 11, .78)",
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5, 1).setDepth(72).setVisible(false);
    npc.__nbdWtfLabel.setResolution?.(3);
    npc.__nbdWtfLabel.setStroke?.("#05060b", 2);
  }
  return npc.__nbdWtfLabel;
}

class SensoryAwarenessSystem {
  constructor(scene) {
    this.scene = scene;
  }

  emit(kind, source) {
    const event = SOUND_EVENTS[kind];
    if (!event || !source) return "";

    const layer = source.layer ?? this.scene.currentLayer;
    const humans = this.scene.npcSystem?.npcs?.filter(npc => visibleNpc(npc, layer)) || [];
    let policeSaw = 0;
    let civiliansSaw = 0;
    let heardOnly = 0;

    for (const npc of humans) {
      const senses = configFor(npc);
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

      this.startHeardOnlyReaction(npc, source, event);
      heardOnly++;
    }

    if (heardOnly > 0) RawAudio.play("witnessWtf", { cooldown: 0.45 });

    const notices = [];
    if (policeSaw) notices.push(`${policeSaw} police officer(s) saw it`);
    if (civiliansSaw) notices.push(`${civiliansSaw} civilian witness(es) saw it`);
    if (heardOnly) notices.push(`${heardOnly} nearby NPC(s) heard it and turned toward the sound`);
    return notices.length ? notices.join(" · ") : "No one nearby noticed";
  }

  alertPoliceBySight(cop, source, event) {
    cop.soundReactionTimer = 0;
    cop.__nbdWtfLabel?.setVisible(false);
    turnToward(cop, source.x, source.y);
    cop.chasingPlayer = true;

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
    npc.__nbdWtfLabel?.setVisible(false);
    turnToward(npc, source.x, source.y);

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
  }

  startHeardOnlyReaction(npc, source, event) {
    if (npc.alarmed || npc.chasingPlayer) return;

    npc.soundReactionTimer = Math.max(npc.soundReactionTimer || 0, event.reaction);
    npc.soundSourceX = source.x;
    npc.soundSourceY = source.y;
    npc.vx = 0;
    npc.vy = 0;
    npc.chasingPlayer = false;
    turnToward(npc, source.x, source.y);

    const label = ensureWtfLabel(this.scene, npc);
    label.setPosition(npc.x, npc.y - 26).setVisible(true);
  }
}

function patchVisionAndHearingDisplay() {
  if (WitnessSystem.prototype.__nbdSensoryDisplayPatch) return;

  WitnessSystem.prototype.drawVisionCones = function drawStableVisionCones(graphics) {
    const drawn = new Set();
    for (const witness of this.scene.npcSystem.npcs) {
      if (!visibleNpc(witness, this.scene.currentLayer)) continue;

      // Overlapping patrols used to create what looked like one officer with a
      // cone in both directions. Render only one cone at an effectively shared
      // position while keeping both NPCs active in the simulation.
      const positionKey = `${witness.type}:${Math.round(witness.x / 3)}:${Math.round(witness.y / 3)}`;
      if (drawn.has(positionKey)) continue;
      drawn.add(positionKey);

      const senses = configFor(witness);
      drawFilledCone(
        graphics,
        witness,
        senses.vision,
        senses.visionHalf,
        senses.visionColor,
        witness.type === NPC_TYPES.POLICE ? 0.10 : 0.075
      );
    }
  };

  WitnessSystem.prototype.drawHearingCones = function drawHearingCones(graphics) {
    const drawn = new Set();
    for (const npc of this.scene.npcSystem.npcs) {
      if (!visibleNpc(npc, this.scene.currentLayer)) continue;
      const positionKey = `${npc.type}:${Math.round(npc.x / 3)}:${Math.round(npc.y / 3)}`;
      if (drawn.has(positionKey)) continue;
      drawn.add(positionKey);
      const senses = configFor(npc);
      drawSoundField(graphics, npc, senses.hearing, senses.hearingHalf, senses.soundColor);
    }
  };

  const originalDrawMarkers = WitnessSystem.prototype.drawMarkers;
  WitnessSystem.prototype.drawMarkers = function drawMarkersWithSound(graphics) {
    const result = originalDrawMarkers.call(this, graphics);
    this.drawHearingCones(graphics);

    const time = this.scene.time.now;
    for (const npc of this.scene.npcSystem.npcs) {
      if (!visibleNpc(npc, this.scene.currentLayer) || !(npc.soundReactionTimer > 0)) continue;
      const pulse = (Math.sin(time * 0.01) + 1) * 0.5;
      graphics.lineStyle(2, 0xffb02e, 0.55 + pulse * 0.3).strokeCircle(npc.x, npc.y, 17 + pulse * 3);
      graphics.fillStyle(0xffb02e, 0.06 + pulse * 0.05).fillCircle(npc.x, npc.y, 17 + pulse * 3);
    }
    return result;
  };

  WitnessSystem.prototype.__nbdSensoryDisplayPatch = true;
}

function patchSoundReactionBehaviour() {
  if (!NpcSystem.prototype.__nbdSoundReactionPatch) {
    const originalUpdateNpc = NpcSystem.prototype.updateNpc;
    NpcSystem.prototype.updateNpc = function updateNpcWithSoundReaction(npc, dt) {
      const label = npc.__nbdWtfLabel;

      if (npc.soundReactionTimer > 0 && !npc.alarmed && !npc.chasingPlayer) {
        npc.soundReactionTimer = Math.max(0, npc.soundReactionTimer - dt);
        turnToward(npc, npc.soundSourceX, npc.soundSourceY);
        npc.vx = 0;
        npc.vy = 0;
        label?.setPosition(npc.x, npc.y - 26).setVisible(true);
        if (npc.soundReactionTimer <= 0) label?.setVisible(false);
        return;
      }

      label?.setVisible(false);
      return originalUpdateNpc.call(this, npc, dt);
    };
    NpcSystem.prototype.__nbdSoundReactionPatch = true;
  }

  if (!PoliceSystem.prototype.__nbdSoundReactionPatch) {
    const originalTargetForCop = PoliceSystem.prototype.targetForCop;
    PoliceSystem.prototype.targetForCop = function targetForCopAfterSound(cop, ...args) {
      if (cop.soundReactionTimer > 0 && !cop.chasingPlayer) return null;
      return originalTargetForCop.call(this, cop, ...args);
    };
    PoliceSystem.prototype.__nbdSoundReactionPatch = true;
  }
}

function patchNoisyActions() {
  if (!GameScene.prototype.__nbdNoisyLightPatch) {
    GameScene.prototype.breakLight = function breakLightWithWitnessAwareness(light) {
      if (!light || this.brokenLights.has(light.id)) return;

      this.brokenLights.add(light.id);
      const reaction = this.sensoryAwarenessSystem?.emit("breakLight", {
        x: light.x,
        y: light.y,
        layer: LAYERS.STREET
      }) || "";
      this.lastActionText = `${light.name} broken. A useful patch of darkness opens. ${reaction}`.trim();
      this.redrawLayer(this.lastActionText);
    };
    GameScene.prototype.__nbdNoisyLightPatch = true;
  }

  if (!TransitionSystem.prototype.__nbdNoisyRoofDropPatch) {
    TransitionSystem.prototype.roofDrop = function roofDropWithSoundAwareness({ from, to, toLayer, status }) {
      if (!this.begin("Roof drop: falling to street level.")) return;
      RawAudio.play("routeRoof");
      this.drawDropLine(from, to);
      this.animateParabola({
        from,
        to,
        duration: 680,
        height: 62,
        peakScale: 1.42,
        landingColor: 0xffb02e,
        landingLabel: "DROP",
        onComplete: () => {
          const reaction = this.scene.sensoryAwarenessSystem?.emit("roofDrop", {
            x: to.x,
            y: to.y,
            layer: toLayer
          }) || "";
          const fullStatus = reaction ? `${status} ${reaction}` : status;
          this.complete(toLayer, to, fullStatus);
        },
        falling: true
      });
    };
    TransitionSystem.prototype.__nbdNoisyRoofDropPatch = true;
  }
}

function attachSensoryAwareness() {
  const scene = window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene");
  if (!scene?.npcSystem || !scene?.witnessSystem || !scene?.policeSystem || !scene?.transitionSystem) {
    window.requestAnimationFrame(attachSensoryAwareness);
    return;
  }

  scene.sensoryAwarenessSystem ||= new SensoryAwarenessSystem(scene);
}

patchVisionAndHearingDisplay();
patchSoundReactionBehaviour();
patchNoisyActions();
attachSensoryAwareness();
