import { BOOT_MODES, bootProfile } from "../boot/BootProfile.js";
import { TutorialDirector } from "./TutorialDirector.js";

function completeTutorial(scene, uiScene, director, { moveToFreeRoamSpawn = false } = {}) {
  director.started = true;
  director.introPromise = Promise.resolve();
  director.busy = false;
  director.state = "complete";
  director.finalAdviceShown = true;
  director.freezeWorld(false);
  director.setControlMode("full");
  director.setTip("", "");
  director.hideDialogue();

  if (director.informant) {
    director.informant.inactive = true;
    director.informant.vx = 0;
    director.informant.vy = 0;
    director.informant.container?.setAlpha?.(0).setVisible?.(false);
  }
  if (uiScene.introOpen) uiScene.closeIntro?.();
  scene.registry?.set?.("campaignResumeApplied", true);
  scene.registry?.set?.("bootMode", bootProfile.mode);
  scene.inputSystem?.resetWorldEdges?.();

  if (moveToFreeRoamSpawn) {
    const persistent = bootProfile.mode === BOOT_MODES.NORMAL;
    scene.switchLayer?.(
      bootProfile.spawn.layer,
      { x: bootProfile.spawn.x, y: bootProfile.spawn.y },
      persistent
        ? "CITY FREE ROAM: no active contract. Campaign economy and vehicles remain persistent."
        : "EXPLORATION MODE: no tutorial, mission or persistent campaign changes."
    );
    scene.lastActionText = persistent
      ? "CITY FREE ROAM: drive, fight and inspect the district while the city is redesigned."
      : "EXPLORATION MODE: drive, fight and test the district freely. Progress is not saved.";
  }
  return true;
}

function applyRestoredTutorial(scene, uiScene, director) {
  scene.campaignCheckpointSystem?.applyPendingNpcState?.(director.informant);
  const checkpoint = scene.campaignCheckpointSystem?.tutorialCheckpoint?.()
    || scene.pendingTutorialCheckpoint;
  if (!checkpoint?.completed) return false;

  completeTutorial(scene, uiScene, director);
  director.finalAdviceShown = checkpoint.finalAdviceShown !== false;
  if (!checkpoint.informantGone && director.informant) {
    director.informant.inactive = false;
    director.informant.container?.setAlpha?.(1).setVisible?.(true);
  }
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
    window.setTimeout(attachTutorialDirector, 16);
    return;
  }
  if (scene.tutorialDirector) return;

  const director = new TutorialDirector(scene, uiScene);
  scene.tutorialDirector = director;

  if (bootProfile.skipTutorial) {
    completeTutorial(scene, uiScene, director, {
      moveToFreeRoamSpawn: bootProfile.startOnStreet
    });
    window.NBD_EXPLORE_READY = bootProfile.mode === BOOT_MODES.EXPLORE;
    window.NBD_FREE_ROAM_READY = true;
    return;
  }

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
