import { CONTROL_MODES } from "./actions.js";

const STATE_MODE = Object.freeze({
  waiting: CONTROL_MODES.LOCKED,
  intro: CONTROL_MODES.LOCKED,
  "rooftop-movement": CONTROL_MODES.MOVEMENT,
  "blocker-warning": CONTROL_MODES.LOCKED,
  "approach-thug": CONTROL_MODES.MOVEMENT,
  "thug-dialogue": CONTROL_MODES.LOCKED,
  "drain-thug": CONTROL_MODES.DRAIN,
  "hunger-lesson": CONTROL_MODES.LOCKED,
  "reach-tip": CONTROL_MODES.TIP,
  "police-informant": CONTROL_MODES.LOCKED,
  "final-sire": CONTROL_MODES.LOCKED,
  "boundary-warning": CONTROL_MODES.LOCKED,
  complete: CONTROL_MODES.FULL
});

function enableGameplayKeys(scene) {
  for (const key of Object.values(scene.keys || {})) {
    if (!key) continue;
    key.enabled = true;
    key.reset?.();
  }
}

function attachTutorialInputAdapter() {
  const game = window.NBD_PHASER_GAME;
  const scene = game?.scene?.getScene?.("GameScene");
  const uiScene = game?.scene?.getScene?.("UIScene");
  const director = scene?.tutorialDirector;

  if (!scene?.inputSystem || !director || !uiScene?.keys) {
    window.requestAnimationFrame(attachTutorialInputAdapter);
    return;
  }
  if (director.__nbdInputAdapterPatch) return;

  enableGameplayKeys(scene);

  director.setControlMode = function setControlModeThroughInputSystem(mode) {
    const normalized = STATE_MODE[mode] || mode || CONTROL_MODES.FULL;
    this.scene.inputSystem?.setControlMode(normalized);
    enableGameplayKeys(this.scene);

    const restricted = normalized !== CONTROL_MODES.FULL;
    document.getElementById("game-ui")?.classList.toggle("tutorial-restricted", restricted);
    this.setKeyEnabled?.(this.uiScene?.keys?.help, !restricted);
    this.setKeyEnabled?.(this.uiScene?.keys?.mission, !restricted);
  };

  const originalFreezeWorld = director.freezeWorld.bind(director);
  director.freezeWorld = function freezeWorldThroughInputSystem(frozen) {
    this.scene.inputSystem?.setWorldEnabled(!frozen);
    if (frozen) this.scene.inputSystem?.reset();
    return originalFreezeWorld(frozen);
  };

  const initialMode = director.busy
    ? CONTROL_MODES.LOCKED
    : STATE_MODE[director.state] || CONTROL_MODES.FULL;
  director.setControlMode(initialMode);
  director.__nbdInputAdapterPatch = true;
}

attachTutorialInputAdapter();
