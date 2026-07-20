import { MissionBoardSystem as MissionBoardSystemCore } from "./MissionBoardSystemCore.js";
import { CLEAN_THE_SCENE_ID } from "./missions/cleanTheScene.js";

// Successful acceptance closes the board while the action is still marked busy.
// Clear that transient UI lock after the overlay is gone so the same first-class
// system can reopen when a completed contract report is dismissed.
export class MissionBoardSystem extends MissionBoardSystemCore {
  close(status = "Contract board closed.") {
    const closed = super.close(status);
    if (closed) this.setBusy(false);
    return closed;
  }

  handleResultDismissed(result = {}) {
    const boardContractCompleted = result?.missionId === CLEAN_THE_SCENE_ID
      && result?.status === "complete";
    if (boardContractCompleted) {
      this.scene.statePublisher?.set?.("missionResult", null)
        || this.scene.registry?.set?.("missionResult", null);
      if (this.scene.missionSystem) {
        this.scene.missionSystem.presentationMissionId = null;
        this.scene.missionSystem.lastPublishedStep = null;
        this.scene.missionSystem.syncFromCampaign?.({
          force: true,
          emitStep: false,
          redraw: true
        });
      }
    }
    return super.handleResultDismissed(result);
  }

  destroy() {
    this.busy = false;
    super.destroy();
  }
}