const HIDDEN_STATES = new Set([
  "waiting",
  "intro",
  "blocker-warning",
  "thug-dialogue",
  "hunger-lesson",
  "final-sire"
]);

function installObjectiveMarkerGuard() {
  const scene = window.NBD_PHASER_GAME?.scene?.getScene?.("GameScene");
  const system = scene?.objectiveMarkerSystem;

  if (!system) {
    window.requestAnimationFrame(installObjectiveMarkerGuard);
    return;
  }
  if (system.__nbdCinematicGuard) return;

  const originalObjective = system.objective.bind(system);
  system.objective = function objectiveOutsideCinematics() {
    const director = this.scene.tutorialDirector;
    const modalOpen = document.getElementById("ui-modal")?.classList.contains("open");
    const tutorialBlocked = director?.started && (director.busy || HIDDEN_STATES.has(director.state));
    return modalOpen || tutorialBlocked ? null : originalObjective();
  };

  system.__nbdCinematicGuard = true;
}

installObjectiveMarkerGuard();
