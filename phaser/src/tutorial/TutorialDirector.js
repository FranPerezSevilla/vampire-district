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

function ensureTutorialUi() {
  if (typeof document === "undefined") return null;
  if (!document.getElementById("nbd-tutorial-director-style")) {
    const style = document.createElement("style");
    style.id = "nbd-tutorial-director-style";
    style.textContent = `
      .tutorial-dialogue {
        position: absolute;
        left: 50%;
        top: 22%;
        width: min(420px, calc(100% - 32px));
        padding: 14px 16px 16px;
        border: 1px solid rgba(241, 230, 255, .82);
        border-radius: 18px;
        background: linear-gradient(145deg, rgba(18, 17, 27, .985), rgba(6, 7, 13, .98));
        box-shadow: 0 26px 90px rgba(0, 0, 0, .76), inset 0 0 0 1px rgba(255,255,255,.04);
        color: #f7f1ff;
        opacity: 0;
        transform: translate(-50%, calc(-100% - 22px)) scale(.96);
        transform-origin: 50% 100%;
        transition: opacity .2s ease, transform .28s ease;
        pointer-events: none;
        z-index: 95;
      }
      .tutorial-dialogue.open { opacity: 1; transform: translate(-50%, calc(-100% - 22px)) scale(1); }
      .tutorial-dialogue::after {
        content: "";
        position: absolute;
        left: 50%;
        bottom: -13px;
        width: 24px;
        height: 24px;
        background: #090a11;
        border-right: 1px solid rgba(241, 230, 255, .82);
        border-bottom: 1px solid rgba(241, 230, 255, .82);
        transform: translateX(-50%) rotate(45deg);
      }
      .tutorial-dialogue.thought { border-color: rgba(186, 133, 255, .95); background: linear-gradient(145deg, rgba(30, 17, 45, .99), rgba(8, 7, 16, .985)); }
      .tutorial-dialogue.thought::after { width: 16px; height: 16px; bottom: -24px; border: 1px solid rgba(186, 133, 255, .88); border-radius: 50%; transform: translateX(-50%); }
      .tutorial-dialogue.thug { border-color: rgba(255, 176, 46, .96); background: linear-gradient(145deg, rgba(47, 27, 13, .99), rgba(12, 8, 7, .985)); }
      .tutorial-dialogue.police { border-color: rgba(77, 163, 255, .94); background: linear-gradient(145deg, rgba(13, 29, 52, .99), rgba(6, 9, 17, .985)); }
      .tutorial-dialogue__speaker { margin-bottom: 6px; color: #78c7a3; font-size: 12px; font-weight: 900; letter-spacing: .13em; text-transform: uppercase; }
      .tutorial-dialogue.thought .tutorial-dialogue__speaker { color: #cda6ff; }
      .tutorial-dialogue.thug .tutorial-dialogue__speaker { color: #ffca72; }
      .tutorial-dialogue.police .tutorial-dialogue__speaker { color: #9ed0ff; }
      .tutorial-dialogue__text { position: relative; z-index: 1; font-size: clamp(16px, 1.35vw, 21px); line-height: 1.3; font-weight: 720; letter-spacing: -.012em; text-wrap: pretty; }
      .tutorial-dialogue__advance { position: relative; z-index: 1; margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(241, 230, 255, .14); color: rgba(241, 230, 255, .66); font-size: 12px; font-weight: 850; letter-spacing: .08em; text-transform: uppercase; }
      .tutorial-strip {
        position: absolute;
        left: 50%;
        top: 82px;
        width: min(760px, calc(100% - 40px));
        min-height: 44px;
        display: none;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 9px 15px;
        transform: translateX(-50%);
        border-top: 1px solid rgba(120, 199, 163, .72);
        border-bottom: 1px solid rgba(120, 199, 163, .35);
        background: linear-gradient(90deg, transparent, rgba(5, 9, 13, .94) 12%, rgba(5, 9, 13, .94) 88%, transparent);
        color: #dff9ec;
        font-size: 14px;
        font-weight: 780;
        line-height: 1.28;
        text-align: center;
        z-index: 72;
        pointer-events: none;
      }
      .tutorial-strip.visible { display: flex; }
      .tutorial-strip kbd { flex: 0 0 auto; min-width: 52px; padding: 5px 8px; border: 1px solid rgba(120, 199, 163, .65); background: rgba(120, 199, 163, .1); color: #dff9ec; font: 900 12px/1 Inter, system-ui, sans-serif; }
      .game-ui.tutorial-cinematic > :not(.tutorial-dialogue):not(.ui-modal) { opacity: .14; filter: saturate(.55); }
      .game-ui.tutorial-restricted .hud-actions, .game-ui.tutorial-restricted .power-dock, .game-ui.tutorial-restricted .weapon-hud { opacity: .22; pointer-events: none !important; }
      @media (max-width: 720px) {
        .tutorial-dialogue { width: min(340px, calc(100% - 22px)); padding: 12px 14px 14px; }
        .tutorial-dialogue__text { font-size: 15px; }
        .tutorial-strip { top: 66px; width: calc(100% - 20px); font-size: 12px; }
      }
      @media (prefers-reduced-motion: reduce) { .tutorial-dialogue { transition: none !important; } }
    `;
    document.head.appendChild(style);
  }

  const host = document.getElementById("game-ui") || document.querySelector(".game-frame");
  if (!host) return null;
  let dialogue = document.getElementById("tutorial-dialogue");
  if (!dialogue) {
    dialogue = document.createElement("div");
    dialogue.id = "tutorial-dialogue";
    dialogue.className = "tutorial-dialogue";
    dialogue.setAttribute("role", "status");
    dialogue.setAttribute("aria-live", "polite");
    dialogue.innerHTML = `
      <div class="tutorial-dialogue__speaker"></div>
      <div class="tutorial-dialogue__text"></div>
      <div class="tutorial-dialogue__advance">CLICK · Continue <span aria-hidden="true">·</span> ESC</div>
    `;
    host.appendChild(dialogue);
  }

  let strip = document.getElementById("tutorial-strip");
  if (!strip) {
    strip = document.createElement("div");
    strip.id = "tutorial-strip";
    strip.className = "tutorial-strip";
    strip.innerHTML = `<kbd></kbd><span></span>`;
    host.appendChild(strip);
  }

  return {
    host,
    dialogue,
    speaker: dialogue.querySelector(".tutorial-dialogue__speaker"),
    text: dialogue.querySelector(".tutorial-dialogue__text"),
    strip,
    stripKey: strip.querySelector("kbd"),
    stripText: strip.querySelector("span")
  };
}

export class TutorialDirector {
  constructor(scene, uiScene) {
    this.scene = scene;
    this.uiScene = uiScene;
    this.state = STATES.WAITING;
    this.busy = false;
    this.started = false;
    this.ui = ensureTutorialUi();
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
    const dialogue = this.ui?.dialogue;
    if (!dialogue) return Promise.resolve();
    const kind = payload.kind || "spoken";
    dialogue.className = `tutorial-dialogue ${kind}`;
    this.ui.speaker.textContent = payload.speaker || "";
    this.ui.text.textContent = payload.text || "";
    dialogue.classList.add("open");

    const reposition = () => this.positionDialogue(payload);
    this.scene.events?.on?.(Phaser.Scenes.Events.UPDATE, reposition);
    requestAnimationFrame(reposition);

    return new Promise(resolve => {
      const notBefore = performance.now() + 240;
      let settled = false;
      const finish = event => {
        if (settled || performance.now() < notBefore) return;
        if (event?.type === "pointerdown" && event.button !== 0) return;
        if (event?.type === "keydown" && event.key !== "Escape") return;
        if (event?.type === "pointerdown") {
          const frame = document.querySelector(".game-frame");
          if (frame && !frame.contains(event.target)) return;
        }
        settled = true;
        event?.preventDefault?.();
        event?.stopPropagation?.();
        document.removeEventListener("pointerdown", finish, true);
        document.removeEventListener("keydown", finish, true);
        this.scene.events?.off?.(Phaser.Scenes.Events.UPDATE, reposition);
        dialogue.classList.remove("open");
        this.scene.time.delayedCall(140, () => {
          this.scene.inputSystem?.resetWorldEdges?.();
          this.scene.game?.canvas?.focus?.({ preventScroll: true });
          resolve();
        });
      };
      document.addEventListener("pointerdown", finish, true);
      document.addEventListener("keydown", finish, true);
    });
  }

  positionDialogue(payload) {
    const dialogue = this.ui?.dialogue;
    const host = this.ui?.host;
    const camera = this.scene.cameras.main;
    const target = this.speakerTarget(payload);
    if (!dialogue || !host || !camera || !target || !dialogue.classList.contains("open")) return;

    const scaleX = host.clientWidth / camera.width;
    const scaleY = host.clientHeight / camera.height;
    const screenX = (target.x - camera.worldView.x) * camera.zoom * scaleX;
    const screenY = (target.y - camera.worldView.y) * camera.zoom * scaleY;
    const halfWidth = Math.max(120, dialogue.offsetWidth / 2);
    const safeX = Phaser.Math.Clamp(screenX, halfWidth + 10, host.clientWidth - halfWidth - 10);
    const bubbleHeight = Math.max(80, dialogue.offsetHeight);
    const safeY = Phaser.Math.Clamp(screenY - 42, bubbleHeight + 16, host.clientHeight - 28);
    dialogue.style.left = `${safeX}px`;
    dialogue.style.top = `${safeY}px`;
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

  hideDialogue() {
    this.ui?.dialogue?.classList.remove("open");
  }

  setTip(key, text, duration = 0) {
    if (!this.ui?.strip) return;
    this.tipTimer?.remove?.(false);
    this.tipTimer = null;
    const visible = Boolean(text);
    this.ui.strip.classList.toggle("visible", visible);
    this.ui.stripKey.textContent = key || "";
    this.ui.stripText.textContent = text || "";
    if (visible && duration > 0) {
      this.tipTimer = this.scene.time.delayedCall(duration, () => this.setTip("", ""));
    }
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
    camera.setBounds(0, 0, WORLD.width, WORLD.height);
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
    this.ui?.dialogue?.remove?.();
    this.ui?.strip?.remove?.();
  }
}

export { STATES as TUTORIAL_STATES };
