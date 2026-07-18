function attachMilestone5TutorialCopy() {
  const scene = window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene");
  const director = scene?.tutorialDirector;
  if (!scene || !director?.setTip) {
    window.requestAnimationFrame(attachMilestone5TutorialCopy);
    return;
  }
  if (director.__nbdMilestone5TutorialCopyPatch) return;

  const originalSetTip = director.setTip.bind(director);
  director.setTip = function setTraversalOnlySpaceTip(key, text, duration = 0) {
    const value = String(text || "");
    if (/hold SPACE to run|Pulsa ESPACIO para correr/i.test(value)) {
      return originalSetTip(
        "WASD / SPACE",
        "WASD or arrows run by default. Hold SHIFT to move quietly. Press SPACE near a route to jump, climb, descend or use a sewer.",
        duration
      );
    }
    return originalSetTip(key, text, duration);
  };

  director.__nbdMilestone5TutorialCopyPatch = true;
}

attachMilestone5TutorialCopy();
