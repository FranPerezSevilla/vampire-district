import { SILENCE_THE_JOURNALIST_ID } from "../campaign/missions/silenceTheJournalist.js";
import {
  MissionSystem as MissionSystemCore,
  RETURN_FINALE_COPY
} from "./MissionSystemCore.js";

// The inherited core owns the scene fallback through globalThis.NBD_CAMPAIGN_SYSTEM
// and all typed progression calls through this.campaign.handle. This facade only
// specializes compatibility and mission-start presentation; it does not own a
// second progression state.
export class MissionSystem extends MissionSystemCore {
  displayRecord() {
    const activeMissionId = this.campaign.state.missions.activeMissionId;
    return this.missionRecord(
      activeMissionId || this.presentationMissionId || SILENCE_THE_JOURNALIST_ID
    );
  }

  handleCampaignEvent(event) {
    const missionId = event?.payload?.missionId;
    if (!missionId) return;
    if (event.type === "mission:started") {
      this.presentationMissionId = missionId;
      this.lastPublishedStep = null;
    } else if (this.campaign.state.missions.activeMissionId === missionId) {
      this.presentationMissionId = missionId;
    }
    if (missionId !== this.presentationMissionId) return;

    const actionText = this.nextActionText || this.actionTextForCurrentState(event.type);
    this.nextActionText = "";
    this.syncFromCampaign({
      actionText,
      emitStep: missionId === SILENCE_THE_JOURNALIST_ID,
      redraw: true
    });
  }
}

export { RETURN_FINALE_COPY };