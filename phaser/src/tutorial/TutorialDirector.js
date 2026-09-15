import { CAMERA, WORLD } from "../data/balance.js";
import { COMBAT_STATES } from "../data/combat.js";
import { LAYERS } from "../data/district.js";
import { NPC_TYPES } from "../data/npcs.js";

const MOVEMENT_ACTION_TYPES = new Set([
  "fireEscapeUp",
  "fireEscapeDown",
  "sewerDown",
  "sewerUp",
  "privateShaft",
  "roofJump",
  "roofDrop"
]);

const STATES = Object.freeze({
  WAITING: "waiting",
  INTRO: "intro",
  ROOFTOP_MOVEMENT: "rooftop-movement",
  THUG_DIALOGUE: "thug-dialogue",
  DRAIN_THUG: "drain-thug",
  HUNGER_LESSON: "hunger-lesson",
  REACH_TIP: "reach-tip",
  POLICE_INFORMANT: "police-informant",
  FINAL_SIRE: "final-sire",
  COMPLETE: "complete",
  BOUNDARY_WARNING: "boundary-warning",
  MISSION_COMPLETE_SIRE: "mission-complete-sire"
});

const INFORMANT_ID = "police_roof_informant";
const INFORMANT_POSITION = Object.freeze({ x: 775, y: 150, layer: LAYERS.ROOF_LOW });

function renderScale() {
  return typeof window !== "undefined"
    ? window.NBD_RESOLUTION_PRESET?.renderScale || 1
    : 1;
}

function normalZoomFor(scene) {
  const base = scene.currentLayer === LAYERS.ROOF_HIGH
    ? CAMERA.roofHighZoom
    : scene.currentLayer === LAYERS.ROOF_LOW
      ? CAMERA.roofLowZoom
      : scene.currentLayer === LAYERS.SEWER
        ? CAMERA.sewerZoom
        : CAMERA.streetZoom;
  return base * renderScale();
}

export class TutorialDirector {
  constructor(scene, uiScene) {
    this.scene = scene;
    this.uiScene = uiScene;
    this.state = STATES.WAITING;
    this.busy = false;
    this.started = false;
    this.ui = null; // Narrative pixels are owned by UIScene/React.
    this.tipTimer = null;
    this.introPromise = null;
    this.finalAdviceShown = false;
    this.informant = this.createInformant();

    this.onThugDowned = payload => {
      if (payload?.targetId === "rooftop_thug" && this.state === STATES.DRAIN_THUG) {
        this.setTip("RMB", "The thug is down. Aim at him and hold the right mouse button to drain.");
      }
    };
    scene.events?.on?.("combat:entity-downed", this.onThugDowned);
    scene.events?.once?.(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.tutorialDirector = this;
  }

  startIntro() {
    if (this.started || this.introPromise) return this.introPromise;
    this.started = true;
    this.introPromise = this.runIntro();
    return this.introPromise;
  }

  async runIntro() {
    this.busy = true;
    this.state = STATES.INTRO;
    this.setControlMode("locked");
    this.setTip("", "");
    this.freezeWorld(true);
    await this.zoomToPlayer();

    await this.showDialogue({
      speaker: "YOU",
      text: "Another night. The same as the last, and the same as the one to come. I am... trapped.",
      kind: "spoken",
      target: this.scene.player
    });
    await this.showDialogue({
      speaker: "YOU",
      text: "My sire... I hear his call.",
      kind: "spoken",
      target: this.scene.player
    });
    await this.showDialogue({
      speaker: "YOUR SIRE · IN YOUR MIND",
      kind: "thought",
      target: this.scene.player,
      segments: [
        "My little one, I have a task for you.",
        "A journalist has learned too much about us and intends to expose what he knows.",
        "Cross the rooftops to the police station. Our informant there will tell you where to find him.",
        "Then silence the journalist before he puts the veil at risk."
      ]
    });

    await this.zoomBackToWorld();
    this.freezeWorld(false);
    this.state = STATES.ROOFTOP_MOVEMENT;
    this.busy = false;
    this.setControlMode("movement");
    this.setTip(
      "WASD / SPACE",
      "WASD or arrows run by default. Hold SHIFT to move quietly. Press SPACE near a route to jump, climb, descend or use a sewer."
    );
  }

  update() {
    if (this.busy || !this.started) return;

    if ([STATES.ROOFTOP_MOVEMENT].includes(this.state) && this.distanceToThug() <= 58) {
      void this.runRooftopEncounter();
      return;
    }

    if (this.state === STATES.DRAIN_THUG) {
      const thug = this.thug();
      if (thug?.dead && thug.deathKind === "drained") void this.runHungerLesson();
    }
  }

  filterActions(options = []) {
    if (this.state === STATES.COMPLETE || this.state === STATES.BOUNDARY_WARNING || this.state === STATES.MISSION_COMPLETE_SIRE) return options;
    if (this.busy || this.state === STATES.WAITING || this.state === STATES.INTRO) return [];

    const movement = options.filter(option => MOVEMENT_ACTION_TYPES.has(option.type));
    if (this.state === STATES.ROOFTOP_MOVEMENT) return movement;
    if (this.state === STATES.DRAIN_THUG) return [];
    if (this.state === STATES.REACH_TIP) {
      const clue = options.find(option => option.id === "mission_collect_police_roof_tip");
      if (!clue) return movement;
      return [...movement, {
        ...clue,
        label: "Speak to the police informant",
        detail: "learn where the journalist is hiding",
        x: this.informant?.x ?? clue.x,
        y: this.informant?.y ?? clue.y,
        distance: this.informant
          ? Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, this.informant.x, this.informant.y)
          : clue.distance,
        run: () => this.collectTipFromInformant()
      }];
    }
    return [];
  }

  async runRooftopEncounter() {
    if (this.busy) return;
    this.busy = true;
    this.state = STATES.THUG_DIALOGUE;
    this.setControlMode("locked");
    this.setTip("", "");
    this.freezeWorld(true);

    await this.showDialogue({
      speaker: "ROOFTOP THUG",
      text: "I won't let you pass.",
      kind: "thug",
      targetId: "rooftop_thug"
    });
    await this.showDialogue({
      speaker: "YOUR SIRE · IN YOUR MIND",
      text: "He stands between you and the police roof. Remove him. Drain him, and clear the way.",
      kind: "thought",
      target: this.scene.player
    });

    this.freezeWorld(false);
    this.state = STATES.DRAIN_THUG;
    this.busy = false;
    this.setControlMode("drain");
    this.setTip("MOUSE / RMB", "Aim with the mouse and left-click to knock him down. Then aim at him and hold the right mouse button to drain.");
  }

  async runHungerLesson() {
    if (this.busy) return;
    this.busy = true;
    this.state = STATES.HUNGER_LESSON;
    this.setControlMode("locked");
    this.setTip("", "");
    this.freezeWorld(true);

    await this.showDialogue({
      speaker: "YOUR SIRE · IN YOUR MIND",
      kind: "thought",
      target: this.scene.player,
      segments: [
        "Feeding lowers your Hunger. Using your powers raises it.",
        "If your Hunger climbs too high, you may lose control.",
        "Never feed where humans can see you. A witness can put the veil at risk."
      ]
    });

    this.freezeWorld(false);
    this.state = STATES.REACH_TIP;
    this.busy = false;
    this.setControlMode("tip");
    this.setTip("SPACE / E", "Cross to the police roof with SPACE. Press E beside the informant to speak with him.");
  }

  async collectTipFromInformant() {
    if (this.busy || this.state !== STATES.REACH_TIP || !this.informant || this.informant.inactive) return;
    if ((this.scene.missionSystem?.rooftopJumps || 0) < 3) {
      this.scene.missionSystem?.collectPoliceRoofTip?.();
      return;
    }

    this.busy = true;
    this.state = STATES.POLICE_INFORMANT;
    this.setControlMode("locked");
    this.setTip("", "");
    this.freezeWorld(true);

    try {
      await this.showDialogue({
        speaker: "POLICE INFORMANT",
        text: "The journalist is outside the nightclub, beneath the pink lights.",
        kind: "police",
        targetId: INFORMANT_ID
      });
      await this.showDialogue({
        speaker: "POLICE INFORMANT",
        text: "He is wearing a grey coat and carrying a camera bag.",
        kind: "police",
        targetId: INFORMANT_ID
      });

      this.scene.missionSystem.collectPoliceRoofTip();
      await this.runFinalSireAdvice();
      await this.departInformant();
      this.finishTutorial();
    } catch (error) {
      console.error("Tutorial informant sequence failed", error);
      this.finishTutorial();
    }
  }

  async runFinalSireAdvice() {
    if (this.finalAdviceShown) return;
    this.finalAdviceShown = true;
    this.state = STATES.FINAL_SIRE;
    await this.showDialogue({
      speaker: "YOUR SIRE · IN YOUR MIND",
      text: "Finish the journalist, then return to the refuge. Do not fail me.",
      kind: "thought",
      target: this.scene.player
    });
  }

  finishTutorial() {
    this.freezeWorld(false);
    this.state = STATES.COMPLETE;
    this.busy = false;
    this.setControlMode("full");
    this.setTip("", "");
    this.hideDialogue();
  }

  async showDialogue(payload = {}) {
    const segments = Array.isArray(payload.segments) && payload.segments.length
      ? payload.segments
      : this.splitText(payload);
    for (const text of segments) await this.showDialogueSegment({ ...payload, text });
  }

  splitText(payload) {
    const text = String(payload.text || "").trim();
    const isThought = payload.kind === "thought";
    if (!isThought || text.length < 115) return [text];
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(value => value.trim()).filter(Boolean) || [text];
    const output = [];
    let current = "";
    for (const sentence of sentences) {
      const candidate = current ? `${current} ${sentence}` : sentence;
      if (current && candidate.length > 105) {
        output.push(current);
        current = sentence;
      } else {
        current = candidate;
      }
    }
    if (current) output.push(current);
    return output;
  }

  showDialogueSegment(payload) {
    return this.uiScene.presentDialogue?.({ speaker: payload.speaker || "", text: payload.text || "", kind: payload.kind || "spoken" }) || Promise.resolve();
  }

  speakerTarget(payload) {
    if (payload.target && Number.isFinite(payload.target.x) && Number.isFinite(payload.target.y)) return payload.target;
    if (payload.targetId) {
      const target = this.scene.npcSystem?.npcs?.find(npc => npc.id === payload.targetId);
      if (target) return target;
    }
    if (payload.kind === "thug") return this.thug() || this.scene.player;
    return this.scene.player;
  }

  hideDialogue() { this.uiScene.hideDialogue?.(); }

  setTip(key, text, duration = 0) {
    this.tipTimer?.remove?.(false);
    this.tipTimer = null;
    this.scene.registry?.set?.("tutorialTip", text ? { key, text } : null);
    if (text && duration > 0) this.tipTimer = this.scene.time.delayedCall(duration, () => this.setTip("", ""));
  }

  setControlMode(mode) {
    this.scene.inputSystem?.setControlMode?.(mode);
    document.getElementById("game-ui")?.classList.toggle("tutorial-restricted", mode !== "full");
  }

  freezeWorld(frozen) {
    this.scene.taskRevealCinematic ||= { active: false, queued: null, initialPlayed: true };
    this.scene.taskRevealCinematic.active = Boolean(frozen);
    this.scene.registry.set("taskRevealActive", Boolean(frozen));
    document.getElementById("game-ui")?.classList.toggle("tutorial-cinematic", Boolean(frozen));
    if (frozen) {
      this.scene.nearestInteraction = null;
      this.scene.nearestMovement = null;
      this.scene.interactionSystem?.close?.("Dialogue started.");
      this.scene.inputSystem?.resetWorldEdges?.();
    }
  }

  async zoomToPlayer() {
    const camera = this.scene.cameras.main;
    const normal = normalZoomFor(this.scene);
    const close = Math.min(normal * 3.15, 8.75);
    camera.stopFollow();
    camera.setBounds(-WORLD.width, -WORLD.height, WORLD.width * 3, WORLD.height * 3);
    camera.centerOn(this.scene.player.x, this.scene.player.y);
    await this.tweenZoom(close, 760, "Cubic.easeOut");
  }

  async zoomBackToWorld() {
    const camera = this.scene.cameras.main;
    const targetZoom = normalZoomFor(this.scene);
    const startZoom = camera.zoom;
    this.scene.outskirtsSystem?.updatePresentation?.();
    await new Promise(resolve => {
      this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 2_400,
        ease: "Sine.easeInOut",
        onUpdate: tween => {
          camera.setZoom(Phaser.Math.Linear(startZoom, targetZoom, tween.getValue()));
          camera.centerOn(this.scene.player.x, this.scene.player.y);
        },
        onComplete: resolve
      });
    });
    camera.setZoom(targetZoom);
    camera.centerOn(this.scene.player.x, this.scene.player.y);
    camera.startFollow(this.scene.player, true, 0.12, 0.12);
  }

  tweenZoom(zoom, duration, ease) {
    return new Promise(resolve => {
      this.scene.tweens.add({
        targets: this.scene.cameras.main,
        zoom,
        duration,
        ease,
        onUpdate: () => this.scene.cameras.main.centerOn(this.scene.player.x, this.scene.player.y),
        onComplete: resolve
      });
    });
  }

  thug() {
    return this.scene.npcSystem?.npcs?.find(npc => npc.id === "rooftop_thug") || null;
  }

  distanceToThug() {
    const thug = this.thug();
    if (!thug || thug.dead || this.scene.currentLayer !== thug.layer) return Infinity;
    return Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, thug.x, thug.y);
  }

  createInformant() {
    const existing = this.scene.npcSystem?.npcs?.find(npc => npc.id === INFORMANT_ID);
    if (existing) return existing;
    const informant = this.scene.npcSystem.createNpc({
      id: INFORMANT_ID,
      type: NPC_TYPES.POLICE,
      x: INFORMANT_POSITION.x,
      y: INFORMANT_POSITION.y,
      layer: INFORMANT_POSITION.layer,
      behavior: "guard",
      speed: 0,
      dirX: -1,
      dirY: 0,
      missionInformant: true
    });
    informant.missionInformant = true;
    informant.container.setDepth(48);
    this.scene.npcSystem.npcs.push(informant);
    this.scene.npcSystem.refreshVisibility?.();
    return informant;
  }

  departInformant() {
    const informant = this.informant;
    if (!informant || informant.inactive) return Promise.resolve();
    informant.vx = 0;
    informant.vy = 0;
    return new Promise(resolve => {
      this.scene.tweens.add({
        targets: informant,
        x: 846,
        y: 148,
        duration: 1_050,
        ease: "Sine.easeInOut",
        onUpdate: tween => {
          const progress = tween.progress || 0;
          informant.dirX = 1;
          informant.dirY = 0;
          informant.container?.setAlpha(progress < 0.58 ? 1 : 1 - ((progress - 0.58) / 0.42));
        },
        onComplete: () => {
          informant.inactive = true;
          informant.vx = 0;
          informant.vy = 0;
          informant.container?.setAlpha(0).setVisible(false);
          this.scene.npcSystem.refreshVisibility?.();
          resolve();
        }
      });
    });
  }

  destroy() {
    this.scene.events?.off?.("combat:entity-downed", this.onThugDowned);
    this.tipTimer?.remove?.(false);
    this.hideDialogue();
    this.ui?.strip?.remove?.();
  }
}

export { STATES as TUTORIAL_STATES };
