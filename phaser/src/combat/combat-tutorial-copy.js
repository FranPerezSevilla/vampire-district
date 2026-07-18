function attachCombatTutorialCopy() {
  const scene = window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene");
  const director = scene?.tutorialDirector;
  if (!scene || !director?.setTip) {
    window.requestAnimationFrame(attachCombatTutorialCopy);
    return;
  }
  if (director.__nbdCombatTutorialCopyPatch) return;

  const originalSetTip = director.setTip.bind(director);
  director.setTip = function setCombatTutorialTip(key, text, duration = 0) {
    const value = String(text || "");
    if (/only offensive action|única acción ofensiva/i.test(value)) {
      return originalSetTip(
        "MOUSE / RMB",
        "Aim with the mouse and left-click to knock him down. Then aim at him and hold the right mouse button to drain.",
        duration
      );
    }
    return originalSetTip(key, text, duration);
  };

  scene.events.on("combat:entity-downed", payload => {
    if (payload?.targetId !== "rooftop_thug" || director.state !== "drain-thug") return;
    director.setTip("RMB", "The thug is down. Aim at him and hold the right mouse button to drain.");
  });

  director.__nbdCombatTutorialCopyPatch = true;
}

attachCombatTutorialCopy();
