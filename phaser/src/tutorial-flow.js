import { CAMERA, WORLD } from "./data/balance.js";
import { LAYERS } from "./data/district.js";
import { GameScene } from "./scenes/GameScene.js";
import { UIScene } from "./scenes/UIScene.js";

const MOVEMENT_ACTION_TYPES = new Set([
  "fireEscapeUp",
  "fireEscapeDown",
  "sewerDown",
  "sewerUp",
  "privateShaft",
  "roofJump",
  "roofDrop"
]);

const TUTORIAL_STATES = Object.freeze({
  WAITING: "waiting",
  INTRO: "intro",
  ROOFTOP_MOVEMENT: "rooftop-movement",
  BLOCKER_WARNING: "blocker-warning",
  APPROACH_THUG: "approach-thug",
  THUG_DIALOGUE: "thug-dialogue",
  DRAIN_THUG: "drain-thug",
  HUNGER_LESSON: "hunger-lesson",
  REACH_TIP: "reach-tip",
  FINAL_SIRE: "final-sire",
  COMPLETE: "complete"
});

const LATER_SIRE_LINES = Object.freeze({
  "TASK 3 / 4": "Lo tienes cerca. Aísla al traidor y acaba con él. Que ningún humano vea lo que realmente eres.",
  "TASK 4 / 4": "Ya está hecho. Vuelve al refugio y dame tu informe antes del amanecer. No me hagas esperar."
});

function renderScale() {
  return window.NBD_RESOLUTION_PRESET?.renderScale || 1;
}

function normalZoomFor(scene) {
  const baseZoom = scene.currentLayer === LAYERS.ROOF_HIGH
    ? CAMERA.roofHighZoom
    : scene.currentLayer === LAYERS.ROOF_LOW
      ? CAMERA.roofLowZoom
      : scene.currentLayer === LAYERS.SEWER
        ? CAMERA.sewerZoom
        : CAMERA.streetZoom;
  return baseZoom * renderScale();
}

function injectTutorialUi() {
  if (!document.getElementById("nbd-tutorial-style")) {
    const style = document.createElement("style");
    style.id = "nbd-tutorial-style";
    style.textContent = `
      .tutorial-dialogue {
        position: absolute;
        left: 50%;
        top: 22%;
        width: min(620px, calc(100% - 48px));
        padding: 18px 21px 20px;
        border: 1px solid rgba(241, 230, 255, .82);
        border-radius: 18px;
        background: linear-gradient(145deg, rgba(18, 17, 27, .985), rgba(6, 7, 13, .98));
        box-shadow: 0 26px 90px rgba(0, 0, 0, .76), inset 0 0 0 1px rgba(255,255,255,.04);
        color: #f7f1ff;
        opacity: 0;
        transform: translate(-50%, -18px) scale(.9);
        transition: opacity .2s ease, transform .32s cubic-bezier(.2,.9,.2,1.08);
        pointer-events: none;
        z-index: 95;
      }

      .tutorial-dialogue.open {
        opacity: 1;
        transform: translate(-50%, 0) scale(1);
      }

      .tutorial-dialogue::after {
        content: "";
        position: absolute;
        left: 50%;
        bottom: -16px;
        width: 28px;
        height: 28px;
        background: #090a11;
        border-right: 1px solid rgba(241, 230, 255, .82);
        border-bottom: 1px solid rgba(241, 230, 255, .82);
        transform: translateX(-50%) rotate(45deg);
      }

      .tutorial-dialogue.thought {
        border-color: rgba(186, 133, 255, .95);
        background: linear-gradient(145deg, rgba(30, 17, 45, .99), rgba(8, 7, 16, .985));
        box-shadow: 0 26px 100px rgba(0,0,0,.8), 0 0 42px rgba(167, 92, 255, .16);
      }

      .tutorial-dialogue.thought::after {
        width: 17px;
        height: 17px;
        bottom: -24px;
        border: 1px solid rgba(186, 133, 255, .88);
        border-radius: 50%;
        background: #100b19;
        transform: translateX(-50%);
        box-shadow: 18px 15px 0 -4px #100b19, 18px 15px 0 -3px rgba(186, 133, 255, .72);
      }

      .tutorial-dialogue.thug {
        border-color: rgba(255, 176, 46, .96);
        background: linear-gradient(145deg, rgba(47, 27, 13, .99), rgba(12, 8, 7, .985));
      }

      .tutorial-dialogue__speaker {
        margin-bottom: 8px;
        color: #78c7a3;
        font-size: 12px;
        font-weight: 900;
        letter-spacing: .13em;
        text-transform: uppercase;
      }

      .tutorial-dialogue.thought .tutorial-dialogue__speaker { color: #cda6ff; }
      .tutorial-dialogue.thug .tutorial-dialogue__speaker { color: #ffca72; }

      .tutorial-dialogue__text {
        font-size: clamp(19px, 1.65vw, 27px);
        line-height: 1.32;
        font-weight: 720;
        letter-spacing: -.012em;
        text-wrap: balance;
      }

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

      .tutorial-strip kbd {
        flex: 0 0 auto;
        min-width: 48px;
        padding: 5px 8px;
        border: 1px solid rgba(120, 199, 163, .65);
        background: rgba(120, 199, 163, .1);
        color: #dff9ec;
        font: 900 12px/1 Inter, system-ui, sans-serif;
        box-shadow: inset 0 -2px rgba(0,0,0,.28);
      }

      .game-ui.tutorial-cinematic > :not(.tutorial-dialogue):not(.ui-modal) {
        opacity: .14;
        filter: saturate(.55);
      }

      .game-ui.tutorial-restricted .hud-actions,
      .game-ui.tutorial-restricted .power-dock {
        opacity: .22;
        pointer-events: none !important;
      }

      .hud-prompt.movement kbd { min-width: 68px; width: auto; padding: 0 8px; }

      @media (max-width: 720px) {
        .tutorial-dialogue { top: 18%; width: calc(100% - 28px); padding: 15px 17px 17px; }
        .tutorial-dialogue__text { font-size: 17px; }
        .tutorial-strip { top: 66px; width: calc(100% - 20px); font-size: 12px; }
      }
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
      <div id="tutorial-dialogue-speaker" class="tutorial-dialogue__speaker"></div>
      <div id="tutorial-dialogue-text" class="tutorial-dialogue__text"></div>
    `;
    host.appendChild(dialogue);
  }

  let strip = document.getElementById("tutorial-strip");
  if (!strip) {
    strip = document.createElement("div");
    strip.id = "tutorial-strip";
    strip.className = "tutorial-strip";
    strip.innerHTML = `<kbd id="tutorial-strip-key"></kbd><span id="tutorial-strip-text"></span>`;
    host.appendChild(strip);
  }

  return { dialogue, strip };
}

class TutorialDirector {
  constructor(scene, uiScene) {
    this.scene = scene;
    this.uiScene = uiScene;
    this.state = TUTORIAL_STATES.WAITING;
    this.busy = false;
    this.started = false;
    this.ui = injectTutorialUi();
    this.originalCollectInteractions = scene.collectInteractions.bind(scene);
    this.originalAddMapLabel = scene.addMapLabel.bind(scene);
    this.keyDefaults = new Map();
    this.tipTimer = null;

    this.captureKeyDefaults(scene.keys);
    this.captureKeyDefaults(uiScene?.keys);
    this.installInteractionFilter();
    this.installMapLabelFilter();
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
  }

  captureKeyDefaults(keys) {
    if (!keys) return;
    for (const key of Object.values(keys)) {
      if (key && !this.keyDefaults.has(key)) this.keyDefaults.set(key, key.enabled !== false);
    }
  }

  installInteractionFilter() {
    this.scene.collectInteractions = () => this.filterActions(this.originalCollectInteractions());
  }

  installMapLabelFilter() {
    this.scene.addMapLabel = (text, ...rest) => {
      if (/^no te pienso dejar pasar$/i.test(String(text || "").trim())) return;
      return this.originalAddMapLabel(text, ...rest);
    };
  }

  filterActions(options) {
    if (this.state === TUTORIAL_STATES.COMPLETE) return options;
    if (this.busy || this.state === TUTORIAL_STATES.WAITING || this.state === TUTORIAL_STATES.INTRO) return [];

    const movement = options.filter(option => MOVEMENT_ACTION_TYPES.has(option.type));

    if ([TUTORIAL_STATES.ROOFTOP_MOVEMENT, TUTORIAL_STATES.APPROACH_THUG].includes(this.state)) {
      return movement;
    }

    if (this.state === TUTORIAL_STATES.DRAIN_THUG) {
      if (this.scene.feedingSystem?.isActive()) return [];
      const thugDrain = options.filter(option => option.type === "drain" && /rooftop_thug/.test(option.id || ""));
      return [...movement, ...thugDrain];
    }

    if (this.state === TUTORIAL_STATES.REACH_TIP) {
      const clue = options.filter(option => option.id === "mission_collect_police_roof_tip");
      return [...movement, ...clue];
    }

    return [];
  }

  setKeyEnabled(key, enabled) {
    if (!key) return;
    key.enabled = enabled;
    if (!enabled) key.reset?.();
  }

  setControlMode(mode) {
    const gameplay = this.scene.keys || {};
    const ui = this.uiScene?.keys || {};
    const movementKeys = [gameplay.up, gameplay.down, gameplay.left, gameplay.right, gameplay.w, gameplay.a, gameplay.s, gameplay.d];
    const routeKey = gameplay.space;
    const interactionKey = gameplay.interact;

    for (const key of this.keyDefaults.keys()) this.setKeyEnabled(key, false);

    if (mode === "movement" || mode === "drain" || mode === "tip") {
      for (const key of movementKeys) this.setKeyEnabled(key, true);
      this.setKeyEnabled(routeKey, true);
    }

    if (mode === "drain" || mode === "tip") this.setKeyEnabled(interactionKey, true);

    if (mode === "full") {
      for (const [key, enabled] of this.keyDefaults.entries()) this.setKeyEnabled(key, enabled);
    }

    const restricted = mode !== "full";
    document.getElementById("game-ui")?.classList.toggle("tutorial-restricted", restricted);
    this.setKeyEnabled(ui.help, mode === "full");
    this.setKeyEnabled(ui.mission, mode === "full");
  }

  freezeWorld(frozen) {
    this.scene.taskRevealCinematic ||= { active: false, queued: null, initialPlayed: true };
    this.scene.taskRevealCinematic.active = frozen;
    this.scene.registry.set("taskRevealActive", frozen);
    document.getElementById("game-ui")?.classList.toggle("tutorial-cinematic", frozen);
    if (frozen) {
      this.scene.nearestInteraction = null;
      this.scene.nearestMovement = null;
      this.scene.input.keyboard?.resetKeys?.();
    }
  }

  wait(ms) {
    return new Promise(resolve => this.scene.time.delayedCall(ms, resolve));
  }

  tweenZoom(targetZoom, duration, ease = "Sine.easeInOut") {
    const camera = this.scene.cameras.main;
    return new Promise(resolve => {
      this.scene.tweens.add({
        targets: camera,
        zoom: targetZoom,
        duration,
        ease,
        onUpdate: () => camera.centerOn(this.scene.player.x, this.scene.player.y),
        onComplete: resolve
      });
    });
  }

  async showDialogue({ speaker, text, kind = "speech", duration = 4200 }) {
    const dialogue = this.ui?.dialogue;
    if (!dialogue) return;

    dialogue.className = `tutorial-dialogue ${kind}`;
    dialogue.querySelector("#tutorial-dialogue-speaker").textContent = speaker;
    dialogue.querySelector("#tutorial-dialogue-text").textContent = text;
    window.requestAnimationFrame(() => dialogue.classList.add("open"));
    await this.wait(duration);
    dialogue.classList.remove("open");
    await this.wait(240);
  }

  setTip(key, text, duration = 0) {
    const strip = this.ui?.strip;
    if (!strip) return;
    if (this.tipTimer) {
      this.tipTimer.remove?.();
      this.tipTimer = null;
    }

    strip.querySelector("#tutorial-strip-key").textContent = key || "TIP";
    strip.querySelector("#tutorial-strip-text").textContent = text || "";
    strip.classList.toggle("visible", Boolean(text));

    if (text && duration > 0) {
      this.tipTimer = this.scene.time.delayedCall(duration, () => {
        strip.classList.remove("visible");
        this.tipTimer = null;
      });
    }
  }

  async startIntro() {
    if (this.started) return;
    this.started = true;
    this.state = TUTORIAL_STATES.INTRO;
    this.busy = true;
    this.setControlMode("locked");
    this.setTip("", "");
    this.freezeWorld(true);
    document.getElementById("task-reveal")?.classList.remove("open");

    const camera = this.scene.cameras.main;
    const normalZoom = normalZoomFor(this.scene);
    const closeZoom = Math.min(normalZoom * 3.35, 9.2);
    this.scene.tweens.killTweensOf(camera);
    camera.stopFollow();
    camera.setBounds(-WORLD.width, -WORLD.height, WORLD.width * 3, WORLD.height * 3);
    camera.centerOn(this.scene.player.x, this.scene.player.y);
    camera.setZoom(normalZoom);

    await this.tweenZoom(closeZoom, 820, "Cubic.easeOut");
    await this.showDialogue({
      speaker: "TÚ",
      text: "Otra noche más. Igual que la anterior. Igual que la que vendrá. Estoy... atrapado.",
      kind: "speech",
      duration: 4800
    });
    await this.showDialogue({
      speaker: "TÚ",
      text: "Mi maestro... escucho su llamada.",
      kind: "speech",
      duration: 3000
    });
    await this.showDialogue({
      speaker: "TU SIRE · EN TU MENTE",
      text: "Mi pequeño niño, llegó el momento de que me seas útil. Cruza por los tejados y llega a la comisaría. Allí te darán un chivatazo para que puedas cazar al traidor que pretende delatarnos.",
      kind: "thought",
      duration: 8200
    });

    camera.setBounds(0, 0, WORLD.width, WORLD.height);
    await this.tweenZoom(normalZoom, 2500, "Sine.easeInOut");
    camera.setZoom(normalZoom);
    camera.centerOn(this.scene.player.x, this.scene.player.y);
    camera.startFollow(this.scene.player, true, 0.12, 0.12);

    this.freezeWorld(false);
    this.state = TUTORIAL_STATES.ROOFTOP_MOVEMENT;
    this.busy = false;
    this.setControlMode("movement");
    this.setTip("ESPACIO", "Pulsa flechas o WASD para moverte. Pulsa ESPACIO para correr y para saltar de tejado en tejado.");
  }

  update() {
    if (this.busy || !this.started) return;

    if (this.state === TUTORIAL_STATES.ROOFTOP_MOVEMENT && this.reachedBlockerRoof()) {
      this.runBlockerWarning();
      return;
    }

    if (this.state === TUTORIAL_STATES.APPROACH_THUG && this.distanceToThug() <= 42) {
      this.runThugDialogue();
      return;
    }

    if (this.state === TUTORIAL_STATES.DRAIN_THUG) {
      const thug = this.thug();
      if (thug?.dead && thug.deathKind === "drained") this.runHungerLesson();
      return;
    }

    if (this.state === TUTORIAL_STATES.REACH_TIP && this.scene.missionSystem?.tipCollected) {
      this.runFinalSireMessage();
    }
  }

  thug() {
    return this.scene.npcSystem?.npcs?.find(npc => npc.id === "rooftop_thug") || null;
  }

  distanceToThug() {
    const thug = this.thug();
    if (!thug || this.scene.currentLayer !== thug.layer) return Infinity;
    return Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, thug.x, thug.y);
  }

  reachedBlockerRoof() {
    return this.scene.currentLayer === LAYERS.ROOF_LOW
      && this.scene.player.x >= 520
      && this.scene.player.x <= 675
      && this.scene.player.y >= 92
      && this.scene.player.y <= 242;
  }

  async runBlockerWarning() {
    this.busy = true;
    this.state = TUTORIAL_STATES.BLOCKER_WARNING;
    this.setControlMode("locked");
    this.freezeWorld(true);
    await this.showDialogue({
      speaker: "TU SIRE · EN TU MENTE",
      text: "No dejes que nadie se interponga en tu camino. Elimina a ese desgraciado.",
      kind: "thought",
      duration: 5600
    });
    this.freezeWorld(false);
    this.state = TUTORIAL_STATES.APPROACH_THUG;
    this.busy = false;
    this.setControlMode("movement");
    this.setTip("WASD", "Acércate al matón. Por ahora, solo el movimiento está disponible.");
  }

  async runThugDialogue() {
    this.busy = true;
    this.state = TUTORIAL_STATES.THUG_DIALOGUE;
    this.setControlMode("locked");
    this.freezeWorld(true);
    await this.showDialogue({
      speaker: "MATÓN",
      text: "No te dejaré pasar.",
      kind: "thug",
      duration: 3600
    });
    this.freezeWorld(false);
    this.state = TUTORIAL_STATES.DRAIN_THUG;
    this.busy = false;
    this.setControlMode("drain");
    this.setTip("E", "Pulsa E para drenar al objetivo. Durante este tutorial, es la única acción ofensiva disponible.");
  }

  async runHungerLesson() {
    this.busy = true;
    this.state = TUTORIAL_STATES.HUNGER_LESSON;
    this.setControlMode("locked");
    this.freezeWorld(true);
    await this.showDialogue({
      speaker: "TU SIRE · EN TU MENTE",
      text: "Alimentarte reduce tu hambre. Usar tus poderes la aumenta. No dejes que suba demasiado o perderás el control. Y no permitas que nadie te vea alimentarte: pondrías en peligro el velo que mantenemos ante los humanos.",
      kind: "thought",
      duration: 10500
    });
    this.freezeWorld(false);
    this.state = TUTORIAL_STATES.REACH_TIP;
    this.busy = false;
    this.setControlMode("tip");
    this.setTip("ESPACIO / E", "Cruza hasta la comisaría con ESPACIO y pulsa E para recoger el chivatazo.");
  }

  async runFinalSireMessage() {
    this.busy = true;
    this.state = TUTORIAL_STATES.FINAL_SIRE;
    this.setControlMode("locked");
    this.freezeWorld(true);
    await this.showDialogue({
      speaker: "TU SIRE · EN TU MENTE",
      text: "Acaba con él y vuelve al refugio. No la cagues.",
      kind: "thought",
      duration: 6500
    });
    this.freezeWorld(false);
    this.state = TUTORIAL_STATES.COMPLETE;
    this.busy = false;
    this.setControlMode("full");
    this.setTip("ESPACIO", "Puedes usar ESPACIO para saltar entre edificios, subir o bajar escaleras de incendios y acceder a las cloacas.", 12000);
  }

  interceptTaskReveal(payload) {
    if (this.state !== TUTORIAL_STATES.COMPLETE) return true;
    this.showLaterSireThought(payload);
    return true;
  }

  async showLaterSireThought(payload) {
    if (this.busy || this.scene.missionSystem?.failed || this.scene.missionSystem?.completed) return;
    this.busy = true;
    this.setControlMode("locked");
    this.freezeWorld(true);

    const camera = this.scene.cameras.main;
    const normalZoom = normalZoomFor(this.scene);
    const closeZoom = Math.min(normalZoom * 1.55, 5.8);
    camera.stopFollow();
    camera.setBounds(0, 0, WORLD.width, WORLD.height);
    await this.tweenZoom(closeZoom, 520, "Cubic.easeOut");
    await this.showDialogue({
      speaker: "TU SIRE · EN TU MENTE",
      text: LATER_SIRE_LINES[payload?.step] || payload?.text || "Continúa. No me decepciones.",
      kind: "thought",
      duration: 6200
    });
    await this.tweenZoom(normalZoom, 1500, "Sine.easeInOut");
    camera.startFollow(this.scene.player, true, 0.12, 0.12);

    this.freezeWorld(false);
    this.setControlMode("full");
    this.busy = false;
  }
}

function installPrototypeHooks() {
  if (!GameScene.prototype.__nbdSireTutorialRevealPatch) {
    const previousTaskReveal = GameScene.prototype.playTaskReveal;
    GameScene.prototype.playTaskReveal = function playTaskRevealAsSireThought(payload, ...rest) {
      if (this.tutorialDirector?.interceptTaskReveal(payload)) return;
      return previousTaskReveal?.call(this, payload, ...rest);
    };
    GameScene.prototype.__nbdSireTutorialRevealPatch = true;
  }

  if (!UIScene.prototype.__nbdSireTutorialIntroPatch) {
    const previousCloseIntro = UIScene.prototype.closeIntro;
    const previousRenderModal = UIScene.prototype.renderModal;

    UIScene.prototype.closeIntro = function closeIntroIntoNarrativeTutorial(...args) {
      const result = previousCloseIntro.apply(this, args);
      const gameScene = this.scene.get("GameScene");
      gameScene?.tutorialDirector?.startIntro();
      return result;
    };

    UIScene.prototype.renderModal = function renderTutorialIntroModal(data) {
      const result = previousRenderModal.call(this, data);
      if (this.introOpen) {
        this.setModal(
          "Night Blood District",
          `<p><strong>La noche vuelve a empezar.</strong> Tu sire te llama desde algún lugar de tu mente.</p><p>Pulsa comenzar para escuchar su orden.</p>`,
          "Comenzar la noche · Enter"
        );
      }
      return result;
    };

    UIScene.prototype.__nbdSireTutorialIntroPatch = true;
  }
}

function attachDirector() {
  const game = window.NBD_PHASER_GAME;
  const gameScene = game?.scene?.getScene?.("GameScene");
  const uiScene = game?.scene?.getScene?.("UIScene");

  if (!gameScene?.missionSystem || !uiScene?.keys) {
    window.requestAnimationFrame(attachDirector);
    return;
  }

  if (!gameScene.tutorialDirector) {
    gameScene.tutorialDirector = new TutorialDirector(gameScene, uiScene);
  }
}

installPrototypeHooks();
injectTutorialUi();
attachDirector();
