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

  director.__nbdSilentPostTipPatch = true;
}

installSilentPostTipFlow();
