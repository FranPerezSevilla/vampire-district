import { TutorialDirector } from "./TutorialDirector.js";

function applyRestoredTutorial(scene, uiScene, director) {
  scene.campaignCheckpointSystem?.applyPendingNpcState?.(director.informant);
  const checkpoint = scene.campaignCheckpointSystem?.tutorialCheckpoint?.()
    || scene.pendingTutorialCheckpoint;
  if (!checkpoint?.completed) return false;

  director.started = true;
  director.introPromise = Promise.resolve();
  director.busy = false;
  director.state = "complete";
  director.finalAdviceShown = checkpoint.finalAdviceShown !== false;
  director.freezeWorld(false);
  director.setControlMode("full");
  director.setTip("", "");
  director.hideDialogue();

  if (checkpoint.informantGone && director.informant) {
    director.informant.inactive = true;
    director.informant.vx = 0;
    director.informant.vy = 0;
    director.informant.container?.setAlpha?.(0).setVisible?.(false);
  }
  scene.registry?.set?.("campaignResumeApplied", true);
  scene.inputSystem?.resetWorldEdges?.();
  if (uiScene.introOpen) uiScene.closeIntro?.();
  return true;
}

function attachTutorialDirector() {
  const game = window.NBD_PHASER_GAME;
  const scene = game?.scene?.getScene?.("GameScene");
  const uiScene = game?.scene?.getScene?.("UIScene");
  if (!scene?.inputSystem
    || !scene?.npcSystem
    || !scene?.campaignCheckpointSystem
    || !uiScene?.dom) {
    window.requestAnimationFrame(attachTutorialDirector);
    return;
  }
  if (scene.tutorialDirector) return;

  const director = new TutorialDirector(scene, uiScene);
  scene.tutorialDirector = director;
  applyRestoredTutorial(scene, uiScene, director);

  const startIfReady = () => {
    if (!uiScene.introOpen && !director.started) void director.startIntro();
  };
  scene.registry?.events?.on?.("changedata-uiPaused", (_parent, paused) => {
    if (!paused) startIfReady();
  });
  startIfReady();
}

attachTutorialDirector();
