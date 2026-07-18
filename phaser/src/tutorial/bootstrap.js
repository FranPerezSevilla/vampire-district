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
  scene.tutorialDirector = new TutorialDirector(scene, uiScene);
}

attachTutorialDirector();
