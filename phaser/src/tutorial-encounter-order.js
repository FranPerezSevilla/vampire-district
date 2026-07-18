function installRooftopEncounterOrder() {
  const scene = window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene");
  const director = scene?.tutorialDirector;

  if (!director?.showDialogue?.__nbdAnchoredDialoguePatch) {
    window.requestAnimationFrame(installRooftopEncounterOrder);
    return;
  }
  if (director.__nbdRooftopEncounterOrderPatch) return;

  const previousUpdate = director.update;
  scene.events.off(Phaser.Scenes.Events.UPDATE, previousUpdate, director);

  director.runRooftopEncounter = async function runRooftopEncounter() {
    if (this.busy) return;

    this.busy = true;
    this.state = "thug-dialogue";
    this.setControlMode?.("locked");
    this.setTip?.("", "");
    this.freezeWorld?.(true);

    await this.showDialogue({
      speaker: "MATÓN",
      text: "No te dejaré pasar.",
      kind: "thug",
      targetId: "rooftop_thug"
    });

    this.state = "blocker-warning";
    await this.showDialogue({
      speaker: "TU SIRE · EN TU MENTE",
      text: "He stands between you and the police roof. Remove him. Drain him, and clear the way.",
      kind: "thought"
    });

    this.freezeWorld?.(false);
    this.state = "drain-thug";
    this.busy = false;
    this.setControlMode?.("drain");
    this.setTip?.("MOUSE / RMB", "Aim with the mouse and left-click to knock him down. Then aim at him and hold the right mouse button to drain.");
  };

  // Keep both older entry points safe in case another system invokes them directly.
  director.runBlockerWarning = function runBlockerWarningAfterThug() {
    return this.runRooftopEncounter();
  };
  director.runThugDialogue = function runThugDialogueBeforeSire() {
    return this.runRooftopEncounter();
  };

  director.update = function updateWithReorderedEncounter() {
    if (this.busy || !this.started) return;

    if (["rooftop-movement", "approach-thug"].includes(this.state) && this.distanceToThug() <= 58) {
      this.runRooftopEncounter();
      return;
    }

    if (this.state === "drain-thug") {
      const thug = this.thug();
      if (thug?.dead && thug.deathKind === "drained") this.runHungerLesson();
      return;
    }

    if (this.state === "reach-tip" && this.scene.missionSystem?.tipCollected) {
      this.runFinalSireMessage();
    }
  };

  scene.events.on(Phaser.Scenes.Events.UPDATE, director.update, director);
  director.__nbdRooftopEncounterOrderPatch = true;
}

installRooftopEncounterOrder();
