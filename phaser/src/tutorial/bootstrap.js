import { TutorialDirector } from "./TutorialDirector.js";

function attachTutorialDirector() {
  const game = window.NBD_PHASER_GAME;
  const scene = game?.scene?.getScene?.("GameScene");
  const uiScene = game?.scene?.getScene?.("UIScene");
  if (!scene?.inputSystem || !scene?.npcSystem || !uiScene?.dom) {
    window.requestAnimationFrame(attachTutorialDirector);
    return;
  }
  if (scene.tutorialDirector) return;

  const director = new TutorialDirector(scene, uiScene);
  scene.tutorialDirector = director;
  const startIfReady = () => {
    if (!uiScene.introOpen && !director.started) void director.startIntro();
  };
  scene.registry?.events?.on?.("changedata-uiPaused", (_parent, paused) => {
    if (!paused) startIfReady();
  });
  startIfReady();
}

attachTutorialDirector();
