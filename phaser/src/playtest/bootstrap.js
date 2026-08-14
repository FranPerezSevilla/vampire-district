import { BOOT_MODES, bootProfile } from "../boot/BootProfile.js";
import { CAMERA } from "../data/balance.js";
import { LAYERS } from "../data/district.js";
import { PoliceKnowledgePolicy } from "../police/PoliceKnowledgePolicy.js";
import { AmbientViolenceResponseSystem } from "./AmbientViolenceResponseSystem.js";
import { AudioLab } from "./AudioLab.js";
import {
  failPlaytestBootCover,
  finishPlaytestBootCover,
  installPlaytestStylesheet,
  showPlaytestBootCover
} from "./PlaytestBootCover.js";
import { PlaytestSessionSystem } from "./PlaytestSessionSystem.js";
import { PlaytestUi } from "./PlaytestUi.js";

function cameraZoomForLayer(layer) {
  if (layer === LAYERS.ROOF_HIGH) return CAMERA.roofHighZoom;
  if (layer === LAYERS.ROOF_LOW) return CAMERA.roofLowZoom;
  if (layer === LAYERS.SEWER) return CAMERA.sewerZoom;
  return CAMERA.streetZoom;
}

function settlePlaytestCamera(scene) {
  const camera = scene?.cameras?.main;
  const player = scene?.player;
  if (!camera || !player) return;
  const renderScale = Number(window.NBD_RESOLUTION_PRESET?.renderScale) || 1;
  camera.stopFollow?.();
  camera.setZoom?.(cameraZoomForLayer(scene.currentLayer) * renderScale);
  camera.centerOn?.(player.x, player.y);
  camera.startFollow?.(player, true, 0.12, 0.12);
}

function polishPlaytestIntro() {
  const panel = document.querySelector("#playtest-intro .playtest-intro-panel");
  if (!panel) return;
  panel.classList.add("playtest-story-intro");
  panel.innerHTML = `
    <p class="playtest-kicker">VICEBLOOD · ONE MORE NIGHT</p>
    <h2 id="playtest-intro-title">Immortality was never<br>the luxury you imagined.</h2>
    <p class="playtest-character-line">You were turned into a vampire decades ago. Since then, clan wars and keeping the Veil hidden from humanity have defined every night of your existence.</p>
    <p class="playtest-story-goal">Tonight, hunger comes first. Feed, lose the police, and return to the refuge.</p>
    <p class="playtest-story-controls"><kbd>WASD</kbd> move · <kbd>RMB</kbd> feed · <kbd>F</kbd> Blood Sense</p>
    <button id="playtest-start" class="playtest-primary" type="button">Step into the night · Enter</button>`;

  const title = panel.querySelector("h2");
  const story = panel.querySelector(".playtest-character-line");
  const goal = panel.querySelector(".playtest-story-goal");
  if (title) {
    title.style.fontSize = "clamp(34px, 4.2vw, 46px)";
    title.style.lineHeight = "1.04";
    title.style.letterSpacing = "-.025em";
  }
  if (story) {
    story.style.margin = "18px 0 0";
    story.style.maxWidth = "610px";
    story.style.color = "#d8d0e3";
    story.style.fontSize = "16px";
    story.style.lineHeight = "1.5";
  }
  if (goal) {
    goal.style.margin = "20px 0 16px";
    goal.style.maxWidth = "610px";
    goal.style.lineHeight = "1.5";
  }
}

function attachPlaytest() {
  if (bootProfile.mode !== BOOT_MODES.PLAYTEST) return;
  const game = window.NBD_PHASER_GAME;
  const scene = game?.scene?.getScene?.("GameScene");
  const uiScene = game?.scene?.getScene?.("UIScene");
  if (!window.NBD_FREE_ROAM_READY
    || !scene?.feedingSystem
    || !scene?.heatSystem
    || !scene?.exposureSystem
    || !scene?.vehicleSystem
    || !uiScene?.dom) {
    window.setTimeout(attachPlaytest, 16);
    return;
  }
  if (scene.playtestSessionSystem) {
    finishPlaytestBootCover();
    return;
  }

  try {
    settlePlaytestCamera(scene);
    const session = new PlaytestSessionSystem(scene);
    const ui = new PlaytestUi(session, scene);
    const audioLab = new AudioLab(scene);
    polishPlaytestIntro();
    ui.intro = document.getElementById("playtest-intro");
    ui.startButton = document.getElementById("playtest-start");
    ui.startButton?.addEventListener("click", () => ui.start());
    scene.playtestUi = ui;
    scene.playtestAudioLab = audioLab;
    scene.playtestAmbientViolenceSystem = new AmbientViolenceResponseSystem(scene);
    scene.playtestPoliceKnowledgePolicy = new PoliceKnowledgePolicy(scene);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.playtestPoliceKnowledgePolicy?.destroy?.();
      scene.playtestPoliceKnowledgePolicy = null;
      scene.playtestAmbientViolenceSystem?.destroy?.();
      scene.playtestAmbientViolenceSystem = null;
      scene.playtestAudioLab?.destroy?.();
      scene.playtestAudioLab = null;
      ui.destroy();
    });

    window.NBD_PLAYTEST_SESSION = Object.freeze({
      start: () => session.start(),
      snapshot: () => session.snapshot(),
      result: () => session.result(),
      restart: () => session.restart(),
      openAudioLab: () => audioLab.open(),
      policeKnowledge: () => scene.playtestPoliceKnowledgePolicy?.snapshot?.() || null
    });
    window.NBD_PLAYTEST_READY = true;
    finishPlaytestBootCover();
    window.dispatchEvent(new CustomEvent("nbd:playtest-ready", {
      detail: { id: session.config.id, mode: bootProfile.mode }
    }));
  } catch (error) {
    window.NBD_PLAYTEST_READY = false;
    window.NBD_PLAYTEST_ERROR = error;
    console.error("Viceblood playtest failed to attach", error);
    failPlaytestBootCover(error);
  }
}

if (bootProfile.mode === BOOT_MODES.PLAYTEST) {
  installPlaytestStylesheet();
  showPlaytestBootCover();
  attachPlaytest();
}
