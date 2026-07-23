import { ReleaseCandidateHarness } from "./ReleaseCandidateHarness.js";

function attachHarness() {
  const game = window.NBD_PHASER_GAME;
  const gameScene = game?.scene?.getScene?.("GameScene");
  const uiScene = game?.scene?.getScene?.("UIScene");
  if (!gameScene?.inputSystem || !gameScene?.tutorialDirector || !uiScene?.dom) {
    window.setTimeout(attachHarness, 16);
    return;
  }
  if (window.NBD_RC_HARNESS) return;

  window.NBD_RC_HARNESS = new ReleaseCandidateHarness(gameScene, uiScene);
  window.NBD_RC_HARNESS_READY = true;
  window.dispatchEvent(new CustomEvent("nbd:rc-harness-ready"));
}

window.NBD_RC_HARNESS_READY = false;
attachHarness();
