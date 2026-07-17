function installObjectiveMarkerGuard() {
  const scene = window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene");
  const system = scene?.objectiveMarkerSystem;

  if (!system) {
    window.requestAnimationFrame(installObjectiveMarkerGuard);
    return;
  }
  if (system.__nbdCinematicGuard) return;

  // The player-arrow implementation already hides itself during the intro,
  // dialogue sequences, layer transitions and post-tip gameplay.
  system.__nbdCinematicGuard = true;
}

installObjectiveMarkerGuard();
