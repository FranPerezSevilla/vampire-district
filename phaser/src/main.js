import { BootScene } from "./scenes/BootScene.js";
import { GameScene } from "./scenes/GameScene.js";
import { UIScene } from "./scenes/UIScene.js";
import { CAMERA, WORLD } from "./data/balance.js";
import { LAYERS } from "./data/district.js";

const RESOLUTION_STORAGE_KEY = "nbd-resolution-preset";
const RESOLUTION_PRESETS = Object.freeze({
  compact: Object.freeze({ displayWidth: 960, renderScale: 1.5 }),
  large: Object.freeze({ displayWidth: 1280, renderScale: 2 }),
  qhd: Object.freeze({ displayWidth: 1440, renderScale: 2.25 }),
  ultra: Object.freeze({ displayWidth: 1920, renderScale: 3 })
});

const TASK_REVEALS = Object.freeze({
  0: Object.freeze({ step: "TASK 1 / 4", text: "Cross the rooftops. Neutralize the blocker and reach the police roof." }),
  1: Object.freeze({ step: "TASK 2 / 4", text: "The journalist is near the nightclub. Reach the club district." }),
  2: Object.freeze({ step: "TASK 3 / 4", text: "Find and neutralize the journalist without breaking the veil." }),
  3: Object.freeze({ step: "TASK 4 / 4", text: "Return to the rooftop refuge and report to the clan." })
});

function savedResolutionKey() {
  try {
    const saved = window.localStorage.getItem(RESOLUTION_STORAGE_KEY);
    return RESOLUTION_PRESETS[saved] ? saved : "qhd";
  } catch {
    return "qhd";
  }
}

const resolutionKey = savedResolutionKey();
const resolutionPreset = RESOLUTION_PRESETS[resolutionKey];
const renderScale = resolutionPreset.renderScale;
const deviceResolution = Math.min(Math.max(window.devicePixelRatio || 1, 1), 1.25);

window.NBD_RESOLUTION_PRESET = { key: resolutionKey, ...resolutionPreset };
document.documentElement.style.setProperty("--game-width", `${resolutionPreset.displayWidth}px`);
document.documentElement.style.setProperty("--game-height", `${Math.round(resolutionPreset.displayWidth * 2 / 3)}px`);

const TINY_MAP_LABELS_TO_HIDE = new Set([
  "LAMP",
  "JUMP",
  "JUMP ARC",
  "LAND",
  "DOWN",
  "DROP",
  "FIRE",
  "SEWER"
]);

function bindResolutionSelector() {
  const select = document.getElementById("resolution-select");
  if (!select) return;
  select.value = resolutionKey;
  select.addEventListener("change", () => {
    const nextKey = RESOLUTION_PRESETS[select.value] ? select.value : "qhd";
    try {
      window.localStorage.setItem(RESOLUTION_STORAGE_KEY, nextKey);
    } catch {
      // The selected value still applies after a normal reload when storage is available.
    }
    window.location.reload();
  });
}

function patchReadableCanvasText() {
  const factory = Phaser.GameObjects?.GameObjectFactory?.prototype;
  if (!factory || factory.__nbdReadableTextPatch) return;
  const originalText = factory.text;
  factory.text = function patchedText(x, y, value, style = {}) {
    const raw = String(value ?? "");
    const nextStyle = { ...(style || {}) };
    const fontSize = Number.parseFloat(String(nextStyle.fontSize || "")) || 0;

    if (fontSize && fontSize < 12) nextStyle.fontSize = "12px";
    if (!nextStyle.fontFamily || nextStyle.fontFamily === "monospace") {
      nextStyle.fontFamily = "Arial, Helvetica, sans-serif";
    }
    nextStyle.fontStyle ||= "700";

    const displayValue = TINY_MAP_LABELS_TO_HIDE.has(raw.trim().toUpperCase()) ? "" : value;
    const textObject = originalText.call(this, x, y, displayValue, nextStyle);
    textObject.setResolution?.(3);
    textObject.setStroke?.("#05060b", 3);
    return textObject;
  };
  factory.__nbdReadableTextPatch = true;
}

function suppressStreetBuildingLabelsOnRoofs() {
  const originalDrawBuilding = GameScene.prototype.drawBuilding;
  if (!originalDrawBuilding || originalDrawBuilding.__nbdRoofLabelPatch) return;

  function patchedDrawBuilding(building) {
    if (this.currentLayer === LAYERS.STREET) {
      return originalDrawBuilding.call(this, building);
    }

    const originalAddMapLabel = this.addMapLabel;
    this.addMapLabel = () => {};
    try {
      return originalDrawBuilding.call(this, building);
    } finally {
      this.addMapLabel = originalAddMapLabel;
    }
  }

  patchedDrawBuilding.__nbdRoofLabelPatch = true;
  GameScene.prototype.drawBuilding = patchedDrawBuilding;
}

function baseCameraZoom(scene) {
  const baseZoom = scene.currentLayer === LAYERS.ROOF_HIGH
    ? CAMERA.roofHighZoom
    : scene.currentLayer === LAYERS.ROOF_LOW
      ? CAMERA.roofLowZoom
      : scene.currentLayer === LAYERS.SEWER
        ? CAMERA.sewerZoom
        : CAMERA.streetZoom;
  return baseZoom * renderScale;
}

function useSelectedRenderScaleForCamera() {
  function updateCameraForSelectedResolution() {
    const camera = this.cameras.main;
    const targetZoom = baseCameraZoom(this);
    camera.setZoom(Phaser.Math.Linear(camera.zoom, targetZoom, 0.08));
  }

  updateCameraForSelectedResolution.__nbdResolutionPatch = true;
  GameScene.prototype.updateCameraForLayer = updateCameraForSelectedResolution;
}

function injectTaskRevealUi() {
  if (!document.getElementById("nbd-task-reveal-style")) {
    const style = document.createElement("style");
    style.id = "nbd-task-reveal-style";
    style.textContent = `
      .task-reveal {
        position: absolute;
        left: 50%;
        top: 31%;
        width: min(520px, calc(100% - 48px));
        padding: 17px 20px 18px;
        border: 1px solid rgba(255, 242, 168, .92);
        border-radius: 18px;
        background: linear-gradient(145deg, rgba(17, 15, 24, .98), rgba(7, 8, 14, .97));
        box-shadow: 0 22px 80px rgba(0, 0, 0, .72), inset 0 0 0 1px rgba(255,255,255,.045);
        color: #f8f1ff;
        opacity: 0;
        transform: translate(-50%, -24px) scale(.82);
        transform-origin: 50% 100%;
        transition: opacity .22s ease, transform .38s cubic-bezier(.2,.9,.2,1.15);
        pointer-events: none;
        z-index: 80;
        text-align: left;
      }

      .task-reveal::after {
        content: "";
        position: absolute;
        left: 50%;
        bottom: -17px;
        width: 30px;
        height: 30px;
        background: #090a11;
        border-right: 1px solid rgba(255, 242, 168, .92);
        border-bottom: 1px solid rgba(255, 242, 168, .92);
        transform: translateX(-50%) rotate(45deg);
      }

      .task-reveal.open {
        opacity: 1;
        transform: translate(-50%, 0) scale(1);
      }

      .task-reveal__header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
        color: #ffb02e;
        font-size: 12px;
        font-weight: 900;
        letter-spacing: .12em;
        text-transform: uppercase;
      }

      .task-reveal__step {
        padding: 4px 7px;
        border: 1px solid rgba(255, 176, 46, .55);
        border-radius: 999px;
        background: rgba(255, 176, 46, .09);
        white-space: nowrap;
      }

      .task-reveal__text {
        position: relative;
        z-index: 1;
        font-size: clamp(18px, 1.8vw, 26px);
        line-height: 1.24;
        font-weight: 780;
        letter-spacing: -.015em;
        text-wrap: balance;
      }

      .game-ui.task-cinematic > :not(.task-reveal):not(.ui-modal) {
        opacity: .16;
        filter: saturate(.65);
        transition: opacity .25s ease, filter .25s ease;
      }

      .game-ui.task-cinematic .hud-button,
      .game-ui.task-cinematic button {
        pointer-events: none !important;
      }

      .game-ui.task-cinematic::before {
        opacity: .86;
        background: radial-gradient(circle at 50% 50%, transparent 16%, rgba(2, 3, 8, .34) 60%, rgba(2, 3, 8, .76) 100%);
      }

      @media (max-width: 720px) {
        .task-reveal {
          top: 27%;
          width: calc(100% - 30px);
          padding: 14px 16px 16px;
        }
        .task-reveal__text { font-size: 17px; }
      }
    `;
    document.head.appendChild(style);
  }

  let overlay = document.getElementById("task-reveal");
  if (overlay) return overlay;

  const host = document.getElementById("game-ui") || document.querySelector(".game-frame");
  if (!host) return null;

  overlay = document.createElement("div");
  overlay.id = "task-reveal";
  overlay.className = "task-reveal";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.innerHTML = `
    <div class="task-reveal__header">
      <span id="task-reveal-step" class="task-reveal__step">TASK</span>
      <span>New objective</span>
    </div>
    <div id="task-reveal-text" class="task-reveal__text"></div>
  `;
  host.appendChild(overlay);
  return overlay;
}

function setTaskRevealUi(payload, open) {
  const overlay = injectTaskRevealUi();
  if (!overlay) return;

  const step = overlay.querySelector("#task-reveal-step");
  const text = overlay.querySelector("#task-reveal-text");
  if (payload) {
    if (step) step.textContent = payload.step || "NEW TASK";
    if (text) text.textContent = payload.text || "";
  }

  if (open) {
    window.requestAnimationFrame(() => overlay.classList.add("open"));
  } else {
    overlay.classList.remove("open");
  }
}

function installTaskRevealCinematics() {
  if (GameScene.prototype.__nbdTaskRevealPatch) return;

  const originalCreate = GameScene.prototype.create;
  const originalUpdate = GameScene.prototype.update;
  const originalCloseIntro = UIScene.prototype.closeIntro;
  const originalUiHandleKeys = UIScene.prototype.handleKeys;

  GameScene.prototype.create = function createWithTaskReveal(...args) {
    const result = originalCreate.apply(this, args);
    this.taskRevealCinematic = {
      active: false,
      queued: null,
      initialPlayed: false
    };

    const mission = this.missionSystem;
    if (mission?.setStep && !mission.setStep.__nbdTaskRevealPatch) {
      const originalSetStep = mission.setStep.bind(mission);
      const scene = this;
      const patchedSetStep = function setStepWithReveal(step, ...rest) {
        const setStepResult = originalSetStep(step, ...rest);
        const payload = TASK_REVEALS[step];
        if (payload && step > 0 && step < 4) {
          scene.time.delayedCall(120, () => scene.playTaskReveal(payload));
        }
        return setStepResult;
      };
      patchedSetStep.__nbdTaskRevealPatch = true;
      mission.setStep = patchedSetStep;
    }

    return result;
  };

  GameScene.prototype.update = function updateWithTaskReveal(...args) {
    if (this.taskRevealCinematic?.active) {
      this.nearestInteraction = null;
      this.promptGraphics?.clear();
      this.publishState?.();
      return;
    }
    return originalUpdate.apply(this, args);
  };

  GameScene.prototype.playTaskReveal = function playTaskReveal(payload) {
    if (!payload || this.missionSystem?.failed || this.missionSystem?.completed) return;
    if (!this.taskRevealCinematic) {
      this.taskRevealCinematic = { active: false, queued: null, initialPlayed: false };
    }

    if (this.taskRevealCinematic.active) {
      this.taskRevealCinematic.queued = payload;
      return;
    }

    const cinematic = this.taskRevealCinematic;
    const camera = this.cameras.main;
    const normalZoom = baseCameraZoom(this);
    const closeZoom = Math.min(normalZoom * 3.15, 8.75);
    cinematic.active = true;
    cinematic.queued = null;
    this.registry.set("taskRevealActive", true);
    this.nearestInteraction = null;
    this.interactionSystem?.close?.();
    this.input.keyboard?.resetKeys?.();

    setTaskRevealUi(payload, false);
    document.getElementById("game-ui")?.classList.add("task-cinematic");

    this.tweens.killTweensOf(camera);
    camera.stopFollow();
    camera.setBounds(-WORLD.width, -WORLD.height, WORLD.width * 3, WORLD.height * 3);
    camera.centerOn(this.player.x, this.player.y);
    camera.setZoom(normalZoom);

    this.tweens.add({
      targets: camera,
      zoom: closeZoom,
      duration: 760,
      ease: "Cubic.easeOut",
      onUpdate: () => camera.centerOn(this.player.x, this.player.y),
      onComplete: () => {
        setTaskRevealUi(payload, true);
        this.time.delayedCall(2150, () => {
          setTaskRevealUi(payload, false);
          this.time.delayedCall(180, () => {
            this.tweens.add({
              targets: camera,
              zoom: normalZoom,
              duration: 980,
              ease: "Cubic.easeInOut",
              onUpdate: () => camera.centerOn(this.player.x, this.player.y),
              onComplete: () => {
                camera.setBounds(0, 0, WORLD.width, WORLD.height);
                camera.startFollow(this.player, true, 0.12, 0.12);
                cinematic.active = false;
                this.registry.set("taskRevealActive", false);
                document.getElementById("game-ui")?.classList.remove("task-cinematic");
                this.input.keyboard?.resetKeys?.();

                const queued = cinematic.queued;
                cinematic.queued = null;
                if (queued) this.time.delayedCall(180, () => this.playTaskReveal(queued));
              }
            });
          });
        });
      }
    });
  };

  UIScene.prototype.closeIntro = function closeIntroWithFirstTask(...args) {
    const result = originalCloseIntro.apply(this, args);
    const gameScene = this.scene.get("GameScene");
    if (gameScene && !gameScene.taskRevealCinematic?.initialPlayed) {
      gameScene.taskRevealCinematic ||= { active: false, queued: null, initialPlayed: false };
      gameScene.taskRevealCinematic.initialPlayed = true;
      gameScene.playTaskReveal?.(TASK_REVEALS[0]);
    }
    return result;
  };

  UIScene.prototype.handleKeys = function handleKeysDuringTaskReveal(...args) {
    if (this.registry.get("taskRevealActive")) return;
    return originalUiHandleKeys.apply(this, args);
  };

  GameScene.prototype.__nbdTaskRevealPatch = true;
}

bindResolutionSelector();
patchReadableCanvasText();
suppressStreetBuildingLabelsOnRoofs();
useSelectedRenderScaleForCamera();
injectTaskRevealUi();
installTaskRevealCinematics();

const config = {
  type: Phaser.AUTO,
  parent: "game-root",
  width: Math.round(WORLD.width * renderScale),
  height: Math.round(WORLD.height * renderScale),
  resolution: deviceResolution,
  backgroundColor: "#05060b",
  pixelArt: false,
  roundPixels: false,
  render: {
    antialias: true,
    antialiasGL: true,
    pixelArt: false,
    roundPixels: false
  },
  physics: {
    default: "arcade",
    arcade: {
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [BootScene, GameScene, UIScene]
};

window.NBD_PHASER_GAME = new Phaser.Game(config);
