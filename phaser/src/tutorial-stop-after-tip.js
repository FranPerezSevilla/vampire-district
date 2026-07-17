function finishTutorialSilently(director) {
  director.busy = false;
  director.state = "complete";
  director.freezeWorld?.(false);
  director.setControlMode?.("full");
  director.setTip?.("", "");
  document.getElementById("tutorial-dialogue")?.classList.remove("open");
  document.getElementById("tutorial-strip")?.classList.remove("visible");
}

function installFinalPostTipAdvice() {
  const scene = window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene");
  const director = scene?.tutorialDirector;

  if (!director) {
    window.requestAnimationFrame(installFinalPostTipAdvice);
    return;
  }
  if (director.__nbdFinalPostTipAdvicePatch) return;

  director.runFinalSireMessage = async function showOneFinalSireAdvice() {
    if (this.__nbdFinalAdviceShown) {
      finishTutorialSilently(this);
      return;
    }

    this.__nbdFinalAdviceShown = true;
    this.busy = true;
    this.state = "final-sire";
    this.setControlMode?.("locked");
    this.setTip?.("", "");
    this.freezeWorld?.(true);

    await this.showDialogue({
      speaker: "TU SIRE · EN TU MENTE",
      text: "Acaba con él y vuelve al refugio. No la cagues.",
      kind: "thought"
    });

    finishTutorialSilently(this);
  };

  // Mission changes after the police tip never trigger another sire message.
  director.interceptTaskReveal = function suppressAllLaterTaskReveals() {
    return true;
  };

  director.__nbdFinalPostTipAdvicePatch = true;
}

installFinalPostTipAdvice();
