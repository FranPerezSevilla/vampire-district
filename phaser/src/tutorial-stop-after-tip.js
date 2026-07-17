function finishTutorialSilently(director) {
  director.busy = false;
  director.state = "complete";
  director.freezeWorld?.(false);
  director.setControlMode?.("full");
  director.setTip?.("", "");
  document.getElementById("tutorial-dialogue")?.classList.remove("open");
  document.getElementById("tutorial-strip")?.classList.remove("visible");
}

function installSilentPostTipFlow() {
  const scene = window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene");
  const director = scene?.tutorialDirector;

  if (!director) {
    window.requestAnimationFrame(installSilentPostTipFlow);
    return;
  }
  if (director.__nbdSilentPostTipPatch) return;

  director.runFinalSireMessage = async function endTutorialWithoutFinalMessage() {
    finishTutorialSilently(this);
  };

  director.interceptTaskReveal = function suppressAllLaterTaskReveals() {
    return true;
  };

  const originalUpdate = director.update.bind(director);
  director.update = function updateUntilTipOnly(...args) {
    if (this.scene.missionSystem?.tipCollected) {
      finishTutorialSilently(this);
      return;
    }
    return originalUpdate(...args);
  };

  scene.events.off(Phaser.Scenes.Events.UPDATE, originalUpdate, director);
  scene.events.off(Phaser.Scenes.Events.UPDATE, director.update, director);
  scene.events.on(Phaser.Scenes.Events.UPDATE, director.update, director);

  director.__nbdSilentPostTipPatch = true;
}

installSilentPostTipFlow();
