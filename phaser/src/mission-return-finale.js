import { MissionSystem } from "./systems/MissionSystem.js";
import { RawAudio } from "./systems/RawAudioSystem.js";

const SIRE_APPROVAL = "Well done. You silenced the journalist and returned as ordered. The veil holds. You have served me well tonight.";

function isAtReturnObjective(mission) {
  if (!mission || mission.step !== 3 || mission.completed || mission.failed) return false;
  const marker = mission.marker?.();
  return Boolean(marker && marker.label === "REPORT" && mission.isNear?.(marker));
}

async function runReturnFinale(mission) {
  if (mission.__nbdReturnFinalePending || mission.completed || mission.failed) return;

  const scene = mission.scene;
  const director = scene?.tutorialDirector;
  if (!director?.showDialogue?.__nbdAnchoredDialoguePatch) return;

  mission.__nbdReturnFinalePending = true;
  director.busy = true;
  director.state = "mission-complete-sire";
  director.setTip?.("", "");
  director.setControlMode?.("locked");
  director.freezeWorld?.(true);

  try {
    await director.showDialogue({
      speaker: "TU SIRE · EN TU MENTE",
      text: SIRE_APPROVAL,
      kind: "thought",
      target: scene.player
    });

    // Restore the world state before publishing the result. UIScene will then
    // pause the game for the report modal, guaranteeing bubble -> report order.
    director.freezeWorld?.(false);
    director.state = "complete";
    director.busy = false;
    director.setControlMode?.("full");

    mission.step = 4;
    mission.completed = true;
    mission.lastMissionText = "Report complete. The veil still holds.";
    scene.lastActionText = "ORDER COMPLETE: the journalist is handled, you returned to the refuge, and the clan's veil still holds.";
    RawAudio.play("missionComplete");
    mission.publishResult("complete", "MISSION COMPLETE", "The journalist is silenced and the veil remains intact.");
    scene.redrawLayer(scene.lastActionText);
  } finally {
    // Keep failure paths recoverable if a presentation layer disappears during
    // development. Successful completion is already paused by the report modal.
    if (!mission.completed) {
      director.freezeWorld?.(false);
      director.state = "complete";
      director.busy = false;
      director.setControlMode?.("full");
      mission.__nbdReturnFinalePending = false;
    }
  }
}

function installReturnFinale() {
  if (MissionSystem.prototype.__nbdReturnFinalePatch) return;

  const originalUpdate = MissionSystem.prototype.update;
  MissionSystem.prototype.update = function updateWithReturnFinale(...args) {
    if (this.__nbdReturnFinalePending) return;

    if (isAtReturnObjective(this)) {
      void runReturnFinale(this);
      return;
    }

    return originalUpdate.apply(this, args);
  };

  MissionSystem.prototype.__nbdReturnFinalePatch = true;
}

installReturnFinale();
