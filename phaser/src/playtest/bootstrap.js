import { BOOT_MODES, bootProfile } from "../boot/BootProfile.js";
import { PlaytestSessionSystem } from "./PlaytestSessionSystem.js";
import { PlaytestUi } from "./PlaytestUi.js";

function installStylesheet() {
  if (document.querySelector('link[data-viceblood-playtest="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("../../playtest.css", import.meta.url).href;
  link.dataset.vicebloodPlaytest = "true";
  document.head.appendChild(link);
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
  if (scene.playtestSessionSystem) return;

  installStylesheet();
  const session = new PlaytestSessionSystem(scene);
  const ui = new PlaytestUi(session, scene);
  scene.playtestUi = ui;
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => ui.destroy());

  window.NBD_PLAYTEST_SESSION = Object.freeze({
    start: () => session.start(),
    snapshot: () => session.snapshot(),
    result: () => session.result(),
    restart: () => session.restart()
  });
  window.NBD_PLAYTEST_READY = true;
  window.dispatchEvent(new CustomEvent("nbd:playtest-ready", {
    detail: { id: session.config.id, mode: bootProfile.mode }
  }));
}

attachPlaytest();
